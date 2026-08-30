/**
 * JARVIS Phase 4: Web Capability Registry & Provider Discovery
 * Discovers available search, fetch, crawl, and browser capabilities at runtime.
 * Prevents calling unavailable tools and strictly gates browser launches.
 */

export type ProviderType = 'search' | 'fetch' | 'crawl' | 'browser' | 'extract' | 'export'
export type ProviderStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'BLOCKED_FOR_CURRENT_TASK'

export interface WebProvider {
  isAvailable: () => boolean | Promise<boolean>
  name: string
  priority: number // Lower number = higher priority
  status: ProviderStatus
  type: ProviderType
}

export type BrowserRequirementReason =
  | 'AUTH_REQUIRED'
  | 'INTERACTIVE_UI'
  | 'DYNAMIC_ONLY'
  | 'DOM_REQUIRED'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD_UI'
  | 'USER_EXPLICIT_BROWSER_REQUEST'
  | 'VISUAL_ONLY'

// In-memory provider registry
const registeredProviders: Map<string, WebProvider> = new Map()

// Default fallback HTTP search provider using reliable public endpoints
const directHttpSearchProvider: WebProvider = {
  isAvailable: () => true,
  name: 'Direct_HTTP_Search',
  priority: 10,
  status: 'AVAILABLE',
  type: 'search'
}

// Direct HTTP page fetch provider (works without browser)
const directHttpFetchProvider: WebProvider = {
  isAvailable: () => true,
  name: 'Direct_HTTP_Fetch',
  priority: 1,
  status: 'AVAILABLE',
  type: 'fetch'
}

// Built-in Readability / Structured Extractor
const readabilityExtractProvider: WebProvider = {
  isAvailable: () => true,
  name: 'Readability_Extractor',
  priority: 1,
  status: 'AVAILABLE',
  type: 'extract'
}

// Native Desktop Browser Control (Strictly last resort / interactive only)
const desktopBrowserProvider: WebProvider = {
  isAvailable: () => typeof window !== 'undefined' && !!(window as any).hermesDesktop?.computer,
  name: 'Desktop_Browser_Control',
  priority: 100,
  status: 'AVAILABLE',
  type: 'browser'
}

/**
 * Initializes the default Web Capability Registry.
 */
export function initWebCapabilityRegistry(): void {
  registeredProviders.clear()
  registerProvider(directHttpFetchProvider)
  registerProvider(readabilityExtractProvider)
  registerProvider(directHttpSearchProvider)
  registerProvider(desktopBrowserProvider)
}

// Auto-initialize on load
initWebCapabilityRegistry()

export function registerProvider(provider: WebProvider): void {
  registeredProviders.set(provider.name, provider)
}

export function unregisterProvider(name: string): void {
  registeredProviders.delete(name)
}

export function getRegisteredProviders(): WebProvider[] {
  return Array.from(registeredProviders.values())
}

/**
 * Returns a runtime capability snapshot of available providers.
 */
export async function getCapabilityMap(): Promise<Record<ProviderType, { available: string[]; unavailable: string[] }>> {
  const map: Record<ProviderType, { available: string[]; unavailable: string[] }> = {
    browser: { available: [], unavailable: [] },
    crawl: { available: [], unavailable: [] },
    export: { available: [], unavailable: [] },
    extract: { available: [], unavailable: [] },
    fetch: { available: [], unavailable: [] },
    search: { available: [], unavailable: [] }
  }

  for (const provider of registeredProviders.values()) {
    try {
      const avail = await provider.isAvailable()
      if (avail && provider.status !== 'BLOCKED_FOR_CURRENT_TASK') {
        map[provider.type]?.available.push(provider.name)
      } else {
        map[provider.type]?.unavailable.push(provider.name)
      }
    } catch {
      map[provider.type]?.unavailable.push(provider.name)
    }
  }

  return map
}

/**
 * Selects the best available non-blocked provider for a given capability type.
 */
export async function selectBestProvider(type: ProviderType): Promise<WebProvider | null> {
  const candidates: WebProvider[] = []

  for (const provider of registeredProviders.values()) {
    if (provider.type === type && provider.status !== 'BLOCKED_FOR_CURRENT_TASK') {
      try {
        const avail = await provider.isAvailable()
        if (avail) {
          candidates.push(provider)
        }
      } catch {
        // Provider unavailable
      }
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => a.priority - b.priority)
  return candidates[0]
}

/**
 * Marks a provider blocked for the current task (e.g. anti-bot or rate-limited).
 */
export function markProviderBlocked(name: string): void {
  const p = registeredProviders.get(name)
  if (p) {
    p.status = 'BLOCKED_FOR_CURRENT_TASK'
  }
}

/**
 * Resets blocked provider statuses between tasks.
 */
export function resetProviderBlockStatuses(): void {
  for (const p of registeredProviders.values()) {
    if (p.status === 'BLOCKED_FOR_CURRENT_TASK') {
      p.status = 'AVAILABLE'
    }
  }
}

/**
 * Strictly evaluates whether a task genuinely requires a browser.
 * BROWSER IS LAST RESORT: Never opened for search, reading, research, or comparisons.
 */
export function evaluateBrowserRequirement(taskPrompt: string): {
  allowed: boolean
  reason?: BrowserRequirementReason
} {
  const prompt = (taskPrompt || '').toLowerCase()

  // 1. Explicit user request to open browser
  if (/\b(?:open\s+(?:in\s+)?(?:chrome|browser|edge)|launch\s+browser)\b/i.test(prompt)) {
    return { allowed: true, reason: 'USER_EXPLICIT_BROWSER_REQUEST' }
  }

  // 2. Authentication / Login required
  if (/\b(?:login\s+to|sign\s+in\s+to|authenticated\s+dashboard|my\s+account)\b/i.test(prompt)) {
    return { allowed: true, reason: 'AUTH_REQUIRED' }
  }

  // 3. Interactive form filling or file upload/download via UI
  if (/\b(?:fill\s+out\s+form|upload\s+file\s+on|download\s+from\s+portal)\b/i.test(prompt)) {
    return { allowed: true, reason: 'INTERACTIVE_UI' }
  }

  // All other tasks (search, company research, comparisons, scraping, extraction) do NOT open a browser
  return { allowed: false }
}
