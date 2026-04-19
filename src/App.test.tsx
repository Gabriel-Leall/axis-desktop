import { render, screen, waitFor } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import App from './App'

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders main layout and title bar controls', async () => {
    render(<App />)

    // Check initial layout
    const dashboardButtons = screen.getAllByText(/Dashboard/i)
    expect(dashboardButtons.length).toBeGreaterThan(0)

    // Check title bar is present
    expect(screen.getByTestId('titlebar-macos')).toBeInTheDocument()

    // Wait for the window control buttons (async mount)
    await waitFor(
      () => {
        const closeButton = screen.queryByLabelText(/Close window/i)
        const minimizeButton = screen.queryByLabelText(/Minimize window/i)
        expect(closeButton).toBeInTheDocument()
        expect(minimizeButton).toBeInTheDocument()
      },
      { timeout: 10000 }
    )
  }, 20000) // 20s test timeout
})
