import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";

// Perfil do membro para a UI (nome + avatar do Discord, lidos do cookie de
// sessão assinado). Rota separada da página /members de propósito: a página
// é cacheada (revalidate 1h) e não pode depender de cookies; isto é dinâmico
// e barato — o Terminal busca no cliente depois de hidratar.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get("ds_session")?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(
    { ok: true, name: session.name ?? null, avatar: session.avatar ?? null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
