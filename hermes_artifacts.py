#!/usr/bin/env python3
"""Engineering Artifacts — the Artifact IR and its file-backed store.

An artifact project is a structured intermediate representation (IR) of a
physical engineering concept: components with stable semantic ids, ports,
assemblies, wires, constraints, annotations and simulation state. The IR is
the contract between JARVIS (intent), the renderer (Three.js), the simulator
and future export targets — never mere saved UI state.

Persistence is human-readable JSON under ``$HERMES_HOME/artifacts/``::

    artifacts/
    ├── index.json                  # {project_id: summary}
    └── proj_<id>/
        ├── project.json            # current IR (authoritative cache)
        ├── revisions/
        │   ├── rev_0000.json       # baseline snapshot
        │   └── rev_NNNN.json       # full post-state snapshot per revision
        └── exports/

Every mutation flows through :meth:`ArtifactStore.apply_actions` — a strict,
schema-validated, risk-assessed, transactional action pipeline. There is no
other write path. Each successful batch appends one full-snapshot revision
(simple, restorable, diffable; disk cost is trivial at artifact scale).

Status ladder (gate-controlled — never claimable directly)::

    conceptual → geometrically_consistent → simulation_tested
               → engineering_validated → manufacturing_ready

The store NEVER invents engineering truth: simulated values carry provenance
labels downstream, status/validation transitions are gated, and Phase 1 keeps
every project at the honestly-earned level.
"""

from __future__ import annotations

import copy
import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from hermes_constants import get_hermes_home

# ---------------------------------------------------------------------------
# Error codes (explicit — callers branch on these, never parse prose)
# ---------------------------------------------------------------------------

E_PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND"
E_INVALID_ACTION = "INVALID_ACTION"
E_INVALID_COMPONENT = "INVALID_COMPONENT"
E_INVALID_PORT = "INVALID_PORT"
E_INVALID_CONNECTION = "INVALID_CONNECTION"
E_REVISION_CONFLICT = "REVISION_CONFLICT"
E_REVIEW_REQUIRED = "REVIEW_REQUIRED"
E_VALIDATION_FAILED = "VALIDATION_FAILED"
E_SIMULATION_FAILED = "SIMULATION_FAILED"
E_EXPORT_FAILED = "EXPORT_FAILED"


class ArtifactError(Exception):
    """Structured artifact failure: ``err.code`` + ``err.extra`` for callers."""

    def __init__(self, code: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.code = code
        self.extra = extra


class ReviewRequired(ArtifactError):
    """A batch contains medium/high-risk actions without review confirmation.

    ``pending`` carries the assessed proposals so the UI can render an
    APPLY ALL / CANCEL card from real backend-computed risk data.
    """

    def __init__(self, message: str, pending: List[Dict[str, Any]]) -> None:
        super().__init__(E_REVIEW_REQUIRED, message, pending=pending)
        self.pending = pending


# ---------------------------------------------------------------------------
# Status model (gates) + provenance vocabulary
# ---------------------------------------------------------------------------

STATUS_CONCEPTUAL = "conceptual"
STATUS_GEOMETRICALLY_CONSISTENT = "geometrically_consistent"
STATUS_SIMULATION_TESTED = "simulation_tested"
STATUS_ENGINEERING_VALIDATED = "engineering_validated"
STATUS_MANUFACTURING_READY = "manufacturing_ready"

PROJECT_STATUSES = (
    STATUS_CONCEPTUAL,
    STATUS_GEOMETRICALLY_CONSISTENT,
    STATUS_SIMULATION_TESTED,
    STATUS_ENGINEERING_VALIDATED,
    STATUS_MANUFACTURING_READY,
)

VALIDATION_UNVERIFIED = "unverified"
VALIDATION_PASSED = "passed"
VALIDATION_WARNINGS = "warnings"
VALIDATION_FAILED_STATE = "failed"

PROVENANCE_LABELS = (
    "CALCULATED",
    "SIMULATED",
    "ESTIMATED",
    "USER_PROVIDED",
    "DATABASE_VALUE",
    "UNKNOWN",
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


_SEMANTIC_ID_RE = re.compile(r"^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$")


def _validate_semantic_id(value: str) -> str:
    """Stable semantic ids: ``frame.main``, ``motor.front_left``.

    Display names may change; identity may not. At least one dot-separated
    qualifier keeps ids self-describing and collision-resistant.
    """
    if not _SEMANTIC_ID_RE.match(value):
        raise ValueError(
            f"invalid semantic id {value!r}: expected dotted lowercase form like 'motor.front_left'"
        )
    return value


# ---------------------------------------------------------------------------
# Artifact IR models
# ---------------------------------------------------------------------------


class Transform(BaseModel):
    """Position (mm), rotation (deg), scale (unit) in the project frame."""

    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0, "z": 0.0})
    rotation: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0, "z": 0.0})
    scale: Dict[str, float] = Field(default_factory=lambda: {"x": 1.0, "y": 1.0, "z": 1.0})


class Geometry(BaseModel):
    """Procedural primitive + params now; mesh_path for real assets later."""

    primitive: str = "box"
    params: Dict[str, Any] = Field(default_factory=dict)
    mesh_path: Optional[str] = None


class Material(BaseModel):
    name: str = "generic"
    color: Optional[str] = None
    density_g_cm3: Optional[float] = None


class Port(BaseModel):
    id: str
    kind: Literal["power", "ground", "signal", "data", "rf", "mechanical"] = "signal"
    direction: Literal["input", "output", "bidirectional"] = "bidirectional"
    voltage_rating_v: Optional[float] = None
    current_rating_a: Optional[float] = None
    protocol: Optional[str] = None


class Component(BaseModel):
    """A physical part of the artifact. Identity is the semantic id."""

    id: str
    type: str
    name: str
    category: str = "mechanical"
    status: str = STATUS_CONCEPTUAL
    geometry: Geometry = Field(default_factory=Geometry)
    transform: Transform = Field(default_factory=Transform)
    material: Material = Field(default_factory=Material)
    mass_g: Optional[float] = None
    ports: List[Port] = Field(default_factory=list)
    electrical: Optional[Dict[str, Any]] = None
    mechanical: Optional[Dict[str, Any]] = None
    thermal: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def _id_is_semantic(cls, value: str) -> str:
        return _validate_semantic_id(value)


class Wire(BaseModel):
    """An electrical connection between two ports (``component:PORT`` refs)."""

    id: str
    source: str
    target: str
    gauge: Optional[str] = None
    material: str = "copper"
    color: Optional[str] = None
    length_mm: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Constraint(BaseModel):
    """Mechanical relationship. Phase 1 supports rigid parenting."""

    id: str
    type: Literal["parent"] = "parent"
    parent: str
    child: str
    offset: Optional[Dict[str, float]] = None


class Annotation(BaseModel):
    id: str
    text: str
    anchor_component: Optional[str] = None
    position: Optional[Dict[str, float]] = None


class Dimension(BaseModel):
    id: str
    kind: Literal["distance", "angle", "radius"] = "distance"
    a: str  # component id or "comp:PORT"
    b: Optional[str] = None
    value: Optional[float] = None
    unit: Literal["mm", "deg"] = "mm"


class Assembly(BaseModel):
    id: str
    root: str
    children: List[str] = Field(default_factory=list)
    explode_factor: float = 0.0

    @field_validator("explode_factor")
    @classmethod
    def _clamp_explode(cls, value: float) -> float:
        return max(0.0, min(3.0, value))


class ArtifactProject(BaseModel):
    """The full Artifact IR document — one engineering concept."""

    version: int = 1
    id: str
    name: str
    category: str = "generic"

    status: str = STATUS_CONCEPTUAL
    validation: str = VALIDATION_UNVERIFIED
    manufacturing_ready: bool = False

    created_at: str
    updated_at: str
    revision: int = 0

    metadata: Dict[str, Any] = Field(default_factory=dict)

    components: Dict[str, Component] = Field(default_factory=dict)
    assemblies: Dict[str, Assembly] = Field(default_factory=dict)
    wires: Dict[str, Wire] = Field(default_factory=dict)
    constraints: Dict[str, Constraint] = Field(default_factory=dict)
    annotations: List[Annotation] = Field(default_factory=list)
    dimensions: List[Dimension] = Field(default_factory=list)

    simulation: Dict[str, Any] = Field(default_factory=dict)
    scene_viewport: Dict[str, Any] = Field(default_factory=dict)

    from pydantic import model_validator

    @model_validator(mode="before")
    @classmethod
    def _coerce_keyed_collections(cls, data: Any) -> Any:
        """Accept list-of-objects for components/wires/etc. and key them by id.
        The canonical persisted form is a dict; lists keep authoring (and the
        renderer) ergonomic."""
        if not isinstance(data, dict):
            return data
        for field in ("components", "assemblies", "wires", "constraints"):
            value = data.get(field)
            if isinstance(value, list):
                data[field] = {
                    item["id"]: item for item in value if isinstance(item, dict) and item.get("id")
                }
        return data

    def total_mass_g(self) -> float:
        return sum(c.mass_g or 0.0 for c in self.components.values())


# ---------------------------------------------------------------------------
# Strict action catalog — the ONLY mutation vocabulary
#
# Every AI/renderer mutation is one of these typed actions. The backend
# validates, risk-assesses and applies them transactionally; arbitrary JSON
# state patches do not exist.
# ---------------------------------------------------------------------------


class _ActionBase(BaseModel):
    """Caller-supplied fields every action may carry. Backend adds the rest."""

    reason: Optional[str] = None


class ComponentCreate(_ActionBase):
    type: Literal["component.create"]
    component: Component
    parent_assembly: Optional[str] = None


class ComponentDelete(_ActionBase):
    type: Literal["component.delete"]
    component_id: str
    recursive: bool = False


class ComponentUpdate(_ActionBase):
    type: Literal["component.update"]
    component_id: str
    patch: Dict[str, Any]


class ComponentTransform(_ActionBase):
    type: Literal["component.transform"]
    component_id: str
    transform: Transform
    relative: bool = False


class ComponentMaterial(_ActionBase):
    type: Literal["component.material"]
    component_id: str
    material: Material


class AssemblyCreate(_ActionBase):
    type: Literal["assembly.create"]
    assembly_id: str
    root: str
    children: List[str] = Field(default_factory=list)


class AssemblyParent(_ActionBase):
    type: Literal["assembly.parent"]
    parent_id: str
    child_id: str
    offset: Optional[Dict[str, float]] = None


class AssemblyUnparent(_ActionBase):
    type: Literal["assembly.unparent"]
    child_id: str


class AssemblyExplode(_ActionBase):
    type: Literal["assembly.explode"]
    assembly_id: str
    factor: float


class WireCreate(_ActionBase):
    type: Literal["wire.create"]
    wire_id: Optional[str] = None
    source: str  # "component_id:PORT_ID"
    target: str
    gauge: Optional[str] = None
    color: Optional[str] = None
    length_mm: Optional[float] = None


class WireDelete(_ActionBase):
    type: Literal["wire.delete"]
    wire_id: str


class WireReroute(_ActionBase):
    type: Literal["wire.reroute"]
    wire_id: str
    waypoints_mm: List[Dict[str, float]]


class ConstraintCreate(_ActionBase):
    type: Literal["constraint.create"]
    constraint: Constraint


class ConstraintDelete(_ActionBase):
    type: Literal["constraint.delete"]
    constraint_id: str


class AnnotationCreate(_ActionBase):
    type: Literal["annotation.create"]
    annotation: Annotation


class DimensionCreate(_ActionBase):
    type: Literal["dimension.create"]
    dimension: Dimension


class SimulationConfigure(_ActionBase):
    type: Literal["simulation.configure"]
    config: Dict[str, Any]


class SimulationRun(_ActionBase):
    type: Literal["simulation.run"]
    scenario: Dict[str, Any]


class SceneUpdate(_ActionBase):
    type: Literal["scene.update"]
    viewport: Dict[str, Any]


ArtifactAction = Union[
    ComponentCreate,
    ComponentDelete,
    ComponentUpdate,
    ComponentTransform,
    ComponentMaterial,
    AssemblyCreate,
    AssemblyParent,
    AssemblyUnparent,
    AssemblyExplode,
    WireCreate,
    WireDelete,
    WireReroute,
    ConstraintCreate,
    ConstraintDelete,
    AnnotationCreate,
    DimensionCreate,
    SimulationConfigure,
    SimulationRun,
    SceneUpdate,
]


def parse_action(raw: Any) -> ArtifactAction:
    """Parse + schema-validate one raw action dict into the typed catalog."""
    from pydantic import TypeAdapter

    adapter = getattr(parse_action, "_adapter", None)
    if adapter is None:
        adapter = TypeAdapter(ArtifactAction)
        parse_action._adapter = adapter  # type: ignore[attr-defined]
    try:
        return adapter.validate_python(raw)
    except Exception as exc:
        raise ArtifactError(E_INVALID_ACTION, f"invalid action: {exc}") from exc


def parse_actions(raw_actions: List[Any]) -> List[ArtifactAction]:
    if not isinstance(raw_actions, list) or not raw_actions:
        raise ArtifactError(E_INVALID_ACTION, "actions must be a non-empty list")
    return [parse_action(raw) for raw in raw_actions]


# ---------------------------------------------------------------------------
# Risk model — backend-computed; AI-supplied risk is never trusted
# ---------------------------------------------------------------------------

RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"
RISK_CRITICAL = "critical"

# A transform beyond these deltas needs review even though it is reversible.
TRANSFORM_REVIEW_MM = 50.0
ROTATE_REVIEW_DEG = 30.0

# Patch keys that change engineering substance (vs cosmetic naming).
_ENGINEERING_PATCH_KEYS = {
    "type",
    "geometry",
    "electrical",
    "mechanical",
    "thermal",
    "material",
    "mass_g",
    "ports",
}


class RiskAssessment:
    __slots__ = ("risk", "reversible", "requires_review")

    def __init__(self, risk: str, reversible: bool, requires_review: bool) -> None:
        self.risk = risk
        self.reversible = reversible
        self.requires_review = requires_review

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk": self.risk,
            "reversible": self.reversible,
            "requires_review": self.requires_review,
        }


def _vec_delta(a: Dict[str, float], b: Dict[str, float]) -> float:
    import math

    return math.sqrt(sum((float(a.get(k, 0.0)) - float(b.get(k, 0.0))) ** 2 for k in ("x", "y", "z")))


def assess_risk(action: ArtifactAction, project: ArtifactProject, source: str = "ai") -> RiskAssessment:
    """Compute risk from the action AND current state. Reversible actions are
    always recoverable via the append-only revision log.

    ``source='user'`` tuning exception: when the USER personally edits
    engineering fields from the studio (electrical values, dims, mass,
    material), the change is intentional, instantly visible in their viewport
    and one undo away — forcing a review card per keystroke would make the
    lab unusable. AI-proposed engineering changes STILL require review.
    Delete / large transforms stay gated for both sources.
    """
    user_direct = source == "user"
    t = type(action)

    if t is ComponentCreate:
        return RiskAssessment(RISK_LOW, True, False)
    if t is ComponentDelete:
        return RiskAssessment(RISK_MEDIUM, True, True)
    if t is ComponentUpdate:
        keys = set(action.patch.keys())
        if keys & _ENGINEERING_PATCH_KEYS:
            return RiskAssessment(RISK_LOW if user_direct else RISK_MEDIUM, True, not user_direct)
        return RiskAssessment(RISK_LOW, True, False)
    if t is ComponentTransform:
        comp = project.components.get(action.component_id)
        if comp is None:
            return RiskAssessment(RISK_MEDIUM, True, True)
        # Movement is what carries risk: a RELATIVE action's delta IS its
        # offset vector (distance from zero), an ABSOLUTE action's delta is
        # the distance from the component's CURRENT position. Getting this
        # backwards made small nudges of far-placed parts demand review.
        if action.relative:
            base = {"x": 0.0, "y": 0.0, "z": 0.0}
        else:
            base = comp.transform.position
        move_mm = _vec_delta(base, action.transform.position)
        rot = max(abs(float(v)) for v in action.transform.rotation.values()) if action.transform.rotation else 0.0
        if move_mm <= TRANSFORM_REVIEW_MM and rot <= ROTATE_REVIEW_DEG:
            return RiskAssessment(RISK_LOW, True, False)
        return RiskAssessment(RISK_MEDIUM, True, True)
    if t is ComponentMaterial:
        return RiskAssessment(RISK_LOW if user_direct else RISK_MEDIUM, True, not user_direct)
    if t in (AssemblyCreate, AssemblyParent, AssemblyUnparent, AssemblyExplode):
        return RiskAssessment(RISK_LOW, True, False)
    if t is WireCreate:
        src_kind, tgt_kind = _wire_kinds(project, action.source, action.target)
        if src_kind and tgt_kind and src_kind != tgt_kind:
            return RiskAssessment(RISK_HIGH, True, True)
        return RiskAssessment(RISK_LOW, True, False)
    if t in (WireDelete, WireReroute):
        return RiskAssessment(RISK_LOW, True, False)
    if t in (ConstraintCreate, ConstraintDelete):
        return RiskAssessment(RISK_LOW, True, False)
    if t in (AnnotationCreate, DimensionCreate):
        return RiskAssessment(RISK_LOW, True, False)
    if t in (SimulationConfigure, SimulationRun, SceneUpdate):
        return RiskAssessment(RISK_LOW, True, False)
    return RiskAssessment(RISK_MEDIUM, True, True)


# ---------------------------------------------------------------------------
# State validation helpers
# ---------------------------------------------------------------------------


def _split_port_ref(ref: str) -> tuple[str, str]:
    if ":" not in ref:
        raise ArtifactError(E_INVALID_PORT, f"port ref {ref!r} must be 'component_id:PORT_ID'")
    comp_id, port_id = ref.split(":", 1)
    if not comp_id or not port_id:
        raise ArtifactError(E_INVALID_PORT, f"port ref {ref!r} is incomplete")
    return comp_id, port_id


def _resolve_port(project: ArtifactProject, ref: str) -> Port:
    comp_id, port_id = _split_port_ref(ref)
    comp = project.components.get(comp_id)
    if comp is None:
        raise ArtifactError(E_INVALID_COMPONENT, f"unknown component {comp_id!r}")
    for port in comp.ports:
        if port.id == port_id:
            return port
    raise ArtifactError(E_INVALID_PORT, f"component {comp_id!r} has no port {port_id!r}")


def _wire_kinds(project: ArtifactProject, source: str, target: str) -> tuple[Optional[str], Optional[str]]:
    try:
        return _resolve_port(project, source).kind, _resolve_port(project, target).kind
    except ArtifactError:
        return None, None


def _validate_wire_create(project: ArtifactProject, action: WireCreate) -> None:
    src = _resolve_port(project, action.source)
    tgt = _resolve_port(project, action.target)

    if action.source == action.target:
        raise ArtifactError(E_INVALID_CONNECTION, "a wire cannot connect a port to itself")

    src_comp, _ = _split_port_ref(action.source)
    tgt_comp, _ = _split_port_ref(action.target)

    # Phase-1 short-circuit guard: direct power↔ground loop inside one
    # component (e.g. battery POWER+ → battery POWER-). Full circuit-graph
    # analysis arrives with the Phase 3 simulator.
    if src_comp == tgt_comp and {src.kind, tgt.kind} == {"power", "ground"}:
        raise ArtifactError(
            E_INVALID_CONNECTION,
            "blocked: this wire shorts the component's own power rail "
            "(power→ground on the same part). Use a load between them.",
            short_circuit=True,
        )

    if src.kind != tgt.kind:
        raise ArtifactError(
            E_INVALID_CONNECTION,
            f"kind mismatch: {src.kind} cannot connect to {tgt.kind}",
        )

    for existing in project.wires.values():
        pair = {existing.source, existing.target}
        if pair == {action.source, action.target}:
            raise ArtifactError(E_INVALID_CONNECTION, "these ports are already wired")


# ---------------------------------------------------------------------------
# Apply engine — mutates a working copy; any failure aborts the whole batch
# ---------------------------------------------------------------------------


def _apply_one(work: ArtifactProject, action: ArtifactAction) -> None:
    t = type(action)

    if t is ComponentCreate:
        if action.component.id in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"component {action.component.id!r} already exists")
        if action.parent_assembly:
            asm = work.assemblies.get(action.parent_assembly)
            if asm is None:
                raise ArtifactError(E_INVALID_COMPONENT, f"unknown assembly {action.parent_assembly!r}")
            asm.children.append(action.component.id)
        work.components[action.component.id] = action.component.model_copy(deep=True)
        return

    if t is ComponentDelete:
        comp_id = action.component_id
        if comp_id not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown component {comp_id!r}")
        children_of = [cst.child for cst in work.constraints.values() if cst.parent == comp_id]
        if children_of and not action.recursive:
            raise ArtifactError(
                E_VALIDATION_FAILED,
                f"{comp_id!r} parents {children_of}; pass recursive=true to delete the subtree",
                children=children_of,
            )
        doomed = {comp_id, *children_of}
        for cid in sorted(doomed):
            work.components.pop(cid, None)
        work.wires = {
            wid: w for wid, w in work.wires.items()
            if _split_port_ref(w.source)[0] not in doomed
            and _split_port_ref(w.target)[0] not in doomed
        }
        work.constraints = {
            k: c for k, c in work.constraints.items()
            if c.parent not in doomed and c.child not in doomed
        }
        for asm_id in list(work.assemblies.keys()):
            asm = work.assemblies[asm_id]
            asm.children = [c for c in asm.children if c not in doomed]
            if asm.root in doomed:
                if asm.children:
                    asm.root = asm.children[0]
                else:
                    # Root gone and nothing left to promote: keeping the
                    # assembly would dangle a reference to a deleted part.
                    del work.assemblies[asm_id]
        return

    if t is ComponentUpdate:
        comp = work.components.get(action.component_id)
        if comp is None:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown component {action.component_id!r}")
        forbidden = set(action.patch) & {"id", "status", "validation"}
        if forbidden:
            raise ArtifactError(
                E_VALIDATION_FAILED,
                f"fields {sorted(forbidden)} are gate-controlled and cannot be patched directly",
            )
        data = comp.model_dump()
        for key, value in action.patch.items():
            if key not in data:
                raise ArtifactError(E_VALIDATION_FAILED, f"unknown component field {key!r}")
            data[key] = value
        work.components[action.component_id] = Component.model_validate(data)
        return

    if t is ComponentTransform:
        comp = work.components.get(action.component_id)
        if comp is None:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown component {action.component_id!r}")
        tr = action.transform.model_copy(deep=True)
        if action.relative:
            cur = comp.transform
            tr.position = {k: float(cur.position.get(k, 0.0)) + float(tr.position.get(k, 0.0)) for k in ("x", "y", "z")}
            tr.rotation = {k: float(cur.rotation.get(k, 0.0)) + float(tr.rotation.get(k, 0.0)) for k in ("x", "y", "z")}
            # Scale composes multiplicatively; a bare {x:1,y:1,z:1} in a
            # relative action must not silently reset a non-uniform scale.
            tr.scale = {
                k: float(cur.scale.get(k, 1.0)) * float(tr.scale.get(k, 1.0))
                for k in ("x", "y", "z")
            }
        comp.transform = tr
        return

    if t is ComponentMaterial:
        comp = work.components.get(action.component_id)
        if comp is None:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown component {action.component_id!r}")
        comp.material = action.material.model_copy(deep=True)
        return

    if t is AssemblyCreate:
        if action.assembly_id in work.assemblies:
            raise ArtifactError(E_VALIDATION_FAILED, f"assembly {action.assembly_id!r} already exists")
        if action.root not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown root component {action.root!r}")
        missing = [c for c in action.children if c not in work.components]
        if missing:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown child components {missing}")
        work.assemblies[action.assembly_id] = Assembly(
            id=action.assembly_id, root=action.root, children=list({action.root, *action.children})
        )
        return

    if t is AssemblyParent:
        if action.parent_id not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown parent {action.parent_id!r}")
        if action.child_id not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown child {action.child_id!r}")
        if action.parent_id == action.child_id:
            raise ArtifactError(E_VALIDATION_FAILED, "cannot parent a component to itself")
        # Keyed by child: one parent per child; re-parenting replaces cleanly.
        work.constraints[action.child_id] = Constraint(
            id=action.child_id, parent=action.parent_id, child=action.child_id, offset=action.offset
        )
        return

    if t is AssemblyUnparent:
        removed = [k for k, c in work.constraints.items() if c.child == action.child_id]
        for k in removed:
            work.constraints.pop(k)
        if not removed:
            raise ArtifactError(E_VALIDATION_FAILED, f"{action.child_id!r} has no parent constraint")
        return

    if t is AssemblyExplode:
        asm = work.assemblies.get(action.assembly_id)
        if asm is None:
            raise ArtifactError(E_VALIDATION_FAILED, f"unknown assembly {action.assembly_id!r}")
        asm.explode_factor = max(0.0, min(3.0, action.factor))
        return

    if t is WireCreate:
        _validate_wire_create(work, action)
        wire_id = action.wire_id or _new_id("wire")
        if wire_id in work.wires:
            raise ArtifactError(E_VALIDATION_FAILED, f"wire {wire_id!r} already exists")
        work.wires[wire_id] = Wire(
            id=wire_id, source=action.source, target=action.target,
            gauge=action.gauge, color=action.color, length_mm=action.length_mm,
        )
        return

    if t is WireDelete:
        if action.wire_id not in work.wires:
            raise ArtifactError(E_VALIDATION_FAILED, f"unknown wire {action.wire_id!r}")
        work.wires.pop(action.wire_id)
        return

    if t is WireReroute:
        if action.wire_id not in work.wires:
            raise ArtifactError(E_VALIDATION_FAILED, f"unknown wire {action.wire_id!r}")
        work.wires[action.wire_id].metadata["waypoints_mm"] = action.waypoints_mm
        return

    if t is ConstraintCreate:
        cst = action.constraint
        if cst.parent not in work.components or cst.child not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, "constraint references unknown component")
        work.constraints[cst.id or _new_id("cst")] = cst.model_copy(deep=True)
        return

    if t is ConstraintDelete:
        if action.constraint_id not in work.constraints:
            raise ArtifactError(E_VALIDATION_FAILED, f"unknown constraint {action.constraint_id!r}")
        work.constraints.pop(action.constraint_id)
        return

    if t is AnnotationCreate:
        ann = action.annotation.model_copy(deep=True)
        if not ann.id:
            ann.id = _new_id("ann")
        if ann.anchor_component and ann.anchor_component not in work.components:
            raise ArtifactError(E_INVALID_COMPONENT, f"unknown anchor {ann.anchor_component!r}")
        work.annotations.append(ann)
        return

    if t is DimensionCreate:
        dim = action.dimension.model_copy(deep=True)
        if not dim.id:
            dim.id = _new_id("dim")
        work.dimensions.append(dim)
        return

    if t is SimulationConfigure:
        work.simulation["config"] = copy.deepcopy(action.config)
        return

    if t is SimulationRun:
        # Honest boundary: the solver ships in Phase 3. Never fake results.
        raise ArtifactError(
            E_SIMULATION_FAILED,
            "simulation engine is not available yet (Phase 3); configure scenarios today, run them once the solver lands",
            phase=1,
        )

    if t is SceneUpdate:
        work.scene_viewport = copy.deepcopy(action.viewport)
        return

    raise ArtifactError(E_INVALID_ACTION, f"unsupported action type {getattr(action, 'type', t)!r}")


# ---------------------------------------------------------------------------
# Drone template — a conceptual seed, honestly labelled
# ---------------------------------------------------------------------------

TEMPLATE_DRONE_QUADCOPTER = "drone_quadcopter"
TEMPLATE_ROBOT_ARM = "robot_arm"
_TEMPLATES = (TEMPLATE_DRONE_QUADCOPTER, TEMPLATE_ROBOT_ARM)


def _port(port_id: str, kind: str, direction: str, **kw: Any) -> Port:
    return Port(id=port_id, kind=kind, direction=direction, **kw)  # type: ignore[arg-type]


def _drone_template() -> Dict[str, Any]:
    """Quadcopter conceptual seed. status=conceptual / validation=unverified /
    manufacturing_ready=false — a starting point, NOT a validated design."""

    def motor(cid: str, pos: Dict[str, float]) -> Component:
        return Component(
            id=cid,
            type="bldc_motor",
            name=cid.split(".", 1)[1].replace("_", " ").title(),
            category="electromechanical",
            geometry=Geometry(primitive="cylinder", params={"diameter_mm": 28, "height_mm": 30}),
            transform=Transform(position=pos),
            material=Material(name="aluminum"),
            mass_g=30.0,
            ports=[
                _port("POWER+", "power", "input", voltage_rating_v=16.8, current_rating_a=30),
                _port("POWER-", "ground", "input", current_rating_a=30),
                _port("CONTROL", "signal", "input", protocol="dshot"),
            ],
            electrical={"kv": 2300, "max_voltage_v": 16.8, "max_current_a": 30, "resistance_ohm": 0.08},
            mechanical={"max_rpm": 40000, "prop_size_in": 5},
            thermal={"max_temp_c": 100},
            metadata={"part_number": "2204-2300KV", "cost_usd": 12.5},
        )

    def esc(cid: str, pos: Dict[str, float]) -> Component:
        return Component(
            id=cid,
            type="esc",
            name=cid.split(".", 1)[1].replace("_", " ").title() + " ESC",
            category="electronics",
            geometry=Geometry(primitive="box", params={"w_mm": 35, "d_mm": 18, "h_mm": 8}),
            transform=Transform(position=pos),
            mass_g=8.0,
            ports=[
                _port("POWER+", "power", "input", voltage_rating_v=16.8, current_rating_a=30),
                _port("POWER-", "ground", "input", current_rating_a=30),
                _port("SIGNAL", "signal", "input", protocol="dshot"),
                _port("MOTOR_A", "power", "output", current_rating_a=30),
                _port("MOTOR_B", "power", "output", current_rating_a=30),
            ],
            electrical={"max_current_a": 30, "max_voltage_v": 16.8},
            metadata={"part_number": "BLHeli_30A"},
        )

    corners = {
        "front_left": {"x": -150.0, "y": -150.0, "z": 10.0},
        "front_right": {"x": 150.0, "y": -150.0, "z": 10.0},
        "rear_left": {"x": -150.0, "y": 150.0, "z": 10.0},
        "rear_right": {"x": 150.0, "y": 150.0, "z": 10.0},
    }

    components: List[Component] = [
        Component(
            id="frame.main",
            type="frame",
            name="Quadcopter Frame",
            category="mechanical",
            geometry=Geometry(primitive="frame_quad", params={"wheelbase_mm": 300, "arm_width_mm": 20}),
            material=Material(name="carbon_fiber", density_g_cm3=1.6),
            mass_g=120.0,
            metadata={"part_number": "F300"},
        ),
        Component(
            id="fc.flight_controller",
            type="flight_controller",
            name="Flight Controller",
            category="electronics",
            geometry=Geometry(primitive="pcb", params={"w_mm": 36, "d_mm": 36, "h_mm": 4}),
            transform=Transform(position={"x": 0.0, "y": 0.0, "z": 20.0}),
            mass_g=10.0,
            ports=[
                _port("VBAT", "power", "input", voltage_rating_v=16.8),
                _port("5V", "power", "input", voltage_rating_v=5.0),
                _port("GND", "ground", "input"),
                *[_port(f"MOTOR{i}", "signal", "output", protocol="dshot") for i in range(1, 5)],
                _port("UART_TX", "data", "output", protocol="uart"),
                _port("UART_RX", "data", "input", protocol="uart"),
                _port("I2C_SDA", "data", "bidirectional", protocol="i2c"),
                _port("I2C_SCL", "data", "bidirectional", protocol="i2c"),
            ],
            metadata={"part_number": "F405"},
        ),
        Component(
            id="battery.main",
            type="lipo_battery",
            name="LiPo Battery 4S 1500mAh",
            category="power",
            geometry=Geometry(primitive="box", params={"w_mm": 70, "d_mm": 35, "h_mm": 30}),
            transform=Transform(position={"x": 0.0, "y": 0.0, "z": -12.0}),
            material=Material(name="lipo"),
            mass_g=180.0,
            ports=[
                _port("POWER+", "power", "output", voltage_rating_v=16.8, current_rating_a=100),
                _port("POWER-", "ground", "output", current_rating_a=100),
            ],
            electrical={
                "cells_s": 4,
                "capacity_mah": 1500,
                "nominal_voltage_v": 14.8,
                "full_voltage_v": 16.8,
                "c_rating": 75,
            },
            metadata={"provenance": "USER_PROVIDED"},
        ),
        Component(
            id="pdb.power_distribution",
            type="distribution_board",
            name="Power Distribution Board",
            category="power",
            geometry=Geometry(primitive="pcb", params={"w_mm": 40, "d_mm": 40, "h_mm": 3}),
            transform=Transform(position={"x": 0.0, "y": 0.0, "z": 5.0}),
            mass_g=12.0,
            ports=[
                _port("IN+", "power", "input", voltage_rating_v=16.8, current_rating_a=100),
                _port("IN-", "ground", "input", current_rating_a=100),
                *[
                    p
                    for i in range(1, 5)
                    for p in (
                        _port(f"OUT{i}+", "power", "output", current_rating_a=30),
                        _port(f"OUT{i}-", "ground", "output", current_rating_a=30),
                    )
                ],
            ],
        ),
    ]
    for corner, pos in corners.items():
        spin = 90.0 if corner in ("front_left", "rear_right") else -90.0
        components.append(motor(f"motor.{corner}", {**pos, "z": pos["z"] + 15.0}))
        components.append(esc(f"esc.{corner}", {**pos, "z": pos["z"] - 8.0}))
        components.append(
            Component(
                id=f"prop.{corner}",
                type="propeller",
                name=f"Propeller {corner.replace('_', ' ').title()}",
                category="mechanical",
                geometry=Geometry(primitive="propeller", params={"diameter_in": 5, "pitch_in": 4}),
                transform=Transform(
                    position={**pos, "z": pos["z"] + 32.0},
                    rotation={"x": 0.0, "y": 0.0, "z": spin},
                ),
                material=Material(name="polycarbonate"),
                mass_g=3.0,
                mechanical={
                    "diameter_in": 5,
                    "pitch_in": 4,
                    "rotation": "cw" if spin > 0 else "ccw",
                },
                metadata={"provenance": "USER_PROVIDED"},
            )
        )

    wires: List[Wire] = [
        Wire(id="wire.bat_p", source="battery.main:POWER+", target="pdb.power_distribution:IN+", gauge="14AWG", color="red"),
        Wire(id="wire.bat_n", source="battery.main:POWER-", target="pdb.power_distribution:IN-", gauge="14AWG", color="black"),
    ]
    for i, corner in enumerate(corners, start=1):
        esc_id = f"esc.{corner}"
        motor_id = f"motor.{corner}"
        fc_id = "fc.flight_controller"
        wires += [
            Wire(id=f"wire.pdb_p{i}", source=f"pdb.power_distribution:OUT{i}+", target=f"{esc_id}:POWER+", gauge="18AWG", color="red"),
            Wire(id=f"wire.pdb_n{i}", source=f"pdb.power_distribution:OUT{i}-", target=f"{esc_id}:POWER-", gauge="18AWG", color="black"),
            Wire(id=f"wire.sig{i}", source=f"{fc_id}:MOTOR{i}", target=f"{esc_id}:SIGNAL", color="yellow"),
            Wire(id=f"wire.ph_a{i}", source=f"{esc_id}:MOTOR_A", target=f"{motor_id}:POWER+", gauge="18AWG"),
            Wire(id=f"wire.ph_b{i}", source=f"{esc_id}:MOTOR_B", target=f"{motor_id}:POWER-", gauge="18AWG"),
        ]

    constraints: List[Constraint] = [
        Constraint(id=cid, parent="frame.main", child=cid)
        for cid in (
            *[f"motor.{c}" for c in corners],
            *[f"esc.{c}" for c in corners],
            *[f"prop.{c}" for c in corners],
            "fc.flight_controller",
            "battery.main",
            "pdb.power_distribution",
        )
    ]

    now = _utc_now_iso()
    return {
        "version": 1,
        "id": "",
        "name": "",
        "category": "drone",
        "status": STATUS_CONCEPTUAL,
        "validation": VALIDATION_UNVERIFIED,
        "manufacturing_ready": False,
        "created_at": now,
        "updated_at": now,
        "revision": 0,
        "metadata": {
            "template": TEMPLATE_DRONE_QUADCOPTER,
            "description": "Conceptual quadcopter seed (300mm, 2204 2300KV x4, 30A ESC x4, F405 FC, 4S 1500mAh, 5in props)",
            "target_mass_g": 850,
            "target_voltage_v": 14.8,
            "note": "CONCEPTUAL MODEL - not geometrically validated, not simulated, not flight-ready",
        },
        "components": [c.model_dump() for c in components],
        "assemblies": [
            {
                "id": "airframe",
                "root": "frame.main",
                "children": [c.id for c in components],
                "explode_factor": 0.0,
            }
        ],
        "wires": [w.model_dump() for w in wires],
        "constraints": [c.model_dump() for c in constraints],
        "annotations": [],
        "dimensions": [],
        "simulation": {},
        "scene_viewport": {},
    }


def _robot_arm_template() -> Dict[str, Any]:
    """4-DOF desktop robot arm seed — proves the engine is platform-generic.
    Same honest labelling as every template: conceptual / unverified."""

    def servo(cid: str, name: str, pos: Dict[str, float]) -> Component:
        return Component(
            id=cid,
            type="servo",
            name=name,
            category="actuator",
            geometry=Geometry(primitive="box", params={"w_mm": 40, "d_mm": 20, "h_mm": 41}),
            transform=Transform(position=pos),
            mass_g=55.0,
            ports=[
                _port("VCC", "power", "input", voltage_rating_v=6.0, current_rating_a=3),
                _port("GND", "ground", "input"),
                _port("PWM", "signal", "input", protocol="pwm"),
            ],
            electrical={"max_voltage_v": 7.4, "stall_torque_kgcm": 15},
            metadata={"part_number": "MG996R"},
        )

    components: List[Component] = [
        Component(
            id="base.plinth",
            type="base",
            name="Arm Base",
            category="mechanical",
            geometry=Geometry(primitive="cylinder", params={"diameter_mm": 120, "height_mm": 30}),
            material=Material(name="steel"),
            mass_g=800.0,
        ),
        servo("joint.base_yaw", "Base Yaw Servo", {"x": 0.0, "y": 0.0, "z": 45.0}),
        servo("joint.shoulder", "Shoulder Servo", {"x": 0.0, "y": 0.0, "z": 90.0}),
        servo("joint.elbow", "Elbow Servo", {"x": 60.0, "y": 0.0, "z": 150.0}),
        Component(
            id="link.upper",
            type="link",
            name="Upper Arm Link",
            category="mechanical",
            geometry=Geometry(primitive="box", params={"w_mm": 30, "d_mm": 25, "h_mm": 140}),
            transform=Transform(position={"x": 30.0, "y": 0.0, "z": 160.0}),
            material=Material(name="aluminum"),
            mass_g=140.0,
        ),
        Component(
            id="link.forearm",
            type="link",
            name="Forearm Link",
            category="mechanical",
            geometry=Geometry(primitive="box", params={"w_mm": 24, "d_mm": 20, "h_mm": 120}),
            transform=Transform(position={"x": 100.0, "y": 0.0, "z": 210.0}),
            material=Material(name="aluminum"),
            mass_g=95.0,
        ),
        Component(
            id="gripper.claw",
            type="gripper",
            name="Two-Finger Gripper",
            category="actuator",
            geometry=Geometry(primitive="box", params={"w_mm": 70, "d_mm": 35, "h_mm": 60}),
            transform=Transform(position={"x": 170.0, "y": 0.0, "z": 230.0}),
            mass_g=85.0,
            ports=[
                _port("VCC", "power", "input", voltage_rating_v=6.0),
                _port("GND", "ground", "input"),
                _port("PWM", "signal", "input", protocol="pwm"),
            ],
            electrical={"max_voltage_v": 7.4},
        ),
        Component(
            id="mcu.controller",
            type="mcu_board",
            name="Servo Controller (MCU)",
            category="electronics",
            geometry=Geometry(primitive="pcb", params={"w_mm": 55, "d_mm": 35, "h_mm": 5}),
            transform=Transform(position={"x": -80.0, "y": 0.0, "z": 20.0}),
            mass_g=18.0,
            ports=[
                _port("VIN", "power", "input", voltage_rating_v=6.0),
                _port("GND", "ground", "input"),
                *[_port(f"PWM{i}", "signal", "output", protocol="pwm") for i in range(1, 5)],
                _port("USB", "data", "bidirectional", protocol="usb"),
            ],
            metadata={"part_number": "PCA9685-class"},
        ),
        Component(
            id="battery.main",
            type="battery_pack",
            name="LiPo 2S Pack",
            category="power",
            geometry=Geometry(primitive="box", params={"w_mm": 70, "d_mm": 35, "h_mm": 25}),
            transform=Transform(position={"x": -80.0, "y": 0.0, "z": 55.0}),
            mass_g=110.0,
            ports=[
                _port("POWER+", "power", "output", voltage_rating_v=7.4, current_rating_a=10),
                _port("POWER-", "ground", "output", current_rating_a=10),
            ],
            electrical={
                "cells_s": 2,
                "capacity_mah": 2200,
                "nominal_voltage_v": 7.4,
                "full_voltage_v": 8.4,
            },
            metadata={"provenance": "USER_PROVIDED"},
        ),
    ]

    wires: List[Wire] = [
        Wire(id="wire.pwr_p", source="battery.main:POWER+", target="mcu.controller:VIN", gauge="16AWG", color="red"),
        Wire(id="wire.pwr_n", source="battery.main:POWER-", target="mcu.controller:GND", gauge="16AWG", color="black"),
    ]
    for i, jid in enumerate(("joint.base_yaw", "joint.shoulder", "joint.elbow"), start=1):
        wires.append(Wire(id=f"wire.pwm{i}", source=f"mcu.controller:PWM{i}", target=f"{jid}:PWM", color="orange"))
    wires.append(Wire(id="wire.pwm4", source="mcu.controller:PWM4", target="gripper.claw:PWM", color="orange"))

    constraints: List[Constraint] = [
        Constraint(id=cid, parent="base.plinth", child=cid)
        for cid in (
            "joint.base_yaw",
            "joint.shoulder",
            "link.upper",
            "link.forearm",
            "joint.elbow",
            "gripper.claw",
            "mcu.controller",
            "battery.main",
        )
    ]

    now = _utc_now_iso()
    return {
        "version": 1,
        "id": "",
        "name": "",
        "category": "robot_arm",
        "status": STATUS_CONCEPTUAL,
        "validation": VALIDATION_UNVERIFIED,
        "manufacturing_ready": False,
        "created_at": now,
        "updated_at": now,
        "revision": 0,
        "metadata": {
            "template": TEMPLATE_ROBOT_ARM,
            "description": "Conceptual 4-DOF desktop arm (3 servos + gripper, MCU controller, 2S pack)",
            "target_mass_g": 1400,
            "target_voltage_v": 7.4,
            "note": "CONCEPTUAL MODEL - not geometrically validated, not simulated",
        },
        "components": [c.model_dump() for c in components],
        "assemblies": [
            {
                "id": "arm",
                "root": "base.plinth",
                "children": [c.id for c in components],
                "explode_factor": 0.0,
            }
        ],
        "wires": [w.model_dump() for w in wires],
        "constraints": [c.model_dump() for c in constraints],
        "annotations": [],
        "dimensions": [],
        "simulation": {},
        "scene_viewport": {},
    }


def template_names() -> tuple:
    return _TEMPLATES


def build_template(name: str) -> Dict[str, Any]:
    """Materialize a template into a raw project dict (id/name still blank)."""
    if name == TEMPLATE_DRONE_QUADCOPTER:
        return _drone_template()
    if name == TEMPLATE_ROBOT_ARM:
        return _robot_arm_template()
    raise ArtifactError(E_VALIDATION_FAILED, f"unknown template {name!r}; available: {list(_TEMPLATES)}")


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------


class ArtifactStore:
    """File-backed artifact project store. Thread-safe; one instance per
    process is enough (the gateway installs it once, like projects_db)."""

    def __init__(self, root=None) -> None:
        self._root = Path(root) if root else (get_hermes_home() / "artifacts")
        self._lock = threading.RLock()

    # -- paths ---------------------------------------------------------------

    @property
    def root(self) -> Path:
        return self._root

    def _project_dir(self, project_id: str) -> Path:
        if not re.fullmatch(r"proj_[0-9a-f]{6,16}", str(project_id)):
            raise ArtifactError(E_PROJECT_NOT_FOUND, f"malformed project id {project_id!r}")
        return self._root / project_id

    def _project_file(self, project_id: str) -> Path:
        return self._project_dir(project_id) / "project.json"

    def _revisions_dir(self, project_id: str) -> Path:
        return self._project_dir(project_id) / "revisions"

    # -- io ------------------------------------------------------------------

    @staticmethod
    def _read_json(path: Path) -> Dict[str, Any]:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    @staticmethod
    def _write_json(path: Path, payload: Dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
        tmp.replace(path)

    def _load_raw(self, project_id: str) -> Dict[str, Any]:
        path = self._project_file(project_id)
        if not path.exists():
            raise ArtifactError(E_PROJECT_NOT_FOUND, f"no artifact project {project_id!r}")
        return self._read_json(path)

    def _index_path(self) -> Path:
        return self._root / "index.json"

    def _update_index(self, project: ArtifactProject) -> None:
        index: Dict[str, Any] = {"projects": {}}
        if self._index_path().exists():
            index = self._read_json(self._index_path())
        projects: Dict[str, Any] = index.setdefault("projects", {})
        projects[project.id] = {
            "name": project.name,
            "category": project.category,
            "status": project.status,
            "validation": project.validation,
            "manufacturing_ready": project.manufacturing_ready,
            "revision": project.revision,
            "updated_at": project.updated_at,
        }
        self._write_json(self._index_path(), index)

    # -- CRUD ----------------------------------------------------------------

    def list_projects(self) -> List[Dict[str, Any]]:
        with self._lock:
            if not self._index_path().exists():
                return []
            index = self._read_json(self._index_path())
            rows = [
                {"id": pid, **summary}
                for pid, summary in sorted(
                    index.get("projects", {}).items(),
                    key=lambda kv: kv[1].get("updated_at", ""),
                    reverse=True,
                )
            ]
            return rows

    def get_project(self, project_id: str) -> ArtifactProject:
        with self._lock:
            return ArtifactProject.model_validate(self._load_raw(project_id))

    def create_project(self, name: str, category: str = "generic", template: Optional[str] = None) -> ArtifactProject:
        if not name or not name.strip():
            raise ArtifactError(E_VALIDATION_FAILED, "project name is required")
        with self._lock:
            if template:
                raw = build_template(template)
            else:
                now = _utc_now_iso()
                raw = {
                    "version": 1,
                    "id": "",
                    "name": "",
                    "category": category,
                    "status": STATUS_CONCEPTUAL,
                    "validation": VALIDATION_UNVERIFIED,
                    "manufacturing_ready": False,
                    "created_at": now,
                    "updated_at": now,
                    "revision": 0,
                    "metadata": {},
                    "components": [],
                    "assemblies": [],
                    "wires": [],
                    "constraints": [],
                    "annotations": [],
                    "dimensions": [],
                    "simulation": {},
                    "scene_viewport": {},
                }
            raw["id"] = _new_id("proj")
            raw["name"] = name.strip()
            project = ArtifactProject.model_validate(raw)
            d = self._project_dir(project.id)
            (d / "revisions").mkdir(parents=True, exist_ok=True)
            (d / "exports").mkdir(exist_ok=True)
            (d / "assets").mkdir(exist_ok=True)
            self._write_json(self._project_file(project.id), project.model_dump())
            self._write_json(
                self._revisions_dir(project.id) / "rev_0000.json",
                {
                    "revision": 0,
                    "timestamp": _utc_now_iso(),
                    "source": "system",
                    "reason": "created",
                    "actions": [],
                    "restored_from": None,
                    "project": project.model_dump(),
                },
            )
            self._update_index(project)
            return project

    def delete_project(self, project_id: str) -> None:
        import shutil

        with self._lock:
            d = self._project_dir(project_id)
            if not d.exists():
                raise ArtifactError(E_PROJECT_NOT_FOUND, f"no artifact project {project_id!r}")
            shutil.rmtree(d)
            index = self._read_json(self._index_path()) if self._index_path().exists() else {"projects": {}}
            index.setdefault("projects", {}).pop(project_id, None)
            self._write_json(self._index_path(), index)

    # -- mutations -------------------------------------------------------------

    def apply_actions(
        self,
        project_id: str,
        raw_actions: List[Any],
        *,
        source: str = "ai",
        reason: str = "",
        expected_revision: Optional[int] = None,
        auto_review: bool = False,
    ) -> Dict[str, Any]:
        """The single mutation path. Validate all → assess risk → apply to a
        working copy → persist atomically → append a revision. All-or-nothing.
        """
        actions = parse_actions(raw_actions)

        with self._lock:
            current = self.get_project(project_id)
            if expected_revision is not None and expected_revision != current.revision:
                raise ArtifactError(
                    E_REVISION_CONFLICT,
                    f"stale revision: expected {expected_revision}, project is at {current.revision}",
                    authoritative_revision=current.revision,
                )

            # 1. Validate + apply every action to a throwaway working copy.
            #    Any hard failure (unknown component/port, shorted rail, bad
            #    patch key...) aborts the WHOLE batch here — critical-invalid
            #    actions never become "reviewable proposals".
            work = current.model_copy(deep=True)
            enriched_actions: List[Dict[str, Any]] = []
            for action in actions:
                _apply_one(work, action)

            # 2. Risk-assess valid actions against the pre-mutation state.
            reviewed: List[Dict[str, Any]] = []
            for action in actions:
                risk = assess_risk(action, current, source=source)
                reviewed.append({
                    "action": action,
                    "risk": risk.risk,
                    "reversible": risk.reversible,
                    "requires_review": risk.requires_review,
                    "reason": getattr(action, "reason", None) or reason,
                })

            # 3. Review gate: medium/high-risk VALID actions need confirmation;
            #    low-risk ones auto-apply.
            pending_items = [r for r in reviewed if r["requires_review"]]
            if pending_items and not auto_review:
                raise ReviewRequired(
                    f"{len(pending_items)} of {len(reviewed)} actions require review",
                    pending=[
                        {
                            "type": item["action"].model_dump()["type"],
                            "payload": item["action"].model_dump(exclude={"type"}, exclude_none=True),
                            "risk": item["risk"],
                            "reversible": item["reversible"],
                            "reason": item["reason"],
                        }
                        for item in pending_items
                    ],
                )

            enriched_actions = [
                {
                    "action_id": _new_id("act"),
                    "timestamp": _utc_now_iso(),
                    "source": source,
                    "type": item["action"].model_dump()["type"],
                    "payload": item["action"].model_dump(exclude={"type"}, exclude_none=True),
                    "risk": item["risk"],
                    "reversible": item["reversible"],
                    "reason": item["reason"],
                }
                for item in reviewed
            ]

            work.revision = current.revision + 1
            work.updated_at = _utc_now_iso()

            self._write_json(self._project_file(project_id), work.model_dump())
            self._write_json(
                self._revisions_dir(project_id) / f"rev_{work.revision:04d}.json",
                {
                    "revision": work.revision,
                    "timestamp": work.updated_at,
                    "source": source,
                    "reason": reason,
                    "actions": enriched_actions,
                    "restored_from": None,
                    "project": work.model_dump(),
                },
            )
            self._update_index(work)

            return {
                "revision": work.revision,
                "applied": enriched_actions,
                "warnings": [a for a in []],
            }

    # -- history ----------------------------------------------------------------

    def get_history(self, project_id: str, limit: int = 50, before_revision: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._lock:
            revs_dir = self._revisions_dir(project_id)
            if not revs_dir.exists():
                raise ArtifactError(E_PROJECT_NOT_FOUND, f"no artifact project {project_id!r}")
            out: List[Dict[str, Any]] = []
            rev_files = sorted(revs_dir.glob("rev_*.json"), reverse=True)
            for path in rev_files:
                payload = self._read_json(path)
                rev = int(payload.get("revision", -1))
                if before_revision is not None and rev >= before_revision:
                    continue
                # History rows stay light: header only, no full snapshot dump.
                out.append({k: payload[k] for k in ("revision", "timestamp", "source", "reason", "restored_from") if k in payload} | {
                    "actions": [
                        {k: a.get(k) for k in ("action_id", "type", "risk", "reversible", "reason")}
                        for a in payload.get("actions", [])
                    ]
                })
                if len(out) >= limit:
                    break
            return out

    def restore_revision(self, project_id: str, revision: int, *, source: str = "user") -> ArtifactProject:
        with self._lock:
            current = self.get_project(project_id)
            target_path = self._revisions_dir(project_id) / f"rev_{revision:04d}.json"
            if not target_path.exists():
                raise ArtifactError(E_VALIDATION_FAILED, f"unknown revision {revision}")
            restored = ArtifactProject.model_validate(self._read_json(target_path)["project"])
            restored.revision = current.revision + 1
            restored.updated_at = _utc_now_iso()
            self._write_json(self._project_file(project_id), restored.model_dump())
            self._write_json(
                self._revisions_dir(project_id) / f"rev_{restored.revision:04d}.json",
                {
                    "revision": restored.revision,
                    "timestamp": restored.updated_at,
                    "source": source,
                    "reason": f"restore revision {revision}",
                    "actions": [],
                    "restored_from": revision,
                    "project": restored.model_dump(),
                },
            )
            self._update_index(restored)
            return restored

    # -- export / import ----------------------------------------------------------

    def export_project(self, project_id: str, fmt: str = "json") -> Path:
        with self._lock:
            try:
                project = self.get_project(project_id)
            except ArtifactError:
                raise
            except Exception as exc:
                raise ArtifactError(E_EXPORT_FAILED, f"export failed: {exc}") from exc
            exports = self._project_dir(project_id) / "exports"
            exports.mkdir(parents=True, exist_ok=True)
            if fmt != "json":
                raise ArtifactError(E_EXPORT_FAILED, f"unsupported export format {fmt!r}; available: ['json']")
            path = exports / f"{project.name.replace(' ', '_').lower()}_rev{project.revision}.json"
            self._write_json(path, project.model_dump())
            return path

    def import_project(self, source: Union[str, Path]) -> ArtifactProject:
        """Import from an exported JSON file path (zip arrives later phase)."""
        with self._lock:
            path = Path(source)
            try:
                raw = self._read_json(path)
            except Exception as exc:
                raise ArtifactError(E_EXPORT_FAILED, f"cannot read {path}: {exc}") from exc
            raw.pop("id", None)
            raw["id"] = _new_id("proj")
            raw["name"] = f"{raw.get('name', 'Imported')} (imported)"
            raw["revision"] = 0
            project = ArtifactProject.model_validate(raw)
            d = self._project_dir(project.id)
            (d / "revisions").mkdir(parents=True, exist_ok=True)
            self._write_json(self._project_file(project.id), project.model_dump())
            self._write_json(
                self._revisions_dir(project.id) / "rev_0000.json",
                {
                    "revision": 0,
                    "timestamp": _utc_now_iso(),
                    "source": "system",
                    "reason": f"imported from {path.name}",
                    "actions": [],
                    "restored_from": None,
                    "project": project.model_dump(),
                },
            )
            self._update_index(project)
            return project


# Module-level shared store (paths are profile-aware via get_hermes_home()).
_default_store: Optional[ArtifactStore] = None
_store_lock = threading.Lock()


def get_artifact_store() -> ArtifactStore:
    global _default_store
    with _store_lock:
        if _default_store is None:
            _default_store = ArtifactStore()
        return _default_store


# ---------------------------------------------------------------------------
# Session artifact context — what the renderer has open right now.
#
# The desktop renderer reports its open project / selection / mode through the
# ``artifacts.set_context`` gateway RPC; agent tools read the same context so a
# plain "move the battery down" resolves without the user repeating ids.
# Keyed by HERMES_UI_SESSION_ID (one window, one context).
# ---------------------------------------------------------------------------

_session_contexts: Dict[str, Dict[str, Any]] = {}
_context_lock = threading.Lock()


def set_session_artifact_context(
    session_id: str,
    *,
    project_id: Optional[str] = None,
    selection: Optional[List[str]] = None,
    mode: Optional[str] = None,
) -> None:
    with _context_lock:
        ctx = _session_contexts.setdefault(session_id or "", {})
        if project_id is not None:
            ctx["project_id"] = project_id
        if selection is not None:
            ctx["selection"] = list(selection)
        if mode is not None:
            ctx["mode"] = mode


def clear_session_artifact_context(session_id: str) -> None:
    with _context_lock:
        _session_contexts.pop(session_id or "", None)


def get_session_artifact_context(session_id: str) -> Dict[str, Any]:
    with _context_lock:
        return dict(_session_contexts.get(session_id or "", {}))
