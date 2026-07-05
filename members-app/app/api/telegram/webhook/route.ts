import { NextResponse, type NextRequest } from "next/server";
import { consumeLinkCode, linkChat, unlinkChat } from "@/lib/data/alerts";
import { sendMessage, webhookSecret } from "@/lib/telegram";

// Webhook do bot Telegram. Só processa comandos de texto: /start <código>
// (liga o membro), /stop (desliga), /help. O segredo (header) impede que
// alguém que descubra o URL nos injete updates falsos.

export const dynamic = "force-dynamic";

interface TgUpdate {
  message?: {
    chat: { id: number };
    from?: { username?: string };
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== (await webhookSecret())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const text = msg?.text?.trim();
  if (!msg || !text) return NextResponse.json({ ok: true });
  const chatId = msg.chat.id;

  try {
    if (text.startsWith("/start")) {
      const code = text.split(/\s+/)[1];
      if (!code) {
        await sendMessage(
          chatId,
          "🌊 Olá! Para receberes alertas, abre o <b>Radar do Swell</b>, vai à aba <b>Watchlist</b> e clica em <b>“Ligar Telegram”</b>."
        );
        return NextResponse.json({ ok: true });
      }
      const discordId = await consumeLinkCode(code);
      if (!discordId) {
        await sendMessage(
          chatId,
          "❌ Este link de ligação expirou ou já foi usado. Gera um novo no Radar (botão “Ligar Telegram”)."
        );
        return NextResponse.json({ ok: true });
      }
      await linkChat(discordId, chatId, msg.from?.username ?? null);
      await sendMessage(
        chatId,
        "✅ <b>Ligado!</b> Vais receber aqui um alerta sempre que um ativo da tua watchlist virar bullish ou bearish no fecho da vela.\n\nUsa /stop para desligar a qualquer momento."
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/stop")) {
      await unlinkChat(chatId);
      await sendMessage(chatId, "🔕 Alertas desligados. Podes voltar a ligar no Radar quando quiseres.");
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/help")) {
      await sendMessage(
        chatId,
        "📡 <b>Radar do Swell — alertas</b>\n/start — ligar (usa o botão no Radar)\n/stop — desligar\n\nMaterial educativo, não é aconselhamento financeiro."
      );
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[telegram] webhook falhou:", err);
  }

  return NextResponse.json({ ok: true });
}
