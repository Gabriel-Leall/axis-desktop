import type { FullBoard, KanbanBoard } from '@/lib/bindings'

export interface OrderedItem {
  id: string
  sort_order: number
}

const SORT_GAP = 1000

export function recalculateOrder(
  ids: string[],
  currentItems: OrderedItem[]
): OrderedItem[] {
  const currentById = new Map(currentItems.map(item => [item.id, item]))

  return ids
    .filter(id => currentById.has(id))
    .map((id, index) => ({
      id,
      sort_order: index * SORT_GAP,
    }))
}

export function getInsertPosition(
  overColumnId: string,
  overId: string,
  fullBoard: FullBoard
): number {
  const targetColumn = fullBoard.columns.find(
    col => col.column.id === overColumnId
  )

  if (!targetColumn) return 0

  if (overId === overColumnId) {
    return targetColumn.cards.length * SORT_GAP
  }

  const overCardIndex = targetColumn.cards.findIndex(card => card.id === overId)
  if (overCardIndex === -1) {
    return targetColumn.cards.length * SORT_GAP
  }

  return overCardIndex * SORT_GAP
}

export function isDuplicateName(
  name: string,
  boards: KanbanBoard[],
  excludeId?: string
): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false

  return boards.some(board => {
    if (excludeId && board.id === excludeId) return false
    return board.name.trim().toLowerCase() === normalized
  })
}
