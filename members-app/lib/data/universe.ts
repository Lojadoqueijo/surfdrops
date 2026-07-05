// Universo curado (expansão 2026-07-04). Cobertura tipo Bullmania: cripto
// (majors + alts), ações (semis/hardware + mega tech + cripto-expostas), ETFs,
// commodities, índices. Expandir com feedback dos membros.
//
// Routing de dados (ver DEFI_SURFERS_PLANO.md §3.5):
//  - source "binance"    → Binance klines (cripto; grátis, sem key, OHLC perfeito)
//  - source "twelvedata" → Twelve Data (ações/ETFs/commodities/índices; 8 req/min)
//  - coingeckoId         → fallback para tokens fora da Binance (qualidade inferior)
//
// ORÇAMENTO Twelve Data (grátis: 800 créditos/dia, 8/min): cada ativo TD custa
// 2 pedidos/dia (1W+1D). Com o throttle de 16s/ativo, cada lote do cron aguenta
// ~18 ativos TD em 300s — ver CRON_BATCHES no route do cron ao mexer aqui.
//
// Metadados (DEFI_SURFERS_UXUI.md §3.1):
//  - logoUrl: Clearbit (empresas) e jsDelivr cryptocurrency-icons (cripto).
//    Para tokens que NÃO existem no pack de ícones (novos: SUI, SEI, TIA...)
//    fica null → a UI mostra as iniciais. Não inventar URLs.
//  - yahooSymbol: verificado manualmente; o padrão óbvio nem sempre bate certo
//    (ex: Toncoin é TON11419-USD; Uniswap é UNI7083-USD). Em caso de dúvida →
//    null (a UI esconde o botão YF) e corrige-se depois.

export type DataSource = "binance" | "okx" | "bybit" | "twelvedata";

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
  marketCap?: number | null; // presente no universo cripto dinâmico (CoinGecko)
  source: DataSource;
  binanceSymbol?: string; // ex: BTCUSDT
  okxInstId?: string; // ex: BTC-USDT (source "okx")
  bybitSymbol?: string; // ex: BTCUSDT (source "bybit")
  twelveSymbol?: string; // ex: AAPL, XAU/USD
  coingeckoId?: string; // ex: bitcoin (só fallback)
}

const CRYPTO_ICON = (ticker: string) =>
  `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1.0/128/color/${ticker.toLowerCase()}.png`;
const COMPANY_LOGO = (domain: string) => `https://logo.clearbit.com/${domain}`;

// Helper compacto para cripto Binance.
function cripto(
  ticker: string,
  name: string,
  rankHint: number,
  opts: { sector?: string; categories?: string[]; yahoo?: string | null; icon?: boolean; coingeckoId?: string } = {}
): UniverseAsset {
  return {
    symbol: `${ticker}/USD`,
    tvSymbol: `CRYPTO:${ticker}USD`,
    yahooSymbol: opts.yahoo ?? null,
    name,
    sector: opts.sector ?? "Cripto — Alts",
    categories: opts.categories ?? ["Crypto and Blockchain", "Alts"],
    currency: "USD",
    country: null,
    logoUrl: opts.icon === false ? null : CRYPTO_ICON(ticker),
    rankHint,
    source: "binance",
    binanceSymbol: `${ticker}USDT`,
    coingeckoId: opts.coingeckoId,
  };
}

// Helper compacto para ações/ETFs Twelve Data.
function td(
  symbol: string,
  name: string,
  rankHint: number,
  opts: {
    sector: string;
    categories: string[];
    tv: string;
    domain?: string;
    yahoo?: string | null;
    twelveSymbol?: string;
    country?: string | null;
  }
): UniverseAsset {
  return {
    symbol,
    tvSymbol: opts.tv,
    yahooSymbol: opts.yahoo === undefined ? symbol : opts.yahoo,
    name,
    sector: opts.sector,
    categories: opts.categories,
    currency: "USD",
    country: opts.country === undefined ? "US" : opts.country,
    logoUrl: opts.domain ? COMPANY_LOGO(opts.domain) : null,
    rankHint,
    source: "twelvedata",
    twelveSymbol: opts.twelveSymbol ?? symbol,
  };
}

const MAJORS = { sector: "Cripto — Majors", categories: ["Crypto and Blockchain", "Majors"] };

export const UNIVERSE: UniverseAsset[] = [
  // --- Cripto: majors (Binance, grátis) ---
  cripto("BTC", "Bitcoin", 1, { ...MAJORS, yahoo: "BTC-USD", coingeckoId: "bitcoin" }),
  cripto("ETH", "Ethereum", 2, { ...MAJORS, yahoo: "ETH-USD", coingeckoId: "ethereum" }),
  cripto("SOL", "Solana", 5, { ...MAJORS, yahoo: "SOL-USD", coingeckoId: "solana" }),
  cripto("BNB", "BNB", 6, { ...MAJORS, yahoo: "BNB-USD", coingeckoId: "binancecoin" }),
  cripto("XRP", "XRP", 7, { ...MAJORS, yahoo: "XRP-USD", coingeckoId: "ripple" }),
  cripto("ADA", "Cardano", 9, { ...MAJORS, yahoo: "ADA-USD", coingeckoId: "cardano" }),
  cripto("DOGE", "Dogecoin", 10, { sector: MAJORS.sector, categories: ["Crypto and Blockchain", "Majors", "Memes"], yahoo: "DOGE-USD", coingeckoId: "dogecoin" }),
  cripto("TRX", "TRON", 11, { ...MAJORS, yahoo: "TRX-USD", coingeckoId: "tron" }),
  cripto("AVAX", "Avalanche", 15, { ...MAJORS, yahoo: "AVAX-USD", coingeckoId: "avalanche-2" }),
  cripto("LINK", "Chainlink", 16, { ...MAJORS, yahoo: "LINK-USD", coingeckoId: "chainlink" }),
  // Yahoo: Toncoin usa TON11419-USD (colisão de ticker); TON-USD é outro token.
  cripto("TON", "Toncoin", 20, { ...MAJORS, yahoo: "TON11419-USD", coingeckoId: "the-open-network", icon: false }),

  // --- Cripto: alts (Binance, grátis) ---
  cripto("DOT", "Polkadot", 30, { yahoo: "DOT-USD" }),
  cripto("LTC", "Litecoin", 31, { yahoo: "LTC-USD" }),
  cripto("XLM", "Stellar", 32, { yahoo: "XLM-USD" }),
  cripto("HBAR", "Hedera", 33, { icon: false }),
  cripto("ATOM", "Cosmos", 34, { yahoo: "ATOM-USD" }),
  cripto("FIL", "Filecoin", 35, { yahoo: "FIL-USD" }),
  cripto("NEAR", "NEAR Protocol", 36, { yahoo: "NEAR-USD" }),
  cripto("APT", "Aptos", 37, { icon: false }),
  cripto("SUI", "Sui", 38, { icon: false }),
  cripto("SEI", "Sei", 39, { icon: false }),
  cripto("INJ", "Injective", 40, { icon: false }),
  cripto("ARB", "Arbitrum", 41, { icon: false }),
  cripto("OP", "Optimism", 42, { icon: false }),
  cripto("TIA", "Celestia", 43, { icon: false }),
  cripto("UNI", "Uniswap", 44, { categories: ["Crypto and Blockchain", "Alts", "DeFi"], yahoo: "UNI7083-USD" }),
  cripto("AAVE", "Aave", 45, { categories: ["Crypto and Blockchain", "Alts", "DeFi"], yahoo: "AAVE-USD" }),
  cripto("FET", "Fetch.ai (ASI)", 46, { categories: ["Crypto and Blockchain", "Alts", "AI"], icon: false }),
  cripto("RENDER", "Render", 47, { categories: ["Crypto and Blockchain", "Alts", "AI"], icon: false }),
  cripto("TAO", "Bittensor", 48, { categories: ["Crypto and Blockchain", "Alts", "AI"], icon: false }),
  cripto("ZEC", "Zcash", 49, { categories: ["Crypto and Blockchain", "Alts", "Privacy"], yahoo: "ZEC-USD" }),
  cripto("SHIB", "Shiba Inu", 50, { categories: ["Crypto and Blockchain", "Alts", "Memes"], yahoo: "SHIB-USD" }),
  cripto("PEPE", "Pepe", 51, { categories: ["Crypto and Blockchain", "Alts", "Memes"], icon: false }),

  // --- Ações: Semis & Hardware (Twelve Data) ---
  td("NVDA", "NVIDIA", 100, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis", "Mag7"], tv: "NASDAQ:NVDA", domain: "nvidia.com" }),
  td("AMD", "AMD", 101, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:AMD", domain: "amd.com" }),
  td("TSM", "TSMC", 102, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NYSE:TSM", domain: "tsmc.com" }),
  td("MU", "Micron", 103, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:MU", domain: "micron.com" }),
  td("MRVL", "Marvell", 104, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:MRVL", domain: "marvell.com" }),
  td("AVGO", "Broadcom", 105, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:AVGO", domain: "broadcom.com" }),
  td("ALAB", "Astera Labs", 106, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:ALAB", domain: "asteralabs.com" }),
  td("SNDK", "Sandisk", 107, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:SNDK", domain: "sandisk.com" }),
  td("INTC", "Intel", 108, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:INTC", domain: "intel.com" }),
  td("SMCI", "Super Micro", 109, { sector: "Ações — Semis & Hardware", categories: ["AI", "Hardware"], tv: "NASDAQ:SMCI", domain: "supermicro.com" }),
  td("ARM", "Arm Holdings", 110, { sector: "Ações — Semis & Hardware", categories: ["AI", "Semis"], tv: "NASDAQ:ARM", domain: "arm.com" }),
  td("DELL", "Dell", 111, { sector: "Ações — Semis & Hardware", categories: ["AI", "Hardware"], tv: "NYSE:DELL", domain: "dell.com" }),

  // --- Ações: Mega Tech / AI (Twelve Data) ---
  td("MSFT", "Microsoft", 120, { sector: "Ações — Mega Tech", categories: ["AI", "Mag7"], tv: "NASDAQ:MSFT", domain: "microsoft.com" }),
  td("AAPL", "Apple", 121, { sector: "Ações — Mega Tech", categories: ["Mag7"], tv: "NASDAQ:AAPL", domain: "apple.com" }),
  td("GOOGL", "Alphabet", 122, { sector: "Ações — Mega Tech", categories: ["AI", "Mag7"], tv: "NASDAQ:GOOGL", domain: "abc.xyz" }),
  td("AMZN", "Amazon", 123, { sector: "Ações — Mega Tech", categories: ["AI", "Mag7"], tv: "NASDAQ:AMZN", domain: "amazon.com" }),
  td("META", "Meta", 124, { sector: "Ações — Mega Tech", categories: ["AI", "Mag7"], tv: "NASDAQ:META", domain: "meta.com" }),
  td("TSLA", "Tesla", 125, { sector: "Ações — Mega Tech", categories: ["Mag7"], tv: "NASDAQ:TSLA", domain: "tesla.com" }),
  td("ORCL", "Oracle", 126, { sector: "Ações — Mega Tech", categories: ["AI"], tv: "NYSE:ORCL", domain: "oracle.com" }),
  td("PLTR", "Palantir", 127, { sector: "Ações — Mega Tech", categories: ["AI"], tv: "NASDAQ:PLTR", domain: "palantir.com" }),

  // --- Ações: cripto-expostas (Twelve Data) ---
  td("COIN", "Coinbase", 140, { sector: "Ações — Cripto-expostas", categories: ["Crypto and Blockchain"], tv: "NASDAQ:COIN", domain: "coinbase.com" }),
  td("MSTR", "Strategy", 141, { sector: "Ações — Cripto-expostas", categories: ["Crypto and Blockchain"], tv: "NASDAQ:MSTR", domain: "strategy.com" }),

  // --- ETFs (Twelve Data) ---
  td("SPY", "SPDR S&P 500", 160, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "AMEX:SPY", domain: "ssga.com" }),
  td("QQQ", "Invesco QQQ", 161, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "NASDAQ:QQQ", domain: "invesco.com" }),
  td("SMH", "VanEck Semiconductor", 162, { sector: "ETFs", categories: ["ETF", "AI", "Semis"], tv: "NASDAQ:SMH", domain: "vaneck.com" }),
  td("GLD", "SPDR Gold Shares", 163, { sector: "ETFs", categories: ["ETF", "Commodities"], tv: "AMEX:GLD", domain: "ssga.com" }),
  td("SLV", "iShares Silver Trust", 164, { sector: "ETFs", categories: ["ETF", "Commodities"], tv: "AMEX:SLV", domain: "ishares.com" }),
  td("IBIT", "iShares Bitcoin Trust", 165, { sector: "ETFs", categories: ["ETF", "Crypto and Blockchain"], tv: "NASDAQ:IBIT", domain: "ishares.com" }),

  // --- Commodities (Twelve Data) ---
  td("XAU/USD", "Ouro", 180, { sector: "Commodities", categories: ["Commodities"], tv: "OANDA:XAUUSD", yahoo: "XAUUSD=X", twelveSymbol: "XAU/USD", country: null }),
  td("XAG/USD", "Prata", 181, { sector: "Commodities", categories: ["Commodities"], tv: "OANDA:XAGUSD", yahoo: "XAGUSD=X", twelveSymbol: "XAG/USD", country: null }),
  td("WTI/USD", "Petróleo WTI", 182, { sector: "Commodities", categories: ["Commodities"], tv: "TVC:USOIL", yahoo: "CL=F", twelveSymbol: "WTI/USD", country: null }),

  // --- Índices (Twelve Data) ---
  td("SPX", "S&P 500", 190, { sector: "Índices", categories: ["Indices"], tv: "SP:SPX", yahoo: "^GSPC" }),
  td("NDX", "Nasdaq 100", 191, { sector: "Índices", categories: ["Indices"], tv: "NASDAQ:NDX", yahoo: "^NDX" }),
];

export const SECTORS = [...new Set(UNIVERSE.map((a) => a.sector))];
export const CATEGORIES = [...new Set(UNIVERSE.flatMap((a) => a.categories))].sort();
