import { lazy, Suspense, useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { initializeCommandSystem } from './lib/commands'
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu'
import { initializeLanguage } from './i18n/language-init'
import { logger } from './lib/logger'
import { cleanupOldFiles } from './lib/recovery'
import { commands } from './lib/tauri-bindings'
import { registerDeepLinkHandler } from './lib/oauth-handler'
import { useGitHubStore } from './store/github-store'
import { useGoogleStore } from './store/google-store'
import { useSlackStore } from './store/slack-store'
import { useOnboardingStore } from './store/onboarding-store'
import { useUIStore } from './store/ui-store'
import i18n from './i18n/config'
import './App.css'
import { ThemeProvider } from './components/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { useSquareCornersEffect } from './hooks/useSquareCornersEffect'
import { Toaster } from './components/ui/sonner'
import { notifications } from './lib/notifications'

const LOADING_MESSAGES = [
  'Verificando suas tasks',
  'Organizando seu dashboard',
  'Separando prioridades do dia',
  'Preparando seus hábitos',
  'Ajustando o foco da sessão',
]

const MainWindow = lazy(() =>
  import('./components/layout/MainWindow').then(module => ({
    default: module.MainWindow,
  }))
)
const OnboardingPage = lazy(() =>
  import('./pages/onboarding/OnboardingPage').then(module => ({
    default: module.OnboardingPage,
  }))
)

function AppLoadingFallback() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex(current => (current + 1) % LOADING_MESSAGES.length)
    }, 1800)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[oklch(0.985_0.006_230)]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-lg border border-[oklch(0.88_0.025_230)] bg-[oklch(0.995_0.004_230)]">
          <img src="/Axis-Mark.png" alt="Axis" className="size-10" />
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-[oklch(0.93_0.014_230)]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[oklch(0.46_0.035_230)]" />
        </div>
        <p className="min-h-5 text-sm text-[oklch(0.36_0.025_230)]">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}

function App() {
  useSquareCornersEffect()

  const hasCompletedOnboarding = useOnboardingStore(state => state.hasCompleted)

  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 Frontend application starting up')
    initializeCommandSystem()
    logger.debug('Command system initialized')

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        // Load preferences to get saved language
        const result = await commands.loadPreferences()
        const savedLanguage =
          result.status === 'ok' ? result.data.language : null

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage)

        // Build the application menu with the initialized language
        await buildAppMenu()
        logger.debug('Application menu built')
        setupMenuLanguageListener()
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error })
      }
    }

    initLanguageAndMenu()

    const backgroundStartupTimer = window.setTimeout(() => {
      // Register deep link handler for OAuth callbacks (axis:// scheme)
      void registerDeepLinkHandler()

      // Initialize integration stores after the first render path is interactive.
      void useGitHubStore.getState().initialize()
      void useGoogleStore.getState().initialize()
      void useSlackStore.getState().initialize()

      cleanupOldFiles().catch(error => {
        logger.warn('Failed to cleanup old recovery files', { error })
      })
    }, 1200)

    // Example of logging with context
    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    })

    // Auto-updater logic - check for updates 5 seconds after app loads
    const checkForUpdates = async () => {
      try {
        const update = await check()
        if (update) {
          logger.info(`Update available: ${update.version}`)
          notifications.info(
            i18n.t('updates.availableTitle'),
            i18n.t('updates.availableDescription', { version: update.version })
          )
          useUIStore.getState().setPreferencesOpen(true, 'updates')
        }
      } catch (checkError) {
        logger.error(`Update check failed: ${String(checkError)}`)
        // Silent fail for update checks - don't bother user with network issues
      }
    }

    // Check for updates 5 seconds after app loads
    const updateTimer = setTimeout(checkForUpdates, 5000)
    return () => {
      clearTimeout(backgroundStartupTimer)
      clearTimeout(updateTimer)
    }
  }, [])

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <Suspense fallback={<AppLoadingFallback />}>
            {hasCompletedOnboarding ? <MainWindow /> : <OnboardingPage />}
          </Suspense>
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
