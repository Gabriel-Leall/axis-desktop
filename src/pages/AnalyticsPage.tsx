import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fillMissingDays,
  formatDuration,
  getPeriodRange,
  type AnalyticsPeriod,
} from '@/lib/analytics-domain'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '@/store/analytics-store'

function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function comparisonLabel(period: AnalyticsPeriod): string {
  switch (period) {
    case 'this_week':
      return 'vs last week'
    case 'this_month':
      return 'vs last month'
    case 'this_year':
      return 'vs last year'
    case 'all_time':
      return 'vs previous period'
    default:
      return 'vs previous period'
  }
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function gradeFromScore(score: number): string {
  if (score >= 92) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 78) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 62) return 'C+'
  if (score >= 55) return 'C'
  return 'D'
}

function Sparkline({ data, stroke }: { data: number[]; stroke?: string }) {
  if (data.length < 2) {
    return <div className="h-full w-full bg-muted/20" />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')

  const area = `0,100 ${points} 100,100`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden
    >
      <polygon
        points={area}
        fill="color-mix(in oklab, var(--primary) 24%, transparent)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke ?? 'var(--primary)'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrendDelta({ delta, label }: { delta: number | null; label: string }) {
  if (delta === null) {
    return (
      <span className="inline-flex w-fit rounded-md border border-border/45 bg-card/85 px-2 py-1 text-xs font-medium text-muted-foreground/85 backdrop-blur-sm">
        No baseline {label}
      </span>
    )
  }

  const positive = delta >= 0
  const value = Math.min(999, Math.round(Math.abs(delta)))
  const arrow = positive ? '▲' : '▼'

  return (
    <span
      className={cn(
        'inline-flex w-fit rounded-md border border-border/45 bg-card/85 px-2 py-1 text-xs font-semibold backdrop-blur-sm',
        positive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
      )}
    >
      {arrow} {value}% {label}
    </span>
  )
}

function StatBox({
  title,
  value,
  subtitle,
  delta,
  deltaLabel,
  sparklineData,
}: {
  title: string
  value: string | number
  subtitle?: string
  delta: number | null
  deltaLabel: string
  sparklineData: number[]
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/30 bg-card/15 p-6 transition-all duration-300 hover:border-border/60 hover:bg-card/25">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-18 opacity-50">
        <Sparkline data={sparklineData} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background/95 via-background/70 to-transparent" />

      <div className="relative z-10 flex min-h-[118px] flex-col justify-between gap-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/75">
          {title}
        </h3>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-3xl font-medium tracking-tight text-foreground">
            {value}
          </span>
          <span className="text-xs font-medium text-muted-foreground h-4">
            {subtitle ?? ''}
          </span>
          <TrendDelta delta={delta} label={deltaLabel} />
        </div>
      </div>
    </div>
  )
}

function PeriodToggle() {
  const period = useAnalyticsStore(state => state.period)
  const setPeriod = useAnalyticsStore(state => state.setPeriod)

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: 'this_week', label: '7 Days' },
    { value: 'this_month', label: '30 Days' },
    { value: 'this_year', label: '1 Year' },
    { value: 'all_time', label: 'All Time' },
  ]

  return (
    <div className="flex gap-1 rounded-md border border-border/40 bg-muted/10 p-1 backdrop-blur-sm">
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={cn(
            'rounded-sm px-4 py-1.5 text-xs font-medium transition-all duration-200',
            period === p.value
              ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
              : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius = 84
  const strokeWidth = 14
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative mx-auto size-[220px]">
      <svg
        className="size-full -rotate-90"
        viewBox="0 0 220 220"
        role="img"
        aria-label={`Focus score ${score}`}
      >
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="color-mix(in oklab, var(--muted) 72%, transparent)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition:
              'stroke-dashoffset 400ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight text-foreground">
          {grade}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {score}%
        </span>
      </div>
    </div>
  )
}

interface ContributionDay {
  dateISO: string
  count: number
  outside: boolean
}

interface ContributionWeek {
  monthLabel: string
  days: ContributionDay[]
}

function buildContributionWeeks(logs: string[]): {
  weeks: ContributionWeek[]
  maxCount: number
  totalContributions: number
} {
  const counts = new Map<string, number>()
  for (const date of logs) {
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - 364)

  const gridStart = new Date(start)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const seenMonths = new Set<string>()
  const weeks: ContributionWeek[] = []
  let maxCount = 0
  let totalContributions = 0

  for (
    let cursor = new Date(gridStart);
    cursor <= today;
    cursor.setDate(cursor.getDate() + 7)
  ) {
    let monthLabel = ''
    const days: ContributionDay[] = []

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const day = new Date(cursor)
      day.setDate(cursor.getDate() + weekday)
      const dateISO = toISODate(day)
      const outside = day < start || day > today
      const count = outside ? 0 : (counts.get(dateISO) ?? 0)
      if (!outside) {
        maxCount = Math.max(maxCount, count)
        totalContributions += count
      }

      const monthKey = `${day.getFullYear()}-${day.getMonth()}`
      if (!outside && day.getDate() <= 7 && !seenMonths.has(monthKey)) {
        monthLabel = day.toLocaleDateString('en-US', { month: 'short' })
        seenMonths.add(monthKey)
      }

      days.push({ dateISO, count, outside })
    }

    weeks.push({ monthLabel, days })
  }

  return { weeks, maxCount, totalContributions }
}

function contributionLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || maxCount <= 0) return 0
  const ratio = count / maxCount
  if (ratio >= 0.75) return 4
  if (ratio >= 0.5) return 3
  if (ratio >= 0.25) return 2
  return 1
}

function contributionColor(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 4:
      return 'color-mix(in oklab, var(--primary) 92%, var(--background))'
    case 3:
      return 'color-mix(in oklab, var(--primary) 72%, var(--background))'
    case 2:
      return 'color-mix(in oklab, var(--primary) 52%, var(--background))'
    case 1:
      return 'color-mix(in oklab, var(--primary) 32%, var(--background))'
    default:
      return 'color-mix(in oklab, var(--primary) 12%, var(--background))'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null

  const formattedDate = new Date(`${label}T12:00:00Z`).toLocaleDateString(
    undefined,
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }
  )

  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 p-4 shadow-xl backdrop-blur-md">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {formattedDate}
      </p>
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="size-2 rounded-full"
                style={{
                  backgroundColor:
                    entry.color || entry.fill || 'var(--primary)',
                }}
              />
              <span className="text-sm text-foreground/90">{entry.name}</span>
            </div>
            <span className="font-mono text-sm font-semibold text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const period = useAnalyticsStore(state => state.period)
  const loadData = useAnalyticsStore(state => state.loadData)
  const summary = useAnalyticsStore(state => state.summary)
  const previousSummary = useAnalyticsStore(state => state.previousSummary)
  const focusTimeData = useAnalyticsStore(state => state.focusTimeData)
  const taskCountData = useAnalyticsStore(state => state.taskCountData)
  const pomodoroSummary = useAnalyticsStore(state => state.pomodoroSummary)
  const habitLogs = useAnalyticsStore(state => state.habitLogs)
  const isLoading = useAnalyticsStore(state => state.isLoading)

  useEffect(() => {
    void loadData()
  }, [loadData])

  const periodRange = useMemo(() => getPeriodRange(period), [period])

  const filledFocusData = useMemo(() => {
    const rows = fillMissingDays(
      focusTimeData,
      periodRange.start,
      periodRange.end
    )
    return rows.map(row => ({
      day: row.day as string,
      total_seconds: (row.total_seconds as number) ?? 0,
    }))
  }, [focusTimeData, periodRange.end, periodRange.start])

  const filledTaskData = useMemo(() => {
    const rows = fillMissingDays(
      taskCountData,
      periodRange.start,
      periodRange.end
    )
    return rows.map(row => ({
      day: row.day as string,
      created: (row.created as number) ?? 0,
      completed: (row.completed as number) ?? 0,
    }))
  }, [periodRange.end, periodRange.start, taskCountData])

  const focusSparkline = filledFocusData.map(item => item.total_seconds)
  const taskSparkline = filledTaskData.map(item => item.completed)

  const pomodoroSparkline = filledFocusData.map(item =>
    Math.max(0, Math.round(item.total_seconds / (25 * 60)))
  )

  const dayTaskMap = new Map(filledTaskData.map(item => [item.day, item]))
  const dayHabitMap = new Map<string, number>()
  for (const log of habitLogs) {
    dayHabitMap.set(
      log.completed_date,
      (dayHabitMap.get(log.completed_date) ?? 0) + 1
    )
  }
  const activeDaysSparkline = filledFocusData.map(item => {
    const task = dayTaskMap.get(item.day)
    const habitCount = dayHabitMap.get(item.day) ?? 0
    const isActive =
      item.total_seconds > 0 ||
      (task?.created ?? 0) > 0 ||
      (task?.completed ?? 0) > 0 ||
      habitCount > 0
    return isActive ? 1 : 0
  })

  const focusDelta = percentDelta(
    summary?.total_focus_seconds ?? 0,
    previousSummary?.total_focus_seconds ?? 0
  )
  const taskDelta = percentDelta(
    summary?.tasks_completed ?? 0,
    previousSummary?.tasks_completed ?? 0
  )
  const pomodoroDelta = percentDelta(
    summary?.pomodoros_completed ?? 0,
    previousSummary?.pomodoros_completed ?? 0
  )
  const activeDaysDelta = percentDelta(
    summary?.days_active ?? 0,
    previousSummary?.days_active ?? 0
  )

  const focusSessions = pomodoroSummary.find(s => s.session_type === 'focus')
  const avgSessionMinutes =
    focusSessions && focusSessions.sessions > 0
      ? Math.round(focusSessions.total_seconds / focusSessions.sessions / 60)
      : 0

  const trackedDays = Math.max(filledFocusData.length, 1)
  const focusTargetRatio = Math.min(
    (summary?.total_focus_seconds ?? 0) / (trackedDays * 45 * 60),
    1
  )
  const taskFlowRatio = Math.min(
    (summary?.tasks_completed ?? 0) / Math.max(summary?.tasks_created ?? 1, 1),
    1
  )
  const activeCadenceRatio = Math.min(
    (summary?.days_active ?? 0) / trackedDays,
    1
  )
  const habitStreakRatio = Math.min(
    (summary?.best_habit_streak ?? 0) /
      Math.max(Math.round(trackedDays * 0.35), 1),
    1
  )

  const focusScore = Math.round(
    focusTargetRatio * 35 +
      taskFlowRatio * 30 +
      activeCadenceRatio * 20 +
      habitStreakRatio * 15
  )
  const focusGrade = gradeFromScore(focusScore)

  const contribution = useMemo(
    () => buildContributionWeeks(habitLogs.map(log => log.completed_date)),
    [habitLogs]
  )
  const [hoveredContribution, setHoveredContribution] = useState<{
    dateISO: string
    count: number
    x: number
    y: number
  } | null>(null)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-8 lg:p-12">
      <div className="mx-auto w-full max-w-[1400px] space-y-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground/80">
              Métricas claras, tendências e evolução.
            </p>
          </div>
          <PeriodToggle />
        </header>

        <div
          className={cn(
            'flex flex-col gap-8 transition-opacity duration-500',
            isLoading ? 'pointer-events-none opacity-40' : 'opacity-100'
          )}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <StatBox
              title="Focus Time"
              value={formatDuration(summary?.total_focus_seconds ?? 0)}
              subtitle={
                summary?.top_productivity_day
                  ? `Peak: ${new Date(
                      summary.top_productivity_day
                    ).toLocaleDateString(undefined, { weekday: 'long' })}`
                  : undefined
              }
              delta={focusDelta}
              deltaLabel={comparisonLabel(period)}
              sparklineData={focusSparkline}
            />

            <StatBox
              title="Tasks Completed"
              value={summary?.tasks_completed ?? 0}
              subtitle={`${summary?.tasks_created ?? 0} items created`}
              delta={taskDelta}
              deltaLabel={comparisonLabel(period)}
              sparklineData={taskSparkline}
            />

            <StatBox
              title="Pomodoros"
              value={summary?.pomodoros_completed ?? 0}
              subtitle={
                avgSessionMinutes > 0
                  ? `${avgSessionMinutes}m avg session`
                  : undefined
              }
              delta={pomodoroDelta}
              deltaLabel={comparisonLabel(period)}
              sparklineData={pomodoroSparkline}
            />

            <StatBox
              title="Days Active"
              value={summary?.days_active ?? 0}
              subtitle="Days with tracked activity"
              delta={activeDaysDelta}
              deltaLabel={comparisonLabel(period)}
              sparklineData={activeDaysSparkline}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.35fr)]">
            <div className="rounded-2xl border border-border/30 bg-card/5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  Focus Score
                </h2>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Weighted Index
                </span>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[auto_1fr] xl:items-center">
                <ScoreRing score={focusScore} grade={focusGrade} />
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Score composition for the selected period:
                  </p>
                  <div className="space-y-2 text-sm text-foreground/90">
                    <div className="flex items-center justify-between">
                      <span>Focus depth</span>
                      <span className="font-mono">
                        {Math.round(focusTargetRatio * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Task completion flow</span>
                      <span className="font-mono">
                        {Math.round(taskFlowRatio * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active cadence</span>
                      <span className="font-mono">
                        {Math.round(activeCadenceRatio * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Habit momentum</span>
                      <span className="font-mono">
                        {Math.round(habitStreakRatio * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/30 bg-card/5 p-6">
              <h2 className="text-sm font-medium text-foreground">
                Task Activity
              </h2>
              <div className="mt-4 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filledTaskData}
                    barCategoryGap="34%"
                    barGap={4}
                  >
                    <CartesianGrid
                      stroke="color-mix(in oklab, var(--border) 70%, transparent)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tickFormatter={val =>
                        new Date(`${val}T12:00:00Z`).toLocaleDateString(
                          undefined,
                          {
                            weekday: 'short',
                          }
                        )
                      }
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={14}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      dx={-8}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: 'var(--muted)', opacity: 0.16 }}
                    />
                    <Bar
                      dataKey="created"
                      name="Created"
                      fill="color-mix(in oklab, var(--chart-4) 88%, transparent)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={22}
                    />
                    <Bar
                      dataKey="completed"
                      name="Completed"
                      fill="color-mix(in oklab, var(--chart-2) 92%, transparent)"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/5 p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">
                Consistency Map
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>
                  {contribution.totalContributions} contributions in the last
                  year
                </span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map(level => (
                    <span
                      key={level}
                      className="size-2.5 rounded-[3px] border border-border/50"
                      style={{
                        backgroundColor: contributionColor(
                          level as 0 | 1 | 2 | 3 | 4
                        ),
                      }}
                    />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="relative inline-flex min-w-max gap-2">
                <div className="mt-6 grid grid-rows-7 gap-1 text-[10px] text-muted-foreground/80">
                  <span />
                  <span>Mon</span>
                  <span />
                  <span>Wed</span>
                  <span />
                  <span>Fri</span>
                  <span />
                </div>

                <div>
                  <div
                    className="mb-2 grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${contribution.weeks.length}, 12px)`,
                    }}
                  >
                    {contribution.weeks.map((week, index) => (
                      <span
                        key={`month-${index}`}
                        className="text-[10px] text-muted-foreground/80"
                      >
                        {week.monthLabel}
                      </span>
                    ))}
                  </div>

                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${contribution.weeks.length}, 12px)`,
                    }}
                  >
                    {contribution.weeks.map((week, weekIndex) => (
                      <div
                        key={`week-${weekIndex}`}
                        className="grid grid-rows-7 gap-1"
                      >
                        {week.days.map(day => {
                          const level = contributionLevel(
                            day.count,
                            contribution.maxCount
                          )
                          return (
                            <div
                              key={day.dateISO}
                              className={cn(
                                'size-3 rounded-[3px] border border-border/55 transition-[transform,filter,background-color,border-color] duration-100 ease-out hover:scale-110 hover:brightness-110',
                                day.outside && 'opacity-20'
                              )}
                              style={{
                                backgroundColor: contributionColor(level),
                              }}
                              onMouseEnter={event => {
                                const rect =
                                  event.currentTarget.getBoundingClientRect()
                                setHoveredContribution({
                                  dateISO: day.dateISO,
                                  count: day.count,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                })
                              }}
                              onMouseLeave={() => setHoveredContribution(null)}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {hoveredContribution && (
                <div
                  className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-2 rounded-md border border-border/70 bg-popover/95 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-sm"
                  style={{
                    left: hoveredContribution.x,
                    top: hoveredContribution.y,
                  }}
                >
                  {hoveredContribution.count} completion
                  {hoveredContribution.count === 1 ? '' : 's'} on{' '}
                  {new Date(
                    `${hoveredContribution.dateISO}T12:00:00Z`
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
