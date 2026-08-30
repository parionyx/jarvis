import { describe, expect, it } from 'vitest'

import type { ArtifactProject } from '@/types/artifact-studio'

import { buildSceneSpec } from './scene-spec'

function makeProject(overrides: Partial<ArtifactProject> = {}): ArtifactProject {
  return {
    version: 1,
    id: 'proj_scene0001',
    name: 'Scene Drone',
    category: 'drone',
    status: 'conceptual',
    validation: 'unverified',
    manufacturing_ready: false,
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    revision: 2,
    metadata: {},
    components: {
      'frame.main': {
        id: 'frame.main', type: 'frame', name: 'Frame', category: 'mechanical', status: 'conceptual',
        geometry: { primitive: 'frame_quad', params: { wheelbase_mm: 300, arm_width_mm: 20 } },
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        material: { name: 'generic' }, mass_g: null,
        ports: [], electrical: null, mechanical: null, thermal: null, metadata: {}
      },
      'motor.front_left': {
        id: 'motor.front_left', type: 'bldc_motor', name: 'FL', category: 'electromechanical', status: 'conceptual',
        geometry: { primitive: 'cylinder', params: { diameter_mm: 28, height_mm: 30 } },
        transform: { position: { x: -150, y: -150, z: 25 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        material: { name: 'generic' }, mass_g: null,
        ports: [
          { id: 'POWER+', kind: 'power', direction: 'input' },
          { id: 'POWER-', kind: 'ground', direction: 'input' }
        ],
        electrical: null, mechanical: null, thermal: null, metadata: {}
      }
    },
    assemblies: {},
    wires: {
      w1: {
        id: 'w1', source: 'battery.main:POWER+', target: 'motor.front_left:POWER+',
        gauge: null, material: 'copper', color: 'red', length_mm: null, metadata: {}
      }
    },
    constraints: {},
    annotations: [],
    dimensions: [],
    simulation: {},
    scene_viewport: {},
    ...overrides
  }
}

describe('buildSceneSpec', () => {
  it('expands frame_quad into plate + 4 arms sharing the parent pick id', () => {
    const spec = buildSceneSpec(makeProject())
    const frameMeshes = spec.meshes.filter(m => m.id.startsWith('frame.main'))

    expect(frameMeshes).toHaveLength(5) // plate + 4 arms
    expect(frameMeshes.every(m => m.id.split('::')[0] === 'frame.main')).toBe(true)
  })

  it('maps motor to cylinder dims from geometry params', () => {
    const spec = buildSceneSpec(makeProject())
    const motor = spec.meshes.find(m => m.id === 'motor.front_left')

    expect(motor?.kind).toBe('motor')
    expect(motor?.dims).toEqual({ x: 28, y: 30, z: 28 })
    expect(motor?.position).toEqual({ x: -150, y: -150, z: 25 })
  })

  it('resolves wire endpoints to component anchors with known colors', () => {
    const spec = buildSceneSpec(makeProject())

    // battery.main absent in fixture → anchor unresolved → wire dropped (honest)
    expect(spec.wires).toHaveLength(0)
  })

  it('keeps wires whose both anchors resolve', () => {
    const project = makeProject()
    project.components['battery.main'] = {
      id: 'battery.main', type: 'lipo_battery', name: 'Batt', category: 'power', status: 'conceptual',
      geometry: { primitive: 'box', params: {} },
      transform: { position: { x: 0, y: 0, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      material: { name: 'generic' }, mass_g: null,
      ports: [{ id: 'POWER+', kind: 'power', direction: 'output' }],
      electrical: null, mechanical: null, thermal: null, metadata: {}
    }

    const spec = buildSceneSpec(project)

    expect(spec.wires).toHaveLength(1)
    expect(spec.wires[0].colorHex).toBe(0xdc2626) // red
    expect(spec.wires[0].from.x).toBe(0)
    expect(spec.wires[0].to.x).not.toBe(0) // offset by port spread
  })
})

describe('custom (unknown) types', () => {
  it('renders unknown types as box with user dims + color', () => {
    const project = makeProject()
    project.components['laser_module.custom'] = {
      id: 'laser_module.custom', type: 'laser_module', name: 'Laser', category: 'custom', status: 'conceptual',
      geometry: { primitive: 'box', params: { w_mm: 50, h_mm: 20, d_mm: 25 } },
      transform: { position: { x: 10, y: 10, z: 60 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      material: { name: 'custom', color: '#ff5500' },
      mass_g: null, ports: [], electrical: null, mechanical: null, thermal: null, metadata: {}
    }

    const spec = buildSceneSpec(project)
    const laser = spec.meshes.find(m => m.id === 'laser_module.custom')

    expect(laser?.kind).toBe('box')
    expect(laser?.dims).toEqual({ x: 50, y: 20, z: 25 })
    expect(laser?.colorHex).toBe(0xff5500)
  })
})
