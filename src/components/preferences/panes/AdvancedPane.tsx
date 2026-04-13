import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logger } from '@/lib/logger'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'

export function AdvancedPane() {
  const { t } = useTranslation()
  // Example local state - these are NOT persisted to disk
  // To add persistent preferences:
  // 1. Add the field to AppPreferences in both Rust and TypeScript
  // 2. Use usePreferencesManager() and updatePreferences()
  const [exampleDropdown, setExampleDropdown] = useState('option1')
  const [autostartEnabled, setAutostartEnabled] = useState(false)
  const [autostartLoading, setAutostartLoading] = useState(true)

  useEffect(() => {
    const loadAutostartState = async () => {
      try {
        const enabled = await isAutostartEnabled()
        setAutostartEnabled(enabled)
      } catch (error) {
        logger.warn('Failed to load autostart state', { error })
      } finally {
        setAutostartLoading(false)
      }
    }

    void loadAutostartState()
  }, [])

  const handleAutostartChange = async (enabled: boolean) => {
    setAutostartLoading(true)

    try {
      if (enabled) {
        await enableAutostart()
      } else {
        await disableAutostart()
      }

      setAutostartEnabled(enabled)
      toast.success(
        enabled
          ? t('toast.success.autostartEnabled')
          : t('toast.success.autostartDisabled')
      )
    } catch (error) {
      logger.error('Failed to update autostart state', { error, enabled })
      toast.error(t('toast.error.autostartFailed'))
    } finally {
      setAutostartLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.advanced.startup')}>
        <SettingsField
          label={t('preferences.advanced.launchAtStartup')}
          description={t('preferences.advanced.launchAtStartupDescription')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="launch-at-startup"
              checked={autostartEnabled}
              onCheckedChange={handleAutostartChange}
              disabled={autostartLoading}
            />
            <Label htmlFor="launch-at-startup" className="text-sm">
              {autostartEnabled ? t('common.enabled') : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.advanced.title')}>
        <SettingsField
          label={t('preferences.advanced.dropdown')}
          description={t('preferences.advanced.dropdownDescription')}
        >
          <Select value={exampleDropdown} onValueChange={setExampleDropdown}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">
                {t('preferences.advanced.option1')}
              </SelectItem>
              <SelectItem value="option2">
                {t('preferences.advanced.option2')}
              </SelectItem>
              <SelectItem value="option3">
                {t('preferences.advanced.option3')}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
