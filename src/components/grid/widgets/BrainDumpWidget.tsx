import { useState, useEffect, useCallback } from 'react'
import { Brain, ArrowUpRight, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useNotesStore } from '@/store/notes-store'

interface BrainDumpWidgetProps {
  onNavigateToNotes?: (selectedNoteId?: string) => void
}

export function BrainDumpWidget({ onNavigateToNotes }: BrainDumpWidgetProps) {
  const { t } = useTranslation()

  const notes = useNotesStore(state => state.notes)
  const loadNotes = useNotesStore(state => state.loadNotes)
  const createNote = useNotesStore(state => state.createNote)
  const updateNote = useNotesStore(state => state.updateNote)
  const selectNote = useNotesStore(state => state.selectNote)

  const [currentIndex, setCurrentIndex] = useState(0)

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

  const handleCreateNote = useCallback(async () => {
    try {
      const id = await createNote('')
      selectNote(id)
      setCurrentIndex(0)
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

  const handleOpenPage = () => {
    if (currentNote) {
      selectNote(currentNote.id)
      onNavigateToNotes?.(currentNote.id)
    } else {
      onNavigateToNotes?.()
    }
  }

  const handleContentChange = useCallback(
    (content: string) => {
      if (currentNote) {
        updateNote(currentNote.id, content)
      }
    },
    [currentNote, updateNote]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!event.ctrlKey) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        navigateUp()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        navigateDown()
      }
    },
    [navigateUp, navigateDown]
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div
        className="widget-drag-handle flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5"
        style={{ cursor: 'grab' }}
      >
        <Brain className="size-3.5 text-muted-foreground" strokeWidth={2} />
        <span className="flex-1 text-xs font-medium text-muted-foreground select-none">
          {t('widgets.brainDump.title')}
        </span>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={handleOpenPage}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label={t('widgets.brainDump.openNotesAria')}
        >
          <ArrowUpRight className="size-3" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => void handleCreateNote()}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
          aria-label={t('widgets.brainDump.newNoteAria')}
        >
          <Plus className="size-3" />
        </motion.button>
      </div>

      <textarea
        value={currentNote?.content ?? ''}
        onChange={e => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('widgets.brainDump.placeholder')}
        spellCheck={false}
        className="font-sans text-base leading-relaxed h-full w-full resize-none bg-transparent p-4 text-foreground placeholder:text-muted-foreground/60 outline-none"
      />

      <div className="flex shrink-0 items-center justify-between border-t border-border px-3 py-1">
        <span className="text-muted-foreground font-mono text-xs">
          {t('widgets.brainDump.notesCount', { count: notes.length })}
        </span>
        {notes.length > 0 && (
          <span className="text-muted-foreground font-mono text-xs">
            {currentIndex + 1}/{notes.length}
          </span>
        )}
      </div>
    </div>
  )
}
