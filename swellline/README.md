# 🌊 SwellLine

Indicador Pine Script v5 para TradingView — trend-following por ATR trailing stop
(verde = bull / vermelho = red), réplica do comportamento da suite "MoneyLine"
(Bullmania™ / Ivan on Tech). O código original é invite-only e protegido; isto é
uma reconstrução independente por reverse-engineering visual, para uso próprio.

## Ficheiros

| Ficheiro | Conteúdo |
|---|---|
| [`swellline.pine`](swellline.pine) | O indicador (colar no Pine Editor do TradingView) |
| [`swellline_research.md`](swellline_research.md) | Registo do reverse-engineering, provas numéricas e log de calibração |
| [`swellline_como_usar.md`](swellline_como_usar.md) | Guia de utilização |
| `SwellLine_Guia*.pdf`, `SwellLine_slides.md`, `SwellLine_fonte_NotebookLM.md` | Material de apoio / guia em PDF |

## Motores da linha

- **Chandelier (tipo MoneyLine)** — default. Trailing ancorado ao **extremo** do
  período (`highest − k×ATR` em bull, `lowest + k×ATR` em bear). Cola-se ao preço
  em tendências fortes e vira mais cedo — é o comportamento observado na MoneyLine.
  Defaults: período 22, long 3, short 3.
- **Supertrend (original)** — trailing ancorado ao meio do preço (`hl2 ± k×ATR`).
  Defaults calibrados: ATR 10, long 3, short 3 (não reverter).

## Funcionalidades

- Flip Level explícito (o preço que vira a tendência = stop dinâmico)
- Tabela multi-timeframe Weekly/Daily → ALIGNED / CONFLICT
- Etiquetas de flip bullish/bearish + alertas (incluindo "flip sem conflito")
- Alvos de take-profit em 1/2/3 ATR a partir do flip
- Medidor de força (momentum MACD÷ATR, heatmap no fundo)
- Avisos de topos & fundos: viragem Daily-contra-Weekly, divergências de momentum,
  exaustão (≥4 ATR da linha), 200W MA + zona "very cheap"
- Companheiros opcionais: Bull Market Support Band (SMA20+EMA21) e MA Pack 21/50/100/200
