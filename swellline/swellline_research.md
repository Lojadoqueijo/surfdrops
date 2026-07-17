# SwellLine — Reverse-engineering da "MoneyLine" (Bullmania™ / Ivan on Tech)

> **DECISÃO FINAL 2026-07-04:** o utilizador fixou o `swellline.pine` na versão
> Supertrend original (10/3/3/hl2) e deu o projeto por satisfeito. A investigação
> do motor chandelier (secções 2026-07-04 abaixo) fica arquivada para referência;
> melhor fit encontrado por grid search: len 18-20, Long 3,95, Short 3,35-3,4
> (BTC exato; ações ficavam mais largas que o Ivan — réplica exata não fechada).

Registo do que foi extraído dos frames de vídeo do Ivan on Tech, com nível de
confiança. Objetivo: replicar o comportamento (o código original é invite-only
e protegido no TradingView).

## Fonte dos dados
Frames de vídeo no timeframe **Semanal (1W)** de vários ativos:
BTCUSD (CRYPTO), ETHUSD, AVAXUSD, ZECUSD, HYPEUSD, TONUSD.
Não há acesso às Settings do indicador (apenas o que está visível na legenda/UI).

## Parâmetros extraídos

| Parâmetro | Valor | Confiança | Evidência |
|---|---|---|---|
| Multiplicador ATR — Long | **5** | Alta | Legenda "5 Long + Short 3" (ETH, AVAX, TON) |
| Multiplicador ATR — Short | **3** | Alta | Legenda "... Short 3"; caixa TP "3.0 ATR" |
| Posição da tabela | Bottom Left | Alta | "Bottom Left" na legenda = canto da tabela |
| MA Pack | 21 / 50 / 100 / 200 | Alta | Legenda "MA ... 21 50 100 200" |
| Bull Market Support Band | SMA 20 + EMA 21 | Alta | Legenda "Bullmarket Support Band 20 21" |
| Alvos TP | 1 / 2 / 3 ATR | Alta | Caixa "TP Target: 1 ATR / 2 ATR / 3.0 ATR" + Hit% |
| **ATR Length (período)** | **DESCONHECIDO** | — | Não aparece na legenda; só nas Settings (escondidas) |

> O único parâmetro por fixar é o **ATR Length**. Default atual = 10 (standard).
> Calibrar visualmente até os flips baterem nas mesmas velas dos vídeos.

## Comportamento confirmado (observável)
- Linha **em degraus** (trailing stop por ATR), NÃO média móvel → confirma Supertrend-like.
- **Regime único por vez**: verde POR BAIXO em bull (suporte), vermelho POR CIMA em bear (resistência).
- **"Flip Level"** explícito = preço que o close tem de romper para virar (= banda oposta).
- Etiquetas "bullish"/"bearish" no ponto de flip.
- Multiplicadores **assimétricos** (Long 5 / Short 3): dá mais folga em tendência de alta.

## Regras mecânicas dele (ligadas ao indicador)
1. **Direção** = cor da MoneyLine (long só em verde; cash/short em vermelho).
2. **Filtro** = tabela mostra `Weekly` + `Daily`; operar quando `ALIGNED`, evitar `CONFLICT`.
3. **Gestão** = TP escalonado em 1/2/3 ATR; stop = a própria linha (Flip Level).

## Ainda por replicar (visto nos frames, não essencial)
- **Faixa de pontos coloridos** no fundo (laranja→amarelo→verde→vermelho) =
  medidor de força de tendência / heatmap (provável indicador separado).
- Pontos verdes/vermelhos discretos sobre o preço (possíveis marcadores de entrada).
- "FOMC Meeting Analysis" e "TP Target Hit%" (módulos extra do layout dele).

## Estado da réplica
`swellline.pine` já implementa: trailing stop ATR assimétrico (5/3), Flip Level,
tabela MTF (Weekly/Daily + ALIGNED/CONFLICT), alvos 1/2/3 ATR, BMSB, MA Pack e
medidor de força (faixa heatmap no fundo).

## Setup confirmado do Ivan (frame nítido BTCUSD 1W CRYPTO)
Tabela dele no flip bearish:
- Trend: BEARISH | Weekly: BEARISH | Daily: BULLISH | Estado: CONFLICT
- Next Flip: 84.605 / 84.635  (resistência atual p/ voltar a bull)
- **Last Flip: 94.219,33**  (NÍVEL DA LINHA de suporte rompida, NÃO o close)
- Last Flip Date: **2025-11-17**
- Since Flip: **-33,14%**

### Provas
1. -33,14% = (62.992,99 - 94.219,33) / 94.219,33  → confirma Last Flip = 94.219 (não 84.219).
2. Preço real BTC: ATH ~126.198 (Out/2025); mínimo 80.540 em 21-Nov; 30-Nov ~90.394.
   A 17-Nov o BTC estava ~84k → logo 94.219 é o NÍVEL DA LINHA rompida, não o preço.
   O suporte bull dele estava fixo em ~94k (~25% abaixo do ATH).

### Semântica adotada na SwellLine
"Last Flip" passou a mostrar o nível da linha rompida (up[1] em flipBear / dn[1] em
flipBull), e Since Flip mede a partir desse nível — igual à tabela do Ivan.

## Log de calibração (BTCUSD 1W CRYPTO)
Alvo: Last Flip ≈ 94.219, flip na vela de 17-Nov-2025, Since Flip ≈ -33%.
- Long=5, Short=3, ATR 10 → Last Flip 80.796,83 ; Since Flip -22,75% ; flip ~início 2026.
- Long=5, Short=3, ATR 20 → Last Flip 78.839,77 ; Since Flip -20,73% ; flip ~início 2026.

### Conclusão da calibração
- Mexer no ATR Length quase não move o suporte (~2k) e SUBIR piora (afrouxa).
  => ATR Length não é o lever principal. ATR(~8-9k) no weekly.
- O lever é o MULTIPLICADOR Long. Com Long=5 o suporte trava ~80k (largo demais vs 94k dele).
- Matemática: (5 - Long)*ATR ≈ 13.400 com ATR~8k => **Long ≈ 3 a 3,5**.
- Reinterpretação da legenda dele: provavelmente **Long = 3** (ambos 3); o "5" era do
  "Bottom Left 5" (posição/offset), não multiplicador.
- Long=3, Short=3, ATR 10 → Last Flip 96.394,06 ; Next Flip 83.473,66 ; Since Flip -35,17% ;
  flip ~Nov-2025. ✅ BATE com o Ivan (ele: 94.219 / 84.605 / -33,14% / Nov-2025).

### RESULTADO: CALIBRADO
Parâmetros finais: **ATR Length=10, Long=3, Short=3, source=hl2** (BTCUSD 1W CRYPTO).
Diferença residual (~2k no Last Flip) explicável por fonte de dados/source.
Fine-tune opcional: Long≈3,3 baixa o Last Flip de 96,4k para ~94,2k (exato).
multLong default no ficheiro fixado em 3.0.

## CONFIGURAÇÃO FINAL (defaults fixados no swellline.pine)
Estes são os defaults gravados no código — vêm já assim "de origem":
- ATR Length = 10
- Multiplicador Long = 3 ; Short = 3
- Source = hl2
- MTF: Weekly (alto) + Daily (baixo)
- Medidor de força (momentum MACD/ATR): EMA rápida 12, EMA lenta 18, Suavização 3, Escala 1.0
- Bull Market Support Band = OFF (default)
- MA Pack 21/50/100/200 = OFF (default)
- Alvos 1/2/3 ATR = OFF (default) — utilizador pediu para esconder
- Colorir velas = OFF (default)
- Preencher fundo = ON ; Etiquetas de flip = ON ; Faixa de força = ON

REGRA: qualquer alteração futura ao código deve PRESERVAR estes defaults e tudo o
que já foi calibrado/decidido acima. Não reverter para os valores iniciais.

## 2026-07-04 — Divergência estrutural: o motor NÃO é Supertrend, é Chandelier
Comparação lado a lado (screenshots de 3-jul-2026, ~10h-11h Lisboa, tudo 1W):

| Ativo | Preço | Flip Level Ivan | dist. | Flip Level SwellLine (ST 10/3 hl2) | dist. |
|---|---|---|---|---|---|
| SNDK (bull) | 1.745 | 1.691,13 | −3% | 1.383,49 | −21% |
| BTC (bear) | 61.622 | 82.707,85 | +34% | 80.164 | +30% |
| META (bear) | 583 | 611,45 | +5% | 696,15 | +19% |
| NVDA | 195 | 234,03 (JÁ bear) | — | 176,53 (ainda bull) | — |
| AMZN | 243 | 266,18 (JÁ bear, flip ~15-jun) | — | 224,56 (ainda bull) | — |

Extra: SNDK dele tem Last Flip 284,22 em 2026-01-05 (Since +515,96%) → a linha dele
flipou bear em Dez-2025 e re-flipou bull a 5-jan; a nossa nunca flipou (mais larga).

### Conclusão
- Nenhum multiplicador fixo sobre hl2 fecha os 5 casos ao mesmo tempo (BTC bate com 3×ATR,
  SNDK precisaria de ~1×ATR). A âncora é que muda: **extremo do período**, não o meio.
- Hipótese forte: **Chandelier Exit** — long stop = highest(len) − k×ATR, short stop =
  lowest(len) + k×ATR (estilo everget, len 22 / mult 3). Verificação numérica:
  BTC: lowest ~57k + 3×~8,5k ≈ 82-83k ✓ (dele: 82.707); SNDK: highest ~2.280 − 3×~196 ≈ 1.690 ✓
  (dele: 1.691); AMZN: lowest(22) ~233 + 3×~11 ≈ 266 ✓ (dele: 266,18).
- Explica também a linha "arredondada": no chandelier a âncora (extremo) e o ATR mexem
  TODAS as velas → a linha desliza continuamente; o Supertrend trava em patamares.
  (A observação antiga "linha em degraus" vinha de zonas onde o chandelier congela.)
- Explica flips mais cedo: a linha colada ao preço é rompida na primeira correção séria
  (NVDA e AMZN dele já bear; os nossos ainda bull).

### Implementação (swellline.pine)
Novo grupo "Motor da linha": Chandelier (default, len 22 / long 3 / short 3 /
extremos high-low) vs Supertrend (original 10/3/3 hl2, defaults calibrados INTACTOS).
Tabela MTF, flips, TP, exaustão e medidor seguem o motor escolhido. Novo toggle
"Linha em degraus" (default OFF = linha contínua, aspeto MoneyLine).

### Calibração pendente (mercado fechado ao fim-de-semana → valores congelados)
Alvos para afinar chLen/chMultL/chMultS até bater: SNDK 1.691,13 · BTC 82.707,85 ·
META 611,45 · NVDA 234,03 · AMZN 266,18 (+ SNDK last flip 284,22 em 2026-01-05).
Teste rápido alternativo: sobrepor o "Chandelier Exit" do everget (público no TV, 22/3)
à MoneyLine e comparar diretamente.

### Ronda 2 (2026-07-04, tarde) — chandelier 22/3/3 testado em gráfico: Long fino demais
Comparação com o motor chandelier já ativo (BTC e MU, 1W):

| Métrica | SwellLine ch. 22/3/3 | Ivan | Leitura |
|---|---|---|---|
| BTC last flip (bear, Nov-2025) | 101.510 | 94.219,33 (17-nov) | o nosso flipa CEDO demais |
| BTC next flip (atual) | 80.306 | 82.707,85 | short quase certo (±3%) |
| BTC whipsaws em consolidação | tem flips extra (setas) | não tem | suporte largo demais no dele |
| MU next flip (bull, atual) | 990,42 | 904,62 | idem: suporte dele mais largo |
| MU last flip | 96,52 (nunca flipou desde 2024) | 458,25 em 2026-04-20 | ver anomalia abaixo |

Aritmética do multiplicador Long (ATR implícito nos nossos valores 3×ATR):
- BTC topo: 126.200−101.510=24.700=3×ATR → ATR≈8.230; Ivan: 126.200−94.219≈3,9×8.230.
- MU: 1.240−990=250=3×ATR → ATR≈83; Ivan: 1.240−904≈335≈4,0×83.
=> **Multiplicador Long ≈ 4** (dois ativos independentes concordam). Reabilita a
legenda antiga "5 Long / Short 3" como pista de assimetria Long>Short no chandelier.
Default chMultL atualizado 3.0 → **4.0** no swellline.pine. chMultS mantém 3.0
(diferença BTC 80,3k vs 82,7k pode ser feed: ele usa CRYPTO:BTCUSD agregado,
nós Bitstamp — calibrar SEMPRE no mesmo símbolo CRYPTO:BTCUSD).

**Anomalia em aberto:** o MU dele flipou bear ~Mar-2026 e bull a 20-abr (Last Flip
458,25) num dip que nenhum chandelier com k≥3 apanha (k×ATR implícito ≈ 30 pontos,
k≈1). Nenhum multiplicador constante explica isto junto com o resto → hipótese: a
suite dele tem um componente RÁPIDO adicional (linha de saída/entrada mais curta,
talvez os marcadores E/D), ou houve mudança de settings dele entre vídeos. NÃO
forçar a calibração a este ponto; usar como caso de estudo à parte.

### Matriz de calibração a correr no TradingView (CRYPTO:BTCUSD e MU, 1W)
Alvos duros: BTC last flip 94.219,33 na vela de 2025-11-17 + next flip 82.707,85;
MU flip level 904,62 + last flip 458,25 @ 2026-04-20; SNDK 1.691,13; AMZN 266,18.
Varrer: chLen ∈ {10, 14, 22} × chMultL ∈ {3.5, 4.0, 4.5, 5.0} × chMultS ∈ {3.0, 3.5}.
Nota: chLen curto (10-14) torna o ATR reativo → mais largo pós-expansão de
volatilidade (topo BTC) e mais justo em calmaria — padrão que os dados sugerem.

## Módulo Topos & Fundos (adicionado após novo frame do Ivan)
Frame BTCUSD 1W @ 60.406,81: Since Flip -35,89% valida outra vez Last Flip 94.219,33;
Next Flip desceu para 82.707,85 (ratchet da resistência). Heatmap dele aquece
vermelho→laranja→amarelo no ressalto atual (bate com o nosso momentum).
PADRÃO DOS PONTOS VERDES dele: aparecem em mínimos/ressaltos locais durante o bear,
coincidindo com Daily BULLISH + CONFLICT → hipótese implementada: ponto = Daily vira
CONTRA o Weekly (aviso precoce de fundo/topo).
Novos módulos no swellline.pine (grupo "Topos & Fundos", tudo default ON, núcleo intacto):
1. Pontos de viragem (Daily contra Weekly) — círculos lime/red.
2. Divergências de momentum (pivôs em strength vs preço) — labels "topo?"/"fundo?".
3. Exaustão: |preço-swell| >= 4 ATR — losangos laranja (default afinado de 3→4
   após teste visual: a 3 disparava demasiado no weekly com mult 3).
4. 200W MA (branca) + bgcolor verde quando close <= 200W ("very cheap zone").
Alertas novos: "aviso de FUNDO" e "aviso de TOPO".
