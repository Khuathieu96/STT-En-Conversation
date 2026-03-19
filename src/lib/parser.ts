import type { EvaluationResult, ParseResult } from "../types/evaluation";

const REQUIRED_KEYS: (keyof EvaluationResult)[] = [
  "is_match",
  "score_topic",
  "score_context",
  "score_character",
  "score_prev_reply_relevance",
  "feedback_short_vi",
  "suggested_user_reply_en",
  "next_action",
];

function validate(obj: Record<string, unknown>): EvaluationResult {
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      throw new Error(`Missing required key: ${key}`);
    }
  }

  if (typeof obj.is_match !== "boolean") {
    throw new Error("is_match must be boolean");
  }

  for (const scoreKey of ["score_topic", "score_context", "score_character", "score_prev_reply_relevance"] as const) {
    const v = obj[scoreKey];
    if (typeof v !== "number" || v < 0 || v > 1) {
      throw new Error(`${scoreKey} must be number between 0 and 1`);
    }
  }

  if (typeof obj.feedback_short_vi !== "string") {
    throw new Error("feedback_short_vi must be string");
  }
  if (typeof obj.suggested_user_reply_en !== "string") {
    throw new Error("suggested_user_reply_en must be string");
  }
  if (obj.next_action !== "continue" && obj.next_action !== "redirect") {
    throw new Error("next_action must be continue or redirect");
  }

  return obj as unknown as EvaluationResult;
}

function tryParseJSON(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }

  const braces = raw.match(/\{[\s\S]*\}/);
  if (braces) {
    return JSON.parse(braces[0]);
  }

  throw new Error("No valid JSON found in response");
}

export function parseEvaluation(raw: string): ParseResult {
  try {
    const obj = tryParseJSON(raw.trim());
    const data = validate(obj);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown parse error",
      raw,
    };
  }
}
