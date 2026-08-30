# Cron subagent "Gemini returned HTTP 404"

Symptom: `cronjob(action='run')` (or a scheduled run) fails with
`RuntimeError: Gemini returned HTTP 404:` and 0 API calls. The job never runs.

## Root cause (verified)
The cron subsystem resolves its model INDEPENDENTLY of the live chat session.
If `model.default` in config points at a provider that has NO provider block
configured, the cron falls back to Gemini (because `GOOGLE_API_KEY` is set) and
404s — even though the interactive session runs fine on a different provider
(e.g. `9router/Jarvis`).

In the JARVIS case: `model.default: openai/gpt-oss-120b` but NO `openai`
provider block existed (only `9router`). Interactive chat worked (9router
routing layer); cron did not.

The `hermes model` CLI can mislead: it reported "Active provider: Google AI
Studio" while `model.default` was `9router/Jarvis` — trust config.yaml, not the
CLI summary.

## Fix
1. Point the default at the provider that actually works:
   ```bash
   hermes config set model.default 9router/Jarvis
   ```
   (substitute your real working provider/model).
2. **Remove and recreate** the cron — an existing job keeps a stale
   `model_snapshot` and FAILS CLOSED on next run (Hermes warns about this).
   Updating via `cronjob(action='update')` with model/provider does NOT pin it.

## Anti-patterns
- Pinning `delegation.model` / `delegation.provider` does NOT fix cron — cron
  reads `model.default`, not delegation.
- Do NOT attach browser/automation skills (e.g. `ads-performance-reporting`) to a
  text-only briefing cron — bloats the prompt and can trigger unwanted browser
  automation.

## Verify
Run the recreated job: `cronjob(action='run', job_id=<new>)`. Expect a real
briefing in the async result, not a Gemini 404.
