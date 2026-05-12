import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

export const languageStorageKey = 'axis-site-language'
export const supportedLanguages = ['en', 'pt-BR'] as const

function detectInitialLanguage() {
  if (typeof window !== 'undefined') {
    const savedLanguage = window.localStorage.getItem(languageStorageKey)
    if (savedLanguage && supportedLanguages.includes(savedLanguage as 'en' | 'pt-BR')) {
      return savedLanguage
    }
  }

  return typeof navigator !== 'undefined' &&
    navigator.language.toLowerCase().startsWith('pt')
    ? 'pt-BR'
    : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'pt-BR': { translation: ptBR },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', language => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(languageStorageKey, language)
})

export default i18n
