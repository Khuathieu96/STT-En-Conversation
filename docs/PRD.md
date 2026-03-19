# Product Requirements Document (PRD)
## Project: English Conversation Practice (OpenRouter Prototype)
## Date: 2026-03-18
## Owner: ceuli-khuat_Vatech

---

## 1) Objective

Build a minimal React web app to validate conversation-practice logic using OpenRouter with an evaluator and automatic next bot turn generation.

This is an MVP/prototype for testing only:
- No backend API endpoint
- No database
- No authentication
- Vercel-ready frontend deploy

---

## 2) Scope

### In Scope
- React frontend-only app
- Scenario-driven conversation flow
- Scenario library grouped by topics
- Click scenario to start conversation immediately
- 4-column dashboard UI:
  - Column 1: scenario list
  - Column 2: overview
  - Column 3: chat
  - Column 4: scores
- Auto-evaluate user line on Enter
- Auto-generate next bot line:
  - If pass: follow-up question
  - If fail: supportive redirect reply
- Structured score rendering and parse fallback
- Create scenario dialog and save sample index via browser file system API
- Text-to-Speech bot voice playback via Edge TTS

### Out of Scope
- Persistent DB storage
- Auth/user accounts
- Advanced analytics

---

## 3) Core User Flow

1. User opens app.
2. User selects a scenario from list.
3. App auto-starts conversation with opening bot line.
4. User clicks the mic button to start recording (browser requests microphone permission if needed).
5. Real-time transcription appears as a user message bubble in the chat while recording.
6. User clicks mic button again to stop recording; the final transcription is submitted as the user's line.
7. App evaluates the line with OpenRouter.
8. App displays structured score result.
9. App auto-generates the next bot message based on pass/fail.
10. User continues until ending conversation.

---

## 4) Functional Requirements

### FR-1: Scenario Library
- Topic folders can be expanded/collapsed.
- Scenario names are shown as readable labels.
- Selecting a scenario starts a new conversation state.

### FR-2: Conversation Dashboard
- Full-screen layout with four columns.
- Each column scrolls independently.
- Page-level scrolling is disabled on desktop.

### FR-3: Evaluation
- Use `POST https://openrouter.ai/api/v1/chat/completions`.
- Structured JSON output fields:
  - `is_match`
  - `score_topic`
  - `score_context`
  - `score_character`
  - `score_prev_reply_relevance`
  - `feedback_short_vi`
  - `suggested_bot_reply_en`
  - `next_action`
- Safe parsing with fallback raw display.

### FR-4: Auto Next Bot Line
- If evaluation passes, generate a short follow-up question.
- If evaluation fails, generate a short redirect line.

### FR-5: Speech-to-Text Input (Soniox)
- Replace the text input area with a mic toggle button.
- Use `@soniox/react` SDK for real-time speech transcription.
- Soniox API key stored in environment variable `VITE_SONIOX_API_KEY`.
- Click mic button → `isRecording = true`, request microphone permission, begin real-time transcription.
- While recording, display interim transcription text inside a user chat bubble.
- Click mic button again → `isRecording = false`, finalize transcription, submit final text as user input to the evaluation pipeline.
- Handle microphone permission denial and transcription errors gracefully.

### FR-6: Configuration and Errors
- API key comes from environment variable `VITE_OPENROUTER_API_KEY`.
- Soniox API key comes from environment variable `VITE_SONIOX_API_KEY`.
- Handle missing key, HTTP errors, model endpoint unavailability, rate limit, and malformed output.

### FR-7: Text-to-Speech (Edge TTS)
- All bot messages (opening line and follow-ups) auto-play as audio using Edge TTS.
- Default voice: `en-US-AriaNeural`.
- Serverless endpoint `POST /api/tts` accepts `{ text, voice? }` and returns `audio/mpeg`.
- Replay button (speaker icon) on each bot chat bubble to re-play that message.
- Global mute toggle in chat header, persisted in `localStorage`.
- TTS playback cancels when user starts microphone recording or ends/clears conversation.
- No API key required — Edge TTS is free.
- TTS errors are handled silently; failure never blocks the conversation flow.

---

## 5) Non-Functional Requirements

- Minimal and responsive UI
- Fast local iteration
- No real key committed
- Vercel static deploy compatibility

---

## 6) Technical Constraints

- Stack: React + TypeScript + Vite
- AI provider: OpenRouter
- TTS: `msedge-tts` via Vercel serverless function + Vite dev middleware
- Configurable model via `VITE_OPENROUTER_MODEL`
- Fallback model strategy for endpoint downtime

---

## 7) Success Criteria

- Scenario click starts chat immediately.
- User can complete multi-turn evaluation loop.
- Score and feedback are visible for each evaluated turn.
- Bot messages play audio automatically via Edge TTS.
- Build and deploy work without backend (except Vercel serverless for TTS).

---

## 8) Risks & Mitigations

- Model endpoint downtime:
  - Mitigation: fallback model list and clear error messaging.
- Non-JSON evaluator output:
  - Mitigation: strict prompt + parser fallback extraction.
- Frontend key exposure:
  - Mitigation: test key only, rotation policy, no key in git.