koishi-plugin-monetary-rank
===========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/monetary_rank-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-monetary-rank)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-monetary-rank.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

Koishi 的通用货币排行榜插件。

与发言排行榜共用同一套水平柱状图资源。

## 使用

1. 启用 `bind` 插件。
2. 用户第一次发言时才会记下昵称与头像，刚装好时榜是空的。

## 指令

| 指令 | 说明 |
| --- | --- |
| `monetaryRank` | 查看帮助 |
| `monetaryRank.本群个人货币排行榜 [数量]` | 本群榜，别名 `monetaryRank.本群榜` |
| `monetaryRank.跨群个人货币排行榜 [数量]` | 跨群榜，别名 `monetaryRank.跨群榜` |
| `monetaryRank.查询货币 [@某人]` | 查询余额，别名 `monetaryRank.查询` |

三个指令都支持 `-c <货币种类>` 临时指定货币，缺省用配置里的 `defaultCurrency`。

## 样式

与 [message-counter](https://github.com/araea/koishi-plugin-message-counter) 共用 `data/messageCounter/`。改完后重载插件生效。

**用户图标** — `data/messageCounter/icons/`，文件名 `用户ID.png`。多图标：`用户ID-1.png`、`用户ID-2.png`，会同时显示。

**柱状条背景** — `data/messageCounter/barBgImgs/`，建议 850×50。多图随机：`用户ID-1.png`。

## 示例

![样式 2](https://github.com/user-attachments/assets/eb6bf930-12e7-450b-89de-2e07f678c66e)

![样式 3](https://i0.hdslb.com/bfs/article/39dd40e20d04f85291bc2cb7cc0a367f312276085.png)

样式 3 的预览来自 deer-pipe 插件。

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
