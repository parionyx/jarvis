import { useStore } from '@nanostores/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import {
  $pendingProposal,
  confirmPendingProposal,
  dismissPendingProposal
} from '@/store/artifact-studio'
import type { PendingProposal } from '@/types/artifact-studio'

const RISK_VARIANT: Record<string, 'default' | 'muted' | 'destructive' | 'outline'> = {
  low: 'muted',
  medium: 'outline',
  high: 'destructive',
  critical: 'destructive'
}

function summarize(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'component.transform': {
      const pos = (payload.transform as { position?: Record<string, number> } | undefined)?.position
      const rel = payload.relative === true

      return `${payload.component_id} ${rel ? '+' : '→'} (${pos?.x ?? 0}, ${pos?.y ?? 0}, ${pos?.z ?? 0})`
    }

    case 'component.create':
      return String(payload.component && typeof payload.component === 'object' && 'id' in payload.component ? (payload.component as { id: string }).id : '?')

    case 'component.delete':
      return String(payload.component_id)

    case 'wire.create':
      return `${payload.source} → ${payload.target}`

    default:
      return Object.keys(payload).join(', ')
  }
}

/**
 * Backend-assessed proposals for medium/high-risk batches. Risk shown here is
 * COMPUTED BY THE BACKEND — never the AI's self-report. Nothing mutates until
 * the user picks APPLY ALL.
 */
export function ProposalCard() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const proposal = useStore($pendingProposal)

  if (!proposal || proposal.pending.length === 0) {return null}

  const apply = (): void => {
    void confirmPendingProposal()
  }

  return (
    <div className="border-b border-(--ui-stroke-primary) bg-(--ui-bg-secondary) px-3 py-2" data-testid="artifact-proposal-card">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[0.625rem] font-medium tracking-[0.08em] text-(--ui-text-secondary) uppercase">
          {a.proposalTitle}
        </span>
        <Badge className="text-[0.5625rem]" variant="outline">
          {a.reviewRequired}
        </Badge>
      </div>

      <ol className="mb-2 flex flex-col gap-1">
        {proposal.pending.map((item: PendingProposal, index: number) => (
          <li className="flex items-center gap-2 text-xs" key={`${item.type}_${index}`}>
            <span className="w-3 shrink-0 text-right font-mono text-[0.625rem] text-(--ui-text-tertiary)">
              {index + 1}
            </span>
            <Badge className="shrink-0 px-1 py-0 font-mono text-[0.5625rem]" variant={RISK_VARIANT[item.risk] ?? 'muted'}>
              {item.risk}
            </Badge>
            <span className="min-w-0 truncate text-(--ui-text-secondary)">
              <span className="font-mono">{item.type}</span> · {summarize(item.type, item.payload)}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex gap-1.5">
        <Button onClick={apply} size="xs" type="button" variant="default">
          {a.applyAll}
        </Button>
        <Button onClick={dismissPendingProposal} size="xs" type="button" variant="ghost">
          {a.cancelReview}
        </Button>
      </div>
    </div>
  )
}
