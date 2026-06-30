import {
  Check,
  LocateFixed,
  MessageSquare,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { NoteAnnotation } from '@/lib/tauri-bindings'
import { cn } from '@/lib/utils'

const annotationButtonClass =
  'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface NotesAnnotationsPanelProps {
  noteId: string
  annotations: NoteAnnotation[]
  selectedAnnotationId: string | null
  activeSelection: { from: number; to: number; text: string } | null
  onClose: () => void
  onSelect: (annotationId: string) => void
  onUpdateText: (
    noteId: string,
    annotationId: string,
    text: string
  ) => Promise<void>
  onResolve: (noteId: string, annotationId: string) => Promise<void>
  onReopen: (noteId: string, annotationId: string) => Promise<void>
  onDelete: (noteId: string, annotationId: string) => Promise<void>
  onReposition: (
    noteId: string,
    annotationId: string,
    from: number,
    to: number
  ) => Promise<void>
}

export function NotesAnnotationsPanel({
  noteId,
  annotations,
  selectedAnnotationId,
  activeSelection,
  onClose,
  onSelect,
  onUpdateText,
  onResolve,
  onReopen,
  onDelete,
  onReposition,
}: NotesAnnotationsPanelProps) {
  const { t } = useTranslation()
  const showActionError = (error: unknown) => {
    toast.error(t('notes.annotations.actionFailed'), {
      description: String(error),
    })
  }

  const runAnnotationAction = (action: () => Promise<void>) => {
    void action().catch(showActionError)
  }

  return (
    <aside className="notes-paper-sidebar flex h-full w-72 shrink-0 flex-col border-s border-border/70 text-card-foreground">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageSquare className="size-4" />
            {t('notes.annotations.title')}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('notes.annotations.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t('notes.annotations.close')}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {annotations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 px-3 py-5 text-center text-xs text-muted-foreground">
            {t('notes.annotations.empty')}
          </div>
        ) : (
          annotations.map(annotation => {
            const isSelected = annotation.id === selectedAnnotationId
            const isLost = annotation.anchor_status === 'lost'
            const isResolved = annotation.state === 'resolved'

            return (
              <article
                key={annotation.id}
                className={cn(
                  'rounded-xl border bg-background/45 p-3 shadow-sm transition-colors',
                  isSelected
                    ? 'border-primary/45'
                    : 'border-border/70 hover:border-border'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(annotation.id)}
                  className="mb-2 flex w-full items-start gap-2 rounded-md text-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'mt-0.5 size-2 rounded-full',
                      isLost
                        ? 'bg-destructive'
                        : isResolved
                          ? 'bg-muted-foreground'
                          : 'bg-primary'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-medium text-foreground">
                      {isLost
                        ? t('notes.annotations.lostAnchor')
                        : annotation.quote}
                    </span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {isResolved
                        ? t('notes.annotations.resolved')
                        : t('notes.annotations.active')}
                    </span>
                  </span>
                </button>

                <textarea
                  defaultValue={annotation.text}
                  onBlur={event => {
                    const nextText = event.target.value
                    if (nextText !== annotation.text) {
                      runAnnotationAction(() =>
                        onUpdateText(noteId, annotation.id, nextText)
                      )
                    }
                  }}
                  className="min-h-20 w-full resize-none rounded-lg border border-border/70 bg-card/50 p-2 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={t('notes.annotations.commentLabel')}
                />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(annotation.id)}
                    className={annotationButtonClass}
                  >
                    <LocateFixed className="size-3" />
                    {t('notes.annotations.goToAnchor')}
                  </button>
                  {isResolved ? (
                    <button
                      type="button"
                      onClick={() =>
                        runAnnotationAction(() =>
                          onReopen(noteId, annotation.id)
                        )
                      }
                      className={annotationButtonClass}
                    >
                      <RotateCcw className="size-3" />
                      {t('notes.annotations.reopen')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        runAnnotationAction(() =>
                          onResolve(noteId, annotation.id)
                        )
                      }
                      className={annotationButtonClass}
                    >
                      <Check className="size-3" />
                      {t('notes.annotations.resolve')}
                    </button>
                  )}
                  {isLost && activeSelection && (
                    <button
                      type="button"
                      onClick={() =>
                        runAnnotationAction(() =>
                          onReposition(
                            noteId,
                            annotation.id,
                            activeSelection.from,
                            activeSelection.to
                          )
                        )
                      }
                      className={annotationButtonClass}
                    >
                      {t('notes.annotations.reposition')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      runAnnotationAction(() =>
                        onDelete(noteId, annotation.id)
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Trash2 className="size-3" />
                    {t('notes.annotations.delete')}
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </aside>
  )
}
