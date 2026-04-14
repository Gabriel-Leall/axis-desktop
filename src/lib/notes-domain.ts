export type NoteGroup = 'today' | 'yesterday' | 'thisWeek' | 'older'

export interface GroupedNotes {
  label: NoteGroup
  notes: Note[]
}

export interface Note {
  id: string
  content: string
  created_at: string
  updated_at: string
  word_count: number
}

export function getNoteTitle(content: string): string {
  const firstLine = (content.split('\n')[0] ?? '').replace(/^#+\s*/, '').trim()
  return firstLine || 'Untitled'
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
