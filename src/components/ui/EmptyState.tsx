import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'

export interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    shortcut?: string
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      {Icon && (
        <div className="mb-4 text-muted-foreground [&>svg]:size-10 [&>svg]:opacity-30">
          <Icon />
        </div>
      )}
      <h3 className="text-lg font-medium tracking-tight mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline" className="gap-2">
          {action.label}
          {action.shortcut && (
            <Kbd className="text-[10px] uppercase ml-1">{action.shortcut}</Kbd>
          )}
        </Button>
      )}
    </motion.div>
  )
}
