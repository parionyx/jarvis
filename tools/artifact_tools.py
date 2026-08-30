#!/usr/bin/env python3
"""Artifact tools — JARVIS's hands on the Engineering Artifact Studio.

These live in the ``desktop_ui`` toolset (GUI sessions only, resolved from the
SESSION source — never a process env var). The renderer reports what it has
open via ``artifacts.set_context``, so ``project_id`` is optional everywhere:
when omitted the tools target the project that window currently shows.

Mutation discipline:

- The ONLY write path is ``artifact_apply(actions=...)`` →
  ``ArtifactStore.apply_actions``: schema-validated typed actions,
  backend-computed risk, all-or-nothing transactional application.
- Medium/high-risk batches come back as ``REVIEW_REQUIRED`` with the assessed
  proposals; surface them to the user (proposal card / buttons), then re-send
  confirmed batches with ``auto_review=true``. Never auto-confirm silently.
- Critical-invalid actions (e.g. a wire shorting a component's own power rail)
  are hard-blocked and CANNOT be forced through review.

Phase 1 honesty boundary: there is no solver yet. ``artifact_simulate_request``
reports SIMULATION_FAILED/not_available instead of inventing numbers. Provenance
labels ride with every value once Phase 3 lands.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from tools.registry import registry, tool_error


def _ha():
    """Lazy module handle. Tool discovery imports EVERY tools/*.py at process
    start, so this file must stay import-cheap (project_tools.py convention);
    the pydantic IR (~330 ms cold) only loads when a tool actually runs."""
    import hermes_artifacts as ha

    return ha


def _du():
    """Lazy desktop_ui bridge — pulls the gateway.config chain (~1 s cold),
    so it must not ride tool discovery either."""
    from tools import desktop_ui

    return desktop_ui


def _store():
    """Store handle (monkeypatch-friendly in tests)."""
    return _ha().get_artifact_store()


def _ui_session_id() -> str:
    from gateway.session_context import get_session_env

    return get_session_env("HERMES_UI_SESSION_ID", "")


def _resolve_project_id(explicit: Optional[str]) -> Optional[str]:
    if explicit:
        return explicit
    # Window-scoped context first (set during open), then the default bucket
    # written by artifacts.set_context RPCs that arrive without a session id.
    ctx = _ha().get_session_artifact_context(_ui_session_id())
    pid = ctx.get("project_id")
    if not pid:
        ctx = _ha().get_session_artifact_context("")
        pid = ctx.get("project_id")
    return pid or None


def _emit_state_changed(project_id: str, revision: int, source: str) -> None:
    try:
        _du().emit(
            "artifact.state.changed",
            {"project_id": project_id, "revision": revision, "source": source},
        )
    except Exception:
        # A dead renderer must not corrupt an already-persisted mutation.
        pass


def _error_payload(err: Exception) -> Dict[str, Any]:
    ha = _ha()
    if isinstance(err, ha.ArtifactError):
        payload = {"code": err.code, "message": str(err)}
        payload.update(err.extra)
        return payload
    return {"code": "INTERNAL", "message": str(err)}


# ---------------------------------------------------------------------------
# artifact_studio — open/close the workspace surface
# ---------------------------------------------------------------------------


def artifact_studio(
    action: str = "open",
    project_id: Optional[str] = None,
    name: str = "",
    template: str = "",
    task_id: Optional[str] = None,
) -> str:
    ha = _ha()
    action = (action or "open").lower()
    store = _store()

    if action == "close":
        pid = _resolve_project_id(project_id)
        ok = _du().emit("artifact.studio.close", {"project_id": pid})
        if not ok:
            return tool_error("The Artifact Studio is only available in the Hermes desktop app.")
        return json.dumps({"success": True, "closed": pid})

    if action != "open":
        return tool_error(f"unknown action {action!r}; use 'open' or 'close'")

    try:
        if project_id:
            project = store.get_project(project_id)  # validates existence
        else:
            project = store.create_project(
                name=name.strip() or "Untitled Artifact",
                template=(template.strip() or None),
            )
    except ha.ArtifactError as err:
        return json.dumps({"success": False, "error": _error_payload(err)}, ensure_ascii=False)

    ok = _du().emit("artifact.studio.open", {"project_id": project.id})
    if not ok:
        return tool_error(
            f"Created artifact project {project.id} ({project.name}), but the Artifact "
            "Studio pane is only available in the Hermes desktop app."
        )

    # This window now owns this project: later calls may omit project_id.
    ha.set_session_artifact_context(_ui_session_id(), project_id=project.id)

    return json.dumps({
        "success": True,
        "project_id": project.id,
        "name": project.name,
        "status": project.status,
        "revision": project.revision,
        "components": len(project.components),
        "wires": len(project.wires),
    }, ensure_ascii=False)


# ---------------------------------------------------------------------------
# artifact_read — inspect IR state (whole doc or targeted query)
# ---------------------------------------------------------------------------

_READ_QUERY_PREFIXES = ("components.", "wires.", "assemblies.", "constraints.", "simulation", "metadata")


def artifact_read(project_id: Optional[str] = None, query: str = "", task_id: Optional[str] = None) -> str:
    ha = _ha()
    pid = _resolve_project_id(project_id)
    if not pid:
        return tool_error(
            "No artifact project specified and none is open in this window. "
            "Pass project_id or open one with artifact_studio."
        )
    try:
        project = _store().get_project(pid)
    except ha.ArtifactError as err:
        return json.dumps({"success": False, "error": _error_payload(err)}, ensure_ascii=False)

    data = project.model_dump()
    q = (query or "").strip()
    if not q:
        # Full read: envelope + flattened document so callers get both.
        return json.dumps({"success": True, "project_id": project.id, **data}, ensure_ascii=False)

    def _descend(root: Any, path_parts: List[str]) -> tuple[Optional[Any], str]:
        """Walk a dotted path where keys THEMSELVES contain dots
        (semantic ids like ``battery.main``). At each dict level prefer the
        longest matching key."""
        node = root
        i = 0
        while i < len(path_parts):
            if isinstance(node, dict):
                matched_end = None
                for end in range(len(path_parts), i, -1):
                    candidate = ".".join(path_parts[i:end])
                    if candidate in node:
                        node = node[candidate]
                        matched_end = end
                        break
                if matched_end is None:
                    return None, f"no key matching {'.'.join(path_parts[i:])!r} in {q}"
                i = matched_end
            elif isinstance(node, list):
                try:
                    node = node[int(path_parts[i])]
                except (ValueError, IndexError):
                    return None, f"bad index {path_parts[i]!r} in {q}"
                i += 1
            else:
                return None, f"cannot descend past {'.'.join(path_parts[:i])} in {q}"
        return node, ""

    node, err_msg = _descend(data, q.split("."))
    if err_msg:
        return json.dumps({"success": False, "error": {"code": ha.E_VALIDATION_FAILED, "message": err_msg}}, ensure_ascii=False)

    return json.dumps({"success": True, "query": q, "result": node}, ensure_ascii=False)

    return json.dumps({"success": True, "query": q, "result": node}, ensure_ascii=False)


# ---------------------------------------------------------------------------
# artifact_apply — THE single mutation entry point
# ---------------------------------------------------------------------------


def artifact_apply(
    actions: List[Dict[str, Any]],
    project_id: Optional[str] = None,
    reason: str = "",
    auto_review: bool = False,
    task_id: Optional[str] = None,
) -> str:
    ha = _ha()
    if not isinstance(actions, list) or not actions:
        return tool_error("actions must be a non-empty list of typed artifact actions")

    pid = _resolve_project_id(project_id)
    if not pid:
        return tool_error(
            "No artifact project specified and none is open in this window. "
            "Pass project_id or open one with artifact_studio."
        )

    try:
        result = _store().apply_actions(
            pid,
            actions,
            source="ai",
            reason=reason,
            auto_review=bool(auto_review),
        )
    except ha.ReviewRequired as err:
        # Surface the assessed proposals; do NOT retry automatically.
        return json.dumps({
            "success": False,
            "error": {
                "code": ha.E_REVIEW_REQUIRED,
                "message": (
                    f"{len(err.pending)} of these actions require explicit user review "
                    "(medium/high engineering risk). Show the proposals to the user and "
                    "re-send ONLY after they confirm, with auto_review=true."
                ),
                "pending": err.pending,
            },
        }, ensure_ascii=False)
    except ha.ArtifactError as err:
        return json.dumps({"success": False, "error": _error_payload(err)}, ensure_ascii=False)

    _emit_state_changed(pid, result["revision"], "ai")

    risks = sorted({a["risk"] for a in result["applied"]})
    return json.dumps({
        "success": True,
        "project_id": pid,
        "revision": result["revision"],
        "applied_count": len(result["applied"]),
        "risk_levels": risks,
        "note": "state persisted; renderer will reconcile via artifact.state.changed",
    }, ensure_ascii=False)


# ---------------------------------------------------------------------------
# artifact_simulate_request — honest Phase 1 boundary
# ---------------------------------------------------------------------------


def artifact_simulate_request(
    scenario: Optional[Dict[str, Any]] = None,
    project_id: Optional[str] = None,
    task_id: Optional[str] = None,
) -> str:
    ha = _ha()
    pid = _resolve_project_id(project_id)
    if not pid:
        return tool_error("No artifact project specified and none is open in this window.")
    try:
        _store().get_project(pid)
    except ha.ArtifactError as err:
        return json.dumps({"success": False, "error": _error_payload(err)}, ensure_ascii=False)

    return json.dumps({
        "success": False,
        "error": {
            "code": ha.E_SIMULATION_FAILED,
            "message": (
                "The simulation engine ships with Phase 3 (circuit/thermal models). "
                "Do NOT estimate numbers yourself as results — describe what WILL be "
                "simulated once available, or ask the user for measured values."
            ),
            "not_available": True,
            "phase": 1,
        },
    }, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Registration (desktop_ui toolset — GUI sessions only)
# ---------------------------------------------------------------------------

_STUDIO_ACTIONS = {"open", "close"}

registry.register(
    name="artifact_studio",
    toolset="desktop_ui",
    schema={
        "name": "artifact_studio",
        "description": (
            "Open or close the Engineering Artifact Studio in the Hermes desktop app — "
            "an interactive 3D engineering workspace backed by a persistent structured "
            "artifact project. Open WITHOUT project_id to create a fresh project from a "
            "template (drone_quadcopter available). Use when the user wants to design, "
            "prototype, wire or analyze hardware (drone, robot, circuit...)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["open", "close"], "description": "open (default) or close the studio"},
                "project_id": {"type": "string", "description": "Existing artifact project id to open; omit to create new"},
                "name": {"type": "string", "description": "Name for a newly created project"},
                "template": {
                    "type": "string",
                    "enum": ["drone_quadcopter", "robot_arm"],
                    "description": "Optional seed template; omit for a blank project and add parts from the studio palette",
                },
            },
        },
    },
    handler=lambda args, **kw: artifact_studio(
        action=args.get("action", "open"),
        project_id=args.get("project_id"),
        name=args.get("name", ""),
        template=args.get("template", ""),
        task_id=kw.get("task_id"),
    ),
    emoji="🛠️",
)

registry.register(
    name="artifact_read",
    toolset="desktop_ui",
    schema={
        "name": "artifact_read",
        "description": (
            "Read the current state of an Engineering Artifact project (the structured "
            "IR: components, ports, wires, assemblies, constraints, simulation config). "
            "Omitting project_id reads the project open in the user's studio window. "
            "Optional dotted query narrows the response, e.g. "
            "'components.battery.main.electrical' or 'wires'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "Project id; omit for the window's active project"},
                "query": {"type": "string", "description": "Optional dotted path into the IR document"},
            },
        },
    },
    handler=lambda args, **kw: artifact_read(project_id=args.get("project_id"), query=args.get("query", ""), task_id=kw.get("task_id")),
    emoji="📄",
)

registry.register(
    name="artifact_apply",
    toolset="desktop_ui",
    schema={
        "name": "artifact_apply",
        "description": (
            "Apply typed actions to an Engineering Artifact project — the ONLY way to "
            "modify artifacts. Action types: component.create/delete/update/transform/"
            "material, assembly.create/parent/unparent/explode, wire.create/delete/reroute, "
            "constraint.create/delete, annotation.create, dimension.create, "
            "simulation.configure/run, scene.update. Backend validates, computes risk and "
            "applies transactionally. REVIEW_REQUIRED means: show the pending proposals to "
            "the user first, then re-send with auto_review=true only after they confirm. "
            "Invalid actions are rejected outright — never guess ids, use artifact_read."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "actions": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "Typed actions, e.g. {\"type\":\"component.transform\","
                        "\"component_id\":\"battery.main\",\"relative\":true,"
                        "\"transform\":{\"position\":{\"x\":0,\"y\":0,\"z\":-20}}}. "
                        "component.create accepts ANY type string (custom parts welcome: "
                        "'laser_module', 'hydraulic_pump', 'heater_pad'...) — add geometry.params"
                        " {w_mm,h_mm,d_mm} and material.color '#rrggbb' so it renders meaningfully. "
                        "Also: component.delete/update/transform/material, assembly.*, wire.create/"
                        "delete/reroute, constraint.*, annotation/dimension.create, simulation.*,"
                        " scene.update."
                    ),
                },
                "project_id": {"type": "string", "description": "Project id; omit for the window's active project"},
                "reason": {"type": "string", "description": "Short why, recorded in history"},
                "auto_review": {"type": "boolean", "description": "ONLY set true after the user explicitly approved the reviewed batch"},
            },
            "required": ["actions"],
        },
    },
    handler=lambda args, **kw: artifact_apply(
        actions=args.get("actions") or [],
        project_id=args.get("project_id"),
        reason=args.get("reason", ""),
        auto_review=bool(args.get("auto_review", False)),
        task_id=kw.get("task_id"),
    ),
    emoji="⚙️",
)

registry.register(
    name="artifact_simulate_request",
    toolset="desktop_ui",
    schema={
        "name": "artifact_simulate_request",
        "description": (
            "Request simulation of the open artifact (electrical loads, thermal estimates, "
            "power budget) under a scenario, e.g. {\"load_pct\":70,\"duration_s\":60}. "
            "Results carry provenance labels (CALCULATED/SIMULATED/ESTIMATED). Currently "
            "returns not_available until the Phase 3 solver lands — never fabricate results."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "scenario": {"type": "object", "description": "Test scenario knobs"},
                "project_id": {"type": "string", "description": "Project id; omit for the window's active project"},
            },
        },
    },
    handler=lambda args, **kw: artifact_simulate_request(
        scenario=args.get("scenario") or {},
        project_id=args.get("project_id"),
        task_id=kw.get("task_id"),
    ),
    emoji="📈",
)
