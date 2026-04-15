import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalendarStore } from '@/store/calendar-store'
import { useUIStore } from '@/store/ui-store'
import { getLocalISODate } from '@/lib/calendar-domain'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { getEventsForDate } from '@/lib/calendar-domain'
import type { Task } from '@/store/tasks-store'

interface CalendarPageProps {
  tasks?: Task[]
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarPage({ tasks = [] }: CalendarPageProps) {
  const { t, i18n } = useTranslation()
  const loadEvents = useCalendarStore(state => state.loadEvents)
  const events = useCalendarStore(state => state.events)
  const createEvent = useCalendarStore(state => state.createEvent)
  const deleteEvent = useCalendarStore(state => state.deleteEvent)
  const navigateTo = useUIStore(state => state.navigateTo)

  const today = new Date()
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  const weekdays = i18n.language.startsWith('pt') ? WEEKDAYS_PT : WEEKDAYS_EN

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const monthLabel = currentDate.toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    loadEvents(currentDate)
  }, [loadEvents, currentDate])

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  function handleSave() {
    if (!title.trim() || !startDate || !endDate) return
    const now = new Date().toISOString()

    if (editingId) {
      useCalendarStore.getState().updateEvent({
        id: editingId,
        title,
        start_date: startDate,
        end_date: endDate,
        all_day: allDay,
        updated_at: now,
      })
    } else {
      createEvent({
        title,
        description: undefined,
        start_date: startDate,
        end_date: endDate,
        all_day: allDay,
        color: undefined,
      })
    }

    setShowModal(false)
    resetForm()
    loadEvents(currentDate)
  }

  function handleDelete() {
    if (editingId) {
      deleteEvent(editingId)
      setShowModal(false)
      resetForm()
      loadEvents(currentDate)
    }
  }

  function resetForm() {
    setTitle('')
    setStartDate('')
    setEndDate('')
    setAllDay(true)
    setEditingId(null)
  }

  function goBack() {
    navigateTo('grid')
  }

  return (
    <div className="flex h-full flex-col bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goBack}>
          {t('common.back')}
        </Button>
        <h1 className="text-xl font-semibold">{t('calendar.pageTitle')}</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="mr-1 size-4" />
          {t('calendar.addEvent')}
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          ←
        </Button>
        <span className="text-lg font-medium">{monthLabel}</span>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          →
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-border">
          {weekdays.map(d => (
            <div
              key={d}
              className="bg-muted p-2 text-center text-sm font-medium"
            >
              {d}
            </div>
          ))}

          {days.map((day, idx) => {
            const dateISO = day
              ? getLocalISODate(new Date(year, month, day))
              : null
            const dayEvents = dateISO ? getEventsForDate(events, dateISO) : []
            const taskEvents = dateISO
              ? tasks.filter(t => t.due_date === dateISO && t.status !== 'done')
              : []
            const allEvents = [
              ...dayEvents,
              ...taskEvents.map(t => ({ ...t, id: `task_${t.id}` })),
            ]

            return (
              <div
                key={idx}
                className={`min-h-24 border bg-background p-1 ${
                  day === null ? 'bg-muted/30' : ''
                }`}
              >
                {day && (
                  <>
                    <div className="text-xs font-medium">{day}</div>
                    <div className="space-y-1 overflow-y-auto">
                      {allEvents.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          className={`truncate rounded px-1 py-0.5 text-xs ${
                            e.id.startsWith('task_')
                              ? 'bg-indigo-500 text-white'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {allEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{allEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-96 rounded-lg border bg-background p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? t('calendar.editEvent') : t('calendar.newEvent')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  {t('calendar.title')}
                </label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('calendar.titlePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">
                    {t('calendar.start')}
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t('calendar.end')}
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allDay}
                  onCheckedChange={c => setAllDay(!!c)}
                />
                <span className="text-sm">{t('calendar.allDay')}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between">
              {editingId && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="mr-1 size-4" />
                  {t('common.delete')}
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                >
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
