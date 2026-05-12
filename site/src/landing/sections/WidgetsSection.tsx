import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { getWidgetCards } from '../data'
import type { WidgetCard } from '../types'
import { WidgetStoryPreview } from '../components/WidgetStoryPreview'

export function WidgetsSection({
  sectionRef,
  activeWidgetIndex,
  activeWidget,
  previousWidget,
  isWidgetTransitioning,
}: {
  sectionRef: RefObject<HTMLElement | null>
  activeWidgetIndex: number
  activeWidget: WidgetCard
  previousWidget: WidgetCard | null
  isWidgetTransitioning: boolean
}) {
  const { t } = useTranslation()
  const widgetCards = getWidgetCards(t)
  const ActiveWidgetIcon = activeWidget.icon
  const PreviousWidgetIcon = previousWidget?.icon

  return (
    <section
      id="widgets"
      ref={sectionRef}
      className="widgets-section"
      data-reveal={true}
      data-delay="3"
    >
      <div className="widgets-shell">
        <div className="widgets-showcase" data-widget-story-index={activeWidgetIndex}>
          <div className="widgets-copy-panel">
            <div className="widgets-copy-stage">
              {previousWidget && isWidgetTransitioning ? (
                <div className="widgets-copy-swap widgets-copy-swap--leaving">
                  <h2>{previousWidget.title}</h2>
                  <p>{previousWidget.description}</p>
                </div>
              ) : null}

              <div
                className={`widgets-copy-swap${
                  isWidgetTransitioning ? ' widgets-copy-swap--entering' : ''
                }`}
                key={activeWidget.slug}
              >
                <h2>{activeWidget.title}</h2>
                <p>{activeWidget.description}</p>
              </div>
            </div>

            <div
              className="widgets-progress-nav"
              aria-label={t('landing.widgets.progressAriaLabel')}
            >
              {widgetCards.map((item, index) => (
                <span
                  key={item.slug}
                  className={index === activeWidgetIndex ? 'is-active' : undefined}
                  aria-current={index === activeWidgetIndex ? 'true' : undefined}
                >
                  {item.kicker}
                </span>
              ))}
            </div>
          </div>

          <article
            className={`widget-story-card widget-story-card--${activeWidget.slug} is-active`}
          >
            <div className="widget-story-card-stage">
              {previousWidget && isWidgetTransitioning ? (
                <div className="widget-story-card-shell widget-story-card-shell--leaving">
                  <div className="widget-story-card-head">
                    <div className="widget-story-card-label">
                      {PreviousWidgetIcon ? <PreviousWidgetIcon /> : null}
                      <span>{previousWidget.kicker}</span>
                    </div>
                    <span className="widget-story-card-badge">
                      {previousWidget.badge}
                    </span>
                  </div>

                  <WidgetStoryPreview slug={previousWidget.slug} active={false} />
                </div>
              ) : null}

              <div
                className={`widget-story-card-shell${
                  isWidgetTransitioning ? ' widget-story-card-shell--entering' : ''
                }`}
                key={activeWidget.slug}
              >
                <div className="widget-story-card-head">
                  <div className="widget-story-card-label">
                    <ActiveWidgetIcon />
                    <span>{activeWidget.kicker}</span>
                  </div>
                  <span className="widget-story-card-badge">{activeWidget.badge}</span>
                </div>

                <WidgetStoryPreview slug={activeWidget.slug} active={true} />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
