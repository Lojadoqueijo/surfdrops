import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar do Swell — DeFi Surfers",
  description:
    "O Radar do Swell: 3.350 ativos varridos pelo motor da Linha do Swell. Exclusivo para membros DeFi Surfers.",
  robots: { index: false, follow: false }, // área privada: nunca indexar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
