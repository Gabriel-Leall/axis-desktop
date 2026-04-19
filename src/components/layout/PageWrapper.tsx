import { motion } from 'motion/react'
import { pageVariants } from '@/lib/motion-tokens'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="h-full w-full"
    >
      {children}
    </motion.div>
  )
}
