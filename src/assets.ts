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

/**
 * 昵称与读数用的字体。
 *
 * message-counter 的行内文字走它随包带的 `HarmonyOS_Sans_Medium`（用户可以在
 * 那边换成别的字体，默认就是这一支）。两个插件的榜单会在同一个群里前后脚出现，
 * 字体不同一眼就是两张图，所以这里把同一支字体读进来、内联成 @font-face。
 * 取不到就退回页面字体栈，不报错——这个文件由 message-counter 在启动时铺好，
 * 没装它的时候图表仍然出得来。
 */
export const NICKNAME_FONT = 'HarmonyOS_Sans_Medium'
const NICKNAME_FONT_FILE = 'HarmonyOS_Sans_Medium.ttf'

let fontFaceCache = ''

export function nicknameFontFace(ctx: Context): string {
  if (fontFaceCache) return fontFaceCache
  const file = path.join(ctx.baseDir, 'data', 'messageCounter', 'fonts', NICKNAME_FONT_FILE)
  try {
    const base64 = fs.readFileSync(file).toString('base64')
    fontFaceCache = `@font-face{font-family:'${NICKNAME_FONT}';src:url('data:font/ttf;base64,${base64}') format('truetype')}`
    return fontFaceCache
  } catch {
    return ''
  }
}

/** 头像加载结果：base64 图与一枚用于配色的主色。 */
export interface Avatar {
  base64: string
  /** 头像像素的平均色，取不到时为空串。 */
  accent: string
}

/**
 * 头像主色：与 ayjx 的 `get_average_color` 逐字对应。
 *
 * 那边取的是**圆裁之后**的缩略图，圆外算作纯黑（`make_circular_avatar` 把圆外
 * 留成透明，而求平均时不看 alpha、只累加 RGB），这里照做：只有落在圆里的像素
 * 参与累加，分母仍是整张缩略图的像素数，最后整数除法（向下取整）。
 * message-counter 那边取主色也必须是这一份，两个插件算出来才相等。
 *
 * 设备像素差：ayjx 在 100×100 上用 Lanczos3 缩放，这里是 50×50 的画布重采样，
 * 圆覆盖率与滤波器都略有出入，主色因此可能差一两个单位。
 */
function averageColor(data: Uint8ClampedArray, size: number) {
  const center = size / 2
  const radius = center - 1
  let r = 0
  let g = 0
  let b = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center + 0.5
      const dy = y - center + 0.5
      if (Math.hypot(dx, dy) > radius + 0.5) continue
      const i = (y * size + x) * 4
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
    }
  }
  const count = size * size
  return '#' + [r, g, b]
    .map((sum) => Math.floor(sum / count).toString(16).padStart(2, '0'))
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
        accent = averageColor(context.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE).data, AVATAR_SIZE)
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
