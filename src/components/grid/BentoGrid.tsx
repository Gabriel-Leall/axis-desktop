import { useEffect, useRef } from 'react'
import {
  GridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import './grid.css'

import {
  useGridStore,
  getDefaultLayout,
  getDefaultVisibility,
  WIDGET_REGISTRY,
} from '@/store/grid-store'
import { saveGridLayout, loadGridLayout } from '@/services/grid-layout-db'
import { logger } from '@/lib/logger'

import {
  CalendarWidget,
  NotesWidget as BrainDumpWidget,
  TasksWidget,
  PomodoroWidget,
  HabitWidget,
  GitHubWidget,
} from './widgets'
import { useUIStore } from '@/store/ui-store'
import { useGitHubStore } from '@/store/github-store'

/**
 * Wrapper that passes navigation to TasksWidget.
 * We need this because WIDGET_COMPONENTS only holds React.FC with no props.
 */
function TasksWidgetConnected() {
  const navigateTo = useUIStore(state => state.navigateTo)
  return (
    <TasksWidget
      onNavigateToTasks={selectedTaskId =>
        navigateTo('tasks', selectedTaskId ? { selectedTaskId } : {})
      }
    />
  )
}

function HabitWidgetConnected() {
  const navigateTo = useUIStore(state => state.navigateTo)
  return (
    <HabitWidget
      onNavigateToHabits={selectedHabitId =>
        navigateTo('habits', selectedHabitId ? { selectedHabitId } : {})
      }
    />
  )
}

function BrainDumpWidgetConnected() {
  const navigateTo = useUIStore(state => state.navigateTo)
  return (
    <BrainDumpWidget
      onNavigateToNotes={selectedNoteId =>
        navigateTo('notes', selectedNoteId ? { selectedNoteId } : {})
      }
    />
  )
}

function GitHubWidgetConnected() {
  const navigateTo = useUIStore(state => state.navigateTo)
  return <GitHubWidget onNavigateToGitHub={() => navigateTo('github')} />
}

/** Map widget ID → React component */
const WIDGET_COMPONENTS: Record<string, React.FC> = {
  calendar: CalendarWidget,
  notes: BrainDumpWidgetConnected,
  tasks: TasksWidgetConnected,
  pomodoro: PomodoroWidget,
  github: GitHubWidgetConnected,
  habits: HabitWidgetConnected,
}

/** Grid configuration */
const GRID_COLS = 12
const ROW_HEIGHT = 80
const GRID_MARGIN: [number, number] = [12, 12]
const GRID_PADDING: [number, number] = [16, 16]
const VALID_WIDGET_IDS = new Set(WIDGET_REGISTRY.map(widget => widget.id))
const WIDGET_CONSTRAINTS = new Map(
  WIDGET_REGISTRY.map(widget => [
    widget.id,
    {
      minW: widget.minW,
      minH: widget.minH,
    },
  ])
)

function normalizeLayout(layout: LayoutItem[]): LayoutItem[] {
  return layout
    .filter(item => VALID_WIDGET_IDS.has(item.i))
    .map(item => {
      const constraints = WIDGET_CONSTRAINTS.get(item.i)
      const minW = constraints?.minW
      const minH = constraints?.minH

      return {
        ...item,
        minW,
        minH,
        w: minW ? Math.max(item.w, minW) : item.w,
        h: minH ? Math.max(item.h, minH) : item.h,
      }
    })
}

/**
 * BentoGrid — draggable/resizable widget dashboard.
 *
 * Uses react-grid-layout v2 component API with:
 * - useContainerWidth for responsive width measurement
 * - Vertical compaction
 * - Debounced persistence to SQLite via tauri-plugin-sql
 */
export function BentoGrid() {
  const { width, containerRef, mounted } = useContainerWidth()

  const layout = useGridStore(state => state.layout)
  const widgetVisibility = useGridStore(state => state.widgetVisibility)
  const loaded = useGridStore(state => state.loaded)
  const profileId = useGridStore(state => state.profileId)
  const setLayout = useGridStore(state => state.setLayout)
  const setWidgetVisibility = useGridStore(state => state.setWidgetVisibility)
  const setLoaded = useGridStore(state => state.setLoaded)
  const setProfileId = useGridStore(state => state.setProfileId)
  const githubUser = useGitHubStore(state => state.user)

  const activeProfileId = githubUser?.login
    ? `github:${githubUser.login}`
    : 'guest'

  // Debounce ref for saving
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the layout for the active profile. Guest and authenticated users keep
  // independent dashboard arrangements.
  useEffect(() => {
    setLoaded(false)
    setProfileId(activeProfileId)
    setLayout(getDefaultLayout())
    setWidgetVisibility(getDefaultVisibility())

    let cancelled = false

    const hydrate = async () => {
      try {
        const saved = await loadGridLayout(activeProfileId)
        if (cancelled) return

        if (saved) {
          const parsedLayout = JSON.parse(saved.layoutJson) as LayoutItem[]
          const parsedVisibility = JSON.parse(saved.widgetVisibility) as Record<
            string,
            boolean
          >
          const sanitizedLayout = normalizeLayout(parsedLayout)
          const sanitizedVisibility = Object.fromEntries(
            Object.entries(parsedVisibility).filter(([widgetId]) =>
              VALID_WIDGET_IDS.has(widgetId)
            )
          )

          // Only use saved data if it has content
          if (sanitizedLayout.length > 0) {
            setLayout(sanitizedLayout)
          }
          if (Object.keys(sanitizedVisibility).length > 0) {
            // Merge with defaults — new widgets get visible by default
            const defaults = getDefaultVisibility()
            setWidgetVisibility({ ...defaults, ...sanitizedVisibility })
          }
        }
      } catch (error) {
        logger.warn(`Failed to hydrate grid layout: ${String(error)}`)
        // Fall through to defaults already in the store
      } finally {
        if (!cancelled) {
          setLoaded(true)
        }
      }
    }

    hydrate()
    return () => {
      cancelled = true
    }
  }, [activeProfileId, setLayout, setWidgetVisibility, setLoaded, setProfileId])

  /**
   * Debounced save to SQLite when layout changes via drag/resize.
   */
  const handleLayoutChange = (newLayout: Layout) => {
    const normalizedLayout = normalizeLayout([...newLayout])

    // Layout is readonly, spread to mutable array for the store
    setLayout(normalizedLayout)

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      const { widgetVisibility: vis } = useGridStore.getState()
      saveGridLayout(normalizedLayout, vis, profileId)
    }, 500)
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Persist when visibility changes
  useEffect(() => {
    if (!loaded) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(() => {
      const { layout: currentLayout } = useGridStore.getState()
      saveGridLayout(currentLayout, widgetVisibility, profileId)
    }, 300)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [widgetVisibility, loaded, profileId])

  // Filter layout to only visible widgets
  const visibleLayout = layout.filter(
    item => VALID_WIDGET_IDS.has(item.i) && widgetVisibility[item.i] !== false
  )

  // Don't render grid until width is measured & data is loaded
  if (!mounted || !loaded) {
    return (
      <div className="h-full w-full min-w-0 overflow-auto">
        <div className="flex w-full justify-center">
          <div
            ref={containerRef}
            className="flex h-full w-full max-w-[min(90vw,1600px)] items-center justify-center"
          >
            <div className="text-sm text-muted-foreground">
              Loading dashboard…
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full min-w-0 overflow-auto">
      <div className="flex w-full justify-center">
        <div
          ref={containerRef}
          className="h-full w-full max-w-[min(90vw,1600px)]"
        >
          <GridLayout
            width={width}
            layout={visibleLayout}
            gridConfig={{
              cols: GRID_COLS,
              rowHeight: ROW_HEIGHT,
              margin: GRID_MARGIN,
              containerPadding: GRID_PADDING,
            }}
            dragConfig={{
              enabled: true,
              handle: '.widget-drag-handle',
            }}
            resizeConfig={{
              enabled: true,
              handles: ['nw', 'ne', 'sw', 'se'],
            }}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange}
          >
            {visibleLayout.map(item => {
              const WidgetComponent = WIDGET_COMPONENTS[item.i]
              if (!WidgetComponent) return null

              return (
                <div key={item.i}>
                  <WidgetComponent />
                </div>
              )
            })}
          </GridLayout>
        </div>
      </div>
    </div>
  )
}
