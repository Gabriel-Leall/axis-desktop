import {
  CalendarDays,
  CheckSquare,
  Download,
  Flame,
  FolderOpen,
  Play,
  Timer,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  downloadUrl,
  getHeroPreviewHabits,
  getHeroPreviewTasks,
  heroCalendarDays,
  heroSidebarItems,
} from '../data'

export function HeroSection() {
  const { t, i18n } = useTranslation()
  const heroPreviewTasks = getHeroPreviewTasks(t)
  const heroPreviewHabits = getHeroPreviewHabits(t)
  const calendarWeekdays = i18n.resolvedLanguage?.startsWith('pt')
    ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <section className="hero-section" data-reveal={true} data-delay="1">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="hero-kicker">{t('landing.hero.kicker')}</p>
          <h1>{t('landing.hero.title')}</h1>
          <p>{t('landing.hero.subtitle')}</p>
          <div className="hero-actions">
            <a className="primary-action" href={downloadUrl}>
              <Download />
              {t('landing.hero.primaryCta')}
            </a>
          </div>
          <div
            className="hero-preview"
            aria-label={t('landing.hero.preview.ariaLabel')}
          >
            <div className="hero-preview-window">
              <div className="hero-preview-toolbar">
                <div className="hero-preview-toolbar-brand">
                  <img src="/Axis-Logo.png" alt="" />
                  <span>Axis Desktop</span>
                </div>
                <span className="hero-preview-toolbar-clock">
                  {t('landing.hero.preview.clock')}
                </span>
                <div
                  className="hero-preview-toolbar-controls"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="hero-preview-body">
                <aside className="hero-preview-sidebar" aria-hidden="true">
                  {heroSidebarItems.map(item => {
                    const Icon = item.icon
                    return (
                      <span
                        key={item.labelKey}
                        className={item.active ? 'is-active' : undefined}
                        title={t(item.labelKey)}
                      >
                        <Icon />
                      </span>
                    )
                  })}
                </aside>

                <div className="hero-preview-canvas">
                  <div className="hero-preview-grid">
                    <article className="hero-widget hero-widget--notes">
                      <div className="hero-widget-head">
                        <FolderOpen />
                        <span>{t('landing.hero.preview.notes.title')}</span>
                      </div>
                      <div className="hero-widget-body hero-widget-body--empty">
                        {t('landing.hero.preview.notes.placeholder')}
                      </div>
                      <div className="hero-widget-foot">
                        <span>{t('landing.hero.preview.notes.count')}</span>
                        <span>1/2</span>
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--focus">
                      <div className="hero-widget-head">
                        <Timer />
                        <span>{t('landing.hero.preview.focus.title')}</span>
                      </div>
                      <div className="hero-focus-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="hero-focus-pill">
                        {t('landing.hero.preview.focus.emptyTask')}
                      </div>
                      <div className="hero-focus-time">01:00</div>
                      <div className="hero-focus-controls">
                        <button
                          type="button"
                          aria-label={t('landing.hero.preview.focus.reset')}
                        >
                          ↺
                        </button>
                        <button
                          type="button"
                          className="hero-focus-play"
                          aria-label={t('landing.hero.preview.focus.start')}
                        >
                          <Play fill="currentColor" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('landing.hero.preview.focus.skip')}
                        >
                          ↷
                        </button>
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--calendar">
                      <div className="hero-widget-head">
                        <CalendarDays />
                        <span>{t('landing.hero.preview.calendar.title')}</span>
                      </div>
                      <div className="hero-calendar">
                        <div className="hero-calendar-head">
                          <span>
                            {t('landing.hero.preview.calendar.month')}
                          </span>
                        </div>
                        <div className="hero-calendar-weekdays">
                          {calendarWeekdays.map(day => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>
                        <div className="hero-calendar-grid">
                          {heroCalendarDays.map((day, index) => (
                            <span
                              key={`${day}-${index}`}
                              className={
                                day === '6' && index === 7
                                  ? 'is-selected'
                                  : index < 2 || index > 32
                                    ? 'is-muted'
                                    : undefined
                              }
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--tasks">
                      <div className="hero-widget-head">
                        <CheckSquare />
                        <span>{t('landing.hero.preview.tasks.title')}</span>
                      </div>
                      <div className="hero-task-list">
                        {heroPreviewTasks.map(task => (
                          <div key={task.title} className="hero-task-row">
                            <span
                              className="hero-task-check"
                              aria-hidden="true"
                            />
                            <span className="hero-task-title">
                              {task.title}
                            </span>
                            <span
                              className={`hero-task-badge ${
                                task.level === t('landing.preview.levels.high')
                                  ? 'hero-task-badge--high'
                                  : 'hero-task-badge--medium'
                              }`}
                            >
                              {task.level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--protocol">
                      <div className="hero-widget-head">
                        <Flame />
                        <span>{t('landing.hero.preview.protocol.title')}</span>
                      </div>
                      <div className="hero-protocol-meta">
                        {t('landing.hero.preview.protocol.meta')}
                      </div>
                      <div className="hero-habit-list">
                        {heroPreviewHabits.map(habit => (
                          <div key={habit} className="hero-habit-row">
                            <div>
                              <strong>{habit}</strong>
                              <span>
                                {t('landing.hero.preview.protocol.streak')}
                              </span>
                            </div>
                            <span
                              className="hero-habit-mark"
                              aria-hidden="true"
                            >
                              <Flame />
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
