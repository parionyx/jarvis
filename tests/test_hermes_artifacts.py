"""Tests for the Engineering Artifact IR + store (hermes_artifacts.py).

Covers Phase 1 acceptance: schema validation, CRUD, template seed, typed
action validation, risk gating, transactional mutation, revision conflict,
history/restore, export/import round-trip, and tool registration.
"""

import json

import pytest

import hermes_artifacts as ha


@pytest.fixture()
def store(tmp_path):
    return ha.ArtifactStore(root=tmp_path / "artifacts")


@pytest.fixture()
def drone(store):
    return store.create_project("Test Drone", template=ha.TEMPLATE_DRONE_QUADCOPTER)


# ---------------------------------------------------------------------------
# Schema / IR validation
# ---------------------------------------------------------------------------


class TestSchema:
    def test_semantic_ids_required(self):
        with pytest.raises(Exception):
            ha.Component(id="Motor 1", type="bldc_motor", name="m")

    def test_dotted_id_accepted(self):
        comp = ha.Component(id="motor.front_left", type="bldc_motor", name="Front Left")
        assert comp.id == "motor.front_left"

    def test_status_defaults_conceptual(self, drone):
        assert drone.status == ha.STATUS_CONCEPTUAL
        assert drone.validation == ha.VALIDATION_UNVERIFIED
        assert drone.manufacturing_ready is False

    def test_list_collections_coerced_to_keyed_dicts(self, drone):
        assert isinstance(drone.components, dict)
        assert "frame.main" in drone.components
        assert "battery.main" in drone.components

    def test_template_contents(self, drone):
        # 1 frame + 1 fc + 1 battery + 1 pdb + 4x(motor+esc+prop) = 16
        assert len(drone.components) == 16
        # battery->pdb (2) + per-corner (pdb p/n, signal, phase a/b) = 2 + 4*5 = 22
        assert len(drone.wires) == 22
        assert drone.total_mass_g() == pytest.approx(486.0)
        assert "airframe" in drone.assemblies


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


class TestCrud:
    def test_create_empty_project(self, store):
        project = store.create_project("Bare")
        assert project.revision == 0
        assert project.components == {}
        rows = store.list_projects()
        assert [r["id"] for r in rows] == [project.id]

    def test_create_requires_name(self, store):
        with pytest.raises(ha.ArtifactError) as err:
            store.create_project("   ")
        assert err.value.code == ha.E_VALIDATION_FAILED

    def test_get_missing_project(self, store):
        with pytest.raises(ha.ArtifactError) as err:
            store.get_project("proj_00000000")
        assert err.value.code == ha.E_PROJECT_NOT_FOUND

    def test_malformed_project_id_rejected(self, store):
        with pytest.raises(ha.ArtifactError) as err:
            store.get_project("../etc/passwd")
        assert err.value.code == ha.E_PROJECT_NOT_FOUND

    def test_unknown_template(self, store):
        with pytest.raises(ha.ArtifactError) as err:
            store.create_project("X", template="starship")
        assert err.value.code == ha.E_VALIDATION_FAILED

    def test_delete_removes_from_index(self, store, drone):
        store.delete_project(drone.id)
        assert store.list_projects() == []
        with pytest.raises(ha.ArtifactError):
            store.get_project(drone.id)


# ---------------------------------------------------------------------------
# Typed action validation
# ---------------------------------------------------------------------------


class TestActionValidation:
    def test_invalid_action_type(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(drone.id, [{"type": "component.hack", "x": 1}])
        assert err.value.code == ha.E_INVALID_ACTION

    def test_actions_must_be_nonempty(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(drone.id, [])
        assert err.value.code == ha.E_INVALID_ACTION

    def test_unknown_component(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "component.transform", "component_id": "ghost.x",
                  "transform": {"position": {"x": 0, "y": 0, "z": 0}}}],
            )
        assert err.value.code == ha.E_INVALID_COMPONENT

    def test_unknown_port(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "wire.create", "source": "battery.main:NOPE",
                  "target": "fc.flight_controller:GND"}],
            )
        assert err.value.code == ha.E_INVALID_PORT

    def test_self_port_wire_rejected(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "wire.create", "source": "battery.main:POWER+",
                  "target": "battery.main:POWER+"}],
            )
        assert err.value.code == ha.E_INVALID_CONNECTION

    def test_short_circuit_blocked_not_reviewable(self, store, drone):
        """Same-component power→ground is CRITICAL-blocked regardless of review."""
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "wire.create", "source": "fc.flight_controller:VBAT",
                  "target": "fc.flight_controller:GND"}],
                auto_review=True,
            )
        assert err.value.code == ha.E_INVALID_CONNECTION
        assert err.value.extra.get("short_circuit") is True

    def test_duplicate_wire_rejected(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "wire.create", "source": "battery.main:POWER+",
                  "target": "pdb.power_distribution:IN+"}],
            )
        assert err.value.code == ha.E_INVALID_CONNECTION

    def test_kind_mismatch_blocked(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "wire.create", "source": "battery.main:POWER+",
                  "target": "fc.flight_controller:UART_TX"}],
            )
        assert err.value.code == ha.E_INVALID_CONNECTION

    def test_gate_controlled_patch_fields_rejected(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "component.update", "component_id": "frame.main",
                  "patch": {"status": "manufacturing_ready"}}],
            )
        assert err.value.code == ha.E_VALIDATION_FAILED

    def test_simulation_run_honest_unavailable(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "simulation.run", "scenario": {"duration_s": 60}}],
            )
        assert err.value.code == ha.E_SIMULATION_FAILED

    def test_parent_delete_requires_recursive(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "component.delete", "component_id": "frame.main"}],
            )
        assert err.value.code == ha.E_VALIDATION_FAILED

        result = store.apply_actions(
            drone.id,
            [{"type": "component.delete", "component_id": "frame.main", "recursive": True}],
            source="ai",
            auto_review=True,
        )
        project = store.get_project(drone.id)
        assert "frame.main" not in project.components
        # cascade: motors/escs/props/fc/battery/pdb all parented to frame
        assert len(project.components) == 0
        assert project.wires == {}


# ---------------------------------------------------------------------------
# Risk model
# ---------------------------------------------------------------------------


class TestRisk:
    def test_small_transform_auto_applies(self, store, drone):
        result = store.apply_actions(
            drone.id,
            [{"type": "component.transform", "component_id": "battery.main",
              "transform": {"position": {"x": 10, "y": 0, "z": -20}}}],
            source="ai",
        )
        assert result["applied"][0]["risk"] == ha.RISK_LOW

    def test_large_transform_requires_review(self, store, drone):
        with pytest.raises(ha.ReviewRequired) as exc:
            store.apply_actions(
                drone.id,
                [{"type": "component.transform", "component_id": "battery.main",
                  "transform": {"position": {"x": 500, "y": 0, "z": 0}}}],
                source="ai",
            )
        pending = exc.value.pending[0]
        assert pending["risk"] == ha.RISK_MEDIUM

        confirmed = store.apply_actions(
            drone.id,
            [{"type": "component.transform", "component_id": "battery.main",
              "transform": {"position": {"x": 500, "y": 0, "z": 0}}}],
            source="ai",
            auto_review=True,
        )
        assert confirmed["revision"] > 0

    def test_relative_transform_risk_uses_delta(self, store, drone):
        result = store.apply_actions(
            drone.id,
            [{"type": "component.transform", "component_id": "battery.main",
              "transform": {"position": {"x": 5, "y": 5, "z": 5}}, "relative": True}],
            source="ai",
        )
        assert result["applied"][0]["risk"] == ha.RISK_LOW

    def test_small_absolute_move_of_far_placed_part_is_low_risk(self, store, drone):
        """Regression: absolute deltas were measured from the ORIGIN, so a
        10mm nudge of a motor sitting at x=150 demanded review. Risk must
        track MOVEMENT, not distance from origin."""
        motor = drone.components["motor.front_left"]
        target = {
            "x": float(motor.transform.position["x"]) + 10,
            "y": float(motor.transform.position["y"]),
            "z": float(motor.transform.position["z"]),
        }
        result = store.apply_actions(
            drone.id,
            [{"type": "component.transform", "component_id": "motor.front_left",
              "transform": {"position": target}}],
            source="ai",
        )
        assert result["applied"][0]["risk"] == ha.RISK_LOW

    def test_delete_is_medium_review(self, store, drone):
        with pytest.raises(ha.ReviewRequired) as exc:
            store.apply_actions(
                drone.id,
                [{"type": "component.delete", "component_id": "prop.front_left"}],
            )
        assert exc.value.pending[0]["risk"] == ha.RISK_MEDIUM

    def test_engineering_update_needs_review_name_does_not(self, store, drone):
        with pytest.raises(ha.ReviewRequired):
            store.apply_actions(
                drone.id,
                [{"type": "component.update", "component_id": "motor.front_left",
                  "patch": {"electrical": {"kv": 3500}}}],
            )

        store.apply_actions(  # cosmetic rename auto-applies
            drone.id,
            [{"type": "component.update", "component_id": "motor.front_left",
              "patch": {"name": "FL Motor"}}],
        )
        assert store.get_project(drone.id).components["motor.front_left"].name == "FL Motor"


# ---------------------------------------------------------------------------
# Transactionality + conflicts
# ---------------------------------------------------------------------------


class TestTransaction:
    def test_batch_all_or_nothing(self, store, drone):
        before = store.get_project(drone.id)
        with pytest.raises(ha.ArtifactError):
            store.apply_actions(
                drone.id,
                [
                    {"type": "component.transform", "component_id": "battery.main",
                     "transform": {"position": {"x": 42, "y": 0, "z": 0}}},
                    {"type": "wire.delete", "wire_id": "does_not_exist"},
                ],
                source="ai",
            )
        after = store.get_project(drone.id)
        assert after.revision == before.revision
        assert after.components["battery.main"].transform.position["x"] == 0.0

    def test_expected_revision_conflict(self, store, drone):
        current_rev = drone.revision
        store.apply_actions(
            drone.id,
            [{"type": "scene.update", "viewport": {"zoom": 1.2}}],
            expected_revision=current_rev,
        )
        with pytest.raises(ha.ArtifactError) as err:
            store.apply_actions(
                drone.id,
                [{"type": "scene.update", "viewport": {"zoom": 2.0}}],
                expected_revision=current_rev,  # stale now
            )
        assert err.value.code == ha.E_REVISION_CONFLICT
        assert err.value.extra["authoritative_revision"] == current_rev + 1


# ---------------------------------------------------------------------------
# Revisions / history / restore
# ---------------------------------------------------------------------------


class TestRevisions:
    def test_revision_chain_and_restore(self, store, drone):
        store.apply_actions(
            drone.id,
            [{"type": "component.transform", "component_id": "battery.main",
              "transform": {"position": {"x": 100, "y": 0, "z": 0}}}],
            reason="shift battery",
            auto_review=True,
        )
        mid = store.get_project(drone.id).revision

        store.apply_actions(
            drone.id,
            [{"type": "component.delete", "component_id": "prop.rear_left"}],
            source="user",
            auto_review=True,
        )
        assert "prop.rear_left" not in store.get_project(drone.id).components

        restored = store.restore_revision(drone.id, mid)
        assert restored.revision == mid + 2  # append-only restore revision
        assert "prop.rear_left" in restored.components
        assert restored.components["battery.main"].transform.position["x"] == 100.0

    def test_history_rows_are_light(self, store, drone):
        store.apply_actions(
            drone.id,
            [{"type": "scene.update", "viewport": {}}],
            reason="noop",
        )
        history = store.get_history(drone.id)
        assert [h["revision"] for h in history] == [1, 0]
        assert "project" not in history[0]  # snapshots stay out of listings
        assert history[1]["actions"] == []  # baseline row

    def test_restore_unknown_revision(self, store, drone):
        with pytest.raises(ha.ArtifactError):
            store.restore_revision(drone.id, 99)


# ---------------------------------------------------------------------------
# Export / import
# ---------------------------------------------------------------------------


class TestExportImport:
    def test_json_round_trip(self, store, tmp_path):
        original = store.create_project("Round Trip", template=ha.TEMPLATE_DRONE_QUADCOPTER)
        path = store.export_project(original.id, fmt="json")
        imported = store.import_project(path)

        assert imported.id != original.id
        assert imported.name.startswith("Round Trip")
        assert len(imported.components) == len(original.components)
        assert set(imported.components) == set(original.components)
        assert imported.total_mass_g() == pytest.approx(original.total_mass_g())

    def test_unsupported_format(self, store, drone):
        with pytest.raises(ha.ArtifactError) as err:
            store.export_project(drone.id, fmt="step")
        assert err.value.code == ha.E_EXPORT_FAILED


# ---------------------------------------------------------------------------
# Tool registration (desktop_ui toolset wiring)
# ---------------------------------------------------------------------------


class TestToolRegistration:
    def test_artifact_tools_registered(self):
        from tools.registry import registry

        import tools.artifact_tools  # noqa: F401  (registers at import)

        names = registry.get_tool_names_for_toolset("desktop_ui")
        for expected in ("artifact_studio", "artifact_read", "artifact_apply", "artifact_simulate_request"):
            assert expected in names

    def test_tool_handlers_round_trip(self, tmp_path, monkeypatch):
        import json as _json

        from tools import artifact_tools, desktop_ui

        monkeypatch.setattr(artifact_tools, "_store", lambda: ha.ArtifactStore(root=tmp_path / "artifacts"))
        # Simulate a wired desktop renderer so emit() succeeds.
        emitted: list = []
        monkeypatch.setattr(
            desktop_ui,
            "_emit",
            lambda sid, event, payload: emitted.append((event, payload)) or True,
        )

        opened = _json.loads(artifact_tools.artifact_studio(action="open", name="CLI Drone", template=ha.TEMPLATE_DRONE_QUADCOPTER))
        assert opened["success"] is True
        pid = opened["project_id"]
        assert any(event == "artifact.studio.open" for event, _ in emitted)

        read = _json.loads(artifact_tools.artifact_read(project_id=pid))
        assert read["status"] == ha.STATUS_CONCEPTUAL
        assert "components" in read

        slice_read = _json.loads(artifact_tools.artifact_read(project_id=pid, query="components.battery.main.electrical"))
        assert slice_read["success"] is True
        assert slice_read["result"]["cells_s"] == 4

        applied = _json.loads(artifact_tools.artifact_apply(
            project_id=pid,
            actions=[{
                "type": "component.transform",
                "component_id": "battery.main",
                "relative": True,
                "transform": {"position": {"x": 0, "y": 0, "z": -20}},
            }],
            reason="unit test",
        ))
        assert applied["success"] is True
        assert applied["revision"] == 1
        assert any(event == "artifact.state.changed" for event, _ in emitted)

        review = _json.loads(artifact_tools.artifact_apply(
            project_id=pid,
            actions=[{"type": "component.delete", "component_id": "battery.main"}],
            reason="needs confirmation",
        ))
        assert review["success"] is False
        assert review["error"]["code"] == ha.E_REVIEW_REQUIRED
        assert review["error"]["pending"][0]["risk"] == ha.RISK_MEDIUM

        sim = _json.loads(artifact_tools.artifact_simulate_request(project_id=pid, scenario={"load_pct": 70}))
        assert sim["success"] is False
        assert sim["error"]["code"] == ha.E_SIMULATION_FAILED

    def test_tool_handlers_round_trip(self, tmp_path, monkeypatch):
        """Full tool flow against a temp store with a fake desktop emitter."""
        import json

        from tools import artifact_tools, desktop_ui

        monkeypatch.setattr(artifact_tools, "_store", lambda: ha.ArtifactStore(root=tmp_path / "artifacts"))
        events: list = []
        monkeypatch.setattr(desktop_ui, "_emit",
                            lambda sid, event, payload: events.append((sid, event, payload)) or True)

        opened = json.loads(artifact_tools.artifact_studio(
            action="open", name="CLI Drone", template=ha.TEMPLATE_DRONE_QUADCOPTER))
        assert opened["success"] is True
        pid = opened["project_id"]
        assert any(e[1] == "artifact.studio.open" for e in events)

        read = json.loads(artifact_tools.artifact_read(project_id=pid, query="components.battery.main"))
        assert read["success"] is True
        assert read["result"]["id"] == "battery.main"

        applied = json.loads(artifact_tools.artifact_apply(
            project_id=pid,
            actions=[{"type": "component.transform", "component_id": "battery.main",
                      "transform": {"position": {"x": 0, "y": 0, "z": -20}}, "relative": True}],
            reason="test"))
        assert applied["success"] is True
        assert applied["revision"] == 1
        assert any(e[1] == "artifact.state.changed" for e in events)

        review = json.loads(artifact_tools.artifact_apply(
            project_id=pid,
            actions=[{"type": "component.delete", "component_id": "battery.main"}],
            reason="test delete"))
        assert review["success"] is False
        assert review["error"]["code"] == ha.E_REVIEW_REQUIRED

        sim = json.loads(artifact_tools.artifact_simulate_request(project_id=pid, scenario={"load_pct": 70}))
        assert sim["success"] is False
        assert sim["error"]["code"] == ha.E_SIMULATION_FAILED

    def test_session_context_resolution(self, tmp_path, monkeypatch):
        """Tools resolve the window's active project without explicit ids."""
        import json

        from tools import artifact_tools, desktop_ui

        monkeypatch.setattr(artifact_tools, "_store", lambda: ha.ArtifactStore(root=tmp_path / "artifacts"))
        monkeypatch.setattr(desktop_ui, "_emit", lambda sid, event, payload: True)
        monkeypatch.setenv("HERMES_UI_SESSION_ID", "sess_test_1")

        opened = json.loads(artifact_tools.artifact_studio(action="open", name="Ctx"))
        pid = opened["project_id"]

        # No explicit id: falls back to the session context set by open.
        read = json.loads(artifact_tools.artifact_read(query="name"))
        assert read["success"] is True
        assert read["result"] == "Ctx"

        ha.set_session_artifact_context("sess_test_1", selection=["battery.main"], mode="DESIGN")
        ctx = ha.get_session_artifact_context("sess_test_1")
        assert ctx["project_id"] == pid
        assert ctx["selection"] == ["battery.main"]
