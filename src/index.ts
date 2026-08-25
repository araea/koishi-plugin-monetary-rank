import { Context, h, Session } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {} from '@koishijs/canvas'
import { createAvatarLoader, readAssets } from './assets'
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

export const usage = `## 注意事项

- 需要启用 \`bind\` 插件。
- 用户第一次发言时才会记录昵称与头像，刚装好时榜单是空的。

## 自定义水平柱状图（样式 2，与发言排行榜共用文件夹）

1. 用户图标：放在 \`data/messageCounter/icons\`，文件名为用户 ID（如 \`1234567890.png\`）。
   同一个人可放多张，命名为 \`1234567890-1.png\`、\`1234567890-2.png\`，它们会同时显示。
2. 柱状条背景：放在 \`data/messageCounter/barBgImgs\`，命名规则同上，多张时随机取一张。
   建议尺寸 850×50。

> 改动后需重启插件生效。

## QQ 群

- 956758505`

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

  /** 截图；`measure` 用于样式 2——画布宽度要等脚本跑完才知道。 */
  async function screenshot(html: string, { width = 1080, scale = 1, measure = false } = {}) {
    const page = await ctx.puppeteer.page()
    try {
      await page.setViewport({ width, height: 256, deviceScaleFactor: scale })
      await page.setContent(html, { waitUntil: config.waitUntil })
      if (measure) {
        const measured = await page.evaluate(() => {
          const canvas = document.getElementById('rankingCanvas') as HTMLCanvasElement
          return canvas ? canvas.width + 40 : 1080
        })
        await page.setViewport({ width: Math.ceil(measured), height: 256, deviceScaleFactor: scale })
      }
      return await page.screenshot({ type: 'png', fullPage: true })
    } finally {
      await page.close()
    }
  }

  async function present(session: Session, title: string, rows: RankEntry[]) {
    if (!rows.length) return '暂无数据。'
    if (!config.isLeaderboardDisplayedAsImage || !ctx.puppeteer) {
      // 昵称可能带尖括号，用 h.text 包住避免被当成消息元素解析
      return h.text([`${title}：`, ...rows.map((row, index) =>
        `${index + 1}. ${row.username}（${row.userId}） - ${row.value}`)].join('\n'))
    }

    try {
      if (config.style === '3') {
        return h.image(await screenshot(renderCard(title, rows), { width: 550, scale: 2 }), 'image/png')
      }
      const chartRows = await Promise.all(rows.map(async (row) => ({
        name: row.username,
        userId: row.userId,
        count: row.value,
        avatarBase64: await loadAvatar(row.avatar),
      })))
      const subtitle = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      const html = renderChart(title, subtitle, chartRows, icons, backgrounds, {
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity: config.horizontalBarBackgroundFullOpacity,
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
      })
      return h.image(await screenshot(html, { measure: true }), 'image/png')
    } catch (error) {
      logger.error('生成排行榜图片失败：%s', error.stack || error.message)
      return '生成排行榜图片失败，请查看后台日志。'
    }
  }

  const cmd = ctx.command('monetaryRank', '通用货币排行榜')
    .action(({ session }) => session.execute('help monetaryRank'))

  cmd.subcommand('.本群个人货币排行榜 [count:posint]', '查看本群货币排行榜')
    .alias('monetaryRank.本群榜')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, count) => {
      const limit = count || config.defaultLeaderboardDisplayCount
      const currency = options.currency || config.defaultCurrency
      return present(session, '本群个人货币排行榜',
        await channelRank(ctx, session.platform, session.channelId, currency, limit))
    })

  cmd.subcommand('.跨群个人货币排行榜 [count:posint]', '查看跨群货币排行榜')
    .alias('monetaryRank.跨群榜')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, count) => {
      const limit = count || config.defaultLeaderboardDisplayCount
      const currency = options.currency || config.defaultCurrency
      return present(session, '跨群个人货币排行榜',
        await globalRank(ctx, session.platform, currency, limit))
    })

  cmd.subcommand('.查询货币 [target:user]', '查询货币余额')
    .alias('monetaryRank.查询')
    .option('currency', '-c <currency:string> 指定货币种类')
    .action(async ({ session, options }, target) => {
      const userId = target ? target.split(':')[1] : session.userId
      const [binding] = await ctx.database.get('binding', { pid: userId, platform: session.platform })
      if (!binding) return '未找到该用户的账户信息。'

      const who = userId === session.userId ? '你' : h.at(userId)
      const records = await ctx.database.get('monetary', options.currency
        ? { uid: binding.aid, currency: options.currency }
        : { uid: binding.aid })

      if (!records.length) {
        return options.currency
          ? [who, ` 没有 ${options.currency} 货币的记录。`]
          : [who, ' 还没有任何货币记录。']
      }
      if (records.length === 1) {
        return [who, ` 的 ${records[0].currency} 余额为 ${records[0].value}`]
      }
      return [who, ' 的货币余额：\n', records.map((row) => `${row.currency}: ${row.value}`).join('\n')]
    })
}
