---
name: free-mcp-creative-stack
description: Free Pollinations image MCP; audio/video paid, npx no clone.
---

# Free MCP Creative Stack (No clone, no local server)

## Installed (Hermes MCP, npx-based)
- `pollinations` — `@pollinations/model-context-protocol`, env `POLLINATIONS_API_KEY=sk_...` (user key set in config).
  Tools: generateImage, generateImageUrl, sayText/respondAudio (audio), listAudioVoices, generateText, listImageModels.
- `social-media` — `social-media-manager-mcp` (npx). 8 tools: get_hashtag_strategy, build_content_calendar, get_caption_framework, get_posting_cadence, get_engagement_playbook, interpret_metric, get_client_report_template, get_full_pack.
- `xtapdown` — `xtapdown-mcp` (npx). 14 tools: X/Twitter hashtags by niche, viral tweet finder, search operators. Zero auth.

## HARD REALITY LIMITS (verified 2026-08-24)
- **IMAGE: FREE works** (flux model, anonymous OR key). `https://image.pollinations.ai/prompt/{urlencoded}?width=1024&height=1024&nologo=true&model=flux`
- **AUDIO: FAILS on free** — HTTP 402 Payment Required even with sk_ key. Audio is paid tier.
- **VIDEO: FAILS** — `/v1/video/generate` 404 NOT_FOUND even with key. Paid only.
- Canva + Figma MCPs already enabled for designing (OAuth, free tier) — graphic/UI design, NOT AI generation.

## How to use
- IMAGE: "image banao <prompt>" → if MCP loaded use generateImageUrl; else curl image.pollinations.ai endpoint directly and show via MEDIA: path.
- AUDIO: do NOT promise Pollinations. Use Hermes built-in `text_to_speech` tool (edge, hi-IN-SwaraNeural) — no MCP needed, free.
- VIDEO: not free. Suggest Comfy Cloud (paid) or local ComfyUI (GPU).
- Social hashtags: use social-media / xtapdown MCP tools after session restart.

## Re-add commands
```
printf 'Y\n' | hermes mcp add pollinations --command npx --args -y @pollinations/model-context-protocol --env POLLINATIONS_API_KEY=<KEY>
printf 'Y\n' | hermes mcp add social-media --command npx --args -y social-media-manager-mcp
printf 'Y\n' | hermes mcp add xtapdown --command npx --args -y xtapdown-mcp
```
`hermes mcp add` prompts interactively — pipe `Y\n` via printf. NEVER edit config.yaml directly (Hermes blocks agent writes to security config).

## Verification rule
Actually generate the asset and confirm file size > 0 + correct mime before claiming success. If audio/video 402/404, say so honestly — do not fake.
