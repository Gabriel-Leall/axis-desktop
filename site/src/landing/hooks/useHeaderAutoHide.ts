import { useEffect, type RefObject } from 'react'

export function useHeaderAutoHide({
  scrollerRef,
  headerRef,
}: {
  scrollerRef: RefObject<HTMLElement | null>
  headerRef: RefObject<HTMLElement | null>
}) {
  useEffect(() => {
    const scroller = scrollerRef.current
    const header = headerRef.current
    if (!scroller || !header) return

    let lastScrollTop = scroller.scrollTop
    let ticking = false
    const directionThreshold = 2
    const hideAfter = 64
    const idleHideDelayMs = 2400
    let idleHideTimer: number | null = null

    const clearIdleHideTimer = () => {
      if (idleHideTimer === null) return
      window.clearTimeout(idleHideTimer)
      idleHideTimer = null
    }

    const scheduleIdleHide = () => {
      clearIdleHideTimer()
      idleHideTimer = window.setTimeout(() => {
        if (scroller.scrollTop > hideAfter) {
          header.classList.add('site-header--hidden')
        }
      }, idleHideDelayMs)
    }

    const updateHeaderVisibility = () => {
      const currentScrollTop = scroller.scrollTop
      const delta = currentScrollTop - lastScrollTop
      const nearTop = currentScrollTop < 18

      if (nearTop || delta < -directionThreshold) {
        header.classList.remove('site-header--hidden')
      } else if (delta > directionThreshold && currentScrollTop > hideAfter) {
        header.classList.add('site-header--hidden')
      }

      if (currentScrollTop > hideAfter) {
        scheduleIdleHide()
      } else {
        clearIdleHideTimer()
      }

      lastScrollTop = currentScrollTop
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(updateHeaderVisibility)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    updateHeaderVisibility()
    return () => {
      clearIdleHideTimer()
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [headerRef, scrollerRef])
}
