import {Context, h, Schema} from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {} from '@koishijs/canvas'
import path from "path";
import fs from "fs";

export const name = 'monetary-rank'
export const inject = {
  required: ['database', 'monetary'],
  optional: ['puppeteer', 'canvas'],
}
export const usage = `## 🌈 使用指南

### 基本使用

- 使用指令查看对应排行榜，刚开始使用时可能没有数据，需要用户发送消息后才会有数据。
- 建议自行添加别名：可以将 \`monetaryRank.本群个人货币排行榜\` 添加别名为 \`本群货币排行榜\`，以便更方便地使用。

### 高级功能：自定义水平柱状图（与发言排行榜共用）

水平柱状图样式 2 支持强大的自定义功能，让你的排行榜更加个性化！🎨

* **自定义用户图标**:
  - 在 \`data/messageCounterIcons\` 文件夹下添加用户图标，文件名为用户 ID (例如 \`1234567890.png\`)。
  - 支持为同一用户添加多个图标，它们会同时显示。多个图标的文件名需形如  \`1234567890-1.png\`、 \`1234567890-2.png\` 。
* **自定义水平柱状条背景**:
  - 在 \`data/messageCounterBarBgImgs\` 文件夹下添加水平柱状条背景图片，建议图片尺寸为 850*50 像素，文件名为用户 ID (例如
    \`1234567890.png\`)。
  - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。多个图片的文件名需形如 \`1234567890-1.png\`、\`1234567890-2.png\`。

> 添加完图片后，记得重启插件以使更改生效！ 🔄

## 🌼 命令

- \`monetaryRank\` - 查看货币排行榜帮助
- \`monetaryRank.本群个人货币排行榜 [displaySize:number]\` - 查看本群个人货币排行榜
- \`monetaryRank.跨群个人货币排行榜 [displaySize:number]\` - 查看跨群个人货币排行榜

> 其中 \`displaySize\` 是可选参数，用于指定显示的排行数量。

## 🐱 QQ 群

- 956758505`

// pz*
export interface Config {
  // 排行榜显示设置
  defaultLeaderboardDisplayCount: number;

  // 图片转换功能设置
  isLeaderboardDisplayedAsImage: boolean;
  style: '1' | '2';
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  horizontalBarBackgroundFullOpacity: number;
  horizontalBarBackgroundOpacity: number;
  shouldMoveIconToBarEndLeft: boolean;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultLeaderboardDisplayCount: Schema.number().min(1).default(10).description('默认排行榜显示数量。'),
  }).description('排行榜显示设置'),

  Schema.object({
    isLeaderboardDisplayedAsImage: Schema.boolean().default(false).description(`排行榜是否以图片形式显示，需要启用 \`puppeteer\` 服务。`),
    style: Schema.union([
      Schema.const('1').description('样式 1（文字列表）'),
      Schema.const('2').description('样式 2（水平柱状图）'),
    ]).role('radio').default('2').description('排行榜样式。'),
    waitUntil: Schema.union(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).default('networkidle0').description('（仅样式 2）等待页面加载的事件。'),
    horizontalBarBackgroundFullOpacity: Schema.number().min(0).max(1).default(0).description('（仅样式 2）自定义水平柱状条背景整条的不透明度，值越小则越透明。'),
    horizontalBarBackgroundOpacity: Schema.number().min(0).max(1).default(0.6).description('（仅样式 2）自定义水平柱状条背景的不透明度，值越小则越透明。'),
    shouldMoveIconToBarEndLeft: Schema.boolean().default(true).description('（仅样式 2）是否将自定义图标移动到水平柱状条末端的左侧，关闭后将放在用户名的右侧。'),
  }).description('图片转换功能设置'),
])

// smb*
declare module 'koishi' {
  interface Tables {
    username: Username;
    monetary: Monetary
  }
}

// jk*
interface Binding {
  pid: string; // userId
  bid: number;
  aid: number; // uid
  platform: string;
}

interface Monetary {
  uid: number;
  value: number;
  currency: string;
}

interface Username {
  id: number;
  uid: number;
  userId: string;
  avatar?: string;
  platform: string;
  username: string;
  channelId: string;
}

interface MonetaryRank {
  uid: number;
  value: number;
  userId: string;
  avatar?: string; // https://th.bing.com/th/id/OIP.s5N_QuGWAIWBmUyeNemQagHaHZ?w=512&h=512&c=7&r=0&o=5&dpr=1.3&pid=1.7
  username: string; // 神秘人
  currency: string;
  platform: string;
  channelId: string;
}

interface RankingData {
  name: string;
  userId: string;
  avatar: string;
  count: number;
  percentage: number;
  avatarBase64?: string;
}

interface IconData {
  userId: string;
  iconBase64: string;
}

interface BarBgImgs {
  userId: string;
  barBgImgBase64: string;
}

// zhs*
export async function apply(ctx: Context, config: Config) {
  // wj*
  const messageCounterIconsPath = path.join(ctx.baseDir, 'data', 'messageCounterIcons');
  const messageCounterBarBgImgsPath = path.join(ctx.baseDir, 'data', 'messageCounterBarBgImgs');
  const filePath = path.join(__dirname, 'emptyHtml.html').replace(/\\/g, '/');
  await ensureDirExists(messageCounterIconsPath);
  await ensureDirExists(messageCounterBarBgImgsPath);
  // cl*
  const logger = ctx.logger('monetaryRank');
  const iconData: IconData[] = readIconsFromFolder(messageCounterIconsPath);
  const barBgImgs: BarBgImgs[] = readBgImgsFromFolder(messageCounterBarBgImgsPath);
  // tzb*
  ctx.model.extend('username', {
    id: 'unsigned',
    uid: 'unsigned',
    userId: 'string',
    avatar: 'string',
    platform: 'string',
    username: 'string',
    channelId: 'string',
  }, {primary: 'id', autoInc: true});

  // jt* sj*
  ctx.on('message', async (session) => {
    const user: Username[] = await ctx.database.get('username', {userId: session.userId, channelId: session.channelId});
    const username = session.author.nick ? session.author.nick : session.author.name ? session.author.name : '神秘人';
    const avatar = session.author.avatar ? session.author.avatar : 'https://th.bing.com/th/id/OIP.s5N_QuGWAIWBmUyeNemQagHaHZ?w=512&h=512&c=7&r=0&o=5&dpr=1.3&pid=1.7';
    if (user.length === 0) {
      const binding: Binding[] = await ctx.database.get('binding', {pid: session.userId, platform: session.platform});
      const uid = binding[0].aid;
      await ctx.database.create('username', {
        uid: uid,
        userId: session.userId,
        avatar: avatar,
        platform: session.platform,
        username: username,
        channelId: session.channelId,
      })
    } else if (user[0].username !== username || user[0].avatar !== avatar) {
      await ctx.database.set('username', {userId: session.userId, channelId: session.channelId}, {
        username: username,
        avatar: avatar,
      })
    }
  });

  // zl*
  // bz* h*
  ctx.command('monetaryRank', '查看货币排行榜帮助')
    .action(async ({session}) => {
      await session.execute(`monetaryRank -h`);
    });
  // bqphb*
  ctx.command('monetaryRank.本群个人货币排行榜 [displaySize:number]', '查看本群个人货币排行榜')
    .action(async ({session}, displaySize = config.defaultLeaderboardDisplayCount) => {
      if (!isValidDisplaySize(displaySize)) {
        displaySize = config.defaultLeaderboardDisplayCount;
      }
      const monetaries = await ctx.database.get('monetary', {});
      const usernames = await ctx.database.get('username', {platform: session.platform, channelId: session.channelId});
      const bindings = await ctx.database.get('binding', {platform: session.platform});
      const monetaryRanks = generateMonetaryRanks(monetaries, usernames, bindings).filter(rank => rank.channelId === session.channelId).slice(0, displaySize);
      if (config.isLeaderboardDisplayedAsImage) {
        const rankTitle = `本群个人货币排行榜`;
        const html = await generateLeaderboardHtml(rankTitle, monetaryRanks);
        await htmlToBufferAndSendMessage(session, html);
      } else {
        await sendMessage(session, `本群个人货币排行榜：\n${monetaryRanks.map((rank, index) => `${index + 1}. ${rank.username}(${rank.userId}) - ${rank.value}`).join('\n')}`);
      }
    });
  // kqphb*
  ctx.command('monetaryRank.跨群个人货币排行榜 [displaySize:number]', '查看跨群个人货币排行榜')
    .action(async ({session}, displaySize = config.defaultLeaderboardDisplayCount) => {
      if (!isValidDisplaySize(displaySize)) {
        displaySize = config.defaultLeaderboardDisplayCount;
      }
      const monetaries = await ctx.database.get('monetary', {});
      const usernames = await ctx.database.get('username', {platform: session.platform});
      const bindings = await ctx.database.get('binding', {platform: session.platform});
      const monetaryRanks = generateMonetaryRanks(monetaries, usernames, bindings).slice(0, displaySize);
      if (config.isLeaderboardDisplayedAsImage) {
        const rankTitle = `跨群个人货币排行榜`;
        const html = await generateLeaderboardHtml(rankTitle, monetaryRanks);
        await htmlToBufferAndSendMessage(session, html);
      } else {
        await sendMessage(session, `跨群个人货币排行榜：\n${monetaryRanks.map((rank, index) => `${index + 1}. ${rank.username}(${rank.userId}) - ${rank.value}`).join('\n')}`);
      }
    });

  // hs*
  function readBgImgsFromFolder(folderPath: string): BarBgImgs[] {
    const barBgImgs: BarBgImgs[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split('-')[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const barBgImgBase64 = fileData.toString('base64');

        barBgImgs.push({userId, barBgImgBase64});
      });

    } catch (err) {
      logger.error('读取水平柱状图背景图时出错：', err);
    }

    return barBgImgs;
  }

  function readIconsFromFolder(folderPath: string): IconData[] {
    const iconData: IconData[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split('-')[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const iconBase64 = fileData.toString('base64');

        iconData.push({userId, iconBase64});
      });

    } catch (err) {
      logger.error('读取图标时出错：', err);
    }

    return iconData;
  }

  async function ensureDirExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, {recursive: true});
    }
  }

  async function htmlToBufferAndSendMessage(session, html: string): Promise<void> {
    ctx.inject(['puppeteer'], async (ctx) => {
      const browser = ctx.puppeteer.browser;
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      if (config.style === '1') {
        await page.setViewport({width: 800, height: 100, deviceScaleFactor: 2})
      } else if (config.style === '2') {
        await page.setViewport({width: 1080, height: 256, deviceScaleFactor: 1})
      }
      await page.goto('file://' + filePath);

      await page.setContent(h.unescape(html), {waitUntil: config.waitUntil});

      const buffer = await page.screenshot({type: 'png', fullPage: true});
      await page.close();
      await context.close();
      await sendMessage(session, h.image(buffer, 'image/png'));
    });
  }

  function generateLeaderboardHtmlStyle1(rankTitle: string, monetaryRanks: MonetaryRank[]): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const formattedTime = `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;

    return `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Leaderboard</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      background-image: url('./assets/background.jpg');
                      background-size: cover;
                      background-repeat: no-repeat;
                      background-attachment: fixed;
                      margin: 0;
                      padding: 20px;
                  }
                  .leaderboard {
                      background-color: #fff;
                      border-radius: 8px;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                      overflow: hidden;
                      max-width: 600px;
                      margin: 0 auto;
                  }
                  .leaderboard-header {
                      background-color: #333;
                      color: #fff;
                      padding: 15px;
                      text-align: center;
                      font-size: 24px;
                      font-weight: bold;
                  }
                  .leaderboard-item {
                      display: flex;
                      align-items: center;
                      padding: 10px 15px;
                      border-bottom: 1px solid #eee;
                  }
                  .leaderboard-item:last-child {
                      border-bottom: none;
                  }
                  .rank {
                      font-weight: bold;
                      margin-right: 15px;
                      min-width: 30px;
                      text-align: center;
                  }
                  .user-info {
                      display: flex;
                      align-items: center;
                      flex-grow: 1;
                  }
                  .avatar {
                      width: 40px;
                      height: 40px;
                      border-radius: 50%;
                      margin-right: 10px;
                  }
                  .username {
                      font-weight: bold;
                  }
                  .user-id {
                      font-size: 12px;
                      color: #888;
                      margin-left: 10px;
                  }
                  .value {
                      font-weight: bold;
                      text-align: right;
                  }
                  .leaderboard-footer {
                      background-color: #f0f0f0;
                      padding: 10px;
                      text-align: center;
                      font-size: 12px;
                      color: #333;
                  }
                  .background-overlay {
                      position: fixed;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      background-color: rgba(255, 255, 255, 0.5);
                      backdrop-filter: blur(5px);
                      z-index: -1;
                  }
              </style>
          </head>
          <body>
              <div class="background-overlay"></div>
              <div class="leaderboard">
                  <div class="leaderboard-header">${rankTitle}</div>
                  ${monetaryRanks.map((rank, index) => `
                      <div class="leaderboard-item">
                          <span class="rank">${index + 1}</span>
                          <div class="user-info">
                              ${rank.avatar ? `<img class="avatar" src="${rank.avatar}" alt="${rank.username}'s avatar">` : ''}
                              <span class="username">${rank.username}</span>
                              <span class="user-id">(${rank.userId})</span>
                          </div>
                          <span class="value">${rank.value}</span>
                      </div>
                  `).join('')}
                  <div class="leaderboard-footer">
                      更新时间：${formattedTime}
                  </div>
              </div>
          </body>
          </html>
      `;
  }

  function getCurrentBeijingTime(): string {
    const beijingTime = new Date().toLocaleString("zh-CN", {timeZone: "Asia/Shanghai"});
    const date = beijingTime.split(" ")[0];
    const time = beijingTime.split(" ")[1];

    return `${date} ${time}`;
  }

  async function updateDataWithBase64(data: RankingData[]) {
    await Promise.all(
      data.map(async (item) => {
        item.avatarBase64 = await resizeImageToBase64(item.avatar);
      })
    );
  }

  async function resizeImageToBase64(url: string) {
    const response = await fetch(url);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    const canvas = await ctx.canvas.createCanvas(50, 50);
    const context = canvas.getContext('2d');

    const image = await ctx.canvas.loadImage(imageBuffer);
    context.drawImage(image, 0, 0, 50, 50);

    const buffer = await canvas.toBuffer('image/png');
    return buffer.toString('base64');
  }

  function convertMonetaryRanksToRankingData(monetaryRanks: MonetaryRank[]): RankingData[] {
    const totalValue = monetaryRanks.reduce((sum, rank) => sum + rank.value, 0);

    const rankingDatas: RankingData[] = monetaryRanks.map(rank => ({
      name: rank.username,
      userId: rank.userId,
      avatar: rank.avatar || '',
      count: rank.value,
      percentage: totalValue > 0 ? Math.round((rank.value / totalValue) * 100) : 0,
      avatarBase64: undefined, // 可选项，保持为空
    }));

    rankingDatas.sort((a, b) => b.count - a.count);

    return rankingDatas;
  }

  async function generateLeaderboardHtmlStyle2(rankTitle: string, monetaryRanks: MonetaryRank[]) {
    const rankTimeTitle = getCurrentBeijingTime();
    const data = convertMonetaryRanksToRankingData(monetaryRanks);
    await updateDataWithBase64(data);
    return `
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ranking Board</title>
    <style>
           @font-face {
            font-family: 'JMH';
            src: local('JMH'), url('./assets/fonts/JMH.woff2') format('woff2');
        }
           @font-face {
            font-family: 'SJkaishu';
            src: local('SJkaishu'), url('./assets/fonts/SJkaishu.woff2') format('woff2');
        }
        @font-face {
            font-family: 'SJbangkaijianti';
            src: local('SJbangkaijianti'), url('./assets/fonts/SJbangkaijianti-Regular.woff2') format('woff2');
        }

            .ranking-title {
            text-align: center;
            margin-bottom: 20px;
        }

    body {
      font-family: 'JMH', 'SJbangkaijianti', 'SJkaishu';
    }
    </style>
</head>
<body>
      <h1 class="ranking-title" style="font-family: 'JMH'; font-weight: normal; font-style: normal;">${rankTimeTitle}</h1>
      <h1 class="ranking-title" style="font-family: 'JMH'; font-weight: normal; font-style: normal;">${rankTitle}</h1>
      <h1 class="ranking-title" style="display: none;font-family: 'SJkaishu'; font-weight: normal; font-style: normal;">SJkaishu</h1>
      <h1 class="ranking-title" style="display: none;font-family: 'SJbangkaijianti'; font-weight: normal; font-style: normal;">SJbangkaijianti</h1>
<canvas id="rankingCanvas"></canvas>

<script>
    window.onload = async () => {
        await drawRanking();
    }

    async function drawRanking() {
        let rankingData = ${JSON.stringify(data)};
        let iconData = ${JSON.stringify(iconData)};
        let barBgImgs = ${JSON.stringify(barBgImgs)};
        const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0);
        const maxCountText = maxCount.toString()
        const userNum = rankingData.length;
        const userAvatarSize = 50;
        const firstVerticalLineX = 200;
        const verticalLineWidth = 3;
        const tableWidth = 200 + 100 * 7;
        const canvasWidth = tableWidth + 100;
        const canvasHeight = 50 * userNum;

        const canvas = document.getElementById('rankingCanvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        let context = canvas.getContext('2d');
        const maxCountTextWidth = context.measureText(maxCountText).width
        canvas.width = canvasWidth + maxCountTextWidth;
        canvas.height = canvasHeight;
        context = canvas.getContext('2d');


        // 绘制用户头像
        await drawAvatars(context, rankingData, userAvatarSize);
        // 绘制发言次数柱状条、发言次数、用户名
        await drawRankingBars(rankingData, maxCount, context, userAvatarSize, tableWidth);
        // 绘制垂直线
        drawVerticalLines(context, firstVerticalLineX, canvasHeight, verticalLineWidth);

        function chooseColorAdjustmentMethod(hexcolor) {
            const rgb = hexToRgb(hexcolor)

            const yiqBrightness = calculateYiqBrightness(rgb)

            if (yiqBrightness > 0.2 && yiqBrightness < 0.8) {
                return adjustColorHsl(hexcolor)
            } else {
                return adjustColorYiq(hexcolor)
            }
        }

        function calculateYiqBrightness(rgb) {
            return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 / 255
        }

        function adjustColorYiq(hexcolor) {
            const rgb = hexToRgb(hexcolor)
            const yiqBrightness = calculateYiqBrightness(rgb)
            return yiqBrightness >= 0.8 ? "#000000" : "#FFFFFF"
        }

        function adjustColorHsl(hexcolor) {
            const rgb = hexToRgb(hexcolor)

            let hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)

            hsl.l = hsl.l < 0.5 ? hsl.l + 0.3 : hsl.l - 0.3
            hsl.s = hsl.s < 0.5 ? hsl.s + 0.3 : hsl.s - 0.3

            const contrastRgb = hslToRgb(hsl.h, hsl.s, hsl.l)
            return rgbToHex(contrastRgb.r, contrastRgb.g, contrastRgb.b)
        }

        function hexToRgb(hex) {
            const sanitizedHex = String(hex).replace("#", "")

            const bigint = parseInt(sanitizedHex, 16)
            const r = (bigint >> 16) & 255
            const g = (bigint >> 8) & 255
            const b = bigint & 255

            return {r, g, b}
        }

        function rgbToHsl(r, g, b) {
            ;(r /= 255), (g /= 255), (b /= 255)
            const max = Math.max(r, g, b),
                min = Math.min(r, g, b)
            let h,
                s,
                l = (max + min) / 2

            if (max === min) {
                h = s = 0
            } else {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0)
                        break
                    case g:
                        h = (b - r) / d + 2
                        break
                    case b:
                        h = (r - g) / d + 4
                        break
                }
                h /= 6
            }

            return {h, s, l}
        }

        function hslToRgb(h, s, l) {
            let r, g, b

            if (s === 0) {
                r = g = b = l
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1
                    if (t > 1) t -= 1
                    if (t < 1 / 6) return p + (q - p) * 6 * t
                    if (t < 1 / 2) return q
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                    return p
                }

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s
                const p = 2 * l - q
                r = hue2rgb(p, q, h + 1 / 3)
                g = hue2rgb(p, q, h)
                b = hue2rgb(p, q, h - 1 / 3)
            }

            return {
                r: Math.round(r * 255),
                g: Math.round(g * 255),
                b: Math.round(b * 255)
            }
        }

        function rgbToHex(r, g, b) {
            const toHex = c => {
                const hex = c.toString(16)
                return hex.length === 1 ? "0" + hex : hex
            }

            return \`#\${toHex(r)}\${toHex(g)}\${toHex(b)}\`
        }

        async function drawRankingBars(
            rankingData,
            maxCount,
            context,
            userAvatarSize,
            tableWidth,
        ) {
            for (const data of rankingData) {
                const index = rankingData.indexOf(data)
                const countBarWidth = 150 + (700 * data.count) / maxCount
                const countBarX = 50
                const countBarY = 50 * index

                // 绘制发言次数柱状条
                let avgColor = await getAverageColor(data.avatarBase64)
                // const avgColor = await getAverageColor(data.avatarBase64)
                const colorWithOpacity = addOpacityToColor(avgColor, 0.5)

                context.fillStyle = \`\${avgColor}\`
                context.fillRect(countBarX, countBarY, countBarWidth, userAvatarSize)

                const barBgImgsBase64 = findBarBgImgBase64(data.userId, barBgImgs);
                if (barBgImgs.length > 0 && barBgImgsBase64 !== null) {
                        const randomBarBgImg = getRandomBarBgImg(barBgImgsBase64);
                        const barBgImg = new Image();
                        barBgImg.src = "data:image/png;base64," + randomBarBgImg;
                        barBgImg.onload = () => {

                          context.globalAlpha = ${config.horizontalBarBackgroundFullOpacity};
                          context.drawImage(barBgImg, countBarX, countBarY, tableWidth - countBarX, userAvatarSize);
                          context.globalAlpha = 1;
                          context.globalAlpha = ${config.horizontalBarBackgroundOpacity};
                          context.drawImage(barBgImg, 0, 0, countBarWidth, userAvatarSize, countBarX, countBarY, countBarWidth, userAvatarSize);
                          context.globalAlpha = 1;
                        }
                        avgColor = await getAverageColor(randomBarBgImg)
                }

                // 绘制剩余部分
                if (data.count !== maxCount) {
                    context.fillStyle = \`\${colorWithOpacity}\`
                    context.fillRect(
                        countBarX + countBarWidth,
                        countBarY,
                        tableWidth - countBarWidth - 50,
                        userAvatarSize
                    )
                }

                // 绘制用户发言次数
                context.fillStyle = "rgba(0, 0, 0, 1)" // 黑色，不透明度100%
                context.font = "30px JMH SJbangkaijianti SJkaishu"
                context.textAlign = "center"

                const countText = data.count.toString()
                const textWidth = context.measureText(countText).width

                const textX = countBarX + countBarWidth + 10 + textWidth / 2 // 根据数字宽度调整位置居中
                const textY = countBarY + userAvatarSize / 2 + 10.5

                context.fillText(countText, textX, textY)

                // 绘制用户名
                context.fillStyle = chooseColorAdjustmentMethod(avgColor);
                context.font = "30px SJbangkaijianti JMH SJkaishu";
                context.textAlign = "center";

                let nameText = data.name;
                let nameTextWidth = context.measureText(nameText).width;

                let nameTextX = countBarX + 10 + nameTextWidth / 2;
                const nameTextY = countBarY + userAvatarSize / 2 + 10.5;

                const textMaxWidth = countBarX + countBarWidth - 80;

                if (nameTextWidth > textMaxWidth) {
                    const ellipsis = "...";
                    const ellipsisWidth = context.measureText(ellipsis).width;
                    let maxNameWidth = textMaxWidth - ellipsisWidth;

                    while (nameTextWidth > maxNameWidth && nameText.length > 0) {
                        nameText = nameText.slice(0, -1);
                        nameTextWidth = context.measureText(nameText).width;
                    }
                    nameText += ellipsis;

                    nameTextX = countBarX + 10 + nameTextWidth / 2 + 13
                    context.fillText(nameText, nameTextX, nameTextY);
                } else {
                    context.fillText(nameText, nameTextX, nameTextY);
                }

                // 绘制图标
                const userIconBase64 = findIconBase64(data.userId, iconData);
                if (iconData.length > 0 && userIconBase64 !== null) {
                // 遍历 userIconBase64 数组，依次绘制图标，图标大小为 40*40，绘制在发言次数柱状条末端左侧/右侧

                for (let i = 0; i < userIconBase64.length; i++) {
                    const icon = new Image();
                    icon.src = "data:image/png;base64," + userIconBase64[i];
                    icon.onload = () => {
                                    ${config.shouldMoveIconToBarEndLeft ? `context.drawImage(icon, countBarX + countBarWidth - 40 * i - 40,  nameTextY - 30, 40, 40);` : `context.drawImage(icon, nameTextX + nameTextWidth / 2 + 40 * i + 2, nameTextY - 30, 40, 40);`}
                        // context.drawImage(icon, countBarX + countBarWidth - 40 * i - 40,  nameTextY - 30, 40, 40);
                    } // onload
                } // for
            } // if

                // for
            }

            // function
        }

          function getRandomBarBgImg(barBgImgsBase64) {
              const randomIndex = Math.floor(Math.random() * barBgImgsBase64.length);
              return barBgImgsBase64[randomIndex];
          }

         function findIconBase64(userId, iconData) {
            const foundIcons = iconData.filter((data) => data.userId === userId);

            if (foundIcons.length > 0) {
                return foundIcons.map((icon) => icon.iconBase64);
            } else {
                return null;
            }
        }

        function findBarBgImgBase64(userId, barBgImgs) {
            const foundBarBgImgs = barBgImgs.filter((data) => data.userId === userId);

            if (foundBarBgImgs.length > 0) {
                return foundBarBgImgs.map((barBgImg) => barBgImg.barBgImgBase64);
            } else {
                return null;
            }
        }

        function addOpacityToColor(color, opacity) {
            const opacityHex = Math.round(opacity * 255)
                .toString(16)
                .padStart(2, "0")
            return \`\${color}\${opacityHex}\`
        }

      function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function removeCanvas(canvas) {
    canvas.remove();
}

async function getAverageColor(avatarBase64) {
    const image = new Image();
    // image.src = url;
    image.src = "data:image/png;base64," + avatarBase64;

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;

    let totalRed = 0;
    let totalGreen = 0;
    let totalBlue = 0;

    for (let i = 0; i < data.length; i += 4) {
        totalRed += data[i];
        totalGreen += data[i + 1];
        totalBlue += data[i + 2];
    }

    const pixelCount = data.length / 4;
    const avgRed = Math.round(totalRed / pixelCount);
    const avgGreen = Math.round(totalGreen / pixelCount);
    const avgBlue = Math.round(totalBlue / pixelCount);

    const hexRed = avgRed.toString(16).padStart(2, "0");
    const hexGreen = avgGreen.toString(16).padStart(2, "0");
    const hexBlue = avgBlue.toString(16).padStart(2, "0");

    removeCanvas(canvas);

    return \`#\${hexRed}\${hexGreen}\${hexBlue}\`;
}



        function drawVerticalLines(
            context,
            firstVerticalLineX,
            canvasHeight,
            verticalLineWidth
        ) {
            context.fillStyle = "rgba(0, 0, 0, 0.12)" // 设置线条颜色为黑色，不透明度为12%
            context.fillRect(firstVerticalLineX, 0, verticalLineWidth, canvasHeight) // 绘制第 1 条垂直线
            // 绘制第 2~8 条垂直线
            for (let i = 1; i < 8; i++) {
                const x = firstVerticalLineX + 100 * i
                context.fillRect(x, 0, verticalLineWidth, canvasHeight)
            }
        }

        async function drawAvatars(context, rankingData, userAvatarSize) {
            let y = 0
            for (const data of rankingData) {
            const image = new Image();
            // image.src = data.avatar;
            image.src = "data:image/png;base64," + data.avatarBase64;

                image.onload = () => {
                    context.drawImage(image, 0, y, userAvatarSize, userAvatarSize)
                    y += userAvatarSize
                }

            }
        }
    }

</script>
</body>
</html>
`;
  }

  async function generateLeaderboardHtml(rankTitle: string, monetaryRanks: MonetaryRank[]): Promise<string> {
    if (config.style === '1') {
      return generateLeaderboardHtmlStyle1(rankTitle, monetaryRanks);
    } else if (config.style === '2') {
      return await generateLeaderboardHtmlStyle2(rankTitle, monetaryRanks);
    }
  }

  function isValidDisplaySize(displaySize: number): boolean {
    return Number.isInteger(displaySize) && displaySize > 0;
  }

  function generateMonetaryRanks(monetaries: Monetary[], usernames: Username[], bindings: Binding[]): MonetaryRank[] {
    const usernameMap = new Map<number, Username>();
    usernames.forEach(user => usernameMap.set(user.uid, user));

    const bindingMap = new Map<number, Binding>();
    bindings.forEach(binding => bindingMap.set(binding.aid, binding));

    const monetaryRanks: MonetaryRank[] = monetaries.map(monetary => {
      const username = usernameMap.get(monetary.uid);
      const binding = bindingMap.get(monetary.uid);
      const userId = username?.userId || binding?.pid || '123456789';
      const platform = username?.platform || binding?.platform || 'unknown';
      const avatar = platform === 'onebot' ? `https://q.qlogo.cn/g?b=qq&s=640&nk=${userId}` : username?.avatar || 'https://th.bing.com/th/id/OIP.s5N_QuGWAIWBmUyeNemQagHaHZ?w=185&h=184&c=7&r=0&o=5&dpr=1.3&pid=1.7';

      const rank: MonetaryRank = {
        uid: monetary.uid,
        value: Math.round(monetary.value),
        userId: userId,
        avatar: avatar,
        username: username?.username || '神秘人',
        currency: monetary.currency,
        platform: platform,
        channelId: username?.channelId || 'unknown',
      };

      return rank;
    });

    monetaryRanks.sort((a, b) => b.value - a.value);

    return monetaryRanks;
  }

  async function sendMessage(session, message) {
    await session.send(message);
  }
}
