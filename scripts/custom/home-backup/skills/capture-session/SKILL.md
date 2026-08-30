---
name: capture-session
description: Distill this session's approach into a reusable skill.
version: 1.0.0
author: Parionyx
license: MIT
metadata:
  hermes:
    tags: [learning, self-improvement, skills]
    category: productivity
---

# Capture Session Skill

Capture what you just figured out as a durable, reusable skill so the next

(Note: the built-in `/learn` command covers "learn from X" — this skill is
for distilling the CURRENT conversation's successful approach.)
similar task starts from experience instead of scratch.

## When to Use

- The user asks you to "remember this", "learn this", or says "/learn".
- You solved something non-trivial through trial and error that a future
  session would otherwise rediscover slowly.
- An approach worked notably well (or failed in an instructive way).

Do NOT use for one-off personal tasks with no repeat value.

## Prerequisites

- The `skill_manage` tool must be available.
- The session must contain enough substance to distill (a real procedure,
  not a single trivial answer).

## How to Run

1. Review the conversation so far. Identify the goal, the approaches tried,
   and specifically the one that succeeded (commands, file paths, tool call
   sequences, ordering, gotchas hit).
2. Decide the skill boundary: ONE capability per skill. If several were
   learned, propose several skills and ask which to save (use `clarify` on
   GUI surfaces; otherwise list them in text).
3. Create it with `skill_manage(action="create", name=..., content=...)`.
4. Confirm to the user with the skill name and one line on when it will fire.

## Procedure

```python
skill_manage(
    action="create",
    name="kebab-case-skill-name",
    category="software-development",  # closest bundled category
    content=<full SKILL.md text>,
)
```

SKILL.md requirements (enforced by validation):

- Frontmatter: `name`, `description` (≤60 chars, one sentence, ends with
  a period), `version`, `author`.
- Body sections: intro, `## When to Use`, `## Prerequisites`,
  `## How to Run`, `## Quick Reference`, `## Procedure`, `## Pitfalls`,
  `## Verification`.
- Target ~100 lines. Concrete beats abstract: real commands, real paths.
- Reference native Hermes tools (`terminal`, `read_file`, `patch`) rather
  than shell utilities in prose.

If a matching skill already exists, use `skill_manage(action="edit")` to
refine it instead of creating a near-duplicate.

## Quick Reference

| Situation | Action |
|-----------|--------|
| New capability learned | `create` |
| Existing skill needs refinement | `edit` |
| Small correction | `patch` |

## Pitfalls

- Do not save secrets, API keys, or tokens into skills.
- Do not encode session-specific file paths unless they are stable project
  conventions.
- Do not create skills from tasks that fully match an existing skill —
  extend the existing one.
- Description length is validated hard (>60 chars is rejected).

## Verification

After creation, run `skill_manage(action="view", ...)` or `skills_list` to
confirm the skill exists, then tell the user how it will be recalled
(its description drives automatic loading in future sessions).
