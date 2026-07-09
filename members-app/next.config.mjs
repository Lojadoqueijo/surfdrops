// Headers de segurança (auditoria 1.5). Notas:
// - script-src precisa de 'unsafe-inline' (scripts inline de hidratação do Next)
//   e, SÓ em dev, de 'unsafe-eval' (source maps do next dev).
// - img-src https: porque os logos vêm de hosts externos (Parqet, CoinGecko,
//   CDN do Discord) que mudam com o universo — allowlist rígida partia logos.
// - connect-src 'self': o cliente só fala com as nossas rotas /api.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
