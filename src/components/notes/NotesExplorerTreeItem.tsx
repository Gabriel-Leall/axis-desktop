import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { useState, type ReactElement } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { NoteTreeItem, NoteWorkspaceTree } from '@/lib/notes-domain'
import type { NotesTreeDragItem } from '@/lib/notes-tree-drag-domain'
import {
  getNotesTreeDragId,
  getNotesTreeFolderDropId,
  type NotesTreeContextAction,
  type NotesTreeItemRef,
} from './notes-tree-types'

export interface NotesExplorerTreeItemProps {
  item: NoteTreeItem
  depth: number
  selectedNoteId: string | null
  collapsedPaths: ReadonlySet<string>
  workspace: NoteWorkspaceTree['workspace']
  activeItem: NotesTreeDragItem | null
  activeDropTarget: string | null
  invalidDropTarget: string | null
  onToggleFolder: (path: string) => void
  onSelectNote: (id: string) => void
  onContextAction?: (
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) => void
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
  onContextAction?: NotesExplorerTreeItemProps['onContextAction']
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  if (!onContextAction) return children
  const dispatchContextAction = onContextAction

  function handleAction(action: NotesTreeContextAction) {
    setIsOpen(false)
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

function getItemRef(item: NoteTreeItem): NotesTreeItemRef {
  return item.kind === 'note'
    ? { kind: 'note', id: item.note.id }
    : { kind: 'folder', path: item.path, name: item.name }
}

function getDragItem(item: NoteTreeItem): NotesTreeDragItem {
  return item.kind === 'note'
    ? { kind: 'note', id: item.note.id }
    : { kind: 'folder', path: item.path }
}

function areSameDragItem(
  first: NotesTreeDragItem | null,
  second: NotesTreeDragItem
): boolean {
  if (!first || first.kind !== second.kind) return false
  if (first.kind === 'note' && second.kind === 'note') {
    return first.id === second.id
  }
  if (first.kind === 'folder' && second.kind === 'folder') {
    return first.path === second.path
  }
  return false
}

export function NotesExplorerTreeItem({
  item,
  depth,
  selectedNoteId,
  collapsedPaths,
  workspace,
  activeItem,
  activeDropTarget,
  invalidDropTarget,
  onToggleFolder,
  onSelectNote,
  onContextAction,
}: NotesExplorerTreeItemProps) {
  const { t } = useTranslation()
  const isInbox = workspace === 'inbox'
  const itemRef = getItemRef(item)
  const dragItem = getDragItem(item)
  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
  } = useDraggable({
    id: getNotesTreeDragId(itemRef),
    data: { item: dragItem },
    disabled: !isInbox,
  })
  const { setNodeRef: setDropNodeRef } = useDroppable({
    id:
      item.kind === 'folder'
        ? getNotesTreeFolderDropId(item.path)
        : getNotesTreeDragId(itemRef),
    data: item.kind === 'folder' ? { path: item.path } : undefined,
    disabled: !isInbox || item.kind !== 'folder',
  })
  const paddingInlineStart = `${depth * 14 + 8}px`
  const isActiveDrag = areSameDragItem(activeItem, dragItem)
  const dropState =
    item.kind === 'folder' && activeItem
      ? activeDropTarget === item.path
        ? 'valid'
        : invalidDropTarget === item.path
          ? 'invalid'
          : undefined
      : undefined

  if (item.kind === 'note') {
    const isSelected = item.note.id === selectedNoteId

    return (
      <TreeItemContextMenu
        item={itemRef}
        workspace={workspace}
        onContextAction={onContextAction}
      >
        <button
          ref={setDragNodeRef}
          type="button"
          onClick={() => onSelectNote(item.note.id)}
          aria-current={isSelected ? 'page' : undefined}
          data-drag-source={isInbox ? 'true' : undefined}
          data-dragging={isActiveDrag ? 'true' : undefined}
          className={cn(
            'notes-explorer-tree-note notes-paper-note-row flex w-full items-center gap-2 rounded-md py-1.5 pe-2 text-start transition-colors',
            isSelected
              ? 'is-selected text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          style={{ paddingInlineStart }}
          {...attributes}
          {...listeners}
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
  const folderAriaLabel =
    dropState === 'invalid'
      ? `${folderAction}. ${t('notes.tree.invalidDestination')}`
      : folderAction

  return (
    <div className="notes-explorer-tree-folder" ref={setDropNodeRef}>
      <TreeItemContextMenu
        item={itemRef}
        workspace={workspace}
        onContextAction={onContextAction}
      >
        <button
          ref={setDragNodeRef}
          type="button"
          onClick={() => onToggleFolder(item.path)}
          aria-expanded={!isCollapsed}
          aria-label={folderAriaLabel}
          data-drag-source={isInbox ? 'true' : undefined}
          data-drop-target={isInbox ? 'true' : undefined}
          data-drop-state={dropState}
          data-dragging={isActiveDrag ? 'true' : undefined}
          className="notes-explorer-tree-folder-row flex w-full items-center gap-1.5 rounded-md py-1.5 pe-2 text-start text-muted-foreground transition-colors hover:bg-background/55 hover:text-foreground"
          style={{ paddingInlineStart }}
          {...attributes}
          {...listeners}
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
          <NotesExplorerTreeItem
            key={child.kind === 'folder' ? child.path : child.note.id}
            item={child}
            depth={depth + 1}
            selectedNoteId={selectedNoteId}
            collapsedPaths={collapsedPaths}
            workspace={workspace}
            activeItem={activeItem}
            activeDropTarget={activeDropTarget}
            invalidDropTarget={invalidDropTarget}
            onToggleFolder={onToggleFolder}
            onSelectNote={onSelectNote}
            onContextAction={onContextAction}
          />
        ))}
    </div>
  )
}
