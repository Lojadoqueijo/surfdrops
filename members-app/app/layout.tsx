import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar do Swell — DeFi Surfers",
  description:
    "O Radar do Swell: 3.350 ativos varridos pelo motor da Linha do Swell. Exclusivo para membros DeFi Surfers.",
  robots: { index: false, follow: false }, // área privada: nunca indexar
  // Mesmo favicon do Surf Drops (🏄) em toda a marca.
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏄</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
