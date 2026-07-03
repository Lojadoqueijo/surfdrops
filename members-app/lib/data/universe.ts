// Lista curada inicial (MVP). Cobertura tipo Bullmania: cripto, ações, ETFs,
// commodities, índices. Expandir com feedback dos membros.
//
// Routing de dados (ver DEFI_SURFERS_PLANO.md §3.5):
//  - source "binance"    → Binance klines (cripto; grátis, sem key, OHLC perfeito)
//  - source "twelvedata" → Twelve Data (ações/ETFs/commodities/índices; 8 req/min)
//  - coingeckoId         → fallback para tokens fora da Binance (qualidade inferior)

export type DataSource = "binance" | "twelvedata";

export interface UniverseAsset {
  symbol: string; // identificador interno/de exibição
  tvSymbol: string; // símbolo TradingView (botão "Abrir no TradingView")
  name: string;
  sector: string;
  source: DataSource;
  binanceSymbol?: string; // ex: BTCUSDT
  twelveSymbol?: string; // ex: AAPL, XAU/USD
  coingeckoId?: string; // ex: bitcoin (só fallback)
}

export const UNIVERSE: UniverseAsset[] = [
  // --- Cripto: majors (Binance, grátis) ---
  { symbol: "BTC/USD", tvSymbol: "CRYPTO:BTCUSD", name: "Bitcoin", sector: "Cripto — Majors", source: "binance", binanceSymbol: "BTCUSDT", coingeckoId: "bitcoin" },
  { symbol: "ETH/USD", tvSymbol: "CRYPTO:ETHUSD", name: "Ethereum", sector: "Cripto — Majors", source: "binance", binanceSymbol: "ETHUSDT", coingeckoId: "ethereum" },
  { symbol: "SOL/USD", tvSymbol: "CRYPTO:SOLUSD", name: "Solana", sector: "Cripto — Majors", source: "binance", binanceSymbol: "SOLUSDT", coingeckoId: "solana" },
  { symbol: "BNB/USD", tvSymbol: "CRYPTO:BNBUSD", name: "BNB", sector: "Cripto — Majors", source: "binance", binanceSymbol: "BNBUSDT", coingeckoId: "binancecoin" },
  { symbol: "XRP/USD", tvSymbol: "CRYPTO:XRPUSD", name: "XRP", sector: "Cripto — Majors", source: "binance", binanceSymbol: "XRPUSDT", coingeckoId: "ripple" },
  { symbol: "AVAX/USD", tvSymbol: "CRYPTO:AVAXUSD", name: "Avalanche", sector: "Cripto — Majors", source: "binance", binanceSymbol: "AVAXUSDT", coingeckoId: "avalanche-2" },
  { symbol: "LINK/USD", tvSymbol: "CRYPTO:LINKUSD", name: "Chainlink", sector: "Cripto — Majors", source: "binance", binanceSymbol: "LINKUSDT", coingeckoId: "chainlink" },
  { symbol: "TON/USD", tvSymbol: "CRYPTO:TONUSD", name: "Toncoin", sector: "Cripto — Majors", source: "binance", binanceSymbol: "TONUSDT", coingeckoId: "the-open-network" },
  { symbol: "DOGE/USD", tvSymbol: "CRYPTO:DOGEUSD", name: "Dogecoin", sector: "Cripto — Majors", source: "binance", binanceSymbol: "DOGEUSDT", coingeckoId: "dogecoin" },

  // --- Ações: AI / Tech (Twelve Data) ---
  { symbol: "NVDA", tvSymbol: "NASDAQ:NVDA", name: "NVIDIA", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "NVDA" },
  { symbol: "MSFT", tvSymbol: "NASDAQ:MSFT", name: "Microsoft", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "MSFT" },
  { symbol: "GOOGL", tvSymbol: "NASDAQ:GOOGL", name: "Alphabet", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "GOOGL" },
  { symbol: "AMD", tvSymbol: "NASDAQ:AMD", name: "AMD", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "AMD" },
  { symbol: "PLTR", tvSymbol: "NASDAQ:PLTR", name: "Palantir", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "PLTR" },
  { symbol: "TSM", tvSymbol: "NYSE:TSM", name: "TSMC", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "TSM" },
  { symbol: "TSLA", tvSymbol: "NASDAQ:TSLA", name: "Tesla", sector: "Ações — AI/Tech", source: "twelvedata", twelveSymbol: "TSLA" },
  { symbol: "COIN", tvSymbol: "NASDAQ:COIN", name: "Coinbase", sector: "Ações — Cripto-expostas", source: "twelvedata", twelveSymbol: "COIN" },
  { symbol: "MSTR", tvSymbol: "NASDAQ:MSTR", name: "Strategy", sector: "Ações — Cripto-expostas", source: "twelvedata", twelveSymbol: "MSTR" },

  // --- ETFs (Twelve Data) ---
  { symbol: "SPY", tvSymbol: "AMEX:SPY", name: "SPDR S&P 500", sector: "ETFs", source: "twelvedata", twelveSymbol: "SPY" },
  { symbol: "QQQ", tvSymbol: "NASDAQ:QQQ", name: "Invesco QQQ", sector: "ETFs", source: "twelvedata", twelveSymbol: "QQQ" },
  { symbol: "GLD", tvSymbol: "AMEX:GLD", name: "SPDR Gold Shares", sector: "ETFs", source: "twelvedata", twelveSymbol: "GLD" },
  { symbol: "IBIT", tvSymbol: "NASDAQ:IBIT", name: "iShares Bitcoin Trust", sector: "ETFs", source: "twelvedata", twelveSymbol: "IBIT" },

  // --- Commodities (Twelve Data) ---
  { symbol: "XAU/USD", tvSymbol: "OANDA:XAUUSD", name: "Ouro", sector: "Commodities", source: "twelvedata", twelveSymbol: "XAU/USD" },
  { symbol: "XAG/USD", tvSymbol: "OANDA:XAGUSD", name: "Prata", sector: "Commodities", source: "twelvedata", twelveSymbol: "XAG/USD" },
  { symbol: "WTI/USD", tvSymbol: "TVC:USOIL", name: "Petróleo WTI", sector: "Commodities", source: "twelvedata", twelveSymbol: "WTI/USD" },

  // --- Índices (Twelve Data) ---
  { symbol: "SPX", tvSymbol: "SP:SPX", name: "S&P 500", sector: "Índices", source: "twelvedata", twelveSymbol: "SPX" },
  { symbol: "NDX", tvSymbol: "NASDAQ:NDX", name: "Nasdaq 100", sector: "Índices", source: "twelvedata", twelveSymbol: "NDX" },
];

export const SECTORS = [...new Set(UNIVERSE.map((a) => a.sector))];
