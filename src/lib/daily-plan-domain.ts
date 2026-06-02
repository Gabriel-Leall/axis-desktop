export interface DailyPlanTaskCandidate {
  id: string
  title: string
  priority: string
  status: string
  due_date?: string | null
  completed_at?: string | null
  sort_order: number
  created_at: string
}

function priorityScore(priority: string): number {
  switch (priority) {
    case 'high':
      return 30
    case 'medium':
      return 15
    case 'low':
      return 0
    default:
      return 0
  }
}

function dueDateScore(
  dueDate: string | null | undefined,
  todayISO: string
): number {
  if (!dueDate) return 5
  if (dueDate < todayISO) return 40
  if (dueDate === todayISO) return 25
  return 0
}

export function scoreTaskForDailyPlan(
  task: DailyPlanTaskCandidate,
  todayISO: string
): number {
  if (task.status === 'done' || task.completed_at) {
    return Number.NEGATIVE_INFINITY
  }

  const statusScore = task.status === 'in_progress' ? 50 : 0
  return (
    statusScore +
    priorityScore(task.priority) +
    dueDateScore(task.due_date, todayISO)
  )
}

export function selectDailyPlanFocus(
  tasks: DailyPlanTaskCandidate[],
  todayISO: string
): DailyPlanTaskCandidate | null {
  const candidates = tasks.filter(
    task => task.status !== 'done' && !task.completed_at
  )

  if (candidates.length === 0) {
    return null
  }

  const sortedCandidates = [...candidates].sort((left, right) => {
    const scoreDelta =
      scoreTaskForDailyPlan(right, todayISO) -
      scoreTaskForDailyPlan(left, todayISO)

    if (scoreDelta !== 0) {
      return scoreDelta
    }

    const leftDue = left.due_date ?? '9999-12-31'
    const rightDue = right.due_date ?? '9999-12-31'
    if (leftDue !== rightDue) {
      return leftDue.localeCompare(rightDue)
    }

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    return left.created_at.localeCompare(right.created_at)
  })

  return sortedCandidates[0] ?? null
}
