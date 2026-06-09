import { getOrSetCache } from "@/lib/cache";
import { faqItemsToCsv, parseFaqCsv } from "@/lib/faq";

const FAQ_CACHE_TTL_MS = 60_000;

export async function getFaqCsvContent() {
  const sheetCsvUrl = process.env.SHEET_CSV_URL;
  if (!sheetCsvUrl) {
    throw new Error("Missing SHEET_CSV_URL");
  }

  return getOrSetCache("faq-csv-content", FAQ_CACHE_TTL_MS, async () => {
    const response = await fetch(sheetCsvUrl, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`FAQ sheet request failed with status ${response.status}`);
    }

    const csv = await response.text();
    return faqItemsToCsv(parseFaqCsv(csv));
  });
}
