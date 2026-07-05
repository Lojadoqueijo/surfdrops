import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { getSub } from "@/lib/data/alerts";
import { telegramConfigured } from "@/lib/telegram";

// Estado dos alertas do membro para a UI: bot disponível? Telegram ligado?
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get("ds_session")?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const sub = await getSub(session.sub);
  return NextResponse.json(
    {
      ok: true,
      botAvailable: telegramConfigured(),
      linked: Boolean(sub?.chat_id),
      username: sub?.telegram_username ?? null,
      prefs: sub
        ? { flips: sub.flips, signals: sub.signals, digest: sub.digest }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
