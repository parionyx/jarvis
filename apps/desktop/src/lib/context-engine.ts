/**
 * JARVIS Phase 7: Context Engine & Task Continuity
 * Live working context aggregator and cross-session task continuity manager.
 */

import {
  buildMemoryContextPrompt,
  retrieveRelevantMemories
} from './memory-intelligence'
import type { JarvisMemory } from './memory-store'

export interface JarvisTaskContext {
  activeTools?: string[]
  completedSteps?: string[]
  goal: string
  id: string
  pendingSteps?: string[]
  projectId?: string
  recentResults?: unknown[]
  startedAt: number
  status: 'active' | 'paused' | 'completed' | 'failed'
  updatedAt: number
}

export interface JarvisLiveContext {
  activeApp?: string
  activeProject?: string
  activeWindow?: string
  currentFiles?: string[]
  recentResearch?: string
  recentVision?: string
  relevantMemories: JarvisMemory[]
  taskContext?: JarvisTaskContext
}

const TASK_STORAGE_KEY = 'hermes.jarvis.active_task.v1'

// In-memory working context state
let currentActiveProject: string | undefined
let currentActiveApp: string | undefined
let currentActiveWindow: string | undefined
let currentWorkingFiles: string[] = []
let currentRecentResearch: string | undefined
let currentRecentVision: string | undefined

/**
 * Updates the current runtime context properties.
 */
export function updateLiveContext(patch: {
  activeApp?: string
  activeProject?: string
  activeWindow?: string
  currentFiles?: string[]
  recentResearch?: string
  recentVision?: string
}): void {
  if (patch.activeProject !== undefined) currentActiveProject = patch.activeProject
  if (patch.activeApp !== undefined) currentActiveApp = patch.activeApp
  if (patch.activeWindow !== undefined) currentActiveWindow = patch.activeWindow
  if (patch.currentFiles !== undefined) currentWorkingFiles = patch.currentFiles
  if (patch.recentResearch !== undefined) currentRecentResearch = patch.recentResearch
  if (patch.recentVision !== undefined) currentRecentVision = patch.recentVision
}

/**
 * Saves an active task context for cross-session continuity.
 */
export function saveActiveTask(task: Omit<JarvisTaskContext, 'id' | 'startedAt' | 'updatedAt'> & { id?: string }): JarvisTaskContext {
  const now = Date.now()
  const fullTask: JarvisTaskContext = {
    ...task,
    id: task.id || `task_${now}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: now,
    updatedAt: now
  }

  try {
    window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(fullTask))
  } catch {
    // ignore
  }

  return fullTask
}

/**
 * Loads the active task context for cross-session continuity.
 */
export function getActiveTask(): JarvisTaskContext | null {
  try {
    const raw = window.localStorage.getItem(TASK_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as JarvisTaskContext
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Clears the saved active task context.
 */
export function clearActiveTask(): void {
  try {
    window.localStorage.removeItem(TASK_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Assembles the full live context for a prompt or action.
 */
export function assembleLiveContext(query: string): JarvisLiveContext {
  const memories = retrieveRelevantMemories(query, {
    activeProjectId: currentActiveProject,
    limit: 4
  })

  const task = getActiveTask()

  return {
    activeApp: currentActiveApp,
    activeProject: currentActiveProject,
    activeWindow: currentActiveWindow,
    currentFiles: currentWorkingFiles,
    recentResearch: currentRecentResearch,
    recentVision: currentRecentVision,
    relevantMemories: memories,
    taskContext: task || undefined
  }
}

/**
 * Builds formatted context conditioning header for prompt submission.
 */
export function buildLiveContextPrompt(context: JarvisLiveContext): string {
  const parts: string[] = []

  // 1. Relevant Memories
  const memPrompt = buildMemoryContextPrompt(context.relevantMemories)
  if (memPrompt) {
    parts.push(memPrompt.trim())
  }

  // 2. Active Environment Context
  const envLines: string[] = []
  if (context.activeProject) envLines.push(`Active Project: ${context.activeProject}`)
  if (context.activeApp) envLines.push(`Active Application: ${context.activeApp} (${context.activeWindow || 'Focused'})`)
  if (context.currentFiles && context.currentFiles.length > 0) envLines.push(`Working Files: ${context.currentFiles.join(', ')}`)
  if (context.recentResearch) envLines.push(`Recent Research: ${context.recentResearch}`)

  if (envLines.length > 0) {
    parts.push(`[ACTIVE CONTEXT]\n${envLines.join('\n')}`)
  }

  // 3. Resumed Task Context
  if (context.taskContext && context.taskContext.status === 'active') {
    parts.push(`[RESUMED TASK: ${context.taskContext.goal}]\nPending Steps: ${(context.taskContext.pendingSteps || []).join(' -> ') || 'In progress'}`)
  }

  return parts.length > 0 ? `${parts.join('\n\n')}\n` : ''
}
