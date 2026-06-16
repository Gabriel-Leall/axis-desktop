import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'
import { useNotesStore } from './notes-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getNotes: vi.fn(),
    getNotesVaultInfo: vi.fn(),
    setNotesVaultPath: vi.fn(),
    resetNotesVaultPath: vi.fn(),
    openNotesVaultFolder: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    archiveNote: vi.fn(),
    restoreNote: vi.fn(),
    searchNotes: vi.fn(),
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
    vi.mocked(commands.updateNote).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'inbox/alpha.md',
        path: 'inbox/alpha.md',
        title: 'Alpha',
        content: '# Alpha updated',
        created_at: '2026-06-15T10:00:00.000Z',
        updated_at: '2026-06-15T12:00:00.000Z',
        word_count: 3,
        tags: [],
        wiki_links: [],
        has_attachments: false,
        excerpt: 'Alpha updated',
      },
    })
    vi.mocked(commands.deleteNote).mockResolvedValue({
      status: 'ok',
      data: null,
    })
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
    vi.mocked(commands.searchNotes).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.getNotesVaultInfo).mockResolvedValue({
      status: 'ok',
      data: {
        path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
        is_default: true,
      },
    })
    vi.mocked(commands.setNotesVaultPath).mockResolvedValue({
      status: 'ok',
      data: {
        path: 'D:\\Axis Vault',
        is_default: false,
      },
    })
    vi.mocked(commands.resetNotesVaultPath).mockResolvedValue({
      status: 'ok',
      data: {
        path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
        is_default: true,
      },
    })
    vi.mocked(commands.openNotesVaultFolder).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.getNotes).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'inbox/loaded.md',
          path: 'inbox/loaded.md',
          title: 'Loaded',
          content: '# Loaded',
          created_at: '2026-06-15T09:00:00.000Z',
          updated_at: '2026-06-15T09:00:00.000Z',
          word_count: 2,
          tags: [],
          wiki_links: [],
          has_attachments: false,
          excerpt: 'Loaded',
        },
      ],
    })
    useNotesStore.setState({
      vaultInfo: null,
      vaultError: null,
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

  it('loads active vault info together with the active notes workspace', async () => {
    await useNotesStore.getState().loadNotes()

    expect(commands.getNotesVaultInfo).toHaveBeenCalled()
    expect(commands.getNotes).toHaveBeenCalled()
    expect(useNotesStore.getState().vaultInfo).toEqual({
      path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
      is_default: true,
    })
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/loaded.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/loaded.md')
    expect(useNotesStore.getState().vaultError).toBeNull()
  })

  it('switches vault path and reloads notes without carrying old workspace filters', async () => {
    const alphaNote = useNotesStore.getState().notes[0]
    if (!alphaNote) {
      throw new Error('Expected alpha note fixture')
    }

    useNotesStore.setState({
      searchQuery: 'old',
      searchResults: [alphaNote],
      selectedTag: 'project',
      isSearching: true,
    })

    const vaultInfo = await useNotesStore
      .getState()
      .setVaultPath('D:\\Axis Vault')

    expect(commands.setNotesVaultPath).toHaveBeenCalledWith('D:\\Axis Vault')
    expect(commands.getNotes).toHaveBeenCalled()
    expect(vaultInfo).toEqual({
      path: 'D:\\Axis Vault',
      is_default: false,
    })
    expect(useNotesStore.getState().vaultInfo).toEqual(vaultInfo)
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/loaded.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/loaded.md')
    expect(useNotesStore.getState().searchQuery).toBe('')
    expect(useNotesStore.getState().searchResults).toBeNull()
    expect(useNotesStore.getState().selectedTag).toBeNull()
    expect(useNotesStore.getState().isSearching).toBe(false)
  })

  it('keeps the current workspace when switching vault path fails validation', async () => {
    vi.mocked(commands.setNotesVaultPath).mockResolvedValue({
      status: 'error',
      error: 'Selected notes vault path is not a directory',
    })
    useNotesStore.setState({
      vaultInfo: {
        path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
        is_default: true,
      },
    })

    await expect(
      useNotesStore.getState().setVaultPath('Z:\\invalid')
    ).rejects.toThrow('Selected notes vault path is not a directory')

    expect(useNotesStore.getState().vaultInfo).toEqual({
      path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
      is_default: true,
    })
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/alpha.md',
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/alpha.md')
    expect(commands.getNotes).not.toHaveBeenCalled()
  })

  it('resets to the default vault and reloads the active notes workspace', async () => {
    const vaultInfo = await useNotesStore.getState().resetVaultPath()

    expect(commands.resetNotesVaultPath).toHaveBeenCalled()
    expect(commands.getNotes).toHaveBeenCalled()
    expect(vaultInfo).toEqual({
      path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
      is_default: true,
    })
    expect(useNotesStore.getState().vaultInfo).toEqual(vaultInfo)
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/loaded.md',
    ])
  })

  it('moves deleted notes out of the active list through trash lifecycle', async () => {
    await useNotesStore.getState().deleteNote('inbox/alpha.md')

    expect(commands.deleteNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/beta.md')
  })

  it('flushes pending edits before moving a note to trash', async () => {
    useNotesStore.getState().updateNote('inbox/alpha.md', '# Alpha updated')

    await useNotesStore.getState().deleteNote('inbox/alpha.md')

    expect(commands.updateNote).toHaveBeenCalledWith({
      id: 'inbox/alpha.md',
      content: '# Alpha updated',
    })
    expect(commands.deleteNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().isSaving).toBe(false)
  })

  it('rolls back active state when moving a note to trash fails', async () => {
    vi.mocked(commands.deleteNote).mockResolvedValue({
      status: 'error',
      error: 'move failed',
    })

    await expect(
      useNotesStore.getState().deleteNote('inbox/alpha.md')
    ).rejects.toThrow('move failed')

    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/alpha.md',
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/alpha.md')
  })

  it('archives notes by removing them from the active list', async () => {
    await useNotesStore.getState().archiveNote('inbox/alpha.md')

    expect(commands.archiveNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/beta.md')
  })

  it('flushes pending edits before archiving a note', async () => {
    useNotesStore.getState().updateNote('inbox/alpha.md', '# Alpha updated')

    await useNotesStore.getState().archiveNote('inbox/alpha.md')

    expect(commands.updateNote).toHaveBeenCalledWith({
      id: 'inbox/alpha.md',
      content: '# Alpha updated',
    })
    expect(commands.archiveNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(useNotesStore.getState().isSaving).toBe(false)
  })

  it('rolls back active state when archiving a note fails', async () => {
    vi.mocked(commands.archiveNote).mockResolvedValue({
      status: 'error',
      error: 'archive failed',
    })

    await expect(
      useNotesStore.getState().archiveNote('inbox/alpha.md')
    ).rejects.toThrow('archive failed')

    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/alpha.md',
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/alpha.md')
  })

  it('restores notes into the active list and resets filters', async () => {
    const betaNote = useNotesStore.getState().notes[1]
    if (!betaNote) {
      throw new Error('Expected beta note fixture')
    }

    useNotesStore.setState({
      searchQuery: 'old query',
      searchResults: [betaNote],
      selectedTag: 'work',
      isSearching: true,
    })

    await useNotesStore.getState().restoreNote('trash/restored.md')

    expect(commands.restoreNote).toHaveBeenCalledWith('trash/restored.md')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/restored.md',
      'inbox/alpha.md',
      'inbox/beta.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/restored.md')
    expect(useNotesStore.getState().searchQuery).toBe('')
    expect(useNotesStore.getState().searchResults).toBeNull()
    expect(useNotesStore.getState().selectedTag).toBeNull()
    expect(useNotesStore.getState().isSearching).toBe(false)
  })

  it('cancels pending search debounce when restoring a note', async () => {
    vi.useFakeTimers()
    try {
      useNotesStore.getState().setSearchQuery('alpha')

      await useNotesStore.getState().restoreNote('trash/restored.md')
      await vi.advanceTimersByTimeAsync(250)

      expect(commands.searchNotes).not.toHaveBeenCalled()
      expect(useNotesStore.getState().searchQuery).toBe('')
      expect(useNotesStore.getState().searchResults).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
