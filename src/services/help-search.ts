const HELP_URL = "https://menu.in.th/help/";

export async function searchHelp(query: string) {
  const response = await fetch(HELP_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Help Center request failed with status ${response.status}`);
  }

  const html = await response.text();
  return `URL: ${HELP_URL}\nQUERY: ${query}\nCONTENT:\n${html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 12000)}`;
}
