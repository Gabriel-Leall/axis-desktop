import { LazyMotion, domAnimation, m } from 'motion/react'
import { pageVariants } from '@/lib/motion-tokens'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="h-full w-full"
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
