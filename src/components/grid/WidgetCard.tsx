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
 * Design system:
 * - Light: Mistral warm golden shadow, cream card surface
 * - Dark:  Resend frost border ring, near-void surface
 * - Both:  Cal.com multi-layer shadow approach via --widget-shadow
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
        'widget-card flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground',
        /* Dark mode gets frost border, light mode gets warm tinted border */
        'border-border',
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
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70 select-none">
          {title}
        </span>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}
