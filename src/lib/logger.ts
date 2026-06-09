import { AnswerSource, TokenUsage } from "@/types/faq";

type ConversationLog = {
  timestamp: string;
  userId?: string;
  question: string;
  answer: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
  sourceUsed: AnswerSource;
};

export function logConversation(entry: ConversationLog) {
  console.info(JSON.stringify({ type: "conversation", ...entry }));
}

export function logGeminiUsage(data: {
  finishReason?: string;
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}) {
  console.info(JSON.stringify({ type: "gemini_usage", ...data }));
}

export function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ type: "error", context, message }));
}
