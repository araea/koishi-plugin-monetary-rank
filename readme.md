# koishi-plugin-monetary-rank

[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-rank?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

## 介绍

Koishi 的通用货币排行榜插件。

## 注意事项

- 用户第一次发言时，记录用户数据，刚开始使用时没有数据。

## 自定义水平柱状图 2（与发言排行榜共用文件夹）

1. 用户图标:

- 支持为同一用户添加多个图标，它们会同时显示。
- 在 `data/messageCounterIcons` 文件夹下添加用户图标，文件名为用户 ID (例如 `1234567890.png`)。
- 多个图标的文件名需形如  `1234567890-1.png`、 `1234567890-2.png` 。

2. 柱状条背景：

- 支持为同一用户添加多个背景图片，插件会随机选择一个显示。
- 在 `data/messageCounterBarBgImgs` 文件夹下添加水平柱状条背景图片。
- 多个图片的文件名需形如 `1234567890-1.png`、`1234567890-2.png`。
- 建议图片尺寸为 850x50 像素，文件名为用户 ID (例如`1234567890.png`)。

> 重启插件以使更改生效。

## 测试图

## 样式 1

![image](https://github.com/user-attachments/assets/68cad6c7-edeb-454a-9299-1ad70d66d83e)

## 样式 2

![image](https://github.com/user-attachments/assets/eb6bf930-12e7-450b-89de-2e07f678c66e)

## 致谢

* [Koishi](https://koishi.chat/)

## QQ 群

- 956758505

## License

MIT License © 2024
