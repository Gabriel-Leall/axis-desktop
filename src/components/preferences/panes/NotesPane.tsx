import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Copy,
  FolderOpen,
  FolderSymlink,
  MoveRight,
  RotateCcw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import type { NoteVaultMigrationMode } from '@/lib/tauri-bindings'
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

  if (message === 'Source notes vault path is not a directory') {
    return t('preferences.notes.vault.errors.sourceNotDirectory')
  }

  if (message === 'Source and destination notes vaults must be different') {
    return t('preferences.notes.vault.errors.sameVault')
  }

  if (message.includes('file conflicts')) {
    return t('preferences.notes.vault.errors.conflicts')
  }

  return t('preferences.notes.vault.errors.generic')
}

export function NotesPane() {
  const { t } = useTranslation()
  const vaultInfo = useNotesStore(state => state.vaultInfo)
  const vaultError = useNotesStore(state => state.vaultError)
  const pendingMigrationSourcePath = useNotesStore(
    state => state.pendingMigrationSourcePath
  )
  const loadVaultInfo = useNotesStore(state => state.loadVaultInfo)
  const setVaultPath = useNotesStore(state => state.setVaultPath)
  const resetVaultPath = useNotesStore(state => state.resetVaultPath)
  const migratePendingVault = useNotesStore(state => state.migratePendingVault)
  const dismissPendingVaultMigration = useNotesStore(
    state => state.dismissPendingVaultMigration
  )
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

  async function handleMigrateVault(mode: NoteVaultMigrationMode) {
    setIsBusy(true)

    try {
      const result = await migratePendingVault(mode)
      toast.success(
        mode === 'copy'
          ? t('preferences.notes.vault.migration.copied')
          : t('preferences.notes.vault.migration.moved'),
        {
          description: t('preferences.notes.vault.migration.summary', {
            notes: result.notes_migrated,
            metadata: result.metadata_files_migrated,
          }),
        }
      )
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

            {pendingMigrationSourcePath && (
              <div
                role="region"
                aria-labelledby="notes-vault-migration-title"
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      id="notes-vault-migration-title"
                      className="text-sm font-medium text-foreground"
                    >
                      {t('preferences.notes.vault.migration.title')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('preferences.notes.vault.migration.description')}
                    </p>
                    <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                      {pendingMigrationSourcePath}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={dismissPendingVaultMigration}
                    disabled={isBusy}
                    aria-label={t('preferences.notes.vault.migration.dismiss')}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleMigrateVault('copy')}
                    disabled={isBusy}
                  >
                    <Copy className="size-3.5" />
                    {t('preferences.notes.vault.migration.copy')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleMigrateVault('move')}
                    disabled={isBusy}
                  >
                    <MoveRight className="size-3.5" />
                    {t('preferences.notes.vault.migration.move')}
                  </Button>
                </div>
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
