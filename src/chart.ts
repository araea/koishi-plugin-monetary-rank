import { h } from 'koishi'
import { Asset } from './assets'
import { baseline, EMPHASIZED_WEIGHT, FONT_STACK, harmonize, lch, MONO_STACK, scheme, TYPE } from './m3'

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
 * 版式与 message-counter 的水平柱状榜逐项对齐：两个插件的榜单会在同一个群里
 * 前后脚发出来，行高、条长、字号只要差一点，并排看就是两张图。
 * 下面这组数值是从那边照搬的，改动时请两边一起改。
 * 两处字号取字阶：数额是每行的一号数字，走 headlineLarge；占比退一档，走 bodyLarge。
 */
const LAYOUT = {
  avatarSize: 52, // 头像边长，也是每一行的高度
  rowGap: 10, // 行与行之间的空隙
  avatarGap: 14, // 头像与柱状条之间的空隙
  barMinWidth: 150, // 柱状条的最小长度
  barSpan: 700, // 柱状条随数额增长的最大长度
  textGap: 16, // 柱状条末端与数额之间的空隙
  textEndPad: 16, // 数额距轨道右端的最小留白
  rightPad: 26, // 页面右侧留白
  namePad: 18, // 名称距柱状条左端的距离
  countFontSize: TYPE.headlineLarge.size, // 数额字号
  percentFontSize: TYPE.bodyLarge.size, // 百分比字号，比数额小两档
  percentGap: 9, // 数额与百分比之间的空隙
  pagePadX: 28,
  pagePadY: 32,
  iconSize: 32,
} as const

/**
 * 形状刻度：条、轨道与头像都取全圆角（SHAPE 的 full 档），在 52px 的行高上
 * 就是行高的一半，两端收成圆头。
 * 下面这条是条的起点：头像宽度加一道头像与条之间的空隙。
 */
const BAR_X = LAYOUT.avatarSize + LAYOUT.avatarGap

/**
 * 要对齐的读数（数额、占比）走等宽栈。
 * 等宽栈里没有汉字，把正文栈接在后面，读数里可能夹的字才不掉队。
 */
const NUM_FONT = `${MONO_STACK},${FONT_STACK}`

/*
 * 同一支色相里的四个色调，取值与 message-counter 一致：
 * 条 48、轨道 93、数额 32、占比 54。条固定在色调 48，条上的白字永远够对比，
 * 不必逐行判断该配深字还是浅字。
 */
const TONE = { bar: 48, track: 93, value: 32, percent: 54 } as const

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
  total > 0 ? `${((value / total) * 100).toFixed(2)}%` : ''

/**
 * 样式 2：带头像的水平条形榜。
 *
 * 每行的条色由头像主色推出，但只借它的色相——色调和彩度都换成设计系统的取值。
 * 这样既保留了「这条是我的颜色」，整张图的明暗节奏又是齐的，
 * 不会因为谁的头像特别暗而糊掉，文字对比度也始终够。
 */
export function renderChart(title: string, subtitle: string, rows: ChartRow[], icons: Asset[], backgrounds: Asset[], options: ChartOptions) {
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

  const widest = blocks.reduce((max, block) => Math.max(max, block.width), 0)
  const trackWidth = Math.ceil(
    LAYOUT.barMinWidth + LAYOUT.barSpan + LAYOUT.textGap + widest + LAYOUT.textEndPad,
  )
  const pageWidth = BAR_X + trackWidth + LAYOUT.rightPad + LAYOUT.pagePadX * 2

  // 刻度线：八道等距，自条的零点起一格一道，只刻在轨道里
  const ticks = Array.from(
    { length: 8 },
    (_, index) =>
      `<i style="left:${LAYOUT.barMinWidth + (LAYOUT.barSpan / 7) * index}px"></i>`,
  ).join('')

  const items = rows.map((row, index) => {
    const source = row.accent || GRAY
    const accent = harmonize(source, TONE.bar, 46, HUE)
    const track = harmonize(source, TONE.track, 12, HUE)
    const valueInk = harmonize(source, TONE.value, 30, HUE)
    const percentInk = harmonize(source, TONE.percent, 20, HUE)

    const barWidth = LAYOUT.barMinWidth + (LAYOUT.barSpan * row.count) / top
    const block = blocks[index]

    // 放不下时贴着轨道右端，避免溢出页面
    const trackRight = trackWidth
    let textX = barWidth + LAYOUT.textGap
    if (textX + block.width > trackRight - LAYOUT.textEndPad) {
      textX = Math.max(LAYOUT.namePad, trackRight - LAYOUT.textEndPad - block.width)
    }

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
          <span class="value" style="left:${textX.toFixed(1)}px;color:${valueInk}">${block.countText}${
            block.percentText
              ? `<b style="color:${percentInk}">${block.percentText}</b>`
              : ''
          }</span>
        </span>
      </li>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${h.escape(title)}</title>
  <style>
    ${baseline(SCHEME)}
    html { min-height: 100%; background: linear-gradient(135deg, ${SCHEME.surfaceBright} 0%, ${SCHEME.surfaceContainer} 100%); }
    body {
      width: ${pageWidth}px;
      padding: ${LAYOUT.pagePadY}px ${LAYOUT.pagePadX}px ${LAYOUT.pagePadY + 8}px;
      background: transparent;
    }

    /* 页眉左对齐：标题与下面的榜单同一条起始线，比居中更稳 */
    .head { margin: 0 0 28px; padding-left: 2px; }
    .head h1 {
      margin: 0;
      font-size: ${TYPE.displaySmall.size}px; line-height: ${TYPE.displaySmall.line}px;
      font-weight: ${EMPHASIZED_WEIGHT.display}; letter-spacing: ${TYPE.displaySmall.tracking}px;
      color: ${SCHEME.onSurface};
    }
    .head p {
      margin: 8px 0 0;
      font-size: ${TYPE.bodyMedium.size}px; line-height: ${TYPE.bodyMedium.line}px;
      font-weight: ${TYPE.bodyMedium.weight}; letter-spacing: ${TYPE.bodyMedium.tracking}px;
      color: ${SCHEME.onSurfaceVariant};
    }
    /* 分隔点自己带匀称的左右间距，不依赖字体里「·」的空腔 */
    .head .sep { margin: 0 9px; opacity: .55; }

    .rows { display: flex; flex-direction: column; gap: ${LAYOUT.rowGap}px; margin: 0; padding: 0; list-style: none; }
    .row { display: flex; align-items: center; gap: ${LAYOUT.avatarGap}px; height: ${LAYOUT.avatarSize}px; }

    .avatar {
      width: ${LAYOUT.avatarSize}px; height: ${LAYOUT.avatarSize}px; flex: none;
      border-radius: var(--md-sys-shape-corner-full); object-fit: cover;
      background: ${SCHEME.surfaceContainerHighest};
    }

    /* 轨道比最长的条还要宽出一截，数额就写在这段轨道上 */
    .track {
      position: relative; flex: none;
      width: ${trackWidth}px; height: ${LAYOUT.avatarSize}px;
      border-radius: var(--md-sys-shape-corner-full);
      overflow: hidden;
    }

    /* 刻度线压在实色条下面，文字始终在最上层 */
    .ticks { position: absolute; inset: 0; }
    .ticks i { position: absolute; top: 0; bottom: 0; width: 2px; background: ${SCHEME.outlineVariant}; }

    .bar {
      position: absolute; left: 0; top: 0; bottom: 0;
      display: flex; align-items: center;
      padding-left: ${LAYOUT.namePad}px;
      border-radius: var(--md-sys-shape-corner-full);
      overflow: hidden;
    }
    /* 自定义背景图铺在条上，盖不住的地方仍是头像主色 */
    .wash { position: absolute; inset: 0; background-size: cover; background-position: center; }

    .name {
      position: relative;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: ${TYPE.headlineLarge.size}px; line-height: ${LAYOUT.avatarSize}px;
      font-weight: ${TYPE.headlineLarge.weight};
      color: ${SCHEME.onPrimary}; text-shadow: 0 1px 3px rgba(0, 0, 0, .45);
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
    .value b { font-size: ${TYPE.bodyLarge.size}px; font-weight: ${TYPE.bodyLarge.weight}; }
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
