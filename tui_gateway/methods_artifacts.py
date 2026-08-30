"""Artifacts JSON-RPC handlers (Engineering Artifact Studio).

Renderer-side CRUD over the artifact IR store (``hermes_artifacts``). These
complement the ``artifact_*`` AGENT tools in ``tools/artifact_tools.py``:

- Agent mutations flow through the tools (source=``ai``) and reach the
  renderer as ``artifact.state.changed`` notifications.
- Renderer-initiated edits flow through THESE RPCs (source=``user``) and get
  their authoritative result back in the response — no event echo needed for
  the window that asked.

Handlers follow the methods_* split convention (see method_ctx.py): they are
defined against this module's HandlerRegistry and rebound onto server.py's
globals at install time, so ``_ok`` / ``_err`` resolve from server state.
"""

from .method_ctx import HandlerRegistry

_registry = HandlerRegistry()
method = _registry.method
_profile_scoped = _registry.profile_scoped

# JSON-RPC error codes (projects block uses 5061..5063)
_E_ARTIFACTS = 5071          # generic failure
_E_NO_ARTIFACT = 5072        # project id resolved to nothing
_E_ARTIFACT_ARG = 5073       # invalid argument


def _artifact_error_payload(err):
    import hermes_artifacts as ha

    payload = {"code": err.code, "message": str(err)}
    payload.update(err.extra)
    return payload


@method("artifacts.list")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        return _ok(rid, {"projects": ha.get_artifact_store().list_projects()})
    except Exception as e:
        return _err(rid, _E_ARTIFACTS, str(e))


@method("artifacts.get")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        project = ha.get_artifact_store().get_project(str(params.get("project_id") or ""))
        return _ok(rid, {"project": project.model_dump()})
    except Exception as e:
        code = _E_NO_ARTIFACT if getattr(e, "code", "") == "PROJECT_NOT_FOUND" else _E_ARTIFACTS
        return _err(rid, code, str(e))


@method("artifacts.create")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        project = ha.get_artifact_store().create_project(
            name=str(params.get("name") or ""),
            category=str(params.get("category") or "generic"),
            template=params.get("template") or None,
        )
        return _ok(rid, {
            "project_id": project.id,
            "status": project.status,
            "revision": project.revision,
            "components": len(project.components),
            "wires": len(project.wires),
        })
    except Exception as e:
        code = _E_ARTIFACT_ARG if getattr(e, "code", "") == "VALIDATION_FAILED" else _E_ARTIFACTS
        return _err(rid, code, str(e))


@method("artifacts.apply_actions")
@_profile_scoped
def _(rid, params: dict) -> dict:
    """The renderer's single mutation path. Same transactional pipeline and
    risk gating as the agent tool — the renderer shows REVIEW_REQUIRED
    proposals to the user and resends with auto_review after confirmation."""
    try:
        import hermes_artifacts as ha

        result = ha.get_artifact_store().apply_actions(
            str(params.get("project_id") or ""),
            params.get("actions") or [],
            source=str(params.get("source") or "user"),
            reason=str(params.get("reason") or ""),
            expected_revision=params.get("expected_revision"),
            auto_review=bool(params.get("auto_review", False)),
        )
        # Shape ReviewRequired into a normal (non-error) response so the
        # renderer can render the proposal card directly.
        return _ok(rid, {"success": True, **result})
    except Exception as e:
        err_code = getattr(e, "code", "")
        if err_code == "REVIEW_REQUIRED":
            pending = getattr(e, "pending", [])
            return _ok(rid, {
                "success": False,
                "error": {"code": err_code, "message": str(e), "pending": pending},
            })
        data = {"error": _artifact_error_payload(e)}
        rpc_code = _E_ARTIFACT_ARG if err_code == "VALIDATION_FAILED" else (
            _E_NO_ARTIFACT if err_code == "PROJECT_NOT_FOUND" else _E_ARTIFACTS
        )
        return _err(rid, rpc_code, str(e), data=data)


@method("artifacts.history")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        history = ha.get_artifact_store().get_history(
            str(params.get("project_id") or ""),
            limit=int(params.get("limit") or 50),
            before_revision=params.get("before_revision"),
        )
        return _ok(rid, {"history": history})
    except Exception as e:
        code = _E_NO_ARTIFACT if getattr(e, "code", "") == "PROJECT_NOT_FOUND" else _E_ARTIFACTS
        return _err(rid, code, str(e))


@method("artifacts.restore")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        project = ha.get_artifact_store().restore_revision(
            str(params.get("project_id") or ""),
            int(params.get("revision")),
        )
        return _ok(rid, {"project": project.model_dump(), "restored_to_revision": int(params.get("revision"))})
    except Exception as e:
        return _err(rid, _E_ARTIFACTS, str(e))


@method("artifacts.export")
@_profile_scoped
def _(rid, params: dict) -> dict:
    """Export as portable JSON (zip packaging arrives with later phases)."""
    try:
        import hermes_artifacts as ha

        path = ha.get_artifact_store().export_project(
            str(params.get("project_id") or ""), fmt=str(params.get("format") or "json")
        )
        return _ok(rid, {"path": str(path), "format": "json"})
    except Exception as e:
        return _err(rid, _E_ARTIFACTS, str(e))


@method("artifacts.import")
@_profile_scoped
def _(rid, params: dict) -> dict:
    try:
        import hermes_artifacts as ha

        project = ha.get_artifact_store().import_project(str(params.get("path") or ""))
        return _ok(rid, {"project_id": project.id, "name": project.name})
    except Exception as e:
        return _err(rid, _E_ARTIFACTS, str(e))


@method("artifacts.set_context")
@_profile_scoped
def _(rid, params: dict) -> dict:
    """Renderer reports what it has open (project/selection/mode) so agent
    tools can omit ids ("move the battery down" just works). Keyed under the
    default bucket; per-window keys refine this once transports expose sids.
    A request with NO context fields at all means "studio closed" — drop the
    stale reference instead of leaving tools pointing at a closed project."""
    try:
        import hermes_artifacts as ha

        has_any = any(
            params.get(k) is not None for k in ("project_id", "selection", "mode")
        )
        if not has_any:
            ha.clear_session_artifact_context("")
            return _ok(rid, {"cleared": True})

        ha.set_session_artifact_context(
            "",
            project_id=params.get("project_id"),
            selection=params.get("selection"),
            mode=params.get("mode"),
        )
        return _ok(rid, {"ok": True})
    except Exception as e:
        return _err(rid, _E_ARTIFACTS, str(e))


def register(server) -> None:
    """Bind this module's handlers onto ``server``'s globals and registry."""
    _registry.install(server)
