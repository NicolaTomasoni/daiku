#!/usr/bin/env node
/**
 * I banchi dei due script fratelli in un colpo solo, più la scansione «l'attrezzo non installa».
 *
 * Attrezzo di sviluppo di questo repository, non del pacchetto: vive fuori da `plugins/`, non si
 * pubblica, non si installa in nessun progetto e non gira mai da un hook. Si lancia a mano, prima
 * di un rilascio o dopo aver toccato uno dei due fratelli:
 *
 *   node .docs/tools/repo-intelligence/self-check.mjs
 *
 * Non prende nessun argomento: `check-toolchain.mjs --self-check` e `check-run.mjs --self-check`
 * sanno collaudarsi da soli, con le proprie fixture in `os.tmpdir()`, e non hanno bisogno di una
 * radice reale. Il totale che stampa è **contato**: la somma dei `checks` dei due banchi più un
 * caso per ogni altro `.mjs` di questa cartella scandito dalla ricerca di comandi d'installazione
 * — non un numero scritto qui a mano.
 *
 * Il proprio file è escluso dalla scansione: il suo unico spawn è `process.execPath` sui due
 * fratelli, mai un comando d'installazione, e scandire sé stesso non aggiungerebbe nessuna
 * garanzia in più di quella che il codice sorgente qui sotto già mostra a chi lo legge.
 *
 * Stampa un JSON contato `{"checks":N,"passed":N,"failed":[…]}`, come i due fratelli; esce `1`
 * al primo rosso (fra un banco che fallisce e una scansione che trova un'installazione, come
 * `plugins/daiku/hooks/self-check.mjs` fa dei propri quattro banchi), `0` se tutto passa.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF_NAME = 'self-check.mjs';
const SIBLINGS = ['check-toolchain.mjs', 'check-run.mjs'];

/** Le forme di comando d'installazione che nessuno script della cartella deve contenere. */
const INSTALL_PATTERNS = [
  /\b(npm|pnpm|yarn)\s+(i|install|ci|add)\b/,
  /\bpip3?\s+install\b/,
  /\b-m\s+pip\s+install\b/,
  /\buv\s+(tool|pip)\s+install\b/,
  /\bpipx\s+install\b/,
  /\b(winget|choco|scoop|cargo|go|gem)\s+install\b/,
  /\bgraphify\s+(\w+\s+)?install\b/,
];

/** Lancia `<file> --self-check` con `process.execPath` e nient'altro. Se il banco non parte, è
 *  silenzioso o non torna un JSON leggibile, conta comunque come un caso — rosso — invece di
 *  sparire dal totale. */
function runBench(file, label) {
  const result = spawnSync(process.execPath, [file, '--self-check'], { encoding: 'utf-8', timeout: 120000 });
  if (result.error) return { checks: 1, failed: [`${label} non parte: ${result.error.message}`] };
  const stdout = (result.stdout || '').trim();
  if (!stdout) return { checks: 1, failed: [`${label} silenzioso (uscita ${result.status}): ${(result.stderr || '').trim()}`] };
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return { checks: 1, failed: [`${label} esito illeggibile: ${stdout.slice(0, 200)}`] };
  }
  return { checks: report.checks || 0, failed: (report.failed || []).map((f) => `${label}: ${f}`) };
}

let checksTotal = 0;
const failedAll = [];

for (const name of SIBLINGS) {
  const outcome = runBench(join(HERE, name), name);
  checksTotal += outcome.checks;
  failedAll.push(...outcome.failed);
}

let files = [];
try {
  files = readdirSync(HERE).filter((f) => f.endsWith('.mjs') && f !== SELF_NAME);
} catch (error) {
  checksTotal += 1;
  failedAll.push(`scansione-installazione: impossibile leggere ${HERE}: ${error.message}`);
}

for (const name of files) {
  checksTotal += 1;
  let text = '';
  try {
    text = readFileSync(join(HERE, name), 'utf-8');
  } catch (error) {
    failedAll.push(`installazione-assente:${name}: illeggibile: ${error.message}`);
    continue;
  }
  const hits = INSTALL_PATTERNS.map((p) => text.match(p)).filter(Boolean).map((m) => m[0]);
  if (hits.length) failedAll.push(`installazione-assente:${name}: trovato "${hits.join(', ')}"`);
}

const passed = checksTotal - failedAll.length;
process.stdout.write(JSON.stringify({ checks: checksTotal, passed, failed: failedAll }) + '\n');
process.exit(failedAll.length ? 1 : 0);
