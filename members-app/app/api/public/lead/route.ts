import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/data/supabase";

// Captura de lead (auditoria 5.1): lista de espera da próxima janela.
// POST {email, source, web} — `web` é honeypot (bots preenchem-no; humanos
// não o veem). Upsert por email = sem duplicados, re-submeter é inofensivo.
// CORS restrito aos nossos domínios: é um endpoint de ESCRITA, não abre "*".

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "https://defisurfers.xyz",
  "https://drops.defisurfers.xyz",
  "https://surfdrops.vercel.app",
  "https://app.defisurfers.xyz",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://defisurfers.xyz";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  let body: { email?: string; source?: string; web?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "json" }, { status: 400, headers });
  }

  // Honeypot: humanos nunca preenchem este campo.
  if (body.web) return NextResponse.json({ ok: true }, { headers });

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ ok: false, error: "email" }, { status: 400, headers });
  }
  const source = (body.source ?? "hub").slice(0, 40);

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "db" }, { status: 503, headers });

  const { error } = await supabase
    .from("leads")
    .upsert({ email, source, created_at: new Date().toISOString() }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error("[lead] gravação falhou:", error.message);
    return NextResponse.json({ ok: false, error: "db" }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
