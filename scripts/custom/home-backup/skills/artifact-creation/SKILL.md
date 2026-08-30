---
name: artifact-creation
description: Create live HTML/SVG/React artifacts that render in chat.
version: 1.0.0
author: Parionyx
license: MIT
metadata:
  hermes:
    tags: [artifacts, desktop, react, html]
    category: creative
---

# Artifact Creation Skill

Produce interactive artifacts — HTML pages, SVG graphics, React components —
that open as live previews beside the chat and can be pushed to GitHub.

## When to Use

- The user asks for a dashboard, demo page, timer, game, or visual tool.
- A diagram/graphic is better standalone than inline.
- Iterating on a UI idea with the user.

## Prerequisites

- Desktop app for live preview (fences still work everywhere as code).
- No network access inside artifact iframes — everything must be inlined;
  use system fonts and vanilla JS/React only.

## How to Run

Emit ONE fenced block; the desktop promotes it automatically:

- ` ```html ` — full document (≥160 chars) or large fragment → live iframe.
- ` ```svg ` — ≥2000 chars → sanitized graphic view.
- ` ```jsx / ```tsx ` — component-shaped code (a component definition AND
  JSX markup) → runs on embedded React 18 + Babel.

Give every artifact a `<title>` (html) or clear component name (react) —
the title names the card and version history groups by it.

React convention:

```tsx
export default function Counter() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>{n}</button>
}
```

`export default` is captured automatically and mounted. Named exports also
work (`export const Card = ...`). Errors render inside the frame — read
them there when the user reports a blank pane.

## Quick Reference

| Kind | Promotes when | Renders |
|------|---------------|---------|
| html | doc ≥160c / fragment ≥1200c | sandboxed iframe |
| svg | ≥2000 chars | sanitized inline/pane |
| jsx/tsx | component + JSX | React runtime iframe |

## Procedure

1. Write the artifact in ONE fence (no prose splitting it).
2. Iterate by re-emitting the SAME title — versions stack with a stepper.
3. After finishing substantial work, persist it:
   - Desktop session: call `save_artifact_github(title, content, kind)`.
   - Any other surface: MCP `save_artifact(title, content, kind)`.
4. Tell the user the GitHub URL returned.

## Pitfalls

- **HARD RULE: an artifact is ALWAYS one fenced code block** — ` ```html `,
  ` ```svg `, ` ```jsx `, or ` ```tsx `. NEVER emit artifact code as bare text
  or prose. An unfenced HTML blob renders as unreadable plain text in chat and
  never becomes an artifact. Open the fence, write the code, close the fence.
- External CDN scripts/fonts will not load offline — inline everything.
- Tiny snippets stay plain code cards; do not force artifact size padding.
- Do not put secrets in artifacts; they get pushed to GitHub.
- tsx types are stripped by Babel at render time — keep them light.

## Verification

Open the card: rendered/source toggle works, version stepper shows history,
and after persistence `/sync-github status` lists the push.
