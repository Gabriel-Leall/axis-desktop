import { useEffect } from 'react'

export function useRevealOnIntersect() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.22 }
    )

    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [])
}
