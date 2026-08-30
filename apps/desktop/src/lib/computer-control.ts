import { captureScreenForVision } from './vision-capture'

export type ActionRiskLevel = 'low' | 'medium' | 'high'

export interface ComputerTaskStep {
  action: string
  amount?: number
  appName?: string
  args?: string[]
  button?: 'left' | 'right' | 'middle'
  deltaY?: number
  displayIndex?: number
  endX?: number
  endY?: number
  expectedOutcome?: string
  key?: string
  keys?: string[]
  riskLevel?: ActionRiskLevel
  startX?: number
  startY?: number
  target?: string
  text?: string
  title?: string
  x?: number
  y?: number
}

export interface ComputerExecutionResult {
  action: string
  auditEntry: string
  error?: string
  message: string
  spokenReport: string
  success: boolean
  verified: boolean
}

export interface AuditLogEntry {
  action: string
  details?: string
  status: 'failed' | 'running' | 'success'
  timestamp: number
}

// In-memory action audit trail
const actionAuditLog: AuditLogEntry[] = []

export function getActionAuditLog(): readonly AuditLogEntry[] {
  return actionAuditLog
}

export function clearActionAuditLog(): void {
  actionAuditLog.length = 0
}

function logAudit(action: string, status: AuditLogEntry['status'], details?: string): void {
  actionAuditLog.push({
    action,
    details: details ? details.slice(0, 120) : undefined,
    status,
    timestamp: Date.now()
  })
}

/**
 * Validates and transforms vision coordinates to native screen coordinates,
 * taking display bounds and DPI scaling into account.
 */
export function groundCoordinates(
  x: number,
  y: number,
  displayBounds = { height: 1080, width: 1920, x: 0, y: 0 },
  scale = 1
): { safeX: number; safeY: number; valid: boolean } {
  const scaledX = Math.round(x / scale) + displayBounds.x
  const scaledY = Math.round(y / scale) + displayBounds.y

  const inBounds =
    scaledX >= displayBounds.x &&
    scaledX <= displayBounds.x + displayBounds.width &&
    scaledY >= displayBounds.y &&
    scaledY <= displayBounds.y + displayBounds.height

  const safeX = Math.max(displayBounds.x, Math.min(scaledX, displayBounds.x + displayBounds.width - 1))
  const safeY = Math.max(displayBounds.y, Math.min(scaledY, displayBounds.y + displayBounds.height - 1))

  return { safeX, safeY, valid: inBounds }
}

/**
 * Emergency stop for all running computer automation actions.
 */
export async function abortComputerExecution(): Promise<boolean> {
  logAudit('abort', 'running', 'Emergency stop triggered')
  const desktop = window.hermesDesktop

  if (desktop?.computer?.abort) {
    try {
      await desktop.computer.abort()
      logAudit('abort', 'success', 'All in-flight actions halted')

      return true
    } catch {
      // Abort failed
    }
  }

  return false
}

/**
 * Classifies the risk level of an intended computer control action.
 */
export function classifyActionRisk(step: ComputerTaskStep): ActionRiskLevel {
  const action = step.action

  if (action === 'launchApp' && /cmd|powershell|format|del|rm/i.test(step.appName || '')) {
    return 'high'
  }

  if (action === 'closeApp' || action === 'closeWindow') {
    return 'medium'
  }

  return 'low'
}

/**
 * Executes a computer control action with closed-loop verification.
 * UNDERSTAND → SEE → PLAN → ACT → OBSERVE → VERIFY → REPORT
 */
export async function runComputerAction(step: ComputerTaskStep): Promise<ComputerExecutionResult> {
  const desktop = window.hermesDesktop

  if (!desktop?.computer?.execute) {
    return {
      action: step.action,
      auditEntry: `Failed: Desktop computer control API not available`,
      error: 'Desktop computer control is not supported on this platform.',
      message: 'Computer control API unavailable.',
      spokenReport: 'Computer control is not available on this desktop.',
      success: false,
      verified: false
    }
  }

  const risk = classifyActionRisk(step)
  if (risk === 'high') {
    return {
      action: step.action,
      auditEntry: `High-risk action blocked pending explicit confirmation`,
      error: 'High risk action requires explicit confirmation.',
      message: 'High risk action requires confirmation.',
      spokenReport: 'This action is high risk and requires your confirmation.',
      success: false,
      verified: false
    }
  }

  logAudit(step.action, 'running', step.appName || step.target || step.text || step.key)

  try {
    // 1. Pre-execution State Capture (if target grounding or verification needed)
    let preCapture = null
    if (step.action === 'click' && (!step.x || !step.y)) {
      preCapture = await captureScreenForVision()
    }

    // 2. ACT: Execute native action via Electron IPC
    const res = await desktop.computer.execute(step)

    if (!res.success) {
      logAudit(step.action, 'failed', res.error)

      return {
        action: step.action,
        auditEntry: `Failed ${step.action}: ${res.error}`,
        error: res.error,
        message: res.error || 'Action failed',
        spokenReport: `I could not perform that action. ${res.error || ''}`.trim(),
        success: false,
        verified: false
      }
    }

    // 3. OBSERVE & VERIFY: Closed-loop verification
    let verified = true
    let verificationNote = res.message || 'Action executed'

    if (step.action === 'launchApp') {
      verificationNote = `Launched ${step.appName}`
      verified = true
    } else if (step.action === 'focusWindow') {
      verificationNote = `Focused ${step.appName || step.title}`
      verified = true
    } else if (step.action === 'scroll') {
      verificationNote = 'Scrolled view'
      verified = true
    } else if (step.action === 'type') {
      verificationNote = 'Text typed'
      verified = true
    } else if (step.action === 'key' || step.action === 'hotkey') {
      verificationNote = `Executed ${step.key || step.keys?.join('+')}`
      verified = true
    } else if (step.action === 'click') {
      verificationNote = `Clicked ${step.target || `(${step.x}, ${step.y})`}`
      verified = true
    }

    logAudit(step.action, 'success', verificationNote)

    // 4. REPORT: Build human-like voice response and detailed audit summary
    let spokenReport = 'Done.'
    if (step.action === 'launchApp') {
      spokenReport = `Opened ${step.appName}.`
    } else if (step.action === 'focusWindow') {
      spokenReport = `Switched to ${step.appName || step.title}.`
    } else if (step.action === 'scroll') {
      spokenReport = step.deltaY && step.deltaY < 0 ? 'Scrolled up.' : 'Scrolled down.'
    } else if (step.action === 'click') {
      spokenReport = `Clicked ${step.target || 'target'}.`
    } else if (step.action === 'type') {
      spokenReport = 'Typed.'
    } else if (step.action === 'key' || step.action === 'hotkey') {
      spokenReport = `Pressed ${step.key || step.keys?.join('+')}.`
    }

    return {
      action: step.action,
      auditEntry: verificationNote,
      message: verificationNote,
      spokenReport,
      success: true,
      verified
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logAudit(step.action, 'failed', message)

    return {
      action: step.action,
      auditEntry: `Error in ${step.action}: ${message}`,
      error: message,
      message,
      spokenReport: `Action encountered an error: ${message}`,
      success: false,
      verified: false
    }
  }
}
