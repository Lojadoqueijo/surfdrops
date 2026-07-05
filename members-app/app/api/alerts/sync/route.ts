import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { syncPrefs } from "@/lib/data/alerts";

// Sincroniza as preferências + watchlist do membro para o Supabase, para o
// cron saber a quem e sobre o quê enviar. Chamado pelo cliente quando o membro
// muda os toggles ou os corações.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get("ds_session")?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { flips?: boolean; signals?: boolean; digest?: boolean; watchlist?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const watchlist = Array.isArray(body.watchlist)
    ? (body.watchlist.filter((s) => typeof s === "string") as string[]).slice(0, 500)
    : [];

  await syncPrefs(
    session.sub,
    {
      flips: body.flips !== false,
      signals: Boolean(body.signals),
      digest: Boolean(body.digest),
    },
    watchlist
  );

  return NextResponse.json({ ok: true });
}
