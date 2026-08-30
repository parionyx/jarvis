import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n'
import { $activeArtifactProject } from '@/store/artifact-studio'

type BadgeVariant = 'default' | 'muted' | 'destructive' | 'outline' | 'warn'

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  conceptual: 'muted',
  geometrically_consistent: 'outline',
  simulation_tested: 'outline',
  engineering_validated: 'default',
  manufacturing_ready: 'default'
}

const VALIDATION_VARIANT: Record<string, BadgeVariant> = {
  unverified: 'muted',
  passed: 'default',
  warnings: 'warn',
  failed: 'destructive'
}

/**
 * Status ladder strip. Honest by design: shows where the project actually
 * sits and which rungs are NOT earned yet — JARVIS and the user must be able
 * to tell a conceptual model from a validated one at a glance.
 */
export function StatusBadges() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const project = useStore($activeArtifactProject)

  const ladderNote = useMemo(() => {
    if (!project) {return null}

    if (project.status === 'conceptual') {return a.conceptualNote}

    if (!project.validation || project.validation === 'unverified') {return a.unverifiedNote}

    return null
  }, [project, a])

  if (!project) {return null}

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Badge className="font-mono text-[0.625rem]" variant={STATUS_VARIANT[project.status] ?? 'muted'}>
        {a[`status_${project.status}` as const]}
      </Badge>
      <Badge className="font-mono text-[0.625rem]" variant={VALIDATION_VARIANT[project.validation] ?? 'muted'}>
        {a[`validation_${project.validation}` as const]}
      </Badge>
      {project.manufacturing_ready ? (
        <Badge className="text-[0.625rem]" variant="default">
          {a.manufacturingReady}
        </Badge>
      ) : null}
      <span className="truncate font-mono text-[0.625rem] text-(--ui-text-tertiary)">rev {project.revision}</span>
      {ladderNote ? (
        <span className="truncate text-[0.625rem] text-(--ui-text-tertiary)" title={ladderNote}>
          ⚠ {ladderNote}
        </span>
      ) : null}
    </div>
  )
}
