koishi-plugin-monetary-rank
========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/monetary_rank-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-monetary-rank)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-monetary-rank.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

Koishi 的通用货币排行榜插件。

## 注意事项

- 需要启用 `bind` 插件。
- 用户第一次发言时才会记录昵称与头像，刚装好时榜单是空的。

## 指令

| 指令 | 说明 |
| --- | --- |
| `monetaryRank` | 查看帮助 |
| `monetaryRank.本群个人货币排行榜 [数量]` | 本群榜，别名 `monetaryRank.本群榜` |
| `monetaryRank.跨群个人货币排行榜 [数量]` | 跨群榜，别名 `monetaryRank.跨群榜` |
| `monetaryRank.查询货币 [@某人]` | 查询余额，别名 `monetaryRank.查询` |

三个指令都支持 `-c <货币种类>` 临时指定货币，缺省用配置里的 `defaultCurrency`。

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

<br>

#### License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
