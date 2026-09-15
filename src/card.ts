import { h } from 'koishi'
import { baseline, components, palettesOf, scheme } from './m3'
import { RankEntry } from './model'

/** 货币榜取金色主调；第三色改取 -60° 的赤铜，比 +60° 的绿更贴「钱」的语义。 */
const HUE = 78
const SOURCE = { tertiaryShift: -60 }
const SCHEME = scheme(HUE, false, SOURCE)

/*
 * 条色不用 primary（色调 40）。黄色系在低色调上必然发闷，
 * 抬到色调 52 才是这个色相真正鲜亮的那一段。
 */
const BAR = palettesOf(HUE, SOURCE).primary(52)

/** 名次前三用主 / 次 / 第三色的徽章，之后退回中性色，视线只落在头部。 */
const BADGE = ['m3-badge--gold', 'm3-badge--silver', 'm3-badge--bronze']

/** 样式 3：紧凑的卡片式榜单，不带头像，适合窄图。 */
export function renderCard(title: string, rows: RankEntry[], currency: string) {
  const top = rows[0]?.value || 1

  const items = rows.map((row, index) => `
      <li class="m3-list-item${index === 0 ? ' m3-list-item--accent' : ''}">
        <span class="m3-badge ${BADGE[index] || ''}">${index + 1}</span>
        <span class="name">${h.escape(row.username)}</span>
        <span class="m3-bar${index === 0 ? ' m3-bar--on-accent' : ''}">
          <span class="m3-bar__fill" style="flex:${Math.max(row.value, top * 0.04)};background:${BAR}"></span>
          <span class="m3-bar__track" style="flex:${Math.max(0, top - row.value)}"></span>
        </span>
        <span class="value">${row.value}</span>
      </li>`).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${h.escape(title)}</title>
  <style>
    ${baseline(SCHEME)}${components()}
    body { padding: 28px 24px 24px; }
    .m3-list-item { min-height: 52px; gap: 12px; }
    .name {
      flex: 0 0 auto; max-width: 168px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 16px; line-height: 24px; font-weight: 600; letter-spacing: .15px;
    }
    .m3-bar { flex: 1 1 auto; min-width: 72px; }
    .value {
      flex: none; min-width: 72px; text-align: right;
      font-size: 16px; line-height: 24px; font-weight: 600; font-variant-numeric: tabular-nums;
    }
    .value::after {
      content: " ${h.escape(currency)}"; margin-left: 2px;
      font-size: 11px; font-weight: 600; letter-spacing: .5px; opacity: .6;
    }
  </style>
</head>
<body>
  <div class="m3-header">
    <h1 class="m3-header__title">${h.escape(title)}</h1>
    <p class="m3-header__support">共 ${rows.length} 位 · 货币「${h.escape(currency)}」</p>
  </div>
  <ul class="m3-list">${items}
  </ul>
</body>
</html>`
}
