# koishi-plugin-monetary-rank

货币排行榜

## 安装

```sh
yarn add koishi-plugin-monetary-rank
```

在 Koishi 配置中启用，并提供 database 与 monetary 服务。图表显示需要 puppeteer 与 canvas，资源与 message-counter 共用 `data/messageCounter/`。

## 指令

| 指令 | 说明 |
| --- | --- |
| `mrank` | 帮助 |
| `mrank.本群榜 [数量]` | 本群排行 |
| `mrank.跨群榜 [数量]` | 跨群排行 |
| `mrank.查询 [@某人]` | 余额 |

用 `-c <货币种类>` 可临时指定货币。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
