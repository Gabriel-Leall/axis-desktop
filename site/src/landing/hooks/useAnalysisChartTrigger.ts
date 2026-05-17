import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  momentumComparisonTargetData,
  momentumComparisonZeroData,
} from '../data'
import type { MomentumComparisonPoint } from '../types'

export function useAnalysisChartTrigger({
  sectionRef,
  scrollerRef,
  setAnalysisChartData,
}: {
  sectionRef: RefObject<HTMLElement | null>
  scrollerRef: RefObject<HTMLElement | null>
  setAnalysisChartData: Dispatch<SetStateAction<MomentumComparisonPoint[]>>
}) {
  useEffect(() => {
    const section = sectionRef.current
    const scroller = scrollerRef.current
    if (!section || !scroller) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) {
      setAnalysisChartData(momentumComparisonTargetData)
      return
    }

    setAnalysisChartData(momentumComparisonZeroData)

    let hasAnimated = false
    const chartShell = section.querySelector<HTMLElement>(
      '.analysis-chart-shell'
    )
    const observedElement = chartShell ?? section

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            const rootBottom = entry.rootBounds?.bottom ?? 0
            if (entry.boundingClientRect.top >= rootBottom) {
              setAnalysisChartData(momentumComparisonZeroData)
              hasAnimated = false
            }
            return
          }

          if (hasAnimated) return

          setAnalysisChartData(momentumComparisonTargetData)
          hasAnimated = true
        })
      },
      {
        root: scroller,
        threshold: 0.45,
      }
    )

    observer.observe(observedElement)

    return () => {
      observer.disconnect()
    }
  }, [scrollerRef, sectionRef, setAnalysisChartData])
}
