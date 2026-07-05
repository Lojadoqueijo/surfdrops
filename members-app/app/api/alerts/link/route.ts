import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { issueLinkCode } from "@/lib/data/alerts";
import { getBotUsername, telegramConfigured } from "@/lib/telegram";

// Gera o deep-link t.me/<bot>?start=<código> para o membro ligar o Telegram.
// Só membros com sessão válida; o código expira em 15 min.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get("ds_session")?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, reason: "bot" }, { status: 503 });
  }
  const username = await getBotUsername();
  if (!username) return NextResponse.json({ ok: false, reason: "bot" }, { status: 503 });

  const code = await issueLinkCode(session.sub);
  if (!code) return NextResponse.json({ ok: false, reason: "db" }, { status: 503 });

  return NextResponse.json({ ok: true, url: `https://t.me/${username}?start=${code}` });
}
