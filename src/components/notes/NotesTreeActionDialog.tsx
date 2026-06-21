import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { NotesTreeItemRef } from './NotesExplorerTree'

export type NotesTreeDialogAction = 'create-folder' | 'rename-folder' | 'move'

export interface NotesTreeDialogRequest {
  action: NotesTreeDialogAction
  item: NotesTreeItemRef
  initialValue: string
}

interface NotesTreeActionDialogProps {
  request: NotesTreeDialogRequest | null
  onOpenChange: (open: boolean) => void
  onSubmit: (value: string) => Promise<boolean>
}

const DIALOG_KEYS: Record<
  NotesTreeDialogAction,
  {
    description: string
    inputLabel: string
    placeholder: string
    submit: string
    title: string
  }
> = {
  'create-folder': {
    title: 'notes.contextMenu.newFolder',
    description: 'notes.contextMenu.dialog.createFolderDescription',
    inputLabel: 'notes.contextMenu.dialog.folderName',
    placeholder: 'notes.contextMenu.dialog.folderNamePlaceholder',
    submit: 'notes.contextMenu.dialog.create',
  },
  'rename-folder': {
    title: 'notes.contextMenu.renameFolder',
    description: 'notes.contextMenu.dialog.renameFolderDescription',
    inputLabel: 'notes.contextMenu.dialog.folderName',
    placeholder: 'notes.contextMenu.dialog.folderNamePlaceholder',
    submit: 'notes.contextMenu.dialog.rename',
  },
  move: {
    title: 'notes.contextMenu.move',
    description: 'notes.contextMenu.dialog.moveDescription',
    inputLabel: 'notes.contextMenu.dialog.destinationFolder',
    placeholder: 'notes.contextMenu.dialog.destinationFolderPlaceholder',
    submit: 'notes.contextMenu.dialog.move',
  },
}

export function NotesTreeActionDialog({
  request,
  onOpenChange,
  onSubmit,
}: NotesTreeActionDialogProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setValue(request?.initialValue ?? '')
    setIsSubmitting(false)
  }, [request])

  if (!request) return null

  const keys = DIALOG_KEYS[request.action]
  const valueIsBlank = value.trim().length === 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valueIsBlank || isSubmitting) return

    setIsSubmitting(true)
    try {
      const didSubmit = await onSubmit(value.trim())
      if (didSubmit) onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!isSubmitting) onOpenChange(open)
      }}
    >
      <DialogContent
        className="notes-paper-dialog"
        showCloseButton={!isSubmitting}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t(keys.title)}</DialogTitle>
            <DialogDescription>{t(keys.description)}</DialogDescription>
          </DialogHeader>
          <div className="mt-5">
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor="notes-tree-action-value"
            >
              {t(keys.inputLabel)}
            </label>
            <Input
              autoFocus
              disabled={isSubmitting}
              id="notes-tree-action-value"
              onChange={event => setValue(event.target.value)}
              placeholder={t(keys.placeholder)}
              value={value}
            />
          </div>
          <DialogFooter className="mt-6">
            <button
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              type="button"
            >
              {t('common.cancel')}
            </button>
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={valueIsBlank || isSubmitting}
              type="submit"
            >
              {t(keys.submit)}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
