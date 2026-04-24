import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { emit } from '@tauri-apps/api/event'
import { ThemeProviderContext, type Theme } from '@/lib/theme-context'
import type { ResolvedTheme } from '@/lib/theme'
import { usePreferences } from '@/services/preferences'
import {
  applyDocumentTheme,
  resolveThemePreference,
  syncNativeAppTheme,
  THEME_STORAGE_KEY,
} from '@/lib/theme'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveThemePreference(
      (localStorage.getItem(storageKey) as Theme) || defaultTheme,
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  )

  // Load theme from persistent preferences
  const { data: preferences } = usePreferences()
  const hasSyncedPreferences = useRef(false)

  // Sync theme with preferences when they load
  // This is a legitimate case of syncing with external async state (persistent preferences)
  // The ref ensures this only happens once when preferences first load
  useLayoutEffect(() => {
    if (preferences?.theme && !hasSyncedPreferences.current) {
      hasSyncedPreferences.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external async preferences on initial load
      setTheme(preferences.theme as Theme)
    }
  }, [preferences?.theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const appliedTheme = applyDocumentTheme(theme)
      setResolvedTheme(appliedTheme)
    }

    if (theme === 'system') {
      applyTheme()

      const handleChange = () => applyTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    applyTheme()
  }, [theme])

  useEffect(() => {
    void syncNativeAppTheme(theme)
  }, [theme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
      // Notify other windows (e.g., quick pane) of theme change
      void emit('theme-changed', { theme: newTheme })
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
