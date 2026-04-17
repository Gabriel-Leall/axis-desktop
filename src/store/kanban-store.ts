import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { commands } from '@/lib/tauri-bindings'
import type {
  CardOrderUpdate,
  ColumnOrderUpdate,
  FullBoard,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanSubtask,
} from '@/lib/bindings'
import { recalculateOrder } from '@/lib/kanban-domain'

const SORT_GAP = 1000

interface KanbanStoreState {
  boards: KanbanBoard[]
  activeBoardId: string | null
  fullBoard: FullBoard | null
  selectedCardId: string | null
  isLoading: boolean
  subtasksByCardId: Record<string, KanbanSubtask[]>

  loadBoards: () => Promise<void>
  loadFullBoard: (boardId: string) => Promise<void>
  createBoard: (name: string) => Promise<string>
  updateBoard: (id: string, name: string) => Promise<void>
  setActiveBoard: (id: string) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  createColumn: (boardId: string, name: string) => Promise<void>
  updateColumn: (id: string, name: string) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  createCard: (columnId: string, title: string) => Promise<void>
  updateCard: (id: string, updates: Partial<KanbanCard>) => Promise<void>
  moveCard: (
    cardId: string,
    toColumnId: string,
    newOrder: number
  ) => Promise<void>
  reorderCards: (columnId: string, orderedIds: string[]) => Promise<void>
  reorderColumns: (orderedIds: string[]) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  selectCard: (id: string | null) => void

  loadCardSubtasks: (cardId: string) => Promise<void>
  createSubtask: (cardId: string, title: string) => Promise<void>
  toggleSubtask: (cardId: string, subtaskId: string) => Promise<void>
}

function utcNow(): string {
  return new Date().toISOString()
}

function createId(): string {
  return crypto.randomUUID()
}

function unwrapOrThrow<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: unknown }
): T {
  if (result.status === 'ok') return result.data
  throw result.error
}

function cloneBoard(board: FullBoard): FullBoard {
  return structuredClone(board)
}

function findCardLocation(
  fullBoard: FullBoard,
  cardId: string
): {
  columnIndex: number
  cardIndex: number
} | null {
  for (
    let columnIndex = 0;
    columnIndex < fullBoard.columns.length;
    columnIndex += 1
  ) {
    const cardIndex = fullBoard.columns[columnIndex]?.cards.findIndex(
      card => card.id === cardId
    )
    if ((cardIndex ?? -1) >= 0) {
      return { columnIndex, cardIndex: cardIndex as number }
    }
  }
  return null
}

async function bootstrapDefaultBoard(): Promise<string> {
  const now = utcNow()
  const boardId = createId()
  await unwrapOrThrow(await commands.createBoard(boardId, 'Personal', now, now))

  const columns: { id: string; name: string; sort: number }[] = [
    { id: createId(), name: 'Backlog', sort: 0 },
    { id: createId(), name: 'In Progress', sort: 1000 },
    { id: createId(), name: 'Done', sort: 2000 },
  ]

  for (const column of columns) {
    await unwrapOrThrow(
      await commands.createColumn(
        column.id,
        boardId,
        column.name,
        column.sort,
        now,
        now
      )
    )
  }

  const backlogColumnId = columns[0]?.id
  if (backlogColumnId) {
    await unwrapOrThrow(
      await commands.createCard(
        createId(),
        backlogColumnId,
        'Welcome to Kanban',
        'medium',
        0,
        now,
        now
      )
    )
  }

  await unwrapOrThrow(await commands.setActiveBoard(boardId, now))
  return boardId
}

export const useKanbanStore = create<KanbanStoreState>()(
  devtools(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      fullBoard: null,
      selectedCardId: null,
      isLoading: false,
      subtasksByCardId: {},

      loadBoards: async () => {
        set({ isLoading: true }, undefined, 'kanban/loadBoards:start')
        try {
          let boards = unwrapOrThrow(await commands.getBoards())

          if (boards.length === 0) {
            await bootstrapDefaultBoard()
            boards = unwrapOrThrow(await commands.getBoards())
          }

          const activeBoardId =
            boards.find(board => board.is_active)?.id ?? boards[0]?.id ?? null

          set(
            { boards, activeBoardId, isLoading: false },
            undefined,
            'kanban/loadBoards:done'
          )

          if (activeBoardId) {
            await get().loadFullBoard(activeBoardId)
          }
        } catch (error) {
          console.error('[kanban-store] loadBoards failed', error)
          set({ isLoading: false }, undefined, 'kanban/loadBoards:error')
        }
      },

      loadFullBoard: async boardId => {
        try {
          const fullBoard = unwrapOrThrow(await commands.getFullBoard(boardId))
          set(
            { fullBoard, activeBoardId: boardId },
            undefined,
            'kanban/loadFullBoard'
          )
        } catch (error) {
          console.error('[kanban-store] loadFullBoard failed', error)
        }
      },

      createBoard: async name => {
        const now = utcNow()
        const id = createId()
        const boardName = name.trim() || 'Untitled Board'

        const board = unwrapOrThrow(
          await commands.createBoard(id, boardName, now, now)
        )

        set(
          state => ({ boards: [...state.boards, board] }),
          undefined,
          'kanban/createBoard'
        )

        await get().setActiveBoard(id)
        return id
      },

      updateBoard: async (id, name) => {
        const now = utcNow()
        const updated = unwrapOrThrow(await commands.updateBoard(id, name, now))

        set(
          state => ({
            boards: state.boards.map(board =>
              board.id === id ? updated : board
            ),
            fullBoard:
              state.fullBoard && state.fullBoard.board.id === id
                ? { ...state.fullBoard, board: updated }
                : state.fullBoard,
          }),
          undefined,
          'kanban/updateBoard'
        )
      },

      setActiveBoard: async id => {
        const now = utcNow()
        const prevBoards = get().boards
        const prevActive = get().activeBoardId

        set(
          state => ({
            activeBoardId: id,
            boards: state.boards.map(board => ({
              ...board,
              is_active: board.id === id,
              updated_at: board.id === id ? now : board.updated_at,
            })),
          }),
          undefined,
          'kanban/setActiveBoard:optimistic'
        )

        try {
          await unwrapOrThrow(await commands.setActiveBoard(id, now))
          await get().loadFullBoard(id)
        } catch (error) {
          set(
            { boards: prevBoards, activeBoardId: prevActive },
            undefined,
            'kanban/setActiveBoard:rollback'
          )
          throw error
        }
      },

      deleteBoard: async id => {
        const snapshotBoards = get().boards
        const snapshotActive = get().activeBoardId
        const wasActive = snapshotActive === id

        const remaining = snapshotBoards.filter(board => board.id !== id)

        set(
          {
            boards: remaining,
            fullBoard: wasActive ? null : get().fullBoard,
            activeBoardId: wasActive
              ? (remaining[0]?.id ?? null)
              : snapshotActive,
            selectedCardId: wasActive ? null : get().selectedCardId,
            subtasksByCardId: wasActive ? {} : get().subtasksByCardId,
          },
          undefined,
          'kanban/deleteBoard:optimistic'
        )

        try {
          await unwrapOrThrow(await commands.deleteBoard(id))

          if (wasActive && remaining[0]) {
            await get().setActiveBoard(remaining[0].id)
          }
        } catch (error) {
          set(
            {
              boards: snapshotBoards,
              activeBoardId: snapshotActive,
            },
            undefined,
            'kanban/deleteBoard:rollback'
          )
          throw error
        }
      },

      createColumn: async (boardId, name) => {
        const fullBoard = get().fullBoard
        if (!fullBoard || fullBoard.board.id !== boardId) return

        const now = utcNow()
        const id = createId()
        const sort_order =
          fullBoard.columns.length > 0
            ? (fullBoard.columns[fullBoard.columns.length - 1]?.column
                .sort_order ?? 0) + SORT_GAP
            : 0

        const optimisticColumn: KanbanColumn = {
          id,
          board_id: boardId,
          name,
          sort_order,
          created_at: now,
          updated_at: now,
        }

        const snapshot = cloneBoard(fullBoard)

        set(
          state => ({
            fullBoard: state.fullBoard
              ? {
                  ...state.fullBoard,
                  columns: [
                    ...state.fullBoard.columns,
                    { column: optimisticColumn, cards: [] },
                  ],
                }
              : state.fullBoard,
          }),
          undefined,
          'kanban/createColumn:optimistic'
        )

        try {
          await unwrapOrThrow(
            await commands.createColumn(id, boardId, name, sort_order, now, now)
          )
        } catch (error) {
          set(
            { fullBoard: snapshot },
            undefined,
            'kanban/createColumn:rollback'
          )
          throw error
        }
      },

      updateColumn: async (id, name) => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const targetColumn = fullBoard.columns.find(col => col.column.id === id)
        if (!targetColumn) return

        const now = utcNow()
        const snapshot = cloneBoard(fullBoard)

        set(
          state => ({
            fullBoard: state.fullBoard
              ? {
                  ...state.fullBoard,
                  columns: state.fullBoard.columns.map(col =>
                    col.column.id === id
                      ? {
                          ...col,
                          column: {
                            ...col.column,
                            name,
                            updated_at: now,
                          },
                        }
                      : col
                  ),
                }
              : state.fullBoard,
          }),
          undefined,
          'kanban/updateColumn:optimistic'
        )

        try {
          await unwrapOrThrow(
            await commands.updateColumn(
              id,
              name,
              targetColumn.column.sort_order,
              now
            )
          )
        } catch (error) {
          set(
            { fullBoard: snapshot },
            undefined,
            'kanban/updateColumn:rollback'
          )
          throw error
        }
      },

      deleteColumn: async id => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const snapshot = cloneBoard(fullBoard)

        set(
          state => ({
            fullBoard: state.fullBoard
              ? {
                  ...state.fullBoard,
                  columns: state.fullBoard.columns.filter(
                    col => col.column.id !== id
                  ),
                }
              : state.fullBoard,
          }),
          undefined,
          'kanban/deleteColumn:optimistic'
        )

        try {
          await unwrapOrThrow(await commands.deleteColumn(id))
        } catch (error) {
          set(
            { fullBoard: snapshot },
            undefined,
            'kanban/deleteColumn:rollback'
          )
          throw error
        }
      },

      createCard: async (columnId, title) => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const column = fullBoard.columns.find(col => col.column.id === columnId)
        if (!column) return

        const now = utcNow()
        const id = createId()
        const sort_order =
          column.cards.length > 0
            ? (column.cards[column.cards.length - 1]?.sort_order ?? 0) +
              SORT_GAP
            : 0

        const optimisticCard: KanbanCard = {
          id,
          column_id: columnId,
          title,
          description: null,
          priority: 'medium',
          sort_order,
          created_at: now,
          updated_at: now,
        }

        const snapshot = cloneBoard(fullBoard)

        set(
          state => ({
            fullBoard: state.fullBoard
              ? {
                  ...state.fullBoard,
                  columns: state.fullBoard.columns.map(col =>
                    col.column.id === columnId
                      ? { ...col, cards: [...col.cards, optimisticCard] }
                      : col
                  ),
                }
              : state.fullBoard,
          }),
          undefined,
          'kanban/createCard:optimistic'
        )

        try {
          await unwrapOrThrow(
            await commands.createCard(
              id,
              columnId,
              title,
              'medium',
              sort_order,
              now,
              now
            )
          )
        } catch (error) {
          set({ fullBoard: snapshot }, undefined, 'kanban/createCard:rollback')
          throw error
        }
      },

      updateCard: async (id, updates) => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const location = findCardLocation(fullBoard, id)
        if (!location) return

        const targetCard =
          fullBoard.columns[location.columnIndex]?.cards[location.cardIndex]
        if (!targetCard) return

        const now = utcNow()
        const nextCard: KanbanCard = {
          ...targetCard,
          ...updates,
          updated_at: now,
        }

        const snapshot = cloneBoard(fullBoard)

        set(
          state => ({
            fullBoard: state.fullBoard
              ? {
                  ...state.fullBoard,
                  columns: state.fullBoard.columns.map((column, columnIndex) =>
                    columnIndex !== location.columnIndex
                      ? column
                      : {
                          ...column,
                          cards: column.cards.map(card =>
                            card.id === id ? nextCard : card
                          ),
                        }
                  ),
                }
              : state.fullBoard,
          }),
          undefined,
          'kanban/updateCard:optimistic'
        )

        try {
          await unwrapOrThrow(
            await commands.updateCard(
              id,
              nextCard.title,
              nextCard.description,
              nextCard.priority,
              nextCard.sort_order,
              nextCard.column_id,
              now
            )
          )
        } catch (error) {
          set({ fullBoard: snapshot }, undefined, 'kanban/updateCard:rollback')
          throw error
        }
      },

      moveCard: async (cardId, toColumnId, newOrder) => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const source = findCardLocation(fullBoard, cardId)
        if (!source) return

        const sourceColumn = fullBoard.columns[source.columnIndex]
        const sourceCard = sourceColumn?.cards[source.cardIndex]
        if (!sourceColumn || !sourceCard) return

        const targetColumnIndex = fullBoard.columns.findIndex(
          col => col.column.id === toColumnId
        )
        if (targetColumnIndex === -1) return

        const snapshot = cloneBoard(fullBoard)
        const next = cloneBoard(fullBoard)

        next.columns[source.columnIndex]?.cards.splice(source.cardIndex, 1)

        const insertIndex = Math.max(
          0,
          Math.min(
            next.columns[targetColumnIndex]?.cards.length ?? 0,
            Math.round(newOrder / SORT_GAP)
          )
        )

        const movedCard: KanbanCard = {
          ...sourceCard,
          column_id: toColumnId,
        }

        next.columns[targetColumnIndex]?.cards.splice(insertIndex, 0, movedCard)

        const now = utcNow()
        const updates: CardOrderUpdate[] = []

        const affectedColumnIndexes = new Set([
          source.columnIndex,
          targetColumnIndex,
        ])
        for (const columnIndex of affectedColumnIndexes) {
          const column = next.columns[columnIndex]
          if (!column) continue

          const orderedIds = column.cards.map(card => card.id)
          const recalculated = recalculateOrder(
            orderedIds,
            column.cards.map(card => ({
              id: card.id,
              sort_order: card.sort_order,
            }))
          )

          column.cards = column.cards.map(card => {
            const match = recalculated.find(item => item.id === card.id)
            const sort_order = match?.sort_order ?? card.sort_order
            updates.push({
              id: card.id,
              column_id: column.column.id,
              sort_order,
              updated_at: now,
            })
            return {
              ...card,
              sort_order,
              updated_at: now,
              column_id: column.column.id,
            }
          })
        }

        set({ fullBoard: next }, undefined, 'kanban/moveCard:optimistic')

        try {
          await unwrapOrThrow(await commands.reorderCards(updates))
        } catch (error) {
          set({ fullBoard: snapshot }, undefined, 'kanban/moveCard:rollback')
          throw error
        }
      },

      reorderCards: async (columnId, orderedIds) => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const columnIndex = fullBoard.columns.findIndex(
          column => column.column.id === columnId
        )
        if (columnIndex === -1) return

        const snapshot = cloneBoard(fullBoard)
        const next = cloneBoard(fullBoard)
        const column = next.columns[columnIndex]
        if (!column) return

        const byId = new Map(column.cards.map(card => [card.id, card]))
        const orderedCards = orderedIds
          .map(id => byId.get(id))
          .filter((card): card is KanbanCard => Boolean(card))

        const recalculated = recalculateOrder(
          orderedCards.map(card => card.id),
          orderedCards.map(card => ({
            id: card.id,
            sort_order: card.sort_order,
          }))
        )

        const now = utcNow()
        const updates: CardOrderUpdate[] = recalculated.map(item => ({
          id: item.id,
          column_id: columnId,
          sort_order: item.sort_order,
          updated_at: now,
        }))

        column.cards = orderedCards.map(card => {
          const found = recalculated.find(item => item.id === card.id)
          return {
            ...card,
            sort_order: found?.sort_order ?? card.sort_order,
            updated_at: now,
          }
        })

        set({ fullBoard: next }, undefined, 'kanban/reorderCards:optimistic')

        try {
          await unwrapOrThrow(await commands.reorderCards(updates))
        } catch (error) {
          set(
            { fullBoard: snapshot },
            undefined,
            'kanban/reorderCards:rollback'
          )
          throw error
        }
      },

      reorderColumns: async orderedIds => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const snapshot = cloneBoard(fullBoard)
        const next = cloneBoard(fullBoard)
        const byId = new Map(
          next.columns.map(column => [column.column.id, column])
        )

        next.columns = orderedIds
          .map(id => byId.get(id))
          .filter(
            (column): column is { column: KanbanColumn; cards: KanbanCard[] } =>
              Boolean(column)
          )

        const now = utcNow()
        const updates: ColumnOrderUpdate[] = next.columns.map(
          (column, index) => {
            const sort_order = index * SORT_GAP
            column.column.sort_order = sort_order
            column.column.updated_at = now
            return {
              id: column.column.id,
              sort_order,
              updated_at: now,
            }
          }
        )

        set({ fullBoard: next }, undefined, 'kanban/reorderColumns:optimistic')

        try {
          await unwrapOrThrow(await commands.reorderColumns(updates))
        } catch (error) {
          set(
            { fullBoard: snapshot },
            undefined,
            'kanban/reorderColumns:rollback'
          )
          throw error
        }
      },

      deleteCard: async id => {
        const fullBoard = get().fullBoard
        if (!fullBoard) return

        const snapshot = cloneBoard(fullBoard)
        const next = cloneBoard(fullBoard)

        next.columns = next.columns.map(column => ({
          ...column,
          cards: column.cards.filter(card => card.id !== id),
        }))

        set(
          state => ({
            fullBoard: next,
            selectedCardId:
              state.selectedCardId === id ? null : state.selectedCardId,
            subtasksByCardId: Object.fromEntries(
              Object.entries(state.subtasksByCardId).filter(
                ([cardId]) => cardId !== id
              )
            ),
          }),
          undefined,
          'kanban/deleteCard:optimistic'
        )

        try {
          await unwrapOrThrow(await commands.deleteCard(id))
        } catch (error) {
          set({ fullBoard: snapshot }, undefined, 'kanban/deleteCard:rollback')
          throw error
        }
      },

      selectCard: id => {
        set({ selectedCardId: id }, undefined, 'kanban/selectCard')
      },

      loadCardSubtasks: async cardId => {
        const cached = get().subtasksByCardId[cardId]
        if (cached) return

        const subtasks = unwrapOrThrow(
          await commands.getKanbanCardSubtasks(cardId)
        )
        set(
          state => ({
            subtasksByCardId: { ...state.subtasksByCardId, [cardId]: subtasks },
          }),
          undefined,
          'kanban/loadCardSubtasks'
        )
      },

      createSubtask: async (cardId, title) => {
        const now = utcNow()
        const id = createId()

        const current = get().subtasksByCardId[cardId] ?? []
        const sort_order =
          current.length > 0
            ? (current[current.length - 1]?.sort_order ?? 0) + SORT_GAP
            : 0

        const optimistic: KanbanSubtask = {
          id,
          card_id: cardId,
          title,
          completed: false,
          sort_order,
          created_at: now,
        }

        set(
          state => ({
            subtasksByCardId: {
              ...state.subtasksByCardId,
              [cardId]: [...(state.subtasksByCardId[cardId] ?? []), optimistic],
            },
          }),
          undefined,
          'kanban/createSubtask:optimistic'
        )

        try {
          await unwrapOrThrow(
            await commands.createKanbanSubtask(
              id,
              cardId,
              title,
              sort_order,
              now
            )
          )
        } catch (error) {
          set(
            state => ({
              subtasksByCardId: {
                ...state.subtasksByCardId,
                [cardId]: (state.subtasksByCardId[cardId] ?? []).filter(
                  subtask => subtask.id !== id
                ),
              },
            }),
            undefined,
            'kanban/createSubtask:rollback'
          )
          throw error
        }
      },

      toggleSubtask: async (cardId, subtaskId) => {
        const snapshot = get().subtasksByCardId[cardId] ?? []

        set(
          state => ({
            subtasksByCardId: {
              ...state.subtasksByCardId,
              [cardId]: (state.subtasksByCardId[cardId] ?? []).map(subtask =>
                subtask.id === subtaskId
                  ? { ...subtask, completed: !subtask.completed }
                  : subtask
              ),
            },
          }),
          undefined,
          'kanban/toggleSubtask:optimistic'
        )

        try {
          const completed = unwrapOrThrow(
            await commands.toggleKanbanSubtask(subtaskId, utcNow())
          )

          set(
            state => ({
              subtasksByCardId: {
                ...state.subtasksByCardId,
                [cardId]: (state.subtasksByCardId[cardId] ?? []).map(subtask =>
                  subtask.id === subtaskId ? { ...subtask, completed } : subtask
                ),
              },
            }),
            undefined,
            'kanban/toggleSubtask:reconcile'
          )
        } catch (error) {
          set(
            state => ({
              subtasksByCardId: {
                ...state.subtasksByCardId,
                [cardId]: snapshot,
              },
            }),
            undefined,
            'kanban/toggleSubtask:rollback'
          )
          throw error
        }
      },
    }),
    { name: 'kanban-store' }
  )
)
