import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function HabitsPane() {
  const { t } = useTranslation()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()

  const handleUpdate = async (updates: Partial<typeof preferences>) => {
    if (!preferences) return
    try {
      await savePreferences.mutateAsync({ ...preferences, ...updates })
      toast.success(t('toast.success.settingsSaved'))
    } catch {
      toast.error(t('toast.error.generic'))
    }
  }

  if (!preferences) return null

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('preferences.habits.calendar', {
          defaultValue: 'Calendar & Tracking',
        })}
      >
        <SettingsField
          label={t('preferences.habits.startOfWeek', {
            defaultValue: 'Start of the Week',
          })}
          description={t('preferences.habits.startOfWeekDescription', {
            defaultValue:
              'Which day should be the first column in your tracking charts?',
          })}
        >
          <Select
            value={preferences.start_of_week || 'sunday'}
            onValueChange={value => handleUpdate({ start_of_week: value })}
            disabled={savePreferences.isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">
                {t('common.days.sunday', { defaultValue: 'Sunday' })}
              </SelectItem>
              <SelectItem value="monday">
                {t('common.days.monday', { defaultValue: 'Monday' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label={t('preferences.habits.dailyResetTime', {
            defaultValue: 'Daily Reset Time',
          })}
          description={t('preferences.habits.dailyResetTimeDescription', {
            defaultValue: 'When does a new day begin? Useful for night owls.',
          })}
        >
          <Input
            type="time"
            className="w-32"
            value={preferences.daily_reset_time || '00:00'}
            onChange={e => handleUpdate({ daily_reset_time: e.target.value })}
            disabled={savePreferences.isPending}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
