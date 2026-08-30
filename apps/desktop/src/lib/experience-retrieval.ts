/**
 * JARVIS Experience & Learning Engine: Task Fingerprinting & Retrieval
 * Semantic normalization of task intents, multi-factor similarity matching,
 * and scoped experience retrieval.
 */

import { loadExperiences, type JarvisExperience, type JarvisEnvironmentSnapshot } from './experience-store'
import type { JarvisGoal } from './goal-model'

export interface TaskFingerprint {
  capabilities: string[]
  domain: string
  entities: string[]
  goalType: string
  operations: string[]
  projectId?: string
  rawObjective: string
}

/**
 * Generates a normalized semantic signature from a user goal.
 */
export function generateTaskFingerprint(goal: JarvisGoal): TaskFingerprint {
  const lower = goal.objective.toLowerCase()
  const entities: string[] = []
  const operations: string[] = []
  const capabilities: string[] = []
  let domain = 'general'
  let goalType = 'action'

  // 1. Entity & Project Extraction
  if (/\bmeta\b/i.test(lower)) entities.push('Meta')
  if (/\baisensy\b/i.test(lower)) entities.push('AiSensy')
  if (/\bonex\b/i.test(lower)) entities.push('ONEX')
  if (/\bsupabase\b/i.test(lower)) entities.push('Supabase')
  if (/\bgithub\b/i.test(lower)) entities.push('GitHub')
  if (/\bgmail\b/i.test(lower)) entities.push('Gmail')
  if (/\bcalendar\b/i.test(lower)) entities.push('Calendar')

  // 2. Operation Extraction
  if (/\b(?:report|summary|briefing)\b/i.test(lower)) {
    operations.push('report')
    goalType = 'report'
  }
  if (/\b(?:compare|comparison|difference)\b/i.test(lower)) {
    operations.push('compare')
    goalType = 'comparison'
  }
  if (/\b(?:export|save|generate\s+excel|create\s+excel)\b/i.test(lower)) {
    operations.push('export')
  }
  if (/\b(?:check|read|inspect|query|how\s+many|show)\b/i.test(lower)) {
    operations.push('read')
  }
  if (/\b(?:send|update|create|delete)\b/i.test(lower)) {
    operations.push('write')
  }

  // 3. Domain & Capability Extraction
  if (entities.includes('Meta') || entities.includes('AiSensy') || entities.includes('ONEX')) {
    domain = 'business_reporting'
    if (entities.includes('Meta')) capabilities.push('ads.read')
    if (entities.includes('AiSensy')) capabilities.push('whatsapp.messages.read')
    if (entities.includes('ONEX')) capabilities.push('crm.leads.read')
  } else if (entities.includes('Gmail')) {
    domain = 'email_management'
    capabilities.push('email.read')
  } else if (entities.includes('Calendar')) {
    domain = 'calendar_management'
    capabilities.push('calendar.read')
  } else if (entities.includes('Supabase')) {
    domain = 'database_query'
    capabilities.push('database.query')
  } else if (entities.includes('GitHub')) {
    domain = 'developer_pr'
    capabilities.push('github.pr.read')
  } else if (lower.includes('invoice')) {
    domain = 'document_processing'
    capabilities.push('file.search', 'spreadsheet.compute')
  } else if (lower.includes('research') && lower.includes('excel')) {
    domain = 'web_research'
    capabilities.push('web.research', 'spreadsheet.write')
  }

  return {
    capabilities,
    domain,
    entities,
    goalType,
    operations,
    projectId: goal.projectId,
    rawObjective: goal.objective
  }
}

/**
 * Calculates multi-factor semantic similarity (0.0 to 1.0) between two task fingerprints.
 */
export function calculateTaskSimilarity(fpA: TaskFingerprint, fpB: TaskFingerprint): number {
  let score = 0

  // 1. Domain match (10%)
  if (fpA.domain === fpB.domain && fpA.domain !== 'general') {
    score += 0.1
  }

  // 2. Goal type match (10%)
  if (fpA.goalType === fpB.goalType) {
    score += 0.1
  }

  // 3. Capability overlap (35%)
  if (fpA.capabilities.length > 0 && fpB.capabilities.length > 0) {
    const commonCaps = fpA.capabilities.filter(c => fpB.capabilities.includes(c))
    const capScore = (commonCaps.length * 2) / (fpA.capabilities.length + fpB.capabilities.length)
    score += capScore * 0.35
  }

  // 4. Entity & Project overlap (30%)
  const allEntitiesA = [...fpA.entities, ...(fpA.projectId ? [fpA.projectId] : [])]
  const allEntitiesB = [...fpB.entities, ...(fpB.projectId ? [fpB.projectId] : [])]
  if (allEntitiesA.length > 0 && allEntitiesB.length > 0) {
    const commonEntities = allEntitiesA.filter(e => allEntitiesB.includes(e))
    const entityScore = (commonEntities.length * 2) / (allEntitiesA.length + allEntitiesB.length)
    score += entityScore * 0.3
  }

  // 5. Operation overlap (15%)
  if (fpA.operations.length > 0 && fpB.operations.length > 0) {
    const commonOps = fpA.operations.filter(o => fpB.operations.includes(o))
    const opScore = (commonOps.length * 2) / (fpA.operations.length + fpB.operations.length)
    score += opScore * 0.15
  }

  return Math.min(1.0, score)
}

/**
 * Retrieves candidate experiences matching the current goal.
 */
export function retrieveRelevantExperiences(
  goal: JarvisGoal,
  _currentEnv?: JarvisEnvironmentSnapshot,
  threshold = 0.4
): Array<{ experience: JarvisExperience; similarity: number }> {
  const goalFingerprint = generateTaskFingerprint(goal)
  const allExperiences = loadExperiences()
  const scored: Array<{ experience: JarvisExperience; similarity: number }> = []

  for (const exp of allExperiences) {
    // Construct fingerprint from stored experience
    const expGoal: JarvisGoal = {
      createdAt: exp.createdAt,
      id: exp.id,
      objective: exp.goalDescription,
      originalRequest: exp.goalDescription,
      planVersion: 1,
      projectId: exp.projectId,
      riskLevel: 'low',
      status: 'completed',
      successCriteria: [],
      updatedAt: exp.lastUsedAt
    }
    const expFingerprint = generateTaskFingerprint(expGoal)
    const similarity = calculateTaskSimilarity(goalFingerprint, expFingerprint)

    if (similarity >= threshold) {
      scored.push({ experience: exp, similarity })
    }
  }

  // Sort by combination of similarity, confidence, and success
  scored.sort((a, b) => {
    const rankA =
      a.similarity * 0.5 +
      a.experience.confidence * 0.3 +
      (a.experience.outcome === 'success' ? 0.2 : 0)
    const rankB =
      b.similarity * 0.5 +
      b.experience.confidence * 0.3 +
      (b.experience.outcome === 'success' ? 0.2 : 0)
    return rankB - rankA
  })

  return scored
}
