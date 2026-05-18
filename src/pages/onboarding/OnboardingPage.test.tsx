import { render, screen } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('renders the first onboarding question', () => {
    render(<OnboardingPage />)
    expect(
      screen.getByRole('heading', {
        name: /qual é o seu maior obstáculo hoje/i,
      })
    ).toBeInTheDocument()
  })

  it('asks for confirmation before skipping account connection', async () => {
    const user = userEvent.setup()

    render(<OnboardingPage />)

    await user.click(screen.getByRole('button', { name: /procrastinação/i }))

    expect(
      await screen.findByRole('heading', {
        name: /o que você quer dominar primeiro/i,
      })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /foco profundo/i }))

    expect(
      await screen.findByRole(
        'heading',
        { name: /conecte sua conta/i },
        { timeout: 3000 }
      )
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /pular por enquanto/i })
    )

    expect(
      screen.getByRole('alertdialog', {
        name: /continuar sem conectar uma conta/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sincronização segura de progresso e preferências/i)
    ).toBeInTheDocument()
  }, 10000)
})
