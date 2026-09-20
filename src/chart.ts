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
 * 条尾到数额 10、数额与占比之间 8、页面留白 24。改动时三处一起改。
 */
const LAYOUT = {
  avatarSize: 50, // 头像边长，也是每一行的高度
  rowGap: 10, // 行与行之间的空隙
  avatarGap: 6, // 头像与柱状条之间的空隙
  barMinWidth: 150, // 柱状条的最小长度
  barSpan: 700, // 柱状条随数额增长的最大长度
  namePad: 10, // 名称距柱状条左端的距离
  textGap: 10, // 柱状条末端与数额之间的空隙
  countFontSize: 30, // 数额字号，与 acumen 的 font_size 同档
  percentFontSize: 20, // 百分比字号，与 acumen 的 pct_font_size 同档
  percentGap: 8, // 数额与百分比之间的空隙
  pagePadX: 24,
  pagePadY: 24,
  iconSize: 32,
  // 页眉：标题 32、元信息行 18、两者之间 12、到榜单 24
  titleFontSize: 32,
  metaFontSize: 18,
  headerGap: 12,
  headerMargin: 24,
} as const

/** 条的圆角是条高的两成（50 的 20% = 10）。 */
const BAR_RADIUS = 10
const TRACK_WIDTH = LAYOUT.barMinWidth + LAYOUT.barSpan
const BAR_X = LAYOUT.avatarSize + LAYOUT.avatarGap

/**
 * 行内文字的字体：与 acumen 的取字体顺序一致，首选系统里的 Noto Sans CJK SC
 * （acumen 的 config.toml 里 font_family 就是它）。昵称与读数同一支字体，
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
/** 刻度线与头像描边：8% 的黑。 */
const HAIRLINE = 'rgba(0, 0, 0, 0.08)'
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

/** 主题色的明度与饱和度收进窄带，只留色相。 */
function harmonizeTheme(color: Rgb): Rgb {
  const [h, s, l] = toHsl(color)
  // 本来就没有色相的头像（纯灰）保持中性，硬给饱和度会凭空染出一条彩色的条
  if (s < 0.06) return fromHsl(0, 0, clamp(l, 0.36, 0.5))
  return fromHsl(h, clamp(s, 0.18, 0.42), clamp(l, 0.36, 0.5))
}

const mixWithWhite = (color: Rgb, opacity: number): Rgb =>
  color.map((value) => to8(value * opacity + 255 * (1 - opacity))) as Rgb

const mixWithColor = (color: Rgb, base: Rgb, opacity: number): Rgb => {
  const t = clamp(opacity, 0, 1)
  return color.map((value, i) => to8(value * t + base[i] * (1 - t))) as Rgb
}

/** 同色相的深调：给淡底上的字用。 */
function deepTone(color: Rgb, strength: number): Rgb {
  const black: Rgb = [0, 0, 0]
  let out = mixWithColor(color, black, clamp(strength, 0.05, 1))
  for (let i = 0; i < 4; i++) {
    if (yiq(out) <= 96) break
    out = mixWithColor(out, black, 0.75)
  }
  return out
}

/** 实色条上的字色：亮的底取深调，暗的底取极浅调。 */
const contrastInk = (color: Rgb): Rgb => (yiq(color) >= 128 ? deepTone(color, 0.26) : mixWithWhite(color, 0.1))

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
 * 版式与配色都与 acumen 的 `draw_bar_chart` 相同：每行的条色由头像主色推出，
 * 明度与饱和度收进窄带、只留色相；轨道是条色与白各半，读数是条色的深调，
 * 占比再往轨道色退一档。
 */
export function renderChart(title: string, subtitle: string, rows: ChartRow[], icons: Asset[], backgrounds: Asset[], options: ChartOptions, fontFace = '') {
  // subtitle 由调用方拼好，内含 <span class="sep"> 分隔点，所以不整串转义；
  // 其中唯一的用户可控片段是货币名，调用方已经 h.escape 过

  const top = rows.reduce((max, row) => Math.max(max, row.count), 0) || 1
  const total = rows.reduce((sum, row) => sum + row.count, 0)

  // 轨道要能装下最长的那串数额，所以先把每行右侧的文字量一遍
  const blocks = rows.map((row) => {
    const countText = thousands(row.count)
    const percentText = percentOf(row.count, total)
    const countWidth = textWidth(countText, LAYOUT.countFontSize)
    const percentWidth = percentText ? textWidth(percentText, LAYOUT.percentFontSize) : 0
    return {
      countText,
      percentText,
      countWidth,
      width: countWidth + (percentText ? LAYOUT.percentGap + percentWidth : 0),
    }
  })

  // 轨道是定长的：条最长就铺满它，数额写在轨道右侧的留白上，与 acumen 一致。
  // 页面宽度则按最长的那串数额撑开，读数不会溢出。
  const widest = blocks.reduce((max, block) => Math.max(max, block.width), 0)
  const pageWidth = Math.ceil(BAR_X + TRACK_WIDTH + LAYOUT.textGap + widest + LAYOUT.pagePadX * 2)

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
    const track = mixWithWhite(bar, 0.5)
    const valueTone = deepTone(bar, 0.34)
    const accent = rgbToHex(bar)
    const trackCss = rgbToHex(track)
    const valueInk = rgbToHex(valueTone)
    // 占比是次要信息：往轨道色退一档，同一支色相
    const percentInk = rgbToHex(mixWithColor(valueTone, track, 0.64))
    const nameInk = rgbToHex(contrastInk(bar))

    const barWidth = LAYOUT.barMinWidth + (LAYOUT.barSpan * row.count) / top
    const block = blocks[index]

    // 读数紧跟条尾，落在轨道里或轨道外的纸面上，位置不跟着轨道右端变
    const textX = BAR_X + barWidth + LAYOUT.textGap

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

    return `
      <li class="row">
        <img class="avatar" src="data:image/png;base64,${row.avatarBase64}">
        <span class="track" style="background:${trackCss}">
          <span class="ticks${options.gridLinesOverBars ? ' ticks--over' : ''}">${ticks}</span>
          ${fullLayer}
          <span class="bar" style="width:${barWidth.toFixed(3)}px;background:${accent}">
            ${barLayer}
            <span class="name" style="max-width:${nameRoom.toFixed(1)}px;color:${nameInk}">${h.escape(row.name)}</span>
            ${options.shouldMoveIconToBarEndLeft ? '' : badges}
          </span>
          ${options.shouldMoveIconToBarEndLeft && badges
            ? `<span class="tail" style="left:${(barWidth - LAYOUT.namePad / 2).toFixed(1)}px">${badges}</span>`
            : ''}
        </span>
        <span class="value" style="left:${textX.toFixed(1)}px;color:${valueInk}">${block.countText}${
          block.percentText
            ? `<b style="color:${percentInk}">${block.percentText}</b>`
            : ''
        }</span>
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
      font-size: ${LAYOUT.titleFontSize}px; line-height: ${LAYOUT.titleFontSize}px;
      font-weight: ${EMPHASIZED_WEIGHT.headline};
      color: ${INK};
    }
    .head p {
      margin: ${LAYOUT.headerGap}px 0 0;
      font-family: ${CHART_FONT};
      font-size: ${LAYOUT.metaFontSize}px; line-height: ${LAYOUT.metaFontSize}px;
      font-weight: 400;
      color: ${INK_SOFT};
    }
    /* 分隔点自己带匀称的左右间距，不依赖字体里「·」的空腔 */
    .head .sep { margin: 0 9px; opacity: .55; }

    .rows { display: flex; flex-direction: column; gap: ${LAYOUT.rowGap}px; margin: 0; padding: 0; list-style: none; }
    .row { position: relative; display: flex; align-items: center; gap: ${LAYOUT.avatarGap}px; height: ${LAYOUT.avatarSize}px; }

    .avatar {
      width: ${LAYOUT.avatarSize}px; height: ${LAYOUT.avatarSize}px; flex: none;
      border-radius: var(--md-sys-shape-corner-full); object-fit: cover;
      /* 头像底下垫一圈发丝细的暗边：浅色头像贴在暖白纸上边缘会化掉 */
      box-shadow: 0 0 0 1px ${HAIRLINE};
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
      font-size: ${LAYOUT.countFontSize}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: 400;
    }

    .tail { position: absolute; z-index: 2; top: 50%; transform: translate(-100%, -50%); display: flex; align-items: center; gap: 4px; }
    .icon { position: relative; width: ${LAYOUT.iconSize}px; height: ${LAYOUT.iconSize}px; object-fit: contain; margin-left: 5px; }

    .value {
      position: absolute; z-index: 2; top: 50%; transform: translateY(-50%);
      display: flex; align-items: baseline; gap: ${LAYOUT.percentGap}px;
      font-family: ${CHART_FONT}; font-variant-numeric: tabular-nums;
      font-size: ${LAYOUT.countFontSize}px; line-height: 1;
      font-weight: 400; white-space: nowrap;
    }
    .value b { font-size: ${LAYOUT.percentFontSize}px; font-weight: 400; }
    .value b { font-size: ${LAYOUT.percentFontSize}px; font-weight: 400; }
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
