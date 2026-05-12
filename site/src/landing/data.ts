import {
  CalendarDays,
  CheckSquare,
  CloudSun,
  Columns3,
  Flame,
  FolderOpen,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import type { TFunction } from 'i18next'
import type { WidgetCard } from './types'

export const downloadUrl =
  'https://github.com/Gabriel-Leall/axis-desktop/releases'

export const navLinks = [
  { href: '#widgets', labelKey: 'landing.nav.widgets' },
  { href: '#clarity', labelKey: 'landing.nav.clarity' },
  { href: '#analysis', labelKey: 'landing.nav.analysis' },
]

export function getWidgetCards(t: TFunction): WidgetCard[] {
  return [
    {
      slug: 'tasks',
      kicker: t('landing.widgets.cards.tasks.kicker'),
      title: t('landing.widgets.cards.tasks.title'),
      description: t('landing.widgets.cards.tasks.description'),
      badge: t('landing.widgets.cards.tasks.badge'),
      icon: CheckSquare,
    },
    {
      slug: 'habit-tracker',
      kicker: t('landing.widgets.cards.habitTracker.kicker'),
      title: t('landing.widgets.cards.habitTracker.title'),
      description: t('landing.widgets.cards.habitTracker.description'),
      badge: t('landing.widgets.cards.habitTracker.badge'),
      icon: Flame,
    },
    {
      slug: 'pomodoro',
      kicker: t('landing.widgets.cards.pomodoro.kicker'),
      title: t('landing.widgets.cards.pomodoro.title'),
      description: t('landing.widgets.cards.pomodoro.description'),
      badge: t('landing.widgets.cards.pomodoro.badge'),
      icon: Timer,
    },
    {
      slug: 'kanban',
      kicker: t('landing.widgets.cards.kanban.kicker'),
      title: t('landing.widgets.cards.kanban.title'),
      description: t('landing.widgets.cards.kanban.description'),
      badge: t('landing.widgets.cards.kanban.badge'),
      icon: Columns3,
    },
    {
      slug: 'calendar',
      kicker: t('landing.widgets.cards.calendar.kicker'),
      title: t('landing.widgets.cards.calendar.title'),
      description: t('landing.widgets.cards.calendar.description'),
      badge: t('landing.widgets.cards.calendar.badge'),
      icon: CalendarDays,
    },
  ]
}

export function getTaskShowcaseRows(t: TFunction) {
  return [
    {
      title: t('landing.preview.tasks.rows.shipLandingUpdate'),
      level: t('landing.preview.levels.high'),
      completed: false,
    },
    {
      title: t('landing.preview.tasks.rows.polishPricingCopy'),
      level: t('landing.preview.levels.medium'),
      completed: false,
    },
    {
      title: t('landing.preview.tasks.rows.reviewOnboardingFlow'),
      level: t('landing.preview.levels.high'),
      completed: false,
    },
  ]
}

export function getHabitShowcaseRows(t: TFunction) {
  return [
    {
      title: t('landing.preview.habits.rows.morningReview'),
      streak: 12,
      completed: true,
    },
    {
      title: t('landing.preview.habits.rows.hydrationReset'),
      streak: 7,
      completed: true,
    },
    {
      title: t('landing.preview.habits.rows.readTenPages'),
      streak: 4,
      completed: false,
    },
  ]
}

export function getKanbanColumns(t: TFunction) {
  return [
    {
      label: t('landing.preview.kanban.columns.backlog'),
      cards: [t('landing.preview.kanban.cards.rewriteCta')],
    },
    {
      label: t('landing.preview.kanban.columns.inProgress'),
      cards: [t('landing.preview.kanban.cards.syncWidgetStory')],
    },
    {
      label: t('landing.preview.kanban.columns.done'),
      cards: [t('landing.preview.kanban.cards.updateHeroPreview')],
    },
  ]
}

export function getPomodoroMetricCountdown(t: TFunction) {
  return ['25:00', '24:59', '24:58', '24:57', '24:56', '24:55'].map(time =>
    t('landing.preview.pomodoro.timeLeft', { time })
  )
}

export const pomodoroCoreCountdown = [
  '25:00',
  '24:59',
  '24:58',
  '24:57',
  '24:56',
  '24:55',
]

export const calendarShowcaseDays = [
  ['12', false],
  ['13', false],
  ['14', true],
  ['15', true],
  ['16', false],
  ['17', true],
  ['18', true],
  ['19', false],
  ['20', false],
  ['21', true],
  ['22', true],
  ['23', false],
  ['24', false],
  ['25', true],
] as const

export function getChaosList(t: TFunction) {
  return [
    t('landing.clarity.chaos.items.tabs'),
    t('landing.clarity.chaos.items.disconnectedPlanning'),
    t('landing.clarity.chaos.items.busyWork'),
  ]
}

export function getAxisList(t: TFunction) {
  return [
    t('landing.clarity.axis.items.widgets'),
    t('landing.clarity.axis.items.sharedView'),
    t('landing.clarity.axis.items.analysis'),
  ]
}

export function getChaosPainStat(t: TFunction) {
  return {
    label: t('landing.clarity.chaos.stat.label'),
    value: t('landing.clarity.chaos.stat.value'),
    description: t('landing.clarity.chaos.stat.description'),
  }
}

export const heroSidebarItems = [
  { icon: Columns3, active: true, labelKey: 'landing.hero.preview.sidebar.board' },
  { icon: CheckSquare, active: false, labelKey: 'landing.hero.preview.sidebar.tasks' },
  { icon: FolderOpen, active: false, labelKey: 'landing.hero.preview.sidebar.notes' },
  {
    icon: CalendarDays,
    active: false,
    labelKey: 'landing.hero.preview.sidebar.calendar',
  },
  { icon: Timer, active: false, labelKey: 'landing.hero.preview.sidebar.focus' },
]

export function getHeroPreviewTasks(t: TFunction) {
  return [
    {
      title: t('landing.hero.preview.tasks.planTheDay'),
      level: t('landing.preview.levels.high'),
    },
    {
      title: t('landing.hero.preview.tasks.reviewWeeklyGoals'),
      level: t('landing.preview.levels.high'),
    },
    {
      title: t('landing.hero.preview.tasks.deepWorkBlock'),
      level: t('landing.preview.levels.high'),
    },
    {
      title: t('landing.hero.preview.tasks.triageGithubAndSlack'),
      level: t('landing.preview.levels.medium'),
    },
  ]
}

export function getHeroPreviewHabits(t: TFunction) {
  return [
    t('landing.hero.preview.habits.noPhone'),
    t('landing.hero.preview.habits.dailyReview'),
    t('landing.hero.preview.habits.drinkWater'),
    t('landing.hero.preview.habits.readTenPages'),
  ]
}

export const heroCalendarDays = [
  '29',
  '30',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '1',
  '2',
]

export const momentumComparisonTargetData = [
  { point: 'S1', pastMonth: 18, currentMonth: 27 },
  { point: 'S2', pastMonth: 31, currentMonth: 42 },
  { point: 'S3', pastMonth: 28, currentMonth: 39 },
  { point: 'S4', pastMonth: 37, currentMonth: 55 },
  { point: 'S5', pastMonth: 41, currentMonth: 58 },
  { point: 'S6', pastMonth: 62, currentMonth: 86 },
]

export const momentumComparisonZeroData = momentumComparisonTargetData.map(
  item => ({
    ...item,
    pastMonth: 0,
    currentMonth: 0,
  })
)

export const lastComparisonPoint =
  momentumComparisonTargetData[momentumComparisonTargetData.length - 1]?.point ??
  'S6'

export const clarityHeaderIcons = {
  chaos: TriangleAlert,
  axis: CloudSun,
}
