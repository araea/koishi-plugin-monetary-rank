import {Context, h, Schema} from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import path from "path";

export const name = 'monetary-rank'
export const inject = {
  required: ['database', 'monetary'],
  optional: ['puppeteer'],
}
export const usage = `## 🌈 使用

- 使用指令查看对应排行榜，刚开始使用时可能没有数据，需要用户发送消息后才会有数据。
- 建议自行添加别名：可以将 \`monetaryRank.本群个人货币排行榜\` 添加别名为 \`本群货币排行榜\`，以便更方便地使用。

## ⚙️ 配置项

- \`defaultLeaderboardDisplayCount\`: 默认排行榜显示数量 (默认值: 10)
- \`isLeaderboardDisplayedAsImage\`: 排行榜是否以图片形式显示 (默认值: false)

## 🌼 命令

- \`monetaryRank\` - 查看货币排行榜帮助
- \`monetaryRank.本群个人货币排行榜 [displaySize:number]\` - 查看本群个人货币排行榜
- \`monetaryRank.跨群个人货币排行榜 [displaySize:number]\` - 查看跨群个人货币排行榜

其中 \`displaySize\` 是可选参数，用于指定显示的排行数量。

## 🐱 QQ 群

- 956758505`

// pz*
export interface Config {
  defaultLeaderboardDisplayCount: number
  isLeaderboardDisplayedAsImage: boolean
}

export const Config: Schema<Config> = Schema.object({
  defaultLeaderboardDisplayCount: Schema.number().min(1).default(10).description('默认排行榜显示数量'),
  isLeaderboardDisplayedAsImage: Schema.boolean().default(false).description('排行榜是否以图片形式显示'),
})

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

// zhs*
export function apply(ctx: Context, config: Config) {
  // wj*
  const filePath = path.join(__dirname, 'emptyHtml.html').replace(/\\/g, '/');
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
        ctx.inject(['puppeteer'], async (ctx) => {
          const html = generateLeaderboard('本群个人货币排行榜', monetaryRanks);
          const browser = ctx.puppeteer.browser;
          const context = await browser.createBrowserContext()
          const page = await context.newPage()
          await page.setViewport({width: 600, height: 100, deviceScaleFactor: 1})
          await page.goto('file://' + filePath);

          await page.setContent(h.unescape(html), {waitUntil: 'load'});

          const buffer = await page.screenshot({type: 'png', fullPage: true});
          await page.close();
          await context.close();
          await sendMessage(session, h.image(buffer, 'image/png'));
        });
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
        ctx.inject(['puppeteer'], async (ctx) => {
          const html = generateLeaderboard('跨群个人货币排行榜', monetaryRanks);
          const browser = ctx.puppeteer.browser;
          const context = await browser.createBrowserContext()
          const page = await context.newPage()
          await page.setViewport({width: 800, height: 100, deviceScaleFactor: 2})
          await page.goto('file://' + filePath);

          await page.setContent(h.unescape(html), {waitUntil: 'load'});

          const buffer = await page.screenshot({type: 'png', fullPage: true});
          await page.close();
          await context.close();
          await sendMessage(session, h.image(buffer, 'image/png'));
        });
      } else {
        await sendMessage(session, `跨群个人货币排行榜：\n${monetaryRanks.map((rank, index) => `${index + 1}. ${rank.username}(${rank.userId}) - ${rank.value}`).join('\n')}`);
      }
    });

  // hs*
  function generateLeaderboard(header: string, monetaryRanks: MonetaryRank[]): string {
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
                <div class="leaderboard-header">${header}</div>
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
        value: monetary.value,
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
