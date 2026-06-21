import { useState, type ReactElement } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { NoteTreeItem, NoteWorkspaceTree } from '@/lib/notes-domain'

export type NotesTreeContextAction =
  | 'create-folder'
  | 'rename-folder'
  | 'move'
  | 'archive'
  | 'trash'
  | 'restore'

export type NotesTreeItemRef =
  | { kind: 'note'; id: string }
  | { kind: 'folder'; path: string; name?: string }

interface NotesExplorerTreeProps {
  tree: NoteWorkspaceTree
  selectedNoteId: string | null
  onSelectNote: (id: string) => void
  onContextAction?: (
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) => void
}

interface TreeItemProps {
  item: NoteTreeItem
  depth: number
  selectedNoteId: string | null
  collapsedPaths: ReadonlySet<string>
  onToggleFolder: (path: string) => void
  onSelectNote: (id: string) => void
  workspace: NoteWorkspaceTree['workspace']
  onContextAction?: NotesExplorerTreeProps['onContextAction']
}

function TreeItemContextMenu({
  children,
  item,
  workspace,
  onContextAction,
}: {
  children: ReactElement
  item: NotesTreeItemRef
  workspace: NoteWorkspaceTree['workspace']
  onContextAction?: NotesExplorerTreeProps['onContextAction']
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  if (!onContextAction) return children
  const dispatchContextAction = onContextAction

  function handleAction(action: NotesTreeContextAction) {
    setIsOpen(false)
    // Let Radix restore focus from the closed context menu before opening a dialog.
    window.setTimeout(() => dispatchContextAction(action, item), 0)
  }

  const isFolder = item.kind === 'folder'
  const actions: NotesTreeContextAction[] =
    workspace === 'inbox'
      ? [
          ...(isFolder ? (['create-folder', 'rename-folder'] as const) : []),
          'move',
          'archive',
          'trash',
        ]
      : workspace === 'archive'
        ? ['restore', 'trash']
        : ['restore']

  const labels: Record<NotesTreeContextAction, string> = {
    'create-folder': t('notes.contextMenu.newFolder'),
    'rename-folder': t('notes.contextMenu.renameFolder'),
    move: t('notes.contextMenu.move'),
    archive: t('notes.contextMenu.archive'),
    trash: t('notes.editor.menu.moveToTrash'),
    restore: t('notes.editor.menu.restore'),
  }

  return (
    <ContextMenu.Root onOpenChange={setIsOpen} open={isOpen}>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {actions.map(action => (
            <ContextMenu.Item
              key={action}
              onSelect={() => handleAction(action)}
              className={cn(
                'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                action === 'trash' && 'text-destructive'
              )}
            >
              {labels[action]}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function TreeItem({
  item,
  depth,
  selectedNoteId,
  collapsedPaths,
  onToggleFolder,
  onSelectNote,
  workspace,
  onContextAction,
}: TreeItemProps) {
  const { t } = useTranslation()
  const paddingInlineStart = `${depth * 14 + 8}px`

  if (item.kind === 'note') {
    const isSelected = item.note.id === selectedNoteId

    return (
      <TreeItemContextMenu
        item={{ kind: 'note', id: item.note.id }}
        workspace={workspace}
        onContextAction={onContextAction}
      >
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
      </TreeItemContextMenu>
    )
  }

  const isCollapsed = collapsedPaths.has(item.path)
  const folderAction = isCollapsed
    ? t('notes.sidebar.expandFolder', { name: item.name })
    : t('notes.sidebar.collapseFolder', { name: item.name })

  return (
    <div className="notes-explorer-tree-folder">
      <TreeItemContextMenu
        item={{ kind: 'folder', path: item.path, name: item.name }}
        workspace={workspace}
        onContextAction={onContextAction}
      >
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
      </TreeItemContextMenu>

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
            workspace={workspace}
            onContextAction={onContextAction}
          />
        ))}
    </div>
  )
}

export function NotesExplorerTree({
  tree,
  selectedNoteId,
  onSelectNote,
  onContextAction,
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
          workspace={tree.workspace}
          onContextAction={onContextAction}
        />
      ))}
    </div>
  )
}
