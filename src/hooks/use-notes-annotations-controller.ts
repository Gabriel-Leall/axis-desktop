import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { MarkdownAnnotationMarker } from '@/components/notes/editor/markdown-annotation-extension'
import { logger } from '@/lib/logger'
import type { Note } from '@/lib/notes-domain'
import { useNotesStore } from '@/store/notes-store'

export type NotesEditorSelection = {
  from: number
  to: number
  text: string
} | null

export function useNotesAnnotationsController(activeNote: Note | null) {
  const { t } = useTranslation()
  const [selectionDraft, setSelectionDraft] = useState<{
    noteId: string
    selection: NotesEditorSelection
  } | null>(null)
  const annotations = useNotesStore(state => state.annotations)
  const selectedAnnotationId = useNotesStore(
    state => state.selectedAnnotationId
  )
  const annotationsPanelOpen = useNotesStore(
    state => state.annotationsPanelOpen
  )
  const loadAnnotations = useNotesStore(state => state.loadAnnotations)
  const createAnnotation = useNotesStore(state => state.createAnnotation)
  const updateAnnotationText = useNotesStore(
    state => state.updateAnnotationText
  )
  const resolveAnnotation = useNotesStore(state => state.resolveAnnotation)
  const reopenAnnotation = useNotesStore(state => state.reopenAnnotation)
  const deleteAnnotation = useNotesStore(state => state.deleteAnnotation)
  const repositionAnnotation = useNotesStore(
    state => state.repositionAnnotation
  )
  const replaceLocalAnnotations = useNotesStore(
    state => state.replaceLocalAnnotations
  )
  const selectAnnotation = useNotesStore(state => state.selectAnnotation)
  const setAnnotationsPanelOpen = useNotesStore(
    state => state.setAnnotationsPanelOpen
  )
  const activeSelection =
    selectionDraft && selectionDraft.noteId === activeNote?.id
      ? selectionDraft.selection
      : null

  useEffect(() => {
    if (!activeNote?.id) return

    void loadAnnotations(activeNote.id).catch(error => {
      logger.error(`Failed to load annotations for note: ${String(error)}`)
    })
  }, [activeNote?.id, loadAnnotations])

  async function handleCreateAnnotation() {
    if (!activeNote || !activeSelection) return

    try {
      await createAnnotation({
        noteId: activeNote.id,
        from: activeSelection.from,
        to: activeSelection.to,
        text: t('notes.annotations.defaultComment'),
      })
    } catch (error) {
      toast.error(t('notes.annotations.createFailed'), {
        description: String(error),
      })
    }
  }

  function handleSelectionChange(selection: NotesEditorSelection) {
    if (!activeNote?.id) {
      setSelectionDraft(null)
      return
    }

    setSelectionDraft({ noteId: activeNote.id, selection })
  }

  function handleAnnotationsChange(nextMarkers: MarkdownAnnotationMarker[]) {
    const markersById = new Map(nextMarkers.map(marker => [marker.id, marker]))
    replaceLocalAnnotations(
      annotations.map(annotation => {
        const marker = markersById.get(annotation.id)
        return marker
          ? {
              ...annotation,
              from: marker.from,
              to: marker.to,
              anchor_status: marker.anchor_status,
            }
          : annotation
      })
    )
  }

  function handleSelectAnnotation(annotationId: string) {
    selectAnnotation(annotationId)
    setAnnotationsPanelOpen(true)
  }

  return {
    annotations,
    selectedAnnotationId,
    annotationsPanelOpen,
    activeSelection,
    handleCreateAnnotation,
    handleSelectionChange,
    handleSelectAnnotation,
    handleAnnotationsChange,
    updateAnnotationText,
    resolveAnnotation,
    reopenAnnotation,
    deleteAnnotation,
    repositionAnnotation,
    setAnnotationsPanelOpen,
  }
}
