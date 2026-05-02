import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { locale } from '@tauri-apps/plugin-os'
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShortcutPicker } from '../ShortcutPicker'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { commands } from '@/lib/tauri-bindings'
import { availableLanguages } from '@/i18n'
import { logger } from '@/lib/logger'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/lib/theme-context'

// Language display names (native names)
const languageNames: Record<string, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
}

export function GeneralPane() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()

  const [autostartState, setAutostartState] = useState({
    enabled: false,
    loading: true,
  })

  // Load preferences for keyboard shortcuts
  const { data: defaultShortcut } = useQuery({
    queryKey: ['default-quick-pane-shortcut'],
    queryFn: async () => {
      return await commands.getDefaultQuickPaneShortcut()
    },
    staleTime: Infinity,
  })

  useEffect(() => {
    const loadAutostartState = async () => {
      try {
        const enabled = await isAutostartEnabled()
        setAutostartState({ enabled, loading: false })
      } catch (error) {
        logger.warn('Failed to load autostart state', { error })
        setAutostartState(prev => ({ ...prev, loading: false }))
      }
    }

    void loadAutostartState()
  }, [])

  const handleShortcutChange = async (newShortcut: string | null) => {
    if (!preferences) return
    const oldShortcut = preferences.quick_pane_shortcut

    const result = await commands.updateQuickPaneShortcut(newShortcut)
    if (result.status === 'error') {
      toast.error(t('toast.error.shortcutFailed'), {
        description: result.error,
      })
      return
    }

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        quick_pane_shortcut: newShortcut,
      })
    } catch {
      await commands.updateQuickPaneShortcut(oldShortcut)
    }
  }

  const handleLanguageChange = async (value: string) => {
    const language = value === 'system' ? null : value
    try {
      if (language) {
        await i18n.changeLanguage(language)
      } else {
        const systemLocale = await locale()
        const langCode = systemLocale?.split('-')[0]?.toLowerCase() ?? 'en'
        const targetLang = langCode === 'pt' ? 'pt-BR' : langCode
        const resolvedLang = availableLanguages.includes(targetLang)
          ? targetLang
          : 'en'
        await i18n.changeLanguage(resolvedLang)
      }
    } catch (error) {
      logger.error('Failed to change language', { error })
      toast.error(t('toast.error.generic'))
      return
    }

    if (preferences) {
      savePreferences.mutate({ ...preferences, language })
    }
  }

  const handleThemeChange = (value: Theme) => {
    // Update the theme provider immediately for instant UI feedback
    setTheme(value)

    // Persist the theme preference to disk, preserving other preferences
    if (preferences) {
      savePreferences.mutate({ ...preferences, theme: value })
    }
  }

  const handleAutostartChange = async (enabled: boolean) => {
    setAutostartState(prev => ({ ...prev, loading: true }))
    try {
      if (enabled) {
        await enableAutostart()
      } else {
        await disableAutostart()
      }
      setAutostartState({ enabled, loading: false })
      toast.success(
        enabled
          ? t('toast.success.autostartEnabled')
          : t('toast.success.autostartDisabled')
      )
    } catch (error) {
      logger.error('Failed to update autostart state', { error, enabled })
      toast.error(t('toast.error.autostartFailed'))
      setAutostartState(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.appearance')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsField
            label={t('preferences.appearance.theme')}
            description={t('preferences.appearance.colorThemeDescription')}
          >
            <Select
              value={theme}
              onValueChange={handleThemeChange}
              disabled={savePreferences.isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('preferences.appearance.selectTheme')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t('preferences.appearance.theme.light')}
                </SelectItem>
                <SelectItem value="dark">
                  {t('preferences.appearance.theme.dark')}
                </SelectItem>
                <SelectItem value="entardecer">
                  {t('preferences.appearance.theme.entardecer')}
                </SelectItem>
                <SelectItem value="cream">
                  {t('preferences.appearance.theme.cream')}
                </SelectItem>
                <SelectItem value="system">
                  {t('preferences.appearance.theme.system')}
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField
            label={t('preferences.appearance.language')}
            description={t('preferences.appearance.languageDescription')}
          >
            <Select
              value={preferences?.language ?? 'system'}
              onValueChange={handleLanguageChange}
              disabled={savePreferences.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">
                  {t('preferences.appearance.language.system')}
                </SelectItem>
                {availableLanguages.map(lang => (
                  <SelectItem key={lang} value={lang}>
                    {languageNames[lang] ?? lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title={t('preferences.advanced.startup')}>
        <SettingsField
          label={t('preferences.advanced.launchAtStartup')}
          description={t('preferences.advanced.launchAtStartupDescription')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="launch-at-startup"
              checked={autostartState.enabled}
              onCheckedChange={handleAutostartChange}
              disabled={autostartState.loading}
            />
            <Label htmlFor="launch-at-startup" className="text-sm">
              {autostartState.enabled
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.general.systemBehavior')}>
        <SettingsField
          label={t('preferences.general.minimizeToTray')}
          description={t('preferences.general.minimizeToTrayDescription')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="minimize-to-tray"
              checked={preferences?.minimize_to_tray ?? false}
              onCheckedChange={checked => {
                if (preferences) {
                  savePreferences.mutate({
                    ...preferences,
                    minimize_to_tray: checked,
                  })
                }
              }}
              disabled={savePreferences.isPending}
            />
            <Label htmlFor="minimize-to-tray" className="text-sm">
              {(preferences?.minimize_to_tray ?? false)
                ? t('common.enabled')
                : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.general.keyboardShortcuts')}>
        <SettingsField
          label={t('preferences.general.quickPaneShortcut')}
          description={t('preferences.general.quickPaneShortcutDescription')}
        >
          <ShortcutPicker
            value={preferences?.quick_pane_shortcut ?? null}
            defaultValue={defaultShortcut ?? 'CommandOrControl+Shift+.'}
            onChange={handleShortcutChange}
            disabled={!preferences || savePreferences.isPending}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
