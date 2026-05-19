import { useState } from 'react'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { logger } from '@/lib/logger'

type AvailableUpdate = NonNullable<Awaited<ReturnType<typeof check>>>

export function UpdatesPane() {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [contentLength, setContentLength] = useState<number | null>(null)

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      const availableUpdate = await check()
      setUpdate(availableUpdate)
      toast(
        availableUpdate
          ? t('updates.availableDescription', {
              version: availableUpdate.version,
            })
          : t('updates.upToDateDescription')
      )
    } catch (error) {
      logger.error('Update check failed', { error })
      toast.error(t('updates.checkFailed'))
    } finally {
      setChecking(false)
    }
  }

  const installUpdate = async () => {
    if (!update) return

    setInstalling(true)
    setDownloadedBytes(0)
    setContentLength(null)

    try {
      await update.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength ?? null)
            break
          case 'Progress':
            setDownloadedBytes(current => current + event.data.chunkLength)
            break
          case 'Finished':
            setDownloadedBytes(current => current)
            break
        }
      })

      toast.success(t('updates.installComplete'))
      await relaunch()
    } catch (error) {
      logger.error('Update installation failed', { error })
      toast.error(t('updates.installFailed'))
      setInstalling(false)
    }
  }

  const progress =
    contentLength && contentLength > 0
      ? Math.min(100, Math.round((downloadedBytes / contentLength) * 100))
      : null

  return (
    <div className="space-y-6">
      <SettingsSection title={t('updates.sectionTitle')}>
        <SettingsField
          label={t('updates.statusLabel')}
          description={
            update
              ? t('updates.availableDescription', { version: update.version })
              : t('updates.statusDescription')
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={checkForUpdates}
            disabled={checking || installing}
          >
            {checking ? t('updates.checking') : t('updates.checkButton')}
          </Button>
        </SettingsField>

        {update && (
          <SettingsField
            label={t('updates.installLabel')}
            description={
              progress === null
                ? t('updates.installDescription')
                : t('updates.downloadProgress', { progress })
            }
          >
            <Button size="sm" onClick={installUpdate} disabled={installing}>
              {installing
                ? t('updates.installing')
                : t('updates.installButton')}
            </Button>
          </SettingsField>
        )}
      </SettingsSection>
    </div>
  )
}
