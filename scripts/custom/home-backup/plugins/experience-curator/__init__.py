#!/usr/bin/env python3
"""Experience Curator — turn successful unfamiliar work into reusable skills.

Listens for session turns completing, and (rate-limited) asks the auxiliary
model whether the just-finished session solved something worth remembering.
When it did, the distilled procedure is written as an agent-created skill via
the standard ``skill_manage`` path — so provenance tracking, the curator
lifecycle, and skill validation all apply unchanged.

Design notes:
  * The hook returns immediately; the LLM review runs on a daemon thread so
    turn finalization is never delayed.
  * Rate-limited by default (one auto-capture per ``min_interval_hours``).
    ``/experience now`` bypasses the limiter.
  * Never raises: every failure lands in the plugin log. A broken capture
    must not break a session that just finished.

Slash command: ``/experience`` — status; ``/experience now`` — force a
review of the most recent completed session.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.plugins.experience_curator")

# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

_MIN_INTERVAL_HOURS_DEFAULT = 6.0
_MAX_TRANSCRIPT_CHARS = 14_000
_MAX_MESSAGES = 80


def _state_path() -> Path:
    from hermes_constants import get_hermes_home

    return get_hermes_home() / "experience-curator-state.json"


def _load_state() -> Dict[str, Any]:
    try:
        return json.loads(_state_path().read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_state(state: Dict[str, Any]) -> None:
    try:
        from utils import atomic_json_write

        atomic_json_write(_state_path(), state)
    except Exception:
        logger.debug("state save failed", exc_info=True)


def _config() -> Dict[str, Any]:
    """Plugin tuning from config.yaml → experience_curator: {...}."""
    try:
        from hermes_cli.config import load_config

        cfg = load_config()
        section = cfg.get("experience_curator", {})
        return section if isinstance(section, dict) else {}
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Transcript access
# ---------------------------------------------------------------------------


def _load_recent_messages(session_id: str) -> list[Dict[str, Any]]:
    from hermes_state import SessionDB

    db = SessionDB()
    rows = db.get_messages(session_id, limit=_MAX_MESSAGES, latest=True)
    # `latest` pages back from the newest but still returns chronological order.
    return rows or []


def _render_transcript(rows: list[Dict[str, Any]]) -> str:
    lines: list[str] = []
    total = 0

    for row in rows:
        role = str(row.get("role") or "system")
        content = row.get("content") or ""
        if not isinstance(content, str):
            content = json.dumps(content)[:400]
        content = content.strip()
        if role == "system" or not content:
            continue
        snippet = content[:600] + ("…" if len(content) > 600 else "")
        line = f"{role.upper()}: {snippet}"
        if total + len(line) > _MAX_TRANSCRIPT_CHARS:
            break
        lines.append(line)
        total += len(line)

    return "\n\n".join(lines)


def _session_is_substantial(rows: list[Dict[str, Any]]) -> bool:
    roles = [str(r.get("role") or "") for r in rows]
    user_turns = roles.count("user")
    assistant_turns = roles.count("assistant")
    toolish = sum(1 for r in rows if r.get("tool_name") or r.get("tool_call_id"))
    return user_turns >= 2 and assistant_turns >= 1


# ---------------------------------------------------------------------------
# Capture
# ---------------------------------------------------------------------------

_REVIEW_PROMPT = """You are a learning extractor. Review this finished agent session.

Decide: did the agent complete a task whose *procedure* is non-obvious and
likely to recur? Ignore trivial Q&A, pure conversation, and anything already
generic knowledge. If nothing qualifies, answer {"capture": false}.

If it qualifies, distill the SUCCESSFUL approach into a new Hermes skill and
answer with strict JSON only:

{
  "capture": true,
  "name": "kebab-case-skill-name",
  "category": "closest-bundled-category",
  "skill_md": "full SKILL.md text with frontmatter (name, description <=60 chars ending with period, version, author: 'Hermes Agent') and sections: intro, ## When to Use, ## Prerequisites, ## How to Run, ## Quick Reference, ## Procedure, ## Pitfalls, ## Verification"
}

Rules for skill_md: ~100 lines max; concrete commands/paths/tool sequences;
no secrets; reference native Hermes tools (`terminal`, `read_file`, `patch`,
`web_search`) in prose. Output JSON only — no markdown fences."""


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        return None


def run_capture(session_id: str, *, force: bool = False) -> str:
    """Review one finished session; create a skill when warranted.

    Returns a human-readable summary either way."""
    cfg = _config()
    min_interval_hours = float(cfg.get("min_interval_hours", _MIN_INTERVAL_HOURS_DEFAULT))
    state = _load_state()

    last_ts = float(state.get("last_auto_capture_ts", 0))
    if not force and min_interval_hours > 0 and (time.time() - last_ts) < min_interval_hours * 3600:
        return (
            f"Auto-capture skipped: last review {min_interval_hours}h window not elapsed. "
            "Use `/experience now` to force."
        )

    rows = _load_recent_messages(session_id)
    if len([r for r in rows if str(r.get('role') or '') != 'system']) < 4:
        return "Session too short to learn from."

    if not _session_is_substantial(rows):
        return "Session lacks substance (too few real exchanges)."

    transcript = _render_transcript(rows)

    try:
        from agent.auxiliary_client import call_llm, extract_content_or_reasoning

        response = call_llm(
            task="experience_curator",
            messages=[
                {"role": "system", "content": _REVIEW_PROMPT},
                {"role": "user", "content": f"SESSION TRANSCRIPT:\n\n{transcript}"},
            ],
            temperature=0.2,
        )
        raw = extract_content_or_reasoning(response) or ""
    except Exception as exc:
        logger.warning("aux LLM review failed: %s", exc)
        return f"Review failed: {exc}"

    verdict = _extract_json(raw)
    if not verdict:
        return "Reviewer returned no usable verdict."

    if verdict.get("capture") is not True:
        state["last_auto_capture_ts"] = time.time()
        state["last_result"] = "no capture"
        _save_state(state)
        return "Nothing novel enough to save this time."

    name = str(verdict.get("name") or "").strip()
    content = str(verdict.get("skill_md") or "")
    category = str(verdict.get("category") or "").strip() or None
    if not name or not content:
        return "Verdict missing name/content."

    try:
        from tools.skill_manager_tool import skill_manage

        result = skill_manage(action="create", name=name, content=content, category=category, session_id=session_id)
    except Exception as exc:
        logger.warning("skill_manage failed: %s", exc)
        return f"Skill creation failed: {exc}"

    try:
        outcome = json.loads(result)
    except ValueError:
        outcome = {}

    if outcome.get("success") is False:
        return f"Skill creation rejected: {outcome.get('error') or result[:200]}"

    state["last_auto_capture_ts"] = time.time()
    state["last_result"] = f"created skill: {name}"
    state["last_skill"] = name
    _save_state(state)
    logger.info("Experience captured as skill '%s'", name)
    return f"Learned something new — saved as skill `{name}`. It will load automatically on similar tasks."


# ---------------------------------------------------------------------------
# Hook + command wiring
# ---------------------------------------------------------------------------


def _on_session_end(session_id=None, completed=False, **_kwargs) -> None:
    """Fire-and-forget auto capture. Returns before any LLM work starts."""
    if not session_id or not completed:
        return

    def _worker():
        try:
            run_capture(str(session_id), force=False)
        except Exception:
            logger.debug("auto capture crashed", exc_info=True)

    threading.Thread(target=_worker, name="experience-curator", daemon=True).start()


def _handle_slash(raw_args: str) -> Optional[str]:
    args = (raw_args or "").strip().lower()
    state = _load_state()
    last_skill = state.get("last_skill")

    if args in ("", "status"):
        last = state.get("last_result") or "never run"
        when = state.get("last_auto_capture_ts")
        stamp = time.strftime("%Y-%m-%d %H:%M", time.localtime(when)) if when else "-"
        return f"Experience curator — last run: {stamp}; result: {last}" + (
            f"; latest skill: `{last_skill}`" if last_skill else ""
        )

    if args in ("now", "force"):
        session_id = state.get("last_session_id")
        if not session_id:
            return "No recent completed session id recorded yet."
        return run_capture(str(session_id), force=True)

    return "Usage: /experience [status|now]"


def register(ctx) -> None:
    ctx.register_hook("on_session_end", _remember_session_and_maybe_capture)
    ctx.register_command(
        "experience",
        handler=_handle_slash,
        description="Show/force experience-curator skill capture.",
    )


def _remember_session_and_maybe_capture(session_id=None, completed=False, **kwargs) -> None:
    # Record the id first so `/experience now` always has a target, then hand
    # off to the async worker.
    if session_id:
        state = _load_state()
        state["last_session_id"] = str(session_id)
        _save_state(state)

    _on_session_end(session_id=session_id, completed=completed, **kwargs)
