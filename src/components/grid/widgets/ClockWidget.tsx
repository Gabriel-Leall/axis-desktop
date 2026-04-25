import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WidgetCard } from '../WidgetCard'
import { Clock as ClockIcon } from 'lucide-react'

/**
 * Clock widget — shows current time and date.
 */
export function ClockWidget() {
  const { t, i18n } = useTranslation()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = time.getHours().toString().padStart(2, '0')
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const seconds = time.getSeconds().toString().padStart(2, '0')

  const dateStr = time.toLocaleDateString(i18n.resolvedLanguage, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <WidgetCard title={t('widgets.clock.title')} icon={ClockIcon}>
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <div className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
          {hours}
          <span className="animate-pulse text-muted-foreground">:</span>
          {minutes}
          <span className="animate-pulse text-muted-foreground">:</span>
          {seconds}
        </div>
        <div className="text-sm text-muted-foreground">{dateStr}</div>
      </div>
    </WidgetCard>
  )
}
