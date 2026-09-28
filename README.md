# 通用货币排行榜

Koishi 插件：按货币种类生成跨频道通用货币排行榜

[![GitHub](https://img.shields.io/badge/GitHub-仓库-181717)](https://github.com/araea/koishi-plugin-monetary-rank) [![npm](https://img.shields.io/badge/npm-包-CB3837)](https://www.npmjs.com/package/koishi-plugin-monetary-rank)

## 安装

```sh
yarn add koishi-plugin-monetary-rank
```

启用插件，并安装 `database`、`monetary` 与 `bind` 插件。图片版排行榜需要 `puppeteer` 与 `canvas` 服务。图片资源与 message-counter 共用 `data/messageCounter/`。

## 快速使用

启用后使用指令：

| 指令 | 说明 |
| --- | --- |
| `mrank` | 查看帮助 |
| `mrank.本频道排行榜 [数量]` | 查看本频道排行 |
| `mrank.跨频道排行榜 [数量]` | 查看跨频道排行 |
| `mrank.查询 [@用户]` | 查询货币余额 |

使用 `-c <货币种类>` 可临时指定货币。

## 配置

| 配置项 | 类型 | 默认值 |
| --- | --- | --- |
| `defaultCurrency` | string | `"default"` |
| `defaultLeaderboardDisplayCount` | number | `10` |
| `isLeaderboardDisplayedAsImage` | boolean | `false` |
| `style` | `"2"` / `"3"` | 无（仅图片模式可选） |
| `waitUntil` | `"load"` / `"domcontentloaded"` / `"networkidle0"` / `"networkidle2"` | `"load"` |
| `horizontalBarBackgroundFullOpacity` | number（0–1） | `0` |
| `horizontalBarBackgroundOpacity` | number（0–1） | `0.6` |
| `shouldMoveIconToBarEndLeft` | boolean | `true` |
| `gridLinesOverBars` | boolean | `true` |
| `valueFollowsBar` | boolean | `true` |
| `chartFontScale` | number（0.6–1.6） | `1` |

`style` 仅当 `isLeaderboardDisplayedAsImage` 为 `true` 时可选：`"2"` 为水平柱状排行榜，`"3"` 为紧凑卡片排行榜。

## 限制 / 风险

图片版排行榜需要 `puppeteer` 与 `canvas`，未安装时仅输出文字。

默认货币为 `default`，使用 `-c` 切换到其它货币需该货币已在 `monetary` 中定义。

图片资源与 message-counter 共用 `data/messageCounter/`，卸载 message-counter 可能影响资源加载。

## 必要链接

- GitHub：<https://github.com/araea/koishi-plugin-monetary-rank>
- npm：<https://www.npmjs.com/package/koishi-plugin-monetary-rank>
