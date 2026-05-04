import { cn } from '@/lib/utils'
import { AnimatePresence } from 'motion/react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { BentoGrid } from '@/components/grid'
import { WidgetToggleMenu } from '@/components/grid'
import { useUIStore } from '@/store/ui-store'
import { Maximize2, Minimize2 } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { lazy, Suspense, useState } from 'react'

const TasksPage = lazy(() =>
  import('@/pages/TasksPage').then(module => ({ default: module.TasksPage }))
)
const PomodoroPage = lazy(() =>
  import('@/pages/PomodoroPage').then(module => ({
    default: module.PomodoroPage,
  }))
)
const HabitPage = lazy(() =>
  import('@/pages/HabitPage').then(module => ({ default: module.HabitPage }))
)
const NotesPage = lazy(() =>
  import('@/pages/NotesPage').then(module => ({ default: module.NotesPage }))
)
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then(module => ({
    default: module.CalendarPage,
  }))
)
const GitHubPage = lazy(() =>
  import('@/pages/GitHubPage').then(module => ({ default: module.GitHubPage }))
)
const SlackPage = lazy(() =>
  import('@/pages/SlackPage').then(module => ({ default: module.SlackPage }))
)
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  const activePage = useUIStore(state => state.activePage)
  const activePageData = useUIStore(state => state.activePageData)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = async () => {
    const appWindow = getCurrentWindow()
    const current = await appWindow.isFullscreen()
    if (current) {
      await appWindow.setFullscreen(false)
      setIsFullscreen(false)
    } else {
      await appWindow.setFullscreen(true)
      setIsFullscreen(true)
    }
  }

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <Suspense
          fallback={<div className="flex h-full items-center justify-center" />}
        >
          <AnimatePresence mode="wait">
            {activePage === 'tasks' ? (
              <PageWrapper key="tasks">
                <TasksPage
                  initialSelectedTaskId={activePageData['selectedTaskId']}
                />
              </PageWrapper>
            ) : activePage === 'habits' ? (
              <PageWrapper key="habits">
                <HabitPage
                  initialSelectedHabitId={activePageData['selectedHabitId']}
                />
              </PageWrapper>
            ) : activePage === 'pomodoro' ? (
              <PageWrapper key="pomodoro">
                <PomodoroPage />
              </PageWrapper>
            ) : activePage === 'notes' ? (
              <PageWrapper key="notes">
                <NotesPage
                  initialSelectedNoteId={activePageData['selectedNoteId']}
                />
              </PageWrapper>
            ) : activePage === 'kanban' ? (
              <PageWrapper key="kanban">
                <TasksPage initialViewMode="kanban" />
              </PageWrapper>
            ) : activePage === 'calendar' ? (
              <PageWrapper key="calendar">
                <CalendarPage />
              </PageWrapper>
            ) : activePage === 'github' ? (
              <PageWrapper key="github">
                <GitHubPage />
              </PageWrapper>
            ) : activePage === 'slack' ? (
              <PageWrapper key="slack">
                <SlackPage />
              </PageWrapper>
            ) : activePage === 'analytics' ? (
              <PageWrapper key="analytics">
                <AnalyticsPage />
              </PageWrapper>
            ) : (
              <PageWrapper key="dashboard">
                <div className="flex h-full flex-col">
                  {/* Header with widget toggle + fullscreen */}
                  <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-4 py-1.5">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={
                        isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                      }
                    >
                      {isFullscreen ? (
                        <Minimize2 className="size-3.5" />
                      ) : (
                        <Maximize2 className="size-3.5" />
                      )}
                    </button>
                    <WidgetToggleMenu />
                  </div>
                  {/* Bento Grid Dashboard */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <BentoGrid />
                  </div>
                </div>
              </PageWrapper>
            )}
          </AnimatePresence>
        </Suspense>
      )}
    </div>
  )
}
