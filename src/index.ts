import { Context, h, Session } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {} from '@koishijs/canvas'
import { createAvatarLoader, nicknameFontFace, readAssets } from './assets'
import { renderCard } from './card'
import { renderChart } from './chart'
import { Config } from './config'
import { defineTables, RankEntry } from './model'
import { channelRank, globalRank } from './rank'

export { Config }
export const name = 'monetary-rank'
export const inject = {
  required: ['database', 'monetary'],
  optional: ['puppeteer', 'canvas'],
}

export const usage = `## 使用

在 Koishi 配置中启用，并提供 database 与 monetary 服务；另需启用 \`bind\` 插件。图表显示需要 puppeteer 与 canvas，资源与 [message-counter](https://github.com/araea/koishi-plugin-message-counter) 共用 \`data/messageCounter/\`。

## 指令

| 指令 | 说明 |
| --- | --- |
| \`mrank\` | 帮助 |
| \`mrank.本频道排行榜 [数量]\` | 本频道排行榜 |
| \`mrank.跨频道排行榜 [数量]\` | 跨频道排行榜 |
| \`mrank.查询 [@某人]\` | 查询货币余额 |

用 \`-c <货币种类>\` 可以临时指定货币。`

/** 昵称/头像同上次一致时跳过写库，避免每条消息都读写数据库。 */
const SYNC_CACHE_MAX = 4096

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name)
  defineTables(ctx)

  const loadAvatar = createAvatarLoader(ctx)
  const icons = readAssets(ctx, 'icons')
  const backgrounds = readAssets(ctx, 'barBgImgs')
  const synced = new Map<string, string>()

  ctx.on('message', async (session) => {
    if (!session.channelId || !session.userId) return
    const username = session.author?.nick || session.author?.name || '神秘人'
    const avatar = session.author?.avatar || ''
    const key = `${session.platform}:${session.channelId}:${session.userId}`
    if (synced.get(key) === `${username}\n${avatar}`) return

    const [record] = await ctx.database.get('username', {
      platform: session.platform,
      channelId: session.channelId,
      userId: session.userId,
    })
    if (!record) {
      const [binding] = await ctx.database.get('binding', {
        pid: session.userId,
        platform: session.platform,
      })
      if (!binding) return
      await ctx.database.create('username', {
        uid: binding.aid,
        userId: session.userId,
        avatar,
        platform: session.platform,
        username,
        channelId: session.channelId,
      })
    } else if (record.username !== username || record.avatar !== avatar) {
      await ctx.database.set('username', { id: record.id }, { username, avatar })
    }

    if (synced.size >= SYNC_CACHE_MAX) synced.clear()
    synced.set(key, `${username}\n${avatar}`)
  })

  /**
   * 截图。
   *
   * 柱状榜的宽度取决于最长的那串数额，页面自己在 `body` 上写死了，所以先按一个
   * 保守的视口渲染，再回读 `scrollWidth` 把视口收到正好——不这么做，窄视口会让
   * 轨道被横向裁掉，宽视口又会在右边留一大条空白。高度一律交给 fullPage。
   */
  async function screenshot(html: string, { width = 1080, scale = 1, fit = false } = {}) {
    const page = await ctx.puppeteer.page()
    try {
      await page.setViewport({ width, height: 256, deviceScaleFactor: scale })
      await page.setContent(html, { waitUntil: config.waitUntil })
      // 昵称字体是内联的 @font-face，加载完再量宽度、再截图；
      // 量早了会按回退字体算，轨道右侧的留白就不对了
      await page.evaluate(async () => {
        await (document as any).fonts?.ready
      })
      if (fit) {
        const measured = await page.evaluate(() => document.body.scrollWidth)
        if (measured > 0) {
          await page.setViewport({ width: Math.ceil(measured), height: 256, deviceScaleFactor: scale })
        }
      }
      return await page.screenshot({ type: 'png', fullPage: true })
    } finally {
      await page.close()
    }
  }

  /**
   * 文本榜单。整条消息五行封顶：标题一行，内容最多四行，更多时压到三行并留一行尾注。
   * 昵称可能带尖括号，用 h.text 包住避免被当成消息元素解析。
   */
  function textBoard(title: string, rows: RankEntry[]) {
    const shown = rows.length > 4 ? rows.slice(0, 3) : rows
    const hidden = rows.length - shown.length
    return h.text([
      `📋 ${title}`,
      ...shown.map((row, index) => `${index + 1}. ${row.username}（${row.userId}） · ${row.value}`),
      hidden > 0 ? `…… 另有 ${hidden} 人未列` : null,
    ].filter(Boolean).join('\n'))
  }

  async function present(session: Session, title: string, currency: string, rows: RankEntry[]) {
    if (!rows.length) return '📋 排行榜还空着\n这里按余额排名，有人持有货币后就会出现。\n发送「mrank.查询」看自己的余额。'
    if (!config.isLeaderboardDisplayedAsImage || !ctx.puppeteer) {
      return textBoard(title, rows)
    }

    try {
      if (config.style === '3') {
        return h.image(await screenshot(renderCard(title, rows, currency), { width: 560, scale: 2 }), 'image/png')
      }
      const chartRows = await Promise.all(rows.map(async (row) => {
        const avatar = await loadAvatar(row.avatar)
        return {
          name: row.username,
          userId: row.userId,
          count: row.value,
          avatarBase64: avatar.base64,
          accent: avatar.accent,
        }
      }))
      // 元信息行与 message-counter 的榜单同一种写法：范围、合计、出图时间
      const sum = chartRows.reduce((carry, row) => carry + row.count, 0)
      const stamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      const subtitle = [
        `${chartRows.length} 位`,
        `合计 ${sum.toLocaleString('en-US')} ${h.escape(currency)}`,
        stamp,
      ].join('<span class="sep">·</span>')
      const html = renderChart(title, subtitle, chartRows, icons, backgrounds, {
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity: config.horizontalBarBackgroundFullOpacity,
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
      }, nicknameFontFace(ctx))
      return h.image(await screenshot(html, { fit: true }), 'image/png')
    } catch (error) {
      logger.error('生成排行榜图片失败：%s', error.stack || error.message)
      return textBoard(title, rows)
    }
  }

  const cmd = ctx.command('mrank', '通用货币排行榜')
    .alias('monetaryRank')
    .action(({ session }) => session.execute('help mrank'))

  // 指令主名取短的，长名保留为别名，老用户输入不受影响。
  cmd.subcommand('.本频道排行榜 [count:posint]', '查看本频道排行榜')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, count) => {
      const limit = count || config.defaultLeaderboardDisplayCount
      const currency = options.currency || config.defaultCurrency
      return present(session, '本频道个人货币排行榜', currency,
        await channelRank(ctx, session.platform, session.channelId, currency, limit))
    })

  cmd.subcommand('.跨频道排行榜 [count:posint]', '查看跨频道排行榜')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, count) => {
      const limit = count || config.defaultLeaderboardDisplayCount
      const currency = options.currency || config.defaultCurrency
      return present(session, '跨频道个人货币排行榜', currency,
        await globalRank(ctx, session.platform, currency, limit))
    })

  cmd.subcommand('.查询 [target:user]', '查询货币余额')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, target) => {
      const userId = target ? target.split(':')[1] : session.userId
      // 查自己用「你」，查他人用 @；只有 @ 元素后面需要留一个空格。
      const who = userId === session.userId ? ['你'] : [h.at(userId), ' ']
      const [binding] = await ctx.database.get('binding', { pid: userId, platform: session.platform })
      if (!binding) {
        return ['💡 ', ...who, '还没有账户\n货币账户由 `bind` 插件在首次绑定时创建。\n发送「bind」绑定后，余额就会出现在这里。']
      }

      const records = await ctx.database.get('monetary', options.currency
        ? { uid: binding.aid, currency: options.currency }
        : { uid: binding.aid })

      if (!records.length) {
        return options.currency
          ? ['💡 ', ...who, `还没有「${options.currency}」的记录。`]
          : ['💡 ', ...who, '还没有任何货币记录。']
      }
      if (records.length === 1) {
        return ['📋 ', ...who, `的 ${records[0].currency} 余额为 ${records[0].value}。`]
      }
      const lines = records.map((row) => `• ${row.currency}：${row.value}`)
      const shown = lines.length > 4 ? lines.slice(0, 3) : lines
      const hidden = lines.length - shown.length
      const body = shown.join('\n') + (hidden > 0 ? `\n…… 另有 ${hidden} 种未列` : '')
      return ['📋 ', ...who, '的货币余额：\n', body]
    })
}
