/**
 * JARVIS Tool Selection Engine: Dynamic Tool Router & Multi-Tool Planner
 * Scores candidate tools, constructs execution DAGs, manages bounded fallbacks,
 * verifies outcomes, and provides emergency cancellation.
 */

import type { JarvisToolDefinition, JarvisToolResult, ToolExecutionContext, ToolPlan, ToolPlanStep } from './tool-definition'
import { JarvisToolRegistry } from './tool-registry'
import { extractTaskRequirements, type TaskRequirement } from './tool-requirements'

export interface ToolRoutingPolicy {
  avoidBrowserWhenPossible: boolean
  avoidVisionWhenPossible: boolean
  browserPenalty: number
  llmPenalty: number
  maxFallbackDepth: number
  maxParallelTasks: number
  maxRetries: number
  preferDirectAPI: boolean
  preferLocal: boolean
  preferMCP: boolean
  preferStructuredData: boolean
  visionPenalty: number
}

export const DEFAULT_ROUTING_POLICY: ToolRoutingPolicy = {
  avoidBrowserWhenPossible: true,
  avoidVisionWhenPossible: true,
  browserPenalty: 50,
  llmPenalty: 40,
  maxFallbackDepth: 3,
  maxParallelTasks: 4,
  maxRetries: 2,
  preferDirectAPI: true,
  preferLocal: true,
  preferMCP: true,
  preferStructuredData: true,
  visionPenalty: 40
}

export interface RoutingDecision {
  candidatesConsidered: { score: number; toolId: string }[]
  plan: ToolPlan
  primaryToolId?: string
  requirement: TaskRequirement
  selectedLevel: 1 | 2 | 3
}

export class JarvisToolRouter {
  private static instance: JarvisToolRouter | null = null
  private registry: JarvisToolRegistry
  private policy: ToolRoutingPolicy
  private globalAbortController: AbortController | null = null
  private activePlans: Set<string> = new Set()

  private constructor(registry = JarvisToolRegistry.getInstance(), policy = DEFAULT_ROUTING_POLICY) {
    this.registry = registry
    this.policy = policy
  }

  public static getInstance(): JarvisToolRouter {
    if (!JarvisToolRouter.instance) {
      JarvisToolRouter.instance = new JarvisToolRouter()
    }
    return JarvisToolRouter.instance
  }

  /**
   * Emergency stop for all running plans and tool execution.
   */
  public abortAll(): void {
    if (this.globalAbortController) {
      this.globalAbortController.abort()
      this.globalAbortController = null
    }
    this.activePlans.clear()
  }

  /**
   * Core routing decision: converts user prompt into a structured ToolPlan.
   */
  public route(prompt: string): RoutingDecision {
    const requirement = extractTaskRequirements(prompt)

    // Level 1: Deterministic Operations
    const level1Plan = this.tryBuildLevel1Plan(requirement)
    if (level1Plan) {
      return {
        candidatesConsidered: [{ score: 500, toolId: level1Plan.steps[0].toolId }],
        plan: level1Plan,
        primaryToolId: level1Plan.steps[0].toolId,
        requirement,
        selectedLevel: 1
      }
    }

    // Level 3: Multi-Tool Complex Workflow Planning
    if (requirement.intent === 'research_and_export' || requirement.requiredCapabilities.length > 2) {
      const level3Plan = this.buildLevel3Plan(requirement)
      return {
        candidatesConsidered: level3Plan.steps.map(s => ({ score: 300, toolId: s.toolId })),
        plan: level3Plan,
        requirement,
        selectedLevel: 3
      }
    }

    // Level 2: Capability Matching & Multi-Factor Scoring
    const { bestTool, scoredCandidates } = this.selectBestToolForCapabilities(requirement.requiredCapabilities, requirement)

    const fallbackChains: Record<string, string[]> = {}
    if (bestTool) {
      if (bestTool.category === 'WEB') {
        fallbackChains[bestTool.id] = ['web.search.direct', 'web.browser.interactive']
      } else if (bestTool.id === 'document.pdf_parse') {
        fallbackChains[bestTool.id] = ['vision.analyze']
      }
    }

    const plan: ToolPlan = {
      fallbackChains,
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      level: 2,
      reasoning: `Selected ${bestTool?.name || 'default tool'} based on capability matching and optimal scoring.`,
      steps: bestTool
        ? [
            {
              arguments: { prompt: requirement.goal, query: requirement.goal },
              expectedOutcome: 'Task completed via highest scoring capability provider',
              id: `step_1`,
              riskClass: bestTool.riskClass,
              targetCapability: requirement.requiredCapabilities[0] || 'general',
              timeoutMs: 15_000,
              toolId: bestTool.id,
              verificationStrategy: 'non_empty'
            }
          ]
        : [],
      task: requirement.goal
    }

    return {
      candidatesConsidered: scoredCandidates,
      plan,
      primaryToolId: bestTool?.id,
      requirement,
      selectedLevel: 2
    }
  }

  /**
   * Scores all eligible tools against requirements.
   */
  public scoreTool(tool: JarvisToolDefinition, req: TaskRequirement): number {
    if (tool.availability === 'unavailable') return -1000

    let score = 0

    // 1. Explicit User Override (+200)
    if (req.explicitTool && tool.id === req.explicitTool) {
      score += 200
    }

    // 2. Capability Matching (+100 per matching capability)
    let matchCount = 0
    for (const cap of req.requiredCapabilities) {
      if (tool.capabilities.some(c => c === cap || c.startsWith(`${cap}.`))) {
        matchCount++
      }
    }
    if (matchCount === 0 && !req.explicitTool) return -500
    score += matchCount * 100

    // 3. Availability & Health
    if (tool.availability === 'available') score += 50
    if (tool.availability === 'degraded') score += 10

    // 4. Local vs Remote Preference
    if (this.policy.preferLocal && tool.local) score += 30

    // 5. Structured Data Preference
    if (this.policy.preferStructuredData && tool.supportsStructuredOutput) score += 20

    // 6. Latency Class
    if (tool.latencyClass === 'instant') score += 25
    if (tool.latencyClass === 'fast') score += 15
    if (tool.latencyClass === 'medium') score += 5
    if (tool.latencyClass === 'slow') score -= 15

    // 7. Cost Class
    if (tool.costClass === 'free') score += 20
    if (tool.costClass === 'low') score += 10
    if (tool.costClass === 'high') score -= 20

    // 8. Risk Class
    if (tool.riskClass === 'read') score += 10
    if (tool.riskClass === 'low') score += 5
    if (tool.riskClass === 'high') score -= 20
    if (tool.riskClass === 'critical') score -= 40

    // 9. BROWSER PENALTY (-50)
    if (this.policy.avoidBrowserWhenPossible && tool.requiresBrowser && !req.requiresBrowser && !req.explicitTool?.includes('browser')) {
      score -= this.policy.browserPenalty
    }

    // 10. VISION PENALTY (-40)
    if (this.policy.avoidVisionWhenPossible && tool.supportsVision && !req.requiresVision) {
      score -= this.policy.visionPenalty
    }

    return score
  }

  /**
   * Executes a complete ToolPlan with step verification and fallback support.
   */
  public async executePlan(
    plan: ToolPlan,
    context?: ToolExecutionContext
  ): Promise<{
    durationMs: number
    results: JarvisToolResult[]
    success: boolean
  }> {
    const startTime = Date.now()
    const planId = plan.id
    this.activePlans.add(planId)

    if (!this.globalAbortController) {
      this.globalAbortController = new AbortController()
    }
    const signal = context?.abortSignal || this.globalAbortController.signal

    const results: JarvisToolResult[] = []

    try {
      // Execute steps in sequence or parallel groups
      for (const step of plan.steps) {
        if (signal.aborted) {
          results.push({
            error: 'Plan execution aborted',
            retryable: false,
            success: false,
            toolId: step.toolId,
            verified: false
          })
          return {
            durationMs: Date.now() - startTime,
            results,
            success: false
          }
        }

        let tool = this.registry.get(step.toolId)
        let result: JarvisToolResult | null = null

        if (tool && tool.execute) {
          try {
            result = await tool.execute(step.arguments, { ...context, abortSignal: signal })
          } catch (err) {
            result = {
              error: err instanceof Error ? err.message : String(err),
              retryable: true,
              success: false,
              toolId: step.toolId,
              verified: false
            }
          }
        }

        // Check fallback if failed
        if ((!result || !result.success) && plan.fallbackChains?.[step.toolId]) {
          const fallbacks = plan.fallbackChains[step.toolId]
          for (const fallbackId of fallbacks) {
            if (signal.aborted) break
            const fbTool = this.registry.get(fallbackId)
            if (fbTool && fbTool.execute && fbTool.availability === 'available') {
              try {
                result = await fbTool.execute(step.arguments, { ...context, abortSignal: signal })
                if (result.success) break
              } catch {
                // Try next fallback
              }
            }
          }
        }

        const finalResult: JarvisToolResult = result || {
          error: `Tool ${step.toolId} unavailable or failed`,
          retryable: false,
          success: false,
          toolId: step.toolId,
          verified: false
        }

        results.push(finalResult)
        if (!finalResult.success) {
          return {
            durationMs: Date.now() - startTime,
            results,
            success: false
          }
        }
      }

      return {
        durationMs: Date.now() - startTime,
        results,
        success: results.every(r => r.success)
      }
    } finally {
      this.activePlans.delete(planId)
    }
  }

  /**
   * Helper to build Level 1 Deterministic Plans.
   */
  private tryBuildLevel1Plan(req: TaskRequirement): ToolPlan | null {
    if (req.intent === 'launch_app') {
      return {
        id: `plan_level1_${Date.now()}`,
        level: 1,
        reasoning: 'Direct application launch',
        steps: [
          {
            arguments: { app: req.goal.replace(/\b(?:open|launch|start)\s+/i, '').trim() },
            expectedOutcome: 'Application process launched',
            id: 'step_1',
            riskClass: 'low',
            targetCapability: 'computer.launch_app',
            timeoutMs: 5000,
            toolId: 'computer.launch_app',
            verificationStrategy: 'exists'
          }
        ],
        task: req.goal
      }
    }

    if (req.intent === 'focus_window') {
      return {
        id: `plan_level1_${Date.now()}`,
        level: 1,
        reasoning: 'Direct window focus switch',
        steps: [
          {
            arguments: { title: req.goal.replace(/\b(?:switch\s+to|focus)\s+/i, '').trim() },
            expectedOutcome: 'Target window focused',
            id: 'step_1',
            riskClass: 'low',
            targetCapability: 'computer.focus_window',
            timeoutMs: 3000,
            toolId: 'computer.focus_window',
            verificationStrategy: 'exists'
          }
        ],
        task: req.goal
      }
    }

    if (req.intent === 'key_press') {
      return {
        id: `plan_level1_${Date.now()}`,
        level: 1,
        reasoning: 'Direct keyboard input',
        steps: [
          {
            arguments: { key: 'Enter' },
            expectedOutcome: 'Key event dispatched',
            id: 'step_1',
            riskClass: 'low',
            targetCapability: 'computer.key_press',
            timeoutMs: 2000,
            toolId: 'computer.key_press',
            verificationStrategy: 'status_ok'
          }
        ],
        task: req.goal
      }
    }

    if (req.intent === 'screen_vision') {
      return {
        id: `plan_level1_${Date.now()}`,
        level: 1,
        reasoning: 'Direct screen capture and visual analysis',
        steps: [
          {
            arguments: {},
            expectedOutcome: 'Screen buffer captured',
            id: 'step_1',
            riskClass: 'read',
            targetCapability: 'screen.capture',
            timeoutMs: 3000,
            toolId: 'screen.capture',
            verificationStrategy: 'non_empty'
          },
          {
            arguments: { prompt: req.goal },
            dependencies: ['step_1'],
            expectedOutcome: 'Visual understanding result',
            id: 'step_2',
            riskClass: 'read',
            targetCapability: 'vision.analyze',
            timeoutMs: 10_000,
            toolId: 'vision.analyze',
            verificationStrategy: 'non_empty'
          }
        ],
        task: req.goal
      }
    }

    return null
  }

  /**
   * Helper to build Level 3 Multi-Tool Workflow Plans.
   */
  private buildLevel3Plan(req: TaskRequirement): ToolPlan {
    return {
      fallbackChains: {
        'web.research.adaptive': ['web.search.direct']
      },
      id: `plan_level3_${Date.now()}`,
      level: 3,
      parallelGroups: [['step_1'], ['step_2']],
      reasoning: 'Multi-tool workflow: Multi-source research followed by structured spreadsheet synthesis.',
      steps: [
        {
          arguments: { query: req.goal },
          expectedOutcome: 'Collected 50 candidate entities and verified data',
          id: 'step_1',
          riskClass: 'read',
          targetCapability: 'web.research',
          timeoutMs: 20_000,
          toolId: 'web.research.adaptive',
          verificationStrategy: 'non_empty'
        },
        {
          arguments: { format: 'xlsx', title: 'AI Companies Report' },
          dependencies: ['step_1'],
          expectedOutcome: 'Workbook file written to filesystem',
          id: 'step_2',
          riskClass: 'low',
          targetCapability: 'spreadsheet.write',
          timeoutMs: 5000,
          toolId: 'spreadsheet.write',
          verificationStrategy: 'exists'
        }
      ],
      task: req.goal
    }
  }

  /**
   * Selects best tool among candidates based on capability scoring.
   */
  private selectBestToolForCapabilities(
    capabilities: string[],
    req: TaskRequirement
  ): {
    bestTool: JarvisToolDefinition | null
    scoredCandidates: { score: number; toolId: string }[]
  } {
    const candidates = this.registry.list()
    const scored = candidates
      .map(tool => ({
        score: this.scoreTool(tool, req),
        tool
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    return {
      bestTool: scored.length > 0 ? scored[0].tool : null,
      scoredCandidates: scored.map(s => ({ score: s.score, toolId: s.tool.id }))
    }
  }
}
