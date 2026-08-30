# Voice Config — exact commands + verified state

## TTS (verified working, free, no API key)
```bash
hermes config set tts.provider edge
hermes config set tts.edge.voice en-GB-RyanNeural
```
Verify the voice renders real audio:
```bash
cd "$LOCALAPPDATA/Temp"   # Windows scratch; native tools read this path
edge-tts --voice en-GB-RyanNeural --text "Good morning, sir. JARVIS online." --write-media jarvis_test.mp3
file jarvis_test.mp3      # -> MPEG ADTS, layer III, ~48 kbps, 24 kHz, Monaural
```
In-chat activation: `/voice on` (voice-to-voice), `/voice tts` (always speak), `/voice off`.

### TTS provider table (from hermes-agent config reference)
| Provider | Env var | Free? |
|---|---|---|
| Edge (default choice) | none | Yes |
| ElevenLabs | ELEVENLABS_API_KEY | Free tier (SILENT if missing) |
| OpenAI | VOICE_TOOLS_OPENAI_KEY | Paid |
| Gemini | GOOGLE_API_KEY | Free tier |
| MiniMax / Mistral / xAI / NeuTTS / Piper / KittenTTS (local) | varies / none | Paid / Free |

British voices worth knowing: `en-GB-RyanNeural` (used, JARVIS-like),
`en-GB-ThomasNeural` (deeper), `en-GB-AbbiNeural`, `en-GB-NoahNeural`.

## STT (verified enabled)
```bash
hermes config get stt     # enabled: true, provider: local
pip show faster-whisper   # 1.2.1 observed — required for local model
python -c "import sounddevice; print('mic OK')"   # mic reachable
```
Auto-detect priority: local faster-whisper → Groq (GROQ_API_KEY) →
OpenAI (VOICE_TOOLS_OPENAI_KEY) → Mistral Voxtral (MISTRAL_API_KEY).
Local model sizes: tiny, base, small, medium, large-v3 (config: `stt.local.model`).

## Hard rules
- Set config ONLY via `hermes config set section.key value`. Never hand-edit `config.yaml`.
- ElevenLabs as default with no key = silent assistant. Prefer `edge`.
