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
    const callsBeforeExternalSync = onChange.mock.calls.length

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
    expect(onChange).toHaveBeenCalledTimes(callsBeforeExternalSync)
  })

  it('renders a read-only editor surface', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MarkdownLiveEditor
        noteId="readonly"
        value="- archived"
        placeholder="Start writing"
        readOnly
        onChange={onChange}
      />
    )

    const editor = await screen.findByRole('textbox', { name: 'Start writing' })
    expect(editor).toHaveAttribute('contenteditable', 'false')

    await user.click(editor)
    await user.keyboard(' ignored')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('uses the latest note value when props change while the editor loads', async () => {
    const { rerender } = render(
      <MarkdownLiveEditor
        noteId="first"
        value="first draft"
        placeholder="Start writing"
        onChange={vi.fn()}
      />
    )

    rerender(
      <MarkdownLiveEditor
        noteId="second"
        value="second draft"
        placeholder="Start writing"
        onChange={vi.fn()}
      />
    )

    expect(
      await screen.findByRole('textbox', { name: 'Start writing' })
    ).toHaveTextContent('second draft')
  })
})
