import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callOpenRouter } from '../server/openrouter';

type ChatMessage = { role: 'bot' | 'user'; text: string };

type EvaluateRequestBody = {
  topic: string;
  context: string;
  character: string;
  prevBotLine: string;
  userResponse: string;
  chatHistory: ChatMessage[];
};

function buildPrompt(input: EvaluateRequestBody): string {
  const transcript = input.chatHistory
    .map((m) => `${m.role === 'bot' ? 'Bot' : 'User'}: ${m.text}`)
    .join('\n');

  return `You are a dialogue evaluator AND conversation bot for an English-learning practice app (for Vietnamese users).

Scenario:
- Topic: ${input.topic}
- Context: ${input.context}
- Character: ${input.character}

Conversation so far:
${transcript}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = (process.env.OPENROUTER_API_KEY ?? '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key is not configured on the server.' });
  }

  const body = req.body as Partial<EvaluateRequestBody>;
  const { topic, context, character, prevBotLine, userResponse, chatHistory } = body;

  if (!topic || !context || !character || !prevBotLine || !userResponse) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const prompt = buildPrompt({
      topic,
      context,
      character,
      prevBotLine,
      userResponse,
      chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
    });

    const raw = await callOpenRouter(apiKey, prompt);
    return res.status(200).json({ raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Evaluation failed.';
    return res.status(500).json({ error: message });
  }
}
