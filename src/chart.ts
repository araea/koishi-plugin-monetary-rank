import { h } from 'koishi'
import { Asset, NICKNAME_FONT } from './assets'
import { baseline, EMPHASIZED_WEIGHT, harmonize, lch, MONO_STACK, scheme, SHAPE, TYPE } from './m3'

/*
 * 柱状榜的源色相跟 message-counter 走，不跟本插件的卡片样式走。
 *
 * 这两张榜会在同一个群里前后脚发出来，底色一冷一暖并排看就是两套设计；
 * 而每行的条色本来就由头像决定，主色在这张图上只影响页面底色、页眉文字
 * 和无彩头像的回退色相——让它们对齐，代价最小、收益最直接。
 * 卡片样式（样式 3）仍用本插件自己的金色。
 */
const HUE = 268
const SCHEME = scheme(HUE)

/*
 * 版式与 message-counter 的水平柱状榜逐项对齐，两个插件的榜单会在同一个群里
 * 前后脚发出来，行高、条长、字号只要差一点，并排看就是两张图。
 * 这一组数值又都来自 ayjx 的 `draw_bar_chart`（那边以 2 倍尺寸绘制，这里是 1 倍）：
 * 行高 50、条最短 150、随数额增长 700、名字左内缩 10、条尾到数额 10、
 * 数额与占比之间 8。改动时三处一起改。
 * 两处字号取字阶：数额是每行的一号数字，走 headlineLarge；占比退到 titleLarge，
 * 与数额保持 2:3。
 */
const LAYOUT = {
  avatarSize: 50, // 头像边长，也是每一行的高度
  rowGap: 10, // 行与行之间的空隙
  avatarGap: 6, // 头像与柱状条之间的空隙
  barMinWidth: 150, // 柱状条的最小长度
  barSpan: 700, // 柱状条随数额增长的最大长度
  namePad: 10, // 名称距柱状条左端的距离
  textGap: 10, // 柱状条末端与数额之间的空隙
  countFontSize: TYPE.headlineLarge.size, // 数额字号
  percentFontSize: TYPE.titleLarge.size, // 百分比字号
  percentGap: 8, // 数额与百分比之间的空隙
  pagePadX: 24,
  pagePadY: 24,
  iconSize: 32,
} as const

/**
 * 形状刻度：条是条高的两成（50 的 20% = 10，SHAPE 里最近的一档是 medium = 12），
 * 头像与轨道取全圆角。下面这条是条的起点：头像宽度加一道头像与条之间的空隙。
 */
const BAR_RADIUS = SHAPE.medium
const TRACK_WIDTH = LAYOUT.barMinWidth + LAYOUT.barSpan
const BAR_X = LAYOUT.avatarSize + LAYOUT.avatarGap

/**
 * 要对齐的读数（数额、占比）走等宽栈，昵称走 message-counter 那一支字体。
 * 两个字体栈逐项照搬 message-counter 的 numFont / chartFont：同一份数据在两个
 * 插件里必须落到同一支字体上。
 * 等宽栈里没有汉字，把昵称字体接在后面，读数里可能夹的字才不掉队。
 */
const NAME_FONT = `'${NICKNAME_FONT}', "Microsoft YaHei", sans-serif`
const NUM_FONT = `${MONO_STACK}, ${NAME_FONT}`

/*
 * 同一支色相里的四个色调，取值与 message-counter 一致：
 * 条 48、轨道 73（彩度 23，条色与页面底色各半）、数额 32、占比 47（彩度 28）。
 * 条固定在色调 48，条上的白字永远够对比，不必逐行判断该配深字还是浅字。
 */
const TONE = { bar: 48, track: 73, value: 32, percent: 47 } as const
const CHROMA = { bar: 46, track: 23, value: 30, percent: 28 } as const

/**
 * 取不到头像主色时的兜底色：一支真正的灰（彩度 0）。
 * harmonize 见到彩度低于 4 的来源就退回主色相，行色仍然落在设计系统里，
 * 不会在报错路径上露出一支系统外的颜色。
 */
const GRAY = lch(50, 0, HUE)

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
 * 每行的条色由头像主色推出，但只借它的色相——色调和彩度都换成设计系统的取值。
 * 这样既保留了「这条是我的颜色」，整张图的明暗节奏又是齐的，
 * 不会因为谁的头像特别暗而糊掉，文字对比度也始终够。
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

  // 轨道是定长的：条最长就铺满它，数额写在轨道右侧的留白上，与 ayjx 一致。
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
    const source = row.accent || GRAY
    const accent = harmonize(source, TONE.bar, CHROMA.bar, HUE)
    const track = harmonize(source, TONE.track, CHROMA.track, HUE)
    const valueInk = harmonize(source, TONE.value, CHROMA.value, HUE)
    const percentInk = harmonize(source, TONE.percent, CHROMA.percent, HUE)

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
        <span class="track" style="background:${track}">
          <span class="ticks">${ticks}</span>
          ${fullLayer}
          <span class="bar" style="width:${barWidth.toFixed(1)}px;background:${accent}">
            ${barLayer}
            <span class="name" style="max-width:${nameRoom.toFixed(1)}px">${h.escape(row.name)}</span>
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
    html { min-height: 100%; background: linear-gradient(135deg, ${SCHEME.surfaceBright} 0%, ${SCHEME.surfaceContainer} 100%); }
    body {
      width: ${pageWidth}px;
      padding: ${LAYOUT.pagePadY}px ${LAYOUT.pagePadX}px;
      background: transparent;
    }

    /* 页眉居中：与 message-counter、ayjx 的榜单同一条版式——标题居中，
       范围、合计与出图时间并成一行小字跟在下面。 */
    .head { margin: 0 0 24px; text-align: center; }
    .head h1 {
      margin: 0;
      font-size: ${TYPE.headlineLarge.size}px; line-height: ${TYPE.headlineLarge.line}px;
      font-weight: ${EMPHASIZED_WEIGHT.headline}; letter-spacing: ${TYPE.headlineLarge.tracking}px;
      color: ${SCHEME.onSurface};
    }
    .head p {
      margin: 12px 0 0;
      font-size: ${TYPE.bodyLarge.size}px; line-height: ${TYPE.bodyLarge.line}px;
      font-weight: ${TYPE.bodyLarge.weight}; letter-spacing: ${TYPE.bodyLarge.tracking}px;
      color: ${SCHEME.onSurfaceVariant};
    }
    /* 分隔点自己带匀称的左右间距，不依赖字体里「·」的空腔 */
    .head .sep { margin: 0 9px; opacity: .55; }

    .rows { display: flex; flex-direction: column; gap: ${LAYOUT.rowGap}px; margin: 0; padding: 0; list-style: none; }
    .row { position: relative; display: flex; align-items: center; gap: ${LAYOUT.avatarGap}px; height: ${LAYOUT.avatarSize}px; }

    .avatar {
      width: ${LAYOUT.avatarSize}px; height: ${LAYOUT.avatarSize}px; flex: none;
      border-radius: var(--md-sys-shape-corner-full); object-fit: cover;
      background: ${SCHEME.surfaceContainerHighest};
    }

    /* 轨道定长：条最长就铺满它；条的圆角交给这层裁 */
    .track {
      position: relative; flex: none;
      width: ${TRACK_WIDTH}px; height: ${LAYOUT.avatarSize}px;
      border-radius: ${BAR_RADIUS}px;
      overflow: hidden;
    }

    /* 刻度线压在实色条下面，文字始终在最上层 */
    .ticks { position: absolute; inset: 0; }
    .ticks i { position: absolute; top: 0; bottom: 0; width: 2px; background: ${SCHEME.outlineVariant}; }

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
      font-family: ${NAME_FONT};
      font-size: ${TYPE.headlineLarge.size}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: ${TYPE.headlineLarge.weight};
      color: ${SCHEME.onPrimary};
    }

    .tail { position: absolute; z-index: 2; top: 50%; transform: translate(-100%, -50%); display: flex; align-items: center; gap: 4px; }
    .icon { position: relative; width: ${LAYOUT.iconSize}px; height: ${LAYOUT.iconSize}px; object-fit: contain; margin-left: 5px; }

    .value {
      position: absolute; z-index: 2; top: 50%; transform: translateY(-50%);
      display: flex; align-items: baseline; gap: ${LAYOUT.percentGap}px;
      font-family: ${NUM_FONT}; font-variant-numeric: tabular-nums;
      font-size: ${TYPE.headlineLarge.size}px; line-height: 1;
      font-weight: ${TYPE.headlineLarge.weight}; white-space: nowrap;
    }
    .value b { font-size: ${TYPE.titleLarge.size}px; font-weight: ${TYPE.titleLarge.weight}; }
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
