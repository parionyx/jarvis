/**
 * JARVIS Capability Discovery: Capability Category Router
 * Connects capability requirements to category taxonomy, related category fallback,
 * and online capability discovery.
 */

import type { CategoryName } from './category-definition'
import { JarvisCategoryRegistry } from './category-registry'
import {
  OnlineCapabilityDiscoveryEngine,
  type CapabilityCandidate
} from './online-capability-discovery'
import type { JarvisToolDefinition } from './tool-definition'

export interface CapabilityRoutingDecision {
  capability: string
  durationMs: number
  primaryCategory: CategoryName
  routingPath: 'primary_category' | 'related_category' | 'online_discovered' | 'unresolved'
  searchedCategories: CategoryName[]
  selectedTool?: JarvisToolDefinition
  setupProposal?: {
    candidate: CapabilityCandidate
    instructions: string
  }
  success: boolean
}

export class JarvisCapabilityRouter {
  private static instance: JarvisCapabilityRouter | null = null
  private categoryRegistry: JarvisCategoryRegistry
  private discoveryEngine: OnlineCapabilityDiscoveryEngine

  private constructor(
    categoryRegistry = JarvisCategoryRegistry.getInstance(),
    discoveryEngine = OnlineCapabilityDiscoveryEngine.getInstance()
  ) {
    this.categoryRegistry = categoryRegistry
    this.discoveryEngine = discoveryEngine
  }

  public static getInstance(): JarvisCapabilityRouter {
    if (!JarvisCapabilityRouter.instance) {
      JarvisCapabilityRouter.instance = new JarvisCapabilityRouter()
    }
    return JarvisCapabilityRouter.instance
  }

  /**
   * Routes a capability requirement through the hierarchical category router.
   */
  public async routeCapability(
    capability: string,
    options?: { allowOnlineDiscovery?: boolean; signal?: AbortSignal }
  ): Promise<CapabilityRoutingDecision> {
    const startTime = Date.now()
    const allowOnline = options?.allowOnlineDiscovery ?? true
    const searchedCategories: CategoryName[] = []

    // 1. PRIMARY CATEGORY RESOLUTION & SEARCH
    const primaryCategory = this.categoryRegistry.findPrimaryCategory(capability)
    searchedCategories.push(primaryCategory)

    const primaryTools = this.categoryRegistry.getAvailableToolsForCategory(
      primaryCategory,
      capability
    )

    if (primaryTools.length > 0) {
      return {
        capability,
        durationMs: Date.now() - startTime,
        primaryCategory,
        routingPath: 'primary_category',
        searchedCategories,
        selectedTool: primaryTools[0],
        success: true
      }
    }

    // 2. RELATED CATEGORY SEARCH (PARALLEL)
    const relatedCategories = this.categoryRegistry.getRelatedCategories(primaryCategory)
    const relatedPromises = relatedCategories.map(async cat => {
      searchedCategories.push(cat)
      const tools = this.categoryRegistry.getAvailableToolsForCategory(cat, capability)
      return tools.length > 0 ? tools[0] : null
    })

    const relatedResults = await Promise.all(relatedPromises)
    const matchedRelatedTool = relatedResults.find(t => t !== null)

    if (matchedRelatedTool) {
      return {
        capability,
        durationMs: Date.now() - startTime,
        primaryCategory,
        routingPath: 'related_category',
        searchedCategories,
        selectedTool: matchedRelatedTool,
        success: true
      }
    }

    // 3. ONLINE CAPABILITY DISCOVERY
    if (allowOnline) {
      const discovery = await this.discoveryEngine.discoverCapability(
        capability,
        primaryCategory,
        { abortSignal: options?.signal }
      )

      if (discovery.success && discovery.primaryCandidate) {
        const candidate = discovery.primaryCandidate

        if (candidate.requiresSetup) {
          // Anti-Silent Installation: Propose setup to user
          return {
            capability,
            durationMs: Date.now() - startTime,
            primaryCategory,
            routingPath: 'online_discovered',
            searchedCategories,
            setupProposal: {
              candidate,
              instructions: discovery.setupInstructions || 'Setup required in Settings.'
            },
            success: false
          }
        } else {
          // Already configured/usable: Register dynamically and return tool
          const toolDef = this.discoveryEngine.acquireAndRegisterCapability(candidate)
          return {
            capability,
            durationMs: Date.now() - startTime,
            primaryCategory,
            routingPath: 'online_discovered',
            searchedCategories,
            selectedTool: toolDef,
            success: true
          }
        }
      }
    }

    return {
      capability,
      durationMs: Date.now() - startTime,
      primaryCategory,
      routingPath: 'unresolved',
      searchedCategories,
      success: false
    }
  }
}
