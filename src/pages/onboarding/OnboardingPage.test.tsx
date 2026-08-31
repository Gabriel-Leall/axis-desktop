import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { commands } from '@/lib/tauri-bindings'
import { recordProductUsage } from '@/lib/product-usage'
import { useDailyPlanStore } from '@/store/daily-plan-store'
import { useOnboardingStore } from '@/store/onboarding-store'
import { usePomodoroStore } from '@/store/pomodoro-store'
import { useTasksStore } from '@/store/tasks-store'
import { useUIStore } from '@/store/ui-store'
import { OnboardingPage } from './OnboardingPage'

vi.mock('@/lib/product-usage', () => ({
  recordProductUsage: vi.fn().mockResolvedValue(true),
}))

describe('OnboardingPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('pt-BR')
    useOnboardingStore.setState({ hasCompleted: false })
    useTasksStore.setState({ tasks: [], selectedTaskId: null })
    useDailyPlanStore.setState({
      activePlan: null,
      currentDate: null,
      isLoading: false,
      isSaving: false,
      error: null,
    })
    useUIStore.setState({ activePage: 'grid', activePageData: {} })

    vi.mocked(commands.getDailyPlan).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.getTasks).mockResolvedValue({
      status: 'ok',
      data: [],
    })
    vi.mocked(commands.createDailyPlan).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'today-plan',
        plan_date: '2026-07-28',
        focus_task_id: null,
        status: 'open',
        focus_source: 'auto',
        created_at: '2026-07-28T09:00:00.000Z',
        updated_at: '2026-07-28T09:00:00.000Z',
        completed_at: null,
      },
    })
    vi.mocked(commands.updateDailyPlanFocus).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'today-plan',
        plan_date: '2026-07-28',
        focus_task_id: 'initial-focus',
        status: 'open',
        focus_source: 'manual',
        created_at: '2026-07-28T09:00:00.000Z',
        updated_at: '2026-07-28T09:00:00.000Z',
        completed_at: null,
      },
    })
  })

  it('starts by asking for a real task from today', () => {
    render(<OnboardingPage />)

    expect(
      screen.getByRole('heading', {
        name: /o que merece sua atenção agora/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /tarefa que merece sua atenção/i })
    ).toBeInTheDocument()
  })

  it('keeps the user in onboarding after defining the first focus', async () => {
    const user = userEvent.setup()

    render(<OnboardingPage />)

    await user.type(
      screen.getByRole('textbox', { name: /tarefa que merece sua atenção/i }),
      'Preparar a proposta para a reunião'
    )
    await user.click(screen.getByRole('button', { name: /definir como foco/i }))

    await waitFor(() => {
      expect(commands.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Preparar a proposta para a reunião',
          priority: 'high',
        })
      )
      expect(commands.updateDailyPlanFocus).toHaveBeenCalledWith(
        'today-plan',
        expect.any(String),
        'manual',
        expect.any(String)
      )
    })
    expect(
      screen.getByRole('heading', { name: /seu próximo foco está definido/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/uma decisão por vez reduz o peso do dia/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/seu espaço de foco vive no desktop/i)
    ).not.toBeInTheDocument()
    expect(useOnboardingStore.getState().hasCompleted).toBe(false)
  })

  it('guides the first focus session and quick capture before opening the workspace', async () => {
    const user = userEvent.setup()
    const startContextualFocus = vi.fn().mockResolvedValue(true)
    usePomodoroStore.setState({ startContextualFocus })

    render(<OnboardingPage />)

    await user.type(
      screen.getByRole('textbox', { name: /tarefa que merece sua atenção/i }),
      'Preparar a proposta para a reunião'
    )
    await user.click(screen.getByRole('button', { name: /definir como foco/i }))
    await user.click(screen.getByRole('button', { name: /preparar sessão/i }))

    expect(
      screen.getByRole('heading', { name: /dê 25 minutos ao que importa/i })
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /começar foco de 25 min/i })
    )

    await waitFor(() => {
      expect(startContextualFocus).toHaveBeenCalledWith(expect.any(String))
    })
    expect(
      screen.getByRole('heading', {
        name: /quando algo interromper, capture/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: /captura rápida/i })
    ).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: /captura rápida/i }),
      'Lembrar de pedir o orçamento'
    )
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))
    await waitFor(() => {
      expect(commands.createTask).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Lembrar de pedir o orçamento',
          priority: 'medium',
        })
      )
      expect(recordProductUsage).toHaveBeenCalledWith('capture_saved')
    })
    expect(useOnboardingStore.getState().hasCompleted).toBe(false)

    await user.click(screen.getByRole('button', { name: /abrir meu espaço/i }))

    expect(useOnboardingStore.getState().hasCompleted).toBe(true)
    expect(useUIStore.getState().activePage).toBe('pomodoro')
    expect(recordProductUsage).toHaveBeenCalledWith('onboarding_completed')
  }, 10_000)
})
