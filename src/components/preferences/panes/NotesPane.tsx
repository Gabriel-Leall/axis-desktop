import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, FolderSymlink, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { commands, type NoteVaultInfo } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { useNotesStore } from '@/store/notes-store'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'

export function NotesPane() {
  const { t } = useTranslation()
  const [vaultInfo, setVaultInfo] = useState<NoteVaultInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const refreshVaultInfo = useCallback(async () => {
    const result = await commands.getNotesVaultInfo()
    if (result.status === 'error') {
      setError(result.error)
      return
    }

    setVaultInfo(result.data)
    setError(null)
  }, [])

  useEffect(() => {
    void refreshVaultInfo()
  }, [refreshVaultInfo])

  const reloadNotes = useCallback(async () => {
    try {
      await useNotesStore.getState().loadNotes()
    } catch (loadError) {
      logger.warn('Failed to reload notes after vault change', { loadError })
    }
  }, [])

  const handleChooseFolder = useCallback(async () => {
    setIsBusy(true)
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      const result = await commands.setNotesVaultPath(selected)
      if (result.status === 'error') {
        setError(result.error)
        toast.error(t('preferences.notes.vault.errorTitle'), {
          description: result.error,
        })
        return
      }

      setVaultInfo(result.data)
      setError(null)
      await reloadNotes()
      toast.success(t('preferences.notes.vault.changed'))
    } catch (chooseError) {
      const message = String(chooseError)
      setError(message)
      toast.error(t('preferences.notes.vault.errorTitle'), {
        description: message,
      })
    } finally {
      setIsBusy(false)
    }
  }, [reloadNotes, t])

  const handleUseDefault = useCallback(async () => {
    setIsBusy(true)
    try {
      const result = await commands.resetNotesVaultPath()
      if (result.status === 'error') {
        setError(result.error)
        toast.error(t('preferences.notes.vault.errorTitle'), {
          description: result.error,
        })
        return
      }

      setVaultInfo(result.data)
      setError(null)
      await reloadNotes()
      toast.success(t('preferences.notes.vault.defaultRestored'))
    } finally {
      setIsBusy(false)
    }
  }, [reloadNotes, t])

  const handleOpenFolder = useCallback(async () => {
    const result = await commands.openNotesVaultFolder()
    if (result.status === 'error') {
      setError(result.error)
      toast.error(t('preferences.notes.vault.errorTitle'), {
        description: result.error,
      })
    }
  }, [t])

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.notes.localVault')}>
        <SettingsField
          label={t('preferences.notes.vault.location')}
          description={t('preferences.notes.vault.description')}
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="break-all font-mono text-xs text-muted-foreground">
                {vaultInfo?.path ?? t('preferences.notes.vault.loading')}
              </p>
              {vaultInfo?.is_default && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('preferences.notes.vault.defaultBadge')}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void handleUseDefault()}
                  disabled={isBusy}
                >
                  <RotateCcw className="size-3.5" />
                  {t('preferences.notes.vault.useDefault')}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleChooseFolder()}
                disabled={isBusy}
              >
                <FolderSymlink className="size-3.5" />
                {t('preferences.notes.vault.changeFolder')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleOpenFolder()}
                disabled={isBusy || !vaultInfo}
              >
                <FolderOpen className="size-3.5" />
                {t('preferences.notes.vault.openFolder')}
              </Button>
            </div>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
