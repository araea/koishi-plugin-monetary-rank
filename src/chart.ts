import { h } from 'koishi'
import { Asset } from './assets'
import { baseline, components, harmonize, scheme, SHAPE } from './m3'

/** 与卡片样式共用同一个主色，两种样式换着看也是同一套观感。 */
const HUE = 78
const SCHEME = scheme(HUE, false, { tertiaryShift: -60 })

const ROW_HEIGHT = 64
const AVATAR = 48
const BAR_MIN = 0.06
/** 条形轨道的大致可用宽度，用来判断名字放不放得下。 */
const TRACK_WIDTH = 720

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

const dataUrl = (base64: string) => `url("data:image/png;base64,${base64}")`

/**
 * 样式 2：带头像的水平条形榜。
 *
 * 每行的条色由头像主色推出，但只借它的色相——色调和彩度都换成设计系统的取值。
 * 这样既保留了「这条是我的颜色」，整张图的明暗节奏又是齐的，
 * 不会因为谁的头像特别暗而糊掉，文字对比度也始终够。
 */
export function renderChart(title: string, subtitle: string, rows: ChartRow[], icons: Asset[], backgrounds: Asset[], options: ChartOptions) {
  const top = rows.reduce((max, row) => Math.max(max, row.count), 0) || 1

  const items = rows.map((row, index) => {
    const accent = harmonize(row.accent || '#808080', 48, 46, HUE)
    const ratio = Math.max(BAR_MIN, row.count / top)

    // 分数低的人条很短，名字塞进去只会被截断；放到条外面用正文色写，反而读得清
    const needed = [...row.name].length * 19 + 40
    const inside = ratio * TRACK_WIDTH >= needed

    const chosen = pick(backgrounds, row.userId)
    const background = chosen.length ? chosen[Math.floor(Math.random() * chosen.length)] : ''
    // 整行铺底与条内铺底是两层独立的不透明度，配置里分开控制
    const fullLayer = background && options.horizontalBarBackgroundFullOpacity > 0
      ? `<span class="wash" style="background-image:${dataUrl(background)};opacity:${options.horizontalBarBackgroundFullOpacity}"></span>`
      : ''
    const barLayer = background
      ? `<span class="wash" style="background-image:${dataUrl(background)};opacity:${options.horizontalBarBackgroundOpacity}"></span>`
      : ''

    const badges = pick(icons, row.userId)
      .map((base64) => `<img class="icon" src="data:image/png;base64,${base64}">`).join('')

    return `
      <li class="row">
        <span class="m3-badge ${index < 3 ? ['m3-badge--gold', 'm3-badge--silver', 'm3-badge--bronze'][index] : ''}">${index + 1}</span>
        <img class="avatar" src="data:image/png;base64,${row.avatarBase64}">
        <span class="track">
          ${fullLayer}
          <span class="bar" style="width:${(ratio * 100).toFixed(2)}%;background:${accent}">
            ${barLayer}
            <span class="label">
              ${inside ? `<span class="who">${h.escape(row.name)}</span>` : ''}
              ${options.shouldMoveIconToBarEndLeft ? '' : badges}
            </span>
            ${options.shouldMoveIconToBarEndLeft ? `<span class="tail">${badges}</span>` : ''}
          </span>
          ${inside ? '' : `<span class="who who--outside" style="left:calc(${(ratio * 100).toFixed(2)}% + 12px)">${h.escape(row.name)}</span>`}
        </span>
        <span class="count">${row.count}</span>
      </li>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${h.escape(title)}</title>
  <style>
    ${baseline(SCHEME)}${components()}
    body { padding: 32px 28px 28px; width: 1080px; }

    .m3-list { gap: 6px; }
    .row {
      display: flex; align-items: center; gap: 14px;
      height: ${ROW_HEIGHT}px; padding: 0 16px 0 12px;
      border-radius: ${SHAPE.large}px;
      background: var(--md-sys-color-surface-container);
    }
    .avatar {
      width: ${AVATAR}px; height: ${AVATAR}px; flex: none;
      border-radius: var(--md-sys-shape-corner-full); object-fit: cover;
      background: var(--md-sys-color-surface-container-highest);
    }

    /* 轨道与条都是全圆角；条压在轨道左端，超出的部分裁掉 */
    .track {
      position: relative; flex: 1; min-width: 0; height: ${AVATAR}px;
      border-radius: var(--md-sys-shape-corner-full);
      background: var(--md-sys-color-surface-container-highest);
      overflow: hidden;
    }
    .bar {
      position: relative; display: flex; align-items: center; justify-content: space-between;
      height: 100%; min-width: ${AVATAR}px; padding: 0 16px;
      border-radius: var(--md-sys-shape-corner-full);
      overflow: hidden;
    }
    /* 自定义背景图铺在条上，盖不住的地方仍是头像主色 */
    .wash {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
    }
    .label { position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; }
    .who {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 18px; line-height: 24px; font-weight: 600; letter-spacing: .1px;
      color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, .45);
    }
    /* 条外的名字写在轨道上，换成正文色，不需要投影 */
    .who--outside {
      position: absolute; top: 50%; right: 12px; transform: translateY(-50%);
      color: var(--md-sys-color-on-surface-variant); text-shadow: none;
    }
    .tail { position: relative; display: flex; align-items: center; gap: 4px; }
    .icon { width: 32px; height: 32px; object-fit: contain; }

    .count {
      flex: none; min-width: 108px; text-align: right;
      font-size: 20px; line-height: 28px; font-weight: 600; font-variant-numeric: tabular-nums;
      color: var(--md-sys-color-on-surface);
    }
  </style>
</head>
<body>
  <div class="m3-header">
    <h1 class="m3-header__title">${h.escape(title)}</h1>
    <p class="m3-header__support">${h.escape(subtitle)}</p>
  </div>
  <ul class="m3-list">${items}
  </ul>
</body>
</html>`
}
