---
name: semana-cheia
description: Economia de limite do plano Claude Pro sem perder qualidade - ritmo semanal, modos NORMAL/ECONOMICO/RESERVA e orquestração por nível de tarefa (delegar a modelos mais baratos). Use quando o usuário falar em "limite", "uso da semana", "ritmo", "economizar", "delegar", "orquestrar", pedir para checar ou calibrar o consumo, ou quando o aviso [semana-cheia] indicar ECONOMICO ou RESERVA.
---

# Semana Cheia

O limite semanal do Claude Pro tem que durar 7 dias (cerca de 14% por dia) sem piorar o projeto.

## 1. Trava de qualidade (vence todas as outras regras)

Economia corta desperdício, nunca correção.

- Ler o necessário para entender antes de editar. Reler se o arquivo pode ter mudado.
- Verificar tudo o que foi alterado (teste, build ou execução), em qualquer modo.
- Dúvida sobre API, versão ou comportamento: consultar a documentação ou o código-fonte. Não chutar.
- Nunca rebaixar o nível de uma tarefa para economizar. Sem limite para fazer bem: adiar ou dividir.
- Retrabalho custa mais que acertar de primeira.

## 2. Orquestração

O modelo da sessão é o orquestrador: entende o pedido, planeja, decide, delega, confere e responde. Trabalho braçal vai para agentes mais baratos, via ferramenta Agent (ou Task). Sem essa ferramenta, faça você mesmo.

### Níveis

| Nível | Sinais | model | effort |
|---|---|---|---|
| simples | buscar, mapear, resumir arquivo ou log, rodar testes e reportar, edição mecânica | haiku | low |
| comum | feature especificada, bug de causa conhecida, escrever testes, refactor limitado | sonnet | medium |
| difícil | bug de causa desconhecida, desenho que cruza arquivos, desempenho, concorrência | opus | high |
| crítica | arquitetura, segurança, dados, dinheiro, ação irreversível | fable | xhigh |

Na dúvida entre dois níveis, use o mais alto. Modelo indisponível: use o próximo acima.

Seu próprio nível: haiku = simples, sonnet = comum, opus = difícil, fable ou mythos = crítica.

### Quem faz

- **Trivial** (até 3 chamadas de ferramenta, contexto já em mãos): você mesmo. Delegar custaria mais.
- **Abaixo do seu nível**: delegue ao modelo da tabela.
- **No seu nível**: você mesmo. Um agente do mesmo modelo só paga a partida a frio. Exceção: leitura volumosa que encheria seu contexto.
- **Acima do seu nível**: delegue para cima e avise o usuário em uma linha.
- **Difícil ou crítica e grande**: decomponha. Decisão e desenho ficam no nível alto; a execução, já especificada, desce para comum.

Agentes: `sc-batedor` (somente leitura, haiku) e `sc-executor` (edita e roda comandos; passe `model` e `effort` da tabela). Sem eles instalados: `general-purpose` com os mesmos `model` e `effort`.

### Não delegue quando

- O briefing teria que recontar mais de 15 linhas de contexto da conversa.
- A tarefa exige ida e volta com o usuário a cada passo.
- Outro agente está editando o mesmo arquivo.

### Briefing (curto e autossuficiente)

1. Objetivo em uma frase, e o porquê.
2. Arquivos ou área, com os caminhos que você já conhece.
3. Restrições: o que não tocar, estilo, compatibilidade.
4. Verificação: o comando que prova que funcionou.
5. O que significa "pronto".

O formato do relatório já está nos agentes `sc-*`; não repita.

### Conferência (sempre, antes de dar por pronto)

- Leia o diff ou os trechos `arquivo:linha` citados, não os arquivos inteiros.
- Relatório sem resultado de verificação = não verificado: rode você.
- Nível crítico: revise a lógica linha a linha.
- `BLOQUEIO:` — responda ao agente (SendMessage) ou decida você.
- `INCERTO:` ou falha — suba um nível. Não repita no mesmo.

### Paralelo

Tarefas independentes: lance na mesma mensagem. Nunca dois escritores no mesmo arquivo.

## 3. Monitoramento do limite

```
node <ritmo.js>
```

`<ritmo.js>`: no plugin, o caminho impresso no início da sessão ("Script de ritmo"); na instalação manual, `~/.claude/skills/semana-cheia/scripts/ritmo.js`. No plugin os agentes têm prefixo: `semana-cheia:sc-batedor`, `semana-cheia:sc-executor`.

Mostra dia do ciclo, uso real mais estimado, uso ideal, modo, gasto por modelo e sessões mais caras.

O limite real só existe nos servidores. A leitura sem pedir nada ao usuário é a ferramenta `mcp__ccd_session_mgmt__get_usage` do app desktop (carregar com ToolSearch se estiver adiada).

1. O hook de início de sessão imprime a linha `[semana-cheia]`. Com a leitura real vencida (6h; 2h enquanto a escala não está calibrada), a linha pede sincronização.
2. Ao receber o pedido, antes de uma tarefa grande, ou quando o usuário perguntar do limite: chame `get_usage` e rode

   ```
   node <ritmo.js> --sync <pct> <resetsAt> <pct5h> <resetsAt5h> <modelo> <pctModelo>
   ```

   - `<pct>`, `<resetsAt>`: da janela "Weekly · all models". O `resetsAt` define o início da semana.
   - `<pct5h>`, `<resetsAt5h>`: da janela "5-hour limit".
   - `<modelo>`, `<pctModelo>`: da janela semanal de um modelo, se existir (ex.: "Weekly · Fable" vira `fable 9`). Havendo mais de uma, a mais cheia.
3. A janela mais cheia é o gargalo e define o modo. Se for a de um modelo, só o gasto dele conta: delegar a outros modelos alivia essa janela por inteiro.
4. Entre leituras, o script soma à leitura real o gasto estimado pelos transcripts locais.

Sincronize em silêncio; só comente se o modo não for NORMAL.

Sem a ferramenta (terminal puro): `ritmo.js --calibrar <pct>` com o percentual que o usuário informar, e `ritmo.js --reset <dia 0-6> <hora>`.

## 4. Modos

| Modo | Quando | Muda o quê |
|---|---|---|
| NORMAL | uso dentro do ritmo | Nada além das seções 1, 2 e 5. |
| ECONOMICO | uso acima do ritmo | Se o gargalo for a janela do seu próprio modelo, delegue tudo o que não exigir o seu nível. Delegue também leitura volumosa trivial. Respostas mínimas. Nada de extras não pedidos (artefatos, diagramas, explicações longas). Uma vez por sessão, lembre que um orquestrador mais barato reduz o custo de coordenação. |
| RESERVA | 85% ou mais gasto | Só o que o usuário declarar urgente. Antes de tarefa grande, diga o custo provável e pergunte se pode esperar o reinício. |

O nível das tarefas e a verificação não mudam em nenhum modo.

Ao fechar tarefa grande em ECONOMICO ou RESERVA: uma linha com uso atual, ideal e sobra por dia.

## 5. Economia do dia a dia

1. Buscar antes de ler; ler trechos; não reler o que não mudou.
2. Chamadas independentes em paralelo.
3. Resposta curta, resultado primeiro, sem recapitular.
4. Filtrar a saída de comandos.
5. Texto em vez de screenshot. Navegador, pesquisa web e artefatos só quando a tarefa precisa.
6. Avisar em uma linha: sessão longa demais, troca de assunto na mesma sessão.

## 6. Hábitos do usuário (lembrar quando for relevante, sem sermão)

- Uma tarefa por sessão; assunto novo, sessão nova.
- Sessão grande parada por mais de uma hora: melhor abrir outra com um resumo do que retomar.
- Juntar pedidos em uma mensagem.
- Desligar conectores e plugins que o projeto não usa.
- Só tarefas simples no dia: escolher um modelo mais barato para a sessão.
