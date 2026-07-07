import { ImageResponse } from "next/og";

// og:image de marca para partilhas (defisurfers.xyz, drops., app.). Gerado
// dinamicamente (1200×630) para não depender de nenhum ficheiro e nunca ser a
// foto de ninguém: marca DeFi Surfers + ganhos (verde) + estrutura (barras) +
// comunidade. Público (path /api/public/) e cacheado 24h.

export const runtime = "edge";

const BG = "#120826";
const ACCENT = "#8b5cf6";
const GREEN = "#22c55e";
const TEXT = "#ece8f6";
const MUTED = "#b6adcc";
const FAINT = "#9d93b8";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 68px",
          color: TEXT,
          background: BG,
          backgroundImage:
            "radial-gradient(1000px 620px at 18% -5%, rgba(139,92,246,0.28), transparent 60%), radial-gradient(900px 620px at 95% 105%, rgba(168,85,247,0.20), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
            <div style={{ display: "flex", width: 20, height: 20, borderRadius: 999, background: ACCENT, marginRight: 18 }} />
            <div style={{ display: "flex" }}>DeFi</div>
            <div style={{ display: "flex", color: ACCENT }}>Surfers</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: FAINT, letterSpacing: 3 }}>DESDE 2023</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.5, maxWidth: 940 }}>
            A primeira e maior comunidade de DeFi em Portugal
          </div>
          <div style={{ display: "flex", marginTop: 30 }}>
            {["+182%", "+147%", "+121%"].map((t) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: GREEN,
                  background: "rgba(34,197,94,0.12)",
                  border: "2px solid rgba(34,197,94,0.4)",
                  borderRadius: 999,
                  padding: "8px 22px",
                  fontSize: 30,
                  fontWeight: 700,
                  marginRight: 16,
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 27, color: MUTED }}>
            3.450 ativos · ~300 membros · rendimento em DeFi
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {[42, 68, 96, 124, 156].map((h, i) => (
              <div key={i} style={{ display: "flex", width: 24, height: h, background: GREEN, marginLeft: 13, borderRadius: 4 }} />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "cache-control": "public, max-age=86400, s-maxage=86400, immutable" },
    }
  );
}
