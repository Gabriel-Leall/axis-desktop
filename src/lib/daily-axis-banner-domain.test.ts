import { describe, expect, it } from 'vitest'
import { getDailyAxisPeriod } from './daily-axis-banner-domain'

describe('getDailyAxisPeriod', () => {
  it('returns morning before noon', () => {
    expect(getDailyAxisPeriod(new Date('2026-06-02T08:00:00'))).toBe(
      'morning'
    )
  })

  it('returns afternoon from noon until 17:59', () => {
    expect(getDailyAxisPeriod(new Date('2026-06-02T15:30:00'))).toBe(
      'afternoon'
    )
  })

  it('returns evening from 18:00 onward', () => {
    expect(getDailyAxisPeriod(new Date('2026-06-02T20:15:00'))).toBe(
      'evening'
    )
  })
})
