// Gera SVGs inline (curva de portfólio Linha vs Buy&Hold, zonas em cash,
// anotações de drawdown) para a página /linha. Dados = motor real.
const { computeSwellLine } = require("./swellline.js");
const fs = require("fs");
const WEEK = 7 * 86400000;

async function klines(symbol) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1w&limit=1000`);
  const raw = await r.json();
  let c = raw.map((k) => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
  while (c.length && Date.now() < c[c.length - 1].time + WEEK) c.pop();
  return c;
}

function fmtEur(v) {
  // portfólio em dólares, formato pt: 30.210 $
  const n = Math.round(v);
  return n.toLocaleString("pt-PT").replace(/ /g, ".") + " $";
}

async function gen(symbol, label) {
  const candles = await klines(symbol);
  const states = computeSwellLine(candles);
  const start = states.findIndex((s) => s && s.trend);
  const closes = candles.map((c) => c.close);
  const n = candles.length;

  const CAP = 1000;
  const strat = [CAP], bh = [CAP], cash = [states[start].trend !== "bullish"];
  for (let i = start + 1; i < n; i++) {
    const r = closes[i] / closes[i - 1];
    bh.push(bh[bh.length - 1] * r);
    strat.push(strat[strat.length - 1] * (states[i - 1].trend === "bullish" ? r : 1));
    cash.push(states[i].trend !== "bullish");
  }
  const m = strat.length;

  // troughs p/ anotações (mínimo APÓS o pico máximo de cada curva)
  function trough(eq) {
    let peak = -1, peakI = 0, mdd = 0, tI = 0, curPeak = -1;
    for (let i = 0; i < eq.length; i++) {
      if (eq[i] > curPeak) { curPeak = eq[i]; }
      const dd = 1 - eq[i] / curPeak;
      if (dd > mdd) { mdd = dd; tI = i; }
    }
    return { i: tI, dd: mdd, v: eq[tI] };
  }
  const tS = trough(strat), tB = trough(bh);

  // escala
  const W = 720, H = 300, padL = 56, padR = 14, padT = 30, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const all = strat.concat(bh);
  const lo = Math.min(...all) * 0.9, hi = Math.max(...all) * 1.15;
  const ly = (v) => padT + ih - ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * ih;
  const lx = (i) => padL + (i / (m - 1)) * iw;

  // ticks "bonitos" em escala log
  const cands = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const ticks = cands.filter((t) => t >= lo && t <= hi).slice(-4);

  // anos no eixo x (jan de cada ano, espaçados)
  const years = [];
  for (let i = 0; i < m; i++) {
    const d = new Date(candles[start + i].time);
    if (d.getUTCMonth() === 0 && d.getUTCDate() <= 7) years.push({ i, y: d.getUTCFullYear() });
  }
  const yearStep = Math.ceil(years.length / 6);
  const yearsShown = years.filter((_, idx) => idx % yearStep === 0);

  // zonas em cash (bandas)
  const bands = [];
  let b0 = null;
  for (let i = 0; i < m; i++) {
    if (cash[i] && b0 === null) b0 = i;
    if ((!cash[i] || i === m - 1) && b0 !== null) { bands.push([b0, cash[i] ? i : i - 1]); b0 = null; }
  }

  const path = (eq) => eq.map((v, i) => `${i ? "L" : "M"}${lx(i).toFixed(1)},${ly(v).toFixed(1)}`).join("");

  // anotações de fundo (drawdown) — posicionar sem sair do gráfico
  const annot = (t, cls, txt) => {
    const x = Math.min(Math.max(lx(t.i), padL + 30), W - padR - 60);
    const y = Math.min(ly(t.v) + 16, H - padB - 4);
    return `<circle cx="${lx(t.i).toFixed(1)}" cy="${ly(t.v).toFixed(1)}" r="3.5" class="${cls}-dot"/>
    <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="ann ${cls}" text-anchor="middle">${txt}</text>`;
  };

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}: portfólio de 1.000 $ com a Linha vs buy & hold" class="eq-svg">
  <!-- zonas em cash: a defesa a acontecer -->
  ${bands.map(([a, b]) => `<rect x="${lx(a).toFixed(1)}" y="${padT}" width="${(lx(b) - lx(a)).toFixed(1)}" height="${ih}" class="cash-band"/>`).join("\n  ")}
  ${ticks.map((t) => `<line x1="${padL}" x2="${W - padR}" y1="${ly(t).toFixed(1)}" y2="${ly(t).toFixed(1)}" class="grid"/><text x="${padL - 8}" y="${(ly(t) + 3.5).toFixed(1)}" class="tick" text-anchor="end">${t >= 1000 ? (t / 1000) + "k $" : t + " $"}</text>`).join("\n  ")}
  ${yearsShown.map((yy) => `<text x="${lx(yy.i).toFixed(1)}" y="${H - 12}" class="tick" text-anchor="middle">${yy.y}</text>`).join("\n  ")}
  <path d="${path(bh)}" class="line-bh"/>
  <path d="${path(strat)}" class="line-strat"/>
  ${annot(tB, "bh", `-${Math.round(tB.dd * 100)}% quem segurou`)}
  ${annot(tS, "st", `-${Math.round(tS.dd * 100)}% com a Linha`)}
</svg>`;

  const meta = {
    label,
    stratEnd: fmtEur(strat[m - 1]),
    bhEnd: fmtEur(bh[m - 1]),
    cashPct: Math.round((cash.filter(Boolean).length / m) * 100),
  };
  fs.writeFileSync(`${__dirname}/${symbol}.svg`, svg);
  console.log(label, "→ Linha:", meta.stratEnd, "| B&H:", meta.bhEnd, "| em cash", meta.cashPct + "% do tempo", "| bandas:", bands.length);
  return meta;
}

(async () => {
  for (const [s, l] of [["BTCUSDT", "Bitcoin"], ["SOLUSDT", "Solana"], ["DOTUSDT", "Polkadot"]]) await gen(s, l);
})().catch((e) => { console.error(e); process.exit(1); });
