import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpRight, Plus } from 'lucide-react'
import { WidgetCard } from '../WidgetCard'
import { cn } from '@/lib/utils'
import { useKanbanStore } from '@/store/kanban-store'
import type { KanbanCard } from '@/lib/bindings'

interface KanbanWidgetProps {
  onOpenKanban?: () => void
}

function DroppableMiniColumn({
  columnId,
  isOver,
  children,
}: {
  columnId: string
  isOver: boolean
  children: ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: { type: 'column', columnId },
  })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-44 shrink-0 flex-col rounded-md border border-border bg-muted/30 p-2',
        isOver && 'ring-1 ring-ring/40'
      )}
    >
      {children}
    </section>
  )
}

function MiniCard({
  card,
  onSelect,
}: {
  card: KanbanCard
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
    data: { type: 'card', cardId: card.id, columnId: card.column_id },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="w-full rounded border border-border/70 bg-card px-2 py-1 text-left text-[11px] leading-4 hover:bg-accent/50"
    >
      <span className="line-clamp-2">{card.title}</span>
    </button>
  )
}

export function KanbanWidget({ onOpenKanban }: KanbanWidgetProps) {
  const boards = useKanbanStore(state => state.boards)
  const activeBoardId = useKanbanStore(state => state.activeBoardId)
  const fullBoard = useKanbanStore(state => state.fullBoard)
  const selectedCardId = useKanbanStore(state => state.selectedCardId)
  const isLoading = useKanbanStore(state => state.isLoading)

  const loadBoards = useKanbanStore(state => state.loadBoards)
  const setActiveBoard = useKanbanStore(state => state.setActiveBoard)
  const moveCard = useKanbanStore(state => state.moveCard)
  const reorderCards = useKanbanStore(state => state.reorderCards)
  const createCard = useKanbanStore(state => state.createCard)
  const selectCard = useKanbanStore(state => state.selectCard)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const [activeDragCardId, setActiveDragCardId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null)
  const [quickAddValue, setQuickAddValue] = useState('')

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const selectedCard = useMemo(() => {
    if (!fullBoard || !selectedCardId) return null

    for (const column of fullBoard.columns) {
      const card = column.cards.find(item => item.id === selectedCardId)
      if (card) return card
    }

    return null
  }, [fullBoard, selectedCardId])

  const draggedCard = useMemo(() => {
    if (!fullBoard || !activeDragCardId) return null

    for (const column of fullBoard.columns) {
      const card = column.cards.find(item => item.id === activeDragCardId)
      if (card) return card
    }

    return null
  }, [activeDragCardId, fullBoard])

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type !== 'card') return
    setActiveDragCardId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setOverColumnId(null)
      return
    }

    const overType = event.over.data.current?.type as string | undefined
    if (overType === 'column') {
      setOverColumnId(String(event.over.id))
      return
    }

    if (overType === 'card') {
      setOverColumnId(String(event.over.data.current?.columnId))
      return
    }

    setOverColumnId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveDragCardId(null)
    setOverColumnId(null)

    if (!fullBoard || !over) return

    const cardId = String(active.id)

    let sourceColumnId = ''
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

    const overType = over.data.current?.type as string | undefined
    let destinationColumnId = ''
    let destinationIndex = 0

    if (overType === 'column') {
      destinationColumnId = String(over.id)
      const targetColumn = fullBoard.columns.find(
        column => column.column.id === destinationColumnId
      )
      destinationIndex = targetColumn?.cards.length ?? 0
    }

    if (overType === 'card') {
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

      const next = [...ids]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved as string)
      await reorderCards(sourceColumnId, next)
      return
    }

    await moveCard(cardId, destinationColumnId, destinationIndex * 1000)
  }

  const submitQuickAdd = async () => {
    const title = quickAddValue.trim()
    if (!title || !quickAddColumnId) return
    await createCard(quickAddColumnId, title)
    setQuickAddValue('')
    setQuickAddColumnId(null)
  }

  return (
    <WidgetCard title="Kanban">
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <select
            value={activeBoardId ?? ''}
            onChange={event => void setActiveBoard(event.target.value)}
            className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-[11px]"
          >
            {boards.map(board => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenKanban}
            className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-accent"
            title="Open full page"
          >
            <ArrowUpRight className="size-3" />
          </button>
        </div>

        {isLoading || !fullBoard ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
            Loading board...
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={event => void handleDragEnd(event)}
          >
            <div className="custom-scrollbar-horizontal flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex h-full min-w-max gap-2 pb-1">
                {fullBoard.columns.map(column => {
                  const visibleCards = column.cards.slice(0, 4)
                  const hiddenCount = Math.max(
                    0,
                    column.cards.length - visibleCards.length
                  )

                  return (
                    <DroppableMiniColumn
                      key={column.column.id}
                      columnId={column.column.id}
                      isOver={overColumnId === column.column.id}
                    >
                      <header className="mb-1 flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] font-medium text-muted-foreground">
                          {column.column.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/70">
                          {column.cards.length}
                        </span>
                      </header>

                      <SortableContext
                        items={column.cards.map(card => card.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="flex flex-1 flex-col gap-1">
                          {visibleCards.map(card => (
                            <MiniCard
                              key={card.id}
                              card={card}
                              onSelect={() => selectCard(card.id)}
                            />
                          ))}
                        </div>
                      </SortableContext>

                      {hiddenCount > 0 && (
                        <span className="mt-1 text-[10px] text-muted-foreground/70">
                          +{hiddenCount} more
                        </span>
                      )}

                      <div className="mt-1">
                        {quickAddColumnId === column.column.id ? (
                          <input
                            value={quickAddValue}
                            onChange={event =>
                              setQuickAddValue(event.target.value)
                            }
                            onBlur={() => void submitQuickAdd()}
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                void submitQuickAdd()
                              }
                              if (event.key === 'Escape') {
                                setQuickAddColumnId(null)
                                setQuickAddValue('')
                              }
                            }}
                            className="h-7 w-full rounded border border-border bg-background px-2 text-[11px] outline-none"
                            placeholder="New card"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickAddColumnId(column.column.id)
                            }
                            className="flex w-full items-center gap-1 rounded px-1 py-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Plus className="size-3" /> Add card
                          </button>
                        )}
                      </div>
                    </DroppableMiniColumn>
                  )
                })}
              </div>
            </div>

            <DragOverlay>
              {draggedCard ? (
                <div
                  className="w-44 rounded border border-border/80 bg-card px-2 py-1 text-[11px] opacity-50"
                  style={{ pointerEvents: 'none' }}
                >
                  {draggedCard.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {selectedCard && (
          <div className="rounded border border-border bg-card p-2 text-[11px]">
            <p className="mb-1 font-medium">{selectedCard.title}</p>
            <p className="line-clamp-3 text-muted-foreground">
              {selectedCard.description || 'No description'}
            </p>
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
