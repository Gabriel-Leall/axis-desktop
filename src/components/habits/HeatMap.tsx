import { cn } from '@/lib/utils'
import { getLocalISODate } from '@/lib/habits-domain'

export interface HeatMapProps {
  logs: string[]
  days: number
  color: string
  size?: 'sm' | 'md'
}

function dateLabel(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function lastNDates(days: number): string[] {
  const dates: string[] = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  for (let i = 0; i < days; i += 1) {
    const step = new Date(today)
    step.setDate(today.getDate() - (days - 1 - i))
    dates.push(getLocalISODate(step))
  }

  return dates
}

export function HeatMap({ logs, days, color, size = 'sm' }: HeatMapProps) {
  const completedSet = new Set(logs)
  const dates = lastNDates(days)

  return (
    <div
      role="grid"
      aria-label={`Habit completion heat map for last ${days} days`}
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))`,
        gap: size === 'sm' ? '4px' : '6px',
      }}
    >
      {dates.map(dateISO => {
        const completed = completedSet.has(dateISO)
        return (
          <div
            key={dateISO}
            role="gridcell"
            aria-label={`${completed ? 'Completed' : 'Missed'} on ${dateISO}`}
            title={`${dateLabel(dateISO)} - ${completed ? 'Completed' : 'Missed'}`}
            className={cn(
              'rounded-[3px] border border-border/60 transition-colors',
              size === 'sm' ? 'size-2.5' : 'size-3.5'
            )}
            style={{
              backgroundColor: completed
                ? color
                : 'color-mix(in oklab, var(--muted) 70%, transparent)',
              opacity: completed ? 0.9 : 0.6,
            }}
          />
        )
      })}
    </div>
  )
}
