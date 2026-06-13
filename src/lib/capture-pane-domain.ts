export type CapturePaneKind = 'task' | 'note' | 'event' | 'habit' | 'focus'

export interface CapturePaneIntent {
  kind: CapturePaneKind
  content: string
}

export type CapturePaneParseResult =
  | {
      status: 'ok'
      intent: CapturePaneIntent
    }
  | {
      status: 'error'
      reason: 'empty' | 'unknown-prefix' | 'insufficient-content'
      prefix?: string
    }

const SUPPORTED_PREFIXES: CapturePaneKind[] = [
  'task',
  'note',
  'event',
  'habit',
  'focus',
]

export function parseCapturePaneInput(
  raw: string,
  defaultKind: CapturePaneKind = 'task'
): CapturePaneParseResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { status: 'error', reason: 'empty' }
  }

  const prefixedMatch = trimmed.match(/^([a-zA-Z]+)\s*:\s*([\s\S]*)$/)
  if (!prefixedMatch) {
    return {
      status: 'ok',
      intent: {
        kind: defaultKind,
        content: trimmed,
      },
    }
  }

  const rawPrefix = prefixedMatch[1] ?? ''
  const rawContent = prefixedMatch[2] ?? ''
  const prefix = rawPrefix.toLowerCase()
  const content = rawContent.trim()
  if (!SUPPORTED_PREFIXES.includes(prefix as CapturePaneKind)) {
    return {
      status: 'error',
      reason: 'unknown-prefix',
      prefix,
    }
  }

  if (!content) {
    return {
      status: 'error',
      reason: 'insufficient-content',
      prefix,
    }
  }

  return {
    status: 'ok',
    intent: {
      kind: prefix as CapturePaneKind,
      content,
    },
  }
}

export interface CapturePaneCreatedPayload {
  kind: CapturePaneKind
  id: string | null
  text: string
  openTarget: 'tasks' | 'notes' | 'calendar' | 'habits' | 'pomodoro' | null
}
