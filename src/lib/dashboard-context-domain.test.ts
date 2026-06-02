import {
  getDashboardContextMode,
  getDashboardWidgetPriority,
  shouldDeemphasizeDashboardWidgets,
} from '@/lib/dashboard-context-domain'

describe('dashboard-context-domain', () => {
  it('prioritizes active focus sessions over day period', () => {
    expect(
      getDashboardContextMode({
        adaptationMode: 'full',
        period: 'morning',
        focusSessionActive: true,
      })
    ).toBe('focus')
  })

  it('falls back to default when adaptation is off', () => {
    expect(
      getDashboardContextMode({
        adaptationMode: 'off',
        period: 'evening',
        focusSessionActive: true,
      })
    ).toBe('default')
  })

  it('keeps only primary highlights in reduced mode', () => {
    expect(getDashboardWidgetPriority('focus', 'reduced', 'pomodoro')).toBe(
      'primary'
    )
    expect(getDashboardWidgetPriority('focus', 'reduced', 'tasks')).toBe(
      'default'
    )
  })

  it('returns secondary surfaces in full mode', () => {
    expect(getDashboardWidgetPriority('morning', 'full', 'calendar')).toBe(
      'secondary'
    )
  })

  it('only de-emphasizes other widgets in full contextual mode', () => {
    expect(shouldDeemphasizeDashboardWidgets('afternoon', 'full')).toBe(true)
    expect(shouldDeemphasizeDashboardWidgets('afternoon', 'reduced')).toBe(
      false
    )
    expect(shouldDeemphasizeDashboardWidgets('default', 'full')).toBe(false)
  })
})
