/**
 * Engineering Artifact IR — TypeScript mirror of the backend schema
 * (hermes_artifacts.py). The backend document is authoritative; these types
 * describe the shape the renderer consumes and displays. Keep field names in
 * sync — the store validates nothing beyond presence and treats the gateway
 * response as truth.
 */

export type ArtifactProjectStatus =
  | 'conceptual'
  | 'geometrically_consistent'
  | 'simulation_tested'
  | 'engineering_validated'
  | 'manufacturing_ready'

export type ArtifactValidationState = 'unverified' | 'passed' | 'warnings' | 'failed'

/** Provenance labels every simulated/derived value must carry (never omitted). */
export type ProvenanceLabel =
  | 'CALCULATED'
  | 'SIMULATED'
  | 'ESTIMATED'
  | 'USER_PROVIDED'
  | 'DATABASE_VALUE'
  | 'UNKNOWN'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Transform {
  position: Vec3
  rotation: Vec3
  scale: Vec3
}

export interface ComponentGeometry {
  primitive: string
  params: Record<string, unknown>
  mesh_path?: null | string
}

export interface ComponentMaterial {
  name: string
  color?: null | string
  density_g_cm3?: null | number
}

export type PortKind = 'power' | 'ground' | 'signal' | 'data' | 'rf' | 'mechanical'
export type PortDirection = 'input' | 'output' | 'bidirectional'

export interface ComponentPort {
  id: string
  kind: PortKind
  direction: PortDirection
  voltage_rating_v?: null | number
  current_rating_a?: null | number
  protocol?: null | string
}

export interface ArtifactComponent {
  /** Stable semantic id (e.g. 'motor.front_left') — never a display name. */
  id: string
  type: string
  name: string
  category: string
  status: ArtifactProjectStatus
  geometry: ComponentGeometry
  transform: Transform
  material: ComponentMaterial
  mass_g?: null | number
  ports: ComponentPort[]
  electrical?: null | Record<string, unknown>
  mechanical?: null | Record<string, unknown>
  thermal?: null | Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface ArtifactWire {
  id: string
  source: string // 'component_id:PORT_ID'
  target: string
  gauge?: null | string
  material: string
  color?: null | string
  length_mm?: null | number
  metadata: Record<string, unknown>
}

export interface ArtifactConstraint {
  id: string
  type: 'parent'
  parent: string
  child: string
  offset?: null | Record<string, number>
}

export interface ArtifactAssembly {
  id: string
  root: string
  children: string[]
  explode_factor: number
}

export interface ArtifactAnnotation {
  id: string
  text: string
  anchor_component?: null | string
  position?: null | Vec3
}

export interface ArtifactDimension {
  id: string
  kind: 'distance' | 'angle' | 'radius'
  a: string
  b?: null | string
  value?: null | number
  unit: 'mm' | 'deg'
}

/**
 * The full artifact document. Collections are keyed by stable semantic id on
 * the wire; the backend also accepts/normalizes list form.
 */
export interface ArtifactProject {
  version: number
  id: string
  name: string
  category: string

  status: ArtifactProjectStatus
  validation: ArtifactValidationState
  manufacturing_ready: boolean

  created_at: string
  updated_at: string
  revision: number

  metadata: Record<string, unknown>

  components: Record<string, ArtifactComponent>
  assemblies: Record<string, ArtifactAssembly>
  wires: Record<string, ArtifactWire>
  constraints: Record<string, ArtifactConstraint>
  annotations: ArtifactAnnotation[]
  dimensions: ArtifactDimension[]

  simulation: Record<string, unknown>
  scene_viewport: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Strict action catalog — mirrors hermes_artifacts.py. The backend is the
// validator; this union exists for typed composition in the studio UI.
// ---------------------------------------------------------------------------

interface ActionBase {
  reason?: string
}

export type ArtifactAction =
  | (ActionBase & { type: 'component.create'; component: Partial<ArtifactComponent> & { id: string; type: string; name: string }; parent_assembly?: string })
  | (ActionBase & { type: 'component.delete'; component_id: string; recursive?: boolean })
  | (ActionBase & { type: 'component.update'; component_id: string; patch: Record<string, unknown> })
  | (ActionBase & { type: 'component.transform'; component_id: string; transform: Partial<Transform>; relative?: boolean })
  | (ActionBase & { type: 'component.material'; component_id: string; material: ComponentMaterial })
  | (ActionBase & { type: 'assembly.create'; assembly_id: string; root: string; children?: string[] })
  | (ActionBase & { type: 'assembly.parent'; parent_id: string; child_id: string; offset?: Record<string, number> })
  | (ActionBase & { type: 'assembly.unparent'; child_id: string })
  | (ActionBase & { type: 'assembly.explode'; assembly_id: string; factor: number })
  | (ActionBase & { type: 'wire.create'; source: string; target: string; wire_id?: string; gauge?: string; color?: string; length_mm?: number })
  | (ActionBase & { type: 'wire.delete'; wire_id: string })
  | (ActionBase & { type: 'wire.reroute'; wire_id: string; waypoints_mm: Vec3[] })
  | (ActionBase & { type: 'constraint.create'; constraint: ArtifactConstraint })
  | (ActionBase & { type: 'constraint.delete'; constraint_id: string })
  | (ActionBase & { type: 'annotation.create'; annotation: Omit<ArtifactAnnotation, 'id'> & { id?: string } })
  | (ActionBase & { type: 'dimension.create'; dimension: Omit<ArtifactDimension, 'id'> & { id?: string } })
  | (ActionBase & { type: 'simulation.configure'; config: Record<string, unknown> })
  | (ActionBase & { type: 'simulation.run'; scenario: Record<string, unknown> })
  | (ActionBase & { type: 'scene.update'; viewport: Record<string, unknown> })

export type ActionRisk = 'low' | 'medium' | 'high' | 'critical'

/** Backend-assessed pending proposal (REVIEW_REQUIRED payload). */
export interface PendingProposal {
  type: string
  payload: Record<string, unknown>
  risk: ActionRisk
  reversible: boolean
  reason?: null | string
}

export interface RevisionRow {
  revision: number
  timestamp: string
  source?: null | string
  reason?: null | string
  restored_from?: null | number
  actions?: Array<{ action_id?: string; type?: string; risk?: ActionRisk; reversible?: boolean; reason?: null | string }>
}

export interface ArtifactProjectSummary {
  id: string
  name: string
  category: string
  status: ArtifactProjectStatus
  validation: ArtifactValidationState
  manufacturing_ready: boolean
  revision: number
  updated_at: string
}

export interface AppliedActionResult {
  action_id: string
  type: string
  risk: ActionRisk
  reversible: boolean
}

export interface ApplyActionsResult {
  success: true
  revision: number
  applied: AppliedActionResult[]
}

export interface ReviewRequiredResult {
  success: false
  error: {
    code: 'REVIEW_REQUIRED'
    message: string
    pending: PendingProposal[]
  }
}

/** Alias kept for symmetry with the backend's history row shape. */
export type HistoryRow = RevisionRow

export type AppliedActionInfo = AppliedActionResult

export type StudioMode = 'DESIGN' | 'SIMULATE' | 'ANALYZE' | 'TEST' | 'BUILD'

export interface StudioConsoleLine {
  id: string
  ts: string
  level: 'info' | 'warning' | 'error' | 'success'
  text: string
}

export interface SelectionState {
  componentIds: string[]
  wireIds: string[]
}

export interface StudioCommandContext {
  project_id: string
  revision: number
  selected_component: null | string
  active_mode: StudioMode
  recent_artifact_changes: string[]
}
