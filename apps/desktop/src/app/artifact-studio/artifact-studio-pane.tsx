import { useStore } from '@nanostores/react'
import { useCallback } from 'react'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import {
  $activeArtifactProject,
  $studioMode,
  setStudioMode
} from '@/store/artifact-studio'

import { AssemblyTree } from './assembly-tree'
import { CommandBar, type CommandSubmitPayload } from './command-bar'
import { ComponentPalette } from './component-palette'
import { InspectorPanel } from './inspector-panel'
import { ModePanel } from './mode-panels'
import { ProjectLauncher } from './project-launcher'
import { ProposalCard } from './proposal-card'
import { StatusBadges } from './status-badges'
import { StudioChat } from './studio-chat'
import { StudioConsole } from './studio-console'
import { ViewportCanvas } from './viewport-canvas'

const MODE_OPTIONS = (['DESIGN', 'SIMULATE', 'ANALYZE', 'TEST', 'BUILD'] as const).map(m => ({ id: m, label: m }))

/**
 * Artifact Studio — the engineering workspace shell.
 *
 * Left: assembly tree · Center: live Three.js viewport (lazy-loaded) +
 * JARVIS mini-chat + command bar + console · Right: inspector.
 */
export function ArtifactStudioPane() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const project = useStore($activeArtifactProject)
  const mode = useStore($studioMode)

  const submitCommand = useCallback((payload: CommandSubmitPayload) => {
    // The bridge (use-artifact-command-bridge) picks this up and routes it
    // through the SAME submitText pipeline as the main composer. JARVIS ka
    // jawab wahi $messages stream se StudioChat me dikhta hai.
    import('@/app/artifact-studio/command-bridge-store').then(({ queueStudioCommand }) => {
      queueStudioCommand(payload.text, payload.contextLine)
    }).catch(() => {})
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="artifact-studio-pane">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-(--ui-stroke-tertiary) px-3">
        <span className="shrink-0 font-mono text-[0.625rem] tracking-[0.12em] text-(--theme-primary) uppercase">
          JARVIS · {a.studioTitle}
        </span>
        <StatusBadges />
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl
            onChange={value => setStudioMode(value)}
            options={MODE_OPTIONS}
            value={mode}
          />
        </div>
      </div>

      <ProposalCard />

      {/* Mode panel — SIMULATE/ANALYZE/TEST/BUILD each render real tools */}
      <ModePanel mode={mode} />

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail: launcher + assembly tree + component palette */}
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-(--ui-stroke-tertiary)">
          <ProjectLauncher />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {project ? (
              <AssemblyTree />
            ) : (
              <div className="p-3 text-xs text-(--ui-text-tertiary)">{a.noProjectHint}</div>
            )}
          </div>
          <ComponentPalette />
        </aside>

        {/* Center: viewport + chat + command bar + console */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 bg-(--ui-bg-quinary)">
            {project ? (
              <ViewportCanvas mode={mode} />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <div className="text-sm font-medium">{a.noProjectTitle}</div>
                  <div className="mt-1 text-xs text-(--ui-text-tertiary)">{a.noProjectDesc}</div>
                </div>
              </div>
            )}
          </div>
          <StudioChat />
          <CommandBar onSubmit={submitCommand} />
          <div className="h-32 shrink-0">
            <StudioConsole />
          </div>
        </main>

        {/* Right rail: inspector / context */}
        <aside className="w-64 shrink-0 overflow-hidden border-l border-(--ui-stroke-tertiary)">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  )
}
