"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSET_CLASSES,
  type AssetClass,
  type TerminalRow,
} from "@/lib/data/terminal";

// Tab extra além das classes de ativos: a watchlist pessoal (corações).
type TabId = AssetClass | "Watchlist";
const TABS: TabId[] = [...ASSET_CLASSES, "Watchlist"];
const WATCHLIST_STORAGE_KEY = "ds_watchlist";
const PAGE_SIZE = 20;

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

// Decisão 2026-07-05: sem estado WARMUP na UI — um ativo ou está bullish ou
// bearish (como no terminal do Ivan). Os campos warmup/cooldown continuam no
// motor/BD para uso futuro (alertas), mas não aparecem.
type TrendTag = "BULLISH" | "BEARISH";

function trendTag(r: TerminalRow): TrendTag {
  return r.trend === "bullish" ? "BULLISH" : "BEARISH";
}

const TREND_CLASS: Record<TrendTag, string> = {
  BULLISH: "t-bull",
  BEARISH: "t-bear",
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

// Preferências de alertas Telegram (guardadas no browser até o bot de envio
// estar ligado — ver painel "Alertas · Telegram" na tab Watchlist).
const ALERTS_STORAGE_KEY = "ds_alert_prefs";
interface AlertPrefs {
  flips: boolean; // flip semanal bull/bear num ativo da watchlist
  signals: boolean; // avisos de possível topo/fundo e divergências
  digest: boolean; // resumo diário da watchlist
  telegram: string; // @username ou nº do Telegram
}
const DEFAULT_PREFS: AlertPrefs = { flips: true, signals: false, digest: false, telegram: "" };

export default function Terminal({
  rows,
  updatedAt,
  mock,
}: {
  rows: TerminalRow[];
  updatedAt: string;
  mock: boolean;
}) {
  const [activeClass, setActiveClass] = useState<TabId>("Cripto");
  const [search, setSearch] = useState("");
  const [trendFilter, setTrendFilter] = useState<Set<TrendTag>>(new Set());
  const [category, setCategory] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [alignedOnly, setAlignedOnly] = useState(false);
  const [cheapOnly, setCheapOnly] = useState(false);
  const [signalFilter, setSignalFilter] = useState<string>("any");
  // Ordenação por defeito: ranking de market cap (como o terminal do Ivan).
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Watchlist pessoal, persistida no browser (a versão por membro no Supabase
  // + alertas de flip é a fase seguinte).
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) setWatchlist(new Set(saved as string[]));
    } catch {
      /* watchlist corrompida → começa vazia */
    }
  }, []);
  function toggleWatch(symbol: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* armazenamento indisponível — mantém só em memória */
      }
      return next;
    });
  }

  const classRows = useMemo(
    () =>
      activeClass === "Watchlist"
        ? rows.filter((r) => watchlist.has(r.symbol))
        : rows.filter((r) => r.assetClass === activeClass),
    [rows, activeClass, watchlist]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    classRows.forEach((r) => r.categories.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [classRows]);

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
    if (alignedOnly) {
      out = out.filter((r) => r.estado === "ALIGNED BULL" || r.estado === "ALIGNED BEAR");
    }
    if (cheapOnly) {
      out = out.filter((r) => r.cheapZone);
    }
    if (signalFilter === "bottom") {
      out = out.filter((r) => r.dotBottom || r.bullDiv);
    } else if (signalFilter === "top") {
      out = out.filter((r) => r.dotTop || r.bearDiv);
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
  }, [
    classRows,
    search,
    trendFilter,
    category,
    timeFilter,
    alignedOnly,
    cheapOnly,
    signalFilter,
    sortKey,
    sortDir,
  ]);

  // Stats sobre o conjunto FILTRADO (como no terminal do Ivan: com o filtro
  // bearish ativo, "BULLISH 0 (0%)").
  const pulse = useMemo(() => {
    const total = filtered.length;
    const bull = filtered.filter((r) => r.trend === "bullish").length;
    const bear = total - bull;
    const mcap = filtered.reduce((sum, r) => sum + (r.marketCap ?? 0), 0);
    return { total, bull, bear, mcap };
  }, [filtered]);

  // Paginação: 20 por página; clamp quando os filtros encolhem o conjunto.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  function toggleTrend(t: TrendTag) {
    setPage(1);
    setTrendFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  // Preferências de alertas Telegram (persistidas no browser).
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS);
  const [prefsSaved, setPrefsSaved] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) ?? "null");
      if (saved && typeof saved === "object") setPrefs({ ...DEFAULT_PREFS, ...saved });
    } catch {
      /* preferências corrompidas → defaults */
    }
  }, []);
  function savePrefs() {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(prefs));
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } catch {
      /* armazenamento indisponível */
    }
  }
  function setPref<K extends keyof AlertPrefs>(k: K, v: AlertPrefs[K]) {
    setPrefsSaved(false);
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  function setSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <main className="terminal">
      <header className="term-head">
        <div className="topbar">
          <div className="brand">
            <h1>🌊 DeFi Surfers</h1>
          </div>
          <nav className="tabs">
            {TABS.map((c) => (
              <button
                key={c}
                className={c === activeClass ? "tab active" : "tab"}
                onClick={() => {
                  setActiveClass(c);
                  setCategory("");
                  setExpanded(null);
                  setPage(1);
                  setSortKey("rank");
                  setSortDir("asc");
                }}
              >
                {c === "Watchlist" ? `♥ Watchlist${watchlist.size ? ` (${watchlist.size})` : ""}` : c}
              </button>
            ))}
          </nav>
          <a className="logout" href="/api/auth/logout" title="Terminar sessão">
            Sair ↩
          </a>
        </div>

        <div className="pulse">
          <div className="profile">
            <span className="avatar">🌊</span>
            <div className="profile-txt">
              <span className="profile-name">DeFi Surfer</span>
              <span className="profile-sub">membro</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-k">Total Market Cap</span>
            <span className="stat-v">{pulse.mcap > 0 ? fmtMarketCap(pulse.mcap) : "—"}</span>
          </div>
          <div className="stat">
            <span className="stat-k">Total Ativos</span>
            <span className="stat-v">{pulse.total}</span>
          </div>
          <div className="stat">
            <span className="stat-k">Bullish</span>
            <span className="stat-v bull">
              <em>({pulse.total ? Math.round((pulse.bull / pulse.total) * 100) : 0}%)</em>{" "}
              {pulse.bull}
            </span>
          </div>
          <div className="stat">
            <span className="stat-k">Bearish</span>
            <span className="stat-v bear">
              <em>({pulse.total ? Math.round((pulse.bear / pulse.total) * 100) : 0}%)</em>{" "}
              {pulse.bear}
            </span>
          </div>
          <div className="stat upd">
            <span className="stat-k">Última atualização</span>
            <span className="stat-v small-v">{new Date(updatedAt).toLocaleString("pt-PT")}</span>
          </div>
        </div>
      </header>

      <div className="searchbar">
        <input
          className="search"
          placeholder="Pesquisar nome ou símbolo…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="controls">
        <div className="trend-chips">
          {(["BULLISH", "BEARISH"] as TrendTag[]).map((t) => (
            <button
              key={t}
              className={`tchip ${TREND_CLASS[t]} ${trendFilter.has(t) ? "on" : ""}`}
              onClick={() => toggleTrend(t)}
            >
              {t === "BULLISH" ? "↑ Bullish" : "↓ Bearish"}
            </button>
          ))}
        </div>
        <button
          className={`tchip t-aligned ${alignedOnly ? "on" : ""}`}
          title="Weekly e Daily na mesma direção — a única zona onde a estratégia age"
          onClick={() => {
            setAlignedOnly((v) => !v);
            setPage(1);
          }}
        >
          ⚡ Alinhados
        </button>
        <button
          className={`tchip t-cheap ${cheapOnly ? "on" : ""}`}
          title="Preço abaixo da média de 200 semanas — zona histórica de fundo"
          onClick={() => {
            setCheapOnly((v) => !v);
            setPage(1);
          }}
        >
          💎 Zona barata
        </button>
        <select
          value={timeFilter}
          onChange={(e) => {
            setTimeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="any">Flip: qualquer altura</option>
          <option value="today">Flip: hoje</option>
          <option value="week">Flip: esta semana</option>
          <option value="month">Flip: este mês</option>
        </select>
        <select
          value={signalFilter}
          onChange={(e) => {
            setSignalFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="any">Sinais: todos</option>
          <option value="bottom">Sinais: possível fundo</option>
          <option value="top">Sinais: possível topo</option>
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
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
                <th className="num sortable col-delta" onClick={() => setSort("sinceFlipPct")}>
                  Δ desde flip{sortArrow("sinceFlipPct")}
                </th>
                <th className="num sortable col-tempo" onClick={() => setSort("since")}>
                  Tempo{sortArrow("since")}
                </th>
                <th className="num sortable" onClick={() => setSort("price")}>
                  Preço{sortArrow("price")}
                </th>
                <th className="num sortable col-mcap" onClick={() => setSort("marketCap")}>
                  Mkt Cap{sortArrow("marketCap")}
                </th>
                <th className="col-links"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const tag = trendTag(r);
                const fresh = daysSince(r.lastFlipDate) <= 7;
                const isOpen = expanded === r.symbol;
                const warns = warningsFor(r);
                return (
                  <FragmentRow
                    key={r.symbol}
                    r={r}
                    i={(safePage - 1) * PAGE_SIZE + i}
                    tag={tag}
                    fresh={fresh}
                    isOpen={isOpen}
                    warns={warns}
                    watched={watchlist.has(r.symbol)}
                    onWatch={() => toggleWatch(r.symbol)}
                    onToggle={() => setExpanded(isOpen ? null : r.symbol)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    {activeClass === "Watchlist"
                      ? "A tua watchlist está vazia — clica no ♥ de um ativo para o acompanhares aqui."
                      : "Nenhum ativo corresponde aos filtros."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                ‹ Anterior
              </button>
              <span className="page-info">
                Página {safePage} de {totalPages} · {filtered.length} ativos
              </span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                Seguinte ›
              </button>
            </div>
          )}
        </div>

        <aside className="side">
          {activeClass === "Watchlist" && (
            <div className="panel alerts-panel">
              <h3>Alertas · Telegram</h3>
              <p className="muted small">
                Recebe no Telegram os eventos dos ativos que marcaste com ♥.
              </p>
              <label className="alert-opt">
                <input
                  type="checkbox"
                  checked={prefs.flips}
                  onChange={(e) => setPref("flips", e.target.checked)}
                />
                <span>
                  <b>Flips semanais</b>
                  <em>quando um ativo vira bullish/bearish no fecho</em>
                </span>
              </label>
              <label className="alert-opt">
                <input
                  type="checkbox"
                  checked={prefs.signals}
                  onChange={(e) => setPref("signals", e.target.checked)}
                />
                <span>
                  <b>Avisos de topo/fundo</b>
                  <em>dots Daily-vs-Weekly e divergências</em>
                </span>
              </label>
              <label className="alert-opt">
                <input
                  type="checkbox"
                  checked={prefs.digest}
                  onChange={(e) => setPref("digest", e.target.checked)}
                />
                <span>
                  <b>Resumo diário</b>
                  <em>estado da watchlist, uma mensagem por dia</em>
                </span>
              </label>
              <input
                className="alert-input"
                placeholder="@teu_username no Telegram"
                value={prefs.telegram}
                onChange={(e) => setPref("telegram", e.target.value)}
              />
              <button className="trade-btn btn-save" onClick={savePrefs}>
                {prefsSaved ? "Guardado ✓" : "Guardar preferências"}
              </button>
              <p className="muted small alerts-note">
                🔧 Envio em preparação — as tuas escolhas ficam guardadas e ativam-se
                automaticamente quando o bot da comunidade estiver ligado.
              </p>
            </div>
          )}
          <div className="panel trade-panel">
            <h3>Negociar</h3>
            <p className="muted small">
              Abre conta com os links da comunidade e garante as vantagens de referral.
            </p>
            <a
              className="trade-btn"
              href="https://my.okx.com/en-eu/welcome-rewards?channelID=94234435"
              target="_blank"
              rel="noopener noreferrer"
            >
              Criar conta na OKX ↗
            </a>
            <div className="trade-slot">Bybit · em breve</div>
            <div className="trade-slot">Pionex · em breve</div>
          </div>
          <div className="panel">
            <h3>Como ler</h3>
            <p className="muted small">
              A regra de ouro: só se age em <b>ALINHADO</b>, com o flip confirmado no fecho da
              vela. Clica numa linha para veres o stop (Next Flip), os alvos em ATR e os avisos
              de topo/fundo.
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
  watched,
  onWatch,
  onToggle,
}: {
  r: TerminalRow;
  i: number;
  tag: TrendTag;
  fresh: boolean;
  isOpen: boolean;
  warns: Warning[];
  watched: boolean;
  onWatch: () => void;
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
        <td className="col-heart" onClick={(e) => e.stopPropagation()}>
          <button
            className={`heart ${watched ? "on" : ""}`}
            title={watched ? "Remover da watchlist" : "Adicionar à watchlist"}
            onClick={onWatch}
          >
            {watched ? "♥" : "♡"}
          </button>
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
        <td className={`num col-delta ${(r.sinceFlipPct ?? 0) >= 0 ? "bull" : "bear"}`}>
          {fmtPct(r.sinceFlipPct)}
        </td>
        <td className="num muted col-tempo">{fmtSince(r.lastFlipDate)}</td>
        <td className="num">{fmtPrice(r.price, r.currency)}</td>
        <td className="num muted col-mcap">{fmtMarketCap(r.marketCap)}</td>
        <td className="col-links" onClick={(e) => e.stopPropagation()}>
          <div className="links-stack">
            <a
              href={tvHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir gráfico no TradingView"
              className="link-ico"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <rect x="1.5" y="8" width="3" height="6.5" rx="0.8" />
                <rect x="6.5" y="4.5" width="3" height="10" rx="0.8" />
                <rect x="11.5" y="1.5" width="3" height="13" rx="0.8" />
              </svg>
            </a>
            {yfHref && (
              <a
                href={yfHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Yahoo Finance"
                className="link-ico yf-mark"
              >
                y!
              </a>
            )}
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="detail-row">
          <td colSpan={9}>
            <div className="detail">
              <div className="detail-levels">
                <div className="lvl">
                  <span className="lvl-k">Estado (Weekly/Daily)</span>
                  <span className="lvl-v">
                    <EstadoChip estado={r.estado} />
                  </span>
                </div>
                <div className="lvl">
                  <span className="lvl-k">Força</span>
                  <span className="lvl-v">
                    <ForceBar strength={r.strength} />
                  </span>
                </div>
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
