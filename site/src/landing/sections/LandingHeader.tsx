import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RefObject } from 'react'
import { downloadUrl, navLinks } from '../data'

export function LandingHeader({
  headerRef,
}: {
  headerRef: RefObject<HTMLElement | null>
}) {
  const { t, i18n } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en'
  const nextLanguage = currentLanguage === 'pt-BR' ? 'en' : 'pt-BR'
  const currentLanguageLabel =
    currentLanguage === 'pt-BR'
      ? t('landing.languageSwitcher.portuguese')
      : t('landing.languageSwitcher.english')

  return (
    <header ref={headerRef} className="site-header">
      <span className="header-grid" aria-hidden="true" />
      <a className="brand-mark" href="/" aria-label="Axis Desktop">
        <img src="/Axis-Logo.png" alt="" />
        <span>Axis Desktop</span>
      </a>

      <nav aria-label={t('landing.nav.ariaLabel')}>
        {navLinks.map(link => (
          <a key={link.href} href={link.href} className="nav-link">
            <span className="nav-marker" aria-hidden="true" />
            {t(link.labelKey)}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <div
          className="language-switcher"
          aria-label={t('landing.languageSwitcher.ariaLabel')}
        >
          <button
            type="button"
            className="is-active"
            onClick={() => void i18n.changeLanguage(nextLanguage)}
            aria-label={t('landing.languageSwitcher.toggleLabel', {
              language: currentLanguageLabel,
            })}
          >
            {currentLanguageLabel}
          </button>
        </div>

        <a className="header-download" href={downloadUrl}>
          <Download />
          {t('landing.nav.download')}
        </a>
      </div>
    </header>
  )
}
