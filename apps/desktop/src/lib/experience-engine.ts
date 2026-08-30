/**
 * JARVIS Phase: Experience & Learning Engine Orchestrator
 * Connects execution history, task similarity, world-state verification,
 * confidence-weighted strategy ranking, and dynamic strategy lifecycle management.
 */

import type { GoalVerificationResult } from './agent-verification'
import type { JarvisLiveContext } from './context-engine'
import {
  retrieveRelevantExperiences
} from './experience-retrieval'
import {
  clearExperiences,
  loadExperiences,
  loadStrategyStats,
  saveExperience,
  saveStrategyStats,
  type JarvisEnvironmentSnapshot,
  type JarvisExperience,
  type JarvisStrategy,
  type StrategyHealth,
  type StrategyStats
} from './experience-store'
import type { JarvisGoal } from './goal-model'
import {
  calculateSmoothedConfidence,
  rankStrategyCandidates,
  type RankedStrategyCandidate
} from './strategy-ranking'
import type { JarvisTaskGraph } from './task-graph'
import { JarvisIntegrationRegistry } from './integration-registry'
import { JarvisToolRegistry } from './tool-registry'

export class JarvisExperienceEngine {
  private static instance: JarvisExperienceEngine | null = null
  private toolRegistry: JarvisToolRegistry
  private integrationRegistry: JarvisIntegrationRegistry
  private statsMap: Map<string, StrategyStats> = new Map()

  private constructor(
    toolRegistry = JarvisToolRegistry.getInstance(),
    integrationRegistry = JarvisIntegrationRegistry.getInstance()
  ) {
    this.toolRegistry = toolRegistry
    this.integrationRegistry = integrationRegistry
    this.statsMap = loadStrategyStats()
  }

  public static getInstance(): JarvisExperienceEngine {
    if (!JarvisExperienceEngine.instance) {
      JarvisExperienceEngine.instance = new JarvisExperienceEngine()
    }
    return JarvisExperienceEngine.instance
  }

  /**
   * Captures the current world state snapshot.
   */
  public captureCurrentEnvironment(liveContext?: JarvisLiveContext): JarvisEnvironmentSnapshot {
    const availableTools = this.toolRegistry
      .list()
      .filter(t => t.availability === 'available')
      .map(t => t.id)

    const connectedIntegrations = this.integrationRegistry
      .listIntegrations()
      .filter(i => i.availability === 'available')
      .map(i => i.id)

    return {
      activeApp: liveContext?.activeApp,
      activeProject: liveContext?.activeProject,
      activeWindow: liveContext?.activeWindow,
      availableTools,
      connectedIntegrations,
      currentFiles: liveContext?.currentFiles,
      networkAvailable: true
    }
  }

  /**
   * Finds the best learned strategy for a goal if an applicable high-confidence strategy exists.
   */
  public findBestLearnedStrategy(
    goal: JarvisGoal,
    liveContext?: JarvisLiveContext
  ): RankedStrategyCandidate | null {
    const currentEnv = this.captureCurrentEnvironment(liveContext)
    const candidates = retrieveRelevantExperiences(goal, currentEnv)

    if (candidates.length === 0) return null

    const ranked = rankStrategyCandidates(candidates, currentEnv, this.statsMap)
    const best = ranked[0]

    // Only recommend if applicable, high score, and positive historical outcome
    if (
      best &&
      (best.applicability === 'APPLICABLE' || best.applicability === 'PARTIALLY_APPLICABLE') &&
      best.score >= 50 &&
      best.experience.outcome === 'success'
    ) {
      return best
    }

    return null
  }

  /**
   * Records a completed task execution outcome, updates strategy stats, and performs root-cause diagnostics.
   */
  public recordTaskExperience(params: {
    durationMs: number
    goal: JarvisGoal
    graph: JarvisTaskGraph
    liveContext?: JarvisLiveContext
    result: unknown
    verification: GoalVerificationResult
  }): JarvisExperience | null {
    const { goal, graph, verification, durationMs, liveContext, result } = params

    // 1. Build strategy definition from executed task graph
    const steps = Array.from(graph.tasks.values()).map(task => ({
      capability: task.toolId || 'action',
      expectedOutcome: task.description,
      fallbackTools: [],
      preferredTool: task.toolId
    }))

    const strategyId = `strat_${goal.objective.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32)}`
    const strategy: JarvisStrategy = {
      estimatedDurationMs: durationMs,
      id: strategyId,
      name: `Strategy for: ${goal.objective}`,
      prerequisites: goal.projectId ? [`integration:${goal.projectId}`] : [],
      steps
    }

    // 2. Classify outcome
    const isSuccess = verification.completed
    const outcome = isSuccess ? 'success' : 'failure'

    // 3. Update strategy statistics
    let stats = this.statsMap.get(strategyId)
    if (!stats) {
      stats = {
        attempts: 0,
        averageDurationMs: durationMs,
        cancellations: 0,
        confidence: 0.3,
        failures: 0,
        health: 'PROMISING',
        partialSuccesses: 0,
        recentSuccessRate: isSuccess ? 1.0 : 0.0,
        strategyId,
        successRate: isSuccess ? 1.0 : 0.0,
        successes: 0
      }
    }

    stats.attempts++
    if (isSuccess) {
      stats.successes++
      stats.lastSuccessAt = Date.now()
    } else {
      stats.failures++
      stats.lastFailureAt = Date.now()
      stats.lastFailureReason = verification.failureReason || 'Verification criteria failed'
    }

    stats.successRate = Number((stats.successes / stats.attempts).toFixed(2))
    stats.confidence = calculateSmoothedConfidence(stats.successes, stats.attempts)
    stats.averageDurationMs = Math.round((stats.averageDurationMs + durationMs) / 2)

    // Strategy Health Lifecycle
    if (stats.attempts >= 3 && stats.successRate < 0.4) {
      stats.health = 'DEGRADED'
    } else if (stats.attempts >= 5 && stats.successRate >= 0.8) {
      stats.health = 'ACTIVE'
    }

    this.statsMap.set(strategyId, stats)
    saveStrategyStats(this.statsMap)

    // 4. Create and persist experience
    const experience: JarvisExperience = {
      capabilities: steps.map(s => s.capability),
      confidence: stats.confidence,
      createdAt: Date.now(),
      durationMs,
      entityIds: goal.projectId ? [goal.projectId] : [],
      environment: this.captureCurrentEnvironment(liveContext),
      failureReason: !isSuccess ? stats.lastFailureReason : undefined,
      goalDescription: goal.objective,
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      lastUsedAt: Date.now(),
      outcome,
      projectId: goal.projectId,
      sourceTaskId: goal.id,
      strategy,
      successScore: isSuccess ? 100 : 0,
      taskPattern: goal.objective,
      verification: {
        details: verification.summary,
        evidence: result,
        verified: verification.completed
      }
    }

    saveExperience(experience)
    return experience
  }

  /**
   * Introspection & user natural language query handler.
   */
  public handleUserCommand(command: string): string {
    const lower = command.toLowerCase()

    if (lower.includes('last time') || lower.includes('previous strategy') || lower.includes('method did you use')) {
      const all = loadExperiences()
      if (all.length === 0) return 'No previous task executions recorded in experience memory.'
      const last = all[all.length - 1]
      return `Last executed strategy for "${last.goalDescription}": used ${last.strategy.steps.map(s => s.preferredTool || s.capability).join(' -> ')} (Outcome: ${last.outcome}, Duration: ${Math.round(last.durationMs / 1000)}s).`
    }

    if (lower.includes('learn from the failure') || lower.includes('why did it fail')) {
      const all = loadExperiences().filter(e => e.outcome === 'failure')
      if (all.length === 0) return 'No recent failures recorded.'
      const lastFailed = all[all.length - 1]
      return `Last failure on "${lastFailed.goalDescription}": Root cause was "${lastFailed.failureReason}". Future executions will avoid this path.`
    }

    if (lower.includes('forget this workflow') || lower.includes('reset learning') || lower.includes("don't learn")) {
      clearExperiences()
      this.statsMap.clear()
      return 'Experience history and learned strategy statistics have been reset.'
    }

    return 'Experience engine is active.'
  }

  /**
   * Clears experience store and stats for clean testing.
   */
  public reset(): void {
    clearExperiences()
    this.statsMap.clear()
  }
}
