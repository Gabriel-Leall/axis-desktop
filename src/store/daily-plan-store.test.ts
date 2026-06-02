import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands } from '@/lib/tauri-bindings'
import { useDailyPlanStore } from './daily-plan-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getTasks: vi.fn(),
    getDailyPlan: vi.fn(),
    createDailyPlan: vi.fn(),
    updateDailyPlanFocus: vi.fn(),
    completeDailyPlan: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('daily-plan-store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useDailyPlanStore.setState({
      activePlan: null,
      currentDate: null,
      isLoading: false,
      isSaving: false,
      error: null,
    })
  })

  it('creates a daily plan when the current date has no persisted plan', async () => {
    vi.mocked(commands.getDailyPlan).mockResolvedValue({
      status: 'ok',
      data: null,
    })
    vi.mocked(commands.getTasks).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'task-1',
          title: 'Write docs',
          description: null,
          priority: 'medium',
          status: 'todo',
          due_date: '2026-06-03',
          completed_at: null,
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-01T10:00:00.000Z',
          sort_order: 1,
        },
        {
          id: 'task-2',
          title: 'Fix dashboard regression',
          description: null,
          priority: 'high',
          status: 'in_progress',
          due_date: '2026-06-01',
          completed_at: null,
          created_at: '2026-06-01T09:00:00.000Z',
          updated_at: '2026-06-01T09:00:00.000Z',
          sort_order: 0,
        },
      ],
    })
    vi.mocked(commands.createDailyPlan).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'plan-1',
        plan_date: '2026-06-02',
        focus_task_id: 'task-2',
        status: 'open',
        focus_source: 'auto',
        created_at: '2026-06-02T08:00:00.000Z',
        updated_at: '2026-06-02T08:00:00.000Z',
        completed_at: null,
      },
    })

    await useDailyPlanStore.getState().initializeTodayPlan('2026-06-02')

    expect(commands.createDailyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_date: '2026-06-02',
        focus_task_id: 'task-2',
        focus_source: 'auto',
      })
    )
    expect(useDailyPlanStore.getState().activePlan?.focus_task_id).toBe(
      'task-2'
    )
  })

  it('reuses an existing persisted plan for the same date', async () => {
    vi.mocked(commands.getDailyPlan).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'plan-existing',
        plan_date: '2026-06-02',
        focus_task_id: 'task-9',
        status: 'open',
        focus_source: 'manual',
        created_at: '2026-06-02T08:00:00.000Z',
        updated_at: '2026-06-02T08:10:00.000Z',
        completed_at: null,
      },
    })
    vi.mocked(commands.getTasks).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'task-9',
          title: 'Persisted focus',
          description: null,
          priority: 'medium',
          status: 'todo',
          due_date: '2026-06-02',
          completed_at: null,
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-01T10:00:00.000Z',
          sort_order: 0,
        },
      ],
    })

    await useDailyPlanStore.getState().initializeTodayPlan('2026-06-02')

    expect(commands.createDailyPlan).not.toHaveBeenCalled()
    expect(useDailyPlanStore.getState().activePlan?.id).toBe('plan-existing')
  })

  it('recalculates the focus when the persisted task no longer exists', async () => {
    vi.mocked(commands.getDailyPlan).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'plan-existing',
        plan_date: '2026-06-02',
        focus_task_id: 'missing-task',
        status: 'open',
        focus_source: 'manual',
        created_at: '2026-06-02T08:00:00.000Z',
        updated_at: '2026-06-02T08:10:00.000Z',
        completed_at: null,
      },
    })
    vi.mocked(commands.getTasks).mockResolvedValue({
      status: 'ok',
      data: [
        {
          id: 'task-2',
          title: 'Replacement focus',
          description: null,
          priority: 'high',
          status: 'todo',
          due_date: '2026-06-02',
          completed_at: null,
          created_at: '2026-06-01T09:00:00.000Z',
          updated_at: '2026-06-01T09:00:00.000Z',
          sort_order: 0,
        },
      ],
    })
    vi.mocked(commands.updateDailyPlanFocus).mockResolvedValue({
      status: 'ok',
      data: {
        id: 'plan-existing',
        plan_date: '2026-06-02',
        focus_task_id: 'task-2',
        status: 'open',
        focus_source: 'recalculated',
        created_at: '2026-06-02T08:00:00.000Z',
        updated_at: '2026-06-02T08:15:00.000Z',
        completed_at: null,
      },
    })

    await useDailyPlanStore.getState().initializeTodayPlan('2026-06-02')

    expect(commands.updateDailyPlanFocus).toHaveBeenCalledWith(
      'plan-existing',
      'task-2',
      'recalculated',
      expect.any(String)
    )
    expect(useDailyPlanStore.getState().activePlan?.focus_task_id).toBe(
      'task-2'
    )
  })
})
