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

/** 头像加载结果：base64 图与一枚用于配色的主色。 */
export interface Avatar {
  base64: string
  /** 头像像素的平均色，取不到时为空串。 */
  accent: string
}

/** 把像素缓冲取平均，得到一枚代表色。 */
function averageColor(data: Uint8ClampedArray) {
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let i = 0; i < data.length; i += 4) {
    // 透明像素不参与平均，否则带透明边的头像会被整体拉灰
    const alpha = data[i + 3] / 255
    if (!alpha) continue
    r += data[i] * alpha
    g += data[i + 1] * alpha
    b += data[i + 2] * alpha
    weight += alpha
  }
  if (!weight) return ''
  return '#' + [r, g, b]
    .map((sum) => Math.round(sum / weight).toString(16).padStart(2, '0'))
    .join('')
}

export function createAvatarLoader(ctx: Context) {
  const logger = ctx.logger('monetary-rank')
  const cache = new Map<string, Avatar>()
  const fallback: Avatar = { base64: fallbackBase64[0], accent: '' }

  return async function load(url: string): Promise<Avatar> {
    if (!url || !ctx.canvas) return fallback
    const cached = cache.get(url)
    if (cached) return cached

    try {
      const buffer = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 5000 })
      const image = await ctx.canvas.loadImage(buffer)
      const canvas = await ctx.canvas.createCanvas(AVATAR_SIZE, AVATAR_SIZE)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

      // 主色顺手在缩略图上取，比原图快，精度也足够
      let accent = ''
      try {
        accent = averageColor(context.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE).data)
      } catch {
        // 某些 canvas 实现不支持读回像素，配色退回主题色即可
      }

      const avatar: Avatar = { base64: (await canvas.toBuffer('image/png')).toString('base64'), accent }
      // 缓存满了就整体丢弃，头像本来就允许过期
      if (cache.size >= AVATAR_CACHE_MAX) cache.clear()
      cache.set(url, avatar)
      return avatar
    } catch (error) {
      logger.warn('获取头像失败（%s）：%s', url, error.message)
      return fallback
    }
  }
}
