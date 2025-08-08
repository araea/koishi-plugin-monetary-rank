import { Context, h, Schema } from "koishi";
import {} from "koishi-plugin-puppeteer";
import {} from "@koishijs/canvas";
import path from "path";
import fs from "fs";

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
            drawTextAndIcons(context, data, index, avgColor, countBarX, countBarY, countBarWidth, userAvatarSize);
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

        function drawTextAndIcons(context, data, index, avgColor, barX, barY, barWidth, barHeight) {
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
                drawUserIcons(context, userIcons, {
                    nameText: data.name,
                    nameTextX: context.measureText(nameText).width + nameTextX, 
                    barX: barX, barWidth: barWidth, textY: textY
                });
            }
        }
        
        function drawUserIcons(context, icons, positions) {
            const { nameTextX, barX, barWidth, textY } = positions;
            icons.forEach((iconBase64, i) => {
                const icon = new Image();
                icon.src = "data:image/png;base64," + iconBase64;
                icon.onload = () => {
                    const iconSize = 40;
                    const iconY = textY - 30;
                    let iconX = config.shouldMoveIconToBarEndLeft
                        ? barX + barWidth - (iconSize * (i + 1))
                        : nameTextX + (iconSize * i) + 5;
                    context.drawImage(icon, iconX, iconY, iconSize, iconSize);
                };
            });
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
    const fallbackBase64 =
      "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";

    if (!url || !ctx.canvas) {
      return fallbackBase64;
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
      return fallbackBase64;
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
