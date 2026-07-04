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

  trend: "bullish" | "bearish";
  weeklyTrend: AssetSnapshot["weeklyTrend"];
  dailyTrend: AssetSnapshot["dailyTrend"];
  estado: AssetSnapshot["estado"];
  nextFlip: number;
  lastFlip: number | null;
  lastFlipDate: string | null;
  sinceFlipPct: number | null;
  price: number;
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
}

function metaFor(symbol: string): UniverseAsset | undefined {
  return UNIVERSE.find((a) => a.symbol === symbol);
}

export function toTerminalRows(snapshots: AssetSnapshot[]): TerminalRow[] {
  return snapshots.map((s) => {
    const m = metaFor(s.symbol);
    return {
      symbol: s.symbol,
      name: m?.name ?? s.symbol,
      sector: s.sector,
      assetClass: classOfSector(s.sector),
      categories: m?.categories ?? [],
      currency: m?.currency ?? "USD",
      country: m?.country ?? null,
      logoUrl: m?.logoUrl ?? null,
      tvSymbol: m?.tvSymbol ?? s.symbol,
      yahooSymbol: m?.yahooSymbol ?? null,
      rankHint: m?.rankHint ?? 9999,

      trend: s.trend,
      weeklyTrend: s.weeklyTrend,
      dailyTrend: s.dailyTrend,
      estado: s.estado,
      nextFlip: s.nextFlip,
      lastFlip: s.lastFlip,
      lastFlipDate: s.lastFlipDate,
      sinceFlipPct: s.sinceFlipPct,
      price: s.price,
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
    };
  });
}
