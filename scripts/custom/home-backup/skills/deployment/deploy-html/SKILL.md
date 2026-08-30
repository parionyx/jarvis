---
name: deploy-html
description: Basic deploy=GitHub Pages, hard deploy=Cloudflare Pages.
version: 1.0.0
author: JARVIS
license: MIT
metadata:
  hermes:
    tags: [deployment, html, github-pages, cloudflare]
    related_skills: [artifact-creation]
---

# Deploy Static HTML — Basic vs Hard

## When to Use
Use when user says "basic deploy" / "deploy kr de" (→ GitHub Pages) or "hard deploy" (→ Cloudflare Pages) for any static HTML artifact/file and wants a public shareable link.

## Trigger
- **"basic deploy" / "deploy kr de" (basic)** → deploy to **GitHub Pages** (already verified, no extra auth needed).
- **"hard deploy"** → deploy to **Cloudflare Pages** (faster CDN, unlimited sites). Requires one-time Cloudflare account link before first use.

## Prereqs (verify first)
- `gh auth status` must show logged-in account (currently `parionyx`). If not, stop and tell user to login.
- For hard deploy: Cloudflare account MUST be linked once. If not linked, run `setup_mcp(server="cloudflare", action="install")` OR have user connect repo in Cloudflare dashboard. Do NOT attempt hard deploy without this.

---

## BASIC → GitHub Pages (verified working)

1. Set up temp dir + copy HTML as `index.html`:
   ```
   WORK="$HOME/deploy_tmp/<name>"; rm -rf "$WORK"; mkdir -p "$WORK"
   cp "/path/to/file.html" "$WORK/index.html"
   cd "$WORK"
   git init -q
   git config user.email "jarvis@parionyx.local"; git config user.name "JARVIS"
   git add index.html; git commit -q -m "<name>"
   ```
2. Create public repo + push (creates `master` branch):
   ```
   gh repo create <name> --public --description "<desc>" --source . --push
   ```
3. **Rename to main + push** (Pages API requires `main`, not `master` — skipping this gives HTTP 422):
   ```
   git branch -m master main
   git push -u origin main
   ```
4. Enable GitHub Pages:
   ```
   gh api repos/parionyx/<name>/pages -f source[branch]=main -f source[path]=/ -X POST
   ```
5. **Public link:** `https://parionyx.github.io/<name>/`
6. **Verify** (first build takes 30–60s; ignore curl "write of N bytes" local-buffer error if HTTP 200):
   ```
   sleep 30; curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://parionyx.github.io/<name>/
   ```

### Pitfalls (GitHub Pages)
- `gh repo create` default branch is `master` → Pages 422 unless renamed to `main`.
- Repo name = lowercase-hyphen only.
- HTTP 200 = live even if curl prints a write-error on the body.

---

## HARD → Cloudflare Pages

**One-time prereq:** Cloudflare account linked (via `setup_mcp` cloudflare, or user connects GitHub in Cloudflare dashboard).

**RECOMMENDED — API Token method (verified working, headless-safe):**
OAuth callback fails in non-interactive/Windows PTY env (wrangler login --no-browser times out + UV assertion crash). Use API token instead:
1. User generates token: dash.cloudflare.com/profile/api-tokens → Create Token → template "Edit Cloudflare Workers" (or custom: Account:Cloudflare Pages:Edit + Account Settings:Read). Copy `cf_...` token.
2. Set env + deploy (no OAuth needed):
   ```
   export CLOUDFLARE_API_TOKEN="<token>"
   cd <dir-with-index.html>
   npx --yes wrangler@latest pages deploy . --project-name <name>
   ```
3. Links returned: `https://<name>.pages.dev` (alias) + `https://<hash>.<name>.pages.dev` (deploy). Verify with `curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://<name>.pages.dev` (HTTP 200 = live; ignore curl "write of N bytes" local-buffer error).

Then either:

**Option A — Dashboard (simplest, no token):**
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect GitHub repo `<name>`.
2. Framework preset: `None`. Build command: leave empty. Build output / publish directory: `/` (or `.`).
3. Deploy → get `https://<name>.pages.dev`.

**Option B — Wrangler CLI (needs `CLOUDFLARE_API_TOKEN` env):**
```
npx wrangler pages deploy <dir-with-index.html> --project-name <name>
```

**Verify:**
```
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://<name>.pages.dev
```

### Notes (Cloudflare)
- Free tier: **unlimited sites, unlimited bandwidth** — user can host 100+ artifacts.
- Faster global CDN than GitHub Pages.
- Custom domain free if user wants later.

---

## Final report to user
Always return the **public URL** + which host + verification status (HTTP 200). If verification fails, say so honestly and give the repo/dashboard link so user can check build status.
