import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { toast } from 'sonner'
import { useEffect } from 'react'

export function FocusTimerPane() {
  const { t } = useTranslation()
  const { settings, updateSettings, loadSettings, isLoadingSettings } =
    usePomodoroStore()

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleUpdate = async (updates: Partial<typeof settings>) => {
    try {
      await updateSettings(updates)
      toast.success(t('toast.success.settingsSaved'))
    } catch {
      toast.error(t('toast.error.generic'))
    }
  }

  if (isLoadingSettings && !settings) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('preferences.focusTimer.durations', {
          defaultValue: 'Timer Durations',
        })}
      >
        <SettingsField
          label={t('preferences.focusTimer.focusDuration', {
            defaultValue: 'Focus Duration (minutes)',
          })}
          description={t('preferences.focusTimer.focusDurationDescription', {
            defaultValue: 'Length of a single focus session',
          })}
        >
          <Input
            type="number"
            min={1}
            max={120}
            className="w-24"
            value={settings.focus_duration}
            onChange={e =>
              handleUpdate({ focus_duration: parseInt(e.target.value) || 25 })
            }
          />
        </SettingsField>

        <SettingsField
          label={t('preferences.focusTimer.shortBreak', {
            defaultValue: 'Short Break (minutes)',
          })}
          description={t('preferences.focusTimer.shortBreakDescription', {
            defaultValue: 'Length of a short break',
          })}
        >
          <Input
            type="number"
            min={1}
            max={60}
            className="w-24"
            value={settings.short_break_duration}
            onChange={e =>
              handleUpdate({
                short_break_duration: parseInt(e.target.value) || 5,
              })
            }
          />
        </SettingsField>

        <SettingsField
          label={t('preferences.focusTimer.longBreak', {
            defaultValue: 'Long Break (minutes)',
          })}
          description={t('preferences.focusTimer.longBreakDescription', {
            defaultValue: 'Length of a long break after completing cycles',
          })}
        >
          <Input
            type="number"
            min={1}
            max={60}
            className="w-24"
            value={settings.long_break_duration}
            onChange={e =>
              handleUpdate({
                long_break_duration: parseInt(e.target.value) || 15,
              })
            }
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title={t('preferences.focusTimer.automation', {
          defaultValue: 'Automation & Sound',
        })}
      >
        <SettingsField
          label={t('preferences.focusTimer.autoStartBreaks', {
            defaultValue: 'Auto-start Breaks',
          })}
          description={t('preferences.focusTimer.autoStartBreaksDescription', {
            defaultValue:
              'Automatically start breaks when a focus session ends',
          })}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-start-breaks"
              checked={settings.auto_start_breaks}
              onCheckedChange={checked =>
                handleUpdate({ auto_start_breaks: checked })
              }
            />
            <Label htmlFor="auto-start-breaks" className="text-sm">
              {settings.auto_start_breaks
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={t('preferences.focusTimer.autoStartFocus', {
            defaultValue: 'Auto-start Focus',
          })}
          description={t('preferences.focusTimer.autoStartFocusDescription', {
            defaultValue:
              'Automatically start focus sessions when a break ends',
          })}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-start-focus"
              checked={settings.auto_start_focus}
              onCheckedChange={checked =>
                handleUpdate({ auto_start_focus: checked })
              }
            />
            <Label htmlFor="auto-start-focus" className="text-sm">
              {settings.auto_start_focus
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={t('preferences.focusTimer.soundNotifications', {
            defaultValue: 'Sound Notifications',
          })}
          description={t(
            'preferences.focusTimer.soundNotificationsDescription',
            { defaultValue: 'Play a sound when a timer finishes' }
          )}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="sound-notifications"
              checked={settings.sound_notifications}
              onCheckedChange={checked =>
                handleUpdate({ sound_notifications: checked })
              }
            />
            <Label htmlFor="sound-notifications" className="text-sm">
              {settings.sound_notifications
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
