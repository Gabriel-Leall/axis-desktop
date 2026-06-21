import { useState } from 'react'
import type { NoteWorkspaceTree } from '@/lib/notes-domain'
import { NotesExplorerTreeItem } from './NotesExplorerTreeItem'
import type { NotesTreeDragItem } from '@/lib/notes-tree-drag-domain'
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
  const activeItem: NotesTreeDragItem | null = null
  const activeDropTarget: string | null = null

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
        <NotesExplorerTreeItem
          key={item.kind === 'folder' ? item.path : item.note.id}
          item={item}
          depth={0}
          selectedNoteId={selectedNoteId}
          collapsedPaths={collapsedPaths}
          workspace={tree.workspace}
          activeItem={activeItem}
          activeDropTarget={activeDropTarget}
          onToggleFolder={toggleFolder}
          onSelectNote={onSelectNote}
          onContextAction={onContextAction}
        />
      ))}
    </div>
  )
}
