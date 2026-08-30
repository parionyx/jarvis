import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $activeArtifactProject, pushConsoleLine } from '@/store/artifact-studio'

import {
  buildBomRows,
  type CheckResult,
  computeMassBudget,
  computePowerEstimate,
  runConnectivityChecks
} from './analysis'

/**
 * Per-mode working panels. DESIGN mode = base layout (no extra panel).
 * Har number apna provenance dikhata hai (ESTIMATED / CALCULATED) —
 * conceptual model ko validated engineering data jhooth bolne nahi dete.
 */

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="shrink-0 text-[0.625rem] tracking-wide text-(--ui-text-tertiary) uppercase">{label}</span>
      <span className={cn('truncate font-mono text-xs', muted ? 'text-(--ui-text-tertiary)' : 'text-(--ui-text-secondary)')}>
        {value}
      </span>
    </div>
  )
}

const LEVEL_VARIANT: Record<string, 'default' | 'muted' | 'destructive' | 'outline' | 'warn'> = {
  pass: 'default',
  warn: 'warn',
  fail: 'destructive'
}

function SimulatePanel() {
  const a = useI18nMode()
  const project = useStore($activeArtifactProject)

  const est = useMemo(() => (project ? computePowerEstimate(project) : null), [project])

  if (!project || !est) {return null}

  return (
    <div className="grid grid-cols-2 gap-x-8 px-4 py-2" data-testid="mode-panel-simulate">
      <div>
        <Row label="pack voltage" value={est.nominalVoltageV ? `${est.nominalVoltageV} V` : 'UNKNOWN'} />
        <Row label="capacity" value={est.capacityWh ? `${est.capacityWh} Wh` : 'UNKNOWN'} />
        <Row label="motors" value={String(est.motorCount)} />
      </div>
      <div>
        <Row label="hover power" muted value={est.estHoverPowerW ? `≈ ${est.estHoverPowerW} W` : '—'} />
        <Row
          label="hover time"
          muted
          value={est.estHoverMinutes ? `≈ ${est.estHoverMinutes} min` : '—'}
        />
        <div className="pt-1 text-[0.5625rem] leading-snug text-(--ui-text-quaternary, var(--ui-text-tertiary))">
          ESTIMATED — {a.simDisclaimer}
          {est.notes.length > 0 ? ` · ${est.notes.join('; ')}` : ''}
        </div>
        <div className="pt-1 text-[0.5625rem] text-(--ui-text-tertiary)">
          {a.simSolverPending}
        </div>
      </div>
    </div>
  )
}

function AnalyzePanel() {
  const project = useStore($activeArtifactProject)
  const mass = useMemo(() => (project ? computeMassBudget(project) : null), [project])
  const wires = project ? Object.keys(project.wires).length : 0

  if (!project || !mass) {return null}

  const overTarget = mass.targetG != null && mass.totalG > mass.targetG

  return (
    <div className="flex gap-8 px-4 py-2" data-testid="mode-panel-analyze">
      <div className="w-64 shrink-0">
        <Row label="all-up mass" value={`${mass.totalG.toFixed(0)} g`} />
        <Row
          label={mass.targetG != null ? `target (${mass.targetG} g)` : 'target'}
          muted={!mass.targetG}
          value={
            mass.targetG == null
              ? 'not set'
              : `${overTarget ? '+' : ''}${(mass.totalG - mass.targetG).toFixed(0)} g`
          }
        />
        <Row label="wires" value={String(wires)} />
        <Row label="components" value={String(Object.keys(project.components).length)} />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto" style={{ maxHeight: 140 }}>
        <table className="w-full text-left text-xs">
          <thead className="text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase">
            <tr>
              <th className="py-0.5 pr-2 font-medium">component</th>
              <th className="py-0.5 pr-2 text-right font-medium">grams</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[0.6875rem]">
            {mass.rows.map(r => (
              <tr key={r.id}>
                <td className="py-[1px] pr-2 truncate">{r.name}</td>
                <td className="py-[1px] pr-2 text-right">{r.massG}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TestPanel() {
  const project = useStore($activeArtifactProject)
  const [results, setResults] = useState<CheckResult[] | null>(null)

  const run = (): void => {
    if (!project) {return}
    const r = runConnectivityChecks(project)
    setResults(r)
    const fails = r.filter(x => x.level === 'fail').length
    const warns = r.filter(x => x.level === 'warn').length
    pushConsoleLine(
      fails > 0 ? 'error' : warns > 0 ? 'warning' : 'success',
      `connectivity: ${r.length} checks — ${fails} fail, ${warns} warn`
    )
  }

  return (
    <div className="px-4 py-2" data-testid="mode-panel-test">
      <Button disabled={!project} onClick={run} size="xs" type="button" variant="outline">
        Run connectivity & voltage-class checks
      </Button>

      {results ? (
        <div className="mt-2 flex flex-col gap-[3px]" style={{ maxHeight: 130, overflowY: 'auto' }}>
          {results.map((r, i) => (
            <div className="flex items-center gap-2 text-[0.6875rem]" key={`${r.code}_${i}`}>
              <Badge className="px-1 py-0 font-mono text-[0.5rem] uppercase" variant={LEVEL_VARIANT[r.level]}>
                {r.level}
              </Badge>
              <span className="font-mono text-[0.5625rem] text-(--ui-text-tertiary)">{r.code}</span>
              <span className="min-w-0 truncate text-(--ui-text-secondary)">{r.message}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function BomPanel() {
  const project = useStore($activeArtifactProject)
  const rows = useMemo(() => (project ? buildBomRows(project) : []), [project])

  const exportCsv = (): void => {
    if (!project) {return}
    const header = 'type,name,qty,mass_g_each,part_number,cost_usd_each'

    const lines = rows.map(r =>
      [
        r.type,
        `"${r.name.replace(/"/g, '""')}"`,
        r.qty,
        r.massGEach ?? '',
        r.partNumber ?? '',
        r.costUsdEach ?? ''
      ].join(',')
    )

    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}_bom.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    pushConsoleLine('info', 'BOM CSV exported')
  }

  if (!project || rows.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-(--ui-text-tertiary)" data-testid="mode-panel-build">
        No components to source yet.
      </div>
    )
  }

  const totalCost = rows.reduce((s, r) => s + (r.costUsdEach ?? 0) * r.qty, 0)
  const totalMass = rows.reduce((s, r) => s + (r.massGEach ?? 0) * r.qty, 0)

  return (
    <div className="px-4 py-2" data-testid="mode-panel-build">
      <div className="mb-1 flex items-center gap-3">
        <Button onClick={exportCsv} size="xs" type="button" variant="outline">
          Export CSV
        </Button>
        <span className="font-mono text-[0.625rem] text-(--ui-text-tertiary)">
          {rows.length} line items · {totalMass.toFixed(0)} g · ${totalCost.toFixed(2)}
        </span>
      </div>
      <table className="w-full text-left text-xs" data-testid="artifact-bom-table" style={{ maxHeight: 120 }}>
        <thead className="text-[0.5625rem] tracking-wide text-(--ui-text-tertiary) uppercase">
          <tr>
            <th className="py-0.5 pr-3 font-medium">type</th>
            <th className="py-0.5 pr-3 font-medium">name / part</th>
            <th className="py-0.5 pr-3 text-right font-medium">qty</th>
            <th className="py-0.5 pr-3 text-right font-medium">g/ea</th>
            <th className="py-0.5 text-right font-medium">$ / ea</th>
          </tr>
        </thead>
        <tbody className="text-[0.6875rem]">
          {rows.map(r => (
            <tr key={r.key}>
              <td className="py-[1px] pr-3 font-mono">{r.type}</td>
              <td className="max-w-52 truncate py-[1px] pr-3">
                {r.name}
                {r.partNumber ? <span className="ml-1 text-(--ui-text-tertiary)">({r.partNumber})</span> : null}
              </td>
              <td className="py-[1px] pr-3 text-right font-mono">{r.qty}</td>
              <td className="py-[1px] pr-3 text-right font-mono">{r.massGEach ?? '—'}</td>
              <td className="py-[1px] text-right font-mono">{r.costUsdEach != null ? `$${r.costUsdEach}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Tiny hook indirection so every panel shares the same i18n section without
// repeating the call five times.
function useI18nMode() {
  const { t } = useI18n()

  return t.artifactStudio
}

export function ModePanel({ mode }: { mode: string }) {
  switch (mode) {
    case 'SIMULATE':
      return <SimulatePanel />

    case 'ANALYZE':
      return <AnalyzePanel />

    case 'TEST':
      return <TestPanel />

    case 'BUILD':
      return <BomPanel />

    default:
      return null // DESIGN = base layout itself
  }
}
