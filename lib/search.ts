const FETCH_TIMEOUT_MS = 2_000;
const MAX_SOURCE_LENGTH = 12_000;

export const KM_URL = "https://km.menu.in.th/public/";
export const HELP_URL = "https://menu.in.th/help/";

function htmlToText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSearchSource(url: string, query: string) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Search source request failed with status ${response.status}`);
  }

  const content = htmlToText(await response.text()).slice(0, MAX_SOURCE_LENGTH);
  return `URL: ${url}\nQUESTION: ${query}\nCONTENT:\n${content}`;
}
