import { parseCapturePaneInput } from '@/lib/capture-pane-domain'

describe('capture-pane-domain', () => {
  it('defaults raw text to a task', () => {
    expect(parseCapturePaneInput('Ship release notes')).toEqual({
      status: 'ok',
      intent: {
        kind: 'task',
        content: 'Ship release notes',
      },
    })
  })

  it('uses the selected visual mode for raw text', () => {
    expect(parseCapturePaneInput('Walk after lunch', 'habit')).toEqual({
      status: 'ok',
      intent: {
        kind: 'habit',
        content: 'Walk after lunch',
      },
    })
  })

  it('parses supported prefixes', () => {
    expect(parseCapturePaneInput('note: draft home page copy')).toEqual({
      status: 'ok',
      intent: {
        kind: 'note',
        content: 'draft home page copy',
      },
    })
  })

  it('preserves multiline content after a supported prefix', () => {
    expect(parseCapturePaneInput('note: draft copy\nsecond paragraph')).toEqual(
      {
        status: 'ok',
        intent: {
          kind: 'note',
          content: 'draft copy\nsecond paragraph',
        },
      }
    )
  })

  it('rejects unknown prefixes with help context', () => {
    expect(parseCapturePaneInput('foo: bar')).toEqual({
      status: 'error',
      reason: 'unknown-prefix',
      prefix: 'foo',
    })
  })

  it('rejects empty content after a known prefix', () => {
    expect(parseCapturePaneInput('focus:   ')).toEqual({
      status: 'error',
      reason: 'insufficient-content',
      prefix: 'focus',
    })
  })

  it('rejects fully empty input', () => {
    expect(parseCapturePaneInput('   ')).toEqual({
      status: 'error',
      reason: 'empty',
    })
  })
})
