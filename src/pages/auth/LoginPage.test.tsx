import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import { LoginPage } from './LoginPage'

describe('LoginPage', () => {
  it('renders OAuth buttons', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Conectar com GitHub/i)).toBeInTheDocument()
    expect(screen.getByText(/Continuar com Google/i)).toBeInTheDocument()
  })
})
