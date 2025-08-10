import { Context, h, Schema } from "koishi";
import {} from "koishi-plugin-puppeteer";
import {} from "@koishijs/canvas";
import path from "path";
import fs from "fs";

import fallbackBase64 from "./data/fallbackBase64.json";

export const name = "monetary-rank";
export const inject = {
  required: ["database", "monetary"],
  optional: ["puppeteer", "canvas"],
};
export const usage = `## 注意事项

- 用户第一次发言时记录用户数据，刚开始使用时没有数据。

## 自定义水平柱状图 2（与发言排行榜共用文件夹）

1. 用户图标:

  - 支持为同一用户添加多个图标，它们会同时显示。
  - 在 \`data/messageCounter/icons\` 文件夹下添加用户图标，文件名为用户 ID (例如 \`1234567890.png\`)。
  - 多个图标的文件名需形如  \`1234567890-1.png\`、 \`1234567890-2.png\` 。

2. 柱状条背景：

  - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。
  - 在 \`data/messageCounter/barBgImgs\` 文件夹下添加水平柱状条背景图片。
  - 多个图片的文件名需形如 \`1234567890-1.png\`、\`1234567890-2.png\`。
  - 建议图片尺寸为 850x50 像素，文件名为用户 ID (例如\`1234567890.png\`)。

> 重启插件以使更改生效。

## QQ 群

- 956758505`;

// pz*
export interface Config {
  // 排行榜显示设置
  defaultLeaderboardDisplayCount: number;

  // 图片转换功能设置
  isLeaderboardDisplayedAsImage: boolean;
  style: "2" | "3";
  waitUntil: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  horizontalBarBackgroundFullOpacity: number;
  horizontalBarBackgroundOpacity: number;
  shouldMoveIconToBarEndLeft: boolean;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultLeaderboardDisplayCount: Schema.number()
      .min(1)
      .default(10)
      .description("默认排行榜显示数量。"),
  }).description("排行榜显示设置"),

  Schema.object({
    isLeaderboardDisplayedAsImage: Schema.boolean()
      .default(false)
      .description(`排行榜是否以图片形式显示，需要启用 \`puppeteer\` 服务。`),
    style: Schema.union([
      Schema.const("2").description("样式 2（水平柱状图）"),
      Schema.const("3").description("样式 3（deer-pipe插件的排行榜样式）"),
    ])
      .role("radio")
      .default("2")
      .description("排行榜样式。"),
    waitUntil: Schema.union([
      "load",
      "domcontentloaded",
      "networkidle0",
      "networkidle2",
    ])
      .default("networkidle0")
      .description("等待页面加载的事件。"),
    horizontalBarBackgroundFullOpacity: Schema.number()
      .min(0)
      .max(1)
      .default(0)
      .description(
        "（仅样式 2）自定义水平柱状条背景整条的不透明度，值越小则越透明。"
      ),
    horizontalBarBackgroundOpacity: Schema.number()
      .min(0)
      .max(1)
      .default(0.6)
      .description(
        "（仅样式 2）自定义水平柱状条背景的不透明度，值越小则越透明。"
      ),
    shouldMoveIconToBarEndLeft: Schema.boolean()
      .default(true)
      .description(
        "（仅样式 2）是否将自定义图标移动到水平柱状条末端的左侧，关闭后将放在用户名的右侧。"
      ),
  }).description("图片转换功能设置"),
]);

// smb*
declare module "koishi" {
  interface Tables {
    username: Username;
    monetary: Monetary;
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
  const messageCounterRoot = path.join(ctx.baseDir, "data", "messageCounter");
  const iconsPath = path.join(messageCounterRoot, "icons");
  const barBgImgsPath = path.join(messageCounterRoot, "barBgImgs");
  const emptyHtmlPath = path
    .join(messageCounterRoot, "emptyHtml.html")
    .replace(/\\/g, "/");

  await ensureDirExists(iconsPath);
  await ensureDirExists(barBgImgsPath);

  // 如果 emptyHtml.html 不存在，则创建一个
  if (!fs.existsSync(emptyHtmlPath)) {
    fs.writeFileSync(
      emptyHtmlPath,
      '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>'
    );
  }

  // cl*
  const logger = ctx.logger("monetaryRank");
  const iconData: IconData[] = readIconsFromFolder(iconsPath);
  const barBgImgs: BarBgImgs[] = readBgImgsFromFolder(barBgImgsPath);
  // tzb*
  ctx.model.extend(
    "username",
    {
      id: "unsigned",
      uid: "unsigned",
      userId: "string",
      avatar: "string",
      platform: "string",
      username: "string",
      channelId: "string",
    },
    { primary: "id", autoInc: true }
  );

  // jt* sj*
  ctx.on("message", async (session) => {
    const user: Username[] = await ctx.database.get("username", {
      userId: session.userId,
      channelId: session.channelId,
    });
    const username = session.author.nick
      ? session.author.nick
      : session.author.name
      ? session.author.name
      : "神秘人";
    const avatar = session.author.avatar
      ? session.author.avatar
      : "https://th.bing.com/th/id/OIP.s5N_QuGWAIWBmUyeNemQagHaHZ?w=512&h=512&c=7&r=0&o=5&dpr=1.3&pid=1.7";
    if (user.length === 0) {
      const binding: Binding[] = await ctx.database.get("binding", {
        pid: session.userId,
        platform: session.platform,
      });
      const uid = binding[0].aid;
      await ctx.database.create("username", {
        uid: uid,
        userId: session.userId,
        avatar: avatar,
        platform: session.platform,
        username: username,
        channelId: session.channelId,
      });
    } else if (user[0].username !== username || user[0].avatar !== avatar) {
      await ctx.database.set(
        "username",
        { userId: session.userId, channelId: session.channelId },
        {
          username: username,
          avatar: avatar,
        }
      );
    }
  });

  // zl*
  // bz* h*
  ctx
    .command("monetaryRank", "查看货币排行榜帮助")
    .action(async ({ session }) => {
      await session.execute(`monetaryRank -h`);
    });
  // bqphb*
  ctx
    .command(
      "monetaryRank.本群个人货币排行榜 [displaySize:number]",
      "查看本群个人货币排行榜"
    )
    .action(
      async (
        { session },
        displaySize = config.defaultLeaderboardDisplayCount
      ) => {
        if (!isValidDisplaySize(displaySize)) {
          displaySize = config.defaultLeaderboardDisplayCount;
        }
        const monetaries = await ctx.database.get("monetary", {});
        const usernames = await ctx.database.get("username", {
          platform: session.platform,
          channelId: session.channelId,
        });
        const bindings = await ctx.database.get("binding", {
          platform: session.platform,
        });
        const monetaryRanks = generateMonetaryRanks(
          monetaries,
          usernames,
          bindings
        )
          .filter((rank) => rank.channelId === session.channelId)
          .slice(0, displaySize);
        if (config.isLeaderboardDisplayedAsImage) {
          const rankTitle = `本群个人货币排行榜`;
          await htmlToBufferAndSendMessage(session, rankTitle, monetaryRanks);
        } else {
          await sendMessage(
            session,
            `本群个人货币排行榜：\n${monetaryRanks
              .map(
                (rank, index) =>
                  `${index + 1}. ${rank.username}(${rank.userId}) - ${
                    rank.value
                  }`
              )
              .join("\n")}`
          );
        }
      }
    );
  // kqphb*
  ctx
    .command(
      "monetaryRank.跨群个人货币排行榜 [displaySize:number]",
      "查看跨群个人货币排行榜"
    )
    .action(
      async (
        { session },
        displaySize = config.defaultLeaderboardDisplayCount
      ) => {
        if (!isValidDisplaySize(displaySize)) {
          displaySize = config.defaultLeaderboardDisplayCount;
        }
        const monetaries = await ctx.database.get("monetary", {});
        const usernames = await ctx.database.get("username", {
          platform: session.platform,
        });
        const bindings = await ctx.database.get("binding", {
          platform: session.platform,
        });
        const monetaryRanks = generateMonetaryRanks(
          monetaries,
          usernames,
          bindings
        ).slice(0, displaySize);
        if (config.isLeaderboardDisplayedAsImage) {
          const rankTitle = `跨群个人货币排行榜`;
          await htmlToBufferAndSendMessage(session, rankTitle, monetaryRanks);
        } else {
          await sendMessage(
            session,
            `跨群个人货币排行榜：\n${monetaryRanks
              .map(
                (rank, index) =>
                  `${index + 1}. ${rank.username}(${rank.userId}) - ${
                    rank.value
                  }`
              )
              .join("\n")}`
          );
        }
      }
    );
  // cx*
  ctx
    .command("monetaryRank.查询货币 [userArg]", "查询货币余额")
    .option("currency", "-c <currency:string> 指定查询的货币种类")
    .action(async ({ session, options }, userArg) => {
      let targetUserId: string = session.userId; // 默认查询自己
      let targetUsername: string = session.username;
      let parsedUser: any;

      if (userArg) {
        parsedUser = h.parse(userArg)[0];
        if (!parsedUser || parsedUser.type !== "at" || !parsedUser.attrs.id) {
          await session.send(
            "请正确 @ 用户\n示例：monetaryRank.查询货币  @用户"
          );
          return;
        }
        targetUserId = parsedUser.attrs.id;
        targetUsername = parsedUser.attrs.name || targetUserId;
      }

      let uid: number;
      try {
        const bindingRecord = await ctx.database.get("binding", {
          pid: targetUserId,
          platform: session.platform,
        });
        if (bindingRecord.length === 0) {
          await session.send(`未找到用户 ${targetUsername} 的账户信息。`);
          return;
        }
        uid = bindingRecord[0].aid;
      } catch (error) {
        logger.error(`获取用户绑定信息失败: ${error}`);
        await session.send("查询用户信息失败，请稍后重试。");
        return;
      }

      const currencyOption = options?.currency;

      if (currencyOption) {
        // 查询指定货币余额
        const monetaryData = await ctx.database.get("monetary", {
          uid,
          currency: currencyOption,
        });
        if (monetaryData.length === 0) {
          await session.send(
            `${targetUsername} 没有 ${currencyOption} 货币的记录。`
          );
          return;
        }
        const balance = monetaryData[0].value;
        await session.send(
          `${targetUsername} 的 ${currencyOption} 货币余额为 ${balance}`
        );
      } else {
        // 查询所有货币余额或默认货币余额
        const allMonetaryData = await ctx.database.get("monetary", { uid });
        if (allMonetaryData.length === 0) {
          await session.send(`${targetUsername} 没有任何货币记录。`);
          return;
        }

        if (
          allMonetaryData.length === 1 &&
          allMonetaryData[0].currency === "default"
        ) {
          // 只有 default 货币，直接显示
          await session.send(
            `${targetUsername} 的货币余额为 ${allMonetaryData[0].value}`
          );
        } else {
          // 列出所有货币余额
          const balanceList = allMonetaryData
            .map((item) => `${item.currency}: ${item.value}`)
            .join("\n");
          await session.send(`${targetUsername} 的货币余额：\n${balanceList}`);
        }
      }
    });

  // hs*
  /**
   * 生成图表的静态 CSS 样式。
   */
  function _getChartBaseStyles(): string {
    return `
      html { min-height: 100%; }
      body {
        font-family: sans-serif; margin: 0; padding: 20px;
        width: 100%; min-height: 100%; box-sizing: border-box;
      }
      .ranking-title {
        text-align: center; margin-bottom: 20px; color: #333; font-style: normal;
        font-family: "Microsoft YaHei", sans-serif;
      }
      .font-preload { display: none; }
    `;
  }

  /**
   * 准备图表的背景样式 (简化版)。
   */
  function _prepareBackgroundStyle(): string {
    return `html { background: linear-gradient(135deg, #f6f8f9 0%, #e5ebee 100%); }`;
  }

  /**
   * 获取在浏览器端执行的绘图脚本。
   * (此函数为 message-counter 插件的核心绘图逻辑，直接复用)
   */
  function _getClientScript(): string {
    return `
      async ({ rankingData, iconData, barBgImgs, config }) => {
        // --- 主绘制函数 ---
        async function drawRanking() {
          const maxCount = rankingData.reduce((max, item) => Math.max(max, item.count), 0) || 1;
          const userNum = rankingData.length;
          const userAvatarSize = 50;
          const tableWidth = 200 + 7 * 100; // 固定宽度
          const canvasHeight = 50 * userNum;

          const canvas = document.getElementById('rankingCanvas');
          let context = canvas.getContext('2d');
          
          context.font = '30px "Microsoft YaHei", sans-serif';
          // 找到拥有最大计数的条目，因为它的文本通常最长
          const maxCountData = rankingData.find(d => d.count === maxCount) || rankingData[0] || { count: 1 };
          let maxCountText = maxCountData.count.toString();
          
          const maxCountTextWidth = context.measureText(maxCountText).width;

          // 最长进度条的宽度是固定的
          const maxBarWidth = 150 + 700; // 进度条区域总宽度
          
          // 计算最终画布宽度
          canvas.width = 50 + maxBarWidth + 10 + maxCountTextWidth + 20; 
          canvas.height = canvasHeight;

          // 重新获取上下文，因为尺寸变化会重置状态
          context = canvas.getContext('2d');

          // 按顺序绘制图层
          await drawRankingBars(context, maxCount, userAvatarSize, tableWidth);
          await drawAvatars(context, userAvatarSize);
          drawVerticalLines(context, canvas.height, tableWidth);
        }

        async function drawRankingBars(context, maxCount, userAvatarSize, canvasWidth) {
          for (const [index, data] of rankingData.entries()) {
            const countBarWidth = 150 + (700 * data.count) / maxCount;
            const countBarX = 50;
            const countBarY = 50 * index;

            let avgColor = await getAverageColor(data.avatarBase64);
            const colorWithOpacity = addOpacityToColor(avgColor, 0.5);

            // 绘制底色进度条
            context.fillStyle = avgColor;
            context.fillRect(countBarX, countBarY, countBarWidth, userAvatarSize);

            // 绘制自定义背景图
            const userBarBgImgs = findAssets(data.userId, barBgImgs, 'barBgImgBase64');
            if (userBarBgImgs.length > 0) {
              const randomBarBgImgBase64 = userBarBgImgs[Math.floor(Math.random() * userBarBgImgs.length)];
              const newAvgColor = await drawCustomBarBackground(context, randomBarBgImgBase64, countBarX, countBarY, countBarWidth, userAvatarSize, canvasWidth);
              if (newAvgColor) avgColor = newAvgColor;
            }
            
            // 绘制剩余部分灰色背景
            const remainingBarX = countBarX + countBarWidth;
            context.fillStyle = colorWithOpacity;
            context.fillRect(remainingBarX, countBarY, canvasWidth - remainingBarX, userAvatarSize);
            
            // 绘制文本和图标
            await drawTextAndIcons(context, data, index, avgColor, countBarX, countBarY, countBarWidth, userAvatarSize);
          }
        }
        
        async function drawCustomBarBackground(context, base64, x, y, barWidth, barHeight, canvasWidth) {
            return new Promise(async (resolve) => {
                const barBgImg = new Image();
                barBgImg.src = "data:image/png;base64," + base64;
                barBgImg.onload = async () => {
                    context.save();
                    if (config.horizontalBarBackgroundFullOpacity > 0) {
                        context.globalAlpha = config.horizontalBarBackgroundFullOpacity;
                        context.drawImage(barBgImg, x, y, canvasWidth - x, barHeight);
                    }
                    context.globalAlpha = config.horizontalBarBackgroundOpacity;
                    context.drawImage(barBgImg, 0, 0, barWidth, barHeight, x, y, barWidth, barHeight);
                    context.restore();
                    resolve(await getAverageColor(base64));
                };
                barBgImg.onerror = () => resolve(undefined); // On error, resolve with undefined to not change the color
            });
        }

        async function drawTextAndIcons(context, data, index, avgColor, barX, barY, barWidth, barHeight) {
            context.font = '30px "Microsoft YaHei", sans-serif';
            const textY = barY + barHeight / 2 + 10.5;

            let countText = data.count.toString();
            
            const countTextWidth = context.measureText(countText).width;
            const countTextX = barX + barWidth + 10;
            
            if (countTextX + countTextWidth > context.canvas.width - 5) {
                context.fillStyle = chooseColorAdjustmentMethod(avgColor);
                context.textAlign = "right";
                context.fillText(countText, barX + barWidth - 10, textY);
            } else {
                context.fillStyle = "rgba(0, 0, 0, 1)";
                context.textAlign = "left";
                context.fillText(countText, countTextX, textY);
            }

            context.fillStyle = chooseColorAdjustmentMethod(avgColor);
            context.textAlign = "left";

            let nameText = data.name;
            const maxNameWidth = barWidth - 60; 
            if (context.measureText(nameText).width > maxNameWidth) {
                const ellipsis = "...";
                while (context.measureText(nameText + ellipsis).width > maxNameWidth && nameText.length > 0) {
                    nameText = nameText.slice(0, -1);
                }
                nameText += ellipsis;
            }
            const nameTextX = barX + 10;
            context.fillText(nameText, nameTextX, textY);

            const userIcons = findAssets(data.userId, iconData, 'iconBase64');
            if (userIcons.length > 0) {
                await drawUserIcons(context, userIcons, {
                    nameText: data.name,
                    nameTextX: context.measureText(nameText).width + nameTextX, 
                    barX: barX, barWidth: barWidth, textY: textY
                });
            }
        }
        
        async function drawUserIcons(context, icons, positions) {
            const { nameTextX, barX, barWidth, textY } = positions;
            
            // 使用 Promise.all 等待所有图片加载和绘制
            await Promise.all(icons.map((iconBase64, i) => {
                return new Promise((resolve, reject) => {
                    const icon = new Image();
                    icon.src = "data:image/png;base64," + iconBase64;
                    icon.onload = () => {
                        const iconSize = 40;
                        const iconY = textY - 30;
                        let iconX = config.shouldMoveIconToBarEndLeft
                            ? barX + barWidth - (iconSize * (i + 1))
                            : nameTextX + (iconSize * i) + 5;
                        context.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        resolve(); // 图片绘制成功
                    };
                    icon.onerror = () => {
                        console.error("Failed to load user icon.");
                        resolve(); // 即使单个图标加载失败，也继续执行，不中断整个排行榜生成
                    };
                });
            }));
        }

        async function drawAvatars(context, userAvatarSize) {
          for (const [index, data] of rankingData.entries()) {
            const image = new Image();
            image.src = "data:image/png;base64," + data.avatarBase64;
            await new Promise(resolve => {
                image.onload = () => {
                    context.drawImage(image, 0, 50 * index, userAvatarSize, userAvatarSize);
                    resolve();
                };
                image.onerror = resolve;
            });
          }
        }
        
        function drawVerticalLines(context, canvasHeight, tableWidth) {
            context.fillStyle = "rgba(0, 0, 0, 0.12)";
            const verticalLineWidth = 3;
            const firstLineX = 200;
            for (let i = 0; i < 8; i++) {
                context.fillRect(firstLineX + 100 * i, 0, verticalLineWidth, canvasHeight);
            }
        }

        function findAssets(userId, assetList, key) {
          return assetList.filter(data => data.userId === userId).map(data => data[key]);
        }
        function addOpacityToColor(color, opacity) {
          const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
          return \`\${color}\${opacityHex}\`;
        }
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
            r /= 255, g /= 255, b /= 255
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            let h, s, l = (max + min) / 2
            if (max === min) {
                h = s = 0
            } else {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break
                    case g: h = (b - r) / d + 2; break
                    case b: h = (r - g) / d + 4; break
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
            return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
        }
        function rgbToHex(r, g, b) {
            const toHex = c => {
                const hex = c.toString(16)
                return hex.length === 1 ? "0" + hex : hex
            }
            return \`#\${toHex(r)}\${toHex(g)}\${toHex(b)}\`
        }
        async function getAverageColor(base64) {
            const image = new Image(); image.src = "data:image/png;base64," + base64;
            await new Promise(r => image.onload = r);
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = image.width; canvas.height = image.height; ctx.drawImage(image, 0, 0);
            const data = ctx.getImageData(0, 0, image.width, image.height).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
            const count = data.length / 4;
            r = ~~(r / count); g = ~~(g / count); b = ~~(b / count);
            return \`#\${r.toString(16).padStart(2, "0")}\${g.toString(16).padStart(2, "0")}\${b.toString(16).padStart(2, "0")}\`;
        }
        await drawRanking();
      }
    `;
  }

  /**
   * 组装最终的 HTML 页面内容。
   */
  function _getChartHtmlContent(params: {
    rankTimeTitle: string;
    rankTitle: string;
    data: RankingData[];
    iconCache: IconData[];
    barBgImgCache: BarBgImgs[];
    backgroundStyle: string;
    chartConfig: any;
  }): string {
    const {
      rankTimeTitle,
      rankTitle,
      data,
      iconCache,
      barBgImgCache,
      backgroundStyle,
      chartConfig,
    } = params;

    const clientData = {
      rankingData: data,
      iconData: iconCache.map((d) => ({
        userId: d.userId,
        iconBase64: d.iconBase64,
      })),
      barBgImgs: barBgImgCache.map((d) => ({
        userId: d.userId,
        barBgImgBase64: d.barBgImgBase64,
      })),
      config: chartConfig,
    };

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>排行榜</title>
          <style>${_getChartBaseStyles()}</style>
          <style>${backgroundStyle}</style>
      </head>
      <body>
          <h1 class="ranking-title">${rankTimeTitle}</h1>
          <h1 class="ranking-title">${rankTitle}</h1>
          <canvas id="rankingCanvas"></canvas>
          <script>
            (async () => {
              const drawFunction = ${_getClientScript()};
              await drawFunction(${JSON.stringify(clientData)});
            })();
          </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取头像并转换为 Base64，处理失败时返回默认头像。
   * @param url 头像的 URL
   * @returns 头像的 Base64 字符串
   */
  async function getAvatarAsBase64(url: string): Promise<string> {
    if (!url || !ctx.canvas) {
      return fallbackBase64[0];
    }

    try {
      const response = await ctx.http.get(url, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      const image = await ctx.canvas.loadImage(response);
      const canvas = await ctx.canvas.createCanvas(50, 50);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, 50, 50);
      return (await canvas.toBuffer("image/png")).toString("base64");
    } catch (e) {
      logger.warn(`获取或处理头像失败 (${url})，将使用默认头像: ${e.message}`);
      return fallbackBase64[0];
    }
  }

  /**
   * 生成排行榜图片的核心函数。
   */
  async function generateRankingChart({
    rankTimeTitle,
    rankTitle,
    data,
  }: {
    rankTimeTitle: string;
    rankTitle: string;
    data: RankingData[];
  }): Promise<Buffer> {
    if (!ctx.puppeteer || !ctx.canvas) {
      throw new Error("Puppeteer or Canvas service is not enabled.");
    }
    const page = await ctx.puppeteer.page();
    try {
      // 1. 处理头像，使用新的辅助函数
      await Promise.all(
        data.map(async (item) => {
          item.avatarBase64 = await getAvatarAsBase64(item.avatar);
        })
      );

      // 2. 准备 HTML 内容
      const backgroundStyle = _prepareBackgroundStyle();
      const chartConfigForClient = {
        shouldMoveIconToBarEndLeft: config.shouldMoveIconToBarEndLeft,
        horizontalBarBackgroundOpacity: config.horizontalBarBackgroundOpacity,
        horizontalBarBackgroundFullOpacity:
          config.horizontalBarBackgroundFullOpacity,
        isUserMessagePercentageVisible: false, // 货币榜不显示百分比
      };

      const htmlContent = _getChartHtmlContent({
        rankTimeTitle,
        rankTitle,
        data,
        iconCache: iconData,
        barBgImgCache: barBgImgs,
        backgroundStyle,
        chartConfig: chartConfigForClient,
      });

      // 3. Puppeteer 渲染
      await page.goto(`file://${emptyHtmlPath}`);
      await page.setContent(h.unescape(htmlContent), {
        waitUntil: config.waitUntil,
      });

      const calculatedWidth = await page.evaluate(() => {
        const canvas = document.getElementById(
          "rankingCanvas"
        ) as HTMLCanvasElement | null;
        return canvas ? canvas.width + 40 : 1080; // 左右 padding 各 20px
      });

      await page.setViewport({
        width: Math.ceil(calculatedWidth),
        height: 256, // 高度由 fullPage 自动调整
        deviceScaleFactor: 1,
      });

      return await page.screenshot({ type: "png", fullPage: true });
    } finally {
      await page.close();
    }
  }

  function readBgImgsFromFolder(folderPath: string): BarBgImgs[] {
    const barBgImgs: BarBgImgs[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split("-")[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const barBgImgBase64 = fileData.toString("base64");

        barBgImgs.push({ userId, barBgImgBase64 });
      });
    } catch (err) {
      logger.error("读取水平柱状图背景图时出错：", err);
    }

    return barBgImgs;
  }

  function readIconsFromFolder(folderPath: string): IconData[] {
    const iconData: IconData[] = [];

    try {
      const files = fs.readdirSync(folderPath);

      files.forEach((file) => {
        const userId = path.parse(file).name.split("-")[0].trim();
        const filePath = path.join(folderPath, file);
        const fileData = fs.readFileSync(filePath);
        const iconBase64 = fileData.toString("base64");

        iconData.push({ userId, iconBase64 });
      });
    } catch (err) {
      logger.error("读取图标时出错：", err);
    }

    return iconData;
  }

  async function ensureDirExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 整合的图片生成与发送函数
   * @param session Koishi session
   * @param rankTitle 排行榜标题
   * @param monetaryRanks 排行榜数据
   */
  async function htmlToBufferAndSendMessage(
    session,
    rankTitle: string,
    monetaryRanks: MonetaryRank[]
  ): Promise<void> {
    try {
      let buffer: Buffer;
      if (config.style === "2") {
        const data = convertMonetaryRanksToRankingData(monetaryRanks);
        const rankTimeTitle = getCurrentBeijingTime();
        buffer = await generateRankingChart({ rankTimeTitle, rankTitle, data });
      } else if (config.style === "3") {
        // 样式 3 的逻辑保持不变
        const html = await generateLeaderboardHtmlStyle3(
          rankTitle,
          monetaryRanks
        );
        const page = await ctx.puppeteer.page();
        try {
          await page.setViewport({
            width: 550,
            height: 256,
            deviceScaleFactor: 2,
          });
          await page.goto(`file://${emptyHtmlPath}`);
          await page.setContent(h.unescape(html), {
            waitUntil: config.waitUntil,
          });
          buffer = await page.screenshot({ type: "png", fullPage: true });
        } finally {
          await page.close();
        }
      }

      if (buffer) {
        await sendMessage(session, h.image(buffer, "image/png"));
      }
    } catch (error) {
      logger.error("生成排行榜图片失败:", error);
      await session.send("生成排行榜图片失败，请检查后台日志。");
    }
  }

  async function generateLeaderboardHtmlStyle3(
    rankTitle: string,
    monetaryRanks: MonetaryRank[]
  ) {
    const rankData = monetaryRanks.map((rank, index) => ({
      order: index + 1,
      card: rank.username,
      sum: rank.value,
      channels: rank.channelId,
    }));

    const leaderboardHTML = `
<!DOCTYPE html >
  <html lang="zh-CN" >
    <head>
    <meta charset="UTF-8" >
      <meta name="viewport" content = "width=device-width, initial-scale=1.0" >
        <title>鹿管排行榜 </title>
        <style>
body {
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background-color: #f0f4f8;
  margin: 0;
  padding: 0px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.container {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 30px;
  width: 100%;
  max-width: 500px;
}
h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  font-size: 28px;
}
.ranking-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
.ranking-item {
  display: flex;
  align-items: center;
  padding: 15px 10px;
  border-bottom: 1px solid #ecf0f1;
  transition: background-color 0.3s;
}
.ranking-item:hover {
  background-color: #f8f9fa;
}
.ranking-number {
  font-size: 18px;
  font-weight: bold;
  margin-right: 15px;
  min-width: 30px;
  color: #7f8c8d;
}
.medal {
  font-size: 24px;
  margin-right: 15px;
}
.name {
  flex-grow: 1;
  font-size: 18px;
}
.channels {
  font-size: 14px;
  color: #7f8c8d;
  margin-left: 10px;
}
.count {
  font-weight: bold;
  color: #e74c3c;
  font-size: 18px;
}
.count::after {
  content: ' 币';
  font-size: 14px;
  color: #95a5a6;
}
</style>
  </head>
  <body>
  <div class="container" >
    <h1>🦌 货币排行榜 🦌</h1>
      <ol class="ranking-list">
        ${rankData
          .map(
            (deer) => `
<li class="ranking-item">
<span class="ranking-number">${deer.order}</span>
${deer.order === 1 ? '<span class="medal">🥇</span>' : ""}
${deer.order === 2 ? '<span class="medal">🥈</span>' : ""}
${deer.order === 3 ? '<span class="medal">🥉</span>' : ""}
<span class="name">${deer.card}</span>
<!--span class="channels">${deer.channels}</span-->
<span class="count">${deer.sum}</span>
</li>
`
          )
          .join("")}
</ol>
  </div>
  </body>
  </html>
    `;
    return leaderboardHTML;
  }

  function getCurrentBeijingTime(): string {
    const beijingTime = new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });
    const date = beijingTime.split(" ")[0];
    const time = beijingTime.split(" ")[1];

    return `${date} ${time}`;
  }

  function convertMonetaryRanksToRankingData(
    monetaryRanks: MonetaryRank[]
  ): RankingData[] {
    const totalValue = monetaryRanks.reduce((sum, rank) => sum + rank.value, 0);

    const rankingDatas: RankingData[] = monetaryRanks.map((rank) => ({
      name: rank.username,
      userId: rank.userId,
      avatar: rank.avatar || "",
      count: rank.value,
      percentage: totalValue > 0 ? (rank.value / totalValue) * 100 : 0,
    }));

    rankingDatas.sort((a, b) => b.count - a.count);

    return rankingDatas;
  }

  function isValidDisplaySize(displaySize: number): boolean {
    return Number.isInteger(displaySize) && displaySize > 0;
  }

  function generateMonetaryRanks(
    monetaries: Monetary[],
    usernames: Username[],
    bindings: Binding[]
  ): MonetaryRank[] {
    const usernameMap = new Map<number, Username>();
    usernames.forEach((user) => usernameMap.set(user.uid, user));

    const bindingMap = new Map<number, Binding>();
    bindings.forEach((binding) => bindingMap.set(binding.aid, binding));

    const monetaryRanks: MonetaryRank[] = monetaries.map((monetary) => {
      const username = usernameMap.get(monetary.uid);
      const binding = bindingMap.get(monetary.uid);
      const userId = username?.userId || binding?.pid || "123456789";
      const platform = username?.platform || binding?.platform || "unknown";
      const avatar =
        platform === "onebot"
          ? `https://q.qlogo.cn/g?b=qq&s=640&nk=${userId}`
          : username?.avatar ||
            "https://th.bing.com/th/id/OIP.s5N_QuGWAIWBmUyeNemQagHaHZ?w=185&h=184&c=7&r=0&o=5&dpr=1.3&pid=1.7";

      const rank: MonetaryRank = {
        uid: monetary.uid,
        value: Math.round(monetary.value),
        userId: userId,
        avatar: avatar,
        username: username?.username || "神秘人",
        currency: monetary.currency,
        platform: platform,
        channelId: username?.channelId || "unknown",
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
