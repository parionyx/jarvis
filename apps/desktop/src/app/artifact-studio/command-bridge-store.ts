import { atom } from 'nanostores'

/**
 * Studio → JARVIS command hand-off.
 *
 * The Artifact Studio has NO gateway/submit machinery of its own: it queues
 * contextual commands here, and use-artifact-command-bridge (mounted beside
 * useQuickEntryBridge in wiring.tsx) drains them through the SAME submitText
 * pipeline the main composer uses. One submit path, no bespoke RPC.
 */

export interface PendingStudioCommand {
  id: number
  text: string
  /** Compact artifact context prefix shown verbatim with the message. */
  contextLine: null | string
}

export const $pendingStudioCommand = atom<PendingStudioCommand | null>(null)

let seq = 0

export function queueStudioCommand(text: string, contextLine: null | string): void {
  $pendingStudioCommand.set({ id: ++seq, text, contextLine })
}

export function consumeStudioCommand(): PendingStudioCommand | null {
  return $pendingStudioCommand.get()
}

export function clearStudioCommand(): void {
  $pendingStudioCommand.set(null)
}
