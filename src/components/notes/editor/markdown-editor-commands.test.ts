import { describe, expect, it } from 'vitest'
import {
  applyMarkdownCommand,
  formatLocalDate,
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

  it('uses the local calendar day for slash-date insertion', () => {
    expect(formatLocalDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })

  it.each([
    ['italic', 'word', { from: 0, to: 4 }, '_word_', { from: 1, to: 5 }],
    [
      'inlineCode',
      'word',
      { from: 0, to: 4 },
      '`word`',
      { from: 1, to: 5 },
    ],
    [
      'bulletList',
      'first\nsecond',
      { from: 8, to: 8 },
      'first\n- second',
      { from: 10, to: 10 },
    ],
    [
      'orderedList',
      'agenda',
      { from: 0, to: 0 },
      '1. agenda',
      { from: 3, to: 3 },
    ],
  ] as const)(
    'applies %s with the expected cursor position',
    (command, content, selection, expectedContent, expectedSelection) => {
      expect(applyMarkdownCommand(command, content, selection)).toEqual({
        content: expectedContent,
        selection: expectedSelection,
      })
    }
  )
})
