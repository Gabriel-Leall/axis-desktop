import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui-store'
import { executeCommand, useCommandContext } from '@/lib/commands'
import {
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Settings,
} from 'lucide-react'

/**
 * Left-side toolbar actions (sidebar toggle).
 * Place this after window controls on macOS, or at the start on Windows/Linux.
 */
export function TitleBarLeftActions() {
  const { t } = useTranslation()
  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
  const toggleLeftSidebar = useUIStore(state => state.toggleLeftSidebar)

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={toggleLeftSidebar}
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-foreground/70 hover:text-foreground"
        title={t(
          leftSidebarVisible
            ? 'titlebar.hideLeftSidebar'
            : 'titlebar.showLeftSidebar'
        )}
      >
        {leftSidebarVisible ? (
          <PanelLeftClose className="h-3 w-3" />
        ) : (
          <PanelLeft className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
}

/**
 * Right-side toolbar actions (settings, sidebar toggle).
 * Place this before window controls on Windows, or at the end on macOS/Linux.
 */
export function TitleBarRightActions() {
  const { t } = useTranslation()
  const rightSidebarVisible = useUIStore(state => state.rightSidebarVisible)
  const toggleRightSidebar = useUIStore(state => state.toggleRightSidebar)
  const commandContext = useCommandContext()

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext)
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={handleOpenPreferences}
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-foreground/70 hover:text-foreground"
        title={t('titlebar.settings')}
      >
        <Settings className="h-3 w-3" />
      </Button>

      <Button
        onClick={toggleRightSidebar}
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-foreground/70 hover:text-foreground"
        title={t(
          rightSidebarVisible
            ? 'titlebar.hideRightSidebar'
            : 'titlebar.showRightSidebar'
        )}
      >
        {rightSidebarVisible ? (
          <PanelRightClose className="h-3 w-3" />
        ) : (
          <PanelRight className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
}

interface TitleBarTitleProps {
  title?: string
  showClock?: boolean
}

/**
 * Centered title for the title bar.
 * Uses absolute positioning to stay centered regardless of other content.
 */
export function TitleBarTitle({ showClock = true }: TitleBarTitleProps) {
  const { i18n } = useTranslation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const update = () => setNow(new Date())
    const msUntilNextMinute = 60000 - (Date.now() % 60000) + 50
    let interval: number | undefined

    const timeout = window.setTimeout(() => {
      update()
      interval = window.setInterval(update, 60000)
    }, msUntilNextMinute)

    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [])

  if (!showClock) return null

  const time = now.toLocaleTimeString(i18n.resolvedLanguage, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const date = now.toLocaleDateString(i18n.resolvedLanguage, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })

  return (
    <div
      data-tauri-drag-region
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-[11px] font-medium tabular-nums text-muted-foreground"
      aria-label={`${date}, ${time}`}
    >
      <span className="capitalize">{date}</span>
      <span className="h-3 w-px bg-border" />
      <span className="text-foreground/80">{time}</span>
    </div>
  )
}

/**
 * Combined toolbar content for simple layouts.
 * Use this for Linux or when you want all toolbar items in one fragment.
 *
 * For more control, use TitleBarLeftActions, TitleBarRightActions, and TitleBarTitle separately.
 */
export function TitleBarContent({ title = 'Axis' }: TitleBarTitleProps) {
  return (
    <>
      <TitleBarLeftActions />
      <TitleBarTitle title={title} />
      <TitleBarRightActions />
    </>
  )
}
