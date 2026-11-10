#!/usr/bin/env node
// Hook SessionStart do plugin: injeta as regras permanentes e a linha de ritmo.
// Um plugin não pode escrever no CLAUDE.md global, então as regras entram por aqui.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

try {
  const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  // Instalação manual (instalar.js) já presente: ela cuida de tudo; não duplicar.
  let md = '';
  try { md = fs.readFileSync(path.join(CLAUDE, 'CLAUDE.md'), 'utf8'); } catch {}
  if (md.includes('semana-cheia:inicio')) process.exit(0);

  const ritmo = path.join(__dirname, 'ritmo.js').replace(/\\/g, '/');
  console.log(fs.readFileSync(path.join(__dirname, '..', 'regras.md'), 'utf8').trim());
  console.log(`\nNo plugin, os agentes se chamam \`semana-cheia:sc-batedor\` e \`semana-cheia:sc-executor\`. Script de ritmo: node "${ritmo}"\n`);
  const r = spawnSync(process.execPath, [ritmo, '--curto'], { encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
} catch {
  process.exit(0); // nunca despejar erro no contexto do Claude
}
