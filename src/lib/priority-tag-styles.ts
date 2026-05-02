import { cn } from '@/lib/utils'

type PriorityLevel = 'high' | 'medium' | 'low'

export function getPriorityTagClass(priority: PriorityLevel): string {
  return cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset',
    priority === 'high' &&
      'bg-destructive/15 text-destructive ring-destructive/30',
    priority === 'medium' &&
      'bg-accent/20 text-accent-foreground ring-accent/35',
    priority === 'low' && 'bg-muted text-muted-foreground ring-border'
  )
}
