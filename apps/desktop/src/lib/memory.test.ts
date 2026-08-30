import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearMemories,
  loadMemories,
  type JarvisMemory
} from './memory-store'
import {
  executeMemoryCommand,
  parseMemoryCommand,
  retrieveRelevantMemories,
  scoreMemoryRelevance
} from './memory-intelligence'
import { JarvisToolRouter } from './tool-router'

describe('JARVIS Phase 7: Memory Intelligence', () => {
  let router: JarvisToolRouter

  beforeEach(() => {
    clearMemories()
    router = JarvisToolRouter.getInstance()
  })

  describe('1. Explicit Memory Commands & Parsing', () => {
    it('parses explicit remember commands with project scoping', () => {
      const cmd = parseMemoryCommand('Remember that ONEX uses Supabase.')
      expect(cmd.action).toBe('remember')
      expect(cmd.content).toBe('ONEX uses Supabase.')
      expect(cmd.projectId).toBe('ONEX')
    })

    it('parses user preference remember commands', () => {
      const cmd = parseMemoryCommand('Remember that I prefer concise voice responses.')
      expect(cmd.action).toBe('remember')
      expect(cmd.content).toContain('prefer concise voice responses')
    })

    it('parses forget commands', () => {
      const cmd = parseMemoryCommand('Forget that ONEX uses Supabase.')
      expect(cmd.action).toBe('forget')
      expect(cmd.projectId).toBe('ONEX')
    })

    it('parses memory inspection queries', () => {
      const cmd = parseMemoryCommand('What do you remember about ONEX?')
      expect(cmd.action).toBe('inspect')
      expect(cmd.projectId).toBe('ONEX')
    })
  })

  describe('2. Memory Storage & Sensitive Data Protection', () => {
    it('executes remember command and persists active memory', () => {
      const res = executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses Supabase.',
        projectId: 'ONEX'
      })

      expect(res.success).toBe(true)
      const stored = loadMemories().filter(m => m.status === 'active')
      expect(stored).toHaveLength(1)
      expect(stored[0].content).toBe('ONEX uses Supabase.')
      expect(stored[0].projectId).toBe('ONEX')
    })

    it('rejects raw secrets and credentials from persistent memory', () => {
      const res = executeMemoryCommand({
        action: 'remember',
        content: 'Remember my api_key: sk-1234567890abcdef1234567890'
      })

      expect(res.success).toBe(false)
      expect(res.message).toContain('Security Policy')
      expect(loadMemories()).toHaveLength(0)
    })
  })

  describe('3. Conflict Resolution & Versioning', () => {
    it('supersedes previous conflicting memory and stores new version', () => {
      // 1. Initial memory
      executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses Supabase.',
        projectId: 'ONEX'
      })

      // 2. Updated conflicting fact
      executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses PostgreSQL.',
        projectId: 'ONEX'
      })

      const all = loadMemories()
      const active = all.filter(m => m.status === 'active')
      const superseded = all.filter(m => m.status === 'superseded')

      expect(active).toHaveLength(1)
      expect(active[0].content).toBe('ONEX uses PostgreSQL.')
      expect(superseded).toHaveLength(1)
      expect(superseded[0].content).toBe('ONEX uses Supabase.')
    })
  })

  describe('4. Deletion & Memory Forgetting', () => {
    it('forgets specified memory', () => {
      executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses Supabase.',
        projectId: 'ONEX'
      })

      const res = executeMemoryCommand({
        action: 'forget',
        projectId: 'ONEX',
        target: 'ONEX uses Supabase'
      })

      expect(res.success).toBe(true)
      const active = loadMemories().filter(m => m.status === 'active')
      expect(active).toHaveLength(0)
    })
  })

  describe('5. Contextual Relevance & Scoped Retrieval', () => {
    it('retrieves relevant memory when queried with project keywords and penalizes unrelated scope', () => {
      executeMemoryCommand({
        action: 'remember',
        content: 'ONEX uses Supabase for database.',
        projectId: 'ONEX'
      })

      executeMemoryCommand({
        action: 'remember',
        content: 'Hermes uses Electron and React.',
        projectId: 'Hermes'
      })

      // Querying for ONEX database
      const onexResults = retrieveRelevantMemories('What database does ONEX use?', {
        activeProjectId: 'ONEX'
      })
      expect(onexResults.length).toBeGreaterThanOrEqual(1)
      expect(onexResults[0].projectId).toBe('ONEX')

      // Querying for Hermes with active project Hermes should not return ONEX
      const hermesResults = retrieveRelevantMemories('Check frontend architecture', {
        activeProjectId: 'Hermes'
      })
      expect(hermesResults.every(m => m.projectId !== 'ONEX')).toBe(true)
    })
  })

  describe('6. Tool Selection Engine Integration for Phase 7', () => {
    it('routes "Remember that ONEX uses Supabase" to memory.write', () => {
      const decision = router.route('Remember that ONEX uses Supabase')
      expect(decision.primaryToolId).toBe('memory.write')
    })

    it('routes "Forget that ONEX uses Supabase" to memory.delete', () => {
      const decision = router.route('Forget that ONEX uses Supabase')
      expect(decision.primaryToolId).toBe('memory.delete')
    })

    it('routes "What do you remember about ONEX?" to memory.read', () => {
      const decision = router.route('What do you remember about ONEX?')
      expect(decision.primaryToolId).toBe('memory.read')
    })
  })
})
