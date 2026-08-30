---
name: github-sync
description: Skills and artifacts auto-push to private GitHub repos here.
version: 1.0.0
author: Parionyx
license: MIT
metadata:
  hermes:
    tags: [github, backup, automation]
    category: devops
---

# GitHub Sync Skill

Every skill and artifact this install creates is mirrored to the user's
private repos automatically — you rarely need to act, just stay consistent.

## When to Use

- You created/updated a skill via `skill_manage` → nothing to do; the hook
  pushes it within seconds.
- You built an artifact → call `save_artifact_github` (desktop) or MCP
  `save_artifact` yourself right after generating it.
- User asks "where is that file/dashboard/skill saved?" → give the repo URL.
- Something failed to push → diagnose with `/sync-github status`.

## Prerequisites

- `gh` CLI authenticated (account `parionyx`).
- Repos: `parionyx/hermes-custom` (skills + code snapshots) and
  `parionyx/artifacts` (generated content).

## How to Run

```python
# Persist an artifact (returns the permanent URL — share it)
save_artifact_github(
    title="Sales Dashboard",
    content=<full html/svg/jsx source>,
    kind="html",  # html|svg|jsx|tsx
)
```

Status/diagnosis is a slash command, not a tool: `/sync-github status`
shows last push, last error, and recent history.

## Quick Reference

| Target | Repo | Trigger |
|--------|------|---------|
| New/edited skill | hermes-custom `managed-skills/<cat>/<name>/` | automatic |
| Artifacts | artifacts `<yyyy>/<mm>/<stamp>-<slug>` | on your tool call |
| Whole-install snapshot | hermes-custom `main` branch | manual script |

## Procedure

1. Generate the artifact normally (see artifact-creation skill).
2. Immediately persist with the SAME content shown in chat.
3. Quote the returned `url` in your reply.

## Pitfalls

- Pushes are async — the tool returns instantly with "pushing in background";
  verify failures via `/sync-github status`, not by re-calling blindly.
- Do not push secrets; artifact content lands in a private but real repo.
- Empty/garbage content is rejected client-side; fix before retrying once.

## Verification

`gh api repos/parionyx/artifacts/commits?per_page=1` (via terminal) or the
returned blob URL shows the pushed file.
