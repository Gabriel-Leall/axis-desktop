import { startTransition, useEffect, useState } from 'react'

export function useWidgetStoryTransition(targetWidgetIndex: number) {
  const [activeWidgetIndex, setActiveWidgetIndex] = useState(0)
  const [previousWidgetIndex, setPreviousWidgetIndex] = useState<number | null>(
    null
  )
  const [isWidgetTransitioning, setIsWidgetTransitioning] = useState(false)

  useEffect(() => {
    if (targetWidgetIndex === activeWidgetIndex) return

    const transitionDelayMs = 120
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setPreviousWidgetIndex(activeWidgetIndex)
        setIsWidgetTransitioning(true)
        setActiveWidgetIndex(currentIndex => {
          if (currentIndex === targetWidgetIndex) return currentIndex
          return currentIndex < targetWidgetIndex
            ? currentIndex + 1
            : currentIndex - 1
        })
      })
    }, transitionDelayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeWidgetIndex, targetWidgetIndex])

  useEffect(() => {
    if (!isWidgetTransitioning) return

    const transitionDurationMs = 500
    const timeoutId = window.setTimeout(() => {
      setIsWidgetTransitioning(false)
      setPreviousWidgetIndex(null)
    }, transitionDurationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isWidgetTransitioning])

  return {
    activeWidgetIndex,
    previousWidgetIndex,
    isWidgetTransitioning,
  }
}
