import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { LayoutItem } from 'react-grid-layout'

/**
 * Widget definition for the bento grid.
 */
export interface WidgetDefinition {
  /** Unique widget identifier (matches layout item `i` key) */
  id: string
  /** Display name shown in the toggle menu */
  label: string
  /** Icon name from lucide-react */
  icon: string
  /** Default layout position and size */
  defaultLayout: { x: number; y: number; w: number; h: number }
  /** Minimum size constraints */
  minW?: number
  minH?: number
}

/**
 * All available widgets in the bento grid.
 * This is the single source of truth for what widgets exist.
 */
export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'clock',
    label: 'Clock',
    icon: 'Clock',
    defaultLayout: { x: 0, y: 0, w: 3, h: 2 },
    minW: 2,
    minH: 2,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: 'Calendar',
    defaultLayout: { x: 3, y: 0, w: 4, h: 3 },
    minW: 3,
    minH: 3,
  },
  {
    id: 'notes',
    label: 'Quick Notes',
    icon: 'StickyNote',
    defaultLayout: { x: 7, y: 0, w: 5, h: 3 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'system-info',
    label: 'System Info',
    icon: 'Monitor',
    defaultLayout: { x: 0, y: 2, w: 3, h: 3 },
    minW: 2,
    minH: 2,
  },
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    icon: 'Zap',
    defaultLayout: { x: 3, y: 3, w: 4, h: 2 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'recent-files',
    label: 'Recent Files',
    icon: 'FolderOpen',
    defaultLayout: { x: 7, y: 3, w: 5, h: 2 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'CheckSquare',
    defaultLayout: { x: 0, y: 5, w: 4, h: 4 },
    minW: 3,
    minH: 3,
  },
  {
    id: 'pomodoro',
    label: 'Pomodoro Timer',
    icon: 'Timer',
    defaultLayout: { x: 4, y: 5, w: 4, h: 2 },
    minW: 3,
    minH: 2,
  },
  {
    id: 'habits',
    label: 'Habits',
    icon: 'CircleCheck',
    defaultLayout: { x: 8, y: 5, w: 4, h: 4 },
    minW: 3,
    minH: 3,
  },
]

interface GridState {
  /** Current grid layout */
  layout: LayoutItem[]
  /** Map of widget id → visibility */
  widgetVisibility: Record<string, boolean>
  /** Whether the initial load from SQLite is complete */
  loaded: boolean

  setLayout: (layout: LayoutItem[]) => void
  setWidgetVisibility: (visibility: Record<string, boolean>) => void
  toggleWidget: (widgetId: string) => void
  setLoaded: (loaded: boolean) => void
}

/**
 * Build default layout from the widget registry.
 * This is the fallback shown on first launch (empty SQLite).
 */
export function getDefaultLayout(): LayoutItem[] {
  return WIDGET_REGISTRY.map(w => ({
    i: w.id,
    ...w.defaultLayout,
    minW: w.minW,
    minH: w.minH,
  }))
}

/**
 * Build default visibility (all visible).
 */
export function getDefaultVisibility(): Record<string, boolean> {
  const vis: Record<string, boolean> = {}
  for (const w of WIDGET_REGISTRY) {
    vis[w.id] = true
  }
  return vis
}

export const useGridStore = create<GridState>()(
  devtools(
    set => ({
      layout: getDefaultLayout(),
      widgetVisibility: getDefaultVisibility(),
      loaded: false,

      setLayout: layout => set({ layout }, undefined, 'setLayout'),

      setWidgetVisibility: visibility =>
        set({ widgetVisibility: visibility }, undefined, 'setWidgetVisibility'),

      toggleWidget: widgetId =>
        set(
          state => {
            const newVisibility = {
              ...state.widgetVisibility,
              [widgetId]: !state.widgetVisibility[widgetId],
            }

            // If showing a widget that has no layout entry, add default
            if (
              newVisibility[widgetId] &&
              !state.layout.some(l => l.i === widgetId)
            ) {
              const def = WIDGET_REGISTRY.find(w => w.id === widgetId)
              if (def) {
                return {
                  widgetVisibility: newVisibility,
                  layout: [
                    ...state.layout,
                    {
                      i: widgetId,
                      ...def.defaultLayout,
                      minW: def.minW,
                      minH: def.minH,
                    },
                  ],
                }
              }
            }

            return { widgetVisibility: newVisibility }
          },
          undefined,
          'toggleWidget'
        ),

      setLoaded: loaded => set({ loaded }, undefined, 'setLoaded'),
    }),
    {
      name: 'grid-store',
    }
  )
)
