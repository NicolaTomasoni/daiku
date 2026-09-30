#!/usr/bin/env node
/**
 * Nessuno script del cantiere pusha.
 *
 * Attrezzo di sviluppo: vive fuori da `plugins/`, non si pubblica e non gira da un hook.
 *
 * Perche' esiste. Il push e' un gesto manuale dell'owner, e le due sedi che lo impongono —
 * la regola `permissions.deny` in `.claude/settings.json` e il command-guard del pacchetto,
 * acceso qui dal `.daiku/project.json` — giudicano la **riga di comando** che l'agente
 * digita. Uno script che pusha al posto suo non passa da nessuna delle due: la riga e'
 * `.\pubblica-dist.ps1`, e il push sta dentro il file. Il 30 settembre 2026 e' andata
 * esattamente cosi', e un rilascio e' uscito prima che l'owner lo decidesse.
 *
 * Da allora la regola vive anche qui: nessun file eseguibile del cantiere nomina un push.
 * Il controllo legge il **codice**, non i commenti — parlare del push e' cio' che questo
 * file fa dalla prima riga, e non deve segnalarsi da solo.
 *
 * Uso:
 *   node .docs/tools/check-no-push.mjs            # scansiona gli script del cantiere
 *   node .docs/tools/check-no-push.mjs --self-check
 *
 * Stampa un JSON contato ed esce `1` al primo rosso.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const SVILUPPO = join(QUI, '..', '..');

/** Le cartelle che portano script del cantiere, relative alla radice di sviluppo. */
const RADICI = ['.docs/tools', '.claude'];

/** Le estensioni che possono contenere un invocazione di git. */
const ESTENSIONI = ['.ps1', '.mjs', '.js', '.sh', '.cmd', '.bat'];

/** Il file che cerca il gesto e' l'unico che puo' nominarlo nel proprio codice. */
const SE_STESSO = 'check-no-push.mjs';

/** Il gesto, come apparirebbe in codice: `git ... push`, sullo stesso comando. */
const GESTO = /\bgit\b[^\n]*\bpush\b/;

/**
 * La riga ridotta al suo **codice**: senza stringhe e senza commenti.
 *
 * Sono i due posti dove nominare il push e' innocuo, e sono anche i posti dove questo
 * controllo, i suoi banchi e gli header degli script spiegano la regola — `Write-Host
 * "il push resta all'owner"` e `deny = @('Bash(git push:*)')` parlano del gesto, non lo
 * fanno. Le stringhe spariscono **prima** dei commenti: in PowerShell un `#` dentro una
 * stringa non apre niente.
 */
function soloCodice(riga, estensione) {
  let codice = riga
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  if (estensione === '.mjs' || estensione === '.js') {
    codice = codice.replace(/`(?:[^`\\]|\\.)*`/g, '``');
    return codice.replace(/\/\/.*$/, '');
  }
  return codice.replace(/#.*$/, '');
}

/** Ogni file eseguibile sotto le radici, con la sua estensione. */
function scriptDelCantiere(radice) {
  const trovati = [];
  const scendi = (assoluta) => {
    let voci;
    try {
      voci = readdirSync(assoluta, { withFileTypes: true });
    } catch {
      return; // cartella assente: niente da controllare, e non e' un guasto
    }
    for (const voce of voci) {
      const percorso = join(assoluta, voce.name);
      if (voce.isDirectory()) {
        if (voce.name === 'node_modules') continue;
        scendi(percorso);
        continue;
      }
      if (!ESTENSIONI.some((e) => voce.name.endsWith(e))) continue;
      if (voce.name === SE_STESSO) continue;
      trovati.push(percorso);
    }
  };
  scendi(radice);
  return trovati;
}

/** Il primo push che il file invoca davvero, o `null`. */
function pushNelFile(percorso) {
  const estensione = ESTENSIONI.find((e) => percorso.endsWith(e)) || '';
  let testo;
  try {
    testo = readFileSync(percorso, 'utf-8');
  } catch {
    return null; // illeggibile: non e' questo controllo a doverlo dichiarare
  }
  const righe = testo.split('\n');
  for (let i = 0; i < righe.length; i += 1) {
    if (GESTO.test(soloCodice(righe[i], estensione))) {
      return { riga: i + 1, testo: righe[i].trim() };
    }
  }
  return null;
}

function scansiona() {
  const radici = RADICI.map((r) => join(SVILUPPO, r)).filter((r) => {
    try {
      return statSync(r).isDirectory();
    } catch {
      return false;
    }
  });

  const failed = [];
  let controllati = 0;
  for (const radice of radici) {
    for (const file of scriptDelCantiere(radice)) {
      controllati += 1;
      const push = pushNelFile(file);
      if (push) {
        failed.push(
          `${relative(SVILUPPO, file).replace(/\\/g, '/')}:${push.riga}: invoca un push — «${push.testo}»`
        );
      }
    }
  }
  return { controllati, failed };
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (nome, condizione, dettaglio = '') => {
    ran += 1;
    if (!condizione) failed.push(`${nome}: ${dettaglio}`);
  };

  const riga = (testo, ext = '.sh') => soloCodice(testo, ext);

  check('riconosce un push nudo', GESTO.test(riga('git push')), 'non riconosciuto');
  check('riconosce un push con argomenti', GESTO.test(riga('git push origin main')), 'non riconosciuto');
  check('riconosce un push su un altro albero', GESTO.test(riga('git -C $Dest push --quiet')), 'non riconosciuto');
  check('riconosce un push dentro un altro comando', GESTO.test(riga('npm test && git push')), 'non riconosciuto');
  check('riconosce git.exe', GESTO.test(riga('git.exe push')), 'non riconosciuto');

  check('ignora un commento di shell', !GESTO.test(riga('# git push resta all owner')), 'falso positivo');
  check('ignora un commento di PowerShell', !GESTO.test(riga('# poi committa e pusha', '.ps1')), 'falso positivo');
  check('ignora una riga di commento in un mjs', !GESTO.test(riga('// git push e vietato', '.mjs')), 'falso positivo');
  check('ignora la parola push senza git', !GESTO.test(riga('Write-Host "il push resta all owner"')), 'falso positivo');
  check('ignora git status', !GESTO.test(riga('git status --porcelain')), 'falso positivo');
  check('ignora un messaggio di commit che parla di push', !GESTO.test(riga('git commit -m "il push resta all owner"')), 'falso positivo');
  check('ignora una fetch', !GESTO.test(riga('git fetch origin')), 'falso positivo');
  check('ignora un comando in una stringa PowerShell', !GESTO.test(riga('Write-Host "premi git push per pubblicare"', '.ps1')), 'falso positivo');
  check('ignora una regola di permesso scritta come stringa', !GESTO.test(riga("$deny = @('Read(~/Desktop/**)', 'Bash(git push:*)')", '.ps1')), 'falso positivo');
  check('ignora un messaggio che nomina il gesto', !GESTO.test(riga('echo "git push is forbidden"')), 'falso positivo');

  // Il file che cerca il gesto lo nomina in una regex, che e' codice: e' per questo che si
  // esclude per nome, e il banco verifica che l'esclusione tenga.
  const scansionati = scriptDelCantiere(join(SVILUPPO, '.docs', 'tools'));
  check('si esclude da solo', !scansionati.some((f) => basename(f) === SE_STESSO), 'compare fra gli script scansionati');

  const esito = scansiona();
  check(
    'nessuno script del cantiere invoca un push',
    esito.failed.length === 0,
    esito.failed.join(' | ')
  );

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

const esito = scansiona();
process.stdout.write(
  JSON.stringify(
    { scripts: esito.controllati, push: esito.failed.length, failed: esito.failed },
    null,
    2
  ) + '\n'
);
process.exit(esito.failed.length ? 1 : 0);
