import { describe, expect, it } from 'vitest'
import {
  applyMarkdownCommand,
  getSlashCommandInsertion,
} from './markdown-editor-commands'

describe('markdown editor commands', () => {
  it('wraps selected text with Markdown strong markers', () => {
    expect(
      applyMarkdownCommand('bold', 'word', { from: 0, to: 4 })
    ).toEqual({ content: '**word**', selection: { from: 2, to: 6 } })
  })

  it('inserts a heading prefix on the current line', () => {
    expect(
      applyMarkdownCommand('heading1', 'agenda', { from: 0, to: 0 })
    ).toEqual({ content: '# agenda', selection: { from: 2, to: 2 } })
  })

  it('maps slash commands to valid Markdown blocks', () => {
    expect(getSlashCommandInsertion('quote')).toBe('> ')
    expect(getSlashCommandInsertion('checklist')).toBe('- [ ] ')
    expect(getSlashCommandInsertion('divider')).toBe('---\n')
  })
})
