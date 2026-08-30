import { describe, expect, it, vi } from 'vitest'

import { detectVisionIntent, isVisionIntent } from './vision-intent'
import { $visionEnabled, setVisionEnabled } from '@/store/vision-prefs'
import { captureScreenForVision, clearVisualContext } from './vision-capture'

describe('JARVIS Vision Intent Detection', () => {
  it('detects strong vision intent phrases accurately', () => {
    const strongPhrases = [
      'Hey Jarvis, what is on my screen?',
      'Look at my screen',
      'What do you see?',
      'Look at this',
      "What's wrong with this screen?",
      "What's wrong with this page?",
      'What error am I getting?',
      'Read this table',
      'Where is the submit button?',
      'Find the login button',
      'What application is open?',
      'What page am I on?',
      'Explain what is visible on the screen',
      'Can you see my screen?'
    ]

    for (const phrase of strongPhrases) {
      const result = detectVisionIntent(phrase)
      expect(result.isVision, `Expected "${phrase}" to be recognized as vision intent`).toBe(true)
      expect(result.confidence).toBe('strong')
    }
  })

  it('detects contextual vision phrases', () => {
    const contextualPhrases = [
      "What's wrong here?",
      'What is this?',
      'Explain this',
      'Describe this'
    ]

    for (const phrase of contextualPhrases) {
      const result = detectVisionIntent(phrase)
      expect(result.isVision, `Expected contextual "${phrase}" to be recognized`).toBe(true)
      expect(result.confidence).toBe('contextual')
    }
  })

  it('rejects general non-vision queries', () => {
    const nonVisionPhrases = [
      "What's the capital of France?",
      'How do I implement binary search in TypeScript?',
      'Write a python script to parse CSV files',
      'Hello Jarvis, how are you today?',
      'Tell me a joke',
      'What is 42 * 17?'
    ]

    for (const phrase of nonVisionPhrases) {
      const result = detectVisionIntent(phrase)
      expect(result.isVision, `Expected "${phrase}" to NOT be vision intent`).toBe(false)
      expect(result.confidence).toBe('none')
    }
  })

  it('supports spatial follow-up queries only when active visual context is present', () => {
    const followUp = 'What about the top right section?'

    // Without visual context -> false
    expect(isVisionIntent(followUp, false)).toBe(false)

    // With visual context -> true
    expect(isVisionIntent(followUp, true)).toBe(true)
  })
})

describe('JARVIS Vision Capture Service & Privacy', () => {
  it('respects privacy toggle when vision is disabled', async () => {
    setVisionEnabled(false)

    const result = await captureScreenForVision()
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('privacy settings')

    // Re-enable for subsequent tests
    setVisionEnabled(true)
  })

  it('captures screen and constructs ComposerAttachment when vision is enabled', async () => {
    setVisionEnabled(true)
    clearVisualContext()

    const mockCaptureScreen = vi.fn(async () => ({
      activeWindow: { appName: 'VS Code', windowTitle: 'main.ts', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      dataUrl: 'data:image/png;base64,mockPngData',
      filePath: 'C:\\Users\\works_ar\\AppData\\Local\\hermes\\composer-images\\composer_test.png',
      height: 1080,
      scale: 1,
      width: 1920
    }))

    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = {
      captureScreen: mockCaptureScreen
    }

    const result = await captureScreenForVision()
    expect(result.allowed).toBe(true)
    expect(result.filePath).toBe('C:\\Users\\works_ar\\AppData\\Local\\hermes\\composer-images\\composer_test.png')
    expect(result.attachment).toBeDefined()
    expect(result.attachment?.kind).toBe('image')
    expect(result.attachment?.path).toBe(result.filePath)
    expect(result.contextHeader).toContain('VS Code')
    expect(result.contextHeader).toContain('1920x1080')
  })
})
