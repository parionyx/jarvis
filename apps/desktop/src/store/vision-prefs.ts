import { atom } from 'nanostores'

/**
 * JARVIS Phase 2 Privacy Mode:
 * Controls whether on-demand screen capture / vision analysis is allowed.
 * Default is true (enabled). When false, JARVIS will refuse screen capture
 * and politely notify the user that vision is disabled in privacy settings.
 */
export const $visionEnabled = atom<boolean>(true)

export function setVisionEnabled(enabled: boolean): void {
  $visionEnabled.set(enabled)
}

export function isVisionEnabled(): boolean {
  return $visionEnabled.get()
}
