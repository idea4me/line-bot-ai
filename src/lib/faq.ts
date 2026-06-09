import { FaqItem } from "@/types/faq";

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

export function parseFaqCsv(csv: string): FaqItem[] {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);

  return rows.map((row) => {
    const values = parseCsvLine(row);
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    return {
      category: record.category ?? "",
      question: record.question ?? "",
      answer: record.answer ?? "",
      keywords: record.keywords ?? "",
      last_update: record.last_update ?? ""
    };
  });
}

export function faqItemsToCsv(items: FaqItem[]) {
  const header = "category,question,answer,keywords,last_update";
  const rows = items.map((item) =>
    [item.category, item.question, item.answer, item.keywords, item.last_update]
      .map((value) => `"${value.replaceAll('"', '""')}"`)
      .join(",")
  );

  return [header, ...rows].join("\n");
}
