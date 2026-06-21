import type { NoteTreeItem, NoteWorkspaceTree } from './notes-domain'

export type NotesTreeDragItem =
  | { kind: 'note'; id: string }
  | { kind: 'folder'; path: string }

export type NotesTreeDropValidation =
  | { valid: true; destinationFolder: string }
  | { valid: false }

function parentPath(path: string): string | null {
  const segments = path.split('/')
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('/')
}

function findFolder(
  items: readonly NoteTreeItem[],
  path: string
): Extract<NoteTreeItem, { kind: 'folder' }> | null {
  for (const item of items) {
    if (item.kind !== 'folder') continue
    if (item.path === path) return item

    const child = findFolder(item.children, path)
    if (child) return child
  }

  return null
}

function findNote(
  items: readonly NoteTreeItem[],
  id: string
): Extract<NoteTreeItem, { kind: 'note' }> | null {
  for (const item of items) {
    if (item.kind === 'note') {
      if (item.note.id === id) return item
      continue
    }

    const child = findNote(item.children, id)
    if (child) return child
  }

  return null
}

function itemExists(
  items: readonly NoteTreeItem[],
  item: NotesTreeDragItem
): boolean {
  return item.kind === 'folder'
    ? Boolean(findFolder(items, item.path))
    : Boolean(findNote(items, item.id))
}

export function getNotesTreeDropValidation(
  tree: NoteWorkspaceTree,
  active: NotesTreeDragItem,
  target: NotesTreeDragItem | string | null
): NotesTreeDropValidation {
  if (
    tree.workspace !== 'inbox' ||
    typeof target !== 'string' ||
    !itemExists(tree.items, active) ||
    !findFolder(tree.items, target)
  ) {
    return { valid: false }
  }

  if (active.kind === 'folder') {
    if (
      target === active.path ||
      target.startsWith(active.path + '/') ||
      parentPath(active.path) === target
    ) {
      return { valid: false }
    }
  }

  if (active.kind === 'note') {
    const source = findNote(tree.items, active.id)
    if (source?.note.path && parentPath(source.note.path) === target) {
      return { valid: false }
    }
  }

  return { valid: true, destinationFolder: target }
}

function removeTreeItem(
  items: readonly NoteTreeItem[],
  item: NotesTreeDragItem
): { items: NoteTreeItem[]; removed: NoteTreeItem | null } {
  const nextItems: NoteTreeItem[] = []

  for (const current of items) {
    const shouldRemove =
      (item.kind === 'folder' &&
        current.kind === 'folder' &&
        current.path === item.path) ||
      (item.kind === 'note' &&
        current.kind === 'note' &&
        current.note.id === item.id)

    if (shouldRemove) {
      return {
        items: [...nextItems, ...items.slice(nextItems.length + 1)],
        removed: current,
      }
    }

    if (current.kind === 'folder') {
      const nested = removeTreeItem(current.children, item)
      if (nested.removed) {
        nextItems.push({ ...current, children: nested.items })
        nextItems.push(...items.slice(nextItems.length))
        return { items: nextItems, removed: nested.removed }
      }
    }

    nextItems.push(current)
  }

  return { items: nextItems, removed: null }
}

function moveItemToFolder(
  item: NoteTreeItem,
  destinationFolder: string
): NoteTreeItem {
  if (item.kind === 'note') {
    const filename = item.note.path?.split('/').at(-1)
    return {
      ...item,
      note: {
        ...item.note,
        ...(filename ? { path: destinationFolder + '/' + filename } : {}),
      },
    }
  }

  const folderName = item.path.split('/').at(-1)
  if (!folderName) return item

  const destinationPath = destinationFolder + '/' + folderName

  return {
    ...item,
    path: destinationPath,
    children: item.children.map(child =>
      moveItemToFolder(child, destinationPath)
    ),
  }
}

function insertIntoFolder(
  items: readonly NoteTreeItem[],
  destinationFolder: string,
  item: NoteTreeItem
): NoteTreeItem[] | null {
  let inserted = false
  const nextItems = items.map(current => {
    if (current.kind !== 'folder') return current

    if (current.path === destinationFolder) {
      inserted = true
      return { ...current, children: [...current.children, item] }
    }

    const children = insertIntoFolder(current.children, destinationFolder, item)
    if (!children) return current

    inserted = true
    return { ...current, children }
  })

  return inserted ? nextItems : null
}

export function projectNotesTreeMove(
  tree: NoteWorkspaceTree,
  active: NotesTreeDragItem,
  destinationFolder: string
): NoteWorkspaceTree | null {
  const validation = getNotesTreeDropValidation(tree, active, destinationFolder)
  if (!validation.valid) return null

  const removed = removeTreeItem(tree.items, active)
  if (!removed.removed) return null

  const items = insertIntoFolder(
    removed.items,
    validation.destinationFolder,
    moveItemToFolder(removed.removed, validation.destinationFolder)
  )

  if (!items) return null
  return { ...tree, items }
}
