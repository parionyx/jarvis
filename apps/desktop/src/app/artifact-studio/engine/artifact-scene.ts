import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { ArtifactProject } from '@/types/artifact-studio'

import { buildSceneSpec } from './scene-spec'

const CYL_KINDS: ReadonlySet<string> = new Set<string>([
  'cylinder',
  'motor',
  'resistor',
  'capacitor',
  'led'
])

/**
 * Three.js scene manager for the Artifact Studio viewport.
 *
 - Demand-driven rendering: frames render only when something changed
   (orbit, selection, project update) — idle CPU ~0 on low-end machines.
 - Full content rebuild per revision: drone-scale artifacts (<100 meshes)
   make rebuild trivial and kill stale-mesh bugs.
 - World units = millimetres. Project frame is Z-up (drone template);
   one group-level X-rotation maps it onto the renderer's Y-up.
 */

const BACKGROUND = 0x101214

export class ArtifactScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private contentGroup = new THREE.Group()
  private resizeObserver: ResizeObserver
  private dirty = true
  private raf = 0
  private raycaster = new THREE.Raycaster()
  private pickables: THREE.Object3D[] = []
  private selectedId: null | string = null
  private onPick: ((componentId: null | string) => void) | null = null
  private disposed = false
  private container: HTMLElement
  private lastRevision = -1

  // --- Flight simulation (ESTIMATED model, client-side) ---
  private sim = {
    playing: false,
    throttle: 0.55,
    tSec: 0,
    altitudeMm: 0,
    vyMps: 0,
    massKg: 0,
    packV: 0,
    capacityWh: 0,
    kv: 0,
    hoverPowerW: 0,
    propSpinners: [] as THREE.Object3D[],
    socPct: 100
  }
  private lastFrameMs = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setClearColor(BACKGROUND, 1)
    container.appendChild(this.renderer.domElement)
    const style = this.renderer.domElement.style
    style.display = 'block'
    style.width = '100%'
    style.height = '100%'

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 20000)
    this.camera.position.set(420, 380, 520)

    this.scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x1a1d21, 1.0))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(300, 600, 250)
    this.scene.add(dir)

    const grid = new THREE.GridHelper(1200, 24, 0x2a2f36, 0x1c2126)
    grid.position.y = -60
    this.scene.add(grid)
    this.scene.add(new THREE.AxesHelper(70))
    // Project Z-up → renderer Y-up.
    this.contentGroup.rotation.x = -Math.PI / 2
    this.scene.add(this.contentGroup)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.target.set(0, 20, 0)
    this.controls.addEventListener('change', () => {
      this.dirty = true
    })

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)

    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(container)
    this.handleResize()

    this.loop()
  }

  setPickHandler(cb: (componentId: null | string) => void): void {
    this.onPick = cb
  }

  /** Reflect project snapshot + selection. Cheap when revision unchanged. */
  update(project: ArtifactProject, selectedComponentId: null | string): void {
    if (this.disposed) {return}

    this.selectedId = selectedComponentId

    if (project.revision !== this.lastRevision) {
      this.lastRevision = project.revision
      this.rebuild(project)
      this.applyHighlight()
      this.dirty = true

      return
    }

    this.applyHighlight()
    this.dirty = true
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.controls.dispose()
    this.clearGroup()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private handleResize = (): void => {
    if (this.disposed) {return}
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.dirty = true
  }

  private clearGroup(): void {
    for (const obj of [...this.contentGroup.children]) {
      this.contentGroup.remove(obj)
      const mesh = obj as THREE.Mesh

      if (!mesh.isMesh) {continue}
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[]

      if (Array.isArray(mat)) {mat.forEach(m => m.dispose())}
      else {mat?.dispose()}
    }

    this.pickables = []
    this.sim.propSpinners = []
  }

  private rebuild(project: ArtifactProject): void {
    this.clearGroup()

    let spec

    try {
      spec = buildSceneSpec(project)
    } catch {
      return
    }

    for (const m of spec.meshes) {
      let geo: THREE.BufferGeometry

      if (CYL_KINDS.has(m.kind)) {
        geo = new THREE.CylinderGeometry(m.dims.x / 2, m.dims.x / 2, m.dims.y, 24)
      } else {
        geo = new THREE.BoxGeometry(m.dims.x, m.dims.y, m.dims.z)
      }

      const transparent = m.opacity !== undefined && m.opacity < 1

      const mat = new THREE.MeshLambertMaterial({
        color: m.colorHex,
        transparent,
        opacity: m.opacity ?? 1
      })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(m.position.x, m.position.y, m.position.z)
      mesh.rotation.set(
        THREE.MathUtils.degToRad(m.rotationDeg.x),
        THREE.MathUtils.degToRad(m.rotationDeg.y),
        THREE.MathUtils.degToRad(m.rotationDeg.z)
      )
      // Pick target sirf real components (frame arms carry parent id).
      mesh.userData.componentId = m.id.split('::')[0]

      // Propellers spin during flight sim (local Z = blade normal).
      if (m.kind === 'propeller') {this.sim.propSpinners.push(mesh)}
      this.contentGroup.add(mesh)
      this.pickables.push(mesh)
    }

    for (const w of spec.wires) {
      const mid = new THREE.Vector3(
        (w.from.x + w.to.x) / 2,
        Math.min(w.from.y, w.to.y) - 14,
        (w.from.z + w.to.z) / 2
      )

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(w.from.x, w.from.y, w.from.z),
        mid,
        new THREE.Vector3(w.to.x, w.to.y, w.to.z)
      ])

      const geo = new THREE.TubeGeometry(curve, 16, 1.6, 6, false)
      const tube = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: w.colorHex }))
      this.contentGroup.add(tube)
    }

    // --- Sim model inputs (ESTIMATED) — project data se derive ---
    let massG = 0
    let cells = 0
    let capMah = 0
    let kvSum = 0
    let kvCount = 0

    for (const c of Object.values(project.components)) {
      if (typeof c.mass_g === 'number') {massG += c.mass_g}

      const e = (c.electrical ?? {}) as Record<string, unknown>

      if (c.type.includes('battery') || c.type === 'lipo_battery') {
        if (typeof e.cells_s === 'number') {cells = Math.max(cells, e.cells_s)}

        if (typeof e.capacity_mah === 'number') {capMah = Math.max(capMah, e.capacity_mah)}
      }

      if (c.type === 'bldc_motor' && typeof e.kv === 'number') {
        kvSum += e.kv
        kvCount += 1
      }
    }

    this.sim.massKg = massG / 1000
    this.sim.packV = cells ? +(cells * 3.7).toFixed(1) : 14.8
    this.sim.capacityWh = cells && capMah ? +((cells * 3.7 * capMah) / 1000).toFixed(1) : 22.2
    this.sim.kv = kvCount ? Math.round(kvSum / kvCount) : 2300

    // Rule-of-thumb hover power (same as ANALYZE panel — 180 W/kg).
    this.sim.hoverPowerW = this.sim.massKg > 0 ? Math.round(this.sim.massKg * 180) : 0
  }

  private applyHighlight(): void {
    for (const obj of this.pickables) {
      const mesh = obj as THREE.Mesh
      const compId = mesh.userData.componentId as null | string
      const mat = mesh.material as THREE.MeshLambertMaterial

      if (!compId || !mat?.emissive) {continue}

      if (this.selectedId && compId === this.selectedId) {
        mat.emissive.setHex(0x0e7490)
        mat.emissiveIntensity = 0.9
      } else {
        mat.emissive.setHex(0x000000)
        mat.emissiveIntensity = 0
      }
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.onPick) {return}

    const rect = this.renderer.domElement.getBoundingClientRect()

    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    const first = hits.find(h => h.object.userData.componentId != null)

    this.onPick(first ? (first.object.userData.componentId as string) : null)
  }

  // ------------------------------------------------------------------
  // Flight simulation (honest ESTIMATED model)
  //
  // Thrust = throttle^1.5 × maxThrust (maxThrust = mass·g·2.2 typical TWR
  // headroom). Euler-integrated vertical velocity + altitude, ground clamp.
  // Electrical: current = hoverPowerW·(throttle/hoverThr) / packV; RPM =
  // kv·packV·throttle; SOC drains capacity over integrated Wh used.
  // Har value UI me "EST" tag ke saath dikhta hai — solver nahi hai ye.
  // ------------------------------------------------------------------

  startFlight(): void {
    this.sim.playing = true
    this.lastFrameMs = performance.now()
    this.dirty = true
  }

  pauseFlight(): void {
    this.sim.playing = false
    this.dirty = true
  }

  stopFlight(): void {
    this.sim.playing = false
    this.sim.tSec = 0
    this.sim.altitudeMm = 0
    this.sim.vyMps = 0
    this.sim.socPct = 100
    this.contentGroup.position.y = 0
    this.dirty = true
  }

  setThrottle(pct: number): void {
    this.sim.throttle = Math.max(0, Math.min(1, pct / 100))
    this.dirty = true
  }

  getTelemetry(): FlightTelemetry {
    const s = this.sim
    const thr = Math.max(s.throttle, 0.001)

    return {
      playing: s.playing,
      tSec: +(s.tSec).toFixed(1),
      altitudeM: +(s.altitudeMm / 1000).toFixed(2),
      vyMps: +s.vyMps.toFixed(2),
      throttlePct: Math.round(s.throttle * 100),
      rpm: Math.round(s.kv * s.packV * thr),
      currentA: s.hoverPowerW > 0 && s.packV > 0 ? +((s.hoverPowerW * (thr / 0.55)) / s.packV).toFixed(1) : 0,
      powerW: s.hoverPowerW > 0 ? Math.round(s.hoverPowerW * (thr / 0.55)) : 0,
      socPct: +s.socPct.toFixed(1)
    }
  }

  private stepSim(dtSec: number): void {
    const s = this.sim

    if (!s.playing || dtSec <= 0) {return}

    s.tSec += dtSec

    // Thrust model (ESTIMATED): T = maxTWR · m·g · throttle^1.5
    const weightN = s.massKg * G
    const thrustN = MAX_TWR * weightN * Math.pow(Math.max(s.throttle, 0.001), 1.5)
    const netN = thrustN - weightN

    // Euler integrate vertical dynamics; ground clamp with soft bounce.
    s.vyMps += (netN / Math.max(s.massKg, 0.001)) * dtSec

    if (s.altitudeMm <= 0 && s.vyMps < 0) {
      s.vyMps = 0
      s.altitudeMm = 0
    }

    s.altitudeMm += s.vyMps * 1000 * dtSec

    if (s.altitudeMm < 0) {
      s.altitudeMm = 0
    }

    // Visual: assembly lift in renderer Y (project Z-up → group already rotated).
    this.contentGroup.position.y += (s.vyMps * 10 * dtSec) // mm→scene scale ×10 for visibility

    if (this.contentGroup.position.y < 0) {
      this.contentGroup.position.y = 0
    }

    // Prop spin (props identified at rebuild time).
    const spin = (s.kv * s.packV * s.throttle / 60) * dtSec * 6 // visual rad/s

    for (const prop of s.propSpinners) {
      prop.rotation.z += spin
    }

    // Battery drain: Wh used = powerW · t → SOC%.
    if (s.capacityWh > 0) {
      const powerW = s.hoverPowerW * (Math.max(s.throttle, 0.001) / 0.55)
      const whUsed = (powerW * dtSec) / 3600
      s.socPct = Math.max(0, s.socPct - (whUsed / s.capacityWh) * 100)
    }
  }

  private loop = (): void => {
    if (this.disposed) {return}
    this.raf = requestAnimationFrame(this.loop)

    const now = performance.now()
    const dtSec = this.lastFrameMs ? Math.min((now - this.lastFrameMs) / 1000, 0.05) : 0
    this.lastFrameMs = now

    if (this.sim.playing) {
      this.stepSim(dtSec)
      this.dirty = true
    }

    // Damped controls ko settle karne do; jab tak movement hai dirty rahega,
    // settle hone ke baad RAF sirf spin hota hai — zero GPU/CPU work.
    if (this.controls.update()) {this.dirty = true}

    if (!this.dirty) {return}

    this.dirty = false
    this.renderer.render(this.scene, this.camera)
  }
}

const G = 9.81
const MAX_TWR = 2.2

export interface FlightTelemetry {
  playing: boolean
  tSec: number
  altitudeM: number
  vyMps: number
  throttlePct: number
  rpm: number
  currentA: number
  powerW: number
  socPct: number
}
