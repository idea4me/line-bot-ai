import { DEFAULT_REPLY, NOT_FOUND_TOKEN, buildCombinedPrompt } from "@/constants/prompts";
import supportData from "@/constants/support-data.json";
import { getFaqCsvContent } from "@/lib/faq";
import { generateGeminiAnswer, GeminiAnswer } from "@/lib/gemini";
import { logError, logInfo } from "@/lib/logger";
import { fetchSearchSource, HELP_URL, KM_URL } from "@/lib/search";
import { AnswerResult, AnswerSource } from "@/types/faq";

const ANSWER_TIMEOUT_MS = 6_500;

function defaultResult(
  sourceUsed: AnswerSource = "DEFAULT",
  defaultReason = "not_found",
  result?: GeminiAnswer
): AnswerResult {
  return {
    answer: DEFAULT_REPLY,
    finishReason: result?.finishReason,
    tokenUsage: result?.tokenUsage,
    sourceUsed,
    defaultReason
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
    logInfo("answer-default", { sourceUsed, reason: "max_tokens" });
    return defaultResult("DEFAULT", "max_tokens", result);
  }

  if (!isUsable(result)) {
    logInfo("answer-source-not-found", {
      sourceUsed,
      finishReason: result.finishReason,
      answerLength: normalizeAnswer(result.text).length
    });
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
  // 1. Load FAQ CSV (tries static cache, falls back to dynamic fetch if empty)
  let faqCsv: string;
  try {
    faqCsv = await getFaqCsvContent();
    logInfo("faq-loaded", {
      csvLength: faqCsv.length,
      rowCount: Math.max(faqCsv.split(/\r?\n/).length - 1, 0)
    });
  } catch (error) {
    logError("faq-sheet", error);
    return defaultResult("DEFAULT", "faq_sheet_error");
  }

  // 2. Load KM source (use static cache, fallback to dynamic fetch if empty)
  let kmSource = supportData.kmContent;
  if (!kmSource) {
    try {
      kmSource = await fetchSearchSource(KM_URL, question);
    } catch (error) {
      logError("km-search-fallback", error);
      kmSource = "";
    }
  }

  // 3. Load HELP source (use static cache, fallback to dynamic fetch if empty)
  let helpSource = supportData.helpContent;
  if (!helpSource) {
    try {
      helpSource = await fetchSearchSource(HELP_URL, question);
    } catch (error) {
      logError("help-search-fallback", error);
      helpSource = "";
    }
  }

  // 4. Call Gemini with the Combined Prompt
  try {
    const combinedPrompt = buildCombinedPrompt(faqCsv, kmSource, helpSource, question);
    const combinedAnswer = await answerFromPrompt(combinedPrompt, "COMBINED");
    if (combinedAnswer) {
      return combinedAnswer;
    }
  } catch (error) {
    logError("gemini-combined", error);
  }

  logInfo("answer-default", { reason: "all_sources_not_found" });
  return defaultResult("DEFAULT", "all_sources_not_found");
}

export async function getSupportAnswer(question: string): Promise<AnswerResult> {
  return Promise.race([
    buildAnswer(question),
    new Promise<AnswerResult>((resolve) => {
      setTimeout(() => {
        logInfo("answer-default", { reason: "answer_timeout", timeoutMs: ANSWER_TIMEOUT_MS });
        resolve(defaultResult("DEFAULT", "answer_timeout"));
      }, ANSWER_TIMEOUT_MS);
    })
  ]);
}
