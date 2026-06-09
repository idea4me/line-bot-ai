const KM_URL = "https://km.menu.in.th/public/";

export async function searchKm(query: string) {
  const response = await fetch(KM_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`KM request failed with status ${response.status}`);
  }

  const html = await response.text();
  return `URL: ${KM_URL}\nQUERY: ${query}\nCONTENT:\n${html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 12000)}`;
}
