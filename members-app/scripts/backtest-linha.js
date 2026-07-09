// Backtest da Linha do Swell (motor REAL do repo, compilado de swellline.ts).
// Alimenta a página pública defisurfers.xyz/linha (hub/linha.html — os números
// são colados à mão na página; atualizar o "Atualizado a DD/MM/AAAA").
//
// COMO CORRER (a partir de members-app/):
//   1) node node_modules/typescript/bin/tsc lib/engine/swellline.ts lib/engine/types.ts \
//        --module commonjs --target es2020 --outDir scripts --skipLibCheck
//   2) node scripts/backtest-linha.js
//   (os .js compilados em scripts/ podem ser apagados depois; não fazer commit deles)
//
// Modelo: long no FECHO da vela que confirma o flip bullish; sai no FECHO da
// vela que confirma o flip bearish; em cash no resto. Sem taxas/slippage
// (declarado no disclaimer da página). Velas semanais Binance, só FECHADAS.
const { computeSwellLine } = require("./swellline.js");

const WEEK = 7 * 86400000;

async function klines(symbol) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1w&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const raw = await res.json();
  let candles = raw.map((k) => ({
    time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4],
  }));
  // regra nuclear: só velas fechadas
  while (candles.length && Date.now() < candles[candles.length - 1].time + WEEK) candles.pop();
  return candles;
}

function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }

function maxDrawdown(equity) {
  let peak = -Infinity, mdd = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = 1 - e / peak;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

async function run(symbol, label) {
  const candles = await klines(symbol);
  const states = computeSwellLine(candles);
  const n = candles.length;

  // primeiro índice com estado válido (linha existente)
  let start = states.findIndex((s) => s && s.trend);
  if (start < 0) throw new Error("sem estados");

  // série de trades: flips confirmados no fecho
  const trades = [];
  let inPos = states[start].trend === "bullish";
  let entryIdx = inPos ? start : null;
  for (let i = start + 1; i < n; i++) {
    const prev = states[i - 1].trend, cur = states[i].trend;
    if (prev === cur) continue;
    if (cur === "bullish") { inPos = true; entryIdx = i; }
    else if (inPos) {
      trades.push({ entryIdx, exitIdx: i, open: false });
      inPos = false; entryIdx = null;
    }
  }
  if (inPos && entryIdx !== null) trades.push({ entryIdx, exitIdx: n - 1, open: true });

  // equity semanal: estratégia (long entre fechos de flip) vs buy & hold
  const closes = candles.map((c) => c.close);
  const strat = [1], bh = [1];
  let held = states[start].trend === "bullish";
  for (let i = start + 1; i < n; i++) {
    const r = closes[i] / closes[i - 1];
    bh.push(bh[bh.length - 1] * r);
    // posição durante a semana i: estávamos long se o trend no fecho anterior era bullish
    strat.push(strat[strat.length - 1] * (states[i - 1].trend === "bullish" ? r : 1));
  }

  const rows = trades.map((t) => ({
    entrada: iso(candles[t.entryIdx].time),
    precoIn: closes[t.entryIdx],
    saida: t.open ? "(aberto)" : iso(candles[t.exitIdx].time),
    precoOut: closes[t.exitIdx],
    ret: closes[t.exitIdx] / closes[t.entryIdx] - 1,
    semanas: t.exitIdx - t.entryIdx,
    open: t.open,
  }));
  const closed = rows.filter((r) => !r.open);
  const wins = closed.filter((r) => r.ret > 0);

  console.log(`\n======== ${label} (${symbol}) ========`);
  console.log(`histórico: ${iso(candles[0].time)} → ${iso(candles[n - 1].time)} (${n} velas; backtest desde ${iso(candles[start].time)})`);
  console.log(`\n#  entrada      preço-in     saída        preço-out    resultado  semanas`);
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2)} ${r.entrada}  ${String(r.precoIn.toPrecision(6)).padStart(11)}  ${r.saida.padEnd(11)}  ${String(r.precoOut.toPrecision(6)).padStart(11)}  ${((r.ret * 100).toFixed(1) + "%").padStart(8)}${r.open ? "*" : " "}  ${r.semanas}`
    );
  });
  const stratTot = strat[strat.length - 1] - 1, bhTot = bh[bh.length - 1] - 1;
  console.log(`\nRETORNO   Linha: ${(stratTot * 100).toFixed(0)}%   |   Buy&Hold: ${(bhTot * 100).toFixed(0)}%`);
  console.log(`MAX DD    Linha: ${(maxDrawdown(strat) * 100).toFixed(0)}%   |   Buy&Hold: ${(maxDrawdown(bh) * 100).toFixed(0)}%`);
  console.log(`TRADES    ${closed.length} fechados (${wins.length} positivos = ${closed.length ? Math.round((wins.length / closed.length) * 100) : 0}%)${rows.some(r=>r.open) ? " + 1 aberto (*)" : ""}`);
  return { label, symbol, rows, stratTot, bhTot, ddS: maxDrawdown(strat), ddB: maxDrawdown(bh) };
}

(async () => {
  const out = [];
  for (const [sym, label] of [["BTCUSDT", "Bitcoin"], ["SOLUSDT", "Solana"], ["DOTUSDT", "Polkadot"]]) {
    out.push(await run(sym, label));
  }
  require("fs").writeFileSync(__dirname + "/results.json", JSON.stringify(out, null, 2));
  console.log("\n(json completo em results.json)");
})().catch((e) => { console.error(e); process.exit(1); });
