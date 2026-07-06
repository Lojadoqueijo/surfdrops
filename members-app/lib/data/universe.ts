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

export type DataSource = "binance" | "okx" | "bybit" | "mexc" | "gate" | "yahoo" | "twelvedata";

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
  mexcSymbol?: string; // ex: BTCUSDT (source "mexc")
  gatePair?: string; // ex: BTC_USDT (source "gate")
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

// Helper para ETFs/commodities/índices via Yahoo (expansão global 2026-07-05).
// twelveSymbol opcional = fallback Twelve Data se o Yahoo partir (router).
function yh(
  symbol: string,
  name: string,
  rankHint: number,
  opts: {
    sector: string;
    categories: string[];
    tv: string;
    yahoo?: string;
    logo?: boolean; // true → logo Parqet por símbolo (ETFs)
    currency?: string;
    country?: string | null;
    twelveSymbol?: string;
  }
): UniverseAsset {
  return {
    symbol,
    tvSymbol: opts.tv,
    yahooSymbol: opts.yahoo ?? symbol,
    name,
    sector: opts.sector,
    categories: opts.categories,
    currency: opts.currency ?? "USD",
    country: opts.country === undefined ? "US" : opts.country,
    logoUrl: opts.logo
      ? `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png`
      : null,
    rankHint,
    source: "yahoo",
    twelveSymbol: opts.twelveSymbol,
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

  // --- ETFs (Yahoo; fallback TD nos que já o tinham) ---
  yh("SPY", "SPDR S&P 500", 160, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "AMEX:SPY", logo: true, twelveSymbol: "SPY" }),
  yh("QQQ", "Invesco QQQ", 161, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "NASDAQ:QQQ", logo: true, twelveSymbol: "QQQ" }),
  yh("DIA", "SPDR Dow Jones", 162, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "AMEX:DIA", logo: true }),
  yh("IWM", "iShares Russell 2000", 163, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "AMEX:IWM", logo: true }),
  yh("VTI", "Vanguard Total Market", 164, { sector: "ETFs", categories: ["ETF", "Broad Market"], tv: "AMEX:VTI", logo: true }),
  yh("EFA", "iShares MSCI EAFE (desenvolvidos ex-EUA)", 165, { sector: "ETFs", categories: ["ETF", "Global"], tv: "AMEX:EFA", logo: true }),
  yh("EEM", "iShares MSCI Emerging Markets", 166, { sector: "ETFs", categories: ["ETF", "Global"], tv: "AMEX:EEM", logo: true }),
  yh("SMH", "VanEck Semiconductor", 167, { sector: "ETFs", categories: ["ETF", "AI", "Semis"], tv: "NASDAQ:SMH", logo: true, twelveSymbol: "SMH" }),
  yh("XLK", "Technology Select SPDR", 168, { sector: "ETFs", categories: ["ETF", "Setoriais"], tv: "AMEX:XLK", logo: true }),
  yh("XLF", "Financial Select SPDR", 169, { sector: "ETFs", categories: ["ETF", "Setoriais"], tv: "AMEX:XLF", logo: true }),
  yh("XLE", "Energy Select SPDR", 170, { sector: "ETFs", categories: ["ETF", "Setoriais"], tv: "AMEX:XLE", logo: true }),
  yh("XLV", "Health Care Select SPDR", 171, { sector: "ETFs", categories: ["ETF", "Setoriais"], tv: "AMEX:XLV", logo: true }),
  yh("VNQ", "Vanguard Real Estate", 172, { sector: "ETFs", categories: ["ETF", "Setoriais"], tv: "AMEX:VNQ", logo: true }),
  yh("ARKK", "ARK Innovation", 173, { sector: "ETFs", categories: ["ETF", "Growth"], tv: "AMEX:ARKK", logo: true }),
  yh("TLT", "iShares 20+ Year Treasury", 174, { sector: "ETFs", categories: ["ETF", "Obrigações"], tv: "NASDAQ:TLT", logo: true }),
  yh("HYG", "iShares High Yield Corporate", 175, { sector: "ETFs", categories: ["ETF", "Obrigações"], tv: "AMEX:HYG", logo: true }),
  yh("GLD", "SPDR Gold Shares", 176, { sector: "ETFs", categories: ["ETF", "Commodities"], tv: "AMEX:GLD", logo: true, twelveSymbol: "GLD" }),
  yh("SLV", "iShares Silver Trust", 177, { sector: "ETFs", categories: ["ETF", "Commodities"], tv: "AMEX:SLV", logo: true, twelveSymbol: "SLV" }),
  yh("IBIT", "iShares Bitcoin Trust", 178, { sector: "ETFs", categories: ["ETF", "Crypto and Blockchain"], tv: "NASDAQ:IBIT", logo: true, twelveSymbol: "IBIT" }),
  yh("ETHA", "iShares Ethereum Trust", 179, { sector: "ETFs", categories: ["ETF", "Crypto and Blockchain"], tv: "NASDAQ:ETHA", logo: true }),

  // --- Commodities (Yahoo, futuros contínuos; fallback TD nos 3 originais) ---
  yh("XAU/USD", "Ouro", 180, { sector: "Commodities", categories: ["Metais"], tv: "OANDA:XAUUSD", yahoo: "GC=F", twelveSymbol: "XAU/USD", country: null }),
  yh("XAG/USD", "Prata", 181, { sector: "Commodities", categories: ["Metais"], tv: "OANDA:XAGUSD", yahoo: "SI=F", twelveSymbol: "XAG/USD", country: null }),
  yh("COPPER", "Cobre", 182, { sector: "Commodities", categories: ["Metais"], tv: "COMEX:HG1!", yahoo: "HG=F", country: null }),
  yh("PLATINUM", "Platina", 183, { sector: "Commodities", categories: ["Metais"], tv: "NYMEX:PL1!", yahoo: "PL=F", country: null }),
  yh("WTI/USD", "Petróleo WTI", 184, { sector: "Commodities", categories: ["Energia"], tv: "TVC:USOIL", yahoo: "CL=F", twelveSymbol: "WTI/USD", country: null }),
  yh("BRENT", "Petróleo Brent", 185, { sector: "Commodities", categories: ["Energia"], tv: "TVC:UKOIL", yahoo: "BZ=F", country: null }),
  yh("NATGAS", "Gás Natural", 186, { sector: "Commodities", categories: ["Energia"], tv: "NYMEX:NG1!", yahoo: "NG=F", country: null }),
  yh("WHEAT", "Trigo", 187, { sector: "Commodities", categories: ["Agrícolas"], tv: "CBOT:ZW1!", yahoo: "ZW=F", country: null }),
  yh("CORN", "Milho", 188, { sector: "Commodities", categories: ["Agrícolas"], tv: "CBOT:ZC1!", yahoo: "ZC=F", country: null }),
  yh("PALLADIUM", "Paládio", 189, { sector: "Commodities", categories: ["Metais"], tv: "NYMEX:PA1!", yahoo: "PA=F", country: null }),
  yh("SOYBEAN", "Soja", 189, { sector: "Commodities", categories: ["Agrícolas"], tv: "CBOT:ZS1!", yahoo: "ZS=F", country: null }),
  yh("SUGAR", "Açúcar", 189, { sector: "Commodities", categories: ["Agrícolas"], tv: "ICEUS:SB1!", yahoo: "SB=F", country: null }),
  yh("COFFEE", "Café", 189, { sector: "Commodities", categories: ["Agrícolas"], tv: "ICEUS:KC1!", yahoo: "KC=F", country: null }),
  yh("COCOA", "Cacau", 189, { sector: "Commodities", categories: ["Agrícolas"], tv: "ICEUS:CC1!", yahoo: "CC=F", country: null }),
  yh("COTTON", "Algodão", 189, { sector: "Commodities", categories: ["Agrícolas"], tv: "ICEUS:CT1!", yahoo: "CT=F", country: null }),
  yh("GASOLINE", "Gasolina", 189, { sector: "Commodities", categories: ["Energia"], tv: "NYMEX:RB1!", yahoo: "RB=F", country: null }),
  yh("HEATOIL", "Fuelóleo de aquecimento", 189, { sector: "Commodities", categories: ["Energia"], tv: "NYMEX:HO1!", yahoo: "HO=F", country: null }),

  // --- Índices globais (Yahoo) ---
  yh("SPX", "S&P 500", 190, { sector: "Índices", categories: ["América"], tv: "SP:SPX", yahoo: "^GSPC", twelveSymbol: "SPX" }),
  yh("NDX", "Nasdaq 100", 191, { sector: "Índices", categories: ["América"], tv: "NASDAQ:NDX", yahoo: "^NDX", twelveSymbol: "NDX" }),
  yh("DJI", "Dow Jones Industrial", 192, { sector: "Índices", categories: ["América"], tv: "TVC:DJI", yahoo: "^DJI" }),
  yh("RUT", "Russell 2000", 193, { sector: "Índices", categories: ["América"], tv: "TVC:RUT", yahoo: "^RUT" }),
  yh("VIX", "VIX (volatilidade)", 194, { sector: "Índices", categories: ["América"], tv: "TVC:VIX", yahoo: "^VIX" }),
  yh("SX5E", "Euro Stoxx 50", 195, { sector: "Índices", categories: ["Europa"], tv: "TVC:SX5E", yahoo: "^STOXX50E", currency: "EUR", country: null }),
  yh("DAX", "DAX 40", 196, { sector: "Índices", categories: ["Europa"], tv: "XETR:DAX", yahoo: "^GDAXI", currency: "EUR", country: "DE" }),
  yh("FTSE", "FTSE 100", 197, { sector: "Índices", categories: ["Europa"], tv: "TVC:UKX", yahoo: "^FTSE", currency: "GBP", country: "GB" }),
  yh("CAC", "CAC 40", 198, { sector: "Índices", categories: ["Europa"], tv: "TVC:CAC40", yahoo: "^FCHI", currency: "EUR", country: "FR" }),
  yh("IBEX", "IBEX 35", 199, { sector: "Índices", categories: ["Europa"], tv: "BME:IBC35", yahoo: "^IBEX", currency: "EUR", country: "ES" }),
  yh("PSI", "PSI (Portugal)", 200, { sector: "Índices", categories: ["Europa"], tv: "EURONEXT:PSI20", yahoo: "PSI20.LS", currency: "EUR", country: "PT" }),
  yh("N225", "Nikkei 225", 201, { sector: "Índices", categories: ["Ásia"], tv: "TVC:NI225", yahoo: "^N225", currency: "JPY", country: "JP" }),
  yh("HSI", "Hang Seng", 202, { sector: "Índices", categories: ["Ásia"], tv: "TVC:HSI", yahoo: "^HSI", currency: "HKD", country: "HK" }),
  yh("SSE", "Shanghai Composite", 203, { sector: "Índices", categories: ["Ásia"], tv: "SSE:000001", yahoo: "000001.SS", currency: "CNY", country: "CN" }),
  yh("SENSEX", "BSE Sensex", 204, { sector: "Índices", categories: ["Ásia"], tv: "BSE:SENSEX", yahoo: "^BSESN", currency: "INR", country: "IN" }),
  yh("NIFTY", "Nifty 50 (Índia)", 205, { sector: "Índices", categories: ["Ásia"], tv: "NSE:NIFTY", yahoo: "^NSEI", currency: "INR", country: "IN" }),
  yh("KOSPI", "KOSPI (Coreia)", 206, { sector: "Índices", categories: ["Ásia"], tv: "KRX:KOSPI", yahoo: "^KS11", currency: "KRW", country: "KR" }),
  yh("TWII", "TAIEX (Taiwan)", 207, { sector: "Índices", categories: ["Ásia"], tv: "TWSE:TAIEX", yahoo: "^TWII", currency: "TWD", country: "TW" }),
  yh("ASX", "ASX 200 (Austrália)", 208, { sector: "Índices", categories: ["Ásia"], tv: "ASX:XJO", yahoo: "^AXJO", currency: "AUD", country: "AU" }),
  yh("STI", "Straits Times (Singapura)", 209, { sector: "Índices", categories: ["Ásia"], tv: "SGX:STI", yahoo: "^STI", currency: "SGD", country: "SG" }),
  yh("JKSE", "IDX Composite (Indonésia)", 210, { sector: "Índices", categories: ["Ásia"], tv: "IDX:COMPOSITE", yahoo: "^JKSE", currency: "IDR", country: "ID" }),
  yh("AEX", "AEX (Países Baixos)", 211, { sector: "Índices", categories: ["Europa"], tv: "EURONEXT:AEX", yahoo: "^AEX", currency: "EUR", country: "NL" }),
  yh("SMI", "SMI (Suíça)", 212, { sector: "Índices", categories: ["Europa"], tv: "SIX:SMI", yahoo: "^SSMI", currency: "CHF", country: "CH" }),
  yh("OMXS30", "OMX Estocolmo 30", 213, { sector: "Índices", categories: ["Europa"], tv: "OMXSTO:OMXS30", yahoo: "^OMX", currency: "SEK", country: "SE" }),
  yh("FTSEMIB", "FTSE MIB (Itália)", 214, { sector: "Índices", categories: ["Europa"], tv: "MIL:FTSEMIB", yahoo: "FTSEMIB.MI", currency: "EUR", country: "IT" }),
  yh("IBOV", "Ibovespa", 215, { sector: "Índices", categories: ["América"], tv: "INDEX:IBOV", yahoo: "^BVSP", currency: "BRL", country: "BR" }),
  yh("TSX", "S&P/TSX (Canadá)", 216, { sector: "Índices", categories: ["América"], tv: "TSX:TSX", yahoo: "^GSPTSE", currency: "CAD", country: "CA" }),
  yh("IPC", "IPC (México)", 217, { sector: "Índices", categories: ["América"], tv: "BMV:ME", yahoo: "^MXX", currency: "MXN", country: "MX" }),
];

export const SECTORS = [...new Set(UNIVERSE.map((a) => a.sector))];
export const CATEGORIES = [...new Set(UNIVERSE.flatMap((a) => a.categories))].sort();
