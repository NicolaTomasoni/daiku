#!/usr/bin/env node
/**
 * Nessun lockfile e nessun campo di dipendenze nella radice di `plugins/`.
 *
 * Attrezzo di sviluppo: vive fuori da `plugins/`, non si pubblica e non gira da un hook.
 *
 * Perche' esiste. `STACK.md` §2 vieta al pacchetto qualsiasi manifesto di **dipendenze** e
 * qualsiasi lockfile, e un divieto che conta vive in due sedi: il testo che dice cosa fare e un
 * controllo che lo impone (`ARCHITECTURE.md` §3). Finora la regola era prosa sola, e proprio in
 * quel momento il pacchetto guadagna un `package.json` alla radice di `plugins/` — la radice che
 * il rilascio porta alla produzione e che il clone del marketplace consegna intera. La radice e'
 * il posto dove il guasto non si vede in locale ma arriva a chi installa.
 *
 * Due forme, entrambe rosse, entrambe per **nome esatto**:
 *  - ogni lockfile della lista fissa — mai una sottostringa: `blocks.json` del corpus contiene
 *    nelle lettere il segno di un lockfile, e un confronto per sottostringa lo rifiuterebbe;
 *  - ogni `package.json` che parsifica e porta un campo di dipendenze non vuoto, piu' uno che non
 *    parsifica affatto — un file che non si puo' giurare non e' un file pulito.
 *
 * Il descrittore del plugin (`name` + la via dell'entrypoint, nessun campo) passa: e' la forma
 * che §2 ammette, e questo controllo e' cio' che la tiene quella.
 *
 * Uso:
 *   node .docs/tools/check-no-deps.mjs <radice>   # scansiona la radice, contato
 *   node .docs/tools/check-no-deps.mjs --self-check
 *
 * Uscita: JSON contato `{checks, passed, failed[]}`. Esce `1` al primo caso rosso, `2` senza
 * argomento. Il banco ha un caso rosso per ogni nome della lista e per ogni campo enumerato —
 * un campo senza caso rosso resterebbe `never_red`, e un controllo che non si e' mai visto
 * rosso non si distingue da uno che non puo' fallire.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const SVILUPPO = join(QUI, '..', '..');

/** I lockfile, per nome esatto. Una aggiunta qui vuole il suo caso rosso nel banco. */
export const LOCKFILE = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
];

/** I campi di dipendenze che un `package.json` non puo' portare. Anche questi, col loro caso. */
export const CAMPI = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundledDependencies',
];

/** Un campo che non e' vuoto: oggetto con voci, array pieno, stringa con dentro qualcosa. */
export function nonVuoto(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return !!value;
}

/**
 * Le violazioni di un file: `[]` dove il nome non e' un lockfile e il JSON, quando e' un
 * `package.json`, non porta nessuno dei cinque campi. Un `package.json` che non parsifica
 * fallisce per intero — non si puo' giurare che sia pulito.
 */
export function violazioni(nome, testo) {
  const righe = [];
  if (LOCKFILE.includes(nome)) {
    righe.push('lockfile, per nome esatto');
  }
  if (nome !== 'package.json') return righe;
  let parsed = null;
  try {
    parsed = JSON.parse(testo);
  } catch (error) {
    return [`non parsifica (${error.message})`];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return ['non e\' un oggetto JSON'];
  }
  for (const campo of CAMPI) {
    if (nonVuoto(parsed[campo])) righe.push(`campo ${campo} non vuoto`);
  }
  return righe;
}

/**
 * La radice, tutta: un `checks` per file letto, una riga di `failed` per violazione, e
 * `passed` = file senza problemi (un file puo' averne piu' d'una, e allora pesa un solo
 * fallito). Cartelle assente o illeggibile: zero controlli, nessun rosso — il dito che conta
 * qui e' il descrittore, non l'assenza di un albero.
 */
export function scansiona(radice) {
  const failed = [];
  let checks = 0;
  let sporchi = 0;
  const cammina = (cartella) => {
    let voci;
    try {
      voci = readdirSync(cartella, { withFileTypes: true });
    } catch {
      return;
    }
    for (const voce of voci) {
      const percorso = join(cartella, voce.name);
      if (voce.isDirectory()) {
        cammina(percorso);
        continue;
      }
      checks += 1;
      let testo;
      try {
        testo = readFileSync(percorso, 'utf-8');
      } catch {
        continue; // illeggibile: nessun giudizio, e non e' questo controllo a dichiararlo
      }
      const righe = violazioni(voce.name, testo);
      if (righe.length) {
        sporchi += 1;
        const relativo = relative(radice, percorso).replace(/\\/g, '/') || voce.name;
        for (const riga of righe) failed.push(`${relativo}: ${riga}`);
      }
    }
  };
  cammina(radice);
  return { checks, passed: checks - sporchi, failed };
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (nome, condizione, dettaglio = '') => {
    ran += 1;
    if (!condizione) failed.push(dettaglio ? `${nome}: ${dettaglio}` : nome);
  };

  const base = mkdtempSync(join(tmpdir(), 'daiku-no-deps-'));
  const put = (relativo, testo) => {
    const assoluto = join(base, relativo);
    mkdirSync(dirname(assoluto), { recursive: true });
    writeFileSync(assoluto, testo, 'utf-8');
  };

  try {
    // --- un caso rosso per ogni nome della lista -------------------------------------
    for (const nome of LOCKFILE) {
      const cartella = join(base, `lock-${nome}`);
      mkdirSync(cartella, { recursive: true });
      put(join(`lock-${nome}`, nome), 'qualcosa\n');
      const esito = scansiona(cartella);
      check(
        `il lockfile ${nome} e rosso`,
        esito.failed.length === 1 && esito.failed[0].includes(nome) && esito.checks === 1 && esito.passed === 0,
        JSON.stringify(esito)
      );
    }

    // --- e uno per ogni campo enumerato, nella forma che quel campo ha -----------------
    const campi = {
      dependencies: { left: '^1.0.0' },
      devDependencies: { mocha: '^10.0.0' },
      peerDependencies: { react: '>=18' },
      optionalDependencies: { fsevents: '^2.0.0' },
      bundledDependencies: ['uno', 'due'],
    };
    for (const campo of CAMPI) {
      const cartella = join(base, `campo-${campo}`);
      mkdirSync(cartella, { recursive: true });
      put(join(`campo-${campo}`, 'package.json'), JSON.stringify({ name: 'x', [campo]: campi[campo] }));
      const esito = scansiona(cartella);
      check(
        `il campo ${campo} non vuoto e rosso`,
        esito.failed.length === 1 && esito.failed[0].includes(campo) && esito.passed === 0,
        JSON.stringify(esito)
      );
    }

    // --- la forma ammessa, i vuoti, i nomi che assomigliano ---------------------------
    const descrittore = join(base, 'descrittore');
    mkdirSync(descrittore, { recursive: true });
    put(join('descrittore', 'package.json'), JSON.stringify({ name: 'daiku', exports: { '.': './plugin.mjs' } }, null, 2));
    const pulito = scansiona(descrittore);
    check('il descrittore del plugin passa', pulito.failed.length === 0 && pulito.checks === 1, JSON.stringify(pulito));

    const vuoto = join(base, 'vuoto');
    mkdirSync(join(vuoto, 'sub'), { recursive: true });
    put(join('vuoto', 'package.json'), JSON.stringify({ name: 'x', devDependencies: {} }));
    check('un campo vuoto passa', scansiona(vuoto).failed.length === 0, JSON.stringify(scansiona(vuoto)));

    const somiglia = join(base, 'somiglia');
    mkdirSync(somiglia, { recursive: true });
    put(join('somiglia', 'blocks.json'), '{"params":{}}');
    check('un nome che contiene le lettere di un lockfile passa', scansiona(somiglia).failed.length === 0);

    const rotto = join(base, 'rotto');
    mkdirSync(rotto, { recursive: true });
    put(join('rotto', 'package.json'), '{ non e\' json');
    check('un package.json che non parsifica e rosso', scansiona(rotto).failed.length === 1, JSON.stringify(scansiona(rotto)));

    const annidato = join(base, 'annidato', 'deep');
    mkdirSync(annidato, { recursive: true });
    put(join('annidato', 'deep', 'yarn.lock'), '# anche a fondo\n');
    check('un lockfile a qualunque profondita e rosso', scansiona(join(base, 'annidato')).failed.length === 1);

    check('una radice che non c\'e non e un rosso', scansiona(join(base, 'mai-creata')).checks === 0 && scansiona(join(base, 'mai-creata')).failed.length === 0);

    // --- e la radice vera, che e' il motivo per cui il controllo esiste ---------------
    const reale = scansiona(join(SVILUPPO, 'plugins'));
    check('la radice reale di plugins e pulita', reale.failed.length === 0, reale.failed.join(' | '));
    check('e la radice reale contiene davvero il descrittore', reale.checks > 0, String(reale.checks));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed, never_red: [] }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

const argv = process.argv.slice(2);
if (argv[0] === '--self-check') {
  process.exit(selfCheck());
}
if (!argv[0]) {
  process.stderr.write('uso: node check-no-deps.mjs <radice>\n       node check-no-deps.mjs --self-check\n');
  process.exit(2);
}
const esito = scansiona(resolve(argv[0]));
process.stdout.write(JSON.stringify({ checks: esito.checks, passed: esito.passed, failed: esito.failed }, null, 2) + '\n');
process.exit(esito.failed.length ? 1 : 0);
