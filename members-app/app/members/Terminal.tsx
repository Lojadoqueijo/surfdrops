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

// Maré (breadth): retirada do terminal a 2026-07-10 (confundia ao lado do
// pulso — populações/tempos diferentes). Continua viva na página pública
// /mercado do hub, servida por /api/public/breadth + gravação diária no cron.

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

/** Fecho da vela DIÁRIA do flip: cripto = dia seguinte 00:00 UTC; mercado = 21:05 do próprio dia. */
function dailyFlipCloseMs(lastFlipDate: string | null, assetClass: AssetClass): number | null {
  if (!lastFlipDate) return null;
  const t = new Date(lastFlipDate).getTime();
  if (assetClass === "Cripto") return t + 86_400_000;
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 21, 5, 0);
}

/** Dias corridos desde uma data ISO (Infinity quando null) — janela do modo diário. */
function daysSinceIso(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
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
type TrendTag = "BULLISH" | "BEARISH" | "NOVO";

// "NOVO" = recém-listado, linha semanal a aquecer (ex.: SPCX pós-IPO) —
// visível sem sinal; os filtros Bullish/Bearish escondem-no por definição.
function trendTag(r: TerminalRow): TrendTag {
  if (r.trend === "novo") return "NOVO";
  return r.trend === "bullish" ? "BULLISH" : "BEARISH";
}

const TREND_CLASS: Record<TrendTag, string> = {
  BULLISH: "t-bull",
  BEARISH: "t-bear",
  NOVO: "t-novo",
};

// Badge de país junto ao símbolo — só para ativos fora dos EUA (a informação
// útil é "este é o diferente"; bandeira em 3.000 linhas americanas era ruído).
// Código ISO em texto de propósito: emoji de bandeira não renderiza no Windows.
const COUNTRY_NAMES: Record<string, string> = {
  JP: "Japão",
  GB: "Reino Unido",
  DE: "Alemanha",
  FR: "França",
  CH: "Suíça",
  NL: "Países Baixos",
  BE: "Bélgica",
  DK: "Dinamarca",
  ES: "Espanha",
  IT: "Itália",
  PT: "Portugal",
  SE: "Suécia",
  CA: "Canadá",
  AU: "Austrália",
  BR: "Brasil",
  MX: "México",
  IN: "Índia",
  KR: "Coreia do Sul",
  TW: "Taiwan",
  HK: "Hong Kong",
  CN: "China",
  SG: "Singapura",
  ID: "Indonésia",
  EU: "Zona Euro",
};

// Janela "tempo desde o flip" em SEMANAS de calendário (âncora 2ª feira UTC —
// ver nota na filtragem sobre a "zona morta" dos flips semanais).
const WEEKS_BACK: Record<string, number> = { week: 1, month: 5, q: 13, semester: 26, year: 52 };

// Baldes de market cap (USD). Internacionais têm mcap null → fora quando ativo.
const MCAP_BUCKETS: Record<string, [number, number]> = {
  mega: [200e9, Infinity],
  large: [10e9, 200e9],
  mid: [2e9, 10e9],
  small: [0, 2e9],
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
      label: "Zona de 200WMA",
      tone: "good",
      tip: "Preço abaixo da média de 200 semanas — historicamente a zona de acumulação do ciclo.",
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
  const [search, setSearch] = useState("");
  const [trendFilter, setTrendFilter] = useState<Set<TrendTag>>(new Set());
  const [category, setCategory] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<string>("any");
  const [signalFilter, setSignalFilter] = useState<string>("any");
  const [countryFilter, setCountryFilter] = useState<string>(""); // ISO ou "" = todos
  const [mcapFilter, setMcapFilter] = useState<string>(""); // mega/large/mid/small
  // Timeframe da leitura da Linha: semanal (default, a base dos alertas) ou
  // diário (vista de exploração — os alertas ficam SEMPRE no semanal).
  const [timeframe, setTimeframe] = useState<"weekly" | "daily">("weekly");
  const [cheapOnly, setCheapOnly] = useState(false); // só zona barata (200W)
  const [nearAthOnly, setNearAthOnly] = useState(false); // a ≤10% do máximo histórico
  // Ordenação por defeito: ranking de market cap (como o terminal do Ivan).
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Mobile (≤820px): o painel de filtros vira bottom-sheet — no fluxo normal
  // ficava DEPOIS da tabela inteira e ninguém o encontrava. No desktop este
  // estado é inerte (o painel está sempre visível no aside).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tabsRef = useRef<HTMLElement | null>(null);

  // Bottom-sheet dos filtros: Escape fecha; scroll do body bloqueado enquanto aberto.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("sheet-open");
    };
  }, [filtersOpen]);

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

  // Países presentes nesta classe (para o dropdown). US primeiro por ser o
  // maior; o resto por nome. Só aparece o filtro quando há >1 país.
  const countriesInClass = useMemo(() => {
    const set = new Set<string>();
    classRows.forEach((r) => {
      if (r.country) set.add(r.country);
    });
    return [...set].sort((a, b) =>
      a === "US" ? -1 : b === "US" ? 1 : (COUNTRY_NAMES[a] ?? a).localeCompare(COUNTRY_NAMES[b] ?? b)
    );
  }, [classRows]);

  const filtered = useMemo(() => {
    // Vista DIÁRIA: troca os campos de flip (trend/next/desde/data) pelo bundle
    // diário. Ativos sem leitura diária válida (linha ainda NaN) são excluídos,
    // tal como o guard semanal. A vista semanal usa os campos originais.
    let out: TerminalRow[] =
      timeframe === "daily"
        ? classRows.flatMap((r) =>
            r.daily && r.daily.trend
              ? [
                  {
                    ...r,
                    trend: r.daily.trend as "bullish" | "bearish",
                    sinceFlipPct: r.daily.sinceFlipPct,
                    lastFlipDate: r.daily.lastFlipDate,
                    nextFlip: r.daily.nextFlip,
                    lastFlip: r.daily.lastFlip,
                  },
                ]
              : []
          )
        : classRows;
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
      if (timeframe === "daily") {
        // Diário: o flip é datado ao DIA do fecho (não a uma âncora semanal),
        // por isso a janela em dias corridos é correta e "hoje" faz sentido.
        const maxDays =
          timeFilter === "today" ? 1.5 : (WEEKS_BACK[timeFilter] ?? 5) * 7 + 3;
        out = out.filter((r) => daysSinceIso(r.lastFlipDate) <= maxDays);
      } else {
        // Semanal: os flips são datados pela ÂNCORA da vela (2ª feira) e só se
        // confirmam no FECHO (~7 dias depois). Uma janela em dias corridos criava
        // uma "zona morta" no início da semana: o flip do último fecho já com >7
        // dias e a vela atual ainda por fechar → 0 resultados (mesma razão do
        // RECENT_DAYS=12 dos alertas). Ancoramos por SEMANAS de calendário (UTC).
        const now = new Date();
        const dowFromMon = (now.getUTCDay() + 6) % 7; // 0 = 2ª feira
        const thisMonday =
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
          dowFromMon * 86_400_000;
        const weeksBack = WEEKS_BACK[timeFilter] ?? 5;
        const cutoff = thisMonday - weeksBack * 7 * 86_400_000;
        out = out.filter(
          (r) => r.lastFlipDate != null && new Date(r.lastFlipDate).getTime() >= cutoff
        );
      }
    }
    if (signalFilter === "bottom") {
      out = out.filter((r) => r.dotBottom || r.bullDiv);
    } else if (signalFilter === "top") {
      out = out.filter((r) => r.dotTop || r.bearDiv);
    }
    if (countryFilter) {
      out = out.filter((r) => r.country === countryFilter);
    }
    if (mcapFilter && MCAP_BUCKETS[mcapFilter]) {
      const [lo, hi] = MCAP_BUCKETS[mcapFilter];
      out = out.filter((r) => r.marketCap != null && r.marketCap >= lo && r.marketCap < hi);
    }
    if (cheapOnly) {
      out = out.filter((r) => r.cheapZone);
    }
    if (nearAthOnly) {
      // ≤10% do máximo do histórico (~300 semanas); >0 = novo máximo em formação
      out = out.filter((r) => r.athPct != null && r.athPct >= -0.1);
    }

    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: TerminalRow): number => {
      switch (sortKey) {
        case "rank":
          return r.rankHint;
        case "sinceFlipPct":
          return r.sinceFlipPct ?? -Infinity;
        case "since":
          // fecho mais recente primeiro (desc); no diário o fecho é do próprio dia
          return (
            (timeframe === "daily"
              ? dailyFlipCloseMs(r.lastFlipDate, r.assetClass)
              : flipCloseMs(r.lastFlipDate, r.assetClass)) ?? -Infinity
          );
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
    signalFilter,
    countryFilter,
    mcapFilter,
    cheapOnly,
    nearAthOnly,
    timeframe,
    sortKey,
    sortDir,
  ]);

  // Reset de todos os filtros (botão "Limpar" e ao trocar de classe).
  const clearFilters = useCallback(() => {
    setTrendFilter(new Set());
    setCategory("");
    setTimeFilter("any");
    setSignalFilter("any");
    setCountryFilter("");
    setMcapFilter("");
    setCheapOnly(false);
    setNearAthOnly(false);
    setPage(1);
  }, []);

  const activeFilterCount =
    trendFilter.size +
    (timeFilter !== "any" ? 1 : 0) +
    (signalFilter !== "any" ? 1 : 0) +
    (category ? 1 : 0) +
    (countryFilter ? 1 : 0) +
    (mcapFilter ? 1 : 0) +
    (cheapOnly ? 1 : 0) +
    (nearAthOnly ? 1 : 0);

  // Stats sobre o conjunto FILTRADO (como no terminal do Ivan: com o filtro
  // bearish ativo, "BULLISH 0 (0%)").
  const pulse = useMemo(() => {
    const total = filtered.length;
    const bull = filtered.filter((r) => r.trend === "bullish").length;
    // explícito (não total-bull): ativos "novo" não contam como bearish
    const bear = filtered.filter((r) => r.trend === "bearish").length;
    const mcap = filtered.reduce((sum, r) => sum + (r.marketCap ?? 0), 0);
    // internacionais sem mcap (cotação em moeda local) — ficam fora da soma
    const mcapExcl = filtered.filter(
      (r) => r.marketCap === null && r.country && r.country !== "US"
    ).length;
    return { total, bull, bear, mcap, mcapExcl };
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
            <a
              className="tag brand-sub brand-link"
              href="https://defisurfers.xyz"
              target="_blank"
              rel="noopener"
              title="Ir para a comunidade DeFi Surfers"
            >
              by DeFi Surfers ↗
            </a>
          </div>
          <nav className="tabs" ref={tabsRef}>
            {TABS.map((c) => (
              <button
                key={c}
                data-tab={c}
                className={c === activeClass ? "tab active" : "tab"}
                onClick={() => {
                  setActiveClass(c);
                  setCategory(""); // categorias e países mudam por classe
                  setCountryFilter("");
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
          <div
            className="stat"
            style={{ cursor: "help" }}
            title={
              pulse.mcapExcl > 0
                ? `Soma em USD dos ativos com market cap conhecido — exclui ${pulse.mcapExcl} ${pulse.mcapExcl === 1 ? "ação internacional cotada" : "ações internacionais cotadas"} em moeda local (mkt cap "—").`
                : "Soma em USD dos ativos visíveis com market cap conhecido."
            }
          >
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
          <span className="upd-note">
            Última atualização: {new Date(updatedAt).toLocaleString("pt-PT")}
          </span>
        </div>
      </header>

      <div className="controls-top">
        <input
          className="search"
          placeholder="Pesquisar nome ou símbolo…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {/* Só mobile (CSS): abre o bottom-sheet dos filtros. */}
        <button
          className={`filters-toggle${activeFilterCount ? " has-active" : ""}`}
          onClick={() => setFiltersOpen(true)}
        >
          Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ""}
        </button>
      </div>

      {filtersOpen && (
        <div className="filter-overlay" onClick={() => setFiltersOpen(false)} />
      )}

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
                // "FLIP RECENTE": idade desde o FECHO da vela. Semanal: fecho
                // cripto 2ª+7d / mercado 6ª 21:05, janela 14 dias. Diário: fecho
                // do próprio dia, janela 2 dias (senão tudo era "recente").
                const closeMs =
                  timeframe === "daily"
                    ? dailyFlipCloseMs(r.lastFlipDate, r.assetClass)
                    : flipCloseMs(r.lastFlipDate, r.assetClass);
                const freshWindow = (timeframe === "daily" ? 2 : 14) * 86_400_000;
                const fresh = closeMs !== null && Date.now() - closeMs <= freshWindow;
                const isOpen = expanded === r.symbol;
                const warns = warningsFor(r);
                return (
                  <FragmentRow
                    key={r.symbol}
                    r={r}
                    i={(safePage - 1) * PAGE_SIZE + i}
                    tag={tag}
                    fresh={fresh}
                    closeMs={closeMs}
                    timeframe={timeframe}
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
          <div className={`panel filter-panel${filtersOpen ? " open" : ""}`}>
            <div className="filter-head">
              <h3>Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ""}</h3>
              {activeFilterCount > 0 && (
                <button className="filter-clear" onClick={clearFilters}>
                  Limpar
                </button>
              )}
              {/* Só mobile (CSS): fecha o bottom-sheet. */}
              <button
                className="filter-close"
                aria-label="Fechar filtros"
                onClick={() => setFiltersOpen(false)}
              >
                ✕
              </button>
            </div>

            <span className="filter-lbl">Tendência</span>
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

            <span className="filter-lbl">Tempo desde o flip</span>
            <select
              className="filter-sel"
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="any">Qualquer altura</option>
              {timeframe === "daily" && <option value="today">Hoje</option>}
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
              <option value="q">Últimos 3 meses</option>
              <option value="semester">Últimos 6 meses</option>
              <option value="year">Último ano</option>
            </select>

            <span className="filter-lbl">Timeframe</span>
            <div className="trend-chips tf-chips">
              {(["daily", "weekly"] as const).map((tf) => (
                <button
                  key={tf}
                  className={`tchip tf-chip ${timeframe === tf ? "on" : ""}`}
                  title={
                    tf === "weekly"
                      ? "Flips da Linha semanal — a leitura base do método e dos alertas."
                      : "Flips da Linha diária — vista de exploração; os alertas continuam semanais."
                  }
                  onClick={() => {
                    setTimeframe(tf);
                    setPage(1);
                    setExpanded(null);
                    if (tf === "weekly" && timeFilter === "today") setTimeFilter("week");
                  }}
                >
                  {tf === "weekly" ? "Semanal" : "Diário"}
                </button>
              ))}
            </div>

            {countriesInClass.length > 1 && (
              <>
                <span className="filter-lbl">País</span>
                <select
                  className="filter-sel"
                  value={countryFilter}
                  onChange={(e) => {
                    setCountryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos os países</option>
                  {countriesInClass.map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_NAMES[c] ?? c}
                    </option>
                  ))}
                </select>
              </>
            )}

            {categories.length > 0 && (
              <>
                <span className="filter-lbl">Categorias</span>
                <select
                  className="filter-sel"
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
              </>
            )}

            <span className="filter-lbl">Sinais</span>
            <select
              className="filter-sel"
              value={signalFilter}
              onChange={(e) => {
                setSignalFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="any">Todos</option>
              <option value="bottom">Possível fundo</option>
              <option value="top">Possível topo</option>
            </select>

            <span className="filter-lbl">Proximidade</span>
            <label
              className="filter-check"
              title="A 10% (ou menos) do máximo do histórico disponível (~6 anos) — líderes de momentum, em máximos ou quase."
            >
              <input
                type="checkbox"
                checked={nearAthOnly}
                onChange={(e) => {
                  setNearAthOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Zona de ATH
            </label>
            <label
              className="filter-check"
              title="Ativos em tendência bearish perto da média de 200 semanas — historicamente a zona de acumulação do ciclo."
            >
              <input
                type="checkbox"
                checked={cheapOnly}
                onChange={(e) => {
                  setCheapOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Zona de 200WMA
            </label>

            <span className="filter-lbl">Market cap</span>
            <select
              className="filter-sel"
              value={mcapFilter}
              onChange={(e) => {
                setMcapFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Qualquer tamanho</option>
              <option value="mega">Mega (&gt; 200 mil M$)</option>
              <option value="large">Grande (10–200 mil M$)</option>
              <option value="mid">Média (2–10 mil M$)</option>
              <option value="small">Pequena (&lt; 2 mil M$)</option>
            </select>

            {/* Só mobile (CSS): fecha o sheet com o resultado à vista. */}
            <button className="filter-apply" onClick={() => setFiltersOpen(false)}>
              Ver {filtered.length} {filtered.length === 1 ? "ativo" : "ativos"}
            </button>
          </div>

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
              className="trade-btn trade-btn-txflow"
              href="https://app.txflow.com/r/TXSURFISTA"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="alpha-stamp">O Alpha</span>
              <span className="tb-tag">NOVO</span>
              <span className="tb-main">TxFlow — Perp DEX ↗</span>
              <span className="tb-sub">Order book on-chain · 100% comunidade · airdrop ativo</span>
            </a>
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
  closeMs,
  timeframe,
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
  closeMs: number | null; // fecho da vela do flip, já consciente do timeframe
  timeframe: "weekly" | "daily";
  isOpen: boolean;
  warns: Warning[];
  watched: boolean;
  onWatch: () => void;
  onToggle: () => void;
}) {
  // Abre o TradingView no MESMO timeframe que estás a ver no Radar (interval
  // D = diário, W = semanal) — o gráfico casa com a leitura da tabela.
  const tvHref = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(
    r.tvSymbol
  )}&interval=${timeframe === "daily" ? "D" : "W"}`;
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
              <span className="asset-sym muted">
                {r.symbol}
                {r.country && r.country !== "US" && (
                  <em className="badge-country" title={COUNTRY_NAMES[r.country] ?? r.country}>
                    {r.country}
                  </em>
                )}
              </span>
            </span>
            {fresh && <span className="badge-new">FLIP RECENTE</span>}
          </div>
        </td>
        <td className="col-trend">
          <span
            className={`chip ${TREND_CLASS[tag]}`}
            title={
              tag === "NOVO"
                ? "Recém-listado — a linha semanal precisa de ~11 velas fechadas para ativar. Sem sinal até lá."
                : undefined
            }
          >
            {tag === "NOVO" ? "⏳ NOVO" : tag}
          </span>
        </td>
        <td className={`num col-delta ${(r.sinceFlipPct ?? 0) >= 0 ? "bull" : "bear"}`}>
          {fmtPct(r.sinceFlipPct)}
        </td>
        <td className="num muted col-tempo">{fmtSince(closeMs)}</td>
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
              {timeframe === "daily" && (
                <p className="muted" style={{ margin: "0 0 10px", fontSize: 11 }}>
                  Vista <b>diária</b>: o <i>Next Flip</i>, o “desde o flip” e as datas são da Linha
                  diária. O estado, os avisos e as referências ATR abaixo continuam da leitura{" "}
                  <b>semanal</b> — e os alertas Telegram também.
                </p>
              )}
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
                  <span className="lvl-v">
                    {r.trend === "novo" ? "—" : fmtPrice(r.nextFlip, r.currency)}
                  </span>
                </div>
                <div className="lvl">
                  <span className="lvl-k">Last Flip</span>
                  <span className="lvl-v">
                    {r.lastFlip !== null ? fmtPrice(r.lastFlip, r.currency) : "—"}
                    {r.lastFlipDate && closeMs !== null && (
                      <span className="muted">
                        {" "}
                        · {new Date(closeMs).toLocaleDateString("pt-PT")}
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
                <div className="lvl" title="Distância ao máximo do histórico disponível (~6 anos)">
                  <span className="lvl-k">Dist. máximo</span>
                  <span className="lvl-v">
                    {r.athPct != null ? fmtPct(r.athPct * 100) : "—"}
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
