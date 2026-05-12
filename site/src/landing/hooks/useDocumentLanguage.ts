import { useEffect } from 'react'

export function useDocumentLanguage(language: string) {
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
}
