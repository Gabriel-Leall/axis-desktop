import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface WidgetCardProps {
  title: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  contentClassName?: string
  onClick?: () => void
}

/**
 * Widget card shell shared by all dashboard widgets.
 *
 * Visual language:
 * - High-contrast title rail for quick scanning
 * - Soft, layered card body for hierarchy
 * - Unified drag handle area to signal movability
 */
export function WidgetCard({
  title,
  icon: Icon,
  children,
  className,
  contentClassName,
  onClick,
}: WidgetCardProps) {
  return (
    <section
      className={cn(
        'widget-card flex h-full w-full flex-col overflow-hidden border border-border bg-card text-card-foreground',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div
        className="widget-drag-handle flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2"
        style={{ cursor: 'grab' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} />
          )}
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 select-none">
            {title}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'widget-card-content flex-1 overflow-auto p-3',
          contentClassName
        )}
      >
        {children}
      </div>
    </section>
  )
}
