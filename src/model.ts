import { Context } from 'koishi'

declare module 'koishi' {
  interface Tables {
    username: Username
    monetary: Monetary
  }
}

export interface Monetary {
  uid: number
  value: number
  currency: string
}

/** 用户在某个频道最近一次发言时的昵称与头像，用于给排行榜配名字。 */
export interface Username {
  id: number
  uid: number
  userId: string
  avatar?: string
  platform: string
  username: string
  channelId: string
}

export interface Binding {
  pid: string
  bid: number
  aid: number
  platform: string
}

/** 排行榜的一行。 */
export interface RankEntry {
  uid: number
  userId: string
  username: string
  avatar: string
  value: number
}

export function defineTables(ctx: Context) {
  ctx.model.extend('username', {
    id: 'unsigned',
    uid: 'unsigned',
    userId: 'string',
    avatar: 'string',
    platform: 'string',
    username: 'string',
    channelId: 'string',
  }, { primary: 'id', autoInc: true })
}
