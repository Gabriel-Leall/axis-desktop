import {
  startTransition,
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useWidgetsScrollProgress({
  sectionRef,
  scrollerRef,
  totalWidgets,
  setTargetWidgetIndex,
}: {
  sectionRef: RefObject<HTMLElement | null>
  scrollerRef: RefObject<HTMLElement | null>
  totalWidgets: number
  setTargetWidgetIndex: Dispatch<SetStateAction<number>>
}) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const section = sectionRef.current
    const scroller = scrollerRef.current
    if (!section || !scroller) return

    const activationStart = 0.18
    const activationEnd = 0.82
    let lastIndex = -1

    const trigger = ScrollTrigger.create({
      trigger: section,
      scroller,
      start: 'top top+=140',
      end: 'bottom bottom-=120',
      scrub: 0.35,
      onUpdate: self => {
        const normalizedProgress =
          (self.progress - activationStart) / (activationEnd - activationStart)
        const clampedProgress = Math.min(1, Math.max(0, normalizedProgress))
        const nextIndex = Math.min(
          totalWidgets - 1,
          Math.floor(clampedProgress * totalWidgets)
        )

        if (nextIndex === lastIndex) return

        lastIndex = nextIndex
        startTransition(() => setTargetWidgetIndex(nextIndex))
      },
      onEnter: () => {
        lastIndex = 0
        startTransition(() => setTargetWidgetIndex(0))
      },
      onEnterBack: () => {
        lastIndex = totalWidgets - 1
        startTransition(() => setTargetWidgetIndex(totalWidgets - 1))
      },
    })

    return () => {
      trigger.kill()
    }
  }, [scrollerRef, sectionRef, setTargetWidgetIndex, totalWidgets])
}
