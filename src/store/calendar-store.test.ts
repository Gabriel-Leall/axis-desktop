import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCalendarStore } from './calendar-store'
import { calendarCommands } from '@/lib/calendar-commands'
import type { CalendarEvent } from '@/lib/calendar-domain'

vi.mock('@/lib/calendar-commands', () => ({
  calendarCommands: {
    getEventsRange: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}))

// We also mock logger to avoid cluttering test output
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CalendarStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useCalendarStore.setState({
      events: [],
      selectedDate: null,
      selectedEventId: null,
      isLoading: false,
    })
  })

  it('has correct initial state', () => {
    const state = useCalendarStore.getState()
    expect(state.events).toEqual([])
    expect(state.selectedDate).toBeNull()
    expect(state.selectedEventId).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('loads events', async () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        title: 'Test Event',
        start_date: '2023-10-01',
        end_date: '2023-10-02',
        all_day: true,
        created_at: '2023-10-01T00:00:00.000Z',
        updated_at: '2023-10-01T00:00:00.000Z',
      },
    ]

    vi.mocked(calendarCommands.getEventsRange).mockResolvedValue({
      status: 'ok',
      data: mockEvents,
    })

    const { loadEvents } = useCalendarStore.getState()
    await loadEvents(new Date(2023, 9, 15)) // Oct 15

    const state = useCalendarStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.events).toEqual(mockEvents)
    // Check that it was called with correct date strings for Oct 2023
    expect(calendarCommands.getEventsRange).toHaveBeenCalledWith(
      '2023-10-01',
      '2023-10-31'
    )
  })

  it('creates an event', async () => {
    const mockEvent: CalendarEvent = {
      id: '2',
      title: 'New Event',
      start_date: '2023-10-15',
      end_date: '2023-10-16',
      all_day: true,
      created_at: '2023-10-10T00:00:00.000Z',
      updated_at: '2023-10-10T00:00:00.000Z',
    }

    vi.mocked(calendarCommands.createEvent).mockResolvedValue({
      status: 'ok',
      data: mockEvent,
    })

    const { createEvent } = useCalendarStore.getState()
    const result = await createEvent({
      title: 'New Event',
      start_date: '2023-10-15',
      end_date: '2023-10-16',
      all_day: true,
    })

    const state = useCalendarStore.getState()
    expect(result).toEqual(mockEvent)
    expect(state.events).toContainEqual(mockEvent)
    expect(calendarCommands.createEvent).toHaveBeenCalled()
  })

  it('updates an event', async () => {
    const initialEvent: CalendarEvent = {
      id: '3',
      title: 'Old Title',
      start_date: '2023-10-15',
      end_date: '2023-10-16',
      all_day: true,
      created_at: '2023-10-10T00:00:00.000Z',
      updated_at: '2023-10-10T00:00:00.000Z',
    }

    useCalendarStore.setState({ events: [initialEvent] })

    const updatedEvent: CalendarEvent = {
      ...initialEvent,
      title: 'New Title',
      updated_at: '2023-10-12T00:00:00.000Z',
    }

    vi.mocked(calendarCommands.updateEvent).mockResolvedValue({
      status: 'ok',
      data: updatedEvent,
    })

    const { updateEvent } = useCalendarStore.getState()
    await updateEvent({
      id: '3',
      title: 'New Title',
      updated_at: '2023-10-12T00:00:00.000Z',
    })

    const state = useCalendarStore.getState()
    expect(state.events[0]?.title).toBe('New Title')
    expect(calendarCommands.updateEvent).toHaveBeenCalled()
  })

  it('deletes an event and clears selection if selected', async () => {
    const event: CalendarEvent = {
      id: '4',
      title: 'To Delete',
      start_date: '2023-10-15',
      end_date: '2023-10-16',
      all_day: true,
      created_at: '2023-10-10T00:00:00.000Z',
      updated_at: '2023-10-10T00:00:00.000Z',
    }

    useCalendarStore.setState({ events: [event], selectedEventId: '4' })

    vi.mocked(calendarCommands.deleteEvent).mockResolvedValue({
      status: 'ok',
      data: null,
    })

    const { deleteEvent } = useCalendarStore.getState()
    await deleteEvent('4')

    const state = useCalendarStore.getState()
    expect(state.events).toEqual([])
    expect(state.selectedEventId).toBeNull()
    expect(calendarCommands.deleteEvent).toHaveBeenCalledWith('4')
  })
})
