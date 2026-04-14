import { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, ArrowUpRight, Plus } from 'lucide-react'
import { useNotesStore } from '@/store/notes-store'
import { cn } from '@/lib/utils'

interface BrainDumpWidgetProps {
  onNavigateToNotes?: (selectedNoteId?: string) => void
}

function splitNoteContent(content: string): { title: string; body: string } {
  if (!content.trim()) {
    return { title: '', body: '' }
  }

  const lines = content.split('\n')
  const firstLine = lines[0] ?? ''
  const title = firstLine.startsWith('# ')
    ? firstLine.slice(2).trim()
    : firstLine.trim()
  const body = lines.slice(1).join('\n').replace(/^\n+/, '')

  return { title, body }
}

function composeNoteContent(title: string, body: string): string {
  const trimmedTitle = title.trim()
  const normalizedBody = body.replace(/^\n+/, '')

  if (!trimmedTitle && !normalizedBody.trim()) {
    return ''
  }

  if (!trimmedTitle) {
    return normalizedBody
  }

  if (!normalizedBody.trim()) {
    return `# ${trimmedTitle}`
  }

  return `# ${trimmedTitle}\n\n${normalizedBody}`
}

export function BrainDumpWidget({ onNavigateToNotes }: BrainDumpWidgetProps) {
  const notes = useNotesStore(state => state.notes)
  const loadNotes = useNotesStore(state => state.loadNotes)
  const createNote = useNotesStore(state => state.createNote)
  const updateNote = useNotesStore(state => state.updateNote)
  const selectNote = useNotesStore(state => state.selectNote)
  const isSaving = useNotesStore(state => state.isSaving)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const currentNote = notes[currentIndex] ?? null

  useEffect(() => {
    if (notes.length === 0) {
      setCurrentIndex(0)
      return
    }

    if (currentIndex > notes.length - 1) {
      setCurrentIndex(notes.length - 1)
    }
  }, [currentIndex, notes.length])

  useEffect(() => {
    if (!currentNote) {
      setDraftTitle('')
      setDraftBody('')
      return
    }

    const parsed = splitNoteContent(currentNote.content)
    setDraftTitle(parsed.title)
    setDraftBody(parsed.body)
  }, [currentNote?.id, currentNote?.content])

  const handleContentChange = useCallback(
    (content: string) => {
      if (currentNote) {
        updateNote(currentNote.id, content)
      }
    },
    [currentNote, updateNote]
  )

  const handleCreateNote = useCallback(async () => {
    try {
      const id = await createNote('')
      selectNote(id)
      setCurrentIndex(0)
      setTimeout(() => textareaRef.current?.focus(), 50)
    } catch {
      // Keep widget responsive if create fails.
    }
  }, [createNote, selectNote])

  const navigateUp = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  const navigateDown = useCallback(() => {
    setCurrentIndex(prev => Math.min(notes.length - 1, prev + 1))
  }, [notes.length])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        handleCreateNote()
        return
      }
      if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault()
        navigateUp()
        return
      }
      if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault()
        navigateDown()
        return
      }
    },
    [handleCreateNote, navigateUp, navigateDown]
  )

  const handleOpenPage = () => {
    if (currentNote) {
      selectNote(currentNote.id)
      onNavigateToNotes?.(currentNote.id)
    } else {
      onNavigateToNotes?.()
    }
  }

  const handleTitleChange = useCallback(
    (title: string) => {
      setDraftTitle(title)

      if (!currentNote) {
        return
      }

      handleContentChange(composeNoteContent(title, draftBody))
    },
    [currentNote, draftBody, handleContentChange]
  )

  const handleBodyChange = useCallback(
    (body: string) => {
      setDraftBody(body)

      if (!currentNote) {
        return
      }

      handleContentChange(composeNoteContent(draftTitle, body))
    },
    [currentNote, draftTitle, handleContentChange]
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div
        className="widget-drag-handle flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5"
        style={{ cursor: 'grab' }}
      >
        <Brain className="size-3.5 text-muted-foreground" strokeWidth={2} />
        <span className="flex-1 text-xs font-medium text-muted-foreground select-none">
          Brain Dump
        </span>
        <button
          type="button"
          onClick={handleOpenPage}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="Open notes page"
        >
          <ArrowUpRight className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => void handleCreateNote()}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="New note"
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <input
          type="text"
          value={draftTitle}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Title..."
          className="border-b border-border/60 bg-transparent px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
        <div
          className="relative flex-1 overflow-hidden p-0"
          onClick={() => textareaRef.current?.focus()}
        >
        <textarea
          ref={textareaRef}
          key={currentNote?.id ?? 'empty-body'}
          value={draftBody}
          onChange={e => handleBodyChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Dump it here..."
          className="h-full w-full resize-none bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
        <div
          className={cn(
            'absolute inset-e-2 top-2 size-1.5 rounded-full transition-opacity duration-700',
            isSaving ? 'animate-pulse bg-primary/60 opacity-100' : 'opacity-0'
          )}
        />
      </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
        {notes.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {currentIndex + 1}/{notes.length}
          </span>
        )}
      </div>
    </div>
  )
}
