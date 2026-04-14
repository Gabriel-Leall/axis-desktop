import { describe, expect, it } from 'vitest'
import {
  getInsertPosition,
  isDuplicateName,
  recalculateOrder,
} from '@/lib/kanban-domain'
import type { FullBoard, KanbanBoard } from '@/lib/bindings'

describe('kanban-domain', () => {
  it('recalculateOrder keeps ids and applies 1000 gaps', () => {
    const updates = recalculateOrder(
      ['c3', 'c1', 'c2'],
      [
        { id: 'c1', sort_order: 0 },
        { id: 'c2', sort_order: 1000 },
        { id: 'c3', sort_order: 2000 },
      ]
    )

    expect(updates).toEqual([
      { id: 'c3', sort_order: 0 },
      { id: 'c1', sort_order: 1000 },
      { id: 'c2', sort_order: 2000 },
    ])
  })

  it('getInsertPosition appends when dropping on column container', () => {
    const board = mockBoard()
    expect(getInsertPosition('col-a', 'col-a', board)).toBe(2000)
  })

  it('getInsertPosition inserts at card index when dropping on card', () => {
    const board = mockBoard()
    expect(getInsertPosition('col-a', 'card-2', board)).toBe(1000)
  })

  it('isDuplicateName ignores casing and whitespace', () => {
    const boards: KanbanBoard[] = [
      { id: 'a', name: 'Personal' },
      { id: 'b', name: 'Work' },
    ].map(board => ({
      ...board,
      is_active: false,
      sort_order: 0,
      created_at: '2026-04-14T00:00:00.000Z',
      updated_at: '2026-04-14T00:00:00.000Z',
    }))

    expect(isDuplicateName('  personal  ', boards)).toBe(true)
    expect(isDuplicateName('work', boards, 'b')).toBe(false)
    expect(isDuplicateName('new', boards)).toBe(false)
  })
})

function mockBoard(): FullBoard {
  return {
    board: {
      id: 'b-1',
      name: 'Personal',
      is_active: true,
      sort_order: 0,
      created_at: '2026-04-14T00:00:00.000Z',
      updated_at: '2026-04-14T00:00:00.000Z',
    },
    columns: [
      {
        column: {
          id: 'col-a',
          board_id: 'b-1',
          name: 'Backlog',
          sort_order: 0,
          created_at: '2026-04-14T00:00:00.000Z',
          updated_at: '2026-04-14T00:00:00.000Z',
        },
        cards: [
          {
            id: 'card-1',
            column_id: 'col-a',
            title: 'One',
            description: null,
            priority: 'medium',
            sort_order: 0,
            created_at: '2026-04-14T00:00:00.000Z',
            updated_at: '2026-04-14T00:00:00.000Z',
          },
          {
            id: 'card-2',
            column_id: 'col-a',
            title: 'Two',
            description: null,
            priority: 'medium',
            sort_order: 1000,
            created_at: '2026-04-14T00:00:00.000Z',
            updated_at: '2026-04-14T00:00:00.000Z',
          },
        ],
      },
    ],
  }
}
