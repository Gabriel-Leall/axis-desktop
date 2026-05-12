import { EvilLineChart } from '@/components/evilcharts/charts/line-chart'
import type { ChartConfig } from '@/components/evilcharts/ui/chart'
import { useTranslation } from 'react-i18next'
import type { MomentumComparisonPoint } from '../types'

const analysisChartConfig = {
  pastMonth: {
    label: 'Past month',
    colors: {
      light: ['#6f82a1'],
    },
  },
  currentMonth: {
    label: 'This month',
    colors: {
      light: ['#f0a14b', '#f6c37a'],
    },
  },
} satisfies ChartConfig

export function AnalysisChart({
  data,
  shouldAnimate,
  pastMonthLabel,
  thisMonthLabel,
}: {
  data: MomentumComparisonPoint[]
  shouldAnimate: boolean
  pastMonthLabel: string
  thisMonthLabel: string
}) {
  const { t } = useTranslation()

  return (
    <div
      className="analysis-chart-shell"
      aria-label={t('landing.analysis.chartAriaLabel')}
    >
      <div className="analysis-chart-legend">
        <span className="analysis-legend analysis-legend--past">{pastMonthLabel}</span>
        <span className="analysis-legend analysis-legend--current">{thisMonthLabel}</span>
      </div>
      <div className="analysis-chart-box">
        <EvilLineChart
          key={shouldAnimate ? 'analysis-chart-animated' : 'analysis-chart-static'}
          className="h-full w-full aspect-auto"
          data={data}
          chartConfig={analysisChartConfig}
          isAnimationActive={shouldAnimate}
          xDataKey="point"
          curveType="natural"
          strokeVariant="solid"
          strokeWidthByDataKey={{
            pastMonth: 2.4,
            currentMonth: 9,
          }}
          strokeDasharrayByDataKey={{
            pastMonth: '9 8',
          }}
          animationBeginByDataKey={{
            pastMonth: 0,
            currentMonth: 1000,
          }}
          animationDurationByDataKey={{
            pastMonth: 800,
            currentMonth: 1200,
          }}
          animationEasingByDataKey={{
            pastMonth: 'ease-out',
            currentMonth: 'ease-out',
          }}
          endValueLabels={{
            pastMonth: {
              offsetX: 16,
              offsetY: -12,
              textAnchor: 'start',
              fontSize: 22,
              fontWeight: 700,
              fill: 'rgba(125, 134, 149, 0.95)',
              formatter: value => `${Math.round(Number(value ?? 0))}`,
            },
            currentMonth: {
              offsetX: -6,
              offsetY: -16,
              textAnchor: 'end',
              fontSize: 56,
              fontWeight: 900,
              fill: 'rgba(186, 113, 27, 0.98)',
              formatter: value => `${Math.round(Number(value ?? 0))}`,
            },
          }}
          hideLegend={true}
          hideTooltip={true}
          hideCursorLine={true}
          tickGap={20}
          chartProps={{
            margin: { top: 20, right: 90, left: 10, bottom: 6 },
          }}
          xAxisProps={{
            tickLine: false,
            axisLine: false,
            tick: { fill: 'rgba(120, 101, 74, 0.78)', fontSize: 11 },
          }}
        />
      </div>
    </div>
  )
}
