/**
 * JARVIS Phase 7: Memory Intelligence Engine
 * Natural memory command execution, conflict resolution, versioning,
 * and contextual relevance scoring and retrieval.
 */

import {
  addMemory,
  deleteMemory,
  loadMemories,
  updateMemory,
  type JarvisMemory,
  type MemoryType
} from './memory-store'

export interface MemoryCommand {
  action: 'remember' | 'forget' | 'inspect' | 'none'
  content?: string
  projectId?: string
  target?: string
}

export interface MemoryRetrievalOptions {
  activeProjectId?: string
  limit?: number
  minScore?: number
}

/**
 * Parses natural language input for explicit memory instructions.
 */
export function parseMemoryCommand(input: string): MemoryCommand {
  const trimmed = input.trim()
  const lower = trimmed.toLowerCase()

  // 1. Explicit Remember commands
  const rememberMatch = lower.match(/^(?:hey\s+jarvis\s*,?\s*)?(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i)
  if (rememberMatch) {
    const rawContent = trimmed.slice(trimmed.length - rememberMatch[1].length).replace(/^that\s+/i, '')
    let projectId: string | undefined

    if (/\bonex\b/i.test(rawContent)) {
      projectId = 'ONEX'
    } else if (/\bhermes\b/i.test(rawContent)) {
      projectId = 'Hermes'
    } else if (/\bparionyx\b/i.test(rawContent)) {
      projectId = 'Parionyx'
    }

    return {
      action: 'remember',
      content: rawContent,
      projectId
    }
  }

  // 2. Explicit Forget / Delete memory commands
  const forgetMatch = lower.match(/^(?:hey\s+jarvis\s*,?\s*)?(?:please\s+)?(?:forget\s+(?:that\s+|everything\s+about\s+)?|delete\s+(?:what\s+you\s+remember\s+about\s+|memories\s+about\s+))(.+)$/i)
  if (forgetMatch) {
    const target = forgetMatch[1].trim().replace(/\.$/, '')
    let projectId: string | undefined

    if (/\bonex\b/i.test(target)) {
      projectId = 'ONEX'
    } else if (/\bhermes\b/i.test(target)) {
      projectId = 'Hermes'
    }

    return {
      action: 'forget',
      projectId,
      target
    }
  }

  // 3. Memory Inspection queries
  const inspectMatch = lower.match(/^(?:hey\s+jarvis\s*,?\s*)?(?:what\s+do\s+you\s+remember\s+about\s+|tell\s+me\s+what\s+you\s+remember\s+about\s+)(.+)$/i)
  if (inspectMatch) {
    const target = inspectMatch[1].trim().replace(/\?$/, '')
    let projectId: string | undefined

    if (/\bonex\b/i.test(target)) {
      projectId = 'ONEX'
    } else if (/\bhermes\b/i.test(target)) {
      projectId = 'Hermes'
    }

    return {
      action: 'inspect',
      projectId,
      target
    }
  }

  return { action: 'none' }
}

/**
 * Handles explicit memory commands with conflict resolution.
 */
export function executeMemoryCommand(command: MemoryCommand): {
  data?: unknown
  message: string
  success: boolean
} {
  if (command.action === 'remember' && command.content) {
    // Detect memory type
    let type: MemoryType = 'semantic'
    if (command.projectId) {
      type = 'project'
    } else if (/\b(?:prefer|like|voice|language|style|response|concise)\b/i.test(command.content)) {
      type = 'preference'
    }

    // Check for conflicting or existing memories to update
    const allMemories = loadMemories().filter(m => m.status === 'active')
    const words = command.content.toLowerCase().split(/\s+/).filter(w => w.length > 3)

    let existingToSupersede: JarvisMemory | null = null
    for (const mem of allMemories) {
      if (mem.projectId && command.projectId && mem.projectId.toLowerCase() === command.projectId.toLowerCase()) {
        const memWords = mem.content.toLowerCase().split(/\s+/)
        const shared = words.filter(w => memWords.includes(w))
        if (shared.length >= 2 || (mem.content.includes('uses') && command.content.includes('uses'))) {
          existingToSupersede = mem
          break
        }
      }
    }

    if (existingToSupersede) {
      updateMemory(existingToSupersede.id, { status: 'superseded' })
    }

    const addRes = addMemory({
      confidence: 1.0,
      content: command.content,
      importance: 9,
      projectId: command.projectId,
      source: 'user',
      type,
      userConfirmed: true
    })

    if (!addRes.success) {
      return {
        message: addRes.error || 'Failed to remember fact.',
        success: false
      }
    }

    const updatedText = existingToSupersede ? ' (Updated previous fact)' : ''
    return {
      data: addRes.memory,
      message: `Got it. Remembered: "${command.content}"${updatedText}.`,
      success: true
    }
  }

  if (command.action === 'forget') {
    const allMemories = loadMemories().filter(m => m.status === 'active')
    let count = 0

    for (const mem of allMemories) {
      const matchProject = command.projectId && mem.projectId && mem.projectId.toLowerCase() === command.projectId.toLowerCase()
      const matchText = command.target && mem.content.toLowerCase().includes(command.target.toLowerCase())

      if (matchProject || matchText || command.target === 'that') {
        updateMemory(mem.id, { status: 'forgotten' })
        count++
        if (command.target === 'that') break
      }
    }

    return {
      data: { count },
      message: count > 0 ? `Forgotten ${count} remembered item(s).` : 'No matching memory found to forget.',
      success: true
    }
  }

  if (command.action === 'inspect') {
    const allMemories = loadMemories().filter(m => m.status === 'active')
    const matches = allMemories.filter(m => {
      if (command.projectId && m.projectId && m.projectId.toLowerCase() === command.projectId.toLowerCase()) {
        return true
      }
      if (command.target && (command.target === 'me' || command.target === 'myself')) {
        return m.type === 'preference' || m.source === 'user'
      }
      return command.target ? m.content.toLowerCase().includes(command.target.toLowerCase()) : true
    })

    const summary = matches.map(m => `• ${m.content}${m.projectId ? ` [Project: ${m.projectId}]` : ''}`).join('\n')

    return {
      data: matches,
      message: matches.length > 0 ? `Here is what I remember:\n${summary}` : 'I do not have any stored memories matching that query.',
      success: true
    }
  }

  return { message: 'No memory action performed.', success: false }
}

/**
 * Calculates contextual relevance score for a memory item.
 */
export function scoreMemoryRelevance(
  memory: JarvisMemory,
  query: string,
  activeProjectId?: string
): number {
  if (memory.status !== 'active') return -100

  let score = 0
  const qLower = query.toLowerCase()
  const cLower = memory.content.toLowerCase()

  // 1. Keyword match (+15 per keyword)
  const keywords = qLower.split(/[\s,?.!]+/).filter(w => w.length > 2)
  for (const kw of keywords) {
    if (cLower.includes(kw)) {
      score += 20
    }
  }

  // 2. Project scope match / penalty
  if (memory.projectId) {
    if (activeProjectId && memory.projectId.toLowerCase() === activeProjectId.toLowerCase()) {
      score += 50
    } else if (qLower.includes(memory.projectId.toLowerCase())) {
      score += 40
    } else if (activeProjectId && memory.projectId.toLowerCase() !== activeProjectId.toLowerCase()) {
      // Unrelated project penalty
      score -= 60
    }
  }

  // 3. User preference bonus for conversation queries
  if (memory.type === 'preference') {
    score += 15
  }

  // 4. Base confidence and importance
  score += memory.importance * 3
  score += memory.confidence * 15

  return score
}

/**
 * Retrieves top relevant memories for a prompt.
 */
export function retrieveRelevantMemories(
  query: string,
  options: MemoryRetrievalOptions = {}
): JarvisMemory[] {
  const allMemories = loadMemories().filter(m => m.status === 'active')
  const limit = options.limit || 5
  const minScore = options.minScore || 25

  const scored = allMemories.map(memory => ({
    memory,
    score: scoreMemoryRelevance(memory, query, options.activeProjectId)
  }))

  return scored
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory)
}

/**
 * Generates compact memory context prompt header.
 */
export function buildMemoryContextPrompt(memories: JarvisMemory[]): string {
  if (!memories || memories.length === 0) return ''

  const lines = memories.map(m => {
    const scope = m.projectId ? ` [Project: ${m.projectId}]` : ''
    return `- ${m.content}${scope}`
  })

  return `[JARVIS MEMORY CONTEXT]\n${lines.join('\n')}\n`
}
