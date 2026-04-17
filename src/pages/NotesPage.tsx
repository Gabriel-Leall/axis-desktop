import { useState, useEffect, useCallback, useRef } from 'react'
import { Editor as ToastEditor } from '@toast-ui/react-editor'
import {
  Plus,
  Search,
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Download,
  Upload,
  Copy,
} from 'lucide-react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { useNotesStore } from '@/store/notes-store'
import {
  getNoteTitle,
  getNotePreview,
  estimateReadTime,
  relativeDate,
  groupNotesByDate,
  countWords,
} from '@/lib/notes-domain'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { useUIStore } from '@/store/ui-store'
import type { Note } from '@/lib/notes-domain'

import '@toast-ui/editor/dist/toastui-editor.css'

interface NotesPageProps {
  initialSelectedNoteId?: string
}

const GROUP_LABELS: Record<string, string> = {
  today: 'TODAY',
  yesterday: 'YESTERDAY',
  thisWeek: 'THIS WEEK',
  older: 'OLDER',
}

function Sidebar({
  notes,
  selectedNoteId,
  searchQuery,
  onSelectNote,
  onCreateNote,
  onSearchChange,
}: {
  notes: Note[]
  selectedNoteId: string | null
  searchQuery: string
  onSelectNote: (id: string) => void
  onCreateNote: () => Promise<void>
  onSearchChange: (q: string) => void
}) {
  const grouped = groupNotesByDate(notes)

  return (
    <div className="flex h-full w-55 shrink-0 flex-col border-e border-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Notes</h2>
        <button
          type="button"
          onClick={() => void onCreateNote()}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="New note"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="px-2 pb-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
          <Search className="size-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {notes.length === 0 && searchQuery && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No notes matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}
        {notes.length === 0 && !searchQuery && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No notes yet
            <br />
            <span className="text-muted-foreground/50">
              Press N or click + to start
            </span>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.label} className="mb-2">
            <div className="px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {GROUP_LABELS[group.label] ?? group.label}
            </div>
            {group.notes.map(note => {
              const title = getNoteTitle(note.content)
              const preview = getNotePreview(note.content)
              const isSelected = note.id === selectedNoteId

              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-start transition-colors',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  )}
                >
                  <div className="truncate text-xs font-medium">{title}</div>
                  {preview && (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                      {preview}
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                    <span>{relativeDate(note.updated_at)}</span>
                    <span>·</span>
                    <span>{estimateReadTime(note.content)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function EditorArea({
  note,
  isSaving,
  onDelete,
  onContentChange,
}: {
  note: Note | null
  isSaving: boolean
  onDelete: () => Promise<void>
  onContentChange: (content: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ToastEditor>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setConfirmDelete(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [showMenu])

  const handleExport = useCallback(async () => {
    if (!note) return
    const title = getNoteTitle(note.content)
    const path = await save({
      defaultPath: `${title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      await writeTextFile(path, note.content)
    }
    setShowMenu(false)
  }, [note])

  const handleImport = useCallback(async () => {
    const path = await open({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      const content = await readTextFile(path as string)
      const store = useNotesStore.getState()
      await store.createNote(content)
    }
    setShowMenu(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!note) return
    await navigator.clipboard.writeText(note.content)
    setShowMenu(false)
  }, [note])

  if (!note) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a note or create a new one</p>
        </div>
      </div>
    )
  }

  const wordCount = countWords(note.content)

  const handleEditorChange = useCallback(() => {
    const markdown = editorRef.current?.getInstance().getMarkdown() ?? ''
    onContentChange(markdown)
  }, [onContentChange])

  return (
    <div className="flex h-full flex-1 flex-col" data-color-mode="auto">
      <div className="flex items-center justify-end border-b border-border px-3 py-1">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Note actions"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {showMenu && (
            <div className="absolute inset-e-0 top-full z-10 mt-1 min-w-40 rounded-md border border-border bg-popover py-1 shadow-md">
              <button
                type="button"
                onClick={handleExport}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
              >
                <Download className="size-3" />
                Export as .md
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
              >
                <Upload className="size-3" />
                Import .md
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
              >
                <Copy className="size-3" />
                Copy all
              </button>
              <div className="my-1 border-t border-border" />
              {confirmDelete ? (
                <div className="px-3 py-1.5">
                  <p className="mb-1.5 text-[10px] text-destructive">
                    Delete this note?
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void onDelete()
                          .catch(error => {
                            logger.error(
                              `Failed to delete note from UI: ${String(error)}`
                            )
                          })
                          .finally(() => {
                            setShowMenu(false)
                            setConfirmDelete(false)
                          })
                      }}
                      className="rounded bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-accent"
                >
                  <Trash2 className="size-3" />
                  Delete note
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="notes-inline-editor flex-1 overflow-hidden">
        <ToastEditor
          key={note.id}
          ref={editorRef}
          initialValue={note.content}
          initialEditType="wysiwyg"
          hideModeSwitch
          height="100%"
          placeholder="Start writing..."
          usageStatistics={false}
          toolbarItems={[
            ['heading', 'bold', 'italic', 'strike'],
            ['ul', 'ol', 'task', 'quote'],
            ['link', 'code', 'codeblock'],
          ]}
          onChange={handleEditorChange}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-1">
        <span className="font-mono text-[10px] text-muted-foreground/60">
          Inline WYSIWYG · Markdown · Ctrl/Cmd+B · Ctrl/Cmd+I
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {wordCount} words · {isSaving ? 'Saving...' : 'Saved'}
        </span>
      </div>
    </div>
  )
}

export function NotesPage({ initialSelectedNoteId }: NotesPageProps) {
  const notes = useNotesStore(state => state.notes)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const searchQuery = useNotesStore(state => state.searchQuery)
  const isSaving = useNotesStore(state => state.isSaving)
  const isLoading = useNotesStore(state => state.isLoading)
  const loadNotes = useNotesStore(state => state.loadNotes)
  const createNote = useNotesStore(state => state.createNote)
  const updateNote = useNotesStore(state => state.updateNote)
  const deleteNote = useNotesStore(state => state.deleteNote)
  const selectNote = useNotesStore(state => state.selectNote)
  const setSearchQuery = useNotesStore(state => state.setSearchQuery)
  const navigateTo = useUIStore(state => state.navigateTo)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (initialSelectedNoteId) {
      selectNote(initialSelectedNoteId)
    }
  }, [initialSelectedNoteId, selectNote])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const displayedNotes = normalizedSearch
    ? notes.filter(note => note.content.toLowerCase().includes(normalizedSearch))
    : notes
  const activeNote = selectedNoteId
    ? (notes.find(note => note.id === selectedNoteId) ?? null)
    : null

  const handleCreateNote = useCallback(async () => {
    try {
      await createNote('')
    } catch (error) {
      logger.error(`Failed to create note from UI: ${String(error)}`)
    }
  }, [createNote])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNoteId) return
    try {
      await deleteNote(selectedNoteId)
    } catch (error) {
      logger.error(`Failed to delete note from UI: ${String(error)}`)
    }
  }, [selectedNoteId, deleteNote])

  const handleContentChange = useCallback(
    (content: string) => {
      if (selectedNoteId) {
        updateNote(selectedNoteId, content)
      }
    },
    [selectedNoteId, updateNote]
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading notes...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-3 py-1.5">
        <button
          type="button"
          onClick={() => navigateTo('grid')}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to grid"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="ms-2 text-sm font-semibold text-foreground">Notes</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          notes={displayedNotes}
          selectedNoteId={selectedNoteId}
          searchQuery={searchQuery}
          onSelectNote={selectNote}
          onCreateNote={handleCreateNote}
          onSearchChange={setSearchQuery}
        />
        <EditorArea
          note={activeNote}
          isSaving={isSaving}
          onDelete={handleDeleteNote}
          onContentChange={handleContentChange}
        />
      </div>
    </div>
  )
}
