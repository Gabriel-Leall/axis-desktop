import { useState, useEffect, useRef } from 'react'
import {
  Editor as ToastEditor,
  Viewer as ToastViewer,
} from '@toast-ui/react-editor'
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
  Archive,
  Inbox,
  RotateCcw,
  Download,
  Upload,
  Copy,
  FolderOpen,
  X,
} from 'lucide-react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { toast } from 'sonner'
import { useNotesStore } from '@/store/notes-store'
import type { NotesWorkspaceView } from '@/store/notes-store'
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

const WORKSPACE_LABEL_KEYS: Record<NotesWorkspaceView, string> = {
  inbox: 'notes.workspace.inbox',
  archive: 'notes.workspace.archive',
  trash: 'notes.workspace.trash',
}

const WORKSPACE_DESCRIPTION_KEYS: Record<NotesWorkspaceView, string> = {
  inbox: 'notes.workspace.inboxDescription',
  archive: 'notes.workspace.archiveDescription',
  trash: 'notes.workspace.trashDescription',
}

const WORKSPACE_OPTIONS: {
  view: NotesWorkspaceView
  icon: typeof Inbox
}[] = [
  { view: 'inbox', icon: Inbox },
  { view: 'archive', icon: Archive },
  { view: 'trash', icon: Trash2 },
]

interface SidebarProps {
  allNotes: Note[]
  notes: Note[]
  selectedNoteId: string | null
  workspaceView: NotesWorkspaceView
  searchQuery: string
  selectedTag: string | null
  onSelectNote: (id: string) => void
  onWorkspaceChange: (view: NotesWorkspaceView) => Promise<void>
  onSelectTag: (tag: string | null) => void
  onCreateNote: () => Promise<void>
  onSearchChange: (q: string) => void
  onClearFilters: () => void
}

function WorkspaceSwitcher({
  workspaceView,
  onWorkspaceChange,
}: {
  workspaceView: NotesWorkspaceView
  onWorkspaceChange: (view: NotesWorkspaceView) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <div className="px-2 pb-2.5">
      <div className="mb-1.5 px-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {t('notes.sidebar.vaultWorkspace')}
      </div>
      <div className="space-y-1">
        {WORKSPACE_OPTIONS.map(option => {
          const Icon = option.icon
          const isActive = workspaceView === option.view

          return (
            <button
              key={option.view}
              type="button"
              onClick={() => {
                if (!isActive) {
                  void onWorkspaceChange(option.view).catch(error => {
                    logger.error(
                      `Failed to change notes workspace: ${String(error)}`
                    )
                  })
                }
              }}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border px-2 py-2 text-start transition-colors',
                isActive
                  ? 'border-border bg-accent text-accent-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-medium">
                  {t(WORKSPACE_LABEL_KEYS[option.view])}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground/75">
                  {t(WORKSPACE_DESCRIPTION_KEYS[option.view])}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SidebarSearch({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const { t } = useTranslation()
  const hasSearch = searchQuery.trim().length > 0

  return (
    <div className="px-2 pb-2.5">
      <div className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border/50 px-2 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <Search className="size-3 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('notes.sidebar.searchPlaceholder')}
          aria-label={t('notes.sidebar.searchPlaceholder')}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {hasSearch && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label={t('notes.sidebar.clearSearch')}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function AllWorkspaceNotesButton({
  count,
  selectedTag,
  workspaceLabel,
  onSelectTag,
}: {
  count: number
  selectedTag: string | null
  workspaceLabel: string
  onSelectTag: (tag: string | null) => void
}) {
  const { t } = useTranslation()

  return (
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
        <span>
          {t('notes.sidebar.allNotesInWorkspace', {
            workspace: workspaceLabel,
          })}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {count}
        </span>
      </button>
    </div>
  )
}

function TagsSection({
  allNotes,
  selectedTag,
  onSelectTag,
}: {
  allNotes: Note[]
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
}) {
  const { t } = useTranslation()
  const [tagsCollapsed, setTagsCollapsed] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const tagCounts = countTags(allNotes)
  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, 8)
  const hasHiddenTags = tagCounts.length > 8

  return (
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
                      <span className="text-muted-foreground/70">{count}</span>
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
  )
}

function SidebarEmptyState({
  workspaceView,
  workspaceLabel,
  searchQuery,
  selectedTag,
  onClearFilters,
}: {
  workspaceView: NotesWorkspaceView
  workspaceLabel: string
  searchQuery: string
  selectedTag: string | null
  onClearFilters: () => void
}) {
  const { t } = useTranslation()
  const hasSearch = searchQuery.trim().length > 0
  const hasActiveFilters = hasSearch || selectedTag !== null

  if (!hasActiveFilters) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t(`notes.empty.${workspaceView}`)}
        <br />
        <span className="text-muted-foreground/70">
          {workspaceView === 'inbox'
            ? t('notes.empty.hint')
            : t('notes.empty.lifecycleHint')}
        </span>
      </div>
    )
  }

  return (
    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
      <p>
        {hasSearch && selectedTag
          ? t('notes.empty.searchAndTagInWorkspace', {
              query: searchQuery,
              tag: selectedTag,
              workspace: workspaceLabel,
            })
          : hasSearch
            ? t('notes.empty.searchInWorkspace', {
                query: searchQuery,
                workspace: workspaceLabel,
              })
            : t('notes.empty.tagInWorkspace', {
                tag: selectedTag,
                workspace: workspaceLabel,
              })}
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-3 rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {t('notes.empty.clearFilters')}
      </button>
    </div>
  )
}

function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
}: {
  notes: Note[]
  selectedNoteId: string | null
  onSelectNote: (id: string) => void
}) {
  const { t } = useTranslation()
  const grouped = groupNotesByDate(notes)

  return (
    <>
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
    </>
  )
}

function Sidebar({
  allNotes,
  notes,
  selectedNoteId,
  workspaceView,
  searchQuery,
  selectedTag,
  onSelectNote,
  onWorkspaceChange,
  onSelectTag,
  onCreateNote,
  onSearchChange,
  onClearFilters,
}: SidebarProps) {
  const { t } = useTranslation()
  const workspaceLabel = t(WORKSPACE_LABEL_KEYS[workspaceView])

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-card text-card-foreground border-r border-border">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-foreground/90">
          {t('notes.sidebar.title')}
        </h2>
        {workspaceView === 'inbox' && (
          <button
            type="button"
            onClick={() => void onCreateNote()}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={t('notes.sidebar.newNote')}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      <WorkspaceSwitcher
        workspaceView={workspaceView}
        onWorkspaceChange={onWorkspaceChange}
      />
      <SidebarSearch
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
      <AllWorkspaceNotesButton
        count={allNotes.length}
        selectedTag={selectedTag}
        workspaceLabel={workspaceLabel}
        onSelectTag={onSelectTag}
      />
      <TagsSection
        allNotes={allNotes}
        selectedTag={selectedTag}
        onSelectTag={onSelectTag}
      />

      <div className="flex-1 overflow-y-auto px-1">
        {notes.length === 0 ? (
          <SidebarEmptyState
            workspaceView={workspaceView}
            workspaceLabel={workspaceLabel}
            searchQuery={searchQuery}
            selectedTag={selectedTag}
            onClearFilters={onClearFilters}
          />
        ) : (
          <NotesList
            notes={notes}
            selectedNoteId={selectedNoteId}
            onSelectNote={onSelectNote}
          />
        )}
      </div>
    </div>
  )
}

function NoteActionsMenu({
  note,
  workspaceView,
  onArchive,
  onMoveToTrash,
  onRestore,
}: {
  note: Note
  workspaceView: NotesWorkspaceView
  onArchive: () => Promise<void>
  onMoveToTrash: () => Promise<void>
  onRestore: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  async function handleExport() {
    const title = getNoteTitle(note.content)
    const path = await save({
      defaultPath: `${title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      await writeTextFile(path, note.content)
    }
    setShowMenu(false)
  }

  async function handleImport() {
    const path = await open({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      const content = await readTextFile(path as string)
      await useNotesStore.getState().createNote(content)
    }
    setShowMenu(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(note.content)
    setShowMenu(false)
  }

  async function handleArchive() {
    await onArchive()
    setShowMenu(false)
    setConfirmDelete(false)
  }

  return (
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
        <div className="absolute end-0 top-full z-10 mt-1 min-w-40 rounded-md border border-border bg-popover py-1 shadow-md">
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
          >
            <Download className="size-3" />
            {t('notes.editor.menu.export')}
          </button>
          {workspaceView === 'inbox' && (
            <button
              type="button"
              onClick={handleImport}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
            >
              <Upload className="size-3" />
              {t('notes.editor.menu.import')}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
          >
            <Copy className="size-3" />
            {t('notes.editor.menu.copy')}
          </button>
          {workspaceView === 'inbox' && (
            <button
              type="button"
              onClick={() => {
                void handleArchive().catch(error => {
                  logger.error(
                    `Failed to archive note from UI: ${String(error)}`
                  )
                })
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
            >
              <Archive className="size-3" />
              {t('notes.editor.menu.archive')}
            </button>
          )}
          {workspaceView !== 'inbox' && (
            <button
              type="button"
              onClick={() => {
                void onRestore()
                  .catch(error => {
                    logger.error(
                      `Failed to restore note from UI: ${String(error)}`
                    )
                  })
                  .finally(() => {
                    setShowMenu(false)
                    setConfirmDelete(false)
                  })
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-popover-foreground hover:bg-accent"
            >
              <RotateCcw className="size-3" />
              {t('notes.editor.menu.restore')}
            </button>
          )}
          {workspaceView !== 'trash' && (
            <>
              <div className="my-1 border-t border-border" />
              {confirmDelete ? (
                <div className="px-3 py-1.5">
                  <p className="mb-1.5 text-[10px] text-destructive">
                    {t('notes.editor.menu.moveToTrashConfirm')}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void onMoveToTrash()
                          .catch(error => {
                            logger.error(
                              `Failed to move note to trash from UI: ${String(error)}`
                            )
                          })
                          .finally(() => {
                            setShowMenu(false)
                            setConfirmDelete(false)
                          })
                      }}
                      className="rounded bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('notes.editor.menu.moveToTrash')}
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
                  {t('notes.editor.menu.moveToTrash')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EditorArea({
  note,
  workspaceView,
  isSaving,
  onArchive,
  onMoveToTrash,
  onRestore,
  onContentChange,
  onOpenVaultFolder,
}: {
  note: Note | null
  workspaceView: NotesWorkspaceView
  isSaving: boolean
  onArchive: () => Promise<void>
  onMoveToTrash: () => Promise<void>
  onRestore: () => Promise<void>
  onContentChange: (noteId: string, content: string) => void
  onOpenVaultFolder: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [titleInput, setTitleInput] = useState(() =>
    note ? parseNoteContent(note.content).title : ''
  )
  const editorRef = useRef<ToastEditor>(null)
  const editorShellRef = useRef<HTMLDivElement>(null)

  function handleEditorChange() {
    if (!note) return
    const bodyMarkdown = editorRef.current?.getInstance().getMarkdown() ?? ''
    onContentChange(note.id, buildNoteContent(titleInput, bodyMarkdown))
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!note || workspaceView !== 'inbox') return
    const nextTitle = event.target.value
    setTitleInput(nextTitle)

    const bodyMarkdown = editorRef.current?.getInstance().getMarkdown() ?? ''
    onContentChange(note.id, buildNoteContent(nextTitle, bodyMarkdown))
  }

  if (!note) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-background px-8 text-muted-foreground">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
            <FolderOpen className="size-5" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('notes.welcome.title')}
          </h2>
          <p className="mt-2 text-sm leading-6">
            {t('notes.welcome.description')}
          </p>
          <button
            type="button"
            onClick={() => void onOpenVaultFolder()}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <FolderOpen className="size-4" />
            {t('notes.welcome.openFolder')}
          </button>
        </div>
      </div>
    )
  }

  const parsed = parseNoteContent(note.content)
  const wordCount = countWords(parsed.body)
  const isReadOnly = workspaceView !== 'inbox'

  return (
    <div
      className="flex h-full flex-1 flex-col bg-background text-foreground"
      data-color-mode="auto"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="text-[10px] text-muted-foreground">
          {relativeDate(note.updated_at)}
        </div>

        <NoteActionsMenu
          note={note}
          workspaceView={workspaceView}
          onArchive={onArchive}
          onMoveToTrash={onMoveToTrash}
          onRestore={onRestore}
        />
      </div>

      <div className="flex-1 overflow-hidden bg-background text-start">
        <div className="max-w-3xl mx-auto w-full h-full text-start">
          <div className="h-full px-8 pt-8 pb-10 font-sans antialiased text-foreground text-start flex flex-col">
            {isReadOnly ? (
              <h1 className="mb-8 text-2xl font-semibold text-foreground">
                {parsed.title || getNoteTitle(note.content)}
              </h1>
            ) : (
              <input
                type="text"
                value={titleInput}
                onChange={handleTitleChange}
                placeholder={t('notes.editor.titlePlaceholder')}
                aria-label={t('notes.editor.titlePlaceholder')}
                spellCheck={false}
                className="mb-8 w-full rounded bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
              />
            )}

            {isReadOnly ? (
              <div className="notes-inline-editor prose prose-sm max-w-none min-h-0 flex-1 overflow-y-auto text-start text-foreground">
                <ToastViewer initialValue={parsed.body} />
              </div>
            ) : (
              <div
                ref={editorShellRef}
                className="notes-inline-editor min-h-0 flex-1 text-start"
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
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          {isReadOnly
            ? t('notes.editor.footer.readonly')
            : t('notes.editor.footer.hint')}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t('notes.editor.footer.words', { count: wordCount })}
          {!isReadOnly && (
            <>
              {' '}
              ·{' '}
              {isSaving
                ? t('notes.editor.footer.saving')
                : t('notes.editor.footer.saved')}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

async function openNotesVaultFolderFromStore() {
  await useNotesStore.getState().openVaultFolder()
}

export function NotesPage({ initialSelectedNoteId }: NotesPageProps) {
  const { t } = useTranslation()
  const notes = useNotesStore(state => state.notes)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const workspaceView = useNotesStore(state => state.workspaceView)
  const searchQuery = useNotesStore(state => state.searchQuery)
  const selectedTag = useNotesStore(state => state.selectedTag)
  const isSaving = useNotesStore(state => state.isSaving)
  const isLoading = useNotesStore(state => state.isLoading)
  const loadNotes = useNotesStore(state => state.loadNotes)
  const setWorkspaceView = useNotesStore(state => state.setWorkspaceView)
  const createNote = useNotesStore(state => state.createNote)
  const updateNote = useNotesStore(state => state.updateNote)
  const deleteNote = useNotesStore(state => state.deleteNote)
  const archiveNote = useNotesStore(state => state.archiveNote)
  const restoreNote = useNotesStore(state => state.restoreNote)
  const selectNote = useNotesStore(state => state.selectNote)
  const setSearchQuery = useNotesStore(state => state.setSearchQuery)
  const setSelectedTag = useNotesStore(state => state.setSelectedTag)
  const filteredNotes = useNotesStore(state => state.filteredNotes)
  const navigateTo = useUIStore(state => state.navigateTo)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler -- Syncs external route data into the notes store; Tasks/Habits use the same page-entry pattern.
    if (initialSelectedNoteId) {
      selectNote(initialSelectedNoteId)
    }
  }, [initialSelectedNoteId, selectNote])

  const displayedNotes = filteredNotes()
  const activeNote = selectedNoteId
    ? (notes.find(note => note.id === selectedNoteId) ?? null)
    : null

  useEffect(() => {
    if (
      selectedNoteId !== null &&
      !displayedNotes.some(note => note.id === selectedNoteId)
    ) {
      selectNote(null)
    }
  }, [displayedNotes, selectedNoteId, selectNote])

  async function handleCreateNote() {
    try {
      setSelectedTag(null)
      await createNote('')
    } catch (error) {
      logger.error(`Failed to create note from UI: ${String(error)}`)
    }
  }

  function handleContentChange(noteId: string, content: string) {
    if (workspaceView !== 'inbox') return
    updateNote(noteId, content)
  }

  function handleClearFilters() {
    setSearchQuery('')
    setSelectedTag(null)
  }

  async function goToWorkspaceNote(
    view: NotesWorkspaceView,
    noteId: string | null
  ) {
    await setWorkspaceView(view)
    if (noteId) {
      selectNote(noteId)
    }
  }

  async function reloadWorkspaceIfVisible(view: NotesWorkspaceView) {
    if (useNotesStore.getState().workspaceView === view) {
      await setWorkspaceView(view)
    }
  }

  function showLifecycleError(error: unknown) {
    toast.error(t('notes.snackbar.actionFailed'), {
      description: String(error),
    })
  }

  async function handleArchiveNote() {
    if (!selectedNoteId) return

    try {
      const archivedId = await archiveNote(selectedNoteId)
      toast.success(t('notes.snackbar.archived'), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            void (async () => {
              await restoreNote(archivedId)
            })().catch(showLifecycleError)
          },
        },
        cancel: {
          label: t('notes.snackbar.viewArchive'),
          onClick: () => {
            void goToWorkspaceNote('archive', archivedId).catch(
              showLifecycleError
            )
          },
        },
      })
    } catch (error) {
      showLifecycleError(error)
      throw error
    }
  }

  async function handleMoveNoteToTrash() {
    if (!selectedNoteId) return

    const sourceView = workspaceView

    try {
      const trashedId = await deleteNote(selectedNoteId)
      toast.success(t('notes.snackbar.movedToTrash'), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            void (async () => {
              const restoredId = await restoreNote(trashedId)
              if (sourceView === 'archive') {
                await archiveNote(restoredId)
                await reloadWorkspaceIfVisible('archive')
              }
            })().catch(showLifecycleError)
          },
        },
        cancel: {
          label: t('notes.snackbar.viewTrash'),
          onClick: () => {
            void goToWorkspaceNote('trash', trashedId).catch(showLifecycleError)
          },
        },
      })
    } catch (error) {
      showLifecycleError(error)
      throw error
    }
  }

  async function handleRestoreNote() {
    if (!selectedNoteId || workspaceView === 'inbox') return

    const sourceView = workspaceView

    try {
      const restoredId = await restoreNote(selectedNoteId)
      toast.success(t('notes.snackbar.restored'), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            void (async () => {
              if (sourceView === 'archive') {
                await archiveNote(restoredId)
                await reloadWorkspaceIfVisible('archive')
              } else {
                await deleteNote(restoredId)
                await reloadWorkspaceIfVisible('trash')
              }
            })().catch(showLifecycleError)
          },
        },
        cancel: {
          label: t('notes.snackbar.goToNote'),
          onClick: () => {
            void goToWorkspaceNote('inbox', restoredId).catch(
              showLifecycleError
            )
          },
        },
      })
    } catch (error) {
      showLifecycleError(error)
      throw error
    }
  }

  async function handleOpenVaultFolder() {
    try {
      await openNotesVaultFolderFromStore()
    } catch (error) {
      toast.error(t('notes.welcome.openFolderFailed'), {
        description: String(error),
      })
    }
  }

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
          workspaceView={workspaceView}
          searchQuery={searchQuery}
          selectedTag={selectedTag}
          onSelectNote={selectNote}
          onWorkspaceChange={setWorkspaceView}
          onSelectTag={setSelectedTag}
          onCreateNote={handleCreateNote}
          onSearchChange={setSearchQuery}
          onClearFilters={handleClearFilters}
        />
        <EditorArea
          key={`${workspaceView}-${activeNote?.id ?? 'no-note-selected'}`}
          note={activeNote}
          workspaceView={workspaceView}
          isSaving={isSaving}
          onArchive={handleArchiveNote}
          onMoveToTrash={handleMoveNoteToTrash}
          onRestore={handleRestoreNote}
          onContentChange={handleContentChange}
          onOpenVaultFolder={handleOpenVaultFolder}
        />
      </div>
    </div>
  )
}
