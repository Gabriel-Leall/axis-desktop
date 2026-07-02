import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import type * as ReactTypes from 'react'
import { fireEvent, render, screen, waitFor, within } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { commands } from '@/lib/tauri-bindings'
import { useNotesStore } from '@/store/notes-store'
import { NotesPage } from './NotesPage'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getNotes: vi.fn(),
    getNotesWorkspaceTree: vi.fn(),
    getArchivedNotes: vi.fn(),
    getTrashedNotes: vi.fn(),
    getNotesVaultInfo: vi.fn(),
    createNote: vi.fn(),
    renameNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    archiveNote: vi.fn(),
    archiveNotesTreeItem: vi.fn(),
    createNotesFolder: vi.fn(),
    restoreNote: vi.fn(),
    restoreNotesTreeItem: vi.fn(),
    moveNotesTreeItem: vi.fn(),
    renameNotesFolder: vi.fn(),
    trashNotesTreeItem: vi.fn(),
    openNotesVaultFolder: vi.fn(),
    listNoteAnnotations: vi.fn(),
    createNoteAnnotation: vi.fn(),
    updateNoteAnnotationText: vi.fn(),
    resolveNoteAnnotation: vi.fn(),
    reopenNoteAnnotation: vi.fn(),
    deleteNoteAnnotation: vi.fn(),
    repositionNoteAnnotation: vi.fn(),
  },
  unwrapResult: vi.fn(
    (result: { status: 'ok' | 'error'; data?: unknown; error?: string }) => {
      if (result.status === 'ok') return result.data
      throw new Error(result.error ?? 'Command failed')
    }
  ),
}))

vi.mock('@toast-ui/react-editor', async () => {
  const React = await vi.importActual<typeof ReactTypes>('react')
  function Viewer({ initialValue = '' }: { initialValue?: string }) {
    return React.createElement(
      'article',
      { 'data-testid': 'notes-markdown-preview' },
      initialValue
    )
  }

  return { Viewer }
})

vi.mock('@/components/notes/editor/MarkdownLiveEditor', async () => {
  const React = await vi.importActual<typeof ReactTypes>('react')

  return {
    MarkdownLiveEditor: ({
      value,
      placeholder,
      annotations,
      onChange,
      onSelectionChange,
      onSelectAnnotation,
    }: {
      value: string
      placeholder: string
      annotations?: { id: string }[]
      onChange: (content: string) => void
      onSelectionChange?: (
        selection: { from: number; to: number; text: string } | null
      ) => void
      onSelectAnnotation?: (annotationId: string) => void
    }) => {
      const firstAnnotation = annotations?.[0]

      return React.createElement(
        'div',
        null,
        React.createElement('textarea', {
          'aria-label': placeholder,
          value,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
            onChange(event.target.value),
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () =>
              onSelectionChange?.({ from: 2, to: 7, text: 'note' }),
          },
          'Mock selection'
        ),
        firstAnnotation
          ? React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onSelectAnnotation?.(firstAnnotation.id),
              },
              'Mock marker'
            )
          : null
      )
    },
  }
})

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const note = {
  id: 'inbox/paper-workspace.md',
  path: 'inbox/paper-workspace.md',
  title: 'Paper workspace',
  content: 'A note with preview content.',
  created_at: '2026-06-19T10:00:00.000Z',
  updated_at: '2026-06-19T10:00:00.000Z',
  word_count: 7,
  tags: [],
  wiki_links: [],
  has_attachments: false,
  excerpt: 'A note with preview content.',
}

const secondNote = {
  id: 'inbox/research-map.md',
  path: 'inbox/research-map.md',
  title: 'Research map',
  content: 'Second note content.',
  created_at: '2026-06-20T10:00:00.000Z',
  updated_at: '2026-06-20T10:00:00.000Z',
  word_count: 3,
  tags: [],
  wiki_links: [],
  has_attachments: false,
  excerpt: 'Second note content.',
}

const thirdNote = {
  id: 'inbox/daily-plan.md',
  path: 'inbox/daily-plan.md',
  title: 'Daily plan',
  content: 'Third note content.',
  created_at: '2026-06-21T10:00:00.000Z',
  updated_at: '2026-06-21T10:00:00.000Z',
  word_count: 3,
  tags: [],
  wiki_links: [],
  has_attachments: false,
  excerpt: 'Third note content.',
}

describe('NotesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    vi.mocked(commands.getNotesVaultInfo).mockResolvedValue({
      status: 'ok',
      data: {
        path: 'C:\\Users\\Gabriel\\Documents\\Axis_Notes',
        is_default: true,
      },
    })
    vi.mocked(commands.getNotes).mockResolvedValue({
      status: 'ok',
      data: [note, secondNote, thirdNote],
    })
    vi.mocked(commands.getNotesWorkspaceTree).mockResolvedValue({
      status: 'ok',
      data: {
        workspace: 'inbox',
        items: [
          {
            kind: 'folder',
            path: 'inbox/projects',
            name: 'Projects',
            children: [
              {
                kind: 'note',
                note,
              },
              {
                kind: 'note',
                note: secondNote,
              },
              {
                kind: 'note',
                note: thirdNote,
              },
            ],
          },
        ],
      },
    })
    vi.mocked(commands.getArchivedNotes).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.getTrashedNotes).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.createNote).mockResolvedValue({
      status: 'ok',
      data: {
        ...note,
        id: 'inbox/projects/Untitled.md',
        path: 'inbox/projects/Untitled.md',
        title: 'Untitled',
        content: '',
      },
    })
    vi.mocked(commands.archiveNotesTreeItem).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.restoreNotesTreeItem).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.renameNote).mockResolvedValue({
      status: 'ok',
      data: {
        ...note,
        title: 'Renamed workspace',
        path: 'inbox/renamed-workspace.md',
      },
    })
    vi.mocked(commands.listNoteAnnotations).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.createNoteAnnotation).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'annotation-1',
        note_id: note.id,
        state: 'active',
        anchor_status: 'anchored',
        text: 'New annotation',
        from: 2,
        to: 7,
        quote: 'note',
        prefix: 'A ',
        suffix: '',
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:00:00.000Z',
        resolved_at: null,
      },
    })
    vi.mocked(commands.updateNoteAnnotationText).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'annotation-1',
        note_id: note.id,
        state: 'active',
        anchor_status: 'anchored',
        text: 'Updated',
        from: 2,
        to: 7,
        quote: 'note',
        prefix: 'A ',
        suffix: '',
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:01:00.000Z',
        resolved_at: null,
      },
    })
    vi.mocked(commands.resolveNoteAnnotation).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'annotation-1',
        note_id: note.id,
        state: 'resolved',
        anchor_status: 'anchored',
        text: 'New annotation',
        from: 2,
        to: 7,
        quote: 'note',
        prefix: 'A ',
        suffix: '',
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:01:00.000Z',
        resolved_at: '2026-06-28T10:01:00.000Z',
      },
    })
    vi.mocked(commands.reopenNoteAnnotation).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'annotation-1',
        note_id: note.id,
        state: 'active',
        anchor_status: 'anchored',
        text: 'New annotation',
        from: 2,
        to: 7,
        quote: 'note',
        prefix: 'A ',
        suffix: '',
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:02:00.000Z',
        resolved_at: null,
      },
    })
    vi.mocked(commands.deleteNoteAnnotation).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.repositionNoteAnnotation).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'annotation-1',
        note_id: note.id,
        state: 'active',
        anchor_status: 'anchored',
        text: 'New annotation',
        from: 8,
        to: 12,
        quote: 'with',
        prefix: '',
        suffix: '',
        created_at: '2026-06-28T10:00:00.000Z',
        updated_at: '2026-06-28T10:03:00.000Z',
        resolved_at: null,
      },
    })

    useNotesStore.setState({
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
    })
  })

  it('switches between live edit and read-only preview modes', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Paper workspace')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Edit mode' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      screen.queryByTestId('notes-markdown-preview')
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Preview mode' }))

    expect(
      screen.getByRole('button', { name: 'Preview mode' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Start writing...')).not.toBeInTheDocument()
    expect(screen.getByTestId('notes-markdown-preview')).toHaveTextContent(
      'A note with preview content.'
    )

    expect(
      screen.queryByRole('button', { name: 'Split mode' })
    ).not.toBeInTheDocument()

    await user.keyboard('This must not edit the note')
    expect(commands.updateNote).not.toHaveBeenCalled()
  })

  it('renders the physical vault tree in the Notes sidebar', async () => {
    render(<NotesPage />)

    expect(
      await screen.findByRole('button', { name: 'Collapse Projects' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Paper workspace' })
    ).toBeInTheDocument()
  })

  it('opens a second note beside the current note from the tree context menu', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))

    expect(screen.getByDisplayValue('Paper workspace')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Research map')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Right note pane' })
    ).toHaveAttribute('data-active-pane', 'true')
  })

  it('uses normal tree clicks to replace only the active split pane', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))
    await user.click(screen.getByRole('button', { name: 'Daily plan' }))

    expect(screen.getByDisplayValue('Paper workspace')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Research map')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Daily plan')).toBeInTheDocument()
  })

  it('closes the secondary split pane without changing the primary note', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))
    await user.click(screen.getByRole('button', { name: 'Close right pane' }))

    expect(screen.getByDisplayValue('Paper workspace')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Research map')).not.toBeInTheDocument()
  })

  it('applies note lifecycle actions to the active split pane', async () => {
    const user = userEvent.setup()
    vi.mocked(commands.archiveNote).mockResolvedValue({
      status: 'ok',
      data: secondNote,
    })
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))

    const rightPane = screen.getByRole('region', { name: 'Right note pane' })
    await user.click(
      within(rightPane).getByRole('button', { name: 'Note actions' })
    )
    await user.click(screen.getByRole('button', { name: 'Archive note' }))

    await waitFor(() => {
      expect(commands.archiveNote).toHaveBeenCalledWith(secondNote.id)
    })
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Research map')).not.toBeInTheDocument()
    })
  })

  it('activates the visible pane when using the compact split switch', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))
    await user.click(screen.getByRole('button', { name: 'Show left pane' }))

    expect(
      screen.getByRole('region', { name: 'Left note pane' })
    ).toHaveAttribute('data-active-pane', 'true')
  })

  it('keeps editor mode changes scoped to the active pane', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))

    const rightPane = screen.getByRole('region', { name: 'Right note pane' })
    await user.click(
      within(rightPane).getByRole('button', { name: 'Preview mode' })
    )

    expect(
      within(rightPane).getByTestId('notes-markdown-preview')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Left note pane' })).getByRole(
        'textbox',
        { name: 'Start writing...' }
      )
    ).toBeInTheDocument()
  })

  it('imports a markdown file into the active split pane', async () => {
    const user = userEvent.setup()
    vi.mocked(open).mockResolvedValue('C:/tmp/imported.md')
    vi.mocked(readTextFile).mockResolvedValue('Imported note body')
    vi.mocked(commands.createNote).mockResolvedValue({
      status: 'ok',
      data: {
        ...secondNote,
        id: 'inbox/imported-note.md',
        path: 'inbox/imported-note.md',
        title: 'Imported note',
        content: 'Imported note body',
      },
    })
    vi.mocked(commands.getNotes).mockResolvedValueOnce({
      status: 'ok',
      data: [
        note,
        secondNote,
        thirdNote,
        {
          ...secondNote,
          id: 'inbox/imported-note.md',
          path: 'inbox/imported-note.md',
          title: 'Imported note',
          content: 'Imported note body',
        },
      ],
    })
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))

    const rightPane = screen.getByRole('region', { name: 'Right note pane' })
    await user.click(
      within(rightPane).getByRole('button', { name: 'Note actions' })
    )
    await user.click(screen.getByRole('button', { name: 'Import .md' }))

    await waitFor(() => {
      expect(commands.createNote).toHaveBeenCalledWith({
        title: null,
        content: 'Imported note body',
        folder: null,
      })
    })
    expect(screen.getByDisplayValue('Paper workspace')).toBeInTheDocument()
  })

  it('does not keep duplicate panes when the primary note lifecycle advances to the secondary note', async () => {
    const user = userEvent.setup()
    vi.mocked(commands.archiveNote).mockResolvedValue({
      status: 'ok',
      data: note,
    })
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Research map' }))
    await user.click(screen.getByRole('menuitem', { name: 'Open beside' }))

    const leftPane = screen.getByRole('region', { name: 'Left note pane' })
    await user.click(
      within(leftPane).getByRole('button', { name: 'Note actions' })
    )
    await user.click(screen.getByRole('button', { name: 'Archive note' }))

    await waitFor(() => {
      expect(commands.archiveNote).toHaveBeenCalledWith(note.id)
    })
    expect(
      screen.queryByRole('region', { name: 'Right note pane' })
    ).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Research map')).toBeInTheDocument()
  })

  it('keeps annotations panel closed until a selection is annotated', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    expect(screen.queryByText('Annotations')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock selection' }))
    await user.click(screen.getByRole('button', { name: 'Annotate selection' }))

    await waitFor(() => {
      expect(commands.createNoteAnnotation).toHaveBeenCalledWith({
        note_id: note.id,
        text: 'New annotation',
        from: 2,
        to: 7,
      })
    })
    expect(screen.getByText('Annotations')).toBeInTheDocument()
    expect(screen.getByDisplayValue('New annotation')).toBeInTheDocument()
  })

  it('opens the annotations panel when an existing marker is selected', async () => {
    const user = userEvent.setup()
    vi.mocked(commands.listNoteAnnotations).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'annotation-1',
          note_id: note.id,
          state: 'active',
          anchor_status: 'anchored',
          text: 'Existing annotation',
          from: 2,
          to: 7,
          quote: 'note',
          prefix: 'A ',
          suffix: '',
          created_at: '2026-06-28T10:00:00.000Z',
          updated_at: '2026-06-28T10:00:00.000Z',
          resolved_at: null,
        },
      ],
    })

    render(<NotesPage />)

    await screen.findByRole('button', { name: 'Mock marker' })
    expect(screen.queryByText('Annotations')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mock marker' }))

    expect(screen.getByText('Annotations')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing annotation')).toBeInTheDocument()
  })

  it('opens a rename dialog from a folder context menu', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    const folderTrigger = await screen.findByRole('button', {
      name: 'Collapse Projects',
    })
    fireEvent.contextMenu(folderTrigger)

    await user.click(screen.getByRole('menuitem', { name: 'Rename folder' }))

    expect(
      await screen.findByRole('dialog', { name: 'Rename folder' })
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Folder name' })).toHaveValue(
      'Projects'
    )
  })

  it('creates a note inside the folder selected from its context menu', async () => {
    const user = userEvent.setup()
    render(<NotesPage />)

    fireEvent.contextMenu(
      await screen.findByRole('button', { name: 'Collapse Projects' })
    )
    await user.click(screen.getByRole('menuitem', { name: 'New note' }))

    await waitFor(() => {
      expect(commands.createNote).toHaveBeenCalledWith({
        title: null,
        content: '',
        folder: 'inbox/projects',
      })
    })
  })

  it('shows an undoable snackbar after archiving from the context menu', async () => {
    const user = userEvent.setup()
    vi.mocked(commands.archiveNote).mockResolvedValue({
      status: 'ok',
      data: note,
    })
    render(<NotesPage />)

    const noteButton = await screen.findByRole('button', {
      name: 'Paper workspace',
    })
    fireEvent.contextMenu(noteButton)
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() => {
      expect(commands.archiveNote).toHaveBeenCalledWith(note.id)
    })
    expect(toast.success).toHaveBeenCalledWith('Note archived.', {
      action: expect.objectContaining({ label: 'Undo' }),
      cancel: expect.objectContaining({ label: 'View archive' }),
    })

    const options = vi
      .mocked(toast.success)
      .mock.calls.at(-1)?.[1] as unknown as {
      action: { onClick: (event: never) => void }
      cancel: { onClick: (event: never) => void }
    }
    options.action.onClick(undefined as never)
    options.cancel.onClick(undefined as never)

    await waitFor(() => {
      expect(commands.restoreNote).toHaveBeenCalledWith(note.id)
      expect(commands.getNotesWorkspaceTree).toHaveBeenLastCalledWith('archive')
    })
  })

  it('renames the file-backed title without changing the Markdown body', async () => {
    render(<NotesPage />)

    await screen.findByDisplayValue('Paper workspace')
    fireEvent.click(screen.getByRole('button', { name: 'Preview mode' }))
    fireEvent.change(screen.getByDisplayValue('Paper workspace'), {
      target: { value: 'Renamed workspace' },
    })
    fireEvent.keyDown(screen.getByDisplayValue('Renamed workspace'), {
      key: 'Enter',
    })

    await waitFor(() => {
      expect(commands.renameNote).toHaveBeenCalledWith({
        id: note.id,
        title: 'Renamed workspace',
      })
    })
    expect(useNotesStore.getState().selectedNote()?.content).toBe(
      'A note with preview content.'
    )
  })

  it('keeps the paper workspace mounted while another workspace tree loads', async () => {
    render(<NotesPage />)

    await screen.findByRole('button', { name: 'Paper workspace' })

    vi.mocked(commands.getNotesWorkspaceTree).mockImplementation(workspace => {
      if (workspace === 'archive') {
        return new Promise(() => {
          // Keep the IPC pending to assert the page does not flash away.
        })
      }

      return Promise.resolve({
        status: 'ok',
        data: {
          workspace: 'inbox',
          items: [],
        },
      })
    })

    act(() => {
      void useNotesStore.getState().setWorkspaceView('archive')
    })

    await waitFor(() => {
      expect(commands.getNotesWorkspaceTree).toHaveBeenLastCalledWith('archive')
    })

    expect(screen.queryByText('Loading notes...')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument()
  })
})
