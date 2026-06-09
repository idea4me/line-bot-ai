import { AnswerSource, TokenUsage } from "@/types/faq";

type ConversationLog = {
  timestamp: string;
  userId?: string;
  question: string;
  answer: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
  sourceUsed: AnswerSource;
  replyOk?: boolean;
};

export function logConversation(entry: ConversationLog) {
  console.log(JSON.stringify({ type: "conversation", ...entry }));
}

export function logGeminiUsage(data: {
  finishReason?: string;
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}) {
  console.log(JSON.stringify({ type: "gemini_usage", ...data }));
}

export function logInfo(context: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ type: "info", context, ...data }));
}

export function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ type: "error", context, message }));
}

export function logWarning(context: string, data?: Record<string, unknown>) {
  console.warn(JSON.stringify({ type: "warning", context, ...data }));
}
