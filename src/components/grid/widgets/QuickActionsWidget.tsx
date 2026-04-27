import { WidgetCard } from '../WidgetCard'
import { Zap, Settings, FolderOpen, Terminal, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/ui-store'

/**
 * Quick Actions widget — shortcut buttons for common actions.
 */
export function QuickActionsWidget() {
  const { t } = useTranslation()
  const togglePreferences = useUIStore(state => state.togglePreferences)
  const toggleCommandPalette = useUIStore(state => state.toggleCommandPalette)

  const actions = [
    {
      label: t('widgets.quickActions.actions.settings'),
      icon: Settings,
      onClick: togglePreferences,
    },
    {
      label: t('widgets.quickActions.actions.commandPalette'),
      icon: Terminal,
      onClick: toggleCommandPalette,
    },
    {
      label: t('widgets.quickActions.actions.openFolder'),
      icon: FolderOpen,
      onClick: () => {
        // Placeholder
      },
    },
    {
      label: t('widgets.quickActions.actions.themes'),
      icon: Palette,
      onClick: togglePreferences,
    },
  ]

  return (
    <WidgetCard title={t('widgets.quickActions.title')} icon={Zap}>
      <div className="grid h-full grid-cols-2 gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent"
          >
            <action.icon className="size-4 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  )
}
