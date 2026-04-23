export type NoteGroup = 'today' | 'yesterday' | 'thisWeek' | 'older'

export interface GroupedNotes {
  label: NoteGroup
  notes: Note[]
}

export interface NoteTagCount {
  tag: string
  count: number
}

export interface Note {
  id: string
  content: string
  created_at: string
  updated_at: string
  word_count: number
}

const TAG_PATTERN = /(?:^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]{0,31})/gu

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export function getNoteTitle(content: string): string {
  if (!content) {
    return 'Untitled'
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const firstNonEmptyIndex = lines.findIndex(line => line.trim().length > 0)

  if (firstNonEmptyIndex === -1) {
    return 'Untitled'
  }

  const firstLine = lines[firstNonEmptyIndex] ?? ''

  if (firstLine.startsWith('# ')) {
    const title = firstLine.slice(2).trim()
    return title || 'Untitled'
  }

  return firstLine.trim() || 'Untitled'
}

export function getNotePreview(content: string): string {
  const lines = content.split('\n').filter(l => l.trim())
  return lines.slice(1, 3).join(' ').substring(0, 100) ?? ''
}

export function estimateReadTime(content: string): string {
  const words = content.split(/\s+/).filter(Boolean).length
  const minutes = Math.ceil(words / 200)
  return minutes <= 1 ? '1 min' : `${minutes} min`
}

export function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length
}

export function extractNoteTags(content: string): string[] {
  const tagSet = new Set<string>()
  for (const match of content.matchAll(TAG_PATTERN)) {
    const normalized = normalizeTag(match[1] ?? '')
    if (normalized.length >= 2) {
      tagSet.add(normalized)
    }
  }
  return Array.from(tagSet)
}

export function noteHasTag(note: Note, tag: string): boolean {
  const normalizedTag = normalizeTag(tag)
  if (!normalizedTag) return false
  return extractNoteTags(note.content).includes(normalizedTag)
}

export function countTags(notes: Note[]): NoteTagCount[] {
  const tagCounter = new Map<string, number>()

  for (const note of notes) {
    for (const tag of extractNoteTags(note.content)) {
      tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(tagCounter.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isYesterday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  )
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return date >= startOfWeek
}

export function groupNotesByDate(notes: Note[]): GroupedNotes[] {
  const groups: Record<NoteGroup, Note[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  }

  for (const note of notes) {
    if (isToday(note.updated_at)) {
      groups.today.push(note)
    } else if (isYesterday(note.updated_at)) {
      groups.yesterday.push(note)
    } else if (isThisWeek(note.updated_at)) {
      groups.thisWeek.push(note)
    } else {
      groups.older.push(note)
    }
  }

  const result: GroupedNotes[] = []
  const order: NoteGroup[] = ['today', 'yesterday', 'thisWeek', 'older']
  for (const key of order) {
    if (groups[key].length > 0) {
      result.push({ label: key, notes: groups[key] })
    }
  }

  return result
}

export function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes <= 1) return 'just now'
      return `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
