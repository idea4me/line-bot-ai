import { DEFAULT_REPLY, NOT_FOUND_TOKEN, buildFaqPrompt, buildWebSourcePrompt } from "@/constants/prompts";
import { getFaqCsvContent } from "@/lib/faq";
import { generateGeminiAnswer, GeminiAnswer } from "@/lib/gemini";
import { logError } from "@/lib/logger";
import { fetchSearchSource, HELP_URL, KM_URL } from "@/lib/search";
import { AnswerResult, AnswerSource } from "@/types/faq";

const ANSWER_TIMEOUT_MS = 6_500;

function defaultResult(sourceUsed: AnswerSource = "DEFAULT", result?: GeminiAnswer): AnswerResult {
  return {
    answer: DEFAULT_REPLY,
    finishReason: result?.finishReason,
    tokenUsage: result?.tokenUsage,
    sourceUsed
  };
}

function normalizeAnswer(text: string) {
  return text.replace(/^```(?:text)?/i, "").replace(/```$/i, "").trim();
}

function isUsable(result: GeminiAnswer) {
  const answer = normalizeAnswer(result.text);
  return result.finishReason !== "MAX_TOKENS" && answer.length > 0 && answer !== NOT_FOUND_TOKEN;
}

async function answerFromPrompt(prompt: string, sourceUsed: AnswerSource): Promise<AnswerResult | null> {
  const result = await generateGeminiAnswer(prompt);

  if (result.finishReason === "MAX_TOKENS") {
    return defaultResult("DEFAULT", result);
  }

  if (!isUsable(result)) {
    return null;
  }

  return {
    answer: normalizeAnswer(result.text),
    finishReason: result.finishReason,
    tokenUsage: result.tokenUsage,
    sourceUsed
  };
}

async function buildAnswer(question: string): Promise<AnswerResult> {
  let faqCsv: string;

  try {
    faqCsv = await getFaqCsvContent();
  } catch (error) {
    logError("faq-sheet", error);
    return defaultResult();
  }

  try {
    const faqAnswer = await answerFromPrompt(buildFaqPrompt(faqCsv, question), "FAQ");
    if (faqAnswer) {
      return faqAnswer;
    }
  } catch (error) {
    logError("gemini-faq", error);
    return defaultResult();
  }

  try {
    const kmSource = await fetchSearchSource(KM_URL, question);
    const kmAnswer = await answerFromPrompt(buildWebSourcePrompt("MENU KM", kmSource, question), "KM");
    if (kmAnswer) {
      return kmAnswer;
    }
  } catch (error) {
    logError("km-search", error);
  }

  try {
    const helpSource = await fetchSearchSource(HELP_URL, question);
    const helpAnswer = await answerFromPrompt(buildWebSourcePrompt("MENU Help Center", helpSource, question), "HELP");
    if (helpAnswer) {
      return helpAnswer;
    }
  } catch (error) {
    logError("help-search", error);
  }

  return defaultResult();
}

export async function getSupportAnswer(question: string): Promise<AnswerResult> {
  return Promise.race([
    buildAnswer(question),
    new Promise<AnswerResult>((resolve) => {
      setTimeout(() => resolve(defaultResult()), ANSWER_TIMEOUT_MS);
    })
  ]);
}
