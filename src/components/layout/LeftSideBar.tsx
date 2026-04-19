import {
  CheckSquare,
  LayoutGrid,
  Timer,
  CircleCheck,
  NotebookPen,
  BarChart2,
} from 'lucide-react'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import type { AppPage } from '@/store/ui-store'

interface NavItem {
  id: AppPage
  label: string
  icon: React.ElementType
  spacedBelow?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'grid', label: 'Dashboard', icon: LayoutGrid, spacedBelow: true },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'habits', label: 'Habits', icon: CircleCheck },
  { id: 'pomodoro', label: 'Focus', icon: Timer, spacedBelow: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
]

interface LeftSideBarProps {
  children?: React.ReactNode
  className?: string
}

export function LeftSideBar({ children, className }: LeftSideBarProps) {
  const activePage = useUIStore(state => state.activePage)
  const navigateTo = useUIStore(state => state.navigateTo)

  return (
    <div
      className={cn('flex h-full flex-col border-r bg-sidebar', className)}
    >
      {/* Activity Bar - icon-only navigation */}
      <nav
        className="flex flex-col items-center gap-1 p-2 pt-3"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id
          return (
            <div
              key={item.id}
              className={cn(item.spacedBelow && 'mb-6')}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex size-9 items-center justify-center rounded-md transition-all duration-150',
                    isActive
                      ? [
                          'text-foreground',
                          'before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.75 before:rounded-r-full before:bg-accent',
                        ]
                      : [
                          'text-muted-foreground',
                          'hover:bg-accent/8 hover:text-foreground',
                        ]
                  )}
                >
                    <item.icon
                      className={cn(
                        'size-[18px] transition-colors',
                        isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </nav>

      {/* Slot for additional content */}
      {children}
    </div>
  )
}
