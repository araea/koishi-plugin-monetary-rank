import { h } from 'koishi'
import { RankEntry } from './model'

const MEDALS = ['🥇', '🥈', '🥉']

/** 样式 3：deer-pipe 那种卡片式榜单。 */
export function renderCard(title: string, rows: RankEntry[]) {
  const items = rows.map((row, index) => `
      <li>
        <span class="order">${index + 1}</span>
        ${MEDALS[index] ? `<span class="medal">${MEDALS[index]}</span>` : ''}
        <span class="name">${h.escape(row.username)}</span>
        <span class="count">${row.value}</span>
      </li>`).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${h.escape(title)}</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f0f4f8; font-family: "Microsoft YaHei", Arial, sans-serif;
    }
    .container {
      width: 100%; max-width: 500px; padding: 30px; box-sizing: border-box;
      background: #fff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, .1);
    }
    h1 { margin: 0 0 30px; text-align: center; color: #2c3e50; font-size: 28px; }
    ol { margin: 0; padding: 0; list-style: none; }
    li { display: flex; align-items: center; padding: 15px 10px; border-bottom: 1px solid #ecf0f1; }
    li:last-child { border-bottom: none; }
    .order { min-width: 30px; margin-right: 15px; color: #7f8c8d; font-size: 18px; font-weight: bold; }
    .medal { margin-right: 15px; font-size: 24px; }
    .name { flex-grow: 1; font-size: 18px; }
    .count { color: #e74c3c; font-size: 18px; font-weight: bold; }
    .count::after { content: " 币"; color: #95a5a6; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🦌 ${h.escape(title)} 🦌</h1>
    <ol>${items}
    </ol>
  </div>
</body>
</html>`
}
