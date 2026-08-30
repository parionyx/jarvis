import { describe, expect, it } from 'vitest'

import { detectComputerIntent, isComputerControlIntent } from './computer-intent'

describe('computer-intent detection', () => {
  it('detects emergency stop commands', () => {
    const stops = ['stop', 'Stop', 'RUKO', 'ruko', 'ruk jao', 'bas', 'cancel', 'band karo']
    for (const phrase of stops) {
      const res = detectComputerIntent(phrase)
      expect(res.isComputerControl).toBe(true)
      expect(res.action?.action).toBe('abort')
      expect(res.requiresVision).toBe(false)
    }
  })

  it('detects application launch intents', () => {
    const chrome = detectComputerIntent('Open Chrome')
    expect(chrome.isComputerControl).toBe(true)
    expect(chrome.action?.action).toBe('launchApp')
    expect(chrome.action?.appName).toBe('chrome')
    expect(chrome.requiresVision).toBe(false)

    const vscode = detectComputerIntent('Hey JARVIS, launch VS Code')
    expect(vscode.isComputerControl).toBe(true)
    expect(vscode.action?.action).toBe('launchApp')
    expect(vscode.action?.appName).toBe('vs code')

    const notepad = detectComputerIntent('notepad kholo')
    expect(notepad.isComputerControl).toBe(true)
    expect(notepad.action?.action).toBe('launchApp')
  })

  it('detects window switch / focus intents', () => {
    const res = detectComputerIntent('Switch to VS Code')
    expect(res.isComputerControl).toBe(true)
    expect(res.action?.action).toBe('focusWindow')
    expect(res.action?.appName).toBe('vs code')

    const focusChrome = detectComputerIntent('Focus Chrome')
    expect(focusChrome.isComputerControl).toBe(true)
    expect(focusChrome.action?.action).toBe('focusWindow')
  })

  it('detects window minimization, maximization, and close', () => {
    const min = detectComputerIntent('Minimize window')
    expect(min.isComputerControl).toBe(true)
    expect(min.action?.action).toBe('minimizeWindow')

    const max = detectComputerIntent('Maximize this window')
    expect(max.isComputerControl).toBe(true)
    expect(max.action?.action).toBe('maximizeWindow')

    const close = detectComputerIntent('Close Chrome')
    expect(close.isComputerControl).toBe(true)
    expect(close.action?.action).toBe('closeApp')
    expect(close.action?.appName).toBe('chrome')
  })

  it('detects scrolling', () => {
    const down = detectComputerIntent('Scroll down')
    expect(down.isComputerControl).toBe(true)
    expect(down.action?.action).toBe('scroll')
    expect(down.action?.deltaY).toBeGreaterThan(0)

    const up = detectComputerIntent('Neeche scroll karo')
    expect(up.isComputerControl).toBe(true)
    expect(up.action?.action).toBe('scroll')
  })

  it('detects text typing', () => {
    const typeRes = detectComputerIntent('Type hello JARVIS')
    expect(typeRes.isComputerControl).toBe(true)
    expect(typeRes.action?.action).toBe('type')
    expect(typeRes.action?.text).toBe('hello JARVIS')

    const typeCrm = detectComputerIntent('Type "ONEX CRM"')
    expect(typeCrm.isComputerControl).toBe(true)
    expect(typeCrm.action?.action).toBe('type')
    expect(typeCrm.action?.text).toBe('ONEX CRM')
  })

  it('detects keyboard keys and hotkeys', () => {
    const enter = detectComputerIntent('Press Enter')
    expect(enter.isComputerControl).toBe(true)
    expect(enter.action?.action).toBe('key')
    expect(enter.action?.key).toBe('Return')

    const esc = detectComputerIntent('Press Escape')
    expect(esc.isComputerControl).toBe(true)
    expect(esc.action?.action).toBe('key')
    expect(esc.action?.key).toBe('Escape')

    const ctrlA = detectComputerIntent('Press control A')
    expect(ctrlA.isComputerControl).toBe(true)
    expect(ctrlA.action?.action).toBe('hotkey')
    expect(ctrlA.action?.keys).toEqual(['ctrl', 'a'])
  })

  it('detects visual target clicking and flags vision requirement', () => {
    const clickSubmit = detectComputerIntent('Click the submit button')
    expect(clickSubmit.isComputerControl).toBe(true)
    expect(clickSubmit.action?.action).toBe('click')
    expect(clickSubmit.action?.target).toBe('submit')
    expect(clickSubmit.requiresVision).toBe(true)

    const clickLogin = detectComputerIntent('Click on login link')
    expect(clickLogin.isComputerControl).toBe(true)
    expect(clickLogin.action?.action).toBe('click')
    expect(clickLogin.requiresVision).toBe(true)
  })

  it('ignores general conversational and knowledge queries', () => {
    expect(isComputerControlIntent('What is the weather today?')).toBe(false)
    expect(isComputerControlIntent('Explain how transformer models work')).toBe(false)
    expect(isComputerControlIntent('Aaj kitne leads aaye hain?')).toBe(false)
  })
})
