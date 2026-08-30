---
name: hermes-mcp-setup
description: Add non-catalog MCP servers to Hermes via remote OAuth.
---

# Hermes MCP Setup

Use when the user says "add <X> mcp", "connect <service> to Hermes", or the
`setup_mcp` tool fails with "not in the catalog". Covers BOTH catalog and
non-catalog MCP servers.

## Two install paths

### Path 1 — Catalog servers (one-click)
`hermes mcp install <name>` works ONLY for entries in `hermes mcp catalog`
(airtable, figma, notion, vercel, stripe, github, n8n, tavily, zoho-crm, etc.).
The in-app `setup_mcp` tool also only handles catalog entries — it errors on
anything else with "'<x>' is not in the MCP catalog".

### Path 2 — Non-catalog REMOTE OAuth servers (the key technique)
Many official remote MCPs are NOT in the catalog. Add them directly with the
underlying CLI command (the `setup_mcp` tool CANNOT do this):

```
hermes mcp add <name> --url <remote_url> --auth oauth
```

This:
- Writes the server to config as `url:` + `auth: oauth` (same shape as the
  catalog's Figma entry). You do NOT need to hand-edit config.yaml.
- Auto-opens a browser OAuth window. Authorize there; tokens are acquired on
  first connection.
- Runs tool discovery immediately and prints the tool count on success.

## Real worked example: Canva
Canva's official remote MCP is NOT in the catalog. `hermes mcp install canva` and
the `setup_mcp` tool both fail with "not in the catalog". Instead:

```
hermes mcp add canva --url https://mcp.canva.com/mcp --auth oauth
```

Result: connected, 33 tools discovered (create-folder, list-folder-items,
design:content:write/read, brandtemplate:*, asset:read/write, brandkit:read,
comment:*, help:answers:*). OAuth scope requested:
profile:read design:meta:read design:content:write design:content:read
folder:read folder:write brandtemplate:content:read brandtemplate:meta:read
brandtemplate:content:write comment:write comment:read asset:read asset:write
brandkit:read help:answers:read help:answers:write.

Tell the user: authorize in the browser popup that opens; tokens auto-acquire on
first connection.

## Finding the remote URL for a service
If a service "has an MCP" but isn't in `hermes mcp catalog`:
1. Search its developer docs for "MCP" / "Model Context Protocol" remote
   endpoint (usually `https://mcp.<service>.com/mcp`).
2. Try `hermes mcp add <name> --url <that_url> --auth oauth`.
3. If it uses header auth instead of OAuth, use `--auth header` and supply a
   token via config (`headers: { Authorization: Bearer ... }`), like the n8n-mcp
   catalog entry does.

## Pitfalls
- Do NOT loop on `hermes mcp install <x>` or the `setup_mcp` tool for a server
  absent from `hermes mcp catalog` — jump straight to
  `hermes mcp add --url --auth oauth`.
- `hermes mcp add` takes positional `name` first, then `--url` / `--auth`.
  Don't pass the URL as the positional arg.
- Verify after adding: `hermes mcp list` (enabled status) and
  `hermes mcp test <name>` (connection probe).

## Config shape (config.yaml)
```yaml
mcp_servers:
  canva:
    url: https://mcp.canva.com/mcp
    auth: oauth
    enabled: true
  # Figma is the catalog analog (same remote-OAuth shape):
  figma:
    url: https://mcp.figma.com/mcp
    auth: oauth
    enabled: true
```
