import type { EditorView } from '@codemirror/view'

interface CreateMarkdownEditorOptions {
  host: HTMLElement
  value: string
  placeholder: string
  readOnly: boolean
  isApplyingExternalValue: () => boolean
  onChange: (content: string) => void
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
  ] = await Promise.all([
    import('@lezer/markdown'),
    import('@codemirror/lang-markdown'),
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('./markdown-editor-commands'),
    import('./markdown-live-preview'),
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
      createMarkdownCommandExtensions(),
      EditorView.updateListener.of(update => {
        if (!update.docChanged || options.isApplyingExternalValue()) return
        options.onChange(update.state.doc.toString())
      }),
    ],
  })

  return new EditorView({ state, parent: options.host })
}
