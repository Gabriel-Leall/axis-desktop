import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands, unwrapResult } from '@/lib/tauri-bindings'
import { countWords, noteHasTag } from '@/lib/notes-domain'
import { logger } from '@/lib/logger'
import type { Note as BindingNote } from '@/lib/tauri-bindings'
import type { Note } from '@/lib/notes-domain'

interface NotesState {
  notes: Note[]
  searchResults: Note[] | null
  selectedNoteId: string | null
  searchQuery: string
  selectedTag: string | null
  isSaving: boolean
  isLoading: boolean
  isSearching: boolean

  loadNotes: () => Promise<void>
  createNote: (content?: string) => Promise<string>
  updateNote: (id: string, content: string) => void
  deleteNote: (id: string) => Promise<void>
  archiveNote: (id: string) => Promise<void>
  restoreNote: (id: string) => Promise<string>
  selectNote: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedTag: (tag: string | null) => void

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

function removeNoteFromList(notes: Note[], id: string): Note[] {
  return notes.filter(note => note.id !== id)
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
    content: note.content,
    created_at: note.created_at,
    updated_at: note.updated_at,
    word_count: note.word_count,
  }
}

export const useNotesStore = create<NotesState>()(
  devtools(
    (set, get) => ({
      notes: [],
      searchResults: null,
      selectedNoteId: null,
      searchQuery: '',
      selectedTag: null,
      isSaving: false,
      isLoading: false,
      isSearching: false,

      loadNotes: async () => {
        if (loadNotesInFlight) {
          return loadNotesInFlight
        }

        loadNotesInFlight = (async () => {
          set({ isLoading: true }, undefined, 'loadNotes/start')
          try {
            const result = await withTimeout(
              commands.getNotes(),
              NOTES_LOAD_TIMEOUT_MS,
              'Timed out while loading notes (Tauri IPC)'
            )
            const notes = unwrapResult(result).map(mapBindingNote)

            set(
              state => ({
                notes,
                selectedNoteId:
                  state.selectedNoteId &&
                  notes.some(note => note.id === state.selectedNoteId)
                    ? state.selectedNoteId
                    : (notes[0]?.id ?? null),
                searchResults: state.searchQuery.trim()
                  ? state.searchResults
                  : null,
              }),
              undefined,
              'loadNotes/done'
            )
          } catch (error) {
            logger.error(`Failed to load notes: ${String(error)}`)
            set({}, undefined, 'loadNotes/error')
          } finally {
            set({ isLoading: false }, undefined, 'loadNotes/finalize')
            loadNotesInFlight = null
          }
        })()

        return loadNotesInFlight
      },

      createNote: async (content = '') => {
        set({ isSaving: true }, undefined, 'createNote/start')

        try {
          const createdNote = mapBindingNote(
            unwrapResult(
              await commands.createNote({
                title: null,
                content,
                folder: null,
              })
            )
          )

          set(
            state => ({
              notes: [
                createdNote,
                ...state.notes.filter(note => note.id !== createdNote.id),
              ],
              selectedNoteId: createdNote.id,
              searchQuery: '',
              searchResults: null,
              selectedTag: null,
              isSaving: false,
            }),
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

            set(
              state => ({
                notes: state.notes.map(note =>
                  note.id === savedNote.id ? savedNote : note
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

      deleteNote: async id => {
        const snapshot = {
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
          unwrapResult(await commands.deleteNote(id))
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
            set({ isSaving: false }, undefined, 'archiveNote/flushPendingSave')
          }

          set(
            state => ({
              notes: removeNoteFromList(state.notes, id),
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
          unwrapResult(await commands.archiveNote(id))
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
          cancelPendingSearch()
          const restoredNote = mapBindingNote(
            unwrapResult(await commands.restoreNote(id))
          )

          set(
            state => ({
              notes: [
                restoredNote,
                ...state.notes.filter(note => note.id !== restoredNote.id),
              ],
              selectedNoteId: restoredNote.id,
              searchQuery: '',
              searchResults: null,
              selectedTag: null,
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

      selectNote: id => set({ selectedNoteId: id }, undefined, 'selectNote'),

      setSearchQuery: query => {
        const trimmedQuery = query.trim()
        set({ searchQuery: query }, undefined, 'setSearchQuery')

        cancelPendingSearch()

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

      filteredNotes: () => {
        const { notes, searchQuery, searchResults, selectedTag } = get()
        const hasSearch = searchQuery.trim().length > 0
        const base = hasSearch ? (searchResults ?? []) : notes

        return base.filter(note => {
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
    }),
    { name: 'notes-store' }
  )
)
