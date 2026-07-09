import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/data/supabase";

// Saúde dos dados do Radar — consumido pelo vigia no GitHub Actions, que
// falha (e o GitHub envia email) quando alguma classe está obsoleta.
// Limiares com folga deliberada: cripto atualiza 1x/dia (00:25); ações e
// ETFs/índices só em dias úteis ao fecho — na segunda à noite os dados de
// sexta têm ~72h, portanto o limiar é 80h.

export const dynamic = "force-dynamic";

const LIMIAR_HORAS: Record<string, number> = {
  cripto: 26,
  acoes: 80,
  etf_cmd_idx: 80,
};

async function ultimaEscrita(classe: string): Promise<string | null> {
  const s = getSupabase();
  if (!s) return null;
  let q = s.from("snapshots").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (classe === "cripto") q = q.like("sector", "Cripto%");
  else if (classe === "acoes") q = q.like("sector", "Ações%");
  else q = q.not("sector", "like", "Cripto%").not("sector", "like", "Ações%");
  const { data } = await q;
  return (data?.[0]?.updated_at as string) ?? null;
}

// Universo dinâmico (auditoria 2.4): saveUniverseCache só corre num build
// dinâmico BEM-SUCEDIDO — se o updated_at da cache envelhecer, o universo está
// a servir do cache/estático em silêncio (CoinGecko/NASDAQ partidos). Limiar
// com folga: cripto reconstrói 1x/dia; ações só em dias úteis (fds ~72h).
const LIMIAR_UNIVERSO_HORAS: Record<string, number> = {
  cripto: 30,
  acoes: 80,
};

async function universoCache(): Promise<
  Record<string, { updatedAt: string | null; horas: number | null; ok: boolean }>
> {
  const out: Record<string, { updatedAt: string | null; horas: number | null; ok: boolean }> = {};
  const s = getSupabase();
  const rows = s
    ? ((await s.from("universe_cache").select("class, updated_at")).data as
        | Array<{ class: string; updated_at: string | null }>
        | null)
    : null;
  for (const [cls, limiar] of Object.entries(LIMIAR_UNIVERSO_HORAS)) {
    const updatedAt = rows?.find((r) => r.class === cls)?.updated_at ?? null;
    const horas = updatedAt
      ? Math.round(((Date.now() - new Date(updatedAt).getTime()) / 3_600_000) * 10) / 10
      : null;
    out[cls] = { updatedAt, horas, ok: horas !== null && horas <= limiar };
  }
  return out;
}

export async function GET() {
  const classes: Record<string, { updatedAt: string | null; horas: number | null; ok: boolean }> = {};
  let allOk = true;

  for (const classe of Object.keys(LIMIAR_HORAS)) {
    const updatedAt = await ultimaEscrita(classe);
    const horas = updatedAt
      ? Math.round(((Date.now() - new Date(updatedAt).getTime()) / 3_600_000) * 10) / 10
      : null;
    const ok = horas !== null && horas <= LIMIAR_HORAS[classe];
    if (!ok) allOk = false;
    classes[classe] = { updatedAt, horas, ok };
  }

  const universo = await universoCache();
  for (const u of Object.values(universo)) if (!u.ok) allOk = false;

  return NextResponse.json(
    { ok: allOk, classes, universo, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
