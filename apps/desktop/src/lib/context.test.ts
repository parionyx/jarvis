import { beforeEach, describe, expect, it } from 'vitest'

import {
  assembleLiveContext,
  buildLiveContextPrompt,
  clearActiveTask,
  getActiveTask,
  saveActiveTask,
  updateLiveContext
} from './context-engine'
import { clearMemories } from './memory-store'
import { executeMemoryCommand } from './memory-intelligence'
import { JarvisToolRouter } from './tool-router'

describe('JARVIS Phase 7: Context Engine & Task Continuity', () => {
  let router: JarvisToolRouter

  beforeEach(() => {
    clearMemories()
    clearActiveTask()
    router = JarvisToolRouter.getInstance()
  })

  describe('1. Live Context Assembly', () => {
    it('aggregates live environment state and relevant memories into prompt header', () => {
      // 1. Add relevant memory
      executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses Supabase for database.',
        projectId: 'ONEX'
      })

      // 2. Set live context
      updateLiveContext({
        activeApp: 'VS Code',
        activeProject: 'ONEX',
        activeWindow: 'LeadModule.tsx',
        currentFiles: ['src/LeadModule.tsx'],
        recentResearch: 'AiSensy WhatsApp API endpoints verified'
      })

      const liveContext = assembleLiveContext('Fix lead query in Supabase')
      expect(liveContext.activeProject).toBe('ONEX')
      expect(liveContext.activeApp).toBe('VS Code')
      expect(liveContext.relevantMemories.length).toBeGreaterThanOrEqual(1)

      const promptHeader = buildLiveContextPrompt(liveContext)
      expect(promptHeader).toContain('[JARVIS MEMORY CONTEXT]')
      expect(promptHeader).toContain('ONEX uses Supabase')
      expect(promptHeader).toContain('[ACTIVE CONTEXT]')
      expect(promptHeader).toContain('Active Project: ONEX')
      expect(promptHeader).toContain('Active Application: VS Code')
    })
  })

  describe('2. Cross-Session Task Continuity', () => {
    it('saves and resumes active task context across sessions', () => {
      saveActiveTask({
        activeTools: ['terminal.execute', 'spreadsheet.compute'],
        completedSteps: ['1. Extracted leads from CSV', '2. Filtered overdue records'],
        goal: 'Generate Daily ONEX Lead Report',
        pendingSteps: ['3. Send WhatsApp notifications', '4. Export summary to Excel'],
        projectId: 'ONEX',
        status: 'active'
      })

      const loaded = getActiveTask()
      expect(loaded).toBeDefined()
      expect(loaded?.goal).toBe('Generate Daily ONEX Lead Report')
      expect(loaded?.pendingSteps).toHaveLength(2)

      const liveContext = assembleLiveContext('Continue where we stopped')
      const prompt = buildLiveContextPrompt(liveContext)
      expect(prompt).toContain('[RESUMED TASK: Generate Daily ONEX Lead Report]')
      expect(prompt).toContain('Pending Steps: 3. Send WhatsApp notifications -> 4. Export summary to Excel')
    })
  })

  describe('3. Tool Selection Engine Integration for Context', () => {
    it('routes "Continue where we stopped" to context.get', () => {
      const decision = router.route('Continue where we stopped')
      expect(decision.primaryToolId).toBe('context.get')
    })
  })
})
