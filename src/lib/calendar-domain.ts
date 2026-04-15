export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  all_day: boolean
  color?: string
  created_at: string
  updated_at: string
}

export interface CreateEventInput {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  all_day: boolean
  color?: string
  created_at: string
  updated_at: string
}

export interface UpdateEventInput {
  id: string
  title?: string
  description?: string
  start_date?: string
  end_date?: string
  all_day?: boolean
  color?: string
  updated_at: string
}

export function getLocalISODate(date = new Date()): string {
  return date.toLocaleDateString('en-CA')
}

export function formatDateForUI(dateStr: string): string {
  if (dateStr.length === 10) {
    const [y, m, d] = dateStr.split('-')
    return `${d}-${m}-${y}`
  }
  try {
    const d = new Date(dateStr)
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function parseStoreDateForAllDay(dateStr: string): string {
  const [d, m, y] = dateStr.split('-')
  return `${y}-${m}-${d}`
}

export function toRFC3339(date: Date): string {
  return date.toISOString()
}

export function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function getMonthRange(date: Date): { start: string; end: string } {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    start: getLocalISODate(start),
    end: getLocalISODate(end),
  }
}

export function isEventOnDate(event: CalendarEvent, dateISO: string): boolean {
  if (event.all_day) {
    const eventStart = event.start_date
    const eventEnd = event.end_date
    return dateISO >= eventStart && dateISO < eventEnd
  }

  const eventStart = new Date(event.start_date)
  const eventEnd = new Date(event.end_date)
  const checkDate = new Date(`${dateISO}T23:59:59`)

  return eventStart <= checkDate && eventEnd > new Date(`${dateISO}T00:00:00`)
}

export function getEventsForDate(
  events: CalendarEvent[],
  dateISO: string
): CalendarEvent[] {
  return events.filter(e => isEventOnDate(e, dateISO))
}
