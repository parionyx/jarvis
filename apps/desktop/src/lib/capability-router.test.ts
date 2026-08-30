import { beforeEach, describe, expect, it } from 'vitest'

import { JarvisCapabilityRouter } from './capability-router'
import { JarvisCategoryRegistry } from './category-registry'
import { OnlineCapabilityDiscoveryEngine } from './online-capability-discovery'

describe('JARVIS Capability Discovery & Category Router', () => {
  let router: JarvisCapabilityRouter
  let categoryRegistry: JarvisCategoryRegistry
  let discoveryEngine: OnlineCapabilityDiscoveryEngine

  beforeEach(() => {
    categoryRegistry = JarvisCategoryRegistry.getInstance()
    discoveryEngine = OnlineCapabilityDiscoveryEngine.getInstance()
    discoveryEngine.clearCache()
    router = JarvisCapabilityRouter.getInstance()
  })

  describe('1. Category Taxonomy & Primary Resolution', () => {
    it('resolves primary categories from capability strings accurately', () => {
      expect(categoryRegistry.findPrimaryCategory('web.search')).toBe('WEB')
      expect(categoryRegistry.findPrimaryCategory('system.cpu.read')).toBe('DEVOPS')
      expect(categoryRegistry.findPrimaryCategory('email.send')).toBe('COMMUNICATION')
      expect(categoryRegistry.findPrimaryCategory('document.pdf_to_cad')).toBe('DOCUMENT')
      expect(categoryRegistry.findPrimaryCategory('home.light.control')).toBe('HOME_IOT')
      expect(categoryRegistry.findPrimaryCategory('database.query')).toBe('DATABASE')
    })

    it('retrieves related categories for targeted fallback', () => {
      const devopsRelated = categoryRegistry.getRelatedCategories('DEVOPS')
      expect(devopsRelated).toContain('DEVELOPMENT')
      expect(devopsRelated).toContain('CLOUD')

      const docRelated = categoryRegistry.getRelatedCategories('DOCUMENT')
      expect(docRelated).toContain('LOCAL')
      expect(docRelated).toContain('ARTIFACT')
    })
  })

  describe('2. Primary Category Tool Routing', () => {
    it('routes existing capability "web.search" to primary category tool immediately', async () => {
      const decision = await router.routeCapability('web.search')

      expect(decision.success).toBe(true)
      expect(decision.primaryCategory).toBe('WEB')
      expect(decision.routingPath).toBe('primary_category')
      expect(decision.selectedTool).toBeDefined()
    })

    it('routes existing capability "email.read" to communication category tool', async () => {
      const decision = await router.routeCapability('email.read')

      expect(decision.success).toBe(true)
      expect(decision.primaryCategory).toBe('COMMUNICATION')
      expect(decision.routingPath).toBe('primary_category')
      expect(decision.selectedTool?.id).toBe('gmail.email.read')
    })
  })

  describe('3. Online Capability Discovery & Safe Acquisition', () => {
    it('triggers online capability discovery when a capability is missing locally', async () => {
      const decision = await router.routeCapability('document.pdf_to_cad')

      expect(decision.primaryCategory).toBe('DOCUMENT')
      expect(decision.routingPath).toBe('online_discovered')
      expect(decision.setupProposal).toBeDefined()
      expect(decision.setupProposal?.candidate.name).toContain('CloudConvert')
      expect(decision.setupProposal?.candidate.fitScore).toBeGreaterThanOrEqual(90)
    })

    it('enforces "No Silent Installation": requires user approval for newly discovered tools', async () => {
      const discovery = await discoveryEngine.discoverCapability('home.light.control', 'HOME_IOT')

      expect(discovery.success).toBe(true)
      expect(discovery.requiresUserApproval).toBe(true)
      expect(discovery.primaryCandidate?.name).toContain('Home Assistant')
      expect(discovery.setupInstructions).toBeDefined()
    })

    it('registers newly acquired capability and makes it immediately available in subsequent routes', async () => {
      // 1. Discover capability
      const discovery = await discoveryEngine.discoverCapability('document.pdf_to_cad', 'DOCUMENT')
      const candidate = discovery.primaryCandidate!

      // 2. Simulate safe user-approved acquisition & registration
      const toolDef = discoveryEngine.acquireAndRegisterCapability(candidate)
      expect(toolDef.id).toBe(candidate.id)

      // 3. Subsequent route uses registered tool immediately without re-discovery
      const decision = await router.routeCapability('document.pdf_to_cad')
      expect(decision.success).toBe(true)
      expect(decision.routingPath).toBe('primary_category')
      expect(decision.selectedTool?.id).toBe(candidate.id)
    })
  })
})
