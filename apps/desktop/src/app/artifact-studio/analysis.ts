import type { ArtifactComponent, ArtifactProject } from '@/types/artifact-studio'

/**
 * Pure analysis helpers for the studio modes. Har derived value apne saath
 * PROVENANCE label laata hai — kabhi bhi estimate ko calculated mat dikhao.
 */

export type CheckLevel = 'pass' | 'warn' | 'fail'

export interface CheckResult {
  level: CheckLevel
  code: string
  message: string
}

export interface MassBudget {
  totalG: number
  targetG: null | number
  rows: Array<{ id: string; name: string; massG: number }>
}

export interface PowerEstimate {
  /** All values ESTIMATED unless stated. */
  nominalVoltageV: number | null
  capacityWh: number | null
  estHoverPowerW: number | null
  estHoverMinutes: number | null
  motorCount: number
  notes: string[]
}

export interface BomRow {
  key: string
  type: string
  name: string
  qty: number
  massGEach: number | null
  partNumber: string | null
  costUsdEach: number | null
}

// Empirical small-quad rule of thumb (~180 W per kg all-up weight at hover,
// incl. prop/ESC inefficiency). Explicitly an ESTIMATE, not a calculation.
const HOVER_W_PER_KG = 180

export function computeMassBudget(project: ArtifactProject): MassBudget {
  const rows: MassBudget['rows'] = []

  for (const c of Object.values(project.components)) {
    if (c.mass_g == null) {continue}
    rows.push({ id: c.id, name: c.name, massG: c.mass_g })
  }

  rows.sort((a, b) => b.massG - a.massG)

  const targetRaw = project.metadata?.['target_mass_g']
  const targetG = typeof targetRaw === 'number' ? targetRaw : null

  return { totalG: rows.reduce((s, r) => s + r.massG, 0), targetG, rows }
}

function firstBattery(project: ArtifactProject): ArtifactComponent | null {
  for (const c of Object.values(project.components)) {
    if (c.type === 'lipo_battery' || c.type === 'battery' || c.type === 'battery_pack') {return c}
  }

  return null
}

export function computePowerEstimate(project: ArtifactProject): PowerEstimate {
  const notes: string[] = []
  const battery = firstBattery(project)
  const e = (battery?.electrical ?? {}) as Record<string, unknown>

  const cells = typeof e.cells_s === 'number' ? e.cells_s : null
  const capacityMah = typeof e.capacity_mah === 'number' ? e.capacity_mah : null

  const nominalVoltageV = cells ? +(cells * 3.7).toFixed(1) : null
  const capacityWh = cells && capacityMah ? +((cells * 3.7 * capacityMah) / 1000).toFixed(1) : null

  const mass = computeMassBudget(project)
  const massKg = mass.totalG / 1000

  let estHoverPowerW: number | null = null

  if (massKg > 0) {
    estHoverPowerW = Math.round(massKg * HOVER_W_PER_KG)
    notes.push(`hover power ≈ ${HOVER_W_PER_KG} W/kg rule of thumb`)
  }

  let estHoverMinutes: number | null = null

  if (capacityWh && estHoverPowerW) {
    // 75% usable capacity (LiPo safe floor) / hover power draw.
    estHoverMinutes = +(((capacityWh * 0.75) / estHoverPowerW) * 60).toFixed(1)
    notes.push('assumes 75% usable LiPo capacity')
  }

  if (!cells) {notes.push('battery cells_s unknown — add electrical data')}

  const motorCount = Object.values(project.components).filter(
    c => c.type === 'bldc_motor' || c.type === 'dc_motor'
  ).length

  return { nominalVoltageV, capacityWh, estHoverPowerW, estHoverMinutes, motorCount, notes }
}

/** Port refs jo kisi wire ka endpoint hain ("comp:PORT"). */
function wiredPortSet(project: ArtifactProject): Set<string> {
  const s = new Set<string>()

  for (const w of Object.values(project.wires)) {
    s.add(w.source)
    s.add(w.target)
  }

  return s
}

export function runConnectivityChecks(project: ArtifactProject): CheckResult[] {
  const results: CheckResult[] = []
  const wired = wiredPortSet(project)

  const byType = (t: string): ArtifactComponent[] =>
    Object.values(project.components).filter(c => c.type === t)

  // 1. Battery dono terminals wired?
  for (const batt of [...byType('lipo_battery'), ...byType('battery'), ...byType('battery_pack')]) {
    for (const terminal of ['POWER+', 'POWER-']) {
      const ref = `${batt.id}:${terminal}`
      const has = batt.ports.some(p => p.id === terminal)

      if (!has) {continue}
      results.push(
        wired.has(ref)
          ? { level: 'pass', code: 'BATT_WIRED', message: `${batt.id}:${terminal} connected` }
          : { level: 'fail', code: 'BATT_UNWIRED', message: `${batt.id}:${terminal} is NOT wired` }
      )
    }
  }

  // 2. Har ESC ki power + signal?
  for (const esc of byType('esc')) {
    const pIn = `${esc.id}:POWER+`
    const sig = `${esc.id}:SIGNAL`
    const powerOk = esc.ports.some(p => p.id === 'POWER+') && wired.has(pIn)
    const signalOk = esc.ports.some(p => p.id === 'SIGNAL') && wired.has(sig)

    results.push(
      powerOk
        ? { level: 'pass', code: 'ESC_POWER', message: `${esc.id} power wired` }
        : { level: 'fail', code: 'ESC_NO_POWER', message: `${esc.id} has no power input wire` }
    )
    results.push(
      signalOk
        ? { level: 'pass', code: 'ESC_SIGNAL', message: `${esc.id} signal wired` }
        : { level: 'warn', code: 'ESC_NO_SIGNAL', message: `${esc.id} signal line not wired` }
    )
  }

  // 3. Motor phase wiring (kisi bhi MOTOR_A source se uske motor tak)
  const phaseTargets = new Set(
    Object.values(project.wires)
      .filter(w => w.source.includes(':MOTOR_'))
      .map(w => w.target.split(':')[0])
  )

  for (const m of byType('bldc_motor')) {
    results.push(
      phaseTargets.has(m.id)
        ? { level: 'pass', code: 'MOTOR_PHASE', message: `${m.id} phases wired` }
        : { level: 'fail', code: 'MOTOR_NO_PHASE', message: `${m.id} has no phase wires` }
    )
  }

  // 4. FC signal outputs jise juda hi nahi
  for (const fc of byType('flight_controller')) {
    const motorOuts = fc.ports.filter(p => p.protocol === 'dshot')
    let unwired = 0

    for (const port of motorOuts) {
      if (!wired.has(`${fc.id}:${port.id}`)) {unwired += 1}
    }

    if (motorOuts.length > 0) {
      results.push(
        unwired === 0
          ? { level: 'pass', code: 'FC_OUTPUTS', message: `${fc.id}: all ${motorOuts.length} dshot outputs wired` }
          : { level: 'warn', code: 'FC_OPEN_OUTPUTS', message: `${fc.id}: ${unwired}/${motorOuts.length} dshot outputs unwired` }
      )
    }
  }

  // 5. Voltage-class sanity: battery nominal vs har motor max_voltage_v
  const batt = firstBattery(project)
  const battCells = ((batt?.electrical ?? {}) as Record<string, unknown>).cells_s

  if (typeof battCells === 'number') {
    const packV = battCells * 3.7

    for (const m of byType('bldc_motor')) {
      const maxV = (m.electrical ?? {})['max_voltage_v']

      if (typeof maxV !== 'number') {continue}
      results.push(
        packV <= maxV
          ? { level: 'pass', code: 'V_CLASS_OK', message: `${m.id}: ${packV.toFixed(1)}V pack ≤ ${maxV}V rated` }
          : { level: 'fail', code: 'V_CLASS_OVER', message: `${m.id}: ${packV.toFixed(1)}V pack EXCEEDS ${maxV}V rating` }
      )
    }
  }

  if (results.length === 0) {
    results.push({ level: 'warn', code: 'NOTHING_TO_CHECK', message: 'No powered components to check yet' })
  }

  return results
}

export function buildBomRows(project: ArtifactProject): BomRow[] {
  const groups = new Map<string, BomRow>()

  for (const c of Object.values(project.components)) {
    const meta = (c.metadata ?? {}) as Record<string, unknown>
    const key = `${c.type}|${String(meta.part_number ?? c.name)}`

    const existing = groups.get(key)
    const massEach = c.mass_g ?? null
    const cost = typeof meta.cost_usd === 'number' ? meta.cost_usd : null
    const pn = typeof meta.part_number === 'string' ? meta.part_number : null

    if (existing) {
      existing.qty += 1

      continue
    }

    groups.set(key, {
      key,
      type: c.type,
      name: c.name,
      qty: 1,
      massGEach: massEach,
      partNumber: pn,
      costUsdEach: cost
    })
  }

  return [...groups.values()].sort((a, b) => b.qty - a.qty || a.type.localeCompare(b.type))
}
