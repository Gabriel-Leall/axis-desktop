import { useState } from 'react'
import { WidgetCard } from '../WidgetCard'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

/**
 * Calendar widget — simple month view.
 */
export function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const today = new Date()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthLabel = currentDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1))

  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1))

  return (
    <WidgetCard title="Calendar" icon={CalendarIcon}>
      <div className="flex h-full flex-col">
        {/* Month navigation */}
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded p-0.5 hover:bg-accent"
            type="button"
          >
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="rounded p-0.5 hover:bg-accent"
            type="button"
          >
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div
              key={d}
              className="pb-1 text-[10px] font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}

          {/* Day cells */}
          {days.map((day, idx) => (
            <div
              key={idx}
              className={`flex aspect-square items-center justify-center rounded text-xs ${
                day === null
                  ? ''
                  : isToday(day)
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  )
}
