import { render, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownLiveEditor } from './MarkdownLiveEditor'

Object.defineProperty(Range.prototype, 'getClientRects', {
  configurable: true,
  value: () => [],
})

describe('MarkdownLiveEditor', () => {
  it('saves Markdown body changes without recreating the editor for another note', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { container, rerender } = render(
      <MarkdownLiveEditor
        noteId="one"
        value="- first"
        placeholder="Start writing"
        onChange={onChange}
      />
    )

    await user.click(
      await screen.findByRole('textbox', { name: 'Start writing' })
    )
    await user.keyboard('{End} item')

    expect(onChange).toHaveBeenLastCalledWith('- first item')

    rerender(
      <MarkdownLiveEditor
        noteId="two"
        value="- second"
        placeholder="Start writing"
        onChange={onChange}
      />
    )

    expect(
      await screen.findByRole('textbox', { name: 'Start writing' })
    ).toHaveTextContent('- second')
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1)
  })

  it('renders a read-only editor surface', async () => {
    render(
      <MarkdownLiveEditor
        noteId="readonly"
        value="- archived"
        placeholder="Start writing"
        readOnly
        onChange={vi.fn()}
      />
    )

    expect(await screen.findByRole('textbox', { name: 'Start writing' })).toHaveAttribute(
      'contenteditable',
      'false'
    )
  })
})
