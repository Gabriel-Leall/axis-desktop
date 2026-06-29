import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands, unwrapResult } from '@/lib/tauri-bindings'
import { countWords, flattenNoteTree, noteHasTag } from '@/lib/notes-domain'
import { logger } from '@/lib/logger'
import type {
  Note as BindingNote,
  NoteTreeItem as BindingNoteTreeItem,
  NoteVaultInfo,
  NoteVaultMigrationMode,
  NoteVaultMigrationResult,
  NoteAnnotation,
  NotesTreeItemRef,
  NoteWorkspaceTree as BindingNoteWorkspaceTree,
} from '@/lib/tauri-bindings'
import type { Note, NoteTreeItem, NoteWorkspaceTree } from '@/lib/notes-domain'

export type NotesWorkspaceView = 'inbox' | 'archive' | 'trash'

interface CreateAnnotationRequest {
  noteId: string
  from: number
  to: number
  text: string
}

interface NotesState {
  vaultInfo: NoteVaultInfo | null
  vaultError: string | null
  pendingMigrationSourcePath: string | null
  workspaceView: NotesWorkspaceView
  tree: NoteWorkspaceTree | null
  notes: Note[]
  searchResults: Note[] | null
  selectedNoteId: string | null
  searchQuery: string
  selectedTag: string | null
  isSaving: boolean
  isLoading: boolean
  isSearching: boolean
  annotations: NoteAnnotation[]
  selectedAnnotationId: string | null
  annotationsPanelOpen: boolean
  isLoadingAnnotations: boolean

  loadNotes: () => Promise<void>
  loadWidgetNotes: () => Promise<void>
  setWorkspaceView: (view: NotesWorkspaceView) => Promise<void>
  loadVaultInfo: () => Promise<NoteVaultInfo | null>
  setVaultPath: (path: string) => Promise<NoteVaultInfo>
  resetVaultPath: () => Promise<NoteVaultInfo>
  migratePendingVault: (
    mode: NoteVaultMigrationMode
  ) => Promise<NoteVaultMigrationResult>
  dismissPendingVaultMigration: () => void
  openVaultFolder: () => Promise<void>
  createNote: (content?: string, folder?: string) => Promise<string>
  createFolder: (parentPath: string, name: string) => Promise<void>
  renameFolder: (path: string, name: string) => Promise<void>
  renameNote: (id: string, title: string) => Promise<void>
  updateNote: (id: string, content: string) => void
  moveTreeItem: (
    item: NotesTreeItemRef,
    destinationFolder: string
  ) => Promise<void>
  archiveTreeItem: (item: NotesTreeItemRef) => Promise<void>
  trashTreeItem: (item: NotesTreeItemRef) => Promise<void>
  restoreTreeItem: (item: NotesTreeItemRef) => Promise<void>
  deleteNote: (id: string) => Promise<string>
  archiveNote: (id: string) => Promise<string>
  restoreNote: (id: string) => Promise<string>
  selectNote: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedTag: (tag: string | null) => void
  loadAnnotations: (noteId: string) => Promise<void>
  createAnnotation: (input: CreateAnnotationRequest) => Promise<NoteAnnotation>
  updateAnnotationText: (
    noteId: string,
    annotationId: string,
    text: string
  ) => Promise<void>
  resolveAnnotation: (noteId: string, annotationId: string) => Promise<void>
  reopenAnnotation: (noteId: string, annotationId: string) => Promise<void>
  deleteAnnotation: (noteId: string, annotationId: string) => Promise<void>
  repositionAnnotation: (
    noteId: string,
    annotationId: string,
    from: number,
    to: number
  ) => Promise<void>
  replaceLocalAnnotations: (annotations: NoteAnnotation[]) => void
  selectAnnotation: (annotationId: string | null) => void
  setAnnotationsPanelOpen: (open: boolean) => void

  filteredNotes: () => Note[]
  selectedNote: () => Note | null
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let debouncedNoteId: string | null = null
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0
let loadNotesInFlight: Promise<void> | null = null
const DEBOUNCE_MS = 800
const SEARCH_DEBOUNCE_MS = 220
const NOTES_LOAD_TIMEOUT_MS = 10_000
const VAULT_LOAD_TIMEOUT_MS = 10_000

function removeNoteFromList(notes: Note[], id: string): Note[] {
  return notes.filter(note => note.id !== id)
}

function removeNoteFromTree(
  tree: NoteWorkspaceTree | null,
  id: string
): NoteWorkspaceTree | null {
  if (!tree) return null

  function removeFromItems(items: NoteTreeItem[]): NoteTreeItem[] {
    const remainingItems: NoteTreeItem[] = []

    for (const item of items) {
      if (item.kind === 'note') {
        if (item.note.id !== id) {
          remainingItems.push(item)
        }
        continue
      }

      const children = removeFromItems(item.children)
      if (children.length > 0) {
        remainingItems.push({ ...item, children })
      }
    }

    return remainingItems
  }

  return { ...tree, items: removeFromItems(tree.items) }
}

function updateNoteInTree(
  tree: NoteWorkspaceTree | null,
  note: Note
): NoteWorkspaceTree | null {
  if (!tree) return null

  function updateItems(items: NoteTreeItem[]): NoteTreeItem[] {
    return items.map(item => {
      if (item.kind === 'note') {
        return item.note.id === note.id ? { ...item, note } : item
      }

      return { ...item, children: updateItems(item.children) }
    })
  }

  return { ...tree, items: updateItems(tree.items) }
}

function prependNoteToTree(
  tree: NoteWorkspaceTree | null,
  note: Note,
  folder?: string
): NoteWorkspaceTree | null {
  if (!tree) return null

  const withoutExisting = flattenNoteTree(tree.items).some(
    existingNote => existingNote.id === note.id
  )
    ? removeNoteFromTree(tree, note.id)
    : tree
  if (!withoutExisting) return null

  if (!folder || folder === 'inbox') {
    return {
      ...withoutExisting,
      items: [{ kind: 'note', note }, ...withoutExisting.items],
    }
  }

  function prependToFolder(items: NoteTreeItem[]): [NoteTreeItem[], boolean] {
    let inserted = false
    const nextItems = items.map(item => {
      if (item.kind !== 'folder') return item
      if (item.path === folder) {
        inserted = true
        return {
          ...item,
          children: [{ kind: 'note' as const, note }, ...item.children],
        }
      }

      const [children, nestedInserted] = prependToFolder(item.children)
      if (nestedInserted) inserted = true
      return nestedInserted ? { ...item, children } : item
    })
    return [nextItems, inserted]
  }

  const [items, inserted] = prependToFolder(withoutExisting.items)
  if (inserted) return { ...withoutExisting, items }

  return {
    ...withoutExisting,
    items: [{ kind: 'note', note }, ...withoutExisting.items],
  }
}

function nextSelectedNoteId(
  previousSelectedNoteId: string | null,
  removedNoteId: string,
  remainingNotes: Note[]
): string | null {
  if (previousSelectedNoteId !== removedNoteId) {
    return previousSelectedNoteId
  }

  return remainingNotes[0]?.id ?? null
}

function cancelPendingSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
  searchRequestId += 1
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise
      .then(value => {
        clearTimeout(timeoutId)
        resolve(value)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

function mapBindingNote(note: BindingNote): Note {
  return {
    id: note.id,
    path: note.path,
    title: note.title,
    content: note.content,
    created_at: note.created_at,
    updated_at: note.updated_at,
    word_count: note.word_count,
    tags: note.tags,
    wiki_links: note.wiki_links,
  }
}

function mapBindingTreeItem(item: BindingNoteTreeItem): NoteTreeItem {
  if (item.kind === 'folder') {
    return {
      kind: 'folder',
      path: item.path,
      name: item.name,
      children: item.children.map(mapBindingTreeItem),
    }
  }

  return {
    kind: 'note',
    note: mapBindingNote(item.note),
  }
}

function mapBindingWorkspaceTree(
  tree: BindingNoteWorkspaceTree
): NoteWorkspaceTree {
  return {
    workspace: tree.workspace,
    items: tree.items.map(mapBindingTreeItem),
  }
}

function noteMatchesQuery(note: Note, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  if (note.content.toLowerCase().includes(normalizedQuery)) {
    return true
  }
  if (note.title?.toLowerCase().includes(normalizedQuery)) {
    return true
  }
  if (note.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))) {
    return true
  }
  return (
    note.wiki_links?.some(link =>
      link.toLowerCase().includes(normalizedQuery)
    ) ?? false
  )
}

function workspaceStateFromNotes(
  notes: Note[],
  selectedNoteId: string | null
): Pick<NotesState, 'notes' | 'selectedNoteId'> {
  return {
    notes,
    selectedNoteId:
      selectedNoteId && notes.some(note => note.id === selectedNoteId)
        ? selectedNoteId
        : (notes[0]?.id ?? null),
  }
}

function resetWorkspaceForVault(
  vaultInfo: NoteVaultInfo,
  tree: NoteWorkspaceTree
): Pick<
  NotesState,
  | 'vaultInfo'
  | 'vaultError'
  | 'workspaceView'
  | 'tree'
  | 'notes'
  | 'selectedNoteId'
  | 'searchQuery'
  | 'searchResults'
  | 'selectedTag'
  | 'isSearching'
> {
  const notes = flattenNoteTree(tree.items)

  return {
    vaultInfo,
    vaultError: null,
    workspaceView: 'inbox',
    tree,
    notes,
    selectedNoteId: notes[0]?.id ?? null,
    searchQuery: '',
    searchResults: null,
    selectedTag: null,
    isSearching: false,
  }
}

async function loadNotesForWorkspace(
  view: NotesWorkspaceView
): Promise<Note[]> {
  const command =
    view === 'archive'
      ? commands.getArchivedNotes()
      : view === 'trash'
        ? commands.getTrashedNotes()
        : commands.getNotes()

  return unwrapResult(
    await withTimeout(
      command,
      NOTES_LOAD_TIMEOUT_MS,
      'Timed out while loading notes (Tauri IPC)'
    )
  ).map(mapBindingNote)
}

async function loadTreeForWorkspace(
  view: NotesWorkspaceView
): Promise<NoteWorkspaceTree> {
  return mapBindingWorkspaceTree(
    unwrapResult(
      await withTimeout(
        commands.getNotesWorkspaceTree(view),
        NOTES_LOAD_TIMEOUT_MS,
        'Timed out while loading notes workspace tree (Tauri IPC)'
      )
    )
  )
}

async function flushPendingSave(notes: Note[]): Promise<boolean> {
  if (!debounceTimer || !debouncedNoteId) {
    return false
  }

  clearTimeout(debounceTimer)
  debounceTimer = null

  const noteId = debouncedNoteId
  debouncedNoteId = null
  const pendingNote = notes.find(note => note.id === noteId)
  if (!pendingNote) {
    return false
  }

  unwrapResult(
    await commands.updateNote({
      id: noteId,
      content: pendingNote.content,
    })
  )
  return true
}

function reconcileSearchResults(
  previousResults: Note[] | null,
  notes: Note[]
): Note[] | null {
  if (!previousResults) return null

  const notesById = new Map(notes.map(note => [note.id, note]))
  return previousResults.flatMap(result => {
    const note = notesById.get(result.id)
    return note ? [note] : []
  })
}

function upsertAnnotation(
  annotations: NoteAnnotation[],
  nextAnnotation: NoteAnnotation
): NoteAnnotation[] {
  const exists = annotations.some(
    annotation => annotation.id === nextAnnotation.id
  )
  if (!exists) {
    return [nextAnnotation, ...annotations]
  }

  return annotations.map(annotation =>
    annotation.id === nextAnnotation.id ? nextAnnotation : annotation
  )
}

export const useNotesStore = create<NotesState>()(
  devtools(
    (set, get) => {
      async function runWorkspaceMutation(
        actionName: string,
        execute: () => Promise<void>
      ) {
        const snapshot = {
          tree: get().tree,
          notes: get().notes,
          searchResults: get().searchResults,
          selectedNoteId: get().selectedNoteId,
        }
        const attemptedPendingSave =
          debounceTimer !== null && debouncedNoteId !== null
        let flushedPendingSave = false

        try {
          flushedPendingSave = await flushPendingSave(snapshot.notes)
          if (flushedPendingSave) {
            set(
              { isSaving: false },
              undefined,
              `${actionName}/flushPendingSave`
            )
          }

          await execute()
          const tree = await loadTreeForWorkspace(get().workspaceView)
          const notes = flattenNoteTree(tree.items)

          set(
            state => ({
              tree,
              notes,
              selectedNoteId: notes.some(
                note => note.id === state.selectedNoteId
              )
                ? state.selectedNoteId
                : null,
              searchResults: reconcileSearchResults(state.searchResults, notes),
            }),
            undefined,
            `${actionName}/done`
          )
        } catch (error) {
          logger.error(`Failed to ${actionName}: ${String(error)}`)
          set(
            {
              ...snapshot,
              isSaving:
                attemptedPendingSave || flushedPendingSave
                  ? false
                  : get().isSaving,
            },
            undefined,
            `${actionName}/rollback`
          )
          throw error
        }
      }

      return {
        vaultInfo: null,
        vaultError: null,
        pendingMigrationSourcePath: null,
        workspaceView: 'inbox',
        tree: null,
        notes: [],
        searchResults: null,
        selectedNoteId: null,
        searchQuery: '',
        selectedTag: null,
        isSaving: false,
        isLoading: false,
        isSearching: false,
        annotations: [],
        selectedAnnotationId: null,
        annotationsPanelOpen: false,
        isLoadingAnnotations: false,

        loadNotes: async () => {
          if (loadNotesInFlight) {
            return loadNotesInFlight
          }

          loadNotesInFlight = (async () => {
            set({ isLoading: true }, undefined, 'loadNotes/start')
            try {
              const currentView = get().workspaceView
              const [vaultResult, tree] = await Promise.all([
                withTimeout(
                  commands.getNotesVaultInfo(),
                  VAULT_LOAD_TIMEOUT_MS,
                  'Timed out while loading notes vault info (Tauri IPC)'
                ),
                loadTreeForWorkspace(currentView),
              ])
              const vaultInfo = unwrapResult(vaultResult)
              const notes = flattenNoteTree(tree.items)

              set(
                state => ({
                  vaultInfo,
                  vaultError: null,
                  tree,
                  ...workspaceStateFromNotes(notes, state.selectedNoteId),
                  searchResults: state.searchQuery.trim()
                    ? reconcileSearchResults(state.searchResults, notes)
                    : null,
                }),
                undefined,
                'loadNotes/done'
              )
            } catch (error) {
              logger.error(`Failed to load notes: ${String(error)}`)
              set({ vaultError: String(error) }, undefined, 'loadNotes/error')
            } finally {
              set({ isLoading: false }, undefined, 'loadNotes/finalize')
              loadNotesInFlight = null
            }
          })()

          return loadNotesInFlight
        },

        loadWidgetNotes: async () => {
          cancelPendingSearch()
          set({ isLoading: true }, undefined, 'loadWidgetNotes/start')

          try {
            const [vaultResult, notes] = await Promise.all([
              withTimeout(
                commands.getNotesVaultInfo(),
                VAULT_LOAD_TIMEOUT_MS,
                'Timed out while loading notes vault info (Tauri IPC)'
              ),
              loadNotesForWorkspace('inbox'),
            ])
            const vaultInfo = unwrapResult(vaultResult)

            set(
              state => ({
                vaultInfo,
                vaultError: null,
                workspaceView: 'inbox',
                tree: null,
                ...workspaceStateFromNotes(notes, state.selectedNoteId),
                searchQuery: '',
                searchResults: null,
                selectedTag: null,
                isSearching: false,
                isLoading: false,
              }),
              undefined,
              'loadWidgetNotes/done'
            )
          } catch (error) {
            logger.error(
              `Failed to load notes widget workspace: ${String(error)}`
            )
            set(
              { vaultError: String(error), isLoading: false },
              undefined,
              'loadWidgetNotes/error'
            )
          }
        },

        setWorkspaceView: async view => {
          cancelPendingSearch()
          set({ isLoading: true }, undefined, 'setWorkspaceView/start')

          try {
            const tree = await loadTreeForWorkspace(view)
            const notes = flattenNoteTree(tree.items)

            set(
              {
                workspaceView: view,
                tree,
                notes,
                selectedNoteId: null,
                searchResults: null,
                isSearching: false,
                isLoading: false,
              },
              undefined,
              'setWorkspaceView/done'
            )
          } catch (error) {
            logger.error(`Failed to load notes workspace: ${String(error)}`)
            set(
              { vaultError: String(error), isLoading: false },
              undefined,
              'setWorkspaceView/error'
            )
            throw error
          }
        },

        loadVaultInfo: async () => {
          try {
            const vaultInfo = unwrapResult(await commands.getNotesVaultInfo())
            set(
              { vaultInfo, vaultError: null },
              undefined,
              'loadVaultInfo/done'
            )
            return vaultInfo
          } catch (error) {
            logger.error(`Failed to load notes vault info: ${String(error)}`)
            set(
              { vaultInfo: null, vaultError: String(error) },
              undefined,
              'loadVaultInfo/error'
            )
            throw error
          }
        },

        setVaultPath: async path => {
          cancelPendingSearch()
          set({ isLoading: true }, undefined, 'setVaultPath/start')
          const previousVaultPath = get().vaultInfo?.path ?? null
          let vaultChanged = false
          let nextVaultInfo: NoteVaultInfo | null = null

          try {
            const flushedPendingSave = await flushPendingSave(get().notes)
            if (flushedPendingSave) {
              set(
                { isSaving: false },
                undefined,
                'setVaultPath/flushPendingSave'
              )
            }

            const vaultInfo = unwrapResult(
              await commands.setNotesVaultPath(path)
            )
            nextVaultInfo = vaultInfo
            vaultChanged = true
            const tree = await loadTreeForWorkspace('inbox')

            set(
              {
                ...resetWorkspaceForVault(vaultInfo, tree),
                pendingMigrationSourcePath:
                  previousVaultPath && previousVaultPath !== vaultInfo.path
                    ? previousVaultPath
                    : null,
                isLoading: false,
              },
              undefined,
              'setVaultPath/done'
            )

            return vaultInfo
          } catch (error) {
            logger.error(`Failed to set notes vault path: ${String(error)}`)
            set(
              vaultChanged
                ? {
                    vaultInfo: nextVaultInfo,
                    vaultError: String(error),
                    tree: null,
                    notes: [],
                    selectedNoteId: null,
                    searchQuery: '',
                    searchResults: null,
                    selectedTag: null,
                    isSearching: false,
                    pendingMigrationSourcePath:
                      previousVaultPath &&
                      nextVaultInfo &&
                      previousVaultPath !== nextVaultInfo.path
                        ? previousVaultPath
                        : null,
                    isLoading: false,
                  }
                : {
                    vaultError: String(error),
                    isLoading: false,
                  },
              undefined,
              'setVaultPath/error'
            )
            throw error
          }
        },

        resetVaultPath: async () => {
          cancelPendingSearch()
          set({ isLoading: true }, undefined, 'resetVaultPath/start')
          const previousVaultPath = get().vaultInfo?.path ?? null
          let vaultChanged = false
          let nextVaultInfo: NoteVaultInfo | null = null

          try {
            const flushedPendingSave = await flushPendingSave(get().notes)
            if (flushedPendingSave) {
              set(
                { isSaving: false },
                undefined,
                'resetVaultPath/flushPendingSave'
              )
            }

            const vaultInfo = unwrapResult(await commands.resetNotesVaultPath())
            nextVaultInfo = vaultInfo
            vaultChanged = true
            const tree = await loadTreeForWorkspace('inbox')

            set(
              {
                ...resetWorkspaceForVault(vaultInfo, tree),
                pendingMigrationSourcePath:
                  previousVaultPath && previousVaultPath !== vaultInfo.path
                    ? previousVaultPath
                    : null,
                isLoading: false,
              },
              undefined,
              'resetVaultPath/done'
            )

            return vaultInfo
          } catch (error) {
            logger.error(`Failed to reset notes vault path: ${String(error)}`)
            set(
              vaultChanged
                ? {
                    vaultInfo: nextVaultInfo,
                    vaultError: String(error),
                    tree: null,
                    notes: [],
                    selectedNoteId: null,
                    searchQuery: '',
                    searchResults: null,
                    selectedTag: null,
                    isSearching: false,
                    pendingMigrationSourcePath:
                      previousVaultPath &&
                      nextVaultInfo &&
                      previousVaultPath !== nextVaultInfo.path
                        ? previousVaultPath
                        : null,
                    isLoading: false,
                  }
                : {
                    vaultError: String(error),
                    isLoading: false,
                  },
              undefined,
              'resetVaultPath/error'
            )
            throw error
          }
        },

        migratePendingVault: async mode => {
          const sourcePath = get().pendingMigrationSourcePath
          if (!sourcePath) {
            throw new Error('No pending notes vault migration source')
          }

          cancelPendingSearch()
          set({ isLoading: true }, undefined, 'migratePendingVault/start')

          try {
            const result = unwrapResult(
              await commands.migrateNotesVault({
                source_path: sourcePath,
                mode,
              })
            )
            const [vaultResult, tree] = await Promise.all([
              withTimeout(
                commands.getNotesVaultInfo(),
                VAULT_LOAD_TIMEOUT_MS,
                'Timed out while loading notes vault info (Tauri IPC)'
              ),
              loadTreeForWorkspace('inbox'),
            ])
            const vaultInfo = unwrapResult(vaultResult)

            set(
              {
                ...resetWorkspaceForVault(vaultInfo, tree),
                pendingMigrationSourcePath: null,
                isLoading: false,
              },
              undefined,
              'migratePendingVault/done'
            )

            return result
          } catch (error) {
            logger.error(`Failed to migrate notes vault: ${String(error)}`)
            set(
              { vaultError: String(error), isLoading: false },
              undefined,
              'migratePendingVault/error'
            )
            throw error
          }
        },

        dismissPendingVaultMigration: () =>
          set(
            { pendingMigrationSourcePath: null },
            undefined,
            'dismissPendingVaultMigration'
          ),

        openVaultFolder: async () => {
          try {
            unwrapResult(await commands.openNotesVaultFolder())
          } catch (error) {
            logger.error(`Failed to open notes vault folder: ${String(error)}`)
            throw error
          }
        },

        createNote: async (content = '', folder) => {
          set({ isSaving: true }, undefined, 'createNote/start')

          try {
            const currentView = get().workspaceView
            const createdNote = mapBindingNote(
              unwrapResult(
                await commands.createNote({
                  title: null,
                  content,
                  folder: folder ?? null,
                })
              )
            )
            const currentTree =
              currentView === 'inbox'
                ? get().tree
                : await loadTreeForWorkspace('inbox').catch(error => {
                    logger.error(
                      `Failed to reload inbox tree after create: ${String(error)}`
                    )
                    return null
                  })
            const inboxTree = prependNoteToTree(
              currentTree,
              createdNote,
              folder
            ) ?? {
              workspace: 'inbox' as const,
              items: [{ kind: 'note' as const, note: createdNote }],
            }
            const inboxNotes = flattenNoteTree(inboxTree.items)

            set(
              {
                workspaceView: 'inbox',
                tree: inboxTree,
                notes: inboxNotes,
                selectedNoteId: createdNote.id,
                searchQuery: '',
                searchResults: null,
                selectedTag: null,
                isSaving: false,
              },
              undefined,
              'createNote/done'
            )

            return createdNote.id
          } catch (error) {
            logger.error(`Failed to create note: ${String(error)}`)
            set({ isSaving: false }, undefined, 'createNote/error')
            throw error
          }
        },

        createFolder: (parentPath, name) =>
          runWorkspaceMutation('createFolder', async () => {
            unwrapResult(
              await commands.createNotesFolder({
                parent_path: parentPath,
                name,
              })
            )
          }),

        renameFolder: (path, name) =>
          runWorkspaceMutation('renameFolder', async () => {
            unwrapResult(await commands.renameNotesFolder({ path, name }))
          }),

        renameNote: async (id, title) => {
          try {
            const flushedPendingSave = await flushPendingSave(get().notes)
            if (flushedPendingSave) {
              set({ isSaving: false }, undefined, 'renameNote/flushPendingSave')
            }

            const renamedNote = mapBindingNote(
              unwrapResult(await commands.renameNote({ id, title }))
            )

            set(
              state => ({
                notes: state.notes.map(note =>
                  note.id === id ? renamedNote : note
                ),
                tree: updateNoteInTree(state.tree, renamedNote),
                searchResults:
                  state.searchResults?.map(note =>
                    note.id === id ? renamedNote : note
                  ) ?? null,
              }),
              undefined,
              'renameNote/done'
            )
          } catch (error) {
            logger.error(`Failed to rename note: ${String(error)}`)
            await get().loadNotes()
            throw error
          }
        },

        updateNote: (id, content) => {
          const wordCount = countWords(content)
          const updatedAt = new Date().toISOString()

          if (!get().notes.some(note => note.id === id)) {
            return
          }

          set(
            state => ({
              notes: state.notes.map(n =>
                n.id === id
                  ? {
                      ...n,
                      content,
                      word_count: wordCount,
                      updated_at: updatedAt,
                    }
                  : n
              ),
              tree: updateNoteInTree(state.tree, {
                ...(state.notes.find(note => note.id === id) ?? {
                  id,
                  content,
                  created_at: updatedAt,
                  updated_at: updatedAt,
                  word_count: wordCount,
                }),
                content,
                word_count: wordCount,
                updated_at: updatedAt,
              }),
              isSaving: true,
            }),
            undefined,
            'updateNote/optimistic'
          )

          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }

          debouncedNoteId = id
          debounceTimer = setTimeout(async () => {
            try {
              const savedNote = mapBindingNote(
                unwrapResult(
                  await commands.updateNote({
                    id,
                    content,
                  })
                )
              )
              const syncedAnnotations: NoteAnnotation[] = []
              for (const annotation of get().annotations) {
                if (
                  annotation.note_id !== id ||
                  annotation.anchor_status !== 'anchored' ||
                  annotation.from >= annotation.to
                ) {
                  continue
                }

                try {
                  syncedAnnotations.push(
                    unwrapResult(
                      await commands.repositionNoteAnnotation({
                        note_id: id,
                        annotation_id: annotation.id,
                        from: annotation.from,
                        to: annotation.to,
                      })
                    )
                  )
                } catch (error) {
                  logger.error(
                    `Failed to sync note annotation anchor: ${String(error)}`
                  )
                }
              }

              set(
                state => ({
                  notes: state.notes.map(note =>
                    note.id === savedNote.id ? savedNote : note
                  ),
                  tree: updateNoteInTree(state.tree, savedNote),
                  annotations: syncedAnnotations.reduce(
                    (annotations, annotation) =>
                      upsertAnnotation(annotations, annotation),
                    state.annotations
                  ),
                  isSaving: false,
                }),
                undefined,
                'updateNote/saved'
              )
            } catch (error) {
              logger.error(`Failed to update note: ${String(error)}`)
              set({ isSaving: false }, undefined, 'updateNote/error')
              await get().loadNotes()
            } finally {
              debounceTimer = null
              debouncedNoteId = null
            }
          }, DEBOUNCE_MS)
        },

        archiveTreeItem: item =>
          runWorkspaceMutation('archiveTreeItem', async () => {
            unwrapResult(await commands.archiveNotesTreeItem(item))
          }),

        moveTreeItem: (item, destinationFolder) =>
          runWorkspaceMutation('moveTreeItem', async () => {
            unwrapResult(
              await commands.moveNotesTreeItem({
                item,
                destination_folder: destinationFolder,
              })
            )
          }),

        trashTreeItem: item =>
          runWorkspaceMutation('trashTreeItem', async () => {
            unwrapResult(await commands.trashNotesTreeItem(item))
          }),

        restoreTreeItem: item =>
          runWorkspaceMutation('restoreTreeItem', async () => {
            unwrapResult(await commands.restoreNotesTreeItem(item))
          }),

        deleteNote: async id => {
          const snapshot = {
            tree: get().tree,
            notes: get().notes,
            searchResults: get().searchResults,
            selectedNoteId: get().selectedNoteId,
          }
          const pendingNote = snapshot.notes.find(note => note.id === id)
          const shouldFlushPendingSave =
            Boolean(debounceTimer) &&
            debouncedNoteId === id &&
            Boolean(pendingNote)

          try {
            if (shouldFlushPendingSave && pendingNote && debounceTimer) {
              clearTimeout(debounceTimer)
              debounceTimer = null
              debouncedNoteId = null
              unwrapResult(
                await commands.updateNote({
                  id,
                  content: pendingNote.content,
                })
              )
              set({ isSaving: false }, undefined, 'deleteNote/flushPendingSave')
            }

            set(
              state => ({
                notes: removeNoteFromList(state.notes, id),
                tree: removeNoteFromTree(state.tree, id),
                searchResults: state.searchResults
                  ? removeNoteFromList(state.searchResults, id)
                  : null,
                selectedNoteId: nextSelectedNoteId(
                  state.selectedNoteId,
                  id,
                  removeNoteFromList(state.notes, id)
                ),
              }),
              undefined,
              'deleteNote/optimistic'
            )
            const trashedNote = mapBindingNote(
              unwrapResult(await commands.deleteNote(id))
            )
            return trashedNote.id
          } catch (error) {
            logger.error(`Failed to delete note: ${String(error)}`)
            set(
              {
                ...snapshot,
                isSaving: shouldFlushPendingSave ? false : get().isSaving,
              },
              undefined,
              'deleteNote/rollback'
            )
            throw error
          }
        },

        archiveNote: async id => {
          const snapshot = {
            tree: get().tree,
            notes: get().notes,
            searchResults: get().searchResults,
            selectedNoteId: get().selectedNoteId,
          }
          const pendingNote = snapshot.notes.find(note => note.id === id)
          const shouldFlushPendingSave =
            Boolean(debounceTimer) &&
            debouncedNoteId === id &&
            Boolean(pendingNote)

          try {
            if (shouldFlushPendingSave && pendingNote && debounceTimer) {
              clearTimeout(debounceTimer)
              debounceTimer = null
              debouncedNoteId = null
              unwrapResult(
                await commands.updateNote({
                  id,
                  content: pendingNote.content,
                })
              )
              set(
                { isSaving: false },
                undefined,
                'archiveNote/flushPendingSave'
              )
            }

            set(
              state => ({
                notes: removeNoteFromList(state.notes, id),
                tree: removeNoteFromTree(state.tree, id),
                searchResults: state.searchResults
                  ? removeNoteFromList(state.searchResults, id)
                  : null,
                selectedNoteId: nextSelectedNoteId(
                  state.selectedNoteId,
                  id,
                  removeNoteFromList(state.notes, id)
                ),
              }),
              undefined,
              'archiveNote/optimistic'
            )
            const archivedNote = mapBindingNote(
              unwrapResult(await commands.archiveNote(id))
            )
            return archivedNote.id
          } catch (error) {
            logger.error(`Failed to archive note: ${String(error)}`)
            set(
              {
                ...snapshot,
                isSaving: shouldFlushPendingSave ? false : get().isSaving,
              },
              undefined,
              'archiveNote/rollback'
            )
            throw error
          }
        },

        restoreNote: async id => {
          try {
            const currentView = get().workspaceView
            cancelPendingSearch()
            const restoredNote = mapBindingNote(
              unwrapResult(await commands.restoreNote(id))
            )

            set(
              state => ({
                notes:
                  currentView === 'inbox'
                    ? [
                        restoredNote,
                        ...state.notes.filter(
                          note => note.id !== restoredNote.id
                        ),
                      ]
                    : removeNoteFromList(state.notes, id),
                tree:
                  currentView === 'inbox'
                    ? prependNoteToTree(state.tree, restoredNote)
                    : removeNoteFromTree(state.tree, id),
                selectedNoteId:
                  currentView === 'inbox' ? restoredNote.id : null,
                searchResults: null,
                isSearching: false,
              }),
              undefined,
              'restoreNote/done'
            )

            return restoredNote.id
          } catch (error) {
            logger.error(`Failed to restore note: ${String(error)}`)
            throw error
          }
        },

        selectNote: id =>
          set(
            {
              selectedNoteId: id,
              annotations: [],
              selectedAnnotationId: null,
              annotationsPanelOpen: false,
              isLoadingAnnotations: false,
            },
            undefined,
            'selectNote'
          ),

        setSearchQuery: query => {
          const trimmedQuery = query.trim()
          set({ searchQuery: query }, undefined, 'setSearchQuery')

          cancelPendingSearch()

          if (get().workspaceView !== 'inbox') {
            set(
              { searchResults: null, isSearching: false },
              undefined,
              'searchNotes/localWorkspace'
            )
            return
          }

          if (!trimmedQuery) {
            set(
              { searchResults: null, isSearching: false },
              undefined,
              'searchNotes/reset'
            )
            return
          }

          set({ isSearching: true }, undefined, 'searchNotes/start')
          const currentRequestId = ++searchRequestId

          searchDebounceTimer = setTimeout(async () => {
            try {
              const result = unwrapResult(
                await commands.searchNotes(trimmedQuery)
              ).map(mapBindingNote)

              if (currentRequestId !== searchRequestId) {
                return
              }

              set(
                { searchResults: result, isSearching: false },
                undefined,
                'searchNotes/done'
              )
            } catch (error) {
              logger.error(`Failed to search notes: ${String(error)}`)
              if (currentRequestId !== searchRequestId) {
                return
              }

              set(
                { searchResults: [], isSearching: false },
                undefined,
                'searchNotes/error'
              )
            }
          }, SEARCH_DEBOUNCE_MS)
        },

        setSelectedTag: tag =>
          set({ selectedTag: tag }, undefined, 'setSelectedTag'),

        loadAnnotations: async noteId => {
          set(
            { isLoadingAnnotations: true },
            undefined,
            'loadAnnotations/start'
          )

          try {
            const annotations = unwrapResult(
              await commands.listNoteAnnotations(noteId)
            )
            set(
              {
                annotations,
                selectedAnnotationId: null,
                isLoadingAnnotations: false,
              },
              undefined,
              'loadAnnotations/done'
            )
          } catch (error) {
            logger.error(`Failed to load note annotations: ${String(error)}`)
            set(
              { annotations: [], isLoadingAnnotations: false },
              undefined,
              'loadAnnotations/error'
            )
            throw error
          }
        },

        createAnnotation: async ({ noteId, from, to, text }) => {
          if (from === to) {
            throw new Error('Annotations require a non-empty selection')
          }

          const snapshot = {
            annotations: get().annotations,
            selectedAnnotationId: get().selectedAnnotationId,
            annotationsPanelOpen: get().annotationsPanelOpen,
          }

          try {
            const annotation = unwrapResult(
              await commands.createNoteAnnotation({
                note_id: noteId,
                text,
                from: Math.min(from, to),
                to: Math.max(from, to),
              })
            )
            set(
              state => ({
                annotations: upsertAnnotation(state.annotations, annotation),
                selectedAnnotationId: annotation.id,
                annotationsPanelOpen: true,
              }),
              undefined,
              'createAnnotation/done'
            )
            return annotation
          } catch (error) {
            logger.error(`Failed to create note annotation: ${String(error)}`)
            set(snapshot, undefined, 'createAnnotation/rollback')
            throw error
          }
        },

        updateAnnotationText: async (noteId, annotationId, text) => {
          const annotation = unwrapResult(
            await commands.updateNoteAnnotationText({
              note_id: noteId,
              annotation_id: annotationId,
              text,
            })
          )
          set(
            state => ({
              annotations: upsertAnnotation(state.annotations, annotation),
            }),
            undefined,
            'updateAnnotationText/done'
          )
        },

        resolveAnnotation: async (noteId, annotationId) => {
          const annotation = unwrapResult(
            await commands.resolveNoteAnnotation({
              note_id: noteId,
              annotation_id: annotationId,
            })
          )
          set(
            state => ({
              annotations: upsertAnnotation(state.annotations, annotation),
              selectedAnnotationId: annotation.id,
              annotationsPanelOpen: true,
            }),
            undefined,
            'resolveAnnotation/done'
          )
        },

        reopenAnnotation: async (noteId, annotationId) => {
          const annotation = unwrapResult(
            await commands.reopenNoteAnnotation({
              note_id: noteId,
              annotation_id: annotationId,
            })
          )
          set(
            state => ({
              annotations: upsertAnnotation(state.annotations, annotation),
              selectedAnnotationId: annotation.id,
              annotationsPanelOpen: true,
            }),
            undefined,
            'reopenAnnotation/done'
          )
        },

        deleteAnnotation: async (noteId, annotationId) => {
          unwrapResult(
            await commands.deleteNoteAnnotation({
              note_id: noteId,
              annotation_id: annotationId,
            })
          )
          set(
            state => ({
              annotations: state.annotations.filter(
                annotation => annotation.id !== annotationId
              ),
              selectedAnnotationId:
                state.selectedAnnotationId === annotationId
                  ? null
                  : state.selectedAnnotationId,
            }),
            undefined,
            'deleteAnnotation/done'
          )
        },

        repositionAnnotation: async (noteId, annotationId, from, to) => {
          if (from === to) {
            throw new Error('Annotations require a non-empty selection')
          }

          const annotation = unwrapResult(
            await commands.repositionNoteAnnotation({
              note_id: noteId,
              annotation_id: annotationId,
              from: Math.min(from, to),
              to: Math.max(from, to),
            })
          )
          set(
            state => ({
              annotations: upsertAnnotation(state.annotations, annotation),
              selectedAnnotationId: annotation.id,
              annotationsPanelOpen: true,
            }),
            undefined,
            'repositionAnnotation/done'
          )
        },

        replaceLocalAnnotations: annotations =>
          set({ annotations }, undefined, 'replaceLocalAnnotations'),

        selectAnnotation: annotationId =>
          set(
            {
              selectedAnnotationId: annotationId,
              annotationsPanelOpen: annotationId
                ? true
                : get().annotationsPanelOpen,
            },
            undefined,
            'selectAnnotation'
          ),

        setAnnotationsPanelOpen: open =>
          set(
            { annotationsPanelOpen: open },
            undefined,
            'setAnnotationsPanelOpen'
          ),

        filteredNotes: () => {
          const {
            notes,
            searchQuery,
            searchResults,
            selectedTag,
            workspaceView,
          } = get()
          const hasSearch = searchQuery.trim().length > 0
          const usesRemoteSearch =
            workspaceView === 'inbox' && hasSearch && searchResults !== null
          const base = usesRemoteSearch ? searchResults : notes

          return base.filter(note => {
            if (
              hasSearch &&
              !usesRemoteSearch &&
              !noteMatchesQuery(note, searchQuery)
            ) {
              return false
            }
            if (selectedTag && !noteHasTag(note, selectedTag)) {
              return false
            }
            return true
          })
        },

        selectedNote: () => {
          const { notes, selectedNoteId } = get()
          if (!selectedNoteId) return null
          return notes.find(n => n.id === selectedNoteId) ?? null
        },
      }
    },
    { name: 'notes-store' }
  )
)
