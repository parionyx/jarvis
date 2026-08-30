import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'

import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  $activeArtifactProject,
  loadArtifactProject
} from '@/store/artifact-studio'
import { activeGateway } from '@/store/gateway'
import type { ArtifactProjectSummary } from '@/types/artifact-studio'

/**
 * Project launcher — studio ke left rail ka top block:
 * current project + NEW (blank/drone/arm) + recent projects list.
 * Recent pe click = seedha load, kaam wahin se shuru.
 */

const TEMPLATES: Array<{ id: string; labelKey: 'tplBlank' | 'tplDrone' | 'tplArm' }> = [
  { id: '', labelKey: 'tplBlank' },
  { id: 'drone_quadcopter', labelKey: 'tplDrone' },
  { id: 'robot_arm', labelKey: 'tplArm' }
]

export function ProjectLauncher() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const project = useStore($activeArtifactProject)
  const [recents, setRecents] = useState<ArtifactProjectSummary[]>([])
  const [newOpen, setNewOpen] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const gateway = activeGateway()

    if (!gateway) {return}

    try {
      const res = await gateway.request<{ projects: ArtifactProjectSummary[] }>('artifacts.list')
      setRecents(res.projects ?? [])
    } catch {
      // Silent: launcher best-effort hai, studio bina list bhi chalega.
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, project?.revision])

  const openRecent = useCallback(
    (id: string): void => {
      void loadArtifactProject(id)
    },
    []
  )

  const createNew = useCallback(
    async (template: string): Promise<void> => {
      const gateway = activeGateway()

      if (!gateway) {return}

      try {
        const res = await gateway.request<{ project_id: string }>('artifacts.create', {
          name: template === 'robot_arm' ? 'Robot Arm' : template === 'drone_quadcopter' ? 'Drone' : 'New Design',
          category: template || 'generic',
          template: template || undefined
        })

        setNewOpen(false)
        await loadArtifactProject(res.project_id)
        void refresh()
      } catch {
        // create failures surface via console store elsewhere; stay quiet here.
      }
    },
    [refresh]
  )

  return (
    <div className="border-b border-(--ui-stroke-tertiary)" data-testid="artifact-project-launcher">
      <div className="px-2 pt-2 pb-1 text-[0.625rem] tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {a.launcherTitle}
      </div>

      <div className="px-2 pb-2">
        <button
          className={cn(
            'mb-1 w-full rounded-[5px] px-2 py-1 text-left text-xs transition-colors',
            'hover:bg-(--chrome-action-hover)'
          )}
          onClick={() => {setNewOpen(o => !o)}}
          type="button"
        >
          <span className="mr-1 text-(--theme-primary)">＋</span>
          {a.newProject}
        </button>

        {newOpen ? (
          <div className="mb-1 flex flex-col gap-[2px] rounded-[5px] border border-(--ui-stroke-tertiary) p-1">
            {TEMPLATES.map(tpl => (
              <button
                className="rounded-[4px] px-1.5 py-[3px] text-left text-[0.6875rem] text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)"
                key={tpl.id || 'blank'}
                onClick={() => void createNew(tpl.id)}
                type="button"
              >
                {a[tpl.labelKey]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-0.5 px-1 pt-1 text-[0.5625rem] tracking-wide text-(--ui-text-quaternary, var(--ui-text-tertiary)) uppercase">
          {a.recentProjects}
        </div>

        {recents.length === 0 ? (
          <p className="px-1 py-0.5 text-[0.625rem] text-(--ui-text-quaternary, var(--ui-text-tertiary))">
            {a.noRecents}
          </p>
        ) : (
          recents.slice(0, 8).map(r => (
            <button
              className={cn(
                'flex w-full items-center gap-1 rounded-[4px] px-1.5 py-[3px] text-left text-[0.6875rem]',
                r.id === project?.id
                  ? 'bg-(--theme-primary)/10 text-foreground'
                  : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover)'
              )}
              key={r.id}
              onClick={() => openRecent(r.id)}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="shrink-0 font-mono text-[0.5625rem] text-(--ui-text-tertiary)">
                {r.status === 'conceptual' ? 'C' : 'V'}·{r.revision}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
