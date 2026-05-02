import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { useOnboardingStore } from '@/store/onboarding-store'
import { useGitHubStore } from '@/store/github-store'
import { useUIStore } from '@/store/ui-store'

export function AdvancedPane() {
  const { t } = useTranslation()

  const resetOnboarding = useOnboardingStore(state => state.resetOnboarding)
  const logoutGitHub = useGitHubStore(state => state.logout)
  const setPreferencesOpen = useUIStore(state => state.setPreferencesOpen)

  const handleResetOnboarding = () => {
    resetOnboarding()
    setPreferencesOpen(false)
    toast.success(t('toast.success.preferencesSaved')) // Fallback or new key
  }

  const handleGitHubLogout = async () => {
    await logoutGitHub()
    toast.success('Desconectado do GitHub.')
  }

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.advanced.title')}>
        <SettingsField
          label={t('preferences.advanced.resetOnboarding')}
          description={t('preferences.advanced.resetOnboardingDescription')}
        >
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetOnboarding}
          >
            {t('preferences.advanced.resetOnboarding')}
          </Button>
        </SettingsField>

        <SettingsField
          label={t('preferences.advanced.githubLogout')}
          description={t('preferences.advanced.githubLogoutDescription')}
        >
          <Button variant="outline" size="sm" onClick={handleGitHubLogout}>
            {t('preferences.advanced.githubLogout')}
          </Button>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
