import { useEffect, useRef } from 'react'
import { GFM } from '@lezer/markdown'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { placeholder } from '@codemirror/view'
import { EditorView } from '@codemirror/view'
import { createMarkdownCommandExtensions } from './markdown-editor-commands'
import {
  createMarkdownLivePreview,
  markdownLivePreviewPresentation,
} from './markdown-live-preview'

interface MarkdownLiveEditorProps {
  noteId: string
  value: string
  placeholder: string
  readOnly?: boolean
  onChange: (content: string) => void
}

export function MarkdownLiveEditor({
  noteId,
  value,
  placeholder: placeholderText,
  readOnly = false,
  onChange,
}: MarkdownLiveEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const applyingExternalValueRef = useRef(false)
  const editableCompartmentRef = useRef(new Compartment())
  const initialConfigRef = useRef({ value, placeholderText, readOnly })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const initialConfig = initialConfigRef.current
    const editableCompartment = editableCompartmentRef.current
    const state = EditorState.create({
      doc: initialConfig.value,
      extensions: [
        markdown({ extensions: [GFM] }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': initialConfig.placeholderText,
        }),
        placeholder(initialConfig.placeholderText),
        editableCompartment.of([
          EditorView.editable.of(!initialConfig.readOnly),
          EditorState.readOnly.of(initialConfig.readOnly),
        ]),
        markdownLivePreviewPresentation,
        createMarkdownLivePreview(),
        createMarkdownCommandExtensions(),
        EditorView.updateListener.of(update => {
          if (!update.docChanged || applyingExternalValueRef.current) return
          onChangeRef.current(update.state.doc.toString())
        }),
      ],
    })
    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return

    applyingExternalValueRef.current = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: 0 },
    })
    applyingExternalValueRef.current = false
  }, [noteId, value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
    })
  }, [readOnly])

  return <div ref={hostRef} className="notes-codemirror min-h-0 flex-1" />
}
