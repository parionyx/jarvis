---
name: self-learning-system
description: How this install learns from experience into reusable skills.
version: 1.0.0
author: Parionyx
license: MIT
metadata:
  hermes:
    tags: [learning, skills, experience]
    category: productivity
---

# Self-Learning System Skill

This install turns successful unfamiliar work into durable skills — and
expects you to check those skills before re-solving old problems.

## When to Use

- Starting a task you (or a past session) may have done before → FIRST run
  `search_files` over `HERMES_HOME/skills/` or recall matching skills.
- The user says "yaad rakhna", "remember this", or asks what you learned.
- You just finished something non-obvious → offer/do a capture.

## Prerequisites

- `skill_manage` for creating/updating skills (always available).
- `experience-curator` plugin enabled (it is, in config.yaml).

## How to Run

Three capture paths exist — pick per situation:

1. **Automatic** — after each completed session the plugin reviews the
   transcript (once per 6h) and saves novel procedures itself. Do nothing;
   it reports via logs. Check with `/experience status`.
2. **In-session** — user asks mid-chat: distill now via `skill_manage`
   (see `/capture-session` skill for the exact procedure).
3. **Manual review** — `/experience now` forces a review of the last
   completed session.

## Quick Reference

| Command | Effect |
|---------|--------|
| `/capture-session` | Distill THIS conversation's approach into a skill |
| `/experience status` | Last capture time + result + latest skill |
| `/experience now` | Force-review the last completed session |
| `/sync-github status` | Confirm captured skills were pushed to GitHub |

## Procedure

When capturing yourself:

1. Identify goal, failed approaches, and THE approach that worked
   (commands, orderings, file paths, gotchas).
2. One capability per skill; extend an existing match instead of duplicating
   (`skill_manage action="edit"`).
3. Create with full SKILL.md: frontmatter (`name`, `description` ≤60 chars,
   `version`, `author`) + When to Use / Prerequisites / How to Run /
   Quick Reference / Procedure / Pitfalls / Verification.
4. Confirm to the user: name + when it will auto-fire.

## Pitfalls

- Never store secrets/tokens in skills.
- Descriptions drive auto-recall — make them precise, not generic.
- Session-specific one-offs have no repeat value; skip them.

## Verification

After capture: `skills_list` shows the new skill; `/sync-github status`
shows its push; next similar task should load it by description match.
