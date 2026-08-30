/**
 * JARVIS Experience & Learning Engine: Strategy Ranking & World State Applicability
 * Validates prerequisites against current environment, computes Laplace-smoothed
 * Bayesian confidence, and ranks strategy candidates.
 */

import {
  type JarvisEnvironmentSnapshot,
  type JarvisExperience,
  type JarvisStrategy,
  type StrategyStats
} from './experience-store'

export type ApplicabilityState = 'APPLICABLE' | 'PARTIALLY_APPLICABLE' | 'STALE' | 'INCOMPATIBLE'

export interface RankedStrategyCandidate {
  applicability: ApplicabilityState
  confidence: number
  experience: JarvisExperience
  explanation: string
  score: number
  similarity: number
  stats?: StrategyStats
  strategy: JarvisStrategy
}

/**
 * Calculates Laplace-smoothed confidence based on historical attempts and successes.
 */
export function calculateSmoothedConfidence(successes: number, attempts: number): number {
  if (attempts <= 0) return 0.2

  const baseRate = (successes + 1) / (attempts + 2)
  const sampleWeight = Math.min(1.0, attempts / 5) // Requires at least 5 attempts for full weight

  return Number((baseRate * sampleWeight).toFixed(3))
}

/**
 * Evaluates whether a strategy's prerequisites are satisfied by the current world state.
 */
export function evaluateStrategyApplicability(
  strategy: JarvisStrategy,
  currentEnv?: JarvisEnvironmentSnapshot
): { applicability: ApplicabilityState; missingPrerequisites: string[] } {
  if (!currentEnv) {
    return { applicability: 'APPLICABLE', missingPrerequisites: [] }
  }

  const missingPrerequisites: string[] = []

  // 1. Check explicit prerequisites
  if (strategy.prerequisites) {
    for (const prereq of strategy.prerequisites) {
      const lower = prereq.toLowerCase()
      if (
        lower.includes('integration') ||
        lower.includes('meta') ||
        lower.includes('aisensy') ||
        lower.includes('supabase') ||
        lower.includes('gmail') ||
        lower.includes('calendar') ||
        lower.includes('github') ||
        lower.includes('onex')
      ) {
        const matchesIntegration = currentEnv.connectedIntegrations.some(i =>
          lower.includes(i.toLowerCase())
        )
        if (!matchesIntegration) {
          missingPrerequisites.push(prereq)
        }
      }
    }
  }

  // 2. Check required tool availability in steps
  let availableStepCount = 0
  for (const step of strategy.steps) {
    if (step.preferredTool) {
      const toolAvailable = currentEnv.availableTools.includes(step.preferredTool)
      if (toolAvailable) {
        availableStepCount++
      } else if (step.fallbackTools && step.fallbackTools.length > 0) {
        const hasFallback = step.fallbackTools.some(ft => currentEnv.availableTools.includes(ft))
        if (hasFallback) availableStepCount++
      }
    } else {
      availableStepCount++
    }
  }

  if (missingPrerequisites.length > 0) {
    return { applicability: 'INCOMPATIBLE', missingPrerequisites }
  }

  if (strategy.steps.length > 0 && availableStepCount === 0) {
    return {
      applicability: 'INCOMPATIBLE',
      missingPrerequisites: ['No available tools for strategy steps']
    }
  }

  if (availableStepCount < strategy.steps.length) {
    return { applicability: 'PARTIALLY_APPLICABLE', missingPrerequisites: [] }
  }

  return { applicability: 'APPLICABLE', missingPrerequisites: [] }
}

/**
 * Ranks candidate experiences by task similarity, confidence, success rate, and applicability.
 */
export function rankStrategyCandidates(
  candidates: Array<{ experience: JarvisExperience; similarity: number }>,
  currentEnv?: JarvisEnvironmentSnapshot,
  statsMap?: Map<string, StrategyStats>
): RankedStrategyCandidate[] {
  const ranked: RankedStrategyCandidate[] = []

  for (const { experience, similarity } of candidates) {
    const strategy = experience.strategy
    const stats = statsMap?.get(strategy.id)

    const { applicability, missingPrerequisites } = evaluateStrategyApplicability(
      strategy,
      currentEnv
    )
    const confidence = stats
      ? calculateSmoothedConfidence(stats.successes, stats.attempts)
      : experience.confidence || 0.5
    const successRate = stats ? stats.successRate : experience.outcome === 'success' ? 1.0 : 0.0

    // Multi-factor scoring
    let score = similarity * 35 + successRate * 25 + confidence * 20

    if (applicability === 'APPLICABLE') {
      score += 20
    } else if (applicability === 'PARTIALLY_APPLICABLE') {
      score += 5
    } else {
      score -= 40
    }

    if (stats?.health === 'DEGRADED') score -= 30
    if (stats?.health === 'DISABLED') score -= 60
    if (stats?.lastFailureReason) score -= 15

    let explanation = `Ranked strategy "${strategy.name}" (Score: ${Math.round(score)}). `
    if (applicability === 'INCOMPATIBLE') {
      explanation += `Incompatible with current environment due to missing: ${missingPrerequisites.join(', ')}.`
    } else if (confidence >= 0.7) {
      explanation += `High historical confidence (${Math.round(confidence * 100)}%) with ${stats?.attempts || 1} previous runs.`
    }

    ranked.push({
      applicability,
      confidence,
      experience,
      explanation,
      score,
      similarity,
      stats,
      strategy
    })
  }

  return ranked.sort((a, b) => b.score - a.score)
}
