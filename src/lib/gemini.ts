import { GoogleGenAI } from "@google/genai";
import { logGeminiUsage } from "@/lib/logger";
import { TokenUsage } from "@/types/faq";

type GeminiJsonAnswer = {
  answer: string;
  confidence: number;
  finishReason?: string;
  tokenUsage?: TokenUsage;
};

const model = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

function parseJsonAnswer(text: string): Pick<GeminiJsonAnswer, "answer" | "confidence"> {
  try {
    const parsed = JSON.parse(text.trim()) as Partial<GeminiJsonAnswer>;
    return {
      answer: parsed.answer ?? "NOT_FOUND",
      confidence: Number(parsed.confidence ?? 0)
    };
  } catch {
    return {
      answer: "NOT_FOUND",
      confidence: 0
    };
  }
}

export async function generateJsonAnswer(prompt: string): Promise<GeminiJsonAnswer> {
  const response = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json"
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
    ...parseJsonAnswer(response.text ?? ""),
    finishReason,
    tokenUsage
  };
}
