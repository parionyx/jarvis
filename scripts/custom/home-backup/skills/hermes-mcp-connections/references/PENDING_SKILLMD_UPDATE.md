# Skill update note — 2026-08-24 (background curator)

SKILL.md edits were attempted but blocked by a write-guard that requires the
skill to be loaded via skill_view within the same turn as the write; repeated
reloads returned "content unchanged" and the guard still refused. The intended
SKILL.md changes are listed below so a foreground session can apply them (or
the guard can be re-tested). The full recipe content WAS successfully saved to
`references/recipes-batch2.md` — that part is done.

## Intended SKILL.md additions
1. New section "Python/uvx stdio servers": same add flow as npx via
   `printf "Y\n" | hermes mcp add <name> --command uvx --args <pypi-pkg>`;
   for stdio adds pipe ONLY "Y\n" — a leading n makes the enable prompt cancel.
   Smoke-test before registering with an MCP initialize JSON-RPC line.
2. New section "PyPI-missing package → clone + venv pattern": git clone --depth 1,
   uv venv + uv pip install from requirements.txt, smoke-test, register with
   ABSOLUTE venv python path. Verify tools/list — serverInfo.name can be
   mislabeled upstream (pandas-mcp-server reports "Excel-MCP-Server").
3. New section "Enabling a disabled entry": no `hermes mcp enable` subcommand;
   `hermes mcp configure` needs interactive TTY; fix = remove + re-add.
4. Pitfalls: add stdio-vs-remote pipe-shape mismatch; serverInfo mislabel.
5. References: point to `references/recipes-batch2.md`.
