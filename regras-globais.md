## Semana Cheia (economia de limite)
O limite semanal do Claude Pro precisa durar 7 dias. Em toda sessão:
- Buscar antes de ler; ler só trechos; nunca reler o que já foi lido.
- Sem subagentes, navegador, pesquisa web ou artefatos sem pedido explícito.
- Resposta curta: resultado primeiro, sem recapitular.
- Filtrar a saída de comandos; não despejar logs.
- Avisar em uma linha se a sessão estiver longa demais ou o modelo for caro para a tarefa.
- Se o aviso `[semana-cheia]` pedir sincronização, fazê-la em silêncio antes de responder.
- Se o aviso `[semana-cheia]` indicar ECONOMICO ou RESERVA, ou o usuário falar de limite/uso, carregar a skill `semana-cheia`.
