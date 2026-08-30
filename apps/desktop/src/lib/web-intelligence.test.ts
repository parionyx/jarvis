import { beforeEach, describe, expect, it } from 'vitest'

import {
  abortWebResearch,
  clearWebCache,
  compareEntities,
  deduplicateUrls,
  evaluateSourceQuality,
  executeWebResearch,
  exportDataset,
  getCached,
  resolveEntityName,
  setCache
} from './web-intelligence'

describe('web-intelligence engine', () => {
  beforeEach(() => {
    clearWebCache()
  })

  it('deduplicates URLs and strips tracking parameters', () => {
    const raw = [
      'https://example.com/page?utm_source=twitter&utm_medium=social',
      'https://example.com/page?ref=producthunt',
      'https://example.com/page/',
      'https://other.org/article'
    ]

    const deduped = deduplicateUrls(raw)
    expect(deduped).toEqual(['https://example.com/page', 'https://other.org/article'])
  })

  it('resolves entity names across various source variations', () => {
    expect(resolveEntityName('Notion Labs Inc.')).toBe('Notion Labs')
    expect(resolveEntityName('Acme Corp — Leading AI Provider')).toBe('Acme')
    expect(resolveEntityName('Stripe Pvt Ltd')).toBe('Stripe')
  })

  it('evaluates source quality correctly based on domain credibility', () => {
    expect(evaluateSourceQuality('https://docs.anthropic.com', 'docs.anthropic.com')).toBeGreaterThanOrEqual(0.9)
    expect(evaluateSourceQuality('https://en.wikipedia.org/wiki/AI', 'wikipedia.org')).toBeGreaterThanOrEqual(0.9)
    expect(evaluateSourceQuality('https://spam-click.biz', 'spam-click.biz')).toBeLessThan(0.5)
  })

  it('executes web research and provides structured findings with facts, inferences, and citations', async () => {
    const result = await executeWebResearch('Latest developments in AI reasoning models', 'normal')

    expect(result.facts.length).toBeGreaterThanOrEqual(1)
    expect(result.citations.length).toBeGreaterThanOrEqual(1)
    expect(result.sources.length).toBeGreaterThanOrEqual(1)
    expect(result.spokenSummary).toBeDefined()
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('compares entities across criteria with transparent scoring and recommendation', () => {
    const entities = ['Next.js', 'Remix', 'Vite']
    const criteria = ['performance', 'routing', 'ecosystem']

    const comparison = compareEntities(entities, criteria)
    expect(comparison.entities).toEqual(entities)
    expect(comparison.ranked.length).toBe(3)
    expect(comparison.ranked[0].score).toBeGreaterThanOrEqual(comparison.ranked[1].score)
    expect(comparison.recommendation).toContain('Next.js')
    expect(comparison.tradeoffs.length).toBeGreaterThanOrEqual(1)
  })

  it('exports datasets to CSV, JSON, and Markdown formats accurately', () => {
    const headers = ['Tool', 'Rating', 'Price']
    const rows = [
      ['Next.js', 9.2, 'Free'],
      ['Remix', 8.8, 'Free']
    ]

    const csv = exportDataset(headers, rows, 'csv')
    expect(csv).toContain('Tool,Rating,Price')
    expect(csv).toContain('Next.js,9.2,Free')

    const json = exportDataset(headers, rows, 'json')
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].Tool).toBe('Next.js')

    const md = exportDataset(headers, rows, 'markdown')
    expect(md).toContain('| Tool | Rating | Price |')
    expect(md).toContain('| Next.js | 9.2 | Free |')
  })

  it('supports caching and cache expiration', () => {
    setCache('test_key', { value: 123 }, 5000)
    expect(getCached('test_key')).toEqual({ value: 123 })

    clearWebCache()
    expect(getCached('test_key')).toBeNull()
  })

  it('handles emergency stop and cancellation', () => {
    const stopped = abortWebResearch()
    expect(stopped).toBe(true)
  })

  it('performs full-profile entity research for Parionyx Tech Solutions with facts, inferences, and citations without browser', async () => {
    const result = await executeWebResearch('Research Parionyx Tech Solutions and give me full details.', 'deep')

    expect(result.facts.some(f => f.includes('Parionyx Tech Solutions'))).toBe(true)
    expect(result.facts.some(f => f.includes('OneX CRM'))).toBe(true)
    expect(result.facts.some(f => f.includes('Gurugram'))).toBe(true)
    expect(result.inferences.length).toBeGreaterThanOrEqual(1)
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1)
    expect(result.citations).toContain('https://parionyx.com')
    expect(result.providerUsed).toBeDefined()
    expect(result.spokenSummary).toContain('Parionyx Tech Solutions')
  })
})
