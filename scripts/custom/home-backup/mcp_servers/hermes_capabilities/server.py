#!/usr/bin/env python3
"""Hermes Capabilities MCP server.

Gives EVERY Hermes surface — including messaging platforms where the desktop
UI toolset never loads — access to the custom capability layer built on top
of this install:

  - save_artifact      : persist generated HTML/SVG/JSX/TSX to the private
                         GitHub artifacts repo (parionyx/artifacts)
  - push_skill_file    : mirror a SKILL.md to the hermes-custom repo
  - list_capabilities  : self-description of what this install can do

Runs over stdio using the same MCPServer API as `mcp_serve.py`. Registered
in config.yaml under mcp_servers.hermes-capabilities.
"""

from __future__ import annotations

import asyncio
import base64
import json
import re
import subprocess
import time

from mcp.server import MCPServer


ARTIFACTS_REPO = "parionyx/artifacts"
CUSTOM_REPO = "parionyx/hermes-custom"

_SLUG_RE = re.compile(r"[^a-zA-Z0-9._-]+")

EXT_BY_KIND = {"html": ".html", "svg": ".svg", "jsx": ".jsx", "tsx": ".tsx", "md": ".md"}


def _slugify(value: str, fallback: str = "untitled") -> str:
    slug = _SLUG_RE.sub("-", (value or "").strip()).strip("-.")
    return (slug[:80] or fallback).lower()


def _gh_put_file(repo: str, path: str, text: str, message: str) -> None:
    """Create/update one file through the GitHub Contents API via gh CLI."""
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


CAPABILITIES_DOC = {
    "interactive_chat_widgets": {
        "available_on": ["desktop"],
        "tools": {
            "show_buttons": (
                "Non-blocking action chips; clicks arrive as the user's next "
                "message. Persistent in transcript."
            ),
            "show_form": (
                "Blocking typed form (text/number/select/checkbox/textarea); "
                "answers return as structured values in-turn."
            ),
            "clarify": "Blocking multiple-choice / free-text question.",
        },
    },
    "artifacts": {
        "available_on": ["desktop"],
        "behavior": (
            "Substantial ```html / ```svg / component-shaped ```jsx|tsx fences "
            "render as artifact cards and open live in the preview pane with "
            "version history. React artifacts run on an embedded React+Babel runtime."
        ),
        "persist": "save_artifact_github tool (desktop) or this server's save_artifact (anywhere).",
    },
    "self_learning": {
        "auto": (
            "experience-curator plugin reviews completed sessions "
            "(rate-limited to one per 6h) and saves novel successful procedures "
            "as agent-created skills."
        ),
        "commands": ["/capture-session (distill this chat)", "/experience status|now"],
    },
    "github_sync": {
        "skills_repo": CUSTOM_REPO,
        "artifacts_repo": ARTIFACTS_REPO,
        "status_command": "/sync-github",
    },
    "projects": {
        "available_on": ["desktop", "gui sessions"],
        "tools": ["project_list", "project_create", "project_switch"],
    },
}


def create_mcp_server() -> "MCPServer":
    mcp = MCPServer(
        "hermes-capabilities",
        instructions=(
            "Custom capability layer for this Hermes install. Use save_artifact "
            "to persist generated interactive content to GitHub from ANY surface, "
            "and list_capabilities when unsure what this install can do."
        ),
    )

    @mcp.tool()
    def save_artifact(title: str, content: str, kind: str = "html") -> str:
        """Persist a generated artifact (HTML page, SVG graphic, JSX component,
        or markdown doc) to the user's private GitHub artifacts repository so it
        has a permanent, linkable home.

        Args:
            title: Short human title; becomes the filename slug.
            content: Full artifact source text.
            kind: Content type — html|svg|jsx|tsx|md. Default html.
        """
        if not content.strip():
            return json.dumps({"success": False, "error": "content is required."})

        kind = kind.lower().strip()
        if kind not in EXT_BY_KIND:
            kind = "html"

        stamp = time.strftime("%Y%m%d-%H%M%S")
        slug = _slugify(title, "artifact")
        path = f"{time.strftime('%Y/%m')}/{stamp}-{slug}{EXT_BY_KIND[kind]}"

        try:
            _gh_put_file(ARTIFACTS_REPO, path, content, f"artifact: {title}")
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False)

        return json.dumps(
            {
                "success": True,
                "repo": ARTIFACTS_REPO,
                "path": path,
                "url": f"https://github.com/{ARTIFACTS_REPO}/blob/main/{path}",
            },
            ensure_ascii=False,
        )

    @mcp.tool()
    def push_skill_file(name: str, skill_md: str, category: str = "uncategorized") -> str:
        """Back up one skill's SKILL.md to the private hermes-custom repo under
        managed-skills/<category>/<name>/. The github-sync plugin already does
        this automatically after skill_manage calls; use this for manual or
        external skills.

        Args:
            name: Skill name (kebab-case).
            skill_md: Full SKILL.md text including frontmatter.
            category: Category folder. Default uncategorized.
        """
        if not name.strip() or not skill_md.strip():
            return json.dumps({"success": False, "error": "name and skill_md are required."})

        path = f"managed-skills/{_slugify(category)}/{_slugify(name)}/SKILL.md"
        try:
            _gh_put_file(CUSTOM_REPO, path, skill_md, f"skill: update {name}")
        except Exception as exc:
            return json.dumps({"success": False, "error": str(exc)}, ensure_ascii=False)

        return json.dumps(
            {"success": True, "repo": CUSTOM_REPO, "path": path,
             "url": f"https://github.com/{CUSTOM_REPO}/blob/main/{path}"},
            ensure_ascii=False,
        )

    @mcp.tool()
    def list_capabilities() -> str:
        """Describe this install's custom capabilities: interactive chat
        widgets (desktop), live artifact rendering, experience-based
        self-learning, and GitHub auto-sync. Call at session start when unsure
        what you can do here."""
        return json.dumps(CAPABILITIES_DOC, ensure_ascii=False, indent=2)

    return mcp


def run_stdio() -> None:
    server = create_mcp_server()

    async def _run():
        await server.run_stdio_async()

    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    run_stdio()
