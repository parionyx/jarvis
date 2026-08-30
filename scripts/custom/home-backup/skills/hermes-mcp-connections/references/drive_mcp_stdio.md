# Drive a registered MCP server manually over stdio

Use when a server shows `✓ enabled` in `hermes mcp list` AND passes `hermes mcp test <name>`
(tools discovered) — but calling `mcp__<server>__<tool>` directly fails with
**"not a deferrable tool" / "not in model-facing tools list"**. Hermes only injects MCP
tools into the live tool registry of a *new session*; the current session never received them.

Two options:
1. **Restart the session/app** — cleanest; tools then load normally. Preferred when interactive.
2. **Drive the server manually** (this file) — spawn it yourself and speak MCP over stdio.

Validated 2026-08-24 on `weather` (`@dangahagan/weather-mcp`, v1.23.0) — successfully returned
live Open-Meteo current conditions, alerts, and 7-day forecast for Gurgaon (28.4595, 77.0266).

## CRITICAL framing rule (cost me several attempts)
MCP **stdio transport uses NDJSON** (newline-delimited JSON), NOT HTTP-style headers.
- ✅ Send each message as `JSON.stringify(msg) + "\n"`.
- ❌ Do NOT send `Content-Length: N\r\n\r\n{...}`. The server logs "X MCP Server started" to
  stderr, emits **0 bytes** on stdout, and `initialize` hangs forever (timeout 124). This is a
  protocol-correctness rule, not a quirk.

## Windows gotcha (cost me several attempts)
Spawning `npx` or `npx.cmd` from a Node `child_process` (`spawn('npx', ...)`, or via
`cmd.exe /c npx.cmd`) breaks stdio piping on this host: server starts, logs to stderr, but
writes **0 bytes** to stdout → `initialize` never resolves. Fix: run the **cached package
entry point directly** with the system `node.exe`.

Steps:
1. Warm the npx cache once (foreground terminal): `npx -y @dangahagan/weather-mcp --help`
   (or `timeout 150 npx -y <pkg> --help`).
2. Find the cache dir:
   `find "$LOCALAPPDATA/npm-cache/_npx" "$HOME/.npm/_npx" -maxdepth 4 -type d -iname "*<pkg>*"`
   → e.g. `C:\Users\works_ar\AppData\Local\npm-cache\_npx\98658f44c8b2ba69\node_modules\@dangahagan\weather-mcp`
3. Read `package.json` for the entry (`"main": "dist/index.js"`, `"type": "module"`).
4. Spawn `node.exe` (absolute path, e.g. `C:\Program Files\nodejs\node.exe`) with
   `dist/index.js` as the first arg, `cwd` = the package dir. Use `shell: false`.

## Working bridge (Node, ESM server)
```js
const { spawn } = require('child_process');
const CACHE_DIR = 'C:\\Users\\works_ar\\AppData\\Local\\npm-cache\\_npx\\98658f44c8b2ba69\\node_modules\\@dangahagan\\weather-mcp';
const NODE = 'C:\\Program Files\\nodejs\\node.exe';

const proc = spawn(NODE, ['dist/index.js'], { stdio: ['pipe','pipe','pipe'], cwd: CACHE_DIR, env: process.env });

function send(msg) { proc.stdin.write(JSON.stringify(msg) + '\n'); }   // NDJSON, NOT Content-Length

let buf = '';
const pending = {};
let msgId = 0;
proc.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
    if (!line) continue;
    try { const msg = JSON.parse(line); if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; } }
    catch (e) { /* ignore */ }
  }
});
proc.stderr.on('data', (d) => process.stderr.write('[mcp-stderr] ' + d));
setTimeout(() => { proc.kill(); process.exit(2); }, 55000);  // safety net

function rpc(method, params) {
  return new Promise((resolve) => { const id = ++msgId; pending[id] = resolve; send({ jsonrpc: '2.0', id, method, params }); });
}

(async () => {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'jarvis', version: '1.0' } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const lat = 28.4595, lon = 77.0266;
  const cur = await rpc('tools/call', { name: 'get_current_conditions', arguments: { latitude: lat, longitude: lon } });
  console.log(extractText(cur.result ?? cur.error));
  proc.kill(); process.exit(0);
})();

function extractText(result) {
  if (!result) return '(no result)';
  if (result.content && Array.isArray(result.content)) return result.content.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n');
  return JSON.stringify(result, null, 2);
}
```
Run: `cd /c/jarvis && node weather_mcp_test.js`

## Stormcast / checklist for next time
- [ ] `hermes mcp list` → `✓ enabled`? `hermes mcp test <name>` → tools discovered?
- [ ] Direct `mcp__server__tool` call: "not a deferrable tool" → restart OR manual drive.
- [ ] Manual drive → NDJSON framing (`+ "\n"`), direct `node dist/index.js`, NOT npx wrapper.
- [ ] Weather MCP specifics: India has no alerts (US/CA/EU only); data source is Open-Meteo (model-interpolated).
