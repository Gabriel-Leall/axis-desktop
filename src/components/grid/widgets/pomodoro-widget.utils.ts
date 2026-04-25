export function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.floor(Math.max(0, seconds) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function normalizeCycleTotal(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1
  return Math.floor(total)
}

export function getCycleProgress(completed: number, total: number): number {
  const safeTotal = normalizeCycleTotal(total)
  const progress = completed % safeTotal
  return progress === 0 ? safeTotal : progress
}
