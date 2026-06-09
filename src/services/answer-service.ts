import { DEFAULT_REPLY } from "@/constants/default-reply";
import { generateJsonAnswer } from "@/lib/gemini";
import { logError } from "@/lib/logger";
import { buildFaqPrompt, buildWebSourcePrompt } from "@/lib/prompt";
import { getFaqCsvContent } from "@/services/faq-service";
import { searchHelp } from "@/services/help-search";
import { searchKm } from "@/services/km-search";
import { AnswerResult, AnswerSource } from "@/types/faq";

const ESCALATION_KEYWORDS = [
  "ยกเลิกบริการ",
  "ยกเลิกสมาชิก",
  "ร้องเรียน",
  "ฟ้อง",
  "ไม่พอใจ",
  "คืนเงิน",
  "ติดต่อเจ้าหน้าที่"
];

function shouldEscalate(message: string) {
  return ESCALATION_KEYWORDS.some((keyword) => message.includes(keyword));
}

function isUsableAnswer(answer: string, confidence: number, finishReason?: string) {
  return finishReason !== "MAX_TOKENS" && answer !== "NOT_FOUND" && confidence >= 70;
}

function defaultResult(sourceUsed: AnswerSource = "DEFAULT"): AnswerResult {
  return {
    answer: DEFAULT_REPLY,
    confidence: 0,
    sourceUsed
  };
}

export async function getAnswer(question: string): Promise<AnswerResult> {
  if (shouldEscalate(question)) {
    return defaultResult("ESCALATION");
  }

  try {
    const faqCsv = await getFaqCsvContent();
    const faqAnswer = await generateJsonAnswer(buildFaqPrompt(faqCsv, question));

    if (isUsableAnswer(faqAnswer.answer, faqAnswer.confidence, faqAnswer.finishReason)) {
      return {
        ...faqAnswer,
        sourceUsed: "FAQ"
      };
    }

    if (faqAnswer.finishReason === "MAX_TOKENS") {
      return {
        ...defaultResult(),
        finishReason: faqAnswer.finishReason,
        tokenUsage: faqAnswer.tokenUsage
      };
    }
  } catch (error) {
    logError("faq-answer", error);
  }

  try {
    const kmContent = await searchKm(question);
    const kmAnswer = await generateJsonAnswer(buildWebSourcePrompt("KM", kmContent, question));

    if (isUsableAnswer(kmAnswer.answer, kmAnswer.confidence, kmAnswer.finishReason)) {
      return {
        ...kmAnswer,
        sourceUsed: "KM"
      };
    }

    if (kmAnswer.finishReason === "MAX_TOKENS") {
      return {
        ...defaultResult(),
        finishReason: kmAnswer.finishReason,
        tokenUsage: kmAnswer.tokenUsage
      };
    }
  } catch (error) {
    logError("km-answer", error);
  }

  try {
    const helpContent = await searchHelp(question);
    const helpAnswer = await generateJsonAnswer(buildWebSourcePrompt("Help Center", helpContent, question));

    if (isUsableAnswer(helpAnswer.answer, helpAnswer.confidence, helpAnswer.finishReason)) {
      return {
        ...helpAnswer,
        sourceUsed: "HELP"
      };
    }

    if (helpAnswer.finishReason === "MAX_TOKENS") {
      return {
        ...defaultResult(),
        finishReason: helpAnswer.finishReason,
        tokenUsage: helpAnswer.tokenUsage
      };
    }
  } catch (error) {
    logError("help-answer", error);
  }

  return defaultResult();
}
