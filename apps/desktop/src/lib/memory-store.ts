/**
 * JARVIS Phase 7: Memory Store & Data Model
 * Persistent, selective, layered memory storage with sensitive secret detection
 * and local offline persistence.
 */

export type MemoryType =
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'project'
  | 'preference'
  | 'procedural'
  | 'entity'

export type MemorySource =
  | 'user'
  | 'conversation'
  | 'tool'
  | 'system'
  | 'import'

export type MemoryStatus =
  | 'active'
  | 'superseded'
  | 'archived'
  | 'forgotten'

export interface JarvisMemory {
  confidence: number // 0.0 - 1.0
  content: string
  createdAt: number
  entityIds?: string[]
  expiresAt?: number
  id: string
  importance: number // 1 - 10
  lastUsedAt?: number
  projectId?: string
  sensitive?: boolean
  source: MemorySource
  status: MemoryStatus
  tags?: string[]
  type: MemoryType
  updatedAt: number
  userConfirmed?: boolean
  version?: number
}

const STORAGE_KEY = 'hermes.jarvis.memories.v1'

// In-memory cache of memories for fast synchronous access
let memoryCache: Map<string, JarvisMemory> | null = null

/**
 * Detects whether text contains raw secrets, API keys, passwords, or private tokens.
 */
export function isSensitiveSecret(text: string): boolean {
  // Common secret patterns: API keys (sk-..., ghp_..., key_...), passwords, bearer tokens
  const secretPatterns = [
    /\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|key-[a-zA-Z0-9]{16,})\b/i,
    /\b(?:api[_-]?key|secret[_-]?key|auth[_-]?token|private[_-]?key|access[_-]?token)[\s:=]+['"]?[a-zA-Z0-9_\-]{8,}['"]?\b/i,
    /\b(?:password|passwd|pwd)[\s:=]+['"]?[^\s'"]{6,}['"]?\b/i,
    /\b(?:bearer\s+[a-zA-Z0-9_\-\.]{20,})\b/i
  ]

  return secretPatterns.some(pattern => pattern.test(text))
}

/**
 * Loads memories from local persistence.
 */
export function loadMemories(): JarvisMemory[] {
  if (memoryCache) {
    return Array.from(memoryCache.values())
  }

  memoryCache = new Map<string, JarvisMemory>()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as JarvisMemory[]
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id && item.content) {
            memoryCache.set(item.id, item)
          }
        }
      }
    }
  } catch {
    // Restricted or unavailable localStorage environment
  }

  return Array.from(memoryCache.values())
}

/**
 * Persists current memory cache to local storage.
 */
export function saveMemories(): void {
  if (!memoryCache) return

  try {
    const list = Array.from(memoryCache.values())
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Quota or storage write failure
  }
}

/**
 * Adds a new memory item after validating against sensitive secret leakage.
 */
export function addMemory(memory: Omit<JarvisMemory, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'> & { id?: string }): {
  error?: string
  memory?: JarvisMemory
  success: boolean
} {
  // 1. Safety check: Reject raw secrets and credentials from persistent memory
  if (isSensitiveSecret(memory.content)) {
    return {
      error: 'Security Policy: Raw credentials, passwords, and API keys cannot be persisted in memory.',
      success: false
    }
  }

  loadMemories()

  const id = memory.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()

  const entry: JarvisMemory = {
    ...memory,
    createdAt: now,
    id,
    status: 'active',
    updatedAt: now,
    version: 1
  }

  memoryCache!.set(id, entry)
  saveMemories()

  return {
    memory: entry,
    success: true
  }
}

/**
 * Updates an existing memory item.
 */
export function updateMemory(id: string, patch: Partial<JarvisMemory>): JarvisMemory | null {
  loadMemories()
  const existing = memoryCache!.get(id)
  if (!existing) return null

  if (patch.content && isSensitiveSecret(patch.content)) {
    return null
  }

  const updated: JarvisMemory = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: Date.now(),
    version: (existing.version || 1) + 1
  }

  memoryCache!.set(id, updated)
  saveMemories()
  return updated
}

/**
 * Deletes a memory item by ID.
 */
export function deleteMemory(id: string): boolean {
  loadMemories()
  const existed = memoryCache!.delete(id)
  if (existed) {
    saveMemories()
  }
  return existed
}

/**
 * Clears all memories.
 */
export function clearMemories(): void {
  if (memoryCache) {
    memoryCache.clear()
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
