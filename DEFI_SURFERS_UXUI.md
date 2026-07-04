# DeFi Surfers — Especificação UX / UI / Arquitetura de Dados (v1)

_Escrito por Fable a 2026-07-04. Fonte de verdade para a implementação
(componentes → Sonnet). Alterações de fundo passam por Fable._

## 0. Referência de produto: o que o Ivan (Bullmania) oferece

Levantamento feito a partir dos vídeos/screenshots analisados (jul-2026):

| Superfície dele | O que mostra | Equivalente nosso |
|---|---|---|
| MoneyLine no gráfico TV | linha de tendência, flip labels, Flip Level, TP 1/2/3 ATR + "Hit %" | SwellLine (Pine, membros com TV) |
| Tabela no gráfico | Trend, Confirm, Next Flip, Last Flip, **Last Flip Date**, Since Flip, Weekly, Daily, Confluence | tabela SwellLine (parcial — falta a data) |
| Faixa heatmap | força/momentum a aquecer/arrefecer | medidor de força (MACD÷ATR) já no Pine |
| Pontos verdes/vermelhos | avisos precoces de fundo/topo (Daily contra Weekly) | dots já no Pine |
| Zona 200W MA | "200W MA or lower = very cheap" | já no Pine |
| Extras de calendário | datas FOMC, halvings do BTC | fácil de adicionar (dados estáticos) |
| **Money Scanner** | screener multi-setor de flips | **members-app (o nosso core)** |

**A nossa vantagem a explorar (não copiar, superar):** o scanner dele vive dentro
do TradingView (fricção: invite-only, setup). O nosso é **web + telemóvel, login
Discord, digest diário no Discord** — zero fricção. Preço transparente, sem
chamada de vendas. O tom visual é surf (onda, line-up, swell) e não "terminal".

## 1. Personas e jobs-to-be-done

1. **Membro pago (200 no Discord)** — "diz-me o que mudou hoje e o que devo
   olhar; não me faças analisar 26 gráficos". Vem do telemóvel (Telegram/Discord).
2. **Curioso do Telegram (3.000)** — vê o teaser público, sente FOMO, converte.
3. **O próprio Ivan-watcher** — membro que já segue o Ivan e compara; precisa de
   confiar que os números batem certo (transparência do método = página "Como ler").

## 2. Arquitetura de informação (páginas)

```
/login                        → Entrar com Discord (já existe)
/members                      → DASHBOARD "Line-up" (hoje)
/members/[symbol]             → FICHA do ativo (detalhe)
/members/como-ler             → guia rápido do método (retenção/confiança)
/members/alerts               → favoritos + alertas          [fase 2]
site público (Surf Drops)     → bloco teaser sem símbolos    [Bloco D.14]
```

### 2.1 Dashboard `/members` — hierarquia (mobile-first)

1. **Barra de estado do mar** (topo): resumo de mercado em 1 linha —
   "🌊 Hoje: 2 flips bullish · 1 bearish · 14/26 ativos em ALIGNED BULL".
   É o pulso diário; muda todos os dias → hábito de abrir.
2. **"Acabou de flipar"** (cards horizontais): ativos com flip Daily/Weekly nos
   últimos 5 dias úteis, mais recente primeiro. Card = símbolo, setor, direção,
   data do flip, Since Flip %, CTA "ver ficha". É o produto — vai primeiro.
3. **Screener completo** (tabela): agrupada por setor, colunas nucleares
   (ver §4). Ordenação default: flips mais recentes primeiro dentro do setor.
   Filtros: setor · direção · estado (ALIGNED/CONFLICT) · "só recém-flipados".
4. **Rodapé de dados**: "Atualizado às HH:MM UTC · fecho diário" — gere
   expectativas (cadência diária, não tempo real).

### 2.2 Ficha `/members/[symbol]` — o upgrade vs. tabela

- **Cabeçalho**: nome, setor, preço, chip de estado grande (ALIGNED BULL /
  CONFLICT / ALIGNED BEAR), botão "Abrir no TradingView".
- **Mini-gráfico** (SVG/canvas leve, ~120 velas semanais): preço + SwellLine
  verde/vermelha + marcas de flip. Sem lib pesada; os dados já vêm do snapshot.
- **Cartões de nível**: Next Flip (o stop), Last Flip + data, Since Flip %,
  alvos 1/2/3 ATR com estado (atingido ✅ / por atingir ⭕) — equivalente
  honesto ao "TP Hit%" dele.
- **Avisos ativos**: exaustão (X ATR da linha), divergência topo/fundo,
  ponto de viragem Daily-contra-Weekly, zona 200W "very cheap". Cada um com
  frase de ação em PT simples (reutilizar os tooltips do Pine — já escritos).
- **Histórico de flips** (tabela): data, direção, nível, resultado % até ao
  flip seguinte. Prova social do método com dados reais.

### 2.3 Teaser público (Surf Drops)

Bloco no site atual (sem tocar no funil): "Esta semana **3 ativos** flipparam
bullish e **1** bearish no radar dos DeFi Surfers" — números reais do cron,
símbolos borrados/ocultos, CTA para o Telegram (funil existente). Nunca dar
símbolo + direção + timing de graça.

## 3. Princípios de UI

- **Tema**: dark (herda o Surf Drops), acentos verde-lima (bull) / vermelho
  (bear) / laranja (conflito/aviso) — as mesmas cores do indicador, para o
  membro reconhecer o produto no gráfico e no site.
- **Chips, não texto**: estado sempre como chip colorido; Since Flip % com
  sinal e cor; "FLIP HOJE" / "FLIP ESTA SEMANA" como badge pulsante.
- **Faixa de força como assinatura**: a coluna "Força" da tabela é um mini
  heatmap (gradiente vermelho→amarelo→verde, igual ao Pine). Nenhum
  concorrente web tem isto; é a nossa marca visual.
- **Mobile primeiro**: tabela colapsa em cards por setor; filtros viram chips
  scrolláveis; tudo utilizável com o polegar.
- **Números com respeito**: fontes tabulares (tabular-nums), 2 decimais em %,
  formato de preço por classe de ativo (cripto 0-2 dec, FX/commodities 2-4).

## 4. Arquitetura de dados

### 4.1 Extensão do `AssetSnapshot` (motor TS ← paridade com o Pine)

O snapshot atual só cobre a tabela básica. Falta portar do Pine o que alimenta
a ficha e os avisos — **tudo já existe em `swellline.pine`, é portar 1:1**:

```ts
export interface AssetSnapshot {
  // — existente —
  symbol: string; sector: string;
  trend: "bullish" | "bearish";
  weeklyTrend: TrendDir; dailyTrend: TrendDir; estado: Estado;
  nextFlip: number; lastFlip: number | null; sinceFlipPct: number | null;
  price: number; updatedAt: string;
  // — novo (paridade Pine + ficha) —
  lastFlipDate: string | null;      // o Ivan mostra; nós não — corrigir
  dailyFlipDate: string | null;     // p/ badge "FLIP HOJE" com rigor
  strength: number | null;          // momentum MACD÷ATR suavizado (-1..+1 clamp)
  exhaustionAtr: number | null;     // (close-swell)/ATR; aviso se ≥ 4
  dotTop: boolean; dotBottom: boolean;       // Daily vira contra Weekly
  bearDiv: boolean; bullDiv: boolean;        // divergências de momentum
  cheapZone: boolean;               // close ≤ 200W MA
  tp: { t1: number; t2: number; t3: number;  // alvos ATR do último flip
        hit1: boolean; hit2: boolean; hit3: boolean } | null;
  spark: { closes: number[]; swell: number[] } | null; // mini-gráfico (~120 sem.)
}
```

### 4.2 Persistência (Supabase — free tier)

Duas tabelas, nada mais no MVP:

- **`snapshots`** — 1 linha por ativo/dia (upsert pelo cron). Serve o dashboard.
  PK `(symbol, date)`. Guardar o JSON do snapshot + colunas extraídas para
  filtro rápido (trend, estado, flipped_today bool).
- **`flip_events`** — histórico permanente: `(symbol, date, dir, level,
  price_at_flip, timeframe)`. **Append-only, nunca apagar** — alimenta:
  "acabou de flipar" (query, não recomputação), histórico da ficha, o teaser
  público, e futuras estatísticas de acerto. É o ativo de dados do negócio.

Cron: mantém 00:15 UTC; por lotes para respeitar 8 req/min do Twelve Data
(cursor em BD; ~26 ativos → 4 lotes de 7). Cripto (Binance) primeiro, sem limite.

### 4.3 Universo (expansão controlada)

26 ativos é pouco para "scanner" (o Ivan varre dezenas). Expandir por fases
mantendo o free tier do Twelve Data (800 créditos/dia = ~380 ativos/dia com
2 TF; folga enorme): fase 1 → +alts Binance (custo zero: SUI, SEI, INJ, ARB,
OP, APT, NEAR, DOT, ADA...), fase 2 → +ações AI/semis (MU, MRVL, AVGO, ALAB,
SNDK, INTC, META, AMZN, AAPL), fase 3 → pedido dos membros (canal Discord
"sugestões" = retenção + roadmap grátis).

## 5. Ordem de implementação (com etiquetas de modelo)

1. [FABLE] ✅ Esta especificação.
2. [SONNET] Motor: portar momentum/exaustão/dots/divergências/200W/TP do Pine
   para `lib/engine` + estender snapshot (§4.1) + testes vs. valores do Pine.
3. [SONNET] Supabase: tabelas §4.2 + cron por lotes + `flip_events`.
4. [FABLE→spec, SONNET→código] Dashboard novo (§2.1) e ficha (§2.2).
5. [FABLE] Teaser público no Surf Drops + copy (§2.3) — mexe no funil, cuidado
   máximo, revisão Fable obrigatória.
6. [HAIKU] Traduções PT/EN/ES do novo copy aprovado.

Bloqueadores do utilizador (inalterados): Redirect URI no portal Discord +
`DISCORD_CLIENT_SECRET`/`DISCORD_BOT_TOKEN` no Vercel + redeploy → login E2E.
