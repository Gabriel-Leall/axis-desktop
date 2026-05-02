import { useTranslation } from 'react-i18next'
import { Settings, User as UserIcon, Timer, CalendarCheck2 } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { useUIStore } from '@/store/ui-store'
import { GeneralPane } from './panes/GeneralPane'
import { FocusTimerPane } from './panes/FocusTimerPane'
import { HabitsPane } from './panes/HabitsPane'
import { UserPane } from './panes/UserPane'

type PreferencePane = 'general' | 'focusTimer' | 'habits' | 'user'

const navigationItems = [
  {
    id: 'general' as const,
    labelKey: 'preferences.general',
    icon: Settings,
  },
  {
    id: 'focusTimer' as const,
    labelKey: 'preferences.focusTimer',
    icon: Timer,
  },
  {
    id: 'habits' as const,
    labelKey: 'preferences.habits',
    icon: CalendarCheck2,
  },
  {
    id: 'user' as const,
    labelKey: 'preferences.user',
    icon: UserIcon,
  },
] as const

export function PreferencesDialog() {
  const { t } = useTranslation()
  const preferencesOpen = useUIStore(state => state.preferencesOpen)
  const setPreferencesOpen = useUIStore(state => state.setPreferencesOpen)
  const activePane = useUIStore(
    state => state.activePreferencesPane
  ) as PreferencePane
  const setActivePane = useUIStore(state => state.setActivePreferencesPane)

  const getPaneTitle = (pane: PreferencePane): string => {
    return t(`preferences.${pane}`)
  }

  return (
    <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <DialogContent className="overflow-hidden p-0 md:max-h-150 md:max-w-225 lg:max-w-250 font-sans rounded-xl">
        <DialogTitle className="sr-only">{t('preferences.title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('preferences.description')}
        </DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map(item => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activePane === item.id}
                        >
                          <button
                            onClick={() => setActivePane(item.id)}
                            className="w-full"
                          >
                            <item.icon />
                            <span>{t(item.labelKey)}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <span>{t('preferences.title')}</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {getPaneTitle(activePane)}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-10 pt-0 max-h-134">
              {activePane === 'general' && <GeneralPane />}
              {activePane === 'focusTimer' && <FocusTimerPane />}
              {activePane === 'habits' && <HabitsPane />}
              {activePane === 'user' && <UserPane />}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
