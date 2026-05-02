import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  callback: () => void
) => {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        savedCallback.current()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [ref])
}
