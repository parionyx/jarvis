/**
 * JARVIS Phase 8: Goal Model
 * Structured representation of user goals, objectives, constraints, and status lifecycle.
 */

export type GoalStatus =
  | 'new'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface JarvisGoal {
  completedAt?: number
  constraints?: string[]
  createdAt: number
  entities?: string[]
  id: string
  objective: string
  originalRequest: string
  planVersion: number
  preferences?: string[]
  projectId?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  status: GoalStatus
  successCriteria: string[]
  updatedAt: number
}

/**
 * Creates a structured JarvisGoal from a raw user request.
 */
export function createGoalFromRequest(
  request: string,
  context?: { activeProjectId?: string; preferences?: string[] }
): JarvisGoal {
  const trimmed = request.trim()
  const lower = trimmed.toLowerCase()
  const now = Date.now()
  const id = `goal_${now}_${Math.random().toString(36).slice(2, 8)}`

  // Extract entities & project references
  const entities: string[] = []
  let projectId = context?.activeProjectId

  if (/\bonex\b/i.test(lower)) {
    projectId = 'ONEX'
    entities.push('ONEX')
  } else if (/\bhermes\b/i.test(lower)) {
    projectId = 'Hermes'
    entities.push('Hermes')
  }

  // Derive explicit success criteria based on request semantics
  const successCriteria: string[] = []
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

  if (/\b(?:delete|remove|erase)\b/i.test(lower)) {
    riskLevel = 'high'
    successCriteria.push('Target items safely removed with verification')
  } else if (/\b(?:export|save|create\s+excel|generate\s+report)\b/i.test(lower)) {
    successCriteria.push('Output report file created and readable on disk')
  } else if (/\b(?:research|compare|find\s+\d+)\b/i.test(lower)) {
    successCriteria.push('Evidence-backed candidates discovered and structured')
  } else if (/\b(?:open|launch|start)\s+(?:chrome|vs\s*code|notepad)\b/i.test(lower)) {
    successCriteria.push('Target application process launched and focused')
  } else {
    successCriteria.push('Operation completed and output verified')
  }

  return {
    constraints: [],
    createdAt: now,
    entities,
    id,
    objective: trimmed,
    originalRequest: trimmed,
    planVersion: 1,
    preferences: context?.preferences || [],
    projectId,
    riskLevel,
    status: 'new',
    successCriteria,
    updatedAt: now
  }
}

/**
 * Updates the lifecycle status of a goal.
 */
export function updateGoalStatus(goal: JarvisGoal, status: GoalStatus): JarvisGoal {
  const now = Date.now()
  return {
    ...goal,
    completedAt: status === 'completed' || status === 'failed' || status === 'cancelled' ? now : goal.completedAt,
    status,
    updatedAt: now
  }
}
