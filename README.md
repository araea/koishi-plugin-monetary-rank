# 通用货币排行榜

Koishi 插件：按货币种类生成跨频道通用货币排行榜

[![GitHub](https://img.shields.io/badge/GitHub-araea%2Fkoishi--plugin--monetary--rank-181717?logo=github&logoColor=white)](https://github.com/araea/koishi-plugin-monetary-rank)
[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-rank?logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

## 安装

```sh
npm i koishi-plugin-monetary-rank
```

启用插件，并安装 `database` 与 `monetary` 服务。图片版排行榜需要 `puppeteer` 与 `canvas` 服务，资源与 message-counter 共用 `data/messageCounter/`。

## 快速使用

| 指令 | 说明 |
| --- | --- |
| `mrank` | 查看帮助 |
| `mrank.本频道排行榜 [数量]` | 查看本频道排行 |
| `mrank.跨频道排行榜 [数量]` | 查看跨频道排行 |
| `mrank.查询 [@用户]` | 查询货币余额 |

使用 `-c <货币种类>` 可临时指定货币。

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `defaultCurrency` | string | `default` | 默认统计的货币种类 |
| `defaultLeaderboardDisplayCount` | number | `10` | 排行榜默认显示的人数 |
| `maxLeaderboardDisplayCount` | number | `100` | 排行榜最多显示的人数，指令后的数字超过按它出图；0 表示不设上限 |
| `isLeaderboardDisplayedAsImage` | boolean | `false` | 把排行榜渲染成图片 |
| `style` | `2` / `3` | `2` | 图片样式：`2` 水平柱状，`3` 紧凑卡片 |
| `waitUntil` | string | `networkidle0` | 截图前等待的页面加载事件 |
| `horizontalBarBackgroundFullOpacity` | number | `0` | 柱状条背景铺满整行时的不透明度，范围 0–1 |
| `horizontalBarBackgroundOpacity` | number | `0.6` | 柱状条背景的不透明度，范围 0–1 |
| `shouldMoveIconToBarEndLeft` | boolean | `true` | 把自定义图标放在柱状条末端左侧 |
| `gridLinesOverBars` | boolean | `true` | 刻度竖线压在柱状条之上 |
| `valueFollowsBar` | boolean | `true` | 数额与占比紧跟在自己那根条的尾巴后面 |
| `chartFontScale` | number | `1` | 图表字号倍率，范围 0.6–1.6 |

## 限制 / 风险

图片版排行榜需要 `puppeteer` 与 `canvas`，未安装时仅输出文字。

默认货币为 `default`；用 `-c` 切换到其它货币时，该货币需已在 `monetary` 中定义。

图片资源与 message-counter 共用 `data/messageCounter/`，卸载 message-counter 可能影响资源加载。

## 链接

- [设计系统](DESIGN_SYSTEM.md)
- [更新日志](CHANGELOG.md)
- [MIT](LICENSE-MIT) / [Apache-2.0](LICENSE-APACHE)
