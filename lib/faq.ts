import * as Papa from "papaparse";
import supportData from "@/constants/support-data.json";
import { FaqItem } from "@/types/faq";

const FAQ_CACHE_TTL_MS = 60_000;
const FAQ_FETCH_TIMEOUT_MS = 1_500;

let cachedFaq: {
  csv: string;
  expiresAt: number;
} | null = null;

function isActive(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
}

function parseFaqCsv(csv: string): FaqItem[] {
  const cleanCsv = csv.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(cleanCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  return parsed.data
    .map((record) => ({
      category: record.category?.trim() ?? "",
      question: record.question?.trim() ?? "",
      answer: record.answer?.trim() ?? "",
      keywords: record.keywords?.trim() ?? "",
      active: isActive(record.active)
    }))
    .filter((item) => item.active);
}

function faqItemsToPromptCsv(items: FaqItem[]): string {
  return Papa.unparse(
    items.map((item) => ({
      category: item.category,
      question: item.question,
      answer: item.answer,
      keywords: item.keywords
    })),
    {
      columns: ["category", "question", "answer", "keywords"]
    }
  );
}

export async function getFaqCsvContent() {
  // Try static cache first
  if (supportData.faqCsv) {
    return supportData.faqCsv;
  }

  const sheetCsvUrl = process.env.SHEET_CSV_URL;
  if (!sheetCsvUrl) {
    throw new Error("Missing SHEET_CSV_URL and no static cache found");
  }

  const now = Date.now();
  if (cachedFaq && cachedFaq.expiresAt > now) {
    return cachedFaq.csv;
  }

  try {
    const response = await fetch(sheetCsvUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(FAQ_FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`FAQ sheet request failed with status ${response.status}`);
    }

    const csv = faqItemsToPromptCsv(parseFaqCsv(await response.text()));
    cachedFaq = {
      csv,
      expiresAt: now + FAQ_CACHE_TTL_MS
    };

    return csv;
  } catch (error) {
    if (cachedFaq) {
      return cachedFaq.csv;
    }

    throw error;
  }
}
