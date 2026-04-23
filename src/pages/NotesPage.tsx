import { useState, useEffect, useCallback, useRef } from 'react'
import { Editor as ToastEditor } from '@toast-ui/react-editor'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Search,
  Tag,
  ChevronDown,
  ChevronRight,
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
  countTags,
  extractNoteTags,
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

function parseNoteContent(content: string): { title: string; body: string } {
  if (!content) {
    return { title: '', body: '' }
  }

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const firstNonEmptyIndex = lines.findIndex(line => line.trim().length > 0)

  if (firstNonEmptyIndex === -1) {
    return { title: '', body: '' }
  }

  const firstLine = lines[firstNonEmptyIndex] ?? ''

  if (firstLine.startsWith('# ')) {
    return {
      title: firstLine.slice(2),
      body: lines
        .filter((_, index) => index !== firstNonEmptyIndex)
        .join('\n')
        .replace(/^\n+/, ''),
    }
  }

  return {
    title: firstLine.trim(),
    body: lines
      .filter((_, index) => index !== firstNonEmptyIndex)
      .join('\n')
      .replace(/^\n+/, ''),
  }
}

function buildNoteContent(title: string, body: string): string {
  const normalizedBody = body.replace(/^\n+/, '')

  if (!title && !normalizedBody.trim()) {
    return ''
  }

  if (!normalizedBody.trim()) {
    return `# ${title}`
  }

  return `# ${title}\n\n${normalizedBody}`
}

const GROUP_LABEL_KEYS: Record<string, string> = {
  today: 'notes.groups.today',
  yesterday: 'notes.groups.yesterday',
  thisWeek: 'notes.groups.thisWeek',
  older: 'notes.groups.older',
}

function Sidebar({
  allNotes,
  notes,
  selectedNoteId,
  searchQuery,
  selectedTag,
  onSelectNote,
  onSelectTag,
  onCreateNote,
  onSearchChange,
}: {
  allNotes: Note[]
  notes: Note[]
  selectedNoteId: string | null
  searchQuery: string
  selectedTag: string | null
  onSelectNote: (id: string) => void
  onSelectTag: (tag: string | null) => void
  onCreateNote: () => Promise<void>
  onSearchChange: (q: string) => void
}) {
  const { t } = useTranslation()
  const [tagsCollapsed, setTagsCollapsed] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const grouped = groupNotesByDate(notes)
  const tagCounts = countTags(allNotes)
  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, 8)
  const hasHiddenTags = tagCounts.length > 8

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-card text-card-foreground border-r border-border">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-foreground/90">
          {t('notes.sidebar.title')}
        </h2>
        <button
          type="button"
          onClick={() => void onCreateNote()}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="New note"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="px-2 pb-2.5">
        <div className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border/50 px-2 py-1.5">
          <Search className="size-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('notes.sidebar.searchPlaceholder')}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => onSelectTag(null)}
          className={cn(
            'flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors',
            selectedTag
              ? 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              : 'border-border bg-accent text-accent-foreground'
          )}
        >
          <span>{t('notes.sidebar.allNotes')}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {allNotes.length}
          </span>
        </button>
      </div>

      <div className="px-2 pb-2.5">
        <button
          type="button"
          onClick={() => setTagsCollapsed(prev => !prev)}
          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/50 hover:text-accent-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <Tag className="size-3" />
            {t('notes.sidebar.tagsTitle')}
          </span>
          {tagsCollapsed ? (
            <ChevronRight className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </button>

        {!tagsCollapsed && (
          <div className="mt-1.5">
            {tagCounts.length === 0 ? (
              <p className="px-2 text-[11px] text-muted-foreground">
                {t('notes.sidebar.tagsEmpty')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {visibleTags.map(({ tag, count }) => {
                    const isSelectedTag = selectedTag === tag
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onSelectTag(isSelectedTag ? null : tag)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors',
                          isSelectedTag
                            ? 'border-border bg-accent text-accent-foreground'
                            : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-accent-foreground'
                        )}
                      >
                        <span>#{tag}</span>
                        <span className="text-muted-foreground/70">
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {hasHiddenTags && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags(prev => !prev)}
                    className="mt-1 px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showAllTags
                      ? t('notes.sidebar.showLessTags')
                      : t('notes.sidebar.showMoreTags', {
                          count: tagCounts.length - visibleTags.length,
                        })}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {notes.length === 0 && searchQuery && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('notes.empty.search', { query: searchQuery })}
          </div>
        )}
        {notes.length === 0 && !searchQuery && selectedTag && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('notes.empty.tag', { tag: selectedTag })}
          </div>
        )}
        {notes.length === 0 && !searchQuery && !selectedTag && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('notes.empty.none')}
            <br />
            <span className="text-muted-foreground/70">
              {t('notes.empty.hint')}
            </span>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.label} className="mb-2">
            <div className="px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
              {t(GROUP_LABEL_KEYS[group.label] ?? 'notes.groups.older')}
            </div>
            {group.notes.map(note => {
              const title = getNoteTitle(note.content)
              const preview = getNotePreview(note.content)
              const tags = extractNoteTags(note.content).slice(0, 2)
              const isSelected = note.id === selectedNoteId

              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-2 text-start transition-colors',
                    isSelected
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <div className="truncate text-sm font-medium">{title}</div>
                  {preview && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground/80">
                      {preview}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <span>{relativeDate(note.updated_at)}</span>
                    <span>·</span>
                    <span>{estimateReadTime(note.content)}</span>
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tags.map(tag => (
                        <span
                          key={`${note.id}-${tag}`}
                          className="rounded-full border border-border/50 bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
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
  onContentChange: (noteId: string, content: string) => void
}) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ToastEditor>(null)
  const editorShellRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!note) {
      setTitleInput('')
      return
    }
    setTitleInput(parseNoteContent(note.content).title)
  }, [note])

  const handleEditorChange = useCallback(() => {
    if (!note) return
    const bodyMarkdown = editorRef.current?.getInstance().getMarkdown() ?? ''
    onContentChange(note.id, buildNoteContent(titleInput, bodyMarkdown))
  }, [note, onContentChange, titleInput])

  const handleTitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!note) return
      const nextTitle = event.target.value
      setTitleInput(nextTitle)

      const bodyMarkdown = editorRef.current?.getInstance().getMarkdown() ?? ''
      onContentChange(note.id, buildNoteContent(nextTitle, bodyMarkdown))
    },
    [note, onContentChange]
  )

  if (!note) {
    return (
      <div className="flex h-full flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">{t('notes.editor.selectPrompt')}</p>
        </div>
      </div>
    )
  }

  const parsed = parseNoteContent(note.content)
  const wordCount = countWords(parsed.body)

  return (
    <div
      className="flex h-full flex-1 flex-col bg-background text-foreground"
      data-color-mode="auto"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="text-[10px] text-muted-foreground">
          {relativeDate(note.updated_at)}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                {t('notes.editor.menu.export')}
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
              >
                <Upload className="size-3" />
                {t('notes.editor.menu.import')}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
              >
                <Copy className="size-3" />
                {t('notes.editor.menu.copy')}
              </button>
              <div className="my-1 border-t border-border" />
              {confirmDelete ? (
                <div className="px-3 py-1.5">
                  <p className="mb-1.5 text-[10px] text-destructive">
                    {t('notes.editor.menu.deleteConfirm')}
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
                      {t('common.delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
                    >
                      {t('common.cancel')}
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
                  {t('notes.editor.menu.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-background text-left">
        <div className="max-w-3xl mx-auto w-full h-full text-left">
          <div className="h-full px-8 pt-8 pb-10 font-sans antialiased text-foreground text-left flex flex-col">
            <input
              type="text"
              value={titleInput}
              onChange={handleTitleChange}
              placeholder={t('notes.editor.titlePlaceholder')}
              spellCheck={false}
              className="w-full bg-transparent outline-none text-2xl font-semibold mb-8 text-foreground placeholder:text-muted-foreground/60"
            />

            <div
              ref={editorShellRef}
              className="notes-inline-editor min-h-0 flex-1 text-left"
            >
              <ToastEditor
                key={note.id}
                ref={editorRef}
                initialValue={parsed.body}
                initialEditType="wysiwyg"
                hideModeSwitch
                height="100%"
                placeholder={t('notes.editor.placeholder')}
                usageStatistics={false}
                toolbarItems={[
                  ['heading', 'bold', 'italic', 'strike'],
                  ['ul', 'ol', 'task', 'quote'],
                  ['link', 'code', 'codeblock'],
                ]}
                onChange={handleEditorChange}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {t('notes.editor.footer.hint')}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t('notes.editor.footer.words', { count: wordCount })} ·{' '}
          {isSaving
            ? t('notes.editor.footer.saving')
            : t('notes.editor.footer.saved')}
        </span>
      </div>
    </div>
  )
}

export function NotesPage({ initialSelectedNoteId }: NotesPageProps) {
  const { t } = useTranslation()
  const notes = useNotesStore(state => state.notes)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const searchQuery = useNotesStore(state => state.searchQuery)
  const selectedTag = useNotesStore(state => state.selectedTag)
  const isSaving = useNotesStore(state => state.isSaving)
  const isLoading = useNotesStore(state => state.isLoading)
  const loadNotes = useNotesStore(state => state.loadNotes)
  const createNote = useNotesStore(state => state.createNote)
  const updateNote = useNotesStore(state => state.updateNote)
  const deleteNote = useNotesStore(state => state.deleteNote)
  const selectNote = useNotesStore(state => state.selectNote)
  const setSearchQuery = useNotesStore(state => state.setSearchQuery)
  const setSelectedTag = useNotesStore(state => state.setSelectedTag)
  const filteredNotes = useNotesStore(state => state.filteredNotes)
  const navigateTo = useUIStore(state => state.navigateTo)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (initialSelectedNoteId) {
      selectNote(initialSelectedNoteId)
    }
  }, [initialSelectedNoteId, selectNote])

  const displayedNotes = filteredNotes()
  const activeNote = selectedNoteId
    ? (notes.find(note => note.id === selectedNoteId) ?? null)
    : null

  useEffect(() => {
    if (displayedNotes.length === 0) {
      if (selectedNoteId !== null) {
        selectNote(null)
      }
      return
    }

    if (
      !selectedNoteId ||
      !displayedNotes.some(note => note.id === selectedNoteId)
    ) {
      const nextNote = displayedNotes[0]
      if (nextNote) {
        selectNote(nextNote.id)
      }
    }
  }, [displayedNotes, selectedNoteId, selectNote])

  const handleCreateNote = useCallback(async () => {
    try {
      setSelectedTag(null)
      await createNote('')
    } catch (error) {
      logger.error(`Failed to create note from UI: ${String(error)}`)
    }
  }, [createNote, setSelectedTag])

  const handleDeleteNote = useCallback(async () => {
    if (!selectedNoteId) return
    try {
      await deleteNote(selectedNoteId)
    } catch (error) {
      logger.error(`Failed to delete note from UI: ${String(error)}`)
    }
  }, [selectedNoteId, deleteNote])

  const handleContentChange = useCallback(
    (noteId: string, content: string) => {
      updateNote(noteId, content)
    },
    [updateNote]
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">
          {t('notes.loading')}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => navigateTo('grid')}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Back to grid"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="w-8" aria-hidden="true" />
      </div>
      <div className="flex flex-1 overflow-hidden bg-background">
        <Sidebar
          allNotes={notes}
          notes={displayedNotes}
          selectedNoteId={selectedNoteId}
          searchQuery={searchQuery}
          selectedTag={selectedTag}
          onSelectNote={selectNote}
          onSelectTag={setSelectedTag}
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
