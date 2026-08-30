# MCP Server Recipes — Batch 2: search stack, filesystem, pandas (added 2026-08-24, all verified Connected)

General rule unchanged: pipe answers to `hermes mcp add` or it hangs/cancels.
Pipe shape: remote no-auth = `printf "n\nY\n"`; stdio = `printf "Y\n"`. A leading
`n` on a stdio add makes the tool-enable prompt CANCEL ("server not saved") —
for stdio servers pipe just `"Y\n"`.
Note: there is NO `hermes mcp enable` subcommand; `hermes mcp configure <name>`
requires an interactive TTY. To flip a disabled entry on: `remove` then re-`add`.

## free-search-mcp (stdio uvx, NO API key) — 10 tools
Multi-engine parallel search (DDG/Mojeek/GoogleNews/Bing default), RRF merge,
FTS5 cache, trafilatura extraction, one-shot `research` brief. v0.9.2 on PyPI.
```bash
printf "Y\n" | hermes mcp add free-search --command uvx --args free-search-mcp
# optional browser-rendered engines later:
uvx --from free-search-mcp playwright install chromium
```
Tools: search, research, fetch, fetch_batch, read_doc, cache_search, engines,
compare, extract_structured, download.

## RivalSearchMCP (remote, keyless) — 9 tools / 28 sources
Web+social+news+academic+github, deterministic, no in-server LLM.
```
printf "n\nY\n" | hermes mcp add rival-search --url https://RivalSearchMCP.fastmcp.app/mcp
```
Tools include web_search, research_topic, scientific_research, social_search,
news_aggregation, github_search, document_analysis, map_website,
content_operations. Self-host option exists (uv sync + fastmcp run).

## Parallel Search MCP (remote, FREE anonymous tier) — 2 tools
Official Parallel.ai hosted search; `/mcp` endpoint needs no key/OAuth.
```
printf "n\nY\n" | hermes mcp add parallel-search --url https://search.parallel.ai/mcp
```
Tools: `web_search`, `web_fetch`. Higher rate limits: key from
platform.parallel.ai passed as Bearer header (`--header authorization: Bearer ...`
via mcp-remote, or `--env` if supported). `/mcp-oauth` endpoint = OAuth flow.

## Filesystem (official reference server, stdio npx) — 14 tools
Args after the package are the SANDBOXED allowed dirs (everything else rejected).
```
printf "Y\n" | hermes mcp add filesystem --command npx --args -y @modelcontextprotocol/server-filesystem "C:/Users/works_ar" "C:/jarvis"
```
Tools: read/write/edit_file, create_directory, list_directory(_with_sizes),
directory_tree, move_file, search_files, get_file_info,
list_allowed_directories, read_media_file (base64), read_multiple_files.

## pandas-analyst (PyPI-missing pkg → clone + local venv) — 4 tools
`pandas-mcp` is NOT on PyPI (`pip download` finds nothing). Pattern:
```bash
mkdir -p /c/jarvis/mcp_servers && cd /c/jarvis/mcp_servers
git clone --depth 1 https://github.com/marlonluo2018/pandas-mcp-server.git
cd pandas-mcp-server
uv venv .venv && uv pip install --python .venv pandas chardet fastmcp psutil openpyxl
# smoke test BEFORE registering:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"s","version":"0"}}}' | ./.venv/Scripts/python.exe server.py
# register:
printf "Y\n" | hermes mcp add pandas-analyst \
  --command "C:/jarvis/mcp_servers/pandas-mcp-server/.venv/Scripts/python.exe" \
  --args "C:/jarvis/mcp_servers/pandas-mcp-server/server.py"
```
⚠️ Upstream MISLABEL: its `serverInfo.name` says "Excel-MCP-Server 1.29.0" —
verify with a `tools/list` call instead of trusting the name. Actual tools:
`read_metadata_tool`, `interpret_column_data`, `run_pandas_code_tool`,
`generate_chartjs_tool`.

## Playwright (re-add to enable a disabled entry)
`@playwright/mcp` was configured-but-disabled and could not be enabled in-place
(configure needs TTY). Fix = remove + fresh add:
```bash
hermes mcp remove playwright
printf "Y\n" | hermes mcp add playwright --command npx --args -y @playwright/mcp@latest
```
24 tools: browser_navigate/click/type/snapshot/screenshot/tabs/network_requests/
run_code_unsafe etc.

## Verify
`hermes mcp test <name>` per server → expect Connected. New tools load only in
a FRESH session.
