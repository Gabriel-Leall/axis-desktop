import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/test/test-utils'
import { NotesTreeActionDialog } from './NotesTreeActionDialog'

describe('NotesTreeActionDialog', () => {
  it('prefills the current name when renaming a folder', () => {
    render(
      <NotesTreeActionDialog
        request={{
          action: 'rename-folder',
          item: { kind: 'folder', path: 'inbox/projects' },
          initialValue: 'Projects',
        }}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    )

    expect(
      screen.getByRole('dialog', { name: 'Rename folder' })
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Folder name' })).toHaveValue(
      'Projects'
    )
  })

  it('keeps the dialog open when the mutation is rejected', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(false)

    render(
      <NotesTreeActionDialog
        request={{
          action: 'create-folder',
          item: { kind: 'folder', path: 'inbox/projects' },
          initialValue: '',
        }}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Folder name' }),
      'Drafts'
    )
    await user.click(screen.getByRole('button', { name: 'Create folder' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Drafts')
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(
      screen.getByRole('dialog', { name: 'New folder' })
    ).toBeInTheDocument()
  })
})
