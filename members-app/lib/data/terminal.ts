import type { AssetSnapshot } from "../engine/types";
import { UNIVERSE, type UniverseAsset } from "./universe";

// Junta o snapshot (motor) com os metadados do universo numa linha pronta a
// desenhar no terminal. Ver DEFI_SURFERS_UXUI.md §2.1/§3.

export const ASSET_CLASSES = ["Cripto", "Ações", "ETFs", "Commodities", "Índices"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export function classOfSector(sector: string): AssetClass {
  if (sector.startsWith("Cripto")) return "Cripto";
  if (sector.startsWith("Ações")) return "Ações";
  if (sector.startsWith("ETF")) return "ETFs";
  if (sector.startsWith("Commodit")) return "Commodities";
  return "Índices";
}

export interface TerminalRow {
  symbol: string;
  name: string;
  sector: string;
  assetClass: AssetClass;
  categories: string[];
  currency: string;
  country: string | null;
  logoUrl: string | null;
  tvSymbol: string;
  yahooSymbol: string | null;
  rankHint: number;

  trend: "bullish" | "bearish" | "novo";
  weeklyTrend: AssetSnapshot["weeklyTrend"];
  dailyTrend: AssetSnapshot["dailyTrend"];
  estado: AssetSnapshot["estado"];
  nextFlip: number;
  lastFlip: number | null;
  lastFlipDate: string | null;
  sinceFlipPct: number | null;
  price: number;
  athPct: number | null; // distância ao máximo do histórico (~300 semanas)
  marketCap: number | null;
  strength: number | null;
  warmup: boolean;
  cooldown: boolean;
  exhaustionAtr: number | null;
  dotTop: boolean;
  dotBottom: boolean;
  bearDiv: boolean;
  bullDiv: boolean;
  cheapZone: boolean;
  tp: AssetSnapshot["tp"];
  daily: AssetSnapshot["daily"];
}

function metaFor(symbol: string): UniverseAsset | undefined {
  return UNIVERSE.find((a) => a.symbol === symbol);
}

export function toTerminalRows(snapshots: AssetSnapshot[]): TerminalRow[] {
  return snapshots.map((s) => {
    // Metadados: preferir os embebidos no snapshot (universo cripto dinâmico);
    // fallback para a lista estática (ações/ETFs e snapshots antigos).
    const m = metaFor(s.symbol);
    return {
      symbol: s.symbol,
      name: s.name ?? m?.name ?? s.symbol,
      sector: s.sector,
      assetClass: classOfSector(s.sector),
      categories: s.categories ?? m?.categories ?? [],
      currency: s.currency ?? m?.currency ?? "USD",
      country: s.country ?? m?.country ?? null,
      logoUrl: s.logoUrl ?? m?.logoUrl ?? null,
      tvSymbol: s.tvSymbol ?? m?.tvSymbol ?? s.symbol,
      yahooSymbol: s.yahooSymbol ?? m?.yahooSymbol ?? null,
      rankHint: s.rank ?? m?.rankHint ?? 9999,

      trend: s.trend,
      weeklyTrend: s.weeklyTrend,
      dailyTrend: s.dailyTrend,
      estado: s.estado,
      nextFlip: s.nextFlip,
      lastFlip: s.lastFlip,
      lastFlipDate: s.lastFlipDate,
      sinceFlipPct: s.sinceFlipPct,
      price: s.price,
      athPct: s.athPct,
      marketCap: s.marketCap,
      strength: s.strength,
      warmup: s.warmup,
      cooldown: s.cooldown,
      exhaustionAtr: s.exhaustionAtr,
      dotTop: s.dotTop,
      dotBottom: s.dotBottom,
      bearDiv: s.bearDiv,
      bullDiv: s.bullDiv,
      cheapZone: s.cheapZone,
      tp: s.tp,
      daily: s.daily ?? null,
    };
  });
}
