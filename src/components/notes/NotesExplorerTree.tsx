import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NoteTreeItem, NoteWorkspaceTree } from '@/lib/notes-domain'
import {
  getNotesTreeDropValidation,
  type NotesTreeDragItem,
} from '@/lib/notes-tree-drag-domain'
import { NotesExplorerTreeItem } from './NotesExplorerTreeItem'
import type {
  NotesTreeContextAction,
  NotesTreeItemRef,
} from './notes-tree-types'

export type {
  NotesTreeContextAction,
  NotesTreeItemRef,
} from './notes-tree-types'

interface NotesExplorerTreeProps {
  tree: NoteWorkspaceTree
  selectedNoteId: string | null
  onSelectNote: (id: string) => void
  onContextAction?: (
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) => void
  onMoveItem?: (
    item: NotesTreeItemRef,
    destinationFolder: string
  ) => Promise<void> | void
}

function isNotesTreeDragItem(value: unknown): value is NotesTreeDragItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<NotesTreeDragItem>
  return (
    (item.kind === 'note' && typeof item.id === 'string') ||
    (item.kind === 'folder' && typeof item.path === 'string')
  )
}

function getDropFolderPath(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as { path?: unknown }
  return typeof data.path === 'string' ? data.path : null
}

function getItemLabel(
  items: readonly NoteTreeItem[],
  draggedItem: NotesTreeDragItem,
  untitled: string
): string {
  for (const item of items) {
    if (item.kind === 'note') {
      if (draggedItem.kind === 'note' && item.note.id === draggedItem.id) {
        return item.note.title || untitled
      }
      continue
    }

    if (draggedItem.kind === 'folder' && item.path === draggedItem.path) {
      return item.name
    }

    const nestedLabel = getItemLabel(item.children, draggedItem, untitled)
    if (nestedLabel) return nestedLabel
  }

  return ''
}

export function NotesExplorerTree({
  tree,
  selectedNoteId,
  onSelectNote,
  onContextAction,
  onMoveItem,
}: NotesExplorerTreeProps) {
  const { t } = useTranslation()
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  )
  const [activeItem, setActiveItem] = useState<NotesTreeDragItem | null>(null)
  const [activeLabel, setActiveLabel] = useState('')
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null)
  const [invalidDropTarget, setInvalidDropTarget] = useState<string | null>(
    null
  )
  const [isMoving, setIsMoving] = useState(false)
  const hoverTimerRef = useRef<number | null>(null)
  const hoverTargetRef = useRef<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function clearHoverTimer() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    hoverTargetRef.current = null
  }

  function clearDragState() {
    clearHoverTimer()
    setActiveItem(null)
    setActiveLabel('')
    setActiveDropTarget(null)
    setInvalidDropTarget(null)
  }

  useEffect(() => clearHoverTimer, [])

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

  function scheduleFolderExpansion(path: string) {
    if (
      !collapsedPaths.has(path) ||
      hoverTargetRef.current === path ||
      hoverTimerRef.current !== null
    ) {
      return
    }

    clearHoverTimer()
    hoverTargetRef.current = path
    hoverTimerRef.current = window.setTimeout(() => {
      setCollapsedPaths(previous => {
        if (!previous.has(path)) return previous
        const next = new Set(previous)
        next.delete(path)
        return next
      })
      hoverTimerRef.current = null
    }, 600)
  }

  function handleDragStart(event: DragStartEvent) {
    if (isMoving) return
    const draggedItem = event.active.data.current?.item
    if (!isNotesTreeDragItem(draggedItem)) return

    setActiveItem(draggedItem)
    setActiveLabel(
      getItemLabel(tree.items, draggedItem, t('notes.sidebar.untitled'))
    )
  }

  function handleDragOver(event: DragOverEvent) {
    if (!activeItem) return

    const target = getDropFolderPath(event.over?.data.current)
    const validation = getNotesTreeDropValidation(tree, activeItem, target)
    setActiveDropTarget(validation.valid ? validation.destinationFolder : null)
    setInvalidDropTarget(target && !validation.valid ? target : null)

    if (validation.valid) {
      scheduleFolderExpansion(validation.destinationFolder)
    } else {
      clearHoverTimer()
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const draggedItem = event.active.data.current?.item
    const target = getDropFolderPath(event.over?.data.current)
    const validation =
      isNotesTreeDragItem(draggedItem) && !isMoving
        ? getNotesTreeDropValidation(tree, draggedItem, target)
        : { valid: false as const }

    clearDragState()
    if (!validation.valid || !onMoveItem) return

    setIsMoving(true)
    try {
      await onMoveItem(draggedItem, validation.destinationFolder)
    } catch {
      // The caller reports the localized lifecycle error and restores its snapshot.
    } finally {
      setIsMoving(false)
    }
  }

  return (
    <div className="notes-explorer-tree" data-workspace={tree.workspace}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={clearDragState}
        onDragEnd={event => void handleDragEnd(event)}
      >
        {tree.items.map(item => (
          <NotesExplorerTreeItem
            key={item.kind === 'folder' ? item.path : item.note.id}
            item={item}
            depth={0}
            selectedNoteId={selectedNoteId}
            collapsedPaths={collapsedPaths}
            workspace={tree.workspace}
            activeItem={activeItem}
            activeDropTarget={activeDropTarget}
            invalidDropTarget={invalidDropTarget}
            onToggleFolder={toggleFolder}
            onSelectNote={onSelectNote}
            onContextAction={onContextAction}
          />
        ))}
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div
              aria-label={t('notes.tree.dragging', { item: activeLabel })}
              className="notes-tree-drag-overlay"
              role="status"
            >
              {activeLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
