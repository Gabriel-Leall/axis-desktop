import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('renders pill stepper', () => {
    render(<OnboardingPage />)
    const steps = screen.getAllByText(/Obstáculo/i)
    expect(steps.length).toBeGreaterThan(0)
  })
})