import { h } from 'koishi'
import { Asset, NICKNAME_FONT } from './assets'
import { baseline, EMPHASIZED_WEIGHT, scheme } from './m3'

/*
 * 这张榜与 message-counter 的水平柱状榜共用一套版式与一套配色。
 *
 * 两张榜会在同一个群里前后脚发出来，和 acumen 的 stats 榜也会并排出现，
 * 所以不只版式逐项对齐，颜色也照搬 acumen 的 `chart/utils.rs`：同一支头像色
 * 算出来的条色、轨道、读数与占比，三边必须逐位相同。下面是那套运算的搬字版。
 *
 * SCHEME 只留给 `baseline()` 排版重置用，页面上看得见的颜色全部来自下面的常量。
 */
const HUE = 268
const SCHEME = scheme(HUE)

/*
 * 版式与 message-counter、acumen 的 `draw_bar_chart` 逐项对齐（acumen 以 2 倍尺寸
 * 绘制，这里是 1 倍）：行高 50、条最短 150、随数额增长 700、名字左内缩 10、
 * 条尾到数额 10、数额与占比之间 8、名次字号 22、名次到头像 12、页面留白 24。
 * 改动时三处一起改。
 */
const LAYOUT = {
  avatarSize: 50, // 头像边长，也是每一行的高度
  rowGap: 10, // 行与行之间的空隙
  avatarGap: 6, // 头像与柱状条之间的空隙
  barMinWidth: 150, // 柱状条的最小长度
  barSpan: 700, // 柱状条随数额增长的最大长度
  namePad: 10, // 名称距柱状条左端的距离
  textGap: 10, // 柱状条末端与数额之间的空隙
  columnGap: 14, // 读数排成两列时，轨道右端到数额列的空隙
  percentGap: 8, // 数额与百分比之间的空隙
  rankGap: 12, // 名次列与头像之间的空隙
  pagePadX: 24,
  pagePadY: 24,
  iconSize: 32,
  // 页眉：标题 32、元信息行 18（字号见 ACUMEN_FONT）、两者之间 12、到榜单 24
  headerGap: 12,
  headerMargin: 24,
} as const

/**
 * 字号，照 acumen 的 `draw_bar_chart` 写的数（1 倍）。
 *
 * **这些数不能直接当 CSS px 用。** acumen 用 plotters + ab_glyph 画字，那边的「字号」
 * 是 ab_glyph 的 PxScale——字体上伸部到下伸部的总高，不是 CSS 的 em。线上那支
 * MiSans Medium 每 em 1000 单位，上伸 1044、下伸 282，所以写 30 实际只画出
 * 30 × 1000 / 1326 ≈ 22.6px 的 em。从前照抄成 CSS px，整张图的字大了三成多。
 * 出图时统一乘上 ACUMEN_EM（再乘配置里的倍率），见 fontSizes。
 */
const ACUMEN_FONT = {
  count: 30, // 数额与昵称，acumen 的 font_size
  percent: 20, // 百分比，acumen 的 pct_font_size
  rank: 22, // 名次：比昵称小两档，只作次序参照
  title: 32, // acumen 的 title_font_size
  meta: 18, // acumen 的 meta_font_size
} as const

/** acumen 字号 → CSS 字号的系数，推导见 ACUMEN_FONT。message-counter 里是同一个数。 */
const ACUMEN_EM = 1000 / (1044 + 282)

/**
 * 按倍率算出这一张图的 CSS 字号。倍率 1 即与 acumen 的发言榜同大。
 *
 * 标题与元信息行的行高是 acumen 给这两行留的位，只随倍率缩放，不乘 ACUMEN_EM——
 * 这样倍率为 1 时榜单落在与 acumen 同一个纵坐标上。
 */
function fontSizes(scale: number) {
  const px = (size: number) => +(size * ACUMEN_EM * scale).toFixed(2)
  return {
    count: px(ACUMEN_FONT.count),
    percent: px(ACUMEN_FONT.percent),
    rank: px(ACUMEN_FONT.rank),
    title: px(ACUMEN_FONT.title),
    meta: px(ACUMEN_FONT.meta),
    titleLine: ACUMEN_FONT.title * scale,
    metaLine: ACUMEN_FONT.meta * scale,
    sep: px(9),
  }
}

/** 条的圆角是条高的两成（50 的 20% = 10）。 */
const BAR_RADIUS = 10
const TRACK_WIDTH = LAYOUT.barMinWidth + LAYOUT.barSpan

/**
 * 名次列的宽度。
 *
 * 按「字号的 0.6 倍 × 位数」估，不去真量字：message-counter 那边是画布，量得了，
 * 但它必须与这里落到同一个数，否则同一批数据在两张榜上会差一两个像素、整行的位置
 * 全错开。所以两边共用这一个模型（也就是下面 `textWidth` 估数字用的那个系数）。
 * 名次右对齐，模型比真实字宽略宽，多出来的那一点落在数字左边，看不出来。
 */
const rankColumnWidth = (rows: number, rankFontSize: number) => Math.ceil(rankFontSize * 0.6 * String(rows).length)

/**
 * 行内文字的字体：与 acumen 的取字体顺序一致，首选系统里的 Noto Sans CJK SC
 * （acumen 原先的 font_family；线上现在配的是 MiSans，但不能假定装了它）。昵称与读数同一支字体，
 * 数字不再走等宽栈——acumen 那边整张图只用一支字体。
 * 后面接 message-counter 随包带的那支，两个插件在同一台机器上落到同一支字体。
 */
const CHART_FONT = `"Noto Sans CJK SC", "${NICKNAME_FONT}", "Microsoft YaHei", sans-serif`

/*
 * ── 以下是 acumen `src/plugins/stats/chart/utils.rs` 与 `renderer.rs` 的搬字版 ──
 *
 * 逐行照搬，连 `as u8` 的截断与 `.round()` 的位置都没改：只有逐位相同，
 * 两张榜的颜色才谈得上一致。改了这里，acumen 那边要对着一块改。
 */

/** 页面与文字的纸色、墨色，取自 acumen 的 `ColorScheme::default`（scheme-manual）。 */
const PAPER = '#fffefa' // surface，页面底色
const INK = '#1f2a27' // on-surface，标题
const INK_SOFT = '#4f5c57' // on-surface-variant，元信息行
/** on-surface-faint 在暖白纸上差一线（4.44∶1），这是它过 4.5∶1 之后的值，
 *  即 acumen 的 `ColorScheme::readable_faint()`：名次这类参照数字的墨色。 */
const INK_FAINT = '#66726d'
/** 刻度竖线：8% 的黑，压在轨道或实色条上都读得出来。 */
const HAIRLINE = 'rgba(0, 0, 0, 0.08)'
/** 头像底下那圈发丝细的边：不透明的 outline-variant，垫在头像下面。 */
const GRID_LINE = '#dee5df'
/** 前三名的名次色：金、银、铜。含义在颜色本身，不跟主题也不跟头像走。 */
const MEDALS = ['#8a640a', '#687076', '#8c5834']
/** 取不到头像时的兜底色，即 acumen 的 `FALLBACK_THEME`（主色）。 */
const FALLBACK_THEME = '#1f6350'

type Rgb = [number, number, number]

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const hexToRgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16) || 0,
  parseInt(hex.slice(3, 5), 16) || 0,
  parseInt(hex.slice(5, 7), 16) || 0,
]

const rgbToHex = (color: Rgb) =>
  '#' + color.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')

/** Rust 里 `x as u8` 是截断，不是四舍五入。 */
const to8 = (value: number) => clamp(Math.trunc(value), 0, 255)

/** RGB → HSL，H 为 0—360，S/L 为 0—1。 */
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

/** HSL → RGB。 */
function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const m = l - c / 2
  const channel = (value: number) => clamp(Math.round(clamp(value + m, 0, 1) * 255), 0, 255)
  return [channel(r), channel(g), channel(b)]
}

const yiq = (color: Rgb) => (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000

// ── 对比度：可达性，不是风格 ──
// 阈值由 WCAG 2.2 定，正文 4.5∶1，大字与图形元素 3∶1。条色来自头像，什么都可能，
// 所以「同一支色相的深调」这种算法给出来的字色得逐对量过才敢用。

/** WCAG 2.2 的相对亮度。 */
function relativeLuminance(color: Rgb) {
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2])
}

/** 两色之间的对比度，1—21。 */
const contrastRatio = (a: Rgb, b: Rgb) => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 这块底上该写深字还是浅字：黑与白各量一次，谁的对比度高就往谁那边走。 */
const prefersDarkInk = (bg: Rgb) => contrastRatio([0, 0, 0], bg) >= contrastRatio([255, 255, 255], bg)

/**
 * 把前景一档档推开，直到它在 bg 上够 minRatio。色相不动，只动明度。
 *
 * 每档走掉剩余距离的 6%，且至少走一格：单纯按比例混色到了两端会因为取整原地打转，
 * 字色就停在离阈值一线的地方。
 */
function ensureContrast(fg: Rgb, bg: Rgb, minRatio: number): Rgb {
  const target: Rgb = prefersDarkInk(bg) ? [0, 0, 0] : [255, 255, 255]
  const step = (value: number, t: number) => {
    const moved = value + (t - value) * 0.06
    if (t > value) return Math.min(Math.ceil(moved), t)
    if (t < value) return Math.max(Math.floor(moved), t)
    return value
  }
  let color = fg
  for (let i = 0; i < 255; i++) {
    if (contrastRatio(color, bg) >= minRatio
      || (color[0] === target[0] && color[1] === target[1] && color[2] === target[2])) break
    color = [step(color[0], target[0]), step(color[1], target[1]), step(color[2], target[2])]
  }
  return color
}

// ── 同一支色相里的调子 ──
//
// M3 的 tonal palette 用感知明度把同一档上的所有色相归到一样重。这里用 WCAG 的相对
// 亮度做同样的归一：HSL 明度不是视觉亮度，同一条明度带上黄比紫亮将近三倍，于是黄绿
// 那几行在榜上永远比别人扎眼，整张图的重量忽轻忽重。

/** 实色条的目标亮度：相对亮度 0.16。 */
const BAR_LUMINANCE = 0.16
/** 淡色轨道的目标亮度：与条色的对比度约 3.5∶1，过非文字元素的 3∶1。 */
const TRACK_LUMINANCE = 0.68
/** 彩度上限与下限：亮度归一之后，各行之间剩下的差别只有色相与彩度。 */
const MAX_SATURATION = 0.30
const MIN_SATURATION = 0.16
/**
 * 读不出色相的下限：RGB 三分量的极差（彩度）不到这个比例，剩下的方向就是噪声。
 *
 * 判彩度要看极差，不能看 HSL 的 S：雪白的自拍三分量只差 10，HSL 却因为明度贴着顶
 * 而算出 0.23 的饱和度——照着它染，一张白头像会得到一条橘色的条。
 */
const HUE_NOISE_FLOOR = 0.02

/** 回退色相：系统主色的那一支。灰头像不是「没有颜色」，是「没有自己的颜色」。 */
const fallbackHue = () => toHsl(hexToRgb(FALLBACK_THEME))[0]

/** 定住色相与饱和度，把明度推到指定的相对亮度上。相对亮度对 HSL 明度单调，二分即可。 */
function atLuminance(h: number, s: number, target: number): Rgb {
  let low = 0
  let high = 1
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2
    if (relativeLuminance(fromHsl(h, s, mid)) < target) low = mid
    else high = mid
  }
  return fromHsl(h, s, (low + high) / 2)
}

/** 主题色只留色相，彩度收进窄带，亮度归一到 BAR_LUMINANCE。 */
function harmonizeTheme(color: Rgb): Rgb {
  const [h, s] = toHsl(color)
  const chroma = (Math.max(color[0], color[1], color[2]) - Math.min(color[0], color[1], color[2])) / 255
  // 彩度低到读不出方向的头像退到固定的回退色相，但彩度压到窄带之下：
  // 一张本来就没有颜色的头像，不该因为「没有颜色」反而成为整张榜上最扎眼的一条。
  if (chroma < HUE_NOISE_FLOOR) return atLuminance(fallbackHue(), 0.08, BAR_LUMINANCE)
  return atLuminance(h, clamp(s, MIN_SATURATION, MAX_SATURATION), BAR_LUMINANCE)
}

/** 这一行的淡色轨道：同一支色相，亮度归一到 TRACK_LUMINANCE。
 *  「混一半白」得到的是固定的比例、不是固定的对比度：一支本来就亮的黄，混一半白
 *  之后与自己只差 1.50∶1，条尾在哪根本看不出来。 */
function trackTone(bar: Rgb): Rgb {
  const [h, s] = toHsl(bar)
  return atLuminance(h, s, TRACK_LUMINANCE)
}

const mixWithWhite = (color: Rgb, opacity: number): Rgb =>
  color.map((value) => to8(value * opacity + 255 * (1 - opacity))) as Rgb

const mixWithColor = (color: Rgb, base: Rgb, opacity: number): Rgb => {
  const t = clamp(opacity, 0, 1)
  return color.map((value, i) => to8(value * t + base[i] * (1 - t))) as Rgb
}

/** 同色相的深调：给淡底上的字用。一次压暗对本来就很浅的色还不够，
 *  再压到 YIQ 亮度 96 以下为止。 */
function deepTone(color: Rgb, strength: number): Rgb {
  const black: Rgb = [0, 0, 0]
  let out = mixWithColor(color, black, clamp(strength, 0.05, 1))
  for (let i = 0; i < 4; i++) {
    if (yiq(out) <= 96) break
    out = mixWithColor(out, black, 0.75)
  }
  return out
}

/** 实色条上的字色。纯白/纯黑盖在彩色上像两片贴纸；取同色相的极浅调或极深调，
 *  对比度一样够，字却像是从这块颜色里长出来的。最后一律过一遍阈值再交出去。 */
function contrastInk(bg: Rgb): Rgb {
  const seed = prefersDarkInk(bg) ? deepTone(bg, 0.26) : mixWithWhite(bg, 0.10)
  return ensureContrast(seed, bg, 4.5)
}

/** 第 rank 名（从 1 起）该用的墨色：前三名是奖牌色，其余是弱化的前景色。 */
const rankInk = (rank: number) => MEDALS[rank - 1] || INK_FAINT

export interface ChartRow {
  name: string
  userId: string
  count: number
  avatarBase64: string
  /** 头像主色，服务端算好；空串表示取不到，回退主色。 */
  accent: string
}

export interface ChartOptions {
  horizontalBarBackgroundOpacity: number
  horizontalBarBackgroundFullOpacity: number
  shouldMoveIconToBarEndLeft: boolean
  /** 刻度竖线是否压在实色条之上；关闭则由实色条盖住刻度。文字始终在最上层。 */
  gridLinesOverBars: boolean
  /** 数额与占比是否紧跟在自己那根条的尾巴后面；关闭则右对齐成固定的两列。 */
  valueFollowsBar: boolean
  /** 字号倍率，1 即与 acumen 的发言榜同大。 */
  chartFontScale?: number
}

const pick = (assets: Asset[], userId: string) =>
  assets.filter((asset) => asset.userId === userId).map((asset) => asset.base64)

/*
 * 内联进 style 属性，所以 url() 里必须用单引号——双引号会提前闭合 style，
 * 整条背景图规则被丢掉且不报错。base64 只含 [A-Za-z0-9+/=]，不会破坏单引号。
 */
const dataUrl = (base64: string) => `url('data:image/png;base64,${base64}')`

const thousands = (value: number) => Number(value).toLocaleString('en-US')

/**
 * 占比文案：一律取整——一列数字里不夹小数点看着才干净；
 * 不足半个百分点写 "<1%"，免得非零的零头被舍成没意义的 "0%"。
 * 与 message-counter 的写法逐字相同，两张榜的数字读起来才是一套。
 */
function formatPercent(value: number, total: number) {
  if (total <= 0 || value <= 0) return '0%'
  const rounded = Math.round((value / total) * 100)
  return rounded === 0 ? '<1%' : `${rounded}%`
}

/**
 * 估算一段数字文本的宽度。
 *
 * 榜单右侧只会出现数字、千分位逗号和百分号，用固定的字宽模型比把页面量一遍再
 * 重排要省事得多；算出来只用于决定轨道多长，差几个像素也只是右端留白多一点。
 */
function textWidth(text: string, fontSize: number) {
  let units = 0
  for (const char of text) {
    if (char === ',' || char === '.') units += 0.28
    else if (char === '%') units += 0.86
    else units += 0.6
  }
  return units * fontSize
}

const percentOf = (value: number, total: number) =>
  total > 0 ? formatPercent(value, total) : ''

/**
 * 样式 2：带头像的水平条形榜。
 *
 * 版式与配色都与 acumen 的 `draw_bar_chart` 相同：版式分五个纵列——名次 → 头像 →
 * 横条（实色进度 + 淡色轨道）→ 数额 → 占比；每行的条色由头像主色推出，色相留给
 * 个人、亮度归一到同一个点；轨道是同一支色相归一到淡调，读数是它的深调，
 * 占比再往底色退一档。
 */
export function renderChart(title: string, subtitle: string, rows: ChartRow[], icons: Asset[], backgrounds: Asset[], options: ChartOptions, fontFace = '') {
  // subtitle 由调用方拼好，内含 <span class="sep"> 分隔点，所以不整串转义；
  // 其中唯一的用户可控片段是货币名，调用方已经 h.escape 过

  const top = rows.reduce((max, row) => Math.max(max, row.count), 0) || 1
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const font = fontSizes(options.chartFontScale || 1)

  // 名次 → 头像 → 轨道，三个纵列的左边界。名次列宽两边共用同一个模型，见 rankColumnWidth
  const rankColW = rankColumnWidth(rows.length, font.rank)
  const avatarX = rankColW + LAYOUT.rankGap
  const barX = avatarX + LAYOUT.avatarSize + LAYOUT.avatarGap

  // 读数写在哪儿由 valueFollowsBar 决定，两种都要留位，所以每行右侧的文字先量一遍
  const blocks = rows.map((row) => {
    const countText = thousands(row.count)
    const percentText = percentOf(row.count, total)
    const countWidth = textWidth(countText, font.count)
    const percentWidth = percentText ? textWidth(percentText, font.percent) : 0
    return {
      countText,
      percentText,
      countWidth,
      percentWidth,
      width: countWidth + (percentText ? LAYOUT.percentGap + percentWidth : 0),
    }
  })

  // 轨道是定长的：条最长就铺满它，数额写在轨道右侧的留白上，与 acumen 一致。
  // 跟着条尾时按最宽的那一串留；排成两列时按两列各自最宽的一行留。
  const followsBar = options.valueFollowsBar
  const widest = blocks.reduce((max, block) => Math.max(max, block.width), 0)
  const valueColumnWidth = blocks.reduce((max, block) => Math.max(max, block.countWidth), 0)
  const percentColumnWidth = blocks.reduce((max, block) => Math.max(max, block.percentWidth), 0)
  const trackEndX = barX + TRACK_WIDTH
  const numbersWidth = followsBar
    ? LAYOUT.textGap + widest
    : LAYOUT.columnGap + valueColumnWidth + LAYOUT.percentGap + percentColumnWidth
  // 页面宽度则按最长的那串数额撑开，读数不会溢出
  const pageWidth = Math.ceil(barX + TRACK_WIDTH + numbersWidth + LAYOUT.pagePadX * 2)
  // 两列各自的右端（跟着条尾时用不到）
  const valueRightX = trackEndX + LAYOUT.columnGap + valueColumnWidth
  const percentRightX = valueRightX + LAYOUT.percentGap + percentColumnWidth

  // 刻度线：自条的零点起一格一道，只刻在轨道里；末道收在圆角之前
  const tickStep = LAYOUT.barSpan / 7
  const tickCount = Math.floor((LAYOUT.barSpan - BAR_RADIUS) / tickStep) + 1
  const ticks = Array.from(
    { length: tickCount },
    (_, index) => `<i style="left:${LAYOUT.barMinWidth + tickStep * index}px"></i>`,
  ).join('')

  const items = rows.map((row, index) => {
    // 取不到头像主色时用 acumen 的兜底色，行色仍落在那套运算里
    const bar = harmonizeTheme(hexToRgb(row.accent || FALLBACK_THEME))
    const track = trackTone(bar)
    // 数字踩在什么底上，就按什么底量对比度：跟着条尾时压在淡色轨道上
    // （榜首那一行越过轨道落在纸上，纸更浅，一并够）；排成两列时全在纸上。
    const ground = followsBar ? track : hexToRgb(PAPER)
    const valueTone = ensureContrast(deepTone(bar, 0.34), ground, 4.5)
    const accent = rgbToHex(bar)
    const trackCss = rgbToHex(track)
    const valueInk = rgbToHex(valueTone)
    // 占比是次要信息：把数额的墨往底色里调一点，同一支色相退半档，
    // 退到刚好还在正文阈值上为止
    const percentInk = rgbToHex(ensureContrast(mixWithColor(valueTone, ground, 0.62), ground, 4.5))
    const nameInk = rgbToHex(contrastInk(bar))

    // 条长取整：浏览器本来就会把盒子的边落到整像素，写出来是为了与
    // message-counter 的画布版落到同一个数——两张榜的条尾、读数与名字要同起点。
    const barWidth = Math.round(LAYOUT.barMinWidth + (LAYOUT.barSpan * row.count) / top)
    const block = blocks[index]

    // 读数紧跟条尾，落在轨道里或轨道外的纸面上，位置不跟着轨道右端变
    const textX = barX + barWidth + LAYOUT.textGap

    const chosen = pick(backgrounds, row.userId)
    const background = chosen.length ? chosen[Math.floor(Math.random() * chosen.length)] : ''
    // 整行铺底与条内铺底是两层独立的不透明度，配置里分开控制
    const fullLayer = background && options.horizontalBarBackgroundFullOpacity > 0
      ? `<span class="wash wash--full" style="background-image:${dataUrl(background)};opacity:${options.horizontalBarBackgroundFullOpacity}"></span>`
      : ''
    const barLayer = background
      ? `<span class="wash" style="background-image:${dataUrl(background)};opacity:${options.horizontalBarBackgroundOpacity}"></span>`
      : ''

    const badges = pick(icons, row.userId)
      .map((base64) => `<img class="icon" src="data:image/png;base64,${base64}">`).join('')
    // 名字能用满整根条：只有这个人确实挂了图标，才给图标留出那一格
    const reserve = badges ? 44 : LAYOUT.namePad
    const nameRoom = Math.max(0, barWidth - LAYOUT.namePad - reserve)

    // 读数跟着条尾时是一串（数额 + 占比），排成两列时是各自右对齐的两个盒子
    const valueBlock = followsBar
      ? `<span class="value" style="left:${textX.toFixed(1)}px;color:${valueInk}">${block.countText}${
          block.percentText
            ? `<b style="color:${percentInk}">${block.percentText}</b>`
            : ''
        }</span>`
      : `<span class="value value--col" style="left:${(valueRightX - valueColumnWidth).toFixed(1)}px;width:${valueColumnWidth.toFixed(1)}px;color:${valueInk}">${block.countText}</span>
        <span class="value value--col" style="left:${(percentRightX - percentColumnWidth).toFixed(1)}px;width:${percentColumnWidth.toFixed(1)}px"><b style="color:${percentInk}">${block.percentText}</b></span>`

    return `
      <li class="row">
        <span class="rank" style="width:${rankColW}px;color:${rankInk(index + 1)}"><span>${index + 1}</span></span>
        <img class="avatar" src="data:image/png;base64,${row.avatarBase64}">
        <span class="track" style="background:${trackCss}">
          <span class="ticks${options.gridLinesOverBars ? ' ticks--over' : ''}">${ticks}</span>
          ${fullLayer}
          <span class="bar" style="width:${barWidth}px;background:${accent}">
            ${barLayer}
            <span class="name" style="max-width:${nameRoom.toFixed(1)}px;color:${nameInk}">${h.escape(row.name)}</span>
            ${options.shouldMoveIconToBarEndLeft ? '' : badges}
          </span>
          ${options.shouldMoveIconToBarEndLeft && badges
            ? `<span class="tail" style="left:${barWidth - LAYOUT.namePad / 2}px">${badges}</span>`
            : ''}
        </span>
        ${valueBlock}
      </li>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${h.escape(title)}</title>
  <style>
    ${baseline(SCHEME)}
    ${fontFace}
    /* 纸面与墨色与 acumen 的图表同一张纸：暖白卡面、深墨标题、次级墨小字 */
    html { min-height: 100%; background: ${PAPER}; }
    body {
      width: ${pageWidth}px;
      padding: ${LAYOUT.pagePadY}px ${LAYOUT.pagePadX}px;
      background: transparent;
      color: ${INK};
    }

    /* 页眉居中：标题、元信息行的高与间距逐项按 acumen 的标题区来（32 / 12 / 18），
       下面的榜单因此落在与 acumen 同一个纵坐标上。 */
    .head { margin: 0 0 ${LAYOUT.headerMargin}px; text-align: center; }
    .head h1 {
      margin: 0;
      font-family: ${CHART_FONT};
      font-size: ${font.title}px; line-height: ${font.titleLine}px;
      font-weight: ${EMPHASIZED_WEIGHT.headline};
      color: ${INK};
    }
    .head p {
      margin: ${LAYOUT.headerGap}px 0 0;
      font-family: ${CHART_FONT};
      font-size: ${font.meta}px; line-height: ${font.metaLine}px;
      font-weight: 400;
      color: ${INK_SOFT};
    }
    /* 分隔点自己带匀称的左右间距，不依赖字体里「·」的空腔 */
    .head .sep { margin: 0 ${font.sep}px; opacity: .55; }

    .rows { display: flex; flex-direction: column; gap: ${LAYOUT.rowGap}px; margin: 0; padding: 0; list-style: none; }
    /* 行内的间距逐个给（gap 为 0）：名次到头像是一段，头像到轨道是另一段 */
    .row { position: relative; display: flex; align-items: center; gap: 0; height: ${LAYOUT.avatarSize}px; }

    /* 名次单独成列，右对齐收在头像左边。前三名是奖牌色，固定不跟主题也不跟头像走。
       名次、昵称、读数三样字号不同，却要踩在同一条基线上（message-counter 的画布
       就是这么画的）。办法是让它们都排在「昵称字号 + 行高 50」的行盒里：行盒的
       基线只由外层字号定，里面小一号的字挂在同一条基线上；内层行高压成 1，
       免得它把行盒撑高、把基线挤走。从前是按量出来的像素往下推，换一档字号就错位。 */
    .rank {
      flex: none; margin-right: ${LAYOUT.rankGap}px; text-align: right;
      font-family: ${CHART_FONT}; font-variant-numeric: tabular-nums;
      font-size: ${font.count}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: 400;
    }
    .rank span { font-size: ${font.rank}px; line-height: 1; }

    .avatar {
      width: ${LAYOUT.avatarSize}px; height: ${LAYOUT.avatarSize}px; flex: none;
      margin-right: ${LAYOUT.avatarGap}px;
      border-radius: var(--md-sys-shape-corner-full); object-fit: cover;
      /* 头像底下垫一圈发丝细的暗边：浅色头像贴在暖白纸上边缘会化掉 */
      box-shadow: 0 0 0 1px ${GRID_LINE};
      background: #c8c8c8;
    }

    /* 轨道定长：条最长就铺满它；条的圆角交给这层裁 */
    .track {
      position: relative; flex: none;
      width: ${TRACK_WIDTH}px; height: ${LAYOUT.avatarSize}px;
      border-radius: ${BAR_RADIUS}px;
      overflow: hidden;
    }

    /* 刻度线默认压在实色条上面；关掉 gridLinesOverBars 则被条盖住。
       名字抬到刻度之上——文字始终在最上层，位置与字号两种都一样。 */
    .ticks { position: absolute; inset: 0; }
    .ticks i { position: absolute; top: 0; bottom: 0; width: 2px; background: ${HAIRLINE}; }
    .ticks--over { z-index: 2; }
    .ticks--over ~ .bar .name { z-index: 3; }

    .bar {
      position: absolute; left: 0; top: 0; bottom: 0;
      display: flex; align-items: center;
      padding-left: ${LAYOUT.namePad}px;
      overflow: hidden;
    }
    /* 自定义背景图铺在条上，盖不住的地方仍是头像主色 */
    .wash { position: absolute; inset: 0; background-size: cover; background-position: center; }

    .name {
      position: relative;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: ${CHART_FONT};
      font-size: ${font.count}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: 400;
    }

    .tail { position: absolute; z-index: 2; top: 50%; transform: translate(-100%, -50%); display: flex; align-items: center; gap: 4px; }
    .icon { position: relative; width: ${LAYOUT.iconSize}px; height: ${LAYOUT.iconSize}px; object-fit: contain; margin-left: 5px; }

    /* 读数与昵称同一个行盒（整行高、昵称字号），基线自然落在一处；
       占比小一号，挂在同一条基线上，行高压成 1 免得撑高行盒 */
    .value {
      position: absolute; z-index: 2; top: 0;
      font-family: ${CHART_FONT}; font-variant-numeric: tabular-nums;
      font-size: ${font.count}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: 400; white-space: nowrap;
    }
    .value b { margin-left: ${LAYOUT.percentGap}px; font-size: ${font.percent}px; line-height: 1; font-weight: 400; }
    /* 读数排成两列时，各自是一个定宽的盒子、右对齐 */
    .value--col { text-align: right; }
    .value--col b { margin-left: 0; }
  </style>
</head>
<body>
  <div class="head">
    <h1>${h.escape(title)}</h1>
    <p>${subtitle}</p>
  </div>
  <ul class="rows">${items}
  </ul>
</body>
</html>`
}
