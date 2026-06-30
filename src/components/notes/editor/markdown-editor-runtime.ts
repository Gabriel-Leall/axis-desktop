import type { EditorView } from '@codemirror/view'
import type { MarkdownAnnotationMarker } from './markdown-annotation-extension'

interface CreateMarkdownEditorOptions {
  host: HTMLElement
  value: string
  placeholder: string
  readOnly: boolean
  annotations: MarkdownAnnotationMarker[]
  isApplyingExternalValue: () => boolean
  getAnnotations: () => MarkdownAnnotationMarker[]
  onChange: (content: string) => void
  onSelectionChange: (
    selection: { from: number; to: number; text: string } | null
  ) => void
  onSelectAnnotation: (annotationId: string) => void
  onAnnotationsChange: (annotations: MarkdownAnnotationMarker[]) => void
}

/**
 * Loads the editor implementation only when a note is opened. Keeping this
 * outside the React component preserves Compiler optimization and initial load.
 */
export async function createMarkdownEditor(
  options: CreateMarkdownEditorOptions
): Promise<EditorView> {
  const [
    { GFM },
    { markdown },
    { Compartment, EditorState },
    { placeholder, EditorView },
    { createMarkdownCommandExtensions },
    { createMarkdownLivePreview, markdownLivePreviewPresentation },
    { createMarkdownAnnotationExtension },
  ] = await Promise.all([
    import('@lezer/markdown'),
    import('@codemirror/lang-markdown'),
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('./markdown-editor-commands'),
    import('./markdown-live-preview'),
    import('./markdown-annotation-extension'),
  ])

  const editableCompartment = new Compartment()
  const state = EditorState.create({
    doc: options.value,
    extensions: [
      markdown({ extensions: [GFM] }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': options.placeholder }),
      placeholder(options.placeholder),
      editableCompartment.of([
        EditorView.editable.of(!options.readOnly),
        EditorState.readOnly.of(options.readOnly),
      ]),
      markdownLivePreviewPresentation,
      createMarkdownLivePreview(),
      createMarkdownAnnotationExtension({
        annotations: options.annotations,
        onSelectAnnotation: options.onSelectAnnotation,
      }),
      createMarkdownCommandExtensions(),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !options.isApplyingExternalValue()) {
          const mappedAnnotations = options.getAnnotations().map(annotation => {
            if (annotation.anchor_status === 'lost') return annotation
            const from = update.changes.mapPos(annotation.from, 1)
            const to = update.changes.mapPos(annotation.to, -1)
            return {
              ...annotation,
              from,
              to,
              anchor_status:
                from < to ? annotation.anchor_status : ('lost' as const),
            }
          })
          options.onAnnotationsChange(mappedAnnotations)
        }

        if (update.selectionSet) {
          const selection = update.state.selection.main
          options.onSelectionChange(
            selection.empty
              ? null
              : {
                  from: selection.from,
                  to: selection.to,
                  text: update.state.doc.sliceString(
                    selection.from,
                    selection.to
                  ),
                }
          )
        }

        if (!update.docChanged || options.isApplyingExternalValue()) return
        options.onChange(update.state.doc.toString())
      }),
    ],
  })

  return new EditorView({ state, parent: options.host })
}
