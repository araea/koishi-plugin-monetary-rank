import { Context } from 'koishi'
import { Binding, RankEntry, Username } from './model'

const FALLBACK_AVATAR = ''
const FALLBACK_NAME = '神秘人'

function avatarOf(platform: string, userId: string, stored?: string) {
  // QQ 头像可以直接由号码拼出来，比库里那份可能过期的链接更可靠
  if (platform === 'onebot' && /^\d+$/.test(userId)) return `https://q.qlogo.cn/g?b=qq&s=640&nk=${userId}`
  return stored || FALLBACK_AVATAR
}

/** 把 uid 补全成带昵称、头像的排行榜条目。 */
async function decorate(ctx: Context, platform: string, rows: { uid: number; value: number }[]): Promise<RankEntry[]> {
  if (!rows.length) return []
  const uid = rows.map((row) => row.uid)
  const [names, bindings] = await Promise.all([
    ctx.database.get('username', { uid, platform }),
    ctx.database.get('binding', { aid: uid, platform }),
  ])

  const nameMap = new Map<number, Username>(names.map((row) => [row.uid, row]))
  const bindingMap = new Map<number, Binding>(bindings.map((row) => [row.aid, row]))

  return rows.map(({ uid, value }) => {
    const name = nameMap.get(uid)
    const userId = name?.userId ?? bindingMap.get(uid)?.pid ?? String(uid)
    return {
      uid,
      userId,
      username: name?.username || FALLBACK_NAME,
      avatar: avatarOf(platform, userId, name?.avatar),
      value: Math.round(value),
    }
  })
}

/** 全平台按余额排序的前 N 名。 */
export async function globalRank(ctx: Context, platform: string, currency: string, limit: number) {
  const rows = await ctx.database
    .select('monetary')
    .where({ currency })
    .orderBy('value', 'desc')
    .limit(limit)
    .execute()
  return decorate(ctx, platform, rows)
}

/** 只统计在本频道发过言的人。 */
export async function channelRank(ctx: Context, platform: string, channelId: string, currency: string, limit: number) {
  const members = await ctx.database.get('username', { platform, channelId }, ['uid'])
  if (!members.length) return []
  const rows = await ctx.database
    .select('monetary')
    .where({ currency, uid: members.map((row) => row.uid) })
    .orderBy('value', 'desc')
    .limit(limit)
    .execute()
  return decorate(ctx, platform, rows)
}
