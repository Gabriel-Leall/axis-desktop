import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import App from './App'

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders main layout', async () => {
    render(<App />)

    // App should render (onboarding shown for new users)
    expect(
      screen.getByText(/Qual é o seu maior obstáculo hoje?/i)
    ).toBeInTheDocument()
  }, 20000)
})
