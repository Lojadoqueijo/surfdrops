# 🌊 SwellLine — Documento-fonte para apresentação

> Documento de apoio para gerar uma aula/apresentação sobre o indicador SwellLine.
> Público: comunidade de trading (nível iniciante a intermédio). Idioma: Português.
> Tom: didático, simples, honesto. Foco: indicador de tendência de LONGO PRAZO.

## O que é a SwellLine
A SwellLine é um indicador de tendência para o TradingView. Mostra, de forma visual,
se um ativo está numa tendência de subida (bull) ou de descida (bear), e marca o
momento exato em que essa tendência vira. O nome vem de "swell" — a ondulação que
forma a onda: a ideia é apanhar a onda da tendência cedo e largá-la quando acaba.

É um indicador de SEGUIMENTO DE TENDÊNCIA (trend-following), não um adivinho. Reage
à tendência; não prevê o futuro. Brilha no longo prazo, sobretudo no gráfico semanal.

## Como funciona (em linguagem simples)
A SwellLine é uma linha que acompanha o preço a uma distância que se adapta à
volatilidade (usa o ATR — Average True Range, a média do movimento por vela):
- Quando o preço está em tendência de subida, a linha fica VERDE e por BAIXO do preço,
  servindo de suporte.
- Quando vira para descida, a linha fica VERMELHA e por CIMA do preço, servindo de
  resistência.
- A linha desenha-se "em degraus" (é um trailing stop adaptativo): persegue o preço
  mas só inverte quando a tendência inverte mesmo, evitando reagir a cada pequena oscilação.

## Os 4 elementos a ler
1. A LINHA E A COR: verde = bull (comprar/manter); vermelho = bear (vender/fora).
   Quando muda de cor, aparece a etiqueta "bullish" ou "bearish" — é o SINAL.
2. O FLIP LEVEL: o preço exato onde a tendência vira. Funciona como suporte (em bull)
   ou resistência (em bear), e como stop loss natural.
3. A TABELA (canto inferior esquerdo): mostra a tendência no Weekly e no Daily ao mesmo
   tempo, e o estado de alinhamento.
4. A FAIXA DE FORÇA (heatmap no fundo): mede o momentum (força do movimento).
   Verde = força compradora; vermelho = vendedora; amarelo = transição. Serve de aviso
   prévio de que a maré pode estar a virar.

## A REGRA DE OURO (a parte mais importante da aula)
A tabela combina dois prazos: Weekly (semanal) e Daily (diário).
- ALIGNED BULL = ambos a subir → sinal forte de compra.
- ALIGNED BEAR = ambos a descer → ficar fora / proteger.
- CONFLICT = os dois prazos discordam → ESPERAR, não fazer nada.
Regra mecânica: só agir quando está ALIGNED. Em CONFLICT, mãos quietas. Esta disciplina
é o que separa operar com método de operar por impulso.

## Em que timeframe usar (foco no longo prazo)
- WEEKLY (semanal): IDEAL. É o sinal principal. Dá poucos sinais por ano, mas cada um
  tem peso e capta os grandes movimentos, evitando o ruído do curto prazo.
- DAILY (diário): bom para confirmação e timing de entrada/saída.
- 4h / 1h: ruidoso, muitos sinais falsos. Usar apenas como contexto.
- 15m ou menos: evitar.
Mensagem central: é um indicador de tendência de fundo. Paciência — poucos sinais bons
valem mais do que muitos sinais apressados.

## Como usar — passo a passo
1. Abrir o gráfico no Weekly.
2. Esperar por um flip (a linha muda de cor).
3. Confirmar na tabela: só entrar se estiver ALIGNED.
4. Entrada na direção da linha (verde = comprar).
5. Stop no Flip Level (se o preço fechar do outro lado, sair).
6. Saída quando a linha vira de cor, ou em alvos escalonados de 1/2/3 ATR.

## Alertas automáticos
A SwellLine pode enviar alertas (incluindo para o Telegram, via webhook) apenas nos
"flips sem conflito" — ou seja, só quando Weekly e Daily estão alinhados. Assim não se
perde um sinal importante e evitam-se os falsos.

## Demonstração recomendada (Bar Replay)
A melhor forma de ensinar é com o Bar Replay do TradingView: escolher um ponto no
passado e avançar vela a vela, deixando a audiência prever o flip antes de ele aparecer.
Mostrar tanto um flip que correu bem como um sinal falso (whipsaw) — a honestidade
constrói confiança.

## Perguntas frequentes (FAQ)
- "Funciona em qualquer ativo?" Sim, mas é mais fiável em ativos líquidos e no longo prazo.
- "Serve para day trading?" Não é o ideal — quanto mais baixo o timeframe, mais ruído.
- "Repinta?" Os sinais confirmam no fecho da vela; usar alertas "once per bar close".
- "Garante lucro?" Não. Nenhum indicador garante. É uma ferramenta de tendência; o risco
  tem de ser sempre gerido com stop e gestão de posição.

## Aviso legal
Este material é apenas educativo e não constitui aconselhamento financeiro. Cada pessoa
é responsável pelas suas decisões. Usar sempre stop e arriscar apenas o que se pode perder.
