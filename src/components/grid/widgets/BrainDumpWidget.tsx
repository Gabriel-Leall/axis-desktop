import { useState, useEffect, useRef, useCallback } from 'react'
import { Editor as ToastEditor } from '@toast-ui/react-editor'
import { Brain, ArrowUpRight, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useNotesStore } from '@/store/notes-store'
import { cn } from '@/lib/utils'

import '@toast-ui/editor/dist/toastui-editor.css'

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
  const editorRef = useRef<ToastEditor>(null)
  const editorShellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const currentNote = notes[currentIndex] ?? null

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    if (notes.length === 0) {
      timeoutId = setTimeout(() => setCurrentIndex(0), 0)
    } else if (currentIndex > notes.length - 1) {
      timeoutId = setTimeout(() => setCurrentIndex(notes.length - 1), 0)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [currentIndex, notes.length])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    if (!currentNote) {
      timeoutId = setTimeout(() => {
        setDraftTitle('')
        setDraftBody('')
      }, 0)
      return () => {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    const parsed = splitNoteContent(currentNote.content)
    timeoutId = setTimeout(() => {
      setDraftTitle(parsed.title)
      setDraftBody(parsed.body)
    }, 0)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [currentNote])

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
      setTimeout(() => {
        editorShellRef.current
          ?.querySelector<HTMLElement>('[contenteditable="true"]')
          ?.focus()
      }, 50)
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

  useEffect(() => {
    const shell = editorShellRef.current
    if (!shell) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void handleCreateNote()
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        navigateUp()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        navigateDown()
      }
    }

    shell.addEventListener('keydown', handleKeyDown, true)
    return () => shell.removeEventListener('keydown', handleKeyDown, true)
  }, [handleCreateNote, navigateDown, navigateUp, currentNote?.id])

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
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={handleOpenPage}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="Open notes page"
        >
          <ArrowUpRight className="size-3" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => void handleCreateNote()}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label="New note"
        >
          <Plus className="size-3" />
        </motion.button>
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
          className="relative flex-1 overflow-hidden p-0 notes-inline-editor"
          ref={editorShellRef}
        >
          <ToastEditor
            key={currentNote?.id ?? 'empty-body'}
            ref={editorRef}
            initialValue={draftBody}
            initialEditType="wysiwyg"
            hideModeSwitch
            height="100%"
            placeholder="Dump it here..."
            usageStatistics={false}
            toolbarItems={[]}
            onChange={() => {
              const markdown =
                editorRef.current?.getInstance().getMarkdown() ?? ''
              handleBodyChange(markdown)
            }}
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
