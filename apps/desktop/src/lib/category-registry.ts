/**
 * JARVIS Capability Discovery: Category Registry
 * Dynamically indexes tools and integrations into structured categories,
 * resolves primary categories for capabilities, and manages relationship graphs.
 */

import {
  CATEGORY_RELATIONSHIPS,
  DEFAULT_CATEGORIES,
  type CategoryName,
  type JarvisCategoryDefinition
} from './category-definition'
import type { JarvisToolDefinition } from './tool-definition'
import { JarvisToolRegistry } from './tool-registry'

export class JarvisCategoryRegistry {
  private static instance: JarvisCategoryRegistry | null = null
  private categories: Map<CategoryName, JarvisCategoryDefinition> = new Map()
  private toolRegistry: JarvisToolRegistry

  private constructor(toolRegistry = JarvisToolRegistry.getInstance()) {
    this.toolRegistry = toolRegistry
    for (const cat of DEFAULT_CATEGORIES) {
      this.categories.set(cat.id, { ...cat })
    }
  }

  public static getInstance(): JarvisCategoryRegistry {
    if (!JarvisCategoryRegistry.instance) {
      JarvisCategoryRegistry.instance = new JarvisCategoryRegistry()
    }
    return JarvisCategoryRegistry.instance
  }

  public getCategory(name: CategoryName): JarvisCategoryDefinition | undefined {
    return this.categories.get(name)
  }

  public listCategories(): JarvisCategoryDefinition[] {
    return Array.from(this.categories.values())
  }

  /**
   * Identifies the primary owning category for a requested capability.
   */
  public findPrimaryCategory(capability: string): CategoryName {
    const capLower = capability.toLowerCase()

    // 1. Exact match in registered categories
    for (const cat of this.categories.values()) {
      if (cat.capabilities.some(c => c.toLowerCase() === capLower)) {
        return cat.id
      }
    }

    // 2. Prefix-based heuristic resolution
    if (capLower.startsWith('document.') || capLower.includes('pdf') || capLower.includes('ocr')) {
      return 'DOCUMENT'
    }
    if (capLower.startsWith('web.') || capLower.includes('search') || capLower.includes('crawl')) {
      return 'WEB'
    }
    if (capLower.startsWith('research.') || capLower.includes('compare')) {
      return 'RESEARCH'
    }
    if (capLower.startsWith('email.') || capLower.startsWith('calendar.') || capLower.includes('message')) {
      return 'COMMUNICATION'
    }
    if (capLower.startsWith('crm.') || capLower.startsWith('ads.') || capLower.startsWith('whatsapp.')) {
      return 'BUSINESS'
    }
    if (capLower.startsWith('terminal.') || capLower.startsWith('system.') || capLower.startsWith('git.') || capLower.startsWith('docker.')) {
      return 'DEVOPS'
    }
    if (capLower.startsWith('database.') || capLower.startsWith('sql.')) {
      return 'DATABASE'
    }
    if (capLower.startsWith('computer.') || capLower.startsWith('screen.')) {
      return 'COMPUTER'
    }
    if (capLower.startsWith('code.') || capLower.startsWith('github.')) {
      return 'DEVELOPMENT'
    }
    if (capLower.startsWith('home.') || capLower.startsWith('iot.')) {
      return 'HOME_IOT'
    }
    if (capLower.startsWith('file.') || capLower.startsWith('spreadsheet.')) {
      return 'LOCAL'
    }

    return 'LOCAL'
  }

  /**
   * Returns related categories for fallback search.
   */
  public getRelatedCategories(category: CategoryName): CategoryName[] {
    return CATEGORY_RELATIONSHIPS[category] || []
  }

  /**
   * Retrieves all available tools in a category that can satisfy a capability.
   */
  public getAvailableToolsForCategory(
    category: CategoryName,
    capability?: string
  ): JarvisToolDefinition[] {
    const cat = this.categories.get(category)
    if (!cat) return []

    const allTools = this.toolRegistry.list()

    return allTools.filter(tool => {
      if (tool.availability !== 'available') return false

      if (capability) {
        return tool.capabilities.includes(capability)
      }

      return tool.capabilities.some(c => cat.capabilities.includes(c))
    })
  }

  /**
   * Dynamically registers a newly acquired capability and tool definition.
   */
  public registerNewCapability(
    category: CategoryName,
    capability: string,
    toolDef: JarvisToolDefinition
  ): void {
    const cat = this.categories.get(category)
    if (cat && !cat.capabilities.includes(capability)) {
      cat.capabilities.push(capability)
    }

    this.toolRegistry.register(toolDef)
  }
}
