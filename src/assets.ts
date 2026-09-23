import { Context } from 'koishi'
import {} from '@koishijs/canvas'
import {} from 'koishi-plugin-puppeteer'
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

type Rgb = [number, number, number]

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const rgbToHex = (color: Rgb) =>
  '#' + color.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')

/** RGB → HSL，H 为 0—360，S/L 为 0—1；`chart.ts` 里是同一份。 */
function toHsl(color: Rgb): Rgb {
  const [r, g, b] = color.map((value) => value / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (Math.abs(d) < 1e-6) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r
    ? 60 * (((g - b) / d) % 6)
    : max === g
      ? 60 * ((b - r) / d + 2)
      : 60 * ((r - g) / d + 4)
  return [(h + 360) % 360, s, l]
}

/** HSL → RGB；`chart.ts` 里是同一份。 */
function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2
  const channel = (value: number) => clamp(Math.round(clamp(value + m, 0, 1) * 255), 0, 255)
  return [channel(r), channel(g), channel(b)]
}

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
  /** 头像的调子（acumen 的 avatar_theme_color），取不到时为空串。 */
  accent: string
}

/** 取不到头像时的兜底图，也是判断「这一行没有头像」的依据。 */
export const FALLBACK_AVATAR: string = fallbackBase64[0]

/**
 * 头像主色：与 acumen 的 `avatar_theme_color` 逐字对应。
 *
 * **色相与彩度取「有颜色的那部分」的均色，明度取整张图的均色。** 一大半头像是
 * 「大片白底 + 中间一小块彩色」，白底一平均就把那一小块的方向稀释到快没有了；
 * 所以给每个像素按它自己的彩度加一份权重（`+0.04` 的底让纯灰头像退化成朴素平均）。
 * 明度仍按整张图算，否则一张暗底亮标的头像会被那一点亮色带偏。最后把明度落进
 * 收调的窄带里——那个窄带就是 `chart.ts` 里 `harmonizeTheme` 随后要 clamp 到的那一段。
 *
 * 圆内像素才参与：acumen 缓存里存的是**圆裁之后**的缩略图，圆外透明、不计入，
 * 这里没有那一步，所以圆外的像素由这道遮罩剔除，两边看到的是同一批像素。
 * message-counter 那边取主色也必须是这一份，两个插件算出来才相等。
 *
 * 设备像素差：acumen 在 100×100 上用 Lanczos3 缩放，这里是 50×50 的画布重采样，
 * 圆覆盖率与滤波器都略有出入，主色因此可能差一两个单位。
 */
function themeColorOf(data: Uint8ClampedArray, size: number): string {
  const center = size / 2
  const radius = center - 1
  const inside: Rgb[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center + 0.5
      const dy = y - center + 0.5
      if (Math.hypot(dx, dy) > radius + 0.5) continue
      const i = (y * size + x) * 4
      inside.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  return avatarThemeColor(inside)
}

/** [`themeColorOf`] 的算法本体：一批圆内像素 → 这一行的主色。 */
function avatarThemeColor(inside: Rgb[]): string {
  if (!inside.length) return ''
  let r = 0
  let g = 0
  let b = 0
  for (const pixel of inside) {
    r += pixel[0]
    g += pixel[1]
    b += pixel[2]
  }
  const plain: Rgb = [
    Math.floor(r / inside.length),
    Math.floor(g / inside.length),
    Math.floor(b / inside.length),
  ]

  // 色相与彩度来自按彩度加权的那一版
  let tr = 0
  let tg = 0
  let tb = 0
  let weight = 0
  for (const pixel of inside) {
    const chroma = (Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])) / 255
    const w = chroma + 0.04
    tr += pixel[0] * w
    tg += pixel[1] * w
    tb += pixel[2] * w
    weight += w
  }
  if (weight <= 0) return rgbToHex(plain)
  const tinted: Rgb = [Math.round(tr / weight), Math.round(tg / weight), Math.round(tb / weight)]

  // 明度**在收调的窄带里**还原，不用原样的那个值：一张白底头像的均色明度贴着顶，
  // 在那个明度上 HSL 根本表达不出多少彩度，刚捞回来的色相会被重新压扁。
  const [h, s] = toHsl(tinted)
  const l = toHsl(plain)[2]
  return rgbToHex(fromHsl(h, s, clamp(l, 0.36, 0.50)))
}

/** 按文件头认浏览器能解的几种位图：PNG、JPEG、GIF、WebP、BMP。 */
function looksLikeImage(bytes: Buffer) {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  return startsWith(0x89, 0x50, 0x4e, 0x47)
    || startsWith(0xff, 0xd8, 0xff)
    || startsWith(0x47, 0x49, 0x46, 0x38)
    || (startsWith(0x52, 0x49, 0x46, 0x46) && bytes.toString('ascii', 8, 12) === 'WEBP')
    || startsWith(0x42, 0x4d)
}

export function createAvatarLoader(ctx: Context) {
  const logger = ctx.logger('monetary-rank')
  const cache = new Map<string, Avatar>()
  const fallback: Avatar = { base64: FALLBACK_AVATAR, accent: '' }

  return async function load(url: string): Promise<Avatar> {
    if (!url) return fallback
    const cached = cache.get(url)
    if (cached) return cached

    try {
      const buffer = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 5000 })

      let base64 = ''
      let accent = ''
      if (ctx.canvas) {
        const image = await ctx.canvas.loadImage(buffer)
        const canvas = await ctx.canvas.createCanvas(AVATAR_SIZE, AVATAR_SIZE)
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

        // 主色顺手在缩略图上取，比原图快，精度也足够
        try {
          accent = themeColorOf(context.getImageData(0, 0, AVATAR_SIZE, AVATAR_SIZE).data, AVATAR_SIZE)
        } catch {
          // 某些 canvas 实现不支持读回像素，配色退回主题色即可
        }

        base64 = (await canvas.toBuffer('image/png')).toString('base64')
      } else {
        // 没有 canvas 服务：原图直接交给浏览器，缩略图与主色都在那边做。
        // 这里没人解码，状态码 200 的错误页也会被当成头像缓存下来，所以先认一下文件头
        const bytes = Buffer.from(buffer as ArrayBuffer)
        if (!looksLikeImage(bytes)) throw new Error(`返回的不是图片（${bytes.length} 字节）`)
        base64 = bytes.toString('base64')
      }

      const avatar: Avatar = { base64, accent }
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

/**
 * 浏览器里跑的那一份取色，写成字符串交给 page.evaluate。
 *
 * 不能直接传函数：构建时 esbuild 会给函数体里的每个具名箭头函数包上 `__name(...)`，
 * 这个辅助函数只存在于 Node 侧，函数体序列化进页面后就是未定义名——3.2.1 到 3.4.0
 * 一走这条路就抛 `ReferenceError: __name is not defined`，图片榜整体退回文字榜。
 * 写成字符串，打包器就碰不到它。
 */
const MEASURE_ACCENTS_SCRIPT = `async (list) => {
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
  const rgbToHex = (color) =>
    '#' + color.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')
  const toHsl = (color) => {
    const [r, g, b] = color.map((value) => value / 255)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (Math.abs(d) < 1e-6) return [0, 0, l]
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)
    return [(h + 360) % 360, s, l]
  }
  const fromHsl = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const hp = (h % 360) / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
    const m = l - c / 2
    const channel = (value) => clamp(Math.round(clamp(value + m, 0, 1) * 255), 0, 255)
    return [channel(r), channel(g), channel(b)]
  }

  const measure = async (base64) => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + base64
    await new Promise((resolve) => {
      image.onload = resolve
      image.onerror = resolve
    })
    if (!image.width) return ''
    const size = 50
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = size
    canvas.height = size
    context.drawImage(image, 0, 0, size, size)

    const center = size / 2
    const radius = center - 1
    const data = context.getImageData(0, 0, size, size).data
    const inside = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center + 0.5
        const dy = y - center + 0.5
        if (Math.hypot(dx, dy) > radius + 0.5) continue
        const i = (y * size + x) * 4
        inside.push([data[i], data[i + 1], data[i + 2]])
      }
    }
    if (!inside.length) return ''
    // 明度取整张图的均色，色相与彩度取按彩度加权的那一版
    let r = 0
    let g = 0
    let b = 0
    let tr = 0
    let tg = 0
    let tb = 0
    let weight = 0
    for (const pixel of inside) {
      r += pixel[0]
      g += pixel[1]
      b += pixel[2]
      const chroma = (Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])) / 255
      const w = chroma + 0.04
      tr += pixel[0] * w
      tg += pixel[1] * w
      tb += pixel[2] * w
      weight += w
    }
    const plain = [Math.floor(r / inside.length), Math.floor(g / inside.length), Math.floor(b / inside.length)]
    if (weight <= 0) return rgbToHex(plain)
    const tinted = [Math.round(tr / weight), Math.round(tg / weight), Math.round(tb / weight)]
    const [h, s] = toHsl(tinted)
    const l = toHsl(plain)[2]
    return rgbToHex(fromHsl(h, s, clamp(l, 0.36, 0.50)))
  }
  return await Promise.all(list.map(measure))
}`

/**
 * 没有 canvas 服务时，头像主色交给浏览器算。
 *
 * 这里放的是上面 `themeColorOf` / `avatarThemeColor` 的第二份实现（那边在本进程里跑，
 * 这份在页面里跑，两边只能各写一遍），另一份在 message-counter 的客户端脚本里：
 * 三处必须逐字相同——同一张头像在两张榜上要算出同一个调子。缩略图尺寸与圆覆盖率
 * 都按 50×50 那一档来，所以原图多大都不影响结果。
 */
export async function measureAccents(ctx: Context, sources: string[]): Promise<string[]> {
  if (!sources.length) return []
  const page = await ctx.puppeteer.page()
  try {
    await page.setContent('<!DOCTYPE html><body></body>', { waitUntil: 'load' })
    return await page.evaluate(`(${MEASURE_ACCENTS_SCRIPT})(${JSON.stringify(sources)})`) as string[]
  } finally {
    await page.close()
  }
}
