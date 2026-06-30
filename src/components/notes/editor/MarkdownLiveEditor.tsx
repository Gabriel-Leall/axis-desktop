import { useEffect, useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { createMarkdownEditor } from './markdown-editor-runtime'
import {
  setMarkdownAnnotationsEffect,
  type MarkdownAnnotationMarker,
} from './markdown-annotation-extension'

interface MarkdownLiveEditorProps {
  noteId: string
  value: string
  placeholder: string
  readOnly?: boolean
  annotations?: MarkdownAnnotationMarker[]
  onChange: (content: string) => void
  onSelectionChange?: (
    selection: { from: number; to: number; text: string } | null
  ) => void
  onSelectAnnotation?: (annotationId: string) => void
  onAnnotationsChange?: (annotations: MarkdownAnnotationMarker[]) => void
}

const EMPTY_ANNOTATIONS: MarkdownAnnotationMarker[] = []

function replaceEditorDocument(view: EditorView, value: string) {
  const selection = view.state.selection.main
  const limit = value.length

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
    selection: {
      anchor: Math.min(selection.anchor, limit),
      head: Math.min(selection.head, limit),
    },
  })
}

export function MarkdownLiveEditor({
  noteId,
  value,
  placeholder: placeholderText,
  readOnly = false,
  annotations = EMPTY_ANNOTATIONS,
  onChange,
  onSelectionChange,
  onSelectAnnotation,
  onAnnotationsChange,
}: MarkdownLiveEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onSelectAnnotationRef = useRef(onSelectAnnotation)
  const onAnnotationsChangeRef = useRef(onAnnotationsChange)
  const annotationsRef = useRef(annotations)
  const applyingExternalValueRef = useRef(false)
  const initialConfigRef = useRef({
    value,
    placeholderText,
    readOnly,
    annotations,
  })
  const latestValueRef = useRef(value)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useEffect(() => {
    onSelectAnnotationRef.current = onSelectAnnotation
  }, [onSelectAnnotation])

  useEffect(() => {
    onAnnotationsChangeRef.current = onAnnotationsChange
  }, [onAnnotationsChange])

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

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
      annotations: initialConfig.annotations,
      isApplyingExternalValue: () => applyingExternalValueRef.current,
      getAnnotations: () => annotationsRef.current,
      onChange: content => onChangeRef.current(content),
      onSelectionChange: selection => onSelectionChangeRef.current?.(selection),
      onSelectAnnotation: annotationId =>
        onSelectAnnotationRef.current?.(annotationId),
      onAnnotationsChange: nextAnnotations =>
        onAnnotationsChangeRef.current?.(nextAnnotations),
    }).then(view => {
      if (disposed) {
        view.destroy()
        return
      }

      createdView = view
      viewRef.current = view

      const latestValue = latestValueRef.current
      if (view.state.doc.toString() !== latestValue) {
        applyingExternalValueRef.current = true
        replaceEditorDocument(view, latestValue)
        applyingExternalValueRef.current = false
      }
    })

    return () => {
      disposed = true
      createdView?.destroy()
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    view.dispatch({
      effects: setMarkdownAnnotationsEffect.of(annotations),
    })
  }, [annotations])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return

    applyingExternalValueRef.current = true
    replaceEditorDocument(view, value)
    applyingExternalValueRef.current = false
  }, [noteId, value])

  return <div ref={hostRef} className="notes-codemirror min-h-0 flex-1" />
}
