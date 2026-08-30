import { beforeEach, describe, expect, it } from 'vitest'

import { JarvisAgentCore } from './agent-core'
import { decomposeGoal, replanOnFailure } from './agent-planner'
import { classifyFailure, verifyGoalCompletion } from './agent-verification'
import { getActiveTask } from './context-engine'
import { createGoalFromRequest } from './goal-model'
import { createTaskGraph, updateTaskStatus, type JarvisPlanTask } from './task-graph'

describe('JARVIS Phase 8: Reasoning & Agent Core', () => {
  let agentCore: JarvisAgentCore

  beforeEach(() => {
    agentCore = JarvisAgentCore.getInstance()
  })

  describe('1. Goal Understanding & Decomposition', () => {
    it('creates structured goal from natural user request', () => {
      const goal = createGoalFromRequest('Research 50 AI companies and export them to Excel', {
        activeProjectId: 'ONEX'
      })

      expect(goal.objective).toBe('Research 50 AI companies and export them to Excel')
      expect(goal.projectId).toBe('ONEX')
      expect(goal.successCriteria.length).toBeGreaterThanOrEqual(1)
      expect(goal.status).toBe('new')
    })

    it('decomposes complex goal into dependency-aware task graph', () => {
      const goal = createGoalFromRequest('Research 50 AI companies, compare them, and export to Excel')
      const graph = decomposeGoal(goal)

      expect(graph.tasks.size).toBe(3)
      expect(graph.executionStages.length).toBe(3)

      const stage1TaskId = graph.executionStages[0][0]
      const stage1Task = graph.tasks.get(stage1TaskId)!
      expect(stage1Task.toolId).toBe('web.research.adaptive')
    })

    it('decomposes single-step direct operation cleanly', () => {
      const goal = createGoalFromRequest('Open Chrome')
      const graph = decomposeGoal(goal)

      expect(graph.tasks.size).toBe(1)
      expect(graph.executionStages.length).toBe(1)
    })
  })

  describe('2. Task Graph Concurrency & Concurrency Safety', () => {
    it('serializes computer actions rather than running them simultaneously', () => {
      const tasks: JarvisPlanTask[] = [
        {
          dependencies: [],
          description: 'Click button A',
          goalId: 'g1',
          id: 't1',
          maxRetries: 2,
          requiredCapabilities: ['computer.mouse'],
          retryCount: 0,
          riskLevel: 'low',
          status: 'ready',
          timeoutMs: 5000,
          verificationState: { method: 'ui_change', verified: false }
        },
        {
          dependencies: [],
          description: 'Click button B',
          goalId: 'g1',
          id: 't2',
          maxRetries: 2,
          requiredCapabilities: ['computer.mouse'],
          retryCount: 0,
          riskLevel: 'low',
          status: 'ready',
          timeoutMs: 5000,
          verificationState: { method: 'ui_change', verified: false }
        }
      ]

      const graph = createTaskGraph(tasks)
      // Must be split into 2 sequential stages (not run in parallel)
      expect(graph.executionStages.length).toBe(2)
    })
  })

  describe('3. Verification & False Completion Prevention', () => {
    it('verifies goal completion when all tasks succeed', () => {
      const goal = createGoalFromRequest('Open Chrome')
      const graph = decomposeGoal(goal)

      for (const task of graph.tasks.values()) {
        updateTaskStatus(graph, task.id, 'succeeded', { app: 'Chrome', status: 'launched' })
      }

      const verification = verifyGoalCompletion(goal, graph)
      expect(verification.completed).toBe(true)
      expect(verification.summary).toContain('verified complete')
    })

    it('strictly prevents false completion when output verification fails', () => {
      const goal = createGoalFromRequest('Generate and save report to Desktop')
      const graph = decomposeGoal(goal)

      // Simulate a task failure
      const firstTaskId = Array.from(graph.tasks.keys())[0]
      updateTaskStatus(graph, firstTaskId, 'failed', undefined, 'File write permission denied')

      const verification = verifyGoalCompletion(goal, graph)
      expect(verification.completed).toBe(false)
      expect(verification.unverifiedCriteria.length).toBeGreaterThan(0)
    })
  })

  describe('4. Failure Classification & Dynamic Replanning', () => {
    it('classifies transient, recoverable, and blocked failures correctly', () => {
      const transient = classifyFailure('HTTP 504 Gateway Timeout')
      expect(transient.category).toBe('TRANSIENT')
      expect(transient.recommendedAction).toBe('retry')

      const recoverable = classifyFailure('Search provider unavailable: Anti-bot challenge')
      expect(recoverable.category).toBe('RECOVERABLE')
      expect(recoverable.recommendedAction).toBe('fallback')

      const blocked = classifyFailure('User confirmation required for destructive deletion')
      expect(blocked.category).toBe('BLOCKED')
      expect(blocked.recommendedAction).toBe('ask_user')
    })

    it('dynamically switches to fallback tool on recoverable failure', () => {
      const goal = createGoalFromRequest('Research 50 AI companies and export to Excel')
      const graph = decomposeGoal(goal)
      const firstTaskId = Array.from(graph.tasks.keys())[0]

      const replan = replanOnFailure(goal, graph, firstTaskId, 'Search provider unavailable: rate limit')
      expect(replan.revised).toBe(true)
      expect(replan.actionTaken).toBe('fallback_switched')

      const updatedTask = graph.tasks.get(firstTaskId)!
      expect(updatedTask.toolId).toBe('web.search.direct')
    })

    it('stops replanning when max plan revisions reached to prevent infinite loops', () => {
      const goal = createGoalFromRequest('Research 50 AI companies and export to Excel')
      goal.planVersion = 3 // Max reached
      const graph = decomposeGoal(goal)
      const firstTaskId = Array.from(graph.tasks.keys())[0]

      const replan = replanOnFailure(goal, graph, firstTaskId, 'Persistent failure')
      expect(replan.revised).toBe(false)
      expect(replan.actionTaken).toBe('failed')
    })
  })

  describe('5. Full Agent Core Execution Loop', () => {
    it('executes single-step goal end-to-end and checkpoints active task', async () => {
      const result = await agentCore.runGoal('Open Chrome')

      expect(result.success).toBe(true)
      expect(result.finalResponse).toContain('Chrome')

      const savedTask = getActiveTask()
      expect(savedTask).toBeDefined()
      expect(savedTask?.goal).toBe('Open Chrome')
    })

    it('executes multi-step research & export goal end-to-end', async () => {
      const result = await agentCore.runGoal('Research 50 AI companies, compare them, and export to Excel')

      expect(result.success).toBe(true)
      expect(result.finalResponse).toContain('report')
      expect(result.graph.tasks.size).toBe(3)
    })

    it('aborts goal cleanly on emergency cancellation', async () => {
      const abortController = new AbortController()
      abortController.abort()

      const result = await agentCore.runGoal('Research 50 AI companies', {
        abortSignal: abortController.signal
      })

      expect(result.goal.status).toBe('cancelled')
      expect(result.finalResponse).toContain('cancelled')
    })
  })
})
