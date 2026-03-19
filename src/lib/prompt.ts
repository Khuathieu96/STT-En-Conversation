import type { EvaluationInput } from "../types/evaluation";

type ChatMessage = { role: "bot" | "user"; text: string };

function renderTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role === "bot" ? "Bot" : "User"}: ${m.text}`).join("\n");
}

export function buildCombinedPrompt(input: EvaluationInput & {
  chatHistory: ChatMessage[];
}): string {
  return `You are a dialogue evaluator AND conversation bot for an English-learning practice app (for Vietnamese users).

Scenario:
- Topic: ${input.topic}
- Context: ${input.context}
- Character: ${input.character}

Conversation so far:
${renderTranscript(input.chatHistory)}

Previous bot line: ${input.prevBotLine}
User response: ${input.userResponse}

Do TWO things in ONE JSON response:

1) EVALUATE whether the user response fits the topic, context, character, and previous bot line. Score each 0-1. Be lenient for grammar mistakes.

2) Write the bot's NEXT line in English (1-2 sentences). If the response fits (is_match=true), ask a natural follow-up. If it doesn't fit, gently redirect the learner.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "is_match": boolean,
  "score_topic": number,
  "score_context": number,
  "score_character": number,
  "score_prev_reply_relevance": number,
  "feedback_short_vi": "Brief feedback in Vietnamese (1-2 sentences)",
  "suggested_user_reply_en": "A better user reply in English (1 sentence)",
  "next_action": "continue" | "redirect",
  "next_bot_line": "The bot's next line in English (1-2 sentences)"
}`;
}

// Keep the old prompt for backward compatibility if needed
export function buildPrompt(input: EvaluationInput): string {
  return buildCombinedPrompt({ ...input, chatHistory: [] });
}
