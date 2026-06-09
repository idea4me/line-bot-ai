import { FaqItem } from "@/types/faq";

const FAQ_CACHE_TTL_MS = 60_000;
const FAQ_FETCH_TIMEOUT_MS = 1_500;

let cachedFaq: {
  csv: string;
  expiresAt: number;
} | null = null;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function isActive(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
}

function parseFaqCsv(csv: string): FaqItem[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine).map((header) => header.trim());

  return rows
    .map((row) => {
      const values = parseCsvLine(row);
      const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

      return {
        category: record.category ?? "",
        question: record.question ?? "",
        answer: record.answer ?? "",
        keywords: record.keywords ?? "",
        active: isActive(record.active)
      };
    })
    .filter((item) => item.active);
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function faqItemsToPromptCsv(items: FaqItem[]) {
  const header = "category,question,answer,keywords";
  const rows = items.map((item) =>
    [item.category, item.question, item.answer, item.keywords].map(escapeCsv).join(",")
  );

  return [header, ...rows].join("\n");
}

export async function getFaqCsvContent() {
  const sheetCsvUrl = process.env.SHEET_CSV_URL;
  if (!sheetCsvUrl) {
    throw new Error("Missing SHEET_CSV_URL");
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
