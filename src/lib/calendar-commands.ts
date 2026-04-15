import { invoke } from '@tauri-apps/api/core'
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
} from './calendar-domain'

type Result<T, E = string> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: E }

export const calendarCommands = {
  async getEventsRange(
    start: string,
    end: string
  ): Promise<Result<CalendarEvent[]>> {
    try {
      const data = await invoke<CalendarEvent[]>('get_events_range', {
        start,
        end,
      })
      return { status: 'ok', data }
    } catch (e) {
      return { status: 'error', error: e as string }
    }
  },

  async createEvent(input: CreateEventInput): Promise<Result<CalendarEvent>> {
    try {
      const data = await invoke<CalendarEvent>('create_event', { input })
      return { status: 'ok', data }
    } catch (e) {
      return { status: 'error', error: e as string }
    }
  },

  async updateEvent(input: UpdateEventInput): Promise<Result<CalendarEvent>> {
    try {
      const data = await invoke<CalendarEvent>('update_event', { input })
      return { status: 'ok', data }
    } catch (e) {
      return { status: 'error', error: e as string }
    }
  },

  async deleteEvent(id: string): Promise<Result<null>> {
    try {
      await invoke('delete_event', { id })
      return { status: 'ok', data: null }
    } catch (e) {
      return { status: 'error', error: e as string }
    }
  },
}
