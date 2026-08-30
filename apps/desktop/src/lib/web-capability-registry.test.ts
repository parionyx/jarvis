import { beforeEach, describe, expect, it } from 'vitest'

import {
  evaluateBrowserRequirement,
  getCapabilityMap,
  initWebCapabilityRegistry,
  markProviderBlocked,
  registerProvider,
  resetProviderBlockStatuses,
  selectBestProvider,
  type WebProvider
} from './web-capability-registry'

describe('web-capability-registry & provider discovery', () => {
  beforeEach(() => {
    initWebCapabilityRegistry()
    resetProviderBlockStatuses()
  })

  it('discovers and categorizes available providers in runtime capability map', async () => {
    const map = await getCapabilityMap()

    expect(map.search.available).toContain('Direct_HTTP_Search')
    expect(map.fetch.available).toContain('Direct_HTTP_Fetch')
    expect(map.extract.available).toContain('Readability_Extractor')
  })

  it('selects best provider based on priority and availability', async () => {
    const highPriorityProvider: WebProvider = {
      isAvailable: () => true,
      name: 'Custom_MCP_Search',
      priority: 2,
      status: 'AVAILABLE',
      type: 'search'
    }
    registerProvider(highPriorityProvider)

    const selected = await selectBestProvider('search')
    expect(selected?.name).toBe('Custom_MCP_Search')
  })

  it('skips unavailable providers automatically', async () => {
    const unavailableProvider: WebProvider = {
      isAvailable: () => false,
      name: 'Unconfigured_Tavily',
      priority: 1,
      status: 'AVAILABLE',
      type: 'search'
    }
    registerProvider(unavailableProvider)

    const selected = await selectBestProvider('search')
    expect(selected?.name).toBe('Direct_HTTP_Search')
  })

  it('falls back to next provider when current provider is blocked by anti-bot', async () => {
    const providerA: WebProvider = {
      isAvailable: () => true,
      name: 'Search_Provider_A',
      priority: 3,
      status: 'AVAILABLE',
      type: 'search'
    }
    const providerB: WebProvider = {
      isAvailable: () => true,
      name: 'Search_Provider_B',
      priority: 5,
      status: 'AVAILABLE',
      type: 'search'
    }
    registerProvider(providerA)
    registerProvider(providerB)

    let current = await selectBestProvider('search')
    expect(current?.name).toBe('Search_Provider_A')

    // Mark Provider A blocked (e.g. Anti-bot triggered)
    markProviderBlocked('Search_Provider_A')

    current = await selectBestProvider('search')
    expect(current?.name).toBe('Search_Provider_B')
  })

  it('STRICTLY GATES BROWSER: never opens browser for company research, comparisons, or searches', () => {
    // Parionyx research request: MUST NOT OPEN BROWSER
    const parionyx = evaluateBrowserRequirement('Research Parionyx Tech Solutions and give me full details.')
    expect(parionyx.allowed).toBe(false)

    // General search: MUST NOT OPEN BROWSER
    const search = evaluateBrowserRequirement('Search for latest AI news')
    expect(search.allowed).toBe(false)

    // Comparison: MUST NOT OPEN BROWSER
    const compare = evaluateBrowserRequirement('Compare Notion vs Obsidian')
    expect(compare.allowed).toBe(false)

    // Explicit browser request: ALLOWED
    const explicit = evaluateBrowserRequirement('Open Chrome and go to youtube.com')
    expect(explicit.allowed).toBe(true)
    expect(explicit.reason).toBe('USER_EXPLICIT_BROWSER_REQUEST')

    // Authenticated portal: ALLOWED
    const auth = evaluateBrowserRequirement('Login to my AWS dashboard')
    expect(auth.allowed).toBe(true)
    expect(auth.reason).toBe('AUTH_REQUIRED')
  })
})
