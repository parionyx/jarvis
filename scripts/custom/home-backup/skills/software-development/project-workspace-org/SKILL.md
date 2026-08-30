---
name: project-workspace-org
description: "Lay out code projects under C:\\jarvis\\projects\\<name>\\."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [workspace, organization, convention, jarvis, projects]
---

# Project Workspace Organization (JARVIS / Abhishek)

Standing directive from the user (stated verbatim intent: "jab bhi ham kisi
project pr kaam kre jaha code write krne ki need ho vha ka data C drive me ek
ek folder bna jarvies ke name se apna sara is tarah ka data new folder create kr
kr ke starute format me orginize rakhna h").

## When to Use
- Any task that involves writing, editing, or maintaining code (scripts, servers,
  apps, automations, MCP servers, scrapers, etc.).
- Before starting a new project, when the user says "build X", "make a tool for Y",
  "setup Z", or assigns any coding work.
- When you catch yourself about to drop files in `C:\Users\works_ar`, Desktop, or
  Downloads — redirect to `C:\jarvis\projects\<name>\`.

## Rule (always apply for any code-writing task)
- Create a dedicated folder per project under: `C:\jarvis\projects\<project-name>\`
  - `<project-name>` should be short, lowercase, hyphenated (e.g. `zoho-crm-mcp`).
- NEVER scatter project files across the user home (`C:\Users\works_ar`), Desktop,
  or Downloads. The `C:\jarvis` tree is the single source of truth for code work.
- Shared, cross-project dirs already established:
  - `C:\jarvis\config` — shared config templates
  - `C:\jarvis\data` — persistent data dumps
  - `C:\jarvis\logs` — run logs
  - `C:\jarvis\README.md` — index of all projects + the layout convention

## Per-project structured format (STATUS.md is mandatory)
Each project folder should contain:
- `README.md` — what it is, setup, usage
- `STATUS.md` — continuity doc with this shape:
  ```
  # Project Status: <name>
  - OBJECTIVE
  - STACK
  - PATH
  - STATUS (e.g. BUILT/VERIFIED, IN-PROGRESS, BLOCKED)
  - COMPLETED (checklist)
  - PENDING / BLOCKERS
  - KNOWN ISSUES / GOTCHAS
  - NEXT ACTION
  ```
- own `.venv` (uv-managed) — do not share a venv across projects
- code, assets, and any data the project produces, kept in-folder
- `.env` / secrets: never commit; provide a `.env.example`

## Workflow
1. At the START of any code project, create `C:\jarvis\projects\<name>\` and
   `STATUS.md` before/while working — not after.
2. Maintain STATUS.md as work proceeds; mark state VERIFIED only after a real
   tool/run confirms it (JARVIS continuity rule).
3. Keep `C:\jarvis\README.md` project table updated when a project is added.

## Pitfalls
- Do not put the project inside `C:\Users\works_ar\...` even if a tool defaults
  there. Pass absolute `C:\jarvis\projects\<name>\` paths.
- Do not reuse one venv for multiple projects — uv per-project venvs avoid
  dependency conflicts (and the PYTHONPATH-shadow pitfall in mcp-server-dev).
- This is a convention, not a memory-only note: future sessions must create the
  folder structure WITHOUT being reminded.

## See also
- `mcp-server-dev` — for building FastMCP servers inside such a project folder
  (and the PYTHONPATH/pydantic_core launch pitfall).
