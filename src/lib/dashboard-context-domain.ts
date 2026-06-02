export type DashboardAdaptationMode = 'full' | 'reduced' | 'off'
type DailyAxisPeriod = 'morning' | 'afternoon' | 'evening'
export type DashboardContextMode =
  | 'default'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'focus'
export type DashboardWidgetPriority = 'default' | 'primary' | 'secondary'

interface DashboardContextInput {
  adaptationMode?: DashboardAdaptationMode | null
  period?: DailyAxisPeriod | null
  focusSessionActive: boolean
}

const MODE_PRIORITIES: Record<
  Exclude<DashboardContextMode, 'default'>,
  { primary: string[]; secondary: string[] }
> = {
  morning: {
    primary: ['tasks'],
    secondary: ['calendar', 'notes'],
  },
  afternoon: {
    primary: ['tasks'],
    secondary: ['pomodoro', 'notes'],
  },
  evening: {
    primary: ['tasks'],
    secondary: ['habits', 'calendar'],
  },
  focus: {
    primary: ['pomodoro'],
    secondary: ['tasks', 'notes'],
  },
}

export function getDashboardContextMode({
  adaptationMode = 'full',
  period,
  focusSessionActive,
}: DashboardContextInput): DashboardContextMode {
  if (adaptationMode === 'off') {
    return 'default'
  }

  if (focusSessionActive) {
    return 'focus'
  }

  if (!period) {
    return 'default'
  }

  return period
}

export function normalizeDashboardAdaptationMode(
  value: string | null | undefined
): DashboardAdaptationMode {
  if (value === 'reduced' || value === 'off') {
    return value
  }

  return 'full'
}

export function getDashboardWidgetPriority(
  mode: DashboardContextMode,
  adaptationMode: DashboardAdaptationMode,
  widgetId: string
): DashboardWidgetPriority {
  if (adaptationMode === 'off' || mode === 'default') {
    return 'default'
  }

  const priorities = MODE_PRIORITIES[mode]
  if (priorities.primary.includes(widgetId)) {
    return 'primary'
  }

  if (adaptationMode === 'full' && priorities.secondary.includes(widgetId)) {
    return 'secondary'
  }

  return 'default'
}

export function shouldDeemphasizeDashboardWidgets(
  mode: DashboardContextMode,
  adaptationMode: DashboardAdaptationMode
): boolean {
  return adaptationMode === 'full' && mode !== 'default'
}
