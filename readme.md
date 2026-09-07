# koishi-plugin-monetary-rank

货币排行榜插件。

## 安装

~~~sh
yarn add koishi-plugin-monetary-rank
~~~

在 Koishi 配置中启用 koishi-plugin-monetary-rank，并提供 database 和 monetary 服务。
图表显示需要 puppeteer 和 canvas；资源与 message-counter 共用 data/messageCounter/。

## 指令

| 指令 | 说明 |
| --- | --- |
| mrank | 查看帮助 |
| mrank.本群个人货币排行榜 [数量] | 查看本群排行 |
| mrank.跨群个人货币排行榜 [数量] | 查看跨群排行 |
| mrank.查询货币 [@某人] | 查询余额 |

使用 -c &lt;货币种类&gt; 可临时指定货币。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
