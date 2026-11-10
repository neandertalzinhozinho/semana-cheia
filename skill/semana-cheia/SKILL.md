---
name: semana-cheia
description: Economia de limite do plano Claude Pro para o uso durar os 7 dias da semana. Use quando o usuário falar em "limite", "uso da semana", "ritmo", "modo econômico", "economizar tokens", "semana cheia", pedir para checar ou calibrar o consumo, ou quando o aviso [semana-cheia] do início da sessão indicar modo ECONOMICO ou RESERVA.
---

# Semana Cheia

Objetivo: o limite semanal do Claude Pro tem que durar 7 dias. Meta de ritmo: ~14% do limite por dia.

## Checar o ritmo

```
node ~/.claude/skills/semana-cheia/scripts/ritmo.js
```

Mostra: dia da semana do ciclo, uso estimado vs. ideal, modo atual, gasto por modelo e as sessões mais caras.

## Monitoramento automático

O limite real só existe nos servidores; a única leitura sem pedir nada ao usuário é a ferramenta `mcp__ccd_session_mgmt__get_usage` do app desktop (carregar via ToolSearch se estiver adiada). Fluxo:

1. O hook de início de sessão imprime a linha `[semana-cheia]`. Se a última leitura real tiver mais de 6h, a linha pede sincronização.
2. Ao receber o pedido (ou antes de uma tarefa grande, ou quando o usuário perguntar do limite): chamar `get_usage` e rodar

   ```
   node ~/.claude/skills/semana-cheia/scripts/ritmo.js --sync <pct> <resetsAt> <pct5h> <resetsAt5h>
   ```

   - `<pct>`: o MAIOR `percentUsed` entre as janelas "Weekly" (a de um modelo específico pode estourar antes da geral).
   - `<resetsAt>`: o `resetsAt` semanal. Isso define o início da semana sozinho.
   - `<pct5h>` e `<resetsAt5h>`: da janela "5-hour limit".
3. Entre leituras, o script soma à última leitura real o gasto estimado pelos transcripts locais.

Fazer a sincronização em silêncio; só falar do resultado se o modo não for NORMAL.

Sem a ferramenta (CLI, outro ambiente): `ritmo.js --calibrar <pct>` com o percentual que o usuário informar (Configurações > Uso), e `ritmo.js --reset <dia 0-6> <hora>` para o reinício semanal.

## Regras permanentes (todos os modos)

1. **Buscar antes de ler.** Grep/Glob primeiro; Read só do trecho necessário (offset/limit). Nunca reler arquivo já lido ou recém-editado.
2. **Sem subagentes** a menos que o usuário peça. Cada um recomeça do zero e custa caro.
3. **Chamadas em paralelo** quando independentes — menos idas e voltas, menos reenvio de contexto.
4. **Resposta curta.** Resultado primeiro, sem recapitular o que já foi dito, sem listar opções que não serão usadas.
5. **Não carregar o que não vai usar**: skills, esquemas de ferramentas, páginas web, capturas de tela (prefira texto a screenshot).
6. **Saída de comando enxuta**: filtrar (`Select-Object -First`, `--quiet`, `| tail`) em vez de despejar logs inteiros.
7. **Avisar o usuário**, em uma linha, quando perceber desperdício do lado dele: sessão muito longa (sugerir sessão nova com um resumo de 5 linhas), troca de assunto na mesma sessão, modelo caro em tarefa simples.

## Modos

| Modo | Quando | Comportamento |
|---|---|---|
| NORMAL | uso dentro do ritmo | Regras permanentes. |
| ECONOMICO | uso acima do ritmo | + Sugerir Sonnet/Haiku se a sessão estiver em Fable/Opus. Esforço baixo. Respostas mínimas. Nada de artefatos, diagramas, navegador ou pesquisa web sem pedido explícito. Verificação só do essencial. |
| RESERVA | ≥85% do limite gasto | + Só o que o usuário declarar urgente. Antes de qualquer tarefa grande, dizer o custo provável e perguntar se pode esperar o reinício. |

## Hábitos do usuário (lembrar quando for relevante, sem sermão)

- **Modelo**: Sonnet como padrão; Haiku para tarefas mecânicas; Fable/Opus só para arquitetura e bugs difíceis.
- **Uma tarefa por sessão**; assunto novo = sessão nova. Não retomar conversas antigas e enormes.
- **Juntar pedidos** em uma mensagem em vez de várias pequenas.
- **Desligar conectores/plugins** que o projeto não usa (cada um pesa em toda sessão).
- **CLAUDE.md enxuto**: só o que muda comportamento.

## Ao fechar uma tarefa grande

Se o ritmo estiver em ECONOMICO ou RESERVA, terminar com uma linha: uso atual, ideal, e quanto sobra por dia até o reinício.
