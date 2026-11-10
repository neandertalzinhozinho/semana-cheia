#!/usr/bin/env node
// semana-cheia: acompanha o limite semanal do Claude e diz se o ritmo permite
// chegar ao fim da semana. Sem dependências.
//
// Duas fontes, combinadas:
//  1. Leitura REAL do limite (--sync), feita pelo próprio Claude no início das
//     sessões com a ferramenta de uso do app. Define também o reinício da semana.
//  2. Transcripts locais do Claude Code, para estimar o que foi gasto DEPOIS da
//     última leitura real.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const PROJETOS = path.join(CLAUDE, 'projects');
const CFG = path.join(CLAUDE, 'semana-cheia.json');
const EU = __filename.replace(/\\/g, '/');
const SEMANA = 7 * 24 * 3600 * 1000;
const SYNC_VENCE_H = 6;      // pede nova leitura real depois disso
const SYNC_VENCE_CEGO_H = 2; // sem escala calibrada não há estimativa entre leituras: ler mais vezes
const PCT_MIN_CALIBRAR = 5;  // abaixo disso o arredondamento distorce a escala
const MODELOS_CAROS = ['fable', 'mythos', 'opus'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Pesos aproximados (proporcionais ao preço de API). São uma estimativa:
// o limite real da assinatura não é publicado; as leituras reais corrigem a escala.
const PESO_MODELO = [['haiku', 1], ['sonnet', 3], ['opus', 5], ['fable', 10], ['mythos', 10]];
const PESO = { entrada: 1, escritaCache: 1.25, leituraCache: 0.1, saida: 5 };

function lerCfg() {
  const padrao = { resetDia: 1, resetHora: 0, fimSemana: null, orcamento: null, sync: null, janela5h: null };
  try { return Object.assign(padrao, JSON.parse(fs.readFileSync(CFG, 'utf8'))); }
  catch { return padrao; }
}
function salvarCfg(c) { fs.writeFileSync(CFG, JSON.stringify(c, null, 2) + '\n'); }

function inicioDaSemana(cfg, agora) {
  if (cfg.fimSemana) { // reinício real informado pelo app; avança de 7 em 7 dias
    let fim = new Date(cfg.fimSemana).getTime();
    while (fim <= agora.getTime()) fim += SEMANA;
    while (fim - SEMANA > agora.getTime()) fim -= SEMANA;
    return new Date(fim - SEMANA);
  }
  const d = new Date(agora);
  d.setHours(cfg.resetHora, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - cfg.resetDia + 7) % 7));
  if (d > agora) d.setDate(d.getDate() - 7);
  return d;
}

function listarJsonl(dir, desde, out = []) {
  let itens;
  try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of itens) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) listarJsonl(p, desde, out);
    else if (it.name.endsWith('.jsonl')) {
      try { if (fs.statSync(p).mtimeMs >= desde) out.push(p); } catch {}
    }
  }
  return out;
}

function pesoModelo(m) {
  m = String(m || '').toLowerCase();
  for (const [nome, p] of PESO_MODELO) if (m.includes(nome)) return [nome, p];
  return ['outro', 3];
}

function medir(inicio) {
  const msgs = new Map(); // dedupe: a mesma mensagem aparece em várias linhas
  for (const arq of listarJsonl(PROJETOS, inicio.getTime())) {
    let texto;
    try { texto = fs.readFileSync(arq, 'utf8'); } catch { continue; }
    const projeto = path.relative(PROJETOS, arq).split(path.sep)[0];
    for (const linha of texto.split('\n')) {
      if (!linha.includes('"usage"')) continue;
      let o;
      try { o = JSON.parse(linha); } catch { continue; }
      const u = o.message && o.message.usage;
      if (!u || !o.timestamp || new Date(o.timestamp) < inicio) continue;
      if (String(o.message.model).includes('synthetic')) continue;
      const [modelo, pm] = pesoModelo(o.message.model);
      const un = pm * (
        (u.input_tokens || 0) * PESO.entrada +
        (u.cache_creation_input_tokens || 0) * PESO.escritaCache +
        (u.cache_read_input_tokens || 0) * PESO.leituraCache +
        (u.output_tokens || 0) * PESO.saida) / 1e6;
      const chave = (o.message.id || o.uuid) + ':' + (o.requestId || '');
      const ant = msgs.get(chave);
      if (!ant || un > ant.un) msgs.set(chave, { un, modelo, projeto, sessao: o.sessionId || path.basename(arq) });
    }
  }
  const r = { total: 0, porModelo: {}, porSessao: {} };
  for (const m of msgs.values()) {
    r.total += m.un;
    r.porModelo[m.modelo] = (r.porModelo[m.modelo] || 0) + m.un;
    const k = m.projeto + ' / ' + String(m.sessao).slice(0, 8);
    r.porSessao[k] = (r.porSessao[k] || 0) + m.un;
  }
  return r;
}

// Unidades que contam para uma janela: a de um modelo só enxerga o gasto dele.
function unidades(uso, filtro) { return filtro ? (uso.porModelo[filtro] || 0) : uso.total; }

function avaliar(cfg, agora = new Date()) {
  const inicio = inicioDaSemana(cfg, agora);
  const decorrido = (agora - inicio) / SEMANA; // 0..1
  const uso = medir(inicio);
  const a = { agora, inicio, decorrido, dia: Math.min(7, Math.floor(decorrido * 7) + 1), uso, ideal: decorrido * 100 };
  a.diasRestantes = (1 - decorrido) * 7;
  a.idadeSyncH = cfg.sync ? (agora - new Date(cfg.sync.em)) / 3.6e6 : Infinity;
  const caro = MODELOS_CAROS.reduce((t, m) => t + (uso.porModelo[m] || 0), 0);
  a.parteCara = uso.total > 0 ? caro / uso.total * 100 : 0;
  const s = cfg.sync && new Date(cfg.sync.em) >= inicio ? cfg.sync : null;
  // A escala (orcamento) só vale para a mesma janela em que foi calibrada:
  // a geral (todas as unidades) ou a de um modelo (só as unidades dele).
  const filtroAtual = s ? (s.filtro || null) : (cfg.orcamentoFiltro || null);
  const temEscala = !!cfg.orcamento && (cfg.orcamentoFiltro || null) === filtroAtual;
  a.syncVencido = a.idadeSyncH > (temEscala ? SYNC_VENCE_H : SYNC_VENCE_CEGO_H);
  if (s) { // leitura real desta semana + estimativa do que veio depois
    const depois = temEscala ? Math.max(0, unidades(uso, s.filtro) - s.un) / cfg.orcamento * 100 : 0;
    a.usado = s.pct + depois;
    a.fonte = `real ${s.pct}% há ${f(a.idadeSyncH, 1)}h` + (temEscala ? ` + ${f(depois, 1)}% estimado` : '');
    a.gargalo = s.filtro || null;
    a.janelas = s.modelo ? `geral ${s.geral}%, ${s.modelo.nome} ${s.modelo.pct}%` : null;
  } else if (temEscala) {
    a.usado = unidades(uso, filtroAtual) / cfg.orcamento * 100;
    a.fonte = 'estimativa local';
    a.gargalo = filtroAtual;
  }
  if (a.usado != null) {
    a.usado = Math.min(100, a.usado);
    a.modo = a.usado >= 85 ? 'RESERVA' : a.usado > a.ideal * 1.1 + 3 ? 'ECONOMICO' : 'NORMAL';
    a.sobraPorDia = (100 - a.usado) / Math.max(a.diasRestantes, 0.25);
  } else a.modo = 'NORMAL';
  const j = cfg.janela5h;
  if (j && j.fim && new Date(j.fim) > agora) a.janela5h = j;
  return a;
}

const PEDIDO_SYNC = `Sincronize agora, sem comentar: se a ferramenta mcp__ccd_session_mgmt__get_usage existir (carregue com ToolSearch se estiver adiada), chame-a e rode node "${EU}" --sync <% semanal "all models"> <resetsAt semanal> <% da janela de 5h> <resetsAt da janela de 5h> <modelo da janela semanal por modelo, ex. fable> <% dessa janela>. Se não existir, ignore.`;

function linhaCurta(cfg, a) {
  let t = `[semana-cheia] Dia ${a.dia}/7`;
  if (a.usado == null) t += ' · uso desconhecido. Aplique as regras de economia.';
  else {
    t += ` · uso ~${f(a.usado)}% (ideal ${f(a.ideal)}%) · MODO ${a.modo}.`;
    if (a.modo !== 'NORMAL') t += ` Siga o modo ${a.modo} da skill semana-cheia e avise o usuário em uma linha.`;
    if (a.modo !== 'NORMAL' && a.gargalo) t += ` Gargalo: janela semanal do ${a.gargalo}. Tire trabalho desse modelo (delegar a outros modelos não consome essa janela).`;
  }
  if (a.janela5h && a.janela5h.pct >= 70)
    t += ` Janela de 5h em ${a.janela5h.pct}%: evite tarefas grandes até ${new Date(a.janela5h.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
  if (a.syncVencido) t += ' ' + PEDIDO_SYNC;
  return t;
}

function f(n, d = 0) { return Number(n).toFixed(d); }
const args = process.argv.slice(2);
// O hook de início de sessão nunca pode despejar erro no contexto do Claude.
process.on('uncaughtException', (e) => {
  if (args.includes('--curto')) process.exit(0);
  console.error('semana-cheia: ' + e.message);
  process.exit(1);
});
const cfg = lerCfg();

if (args[0] === '--sync') {
  const num = (v) => Number(String(v).replace('%', ''));
  const geral = num(args[1]), fim = new Date(args[2]);
  if (!(geral >= 0 && geral <= 100) || isNaN(fim)) {
    console.error('Uso: ritmo.js --sync <% semanal geral> <resetsAt ISO> [<% 5h> <resetsAt 5h ISO> [<modelo> <% semanal do modelo>]]');
    process.exit(1);
  }
  // Janela semanal de um modelo (ex.: "Weekly · Fable"): se estiver mais cheia que a geral, ela é o gargalo.
  const nomeM = String(args[5] || '').toLowerCase(), pctM = num(args[6]);
  const temM = PESO_MODELO.some(([n]) => n === nomeM) && pctM >= 0 && pctM <= 100;
  const filtro = temM && pctM > geral ? nomeM : null;
  const pct = filtro ? pctM : geral;
  cfg.fimSemana = fim.toISOString();
  const un = unidades(avaliar(cfg).uso, filtro);
  cfg.sync = { em: new Date().toISOString(), pct, un, filtro, geral, modelo: temM ? { nome: nomeM, pct: pctM } : null };
  if (pct >= PCT_MIN_CALIBRAR && un > 0) { cfg.orcamento = un / (pct / 100); cfg.orcamentoFiltro = filtro; }
  const p5 = Number(String(args[3]).replace('%', ''));
  cfg.janela5h = args[3] !== undefined && p5 >= 0 && !isNaN(new Date(args[4])) ? { pct: p5, fim: new Date(args[4]).toISOString() } : null;
  salvarCfg(cfg);
  console.log(linhaCurta(cfg, avaliar(cfg)));
} else if (args[0] === '--reset') {
  const dia = Number(args[1]), hora = Number(args[2] || 0);
  if (!(dia >= 0 && dia <= 6) || !(hora >= 0 && hora <= 23)) {
    console.error('Uso: ritmo.js --reset <dia 0=domingo..6=sábado> <hora 0-23>');
    process.exit(1);
  }
  Object.assign(cfg, { resetDia: dia, resetHora: hora, fimSemana: null, orcamento: null, sync: null });
  salvarCfg(cfg);
  console.log(`Reinício semanal: ${DIAS[dia]} às ${hora}h. Calibração zerada.`);
} else if (args[0] === '--calibrar') { // manual, para quando não há ferramenta de uso
  const pct = Number(String(args[1]).replace('%', ''));
  if (!(pct > 0 && pct <= 100)) {
    console.error('Uso: ritmo.js --calibrar <percentual semanal mostrado no app, 1-100>');
    process.exit(1);
  }
  const un = avaliar(cfg).uso.total;
  cfg.sync = { em: new Date().toISOString(), pct, un, filtro: null, geral: pct, modelo: null };
  if (pct >= PCT_MIN_CALIBRAR && un > 0) { cfg.orcamento = un / (pct / 100); cfg.orcamentoFiltro = null; }
  salvarCfg(cfg);
  console.log(linhaCurta(cfg, avaliar(cfg)));
} else {
  const a = avaliar(cfg);
  if (args.includes('--curto')) console.log(linhaCurta(cfg, a));
  else {
    console.log(`Semana iniciada ${DIAS[a.inicio.getDay()]} ${a.inicio.toLocaleString('pt-BR')} · dia ${a.dia}/7 · ${f(a.ideal)}% da semana decorrido`);
    if (a.usado != null) {
      console.log(`Uso: ~${f(a.usado)}% (${a.fonte}) · ideal até agora: ${f(a.ideal)}% → MODO ${a.modo}`);
      console.log(`Sobra: ${f(100 - a.usado)}% para ${f(a.diasRestantes, 1)} dias = ${f(a.sobraPorDia, 1)}%/dia`);
    } else console.log(`Uso local: ${f(a.uso.total, 2)} unidades, sem leitura real ainda.`);
    if (a.janelas) console.log(`Janelas semanais na última leitura: ${a.janelas}` + (a.gargalo ? ` → gargalo: ${a.gargalo}` : ''));
    if (a.janela5h) console.log(`Janela de 5h: ${a.janela5h.pct}% na última leitura, reinicia ${new Date(a.janela5h.fim).toLocaleString('pt-BR')}`);
    if (a.syncVencido) console.log('Leitura real vencida: sincronize (ver skill, seção Monitoramento).');
    const tot = a.uso.total || 1;
    console.log('\nGasto local por modelo:');
    for (const [m, v] of Object.entries(a.uso.porModelo).sort((x, y) => y[1] - x[1]))
      console.log(`  ${m.padEnd(8)} ${f(v / tot * 100).padStart(3)}%`);
    if (a.parteCara > 70) console.log(`Dica: ${f(a.parteCara)}% do gasto está nos modelos caros. Delegue tarefas simples e comuns (skill, seção Orquestração).`);
    console.log('\nSessões mais caras (projeto / sessão):');
    for (const [s, v] of Object.entries(a.uso.porSessao).sort((x, y) => y[1] - x[1]).slice(0, 5))
      console.log(`  ${f(v / tot * 100).padStart(3)}%  ${s}`);
  }
}
