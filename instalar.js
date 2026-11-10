#!/usr/bin/env node
// Instala a skill semana-cheia em ~/.claude. Uso: node instalar.js [--sem-hook] [--remover]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const ORIGEM = path.join(__dirname, 'skill', 'semana-cheia');
const DESTINO = path.join(CLAUDE, 'skills', 'semana-cheia');
const CLAUDE_MD = path.join(CLAUDE, 'CLAUDE.md');
const SETTINGS = path.join(CLAUDE, 'settings.json');
const INI = '<!-- semana-cheia:inicio -->', FIM = '<!-- semana-cheia:fim -->';
const remover = process.argv.includes('--remover');
const semHook = process.argv.includes('--sem-hook');

fs.mkdirSync(CLAUDE, { recursive: true });

// 1. Skill
fs.rmSync(DESTINO, { recursive: true, force: true });
if (!remover) {
  fs.cpSync(ORIGEM, DESTINO, { recursive: true });
  console.log('Skill copiada para', DESTINO);
}

// 1b. Agentes de delegação (sc-batedor, sc-executor)
const AG_ORIGEM = path.join(__dirname, 'agentes');
const AG_DESTINO = path.join(CLAUDE, 'agents');
const shell = process.platform === 'win32' ? 'Bash, PowerShell' : 'Bash';
for (const nome of fs.readdirSync(AG_ORIGEM).filter((n) => n.endsWith('.md'))) {
  const alvo = path.join(AG_DESTINO, nome);
  if (remover) { fs.rmSync(alvo, { force: true }); continue; }
  fs.mkdirSync(AG_DESTINO, { recursive: true });
  fs.writeFileSync(alvo, fs.readFileSync(path.join(AG_ORIGEM, nome), 'utf8').replace('{{SHELL}}', shell));
}
if (!remover) console.log('Agentes instalados em', AG_DESTINO);

// 2. Bloco no CLAUDE.md global (substitui o bloco anterior, preserva o resto)
let md = fs.existsSync(CLAUDE_MD) ? fs.readFileSync(CLAUDE_MD, 'utf8') : '';
const i = md.indexOf(INI), j = md.indexOf(FIM);
if (i >= 0 && j > i) md = (md.slice(0, i) + md.slice(j + FIM.length)).trim();
if (!remover) {
  const regras = fs.readFileSync(path.join(__dirname, 'regras-globais.md'), 'utf8').trim();
  md = (md.trim() ? md.trim() + '\n\n' : '') + `${INI}\n${regras}\n${FIM}`;
}
if (md.trim()) fs.writeFileSync(CLAUDE_MD, md.trim() + '\n');
else if (fs.existsSync(CLAUDE_MD)) fs.rmSync(CLAUDE_MD);
console.log('CLAUDE.md global atualizado:', CLAUDE_MD);

// 3. Hook de início de sessão (mostra o ritmo em uma linha)
let cfg = {};
if (fs.existsSync(SETTINGS)) {
  const bruto = fs.readFileSync(SETTINGS, 'utf8');
  try { cfg = JSON.parse(bruto); }
  catch { console.error('settings.json inválido; hook não instalado.'); process.exit(1); }
  fs.writeFileSync(SETTINGS + '.bak-semana-cheia', bruto);
}
const nosso = (g) => JSON.stringify(g).includes('semana-cheia');
const lista = ((cfg.hooks || {}).SessionStart || []).filter((g) => !nosso(g));
if (!remover && !semHook) {
  const script = path.join(DESTINO, 'scripts', 'ritmo.js').replace(/\\/g, '/');
  lista.push({ hooks: [{ type: 'command', command: `node "${script}" --curto` }] });
}
if (lista.length) { cfg.hooks = cfg.hooks || {}; cfg.hooks.SessionStart = lista; }
else if (cfg.hooks) { delete cfg.hooks.SessionStart; if (!Object.keys(cfg.hooks).length) delete cfg.hooks; }
if (Object.keys(cfg).length || fs.existsSync(SETTINGS)) fs.writeFileSync(SETTINGS, JSON.stringify(cfg, null, 2) + '\n');
console.log(remover ? 'Removido.' : semHook ? 'Instalado (sem hook).' : 'Hook de início de sessão instalado em ' + SETTINGS);

if (!remover) console.log('\nPróximos passos:\n  1. node "' + path.join(DESTINO, 'scripts', 'ritmo.js') + '" --reset <dia 0-6> <hora>\n  2. node "' + path.join(DESTINO, 'scripts', 'ritmo.js') + '" --calibrar <% semanal do app>\n  3. Abra uma sessão nova do Claude.');
