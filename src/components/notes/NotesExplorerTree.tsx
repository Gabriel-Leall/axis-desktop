import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { NoteTreeItem, NoteWorkspaceTree } from '@/lib/notes-domain'

interface NotesExplorerTreeProps {
  tree: NoteWorkspaceTree
  selectedNoteId: string | null
  onSelectNote: (id: string) => void
}

interface TreeItemProps {
  item: NoteTreeItem
  depth: number
  selectedNoteId: string | null
  collapsedPaths: ReadonlySet<string>
  onToggleFolder: (path: string) => void
  onSelectNote: (id: string) => void
}

function TreeItem({
  item,
  depth,
  selectedNoteId,
  collapsedPaths,
  onToggleFolder,
  onSelectNote,
}: TreeItemProps) {
  const { t } = useTranslation()
  const paddingInlineStart = `${depth * 14 + 8}px`

  if (item.kind === 'note') {
    const isSelected = item.note.id === selectedNoteId

    return (
      <button
        type="button"
        onClick={() => onSelectNote(item.note.id)}
        aria-current={isSelected ? 'page' : undefined}
        className={cn(
          'notes-explorer-tree-note notes-paper-note-row flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-start transition-colors',
          isSelected
            ? 'is-selected text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        style={{ paddingInlineStart }}
      >
        <FileText className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {item.note.title || t('notes.sidebar.untitled')}
        </span>
      </button>
    )
  }

  const isCollapsed = collapsedPaths.has(item.path)
  const folderAction = isCollapsed
    ? t('notes.sidebar.expandFolder', { name: item.name })
    : t('notes.sidebar.collapseFolder', { name: item.name })

  return (
    <div className="notes-explorer-tree-folder">
      <button
        type="button"
        onClick={() => onToggleFolder(item.path)}
        aria-expanded={!isCollapsed}
        aria-label={folderAction}
        className="notes-explorer-tree-folder-row flex w-full items-center gap-1.5 rounded-md py-1.5 pe-2 text-start text-muted-foreground transition-colors hover:bg-background/55 hover:text-foreground"
        style={{ paddingInlineStart }}
      >
        {isCollapsed ? (
          <ChevronRight className="size-3 shrink-0" />
        ) : (
          <ChevronDown className="size-3 shrink-0" />
        )}
        <Folder className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate text-xs font-medium">
          {item.name}
        </span>
      </button>

      {!isCollapsed &&
        item.children.map(child => (
          <TreeItem
            key={child.kind === 'folder' ? child.path : child.note.id}
            item={child}
            depth={depth + 1}
            selectedNoteId={selectedNoteId}
            collapsedPaths={collapsedPaths}
            onToggleFolder={onToggleFolder}
            onSelectNote={onSelectNote}
          />
        ))}
    </div>
  )
}

export function NotesExplorerTree({
  tree,
  selectedNoteId,
  onSelectNote,
}: NotesExplorerTreeProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  )

  function toggleFolder(path: string) {
    setCollapsedPaths(previous => {
      const next = new Set(previous)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <div className="notes-explorer-tree" data-workspace={tree.workspace}>
      {tree.items.map(item => (
        <TreeItem
          key={item.kind === 'folder' ? item.path : item.note.id}
          item={item}
          depth={0}
          selectedNoteId={selectedNoteId}
          collapsedPaths={collapsedPaths}
          onToggleFolder={toggleFolder}
          onSelectNote={onSelectNote}
        />
      ))}
    </div>
  )
}
