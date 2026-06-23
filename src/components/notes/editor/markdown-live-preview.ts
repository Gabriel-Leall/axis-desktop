import {
  HighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  type EditorView,
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

export const markdownLivePreviewPresentation = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    {
      tag: tags.monospace,
      fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
      backgroundColor: 'color-mix(in oklab, var(--muted) 70%, transparent)',
    },
    { tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
  ])
)

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
  const addMarkers = (
    from: number,
    to: number,
    markerRanges: readonly MarkdownMarkerRange[]
  ) => {
    if (!selectionTouchesRange(selection, from, to)) {
      markers.push(...markerRanges)
    }
  }

  for (const match of content.matchAll(/\*\*[^\n*][\s\S]*?\*\*/g)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    addMarkers(start, end, [
      { from: start, to: start + 2 },
      { from: end - 2, to: end },
    ])
  }

  for (const match of content.matchAll(/_([^_\n]+)_/g)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    addMarkers(start, end, [
      { from: start, to: start + 1 },
      { from: end - 1, to: end },
    ])
  }

  for (const match of content.matchAll(/`[^`\n]+`/g)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    addMarkers(start, end, [
      { from: start, to: start + 1 },
      { from: end - 1, to: end },
    ])
  }

  for (const match of content.matchAll(/^(#{1,6})[ \t]+/gm)) {
    const start = match.index ?? 0
    addMarkers(start, start + match[0].length, [
      { from: start, to: start + match[0].length },
    ])
  }

  for (
    const match of content.matchAll(
      /^(?:[-+*][ \t]+(?:\[[ xX]\][ \t]+)?|\d+\.[ \t]+)/gm
    )
  ) {
    const start = match.index ?? 0
    addMarkers(start, start + match[0].length, [
      { from: start, to: start + match[0].length },
    ])
  }

  for (const match of content.matchAll(/\[[^\]\n]+\]\([^)\n]+\)/g)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const labelEnd = start + match[0].indexOf('](')
    addMarkers(start, end, [
      { from: start, to: start + 1 },
      { from: labelEnd, to: labelEnd + 2 },
      { from: end - 1, to: end },
    ])
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
