"use client";

import { useMemo, useState } from "react";
import {
  ASSET_CLASSES,
  type AssetClass,
  type TerminalRow,
} from "@/lib/data/terminal";

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function fmtPrice(n: number, currency: string): string {
  if (Number.isNaN(n)) return "—";
  const digits = n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  const num = n.toLocaleString("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency === "USD" ? `$${num}` : `${num} ${currency}`;
}

function fmtPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
}

function fmtMarketCap(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("pt-PT")}`;
}

function fmtSince(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  let d = Math.max(0, Math.floor((now - then) / 86_400_000));
  const years = Math.floor(d / 365);
  d -= years * 365;
  const weeks = Math.floor(d / 7);
  d -= weeks * 7;
  const parts: string[] = [];
  if (years) parts.push(`${years}A`);
  if (weeks) parts.push(`${weeks}sem`);
  if (d || parts.length === 0) parts.push(`${d}d`);
  return parts.slice(0, 2).join(" ");
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

// ---------------------------------------------------------------------------
// Estados derivados
// ---------------------------------------------------------------------------

type TrendTag = "BULLISH" | "BEARISH" | "WARMUP" | "COOLDOWN";

function trendTag(r: TerminalRow): TrendTag {
  if (r.trend === "bearish" && r.warmup) return "WARMUP";
  if (r.trend === "bullish" && r.cooldown) return "COOLDOWN";
  return r.trend === "bullish" ? "BULLISH" : "BEARISH";
}

const TREND_CLASS: Record<TrendTag, string> = {
  BULLISH: "t-bull",
  BEARISH: "t-bear",
  WARMUP: "t-warm",
  COOLDOWN: "t-cool",
};

interface Warning {
  label: string;
  tone: "good" | "bad" | "warn";
  tip: string;
}

function warningsFor(r: TerminalRow): Warning[] {
  const w: Warning[] = [];
  if (r.cheapZone)
    w.push({
      label: "Zona barata (200W)",
      tone: "good",
      tip: "Preço abaixo da média de 200 semanas — historicamente zona de fundo (‘very cheap’).",
    });
  if (r.dotBottom)
    w.push({
      label: "Possível fundo",
      tone: "good",
      tip: "O Daily virou bullish durante um Weekly bearish. Prepara — a entrada é só no flip com ALIGNED.",
    });
  if (r.bullDiv)
    w.push({
      label: "Divergência de fundo",
      tone: "good",
      tip: "Preço fez novo mínimo mas o momentum não acompanhou. Vendedores a cansar.",
    });
  if (r.dotTop)
    w.push({
      label: "Possível topo",
      tone: "bad",
      tip: "O Daily virou bearish durante um Weekly bullish. Considera realizar lucros.",
    });
  if (r.bearDiv)
    w.push({
      label: "Divergência de topo",
      tone: "bad",
      tip: "Preço fez novo máximo mas o momentum não acompanhou. Força a esgotar-se.",
    });
  if (r.exhaustionAtr !== null && r.exhaustionAtr >= 4)
    w.push({
      label: `Esticado +${r.exhaustionAtr.toFixed(1)} ATR`,
      tone: "warn",
      tip: "Preço muito acima da linha — zona de realizar lucros, não de entrar.",
    });
  if (r.exhaustionAtr !== null && r.exhaustionAtr <= -4)
    w.push({
      label: `Esticado ${r.exhaustionAtr.toFixed(1)} ATR`,
      tone: "warn",
      tip: "Preço muito abaixo da linha — possível capitulação; aguarda avisos de fundo.",
    });
  return w;
}

// Barra de força: strength ∈ [-1, +1] → posição + cor num gradiente vermelho→verde.
function ForceBar({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="muted">—</span>;
  const pct = ((strength + 1) / 2) * 100; // -1→0%, +1→100%
  const hue = (pct / 100) * 120; // 0=vermelho, 120=verde
  return (
    <span className="force-bar" title={`Força: ${strength.toFixed(2)}`}>
      <span className="force-track">
        <span
          className="force-fill"
          style={{ width: `${pct}%`, background: `hsl(${hue}, 75%, 50%)` }}
        />
      </span>
    </span>
  );
}

function EstadoChip({ estado }: { estado: TerminalRow["estado"] }) {
  if (!estado) return <span className="muted">—</span>;
  const cls =
    estado === "CONFLICT" ? "e-conflict" : estado === "ALIGNED BULL" ? "e-bull" : "e-bear";
  const label = estado === "CONFLICT" ? "CONFLITO" : estado === "ALIGNED BULL" ? "ALINHADO ↑" : "ALINHADO ↓";
  return <span className={`chip ${cls}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type SortKey = "rank" | "sinceFlipPct" | "since" | "price" | "marketCap";

export default function Terminal({
  rows,
  updatedAt,
  mock,
}: {
  rows: TerminalRow[];
  updatedAt: string;
  mock: boolean;
}) {
  const [activeClass, setActiveClass] = useState<AssetClass>("Cripto");
  const [search, setSearch] = useState("");
  const [trendFilter, setTrendFilter] = useState<Set<TrendTag>>(new Set());
  const [category, setCategory] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [sortKey, setSortKey] = useState<SortKey>("sinceFlipPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const classRows = useMemo(
    () => rows.filter((r) => r.assetClass === activeClass),
    [rows, activeClass]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    classRows.forEach((r) => r.categories.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [classRows]);

  // Pulso do mar: contagens sobre a classe ativa (bullish/bearish pela direção
  // base da linha; warmup destacado à parte como funil de atenção pré-flip).
  const pulse = useMemo(
    () => ({
      total: classRows.length,
      bull: classRows.filter((r) => r.trend === "bullish").length,
      bear: classRows.filter((r) => r.trend === "bearish").length,
      warm: classRows.filter((r) => trendTag(r) === "WARMUP").length,
    }),
    [classRows]
  );

  const filtered = useMemo(() => {
    let out = classRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) => r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
      );
    }
    if (trendFilter.size > 0) {
      out = out.filter((r) => trendFilter.has(trendTag(r)));
    }
    if (category) {
      out = out.filter((r) => r.categories.includes(category));
    }
    if (timeFilter !== "any") {
      const max = timeFilter === "today" ? 1.5 : timeFilter === "week" ? 7 : 31;
      out = out.filter((r) => daysSince(r.lastFlipDate) <= max);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: TerminalRow): number => {
      switch (sortKey) {
        case "rank":
          return r.rankHint;
        case "sinceFlipPct":
          return r.sinceFlipPct ?? -Infinity;
        case "since":
          return -daysSince(r.lastFlipDate); // mais recente primeiro quando desc
        case "price":
          return r.price;
        case "marketCap":
          return r.marketCap ?? -Infinity;
      }
    };
    return [...out].sort((a, b) => (val(a) - val(b)) * dir);
  }, [classRows, search, trendFilter, category, timeFilter, sortKey, sortDir]);

  function toggleTrend(t: TrendTag) {
    setTrendFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function setSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <main className="terminal">
      <header className="term-head">
        <div className="head-row">
          <div className="brand">
            <h1>🌊 DeFi Surfers</h1>
            <span className="tag">terminal de tendências</span>
          </div>
          <a className="logout" href="/api/auth/logout" title="Terminar sessão">
            Sair ↩
          </a>
        </div>
        <div className="pulse">
          <div className="stat">
            <span className="stat-k">Ativos</span>
            <span className="stat-v">{pulse.total}</span>
          </div>
          <div className="stat">
            <span className="stat-k">Bullish</span>
            <span className="stat-v bull">
              {pulse.bull}
              <em>{pulse.total ? ` ${Math.round((pulse.bull / pulse.total) * 100)}%` : ""}</em>
            </span>
          </div>
          <div className="stat">
            <span className="stat-k">Bearish</span>
            <span className="stat-v bear">
              {pulse.bear}
              <em>{pulse.total ? ` ${Math.round((pulse.bear / pulse.total) * 100)}%` : ""}</em>
            </span>
          </div>
          <div className="stat">
            <span className="stat-k">Warmup</span>
            <span className="stat-v warm">{pulse.warm}</span>
          </div>
          <div className="stat upd">
            <span className="stat-k">Última atualização</span>
            <span className="stat-v small-v">{new Date(updatedAt).toLocaleString("pt-PT")}</span>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {ASSET_CLASSES.map((c) => (
          <button
            key={c}
            className={c === activeClass ? "tab active" : "tab"}
            onClick={() => {
              setActiveClass(c);
              setCategory("");
              setExpanded(null);
            }}
          >
            {c}
          </button>
        ))}
      </nav>

      <div className="controls">
        <input
          className="search"
          placeholder="Pesquisar nome ou símbolo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="trend-chips">
          {(["BULLISH", "BEARISH", "WARMUP"] as TrendTag[]).map((t) => (
            <button
              key={t}
              className={`tchip ${TREND_CLASS[t]} ${trendFilter.has(t) ? "on" : ""}`}
              onClick={() => toggleTrend(t)}
            >
              {t === "BULLISH" ? "↑ Bullish" : t === "BEARISH" ? "↓ Bearish" : "◐ Warmup"}
            </button>
          ))}
        </div>
        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
          <option value="any">Flip: qualquer altura</option>
          <option value="today">Flip: hoje</option>
          <option value="week">Flip: esta semana</option>
          <option value="month">Flip: este mês</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="term-body">
        <div className="table-wrap">
          <table className="term-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => setSort("rank")}>
                  #{sortArrow("rank")}
                </th>
                <th className="col-heart"></th>
                <th>Ativo</th>
                <th>Trend</th>
                <th className="num sortable" onClick={() => setSort("sinceFlipPct")}>
                  Δ desde flip{sortArrow("sinceFlipPct")}
                </th>
                <th className="num sortable" onClick={() => setSort("since")}>
                  Tempo{sortArrow("since")}
                </th>
                <th className="num sortable" onClick={() => setSort("price")}>
                  Preço{sortArrow("price")}
                </th>
                <th className="num sortable" onClick={() => setSort("marketCap")}>
                  Mkt Cap{sortArrow("marketCap")}
                </th>
                <th>Estado</th>
                <th>Força</th>
                <th className="col-links"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const tag = trendTag(r);
                const fresh = daysSince(r.lastFlipDate) <= 7;
                const isOpen = expanded === r.symbol;
                const warns = warningsFor(r);
                return (
                  <FragmentRow
                    key={r.symbol}
                    r={r}
                    i={i}
                    tag={tag}
                    fresh={fresh}
                    isOpen={isOpen}
                    warns={warns}
                    onToggle={() => setExpanded(isOpen ? null : r.symbol)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty">
                    Nenhum ativo corresponde aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="side">
          <div className="panel trade-panel">
            <h3>Negociar</h3>
            <p className="muted small">
              Links de corretoras (com as tuas vantagens de referral) aparecem aqui em breve.
            </p>
            <div className="trade-slot">Bybit · em breve</div>
            <div className="trade-slot">Pionex · em breve</div>
          </div>
          <div className="panel">
            <h3>Como ler</h3>
            <p className="muted small">
              A regra de ouro: só se age em <b>ALINHADO</b>, com o flip confirmado no fecho da
              vela. <b>Warmup</b> = ainda bearish mas a aquecer (radar, não entrada). Clica numa
              linha para veres o stop (Next Flip), alvos e avisos.
            </p>
          </div>
        </aside>
      </div>

      <p className="disclaimer">
        {mock ? "⚠️ Dados demo (mock). " : ""}
        Material educativo — não é aconselhamento financeiro.
      </p>
    </main>
  );
}

function FragmentRow({
  r,
  i,
  tag,
  fresh,
  isOpen,
  warns,
  onToggle,
}: {
  r: TerminalRow;
  i: number;
  tag: TrendTag;
  fresh: boolean;
  isOpen: boolean;
  warns: Warning[];
  onToggle: () => void;
}) {
  const tvHref = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(r.tvSymbol)}`;
  const yfHref = r.yahooSymbol
    ? `https://finance.yahoo.com/quote/${encodeURIComponent(r.yahooSymbol)}`
    : null;

  return (
    <>
      <tr className={`${isOpen ? "open" : ""} ${fresh ? "fresh" : ""}`} onClick={onToggle}>
        <td className="muted">{i + 1}</td>
        <td className="col-heart">
          <span className="heart" title="Favoritos e alertas em breve">
            ♡
          </span>
        </td>
        <td className="asset">
          {r.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logoUrl} alt="" className="logo" loading="lazy" />
          ) : (
            <span className="logo logo-ph">{r.symbol.slice(0, 2)}</span>
          )}
          <span className="asset-txt">
            <span className="asset-name">{r.name}</span>
            <span className="asset-sym muted">{r.symbol}</span>
          </span>
          {fresh && <span className="badge-new">FLIP RECENTE</span>}
        </td>
        <td>
          <span className={`chip ${TREND_CLASS[tag]}`}>{tag}</span>
        </td>
        <td className={`num ${(r.sinceFlipPct ?? 0) >= 0 ? "bull" : "bear"}`}>
          {fmtPct(r.sinceFlipPct)}
        </td>
        <td className="num muted">{fmtSince(r.lastFlipDate)}</td>
        <td className="num">{fmtPrice(r.price, r.currency)}</td>
        <td className="num muted">{fmtMarketCap(r.marketCap)}</td>
        <td>
          <EstadoChip estado={r.estado} />
        </td>
        <td>
          <ForceBar strength={r.strength} />
        </td>
        <td className="col-links" onClick={(e) => e.stopPropagation()}>
          <a href={tvHref} target="_blank" rel="noopener noreferrer" title="Abrir no TradingView">
            TV
          </a>
          {yfHref && (
            <a href={yfHref} target="_blank" rel="noopener noreferrer" title="Abrir no Yahoo Finance">
              YF
            </a>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="detail-row">
          <td colSpan={11}>
            <div className="detail">
              <div className="detail-levels">
                <div className="lvl">
                  <span className="lvl-k">Next Flip (stop)</span>
                  <span className="lvl-v">{fmtPrice(r.nextFlip, r.currency)}</span>
                </div>
                <div className="lvl">
                  <span className="lvl-k">Last Flip</span>
                  <span className="lvl-v">
                    {r.lastFlip !== null ? fmtPrice(r.lastFlip, r.currency) : "—"}
                    {r.lastFlipDate && (
                      <span className="muted">
                        {" "}
                        · {new Date(r.lastFlipDate).toLocaleDateString("pt-PT")}
                      </span>
                    )}
                  </span>
                </div>
                <div className="lvl">
                  <span className="lvl-k">Desde o flip</span>
                  <span className={`lvl-v ${(r.sinceFlipPct ?? 0) >= 0 ? "bull" : "bear"}`}>
                    {fmtPct(r.sinceFlipPct)}
                  </span>
                </div>
              </div>

              {r.tp && (
                <div className="tp-row">
                  <span className="lvl-k">Alvos ATR</span>
                  {[
                    { n: 1, v: r.tp.t1, hit: r.tp.hit1 },
                    { n: 2, v: r.tp.t2, hit: r.tp.hit2 },
                    { n: 3, v: r.tp.t3, hit: r.tp.hit3 },
                  ].map((t) => (
                    <span key={t.n} className={`tp ${t.hit ? "hit" : ""}`}>
                      {t.hit ? "✅" : "⭕"} {t.n} ATR · {fmtPrice(t.v, r.currency)}
                    </span>
                  ))}
                </div>
              )}

              <div className="warn-row">
                {warns.length === 0 ? (
                  <span className="muted small">Sem avisos ativos.</span>
                ) : (
                  warns.map((w, idx) => (
                    <span key={idx} className={`warn warn-${w.tone}`} title={w.tip}>
                      {w.label}
                    </span>
                  ))
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
