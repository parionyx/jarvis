#!/usr/bin/env python3
"""GitHub Sync — every skill and artifact lands on GitHub automatically.

Wires two things onto the agent:

1. ``post_tool_call`` hook: when ``skill_manage`` creates or edits a skill,
   the skill's SKILL.md is pushed to the private custom repo
   (``integrations.github_sync.custom_repo``, default
   ``parionyx/hermes-custom``) under ``managed-skills/<category>/<name>/``.

2. A small tool, ``save_artifact_github``, the agent calls right after it
   builds an interactive artifact (HTML/SVG/JSX). Content goes to the
   artifacts repo (default ``parionyx/artifacts``) under a dated slug, so
   every generated thing has a permanent, shareable-by-link home.

All pushes go through the ``gh`` CLI (already authenticated on this
machine) via the Contents API — no local clone needed. Pushes run on a
daemon thread and never block the agent's turn. Failures are recorded in
the state file and surfaced by ``/sync-github status``.

Config (config.yaml):
    integrations:
      github_sync:
        enabled: true            # master switch (default true)
        custom_repo: parionyx/hermes-custom
        artifacts_repo: parionyx/artifacts
        push_skills: true
"""

from __future__ import annotations

import base64
import json
import logging
import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.plugins.github_sync")

DEFAULT_CUSTOM_REPO = "parionyx/hermes-custom"
DEFAULT_ARTIFACTS_REPO = "parionyx/artifacts"


# ---------------------------------------------------------------------------
# Config + state
# ---------------------------------------------------------------------------


def _config() -> Dict[str, Any]:
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        root = cfg.get("integrations", {})
        section = root.get("github_sync", {}) if isinstance(root, dict) else {}
        return section if isinstance(section, dict) else {}
    except Exception:
        return {}


def _enabled() -> bool:
    return _config().get("enabled", True) is not False


def _custom_repo() -> str:
    return str(_config().get("custom_repo") or DEFAULT_CUSTOM_REPO)


def _artifacts_repo() -> str:
    return str(_config().get("artifacts_repo") or DEFAULT_ARTIFACTS_REPO)


def _state_path() -> Path:
    from hermes_constants import get_hermes_home

    return get_hermes_home() / "github-sync-state.json"


def _load_state() -> Dict[str, Any]:
    try:
        return json.loads(_state_path().read_text(encoding="utf-8"))
    except Exception:
        return {}


def _record(entry: Dict[str, Any]) -> None:
    state = _load_state()
    history = state.get("history", [])
    history.insert(0, {**entry, "ts": time.strftime("%Y-%m-%d %H:%M:%S")})
    state["history"] = history[:50]
    if entry.get("ok"):
        state["last_push"] = entry.get("target")
    else:
        state["last_error"] = entry.get("detail")
    try:
        from utils import atomic_json_write

        atomic_json_write(_state_path(), state)
    except Exception:
        logger.debug("state write failed", exc_info=True)


# ---------------------------------------------------------------------------
# gh CLI plumbing
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def _slugify(value: str, fallback: str = "untitled") -> str:
    slug = _SLUG_RE.sub("-", (value or "").strip()).strip("-.")
    return (slug[:80] or fallback).lower()


def gh_put_file(repo: str, path: str, text: str, message: str) -> None:
    """Create/update one file through the Contents API. Raises on failure."""
    b64 = base64.b64encode(text.encode("utf-8")).decode("ascii")
    result = subprocess.run(
        [
            "gh", "api",
            "-X", "PUT",
            f"repos/{repo}/contents/{path}",
            "-f", "message=" + message,
            "-f", "content=" + b64,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "gh api failed").strip()[:300])


# ---------------------------------------------------------------------------
# Push jobs (async)
# ---------------------------------------------------------------------------


def _push_async(target_desc: str, job) -> None:
    def worker():
        if not _enabled():
            return
        for attempt in (1, 2):
            try:
                url_path = job()
                _record({"ok": True, "target": target_desc})
                logger.info("pushed %s", target_desc)
                return
            except Exception as exc:
                if attempt == 2:
                    logger.warning("push failed for %s: %s", target_desc, exc)
                    _record({"ok": False, "target": target_desc, "detail": str(exc)})
                time.sleep(1.5 * attempt)

    threading.Thread(target=worker, name="github-sync", daemon=True).start()


def push_skill(category: Optional[str], name: str, skill_md_path: Path) -> None:
    repo = _custom_repo()

    def job():
        text = skill_md_path.read_text(encoding="utf-8")
        cat = _slugify(category or "uncategorized")
        path = f"managed-skills/{cat}/{_slugify(name)}/SKILL.md"
        gh_put_file(repo, path, text, f"skill: update {name}")
        return f"{repo}:{path}"

    _push_async(f"{repo} <- skill {name}", job)


def save_artifact(title: str, content: str, kind: str = "html") -> str:
    """Tool entry point: persist one artifact to the artifacts repo."""
    if not content or not content.strip():
        return json.dumps({"success": False, "error": "content is required."})

    kind = kind.lower().strip() or "html"
    ext = {"html": ".html", "svg": ".svg", "jsx": ".jsx", "tsx": ".tsx"}.get(kind, ".html")
    stamp = time.strftime("%Y%m%d-%H%M%S")
    slug = _slugify(title, "artifact")
    repo = _artifacts_repo()
    path = f"{time.strftime('%Y/%m')}/{stamp}-{slug}{ext}"

    def job():
        gh_put_file(repo, path, content, f"artifact: {title}")
        return f"{repo}:{path}"

    _push_async(f"{repo} <- artifact {title}", job)

    return json.dumps(
        {
            "success": True,
            "repo": repo,
            "path": path,
            "url": f"https://github.com/{repo}/blob/main/{path}",
            "note": "Pushing in the background; check /sync-github status if unsure.",
        },
        ensure_ascii=False,
    )


# ---------------------------------------------------------------------------
# Hook + tool registration
# ---------------------------------------------------------------------------


def _on_post_tool_call(**kwargs) -> None:
    """After skill_manage create/edit succeeds, mirror the SKILL.md to GitHub."""
    if not _enabled():
        return

    name = kwargs.get("tool_name") or kwargs.get("function_name")
    if name != "skill_manage":
        return

    result = kwargs.get("result") or ""
    args = kwargs.get("args") or {}
    try:
        outcome = json.loads(result) if isinstance(result, str) else (result or {})
    except ValueError:
        outcome = {}

    if outcome.get("success") is not True:
        return

    action = str(args.get("action") or "")
    if action not in ("create", "edit"):
        return

    skill_name = str(outcome.get("name") or args.get("name") or "").strip()
    category = outcome.get("category") or args.get("category")
    if not skill_name:
        return

    # Locate the written file. The tool result usually carries the path; fall
    # back to scanning HERMES_HOME/skills.
    raw_path = outcome.get("path") or outcome.get("skill_path")

    def find_md():
        if raw_path:
            p = Path(str(raw_path))
            if p.is_file():
                return p
            base = Path(str(raw_path))
            candidate = base / "SKILL.md"
            if candidate.is_file():
                return candidate
        from hermes_constants import get_hermes_home

        roots = [get_hermes_home() / "skills"]
        for root in roots:
            matches = list(root.rglob(f"{_slugify(skill_name)}*/SKILL.md")) + list(
                root.glob(f"*/{skill_name}/SKILL.md")
            )
            if matches:
                return matches[0]
        return None

    md_path = find_md()
    if md_path is None:
        logger.debug("could not locate SKILL.md for %s; skipping push", skill_name)
        return

    push_skill(category if isinstance(category, str) else None, skill_name, md_path)


ARTIFACT_TOOL_SCHEMA = {
    "name": "save_artifact_github",
    "description": (
        "Save an interactive artifact you just created (an HTML page, SVG "
        "graphic, or JSX component) to the user's private GitHub artifacts "
        "repository so it has a permanent home. Call this immediately after "
        "producing substantial artifact content in chat, with the SAME "
        "content that was shown to the user. Returns the repo path."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Short human title, becomes the filename slug."},
            "content": {"type": "string", "description": "The full artifact source text."},
            "kind": {"type": "string", "enum": ["html", "svg", "jsx", "tsx"], "description": "Content type. Default html."},
        },
        "required": ["title", "content"],
    },
}


def save_artifact_github_tool(title: str = "", content: str = "", kind: str = "html") -> str:
    if not title.strip():
        return json.dumps({"success": False, "error": "title is required."})
    return save_artifact(title=title, content=content, kind=kind)


def _handle_slash(raw_args: str) -> Optional[str]:
    args = (raw_args or "").strip().lower()
    state = _load_state()

    if args in ("", "status"):
        enabled = _enabled()
        lines = [
            f"github-sync — enabled: {enabled}",
            f"custom repo: {_custom_repo()}  ·  artifacts repo: {_artifacts_repo()}",
            f"last push: {state.get('last_push') or 'none'}",
        ]
        if state.get("last_error"):
            lines.append(f"last error: {state['last_error']}")
        history = state.get("history", [])[:5]
        if history:
            lines.append("recent:")
            for h in history:
                mark = "+" if h.get("ok") else "-"
                lines.append(f"  [{mark}] {h.get('ts')} {h.get('target')}" + (
                    f" — {h.get('detail')}" if h.get("detail") else ""
                ))
        return "\n".join(lines)

    return "Usage: /sync-github [status]"


def register(ctx) -> None:
    ctx.register_hook("post_tool_call", _on_post_tool_call)
    ctx.register_command(
        "sync-github",
        handler=_handle_slash,
        description="GitHub sync status (skills/artifacts auto-push).",
    )

    # Tool availability gate: only offer the schema when gh is authenticated;
    # otherwise the tool never loads and the agent is none the wiser.
    try:
        probe = subprocess.run(["gh", "auth", "token"], capture_output=True, timeout=15)
        if probe.returncode == 0 and probe.stdout.strip():
            ctx.register_tool(
                name="save_artifact_github",
                toolset="github_sync",
                schema=ARTIFACT_TOOL_SCHEMA,
                handler=lambda args, **kw: save_artifact_github_tool(
                    title=args.get("title", ""),
                    content=args.get("content", ""),
                    kind=args.get("kind", "html"),
                ),
                emoji="⬆️",
            )
        else:
            logger.info("gh not authenticated; save_artifact_github not registered")
    except Exception:
        logger.debug("gh auth probe failed; artifact tool not registered", exc_info=True)
