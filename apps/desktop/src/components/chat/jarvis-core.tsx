import { useStore } from '@nanostores/react'
import { memo } from 'react'

import { cn } from '@/lib/utils'
import { $sessionStates } from '@/store/session-states'

export interface JarvisCoreVisualizerProps {
  sessionKey?: string | null
  /** True when the core is the main centered feature (idle thread) */
  isCentered?: boolean
}

export const JarvisCoreVisualizer = memo(function JarvisCoreVisualizer({
  sessionKey,
  isCentered = false
}: JarvisCoreVisualizerProps) {
  const sessionStates = useStore($sessionStates)
  const sessionState = sessionKey ? sessionStates[sessionKey] : undefined

  const isBusy = sessionState?.busy
  // Simple heuristic: if we have a streamId, it's executing/generating; otherwise if busy, it's thinking.
  const isExecuting = isBusy && !!sessionState?.streamId
  const isThinking = isBusy && !sessionState?.streamId

  let state = 'IDLE'

  if (isExecuting) {state = 'EXECUTING'}
  else if (isThinking) {state = 'THINKING'}

  return (
    <div
      className={cn(
        'jarvis-core-container',
        isCentered ? 'jarvis-core-centered' : 'jarvis-core-hud'
      )}
      data-state={state}
    >
      <div className="jarvis-core-rings">
        <div className="jarvis-ring jarvis-ring-outer" />
        <div className="jarvis-ring jarvis-ring-middle" />
        <div className="jarvis-ring jarvis-ring-inner" />
        <div className="jarvis-core-center" />
      </div>
      <div className="jarvis-core-label">
        <span className="jarvis-core-status-text">{state}</span>
      </div>
    </div>
  )
})
