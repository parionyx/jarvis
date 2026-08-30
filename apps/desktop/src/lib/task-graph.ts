/**
 * JARVIS Phase 8: Task Graph & Decomposition
 * Dependency-aware DAG planning, parallel/sequential stage derivation,
 * and concurrency safety.
 */

export type TaskStatus =
  | 'planning'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'cancelled'
  | 'retrying'

export interface JarvisPlanTask {
  dependencies: string[] // Task IDs that must succeed before this task runs
  description: string
  error?: string
  goalId: string
  id: string
  maxRetries: number
  parallelGroup?: string
  requiredCapabilities: string[]
  result?: unknown
  retryCount: number
  riskLevel: 'read' | 'low' | 'medium' | 'high' | 'critical'
  status: TaskStatus
  timeoutMs: number
  toolArguments?: Record<string, unknown>
  toolId?: string
  verificationState: {
    details?: string
    method: string
    verified: boolean
  }
}

export interface JarvisTaskGraph {
  executionStages: string[][] // Sequential stages of parallel task IDs
  tasks: Map<string, JarvisPlanTask>
}

/**
 * Builds a validated dependency-aware task graph with sequential stages.
 */
export function createTaskGraph(tasks: JarvisPlanTask[]): JarvisTaskGraph {
  const taskMap = new Map<string, JarvisPlanTask>()
  for (const t of tasks) {
    taskMap.set(t.id, { ...t })
  }

  // Derive topological execution stages
  const executionStages: string[][] = []
  const remaining = new Set(tasks.map(t => t.id))
  const completed = new Set<string>()

  // Safeguard against infinite loops in cyclic dependencies
  let iterations = 0
  const maxIterations = tasks.length + 5

  while (remaining.size > 0 && iterations < maxIterations) {
    iterations++
    const currentStage: string[] = []

    for (const id of remaining) {
      const task = taskMap.get(id)!
      const allDepsMet = task.dependencies.every(depId => completed.has(depId))

      if (allDepsMet) {
        currentStage.push(id)
      }
    }

    if (currentStage.length === 0) {
      // Unresolved dependencies / cycle fallback
      const fallbackId = Array.from(remaining)[0]
      currentStage.push(fallbackId)
    }

    // Safety rule: Do not run simultaneous mouse/keyboard/computer tasks in parallel
    const hasComputerAction = currentStage.some(id => {
      const t = taskMap.get(id)!
      return t.requiredCapabilities.some(c => c.startsWith('computer.'))
    })

    if (hasComputerAction && currentStage.length > 1) {
      // Serialize computer actions into individual 1-task stages
      for (const singleId of currentStage) {
        executionStages.push([singleId])
        remaining.delete(singleId)
        completed.add(singleId)
      }
    } else {
      executionStages.push(currentStage)
      for (const id of currentStage) {
        remaining.delete(id)
        completed.add(id)
      }
    }
  }

  return {
    executionStages,
    tasks: taskMap
  }
}

/**
 * Returns tasks ready for execution (all dependencies succeeded).
 */
export function getReadyTasks(graph: JarvisTaskGraph): JarvisPlanTask[] {
  const ready: JarvisPlanTask[] = []

  for (const task of graph.tasks.values()) {
    if (task.status === 'planning' || task.status === 'ready' || task.status === 'waiting') {
      const allDepsMet = task.dependencies.every(depId => {
        const depTask = graph.tasks.get(depId)
        return depTask && depTask.status === 'succeeded'
      })

      if (allDepsMet) {
        ready.push(task)
      }
    }
  }

  return ready
}

/**
 * Updates status of a task in the graph.
 */
export function updateTaskStatus(
  graph: JarvisTaskGraph,
  taskId: string,
  status: TaskStatus,
  result?: unknown,
  error?: string
): void {
  const task = graph.tasks.get(taskId)
  if (task) {
    task.status = status
    if (result !== undefined) task.result = result
    if (error !== undefined) task.error = error
    if (status === 'succeeded') {
      task.verificationState.verified = true
    }
  }
}

/**
 * Checks if all tasks in graph have succeeded.
 */
export function isGraphComplete(graph: JarvisTaskGraph): boolean {
  for (const task of graph.tasks.values()) {
    if (task.status !== 'succeeded') {
      return false
    }
  }
  return graph.tasks.size > 0
}

/**
 * Checks if any task in graph has permanently failed.
 */
export function hasFailedTasks(graph: JarvisTaskGraph): boolean {
  for (const task of graph.tasks.values()) {
    if (task.status === 'failed') {
      return true
    }
  }
  return false
}
