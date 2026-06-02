export type DailyAxisPeriod = 'morning' | 'afternoon' | 'evening'

export function getDailyAxisPeriod(date = new Date()): DailyAxisPeriod {
  const hour = date.getHours()

  if (hour < 12) {
    return 'morning'
  }

  if (hour < 18) {
    return 'afternoon'
  }

  return 'evening'
}
