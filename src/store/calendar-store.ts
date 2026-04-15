import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { calendarCommands } from '@/lib/calendar-commands'
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
} from '@/lib/calendar-domain'
import { generateId, getMonthRange } from '@/lib/calendar-domain'
import { logger } from '@/lib/logger'

interface CalendarState {
  events: CalendarEvent[]
  selectedDate: string | null
  selectedEventId: string | null
  isLoading: boolean

  loadEvents: (date: Date) => Promise<void>
  createEvent: (
    input: Omit<CreateEventInput, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<CalendarEvent>
  updateEvent: (input: UpdateEventInput) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  setSelectedDate: (date: string | null) => void
  setSelectedEvent: (id: string | null) => void
}

function unwrapOrThrow<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: unknown }
): T {
  if (result.status === 'ok') return result.data
  throw result.error
}

export const useCalendarStore = create<CalendarState>()(
  devtools(
    set => ({
      events: [],
      selectedDate: null,
      selectedEventId: null,
      isLoading: false,

      loadEvents: async (date: Date) => {
        set({ isLoading: true }, undefined, 'loadEvents/start')
        try {
          const { start, end } = getMonthRange(date)
          const result = await calendarCommands.getEventsRange(start, end)
          const events = unwrapOrThrow(result)
          set({ events, isLoading: false }, undefined, 'loadEvents/done')
          logger.debug(`Loaded ${events.length} calendar events`)
        } catch (error) {
          logger.error(`Failed to load calendar events: ${String(error)}`)
          set({ isLoading: false }, undefined, 'loadEvents/error')
        }
      },

      createEvent: async input => {
        const now = new Date().toISOString()
        const fullInput: CreateEventInput = {
          ...input,
          id: generateId(),
          created_at: now,
          updated_at: now,
        }

        const result = await calendarCommands.createEvent(fullInput)
        const event = unwrapOrThrow(result)

        set(
          state => ({ events: [...state.events, event] }),
          false,
          'createEvent'
        )
        logger.debug(`Created calendar event: ${event.id}`)
        return event
      },

      updateEvent: async input => {
        const result = await calendarCommands.updateEvent(input)
        const event = unwrapOrThrow(result)

        set(
          state => ({
            events: state.events.map(e => (e.id === event.id ? event : e)),
          }),
          false,
          'updateEvent'
        )
        logger.debug(`Updated calendar event: ${event.id}`)
      },

      deleteEvent: async (id: string) => {
        await calendarCommands.deleteEvent(id)
        set(
          state => ({
            events: state.events.filter(e => e.id !== id),
            selectedEventId:
              state.selectedEventId === id ? null : state.selectedEventId,
          }),
          false,
          'deleteEvent'
        )
        logger.debug(`Deleted calendar event: ${id}`)
      },

      setSelectedDate: date =>
        set({ selectedDate: date }, undefined, 'setSelectedDate'),
      setSelectedEvent: id =>
        set({ selectedEventId: id }, undefined, 'setSelectedEvent'),
    }),
    { name: 'calendar-store' }
  )
)
