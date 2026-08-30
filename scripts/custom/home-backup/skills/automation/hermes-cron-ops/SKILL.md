---
name: hermes-cron-ops
description: "Debug Hermes cron model-404 failures."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [cron, scheduling, debugging, automation]
    related_skills: [voice-assistant-setup]
---

# Hermes Cron Operations

Use when creating a `cronjob`, a scheduled/recurring Hermes task, an autonomous briefing/monitor, or when a cron run fails with `RuntimeError: Gemini returned HTTP 404` or otherwise won't execute in its fresh subagent session.

## When to Use

- Creating any scheduled Hermes job (`cronjob` tool).
- A cron run returns `RuntimeError: Gemini returned HTTP 404`.
- A cron job "fails closed" after a global model change.

## Creating a cron

- Use the `cronjob` tool: `action='create'` with `schedule` (cron expr like `0 9 * * *`, or relative `30m`/`every 2h`), a self-contained `prompt`, a `name`, optional `skills`, and `deliver`.
- **The prompt MUST reconstruct its own context.** A cron runs in a FRESH session with no chat history. Tell it to use `session_search` + memory; never assume anything from the current chat.
- `deliver='origin'` is local-only (output saved, not pushed into chat). For push to a connected platform use `deliver='telegram'` / `'whatsapp'` / `'all'`.
- **Always test immediately** with `cronjob action='run'` and confirm the output is a real report, not an error block.

## PITFALL: model resolution in fresh cron sessions

A cron job runs as a subagent in a brand-new session. It resolves its model from `model.default` in `config.yaml` — NOT from any `delegation.*` pin and NOT from the interactive session's live model.

If `model.default` names a provider that has **no corresponding `providers:` block**, the run cannot load that model and falls back to Gemini (Hermes's fallback when `GOOGLE_API_KEY` is present). If Gemini isn't actually usable you get:

```
RuntimeError: Gemini returned HTTP 404:
```

### Diagnosis

1. Read `config.yaml`: compare `model: default:` against the `providers:` block.
2. Classic case: `default: openai/gpt-oss-120b` but only `9router` (or another router) is defined under `providers:` → that's the bug.
3. Note: `hermes model` may misleadingly report `Active provider: Google AI Studio` even when the working default is your router. Don't trust that line — trust config + a real run.

### Fix

1. Point the default at the real routing layer:
   `hermes config set model.default 9router/Jarvis`  (substitute YOUR configured provider/model)
2. **Recreate the cron** (`cronjob action='remove'` then `create`). Do NOT just `update` the existing job — Hermes stores a per-job `model_snapshot`; after a global model change it "fails closed" on the next run instead of adopting the new default. Recreating captures the corrected snapshot.
3. Re-run to verify a real briefing returns.

## Rule: don't attach browser skills to non-browser crons

Attaching a skill like `ads-performance-reporting` to a briefing/monitor cron bloats the prompt and can trigger unwanted browser automation. Only attach skills the job actually needs.

## Verification

Never mark a cron "working" on creation alone. Run it (`cronjob action='run'`), read the returned output, and confirm it produced the intended content. A 404 / error block means the model fallback fired — apply the fix above.
