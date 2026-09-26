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
  gridLinesOverBars?: boolean
  valueFollowsBar?: boolean
  chartFontScale?: number
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
          Schema.const('2').description('水平柱状排行榜'),
          Schema.const('3').description('紧凑卡片排行榜'),
        ]).role('radio').default('2').description('排行榜样式。'),
        waitUntil: Schema.union(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
          .default('networkidle0').description('截图前等待的页面加载事件。'),
        horizontalBarBackgroundFullOpacity: Schema.number().min(0).max(1).default(0)
          .description('（样式 2）自定义柱状条背景铺满整行时的不透明度，0 为不铺满。'),
        horizontalBarBackgroundOpacity: Schema.number().min(0).max(1).default(0.6)
          .description('（样式 2）自定义柱状条背景的不透明度。'),
        shouldMoveIconToBarEndLeft: Schema.boolean().default(true)
          .description('（样式 2）把自定义图标放在柱状条末端左侧，关闭则放在用户名右侧。'),
        gridLinesOverBars: Schema.boolean().default(true)
          .description('（样式 2）刻度竖线是否压在柱状条之上。开启（默认）则刻度贯穿整行；关闭则由柱状条盖住刻度，每根条是完整的一块颜色。两种都只差遮挡关系，文字始终在最上层。'),
        valueFollowsBar: Schema.boolean().default(true)
          .description('（样式 2）数额与占比是否紧跟在自己那根条的尾巴后面。开启（默认）时眼睛被条的颜色牵到条尾，答案就在那里；代价是二十个数字排成一串阶梯。关闭则右对齐成固定的两列，上下扫一眼就能比大小，但读完条还得横着扫到画面最右边再回头认这是哪一行。'),
        chartFontScale: Schema.number().min(0.6).max(1.6).step(0.05).default(1)
          .description('（样式 2）字号倍率。1 即使用标准图表字号；标题、元信息、名次、昵称与读数一起缩放，行高、条长不变。'),
      }),
      Schema.object({}),
    ]),
  ]).description('图片渲染设置'),
]) as Schema<Config>
