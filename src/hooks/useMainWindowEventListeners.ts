import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useCommandContext } from './use-command-context'
import { useKeyboardShortcuts } from './use-keyboard-shortcuts'
import { useUIStore } from '@/store/ui-store'
import { logger } from '@/lib/logger'
import { useTasksStore } from '@/store/tasks-store'
import { useNotesStore } from '@/store/notes-store'
import { useHabitsStore } from '@/store/habits-store'
import { useCalendarStore } from '@/store/calendar-store'
import type { CapturePaneCreatedPayload } from '@/lib/capture-pane-domain'

/**
 * Main window event listeners - handles global keyboard shortcuts and cross-window events.
 *
 * This hook composes specialized hooks for different event types:
 * - useKeyboardShortcuts: Global keyboard shortcuts (Cmd+, Cmd+1, Cmd+2)
 * - Quick pane submit listener: Cross-window communication from quick pane
 */
export function useMainWindowEventListeners() {
  const commandContext = useCommandContext()

  useKeyboardShortcuts(commandContext)

  // Listen for quick pane submissions (cross-window event)
  useEffect(() => {
    let isMounted = true
    let unlisten: (() => void) | null = null

    listen<{ text: string }>('quick-pane-submit', event => {
      logger.debug('Quick pane submit event received', {
        text: event.payload.text,
      })
      const { setLastQuickPaneEntry } = useUIStore.getState()
      setLastQuickPaneEntry(event.payload.text)
    })
      .then(unlistenFn => {
        if (!isMounted) {
          unlistenFn()
        } else {
          unlisten = unlistenFn
        }
      })
      .catch(error => {
        logger.error('Failed to setup quick-pane-submit listener', { error })
      })

    return () => {
      isMounted = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let unlisten: (() => void) | null = null

    listen<CapturePaneCreatedPayload>('capture-pane-created', event => {
      logger.debug('Capture pane create event received', {
        payload: event.payload,
      })

      const navigateTo = useUIStore.getState().navigateTo

      if (event.payload.kind === 'task' || event.payload.kind === 'focus') {
        void useTasksStore.getState().loadTasks()
      }

      if (event.payload.kind === 'note') {
        void useNotesStore.getState().loadNotes()
      }

      if (event.payload.kind === 'habit') {
        void Promise.all([
          useHabitsStore.getState().loadHabits(),
          useHabitsStore.getState().loadTodayLogs(),
          useHabitsStore.getState().loadMonthLogs(),
        ])
      }

      if (event.payload.kind === 'event') {
        void useCalendarStore.getState().loadEvents(new Date())
      }

      if (event.payload.openTarget === 'tasks' && event.payload.id) {
        navigateTo('tasks', { selectedTaskId: event.payload.id })
      } else if (event.payload.openTarget === 'notes' && event.payload.id) {
        navigateTo('notes', { selectedNoteId: event.payload.id })
      } else if (event.payload.openTarget === 'habits' && event.payload.id) {
        navigateTo('habits', { selectedHabitId: event.payload.id })
      } else if (event.payload.openTarget === 'calendar') {
        navigateTo('calendar')
      } else if (event.payload.openTarget === 'pomodoro') {
        navigateTo('pomodoro')
      }
    })
      .then(unlistenFn => {
        if (!isMounted) {
          unlistenFn()
        } else {
          unlisten = unlistenFn
        }
      })
      .catch(error => {
        logger.error('Failed to setup capture-pane-created listener', { error })
      })

    return () => {
      isMounted = false
      if (unlisten) {
        unlisten()
      }
    }
  }, [])
}
