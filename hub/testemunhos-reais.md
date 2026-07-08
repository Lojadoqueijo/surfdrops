# Testemunhos reais — cofre de prova social

Comentários **reais** de membros (lives do YouTube, Telegram, Discord) para
substituir os placeholders da página de vendas.

**Onde entram:** `hub/index.html`, bloco `<div class="quotes" data-placeholder="true">`
(procurar `data-placeholder`). Quando houver 3-4 fortes, montar a tira e remover
o atributo `data-placeholder`.

## Regras (compliance UE)
- Citação **textual** + atribuição ao handle público. Sem reescrever palavras.
- Disclaimer colado ao bloco: *"Experiências individuais de membros. Resultados
  passados não garantem resultados futuros. Material educativo, não é recomendação."*
- Alegações de % de retorno ficam **dentro da frase do membro**, nunca em destaque
  isolado (não headline "12%").
- Preferir **screenshot do comentário original** (prova raw, inatacável) a texto.

## Recolhidos

### 1 — @trowabarton7258 · live YouTube · 2026-07-08
> ontem o radar do swell valeu-me 12% numa posição short na oracle. winwin

- Fonte: comentário na live do dia.
- Estado: **PUBLICADO** — em destaque único (`.quote-feat`) no bloco de prova social.
- Nota: quando chegarem +2/3, converter em tira (`.quotes`) ou usar screenshots dos
  comentários originais para máxima credibilidade.

### 2 — @joao1989as · live YouTube · 2026-07-08
> fantástico o poder da comunidade 💪

- Fonte: comentário na live do dia.
- Estado: **PUBLICADO** como print trabalhado (`.lp-card`, badge dourado estilo live).

<!-- Próximos: colar aqui à medida que saem, mesmo formato. -->

## Decisão de apresentação (2026-07-08)
Placeholders (`data-placeholder`) MANTIDOS por decisão do utilizador. Os reais
aparecem numa **tira de "prints trabalhados"** (`.live-proof` / `.lp-card`) que
recria o visual do comentário da live (badge dourado + handle + ▶ YouTube), limpa
e escalável, por cima dos placeholders. Cresce à medida que saem novos comentários.
