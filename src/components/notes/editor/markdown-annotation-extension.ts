import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'

export interface MarkdownAnnotationMarker {
  id: string
  from: number
  to: number
  state: 'active' | 'resolved'
  anchor_status: 'anchored' | 'lost'
}

export interface MarkdownAnnotationRange {
  id: string
  from: number
  to: number
  className: string
}

export const setMarkdownAnnotationsEffect =
  StateEffect.define<MarkdownAnnotationMarker[]>()

export function getMarkdownAnnotationRanges(
  annotations: readonly MarkdownAnnotationMarker[],
  docLength: number
): MarkdownAnnotationRange[] {
  return annotations.flatMap(annotation => {
    const from = Math.max(0, Math.min(annotation.from, docLength))
    const to = Math.max(0, Math.min(annotation.to, docLength))

    if (annotation.anchor_status !== 'anchored' || from >= to) {
      return []
    }

    return [
      {
        id: annotation.id,
        from,
        to,
        className:
          annotation.state === 'resolved'
            ? 'cm-notes-annotation cm-notes-annotation-resolved'
            : 'cm-notes-annotation',
      },
    ]
  })
}

function buildAnnotationDecorations(
  annotations: readonly MarkdownAnnotationMarker[],
  docLength: number
): DecorationSet {
  const ranges = getMarkdownAnnotationRanges(annotations, docLength)

  return Decoration.set(
    ranges.map(range =>
      Decoration.mark({
        class: range.className,
        attributes: {
          'data-annotation-id': range.id,
        },
      }).range(range.from, range.to)
    ),
    true
  )
}

function annotationIdFromEventTarget(
  target: EventTarget | null
): string | null {
  if (!(target instanceof HTMLElement)) return null
  const annotationElement = target.closest<HTMLElement>('[data-annotation-id]')
  return annotationElement?.dataset.annotationId ?? null
}

export function createMarkdownAnnotationExtension({
  annotations,
  onSelectAnnotation,
}: {
  annotations: readonly MarkdownAnnotationMarker[]
  onSelectAnnotation: (annotationId: string) => void
}): Extension {
  const annotationField = StateField.define<DecorationSet>({
    create(state) {
      return buildAnnotationDecorations(annotations, state.doc.length)
    },
    update(value, transaction) {
      let decorations = value.map(transaction.changes)

      for (const effect of transaction.effects) {
        if (effect.is(setMarkdownAnnotationsEffect)) {
          decorations = buildAnnotationDecorations(
            effect.value,
            transaction.state.doc.length
          )
        }
      }

      return decorations
    },
    provide: field => EditorView.decorations.from(field),
  })

  return [
    annotationField,
    EditorView.domEventHandlers({
      mousedown(event) {
        const annotationId = annotationIdFromEventTarget(event.target)
        if (!annotationId) return false
        onSelectAnnotation(annotationId)
        return false
      },
    }),
    EditorView.baseTheme({
      '.cm-notes-annotation': {
        borderBottom: '2px solid hsl(var(--primary) / 0.55)',
        backgroundColor: 'hsl(var(--primary) / 0.12)',
        borderRadius: '0.2em',
      },
      '.cm-notes-annotation-resolved': {
        borderBottomStyle: 'dashed',
        opacity: '0.72',
      },
    }),
  ]
}
