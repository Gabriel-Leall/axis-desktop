import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { useCalendarStore } from '@/store/calendar-store'
import { getEventsForDate, getLocalISODate } from '@/lib/calendar-domain'
import { motion } from 'motion/react'

const WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarWidget() {
  const { t, i18n } = useTranslation()
  const navigateTo = useUIStore(state => state.navigateTo)
  const loadEvents = useCalendarStore(state => state.loadEvents)
  const events = useCalendarStore(state => state.events)

  const today = new Date()
  const currentDate = new Date(today.getFullYear(), today.getMonth(), 1)
  const month = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthLabel = currentDate.toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  })

  const weekdays = i18n.language.startsWith('pt') ? WEEKDAYS_PT : WEEKDAYS_EN

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  useEffect(() => {
    loadEvents(new Date(year, month, 1))
  }, [loadEvents, year, month])

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  const prevMonth = () => loadEvents(new Date(year, month - 1, 1))
  const nextMonth = () => loadEvents(new Date(year, month + 1, 1))

  const handleClick = () => navigateTo('calendar')

  return (
    <WidgetCard title={t('calendar.widgetTitle')} icon={CalendarIcon}>
      <div
        className="flex h-full flex-col cursor-pointer"
        onClick={handleClick}
      >
        <div className="mb-2 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={e => {
              e.stopPropagation()
              prevMonth()
            }}
            className="rounded p-0.5 hover:bg-accent"
            type="button"
          >
            <ChevronLeft className="size-4 text-muted-foreground" />
          </motion.button>
          <span className="text-sm font-medium text-foreground">
            {monthLabel}
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={e => {
              e.stopPropagation()
              nextMonth()
            }}
            className="rounded p-0.5 hover:bg-accent"
            type="button"
          >
            <ChevronRight className="size-4 text-muted-foreground" />
          </motion.button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {weekdays.map(d => (
            <div
              key={d}
              className="pb-1 text-[10px] font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}

          {days.map((day, idx) => {
            let dateISO: string | null = null
            let dayEvents: any[] = []
            
            try {
              dateISO = day
                ? getLocalISODate(new Date(year, month, day))
                : null
              dayEvents = dateISO ? getEventsForDate(events, dateISO) : []
            } catch (e) {
              console.error('Error calculating date in CalendarWidget', e)
            }
            
            const hasEvents = dayEvents.length > 0

            return (
              <div
                key={idx}
                className={`relative flex aspect-square items-center justify-center rounded text-xs ${
                  day === null
                    ? ''
                    : isToday(day)
                      ? 'bg-primary font-bold text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                }`}
              >
                {day}
                {hasEvents && (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <span
                        key={i}
                        className="size-1 rounded-full bg-primary"
                      />
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </WidgetCard>
  )
}
