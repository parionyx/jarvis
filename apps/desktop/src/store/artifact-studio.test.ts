import { describe, expect, it } from 'vitest'

import type { ArtifactProject } from '@/types/artifact-studio'

import {
  $activeArtifactProject,
  $artifactSelection,
  $assemblyTreeRoots,
  $selectedComponent,
  buildCommandContext,
  setArtifactSelection,
  setStudioMode
} from './artifact-studio'

function makeProject(overrides: Partial<ArtifactProject> = {}): ArtifactProject {
  return {
    version: 1,
    id: 'proj_test1234',
    name: 'Test Drone',
    category: 'drone',
    status: 'conceptual',
    validation: 'unverified',
    manufacturing_ready: false,
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
    revision: 3,
    metadata: {},
    components: {
      'frame.main': {
        id: 'frame.main', type: 'frame', name: 'Frame', category: 'mechanical',
        status: 'conceptual',
        geometry: { primitive: 'frame_quad', params: {} },
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        material: { name: 'carbon_fiber' },
        mass_g: 120, ports: [], electrical: null, mechanical: null, thermal: null, metadata: {}
      },
      'battery.main': {
        id: 'battery.main', type: 'lipo_battery', name: 'Battery', category: 'power',
        status: 'conceptual',
        geometry: { primitive: 'box', params: {} },
        transform: { position: { x: 0, y: 0, z: -12 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        material: { name: 'lipo' },
        mass_g: 180, ports: [], electrical: null, mechanical: null, thermal: null, metadata: {}
      },
      'motor.front_left': {
        id: 'motor.front_left', type: 'bldc_motor', name: 'FL Motor', category: 'electromechanical',
        status: 'conceptual',
        geometry: { primitive: 'cylinder', params: {} },
        transform: { position: { x: 150, y: 150, z: 25 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
        material: { name: 'aluminum' },
        mass_g: 30, ports: [], electrical: null, mechanical: null, thermal: null, metadata: {}
      }
    },
    assemblies: {},
    wires: {},
    constraints: {
      'battery.main': { id: 'battery.main', type: 'parent', parent: 'frame.main', child: 'battery.main', offset: null },
      'motor.front_left': { id: 'motor.front_left', type: 'parent', parent: 'frame.main', child: 'motor.front_left', offset: null }
    },
    annotations: [],
    dimensions: [],
    simulation: {},
    scene_viewport: {},
    ...overrides
  }
}

describe('artifact-studio store', () => {
  it('derives selection from the active project', () => {
    $activeArtifactProject.set(makeProject())
    setArtifactSelection(['battery.main'])

    expect($selectedComponent.get()?.id).toBe('battery.main')

    // Unknown ids resolve to nothing rather than throwing.
    setArtifactSelection(['ghost.thing'])
    expect($selectedComponent.get()).toBeNull()
  })

  it('assembly roots exclude constrained children', () => {
    $activeArtifactProject.set(makeProject())
    const roots = $assemblyTreeRoots.get()
    expect(roots).toContain('frame.main')
    expect(roots).not.toContain('battery.main')
    expect(roots).not.toContain('motor.front_left')
  })

  it('builds the JARVIS command context from current state', () => {
    $activeArtifactProject.set(makeProject())
    setArtifactSelection(['battery.main'])
    setStudioMode('DESIGN')

    const ctx = buildCommandContext()
    expect(ctx).not.toBeNull()
    expect(ctx!.project_id).toBe('proj_test1234')
    expect(ctx!.revision).toBe(3)
    expect(ctx!.selected_component).toBe('battery.main')
    expect(ctx!.active_mode).toBe('DESIGN')
  })

  it('command context is null with no project open', () => {
    $activeArtifactProject.set(null)
    expect(buildCommandContext()).toBeNull()
  })

  it('selection state keeps wire and component lists independent', () => {
    $artifactSelection.set({ componentIds: ['frame.main'], wireIds: ['wire_1'] })
    expect($artifactSelection.get().componentIds).toEqual(['frame.main'])
    expect($artifactSelection.get().wireIds).toEqual(['wire_1'])
  })
})
