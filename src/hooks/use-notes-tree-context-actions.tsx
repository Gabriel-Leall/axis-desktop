import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  NotesTreeActionDialog,
  type NotesTreeDialogRequest,
} from '@/components/notes/NotesTreeActionDialog'
import type {
  NotesTreeContextAction,
  NotesTreeItemRef,
} from '@/components/notes/NotesExplorerTree'
import type { NotesWorkspaceView } from '@/store/notes-store'
import { useNotesStore } from '@/store/notes-store'

function treeItemInWorkspace(
  item: NotesTreeItemRef,
  workspace: NotesWorkspaceView
): NotesTreeItemRef {
  if (item.kind === 'note') return item

  const name = item.name ?? item.path.split('/').at(-1) ?? ''
  return { kind: 'folder', path: `${workspace}/${name}`, name: item.name }
}

export function useNotesTreeContextActions() {
  const { t } = useTranslation()
  const [request, setRequest] = useState<NotesTreeDialogRequest | null>(null)
  const workspaceView = useNotesStore(state => state.workspaceView)
  const setWorkspaceView = useNotesStore(state => state.setWorkspaceView)
  const selectNote = useNotesStore(state => state.selectNote)
  const createFolder = useNotesStore(state => state.createFolder)
  const renameFolder = useNotesStore(state => state.renameFolder)
  const moveTreeItem = useNotesStore(state => state.moveTreeItem)
  const archiveTreeItem = useNotesStore(state => state.archiveTreeItem)
  const trashTreeItem = useNotesStore(state => state.trashTreeItem)
  const restoreTreeItem = useNotesStore(state => state.restoreTreeItem)

  const showError = (error: unknown) => {
    toast.error(t('notes.snackbar.actionFailed'), {
      description: String(error),
    })
  }

  async function goToWorkspace(
    view: NotesWorkspaceView,
    noteId: string | null
  ) {
    await setWorkspaceView(view)
    if (noteId) selectNote(noteId)
  }

  async function handleLifecycleAction(
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) {
    if (action === 'archive') {
      await archiveTreeItem(item)
      const archivedItem = treeItemInWorkspace(item, 'archive')
      toast.success(t('notes.snackbar.itemArchived'), {
        action: {
          label: t('common.undo'),
          onClick: () => void restoreTreeItem(archivedItem).catch(showError),
        },
        cancel: {
          label: t('notes.snackbar.viewArchive'),
          onClick: () =>
            void goToWorkspace(
              'archive',
              item.kind === 'note' ? item.id : null
            ).catch(showError),
        },
      })
      return
    }

    if (action === 'trash') {
      await trashTreeItem(item)
      const trashedItem = treeItemInWorkspace(item, 'trash')
      toast.success(t('notes.snackbar.itemMovedToTrash'), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            const undo =
              workspaceView === 'archive'
                ? archiveTreeItem(treeItemInWorkspace(item, 'archive'))
                : restoreTreeItem(trashedItem)
            void undo.catch(showError)
          },
        },
        cancel: {
          label: t('notes.snackbar.viewTrash'),
          onClick: () =>
            void goToWorkspace(
              'trash',
              item.kind === 'note' ? item.id : null
            ).catch(showError),
        },
      })
      return
    }

    if (action === 'restore') {
      await restoreTreeItem(item)
      toast.success(t('notes.snackbar.itemRestored'), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            const undo =
              workspaceView === 'archive'
                ? archiveTreeItem(treeItemInWorkspace(item, 'inbox'))
                : trashTreeItem(treeItemInWorkspace(item, 'inbox'))
            void undo.catch(showError)
          },
        },
        cancel: {
          label: t('notes.snackbar.goToNote'),
          onClick: () =>
            void goToWorkspace(
              'inbox',
              item.kind === 'note' ? item.id : null
            ).catch(showError),
        },
      })
    }
  }

  async function onContextAction(
    action: NotesTreeContextAction,
    item: NotesTreeItemRef
  ) {
    try {
      if (action === 'create-folder' && item.kind === 'folder') {
        setRequest({ action, item, initialValue: '' })
        return
      }
      if (action === 'rename-folder' && item.kind === 'folder') {
        setRequest({
          action,
          item,
          initialValue: item.name ?? item.path.split('/').at(-1) ?? '',
        })
        return
      }
      if (action === 'move') {
        setRequest({ action, item, initialValue: 'inbox' })
        return
      }
      await handleLifecycleAction(action, item)
    } catch (error) {
      showError(error)
    }
  }

  async function onDialogSubmit(value: string): Promise<boolean> {
    if (!request) return false
    try {
      if (
        request.action === 'create-folder' &&
        request.item.kind === 'folder'
      ) {
        await createFolder(request.item.path, value)
        return true
      }
      if (
        request.action === 'rename-folder' &&
        request.item.kind === 'folder'
      ) {
        await renameFolder(request.item.path, value)
        return true
      }
      if (request.action === 'move') {
        await moveTreeItem(request.item, value)
        return true
      }
      return false
    } catch (error) {
      showError(error)
      return false
    }
  }

  const contextDialog = (
    <NotesTreeActionDialog
      key={
        request
          ? `${request.action}:${request.item.kind}:${request.item.kind === 'folder' ? request.item.path : request.item.id}`
          : 'closed'
      }
      request={request}
      onOpenChange={open => {
        if (!open) setRequest(null)
      }}
      onSubmit={onDialogSubmit}
    />
  )

  return { contextDialog, onContextAction }
}
