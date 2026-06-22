import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import type * as ReactTypes from 'react'
import { fireEvent, render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
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
      onChange,
    }: {
      value: string
      placeholder: string
      onChange: (content: string) => void
    }) =>
      React.createElement('textarea', {
        'aria-label': placeholder,
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value),
      }),
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
      data: [note],
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
    })
  })

  it('switches between live edit and read-only preview modes', async () => {
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
    render(<NotesPage />)

    const noteButton = await screen.findByRole('button', {
      name: 'Paper workspace',
    })
    fireEvent.contextMenu(noteButton)
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() => {
      expect(commands.archiveNotesTreeItem).toHaveBeenCalledWith({
        kind: 'note',
        id: 'inbox/paper-workspace.md',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('Item archived.', {
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
      expect(commands.restoreNotesTreeItem).toHaveBeenCalledWith({
        kind: 'note',
        id: 'inbox/paper-workspace.md',
      })
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
