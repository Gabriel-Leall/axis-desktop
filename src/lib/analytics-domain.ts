export type AnalyticsPeriod =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'all_time'

export function getPeriodRange(period: AnalyticsPeriod): {
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start = new Date(today)
  let end = new Date(today)
  end.setDate(end.getDate() + 1) // exclusively up to tomorrow at 00:00

  let prevStart = new Date(start)
  let prevEnd = new Date(start)

  switch (period) {
    case 'this_week': {
      // Assuming week starts on Monday
      const dayOfWeek = today.getDay()
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      start.setDate(diff)
      prevEnd = new Date(start)
      prevStart.setTime(start.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    }
    case 'last_week': {
      const dayOfWeek = today.getDay()
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(diff)
      end = thisWeekStart
      start = new Date(thisWeekStart)
      start.setDate(start.getDate() - 7)
      
      prevEnd = new Date(start)
      prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 7)
      break
    }
    case 'this_month': {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      prevEnd = new Date(start)
      prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      break
    }
    case 'last_30_days': {
      start.setDate(today.getDate() - 30) // 30 days ago
      prevEnd = new Date(start)
      prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 30)
      break
    }
    case 'last_90_days': {
      start.setDate(today.getDate() - 90)
      prevEnd = new Date(start)
      prevStart = new Date(start)
      prevStart.setDate(prevStart.getDate() - 90)
      break
    }
    case 'this_year': {
      start = new Date(today.getFullYear(), 0, 1)
      prevEnd = new Date(start)
      prevStart = new Date(today.getFullYear() - 1, 0, 1)
      break
    }
    case 'all_time': {
      start = new Date(2000, 0, 1)
      prevEnd = new Date(start)
      prevStart = new Date(start)
      break
    }
  }

  return { start, end, prevStart, prevEnd }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fillMissingDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[],
  start: Date,
  end: Date
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>()
  data.forEach((d) => map.set(d.day, d))

  const result = []
  const curr = new Date(start)
  while (curr < end) {
    const dateStr = [
      curr.getFullYear(),
      String(curr.getMonth() + 1).padStart(2, '0'),
      String(curr.getDate()).padStart(2, '0')
    ].join('-')
    
    const existing = map.get(dateStr)
    if (existing) {
      result.push({
        ...existing,
        day: dateStr,
      })
    } else {
      result.push({ day: dateStr, value: 0, created: 0, completed: 0, total_seconds: 0 })
    }
    curr.setDate(curr.getDate() + 1)
  }
  return result
}

export function completionRate(created: number, completed: number): number {
  if (created === 0) return 0
  return Math.round((completed / created) * 100)
}

export function formatAxisLabel(day: string, period: AnalyticsPeriod): string {
  // Ensure day is parsed properly based on YYYY-MM-DD
  const date = new Date(`${day}T12:00:00Z`)
  switch (period) {
    case 'this_week':
    case 'last_week':
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    case 'this_month':
    case 'last_30_days':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'last_90_days':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    default:
      return date.toLocaleDateString()
  }
}

export function groupByWeek(
  data: { day: string; total_seconds: number }[]
): { week: string; total_seconds: number }[] {
  const grouped = new Map<string, number>()
  for (const item of data) {
    // Treat the date string purely implicitly to avoid TZ shifts
    const d = new Date(`${item.day}T12:00:00Z`)
    const dayOfWeek = d.getUTCDay()
    const diff = d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const weekStart = new Date(d)
    weekStart.setUTCDate(diff)
    const key = [
      weekStart.getUTCFullYear(),
      String(weekStart.getUTCMonth() + 1).padStart(2, '0'),
      String(weekStart.getUTCDate()).padStart(2, '0')
    ].join('-')
    
    grouped.set(key, (grouped.get(key) || 0) + item.total_seconds)
  }
  return Array.from(grouped.entries())
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([week, total_seconds]) => ({
      week,
      total_seconds,
    }))
}

export function formatDelta(current: number, previous: number): {
  value: string
  isPositive: boolean
} {
  const deltaSeconds = current - previous
  const isPositive = deltaSeconds >= 0
  const absDelta = Math.abs(deltaSeconds)
  return {
    value: `${isPositive ? '+' : '-'}${formatDuration(absDelta)}`,
    isPositive,
  }
}
