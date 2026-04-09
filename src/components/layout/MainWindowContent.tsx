import { cn } from '@/lib/utils'
import { BentoGrid } from '@/components/grid'
import { WidgetToggleMenu } from '@/components/grid'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
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
    </div>
  )
}
