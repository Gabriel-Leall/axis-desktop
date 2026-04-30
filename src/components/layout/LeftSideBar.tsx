import {
  CheckSquare,
  LayoutGrid,
  Timer,
  CircleCheck,
  NotebookPen,
  BarChart2,
  User as UserIcon,
} from 'lucide-react'
import { useGitHubStore } from '@/store/github-store'
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
  const setPreferencesOpen = useUIStore(state => state.setPreferencesOpen)
  const user = useGitHubStore(state => state.user)

  return (
    <div className={cn('flex h-full flex-col border-r bg-sidebar', className)}>
      {/* Activity Bar - icon-only navigation */}
      <nav
        className="flex flex-col items-center gap-1 p-2 pt-3"
        aria-label="Main navigation"
      >
        <div className="mb-6 mt-1 flex items-center justify-center">
          <img src="/Axis-Logo.png" alt="Axis Logo" className="size-8 object-contain drop-shadow-sm" />
        </div>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id
          return (
            <div key={item.id} className={cn(item.spacedBelow && 'mb-6')}>
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
                        'size-4.5 transition-colors',
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground group-hover:text-foreground'
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

      <div className="mt-auto flex flex-col items-center pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setPreferencesOpen(true, 'user')}
              className="group relative flex size-9 items-center justify-center rounded-full border border-border bg-sidebar-accent/50 shadow-sm transition-all hover:border-primary/30 hover:ring-2 hover:ring-primary/10 overflow-hidden"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.login} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {user?.name || user?.login || 'Conta'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Slot for additional content */}
      {children}
    </div>
  )
}
