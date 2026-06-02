import { useState, useEffect, useRef } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTranslation } from 'react-i18next'
import {
  commands,
  unwrapResult,
  type CreateDailyPlanInput,
} from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { applyDocumentTheme, THEME_STORAGE_KEY } from '@/lib/theme'
import {
  parseCapturePaneInput,
  type CapturePaneCreatedPayload,
  type CapturePaneIntent,
} from '@/lib/capture-pane-domain'
import { getLocalISODate } from '@/lib/calendar-domain'

/** Dismiss the quick pane window, logging any errors */
async function dismissQuickPane() {
  const result = await commands.dismissQuickPane()
  if (result.status === 'error') {
    logger.error('Failed to dismiss quick pane', { error: result.error })
  }
}

/**
 * QuickPaneApp - A minimal floating window for quick text entry.
 *
 * This component demonstrates the quick pane pattern:
 * - Single text input with submit on Enter
 * - Emits 'quick-pane-submit' event with the entered text
 * - Theme synced with main window via localStorage
 * - Hides window on submit or Escape
 */
// Apply theme from localStorage to document
function applyTheme() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY) || 'system'
  applyDocumentTheme(theme as 'light' | 'dark' | 'system')
}

function nowISO() {
  return new Date().toISOString()
}

function newId() {
  return crypto.randomUUID()
}

async function nextTaskSortOrder() {
  const tasks = unwrapResult(await commands.getTasks())
  return tasks.length
}

async function nextHabitSortOrder() {
  const habits = unwrapResult(await commands.getHabits())
  return habits.length
}

function buildDailyPlanInput(
  planDate: string,
  focusTaskId: string
): CreateDailyPlanInput {
  const timestamp = nowISO()

  return {
    id: newId(),
    plan_date: planDate,
    focus_task_id: focusTaskId,
    status: 'open',
    focus_source: 'manual',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export default function QuickPaneApp() {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [errorPrefix, setErrorPrefix] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Apply theme on mount and listen for theme changes from main window
  useEffect(() => {
    applyTheme()

    const unlisten = listen('theme-changed', () => {
      applyTheme()
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  // Focus input when window becomes visible, hide on blur
  useEffect(() => {
    const currentWindow = getCurrentWindow()
    const unlisten = currentWindow.onFocusChanged(
      async ({ payload: focused }) => {
        if (focused) {
          // Re-apply theme in case it changed while hidden
          applyTheme()
          inputRef.current?.focus()
        } else {
          // Hide window when it loses focus (dismiss on blur)
          // Use dismiss command for consistent behavior (no animation)
          await dismissQuickPane()
        }
      }
    )

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault() // Prevent system "boop" sound
        await dismissQuickPane()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
  }

  const createFromIntent = async (
    intent: CapturePaneIntent,
    openAfterSave: boolean
  ): Promise<CapturePaneCreatedPayload> => {
    const timestamp = nowISO()
    const today = getLocalISODate()

    if (intent.kind === 'task') {
      const task = unwrapResult(
        await commands.createTask({
          id: newId(),
          title: intent.content,
          description: null,
          priority: 'medium',
          due_date: today,
          created_at: timestamp,
          updated_at: timestamp,
          sort_order: await nextTaskSortOrder(),
        })
      )

      return {
        kind: 'task',
        id: task.id,
        text: intent.content,
        openTarget: openAfterSave ? 'tasks' : null,
      }
    }

    if (intent.kind === 'note') {
      const note = unwrapResult(
        await commands.createNote({
          title: null,
          content: intent.content,
          folder: null,
        })
      )

      return {
        kind: 'note',
        id: note.id,
        text: intent.content,
        openTarget: openAfterSave ? 'notes' : null,
      }
    }

    if (intent.kind === 'event') {
      const event = unwrapResult(
        await commands.createEvent({
          id: newId(),
          title: intent.content,
          description: null,
          start_date: today,
          end_date: getLocalISODate(new Date(Date.now() + 86_400_000)),
          all_day: true,
          color: null,
          created_at: timestamp,
          updated_at: timestamp,
        })
      )

      return {
        kind: 'event',
        id: event.id,
        text: intent.content,
        openTarget: openAfterSave ? 'calendar' : null,
      }
    }

    if (intent.kind === 'habit') {
      const habit = unwrapResult(
        await commands.createHabit({
          id: newId(),
          name: intent.content,
          color: 'blue',
          icon: null,
          frequency: 'daily',
          frequency_days: null,
          sort_order: await nextHabitSortOrder(),
          created_at: timestamp,
          updated_at: timestamp,
        })
      )

      return {
        kind: 'habit',
        id: habit.id,
        text: intent.content,
        openTarget: openAfterSave ? 'habits' : null,
      }
    }

    const task = unwrapResult(
      await commands.createTask({
        id: newId(),
        title: intent.content,
        description: null,
        priority: 'high',
        due_date: today,
        created_at: timestamp,
        updated_at: timestamp,
        sort_order: await nextTaskSortOrder(),
      })
    )
    const existingPlan = unwrapResult(await commands.getDailyPlan(today))

    if (existingPlan) {
      await unwrapResult(
        await commands.updateDailyPlanFocus(
          existingPlan.id,
          task.id,
          'manual',
          nowISO()
        )
      )
    } else {
      await unwrapResult(
        await commands.createDailyPlan(buildDailyPlanInput(today, task.id))
      )
    }

    return {
      kind: 'focus',
      id: task.id,
      text: intent.content,
      openTarget: openAfterSave ? 'pomodoro' : null,
    }
  }

  const submitCapture = async (openAfterSave: boolean) => {
    const parsed = parseCapturePaneInput(text)
    if (parsed.status === 'error') {
      setErrorPrefix(parsed.prefix ?? null)
      setErrorKey(
        parsed.reason === 'unknown-prefix'
          ? 'capturePane.error.unknownPrefix'
          : parsed.reason === 'insufficient-content'
            ? 'capturePane.error.insufficientContent'
            : 'capturePane.error.empty'
      )
      return
    }

    setIsSaving(true)
    setErrorKey(null)
    setErrorPrefix(null)

    try {
      const payload = await createFromIntent(parsed.intent, openAfterSave)
      await emit('quick-pane-submit', { text: text.trim() })
      await emit('capture-pane-created', payload)
      setText('')
      await dismissQuickPane()
    } catch (error) {
      logger.error('Failed to persist capture pane entry', { error })
      setErrorKey('capturePane.error.persistFailed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-screen w-screen flex-col justify-center gap-3 rounded-(--app-corner-radius) border border-border bg-background px-5 py-4 shadow-lg"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => {
          setText(e.target.value)
          if (errorKey) {
            setErrorKey(null)
            setErrorPrefix(null)
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submitCapture(e.shiftKey)
          }
        }}
        placeholder={t('capturePane.placeholder')}
        className="w-full bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={isSaving}
      />

      <div className="flex w-full items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="min-w-0">
          {errorKey ? (
            <span className="text-destructive">
              {errorPrefix ? t(errorKey, { prefix: errorPrefix }) : t(errorKey)}
            </span>
          ) : (
            <span>{t('capturePane.supported')}</span>
          )}
        </div>
        <div className="shrink-0">
          {isSaving ? t('capturePane.saving') : t('capturePane.hintPrimary')} ·{' '}
          {t('capturePane.hintSecondary')}
        </div>
      </div>
    </form>
  )
}
