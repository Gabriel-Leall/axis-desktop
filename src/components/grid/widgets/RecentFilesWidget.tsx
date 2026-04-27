import { WidgetCard } from '../WidgetCard'
import { FolderOpen, FileText, FileCode, FileImage } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Recent Files widget — displays a list of recently accessed files.
 */
export function RecentFilesWidget() {
  const { t } = useTranslation()

  // Placeholder data for demonstration
  const recentFiles = [
    {
      name: 'design-notes.md',
      icon: FileText,
      time: t('widgets.recentFiles.minutesAgo', { count: 2 }),
    },
    {
      name: 'app.tsx',
      icon: FileCode,
      time: t('widgets.recentFiles.minutesAgo', { count: 15 }),
    },
    {
      name: 'screenshot.png',
      icon: FileImage,
      time: t('widgets.recentFiles.hoursAgo', { count: 1 }),
    },
    {
      name: 'README.md',
      icon: FileText,
      time: t('widgets.recentFiles.hoursAgo', { count: 2 }),
    },
    {
      name: 'config.json',
      icon: FileCode,
      time: t('widgets.recentFiles.hoursAgo', { count: 3 }),
    },
  ]

  return (
    <WidgetCard title={t('widgets.recentFiles.title')} icon={FolderOpen}>
      <div className="flex h-full flex-col gap-1">
        {recentFiles.map(file => (
          <button
            key={file.name}
            type="button"
            className="flex items-center gap-2 rounded px-2 py-1 text-start transition-colors hover:bg-accent"
          >
            <file.icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-xs text-foreground">
              {file.name}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {file.time}
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  )
}
