export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom'

export function getLocalISODate(date = new Date()): string {
  return date.toLocaleDateString('en-CA')
}

function parseWeekdayList(daysJson: string | null): number[] {
  if (!daysJson) return []
  try {
    const parsed = JSON.parse(daysJson)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (value): value is number =>
        typeof value === 'number' && value >= 0 && value <= 6
    )
  } catch {
    return []
  }
}

export function shouldDoOnDate(
  frequency: HabitFrequency,
  frequencyDays: string | null,
  dateISO: string
): boolean {
  const day = new Date(`${dateISO}T12:00:00`).getDay()
  if (frequency === 'daily') return true
  if (frequency === 'weekdays') return day >= 1 && day <= 5
  if (frequency === 'weekends') return day === 0 || day === 6
  if (frequency === 'custom') {
    return parseWeekdayList(frequencyDays).includes(day)
  }
  return false
}

export function calculateStreakFromDates(
  completedDates: string[],
  todayISO: string
): number {
  const completedSet = new Set(completedDates)
  const today = new Date(`${todayISO}T12:00:00`)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const hasToday = completedSet.has(getLocalISODate(today))
  const hasYesterday = completedSet.has(getLocalISODate(yesterday))
  if (!hasToday && !hasYesterday) return 0

  let streak = 0
  const cursor = hasToday ? new Date(today) : new Date(yesterday)

  while (completedSet.has(getLocalISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export function completionRate(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function buildDateRange(days: number, endDate = new Date()): string[] {
  const dates: string[] = []
  const end = new Date(endDate)
  end.setHours(12, 0, 0, 0)

  for (let i = 0; i < days; i += 1) {
    const step = new Date(end)
    step.setDate(end.getDate() - (days - 1 - i))
    dates.push(getLocalISODate(step))
  }

  return dates
}

export function bestHistoricalStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0
  const uniqueSorted = [...new Set(completedDates)].sort()
  let best = 1
  let current = 1

  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = new Date(`${uniqueSorted[i - 1]}T12:00:00`)
    const cur = new Date(`${uniqueSorted[i]}T12:00:00`)
    const diffDays = Math.round(
      (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 1) {
      current += 1
      if (current > best) best = current
    } else {
      current = 1
    }
  }

  return best
}

export function topCompletionWeekday(completedDates: string[]): number | null {
  if (completedDates.length === 0) return null
  const counts = new Array<number>(7).fill(0)
  for (const date of completedDates) {
    const weekday = new Date(`${date}T12:00:00`).getDay()
    counts[weekday] = (counts[weekday] ?? 0) + 1
  }

  let maxDay = 0
  let maxCount = counts[0] ?? 0
  for (let day = 1; day < counts.length; day += 1) {
    if ((counts[day] ?? 0) > maxCount) {
      maxCount = counts[day] ?? 0
      maxDay = day
    }
  }
  return maxDay
}
