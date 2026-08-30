---
name: mcp-server-dev
description: "Build or register a local FastMCP server with Hermes."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mcp, fastmcp, model-context-protocol, hermes, integration, api]
---

# MCP Server Dev (local FastMCP + Hermes registration)

Build a custom local MCP server that wraps a REST API / SaaS and exposes it
as tools to MCP clients, then register it in Hermes so its tools become
first-class (`mcp_<name>_<tool>`).

## When to use
- "Build an MCP for <vendor>" / "expose <API> as MCP tools".
- Registering any stdio MCP server in Hermes (`mcp_servers` config).
- A vendor has no native MCP (almost always the case) and you must bridge it.

## Decision: native vs hosted vs custom
1. Check for an **official native MCP** — rare; most SaaS don't ship one.
2. Check **third-party hosted** (viaSocket, etc.) — usually limited to 1–2
   actions and needs an external account/MCP URL. Acceptable only for a quick
   single-action need.
3. **Custom local server** (preferred for control, no per-call limits):
   build on the vendor's REST API using FastMCP. This is the path below.

## Build steps
1. Create a project folder; `uv venv --python 3.11`; activate.
2. **Pin the SDK:** `uv pip install "mcp>=1.0,<2.0" httpx python-dotenv`
   (see `references/fastmcp-version-pitfall.md` — this is the #1 failure).
3. Write `server.py` (use `templates/mcp_server.py` as the skeleton). It must:
   - import `from mcp.server.fastmcp import FastMCP`
   - prepend the venv `site-packages` to `sys.path` before importing mcp
     (guards against a parent process injecting Python env)
   - read secrets from a local `.env` (never hardcode keys in the server)
   - define `@mcp.tool()` async functions; each becomes an MCP tool
   - end with `if __name__ == "__main__": mcp.run()` (stdio transport)
4. Verify the server manually BEFORE registering:
   ```
   printf '{"jsonrpc":"2.0","id":1,"method":"initialize",...}\n' | .venv/Scripts/python.exe server.py
   ```
   If it answers with a `result` containing `serverInfo`, the server is good.

## Register in Hermes (stdio)
**Use `hermes mcp add`, NOT `hermes config set`.** See
`references/hermes-registration.md` for why.
```
hermes mcp add <name> \
  --command "C:/path/to/.venv/Scripts/python.exe" \
  --connect-timeout 90 \
  --args "C:/path/to/server.py"
printf 'y\n' | hermes mcp add <name> ...   # auto-answers the save prompt
hermes mcp test <name>     # ✓ Connected + tools discovered = success
hermes mcp list            # shows ✓ enabled
```
Note: `command` MUST be the venv `python.exe` directly. A `.bat`/`.sh`
launcher as `command` will NOT run (Hermes launches subprocesses without a
shell). If the server needs env prep, bake it into `server.py` (e.g. the
`sys.path` insert) instead of a wrapper script.

## Pitfalls (all verified this session)
- **mcp 2.x removed FastMCP** — `ModuleNotFoundError: No module named
  'mcp.server.fastmcp'` even though mcp is "installed". Pin `mcp<2.0`.
- **`hermes config set mcp_servers.X.args "[...]"` stores a string/dict**,
  not a list → Hermes passes it wrong and the subprocess can't launch. Always
  use `hermes mcp add --args` (variadic, must be the last option).
- **`.bat`/`.sh` as `command` fails silently** (Connection closed). Use the
  interpreter binary directly.
- **Don't assume a PYTHONHOME hijack** when an MCP import fails under Hermes.
  The real cause is usually a version mismatch. Diagnose with the mcp stderr
  log and a pre-import debug dump (see hermes-registration.md).
- **Global `PYTHONPATH` shadows the project `.venv`'s `pydantic_core`.** If the
  host has a `PYTHONPATH` pointing at the hermes-agent venv (common on this
  machine), pydantic-based servers (FastMCP) die with
  `ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'` even
  though the project `.venv` has a correct pydantic_core. Fix: clear PYTHONPATH
  before launch — `set PYTHONPATH=` (cmd) / `env -u PYTHONPATH` (bash), or a
  launcher `.cmd` that does `set PYTHONPATH=` then runs the venv python. Do NOT
  "fix" it with `--force-reinstall pydantic-core` (swaps an incompatible wheel
  and can corrupt the host venv). Full diagnosis recipe in
  `references/pydantic-core-pythonpath-pitfall.md`.

## Verification checklist
- [ ] `hermes mcp test <name>` → `✓ Connected`, `✓ Tools discovered: N`
- [ ] `hermes mcp list` → `<name> ... ✓ enabled`
- [ ] Tools callable: `mcp_<name>_<tool>` appear in the agent toolset
- [ ] Secrets live in `.env`, not inline in `server.py` or `config.yaml`
