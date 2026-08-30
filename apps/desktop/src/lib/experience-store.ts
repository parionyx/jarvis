/**
 * JARVIS Experience & Learning Engine: Experience Store & Data Models
 * Standardized experience records, strategy statistics, environmental snapshots,
 * and privacy-hardened persistence.
 */

export interface JarvisEnvironmentSnapshot {
  activeApp?: string
  activeProject?: string
  activeWindow?: string
  availableTools: string[]
  connectedIntegrations: string[]
  currentFiles?: string[]
  networkAvailable: boolean
}

export interface JarvisStrategyStep {
  capability: string
  dependencies?: string[]
  expectedOutcome?: string
  fallbackTools?: string[]
  preferredTool?: string
}

export interface JarvisStrategy {
  conditions?: string[]
  estimatedDurationMs?: number
  id: string
  name: string
  prerequisites?: string[]
  risks?: string[]
  steps: JarvisStrategyStep[]
}

export type ExperienceOutcome = 'success' | 'partial_success' | 'failure' | 'cancelled'
export type StrategyHealth = 'ACTIVE' | 'PROMISING' | 'DEGRADED' | 'STALE' | 'DISABLED'

export interface JarvisExperience {
  capabilities: string[]
  category?: string
  confidence: number // 0.0 - 1.0 (Laplace smoothed)
  createdAt: number
  durationMs: number
  entityIds?: string[]
  environment: JarvisEnvironmentSnapshot
  failureReason?: string
  goalDescription: string
  id: string
  lastUsedAt: number
  outcome: ExperienceOutcome
  projectId?: string
  recoveryStrategy?: string
  sourceTaskId?: string
  strategy: JarvisStrategy
  successScore: number // 0 - 100
  taskPattern: string
  verification: {
    details?: string
    evidence?: unknown
    verified: boolean
  }
}

export interface StrategyStats {
  attempts: number
  averageDurationMs: number
  cancellations: number
  confidence: number
  failures: number
  health: StrategyHealth
  lastFailureAt?: number
  lastFailureReason?: string
  lastSuccessAt?: number
  partialSuccesses: number
  recentSuccessRate: number
  strategyId: string
  successRate: number
  successes: number
}

const EXPERIENCE_STORAGE_KEY = 'hermes.jarvis.experiences.v1'
const STRATEGY_STATS_STORAGE_KEY = 'hermes.jarvis.strategy_stats.v1'

// In-memory fallback
let memoryExperiences: JarvisExperience[] = []
let memoryStrategyStats: Map<string, StrategyStats> = new Map()

/**
 * Secret pattern detector: Prevents raw API keys, passwords, and tokens from being stored in experiences.
 */
export function isSensitiveExperienceContent(text: string): boolean {
  return /\b(?:sk-[a-zA-Z0-9_-]{15,}|ghp_[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._~+/-]+=*|password\s*[:=]\s*\S+)\b/i.test(
    text
  )
}

/**
 * Loads all stored experiences.
 */
export function loadExperiences(): JarvisExperience[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)
      if (raw) {
        return JSON.parse(raw) as JarvisExperience[]
      }
    }
  } catch {
    // fallback to memory
  }
  return memoryExperiences
}

/**
 * Saves all experiences to local storage.
 */
export function saveExperiences(experiences: JarvisExperience[]): void {
  // Privacy safeguard: Filter out any items containing sensitive patterns
  const sanitized = experiences.filter(
    exp =>
      !isSensitiveExperienceContent(exp.goalDescription) &&
      !isSensitiveExperienceContent(exp.taskPattern)
  )

  memoryExperiences = sanitized
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(sanitized))
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Appends a new experience record.
 */
export function saveExperience(experience: JarvisExperience): boolean {
  if (
    isSensitiveExperienceContent(experience.goalDescription) ||
    isSensitiveExperienceContent(experience.taskPattern)
  ) {
    return false
  }

  const all = loadExperiences()
  all.push(experience)
  saveExperiences(all)
  return true
}

/**
 * Loads strategy statistics.
 */
export function loadStrategyStats(): Map<string, StrategyStats> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STRATEGY_STATS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, StrategyStats>
        const map = new Map<string, StrategyStats>()
        for (const [k, v] of Object.entries(parsed)) {
          map.set(k, v)
        }
        return map
      }
    }
  } catch {
    // fallback
  }
  return memoryStrategyStats
}

/**
 * Saves strategy statistics.
 */
export function saveStrategyStats(statsMap: Map<string, StrategyStats>): void {
  memoryStrategyStats = statsMap
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: Record<string, StrategyStats> = {}
      for (const [k, v] of statsMap.entries()) {
        obj[k] = v
      }
      window.localStorage.setItem(STRATEGY_STATS_STORAGE_KEY, JSON.stringify(obj))
    }
  } catch {
    // Ignore
  }
}

/**
 * Clears all experiences and statistics.
 */
export function clearExperiences(): void {
  memoryExperiences = []
  memoryStrategyStats.clear()
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(EXPERIENCE_STORAGE_KEY)
      window.localStorage.removeItem(STRATEGY_STATS_STORAGE_KEY)
    }
  } catch {
    // Ignore
  }
}
