import { useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  commands,
  unwrapResult,
  type CreateDailyPlanInput,
} from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { applyDocumentTheme, THEME_STORAGE_KEY } from '@/lib/theme'
import { usePlatform } from '@/hooks/use-platform'
import { formatShortcut } from '@/lib/platform-strings'
import {
  parseCapturePaneInput,
  type CapturePaneCreatedPayload,
  type CapturePaneKind,
  type CapturePaneIntent,
} from '@/lib/capture-pane-domain'
import { getLocalISODate } from '@/lib/calendar-domain'

const CAPTURE_MODES: CapturePaneKind[] = [
  'task',
  'note',
  'event',
  'habit',
  'focus',
]
const TYPE_PICKER_STORAGE_KEY = 'axis.quickPane.showTypePicker'
const QUICK_PANE_WIDTH = 680
const QUICK_PANE_MIN_HEIGHT = 176
const TEXTAREA_MIN_HEIGHT = 64

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
 * - Multiline text entry with submit on Cmd/Ctrl+Enter
 * - Optional visual type picker, with typed prefixes as a compact shortcut mode
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

function prefixedKindFromText(text: string): CapturePaneKind | null {
  const prefixedMatch = text.trimStart().match(/^([a-zA-Z]+)\s*:/)
  if (!prefixedMatch) return null

  const prefix = prefixedMatch[1]?.toLowerCase()
  return CAPTURE_MODES.includes(prefix as CapturePaneKind)
    ? (prefix as CapturePaneKind)
    : null
}

function stripLeadingPrefix(text: string): string {
  const prefixedMatch = text.match(/^(\s*)([a-zA-Z]+)\s*:\s*([\s\S]*)$/)
  if (!prefixedMatch) return text
  return prefixedMatch[3] ?? ''
}

function getStoredTypePickerPreference() {
  return localStorage.getItem(TYPE_PICKER_STORAGE_KEY) !== 'false'
}

function splitTitleAndDescription(content: string) {
  const [titleLine = '', ...detailLines] = content.split(/\r?\n/)
  const title = titleLine.trim() || content.trim()
  const description = detailLines.join('\n').trim()

  return {
    title,
    description: description || null,
  }
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

interface CapturePaneError {
  key: string
  prefix: string | null
}

interface QuickPaneState {
  text: string
  selectedKind: CapturePaneKind
  showTypePicker: boolean
  error: CapturePaneError | null
  isSaving: boolean
}

type QuickPaneAction =
  | {
      type: 'input-change'
      text: string
      detectedKind: CapturePaneKind | null
    }
  | { type: 'select-kind'; kind: CapturePaneKind }
  | { type: 'set-type-picker'; show: boolean }
  | { type: 'set-error'; error: CapturePaneError | null }
  | { type: 'set-saving'; isSaving: boolean }
  | { type: 'saved' }

function createInitialQuickPaneState(): QuickPaneState {
  return {
    text: '',
    selectedKind: 'task',
    showTypePicker: getStoredTypePickerPreference(),
    error: null,
    isSaving: false,
  }
}

function quickPaneReducer(
  state: QuickPaneState,
  action: QuickPaneAction
): QuickPaneState {
  if (action.type === 'input-change') {
    return {
      ...state,
      text: action.text,
      selectedKind: action.detectedKind ?? state.selectedKind,
    }
  }

  if (action.type === 'select-kind') {
    return {
      ...state,
      selectedKind: action.kind,
      text: stripLeadingPrefix(state.text),
    }
  }

  if (action.type === 'set-type-picker') {
    return {
      ...state,
      showTypePicker: action.show,
    }
  }

  if (action.type === 'set-error') {
    return {
      ...state,
      error: action.error,
    }
  }

  if (action.type === 'set-saving') {
    return {
      ...state,
      isSaving: action.isSaving,
    }
  }

  return {
    ...state,
    text: '',
    isSaving: false,
  }
}

function preventDefaultFormSubmit(e: React.FormEvent) {
  e.preventDefault()
}

async function createFromIntent(
  intent: CapturePaneIntent,
  openAfterSave: boolean
): Promise<CapturePaneCreatedPayload> {
  const timestamp = nowISO()
  const today = getLocalISODate()

  if (intent.kind === 'task') {
    const { title, description } = splitTitleAndDescription(intent.content)
    const task = unwrapResult(
      await commands.createTask({
        id: newId(),
        title,
        description,
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
    const { title, description } = splitTitleAndDescription(intent.content)
    const event = unwrapResult(
      await commands.createEvent({
        id: newId(),
        title,
        description,
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
    const { title } = splitTitleAndDescription(intent.content)
    const habit = unwrapResult(
      await commands.createHabit({
        id: newId(),
        name: title,
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

  const { title, description } = splitTitleAndDescription(intent.content)
  const task = unwrapResult(
    await commands.createTask({
      id: newId(),
      title,
      description,
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

interface ModePickerProps {
  activeKind: CapturePaneKind
  isSaving: boolean
  onModeSelect: (kind: CapturePaneKind) => void
  t: TFunction
}

function ModePicker({
  activeKind,
  isSaving,
  onModeSelect,
  t,
}: ModePickerProps) {
  return (
    <fieldset className="flex max-w-[294px] shrink-0 flex-wrap items-center gap-1 rounded-full border border-border/55 bg-muted/35 p-1">
      <legend className="sr-only">{t('capturePane.modeLabel')}</legend>
      {CAPTURE_MODES.map(kind => {
        const active = activeKind === kind
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            disabled={isSaving}
            onClick={() => onModeSelect(kind)}
            className={[
              'h-7 rounded-full px-2.5 text-[11px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/80',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              isSaving ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            {t(`capturePane.mode.${kind}`)}
          </button>
        )
      })}
    </fieldset>
  )
}

interface StatusRowProps {
  activeKind: CapturePaneKind
  error: CapturePaneError | null
  isSaving: boolean
  saveAndOpenShortcut: string
  saveShortcut: string
  showTypePicker: boolean
  statusId: string
  statusRef: React.RefObject<HTMLDivElement | null>
  t: TFunction
}

function StatusRow({
  activeKind,
  error,
  isSaving,
  saveAndOpenShortcut,
  saveShortcut,
  showTypePicker,
  statusId,
  statusRef,
  t,
}: StatusRowProps) {
  return (
    <div
      id={statusId}
      ref={statusRef}
      aria-live="polite"
      className="mt-2 flex min-h-6 w-full items-center justify-between gap-3 text-xs text-muted-foreground"
    >
      <div className="min-w-0 truncate">
        {error ? (
          <span role="alert" className="text-destructive">
            {error.prefix
              ? t(error.key, { prefix: error.prefix })
              : t(error.key)}
          </span>
        ) : (
          <span>
            {showTypePicker
              ? t(`capturePane.modeHint.${activeKind}`)
              : t('capturePane.shortcutHint')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isSaving ? (
          <span>{t('capturePane.saving')}</span>
        ) : (
          <>
            <span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                {saveShortcut}
              </kbd>{' '}
              {t('capturePane.hintPrimary')}
            </span>
            <span className="text-border" aria-hidden>
              /
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                {saveAndOpenShortcut}
              </kbd>{' '}
              {t('capturePane.hintSecondary')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default function QuickPaneApp() {
  const { t } = useTranslation()
  const platform = usePlatform()
  const [state, dispatch] = useReducer(
    quickPaneReducer,
    undefined,
    createInitialQuickPaneState
  )
  const formRef = useRef<HTMLFormElement>(null)
  const mainRowRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastPaneHeightRef = useRef<number | null>(null)
  const statusId = 'quick-pane-status'
  const { error, isSaving, selectedKind, showTypePicker, text } = state
  const detectedKind = prefixedKindFromText(text)
  const defaultKind = showTypePicker ? selectedKind : 'task'
  const activeKind = detectedKind ?? defaultKind
  const saveShortcut = formatShortcut(platform, 'Enter')
  const saveAndOpenShortcut = formatShortcut(platform, 'Enter', [
    'mod',
    'shift',
  ])

  useLayoutEffect(() => {
    const form = formRef.current
    const mainRow = mainRowRef.current
    const status = statusRef.current
    const input = inputRef.current
    if (!form || !mainRow || !status || !input) return

    input.style.height = 'auto'
    input.style.height = `${Math.max(TEXTAREA_MIN_HEIGHT, input.scrollHeight)}px`

    const formStyle = window.getComputedStyle(form)
    const statusStyle = window.getComputedStyle(status)
    const verticalPadding =
      Number.parseFloat(formStyle.paddingTop) +
      Number.parseFloat(formStyle.paddingBottom)
    const statusMarginTop = Number.parseFloat(statusStyle.marginTop)
    const paneHeight = Math.ceil(
      Math.max(
        QUICK_PANE_MIN_HEIGHT,
        verticalPadding +
          mainRow.scrollHeight +
          statusMarginTop +
          status.scrollHeight
      )
    )

    if (lastPaneHeightRef.current === paneHeight) return
    lastPaneHeightRef.current = paneHeight

    void getCurrentWindow()
      .setSize(new LogicalSize(QUICK_PANE_WIDTH, paneHeight))
      .catch(error => {
        logger.warn('Failed to resize quick pane to content', { error })
      })
  }, [activeKind, error, isSaving, platform, showTypePicker, text])

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

  const clearError = () => {
    if (error) {
      dispatch({ type: 'set-error', error: null })
    }
  }

  const handleModeSelect = (kind: CapturePaneKind) => {
    dispatch({ type: 'select-kind', kind })
    clearError()
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const toggleTypePicker = () => {
    const next = !showTypePicker
    localStorage.setItem(TYPE_PICKER_STORAGE_KEY, String(next))
    dispatch({ type: 'set-type-picker', show: next })
    clearError()
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const submitCapture = async (openAfterSave: boolean) => {
    if (isSaving) return

    const parsed = parseCapturePaneInput(text, defaultKind)
    if (parsed.status === 'error') {
      dispatch({
        type: 'set-error',
        error: {
          prefix: parsed.prefix ?? null,
          key:
            parsed.reason === 'unknown-prefix'
              ? 'capturePane.error.unknownPrefix'
              : parsed.reason === 'insufficient-content'
                ? 'capturePane.error.insufficientContent'
                : 'capturePane.error.empty',
        },
      })
      return
    }

    dispatch({ type: 'set-saving', isSaving: true })
    dispatch({ type: 'set-error', error: null })

    try {
      const [payload] = await Promise.all([
        createFromIntent(parsed.intent, openAfterSave),
        emit('quick-pane-submit', { text: text.trim() }),
      ])
      await Promise.all([
        emit('capture-pane-created', payload),
        dismissQuickPane(),
      ])
      dispatch({ type: 'saved' })
    } catch (error) {
      logger.error('Failed to persist capture pane entry', { error })
      dispatch({
        type: 'set-error',
        error: {
          key: 'capturePane.error.persistFailed',
          prefix: null,
        },
      })
      dispatch({ type: 'set-saving', isSaving: false })
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={preventDefaultFormSubmit}
      aria-label={t('capturePane.label')}
      aria-busy={isSaving}
      className="flex h-screen w-screen flex-col justify-center overflow-hidden rounded-(--app-corner-radius) border border-transparent bg-background/90 px-4 py-3 shadow-lg backdrop-blur-md transition-[background-color,backdrop-filter] focus-within:bg-background/95"
    >
      <div ref={mainRowRef} className="flex min-w-0 items-start gap-3">
        {showTypePicker ? (
          <ModePicker
            activeKind={activeKind}
            isSaving={isSaving}
            onModeSelect={handleModeSelect}
            t={t}
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <label htmlFor="quick-pane-input" className="sr-only">
            {t('capturePane.inputLabel')}
          </label>
          <textarea
            id="quick-pane-input"
            ref={inputRef}
            rows={2}
            value={text}
            onChange={e => {
              const nextText = e.target.value
              const nextDetectedKind = prefixedKindFromText(nextText)

              dispatch({
                type: 'input-change',
                text: nextText,
                detectedKind: showTypePicker ? nextDetectedKind : null,
              })
              clearError()
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submitCapture(e.shiftKey)
              }
            }}
            aria-describedby={statusId}
            placeholder={t(`capturePane.placeholder.${activeKind}`)}
            className="min-h-16 w-full resize-none overflow-hidden bg-transparent text-base leading-6 text-foreground placeholder:text-muted-foreground outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={isSaving}
          />
        </div>

        <button
          type="button"
          aria-pressed={showTypePicker}
          aria-label={
            showTypePicker
              ? t('capturePane.picker.hide')
              : t('capturePane.picker.show')
          }
          title={
            showTypePicker
              ? t('capturePane.picker.hide')
              : t('capturePane.picker.show')
          }
          disabled={isSaving}
          onClick={toggleTypePicker}
          className={[
            'mt-1 h-7 shrink-0 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/80',
            showTypePicker ? 'bg-muted/45 text-foreground' : '',
            isSaving ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          {showTypePicker
            ? t('capturePane.picker.visible')
            : t('capturePane.picker.compact')}
        </button>
      </div>

      <StatusRow
        activeKind={activeKind}
        error={error}
        isSaving={isSaving}
        saveAndOpenShortcut={saveAndOpenShortcut}
        saveShortcut={saveShortcut}
        showTypePicker={showTypePicker}
        statusId={statusId}
        statusRef={statusRef}
        t={t}
      />
    </form>
  )
}
