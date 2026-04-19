import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowUpRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useKanbanStore } from '@/store/kanban-store'
import type { KanbanCard } from '@/lib/bindings'

interface KanbanPageProps {
  compact?: boolean
}

type DragItemType = 'column' | 'card'

function cardPriorityClass(priority: KanbanCard['priority']): string {
  if (priority === 'high') return 'bg-red-500'
  if (priority === 'low') return 'bg-muted-foreground/50'
  return 'bg-yellow-400'
}

function SortableColumnCard({
  card,
  selected,
  onSelect,
}: {
  card: KanbanCard
  selected: boolean
  onSelect: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card' as DragItemType,
      cardId: card.id,
      columnId: card.column_id,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'group relative rounded-md border border-border/70 bg-card px-2 py-2 text-left transition-colors hover:bg-accent/50',
        selected && 'border-border bg-accent/50'
      )}
      onClick={onSelect}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute inset-y-0 inset-s-0 hidden w-5 items-center justify-center text-muted-foreground/40 group-hover:flex"
      >
        <GripVertical className="size-3" />
      </button>

      <div className="ms-3 flex items-start gap-2">
        <span
          className={cn(
            'mt-1 inline-block size-1.5 shrink-0 rounded-full',
            cardPriorityClass(card.priority)
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] leading-4 text-foreground">
            {card.title}
          </p>
        </div>
      </div>
    </div>
  )
}

function SortableBoardColumn({
  columnId,
  title,
  cards,
  selectedCardId,
  isCardOver,
  editing,
  onStartEditing,
  onSaveTitle,
  onDeleteColumn,
  onClearColumn,
  onAddCard,
  onSelectCard,
}: {
  columnId: string
  title: string
  cards: KanbanCard[]
  selectedCardId: string | null
  isCardOver: boolean
  editing: boolean
  onStartEditing: () => void
  onSaveTitle: (name: string) => void
  onDeleteColumn: () => void
  onClearColumn: () => void
  onAddCard: (title: string) => void
  onSelectCard: (cardId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    data: { type: 'column' as DragItemType, columnId },
  })

  const [nameDraft, setNameDraft] = useState(title)
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [cardDraft, setCardDraft] = useState('')

  useEffect(() => {
    setNameDraft(title)
  }, [title])

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'flex h-full w-65 shrink-0 flex-col rounded-lg border border-border bg-muted/25 p-2',
        isCardOver && 'ring-1 ring-ring/40'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="rounded p-1 text-muted-foreground/50 hover:bg-accent hover:text-foreground"
          aria-label="Drag column"
        >
          <GripVertical className="size-3.5" />
        </button>

        {editing ? (
          <input
            value={nameDraft}
            onChange={event => setNameDraft(event.target.value)}
            onBlur={() => onSaveTitle(nameDraft.trim() || title)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                onSaveTitle(nameDraft.trim() || title)
              }
              if (event.key === 'Escape') {
                setNameDraft(title)
              }
            }}
            className="h-7 flex-1 rounded border border-border bg-background px-2 text-[12px] outline-none"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onDoubleClick={onStartEditing}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            <span className="truncate text-[12px] font-medium">{title}</span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {cards.length}
            </span>
          </button>
        )}

        <details className="relative">
          <summary className="cursor-pointer list-none rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground">
            <MoreHorizontal className="size-3.5" />
          </summary>
          <div className="absolute inset-e-0 top-6 z-30 w-44 rounded-md border border-border bg-card p-1 text-[12px] shadow-xl">
            <button
              type="button"
              onClick={onStartEditing}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent"
            >
              <SquarePen className="size-3" /> Rename
            </button>
            <button
              type="button"
              onClick={onClearColumn}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent"
            >
              <Trash2 className="size-3" /> Clear cards
            </button>
            <button
              type="button"
              onClick={onDeleteColumn}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3" /> Delete column
            </button>
          </div>
        </details>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pe-1">
        <SortableContext
          items={cards.map(card => card.id)}
          strategy={rectSortingStrategy}
        >
          <div className="flex flex-col gap-1.5">
            {cards.map(card => (
              <SortableColumnCard
                key={card.id}
                card={card}
                selected={selectedCardId === card.id}
                onSelect={() => onSelectCard(card.id)}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <div className="mt-2">
        {isAddingCard ? (
          <input
            value={cardDraft}
            onChange={event => setCardDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                const value = cardDraft.trim()
                if (value) onAddCard(value)
                setCardDraft('')
                setIsAddingCard(false)
              }
              if (event.key === 'Escape') {
                setCardDraft('')
                setIsAddingCard(false)
              }
            }}
            onBlur={() => {
              const value = cardDraft.trim()
              if (value) onAddCard(value)
              setCardDraft('')
              setIsAddingCard(false)
            }}
            className="h-8 w-full rounded border border-border bg-background px-2 text-[12px] outline-none"
            placeholder="Card title"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingCard(true)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add a card
          </button>
        )}
      </div>
    </section>
  )
}

function CardDetailPanel() {
  const fullBoard = useKanbanStore(state => state.fullBoard)
  const selectedCardId = useKanbanStore(state => state.selectedCardId)
  const selectCard = useKanbanStore(state => state.selectCard)
  const updateCard = useKanbanStore(state => state.updateCard)
  const deleteCard = useKanbanStore(state => state.deleteCard)
  const moveCard = useKanbanStore(state => state.moveCard)
  const loadCardSubtasks = useKanbanStore(state => state.loadCardSubtasks)
  const createSubtask = useKanbanStore(state => state.createSubtask)
  const toggleSubtask = useKanbanStore(state => state.toggleSubtask)
  const subtasksByCardId = useKanbanStore(state => state.subtasksByCardId)

  const selected = (() => {
    if (!fullBoard || !selectedCardId) return null

    for (const column of fullBoard.columns) {
      const card = column.cards.find(item => item.id === selectedCardId)
      if (card) {
        return { card, columnId: column.column.id }
      }
    }

    return null
  })()

  const [subtaskDraft, setSubtaskDraft] = useState('')

  useEffect(() => {
    if (!selectedCardId) return
    void loadCardSubtasks(selectedCardId)
  }, [loadCardSubtasks, selectedCardId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        selectCard(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectCard])

  if (!selected || !fullBoard) return null

  const { card } = selected
  const subtasks = subtasksByCardId[card.id] ?? []

  return (
    <div
      className="absolute inset-0 z-40 flex justify-end bg-background/60 backdrop-blur-[1px]"
      onClick={() => selectCard(null)}
    >
      <aside
        className="h-full w-full max-w-md border-s border-border bg-card p-4"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Card details</h2>
          <button
            type="button"
            onClick={() => selectCard(null)}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Title
            </label>
            <input
              value={card.title}
              onChange={event =>
                void updateCard(card.id, { title: event.target.value })
              }
              className="h-8 w-full rounded border border-border bg-background px-2 text-[13px] outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Description
            </label>
            <textarea
              value={card.description ?? ''}
              onChange={event =>
                void updateCard(card.id, {
                  description: event.target.value || null,
                })
              }
              className="h-28 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-[13px] outline-none"
              placeholder="Markdown supported"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Priority
              </label>
              <select
                value={card.priority}
                onChange={event =>
                  void updateCard(card.id, {
                    priority: event.target.value as KanbanCard['priority'],
                  })
                }
                className="h-8 w-full rounded border border-border bg-background px-2 text-[12px]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">
                Move to column
              </label>
              <select
                value={card.column_id}
                onChange={event => {
                  const targetColumnId = event.target.value
                  if (targetColumnId === card.column_id) return
                  const targetColumn = fullBoard.columns.find(
                    column => column.column.id === targetColumnId
                  )
                  const order = (targetColumn?.cards.length ?? 0) * 1000
                  void moveCard(card.id, targetColumnId, order)
                }}
                className="h-8 w-full rounded border border-border bg-background px-2 text-[12px]"
              >
                {fullBoard.columns.map(column => (
                  <option key={column.column.id} value={column.column.id}>
                    {column.column.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground">
                Subtasks
              </label>
              <span className="text-[11px] text-muted-foreground">
                {subtasks.filter(item => item.completed).length}/
                {subtasks.length}
              </span>
            </div>
            <div className="mb-2 max-h-40 space-y-1 overflow-y-auto">
              {subtasks.map(subtask => (
                <label
                  key={subtask.id}
                  className="flex items-center gap-2 rounded px-1 py-1 text-[12px] hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => void toggleSubtask(card.id, subtask.id)}
                  />
                  <span
                    className={cn(
                      subtask.completed && 'line-through text-muted-foreground'
                    )}
                  >
                    {subtask.title}
                  </span>
                </label>
              ))}
            </div>
            <input
              value={subtaskDraft}
              onChange={event => setSubtaskDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  const value = subtaskDraft.trim()
                  if (value) {
                    void createSubtask(card.id, value)
                    setSubtaskDraft('')
                  }
                }
              }}
              className="h-8 w-full rounded border border-border bg-background px-2 text-[12px] outline-none"
              placeholder="Add subtask"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const shouldDelete = window.confirm('Delete this card?')
              if (!shouldDelete) return
              void deleteCard(card.id)
              selectCard(null)
            }}
            className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[12px] text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" /> Delete card
          </button>
        </div>
      </aside>
    </div>
  )
}

export function KanbanPage({ compact = false }: KanbanPageProps) {
  const boards = useKanbanStore(state => state.boards)
  const activeBoardId = useKanbanStore(state => state.activeBoardId)
  const fullBoard = useKanbanStore(state => state.fullBoard)
  const selectedCardId = useKanbanStore(state => state.selectedCardId)
  const isLoading = useKanbanStore(state => state.isLoading)

  const loadBoards = useKanbanStore(state => state.loadBoards)
  const createBoard = useKanbanStore(state => state.createBoard)
  const updateBoard = useKanbanStore(state => state.updateBoard)
  const setActiveBoard = useKanbanStore(state => state.setActiveBoard)
  const deleteBoard = useKanbanStore(state => state.deleteBoard)
  const createColumn = useKanbanStore(state => state.createColumn)
  const updateColumn = useKanbanStore(state => state.updateColumn)
  const deleteColumn = useKanbanStore(state => state.deleteColumn)
  const createCard = useKanbanStore(state => state.createCard)
  const deleteCard = useKanbanStore(state => state.deleteCard)
  const reorderColumns = useKanbanStore(state => state.reorderColumns)
  const reorderCards = useKanbanStore(state => state.reorderCards)
  const moveCard = useKanbanStore(state => state.moveCard)
  const selectCard = useKanbanStore(state => state.selectCard)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragType, setActiveDragType] = useState<DragItemType | null>(
    null
  )
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [editingBoardNameId, setEditingBoardNameId] = useState<string | null>(
    null
  )
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const activeBoard = boards.find(board => board.id === activeBoardId) ?? null

  const draggedCard = (() => {
    if (!fullBoard || activeDragType !== 'card' || !activeDragId) return null
    for (const column of fullBoard.columns) {
      const card = column.cards.find(item => item.id === activeDragId)
      if (card) return card
    }
    return null
  })()

  const draggedColumn =
    !fullBoard || activeDragType !== 'column' || !activeDragId
      ? null
      : fullBoard.columns.find(column => column.column.id === activeDragId)

  const handleDragStart = (event: DragStartEvent) => {
    const dragType = event.active.data.current?.type as DragItemType | undefined
    if (!dragType) return

    setActiveDragType(dragType)
    setActiveDragId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const over = event.over
    if (!over) {
      setOverColumnId(null)
      return
    }

    const overType = over.data.current?.type as DragItemType | undefined
    if (overType === 'column') {
      setOverColumnId(String(over.id))
      return
    }

    if (overType === 'card') {
      setOverColumnId(String(over.data.current?.columnId))
      return
    }

    setOverColumnId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveDragId(null)
    setActiveDragType(null)
    setOverColumnId(null)

    if (!fullBoard || !over) return

    const activeType = active.data.current?.type as DragItemType | undefined
    const overType = over.data.current?.type as DragItemType | undefined

    if (activeType === 'column' && overType === 'column') {
      const columnIds = fullBoard.columns.map(column => column.column.id)
      const oldIndex = columnIds.indexOf(String(active.id))
      const newIndex = columnIds.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const next = arrayMove(columnIds, oldIndex, newIndex)
      await reorderColumns(next)
      return
    }

    if (activeType !== 'card') return

    const cardId = String(active.id)
    let sourceColumnId: string | null = null
    let sourceIndex = -1

    for (const column of fullBoard.columns) {
      const index = column.cards.findIndex(card => card.id === cardId)
      if (index !== -1) {
        sourceColumnId = column.column.id
        sourceIndex = index
        break
      }
    }

    if (!sourceColumnId || sourceIndex === -1) return

    let destinationColumnId: string | null = null
    let destinationIndex = 0

    if (overType === 'column') {
      destinationColumnId = String(over.id)
      const targetColumn = fullBoard.columns.find(
        column => column.column.id === destinationColumnId
      )
      destinationIndex = targetColumn?.cards.length ?? 0
    } else if (overType === 'card') {
      destinationColumnId = String(over.data.current?.columnId)
      const targetColumn = fullBoard.columns.find(
        column => column.column.id === destinationColumnId
      )
      destinationIndex =
        targetColumn?.cards.findIndex(card => card.id === String(over.id)) ?? 0
    }

    if (!destinationColumnId) return

    if (destinationColumnId === sourceColumnId) {
      const sourceColumn = fullBoard.columns.find(
        column => column.column.id === sourceColumnId
      )
      if (!sourceColumn) return

      const ids = sourceColumn.cards.map(card => card.id)
      const oldIndex = ids.indexOf(cardId)
      const newIndex = Math.max(0, Math.min(destinationIndex, ids.length - 1))
      if (oldIndex === -1 || oldIndex === newIndex) return

      const nextIds = arrayMove(ids, oldIndex, newIndex)
      await reorderCards(sourceColumnId, nextIds)
      return
    }

    const boundedIndex = Math.max(0, destinationIndex)
    await moveCard(cardId, destinationColumnId, boundedIndex * 1000)
  }

  if (isLoading && !fullBoard) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading kanban...
      </div>
    )
  }

  if (!activeBoard || !fullBoard) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No active board.
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          {editingBoardNameId === activeBoard.id ? (
            <input
              defaultValue={activeBoard.name}
              autoFocus
              onBlur={event => {
                const value = event.target.value.trim()
                if (value) {
                  void updateBoard(activeBoard.id, value)
                }
                setEditingBoardNameId(null)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  const value = event.currentTarget.value.trim()
                  if (value) {
                    void updateBoard(activeBoard.id, value)
                  }
                  setEditingBoardNameId(null)
                }
                if (event.key === 'Escape') {
                  setEditingBoardNameId(null)
                }
              }}
              className="h-8 rounded border border-border bg-background px-2 text-sm outline-none"
            />
          ) : (
            <select
              value={activeBoard.id}
              onChange={event => void setActiveBoard(event.target.value)}
              className="h-8 rounded border border-border bg-card px-2 text-sm"
            >
              {boards.map(board => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={async () => {
              const id = await createBoard('Untitled Board')
              setEditingBoardNameId(id)
            }}
            className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-xs hover:bg-accent"
          >
            <Plus className="size-3.5" /> New Board
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditingBoardNameId(activeBoard.id)}
            className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-xs hover:bg-accent"
          >
            <SquarePen className="size-3.5" /> Board settings
          </button>
          {!compact && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded border border-border px-2 text-xs text-muted-foreground"
              title="Kanban page"
            >
              <ArrowUpRight className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const confirmed = window.confirm('Delete this board?')
              if (!confirmed) return
              void deleteBoard(activeBoard.id)
            }}
            className="inline-flex h-8 items-center gap-1 rounded border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={event => void handleDragEnd(event)}
      >
        <div className="custom-scrollbar-horizontal flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
          <SortableContext
            items={fullBoard.columns.map(column => column.column.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex h-full items-start gap-3">
              {fullBoard.columns.map(column => (
                <SortableBoardColumn
                  key={column.column.id}
                  columnId={column.column.id}
                  title={column.column.name}
                  cards={column.cards}
                  selectedCardId={selectedCardId}
                  isCardOver={
                    overColumnId === column.column.id &&
                    activeDragType === 'card'
                  }
                  editing={editingColumnId === column.column.id}
                  onStartEditing={() => setEditingColumnId(column.column.id)}
                  onSaveTitle={name => {
                    void updateColumn(column.column.id, name)
                    setEditingColumnId(null)
                  }}
                  onDeleteColumn={() => void deleteColumn(column.column.id)}
                  onClearColumn={() => {
                    for (const card of column.cards) {
                      void deleteCard(card.id)
                    }
                  }}
                  onAddCard={title => void createCard(column.column.id, title)}
                  onSelectCard={cardId => selectCard(cardId)}
                />
              ))}

              <button
                type="button"
                onClick={() =>
                  void createColumn(activeBoard.id, 'Untitled Column')
                }
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Add column"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeDragType === 'card' && draggedCard ? (
            <div
              className="w-60 rounded-md border border-border/80 bg-card px-2 py-2 opacity-50"
              style={{ pointerEvents: 'none' }}
            >
              <p className="line-clamp-2 text-[12px]">{draggedCard.title}</p>
            </div>
          ) : activeDragType === 'column' && draggedColumn ? (
            <div
              className="w-65 rounded-md border border-border/80 bg-muted/80 p-2 opacity-50"
              style={{ pointerEvents: 'none' }}
            >
              <p className="text-[12px] font-medium">
                {draggedColumn.column.name}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDetailPanel />
    </div>
  )
}
