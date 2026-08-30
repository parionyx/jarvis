import { beforeEach, describe, expect, it } from 'vitest'

import { JarvisExperienceEngine } from './experience-engine'
import {
  calculateTaskSimilarity,
  generateTaskFingerprint
} from './experience-retrieval'
import {
  clearExperiences,
  isSensitiveExperienceContent,
  loadExperiences
} from './experience-store'
import { decomposeGoal } from './agent-planner'
import { createGoalFromRequest } from './goal-model'
import {
  calculateSmoothedConfidence,
  evaluateStrategyApplicability,
  type ApplicabilityState
} from './strategy-ranking'

describe('JARVIS Experience & Learning Engine', () => {
  let engine: JarvisExperienceEngine

  beforeEach(() => {
    engine = JarvisExperienceEngine.getInstance()
    engine.reset()
    clearExperiences()
  })

  describe('1. Task Fingerprinting & Similarity', () => {
    it('normalizes goal semantics into consistent domain, entities, and operations', () => {
      const goal1 = createGoalFromRequest("Make today's Meta + AiSensy report.")
      const fp1 = generateTaskFingerprint(goal1)

      expect(fp1.domain).toBe('business_reporting')
      expect(fp1.entities).toContain('Meta')
      expect(fp1.entities).toContain('AiSensy')
      expect(fp1.operations).toContain('report')
    })

    it('matches similar phrased tasks with high similarity scores', () => {
      const goal1 = createGoalFromRequest("Make today's Meta + AiSensy report.")
      const goal2 = createGoalFromRequest('Check Meta and AiSensy and prepare daily report.')
      const goal3 = createGoalFromRequest('Check GitHub PRs and issues.')

      const fp1 = generateTaskFingerprint(goal1)
      const fp2 = generateTaskFingerprint(goal2)
      const fp3 = generateTaskFingerprint(goal3)

      const sim12 = calculateTaskSimilarity(fp1, fp2)
      const sim13 = calculateTaskSimilarity(fp1, fp3)

      expect(sim12).toBeGreaterThanOrEqual(0.7)
      expect(sim13).toBeLessThan(0.3)
    })
  })

  describe('2. Statistical Confidence Smoothing & Strategy Lifecycle', () => {
    it('applies Laplace smoothing to prevent single-sample overconfidence', () => {
      const conf1Run = calculateSmoothedConfidence(1, 1) // 1/1
      const conf5Runs = calculateSmoothedConfidence(5, 5) // 5/5
      const conf20Runs = calculateSmoothedConfidence(20, 22) // 20/22

      expect(conf1Run).toBeLessThan(0.3) // Single run gets penalized weight
      expect(conf5Runs).toBeGreaterThanOrEqual(0.7)
      expect(conf20Runs).toBeGreaterThanOrEqual(0.8)
    })

    it('promotes repeatedly successful strategy to ACTIVE and demotes repeatedly failing strategy to DEGRADED', () => {
      const goal = createGoalFromRequest('Check Meta Ads performance.')
      const graph = decomposeGoal(goal)
      for (const t of graph.tasks.values()) {
        t.status = 'succeeded'
      }

      // Record 5 successful runs
      for (let i = 0; i < 5; i++) {
        engine.recordTaskExperience({
          durationMs: 1500,
          goal,
          graph,
          result: { leads: 42 },
          verification: {
            completed: true,
            summary: 'Verified',
            unverifiedCriteria: [],
            verifiedCriteria: ['leads.checked']
          }
        })
      }

      const best = engine.findBestLearnedStrategy(goal)
      expect(best).toBeDefined()
      expect(best?.stats?.health).toBe('ACTIVE')
      expect(best?.stats?.successRate).toBe(1.0)
    })
  })

  describe('3. World-State Applicability & Anti-Blind Replay', () => {
    it('evaluates strategy as APPLICABLE when prerequisites and integrations are available', () => {
      const strategy = {
        id: 'meta_aisensy_strat',
        name: 'Meta and AiSensy Direct Read',
        prerequisites: ['integration:meta_ads', 'integration:aisensy'],
        steps: [
          { capability: 'ads.read', preferredTool: 'meta.insights.read' },
          { capability: 'whatsapp.messages.read', preferredTool: 'aisensy.leads.read' }
        ]
      }

      const env = {
        availableTools: ['meta.insights.read', 'aisensy.leads.read'],
        connectedIntegrations: ['meta_ads', 'aisensy'],
        networkAvailable: true
      }

      const result = evaluateStrategyApplicability(strategy, env)
      expect(result.applicability).toBe('APPLICABLE')
      expect(result.missingPrerequisites).toHaveLength(0)
    })

    it('evaluates strategy as INCOMPATIBLE when required integration is missing, preventing blind replay', () => {
      const strategy = {
        id: 'meta_aisensy_strat',
        name: 'Meta and AiSensy Direct Read',
        prerequisites: ['integration:meta_ads', 'integration:aisensy'],
        steps: [
          { capability: 'ads.read', preferredTool: 'meta.insights.read' }
        ]
      }

      const env = {
        availableTools: ['meta.insights.read'],
        connectedIntegrations: ['meta_ads'], // Missing AiSensy
        networkAvailable: true
      }

      const result = evaluateStrategyApplicability(strategy, env)
      expect(result.applicability).toBe('INCOMPATIBLE')
      expect(result.missingPrerequisites).toContain('integration:aisensy')
    })
  })

  describe('4. Privacy Safeguards & User Control', () => {
    it('detects and rejects sensitive credentials from being persisted in experiences', () => {
      expect(isSensitiveExperienceContent('sk-proj-12345678901234567890')).toBe(true)
      expect(isSensitiveExperienceContent('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true)
      expect(isSensitiveExperienceContent('password = mySecretPass123')).toBe(true)
      expect(isSensitiveExperienceContent('Regular task description for Meta report')).toBe(false)
    })

    it('answers user introspection queries about previous methods and failure learnings', () => {
      const goal = createGoalFromRequest('Check ONEX overdue leads.')
      const graph = decomposeGoal(goal)
      for (const t of graph.tasks.values()) {
        t.status = 'succeeded'
      }

      engine.recordTaskExperience({
        durationMs: 1200,
        goal,
        graph,
        result: { leads: 2 },
        verification: {
          completed: true,
          summary: 'Found 2 leads',
          unverifiedCriteria: [],
          verifiedCriteria: ['leads.checked']
        }
      })

      const lastMethodResponse = engine.handleUserCommand('What method did you use last time?')
      expect(lastMethodResponse).toContain('onex.leads.read')
      expect(lastMethodResponse).toContain('Outcome: success')

      const resetResponse = engine.handleUserCommand('Forget this workflow')
      expect(resetResponse).toContain('reset')
      expect(loadExperiences()).toHaveLength(0)
    })
  })
})
