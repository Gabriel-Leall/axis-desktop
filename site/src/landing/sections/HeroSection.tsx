import { CalendarDays, CheckSquare, Download, Flame, FolderOpen, Play, Timer } from 'lucide-react'
import {
  downloadUrl,
  heroCalendarDays,
  heroPreviewHabits,
  heroPreviewTasks,
  heroSidebarItems,
} from '../data'

export function HeroSection() {
  return (
    <section className="hero-section" data-reveal={true} data-delay="1">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="hero-kicker">Axis Desktop</p>
          <h1>Turn your daily chaos into ruthless focus.</h1>
          <p>
            No more scattered tools. Tasks, habits, and calendar flow perfectly in one
            local-first command center.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href={downloadUrl}>
              <Download />
              Download Axis Desktop
            </a>
          </div>
          <div className="hero-preview" aria-label="Axis Desktop board preview">
            <div className="hero-preview-window">
              <div className="hero-preview-toolbar">
                <div className="hero-preview-toolbar-brand">
                  <img src="/Axis-Logo.png" alt="" />
                  <span>Axis Desktop</span>
                </div>
                <span className="hero-preview-toolbar-clock">Wed, May 06 01:44 AM</span>
                <div className="hero-preview-toolbar-controls" aria-hidden="true">
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
                      <span key={item.label} className={item.active ? 'is-active' : undefined}>
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
                        <span>Brain Dump</span>
                      </div>
                      <div className="hero-widget-body hero-widget-body--empty">
                        Dump it here...
                      </div>
                      <div className="hero-widget-foot">
                        <span>2 notes</span>
                        <span>1/2</span>
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--focus">
                      <div className="hero-widget-head">
                        <Timer />
                        <span>Focus</span>
                      </div>
                      <div className="hero-focus-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="hero-focus-pill">No task selected</div>
                      <div className="hero-focus-time">01:00</div>
                      <div className="hero-focus-controls">
                        <button type="button" aria-label="Reset focus timer">
                          ↺
                        </button>
                        <button
                          type="button"
                          className="hero-focus-play"
                          aria-label="Start focus timer"
                        >
                          <Play fill="currentColor" />
                        </button>
                        <button type="button" aria-label="Skip focus timer">
                          ↷
                        </button>
                      </div>
                    </article>

                    <article className="hero-widget hero-widget--calendar">
                      <div className="hero-widget-head">
                        <CalendarDays />
                        <span>Calendar</span>
                      </div>
                      <div className="hero-calendar">
                        <div className="hero-calendar-head">
                          <span>May 2026</span>
                        </div>
                        <div className="hero-calendar-weekdays">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
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
                        <span>Today</span>
                      </div>
                      <div className="hero-task-list">
                        {heroPreviewTasks.map(task => (
                          <div key={task.title} className="hero-task-row">
                            <span className="hero-task-check" aria-hidden="true" />
                            <span className="hero-task-title">{task.title}</span>
                            <span
                              className={`hero-task-badge ${
                                task.level === 'High'
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
                        <span>Protocol</span>
                      </div>
                      <div className="hero-protocol-meta">2/13 ACTIVE</div>
                      <div className="hero-habit-list">
                        {heroPreviewHabits.map(habit => (
                          <div key={habit} className="hero-habit-row">
                            <div>
                              <strong>{habit}</strong>
                              <span>STREAK: 0</span>
                            </div>
                            <span className="hero-habit-mark" aria-hidden="true">
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

