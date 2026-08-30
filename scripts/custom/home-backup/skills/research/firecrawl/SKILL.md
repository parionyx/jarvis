---
name: firecrawl
description: "Use Firecrawl MCP/CLI to search, scrape, and parse the web."
---

# Firecrawl

Firecrawl gives AI agents fast, reliable web context: search, scrape, interact, parse, research, monitor.

## Init (run once)
```bash
npx -y firecrawl-cli@latest init --all -k fc-b17e45d7b9054d8e9425d35e86927c52
```

## API key
FIRECRAWL_API_KEY=fc-b17e45d7b9054d8e9425d35e86927c52
(Wired into the `firecrawl` Hermes MCP server env too.)

## Default flow (Path A)
1. search for discovery → 2. scrape a known URL → 3. interact for clicks/forms/login → 4. parse local files → 5. monitor for recurring checks → 6. `firecrawl ask <jobId>` on failure.

## CLI
- `firecrawl search "<q>"`
- `firecrawl scrape "<url>" -o out.md`
- `firecrawl interact "<goal>"`
- `firecrawl parse ./f.pdf -o f.md` (-S summary, -Q question)
- `firecrawl monitor create --goal "..."`
- `firecrawl research search-papers "<q>"`
- `firecrawl ask <jobId>`

## REST (Path E)
Base: https://api.firecrawl.dev/v2 · Auth: `Authorization: Bearer fc-...`
POST /search /scrape /interact /parse /monitor; GET /search/research/papers; POST /support/ask

## Keyless free tier (Path F)
MCP https://mcp.firecrawl.dev/v2/mcp · CLI `npx -y firecrawl-cli@latest`

## Hermes MCP tools
`mcp_firecrawl_*` (search, scrape, map, research_search_papers). Use FIRST for web research.
