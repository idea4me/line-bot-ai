export type FaqItem = {
  category: string;
  question: string;
  answer: string;
  keywords: string;
  last_update: string;
};

export type AnswerSource = "FAQ" | "KM" | "HELP" | "DEFAULT" | "ESCALATION";

export type TokenUsage = {
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

export type AnswerResult = {
  answer: string;
  confidence: number;
  finishReason?: string;
  tokenUsage?: TokenUsage;
  sourceUsed: AnswerSource;
};
