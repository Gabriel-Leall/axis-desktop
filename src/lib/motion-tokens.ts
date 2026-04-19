export const transitions = {
  enter: { type: 'spring', stiffness: 400, damping: 30 },
  layout: { type: 'spring', stiffness: 300, damping: 35 },
  snap: { type: 'spring', stiffness: 600, damping: 40 },
  fade: { duration: 0.15, ease: 'easeOut' },
}

export const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04 },
  }),
  exit: { opacity: 0, x: -10 },
}

export const pageVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}
