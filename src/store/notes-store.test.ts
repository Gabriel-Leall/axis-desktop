import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'
import { useNotesStore } from './notes-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    deleteNote: vi.fn(),
    archiveNote: vi.fn(),
    restoreNote: vi.fn(),
  },
  unwrapResult: vi.fn(
    (result: { status: 'ok' | 'error'; data?: unknown; error?: string }) => {
      if (result.status === 'ok') return result.data
      throw new Error(result.error ?? 'Command failed')
    }
  ),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('useNotesStore lifecycle actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useNotesStore.setState({
      notes: [
        {
          id: 'inbox/alpha.md',
          content: '# Alpha',
          created_at: '2026-06-15T10:00:00.000Z',
          updated_at: '2026-06-15T10:00:00.000Z',
          word_count: 2,
        },
        {
          id: 'inbox/beta.md',
          content: '# Beta',
          created_at: '2026-06-15T11:00:00.000Z',
          updated_at: '2026-06-15T11:00:00.000Z',
          word_count: 2,
        },
      ],
      searchResults: null,
      selectedNoteId: 'inbox/alpha.md',
      searchQuery: '',
      selectedTag: null,
      isSaving: false,
      isLoading: false,
      isSearching: false,
    })
  })

  it('moves deleted notes out of the active list through trash lifecycle', async () => {
    vi.mocked(commands.deleteNote).mockResolvedValue({
      status: 'ok',
      data: null,
    })

    await useNotesStore.getState().deleteNote('inbox/alpha.md')

    expect(commands.deleteNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/beta.md')
  })

  it('archives notes by removing them from the active list', async () => {
    vi.mocked(commands.archiveNote).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'archive/alpha.md',
        path: 'archive/alpha.md',
        title: 'Alpha',
        content: '# Alpha',
        created_at: '2026-06-15T10:00:00.000Z',
        updated_at: '2026-06-15T10:00:00.000Z',
        word_count: 2,
        tags: [],
        wiki_links: [],
        has_attachments: false,
        excerpt: 'Alpha',
      },
    })

    await useNotesStore.getState().archiveNote('inbox/alpha.md')

    expect(commands.archiveNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/beta.md')
  })

  it('restores notes into the active list and selects them', async () => {
    vi.mocked(commands.restoreNote).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'inbox/restored.md',
        path: 'inbox/restored.md',
        title: 'Restored',
        content: '# Restored',
        created_at: '2026-06-15T12:00:00.000Z',
        updated_at: '2026-06-15T12:00:00.000Z',
        word_count: 2,
        tags: [],
        wiki_links: [],
        has_attachments: false,
        excerpt: 'Restored',
      },
    })

    await useNotesStore.getState().restoreNote('trash/restored.md')

    expect(commands.restoreNote).toHaveBeenCalledWith('trash/restored.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/restored.md',
      'inbox/alpha.md',
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/restored.md')
  })
})
