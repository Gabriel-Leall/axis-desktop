import { cn } from '@/lib/utils'
import { getLocalISODate } from '@/lib/habits-domain'
import type { HabitLogState } from '@/lib/habits-domain'

export interface HeatMapProps {
  logs: string[]
  days: number
  color: string
  size?: 'sm' | 'md'
  statesByDate?: Record<string, HabitLogState>
  ariaLabel?: string
  locale?: string
  stateLabels?: Partial<Record<HabitLogState | 'missed', string>>
}

function dateLabel(dateISO: string, locale: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString(locale, {
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

export function HeatMap({
  logs,
  days,
  color,
  size = 'sm',
  statesByDate = {},
  ariaLabel,
  locale = 'en-US',
  stateLabels = {},
}: HeatMapProps) {
  const completedSet = new Set(logs)
  const dates = lastNDates(days)

  return (
    <div
      role="grid"
      aria-label={
        ariaLabel ?? `Habit completion heat map for last ${days} days`
      }
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))`,
        gap: size === 'sm' ? '4px' : '6px',
      }}
    >
      {dates.map(dateISO => {
        const completed = completedSet.has(dateISO)
        const state = statesByDate[dateISO]
        const stateLabel =
          stateLabels[state ?? (completed ? 'done' : 'missed')] ??
          state ??
          (completed ? 'done' : 'missed')
        const recovered = state === 'recovered'
        const gentle = state === 'minimal' || state === 'paused'
        return (
          <div
            key={dateISO}
            role="gridcell"
            aria-label={`${stateLabel} on ${dateISO}`}
            title={`${dateLabel(dateISO, locale)} - ${stateLabel}`}
            className={cn(
              'rounded-[3px] border border-border/60 transition-colors',
              size === 'sm' ? 'size-2.5' : 'size-3.5'
            )}
            style={{
              backgroundColor: completed
                ? gentle
                  ? `color-mix(in oklab, ${color} 36%, var(--muted))`
                  : recovered
                    ? `color-mix(in oklab, ${color} 55%, var(--accent))`
                    : color
                : 'color-mix(in oklab, var(--muted) 70%, transparent)',
              opacity: completed ? (gentle ? 0.72 : 0.9) : 0.6,
              outline: recovered
                ? '1px solid color-mix(in oklab, var(--accent) 65%, white)'
                : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
