import type { ComposerAttachment } from '@/store/composer'
import { $visionEnabled } from '@/store/vision-prefs'

export interface ActiveWindowInfo {
  appName?: string
  windowTitle?: string
  bounds?: unknown
}

export interface VisionCaptureResult {
  activeWindow: ActiveWindowInfo | null
  allowed: boolean
  attachment?: ComposerAttachment
  contextHeader?: string
  dataUrl?: string
  error?: string
  filePath?: string
  height?: number
  width?: number
}

// In-memory short-lived cache for recent visual context (expires after 60s)
let lastCapture: {
  activeWindow: ActiveWindowInfo | null
  attachment: ComposerAttachment
  dataUrl: string
  filePath: string
  timestamp: number
} | null = null

const VISUAL_CONTEXT_EXPIRY_MS = 60_000

export function getActiveVisualContext(): typeof lastCapture {
  if (lastCapture && Date.now() - lastCapture.timestamp < VISUAL_CONTEXT_EXPIRY_MS) {
    return lastCapture
  }

  return null
}

export function clearVisualContext(): void {
  lastCapture = null
}

/**
 * Centralized screen capture service for JARVIS Vision.
 * Handles privacy checking, native Electron screen capture, metadata extraction,
 * and composer attachment construction.
 */
export async function captureScreenForVision(options?: {
  forceFresh?: boolean
  screenIndex?: number
}): Promise<VisionCaptureResult> {
  if (!$visionEnabled.get()) {
    return {
      activeWindow: null,
      allowed: false,
      error: 'Vision is currently disabled in your privacy settings. Enable vision in settings to let JARVIS see your screen.'
    }
  }

  const desktop = window.hermesDesktop

  if (!desktop?.captureScreen) {
    return {
      activeWindow: null,
      allowed: false,
      error: 'Screen capture is not supported on this platform/desktop shell.'
    }
  }

  try {
    const res = await desktop.captureScreen(options)

    if (!res || !res.filePath) {
      throw new Error('Screen capture returned no image file path.')
    }

    const id = `screen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const attachment: ComposerAttachment = {
      id,
      kind: 'image',
      label: 'Screen Capture',
      path: res.filePath,
      previewUrl: res.dataUrl,
      refText: `@image:${res.filePath}`
    }

    const appName = res.activeWindow?.appName || 'Desktop'
    const windowTitle = res.activeWindow?.windowTitle || 'Main Display'
    const resolution = `${res.width}x${res.height}`
    const contextHeader = `[Visual Context: Active Application "${appName}", Window "${windowTitle}", Resolution ${resolution}]`

    lastCapture = {
      activeWindow: res.activeWindow,
      attachment,
      dataUrl: res.dataUrl,
      filePath: res.filePath,
      timestamp: Date.now()
    }

    return {
      activeWindow: res.activeWindow,
      allowed: true,
      attachment,
      contextHeader,
      dataUrl: res.dataUrl,
      filePath: res.filePath,
      height: res.height,
      width: res.width
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return {
      activeWindow: null,
      allowed: true,
      error: `Failed to capture screen: ${message}`
    }
  }
}
