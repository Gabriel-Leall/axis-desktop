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
  selectNote: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSelectedTag: (tag: string | null) => void

  filteredNotes: () => Note[]
  selectedNote: () => Note | null
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0
let loadNotesInFlight: Promise<void> | null = null
const DEBOUNCE_MS = 800
const SEARCH_DEBOUNCE_MS = 220
const NOTES_LOAD_TIMEOUT_MS = 10_000

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
          }
        }, DEBOUNCE_MS)
      },

      deleteNote: async id => {
        const snapshot = get().notes
        const remaining = snapshot.filter(note => note.id !== id)

        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }

        set(
          state => ({
            notes: state.notes.filter(n => n.id !== id),
            selectedNoteId:
              state.selectedNoteId === id
                ? (remaining[0]?.id ?? null)
                : state.selectedNoteId,
          }),
          undefined,
          'deleteNote/optimistic'
        )

        try {
          unwrapResult(await commands.deleteNote(id))
        } catch (error) {
          logger.error(`Failed to delete note: ${String(error)}`)
          set({ notes: snapshot }, undefined, 'deleteNote/rollback')
          throw error
        }
      },

      selectNote: id => set({ selectedNoteId: id }, undefined, 'selectNote'),

      setSearchQuery: query => {
        const trimmedQuery = query.trim()
        set({ searchQuery: query }, undefined, 'setSearchQuery')

        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer)
          searchDebounceTimer = null
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
