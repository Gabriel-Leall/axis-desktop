import { useEffect } from 'react'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  CheckSquare,
  Clock,
  Target,
  Flame,
  LayoutGrid,
} from 'lucide-react'
import { useAnalyticsStore } from '@/store/analytics-store'
import { formatDuration } from '@/lib/analytics-domain'
import type { AnalyticsPeriod } from '@/lib/analytics-domain'
import { HeatMap } from '@/components/habits/HeatMap'
import { cn } from '@/lib/utils'

function PeriodToggle() {
  const period = useAnalyticsStore(state => state.period)
  const setPeriod = useAnalyticsStore(state => state.setPeriod)

  const periods: { value: AnalyticsPeriod; label: string }[] = [
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'all_time', label: 'All Time' },
  ]

  return (
    <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/20">
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={cn(
            'px-3 py-1.5 text-[13px] font-medium rounded-md transition-all',
            period === p.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:border-border/80 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs font-medium text-muted-foreground/80">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function FocusTimeChart() {
  const data = useAnalyticsStore(state => state.focusTimeData)

  if (!data || data.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No focus data for this period
      </div>
    )

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="day"
          tickFormatter={val =>
            new Date(`${val}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' })
          }
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          tickFormatter={val => Math.round(val / 60) + 'm'}
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <RechartsTooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(val: any) => [formatDuration(Number(val)), 'Focus Time']}
          labelFormatter={val =>
            new Date(`${val}T12:00:00Z`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
          }
          contentStyle={{
            backgroundColor: 'hsl(var(--popup))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
          itemStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Line
          type="monotone"
          dataKey="total_seconds"
          stroke="hsl(var(--chart-1))"
          strokeWidth={3}
          dot={false}
          activeDot={{
            r: 5,
            fill: 'hsl(var(--chart-1))',
            stroke: 'hsl(var(--background))',
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TasksChart() {
  const data = useAnalyticsStore(state => state.taskCountData)

  if (!data || data.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No task data for this period
      </div>
    )

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <XAxis
          dataKey="day"
          tickFormatter={val =>
            new Date(`${val}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' })
          }
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <RechartsTooltip
          labelFormatter={val =>
            new Date(`${val}T12:00:00Z`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
          }
          contentStyle={{
            backgroundColor: 'hsl(var(--popup))',
            borderColor: 'hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13px',
          }}
        />
        <Bar
          dataKey="completed"
          name="Completed"
          fill="hsl(var(--chart-2))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="created"
          name="Created"
          fill="hsl(var(--chart-3))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function HabitHeatmapSection() {
  const logs = useAnalyticsStore(state => state.habitLogs)
  const period = useAnalyticsStore(state => state.period)

  const days =
    period === 'this_week'
      ? 14
      : period === 'this_month'
        ? 30
        : period === 'this_year'
          ? 365
          : 365

  return (
    <div className="flex h-full flex-col justify-center overflow-x-auto pb-2">
      <div className="min-w-max pr-4">
        <HeatMap
          logs={logs.map(l => l.completed_date)}
          days={days}
          color="hsl(var(--primary))"
          size={days > 60 ? 'sm' : 'md'}
        />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const loadData = useAnalyticsStore(state => state.loadData)
  const summary = useAnalyticsStore(state => state.summary)
  const pomodoroSummary = useAnalyticsStore(state => state.pomodoroSummary)
  const isLoading = useAnalyticsStore(state => state.isLoading)

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal productivity insights.
          </p>
        </div>
        <PeriodToggle />
      </div>

      <div className={cn('transition-opacity duration-300', isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100')}>
        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Focus Time"
            value={formatDuration(summary?.total_focus_seconds ?? 0)}
            subtitle={
              summary?.top_productivity_day
                ? `Most active: ${new Date(summary.top_productivity_day).toLocaleDateString(undefined, {
                    weekday: 'long',
                  })}`
                : undefined
            }
            icon={Clock}
          />
          <StatCard
            title="Tasks Completed"
            value={summary?.tasks_completed ?? 0}
            subtitle={`${summary?.tasks_created ?? 0} items created`}
            icon={CheckSquare}
          />
          <StatCard
            title="Pomodoros"
            value={summary?.pomodoros_completed ?? 0}
            subtitle={
              (() => {
                const focusSummary = pomodoroSummary?.find(s => s.session_type === 'focus')
                if (!focusSummary || focusSummary.sessions === 0) return undefined
                const avgMin = Math.round(focusSummary.total_seconds / focusSummary.sessions / 60)
                return `${avgMin}m avg session`
              })()
            }
            icon={Target}
          />
          <StatCard
            title="Days Active"
            value={summary?.days_active ?? 0}
            subtitle="Days with tracked activity"
            icon={Flame}
          />
        </div>

        {/* Charts Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Focus Time Line Chart */}
          <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Focus Time Trend
              </h2>
            </div>
            <div className="h-64">
              <FocusTimeChart />
            </div>
          </div>

          {/* Tasks Bar Chart */}
          <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <LayoutGrid className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Task Activity
              </h2>
            </div>
            <div className="h-64">
              <TasksChart />
            </div>
          </div>
        </div>

        {/* Habits Heatmap */}
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <Flame className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Habit Consistency
            </h2>
          </div>
          <div className="h-40">
            <HabitHeatmapSection />
          </div>
        </div>
      </div>
    </div>
  )
}
