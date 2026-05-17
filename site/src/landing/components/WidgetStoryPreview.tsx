import { CalendarDays, Flame, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  calendarShowcaseDays,
  getHabitShowcaseRows,
  getKanbanColumns,
  getPomodoroMetricCountdown,
  getTaskShowcaseRows,
  pomodoroCoreCountdown,
} from '../data'
import type { WidgetSlug } from '../types'

export function WidgetStoryPreview({
  slug,
  active,
}: {
  slug: WidgetSlug
  active: boolean
}) {
  const { t, i18n } = useTranslation()
  const taskShowcaseRows = getTaskShowcaseRows(t)
  const habitShowcaseRows = getHabitShowcaseRows(t)
  const kanbanColumns = getKanbanColumns(t)
  const pomodoroMetricCountdown = getPomodoroMetricCountdown(t)

  if (slug === 'tasks') {
    return (
      <div
        className="widget-story-demo widget-story-demo--tasks"
        data-preview-active={active ? 'true' : 'false'}
      >
        <div className="widget-story-metric">
          <span>{t('landing.preview.tasks.metricLabel')}</span>
          <strong>{t('landing.preview.tasks.metricValue')}</strong>
        </div>
        <div className="widget-story-task-list">
          <span className="widget-story-fake-cursor" aria-hidden="true" />
          {taskShowcaseRows.map((task, index) => (
            <div
              key={task.title}
              className={`widget-story-task-row${
                task.completed ? ' is-complete' : ''
              }${index === 0 ? ' is-simulated' : ''}`}
            >
              <span className="widget-story-task-check" aria-hidden="true" />
              <span className="widget-story-task-copy">{task.title}</span>
              {index === 0 ? (
                <span className="widget-story-task-status">
                  <span className="widget-story-task-tag widget-story-task-tag--high">
                    {task.level}
                  </span>
                  <span className="widget-story-task-done">
                    {t('landing.preview.tasks.done')}
                  </span>
                </span>
              ) : (
                <span
                  className={`widget-story-task-tag${
                    task.level === t('landing.preview.levels.high')
                      ? ' widget-story-task-tag--high'
                      : ' widget-story-task-tag--medium'
                  }`}
                >
                  {task.level}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="widget-story-inline-note">
          {active
            ? t('landing.preview.tasks.activeNote')
            : t('landing.preview.tasks.idleNote')}
        </div>
      </div>
    )
  }

  if (slug === 'habit-tracker') {
    return (
      <div
        className="widget-story-demo widget-story-demo--habit"
        data-preview-active={active ? 'true' : 'false'}
      >
        <div className="widget-story-metric">
          <span>{t('landing.preview.habits.metricLabel')}</span>
          <strong>{t('landing.preview.habits.metricValue')}</strong>
        </div>
        <div className="widget-story-habit-list">
          {habitShowcaseRows.map((habit, index) => (
            <div
              key={habit.title}
              className={`widget-story-habit-row${
                habit.completed ? ' is-complete' : ''
              }${index === 0 ? ' is-simulated' : ''}`}
            >
              <div>
                <strong>{habit.title}</strong>
                {index === 0 ? (
                  <span className="widget-story-habit-streak">
                    <span className="widget-story-habit-streak-old">
                      {t('landing.preview.habits.streak', {
                        count: habit.streak,
                      })}
                    </span>
                    <span className="widget-story-habit-streak-new">
                      {t('landing.preview.habits.streak', {
                        count: habit.streak + 1,
                      })}
                    </span>
                  </span>
                ) : (
                  <span>
                    {t('landing.preview.habits.streak', {
                      count: habit.streak,
                    })}
                  </span>
                )}
              </div>
              <span
                className={`widget-story-habit-fire${
                  index === 0 ? ' is-simulated' : ''
                }`}
                aria-hidden="true"
              >
                <Flame />
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (slug === 'pomodoro') {
    return (
      <div
        className="widget-story-demo widget-story-demo--pomodoro"
        data-preview-active={active ? 'true' : 'false'}
      >
        <div className="widget-story-metric">
          <span>{t('landing.preview.pomodoro.metricLabel')}</span>
          <strong className="widget-story-focus-metric">
            <span className="widget-story-focus-time-stage">
              <span className="widget-story-focus-time-track">
                {pomodoroMetricCountdown.map(time => (
                  <span key={time} className="widget-story-focus-time-item">
                    {time}
                  </span>
                ))}
              </span>
            </span>
          </strong>
        </div>
        <div className="widget-story-focus-shell">
          <div className="widget-story-focus-ring">
            <div className="widget-story-focus-core">
              <span className="widget-story-focus-time-stage">
                <span className="widget-story-focus-time-track">
                  {pomodoroCoreCountdown.map(time => (
                    <span key={time} className="widget-story-focus-time-item">
                      {time}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          </div>
          <div className="widget-story-focus-task">
            {t('landing.preview.pomodoro.task')}
          </div>
          <div className="widget-story-focus-progress" aria-hidden="true">
            <span />
          </div>
          <div className="widget-story-focus-controls" aria-hidden="true">
            <span>↺</span>
            <span className="is-primary widget-story-focus-play-button">
              <span className="widget-story-focus-play-icon">
                <Play fill="currentColor" />
              </span>
              <span className="widget-story-focus-pause-icon">
                <span />
                <span />
              </span>
            </span>
            <span>↷</span>
          </div>
        </div>
      </div>
    )
  }

  if (slug === 'kanban') {
    return (
      <div
        className="widget-story-demo widget-story-demo--kanban"
        data-preview-active={active ? 'true' : 'false'}
      >
        <div className="widget-story-metric">
          <span>{t('landing.preview.kanban.metricLabel')}</span>
          <strong>{t('landing.preview.kanban.metricValue')}</strong>
        </div>
        <div className="widget-story-kanban-board">
          {kanbanColumns.map(column => (
            <div
              key={column.label}
              className={`widget-story-kanban-column${
                column.label === 'In Progress'
                  ? ' widget-story-kanban-column--in-progress'
                  : column.label === 'Done'
                    ? ' widget-story-kanban-column--done'
                    : ''
              }`}
            >
              <span>{column.label}</span>
              <div className="widget-story-kanban-cards">
                {column.cards.map(card => (
                  <div key={card} className="widget-story-kanban-card">
                    {card}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="widget-story-kanban-floating-card" aria-hidden="true">
            {t('landing.preview.kanban.cards.syncWidgetStory')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="widget-story-demo widget-story-demo--calendar"
      data-preview-active={active ? 'true' : 'false'}
    >
      <div className="widget-story-metric">
        <span>{t('landing.preview.calendar.metricLabel')}</span>
        <strong>{t('landing.preview.calendar.metricValue')}</strong>
      </div>
      <div className="widget-story-calendar-shell">
        <div className="widget-story-calendar-head">
          <span>{t('landing.preview.calendar.month')}</span>
          <span>{t('landing.preview.calendar.review')}</span>
        </div>
        <div className="widget-story-calendar-weekdays">
          {(i18n.resolvedLanguage?.startsWith('pt')
            ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
            : ['M', 'T', 'W', 'T', 'F', 'S', 'S']
          ).map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="widget-story-calendar-grid">
          {calendarShowcaseDays.map(([day, selected], index) => (
            <span
              key={`${day}-${index}`}
              className={selected ? 'is-selected' : undefined}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="widget-story-calendar-note" aria-hidden="true">
          <CalendarDays />
          <span>{t('landing.preview.calendar.note')}</span>
        </div>
      </div>
    </div>
  )
}
