export type AnnotationAnchorStatus = 'anchored' | 'lost'

export interface AnnotationAnchorSnapshot {
  from: number
  to: number
  quote: string
  prefix: string
  suffix: string
  status: AnnotationAnchorStatus
}

export interface AnnotationTextEdit {
  from: number
  to: number
  insert: string
}

const CONTEXT_CHARS = 32

function clampOffset(value: number, max: number): number {
  return Math.max(0, Math.min(value, max))
}

export function snapshotAnnotationAnchor(
  content: string,
  from: number,
  to: number
): AnnotationAnchorSnapshot {
  const safeFrom = clampOffset(Math.min(from, to), content.length)
  const safeTo = clampOffset(Math.max(from, to), content.length)

  return {
    from: safeFrom,
    to: safeTo,
    quote: content.slice(safeFrom, safeTo),
    prefix: content.slice(Math.max(0, safeFrom - CONTEXT_CHARS), safeFrom),
    suffix: content.slice(safeTo, safeTo + CONTEXT_CHARS),
    status: safeFrom < safeTo ? 'anchored' : 'lost',
  }
}

export function remapAnnotationAnchor(
  anchor: AnnotationAnchorSnapshot,
  edit: AnnotationTextEdit
): AnnotationAnchorSnapshot {
  if (anchor.status === 'lost') return anchor

  const editFrom = Math.min(edit.from, edit.to)
  const editTo = Math.max(edit.from, edit.to)
  const removedLength = editTo - editFrom
  const insertedLength = edit.insert.length
  const delta = insertedLength - removedLength

  if (editTo <= anchor.from) {
    return {
      ...anchor,
      from: anchor.from + delta,
      to: anchor.to + delta,
    }
  }

  if (editFrom >= anchor.to) {
    return anchor
  }

  const nextFrom = Math.min(anchor.from, editFrom)
  const nextTo = Math.max(nextFrom, anchor.to + delta)
  const status = nextFrom < nextTo ? 'anchored' : 'lost'

  return {
    ...anchor,
    from: nextFrom,
    to: nextTo,
    status,
  }
}

function findQuoteMatches(quote: string, content: string): number[] {
  if (!quote) return []

  const matches: number[] = []
  let index = content.indexOf(quote)

  while (index !== -1) {
    matches.push(index)
    index = content.indexOf(quote, index + Math.max(quote.length, 1))
  }

  return matches
}

export function reconcileAnnotationAnchor(
  anchor: AnnotationAnchorSnapshot,
  content: string
): AnnotationAnchorSnapshot {
  const matches = findQuoteMatches(anchor.quote, content)
  const contextMatches = matches.filter(index => {
    const prefixStart = Math.max(0, index - anchor.prefix.length)
    const prefix = content.slice(prefixStart, index)
    const suffix = content.slice(
      index + anchor.quote.length,
      index + anchor.quote.length + anchor.suffix.length
    )

    return prefix.endsWith(anchor.prefix) && suffix.startsWith(anchor.suffix)
  })
  const candidates = contextMatches.length > 0 ? contextMatches : matches

  if (candidates.length !== 1) {
    return {
      ...anchor,
      status: 'lost',
    }
  }

  const from = candidates[0] ?? 0
  return {
    ...anchor,
    from,
    to: from + anchor.quote.length,
    status: 'anchored',
  }
}
