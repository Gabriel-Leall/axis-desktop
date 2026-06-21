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
  FileText,
  Folder,
  ChevronDown,
  ChevronRight,
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
  Eye,
  Columns2,
  PencilLine,
} from 'lucide-react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { toast } from 'sonner'
import { useNotesStore } from '@/store/notes-store'
import {
  NotesExplorerTree,
  type NotesTreeContextAction,
  type NotesTreeItemRef,
} from '@/components/notes/NotesExplorerTree'
import { useNotesTreeContextActions } from '@/hooks/use-notes-tree-context-actions'
import type { NotesWorkspaceView } from '@/store/notes-store'
import {
  getNoteTitle,
  relativeDate,
  groupNotesByDate,
  countTags,
  countWords,
} from '@/lib/notes-domain'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import type { Note, NoteWorkspaceTree } from '@/lib/notes-domain'

import '@toast-ui/editor/dist/toastui-editor.css'

interface NotesPageProps {
  initialSelectedNoteId?: string
}

type NotesEditorMode = 'edit' | 'preview' | 'split'

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

const WORKSPACE_OPTIONS: {
  view: NotesWorkspaceView
  icon: typeof Inbox
}[] = [
  { view: 'inbox', icon: Inbox },
  { view: 'archive', icon: Archive },
  { view: 'trash', icon: Trash2 },
]

const EDITOR_MODE_OPTIONS: {
  mode: NotesEditorMode
  labelKey: string
  ariaKey: string
  icon: typeof PencilLine
}[] = [
  {
    mode: 'edit',
    labelKey: 'notes.editor.mode.edit',
    ariaKey: 'notes.editor.mode.editAria',
    icon: PencilLine,
  },
  {
    mode: 'preview',
    labelKey: 'notes.editor.mode.preview',
    ariaKey: 'notes.editor.mode.previewAria',
    icon: Eye,
  },
  {
    mode: 'split',
    labelKey: 'notes.editor.mode.split',
    ariaKey: 'notes.editor.mode.splitAria',
    icon: Columns2,
  },
]

interface SidebarProps {
  allNotes: Note[]
  notes: Note[]
  tree: NoteWorkspaceTree | null
  selectedNoteId: string | null
  workspaceView: NotesWorkspaceView
  searchQuery: string
  selectedTag: string | null
  onSelectNote: (id: string) => void
  onWorkspaceChange: (view: NotesWorkspaceView) => Promise<void>
  onSelectTag: (tag: string | null) => void
  onCreateNote: () => Promise<void>
  onContextAction: (
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) => void
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
    <div className="px-2 pb-2">
      <div className="space-y-0.5">
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
                'notes-explorer-row notes-paper-nav-item flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-start transition-colors',
                isActive
                  ? 'is-active border-border text-accent-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs">
                {t(WORKSPACE_LABEL_KEYS[option.view])}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {option.view === 'inbox' ? '·' : ''}
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
      <div className="notes-paper-input flex items-center gap-1.5 rounded-lg border px-2 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
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
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            aria-label={t('notes.sidebar.clearSearch')}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
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
    <div className="border-t border-border/50 px-2 pt-2">
      <button
        type="button"
        onClick={() => setTagsCollapsed(prev => !prev)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-background/55 hover:text-foreground"
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
        <div className="mt-1">
          {tagCounts.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">
              {t('notes.sidebar.tagsEmpty')}
            </p>
          ) : (
            <>
              <div className="space-y-0.5">
                {visibleTags.map(({ tag, count }) => {
                  const isSelectedTag = selectedTag === tag
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onSelectTag(isSelectedTag ? null : tag)}
                      className={cn(
                        'notes-explorer-row flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs transition-colors',
                        isSelectedTag
                          ? 'bg-accent/80 text-accent-foreground'
                          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                      )}
                    >
                      <Tag className="size-3 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">#{tag}</span>
                      <span className="text-[10px] text-muted-foreground/70">
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
      <div className="notes-explorer-empty px-3 py-4 text-xs text-muted-foreground">
        {t(`notes.empty.${workspaceView}`)}
        <span className="mt-1 block text-muted-foreground/70">
          {workspaceView === 'inbox'
            ? t('notes.empty.hint')
            : t('notes.empty.lifecycleHint')}
        </span>
      </div>
    )
  }

  return (
    <div className="notes-explorer-empty px-3 py-4 text-xs text-muted-foreground">
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
          <div className="notes-explorer-group flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
            <ChevronDown className="size-3" />
            <Folder className="size-3" />
            <span>
              {t(GROUP_LABEL_KEYS[group.label] ?? 'notes.groups.older')}
            </span>
          </div>
          {group.notes.map(note => {
            const title = getNoteTitle(note.content)
            const isSelected = note.id === selectedNoteId

            return (
              <button
                key={note.id}
                type="button"
                onClick={() => onSelectNote(note.id)}
                className={cn(
                  'notes-explorer-note notes-paper-note-row flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors',
                  isSelected
                    ? 'is-selected text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground/60">
                  {relativeDate(note.updated_at)}
                </span>
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
  tree,
  selectedNoteId,
  workspaceView,
  searchQuery,
  selectedTag,
  onSelectNote,
  onWorkspaceChange,
  onSelectTag,
  onCreateNote,
  onContextAction,
  onSearchChange,
  onClearFilters,
}: SidebarProps) {
  const { t } = useTranslation()
  const hasActiveFilters = searchQuery.trim().length > 0 || selectedTag !== null

  return (
    <aside className="notes-paper-sidebar notes-explorer flex h-full w-56 shrink-0 flex-col text-card-foreground">
      <div className="notes-explorer-vault flex items-center justify-between px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="notes-explorer-vault-mark flex size-5 shrink-0 items-center justify-center rounded">
              <Folder className="size-3.5" />
            </div>
            <h2 className="truncate text-xs font-semibold text-foreground">
              {t('notes.sidebar.title')}
            </h2>
          </div>
          <p className="mt-1 pl-7 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
            {t('notes.sidebar.vaultWorkspace')}
          </p>
        </div>
        {workspaceView === 'inbox' && (
          <button
            type="button"
            onClick={() => void onCreateNote()}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            aria-label={t('notes.sidebar.newNote')}
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      <SidebarSearch
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
      <WorkspaceSwitcher
        workspaceView={workspaceView}
        onWorkspaceChange={onWorkspaceChange}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
            {t('notes.sidebar.title')}
          </span>
          <span className="text-[10px] text-muted-foreground/65">
            {allNotes.length}
          </span>
        </div>
        {notes.length === 0 ? (
          <SidebarEmptyState
            workspaceView={workspaceView}
            workspaceLabel={t(WORKSPACE_LABEL_KEYS[workspaceView])}
            searchQuery={searchQuery}
            selectedTag={selectedTag}
            onClearFilters={onClearFilters}
          />
        ) : !hasActiveFilters && tree ? (
          <NotesExplorerTree
            tree={tree}
            selectedNoteId={selectedNoteId}
            onSelectNote={onSelectNote}
            onContextAction={onContextAction}
          />
        ) : (
          <NotesList
            notes={notes}
            selectedNoteId={selectedNoteId}
            onSelectNote={onSelectNote}
          />
        )}
      </div>
      <TagsSection
        allNotes={allNotes}
        selectedTag={selectedTag}
        onSelectTag={onSelectTag}
      />
    </aside>
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
        aria-label={t('notes.editor.menu.actions')}
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

function EditorModeSwitcher({
  editorMode,
  onEditorModeChange,
}: {
  editorMode: NotesEditorMode
  onEditorModeChange: (mode: NotesEditorMode) => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="notes-paper-segmented inline-flex items-center rounded-lg p-0.5"
      aria-label={t('notes.editor.mode.label')}
    >
      {EDITOR_MODE_OPTIONS.map(option => {
        const Icon = option.icon
        const isActive = editorMode === option.mode

        return (
          <button
            key={option.mode}
            type="button"
            aria-label={t(option.ariaKey)}
            aria-pressed={isActive}
            onClick={() => onEditorModeChange(option.mode)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              isActive
                ? 'bg-background/85 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3" />
            <span>{t(option.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

function EditorArea({
  note,
  workspaceView,
  editorMode,
  isSaving,
  onArchive,
  onMoveToTrash,
  onRestore,
  onContentChange,
  onOpenVaultFolder,
  onEditorModeChange,
}: {
  note: Note | null
  workspaceView: NotesWorkspaceView
  editorMode: NotesEditorMode
  isSaving: boolean
  onArchive: () => Promise<void>
  onMoveToTrash: () => Promise<void>
  onRestore: () => Promise<void>
  onContentChange: (noteId: string, content: string) => void
  onOpenVaultFolder: () => Promise<void>
  onEditorModeChange: (mode: NotesEditorMode) => void
}) {
  const { t } = useTranslation()
  const editorRef = useRef<ToastEditor>(null)
  const editorShellRef = useRef<HTMLDivElement>(null)

  function handleEditorChange() {
    if (!note) return
    const bodyMarkdown =
      editorRef.current?.getInstance().getMarkdown() ?? parsed.body
    onContentChange(note.id, buildNoteContent(parsed.title, bodyMarkdown))
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!note || workspaceView !== 'inbox') return
    const nextTitle = event.target.value

    const bodyMarkdown =
      editorRef.current?.getInstance().getMarkdown() ?? parsed.body
    onContentChange(note.id, buildNoteContent(nextTitle, bodyMarkdown))
  }

  if (!note) {
    return (
      <div className="notes-paper-editor flex h-full flex-1 items-center justify-center px-8 text-muted-foreground">
        <div className="notes-paper-empty max-w-md text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-border bg-background/70 text-foreground shadow-sm">
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
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
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
  const activeMode: NotesEditorMode = isReadOnly ? 'preview' : editorMode
  const showEditor = activeMode === 'edit' || activeMode === 'split'
  const showPreview = activeMode === 'preview' || activeMode === 'split'

  return (
    <div
      className="notes-paper-editor flex h-full flex-1 flex-col text-foreground"
      data-color-mode="auto"
    >
      <div className="notes-paper-editorbar flex items-center justify-between gap-4 px-4 py-2.5">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {relativeDate(note.updated_at)}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground/70">
            {isReadOnly
              ? t('notes.editor.readonlySurface')
              : t('notes.editor.paperSurface')}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <EditorModeSwitcher
              editorMode={editorMode}
              onEditorModeChange={onEditorModeChange}
            />
          )}
          <NoteActionsMenu
            note={note}
            workspaceView={workspaceView}
            onArchive={onArchive}
            onMoveToTrash={onMoveToTrash}
            onRestore={onRestore}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden text-start">
        <div
          className={cn(
            'mx-auto h-full w-full text-start',
            activeMode === 'split' ? 'max-w-6xl' : 'max-w-3xl'
          )}
        >
          <div className="h-full px-8 pt-8 pb-10 font-sans antialiased text-foreground text-start flex flex-col">
            {isReadOnly ? (
              <h1 className="mb-8 text-2xl font-semibold text-foreground">
                {parsed.title || getNoteTitle(note.content)}
              </h1>
            ) : (
              <input
                type="text"
                value={parsed.title}
                onChange={handleTitleChange}
                placeholder={t('notes.editor.titlePlaceholder')}
                aria-label={t('notes.editor.titlePlaceholder')}
                spellCheck={false}
                className="mb-8 w-full rounded bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
              />
            )}

            <div
              className={cn(
                'notes-paper-writing-grid min-h-0 flex-1',
                activeMode === 'split' && 'is-split'
              )}
            >
              {showEditor && !isReadOnly && (
                <div
                  ref={editorShellRef}
                  className="notes-inline-editor min-h-0 text-start"
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

              {showPreview && (
                <div className="notes-paper-preview notes-inline-editor prose prose-sm max-w-none min-h-0 overflow-y-auto text-start text-foreground">
                  <ToastViewer initialValue={parsed.body} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="notes-paper-statusbar flex items-center justify-between px-4 py-2">
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
  const [editorMode, setEditorMode] = useState<NotesEditorMode>('edit')
  const { contextDialog, onContextAction } = useNotesTreeContextActions()
  const notes = useNotesStore(state => state.notes)
  const selectedNoteId = useNotesStore(state => state.selectedNoteId)
  const workspaceView = useNotesStore(state => state.workspaceView)
  const searchQuery = useNotesStore(state => state.searchQuery)
  const selectedTag = useNotesStore(state => state.selectedTag)
  const tree = useNotesStore(state => state.tree)
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

  const showLifecycleError = (error: unknown) => {
    toast.error(t('notes.snackbar.actionFailed'), {
      description: String(error),
    })
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

  if (isLoading && !tree && notes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">
          {t('notes.loading')}
        </span>
      </div>
    )
  }

  return (
    <div className="notes-paper-workspace flex h-full flex-col">
      <div className="notes-paper-shell flex flex-1 overflow-hidden">
        <Sidebar
          allNotes={notes}
          notes={displayedNotes}
          tree={tree}
          selectedNoteId={selectedNoteId}
          workspaceView={workspaceView}
          searchQuery={searchQuery}
          selectedTag={selectedTag}
          onSelectNote={selectNote}
          onWorkspaceChange={setWorkspaceView}
          onSelectTag={setSelectedTag}
          onCreateNote={handleCreateNote}
          onContextAction={onContextAction}
          onSearchChange={setSearchQuery}
          onClearFilters={handleClearFilters}
        />
        {contextDialog}

        <EditorArea
          note={activeNote}
          workspaceView={workspaceView}
          editorMode={editorMode}
          isSaving={isSaving}
          onArchive={handleArchiveNote}
          onMoveToTrash={handleMoveNoteToTrash}
          onRestore={handleRestoreNote}
          onContentChange={handleContentChange}
          onOpenVaultFolder={handleOpenVaultFolder}
          onEditorModeChange={setEditorMode}
        />
      </div>
    </div>
  )
}
