import type { LucideIcon } from 'lucide-react'

export type WidgetSlug =
  | 'tasks'
  | 'habit-tracker'
  | 'pomodoro'
  | 'kanban'
  | 'calendar'

export type WidgetCard = {
  slug: WidgetSlug
  kicker: string
  title: string
  description: string
  badge: string
  icon: LucideIcon
}

export type MomentumComparisonPoint = {
  point: string
  pastMonth: number
  currentMonth: number
}
