import { DEFAULT_REPLY, NOT_FOUND_TOKEN, buildFaqPrompt, buildWebSourcePrompt } from "@/constants/prompts";
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

  try {
    const faqAnswer = await answerFromPrompt(buildFaqPrompt(faqCsv, question), "FAQ");
    if (faqAnswer) {
      return faqAnswer;
    }
  } catch (error) {
    logError("gemini-faq", error);
    return defaultResult("DEFAULT", "gemini_faq_error");
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
