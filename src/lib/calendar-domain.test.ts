import { describe, it, expect } from 'vitest'
import {
  getLocalISODate,
  formatDateForUI,
  parseStoreDateForAllDay,
  toRFC3339,
  generateId,
  getMonthRange,
  isEventOnDate,
  getEventsForDate,
  type CalendarEvent,
} from './calendar-domain'

describe('calendar-domain', () => {
  it('getLocalISODate returns YYYY-MM-DD', () => {
    const date = new Date(2023, 10, 15) // Nov 15 2023
    expect(getLocalISODate(date)).toBe('2023-11-15')
  })

  it('formatDateForUI formats 10-char dates as DD-MM-YYYY', () => {
    expect(formatDateForUI('2023-11-15')).toBe('15-11-2023')
  })

  it('parseStoreDateForAllDay parses DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(parseStoreDateForAllDay('15-11-2023')).toBe('2023-11-15')
  })

  it('toRFC3339 returns a standard ISO string', () => {
    const date = new Date(Date.UTC(2023, 10, 15, 12, 0, 0))
    expect(toRFC3339(date)).toBe('2023-11-15T12:00:00.000Z')
  })

  it('generateId produces an ID prefixed with evt_', () => {
    const id = generateId()
    expect(id).toMatch(/^evt_/)
  })

  it('getMonthRange returns correct start and end for a month', () => {
    const date = new Date(2023, 1, 15) // Feb 2023 (non-leap year)
    const range = getMonthRange(date)
    expect(range.start).toBe('2023-02-01')
    expect(range.end).toBe('2023-02-28')
  })

  describe('isEventOnDate', () => {
    it('handles all-day events correctly', () => {
      const event: CalendarEvent = {
        id: '1',
        title: 'Test',
        start_date: '2023-11-10',
        end_date: '2023-11-12', // Not inclusive of end_date in all_day logic as written
        all_day: true,
        created_at: '',
        updated_at: '',
      }
      expect(isEventOnDate(event, '2023-11-09')).toBe(false)
      expect(isEventOnDate(event, '2023-11-10')).toBe(true)
      expect(isEventOnDate(event, '2023-11-11')).toBe(true)
      expect(isEventOnDate(event, '2023-11-12')).toBe(false) // Exclusive end date
    })

    it('handles exact day all_day events correctly', () => {
      const event: CalendarEvent = {
        id: '2',
        title: 'Test 2',
        start_date: '2023-11-10',
        end_date: '2023-11-11',
        all_day: true,
        created_at: '',
        updated_at: '',
      }
      expect(isEventOnDate(event, '2023-11-10')).toBe(true)
    })

    it('handles non-all-day events correctly', () => {
      const event: CalendarEvent = {
        id: '3',
        title: 'Test 3',
        start_date: '2023-11-10T10:00:00Z',
        end_date: '2023-11-10T12:00:00Z',
        all_day: false,
        created_at: '',
        updated_at: '',
      }
      expect(isEventOnDate(event, '2023-11-10')).toBe(true)
      expect(isEventOnDate(event, '2023-11-09')).toBe(false)
      expect(isEventOnDate(event, '2023-11-11')).toBe(false)
    })
  })

  describe('getEventsForDate', () => {
    it('filters events to only those on the target date', () => {
      const events: CalendarEvent[] = [
        {
          id: '1',
          title: 'Event 1',
          start_date: '2023-11-10',
          end_date: '2023-11-11',
          all_day: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          title: 'Event 2',
          start_date: '2023-11-15',
          end_date: '2023-11-16',
          all_day: true,
          created_at: '',
          updated_at: '',
        },
      ]

      const matched = getEventsForDate(events, '2023-11-10')
      expect(matched.length).toBe(1)
      expect(matched[0]?.id).toBe('1')
    })
  })
})
