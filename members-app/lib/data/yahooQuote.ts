// Market caps em lote via Yahoo quote API (v7) — precisa do fluxo
// cookie (fc.yahoo.com seta A3) + crumb (v1/test/getcrumb). Verificado de IP
// europeu a 2026-07-05: 100 símbolos por chamada, campo marketCap presente.
// Falha branda: devolve o que conseguiu (mapa possivelmente vazio) — quem
// chama decide o fallback.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const BATCH = 100;

interface QuoteResponse {
  quoteResponse?: {
    result?: Array<{ symbol: string; marketCap?: number }>;
  };
}

async function getCookieAndCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
      next: { revalidate: 0 },
    });
    // fc.yahoo.com responde 404 mas seta o cookie A3 — é esse que interessa.
    const setCookies =
      typeof cookieRes.headers.getSetCookie === "function"
        ? cookieRes.headers.getSetCookie()
        : [cookieRes.headers.get("set-cookie") ?? ""];
    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie },
      next: { revalidate: 0 },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<")) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

/** Mapa yahooSymbol → marketCap (USD) para os símbolos pedidos. */
export async function getYahooMarketCaps(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const auth = await getCookieAndCrumb();
  if (!auth) {
    console.warn("[yahooQuote] sem cookie/crumb — market caps indisponíveis");
    return out;
  }

  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const url =
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(","))}` +
      `&fields=marketCap&formatted=false&crumb=${encodeURIComponent(auth.crumb)}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Cookie: auth.cookie },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        console.warn(`[yahooQuote] lote ${i / BATCH}: HTTP ${res.status}`);
        if (res.status === 429) await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const body = (await res.json()) as QuoteResponse;
      for (const q of body.quoteResponse?.result ?? []) {
        if (q.marketCap && q.marketCap > 0) out.set(q.symbol, q.marketCap);
      }
    } catch (err) {
      console.warn(`[yahooQuote] lote ${i / BATCH} falhou:`, err);
    }
  }
  return out;
}
