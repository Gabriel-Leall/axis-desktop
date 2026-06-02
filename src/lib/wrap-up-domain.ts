import type { Task } from '@/store/tasks-store'

export function getTomorrowISO(date = new Date()): string {
  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yyyy = tomorrow.getFullYear()
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const dd = String(tomorrow.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function splitWrapUpTasks(tasks: Task[]) {
  const completed = tasks.filter(
    task => task.status === 'done' || !!task.completed_at
  )
  const open = tasks.filter(
    task => task.status !== 'done' && !task.completed_at
  )

  return { completed, open }
}
