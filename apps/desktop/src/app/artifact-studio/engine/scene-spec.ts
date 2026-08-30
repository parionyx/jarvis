import type { ArtifactComponent, ArtifactProject, ArtifactWire } from '@/types/artifact-studio'

/**
 * Pure scene-spec builder — ArtifactProject ko renderable mesh specs me
 * translate karta hai. Three.js se bilkul alag rakha gaya hai taaki unit-
 * testable rahe aur future viewers (web/mobile) wahi spec use kar sakein.
 *
 * World units = millimetres (project frame), Y-up renderer side.
 */

export type PrimitiveKind =
  | 'frame_quad'
  | 'motor'
  | 'esc'
  | 'battery'
  | 'pcb'
  | 'propeller'
  | 'box'
  | 'cylinder'
  | 'resistor'
  | 'led'
  | 'transformer'
  | 'relay'
  | 'sensor'

export interface MeshSpec {
  id: string
  kind: PrimitiveKind
  /** mm — world units */
  dims: { x: number; y: number; z: number }
  position: { x: number; y: number; z: number }
  rotationDeg: { x: number; y: number; z: number }
  colorHex: number
  opacity?: number
}

export interface WireSpec {
  id: string
  from: { x: number; y: number; z: number }
  to: { x: number; y: number; z: number }
  colorHex: number
}

export interface SceneSpec {
  meshes: MeshSpec[]
  wires: WireSpec[]
}

const COLORS = {
  frame: 0x52525b,
  motor: 0x0e7490,
  esc: 0x57534e,
  battery: 0x15803d,
  pcb: 0x14532d,
  propeller: 0x64748b,
  actuator: 0xb45309,
  passive: 0x9a3412,
  sensor: 0x6d28d9,
  power: 0x1d4ed8,
  default: 0x71717a
} as const

const BOX_KINDS = new Set<string>([
  'esc',
  'battery',
  'pcb',
  'box',
  'transformer',
  'relay',
  'switch',
  'sensor',
  'connector'
])

const CYLINDER_KINDS = new Set<string>(['cylinder', 'motor', 'resistor', 'capacitor', 'led'])

function num(params: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const v = params?.[key]

  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function primitiveFor(type: string): PrimitiveKind {
  switch (type) {
    case 'frame':
      return 'frame_quad'

    case 'bldc_motor':

    case 'dc_motor':

    case 'stepper':
      return 'motor'

    case 'esc':

    case 'motor_driver':
      return 'esc'

    case 'lipo_battery':

    case 'battery':

    case 'battery_pack':
      return 'battery'

    case 'flight_controller':

    case 'distribution_board':

    case 'pcb':

    case 'mcu_board':

    case 'arduino':

    case 'esp32':

    case 'raspberry_pi':
      return 'pcb'

    case 'propeller':
      return 'propeller'

    case 'servo':

    case 'gripper':
      return 'box'

    case 'resistor':

    case 'capacitor':

    case 'inductor':
      return 'resistor'

    case 'led':
      return 'led'

    case 'transformer':
      return 'transformer'

    case 'relay':

    case 'switch':
      return 'relay'

    case 'imu_sensor':

    case 'gps_module':

    case 'sensor_temperature':

    case 'sensor_pressure':

    case 'sensor_distance':

    case 'camera':

    case 'display':
      return 'sensor'

    default:
      // Unknown type: generic box — har part render hota hai.
      return 'box'
  }
}

function colorFor(component: ArtifactComponent, kind: PrimitiveKind): number {
  const matColor = component.material?.color

  if (typeof matColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(matColor)) {
    return Number.parseInt(matColor.slice(1), 16)
  }

  if (kind === 'pcb') {return COLORS.pcb}

  const map: Record<string, number> = {
    bldc_motor: COLORS.motor,
    dc_motor: COLORS.motor,
    stepper: COLORS.motor,
    esc: COLORS.esc,
    motor_driver: COLORS.esc,
    lipo_battery: COLORS.battery,
    battery: COLORS.battery,
    battery_pack: COLORS.battery,
    propeller: COLORS.propeller,
    servo: COLORS.actuator,
    gripper: COLORS.actuator,
    resistor: COLORS.passive,
    capacitor: COLORS.passive,
    inductor: COLORS.passive,
    transformer: COLORS.passive,
    relay: COLORS.passive,
    switch: COLORS.passive,
    fuse: COLORS.passive,
    imu_sensor: COLORS.sensor,
    gps_module: COLORS.sensor,
    sensor_temperature: COLORS.sensor,
    sensor_pressure: COLORS.sensor,
    sensor_distance: COLORS.sensor,
    camera: COLORS.sensor,
    display: COLORS.sensor,
    voltage_regulator: COLORS.power,
    base: COLORS.frame,
    link: COLORS.frame,
    bracket: COLORS.frame,
    enclosure: COLORS.frame
  }

  return map[component.type] ?? COLORS.default
}

function dimsFor(component: ArtifactComponent, kind: PrimitiveKind): MeshSpec['dims'] {
  const p = component.geometry?.params as Record<string, unknown> | undefined

  if (CYLINDER_KINDS.has(kind)) {
    // Passive cylinders — params ho to use karo.
    const d = num(p, 'diameter_mm', kind === 'led' ? 5 : 8)
    const h = num(p, 'height_mm', kind === 'led' ? 8 : 14)

    return { x: d, y: h, z: d }
  }

  switch (kind) {
    case 'frame_quad': {
      // Cross-section arms ke through approximate bounding box.
      const wb = num(p, 'wheelbase_mm', 300)

      return { x: wb + 30, y: 12, z: wb + 30 }
    }

    case 'motor':
      return { x: num(p, 'diameter_mm', 28), y: num(p, 'height_mm', 30), z: num(p, 'diameter_mm', 28) }

    case 'propeller':
      return { x: num(p, 'diameter_in', 5) * 25.4, y: 3, z: num(p, 'pitch_in', 4) * 4 }

    default:
      // Sab box-family kinds (esc/battery/pcb/sensor/relay/…) + fallback.
      return { x: num(p, 'w_mm', 40), y: num(p, 'h_mm', 10), z: num(p, 'd_mm', 40) }
  }
}

/** Port world-position ka conservative approximation: parent component ka
 * centre + chhota per-port offset (exact port geometry Phase-3+). */
function portAnchor(project: ArtifactProject, ref: string): { x: number; y: number; z: number } | null {
  const compId = ref.split(':', 1)[0]
  const c = project.components[compId]

  if (!c) {return null}
  const t = c.transform?.position ?? { x: 0, y: 0, z: 0 }
  const ports = c.ports ?? []
  const idx = Math.max(0, ports.findIndex(p => p.id === ref.split(':').slice(1).join(':')))
  const spread = ports.length > 1 ? (idx / (ports.length - 1) - 0.5) * Math.min(20, ports.length * 4) : 0

  return { x: t.x + spread, y: t.y + 4, z: t.z }
}

function wireColor(wire: ArtifactWire): number {
  if (wire.color === 'red') {return 0xdc2626}

  if (wire.color === 'black') {return 0x18181b}

  if (wire.color === 'yellow') {return 0xca8a04}

  return 0xf97316
}

export function buildSceneSpec(project: ArtifactProject): SceneSpec {
  const meshes: MeshSpec[] = []

  for (const c of Object.values(project.components)) {
    const kind = primitiveFor(c.type)

    const transform = c.transform ?? {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }

    if (kind === 'frame_quad') {
      // Frame ko readable parts me todte hain: centre plate + 4 arms —
      // ek solid slab ki jagah actual quad look.
      const wb = num(c.geometry?.params as Record<string, unknown> | undefined, 'wheelbase_mm', 300)
      const armW = num(c.geometry?.params as Record<string, unknown> | undefined, 'arm_width_mm', 20)
      const plateT = 8
      const pos = transform.position
      meshes.push({
        id: `${c.id}::plate`,
        kind: 'box',
        dims: { x: 90, y: plateT, z: 90 },
        position: { ...pos },
        rotationDeg: { ...transform.rotation },
        colorHex: COLORS.frame
      })
      const armLen = wb / 2

      const corners: Array<[number, number]> = [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1]
      ]

      corners.forEach(([sx, sz], i) => {
        meshes.push({
          id: `${c.id}::arm${i}`,
          kind: 'box',
          dims: { x: armLen, y: plateT - 2, z: armW },
          position: { x: pos.x + (sx * armLen) / 2, y: pos.y, z: pos.z + (sz * armLen) / 2 },
          rotationDeg: { x: 0, y: sx * sz > 0 ? -45 : 45, z: 0 },
          colorHex: COLORS.frame
        })
      })

      continue
    }

    meshes.push({
      id: c.id,
      kind,
      dims: dimsFor(c, kind),
      position: { ...transform.position },
      rotationDeg: { ...transform.rotation },
      colorHex: colorFor(c, kind),
      opacity: kind === 'propeller' ? 0.85 : undefined
    })
  }

  const wires: WireSpec[] = []

  for (const w of Object.values(project.wires)) {
    const from = portAnchor(project, w.source)
    const to = portAnchor(project, w.target)

    if (!from || !to || (from.x === to.x && from.y === to.y && from.z === to.z)) {continue}

    wires.push({
      id: w.id,
      from,
      to,
      colorHex: wireColor(w)
    })
  }

  return { meshes, wires }
}
