import { describe, expect, it } from 'vitest'
import {
  selectDailyPlanFocus,
  scoreTaskForDailyPlan,
} from './daily-plan-domain'

describe('daily-plan-domain', () => {
  const today = '2026-06-02'

  it('prioritizes overdue in-progress high-priority tasks', () => {
    const tasks = [
      {
        id: 'task-low',
        title: 'Low priority today',
        priority: 'low',
        status: 'todo',
        due_date: today,
        sort_order: 2,
        created_at: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'task-best',
        title: 'Overdue task already in progress',
        priority: 'high',
        status: 'in_progress',
        due_date: '2026-06-01',
        sort_order: 1,
        created_at: '2026-06-01T09:00:00.000Z',
      },
    ]

    const focus = selectDailyPlanFocus(tasks, today)

    expect(focus?.id).toBe('task-best')
  })

  it('returns null when every task is already done', () => {
    const focus = selectDailyPlanFocus(
      [
        {
          id: 'done-task',
          title: 'Done',
          priority: 'high',
          status: 'done',
          due_date: today,
          sort_order: 0,
          created_at: '2026-06-01T09:00:00.000Z',
        },
      ],
      today
    )

    expect(focus).toBeNull()
  })

  it('scores overdue work above future work', () => {
    const overdue = scoreTaskForDailyPlan(
      {
        id: 'overdue',
        title: 'Overdue',
        priority: 'medium',
        status: 'todo',
        due_date: '2026-06-01',
        sort_order: 0,
        created_at: '2026-06-01T09:00:00.000Z',
      },
      today
    )
    const future = scoreTaskForDailyPlan(
      {
        id: 'future',
        title: 'Future',
        priority: 'high',
        status: 'todo',
        due_date: '2026-06-04',
        sort_order: 0,
        created_at: '2026-06-01T09:00:00.000Z',
      },
      today
    )

    expect(overdue).toBeGreaterThan(future)
  })
})
