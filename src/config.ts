import { Schema } from 'koishi'

export interface Config {
  defaultCurrency: string
  defaultLeaderboardDisplayCount: number
  isLeaderboardDisplayedAsImage: boolean
  style?: '2' | '3'
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  horizontalBarBackgroundFullOpacity?: number
  horizontalBarBackgroundOpacity?: number
  shouldMoveIconToBarEndLeft?: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    defaultCurrency: Schema.string().default('default')
      .description('默认统计的货币种类，各指令均可用 `-c` 临时指定。'),
    defaultLeaderboardDisplayCount: Schema.natural().min(1).default(10)
      .description('排行榜默认显示的人数。'),
  }).description('排行榜设置'),

  Schema.intersect([
    Schema.object({
      isLeaderboardDisplayedAsImage: Schema.boolean().default(false)
        .description('把排行榜渲染成图片，需要 `puppeteer` 与 `canvas` 服务。'),
    }),
    Schema.union([
      Schema.object({
        isLeaderboardDisplayedAsImage: Schema.const(true).required(),
        style: Schema.union([
          Schema.const('2').description('样式 2（水平柱状图）'),
          Schema.const('3').description('样式 3（deer-pipe 卡片样式）'),
        ]).role('radio').default('2').description('排行榜样式。'),
        waitUntil: Schema.union(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
          .default('networkidle0').description('截图前等待的页面加载事件。'),
        horizontalBarBackgroundFullOpacity: Schema.number().min(0).max(1).default(0)
          .description('（样式 2）自定义柱状条背景铺满整行时的不透明度，0 为不铺满。'),
        horizontalBarBackgroundOpacity: Schema.number().min(0).max(1).default(0.6)
          .description('（样式 2）自定义柱状条背景的不透明度。'),
        shouldMoveIconToBarEndLeft: Schema.boolean().default(true)
          .description('（样式 2）把自定义图标放在柱状条末端左侧，关闭则放在用户名右侧。'),
      }),
      Schema.object({}),
    ]),
  ]).description('图片渲染设置'),
]) as Schema<Config>
