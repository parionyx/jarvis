import { describe, expect, it } from 'vitest'

import { detectWebIntent } from './web-intent'

describe('web-intent classification', () => {
  it('detects direct URLs for web extraction', () => {
    const res = detectWebIntent('Check out https://stripe.com/pricing for me')
    expect(res.isWebTask).toBe(true)
    expect(res.taskType).toBe('extract')
    expect(res.targetUrl).toBe('https://stripe.com/pricing')
  })

  it('detects export requests with format specification', () => {
    const csv = detectWebIntent('Export this comparison to CSV')
    expect(csv.isWebTask).toBe(true)
    expect(csv.taskType).toBe('export')
    expect(csv.exportFormat).toBe('csv')

    const json = detectWebIntent('Save data as JSON')
    expect(json.isWebTask).toBe(true)
    expect(json.taskType).toBe('export')
    expect(json.exportFormat).toBe('json')

    const excel = detectWebIntent('Export to Excel')
    expect(excel.isWebTask).toBe(true)
    expect(excel.exportFormat).toBe('xlsx')
  })

  it('detects multi-entity comparison tasks', () => {
    const res = detectWebIntent('Compare Notion vs Obsidian vs Logseq')
    expect(res.isWebTask).toBe(true)
    expect(res.taskType).toBe('compare')
    expect(res.entities?.length).toBeGreaterThanOrEqual(2)
    expect(res.comparisonCriteria).toContain('pricing')
    expect(res.depth).toBe('deep')

    const twoEntities = detectWebIntent('Which is better: Next.js or Remix')
    expect(twoEntities.taskType).toBe('compare')
    expect(twoEntities.entities).toEqual(['Next.js', 'Remix'])
  })

  it('detects recommendation / best requests', () => {
    const res = detectWebIntent('Find the best noise cancelling headphones under $300')
    expect(res.isWebTask).toBe(true)
    expect(res.taskType).toBe('recommend')
    expect(res.comparisonCriteria).toContain('quality')
  })

  it('detects top-N entity discovery with adaptive depth', () => {
    const top5 = detectWebIntent('Top 5 CRM tools for startups')
    expect(top5.isWebTask).toBe(true)
    expect(top5.taskType).toBe('top_n')
    expect(top5.depth).toBe('normal')

    const top50 = detectWebIntent('Find 50 AI companies')
    expect(top50.isWebTask).toBe(true)
    expect(top50.taskType).toBe('top_n')
    expect(top50.depth).toBe('deep')
  })

  it('detects deep research requests', () => {
    const res = detectWebIntent('Deep research on quantum error correction')
    expect(res.isWebTask).toBe(true)
    expect(res.taskType).toBe('research')
    expect(res.depth).toBe('deep')
  })

  it('detects fast factual search lookups', () => {
    const search = detectWebIntent('What is the latest score of India vs England?')
    expect(search.isWebTask).toBe(true)
    expect(search.taskType).toBe('search')
    expect(search.depth).toBe('fast')
  })

  it('ignores non-web general instructions', () => {
    const general = detectWebIntent('Hello JARVIS, how are you?')
    expect(general.isWebTask).toBe(false)
    expect(general.taskType).toBe('general')
  })
})
