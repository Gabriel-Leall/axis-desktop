import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react'
import { cn } from '@/lib/utils'

function Skeleton({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <BoneyardSkeleton
      loading={true}
      className={cn('bg-accent rounded-md', className)}
      {...props}
    >
      {children || <span />}
    </BoneyardSkeleton>
  )
}

export { Skeleton }
