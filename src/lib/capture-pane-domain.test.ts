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

  it('parses supported prefixes', () => {
    expect(parseCapturePaneInput('note: draft home page copy')).toEqual({
      status: 'ok',
      intent: {
        kind: 'note',
        content: 'draft home page copy',
      },
    })
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
