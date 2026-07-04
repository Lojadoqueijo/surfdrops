// Lista curada inicial (MVP). Cobertura tipo Bullmania: cripto, ações, ETFs,
// commodities, índices. Expandir com feedback dos membros.
//
// Routing de dados (ver DEFI_SURFERS_PLANO.md §3.5):
//  - source "binance"    → Binance klines (cripto; grátis, sem key, OHLC perfeito)
//  - source "twelvedata" → Twelve Data (ações/ETFs/commodities/índices; 8 req/min)
//  - coingeckoId         → fallback para tokens fora da Binance (qualidade inferior)
//
// Metadados novos (DEFI_SURFERS_UXUI.md §3.1, terminal espelhado no do Ivan):
//  - logoUrl: Clearbit Logo API para empresas/emissores (logo.clearbit.com/<domínio>)
//    e jsDelivr cryptocurrency-icons para cripto — ambos grátis, sem key. Trocar
//    de fonte é local a este ficheiro se algum dia deixarem de ser fiáveis.
//  - currency/country: hoje tudo USD/US (ainda sem ações internacionais — ver
//    "não no MVP" no §5 da spec). Ficam prontos para quando expandirmos.
//  - categories: tags temáticas para o filtro "Categories" do terminal (Mag7,
//    AI, Semis, Crypto and Blockchain, ETF, Commodities, Indices...).
//  - yahooSymbol: para o link "Yahoo Finance" por linha (pedido do utilizador,
//    2026-07-04) — verificados manualmente, não assumir o padrão óbvio sempre
//    bate certo (ex: Toncoin é TON11419-USD no Yahoo, não TON-USD — esse é um
//    token diferente na Ethereum).
//  - rankHint: só um desempate de ordenação por defeito (grosseiro, não é
//    market cap real) até termos mcap para todos os ativos.

export type DataSource = "binance" | "twelvedata";

export interface UniverseAsset {
  symbol: string; // identificador interno/de exibição
  tvSymbol: string; // símbolo TradingView (botão "Abrir no TradingView")
  yahooSymbol: string | null; // símbolo Yahoo Finance (botão "Abrir no Yahoo Finance")
  name: string;
  sector: string;
  categories: string[];
  currency: string; // ISO 4217 (moeda em que o preço é mostrado)
  country: string | null; // ISO 3166-1 alpha-2, para a bandeira; null = sem país (cripto)
  logoUrl: string | null;
  rankHint: number; // desempate de ordenação por defeito; não é market cap real
  source: DataSource;
  binanceSymbol?: string; // ex: BTCUSDT
  twelveSymbol?: string; // ex: AAPL, XAU/USD
  coingeckoId?: string; // ex: bitcoin (só fallback)
}

const CRYPTO_ICON = (ticker: string) =>
  `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1.0/128/color/${ticker.toLowerCase()}.png`;
const COMPANY_LOGO = (domain: string) => `https://logo.clearbit.com/${domain}`;

export const UNIVERSE: UniverseAsset[] = [
  // --- Cripto: majors (Binance, grátis) ---
  { symbol: "BTC/USD", tvSymbol: "CRYPTO:BTCUSD", yahooSymbol: "BTC-USD", name: "Bitcoin", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("btc"), rankHint: 1, source: "binance", binanceSymbol: "BTCUSDT", coingeckoId: "bitcoin" },
  { symbol: "ETH/USD", tvSymbol: "CRYPTO:ETHUSD", yahooSymbol: "ETH-USD", name: "Ethereum", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("eth"), rankHint: 2, source: "binance", binanceSymbol: "ETHUSDT", coingeckoId: "ethereum" },
  { symbol: "SOL/USD", tvSymbol: "CRYPTO:SOLUSD", yahooSymbol: "SOL-USD", name: "Solana", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("sol"), rankHint: 5, source: "binance", binanceSymbol: "SOLUSDT", coingeckoId: "solana" },
  { symbol: "BNB/USD", tvSymbol: "CRYPTO:BNBUSD", yahooSymbol: "BNB-USD", name: "BNB", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("bnb"), rankHint: 6, source: "binance", binanceSymbol: "BNBUSDT", coingeckoId: "binancecoin" },
  { symbol: "XRP/USD", tvSymbol: "CRYPTO:XRPUSD", yahooSymbol: "XRP-USD", name: "XRP", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("xrp"), rankHint: 7, source: "binance", binanceSymbol: "XRPUSDT", coingeckoId: "ripple" },
  { symbol: "AVAX/USD", tvSymbol: "CRYPTO:AVAXUSD", yahooSymbol: "AVAX-USD", name: "Avalanche", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("avax"), rankHint: 15, source: "binance", binanceSymbol: "AVAXUSDT", coingeckoId: "avalanche-2" },
  { symbol: "LINK/USD", tvSymbol: "CRYPTO:LINKUSD", yahooSymbol: "LINK-USD", name: "Chainlink", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("link"), rankHint: 16, source: "binance", binanceSymbol: "LINKUSDT", coingeckoId: "chainlink" },
  // Yahoo: Toncoin usa TON11419-USD (colisão de ticker); TON-USD é outro token (Ethereum).
  { symbol: "TON/USD", tvSymbol: "CRYPTO:TONUSD", yahooSymbol: "TON11419-USD", name: "Toncoin", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("ton"), rankHint: 20, source: "binance", binanceSymbol: "TONUSDT", coingeckoId: "the-open-network" },
  { symbol: "DOGE/USD", tvSymbol: "CRYPTO:DOGEUSD", yahooSymbol: "DOGE-USD", name: "Dogecoin", sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"], currency: "USD", country: null, logoUrl: CRYPTO_ICON("doge"), rankHint: 10, source: "binance", binanceSymbol: "DOGEUSDT", coingeckoId: "dogecoin" },

  // --- Ações: AI / Tech (Twelve Data) ---
  { symbol: "NVDA", tvSymbol: "NASDAQ:NVDA", yahooSymbol: "NVDA", name: "NVIDIA", sector: "Ações — AI/Tech", categories: ["AI", "Semis", "Mag7"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("nvidia.com"), rankHint: 30, source: "twelvedata", twelveSymbol: "NVDA" },
  { symbol: "MSFT", tvSymbol: "NASDAQ:MSFT", yahooSymbol: "MSFT", name: "Microsoft", sector: "Ações — AI/Tech", categories: ["AI", "Mag7"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("microsoft.com"), rankHint: 31, source: "twelvedata", twelveSymbol: "MSFT" },
  { symbol: "GOOGL", tvSymbol: "NASDAQ:GOOGL", yahooSymbol: "GOOGL", name: "Alphabet", sector: "Ações — AI/Tech", categories: ["AI", "Mag7"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("abc.xyz"), rankHint: 32, source: "twelvedata", twelveSymbol: "GOOGL" },
  { symbol: "AMD", tvSymbol: "NASDAQ:AMD", yahooSymbol: "AMD", name: "AMD", sector: "Ações — AI/Tech", categories: ["AI", "Semis"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("amd.com"), rankHint: 40, source: "twelvedata", twelveSymbol: "AMD" },
  { symbol: "PLTR", tvSymbol: "NASDAQ:PLTR", yahooSymbol: "PLTR", name: "Palantir", sector: "Ações — AI/Tech", categories: ["AI"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("palantir.com"), rankHint: 41, source: "twelvedata", twelveSymbol: "PLTR" },
  { symbol: "TSM", tvSymbol: "NYSE:TSM", yahooSymbol: "TSM", name: "TSMC", sector: "Ações — AI/Tech", categories: ["AI", "Semis"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("tsmc.com"), rankHint: 33, source: "twelvedata", twelveSymbol: "TSM" },
  { symbol: "TSLA", tvSymbol: "NASDAQ:TSLA", yahooSymbol: "TSLA", name: "Tesla", sector: "Ações — AI/Tech", categories: ["Mag7"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("tesla.com"), rankHint: 34, source: "twelvedata", twelveSymbol: "TSLA" },
  { symbol: "COIN", tvSymbol: "NASDAQ:COIN", yahooSymbol: "COIN", name: "Coinbase", sector: "Ações — Cripto-expostas", categories: ["Crypto and Blockchain"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("coinbase.com"), rankHint: 50, source: "twelvedata", twelveSymbol: "COIN" },
  { symbol: "MSTR", tvSymbol: "NASDAQ:MSTR", yahooSymbol: "MSTR", name: "Strategy", sector: "Ações — Cripto-expostas", categories: ["Crypto and Blockchain"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("strategy.com"), rankHint: 51, source: "twelvedata", twelveSymbol: "MSTR" },

  // --- ETFs (Twelve Data) ---
  { symbol: "SPY", tvSymbol: "AMEX:SPY", yahooSymbol: "SPY", name: "SPDR S&P 500", sector: "ETFs", categories: ["ETF", "Broad Market"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("ssga.com"), rankHint: 60, source: "twelvedata", twelveSymbol: "SPY" },
  { symbol: "QQQ", tvSymbol: "NASDAQ:QQQ", yahooSymbol: "QQQ", name: "Invesco QQQ", sector: "ETFs", categories: ["ETF", "Broad Market"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("invesco.com"), rankHint: 61, source: "twelvedata", twelveSymbol: "QQQ" },
  { symbol: "GLD", tvSymbol: "AMEX:GLD", yahooSymbol: "GLD", name: "SPDR Gold Shares", sector: "ETFs", categories: ["ETF", "Commodities"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("ssga.com"), rankHint: 62, source: "twelvedata", twelveSymbol: "GLD" },
  { symbol: "IBIT", tvSymbol: "NASDAQ:IBIT", yahooSymbol: "IBIT", name: "iShares Bitcoin Trust", sector: "ETFs", categories: ["ETF", "Crypto and Blockchain"], currency: "USD", country: "US", logoUrl: COMPANY_LOGO("ishares.com"), rankHint: 63, source: "twelvedata", twelveSymbol: "IBIT" },

  // --- Commodities (Twelve Data) ---
  { symbol: "XAU/USD", tvSymbol: "OANDA:XAUUSD", yahooSymbol: "XAUUSD=X", name: "Ouro", sector: "Commodities", categories: ["Commodities"], currency: "USD", country: null, logoUrl: null, rankHint: 70, source: "twelvedata", twelveSymbol: "XAU/USD" },
  { symbol: "XAG/USD", tvSymbol: "OANDA:XAGUSD", yahooSymbol: "XAGUSD=X", name: "Prata", sector: "Commodities", categories: ["Commodities"], currency: "USD", country: null, logoUrl: null, rankHint: 71, source: "twelvedata", twelveSymbol: "XAG/USD" },
  { symbol: "WTI/USD", tvSymbol: "TVC:USOIL", yahooSymbol: "CL=F", name: "Petróleo WTI", sector: "Commodities", categories: ["Commodities"], currency: "USD", country: null, logoUrl: null, rankHint: 72, source: "twelvedata", twelveSymbol: "WTI/USD" },

  // --- Índices (Twelve Data) ---
  { symbol: "SPX", tvSymbol: "SP:SPX", yahooSymbol: "^GSPC", name: "S&P 500", sector: "Índices", categories: ["Indices"], currency: "USD", country: "US", logoUrl: null, rankHint: 80, source: "twelvedata", twelveSymbol: "SPX" },
  { symbol: "NDX", tvSymbol: "NASDAQ:NDX", yahooSymbol: "^NDX", name: "Nasdaq 100", sector: "Índices", categories: ["Indices"], currency: "USD", country: "US", logoUrl: null, rankHint: 81, source: "twelvedata", twelveSymbol: "NDX" },
];

export const SECTORS = [...new Set(UNIVERSE.map((a) => a.sector))];
export const CATEGORIES = [...new Set(UNIVERSE.flatMap((a) => a.categories))].sort();
