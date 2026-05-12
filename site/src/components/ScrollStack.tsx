import type { ReactNode } from 'react'

export function ScrollStackItem({
  children,
  itemClassName = '',
}: {
  children: ReactNode
  itemClassName?: string
}) {
  return (
    <article className={`scroll-stack-card ${itemClassName}`.trim()}>
      {children}
    </article>
  )
}

export default function ScrollStack({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`scroll-stack ${className}`.trim()}>
      <div className="scroll-stack-inner">{children}</div>
    </div>
  )
}
