import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { NotesExplorerTree } from './NotesExplorerTree'

const tree = {
  workspace: 'inbox' as const,
  items: [
    {
      kind: 'folder' as const,
      path: 'inbox/projects',
      name: 'Projects',
      children: [
        {
          kind: 'note' as const,
          note: {
            id: 'plan-id',
            path: 'inbox/projects/plan.md',
            title: 'Plan',
            content: '# Plan',
            created_at: '2026-06-19T10:00:00.000Z',
            updated_at: '2026-06-19T10:00:00.000Z',
            word_count: 1,
          },
        },
      ],
    },
    {
      kind: 'note' as const,
      note: {
        id: 'root-id',
        path: 'inbox/root.md',
        title: 'Root',
        content: '# Root',
        created_at: '2026-06-19T10:00:00.000Z',
        updated_at: '2026-06-19T10:00:00.000Z',
        word_count: 1,
      },
    },
  ],
}

describe('NotesExplorerTree', () => {
  it('collapses a physical folder without changing the selected note', async () => {
    const user = userEvent.setup()

    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId="plan-id"
        onSelectNote={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    await user.click(screen.getByRole('button', { name: 'Collapse Projects' }))

    expect(
      screen.queryByRole('button', { name: 'Plan' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expand Projects' })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('selects nested notes by their stable ID', async () => {
    const user = userEvent.setup()
    const onSelectNote = vi.fn()

    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId={null}
        onSelectNote={onSelectNote}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Plan' }))

    expect(onSelectNote).toHaveBeenCalledWith('plan-id')
  })

  it('opens lifecycle actions on right click and archives an inbox note', async () => {
    const user = userEvent.setup()
    const onContextAction = vi.fn()

    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
        onContextAction={onContextAction}
      />
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Plan' }))

    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() => {
      expect(onContextAction).toHaveBeenCalledWith('archive', {
        kind: 'note',
        id: 'plan-id',
      })
    })
  })

  it('offers folder organization actions only in Inbox', async () => {
    const user = userEvent.setup()
    const onContextAction = vi.fn()

    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
        onContextAction={onContextAction}
      />
    )

    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Collapse Projects' })
    )

    expect(screen.getByRole('menuitem', { name: 'New folder' })).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: 'Rename folder' })
    ).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Move' })).toBeVisible()

    await user.click(screen.getByRole('menuitem', { name: 'Rename folder' }))

    await waitFor(() => {
      expect(onContextAction).toHaveBeenCalledWith('rename-folder', {
        kind: 'folder',
        path: 'inbox/projects',
        name: 'Projects',
      })
    })
  })

  it('limits Archive to restore and trash lifecycle actions', async () => {
    const user = userEvent.setup()
    const onContextAction = vi.fn()

    render(
      <NotesExplorerTree
        tree={{ ...tree, workspace: 'archive' }}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
        onContextAction={onContextAction}
      />
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Plan' }))

    expect(screen.getByRole('menuitem', { name: 'Restore note' })).toBeVisible()
    expect(
      screen.getByRole('menuitem', { name: 'Move to trash' })
    ).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'New folder' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Move' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Restore note' }))

    await waitFor(() => {
      expect(onContextAction).toHaveBeenCalledWith('restore', {
        kind: 'note',
        id: 'plan-id',
      })
    })
  })
})
