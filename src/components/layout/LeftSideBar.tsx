import {
  CheckSquare,
  LayoutGrid,
  Timer,
  CircleCheck,
  NotebookPen,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import type { AppPage } from '@/store/ui-store'

interface NavItem {
  id: AppPage
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { id: 'grid', label: 'Dashboard', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'habits', label: 'Habits', icon: CircleCheck },
  { id: 'pomodoro', label: 'Focus', icon: Timer },
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
      className={cn('flex h-full flex-col border-r bg-background', className)}
    >
      {/* Navigation */}
      <nav
        className="flex flex-col gap-0.5 p-2 pt-3"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigateTo(item.id)}
            aria-current={activePage === item.id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all',
              activePage === item.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <item.icon className="size-3.5" strokeWidth={1.75} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Slot for additional content */}
      {children}
    </div>
  )
}
