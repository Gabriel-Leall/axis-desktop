import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent'

// eslint-disable-next-line react-refresh/only-export-components
export const CHART_COLORS = {
  accent: 'var(--color-accent)',
  accentMuted: 'var(--color-accent-muted)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  muted: 'var(--color-muted)',
  border: 'var(--color-border)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border shadow-lg bg-popover text-popover-foreground border-border p-2 text-sm z-50">
        <p className="font-semibold mb-1" style={{ color: CHART_COLORS.text }}>
          {label}
        </p>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-mono text-muted-foreground">
              {formatter
                ? formatter(
                    entry.value as ValueType,
                    entry.name as NameType,
                    entry,
                    index,
                    payload
                  )
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
}
