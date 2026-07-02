import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeFi Surfers — Área de Membros",
  description: "Screener de tendências multi-setor, exclusivo para membros DeFi Surfers.",
  robots: { index: false, follow: false }, // área privada: nunca indexar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
