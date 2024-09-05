# koishi-plugin-monetary-rank

[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-rank?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

## 🎐 介绍

通用货币排行榜，支持本群排行和跨群排行。💰✨

## 🎉 安装

```
前往 Koishi 插件市场添加该插件即可。
```

## 🌈 使用指南

### 基本使用

- 使用指令查看对应排行榜，刚开始使用时可能没有数据，需要用户发送消息后才会有数据。
- 建议自行添加别名：可以将 `monetaryRank.本群个人货币排行榜` 添加别名为 `本群货币排行榜`，以便更方便地使用。

### 高级功能：自定义水平柱状图（与发言排行榜共用）

水平柱状图样式 2 支持强大的自定义功能，让你的排行榜更加个性化！🎨

* **自定义用户图标**:
  - 在 `data/messageCounterIcons` 文件夹下添加用户图标，文件名为用户 ID (例如 `1234567890.png`)。
  - 支持为同一用户添加多个图标，它们会同时显示。多个图标的文件名需形如  `1234567890-1.png`、 `1234567890-2.png` 。
* **自定义水平柱状条背景**:
  - 在 `data/messageCounterBarBgImgs` 文件夹下添加水平柱状条背景图片，建议图片尺寸为 850*50 像素，文件名为用户 ID (例如
    `1234567890.png`)。
  - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。多个图片的文件名需形如 `1234567890-1.png`、`1234567890-2.png`。

> 添加完图片后，记得重启插件以使更改生效！ 🔄

## ⚙️ 配置项

### 排行榜显示设置

- `defaultLeaderboardDisplayCount`：默认排行榜显示数量 (默认值：10)

### 图片转换功能设置

- `isLeaderboardDisplayedAsImage`：排行榜是否以图片形式显示 (默认值：false)
- `style`：排行榜样式 (默认值：2)
- `horizontalBarBackgroundFullOpacity`：自定义水平柱状条背景整条的不透明度 (默认值：0)
- `horizontalBarBackgroundOpacity`：自定义水平柱状条背景的不透明度 (默认值：0.6)
- `shouldMoveIconToBarEndLeft`：是否将自定义图标移动到水平柱状条末端的左侧 (默认值：true)

## 🌼 命令

- `monetaryRank` - 查看货币排行榜帮助
- `monetaryRank.本群个人货币排行榜 [displaySize:number]` - 查看本群个人货币排行榜
- `monetaryRank.跨群个人货币排行榜 [displaySize:number]` - 查看跨群个人货币排行榜

> 其中 `displaySize` 是可选参数，用于指定显示的排行数量。

## 🌸 测试图

## 样式 1

![image](https://github.com/user-attachments/assets/68cad6c7-edeb-454a-9299-1ad70d66d83e)

## 样式 2

![image](https://github.com/user-attachments/assets/eb6bf930-12e7-450b-89de-2e07f678c66e)

## 🍧 致谢

* [Koishi](https://koishi.chat/) - 强大而灵活的机器人框架

## 🐱 QQ 群

- 956758505

## ✨ License

MIT License © 2024

希望您喜欢这款插件! 💫

如有任何问题或建议，欢迎联系我哈~ 🎈
