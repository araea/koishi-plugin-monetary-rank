# 通用货币排行榜

Koishi 插件，查询货币余额并生成本频道或跨频道排行榜。

## 安装

```sh
yarn add koishi-plugin-monetary-rank
```

在 Koishi 中启用，并安装 `database`、`monetary` 与 `bind` 插件。图表需要 `puppeteer` 和 `canvas` 服务。图片资源与 [message-counter](https://github.com/araea/koishi-plugin-message-counter) 共用 `data/messageCounter/`。

## 指令

| 指令 | 说明 |
| --- | --- |
| `mrank` | 查看帮助 |
| `mrank.本频道排行榜 [数量]` | 查看本频道排行 |
| `mrank.跨频道排行榜 [数量]` | 查看跨频道排行 |
| `mrank.查询 [@某人]` | 查询货币余额 |

使用 `-c <货币种类>` 可临时指定货币。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
