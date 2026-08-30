import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import {
  $pendingWirePort,
  $selectedComponent,
  applyArtifactActions,
  setArtifactSelection,
  setPendingWirePort
} from '@/store/artifact-studio'

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="shrink-0 text-[0.625rem] tracking-wide text-(--ui-text-tertiary) uppercase">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-xs text-(--ui-text-secondary)">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-(--ui-stroke-tertiary) px-3 py-2">
      <div className="mb-1 text-[0.625rem] font-medium tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {title}
      </div>
      {children}
    </div>
  )
}

/**
 * Right panel: selected component details. Every engineering value shown here
 * is USER_PROVIDED or UNKNOWN at this phase — the header says so explicitly
 * rather than dressing assumptions up as data.
 */
export function InspectorPanel() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const component = useStore($selectedComponent)
  const [renameValue, setRenameValue] = useState<string | null>(null)

  if (!component) {
    return (
      <div className="grid h-full place-items-center px-4 text-center">
        <p className="text-xs text-(--ui-text-tertiary)">{a.noSelection}</p>
      </div>
    )
  }

  const electrical = (component.electrical ?? {}) as Record<string, unknown>

  const deletePart = (): void => {
    void applyArtifactActions(
      [{ type: 'component.delete', component_id: component.id }],
      { reason: 'deleted from inspector' }
    ).then(ok => {
      if (ok) {setArtifactSelection([])}
    })
  }

  const commitRename = (): void => {
    const next = renameValue?.trim()
    setRenameValue(null)

    if (!next || next === component.name) {return}

    void applyArtifactActions(
      [{ type: 'component.update', component_id: component.id, patch: { name: next } }],
      { reason: 'renamed from inspector' }
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="artifact-inspector">
      <div className="flex-1 overflow-y-auto">
      <Section title={a.identity}>
        <PropRow label={a.propId} value={component.id} />
        <PropRow label={a.propType} value={component.type} />
        <PropRow label={a.propCategory} value={component.category} />
        <PropRow label={a.propStatus} value={component.status} />
        {component.mass_g != null ? <PropRow label={a.propMass} value={`${component.mass_g} g`} /> : null}
        {/* Rename: name-only patch = low-risk, auto-applies. */}
        <input
          aria-label={a.renameLabel}
          className="mt-1 h-6 w-full rounded-[4px] border border-(--ui-stroke-tertiary) bg-transparent px-1.5 text-xs text-(--ui-text-primary) outline-none focus:border-(--theme-primary)"
          onBlur={commitRename}
          onChange={e => setRenameValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {e.currentTarget.blur()}
          }}
          placeholder={component.name}
          value={renameValue ?? ''}
        />
      </Section>

      {component.ports.length > 0 ? (
        <Section title={`${a.ports} · ${component.ports.length}`}>
          <div className="flex flex-col gap-[2px]">
            {component.ports.map(port => (
              <div className="flex items-center gap-1.5" key={port.id}>
                <span className="w-16 shrink-0 truncate font-mono text-[0.6875rem] text-(--ui-text-secondary)">
                  {port.id}
                </span>
                <span className="font-mono text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase">
                  {port.kind}
                </span>
                <PortAction componentId={component.id} portId={port.id} />
                <span className="ml-auto font-mono text-[0.5625rem] text-(--ui-text-tertiary)">
                  {port.direction === 'bidirectional' ? '↔' : port.direction === 'input' ? '←' : '→'}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {Object.keys(electrical).length > 0 ? (
        <Section title={`${a.electrical} · ${a.provenanceSuffix}`}>
          {Object.entries(electrical).map(([key, value]) => (
            <PropRow key={key} label={key} value={String(value)} />
          ))}
        </Section>
      ) : null}
      </div>

      {/* Destructive action: delete → backend medium-risk → proposal card */}
      <div className="shrink-0 border-t border-(--ui-stroke-tertiary) p-2">
        <Button
          className="w-full"
          onClick={deletePart}
          size="xs"
          type="button"
          variant="ghost"
        >
          {a.deleteSelected}
        </Button>
      </div>
    </div>
  )
}


function PortAction({ componentId, portId }: { componentId: string; portId: string }) {
  const a = useI18n().t.artifactStudio
  const pending = useStore($pendingWirePort)

  const ref = `${componentId}:${portId}`
  const isSource = pending === ref
  const canConnect = pending != null && !isSource && pending.split(':')[0] !== componentId

  if (canConnect) {
    return (
      <button
        aria-label={`${a.paletteAdd} wire`}
        className="ml-auto shrink-0 rounded-[3px] bg-emerald-600/15 px-1 text-[0.5625rem] font-medium text-emerald-600 hover:bg-emerald-600/30 dark:text-emerald-400"
        onClick={() => {
          void applyArtifactActions(
            [{ type: 'wire.create', source: pending!, target: ref }],
            { reason: 'port wiring' }
          ).then(ok => {
            if (ok) {setPendingWirePort(null)}
          })
        }}
        title={`${pending} → ${ref}`}
        type="button"
      >
        ⚡ connect
      </button>
    )
  }

  if (isSource) {
    return (
      <button
        className="ml-auto shrink-0 rounded-[3px] bg-cyan-600/20 px-1 text-[0.5625rem] font-medium text-cyan-700 dark:text-cyan-300"
        onClick={() => setPendingWirePort(null)}
        title={a.cancelReview}
        type="button"
      >
        ● source ✕
      </button>
    )
  }

  return (
    <button
      aria-label="start wire"
      className="ml-auto shrink-0 rounded-[3px] px-1 text-[0.5625rem] text-(--ui-text-quaternary, var(--ui-text-tertiary)) hover:text-cyan-700 dark:hover:text-cyan-300"
      onClick={() => setPendingWirePort(ref)}
      title={a.wireStart}
      type="button"
    >
      ⚡
    </button>
  )
}
