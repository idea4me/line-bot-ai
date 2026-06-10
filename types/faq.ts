export type FaqItem = {
  category: string;
  question: string;
  answer: string;
  keywords: string;
  active: boolean;
};

export type AnswerSource = "FAQ" | "KM" | "HELP" | "COMBINED" | "DEFAULT";

export type TokenUsage = {
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

export type AnswerResult = {
  answer: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
  sourceUsed: AnswerSource;
  defaultReason?: string;
};
