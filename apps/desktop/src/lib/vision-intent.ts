/**
 * JARVIS Phase 2: Vision Intent Recognition
 * Detects whether a user prompt (voice transcript or typed chat) is an explicit
 * or contextual request for screen understanding.
 */

// Strong vision intent patterns that directly ask to view, read, or inspect the screen.
const STRONG_VISION_PATTERNS = [
  /\b(?:look\s+at|check|see|view|inspect|analyze|read|examine)\s+(?:my|the|this)\s+screen\b/i,
  /\bwhat(?:\s+is|'s)?\s+(?:on|visible\s+on)\s+(?:my|the|this)\s+screen\b/i,
  /\b(?:what\s+do\s+you\s+see|what\s+can\s+you\s+see)\b/i,
  /\b(?:look\s+at\s+this|look\s+here|look\s+at\s+that)\b/i,
  /\bwhat(?:'s|\s+is)\s+wrong\s+(?:with\s+(?:my|the|this)\s+(?:screen|page|window|build|code|app))\b/i,
  /\bwhat\s+error\s+(?:am\s+i\s+getting|is\s+(?:on|in)\s+(?:my|the|this)\s+screen|is\s+this)\b/i,
  /\bread\s+(?:this|the)\s+(?:table|text|error|page|document|screen|code|paragraph)\b/i,
  /\bwhere\s+is\s+the\s+(?:[a-z0-9_\-\s]+)\s+button\b/i,
  /\bfind\s+the\s+(?:[a-z0-9_\-\s]+)\s+button\b/i,
  /\b(?:what\s+page\s+am\s+i\s+on|which\s+page\s+is\s+this|what\s+website\s+is\s+this)\b/i,
  /\b(?:what\s+app\s+is\s+open|what\s+application\s+is\s+open|which\s+app\s+am\s+i\s+using)\b/i,
  /\bexplain\s+(?:what(?:'s|\s+is)\s+(?:visible|shown|on)|this\s+(?:dashboard|screen|page|chart|graph|diagram))\b/i,
  /\b(?:can\s+you\s+see\s+my\s+screen|take\s+a\s+screenshot|capture\s+(?:my\s+)?screen)\b/i
]

// Contextual vision patterns that only indicate vision when accompanied by deictic references.
const CONTEXTUAL_VISION_PATTERNS = [
  /^what(?:'s|\s+is)\s+wrong(?:\s+here)?\??$/i,
  /^what(?:'s|\s+is)\s+this\??$/i,
  /^explain\s+this\??$/i,
  /^describe\s+this\??$/i,
  /^read\s+that\??$/i
]

export interface VisionIntentResult {
  confidence: 'none' | 'contextual' | 'strong'
  isVision: boolean
}

/**
 * Classify whether a user query requires capturing and analyzing the screen.
 * @param prompt Cleaned user prompt text
 * @param hasActiveVisualContext Whether the active session already has a recent screenshot attached
 */
export function detectVisionIntent(prompt: string, hasActiveVisualContext = false): VisionIntentResult {
  const normalized = (prompt || '').trim()

  if (!normalized) {
    return { confidence: 'none', isVision: false }
  }

  for (const pattern of STRONG_VISION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { confidence: 'strong', isVision: true }
    }
  }

  for (const pattern of CONTEXTUAL_VISION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        confidence: 'contextual',
        isVision: true
      }
    }
  }

  // Follow-up queries referencing spatial regions while having active visual context
  if (hasActiveVisualContext && /\b(?:top|bottom|left|right|center|middle|corner|side|section|panel|header|footer)\b/i.test(normalized)) {
    return { confidence: 'contextual', isVision: true }
  }

  return { confidence: 'none', isVision: false }
}

export function isVisionIntent(prompt: string, hasActiveVisualContext = false): boolean {
  return detectVisionIntent(prompt, hasActiveVisualContext).isVision
}
