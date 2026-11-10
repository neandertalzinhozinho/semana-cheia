# semana-cheia

Plugin do Claude Code que faz o limite semanal do Claude Pro durar os 7 dias, sem perder qualidade.

## Instalar

No Claude Code, rode os dois comandos:

```
/plugin marketplace add neandertalzinhozinho/semana-cheia
```

```
/plugin install semana-cheia@semana-cheia
```

Depois abra uma sessão nova. Requer Node no PATH.

### Instalação manual (sem plugins)

```bash
git clone https://github.com/neandertalzinhozinho/semana-cheia.git
```

```bash
node semana-cheia/instalar.js
```

Copia a skill e os agentes para `~/.claude`, grava as regras no `~/.claude/CLAUDE.md` e o hook no `settings.json`. Remover: `node instalar.js --remover`. Use um método ou o outro; com a instalação manual presente, o hook do plugin fica em silêncio.

## O que faz

| Peça | Para quê |
|---|---|
| Hook `SessionStart` | Injeta as regras permanentes e uma linha com o ritmo da semana |
| Skill `semana-cheia` | Regras completas, monitoramento, modos NORMAL / ECONOMICO / RESERVA |
| Agentes `sc-batedor`, `sc-executor` | Recebem o trabalho delegado, com poucas ferramentas e relatório curto |
| `scripts/ritmo.js` | Mede o consumo: leitura real do limite mais estimativa pelos transcripts locais |

### Trava de qualidade

Economia corta desperdício, nunca correção: ler o necessário antes de editar, verificar tudo o que foi alterado, consultar a documentação na dúvida, nunca rebaixar o nível de uma tarefa.

### Orquestração

O modelo da sessão vira o orquestrador: planeja, decide, delega e confere.

| Nível | Exemplos | Modelo | Effort |
|---|---|---|---|
| trivial | até 3 chamadas de ferramenta | o próprio orquestrador | — |
| simples | buscar, mapear, resumir, rodar testes, edição mecânica | haiku | low |
| comum | feature especificada, bug de causa conhecida, testes | sonnet | medium |
| difícil | causa desconhecida, desenho multi-arquivo, desempenho | opus | high |
| crítica | arquitetura, segurança, dados, dinheiro, irreversível | fable | xhigh |

Todo resultado delegado é conferido; falha sobe um nível em vez de repetir.

### Monitoramento

No app desktop, o Claude lê o limite real no início das sessões (no máximo a cada 6h) e grava com `ritmo.js --sync`. A janela semanal mais cheia (geral ou de um modelo) define o modo. Fora do app desktop, calibre à mão com `ritmo.js --reset <dia 0-6> <hora>` e `ritmo.js --calibrar <%>`.

Ver o ritmo: peça ao Claude "checa meu ritmo".

## Limites

- A leitura real só acontece dentro de uma sessão; não há serviço em segundo plano.
- Entre leituras o valor é estimado: os pesos por modelo seguem a proporção de preço da API, e a fórmula do limite da assinatura não é pública.
- A estimativa só enxerga o Claude Code deste computador.
- As regras do hook custam cerca de 700 tokens por sessão.
