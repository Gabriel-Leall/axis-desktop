import { getRecoverableHabitDates } from '@/lib/habits-domain'

describe('habits-domain', () => {
  it('returns recent due dates without logs as recoverable', () => {
    expect(
      getRecoverableHabitDates('daily', null, ['2026-06-01'], '2026-06-02', 3)
    ).toEqual(['2026-05-31', '2026-05-30'])
  })

  it('skips days that are not due for weekday-only habits', () => {
    expect(
      getRecoverableHabitDates('weekdays', null, [], '2026-06-08', 3)
    ).toEqual(['2026-06-05'])
  })
})
