import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { Calendar } from '@/components/ui/calendar-rac'
import { useState } from 'react'
import { getLocalTimeZone, today } from '@internationalized/date'
import type { DateValue } from 'react-aria-components'

export function CalendarWidget() {
  const { t } = useTranslation()
  const navigateTo = useUIStore(state => state.navigateTo)
  const [date, setDate] = useState<DateValue | null>(today(getLocalTimeZone()))

  const handleClick = () => navigateTo('calendar')

  const now = today(getLocalTimeZone())
  const taskDates = [
    now.set({ day: 15 }).toString(),
    now.set({ day: 20 }).toString(),
    now.set({ day: 25 }).toString(),
  ]

  return (
    <WidgetCard
      title={t('calendar.widgetTitle')}
      icon={CalendarIcon}
      contentClassName="overflow-hidden p-2"
    >
      <div
        className="flex h-full min-h-[220px] w-full flex-col cursor-pointer items-center justify-start"
        onClick={handleClick}
      >
        <Calendar
          className="h-full w-full"
          value={date}
          onChange={setDate}
          taskDates={taskDates}
          compact
        />
      </div>
    </WidgetCard>
  )
}
