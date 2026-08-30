import { beforeEach, describe, expect, it } from 'vitest'

import { JarvisToolRegistry } from './tool-registry'
import { extractTaskRequirements } from './tool-requirements'
import { JarvisToolRouter } from './tool-router'

describe('JARVIS Tool Selection Engine', () => {
  let router: JarvisToolRouter
  let registry: JarvisToolRegistry

  beforeEach(() => {
    registry = JarvisToolRegistry.getInstance()
    router = JarvisToolRouter.getInstance()
    router.abortAll()
  })

  describe('1. Tool Registry & Discovery', () => {
    it('discovers runtime capabilities across local, computer, web, dev, AI, and document categories', async () => {
      const { available } = await registry.discoverRuntimeCapabilities()
      expect(available.length).toBeGreaterThan(5)

      const webTools = registry.list('WEB')
      expect(webTools.some(t => t.id === 'web.search.direct')).toBe(true)

      const localTools = registry.list('LOCAL')
      expect(localTools.some(t => t.id === 'document.pdf_parse')).toBe(true)
      expect(localTools.some(t => t.id === 'spreadsheet.compute')).toBe(true)

      const computerTools = registry.list('COMPUTER')
      expect(computerTools.some(t => t.id === 'computer.launch_app')).toBe(true)
    })

    it('finds tools by dot-separated capability tags', () => {
      const pdfParsers = registry.findByCapability('document.pdf_parse')
      expect(pdfParsers.length).toBeGreaterThanOrEqual(1)
      expect(pdfParsers[0].id).toBe('document.pdf_parse')

      const searchTools = registry.findByCapability('web.search')
      expect(searchTools.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('2. Level 1: Deterministic Operations', () => {
    it('routes "Open Chrome" to computer.launch_app without invoking browser research', () => {
      const decision = router.route('Open Chrome')
      expect(decision.selectedLevel).toBe(1)
      expect(decision.plan.steps[0].toolId).toBe('computer.launch_app')
    })

    it('routes "Press Enter" to computer.key_press', () => {
      const decision = router.route('Press Enter')
      expect(decision.selectedLevel).toBe(1)
      expect(decision.plan.steps[0].toolId).toBe('computer.key_press')
    })

    it('routes "Switch to VS Code" to computer.focus_window', () => {
      const decision = router.route('Switch to VS Code')
      expect(decision.selectedLevel).toBe(1)
      expect(decision.plan.steps[0].toolId).toBe('computer.focus_window')
    })

    it('routes "What is on my screen?" to screen.capture + vision.analyze', () => {
      const decision = router.route('What is on my screen?')
      expect(decision.selectedLevel).toBe(1)
      expect(decision.plan.steps).toHaveLength(2)
      expect(decision.plan.steps[0].toolId).toBe('screen.capture')
      expect(decision.plan.steps[1].toolId).toBe('vision.analyze')
    })
  })

  describe('3. Level 2: Semantic Capability Matching & Scoring', () => {
    it('routes "What is the latest news about OpenAI?" to structured search with BROWSER PENALTY applied', () => {
      const decision = router.route('What is the latest news about OpenAI?')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('web.search.direct')
      // Browser tool should have received a penalty and lost to direct structured search
      const browserScore = decision.candidatesConsidered.find(c => c.toolId === 'web.browser.interactive')?.score ?? 0
      const searchScore = decision.candidatesConsidered.find(c => c.toolId === 'web.search.direct')?.score ?? 0
      expect(searchScore).toBeGreaterThan(browserScore)
    })

    it('routes "Read this PDF and tell me the total amount" to document.pdf_parse (NOT vision/browser)', () => {
      const decision = router.route('Read this PDF and tell me the total amount')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('document.pdf_parse')
    })

    it('routes "Analyze this Excel and find highest sales" to spreadsheet.compute (NOT LLM calculator)', () => {
      const decision = router.route('Analyze this Excel and find highest sales')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('spreadsheet.compute')
    })

    it('routes "Find my agreement" to file.search', () => {
      const decision = router.route('Find my agreement')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('file.search')
    })

    it('routes "Check the server" to terminal.execute', () => {
      const decision = router.route('Check the server')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('terminal.execute')
    })

    it('routes "Create an Excel report" to spreadsheet.write', () => {
      const decision = router.route('Create an Excel report')
      expect(decision.selectedLevel).toBe(2)
      expect(decision.primaryToolId).toBe('spreadsheet.write')
    })
  })

  describe('4. Level 3: Multi-Tool Workflow Planning', () => {
    it('routes "Research 50 AI companies and export them to Excel" into a multi-tool plan', () => {
      const decision = router.route('Research 50 AI companies and export them to Excel')
      expect(decision.selectedLevel).toBe(3)
      expect(decision.plan.steps.length).toBeGreaterThanOrEqual(2)
      expect(decision.plan.steps[0].toolId).toBe('web.research.adaptive')
      expect(decision.plan.steps[1].toolId).toBe('spreadsheet.write')
    })
  })

  describe('5. Plan Execution, Fallback & Verification', () => {
    it('executes a plan successfully and returns verified results', async () => {
      const decision = router.route('Read this PDF and tell me the total amount')
      const execution = await router.executePlan(decision.plan)

      expect(execution.success).toBe(true)
      expect(execution.results).toHaveLength(1)
      expect(execution.results[0].verified).toBe(true)
      expect(execution.results[0].data).toBeDefined()
    })

    it('handles emergency stop / cancellation immediately', async () => {
      const decision = router.route('Research 50 AI companies and export them to Excel')
      const abortController = new AbortController()

      // Trigger abort immediately
      abortController.abort()

      const execution = await router.executePlan(decision.plan, { abortSignal: abortController.signal })
      expect(execution.success).toBe(false)
    })
  })

  describe('6. Browser & Vision Penalties & User Overrides', () => {
    it('applies browser penalty for ordinary research tasks', () => {
      const req = extractTaskRequirements('Research Parionyx Tech Solutions')
      expect(req.requiresBrowser).toBe(false)

      const browserTool = registry.get('web.browser.interactive')!
      const directSearchTool = registry.get('web.search.direct')!

      const browserScore = router.scoreTool(browserTool, req)
      const directSearchScore = router.scoreTool(directSearchTool, req)

      expect(directSearchScore).toBeGreaterThan(browserScore)
    })

    it('respects explicit user tool overrides when requested', () => {
      const req = extractTaskRequirements('Use exa to search for AI trends')
      expect(req.explicitTool).toBe('web.search.exa')
    })
  })
})
