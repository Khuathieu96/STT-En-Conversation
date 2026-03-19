import type { ConversationSetup } from "../types/evaluation";

type ChatMessage = {
  role: "bot" | "user";
  text: string;
};

function renderTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role === "bot" ? "Bot" : "User"}: ${m.text}`).join("\n");
}

export function buildNextQuestionPrompt(args: {
  setup: ConversationSetup;
  messages: ChatMessage[];
  latestUserLine: string;
}): string {
  const { setup, messages, latestUserLine } = args;

  return `You are roleplaying as the conversation bot for an English-learning practice app.

Goal: continue the conversation naturally after a user response that passed evaluation.

Scenario:
- Topic: ${setup.topic}
- Context: ${setup.context}
- Character: ${setup.character}

Conversation so far:
${renderTranscript(messages)}

Latest user line:
${latestUserLine}

Write the bot's NEXT line in English.
Rules:
- Keep it short (1-2 sentences).
- Ask a natural follow-up question.
- Stay in character and in topic.
- Learner-friendly, clear English.
- Return ONLY the next bot line as plain text.`;
}

export function buildRedirectReplyPrompt(args: {
  setup: ConversationSetup;
  messages: ChatMessage[];
  latestUserLine: string;
  evaluationSuggestedUserReply: string;
  feedbackVi: string;
}): string {
  const { setup, messages, latestUserLine, evaluationSuggestedUserReply, feedbackVi } = args;

  return `You are roleplaying as the conversation bot for an English-learning practice app.

Goal: the user response did NOT fit the scenario. Reply in English to gently redirect the learner.

Scenario:
- Topic: ${setup.topic}
- Context: ${setup.context}
- Character: ${setup.character}

Conversation so far:
${renderTranscript(messages)}

Latest user line:
${latestUserLine}

Evaluator hints:
- Vietnamese feedback: ${feedbackVi}
- Suggested better user reply: ${evaluationSuggestedUserReply}

Write the bot's NEXT line in English.
Rules:
- Keep it short (1-2 sentences).
- Be supportive.
- Redirect with a clear question so the learner can answer close to the suggested better user reply.
- Stay in character.
- Return ONLY the next bot line as plain text.`;
}
