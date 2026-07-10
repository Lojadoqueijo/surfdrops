// Backfill da MARÉ da cripto: recalcula, para cada semana do passado, quantos
// ativos do universo estavam bullish/bearish — usando o motor real sobre as
// velas Binance. Gera INSERTs para breadth_daily (class='cripto').
//
// RESSALVA (viés de sobrevivência): usa o universo de HOJE — moedas mortas não
// entram. É retro-calculado, e a UI etiqueta-o como tal. O presente (cron
// diário) é exato; o passado é a melhor reconstrução possível.
const { computeSwellLine } = require("./swellline.js");
const fs = require("fs");
const WEEK = 7 * 86400000;

// universo: top da CoinGecko ∩ Binance USDT (aproxima o universo cripto do Radar)
async function universe() {
  const set = new Set();
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`);
    if (!r.ok) { await new Promise((x) => setTimeout(x, 1500)); continue; }
    for (const c of await r.json()) set.add((c.symbol || "").toUpperCase());
    await new Promise((x) => setTimeout(x, 1200));
  }
  const info = await (await fetch("https://api.binance.com/api/v3/exchangeInfo")).json();
  const binance = new Set(info.symbols.filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING").map((s) => s.baseAsset.toUpperCase()));
  const STABLE = new Set(["USDT", "USDC", "DAI", "FDUSD", "TUSD", "BUSD", "USDE", "PYUSD", "USDS", "FRAX", "PAXG", "XAUT"]);
  const WRAP = new Set(["WBTC", "WETH", "WBETH", "STETH", "WSTETH", "CBBTC", "WEETH", "WBNB", "JITOSOL", "MSOL", "BNSOL"]);
  return [...set].filter((s) => binance.has(s) && !STABLE.has(s) && !WRAP.has(s)).map((s) => s + "USDT");
}

async function klines(sym) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1w&limit=1000`);
  if (!r.ok) return null;
  let c = (await r.json()).map((k) => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
  while (c.length && Date.now() < c[c.length - 1].time + WEEK) c.pop();
  return c;
}

(async () => {
  const syms = await universe();
  console.error(`universo: ${syms.length} pares`);

  // para cada semana (ancorada 2ª 00:00 UTC), contar bull/bear
  const weekAgg = new Map(); // weekTime -> {bull, bear}
  let done = 0;
  for (const sym of syms) {
    const c = await klines(sym);
    if (!c || c.length < 12) { done++; continue; }
    const st = computeSwellLine(c);
    for (let i = 0; i < c.length; i++) {
      if (!st[i] || !st[i].trend) continue;
      const wt = c[i].time; // âncora da vela (2ª 00:00 UTC)
      const a = weekAgg.get(wt) ?? { bull: 0, bear: 0 };
      if (st[i].trend === "bullish") a.bull++; else a.bear++;
      weekAgg.set(wt, a);
    }
    if (++done % 50 === 0) console.error(`  ${done}/${syms.length}`);
  }

  // só semanas com amostra decente (>=30 ativos vivos) para evitar ruído inicial
  const rows = [...weekAgg.entries()]
    .filter(([, a]) => a.bull + a.bear >= 30)
    .sort((x, y) => x[0] - y[0])
    .map(([wt, a]) => {
      const d = new Date(wt).toISOString().slice(0, 10);
      return `('cripto','${d}',${a.bull},${a.bear},${a.bull + a.bear})`;
    });

  const sql =
    "insert into breadth_daily (class, date, bull, bear, total) values\n" +
    rows.join(",\n") +
    "\non conflict (class, date) do update set bull=excluded.bull, bear=excluded.bear, total=excluded.total;";
  fs.writeFileSync(__dirname + "/breadth-cripto.sql", sql);
  console.error(`\n${rows.length} semanas → breadth-cripto.sql`);
  // preview: primeira, meio, última
  const parse = (s) => s.replace(/[()']/g, "").split(",");
  [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].forEach((r) => {
    const [, date, bull, bear, total] = parse(r);
    console.error(`  ${date}: ${bull}/${total} bull = ${Math.round((bull / total) * 100)}%`);
  });
})().catch((e) => { console.error(e); process.exit(1); });
