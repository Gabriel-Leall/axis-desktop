import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, FolderSymlink, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import { useNotesStore } from '@/store/notes-store'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'

function getVaultErrorMessage(
  message: string,
  t: (key: string) => string
): string {
  if (message === 'Notes vault path cannot be empty') {
    return t('preferences.notes.vault.errors.emptyPath')
  }

  if (message === 'Notes vault path must be absolute') {
    return t('preferences.notes.vault.errors.relativePath')
  }

  if (message === 'Configured notes vault path must be absolute') {
    return t('preferences.notes.vault.errors.configuredRelativePath')
  }

  if (message === 'Selected notes vault path is not a directory') {
    return t('preferences.notes.vault.errors.notDirectory')
  }

  return t('preferences.notes.vault.errors.generic')
}

export function NotesPane() {
  const { t } = useTranslation()
  const vaultInfo = useNotesStore(state => state.vaultInfo)
  const vaultError = useNotesStore(state => state.vaultError)
  const loadVaultInfo = useNotesStore(state => state.loadVaultInfo)
  const setVaultPath = useNotesStore(state => state.setVaultPath)
  const resetVaultPath = useNotesStore(state => state.resetVaultPath)
  const openVaultFolder = useNotesStore(state => state.openVaultFolder)
  const [isBusy, setIsBusy] = useState(false)
  const error = vaultError ? getVaultErrorMessage(vaultError, t) : null

  useEffect(() => {
    let isMounted = true

    void loadVaultInfo().catch(vaultError => {
      if (isMounted) {
        logger.warn('Failed to load notes vault info', { vaultError })
      }
    })

    return () => {
      isMounted = false
    }
  }, [loadVaultInfo])

  function showVaultError(message: string) {
    logger.warn('Notes vault operation failed', { message })
    const description = getVaultErrorMessage(message, t)
    toast.error(t('preferences.notes.vault.errorTitle'), {
      description,
    })
  }

  async function handleChooseFolder() {
    setIsBusy(true)

    const selected = await open({
      directory: true,
      multiple: false,
    }).catch(chooseError => {
      showVaultError(String(chooseError))
      return null
    })

    if (!selected || Array.isArray(selected)) {
      setIsBusy(false)
      return
    }

    try {
      await setVaultPath(selected)
      toast.success(t('preferences.notes.vault.changed'))
    } catch (commandError) {
      showVaultError(String(commandError))
      setIsBusy(false)
      return
    }

    setIsBusy(false)
  }

  async function handleUseDefault() {
    setIsBusy(true)

    try {
      await resetVaultPath()
      toast.success(t('preferences.notes.vault.defaultRestored'))
    } catch (commandError) {
      showVaultError(String(commandError))
      setIsBusy(false)
      return
    }

    setIsBusy(false)
  }

  async function handleOpenFolder() {
    try {
      await openVaultFolder()
    } catch (commandError) {
      showVaultError(String(commandError))
    }
  }

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
