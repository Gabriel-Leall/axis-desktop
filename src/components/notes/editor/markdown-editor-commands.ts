import {
  autocompletion,
  type CompletionContext,
} from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from '@codemirror/commands'
import { keymap, type Command } from '@codemirror/view'

export type MarkdownCommand =
  | 'bold'
  | 'italic'
  | 'inlineCode'
  | 'heading1'
  | 'bulletList'
  | 'orderedList'
  | 'checklist'
  | 'quote'
  | 'divider'
  | 'codeBlock'
  | 'date'

export interface MarkdownCommandResult {
  content: string
  selection: { from: number; to: number }
}

const slashCommandInsertions = {
  bold: '**',
  italic: '_',
  inlineCode: '`',
  heading1: '# ',
  bulletList: '- ',
  orderedList: '1. ',
  checklist: '- [ ] ',
  quote: '> ',
  divider: '---\n',
  codeBlock: '```\n\n```',
  date: new Date().toISOString().slice(0, 10),
} as const

export function getSlashCommandInsertion(
  command: keyof typeof slashCommandInsertions
): string {
  return slashCommandInsertions[command]
}

function lineStart(content: string, position: number): number {
  return content.lastIndexOf('\n', Math.max(0, position - 1)) + 1
}

function wrapSelection(
  content: string,
  selection: { from: number; to: number },
  marker: string
): MarkdownCommandResult {
  const selected = content.slice(selection.from, selection.to)
  const insertion = `${marker}${selected}${marker}`
  return {
    content:
      content.slice(0, selection.from) + insertion + content.slice(selection.to),
    selection: {
      from: selection.from + marker.length,
      to: selection.from + marker.length + selected.length,
    },
  }
}

export function applyMarkdownCommand(
  command: MarkdownCommand,
  content: string,
  selection: { from: number; to: number }
): MarkdownCommandResult {
  if (command === 'bold') return wrapSelection(content, selection, '**')
  if (command === 'italic') return wrapSelection(content, selection, '_')
  if (command === 'inlineCode') return wrapSelection(content, selection, '`')

  const prefix = getSlashCommandInsertion(command)
  const start = lineStart(content, selection.from)
  const nextContent = content.slice(0, start) + prefix + content.slice(start)
  const offset = prefix.length

  return {
    content: nextContent,
    selection: {
      from: selection.from + offset,
      to: selection.to + offset,
    },
  }
}

function runMarkdownCommand(command: MarkdownCommand): Command {
  return view => {
    const result = applyMarkdownCommand(
      command,
      view.state.doc.toString(),
      view.state.selection.main
    )
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: result.content,
      },
      selection: {
        anchor: result.selection.from,
        head: result.selection.to,
      },
    })
    return true
  }
}

function slashCompletions(context: CompletionContext) {
  const match = context.matchBefore(/\/[a-z]*/)
  if (!match || (match.from === match.to && !context.explicit)) return null

  return {
    from: match.from,
    options: (Object.keys(slashCommandInsertions) as MarkdownCommand[]).map(
      command => ({
        label: `/${command}`,
        type: 'keyword',
        apply: getSlashCommandInsertion(command),
      })
    ),
  }
}

export function createMarkdownCommandExtensions() {
  return [
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      { key: 'Mod-b', run: runMarkdownCommand('bold') },
      { key: 'Mod-i', run: runMarkdownCommand('italic') },
      { key: 'Mod-Alt-1', run: runMarkdownCommand('heading1') },
      { key: 'Mod-z', run: undo },
      { key: 'Mod-Shift-z', run: redo },
    ]),
    autocompletion({ override: [slashCompletions] }),
  ]
}
