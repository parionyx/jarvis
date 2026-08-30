/**
 * JARVIS Phase 4: Universal Web Intelligence Intent & Task Classification
 * Determines whether web access is required, the task type, research depth,
 * comparison criteria, and output format.
 */

export type WebTaskType =
  | 'search'
  | 'research'
  | 'compare'
  | 'recommend'
  | 'top_n'
  | 'extract'
  | 'export'
  | 'general'

export type ResearchDepth = 'fast' | 'normal' | 'deep'

export interface WebIntentResult {
  comparisonCriteria?: string[]
  depth: ResearchDepth
  entities?: string[]
  exportFormat?: 'csv' | 'json' | 'markdown' | 'xlsx'
  isWebTask: boolean
  query: string
  requiresBrowser: boolean
  schemaFields?: string[]
  targetUrl?: string
  taskType: WebTaskType
}

/**
 * URL regex pattern for detecting direct URLs in queries
 */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i

/**
 * Classifies a user prompt into structured web intelligence metadata.
 */
export function detectWebIntent(rawPrompt: string): WebIntentResult {
  const prompt = (rawPrompt || '').trim()

  if (!prompt) {
    return {
      depth: 'fast',
      isWebTask: false,
      query: '',
      requiresBrowser: false,
      taskType: 'general'
    }
  }

  const lower = prompt.toLowerCase()

  // 1. Direct URL extraction / scraping
  const urlMatch = prompt.match(URL_REGEX)
  if (urlMatch) {
    const targetUrl = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`
    return {
      depth: 'normal',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      targetUrl,
      taskType: 'extract'
    }
  }

  // 2. Export requests
  const exportMatch = lower.match(/\b(?:export|download|save)\b.*?\b(?:as|to|into|in)?\s*(?:format\s+)?(csv|json|markdown|xlsx|excel)\b/i)
  if (exportMatch) {
    const format = exportMatch[1] === 'excel' ? 'xlsx' : (exportMatch[1] as 'csv' | 'json' | 'markdown' | 'xlsx')
    return {
      depth: 'fast',
      exportFormat: format,
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'export'
    }
  }

  // 3. Sports / Match score searches (check before general compare to prevent "team vs team score" being treated as tool compare)
  if (/\b(?:score|match|game|cricket|football|basketball)\b/i.test(lower)) {
    return {
      depth: 'fast',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'search'
    }
  }

  // 4. Comparison requests (*"Compare Notion vs Obsidian vs Logseq"*, *"Which is better: Next.js or Remix"*)
  const compareMatch = lower.match(/\b(?:compare|vs\.?|versus|difference\s+between|which\s+is\s+better)\b/i)
  if (compareMatch) {
    const entities = extractComparisonEntities(prompt)
    return {
      comparisonCriteria: ['features', 'pricing', 'ease_of_use', 'performance', 'community'],
      depth: entities.length > 2 ? 'deep' : 'normal',
      entities,
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'compare'
    }
  }

  // 5. Recommendation / Best requests (*"Find the best noise cancelling headphones"*, *"Top recommended CRM for startups"*)
  if (/\b(?:best|top\s+recommended|which\s+should\s+i\s+(?:choose|buy|use)|recommend\s+the\s+best)\b/i.test(lower)) {
    return {
      comparisonCriteria: ['price', 'quality', 'reliability', 'reviews', 'value'],
      depth: 'normal',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'recommend'
    }
  }

  // 6. Top-N discovery (*"Find top 10 CRM tools"*, *"Top 20 AI startups"*, *"Find 50 companies"*)
  const topNMatch = lower.match(/\b(?:top|find|list)\s+(\d{1,3})\s+(.+)/i)
  if (topNMatch) {
    const count = parseInt(topNMatch[1], 10)
    return {
      depth: count > 10 ? 'deep' : 'normal',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'top_n'
    }
  }

  // 7. Deep Research (*"Research market trends in AI"*, *"Deep research on quantum computing"*, *"Analyze the market"*)
  if (/\b(?:deep\s+research|research|market\s+analysis|investigate|thoroughly\s+analyze)\b/i.test(lower)) {
    return {
      depth: 'deep',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'research'
    }
  }

  // 8. General search / Factual lookups (*"Search for...", "What is the latest score of...", "Who is...", "Current price of..."*)
  if (
    /\b(?:search\s+for|look\s+up|google|find\s+out|latest|current|who\s+won|news\s+on|price\s+of|weather)\b/i.test(
      lower
    )
  ) {
    return {
      depth: 'fast',
      isWebTask: true,
      query: prompt,
      requiresBrowser: false,
      taskType: 'search'
    }
  }

  return {
    depth: 'fast',
    isWebTask: false,
    query: prompt,
    requiresBrowser: false,
    taskType: 'general'
  }
}

/**
 * Extracts entities separated by vs/versus/and/or/comma
 */
function extractComparisonEntities(prompt: string): string[] {
  const cleaned = prompt.replace(/\b(?:compare|which\s+is\s+better(?::|\s+)?|difference\s+between)\b/gi, '').trim()
  const tokens = cleaned.split(/\b(?:vs\.?|versus|and|or|,)\b/i).map(t => t.trim().replace(/^:\s*/, '')).filter(t => t.length > 1)
  return tokens.length >= 2 ? tokens : []
}
