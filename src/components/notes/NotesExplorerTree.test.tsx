import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { NotesExplorerTree } from './NotesExplorerTree'

const dnd = vi.hoisted(() => ({
  props: null as {
    onDragEnd?: (event: unknown) => void
    onDragOver?: (event: unknown) => void
    onDragStart?: (event: unknown) => void
  } | null,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    ...props
  }: {
    children: React.ReactNode
    onDragEnd?: (event: unknown) => void
    onDragOver?: (event: unknown) => void
    onDragStart?: (event: unknown) => void
  }) => {
    dnd.props = props
    return children
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => children,
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
  }),
  useSensor: vi.fn(),
  useSensors: () => [],
}))

const tree = {
  workspace: 'inbox' as const,
  items: [
    {
      kind: 'folder' as const,
      path: 'inbox/projects',
      name: 'Projects',
      children: [
        {
          kind: 'folder' as const,
          path: 'inbox/projects/axis',
          name: 'Axis',
          children: [],
        },
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
  beforeEach(() => {
    dnd.props = null
  })

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

  it('marks Inbox rows as drag sources and only folders as drop targets', () => {
    const { rerender } = render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute(
      'data-drag-source',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'Collapse Projects' })
    ).toHaveAttribute('data-drop-target', 'true')

    rerender(
      <NotesExplorerTree
        tree={{ ...tree, workspace: 'trash' }}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Plan' })).not.toHaveAttribute(
      'data-drag-source'
    )
    expect(
      screen.getByRole('button', { name: 'Collapse Projects' })
    ).not.toHaveAttribute('data-drop-target')
  })

  it('moves a note only when it is dropped on a valid Inbox folder', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined)

    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId="plan-id"
        onSelectNote={vi.fn()}
        onMoveItem={onMoveItem}
      />
    )

    await act(async () => {
      dnd.props?.onDragStart?.({
        active: {
          data: { current: { item: { kind: 'note', id: 'root-id' } } },
        },
      })
    })

    await act(async () => {
      dnd.props?.onDragEnd?.({
        active: {
          data: { current: { item: { kind: 'note', id: 'root-id' } } },
        },
        over: { data: { current: { path: 'inbox/projects' } } },
      })
    })

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        { kind: 'note', id: 'root-id' },
        'inbox/projects'
      )
    })
  })

  it('opens a collapsed valid destination folder after 600 ms of drag hover', async () => {
    vi.useFakeTimers()
    try {
      render(
        <NotesExplorerTree
          tree={tree}
          selectedNoteId={null}
          onSelectNote={vi.fn()}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Collapse Projects' }))
      act(() => {
        dnd.props?.onDragStart?.({
          active: {
            data: { current: { item: { kind: 'note', id: 'root-id' } } },
          },
        })
      })
      act(() => {
        dnd.props?.onDragOver?.({
          over: { data: { current: { path: 'inbox/projects' } } },
        })
      })

      act(() => {
        vi.advanceTimersByTime(599)
      })
      expect(
        screen.queryByRole('button', { name: 'Plan' })
      ).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByRole('button', { name: 'Plan' })).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('announces the dragged item and flags an invalid descendant target', async () => {
    render(
      <NotesExplorerTree
        tree={tree}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
      />
    )

    act(() => {
      dnd.props?.onDragStart?.({
        active: {
          data: {
            current: { item: { kind: 'folder', path: 'inbox/projects' } },
          },
        },
      })
    })
    act(() => {
      dnd.props?.onDragOver?.({
        over: { data: { current: { path: 'inbox/projects/axis' } } },
      })
    })

    expect(screen.getByRole('status')).toHaveAccessibleName('Dragging Projects')
    expect(
      screen.getByRole('button', { name: 'Collapse Axis' })
    ).toHaveAttribute('data-drop-state', 'invalid')
    expect(
      screen.getByRole('button', { name: 'Collapse Axis' })
    ).toHaveAccessibleDescription('This folder cannot contain the dragged item')
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

  it('limits Trash to restoring an item', async () => {
    const user = userEvent.setup()
    const onContextAction = vi.fn()
    render(
      <NotesExplorerTree
        tree={{ ...tree, workspace: 'trash' }}
        selectedNoteId={null}
        onSelectNote={vi.fn()}
        onContextAction={onContextAction}
      />
    )

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Plan' }))

    expect(screen.getByRole('menuitem', { name: 'Restore note' })).toBeVisible()
    expect(
      screen.queryByRole('menuitem', { name: 'Archive' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Move to trash' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'New folder' })
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
