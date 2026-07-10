"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Maré (breadth): mapa da tab → classe do endpoint /api/public/breadth.
const BREADTH_CLASS: Partial<Record<TabId, string>> = {
  Cripto: "cripto",
  Ações: "acoes",
  ETFs: "etf_cmd_idx",
  Commodities: "etf_cmd_idx",
  Índices: "etf_cmd_idx",
};
const BREADTH_LABEL: Record<string, string> = {
  cripto: "Cripto",
  acoes: "Ações",
  etf_cmd_idx: "ETFs, Commodities e Índices",
};

interface BreadthPoint {
  date: string;
  pct: number;
}
interface BreadthData {
  series: BreadthPoint[];
  latest: { pct: number } | null;
  deltaPp7d: number | null;
}

// Chip da Maré no pulso: sparkline dos ~90 dias + delta em pontos percentuais.
// Estado vazio honesto enquanto o histórico não acumula (ações/ETFs).
function MareChip({ cls, onOpen }: { cls: string; onOpen: () => void }) {
  const [data, setData] = useState<BreadthData | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Map<string, BreadthData>>(new Map());

  useEffect(() => {
    const cached = cacheRef.current.get(cls);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/public/breadth?class=${cls}&days=90`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const d: BreadthData = j?.ok
          ? { series: j.series ?? [], latest: j.latest, deltaPp7d: j.deltaPp7d }
          : { series: [], latest: null, deltaPp7d: null };
        cacheRef.current.set(cls, d);
        setData(d);
      })
      .catch(() => alive && setData({ series: [], latest: null, deltaPp7d: null }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cls]);

  const series = data?.series ?? [];
  const enough = series.length >= 8;

  const path = useMemo(() => {
    if (!enough) return "";
    const w = 108,
      h = 30;
    const pts = series.map((p) => p.pct);
    const lo = Math.min(...pts, 40),
      hi = Math.max(...pts, 60);
    const x = (i: number) => (i / (series.length - 1)) * w;
    const y = (v: number) => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4);
    const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
    const mid = y(50);
    return { line, area: `${line} L${w},${h} L0,${h} Z`, mid, w, h };
  }, [series, enough]);

  const pct = data?.latest?.pct ?? null;
  const delta = data?.deltaPp7d ?? null;
  const clickable = enough;

  return (
    <div
      className={`stat mare-stat${clickable ? " mare-clickable" : ""}`}
      onClick={clickable ? onOpen : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onOpen() : undefined}
      title={clickable ? "Ver a Maré em detalhe" : undefined}
    >
      <span className="stat-k">Maré · 90d {clickable && <span className="mare-expand">⤢</span>}</span>
      {loading ? (
        <span className="mare-empty">a carregar…</span>
      ) : !enough ? (
        <span className="mare-empty">a acumular histórico…</span>
      ) : (
        <div className="mare-row">
          <svg className="mare-spark" width={(path as { w: number }).w} height={(path as { h: number }).h} viewBox={`0 0 ${(path as { w: number }).w} ${(path as { h: number }).h}`} aria-hidden="true">
            <line x1="0" x2={(path as { w: number }).w} y1={(path as { mid: number }).mid} y2={(path as { mid: number }).mid} className="mare-mid" />
            <path d={(path as { area: string }).area} className="mare-area" />
            <path d={(path as { line: string }).line} className="mare-line" />
          </svg>
          <span className="mare-meta">
            <b className={pct !== null && pct >= 50 ? "bull" : "bear"}>{pct !== null ? Math.round(pct) : "—"}%</b>
            {delta !== null && (
              <em className={delta >= 0 ? "bull" : "bear"}>
                {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
                {delta}%/7d
              </em>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

interface BreadthFull {
  date: string;
  bull: number;
  bear: number;
  total: number;
  pct: number;
}

// Painel expansível da Maré (fase 2): área do % bullish com seletor de período
// e crosshair (data + % + contagem bull/bear na semana). Fecha com ✕/fora/Esc.
function MarePanel({ cls, label, onClose }: { cls: string; label: string; onClose: () => void }) {
  const RANGES: Array<[string, number]> = [
    ["30d", 30],
    ["90d", 90],
    ["1a", 365],
    ["Tudo", 3650],
  ];
  const [days, setDays] = useState(365);
  const [series, setSeries] = useState<BreadthFull[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setSeries(null);
    fetch(`/api/public/breadth?class=${cls}&days=${days}`)
      .then((r) => r.json())
      .then((j) => alive && setSeries(j?.ok ? (j.series ?? []) : []))
      .catch(() => alive && setSeries([]));
    return () => {
      alive = false;
    };
  }, [cls, days]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const W = 760,
    H = 300,
    padL = 34,
    padR = 12,
    padT = 14,
    padB = 26;
  const iw = W - padL - padR,
    ih = H - padT - padB;
  const n = series?.length ?? 0;
  const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * iw : 0);
  const y = (v: number) => padT + ih - (v / 100) * ih;

  const geom = useMemo(() => {
    if (!series || n < 2) return null;
    const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join("");
    const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
    const years: Array<{ i: number; y: number }> = [];
    let lastYr = 0;
    series.forEach((p, i) => {
      const yr = Number(p.date.slice(0, 4));
      if (yr !== lastYr) {
        years.push({ i, y: yr });
        lastYr = yr;
      }
    });
    return { line, area, years };
  }, [series, n]);

  const cur = hover !== null && series ? series[hover] : null;

  return (
    <div className="mare-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mare-card">
        <button className="mare-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
        <div className="mare-head">
          <span className="mare-title">
            Maré do mercado — <b>{label}</b>
          </span>
          <div className="mare-ranges">
            {RANGES.map(([lbl, d]) => (
              <button key={lbl} className={days === d ? "on" : ""} onClick={() => setDays(d)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {!series ? (
          <div className="mare-panel-empty">a carregar…</div>
        ) : n < 2 ? (
          <div className="mare-panel-empty">Sem histórico suficiente para este período ainda.</div>
        ) : (
          <>
            <div className="mare-chart-wrap">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mare-chart"
                onPointerMove={(e) => {
                  const r = (e.currentTarget as SVGElement).getBoundingClientRect();
                  const px = ((e.clientX - r.left) * W) / r.width;
                  let i = Math.round(((px - padL) / iw) * (n - 1));
                  i = Math.max(0, Math.min(n - 1, i));
                  setHover(i);
                }}
                onPointerLeave={() => setHover(null)}
              >
                <rect x={padL} y={padT} width={iw} height={ih} className="mare-plot" />
                {[25, 50, 75].map((t) => (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={W - padR}
                      y1={y(t)}
                      y2={y(t)}
                      className={t === 50 ? "mare-mid50" : "mare-grid"}
                    />
                    <text x={padL - 6} y={y(t) + 3} className="mare-tick" textAnchor="end">
                      {t}
                    </text>
                  </g>
                ))}
                {geom?.years.map((yr) => (
                  <text key={yr.y} x={x(yr.i)} y={H - 8} className="mare-tick" textAnchor="middle">
                    {yr.y}
                  </text>
                ))}
                <path d={geom!.area} className="mare-panel-area" />
                <path d={geom!.line} className="mare-panel-line" />
                {cur && hover !== null && (
                  <g>
                    <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} className="mare-xh" />
                    <circle cx={x(hover)} cy={y(cur.pct)} r={4} className="mare-xh-dot" />
                  </g>
                )}
              </svg>
              {cur && (
                <div
                  className="mare-tip"
                  style={{ left: `${Math.min(Math.max((x(hover!) / W) * 100, 8), 78)}%` }}
                >
                  <span className="d">{cur.date}</span>
                  <span className={cur.pct >= 50 ? "bull" : "bear"}>
                    {Math.round(cur.pct)}% bullish
                  </span>
                  <span className="c">
                    {cur.bull} verde · {cur.bear} vermelho
                  </span>
                </div>
              )}
            </div>
            <p className="mare-foot">
              % de ativos com tendência semanal bullish. Acima de 50% = maioria verde. Histórico
              da cripto retro-calculado das velas; restantes classes acumulam a partir de agora.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

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

// FECHO real da vela do flip (ms). `lastFlipDate` é a ABERTURA da vela (2ª
// feira, âncora); o flip só é confirmado no FECHO, que DEPENDE da classe:
//   · Cripto (24/7): fecha na 2ª feira seguinte 00:00 UTC → âncora + 7 dias.
//   · Ações/ETFs/Commodities/Índices (horário de mercado): fecham na 6ª feira
//     ~21:05 UTC da semana da vela → âncora + 4 dias (2ª→6ª).
// Toda a IDADE (tempo desde o flip, tag "recente", ordenação) conta a partir
// daqui — senão um flip de ações nasceria com ~8 dias (âncora) em vez de ~4.
function flipCloseMs(lastFlipDate: string | null, assetClass: AssetClass): number | null {
  if (!lastFlipDate) return null;
  const t = new Date(lastFlipDate).getTime();
  if (assetClass === "Cripto") return t + 7 * 86_400_000;
  const d = new Date(t);
  const daysToFri = (5 - d.getUTCDay() + 7) % 7; // âncora 2ª feira → 4
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToFri, 21, 5, 0);
}

/** Idade legível a partir de um instante (ms) — ex.: "1sem 2d", "4d". */
function fmtSince(ms: number | null): string {
  if (ms === null) return "—";
  let d = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
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

// Logo com fallback: os CDNs de logos de ações (Parqet) devolvem 404 para
// alguns tickers — nesses casos cai para as iniciais em vez do ícone partido.
function AssetLogo({ logoUrl, symbol }: { logoUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) {
    return <span className="logo logo-ph">{symbol.slice(0, 2)}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="logo" loading="lazy" onError={() => setFailed(true)} />
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
  const [activeClass, setActiveClass] = useState<TabId>("Cripto");
  const [mareOpen, setMareOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [trendFilter, setTrendFilter] = useState<Set<TrendTag>>(new Set());
  const [category, setCategory] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [signalFilter, setSignalFilter] = useState<string>("any");
  // Ordenação por defeito: ranking de market cap (como o terminal do Ivan).
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false); // gaveta de filtros (mobile)
  const tabsRef = useRef<HTMLElement | null>(null);

  // Watchlist pessoal. Fonte da verdade = servidor (tabela alert_subs), com o
  // localStorage como cache otimista para UX instantânea e fallback offline.
  // No arranque: carrega o cache local (instantâneo) e, quando o servidor
  // responde, funde por UNIÃO (local ∪ servidor) — assim os corações seguem o
  // membro entre dispositivos/domínios sem nunca perder marcações locais.
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  // Só sincronizamos para o servidor DEPOIS da hidratação inicial — senão o
  // estado local (possivelmente vazio) apagaria a watchlist do servidor.
  const hydratedRef = useRef(false);
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
      // Os flips SEMANAIS são datados pela ÂNCORA da vela (2ª feira) e só se
      // confirmam no FECHO (~7 dias depois). Uma janela em dias corridos criava
      // uma "zona morta" no início da semana: o flip do último fecho já com >7
      // dias e a vela atual ainda por fechar → 0 resultados (mesma razão do
      // RECENT_DAYS=12 dos alertas). Ancoramos por SEMANAS de calendário (UTC).
      const now = new Date();
      const dowFromMon = (now.getUTCDay() + 6) % 7; // 0 = 2ª feira
      const thisMonday =
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        dowFromMon * 86_400_000;
      const weeksBack = timeFilter === "week" ? 1 : 5; // "este mês" ≈ 5 semanas
      const cutoff = thisMonday - weeksBack * 7 * 86_400_000;
      out = out.filter(
        (r) => r.lastFlipDate != null && new Date(r.lastFlipDate).getTime() >= cutoff
      );
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
          return flipCloseMs(r.lastFlipDate, r.assetClass) ?? -Infinity; // fecho mais recente primeiro (desc)
        case "price":
          return r.price;
        case "marketCap":
          return r.marketCap ?? -Infinity;
      }
    };
    return [...out].sort((a, b) => (val(a) - val(b)) * dir);
  }, [classRows, search, trendFilter, category, timeFilter, signalFilter, sortKey, sortDir]);

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
      // Ativar um trend ordena por maiores movimentos desde o flip: BULLISH →
      // maiores ganhos primeiro; BEARISH → maiores quedas primeiro. Sem chips
      // ativos, volta ao ranking por market cap.
      if (next.size === 0) {
        setSortKey("rank");
        setSortDir("asc");
      } else if (next.has("BULLISH") && !next.has("BEARISH")) {
        setSortKey("sinceFlipPct");
        setSortDir("desc");
      } else if (next.has("BEARISH") && !next.has("BULLISH")) {
        setSortKey("sinceFlipPct");
        setSortDir("asc");
      }
      return next;
    });
  }

  // Perfil Discord (nome + avatar): vem de /api/me depois de hidratar — a
  // página em si é cacheada e não pode depender do cookie de sessão.
  const [user, setUser] = useState<{ name: string | null; avatar: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setUser({ name: d.name, avatar: d.avatar });
      })
      .catch(() => {
        /* sem perfil → placeholder */
      });
  }, []);

  // Estado da ligação Telegram: bot disponível? membro ligado?
  const [alertStatus, setAlertStatus] = useState<{
    botAvailable: boolean;
    linked: boolean;
    username: string | null;
  } | null>(null);
  const [linking, setLinking] = useState(false);

  const refreshAlertStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/alerts/status");
      if (!r.ok) return;
      const d = await r.json();
      if (!d?.ok) return;
      setAlertStatus({ botAvailable: d.botAvailable, linked: d.linked, username: d.username });
      // Hidratação inicial da watchlist (uma vez): funde local ∪ servidor. As
      // chamadas seguintes (ex.: após ligar o Telegram) só atualizam o estado
      // do bot e NÃO voltam a mexer na watchlist.
      if (!hydratedRef.current) {
        if (Array.isArray(d.watchlist)) {
          setWatchlist((local) => new Set([...local, ...(d.watchlist as string[])]));
        }
        hydratedRef.current = true;
      }
    } catch {
      /* sem estado → mantém placeholder */
    }
  }, []);
  useEffect(() => {
    refreshAlertStatus();
  }, [refreshAlertStatus]);

  async function linkTelegram() {
    setLinking(true);
    try {
      const r = await fetch("/api/alerts/link", { method: "POST" });
      const d = await r.json();
      if (d?.ok && d.url) {
        window.open(d.url, "_blank", "noopener");
        // O membro confirma no Telegram; refrescamos o estado a seguir.
        setTimeout(refreshAlertStatus, 6000);
        setTimeout(refreshAlertStatus, 15000);
      }
    } catch {
      /* ignora — o botão volta ao estado inicial */
    } finally {
      setLinking(false);
    }
  }

  // Sincroniza a watchlist para o servidor (fonte da verdade entre
  // dispositivos). Corre para qualquer sessão válida — mesmo sem o Telegram
  // ligado — mas só DEPOIS da hidratação, para não sobrescrever o servidor
  // com o estado local inicial. Sem sessão (dev/mock) o 401 é ignorado.
  // Decisão 2026-07-06: UMA só notificação (flip da watchlist) — sem menu de
  // preferências; ligar o Telegram É a preferência. signals/digest ficam
  // false na BD até existirem como funcionalidades reais.
  useEffect(() => {
    if (!hydratedRef.current) return;
    fetch("/api/alerts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flips: true,
        signals: false,
        digest: false,
        watchlist: [...watchlist],
      }),
    }).catch(() => {});
  }, [watchlist]);

  function setSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  // Mobile: quando a classe ativa muda, centra a tab na faixa deslizante — a
  // tab selecionada fica sempre visível mesmo quando as tabs transbordam.
  useEffect(() => {
    const strip = tabsRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLElement>(`[data-tab="${activeClass}"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeClass]);

  return (
    <main className="terminal">
      <header className="term-head">
        <div className="topbar">
          <div className="brand">
            <h1>📡 Radar do Swell</h1>
            <span className="tag brand-sub">by DeFi Surfers</span>
          </div>
          <nav className="tabs" ref={tabsRef}>
            {TABS.map((c) => (
              <button
                key={c}
                data-tab={c}
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
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="avatar avatar-img" />
            ) : (
              <span className="avatar">🌊</span>
            )}
            <div className="profile-txt">
              <span className="profile-name">{user?.name || "DeFi Surfer"}</span>
              <span className="profile-sub">DeFi Surfer</span>
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
          {activeClass !== "Watchlist" && BREADTH_CLASS[activeClass] && (
            <MareChip cls={BREADTH_CLASS[activeClass]!} onOpen={() => setMareOpen(true)} />
          )}
          <span className="upd-note">
            Última atualização: {new Date(updatedAt).toLocaleString("pt-PT")}
          </span>
        </div>
      </header>

      {mareOpen && activeClass !== "Watchlist" && BREADTH_CLASS[activeClass] && (
        <MarePanel
          cls={BREADTH_CLASS[activeClass]!}
          label={BREADTH_LABEL[BREADTH_CLASS[activeClass]!]}
          onClose={() => setMareOpen(false)}
        />
      )}

      <div className="controls">
        <input
          className="search"
          placeholder="Pesquisar nome ou símbolo…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
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
          className="filters-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          {(() => {
            const n = (timeFilter !== "any" ? 1 : 0) + (signalFilter !== "any" ? 1 : 0) + (category ? 1 : 0);
            return `⚙ Filtros${n ? ` (${n})` : ""}`;
          })()}
        </button>
        <div className={`filters-extra ${filtersOpen ? "open" : ""}`}>
        <select
          value={timeFilter}
          onChange={(e) => {
            setTimeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="any">Flip: qualquer altura</option>
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
                  Desde o flip{sortArrow("sinceFlipPct")}
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
                // "FLIP RECENTE": idade desde o FECHO da vela (flipCloseMs — cripto
                // 2ª+7d, mercado 6ª 21:05). Ligado no fecho (idade 0), visível 2
                // semanas depois. (14 → 7 se quiseres 1 semana.)
                const closeMs = flipCloseMs(r.lastFlipDate, r.assetClass);
                const fresh = closeMs !== null && Date.now() - closeMs <= 14 * 86_400_000;
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
                Um ativo com ♥ vira bullish ou bearish no fecho da vela semanal → recebes a
                mensagem no Telegram. Simples assim.
              </p>
              {alertStatus && !alertStatus.botAvailable ? (
                <p className="muted small alerts-note">
                  🔧 O bot de alertas está a ser configurado — fica ativo em breve.
                </p>
              ) : alertStatus?.linked ? (
                <>
                  <div className="alert-linked">
                    ✅ Telegram ligado{alertStatus.username ? ` · @${alertStatus.username}` : ""}
                  </div>
                  <p className="muted small alerts-note">
                    Envia <b>/stop</b> ao bot para desligar a qualquer momento.
                  </p>
                </>
              ) : (
                <>
                  <button className="trade-btn btn-tg" onClick={linkTelegram} disabled={linking}>
                    {linking ? "A abrir o Telegram…" : "🔗 Ligar Telegram"}
                  </button>
                  <p className="muted small alerts-note">
                    Liga uma vez e está feito — sem configurações.
                  </p>
                </>
              )}
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
            <a
              className="trade-btn trade-btn-bybit"
              href="https://www.bybit.eu/en-EU/sign-up?affiliate_id=138621&group_id=1414396&group_type=1&ref_code=138621&redirectType=globalModalGuideEu"
              target="_blank"
              rel="noopener noreferrer"
            >
              Criar conta na Bybit ↗
            </a>
          </div>
          <details className="panel panel-details">
            <summary>Como ler</summary>
            <p className="muted small">
              Cada linha mostra a tendência semanal que o indicador identifica. <b>ALINHADO</b> = o
              semanal e o diário concordam; <b>CONFLITO</b> = divergem. Toca numa linha para veres os
              níveis do indicador: o <i>Next Flip</i> (onde a tendência inverteria), as referências em
              ATR e os avisos de possível topo/fundo.
            </p>
            <a className="guia-link" href="/guia">
              📖 Guia completo da Linha do Swell
            </a>
            <p className="muted small" style={{ marginTop: 8 }}>
              Material educativo — não é recomendação nem aconselhamento financeiro.
            </p>
          </details>
        </aside>
      </div>

      <p className="disclaimer">
        {mock ? "⚠️ Dados demo (mock). " : ""}
        Os DeFi Surfers são uma comunidade de educação e ferramentas de análise. Todo o conteúdo
        desta plataforma é estritamente educativo e informativo — nada aqui constitui recomendação
        de compra ou venda de qualquer ativo, nem aconselhamento financeiro. Referências a
        desempenho passado são meramente ilustrativas e não representam resultados típicos ou
        garantidos. As decisões, e o risco, são sempre teus.
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
        {/* # = ranking real de market cap do ativo (rankHint), NÃO a posição
            da linha — mantém-se estável ao filtrar/ordenar. 9999 = sem rank. */}
        <td className="muted col-rank">{r.rankHint < 9999 ? r.rankHint : "—"}</td>
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
          <div className={`asset-inner${fresh ? " has-flip" : ""}`}>
            <AssetLogo logoUrl={r.logoUrl} symbol={r.symbol} />
            <span className="asset-txt">
              <span className="asset-name" title={r.name}>{r.name}</span>
              <span className="asset-sym muted">{r.symbol}</span>
            </span>
            {fresh && <span className="badge-new">FLIP RECENTE</span>}
          </div>
        </td>
        <td className="col-trend">
          <span className={`chip ${TREND_CLASS[tag]}`}>{tag}</span>
        </td>
        <td className={`num col-delta ${(r.sinceFlipPct ?? 0) >= 0 ? "bull" : "bear"}`}>
          {fmtPct(r.sinceFlipPct)}
        </td>
        <td className="num muted col-tempo">{fmtSince(flipCloseMs(r.lastFlipDate, r.assetClass))}</td>
        <td className="num col-price">{fmtPrice(r.price, r.currency)}</td>
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
                        · {new Date(flipCloseMs(r.lastFlipDate, r.assetClass)!).toLocaleDateString("pt-PT")}
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

              {/* Links (TV/Yahoo): saem da linha no mobile, ficam aqui acessíveis. */}
              <div className="detail-links" onClick={(e) => e.stopPropagation()}>
                <a href={tvHref} target="_blank" rel="noopener noreferrer" className="detail-link">
                  📈 TradingView
                </a>
                {yfHref && (
                  <a href={yfHref} target="_blank" rel="noopener noreferrer" className="detail-link">
                    y! Yahoo Finance
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
