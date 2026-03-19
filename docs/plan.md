# Implementation Plan
## Project: English Conversation Practice (OpenRouter Prototype)

## 0) Implementation Principles
- Keep repo minimal and test-focused.
- No backend, no DB, no auth.
- Frontend-only OpenRouter integration.
- One default free model config.

---

## 1) Current Architecture

Implemented structure:
- `src/App.tsx` (4-column dashboard + conversation state)
- `src/components/ResultPanel.tsx`
- `src/lib/openrouter.ts`
- `src/lib/prompt.ts`
- `src/lib/conversationPrompt.ts`
- `src/lib/parser.ts`
- `src/lib/tts.ts` (frontend TTS playback service)
- `src/types/evaluation.ts`
- `server/tts.ts` (shared Edge TTS synthesis logic)
- `api/tts.ts` (Vercel serverless function for TTS)
- `public/sample/index.json` + topic scenario files

---

## 2) Types & Contracts

Create `EvaluationResult` type:

- `is_match: boolean`
- `score_topic: number`
- `score_context: number`
- `score_character: number`
- `score_prev_reply_relevance: number`
- `feedback_short_vi: string`
- `suggested_bot_reply_en: string`
- `next_action: "continue" | "redirect"`

Define `EvaluationInput`:
- `topic`
- `context`
- `character`
- `prevBotLine`
- `userResponse`

Define `ConversationSetup`:
- `topic`
- `context`
- `character`
- `openingBotLine`

---

## 3) Prompt Design

Implemented prompt layers:
- `src/lib/prompt.ts` for evaluator JSON response
- `src/lib/conversationPrompt.ts` for next bot action
  - pass path: next follow-up question
  - fail path: supportive redirect reply

---

## 4) OpenRouter Client

Implemented in `src/lib/openrouter.ts`:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Env model override: `VITE_OPENROUTER_MODEL`
- Missing endpoint fallback across model list
- API key read from env: `VITE_OPENROUTER_API_KEY`
- HTTP error handling and friendly messages

---

## 5) Safe JSON Parsing Layer

Implement `src/lib/parser.ts`:
1. Try direct `JSON.parse`.
2. If failed, attempt extraction from fenced block.
3. Validate required keys and primitive types.
4. Return either:
   - typed `EvaluationResult`
   - parse error + raw content fallback.

---

## 6) UI Implementation

Implemented dashboard columns:
- Column 1: scenario list (topic open/close, create scenario)
- Column 2: overview (topic/context/character/session stats)
- Column 3: chat (mic button, real-time transcription, bot/user turns)
- Column 4: score panel (latest evaluation)

Result rendering:
- Match badge
- Score bars
- Vietnamese feedback
- Suggested bot reply
- Parse warning fallback

---

## 7) Speech-to-Text (Soniox)

Implemented with `@soniox/react` SDK:
- Mic toggle button replaces the text input area in the chat column.
- Click to start recording (`isRecording = true`), browser requests mic permission.
- Real-time transcription displayed as a live user chat bubble.
- Click again to stop (`isRecording = false`), final transcript submitted to evaluation pipeline.
- Soniox API key read from env: `VITE_SONIOX_API_KEY`.

---

## 7) State & UX

In `App.tsx`:
- Scenario click auto-starts conversation
- User Enter key auto-triggers evaluate action
- End conversation and clear actions
- Independent column scrolling with full-screen layout

---

## 8) Environment & Configuration

- `VITE_OPENROUTER_API_KEY` required
- `VITE_OPENROUTER_MODEL` optional override
- Do not commit real keys
- `.env.example` documented

---

## 9) Basic Test Checklist (Manual)

1. Scenario click starts conversation and bot opening line appears.
2. Enter key evaluates user input.
3. Normal input returns parsed result and auto bot next line.
4. Non-JSON response triggers raw fallback.
5. Missing env key shows readable error.
6. Build passes: `npm run build`.

---

## 10) Vercel Deployment Steps

1. Push repo to GitHub.
2. Import project in Vercel.
3. Framework preset: Vite.
4. Add env vars:
  - `VITE_OPENROUTER_API_KEY`
  - `VITE_OPENROUTER_MODEL` (optional)
  - (No env var needed for Edge TTS — it is free and keyless)
5. Deploy.
6. Verify `/api/tts` serverless function works on production URL.
7. Run smoke test on production URL.

---

## 11) Milestones

### M1 (Day 1)
- Scaffold app
- Build form + local state
- Add static result mock

### M2 (Day 2)
- OpenRouter integration
- Prompt builder
- Parsing + error handling

### M3 (Day 3)
- Polish UI
- Add sample test payload
- Vercel deployment + README

---

## 12) Definition of Done

- User can select scenario and start chat immediately.
- User can continue multi-turn evaluation with Enter-triggered evaluation.
- Scores and feedback are rendered in dedicated score column.
- Full-screen 4-column layout with column-level scrolling works.
- Bot messages are spoken aloud via Edge TTS (auto-play, replay button, mute toggle).
- Build succeeds and app is deployable on Vercel.

---

## 13) Text-to-Speech (Edge TTS)

Implemented using `msedge-tts` package (free, no API key required).

### Architecture
- **Vercel serverless function** (`api/tts.ts`): accepts POST `{ text, voice? }`, returns `audio/mpeg`.
- **Vite dev middleware**: custom plugin in `vite.config.ts` intercepts `/api/tts` locally so `npm run dev` works without `vercel dev`.
- **Shared synthesis module** (`server/tts.ts`): both the Vercel function and Vite plugin import the same core logic.
- **Frontend service** (`src/lib/tts.ts`): `speak()`, `stopSpeaking()`, mute-aware playback via HTML5 Audio API.

### Behaviour
- Default voice: `en-US-AriaNeural`.
- Auto-play every bot message (opening line + follow-ups).
- Replay button (speaker icon) on each bot chat bubble.
- Global mute toggle in chat header, persisted in `localStorage`.
- TTS cancelled when user starts recording or ends/clears conversation.
- Errors are logged silently — TTS failure never blocks the conversation flow.