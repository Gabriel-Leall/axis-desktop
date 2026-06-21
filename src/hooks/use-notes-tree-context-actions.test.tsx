import { act, renderHook } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { useNotesTreeContextActions } from './use-notes-tree-context-actions'

const store = vi.hoisted(() => ({
  moveTreeItem: vi.fn(),
}))

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/store/notes-store', () => ({
  useNotesStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      workspaceView: 'inbox',
      setWorkspaceView: vi.fn(),
      selectNote: vi.fn(),
      createFolder: vi.fn(),
      renameFolder: vi.fn(),
      moveTreeItem: store.moveTreeItem,
      archiveTreeItem: vi.fn(),
      trashTreeItem: vi.fn(),
      restoreTreeItem: vi.fn(),
    }),
}))

vi.mock('sonner', () => ({
  toast,
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

describe('useNotesTreeContextActions', () => {
  it('uses the same moveTreeItem transaction for a tree drag', async () => {
    store.moveTreeItem.mockResolvedValue(undefined)
    const { result } = renderHook(() => useNotesTreeContextActions(), {
      wrapper,
    })

    await act(async () => {
      await result.current.onMoveTreeItem(
        { kind: 'note', id: 'inbox/root.md' },
        'inbox/projects'
      )
    })

    expect(store.moveTreeItem).toHaveBeenCalledWith(
      { kind: 'note', id: 'inbox/root.md' },
      'inbox/projects'
    )
  })

  it('reports and rethrows a failed tree drag so the explorer can recover', async () => {
    store.moveTreeItem.mockRejectedValue(new Error('vault move failed'))
    const { result } = renderHook(() => useNotesTreeContextActions(), {
      wrapper,
    })

    await expect(
      result.current.onMoveTreeItem(
        { kind: 'folder', path: 'inbox/projects' },
        'inbox/target'
      )
    ).rejects.toThrow('vault move failed')

    expect(toast.error).toHaveBeenCalledWith('Could not update note', {
      description: 'Error: vault move failed',
    })
  })
})
