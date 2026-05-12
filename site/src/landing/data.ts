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
import type { WidgetCard } from './types'

export const downloadUrl =
  'https://github.com/Gabriel-Leall/axis-desktop/releases'

export const navLinks = [
  { href: '#widgets', labelKey: 'landing.nav.widgets' },
  { href: '#clarity', labelKey: 'landing.nav.clarity' },
  { href: '#analysis', labelKey: 'landing.nav.analysis' },
]

export const widgetCards: WidgetCard[] = [
  {
    slug: 'tasks',
    kicker: 'Tasks',
    title: 'Close tasks before they become noise',
    description:
      'Capture, prioritize, and finish daily tasks in one place with clear status and fast completion flow.',
    badge: '3 completed',
    icon: CheckSquare,
  },
  {
    slug: 'habit-tracker',
    kicker: 'Habit Tracker',
    title: 'Build consistency with visible streaks',
    description:
      'Track routines with streak history and quick daily check-ins so habits stay active instead of forgotten.',
    badge: '+1 streak',
    icon: Flame,
  },
  {
    slug: 'pomodoro',
    kicker: 'Pomodoro',
    title: 'Protect deep work with focused cycles',
    description:
      'Start focus sessions, pause when needed, and reset instantly to keep momentum through real work blocks.',
    badge: 'Focus live',
    icon: Timer,
  },
  {
    slug: 'kanban',
    kicker: 'Kanban',
    title: 'See execution flow at a glance',
    description:
      'Move cards across stages and spot blockers quickly with a board designed for continuous delivery.',
    badge: 'Flow update',
    icon: Columns3,
  },
  {
    slug: 'calendar',
    kicker: 'Calendar',
    title: 'Plan your week with real context',
    description:
      'Keep deadlines, meetings, and planned work aligned so the week stays realistic and under control.',
    badge: 'Week synced',
    icon: CalendarDays,
  },
]

export const taskShowcaseRows = [
  { title: 'Ship landing update', level: 'High', completed: false },
  { title: 'Polish pricing copy', level: 'Medium', completed: false },
  { title: 'Review onboarding flow', level: 'High', completed: false },
]

export const habitShowcaseRows = [
  { title: 'Morning review', streak: 12, completed: true },
  { title: 'Hydration reset', streak: 7, completed: true },
  { title: 'Read 10 pages', streak: 4, completed: false },
]

export const kanbanColumns = [
  { label: 'Backlog', cards: ['Rewrite CTA'] },
  { label: 'In Progress', cards: ['Sync widget story'] },
  { label: 'Done', cards: ['Update hero preview'] },
]

export const pomodoroMetricCountdown = [
  '25:00 left',
  '24:59 left',
  '24:58 left',
  '24:57 left',
  '24:56 left',
  '24:55 left',
]

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

export const chaosList = [
  'Too many tabs and no single command center.',
  'Daily planning breaks when meetings and tasks are disconnected.',
  'Hard to know if progress is real or just busy work.',
]

export const axisList = [
  'Widgets keep all critical signals on one board.',
  'Time, tasks, habits, and focus cycles live in the same view.',
  'The analysis panel compares last month vs this month automatically.',
]

export const chaosPainStat = {
  label: 'Context switching cost',
  value: '2h/day',
  description:
    'The average professional loses around 2 hours a day just switching context between tabs, chats, and scattered tools.',
}

export const heroSidebarItems = [
  { icon: Columns3, active: true, label: 'Board' },
  { icon: CheckSquare, active: false, label: 'Tasks' },
  { icon: FolderOpen, active: false, label: 'Notes' },
  { icon: CalendarDays, active: false, label: 'Calendar' },
  { icon: Timer, active: false, label: 'Focus' },
]

export const heroPreviewTasks = [
  { title: 'Plan the day', level: 'High' },
  { title: 'Review weekly goals', level: 'High' },
  { title: 'Deep work block (90m)', level: 'High' },
  { title: 'Triage GitHub and Slack', level: 'Medium' },
]

export const heroPreviewHabits = [
  'No phone for 1 hour',
  'Daily review',
  'Drink water',
  'Read 10 pages',
]

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

export const previousScore = 62
export const currentScore = 86

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
