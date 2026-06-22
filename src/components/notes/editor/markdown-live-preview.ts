import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

export interface MarkdownSelectionRange {
  from: number
  to: number
}

interface MarkdownMarkerRange {
  from: number
  to: number
}

const markerNodeNames = new Set([
  'EmphasisMark',
  'CodeMark',
  'HeaderMark',
  'LinkMark',
  'ListMark',
  'QuoteMark',
  'StrikethroughMark',
  'TaskMarker',
])

const hiddenMarker = Decoration.replace({})

export function selectionTouchesRange(
  ranges: readonly MarkdownSelectionRange[],
  from: number,
  to: number
): boolean {
  return ranges.some(range => {
    if (range.from === range.to) {
      return range.from >= from && range.from <= to
    }

    return Math.max(range.from, from) < Math.min(range.to, to)
  })
}

export function getMarkdownMarkerRanges(
  content: string,
  selection: readonly MarkdownSelectionRange[]
): MarkdownMarkerRange[] {
  const markers: MarkdownMarkerRange[] = []
  const expressions = [/\*\*[^\n*][\s\S]*?\*\*/g, /`[^`\n]+`/g]

  for (const expression of expressions) {
    for (const match of content.matchAll(expression)) {
      const start = match.index
      if (start === undefined) continue
      const end = start + match[0].length
      if (selectionTouchesRange(selection, start, end)) continue

      const markerLength = match[0].startsWith('**') ? 2 : 1
      markers.push(
        { from: start, to: start + markerLength },
        { from: end - markerLength, to: end }
      )
    }
  }

  return markers.sort((left, right) => left.from - right.from)
}

function markerDecorations(view: EditorView): DecorationSet {
  const ranges: MarkdownMarkerRange[] = []
  const selection = view.state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }))

  for (const visibleRange of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: node => {
        if (!markerNodeNames.has(node.name)) return

        let to = node.to
        if (node.name === 'HeaderMark' || node.name === 'QuoteMark') {
          const nextCharacter = view.state.doc.sliceString(to, to + 1)
          if (nextCharacter === ' ' || nextCharacter === '\t') to += 1
        }

        if (!selectionTouchesRange(selection, node.from, to)) {
          ranges.push({ from: node.from, to })
        }
      },
    })
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const range of ranges.sort((left, right) => left.from - right.from)) {
    builder.add(range.from, range.to, hiddenMarker)
  }
  return builder.finish()
}

export function createMarkdownLivePreview() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = markerDecorations(view)
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.viewportChanged
        ) {
          this.decorations = markerDecorations(update.view)
        }
      }
    },
    {
      decorations: plugin => plugin.decorations,
    }
  )
}
