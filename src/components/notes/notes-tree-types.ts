export type NotesTreeContextAction =
  | 'open-beside'
  | 'create-note'
  | 'create-folder'
  | 'rename-folder'
  | 'move'
  | 'archive'
  | 'trash'
  | 'restore'

export type NotesTreeItemRef =
  | { kind: 'note'; id: string }
  | { kind: 'folder'; path: string; name?: string }

export function getNotesTreeDragId(item: NotesTreeItemRef): string {
  return item.kind === 'note'
    ? `notes-tree:note:${item.id}`
    : `notes-tree:folder:${item.path}`
}

export function getNotesTreeFolderDropId(path: string): string {
  return `notes-tree:folder-drop:${path}`
}
