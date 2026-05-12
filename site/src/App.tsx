import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { momentumComparisonTargetData, widgetCards } from './landing/data'
import { useDocumentLanguage } from './landing/hooks/useDocumentLanguage'
import { useHeaderAutoHide } from './landing/hooks/useHeaderAutoHide'
import { useRevealOnIntersect } from './landing/hooks/useRevealOnIntersect'
import { useWidgetsScrollProgress } from './landing/hooks/useWidgetsScrollProgress'
import { useWidgetStoryTransition } from './landing/hooks/useWidgetStoryTransition'
import { AnalysisSection } from './landing/sections/AnalysisSection'
import { BridgeSection } from './landing/sections/BridgeSection'
import { ClaritySection } from './landing/sections/ClaritySection'
import { HeroSection } from './landing/sections/HeroSection'
import { LandingFooter } from './landing/sections/LandingFooter'
import { LandingHeader } from './landing/sections/LandingHeader'
import { WidgetsSection } from './landing/sections/WidgetsSection'

export function App() {
  const { i18n } = useTranslation()
  const siteShellRef = useRef<HTMLElement | null>(null)
  const analysisSectionRef = useRef<HTMLElement | null>(null)
  const widgetsSectionRef = useRef<HTMLElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  const [targetWidgetIndex, setTargetWidgetIndex] = useState(0)
  const [analysisChartShouldAnimate, setAnalysisChartShouldAnimate] =
    useState(false)

  const { activeWidgetIndex, previousWidgetIndex, isWidgetTransitioning } =
    useWidgetStoryTransition(targetWidgetIndex)

  const activeWidget = widgetCards[activeWidgetIndex] ?? widgetCards[0]
  const previousWidget =
    previousWidgetIndex !== null ? widgetCards[previousWidgetIndex] : null

  useDocumentLanguage(i18n.language)
  useRevealOnIntersect()
  useHeaderAutoHide({
    scrollerRef: siteShellRef,
    headerRef,
  })
  useWidgetsScrollProgress({
    sectionRef: widgetsSectionRef,
    scrollerRef: siteShellRef,
    totalWidgets: widgetCards.length,
    setTargetWidgetIndex,
  })

  useEffect(() => {
    const section = analysisSectionRef.current
    const scroller = siteShellRef.current
    if (!section || !scroller) return

    const chartShell = section.querySelector<HTMLElement>('.analysis-chart-shell')
    const observed = chartShell ?? section

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          setAnalysisChartShouldAnimate(true)
          observer.unobserve(entry.target)
        })
      },
      {
        root: scroller,
        threshold: 0.5,
      }
    )

    observer.observe(observed)
    return () => observer.disconnect()
  }, [])

  return (
    <main ref={siteShellRef} className="site-shell">
      <LandingHeader headerRef={headerRef} />
      <HeroSection />
      <ClaritySection />
      <WidgetsSection
        sectionRef={widgetsSectionRef}
        activeWidgetIndex={activeWidgetIndex}
        activeWidget={activeWidget}
        previousWidget={previousWidget}
        isWidgetTransitioning={isWidgetTransitioning}
      />
      <AnalysisSection
        sectionRef={analysisSectionRef}
        chartData={momentumComparisonTargetData}
        shouldAnimate={analysisChartShouldAnimate}
      />
      <BridgeSection />
      <LandingFooter />
    </main>
  )
}
