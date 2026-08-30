---
name: interactive-chat-widgets
description: Use buttons and forms to interact with the user in chat.
version: 1.0.0
author: Parionyx
license: MIT
metadata:
  hermes:
    tags: [desktop, ui, interaction]
    category: productivity
---

# Interactive Chat Widgets Skill

Render clickable buttons and typed forms inside the desktop chat instead of
asking the user to type everything.

## When to Use

- Offering next-step choices after completing work → `show_buttons`.
- Building a menu of recurring quick actions for the user → `show_buttons`.
- Collecting several structured inputs (contact info, filters, config) → `show_form`.
- A blocking decision question with few options → `clarify` instead.

## Prerequisites

- Hermes Desktop app (GUI session). On CLI/messaging surfaces these tools
  are absent — fall back to numbered text options.
- Check availability implicitly: if the tool schema is not loaded, you are
  not on a GUI surface.

## How to Run

```python
# Persistent quick actions (non-blocking)
show_buttons(
    prompt="What next?",
    buttons=[
        {"label": "Deploy", "message": "Deploy to staging", "style": "primary"},
        {"label": "Show diff first", "message": "Show me the git diff"},
        {"label": "Cancel", "style": "destructive"},
    ],
    note="Clicks arrive as your next message.",
)
```

```python
# Blocking structured input
show_form(
    title="New workspace",
    fields=[
        {"name": "name", "label": "Workspace name", "type": "text", "required": True},
        {"name": "tier", "label": "Tier", "type": "select", "options": ["free", "pro"]},
        {"name": "count", "label": "Seats", "type": "number", "default": 3},
        {"name": "notify", "label": "Email me updates", "type": "checkbox"},
    ],
    submit_label="Create",
)
```

## Quick Reference

| Tool | Blocks? | Best for |
|------|---------|----------|
| `show_buttons` | No | Menus, next steps, confirmations |
| `show_form` | Yes | Multi-field structured input |
| `clarify` | Yes | One decision, few choices |

## Procedure

1. Finish the work first; buttons usually accompany a completed result.
2. Write each button's `message` as a self-contained instruction you could
   execute on receipt ("Deploy to staging", not "yes").
3. For forms keep 2-6 fields; mark only truly required ones.
4. After form results return, act on them immediately in the same turn.

## Pitfalls

- Do not use `show_form` when one `clarify` question would do.
- Button labels ≤ ~30 chars; put detail in `message`, not `label`.
- Buttons do NOT pause your turn — finish your reply normally after calling.

## Verification

The widget renders inline under your message. If the tools are missing from
your schema, this is a non-GUI session — use plain text options instead.
