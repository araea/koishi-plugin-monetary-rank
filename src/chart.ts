import { Asset } from './assets'

export interface ChartRow {
  name: string
  userId: string
  count: number
  avatarBase64: string
}

export interface ChartOptions {
  horizontalBarBackgroundOpacity: number
  horizontalBarBackgroundFullOpacity: number
  shouldMoveIconToBarEndLeft: boolean
}

/** 在浏览器里执行的绘图函数，整段被序列化进页面。 */
const CLIENT_SCRIPT = String.raw`
async ({ rows, icons, backgrounds, options }) => {
  const ROW_HEIGHT = 50
  const BAR_X = 50
  const BAR_MIN = 150
  const BAR_SPAN = 700
  const TABLE_WIDTH = BAR_X + BAR_MIN + BAR_SPAN
  const FONT = '30px "Microsoft YaHei", sans-serif'

  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0) || 1
  const canvas = document.getElementById('rankingCanvas')
  let context = canvas.getContext('2d')

  context.font = FONT
  const widest = rows.find((row) => row.count === maxCount) || rows[0] || { count: 1 }
  canvas.width = TABLE_WIDTH + 10 + context.measureText(String(widest.count)).width + 20
  canvas.height = ROW_HEIGHT * rows.length

  // 改尺寸会重置上下文状态，必须重新拿一次
  context = canvas.getContext('2d')

  for (const [index, row] of rows.entries()) {
    const barWidth = BAR_MIN + (BAR_SPAN * row.count) / maxCount
    const barY = ROW_HEIGHT * index
    let avgColor = await averageColor(row.avatarBase64)
    // 右侧留白用头像本色的半透明版本，不随自定义背景改变
    const restColor = avgColor + '80'

    context.fillStyle = avgColor
    context.fillRect(BAR_X, barY, barWidth, ROW_HEIGHT)

    const userBackgrounds = pick(backgrounds, row.userId)
    if (userBackgrounds.length) {
      const chosen = userBackgrounds[Math.floor(Math.random() * userBackgrounds.length)]
      avgColor = await drawBackground(context, chosen, BAR_X, barY, barWidth) || avgColor
    }

    context.fillStyle = restColor
    context.fillRect(BAR_X + barWidth, barY, TABLE_WIDTH - BAR_X - barWidth, ROW_HEIGHT)

    await drawLabels(context, row, avgColor, barY, barWidth)
  }

  for (const [index, row] of rows.entries()) {
    await drawImage(row.avatarBase64, (image) =>
      context.drawImage(image, 0, ROW_HEIGHT * index, ROW_HEIGHT, ROW_HEIGHT))
  }

  context.fillStyle = 'rgba(0, 0, 0, 0.12)'
  for (let i = 0; i < 8; i++) context.fillRect(200 + 100 * i, 0, 3, canvas.height)

  // --- 辅助函数 ---

  function pick(assets, userId) {
    return assets.filter((asset) => asset.userId === userId).map((asset) => asset.base64)
  }

  function drawImage(base64, draw) {
    return new Promise((resolve) => {
      const image = new Image()
      image.src = 'data:image/png;base64,' + base64
      image.onload = async () => resolve(await draw(image))
      image.onerror = () => resolve(undefined)
    })
  }

  function drawBackground(context, base64, x, y, barWidth) {
    return drawImage(base64, async (image) => {
      context.save()
      if (options.horizontalBarBackgroundFullOpacity > 0) {
        context.globalAlpha = options.horizontalBarBackgroundFullOpacity
        context.drawImage(image, x, y, TABLE_WIDTH - x, ROW_HEIGHT)
      }
      context.globalAlpha = options.horizontalBarBackgroundOpacity
      context.drawImage(image, 0, 0, barWidth, ROW_HEIGHT, x, y, barWidth, ROW_HEIGHT)
      context.restore()
      return averageColor(base64)
    })
  }

  async function drawLabels(context, row, avgColor, barY, barWidth) {
    context.font = FONT
    const textY = barY + ROW_HEIGHT / 2 + 10.5
    const countText = String(row.count)
    const countX = BAR_X + barWidth + 10

    if (countX + context.measureText(countText).width > context.canvas.width - 5) {
      context.fillStyle = contrastColor(avgColor)
      context.textAlign = 'right'
      context.fillText(countText, BAR_X + barWidth - 10, textY)
    } else {
      context.fillStyle = 'rgba(0, 0, 0, 1)'
      context.textAlign = 'left'
      context.fillText(countText, countX, textY)
    }

    context.fillStyle = contrastColor(avgColor)
    context.textAlign = 'left'

    let name = row.name
    const maxNameWidth = barWidth - 60
    if (context.measureText(name).width > maxNameWidth) {
      while (name.length && context.measureText(name + '...').width > maxNameWidth) name = name.slice(0, -1)
      name += '...'
    }
    const nameX = BAR_X + 10
    context.fillText(name, nameX, textY)

    const userIcons = pick(icons, row.userId)
    const iconSize = 40
    await Promise.all(userIcons.map((base64, i) => drawImage(base64, (image) => {
      const iconX = options.shouldMoveIconToBarEndLeft
        ? BAR_X + barWidth - iconSize * (i + 1)
        : nameX + context.measureText(name).width + iconSize * i + 5
      context.drawImage(image, iconX, textY - 30, iconSize, iconSize)
    })))
  }

  function averageColor(base64) {
    return drawImage(base64, (image) => {
      const buffer = document.createElement('canvas')
      const bufferContext = buffer.getContext('2d', { willReadFrequently: true })
      buffer.width = image.width
      buffer.height = image.height
      bufferContext.drawImage(image, 0, 0)
      const { data } = bufferContext.getImageData(0, 0, image.width, image.height)
      let r = 0, g = 0, b = 0
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2] }
      const count = data.length / 4
      return toHex(~~(r / count), ~~(g / count), ~~(b / count))
    }).then((color) => color || '#808080')
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  }

  function toRgb(hex) {
    const value = parseInt(String(hex).replace('#', '').slice(0, 6), 16)
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
  }

  /** 依据背景亮度挑一个读得清的前景色。 */
  function contrastColor(hex) {
    const { r, g, b } = toRgb(hex)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000 / 255
    if (brightness <= 0.2 || brightness >= 0.8) return brightness >= 0.8 ? '#000000' : '#FFFFFF'
    const hsl = rgbToHsl(r, g, b)
    hsl.l = hsl.l < 0.5 ? hsl.l + 0.3 : hsl.l - 0.3
    hsl.s = hsl.s < 0.5 ? hsl.s + 0.3 : hsl.s - 0.3
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l)
    return toHex(rgb.r, rgb.g, rgb.b)
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return { h: 0, s: 0, l }
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6
    return { h, s, l }
  }

  function hslToRgb(h, s, l) {
    if (s === 0) return { r: Math.round(l * 255), g: Math.round(l * 255), b: Math.round(l * 255) }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const channel = (t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    return {
      r: Math.round(channel(h + 1 / 3) * 255),
      g: Math.round(channel(h) * 255),
      b: Math.round(channel(h - 1 / 3) * 255),
    }
  }
}`

export function renderChart(title: string, subtitle: string, rows: ChartRow[], icons: Asset[], backgrounds: Asset[], options: ChartOptions) {
  // 昵称是用户可控内容，转义 `<` 以免提前闭合 <script>
  const payload = JSON.stringify({ rows, icons, backgrounds, options }).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>排行榜</title>
  <style>
    html { min-height: 100%; background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%); }
    body { margin: 0; padding: 20px; box-sizing: border-box; font-family: "Microsoft YaHei", sans-serif; }
    h1 { text-align: center; margin: 0 0 20px; color: #333; font-size: 24px; }
  </style>
</head>
<body>
  <h1>${subtitle}</h1>
  <h1>${title}</h1>
  <canvas id="rankingCanvas"></canvas>
  <script>(async () => { await (${CLIENT_SCRIPT})(${payload}) })()</script>
</body>
</html>`
}
