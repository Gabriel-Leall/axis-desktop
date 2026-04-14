import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands, unwrapResult } from '@/lib/tauri-bindings'
import { countWords } from '@/lib/notes-domain'
import { logger } from '@/lib/logger'
import type { Note as BindingNote } from '@/lib/tauri-bindings'
import type { Note } from '@/lib/notes-domain'

interface NotesState {
  notes: Note[]
  selectedNoteId: string | null
  searchQuery: string
  isSaving: boolean
  isLoading: boolean

  loadNotes: () => Promise<void>
  createNote: (content?: string) => Promise<string>
  updateNote: (id: string, content: string) => void
  deleteNote: (id: string) => Promise<void>
  selectNote: (id: string | null) => void
  setSearchQuery: (query: string) => void

  filteredNotes: () => Note[]
  selectedNote: () => Note | null
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 800

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
      selectedNoteId: null,
      searchQuery: '',
      isSaving: false,
      isLoading: false,

      loadNotes: async () => {
        set({ isLoading: true }, undefined, 'loadNotes/start')
        try {
          const notes = unwrapResult(await commands.getNotes()).map(
            mapBindingNote
          )

          set(
            state => ({
              notes,
              selectedNoteId:
                state.selectedNoteId &&
                notes.some(note => note.id === state.selectedNoteId)
                  ? state.selectedNoteId
                  : (notes[0]?.id ?? null),
              isLoading: false,
            }),
            undefined,
            'loadNotes/done'
          )
        } catch (error) {
          logger.error(`Failed to load notes: ${String(error)}`)
          set({ isLoading: false }, undefined, 'loadNotes/error')
        }
      },

      createNote: async (content = '') => {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        const wordCount = countWords(content)

        set({ isSaving: true }, undefined, 'createNote/start')

        try {
          const createdNote = mapBindingNote(
            unwrapResult(
              await commands.createNote({
                id,
                content,
                created_at: now,
                updated_at: now,
                word_count: wordCount,
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
                  updated_at: updatedAt,
                  word_count: wordCount,
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

      setSearchQuery: query =>
        set({ searchQuery: query }, undefined, 'setSearchQuery'),

      filteredNotes: () => {
        const { notes, searchQuery } = get()
        if (!searchQuery.trim()) return notes
        const lower = searchQuery.toLowerCase()
        return notes.filter(n => n.content.toLowerCase().includes(lower))
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
