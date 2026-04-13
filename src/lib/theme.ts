import { setTheme as setAppTheme } from '@tauri-apps/api/app'
import type { Theme as TauriTheme } from '@tauri-apps/api/window'
import type { Theme } from '@/lib/theme-context'
import { logger } from '@/lib/logger'

export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ui-theme'

export function resolveThemePreference(
  theme: Theme,
  prefersDark: boolean
): ResolvedTheme {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return theme
}

export function toTauriAppTheme(theme: Theme): TauriTheme | null {
  return theme === 'system' ? null : theme
}

/**
 * Applies theme classes to the current document root and returns the resolved mode.
 */
export function applyDocumentTheme(theme: Theme): ResolvedTheme {
  const root = window.document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedTheme = resolveThemePreference(theme, prefersDark)

  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
  root.dataset.axisThemeMode = resolvedTheme

  return resolvedTheme
}

/**
 * Sync native app chrome (titlebar/window controls) with current preference.
 */
export async function syncNativeAppTheme(theme: Theme): Promise<void> {
  try {
    await setAppTheme(toTauriAppTheme(theme))
  } catch (error) {
    // Safe fallback for unsupported platforms or non-Tauri test environments.
    logger.debug('Native theme sync unavailable', { error, theme })
  }
}
