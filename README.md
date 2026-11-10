# semana-cheia

Faz o limite semanal do Claude Pro durar os 7 dias.

## O que instala

| Peça | Onde | Para quê |
|---|---|---|
| Skill `semana-cheia` | `~/.claude/skills/semana-cheia` | Regras completas, modos NORMAL / ECONOMICO / RESERVA |
| Agentes `sc-batedor`, `sc-executor` | `~/.claude/agents` | Recebem o trabalho delegado, com poucas ferramentas e relatório curto |
| Bloco de regras | `~/.claude/CLAUDE.md` | Trava de qualidade, orquestração e economia ativas em toda sessão |
| Hook `SessionStart` | `~/.claude/settings.json` | Uma linha com o ritmo da semana no início de cada sessão |
| `ritmo.js` | dentro da skill | Mede o consumo pelos transcripts locais |

## Instalar (qualquer PC com Node)

```bash
node instalar.js
```

No app desktop não há mais nada a configurar: no início das sessões o Claude lê o limite real pela ferramenta de uso do app e grava com `ritmo.js --sync` (no máximo uma leitura a cada 6h). Entre leituras, o script soma o gasto estimado pelos transcripts locais.

Fora do app desktop (sem a ferramenta de uso), calibre à mão:

```bash
node ~/.claude/skills/semana-cheia/scripts/ritmo.js --reset 2 14
```

```bash
node ~/.claude/skills/semana-cheia/scripts/ritmo.js --calibrar 40
```

Opções: `node instalar.js --sem-hook` (sem o aviso de início de sessão) · `node instalar.js --remover`.

## Uso

- Ver o ritmo: `node ~/.claude/skills/semana-cheia/scripts/ritmo.js`, ou peça ao Claude "checa meu ritmo".

## Orquestração

O modelo que você escolher para a sessão vira o orquestrador: planeja, decide, delega e confere. Cada tarefa vai para o modelo do seu nível:

| Nível | Exemplos | Modelo | Effort |
|---|---|---|---|
| trivial | até 3 chamadas de ferramenta | o próprio orquestrador | — |
| simples | buscar, mapear, resumir, rodar testes, edição mecânica | haiku | low |
| comum | feature especificada, bug de causa conhecida, testes | sonnet | medium |
| difícil | causa desconhecida, desenho multi-arquivo, desempenho | opus | high |
| crítica | arquitetura, segurança, dados, dinheiro, irreversível | fable | xhigh |

Travas: o nível nunca é rebaixado para economizar; todo resultado delegado é conferido (diff e verificação); falha sobe um nível em vez de repetir.

## Limites da medição

- A leitura real só acontece dentro de uma sessão do Claude; não há arquivo local nem serviço em segundo plano com o limite.
- Entre leituras o valor é estimado: os pesos por modelo seguem a proporção de preço da API, e a Anthropic não publica a fórmula do limite da assinatura.
- A estimativa só enxerga o Claude Code deste computador. Uso no chat do claude.ai ou em outro PC só aparece na próxima leitura real.

## Hábitos que mais economizam

1. Sonnet como modelo padrão; Fable/Opus só para o que é difícil.
2. Uma tarefa por sessão; assunto novo, sessão nova.
3. Juntar pedidos em uma mensagem.
4. Desligar conectores e plugins que o projeto não usa.
