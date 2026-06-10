import { GoogleGenAI } from "@google/genai";
import { logGeminiUsage } from "@/lib/logger";
import { TokenUsage } from "@/types/faq";

const MODEL = "gemini-1.5-flash";
const GEMINI_ABORT_TIMEOUT_MS = 6_000;
const MAX_OUTPUT_TOKENS = 1024;

export type GeminiAnswer = {
  text: string;
  finishReason?: string;
  tokenUsage?: TokenUsage;
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

export async function generateGeminiAnswer(prompt: string): Promise<GeminiAnswer> {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "text/plain",
      abortSignal: AbortSignal.timeout(GEMINI_ABORT_TIMEOUT_MS)
    }
  });

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const usageMetadata = response.usageMetadata;
  const tokenUsage = {
    thoughtsTokenCount: usageMetadata?.thoughtsTokenCount,
    candidatesTokenCount: usageMetadata?.candidatesTokenCount,
    totalTokenCount: usageMetadata?.totalTokenCount
  };

  logGeminiUsage({
    finishReason,
    ...tokenUsage
  });

  return {
    text: response.text?.trim() ?? "",
    finishReason,
    tokenUsage
  };
}
