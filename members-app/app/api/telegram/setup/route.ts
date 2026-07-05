import { NextResponse, type NextRequest } from "next/server";
import { getBotUsername, tgCall, webhookSecret } from "@/lib/telegram";

// Regista (ou re-regista) o webhook do bot a apontar para este deployment.
// Correr UMA vez depois de colar o TELEGRAM_BOT_TOKEN no Vercel:
//   GET https://app.defisurfers.xyz/api/telegram/setup
// Idempotente. Se CRON_SECRET existir, exige-o como Bearer.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const origin = new URL(req.url).origin;
    const secret = await webhookSecret();
    await tgCall("setWebhook", {
      url: `${origin}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    const username = await getBotUsername();
    return NextResponse.json({ ok: true, webhook: `${origin}/api/telegram/webhook`, bot: username });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
