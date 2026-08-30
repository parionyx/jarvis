import { useEffect, useRef } from 'react'

import { $pendingStudioCommand, clearStudioCommand } from '@/app/artifact-studio/command-bridge-store'

/**
 * Drains Artifact Studio command-bar submissions into the window's normal
 * prompt machinery — the SAME submitText the main composer uses. The studio
 * pane itself carries no gateway/submit code; this bridge is the only door.
 *
 * Handlers track the latest callback in a ref (the same shape
 * use-quick-entry-bridge guards): re-subscribing on identity churn would drop
 * a submission between effect teardown and re-registration.
 */
export function useArtifactCommandBridge({ submitText }: { submitText: (text: string) => Promise<unknown> | unknown }): void {
  const submitRef = useRef(submitText)
  submitRef.current = submitText

  useEffect(() => {
    let lastId = 0

    const unsubscribe = $pendingStudioCommand.subscribe(command => {
      if (!command || command.id === lastId) {return}
      lastId = command.id

      // Context rides as a visible prefix line: transparent in the transcript,
      // machine-parsable by JARVIS, and never a second hidden channel.
      const text = command.contextLine ? `${command.contextLine}\n${command.text}` : command.text
      clearStudioCommand()
      void submitRef.current(text)
    })

    return unsubscribe
  }, [])
}
