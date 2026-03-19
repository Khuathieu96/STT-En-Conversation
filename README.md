# English Conversation Practice

Vite + React + TypeScript prototype for scenario-based English conversation practice with OpenRouter evaluation.

## Current Features

- 4-column full-screen dashboard:
	- Scenario list
	- Overview
	- Chat
	- Scores
- Topic folders with open/hidden state
- Scenario click starts conversation immediately
- Enter key triggers evaluation (Shift+Enter for newline)
- Auto next bot line:
	- Pass => follow-up question
	- Redirect => supportive corrective reply
- Safe JSON parser with fallback warning view

## Environment

Create `.env` from `.env.example` and set:

```env
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

`VITE_OPENROUTER_MODEL` is optional.
If omitted, the app now defaults to a free OpenRouter model.

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

- Deploy as static Vite app on Vercel
- Set `VITE_OPENROUTER_API_KEY` in Vercel environment variables
