import { LockOpen, Target, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const bridgePillars: {
  titleKey: string
  descriptionKey: string
  icon: LucideIcon
}[] = [
  {
    titleKey: 'landing.bridge.pillars.zeroLag.title',
    descriptionKey: 'landing.bridge.pillars.zeroLag.description',
    icon: Zap,
  },
  {
    titleKey: 'landing.bridge.pillars.focus.title',
    descriptionKey: 'landing.bridge.pillars.focus.description',
    icon: Target,
  },
  {
    titleKey: 'landing.bridge.pillars.openSource.title',
    descriptionKey: 'landing.bridge.pillars.openSource.description',
    icon: LockOpen,
  },
]

export function BridgeSection() {
  const { t } = useTranslation()

  return (
    <section className="bridge-section" data-reveal={true} data-delay="5">
      <div className="bridge-grid">
        {bridgePillars.map(pillar => (
          <article key={pillar.titleKey} className="bridge-card">
            <pillar.icon className="bridge-icon" strokeWidth={2.8} aria-hidden="true" />
            <h3>{t(pillar.titleKey)}</h3>
            <p>{t(pillar.descriptionKey)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
