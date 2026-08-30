import { beforeEach, describe, expect, it } from 'vitest'

import { JarvisAgentCore } from './agent-core'
import {
  compareMetaAndAiSensyLeads,
  executeIntegrationCapability
} from './integration-connectors'
import { JarvisIntegrationRegistry } from './integration-registry'
import { JarvisToolRouter } from './tool-router'

describe('JARVIS Phase 9: Universal Tools & Integrations', () => {
  let registry: JarvisIntegrationRegistry
  let router: JarvisToolRouter
  let agentCore: JarvisAgentCore

  beforeEach(() => {
    registry = JarvisIntegrationRegistry.getInstance()
    router = JarvisToolRouter.getInstance()
    agentCore = JarvisAgentCore.getInstance()
  })

  describe('1. Universal Integration Registry & Discovery', () => {
    it('registers default standard integrations with capabilities', () => {
      const integrations = registry.list()
      expect(integrations.length).toBeGreaterThanOrEqual(8)

      const gmail = registry.get('gmail')
      expect(gmail).toBeDefined()
      expect(gmail?.capabilities).toContain('email.read')

      const supabase = registry.get('supabase')
      expect(supabase).toBeDefined()
      expect(supabase?.capabilities).toContain('database.query')
    })

    it('finds integrations by capability', () => {
      const emailProviders = registry.findByCapability('email.read')
      expect(emailProviders.some(i => i.id === 'gmail')).toBe(true)

      const crmProviders = registry.findByCapability('crm.leads.read')
      expect(crmProviders.some(i => i.id === 'onex')).toBe(true)
    })

    it('enforces "No Fake Connectivity": reports disconnected error when integration is not connected', async () => {
      registry.setAvailability('gmail', 'disconnected')

      const result = await executeIntegrationCapability('gmail', 'email.read')
      expect(result.success).toBe(false)
      expect(result.error).toContain('is not connected yet')
      expect(result.verified).toBe(false)
    })
  })

  describe('2. Connectors & Data Normalization', () => {
    beforeEach(() => {
      // Connect integrations for testing execution
      registry.setAvailability('gmail', 'connected')
      registry.setAvailability('google_calendar', 'connected')
      registry.setAvailability('github', 'connected')
      registry.setAvailability('supabase', 'connected')
      registry.setAvailability('meta_ads', 'connected')
      registry.setAvailability('aisensy', 'connected')
      registry.setAvailability('onex', 'connected')
      registry.setAvailability('n8n', 'connected')
    })

    it('executes Gmail and returns normalized emails', async () => {
      const res = await executeIntegrationCapability('gmail', 'email.read')
      expect(res.success).toBe(true)
      expect(res.verified).toBe(true)
      const data = res.data as { count: number; emails: { subject: string }[] }
      expect(data.count).toBeGreaterThanOrEqual(1)
      expect(data.emails[0].subject).toContain('ONEX')
    })

    it('executes Google Calendar and returns normalized events', async () => {
      const res = await executeIntegrationCapability('google_calendar', 'calendar.read')
      expect(res.success).toBe(true)
      const data = res.data as { count: number; events: { title: string }[] }
      expect(data.events[0].title).toBe('ONEX Sprint Planning')
    })

    it('executes GitHub and returns normalized PRs', async () => {
      const res = await executeIntegrationCapability('github', 'github.pr.read')
      expect(res.success).toBe(true)
      const data = res.data as { count: number; prs: { number: number }[] }
      expect(data.prs[0].number).toBe(42)
    })

    it('executes Supabase query and returns normalized database records', async () => {
      const res = await executeIntegrationCapability('supabase', 'database.query')
      expect(res.success).toBe(true)
      const data = res.data as { count: number; table: string }
      expect(data.count).toBe(1420)
      expect(data.table).toBe('users')
    })

    it('executes Meta Ads and returns normalized campaign insights', async () => {
      const res = await executeIntegrationCapability('meta_ads', 'ads.read')
      expect(res.success).toBe(true)
      const data = res.data as { totalLeads: number; totalSpend: number }
      expect(data.totalLeads).toBe(42)
      expect(data.totalSpend).toBe(180.0)
    })

    it('executes AiSensy and returns normalized WhatsApp leads', async () => {
      const res = await executeIntegrationCapability('aisensy', 'whatsapp.messages.read')
      expect(res.success).toBe(true)
      const data = res.data as { totalLeads: number }
      expect(data.totalLeads).toBe(39)
    })

    it('executes ONEX CRM and returns normalized overdue leads', async () => {
      const res = await executeIntegrationCapability('onex', 'crm.leads.read')
      expect(res.success).toBe(true)
      const data = res.data as { overdueCount: number }
      expect(data.overdueCount).toBe(2)
    })

    it('executes n8n workflow and returns normalized workflow status', async () => {
      const res = await executeIntegrationCapability('n8n', 'workflow.read')
      expect(res.success).toBe(true)
      const data = res.data as { active: boolean }
      expect(data.active).toBe(true)
    })
  })

  describe('3. Cross-System Entity Comparison', () => {
    it('compares Meta Ads leads with AiSensy WhatsApp leads and computes discrepancy', () => {
      const metaData = { totalLeads: 42, totalSpend: 180.0 }
      const aisensyData = { totalLeads: 39 }

      const comp = compareMetaAndAiSensyLeads(metaData, aisensyData)
      expect(comp.metaLeads).toBe(42)
      expect(comp.whatsappLeads).toBe(39)
      expect(comp.discrepancy).toBe(3)
      expect(comp.conversionRate).toBeCloseTo(92.85, 1)
      expect(comp.analysis).toContain('discrepancy of 3 leads')
    })
  })

  describe('4. Tool Selection Engine Intent & Capability Routing', () => {
    it('routes "Check my Gmail" to gmail.email.read', () => {
      const decision = router.route('Check my Gmail')
      expect(decision.primaryToolId).toBe('gmail.email.read')
    })

    it('routes "What is on my calendar today?" to calendar.read', () => {
      const decision = router.route('What is on my calendar today?')
      expect(decision.primaryToolId).toBe('calendar.read')
    })

    it('routes "Check my GitHub PRs" to github.pr.read', () => {
      const decision = router.route('Check my GitHub PRs')
      expect(decision.primaryToolId).toBe('github.pr.read')
    })

    it('routes "How many users are in Supabase?" to supabase.database.query', () => {
      const decision = router.route('How many users are in Supabase?')
      expect(decision.primaryToolId).toBe('supabase.database.query')
    })

    it('routes "Check Meta Ads performance" to meta.insights.read', () => {
      const decision = router.route('Check Meta Ads performance')
      expect(decision.primaryToolId).toBe('meta.insights.read')
    })

    it('routes "How many leads came through AiSensy?" to aisensy.leads.read', () => {
      const decision = router.route('How many leads came through AiSensy?')
      expect(decision.primaryToolId).toBe('aisensy.leads.read')
    })

    it('routes "Show overdue leads from ONEX" to onex.leads.read', () => {
      const decision = router.route('Show overdue leads from ONEX')
      expect(decision.primaryToolId).toBe('onex.leads.read')
    })

    it('routes Hindi/Hinglish query "Jarvis, aaj ke Gmail mails check karo" to gmail.email.read', () => {
      const decision = router.route('Jarvis, aaj ke Gmail mails check karo')
      expect(decision.primaryToolId).toBe('gmail.email.read')
    })
  })

  describe('5. Multi-Integration Workflows in Agent Core', () => {
    beforeEach(() => {
      registry.setAvailability('gmail', 'connected')
      registry.setAvailability('google_calendar', 'connected')
      registry.setAvailability('meta_ads', 'connected')
      registry.setAvailability('aisensy', 'connected')
      registry.setAvailability('onex', 'connected')
    })

    it('executes multi-service business briefing across 5 services in parallel', async () => {
      const result = await agentCore.runGoal(
        'Check Gmail, calendar, Meta, AiSensy, and ONEX and give me a briefing'
      )

      expect(result.success).toBe(true)
      expect(result.graph.tasks.size).toBe(5)
      // All 5 read tasks run in parallel in stage 1
      expect(result.graph.executionStages[0].length).toBe(5)
      expect(result.finalResponse).toContain('Briefing complete')
      expect(result.finalResponse).toContain('Meta recorded 42 leads')
    })

    it('executes cross-service comparison workflow end-to-end', async () => {
      const result = await agentCore.runGoal('Compare Meta leads with AiSensy leads')

      expect(result.success).toBe(true)
      expect(result.finalResponse).toContain('Meta recorded 42 leads')
      expect(result.finalResponse).toContain('discrepancy of 3 leads')
    })
  })
})
