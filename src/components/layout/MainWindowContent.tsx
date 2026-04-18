import { cn } from '@/lib/utils'
import { BentoGrid } from '@/components/grid'
import { WidgetToggleMenu } from '@/components/grid'
import { TasksPage } from '@/pages/TasksPage'
import { PomodoroPage } from '@/pages/PomodoroPage'
import { HabitPage } from '@/pages/HabitPage'
import { NotesPage } from '@/pages/NotesPage'
import { KanbanPage } from '@/pages/KanbanPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { GitHubPage } from '@/pages/GitHubPage'
import { SlackPage } from '@/pages/SlackPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import { useUIStore } from '@/store/ui-store'

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

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <>
          {activePage === 'tasks' ? (
            <TasksPage
              initialSelectedTaskId={activePageData['selectedTaskId']}
            />
          ) : activePage === 'habits' ? (
            <HabitPage
              initialSelectedHabitId={activePageData['selectedHabitId']}
            />
          ) : activePage === 'pomodoro' ? (
            <PomodoroPage />
          ) : activePage === 'notes' ? (
            <NotesPage
              initialSelectedNoteId={activePageData['selectedNoteId']}
            />
          ) : activePage === 'kanban' ? (
            <KanbanPage />
          ) : activePage === 'calendar' ? (
            <CalendarPage />
          ) : activePage === 'github' ? (
            <GitHubPage />
          ) : activePage === 'slack' ? (
            <SlackPage />
          ) : activePage === 'analytics' ? (
            <AnalyticsPage />
          ) : (
            <>
              {/* Header with widget toggle */}
              <div className="flex shrink-0 items-center justify-end border-b border-border px-4 py-1.5">
                <WidgetToggleMenu />
              </div>
              {/* Bento Grid Dashboard */}
              <div className="flex-1 overflow-hidden">
                <BentoGrid />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
