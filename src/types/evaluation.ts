export interface EvaluationInput {
  topic: string;
  context: string;
  character: string;
  prevBotLine: string;
  userResponse: string;
}

export interface ConversationSetup {
  topic: string;
  context: string;
  character: string;
  openingBotLine: string;
}

export interface EvaluationResult {
  is_match: boolean;
  score_topic: number;
  score_context: number;
  score_character: number;
  score_prev_reply_relevance: number;
  feedback_short_vi: string;
  suggested_user_reply_en: string;
  next_action: "continue" | "redirect";
  next_bot_line?: string;
}

export interface ParseSuccess {
  ok: true;
  data: EvaluationResult;
}

export interface ParseError {
  ok: false;
  error: string;
  raw: string;
}

export type ParseResult = ParseSuccess | ParseError;
