// Recopie les modules partagés (config, barème, niveaux) vers les Edge Functions.
// Usage : node tools/sync-shared.mjs          → copie
//         node tools/sync-shared.mjs --check  → échoue si les copies divergent
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = ['config.js', 'scoring.js', 'levels.js'];
const HEADER = '// FICHIER GÉNÉRÉ par tools/sync-shared.mjs depuis js/ — ne pas modifier ici.\n';
const check = process.argv.includes('--check');
let stale = 0;
for (const f of FILES) {
  const src = HEADER + readFileSync(`js/${f}`, 'utf8');
  const dst = `supabase/functions/_shared/${f}`;
  let cur = null;
  try { cur = readFileSync(dst, 'utf8'); } catch { /* absent */ }
  if (cur === src) continue;
  if (check) { console.error(`${dst} n'est pas à jour (lancer : node tools/sync-shared.mjs)`); stale++; }
  else { writeFileSync(dst, src); console.log(`copié : ${dst}`); }
}
if (stale) process.exit(1);
