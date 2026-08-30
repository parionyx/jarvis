/**
 * JARVIS Tool Selection Engine: Core Tool & Execution Definitions
 * Defines structured metadata, capability taxonomy, risk classes, and result contracts.
 */

export type ToolCategory =
  | 'LOCAL'
  | 'COMPUTER'
  | 'WEB'
  | 'DEV'
  | 'BUSINESS'
  | 'AI'
  | 'DOCUMENT'

export type ToolLatencyClass = 'instant' | 'fast' | 'medium' | 'slow'
export type ToolCostClass = 'free' | 'low' | 'medium' | 'high'
export type ToolRiskClass = 'read' | 'low' | 'medium' | 'high' | 'critical'
export type ToolAvailability = 'available' | 'unavailable' | 'degraded' | 'unknown'

export interface ToolExecutionContext {
  abortSignal?: AbortSignal
  dryRun?: boolean
  sessionContext?: Record<string, unknown>
  userOverride?: boolean
}

export interface JarvisToolResult {
  data?: unknown
  durationMs?: number
  error?: string
  metadata?: Record<string, unknown>
  provider?: string
  retryable?: boolean
  success: boolean
  toolId: string
  verified: boolean
}

export interface JarvisToolDefinition {
  availability: ToolAvailability
  capabilities: string[] // e.g. ['web.search', 'computer.mouse', 'document.pdf', 'spreadsheet.compute']
  category: ToolCategory
  costClass: ToolCostClass
  description: string
  id: string
  inputSchema?: unknown
  latencyClass: ToolLatencyClass
  local: boolean
  name: string
  outputSchema?: unknown
  provider?: string
  remote: boolean
  requiresAuthentication: boolean
  requiresBrowser: boolean
  requiresNetwork: boolean
  riskClass: ToolRiskClass
  supportsStructuredOutput: boolean
  supportsVision: boolean

  // Tool execution & verification functions
  execute?: (args: Record<string, unknown>, context?: ToolExecutionContext) => Promise<JarvisToolResult>
  isAvailable?: () => boolean | Promise<boolean>
  verify?: (result: JarvisToolResult, args: Record<string, unknown>) => Promise<boolean> | boolean
}

export interface ToolPlanStep {
  arguments: Record<string, unknown>
  dependencies?: string[]
  expectedOutcome?: string
  id: string
  riskClass: ToolRiskClass
  targetCapability: string
  timeoutMs?: number
  toolId: string
  verificationStrategy?: 'exists' | 'non_empty' | 'status_ok' | 'custom'
}

export interface ToolPlan {
  fallbackChains?: Record<string, string[]>
  id: string
  level: 1 | 2 | 3
  parallelGroups?: string[][]
  reasoning?: string
  steps: ToolPlanStep[]
  task: string
}
