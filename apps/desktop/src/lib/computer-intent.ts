/**
 * JARVIS Phase 3: Computer Control Intent Recognition
 * Extracts structured action requests from natural voice/text commands.
 */

export interface ComputerIntentResult {
  action?: {
    action: string
    amount?: number
    appName?: string
    args?: string[]
    button?: 'left' | 'right' | 'middle'
    deltaY?: number
    key?: string
    keys?: string[]
    target?: string
    text?: string
    title?: string
    x?: number
    y?: number
  }
  confidence: 'high' | 'medium' | 'none'
  isComputerControl: boolean
  requiresVision: boolean
  spokenSummary: string
}

const COMMON_APPS = [
  'chrome',
  'google chrome',
  'vscode',
  'vs code',
  'visual studio code',
  'notepad',
  'calculator',
  'calc',
  'spotify',
  'edge',
  'microsoft edge',
  'terminal',
  'powershell',
  'cmd',
  'explorer',
  'file explorer'
]

/**
 * Normalizes app name from spoken or typed variations.
 */
function extractAppName(text: string): string | null {
  const lower = text.toLowerCase()

  for (const app of COMMON_APPS) {
    const regex = new RegExp(`\\b${app}\\b`, 'i')
    if (regex.test(lower)) {
      return app
    }
  }

  // Fallback for general word following open/launch/switch to or before kholo
  const match = lower.match(/\b(?:open|launch|switch\s+to|focus|kholo)\s+([a-z0-9_\-]+)\b/i) || lower.match(/\b([a-z0-9_\-]+)\s+(?:kholo|chalao|start|open)\b/i)
  if (match && match[1] && !['the', 'a', 'this', 'that', 'my', 'your'].includes(match[1])) {
    return match[1]
  }

  return null
}

export function detectComputerIntent(rawPrompt: string): ComputerIntentResult {
  const normalized = (rawPrompt || '').trim()

  if (!normalized) {
    return { confidence: 'none', isComputerControl: false, requiresVision: false, spokenSummary: '' }
  }

  // 1. Emergency Stop / Abort
  if (/^(?:stop|cancel|ruko|ruk\s*jao|bas|band\s*karo|chup|shant)$/i.test(normalized)) {
    return {
      action: { action: 'abort' },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: 'Stopping all actions.'
    }
  }

  // 2. Application Launch (*"Open Chrome"*, *"Launch VS Code"*, *"Chrome kholo"*, *"notepad kholo"*)
  const launchMatch =
    normalized.match(/^(?:hey\s+jarvis[,\s]*)?(?:open|launch|start|kholo)\s+(.+)$/i) ||
    normalized.match(/^(?:hey\s+jarvis[,\s]*)?(.+?)\s+(?:kholo|chalao|start|open|launch)$/i)
  if (launchMatch && !normalized.toLowerCase().includes('file') && !normalized.toLowerCase().includes('tab')) {
    const app = extractAppName(launchMatch[1])
    if (app) {
      return {
        action: { action: 'launchApp', appName: app },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: `Opened ${app}.`
      }
    }
  }

  // 3. Window Switch / Focus (*"Switch to VS Code"*, *"Focus Chrome"*, *"Go to Notepad"*)
  const switchMatch = normalized.match(/^(?:hey\s+jarvis[,\s]*)?(?:switch\s+to|focus|go\s+to|par\s+jao)\s+(.+)$/i)
  if (switchMatch) {
    const app = extractAppName(switchMatch[1])
    if (app) {
      return {
        action: { action: 'focusWindow', appName: app },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: `Switched to ${app}.`
      }
    }
  }

  // 4. Window State Management (*"Minimize window"*, *"Maximize window"*, *"Close window"*, *"Close Chrome"*)
  if (/\b(?:minimize|chhota\s+karo)\s+(?:this\s+)?(?:window|app)?\b/i.test(normalized)) {
    return {
      action: { action: 'minimizeWindow' },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: 'Window minimized.'
    }
  }

  if (/\b(?:maximize|bada\s+karo)\s+(?:this\s+)?(?:window|app)?\b/i.test(normalized)) {
    return {
      action: { action: 'maximizeWindow' },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: 'Window maximized.'
    }
  }

  const closeMatch = normalized.match(/^(?:hey\s+jarvis[,\s]*)?(?:close|band\s+karo)\s+(.+)$/i)
  if (closeMatch) {
    const app = extractAppName(closeMatch[1])
    return {
      action: { action: 'closeApp', appName: app || 'window' },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: `Closed ${app || 'window'}.`
    }
  }

  // 5. Scrolling (*"Scroll down"*, *"Scroll up"*, *"Neeche scroll karo"*)
  if (/\b(?:scroll\s+down|neeche\s+scroll|scroll\s+bottom)\b/i.test(normalized)) {
    return {
      action: { action: 'scroll', deltaY: 500 },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: 'Scrolled down.'
    }
  }

  if (/\b(?:scroll\s+up|upar\s+scroll|scroll\s+top)\b/i.test(normalized)) {
    return {
      action: { action: 'scroll', deltaY: -500 },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: 'Scrolled up.'
    }
  }

  // 6. Keyboard Typing (*"Type hello world"*, *"Type ONEX CRM"*)
  const typeMatch = normalized.match(/^(?:hey\s+jarvis[,\s]*)?(?:type|write|likho)\s+["']?(.+?)["']?$/i)
  if (typeMatch && typeMatch[1]) {
    return {
      action: { action: 'type', text: typeMatch[1] },
      confidence: 'high',
      isComputerControl: true,
      requiresVision: false,
      spokenSummary: `Typed.`
    }
  }

  // 7. Keyboard Hotkey / Keys (*"Press Enter"*, *"Press Escape"*, *"Press Ctrl+A"*, *"Press control C"*)
  const keyMatch = normalized.match(/^(?:hey\s+jarvis[,\s]*)?(?:press|hit|dabaao)\s+(.+)$/i)
  if (keyMatch) {
    const rawKey = keyMatch[1].trim()

    if (/^(?:enter|return)$/i.test(rawKey)) {
      return {
        action: { action: 'key', key: 'Return' },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: 'Pressed Enter.'
      }
    }

    if (/^(?:esc|escape)$/i.test(rawKey)) {
      return {
        action: { action: 'key', key: 'Escape' },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: 'Pressed Escape.'
      }
    }

    if (/^(?:tab)$/i.test(rawKey)) {
      return {
        action: { action: 'key', key: 'Tab' },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: 'Pressed Tab.'
      }
    }

    const hotkeyMatch = rawKey.match(/(?:ctrl|control|alt|shift|meta|cmd)\s*(?:\+|\s+)?([a-z0-9])/i)
    if (hotkeyMatch) {
      const modifier = rawKey.toLowerCase().includes('alt')
        ? 'alt'
        : rawKey.toLowerCase().includes('shift')
          ? 'shift'
          : 'ctrl'
      const keyChar = hotkeyMatch[1].toLowerCase()

      return {
        action: { action: 'hotkey', keys: [modifier, keyChar] },
        confidence: 'high',
        isComputerControl: true,
        requiresVision: false,
        spokenSummary: `Pressed ${modifier}+${keyChar}.`
      }
    }
  }

  // 8. Visual Actions (*"Click the submit button"*, *"Click on login"*, *"Click that blue link"*)
  const clickMatch = normalized.match(
    /^(?:hey\s+jarvis[,\s]*)?(?:click(?:\s+on)?|tap(?:\s+on)?|press)\s+(?:the\s+)?(.+?)(?:\s+button|\s+link|\s+icon)?$/i
  )
  if (clickMatch && !/^(?:enter|escape|tab|space|ctrl|alt)$/i.test(clickMatch[1])) {
    return {
      action: { action: 'click', target: clickMatch[1] },
      confidence: 'medium',
      isComputerControl: true,
      requiresVision: true,
      spokenSummary: `Clicked ${clickMatch[1]}.`
    }
  }

  return { confidence: 'none', isComputerControl: false, requiresVision: false, spokenSummary: '' }
}

export function isComputerControlIntent(prompt: string): boolean {
  return detectComputerIntent(prompt).isComputerControl
}
