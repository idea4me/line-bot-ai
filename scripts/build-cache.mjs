import fs from 'fs';
import path from 'path';

const KM_URL = "https://km.menu.in.th/public/";
const HELP_URL = "https://menu.in.th/help/";
const FETCH_TIMEOUT_MS = 8000;
const MAX_SOURCE_LENGTH = 12000;

function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSource(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    const html = await response.text();
    return htmlToText(html).slice(0, MAX_SOURCE_LENGTH);
  } catch (error) {
    console.error(`Warning: Failed to fetch ${url}:`, error.message);
    return "";
  }
}

async function buildCache() {
  const sheetCsvUrl = process.env.SHEET_CSV_URL;
  let faqCsv = "";

  if (sheetCsvUrl) {
    console.log("Fetching Google Sheet CSV FAQ from: " + sheetCsvUrl);
    try {
      const response = await fetch(sheetCsvUrl);
      if (response.ok) {
        faqCsv = await response.text();
        console.log(`Successfully fetched FAQ CSV (${faqCsv.length} bytes)`);
      } else {
        console.error("Warning: Failed to fetch Google Sheet CSV:", response.status);
      }
    } catch (err) {
      console.error("Warning: Failed to fetch Google Sheet CSV:", err.message);
    }
  } else {
    console.log("SHEET_CSV_URL is missing in environment variables. Skipping FAQ fetch.");
  }

  console.log("Fetching KM source from: " + KM_URL);
  const kmContent = await fetchSource(KM_URL);

  console.log("Fetching HELP source from: " + HELP_URL);
  const helpContent = await fetchSource(HELP_URL);

  const data = {
    faqCsv,
    kmContent,
    helpContent,
    buildAt: new Date().toISOString()
  };

  const targetDir = path.join(process.cwd(), 'constants');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(targetDir, 'support-data.json'),
    JSON.stringify(data, null, 2)
  );

  console.log("Successfully built support-data.json cache!");
}

buildCache();
