# English Conversation Practice

Vite + React + TypeScript prototype for scenario-based English conversation practice with OpenRouter evaluation.

## Current Features

- 4-column full-screen dashboard:
	- Scenario list
	- Overview
	- Chat (with voice input)
	- Scores
- Topic folders with open/hidden state
- Scenario click starts conversation immediately
- **Speech-to-Text input** via Soniox real-time transcription:
	- Mic button to start/stop recording
	- Live transcription shown as user chat bubble while speaking
	- Final transcript auto-submitted for evaluation on stop
- Auto next bot line:
	- Pass => follow-up question
	- Redirect => supportive corrective reply
- Safe JSON parser with fallback warning view
- **Text-to-Speech** via Edge TTS (`en-US-AriaNeural` voice):
	- Auto-play all bot messages (opening line + follow-ups)
	- Replay button (speaker icon) on each bot chat bubble
	- Global mute toggle in chat header, persisted in localStorage
	- TTS cancels when user starts recording

## Environment

Create `.env` from `.env.example` and set:

```env
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
VITE_SONIOX_API_KEY=your_soniox_key
```

`VITE_OPENROUTER_MODEL` is optional.
If omitted, the app now defaults to a free OpenRouter model.

For local development without Soniox billing, set:

```env
VITE_STT_PROVIDER=browser
```

This uses the browser Web Speech API instead of Soniox.

## Run

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Deploy

- Deploy as Vite app on Vercel (auto-detects `api/` folder for serverless functions)
- Set `VITE_OPENROUTER_API_KEY` in Vercel environment variables
- The `/api/tts` endpoint is deployed as a Vercel serverless function (no extra env var needed — Edge TTS is free)
