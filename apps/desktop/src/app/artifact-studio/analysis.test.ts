import { describe, expect, it } from 'vitest'

import type { ArtifactComponent, ArtifactProject } from '@/types/artifact-studio'

import { buildBomRows, computePowerEstimate, runConnectivityChecks } from './analysis'

function comp(partial: Partial<ArtifactComponent> & { id: string; type: string }): ArtifactComponent {
  return {
    name: partial.id,
    category: 'mechanical',
    status: 'conceptual',
    geometry: { primitive: 'box', params: {} },
    transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    material: { name: 'generic' },
    mass_g: null,
    ports: [],
    electrical: null,
    mechanical: null,
    thermal: null,
    metadata: {},
    ...partial
  }
}

function projectWith(components: ArtifactComponent[], wires: ArtifactProject['wires'] = {}): ArtifactProject {
  return {
    version: 1,
    id: 'proj_analysis01',
    name: 'Analysis',
    category: 'drone',
    status: 'conceptual',
    validation: 'unverified',
    manufacturing_ready: false,
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    revision: 1,
    metadata: {},
    components: Object.fromEntries(components.map(c => [c.id, c])),
    assemblies: {},
    wires,
    constraints: {},
    annotations: [],
    dimensions: [],
    simulation: {},
    scene_viewport: {}
  }
}

const battery = comp({
  id: 'battery.main',
  type: 'lipo_battery',
  category: 'power',
  mass_g: 180,
  ports: [
    { id: 'POWER+', kind: 'power', direction: 'output' },
    { id: 'POWER-', kind: 'ground', direction: 'output' }
  ],
  electrical: { cells_s: 4, capacity_mah: 1500 }
})

describe('computePowerEstimate', () => {
  it('derives pack voltage and energy from battery electrical data', () => {
    const est = computePowerEstimate(projectWith([battery]))

    expect(est.nominalVoltageV).toBe(14.8)
    expect(est.capacityWh).toBeCloseTo(22.2, 1)
  })

  it('hover estimate carries the rule-of-thumb note (ESTIMATED honesty)', () => {
    const esc = comp({ id: 'esc.x', type: 'esc', category: 'electronics', mass_g: 8 })
    const est = computePowerEstimate(projectWith([battery, esc]))

    expect(est.estHoverPowerW).toBeGreaterThan(0)
    expect(est.notes.some(n => n.includes('rule of thumb'))).toBe(true)
    expect(est.estHoverMinutes).not.toBeNull()
  })
})

describe('runConnectivityChecks', () => {
  it('fails ESC power when unwired and passes when wired', () => {
    const esc = comp({
      id: 'esc.front_left',
      type: 'esc',
      category: 'electronics',
      ports: [
        { id: 'POWER+', kind: 'power', direction: 'input' },
        { id: 'SIGNAL', kind: 'signal', direction: 'input' }
      ]
    })

    const unwired = runConnectivityChecks(projectWith([battery, esc]))
    expect(unwired.some(r => r.code === 'ESC_NO_POWER' && r.level === 'fail')).toBe(true)

    const wired = runConnectivityChecks(
      projectWith([battery, esc], {
        w1: { id: 'w1', source: 'battery.main:POWER+', target: 'esc.front_left:POWER+', gauge: null, material: 'copper', color: 'red', length_mm: null, metadata: {} },
        w2: { id: 'w2', source: 'fc.flight_controller:MOTOR1', target: 'esc.front_left:SIGNAL', gauge: null, material: 'copper', color: null, length_mm: null, metadata: {} }
      })
    )

    expect(wired.some(r => r.code === 'ESC_POWER' && r.level === 'pass')).toBe(true)
    expect(wired.some(r => r.code === 'ESC_SIGNAL' && r.level === 'pass')).toBe(true)
  })

  it('flags voltage-class overrun on overrated pack vs motor rating', () => {
    const motor = comp({
      id: 'motor.x',
      type: 'bldc_motor',
      category: 'electromechanical',
      electrical: { max_voltage_v: 12.6 }
    })

    const results = runConnectivityChecks(projectWith([battery, motor]))

    // 4S pack = 14.8V nominal > 12.6V rated → fail expected
    expect(results.some(r => r.code === 'V_CLASS_OVER' && r.level === 'fail')).toBe(true)
  })

  it('warns honestly when there is nothing to check', () => {
    const results = runConnectivityChecks(projectWith([]))
    expect(results[0].code).toBe('NOTHING_TO_CHECK')
  })
})

describe('buildBomRows', () => {
  it('groups identical parts by type+part_number with qty rollup', () => {
    const mkMotor = (id: string): ArtifactComponent =>
      comp({
        id,
        type: 'bldc_motor',
        name: `Motor ${id}`,
        mass_g: 30,
        metadata: { part_number: '2204-2300KV', cost_usd: 12.5 }
      })

    const rows = buildBomRows(projectWith([mkMotor('motor.a'), mkMotor('motor.b'), battery]))

    const motors = rows.find(r => r.type === 'bldc_motor')
    expect(motors?.qty).toBe(2)
    expect(motors?.costUsdEach).toBe(12.5)

    const battRow = rows.find(r => r.type === 'lipo_battery')
    expect(battRow?.qty).toBe(1)
  })
})
