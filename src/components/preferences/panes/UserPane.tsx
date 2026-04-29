import { useGitHubStore } from '@/store/github-store'
import { useTranslation } from 'react-i18next'
import { LogOut, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '../shared/SettingsComponents'
import { Badge } from '@/components/ui/badge'

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

export function UserPane() {
  const { t } = useTranslation()
  const user = useGitHubStore(state => state.user)
  const isAuthenticated = useGitHubStore(state => state.isAuthenticated)
  const logout = useGitHubStore(state => state.logout)
  const startOAuthFlow = useGitHubStore(state => state.startOAuthFlow)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SettingsSection title={t('preferences.user.profile')}>
        <div className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card/50 shadow-sm">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/10 bg-muted shrink-0 shadow-inner">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.login} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent/20">
                <UserIcon className="w-8 h-8 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-foreground truncate">
              {user?.name || user?.login || t('preferences.user.guest')}
            </h4>
            <p className="text-sm text-muted-foreground truncate font-mono opacity-70">
              {user?.login ? `@${user.login}` : t('preferences.user.notLoggedIn')}
            </p>
          </div>
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="shrink-0 gap-2 border-destructive/10 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('preferences.user.logout')}
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title={t('preferences.user.connections')}>
        <div className="grid gap-3">
          {/* GitHub Connection */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/30 hover:bg-card/50 transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1b1f23] flex items-center justify-center shadow-md">
                <GithubIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">GitHub</span>
                <span className="text-xs text-muted-foreground">
                  {isAuthenticated 
                    ? t('preferences.user.connectedAs', { name: user?.login }) 
                    : t('preferences.user.notConnected')}
                </span>
              </div>
            </div>
            {isAuthenticated ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 transition-colors">
                {t('preferences.user.active')}
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startOAuthFlow()} className="h-8 px-3 text-xs">
                {t('preferences.user.connect')}
              </Button>
            )}
          </div>

          {/* Google Connection (Mocked) */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/10 opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm">
                 <GoogleIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Google</span>
                <span className="text-xs text-muted-foreground">{t('preferences.user.notConnected')}</span>
              </div>
            </div>
            <Button size="sm" variant="ghost" disabled className="h-8 px-3 text-xs opacity-50">
              {t('preferences.user.connect')}
            </Button>
          </div>
        </div>
      </SettingsSection>

      <div className="pt-4 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center">
          Axis Cloud Sync v1.0
        </p>
      </div>
    </div>
  )
}

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.09H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.91l3.66-2.8z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.09l3.66 2.84c.87-2.6 3.3-4.55 6.16-4.55z" fill="#EA4335"/>
  </svg>
)
