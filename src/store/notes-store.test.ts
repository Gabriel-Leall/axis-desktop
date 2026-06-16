import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'
import { useNotesStore } from './notes-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getNotes: vi.fn(),
    getArchivedNotes: vi.fn(),
    getTrashedNotes: vi.fn(),
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
      data: {
        id: 'trash/alpha.md',
        path: 'trash/alpha.md',
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
    vi.mocked(commands.getArchivedNotes).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'archive/archived.md',
          path: 'archive/archived.md',
          title: 'Archived',
          content: '# Archived\n\n#work Cold storage',
          created_at: '2026-06-14T09:00:00.000Z',
          updated_at: '2026-06-14T09:00:00.000Z',
          word_count: 4,
          tags: ['work'],
          wiki_links: [],
          has_attachments: false,
          excerpt: 'Cold storage',
        },
      ],
    })
    vi.mocked(commands.getTrashedNotes).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'trash/trashed.md',
          path: 'trash/trashed.md',
          title: 'Trashed',
          content: '# Trashed\n\n#draft Removed note',
          created_at: '2026-06-13T09:00:00.000Z',
          updated_at: '2026-06-13T09:00:00.000Z',
          word_count: 4,
          tags: ['draft'],
          wiki_links: [],
          has_attachments: false,
          excerpt: 'Removed note',
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
      workspaceView: 'inbox',
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

  it('switches to the archived workspace without resetting active filters', async () => {
    useNotesStore.setState({
      searchQuery: 'cold',
      selectedTag: 'work',
      selectedNoteId: 'inbox/alpha.md',
    })

    await useNotesStore.getState().setWorkspaceView('archive')

    expect(commands.getArchivedNotes).toHaveBeenCalled()
    expect(commands.searchNotes).not.toHaveBeenCalled()
    expect(useNotesStore.getState().workspaceView).toBe('archive')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'archive/archived.md',
    ])
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
    expect(useNotesStore.getState().searchQuery).toBe('cold')
    expect(useNotesStore.getState().selectedTag).toBe('work')
    expect(
      useNotesStore
        .getState()
        .filteredNotes()
        .map(note => note.id)
    ).toEqual(['archive/archived.md'])
  })

  it('switches to the trash workspace and scopes search to trashed notes', async () => {
    useNotesStore.setState({
      searchQuery: 'removed',
      selectedTag: 'draft',
    })

    await useNotesStore.getState().setWorkspaceView('trash')

    expect(commands.getTrashedNotes).toHaveBeenCalled()
    expect(commands.searchNotes).not.toHaveBeenCalled()
    expect(useNotesStore.getState().workspaceView).toBe('trash')
    expect(
      useNotesStore
        .getState()
        .filteredNotes()
        .map(note => note.id)
    ).toEqual(['trash/trashed.md'])
  })

  it('keeps the current workspace when restoring a note from archive', async () => {
    useNotesStore.setState({
      workspaceView: 'archive',
      notes: [
        {
          id: 'archive/archived.md',
          content: '# Archived',
          created_at: '2026-06-14T09:00:00.000Z',
          updated_at: '2026-06-14T09:00:00.000Z',
          word_count: 2,
        },
      ],
      selectedNoteId: 'archive/archived.md',
      searchQuery: 'archived',
      selectedTag: 'work',
    })

    const restoredId = await useNotesStore
      .getState()
      .restoreNote('archive/archived.md')

    expect(restoredId).toBe('inbox/restored.md')
    expect(commands.restoreNote).toHaveBeenCalledWith('archive/archived.md')
    expect(useNotesStore.getState().workspaceView).toBe('archive')
    expect(useNotesStore.getState().notes).toEqual([])
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
    expect(useNotesStore.getState().searchQuery).toBe('archived')
    expect(useNotesStore.getState().selectedTag).toBe('work')
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

  it('flushes pending debounced saves before switching vaults', async () => {
    vi.useFakeTimers()
    try {
      useNotesStore.getState().updateNote('inbox/alpha.md', '# Alpha changed')

      await useNotesStore.getState().setVaultPath('D:\\Axis Vault')
      await vi.advanceTimersByTimeAsync(900)

      expect(commands.updateNote).toHaveBeenCalledWith({
        id: 'inbox/alpha.md',
        content: '# Alpha changed',
      })
      expect(
        vi.mocked(commands.updateNote).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(commands.setNotesVaultPath).mock.invocationCallOrder[0] ?? 0
      )
      expect(useNotesStore.getState().isSaving).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the new vault info when notes reload fails after switching vaults', async () => {
    vi.mocked(commands.getNotes).mockResolvedValue({
      status: 'error',
      error: 'notes reload failed',
    })

    await expect(
      useNotesStore.getState().setVaultPath('D:\\Axis Vault')
    ).rejects.toThrow('notes reload failed')

    expect(useNotesStore.getState().vaultInfo).toEqual({
      path: 'D:\\Axis Vault',
      is_default: false,
    })
    expect(useNotesStore.getState().notes).toEqual([])
    expect(useNotesStore.getState().selectedNoteId).toBeNull()
  })

  it('times out stalled notes reloads after switching vaults', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(commands.getNotes).mockReturnValue(
        new Promise(() => {
          // Intentionally never resolves to exercise the timeout branch.
        })
      )

      const switchPromise = useNotesStore
        .getState()
        .setVaultPath('D:\\Axis Vault')
      const outcome = Promise.race([
        switchPromise.then(
          () => 'resolved',
          error => String(error)
        ),
        new Promise<string>(resolve => {
          setTimeout(() => resolve('still pending'), 10_001)
        }),
      ])

      await vi.advanceTimersByTimeAsync(10_001)

      await expect(outcome).resolves.toContain('Timed out while loading notes')
      expect(useNotesStore.getState().isLoading).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not store open-folder failures as vault validation errors', async () => {
    vi.mocked(commands.openNotesVaultFolder).mockResolvedValue({
      status: 'error',
      error: 'open failed',
    })

    await expect(useNotesStore.getState().openVaultFolder()).rejects.toThrow(
      'open failed'
    )

    expect(useNotesStore.getState().vaultError).toBeNull()
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
    const trashedId = await useNotesStore
      .getState()
      .deleteNote('inbox/alpha.md')

    expect(commands.deleteNote).toHaveBeenCalledWith('inbox/alpha.md')
    expect(trashedId).toBe('trash/alpha.md')
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

  it('restores notes into the active list while preserving filters', async () => {
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
    expect(useNotesStore.getState().searchQuery).toBe('old query')
    expect(useNotesStore.getState().searchResults).toBeNull()
    expect(useNotesStore.getState().selectedTag).toBe('work')
    expect(useNotesStore.getState().isSearching).toBe(false)
  })

  it('cancels pending search debounce when restoring a note without clearing filters', async () => {
    vi.useFakeTimers()
    try {
      useNotesStore.getState().setSearchQuery('alpha')

      await useNotesStore.getState().restoreNote('trash/restored.md')
      await vi.advanceTimersByTimeAsync(250)

      expect(commands.searchNotes).not.toHaveBeenCalled()
      expect(useNotesStore.getState().searchQuery).toBe('alpha')
      expect(useNotesStore.getState().searchResults).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
