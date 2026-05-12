import { useTranslation } from 'react-i18next'
import {
  clarityHeaderIcons,
  getAxisList,
  getChaosList,
  getChaosPainStat,
} from '../data'

const ChaosIcon = clarityHeaderIcons.chaos
const AxisIcon = clarityHeaderIcons.axis

export function ClaritySection() {
  const { t } = useTranslation()
  const chaosList = getChaosList(t)
  const axisList = getAxisList(t)
  const chaosPainStat = getChaosPainStat(t)

  return (
    <section id="clarity" className="clarity-section" data-reveal={true} data-delay="2">
      <article className="clarity-panel chaos-panel">
        <div className="clarity-head">
          <div className="clarity-label">
            <ChaosIcon className="clarity-glyph" />
            <span>{t('landing.clarity.chaos.label')}</span>
          </div>
          <div className="clarity-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <h2>
          {t('landing.clarity.chaos.titleLineOne')}
          <br />
          {t('landing.clarity.chaos.titleLineTwo')}
        </h2>
        <ul>
          {chaosList.map(item => (
            <li key={item}>
              <span className="list-marker list-marker--chaos" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div
          className="clarity-quote clarity-quote--chaos"
          aria-label={t('landing.clarity.chaos.ariaLabel')}
        >
          <div className="clarity-stat-head">
            <span>{chaosPainStat.label}</span>
            <strong>{chaosPainStat.value}</strong>
          </div>
          <p>{chaosPainStat.description}</p>
        </div>
      </article>

      <article className="clarity-panel axis-panel">
        <div className="clarity-head">
          <div className="clarity-label">
            <AxisIcon className="clarity-glyph" />
            <span>{t('landing.clarity.axis.label')}</span>
          </div>
          <div className="clarity-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <h2>
          {t('landing.clarity.axis.titleLineOne')}
          <br />
          {t('landing.clarity.axis.titleLineTwoPrefix')}{' '}
          <em>{t('landing.clarity.axis.titleEmphasis')}</em>
        </h2>
        <ul>
          {axisList.map(item => (
            <li key={item}>
              <span className="list-marker list-marker--axis" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div
          className="clarity-quote"
          aria-label={t('landing.clarity.axis.testimonialAriaLabel')}
        >
          <p>{t('landing.clarity.axis.testimonial')}</p>
          <div className="clarity-author">
            <span aria-hidden="true">GL</span>
            <strong>{t('landing.clarity.axis.author')}</strong>
          </div>
        </div>
      </article>
    </section>
  )
}
