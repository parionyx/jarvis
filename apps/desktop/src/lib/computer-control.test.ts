import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  abortComputerExecution,
  classifyActionRisk,
  clearActionAuditLog,
  getActionAuditLog,
  groundCoordinates,
  runComputerAction
} from './computer-control'

describe('computer-control service', () => {
  beforeEach(() => {
    clearActionAuditLog()
    vi.restoreAllMocks()
  })

  it('groundCoordinates correctly maps coordinates and validates boundaries', () => {
    // 1080p display at scale 1
    const bounds = { height: 1080, width: 1920, x: 0, y: 0 }

    const normal = groundCoordinates(500, 300, bounds, 1)
    expect(normal.valid).toBe(true)
    expect(normal.safeX).toBe(500)
    expect(normal.safeY).toBe(300)

    // With 125% DPI scale factor
    const scaled = groundCoordinates(1250, 1000, bounds, 1.25)
    expect(scaled.valid).toBe(true)
    expect(scaled.safeX).toBe(1000)
    expect(scaled.safeY).toBe(800)

    // Clamps off-screen coordinates safely
    const offscreen = groundCoordinates(2500, 1500, bounds, 1)
    expect(offscreen.valid).toBe(false)
    expect(offscreen.safeX).toBe(1919)
    expect(offscreen.safeY).toBe(1079)

    // Secondary monitor with offset
    const secondaryBounds = { height: 1080, width: 1920, x: 1920, y: 0 }
    const secondary = groundCoordinates(100, 200, secondaryBounds, 1)
    expect(secondary.safeX).toBe(2020)
    expect(secondary.safeY).toBe(200)
  })

  it('classifies risk levels accurately', () => {
    expect(classifyActionRisk({ action: 'launchApp', appName: 'chrome' })).toBe('low')
    expect(classifyActionRisk({ action: 'focusWindow', appName: 'vscode' })).toBe('low')
    expect(classifyActionRisk({ action: 'scroll', deltaY: 500 })).toBe('low')
    expect(classifyActionRisk({ action: 'type', text: 'hello' })).toBe('low')

    expect(classifyActionRisk({ action: 'closeApp', appName: 'chrome' })).toBe('medium')
    expect(classifyActionRisk({ action: 'closeWindow' })).toBe('medium')

    expect(classifyActionRisk({ action: 'launchApp', appName: 'cmd.exe /c del' })).toBe('high')
  })

  it('aborts execution via native IPC bridge', async () => {
    const mockAbort = vi.fn().mockResolvedValue({ success: true })
    ;(window as any).hermesDesktop = {
      computer: { abort: mockAbort, execute: vi.fn() }
    }

    const aborted = await abortComputerExecution()
    expect(aborted).toBe(true)
    expect(mockAbort).toHaveBeenCalledTimes(1)

    const audit = getActionAuditLog()
    expect(audit.some(entry => entry.action === 'abort')).toBe(true)
  })

  it('runs computer actions closed loop and maintains audit trail', async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      message: 'Launched chrome',
      success: true
    })
    ;(window as any).hermesDesktop = {
      computer: { abort: vi.fn(), execute: mockExecute }
    }

    const result = await runComputerAction({ action: 'launchApp', appName: 'chrome' })
    expect(result.success).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.spokenReport).toBe('Opened chrome.')

    const audit = getActionAuditLog()
    expect(audit.length).toBeGreaterThanOrEqual(1)
    expect(audit[audit.length - 1].status).toBe('success')
  })
})
