
import { Button } from '@/components/ui/button'
import { Tip, TipKeybindLabel } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import {
  iconSize,
  Layers3
} from '@/lib/icons'
import { cn } from '@/lib/utils'

import { ModelPill } from './model-pill'
import type { ChatBarState } from './types'

export const ICON_BTN = 'size-(--composer-control-size) shrink-0 rounded-md'
export const GHOST_ICON_BTN = cn(
  ICON_BTN,
  'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
)
// Send/voice-conversation primary: solid foreground-on-background circle
// (reads as black-on-white in light mode, white-on-black in dark mode) to
// match the reference composer's high-contrast CTA. Keeps the pill itself
// neutral and lets the action visually dominate the row.
export const PRIMARY_ICON_BTN = cn(
  'size-(--composer-control-primary-size,var(--composer-control-size)) shrink-0 rounded-full p-0',
  'bg-foreground text-background hover:bg-foreground/90',
  'disabled:bg-foreground/30 disabled:text-background disabled:opacity-100'
)

export function ComposerControls({
  busy,
  busyAction,
  canSubmit,
  compactModelPill = false,
  disabled,
  hasComposerPayload,
  state,
  onQueue,
}: {
  busy: boolean
  busyAction: 'steer' | 'queue' | 'stop'
  canSubmit: boolean
  compactModelPill?: boolean
  disabled: boolean
  hasComposerPayload: boolean
  state: ChatBarState
  onQueue: () => void
}) {
  const { t } = useI18n()
  const c = t.composer

  const showVoicePrimary = !busy && !hasComposerPayload
  const busyLabel = busyAction === 'queue' ? c.queueMessage : busyAction === 'steer' ? c.steer : c.stop

  return (
    <div className="ml-auto flex shrink-0 items-center gap-(--composer-control-gap)">
      <ModelPill compact={compactModelPill} disabled={disabled} model={state.model} />
      {busyAction === 'steer' ? (
        <Tip label={<TipKeybindLabel actionId="composer.queue" text={c.queueMessage} />}>
          <Button
            aria-label={c.queueMessage}
            className={GHOST_ICON_BTN}
            disabled={disabled}
            onClick={onQueue}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Layers3 className={iconSize.sm} />
          </Button>
        </Tip>
      ) : null}
    </div>
  )
}



