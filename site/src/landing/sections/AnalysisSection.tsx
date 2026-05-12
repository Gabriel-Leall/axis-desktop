import { useTranslation } from 'react-i18next'
import type { RefObject } from 'react'
import { AnalysisChart } from '../components/AnalysisChart'
import type { MomentumComparisonPoint } from '../types'

export function AnalysisSection({
  sectionRef,
  chartData,
  shouldAnimate,
}: {
  sectionRef: RefObject<HTMLElement | null>
  chartData: MomentumComparisonPoint[]
  shouldAnimate: boolean
}) {
  const { t } = useTranslation()

  return (
    <section
      id="analysis"
      ref={sectionRef}
      className="analysis-section"
      data-reveal={true}
      data-delay="4"
    >
      <div className="analysis-hero">
        <h2 className="analysis-title">{t('landing.analysis.headline')}</h2>
        <p className="analysis-subtitle">{t('landing.analysis.subtitle')}</p>
      </div>

      <AnalysisChart
        data={chartData}
        shouldAnimate={shouldAnimate}
        pastMonthLabel={t('landing.analysis.pastMonth')}
        thisMonthLabel={t('landing.analysis.thisMonth')}
      />
    </section>
  )
}
