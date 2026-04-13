import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/app', () => ({
  setTheme: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

const { setTheme } = await import('@tauri-apps/api/app')
const { logger } = await import('@/lib/logger')
const {
  resolveThemePreference,
  toTauriAppTheme,
  applyDocumentTheme,
  syncNativeAppTheme,
} = await import('./theme')

describe('theme utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.classList.remove('light', 'dark')
    delete document.documentElement.dataset.axisThemeMode

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('resolves system theme from current media preference', () => {
    expect(resolveThemePreference('system', false)).toBe('light')
    expect(resolveThemePreference('system', true)).toBe('dark')
  })

  it('keeps explicit light or dark preferences', () => {
    expect(resolveThemePreference('light', true)).toBe('light')
    expect(resolveThemePreference('dark', false)).toBe('dark')
  })

  it('maps system preference to null for Tauri native theme sync', () => {
    expect(toTauriAppTheme('system')).toBeNull()
    expect(toTauriAppTheme('dark')).toBe('dark')
    expect(toTauriAppTheme('light')).toBe('light')
  })

  it('applies resolved theme class and data attribute on document root', () => {
    const resolved = applyDocumentTheme('dark')

    expect(resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.axisThemeMode).toBe('dark')
  })

  it('syncs native app theme through Tauri API', async () => {
    await syncNativeAppTheme('system')

    expect(setTheme).toHaveBeenCalledWith(null)
  })

  it('fails safely when native theme sync is unavailable', async () => {
    vi.mocked(setTheme).mockRejectedValueOnce(new Error('unsupported'))

    await expect(syncNativeAppTheme('dark')).resolves.toBeUndefined()
    expect(logger.debug).toHaveBeenCalled()
  })
})
