// Lista curada inicial (MVP). Expandir com feedback dos membros.
// tvSymbol = símbolo para o botão "Abrir no TradingView".

export interface UniverseAsset {
  symbol: string; // símbolo interno / da API de dados
  tvSymbol: string; // símbolo TradingView
  name: string;
  sector: string;
}

export const UNIVERSE: UniverseAsset[] = [
  // --- Cripto: majors ---
  { symbol: "BTC/USD", tvSymbol: "CRYPTO:BTCUSD", name: "Bitcoin", sector: "Cripto — Majors" },
  { symbol: "ETH/USD", tvSymbol: "CRYPTO:ETHUSD", name: "Ethereum", sector: "Cripto — Majors" },
  { symbol: "SOL/USD", tvSymbol: "CRYPTO:SOLUSD", name: "Solana", sector: "Cripto — Majors" },
  { symbol: "BNB/USD", tvSymbol: "CRYPTO:BNBUSD", name: "BNB", sector: "Cripto — Majors" },
  { symbol: "XRP/USD", tvSymbol: "CRYPTO:XRPUSD", name: "XRP", sector: "Cripto — Majors" },
  { symbol: "AVAX/USD", tvSymbol: "CRYPTO:AVAXUSD", name: "Avalanche", sector: "Cripto — Majors" },
  { symbol: "LINK/USD", tvSymbol: "CRYPTO:LINKUSD", name: "Chainlink", sector: "Cripto — Majors" },
  { symbol: "TON/USD", tvSymbol: "CRYPTO:TONUSD", name: "Toncoin", sector: "Cripto — Majors" },
  { symbol: "DOGE/USD", tvSymbol: "CRYPTO:DOGEUSD", name: "Dogecoin", sector: "Cripto — Majors" },

  // --- Ações: AI / Tech ---
  { symbol: "NVDA", tvSymbol: "NASDAQ:NVDA", name: "NVIDIA", sector: "Ações — AI/Tech" },
  { symbol: "MSFT", tvSymbol: "NASDAQ:MSFT", name: "Microsoft", sector: "Ações — AI/Tech" },
  { symbol: "GOOGL", tvSymbol: "NASDAQ:GOOGL", name: "Alphabet", sector: "Ações — AI/Tech" },
  { symbol: "AMD", tvSymbol: "NASDAQ:AMD", name: "AMD", sector: "Ações — AI/Tech" },
  { symbol: "PLTR", tvSymbol: "NASDAQ:PLTR", name: "Palantir", sector: "Ações — AI/Tech" },
  { symbol: "TSM", tvSymbol: "NYSE:TSM", name: "TSMC", sector: "Ações — AI/Tech" },
  { symbol: "TSLA", tvSymbol: "NASDAQ:TSLA", name: "Tesla", sector: "Ações — AI/Tech" },
  { symbol: "COIN", tvSymbol: "NASDAQ:COIN", name: "Coinbase", sector: "Ações — Cripto-expostas" },
  { symbol: "MSTR", tvSymbol: "NASDAQ:MSTR", name: "Strategy", sector: "Ações — Cripto-expostas" },

  // --- Commodities ---
  { symbol: "XAU/USD", tvSymbol: "OANDA:XAUUSD", name: "Ouro", sector: "Commodities" },
  { symbol: "XAG/USD", tvSymbol: "OANDA:XAGUSD", name: "Prata", sector: "Commodities" },
  { symbol: "WTI/USD", tvSymbol: "TVC:USOIL", name: "Petróleo WTI", sector: "Commodities" },

  // --- Índices ---
  { symbol: "SPX", tvSymbol: "SP:SPX", name: "S&P 500", sector: "Índices" },
  { symbol: "NDX", tvSymbol: "NASDAQ:NDX", name: "Nasdaq 100", sector: "Índices" },
];

export const SECTORS = [...new Set(UNIVERSE.map((a) => a.sector))];
