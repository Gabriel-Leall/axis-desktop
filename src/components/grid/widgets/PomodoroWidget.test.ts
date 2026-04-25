import { describe, it, expect } from 'vitest'
import {
  formatTime,
  normalizeCycleTotal,
  getCycleProgress,
} from './pomodoro-widget.utils'

describe('PomodoroWidget helpers', () => {
  it('formats time safely for zero and negative values', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(-5)).toBe('00:00')
  })

  it('formats minutes and seconds with leading zero', () => {
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(9 * 60 + 3)).toBe('09:03')
  })

  it('normalizes cycle total to a safe positive integer', () => {
    expect(normalizeCycleTotal(4)).toBe(4)
    expect(normalizeCycleTotal(4.9)).toBe(4)
    expect(normalizeCycleTotal(0)).toBe(1)
    expect(normalizeCycleTotal(-2)).toBe(1)
    expect(normalizeCycleTotal(Number.NaN)).toBe(1)
  })

  it('calculates cycle progress without NaN for invalid totals', () => {
    expect(getCycleProgress(0, 4)).toBe(4)
    expect(getCycleProgress(5, 4)).toBe(1)
    expect(getCycleProgress(3, 0)).toBe(1)
  })
})
