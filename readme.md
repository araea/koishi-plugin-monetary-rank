# koishi-plugin-monetary-rank

[![github](https://img.shields.io/badge/github-araea/monetary_rank-8da0cb?style=for-the-badge&labelColor=555555&logo=github)](https://github.com/araea/koishi-plugin-monetary-rank)
[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-rank.svg?style=for-the-badge&color=fc8d62&logo=npm)](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

Koishi 的通用货币排行榜插件。

## 注意事项

- 启用 bind 插件。
- 用户第一次发言时记录用户数据，刚开始使用时没有数据。

## 自定义水平柱状图 2（与发言排行榜共用文件夹）

1. 用户图标:

   - 支持为同一用户添加多个图标，它们会同时显示。
   - 在 `data/messageCounter/icons` 文件夹下添加用户图标，文件名为用户 ID (例如 `1234567890.png`)。
   - 多个图标的文件名需形如  `1234567890-1.png`、 `1234567890-2.png` 。

2. 柱状条背景：

   - 支持为同一用户添加多个背景图片，插件会随机选择一个显示。
   - 在 `data/messageCounter/barBgImgs` 文件夹下添加水平柱状条背景图片。
   - 多个图片的文件名需形如 `1234567890-1.png`、`1234567890-2.png`。
   - 建议图片尺寸为 850x50 像素，文件名为用户 ID (例如`1234567890.png`)。

> 重启插件以使更改生效。

## 测试图

## 样式 2

![image](https://github.com/user-attachments/assets/eb6bf930-12e7-450b-89de-2e07f678c66e)

## 样式 3

参考deer-pipe插件的预览图

![image](https://i0.hdslb.com/bfs/article/39dd40e20d04f85291bc2cb7cc0a367f312276085.png)

## 致谢

- [Koishi](https://koishi.chat/)
- [shangxueink](https://github.com/araea/koishi-plugin-monetary-rank/pull/1)

## QQ 群

- 956758505

## 📄 License

_Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT license](LICENSE-MIT) at your option._

_Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this crate by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions._
