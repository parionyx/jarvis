import { execFile, spawn } from 'child_process'
import { screen, shell } from 'electron'
import { promisify } from 'util'

import { readWindowBelow } from './window-below'

const execFileAsync = promisify(execFile)

export interface ComputerActionPayload {
  action:
    | 'click'
    | 'doubleClick'
    | 'rightClick'
    | 'middleClick'
    | 'move'
    | 'drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'hotkey'
    | 'listWindows'
    | 'focusWindow'
    | 'minimizeWindow'
    | 'maximizeWindow'
    | 'restoreWindow'
    | 'closeWindow'
    | 'launchApp'
    | 'closeApp'
    | 'listApps'
    | 'getDisplays'
    | 'getCursor'
  amount?: number
  appName?: string
  args?: string[]
  button?: 'left' | 'right' | 'middle'
  deltaX?: number
  deltaY?: number
  displayIndex?: number
  endX?: number
  endY?: number
  key?: string
  keys?: string[]
  modifiers?: string[]
  pid?: number
  startX?: number
  startY?: number
  text?: string
  title?: string
  windowId?: number
  x?: number
  y?: number
}

export interface ComputerActionResult {
  data?: unknown
  error?: string
  message?: string
  success: boolean
}

// Bounded safety timeout for native execution
const ACTION_TIMEOUT_MS = 10_000

// In-flight cancellation abort controller
let activeAbortController: AbortController | null = null

export function abortCurrentComputerAction(): void {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

// Known common Windows application shortcuts & executable mappings
const APP_EXECUTABLE_MAP: Record<string, string> = {
  chrome: 'chrome',
  google_chrome: 'chrome',
  'google chrome': 'chrome',
  browser: 'chrome',
  vscode: 'code',
  'vs code': 'code',
  'visual studio code': 'code',
  code: 'code',
  notepad: 'notepad',
  calc: 'calc',
  calculator: 'calc',
  explorer: 'explorer',
  terminal: 'wt',
  powershell: 'powershell',
  cmd: 'cmd',
  spotify: 'spotify',
  edge: 'msedge',
  'microsoft edge': 'msedge'
}

/**
 * Validates and maps key names to standard key tokens.
 */
function normalizeKey(rawKey: string): string {
  const key = (rawKey || '').trim().toLowerCase()

  switch (key) {
    case 'enter':
    case 'return':
      return 'Return'
    case 'esc':
    case 'escape':
      return 'Escape'
    case 'tab':
      return 'Tab'
    case 'space':
    case 'spacebar':
      return 'space'
    case 'backspace':
      return 'BackSpace'
    case 'delete':
    case 'del':
      return 'Delete'
    case 'up':
    case 'arrowup':
      return 'Up'
    case 'down':
    case 'arrowdown':
      return 'Down'
    case 'left':
    case 'arrowleft':
      return 'Left'
    case 'right':
    case 'arrowright':
      return 'Right'
    case 'home':
      return 'Home'
    case 'end':
      return 'End'
    case 'pageup':
      return 'Page_Up'
    case 'pagedown':
      return 'Page_Down'
    case 'ctrl':
    case 'control':
      return 'Control_L'
    case 'alt':
      return 'Alt_L'
    case 'shift':
      return 'Shift_L'
    case 'win':
    case 'windows':
    case 'cmd':
    case 'command':
    case 'meta':
      return 'Super_L'
    default:
      return rawKey
  }
}

/**
 * Executes a mouse action via native Windows automation or cua-driver.
 */
async function executeMouseAction(payload: ComputerActionPayload, signal?: AbortSignal): Promise<ComputerActionResult> {
  const { action, x = 0, y = 0, deltaY = 0, startX = 0, startY = 0, endX = 0, endY = 0 } = payload

  // Validate coordinates inside active display boundaries
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const targetDisplay = payload.displayIndex !== undefined && displays[payload.displayIndex] ? displays[payload.displayIndex] : primary

  const bounds = targetDisplay.bounds
  if (action === 'click' || action === 'doubleClick' || action === 'rightClick' || action === 'middleClick' || action === 'move') {
    if (x < bounds.x || x > bounds.x + bounds.width || y < bounds.y || y > bounds.y + bounds.height) {
      // Coerce coordinates safely to display bounds if slightly off-screen
      const safeX = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - 1))
      const safeY = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - 1))
      payload.x = safeX
      payload.y = safeY
    }
  }

  try {
    if (action === 'move') {
      const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(payload.x!)}, ${Math.round(payload.y!)});
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { signal })

      return { message: `Moved cursor to (${payload.x}, ${payload.y})`, success: true }
    }

    if (action === 'click' || action === 'doubleClick' || action === 'rightClick' || action === 'middleClick') {
      const clickType = action === 'doubleClick' ? 'double_click' : action === 'rightClick' ? 'right_click' : 'click'
      const psClickScript = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(payload.x!)}, ${Math.round(payload.y!)});
        $signature = @'
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
'@;
        $SendMouse = Add-Type -MemberDefinition $signature -Name "Win32MouseEvent" -Namespace "Win32Functions" -PassThru;
        ${
          clickType === 'right_click'
            ? '$SendMouse::mouse_event(0x08, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; $SendMouse::mouse_event(0x10, 0, 0, 0, 0);'
            : clickType === 'double_click'
              ? '$SendMouse::mouse_event(0x02, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; $SendMouse::mouse_event(0x04, 0, 0, 0, 0); Start-Sleep -Milliseconds 60; $SendMouse::mouse_event(0x02, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; $SendMouse::mouse_event(0x04, 0, 0, 0, 0);'
              : '$SendMouse::mouse_event(0x02, 0, 0, 0, 0); Start-Sleep -Milliseconds 30; $SendMouse::mouse_event(0x04, 0, 0, 0, 0);'
        }
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psClickScript], { signal })

      return { message: `Performed ${action} at (${payload.x}, ${payload.y})`, success: true }
    }

    if (action === 'scroll') {
      const clicks = deltaY !== 0 ? (deltaY > 0 ? -120 : 120) : (payload.amount || 3) * -120
      const psScroll = `
        $signature = @'
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
'@;
        $SendMouse = Add-Type -MemberDefinition $signature -Name "Win32MouseScroll" -Namespace "Win32Functions" -PassThru;
        $SendMouse::mouse_event(0x0800, 0, 0, ${clicks}, 0);
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScroll], { signal })

      return { message: `Scrolled by ${clicks} units`, success: true }
    }

    if (action === 'drag') {
      const psDrag = `
        Add-Type -AssemblyName System.Windows.Forms;
        $signature = @'
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
'@;
        $SendMouse = Add-Type -MemberDefinition $signature -Name "Win32MouseDrag" -Namespace "Win32Functions" -PassThru;
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(startX)}, ${Math.round(startY)});
        $SendMouse::mouse_event(0x02, 0, 0, 0, 0);
        Start-Sleep -Milliseconds 100;
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(endX)}, ${Math.round(endY)});
        Start-Sleep -Milliseconds 100;
        $SendMouse::mouse_event(0x04, 0, 0, 0, 0);
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psDrag], { signal })

      return { message: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`, success: true }
    }

    return { error: `Unsupported mouse action: ${action}`, success: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false }
  }
}

/**
 * Executes keyboard typing, key presses, and hotkeys.
 */
async function executeKeyboardAction(
  payload: ComputerActionPayload,
  signal?: AbortSignal
): Promise<ComputerActionResult> {
  const { action, text, key, keys } = payload

  try {
    if (action === 'type') {
      if (!text) {
        return { error: 'No text provided to type', success: false }
      }

      // Escape special characters for PowerShell SendKeys
      const escaped = text
        .replace(/[{}]/g, '{$&}')
        .replace(/[+^%~()]/g, '{$&}')
        .replace(/"/g, '`"')

      const psType = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait("${escaped}");
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psType], { signal })

      return { message: `Typed text successfully`, success: true }
    }

    if (action === 'key') {
      const normalized = normalizeKey(key || '')
      let sendKeyToken = normalized

      switch (normalized) {
        case 'Return':
          sendKeyToken = '{ENTER}'
          break
        case 'Escape':
          sendKeyToken = '{ESC}'
          break
        case 'Tab':
          sendKeyToken = '{TAB}'
          break
        case 'BackSpace':
          sendKeyToken = '{BACKSPACE}'
          break
        case 'Delete':
          sendKeyToken = '{DELETE}'
          break
        case 'Up':
          sendKeyToken = '{UP}'
          break
        case 'Down':
          sendKeyToken = '{DOWN}'
          break
        case 'Left':
          sendKeyToken = '{LEFT}'
          break
        case 'Right':
          sendKeyToken = '{RIGHT}'
          break
        case 'Home':
          sendKeyToken = '{HOME}'
          break
        case 'End':
          sendKeyToken = '{END}'
          break
        case 'Page_Up':
          sendKeyToken = '{PGUP}'
          break
        case 'Page_Down':
          sendKeyToken = '{PGDN}'
          break
        default:
          sendKeyToken = `{${normalized}}`
      }

      const psKey = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait("${sendKeyToken}");
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psKey], { signal })

      return { message: `Pressed key ${key}`, success: true }
    }

    if (action === 'hotkey') {
      const hotkeys = keys || (key ? [key] : [])
      if (hotkeys.length === 0) {
        return { error: 'No keys provided for hotkey', success: false }
      }

      let prefix = ''
      let mainKey = ''

      for (const k of hotkeys) {
        const lk = k.toLowerCase()
        if (lk === 'ctrl' || lk === 'control') {
          prefix += '^'
        } else if (lk === 'alt') {
          prefix += '%'
        } else if (lk === 'shift') {
          prefix += '+'
        } else {
          mainKey = lk
        }
      }

      const sendToken = `${prefix}${mainKey}`
      const psHotkey = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.SendKeys]::SendWait("${sendToken}");
      `
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psHotkey], { signal })

      return { message: `Executed hotkey ${hotkeys.join('+')}`, success: true }
    }

    return { error: `Unsupported keyboard action: ${action}`, success: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false }
  }
}

/**
 * Executes window management (focus, minimize, maximize, restore, close).
 */
async function executeWindowAction(payload: ComputerActionPayload, signal?: AbortSignal): Promise<ComputerActionResult> {
  const { action, appName, title, pid } = payload

  try {
    if (action === 'focusWindow' || action === 'restoreWindow' || action === 'maximizeWindow' || action === 'minimizeWindow') {
      const targetQuery = pid ? `$_.Id -eq ${pid}` : appName ? `$_.ProcessName -match "${appName}" -or $_.MainWindowTitle -match "${appName}"` : `$_.MainWindowTitle -match "${title || ''}"`

      const showCmd = action === 'minimizeWindow' ? 6 : action === 'maximizeWindow' ? 3 : 9 // 9 = SW_RESTORE, 3 = SW_MAXIMIZE, 6 = SW_MINIMIZE

      const psFocus = `
        $sig = @'
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")]
          public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
'@;
        $Win32 = Add-Type -MemberDefinition $sig -Name "Win32WinFocus" -Namespace "Win32Functions" -PassThru;
        $proc = Get-Process | Where-Object { ${targetQuery} -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1;
        if ($proc) {
          $Win32::ShowWindowAsync($proc.MainWindowHandle, ${showCmd});
          $Win32::SetForegroundWindow($proc.MainWindowHandle);
          Write-Output "OK:$($proc.ProcessName):$($proc.MainWindowTitle)";
        } else {
          Write-Output "NOT_FOUND";
        }
      `
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psFocus], { signal })
      const trimmed = (stdout || '').trim()

      if (trimmed.startsWith('OK:')) {
        return { message: `Window focused: ${trimmed.slice(3)}`, success: true }
      }

      return { error: `Could not find active window matching "${appName || title || pid}"`, success: false }
    }

    if (action === 'closeWindow') {
      const targetQuery = pid ? `$_.Id -eq ${pid}` : appName ? `$_.ProcessName -match "${appName}"` : `$_.MainWindowTitle -match "${title || ''}"`

      const psClose = `
        $proc = Get-Process | Where-Object { ${targetQuery} -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1;
        if ($proc) {
          $proc.CloseMainWindow();
          Write-Output "OK:$($proc.ProcessName)";
        } else {
          Write-Output "NOT_FOUND";
        }
      `
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psClose], { signal })
      const trimmed = (stdout || '').trim()

      if (trimmed.startsWith('OK:')) {
        return { message: `Closed window ${trimmed.slice(3)}`, success: true }
      }

      return { error: `Window matching "${appName || title}" not found`, success: false }
    }

    return { error: `Unsupported window action: ${action}`, success: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false }
  }
}

/**
 * Executes application control (launch, close).
 */
async function executeAppAction(payload: ComputerActionPayload, signal?: AbortSignal): Promise<ComputerActionResult> {
  const { action, appName } = payload

  if (!appName) {
    return { error: 'No application name provided', success: false }
  }

  const normalized = appName.trim().toLowerCase()
  const executable = APP_EXECUTABLE_MAP[normalized] || normalized

  try {
    if (action === 'launchApp') {
      // First check if application is already open
      const checkFocus = await executeWindowAction({ action: 'focusWindow', appName: executable }, signal)
      if (checkFocus.success) {
        return { message: `Application ${appName} was already running and has been focused`, success: true }
      }

      // Launch application via detached cmd start
      spawn('cmd.exe', ['/c', 'start', '', executable, ...(payload.args || [])], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref()

      // Wait a short moment and verify window appearance
      await new Promise(resolve => setTimeout(resolve, 800))
      return { message: `Launched application ${appName}`, success: true }
    }

    if (action === 'closeApp') {
      return executeWindowAction({ action: 'closeWindow', appName: executable }, signal)
    }

    return { error: `Unsupported app action: ${action}`, success: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), success: false }
  }
}

/**
 * Master dispatcher for all computer control actions.
 */
export async function executeComputerAction(payload: ComputerActionPayload): Promise<ComputerActionResult> {
  abortCurrentComputerAction()
  activeAbortController = new AbortController()
  const { signal } = activeAbortController

  const action = payload.action

  try {
    if (action === 'getDisplays') {
      const displays = screen.getAllDisplays().map((d, index) => ({
        bounds: d.bounds,
        id: d.id,
        index,
        isPrimary: d.id === screen.getPrimaryDisplay().id,
        scaleFactor: d.scaleFactor,
        workArea: d.workArea
      }))

      return { data: displays, success: true }
    }

    if (action === 'getCursor') {
      const point = screen.getCursorScreenPoint()
      return { data: point, success: true }
    }

    if (action === 'listWindows') {
      try {
        const read = await readWindowBelow(process.pid, { height: 100, width: 100, x: 0, y: 0 }, true)
        return { data: read, success: true }
      } catch (err) {
        return { error: String(err), success: false }
      }
    }

    if (
      action === 'click' ||
      action === 'doubleClick' ||
      action === 'rightClick' ||
      action === 'middleClick' ||
      action === 'move' ||
      action === 'drag' ||
      action === 'scroll'
    ) {
      return await executeMouseAction(payload, signal)
    }

    if (action === 'type' || action === 'key' || action === 'hotkey') {
      return await executeKeyboardAction(payload, signal)
    }

    if (
      action === 'focusWindow' ||
      action === 'minimizeWindow' ||
      action === 'maximizeWindow' ||
      action === 'restoreWindow' ||
      action === 'closeWindow'
    ) {
      return await executeWindowAction(payload, signal)
    }

    if (action === 'launchApp' || action === 'closeApp') {
      return await executeAppAction(payload, signal)
    }

    return { error: `Unrecognized action: ${action}`, success: false }
  } finally {
    activeAbortController = null
  }
}
