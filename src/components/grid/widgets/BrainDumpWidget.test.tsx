import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@/test/test-utils'
import { commands } from '@/lib/tauri-bindings'
import { useNotesStore } from '@/store/notes-store'
import { BrainDumpWidget } from './BrainDumpWidget'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getNotes: vi.fn(),
    getArchivedNotes: vi.fn(),
    getTrashedNotes: vi.fn(),
    getNotesVaultInfo: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
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

describe('BrainDumpWidget', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(commands.getNotesVaultInfo).mockResolvedValue({
      status: 'ok',
      data: {
        path: 'C:\\Users\\Gabriel\\Documents\\Axis Notes',
        is_default: true,
      },
    })
    vi.mocked(commands.getNotes).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'inbox/widget-note.md',
          path: 'inbox/widget-note.md',
          title: 'Widget note',
          content: '# Widget note',
          created_at: '2026-06-18T10:00:00.000Z',
          updated_at: '2026-06-18T10:00:00.000Z',
          word_count: 2,
          tags: [],
          wiki_links: [],
          has_attachments: false,
          excerpt: 'Widget note',
        },
      ],
    })
    vi.mocked(commands.getTrashedNotes).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'trash/old-widget-note.md',
          path: 'trash/old-widget-note.md',
          title: 'Old widget note',
          content: '# Old widget note',
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-17T10:00:00.000Z',
          word_count: 3,
          tags: [],
          wiki_links: [],
          has_attachments: false,
          excerpt: 'Old widget note',
        },
      ],
    })
    vi.mocked(commands.getArchivedNotes).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.createNote).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'inbox/new-widget-note.md',
        path: 'inbox/new-widget-note.md',
        title: 'New widget note',
        content: '',
        created_at: '2026-06-18T11:00:00.000Z',
        updated_at: '2026-06-18T11:00:00.000Z',
        word_count: 0,
        tags: [],
        wiki_links: [],
        has_attachments: false,
        excerpt: '',
      },
    })

    useNotesStore.setState({
      vaultInfo: null,
      vaultError: null,
      workspaceView: 'trash',
      notes: [
        {
          id: 'trash/old-widget-note.md',
          content: '# Old widget note',
          created_at: '2026-06-17T10:00:00.000Z',
          updated_at: '2026-06-17T10:00:00.000Z',
          word_count: 3,
        },
      ],
      searchResults: null,
      selectedNoteId: 'trash/old-widget-note.md',
      searchQuery: '',
      selectedTag: null,
      isSaving: false,
      isLoading: false,
      isSearching: false,
    })
  })

  it('loads the active vault inbox instead of the current lifecycle workspace', async () => {
    render(<BrainDumpWidget />)

    await waitFor(() => {
      expect(commands.getNotes).toHaveBeenCalled()
    })

    expect(commands.getNotesVaultInfo).toHaveBeenCalled()
    expect(commands.getTrashedNotes).not.toHaveBeenCalled()
    expect(commands.getArchivedNotes).not.toHaveBeenCalled()
    expect(useNotesStore.getState().workspaceView).toBe('inbox')
    expect(useNotesStore.getState().notes.map(note => note.id)).toEqual([
      'inbox/widget-note.md',
    ])
  })

  it('does not expose lifecycle note content while the widget inbox is loading', () => {
    vi.mocked(commands.getNotes).mockReturnValue(
      new Promise(() => {
        // Keep the load pending so the initial render state is observable.
      })
    )

    render(<BrainDumpWidget />)

    const editor = screen.getByPlaceholderText('Dump it here...')

    expect(editor).toHaveValue('')

    fireEvent.change(editor, {
      target: { value: '# Editing should not hit trash' },
    })

    expect(commands.updateNote).not.toHaveBeenCalled()
  })

  it('opens the notes page with the loaded inbox note selected', async () => {
    const onNavigateToNotes = vi.fn()

    render(<BrainDumpWidget onNavigateToNotes={onNavigateToNotes} />)

    await waitFor(() => {
      expect(commands.getNotes).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open notes page' }))

    expect(onNavigateToNotes).toHaveBeenCalledWith('inbox/widget-note.md')
    expect(useNotesStore.getState().selectedNoteId).toBe('inbox/widget-note.md')
  })

  it('keeps quick capture creating notes in the active vault inbox', async () => {
    render(<BrainDumpWidget />)

    await waitFor(() => {
      expect(commands.getNotes).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New note' }))

    await waitFor(() => {
      expect(commands.createNote).toHaveBeenCalledWith({
        title: null,
        content: '',
        folder: null,
      })
    })

    expect(useNotesStore.getState().workspaceView).toBe('inbox')
    expect(useNotesStore.getState().selectedNoteId).toBe(
      'inbox/new-widget-note.md'
    )
  })
})
