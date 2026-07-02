import { getSnapshots } from "@/lib/data/getSnapshots";
import { SECTORS, UNIVERSE } from "@/lib/data/universe";

export const revalidate = 3600; // 1h de cache; o cron diário força refresh

function fmt(n: number | null, digits = 2): string {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-PT", { maximumFractionDigits: digits });
}

function tvLink(symbol: string): string {
  const asset = UNIVERSE.find((a) => a.symbol === symbol);
  const tv = asset?.tvSymbol ?? symbol;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; estado?: string }>;
}) {
  const { setor, estado } = await searchParams;
  const all = await getSnapshots();

  let rows = all;
  if (setor) rows = rows.filter((r) => r.sector === setor);
  if (estado === "bull") rows = rows.filter((r) => r.trend === "bullish");
  if (estado === "bear") rows = rows.filter((r) => r.trend === "bearish");
  if (estado === "aligned") rows = rows.filter((r) => r.estado?.startsWith("ALIGNED"));

  // "acabou de flipar" = flip com menos de ~3% de movimento desde o flip
  const isFresh = (r: (typeof rows)[number]) =>
    r.sinceFlipPct !== null && Math.abs(r.sinceFlipPct) < 3;

  rows = [...rows].sort((a, b) => {
    const fa = isFresh(a) ? 0 : 1;
    const fb = isFresh(b) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.sector.localeCompare(b.sector) || a.symbol.localeCompare(b.symbol);
  });

  const updatedAt = all[0]?.updatedAt ? new Date(all[0].updatedAt) : new Date();

  return (
    <main className="container">
      <div className="brand">
        <h1>🌊 DeFi Surfers</h1>
        <span className="tag">screener de tendências · membros</span>
      </div>
      <p className="updated">
        Atualizado: {updatedAt.toLocaleString("pt-PT")} · cadência diária · sinais confirmados no
        fecho da vela
      </p>

      <div className="filters">
        <a href="/members" className={!setor && !estado ? "active" : ""}>Todos</a>
        <a href="/members?estado=bull" className={estado === "bull" ? "active" : ""}>🟢 Bullish</a>
        <a href="/members?estado=bear" className={estado === "bear" ? "active" : ""}>🔴 Bearish</a>
        <a href="/members?estado=aligned" className={estado === "aligned" ? "active" : ""}>✅ Aligned</a>
        {SECTORS.map((s) => (
          <a key={s} href={`/members?setor=${encodeURIComponent(s)}`} className={setor === s ? "active" : ""}>
            {s}
          </a>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>Ativo</th>
            <th>Setor</th>
            <th>Preço</th>
            <th>Trend</th>
            <th>Weekly</th>
            <th>Daily</th>
            <th>Estado</th>
            <th>Since Flip</th>
            <th>Flip Level</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className={isFresh(r) ? "fresh" : ""}>
              <td>
                {r.symbol}
                {isFresh(r) && <span className="badge-new">FLIP RECENTE</span>}
              </td>
              <td className="muted">{r.sector}</td>
              <td>{fmt(r.price)}</td>
              <td className={r.trend === "bullish" ? "bull" : "bear"}>
                {r.trend === "bullish" ? "BULLISH" : "BEARISH"}
              </td>
              <td className={r.weeklyTrend === "bullish" ? "bull" : r.weeklyTrend === "bearish" ? "bear" : "muted"}>
                {r.weeklyTrend ? (r.weeklyTrend === "bullish" ? "BULL" : "BEAR") : "—"}
              </td>
              <td className={r.dailyTrend === "bullish" ? "bull" : r.dailyTrend === "bearish" ? "bear" : "muted"}>
                {r.dailyTrend ? (r.dailyTrend === "bullish" ? "BULL" : "BEAR") : "—"}
              </td>
              <td className={r.estado === "CONFLICT" ? "conflict" : r.estado === "ALIGNED BULL" ? "bull" : r.estado === "ALIGNED BEAR" ? "bear" : "muted"}>
                {r.estado ?? "—"}
              </td>
              <td className={r.sinceFlipPct !== null && r.sinceFlipPct >= 0 ? "bull" : "bear"}>
                {r.sinceFlipPct !== null ? `${fmt(r.sinceFlipPct)}%` : "—"}
              </td>
              <td className="muted">{fmt(r.nextFlip)}</td>
              <td>
                <a href={tvLink(r.symbol)} target="_blank" rel="noopener noreferrer">
                  TradingView ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="note">
        ⚠️ Dados em modo <b>demo (mock)</b> até a API de dados de mercado estar ligada. A regra
        de ouro mantém-se: só se age em <b>ALIGNED</b>, com confirmação no fecho da vela. Material
        educativo — não é aconselhamento financeiro.
      </p>
    </main>
  );
}
