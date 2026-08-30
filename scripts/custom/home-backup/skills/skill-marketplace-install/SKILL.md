---
name: skill-marketplace-install
description: "Use when installing third-party agent skills from GitHub."
version: 1.0.0
---

# Installing External Agent Skills

## Preferred path: `npx skills add`

```bash
cd "$HOME"
npx -y skills add https://github.com/<org>/<repo> --skill <name> [-y]
# multiple skills from same repo:
npx -y skills add https://github.com/anthropics/skills --skill mcp-builder --skill canvas-design --skill frontend-design -y
```

- Installs to `~/.agents/skills/<name>/` and auto-symlinks into `~/.hermes/skills/` (detected as "Hermes Agent" host, non-interactive when agent detected).
- Verify: `ls ~/.agents/skills`, `head SKILL.md` of each, and `hermes skills list | tail` for counts.

## Pitfalls

- **Skill names often differ from README/blog claims.** If `--skill X` fails with "No matching skills found", the CLI prints the repo's ACTUAL available skills — install from that list, never guess names again. (e.g. user-requested `canva-translate-design` / `canva-branded-presentation` did not exist in canva-sdks/canva-claude-skills; real set: brand-check, bulk-create, edit-design, design-feedback, implement-feedback, resize-for-social-media.)
- Repo short URLs work (`https://github.com/org/repo`); no `.git` needed.
- Windows/git-bash: symlinks appear as `name -> /c/Users/<u>/.agents/skills/name` inside `$LOCALAPPDATA/hermes/skills/`.

## Hub path (curated catalog)

```bash
hermes skills tap add <org>/<repo>   # add source
hermes skills search <query>         # browse (clawhub/skills.sh sources included)
hermes skills install <identifier>
```

Hub installs are PROTECTED (do not edit their content later).

## Ownership rule

Skills installed this way at the user's request are **user-owned** — do not patch/edit them autonomously; report issues and suggest `hermes curator adopt <name>` instead.
