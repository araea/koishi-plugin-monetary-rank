import { Context } from 'koishi'
import {} from '@koishijs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import fallbackBase64 from './data/fallbackBase64.json'

export interface Asset {
  userId: string
  base64: string
}

/** 头像统一缩到 50×50，够画榜单了。 */
const AVATAR_SIZE = 50
const AVATAR_CACHE_MAX = 512

/**
 * 读取 `data/messageCounter` 下的自定义素材，与 message-counter 插件共用同一个目录。
 * 文件名即用户 ID，`1234-1.png` 这样的后缀用于给同一个人放多张图。
 */
export function readAssets(ctx: Context, folder: string): Asset[] {
  const dir = path.join(ctx.baseDir, 'data', 'messageCounter', folder)
  try {
    fs.mkdirSync(dir, { recursive: true })
    return fs.readdirSync(dir).map((file) => ({
      userId: path.parse(file).name.split('-')[0].trim(),
      base64: fs.readFileSync(path.join(dir, file)).toString('base64'),
    }))
  } catch (error) {
    ctx.logger('monetary-rank').warn('读取 %s 失败：%s', dir, error.message)
    return []
  }
}

export function createAvatarLoader(ctx: Context) {
  const logger = ctx.logger('monetary-rank')
  const cache = new Map<string, string>()

  return async function load(url: string): Promise<string> {
    if (!url || !ctx.canvas) return fallbackBase64[0]
    const cached = cache.get(url)
    if (cached) return cached

    try {
      const buffer = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 5000 })
      const image = await ctx.canvas.loadImage(buffer)
      const canvas = await ctx.canvas.createCanvas(AVATAR_SIZE, AVATAR_SIZE)
      canvas.getContext('2d').drawImage(image, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
      const base64 = (await canvas.toBuffer('image/png')).toString('base64')
      // 缓存满了就整体丢弃，头像本来就允许过期
      if (cache.size >= AVATAR_CACHE_MAX) cache.clear()
      cache.set(url, base64)
      return base64
    } catch (error) {
      logger.warn('获取头像失败（%s）：%s', url, error.message)
      return fallbackBase64[0]
    }
  }
}
