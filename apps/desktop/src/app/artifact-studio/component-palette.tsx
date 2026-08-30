import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { useI18n } from '@/i18n'
import {
  $activeArtifactProject,
  applyArtifactActions,
  pushConsoleLine
} from '@/store/artifact-studio'

import { CustomPartForm } from './custom-part-form'

/**
 * Component Palette — koi bhi project, koi bhi part: click-to-add se blank
 * project ko full design banaya ja sakta hai. IDs deterministic hote hain
 * (`<type>.<n>`), position origin ke paas stack hoti hai (JARVIS/design se
 * move kar sakte ho).
 */

interface PaletteItem {
  type: string
  label: string
}

interface PaletteGroup {
  label: string
  items: PaletteItem[]
}

const PALETTE: PaletteGroup[] = [
  {
    label: 'Mechanical',
    items: [
      { type: 'frame', label: 'Frame / chassis' },
      { type: 'bracket', label: 'Bracket' },
      { type: 'base', label: 'Base plate' },
      { type: 'link', label: 'Link arm' },
      { type: 'enclosure', label: 'Enclosure' },
      { type: 'propeller', label: 'Propeller' }
    ]
  },
  {
    label: 'Electronics',
    items: [
      { type: 'mcu_board', label: 'MCU board' },
      { type: 'flight_controller', label: 'Flight controller' },
      { type: 'esp32', label: 'ESP32' },
      { type: 'esc', label: 'ESC' },
      { type: 'motor_driver', label: 'Motor driver' }
    ]
  },
  {
    label: 'Actuators',
    items: [
      { type: 'bldc_motor', label: 'BLDC motor' },
      { type: 'dc_motor', label: 'DC motor' },
      { type: 'servo', label: 'Servo' },
      { type: 'stepper', label: 'Stepper' },
      { type: 'gripper', label: 'Gripper' }
    ]
  },
  {
    label: 'Power',
    items: [
      { type: 'lipo_battery', label: 'LiPo battery' },
      { type: 'distribution_board', label: 'Distribution board' },
      { type: 'voltage_regulator', label: 'Voltage regulator' },
      { type: 'fuse', label: 'Fuse' }
    ]
  },
  {
    label: 'Passive & misc',
    items: [
      { type: 'resistor', label: 'Resistor' },
      { type: 'capacitor', label: 'Capacitor' },
      { type: 'transformer', label: 'Transformer' },
      { type: 'relay', label: 'Relay' },
      { type: 'switch', label: 'Switch' },
      { type: 'imu_sensor', label: 'IMU sensor' },
      { type: 'gps_module', label: 'GPS module' }
    ]
  }
]

/** Deterministic semantic id: `<type>.1`, `<type>.2`, … unique in project. */
export function nextComponentId(existingIds: Iterable<string>, type: string): string {
  const taken = new Set(existingIds)
  let n = 1

  while (taken.has(`${type}.${n}`)) {n += 1}

  return `${type}.${n}`
}

/** Free-text naam ko semantic type-slug banata hai ("Laser Module" →
 * "laser_module"). Backend koi type-whitelist NAHI lagata — custom types
 * first-class hain; renderer box-fallback + diye gaye params se render
 * karta hai. */
export function slugifyType(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

  return slug || 'custom_part'
}

const CATEGORY_BY_TYPE: Record<string, string> = {
  frame: 'mechanical',
  bracket: 'mechanical',
  base: 'mechanical',
  link: 'mechanical',
  enclosure: 'mechanical',
  propeller: 'mechanical',
  mcu_board: 'electronics',
  flight_controller: 'electronics',
  esp32: 'electronics',
  esc: 'electronics',
  motor_driver: 'electronics',
  bldc_motor: 'electromechanical',
  dc_motor: 'electromechanical',
  servo: 'actuator',
  stepper: 'actuator',
  gripper: 'actuator',
  lipo_battery: 'power',
  distribution_board: 'power',
  voltage_regulator: 'power',
  fuse: 'power',
  resistor: 'passive',
  capacitor: 'passive',
  transformer: 'passive',
  relay: 'passive',
  switch: 'passive',
  imu_sensor: 'sensor',
  gps_module: 'sensor'
}

export function ComponentPalette() {
  const { t } = useI18n()
  const a = t.artifactStudio
  const project = useStore($activeArtifactProject)

  const groups = useMemo(() => PALETTE, [])

  if (!project) {return null}

  const addPart = async (item: PaletteItem): Promise<void> => {
    const id = nextComponentId(Object.keys(project.components), item.type)
    // Origin ke upar chhota stack offset — turant dikhe viewport me.
    const stackZ = Object.keys(project.components).length * 12

    const ok = await applyArtifactActions(
      [
        {
          type: 'component.create',
          component: {
            id,
            type: item.type,
            name: item.label,
            category: CATEGORY_BY_TYPE[item.type] ?? 'misc',
            transform: {
              position: { x: 0, y: 0, z: 40 + stackZ },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 }
            }
          }
        }
      ],
      { reason: 'palette add' }
    )

    if (!ok) {pushConsoleLine('error', `could not add ${id}`)}
  }

  return (
    <div className="border-t border-(--ui-stroke-tertiary)" data-testid="artifact-palette">
      <div className="px-2 pt-2 pb-1 text-[0.625rem] tracking-[0.08em] text-(--ui-text-tertiary) uppercase">
        {a.paletteTitle}
      </div>
      <div className="max-h-52 overflow-y-auto px-1 pb-2">
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-1 pt-1 pb-[2px] text-[0.5625rem] font-medium tracking-wide text-(--ui-text-quaternary, var(--ui-text-tertiary)) uppercase">
              {group.label}
            </div>
            <div className="flex flex-wrap gap-1 px-1">
              {group.items.map(item => (
                <button
                  className="rounded-[4px] border border-(--ui-stroke-tertiary) px-1.5 py-[2px] text-[0.5625rem] text-(--ui-text-secondary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
                  key={item.type}
                  onClick={() => void addPart(item)}
                  title={`${a.paletteAdd}: ${item.label}`}
                  type="button"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <CustomPartForm />
    </div>
  )
}
