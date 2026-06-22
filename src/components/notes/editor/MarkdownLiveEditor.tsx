import { useEffect, useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { createMarkdownEditor } from './markdown-editor-runtime'

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
  const initialConfigRef = useRef({ value, placeholderText, readOnly })
  const latestValueRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let createdView: EditorView | null = null
    const initialConfig = initialConfigRef.current

    void createMarkdownEditor({
      host,
      value: latestValueRef.current,
      placeholder: initialConfig.placeholderText,
      readOnly: initialConfig.readOnly,
      isApplyingExternalValue: () => applyingExternalValueRef.current,
      onChange: content => onChangeRef.current(content),
    }).then(view => {
      if (disposed) {
        view.destroy()
        return
      }

      createdView = view
      viewRef.current = view
    })

    return () => {
      disposed = true
      createdView?.destroy()
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

  return <div ref={hostRef} className="notes-codemirror min-h-0 flex-1" />
}
