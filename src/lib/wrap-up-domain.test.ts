import { describe, expect, it } from 'vitest'
import { getTomorrowISO, splitWrapUpTasks } from './wrap-up-domain'

describe('wrap-up-domain', () => {
  it('computes tomorrow in local date format', () => {
    expect(getTomorrowISO(new Date('2026-06-02T12:00:00'))).toBe('2026-06-03')
  })

  it('splits completed and open tasks', () => {
    const result = splitWrapUpTasks([
      {
        id: 'done',
        title: 'Done',
        priority: 'medium',
        status: 'done',
        created_at: '',
        updated_at: '',
        sort_order: 0,
        subtasks: [],
      },
      {
        id: 'open',
        title: 'Open',
        priority: 'high',
        status: 'todo',
        created_at: '',
        updated_at: '',
        sort_order: 1,
        subtasks: [],
      },
    ])

    expect(result.completed).toHaveLength(1)
    expect(result.open).toHaveLength(1)
    expect(result.open[0]?.id).toBe('open')
  })
})
