import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import { useOnboardingStore } from '@/store/onboarding-store'
import App from './App'

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders main layout', async () => {
    window.localStorage.removeItem('axis-onboarding-storage')
    useOnboardingStore.getState().resetOnboarding()

    render(<App />)

    // App should render (onboarding shown for new users)
    expect(
      await screen.findByText(/Qual é o seu maior obstáculo hoje?/i, undefined, {
        timeout: 10000,
      })
    ).toBeInTheDocument()
  }, 20000)
})
