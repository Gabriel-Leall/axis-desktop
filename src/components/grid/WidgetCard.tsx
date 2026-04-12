import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface WidgetCardProps {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

/**
 * Widget card wrapper with themed borders.
 *
 * Uses CSS variables for shadow/border treatment so it adapts
 * to both light and dark themes automatically.
 *
 * Features:
 * - Themed ring-shadow border via --widget-shadow
 * - Subtle header with icon + title
 * - Drag handle on the header area
 */
export function WidgetCard({
  title,
  icon: Icon,
  children,
  className,
  onClick,
}: WidgetCardProps) {
  return (
    <div
      className={cn(
        'widget-card flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Header — drag handle */}
      <div
        className="widget-drag-handle flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5"
        style={{ cursor: 'grab' }}
      >
        {Icon && (
          <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} />
        )}
        <span className="text-xs font-medium text-muted-foreground select-none">
          {title}
        </span>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}
