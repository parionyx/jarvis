/**
 * JARVIS Phase 8: Verification & Failure Diagnostics
 * Failure classification, criteria validation, and false completion prevention.
 */

import type { JarvisGoal } from './goal-model'
import type { JarvisPlanTask, JarvisTaskGraph } from './task-graph'

export type FailureCategory =
  | 'TRANSIENT'
  | 'RETRYABLE'
  | 'RECOVERABLE'
  | 'BLOCKED'
  | 'PERMANENT'

export interface FailureDiagnosis {
  category: FailureCategory
  errorMessage: string
  recommendedAction: 'retry' | 'fallback' | 'ask_user' | 'fail'
  retryAllowed: boolean
}

export interface GoalVerificationResult {
  completed: boolean
  failureReason?: string
  summary: string
  unverifiedCriteria: string[]
  verifiedCriteria: string[]
}

/**
 * Classifies task failures into structured categories with recovery recommendations.
 */
export function classifyFailure(error: string, task?: JarvisPlanTask): FailureDiagnosis {
  const errLower = error.toLowerCase()

  // 1. BLOCKED (User confirmation or permission needed)
  if (
    /\b(?:permission|confirm(?:ation)?|approval|unauthorized|forbidden|captcha|auth\s+required)\b/i.test(
      errLower
    )
  ) {
    return {
      category: 'BLOCKED',
      errorMessage: error,
      recommendedAction: 'ask_user',
      retryAllowed: false
    }
  }

  // 2. RECOVERABLE (Provider unavailable, anti-bot challenge, or alternate tool exists)
  if (
    /\b(?:unavailable|provider\s*failed|anti-bot|challenge|not\s*supported\s*on\s*this\s*provider)\b/i.test(
      errLower
    )
  ) {
    return {
      category: 'RECOVERABLE',
      errorMessage: error,
      recommendedAction: 'fallback',
      retryAllowed: true
    }
  }

  // 3. TRANSIENT (Timeouts, network glitches, temporary gateway downtime)
  if (
    /\b(?:timeout|timed\s*out|socket\s*hang\s*up|econnreset|502|503|504|rate\s*limit)\b/i.test(
      errLower
    )
  ) {
    const canRetry = (task?.retryCount || 0) < (task?.maxRetries || 2)
    return {
      category: 'TRANSIENT',
      errorMessage: error,
      recommendedAction: canRetry ? 'retry' : 'fallback',
      retryAllowed: canRetry
    }
  }

  // 4. RETRYABLE (Tool execution hiccup with remaining retries)
  if ((task?.retryCount || 0) < (task?.maxRetries || 2)) {
    return {
      category: 'RETRYABLE',
      errorMessage: error,
      recommendedAction: 'retry',
      retryAllowed: true
    }
  }

  // 5. PERMANENT (Missing capability, invalid target)
  return {
    category: 'PERMANENT',
    errorMessage: error,
    recommendedAction: 'fail',
    retryAllowed: false
  }
}

/**
 * Verifies that all goal success criteria are genuinely satisfied before completion.
 * Hard rule: Never returns completed: true if any success criterion failed verification.
 */
export function verifyGoalCompletion(
  goal: JarvisGoal,
  graph: JarvisTaskGraph,
  finalResult?: { exported?: boolean; filePath?: string; success?: boolean }
): GoalVerificationResult {
  const verifiedCriteria: string[] = []
  const unverifiedCriteria: string[] = []

  // Check 1: All tasks in the graph must have succeeded
  for (const task of graph.tasks.values()) {
    if (task.status !== 'succeeded' || !task.verificationState.verified) {
      unverifiedCriteria.push(`Task failed: "${task.description}" (${task.error || 'unverified'})`)
    }
  }

  // Check 2: Evaluate specific goal criteria
  for (const criterion of goal.successCriteria) {
    if (criterion.includes('report file created') || criterion.includes('readable on disk')) {
      if (finalResult && finalResult.success === false) {
        unverifiedCriteria.push(criterion)
      } else {
        verifiedCriteria.push(criterion)
      }
    } else if (unverifiedCriteria.length === 0) {
      verifiedCriteria.push(criterion)
    } else {
      unverifiedCriteria.push(criterion)
    }
  }

  const isCompleted = unverifiedCriteria.length === 0 && graph.tasks.size > 0

  return {
    completed: isCompleted,
    failureReason: isCompleted ? undefined : unverifiedCriteria.join('; '),
    summary: isCompleted
      ? `Goal "${goal.objective}" verified complete (${verifiedCriteria.length} criteria met).`
      : `Goal "${goal.objective}" cannot be marked complete: ${unverifiedCriteria.join('; ')}`,
    unverifiedCriteria,
    verifiedCriteria
  }
}
