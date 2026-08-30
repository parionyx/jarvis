import { describe, expect, it } from 'vitest'

import {
  $pendingStudioCommand,
  clearStudioCommand,
  consumeStudioCommand,
  queueStudioCommand
} from './command-bridge-store'

describe('command-bridge-store', () => {
  it('queues a contextual command for the bridge to drain', () => {
    let seen: { id: number; text: string } | null = null

    const unsubscribe = $pendingStudioCommand.subscribe(cmd => {
      if (cmd) {seen = cmd}
    })

    queueStudioCommand('battery ko 20mm neeche karo', '[artifact proj_x rev7 · sel:battery.main]')

    expect(seen).not.toBeNull()
    expect(seen!.text).toBe('battery ko 20mm neeche karo')
    unsubscribe()
  })

  it('clears after consume so a failed submit cannot loop', () => {
    queueStudioCommand('check wiring', null)
    expect(consumeStudioCommand()).not.toBeNull()

    clearStudioCommand()
    expect($pendingStudioCommand.get()).toBeNull()
    expect(consumeStudioCommand()).toBeNull()
  })
})
