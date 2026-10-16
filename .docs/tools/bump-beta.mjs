#!/usr/bin/env node
/**
 * Alza la beta che `develop` dichiara.
 *
 * Attrezzo di sviluppo: vive fuori da `plugins/`, non si pubblica e non gira da un hook.
 *
 * Perche' esiste. `develop` porta una versione che nessun rilascio legge, e che serve a una cosa
 * sola: far muovere la copia installata del pacchetto. L'host ricopia il plugin quando il campo
 * `version` del manifest **differisce** da quella in place — non serve un incremento ordinato,
 * basta che cambi. La regola del numero sta in `plugins/daiku/skills/release/SKILL.md`
 * § *The two sides*: `develop` dichiara **il numero che la produzione porta adesso**, marcato beta
 * con un contatore dopo un punto (`1.2.3-b.230`, mai `b230` senza punto). Il contatore **e' il
 * totale dei commit su `develop`**: sale di uno a ogni push, qualunque cosa il push porti. Quando
 * la produzione ha rilasciato e `develop` e' rimasta indietro, la base si porta al livello della
 * produzione e il contatore riparte dal conteggio corrente.
 *
 * Cosa scrive. Le sedi le legge da `.daiku/project.json`, mai a memoria: `{version.file}` col suo
 * `{version.field}` — la sede canonica — e `{version.replicated_in}`, dove il numero compare anche
 * nella forma scappata che shields.io vuole nel badge (`1.2.3--b.230`, col trattino doppio). Accanto,
 * i documenti che portano il numero **vivo** come esempio e che invecchierebbero in silenzio: sono
 * in `ESEMPI`, con il perche' di ognuno.
 *
 * Cosa verifica. Il numero deve dire "ultimo push": il conteggio locale si confronta con quello che
 * l'upstream di `develop` porta gia' (`origin/develop`, letto in locale senza toccare la rete). Se
 * il push non ha portato commit nuovi, il numero sarebbe fermo e la copia installata non si
 * muoverebbe: il comando lo dice e non scrive niente. Se l'albero locale e' indietro rispetto
 * all'upstream, il numero locale sarebbe bugiardo: stesso esito, stesso motivo.
 *
 * Cosa non fa. Non committa e non mette in stage niente: il commit e' l'ultimo passo del ciclo di
 * review, e la guardia della review lo nega fuori da li'. Non tocca la rete: niente fetch, niente
 * push — il push resta il gesto manuale dell'owner, e questo script non lo nomina che in prosa.
 * Scrive i file e si ferma; il diff lo guarda l'owner.
 *
 * Uso:
 *   node .docs/tools/bump-beta.mjs              # alza e scrive
 *   node .docs/tools/bump-beta.mjs --self-check
 *
 * L'uscita e' tre righe e nient'altro: `OK` o `KO`, il numero che la produzione dichiara, e il
 * numero che `develop` dichiara dopo. Un `KO` aggiunge **una** riga: il motivo. Esce `1` sul `KO`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(QUI, '..', '..');

/** La produzione accetta un numero nudo; `develop` aggiunge `-b.<n>`. */
const NUMERO = /^\d+\.\d+\.\d+$/;
const BETA = /^(\d+\.\d+\.\d+)-b\.(\d+)$/;

/**
 * I documenti che portano il numero vivo come **esempio** e non sono `{version.replicated_in}`
 * perche' nessun programma li legge: sono prosa, e dicono "il numero che la produzione porta
 * adesso". Meccanici da tenere allineati, invisibili quando non lo sono.
 */
const ESEMPI = [
  // Il contratto del rilascio: da' la regola e la illustra col numero corrente.
  'plugins/daiku/skills/release/SKILL.md',
  // Le istruzioni del cantiere: la sezione dei due rami.
  'CLAUDE.md',
  // La memoria della pubblicazione: la stessa illustrazione.
  '.docs/memory/pubblicazione-su-github.md',
];

/**
 * Le sedi che non si guardano mai in cerca di un numero vecchio: la storia (i ledger della review),
 * le copie (le worktree del pool, che si riazzerano da se'), e cio' che non e' sorgente.
 */
const FUORI = ['.git', 'node_modules', '.claude/worktrees', '.docs/runtime/review'];

/**
 * Il file che cerca il numero vecchio lo nomina nei propri casi di prova, e quelli sono **codice**:
 * e' per questo che si esclude per nome, e il banco verifica che l'esclusione tenga.
 */
const SE_STESSO = 'bump-beta.mjs';

/* ------------------------------------------------------------------------- *
 * La derivazione, che e' l'unica cosa che il banco prova
 * ------------------------------------------------------------------------- */

/**
 * Il numero che `develop` deve dichiarare.
 *
 * `prod` e' il numero nudo della produzione, `count` il totale dei commit su `develop`. La base
 * segue sempre la produzione e il contatore e' sempre il conteggio: nessuna biforcazione, nessuna
 * memoria dello stato precedente.
 */
export function nextVersion(prod, count) {
  if (typeof prod !== 'string' || !NUMERO.test(prod)) {
    throw new Error(`la base deve essere un numero nudo, non ${JSON.stringify(prod)}`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`il conteggio deve essere un intero non negativo, non ${JSON.stringify(count)}`);
  }
  return `${prod}-b.${count}`;
}

/** La forma che shields.io vuole dentro l'URL del badge: il trattino diventa doppio. */
export function scappato(version) {
  return version.split('-').join('--');
}

/** Il path del file su produzione: la sorgente pubblicata e' ri-radicata, quindi il prefisso esce. */
export function prodPath(source, path) {
  const src = source ? `${source.replace(/\/+$/, '')}/` : '';
  if (!src) return path;
  if (path.startsWith(src)) return path.slice(src.length);
  return null; // fuori dal sottoalbero pubblicato: su produzione quel file non esiste
}

/* ------------------------------------------------------------------------- *
 * La lettura
 * ------------------------------------------------------------------------- */

function params() {
  const file = join(RADICE, '.daiku', 'project.json');
  if (!existsSync(file)) fail(`.daiku/project.json non esiste in ${RADICE}`);
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (error) {
    fail(`.daiku/project.json non e' JSON valido: ${error.message}`);
  }
}

const git = (args) =>
  execFileSync('git', args, { cwd: RADICE, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Il numero che la produzione dichiara, letto dal suo proprio file di versione. */
function versioneDiProduzione(p) {
  const path = prodPath(p.release && p.release.source, p.version.file);
  if (!path) fail(`${p.version.file} sta fuori dal sottoalbero pubblicato ${p.release.source}`);
  let raw;
  try {
    raw = git(['show', `${p.channels.production}:${path}`]);
  } catch (error) {
    fail(`il ramo ${p.channels.production} non risponde, o non porta ${path}: ${String(error.message).split('\n')[0]}`);
  }
  let value;
  try {
    value = JSON.parse(raw)[p.version.field];
  } catch (error) {
    fail(`${path} su ${p.channels.production} non e' JSON valido: ${error.message}`);
  }
  if (typeof value !== 'string' || !NUMERO.test(value)) {
    fail(`${p.channels.production} dichiara ${JSON.stringify(value)}, che non e' un numero nudo`);
  }
  return value;
}

/** Il numero che l'albero di sviluppo dichiara adesso. */
function versioneDiSviluppo(p) {
  const file = join(RADICE, p.version.file);
  if (!existsSync(file)) fail(`${p.version.file} non esiste`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (error) {
    fail(`${p.version.file} non e' JSON valido: ${error.message}`);
  }
  const value = parsed[p.version.field];
  if (typeof value !== 'string') fail(`${p.version.file} non dichiara ${p.version.field}`);
  return value;
}

/** Il totale dei commit di un ramo, letto in locale senza toccare la rete. */
function conteggio(ramo) {
  try {
    const raw = git(['rev-list', '--count', ramo]);
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 0) fail(`${ramo} conta ${JSON.stringify(raw)}, che non e' un conteggio`);
    return count;
  } catch (error) {
    fail(`il ramo ${ramo} non risponde: ${String(error.message).split('\n')[0]}`);
  }
}

/* ------------------------------------------------------------------------- *
 * La scrittura
 * ------------------------------------------------------------------------- */

function indentOf(text) {
  const line = text.split('\n').find((l) => /^\s+\S/.test(l));
  if (!line) return 2;
  const spaces = line.match(/^ */)[0].length;
  return spaces > 0 ? spaces : 2;
}

/** Il file di versione: il campo portato al numero nuovo, nell'indentazione e a capo del file. */
function conVersione(prima, field, version) {
  const parsed = JSON.parse(prima);
  parsed[field] = version;
  const eol = prima.includes('\r\n') ? '\r\n' : '\n';
  const scritto = JSON.stringify(parsed, null, indentOf(prima)).split('\n').join(eol);
  return scritto.endsWith(eol) ? scritto : `${scritto}${eol}`;
}

/** Ogni occorrenza del numero vecchio diventa la nuova, in entrambe le forme. */
function conNumero(prima, oldVersion, version) {
  const a = prima.split(oldVersion).join(version);
  return a.split(scappato(oldVersion)).join(scappato(version));
}

const occorrenze = (testo, ago) => (ago ? testo.split(ago).length - 1 : 0);

/* ------------------------------------------------------------------------- *
 * La scansione: cosa resta indietro
 * ------------------------------------------------------------------------- */

function* alberi(dir) {
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, voce.name);
    const rel = relative(RADICE, path).split('\\').join('/');
    if (FUORI.some((fuori) => rel === fuori || rel.startsWith(`${fuori}/`))) continue;
    if (voce.isDirectory()) yield* alberi(path);
    else if (voce.isFile()) yield rel;
  }
}

/** I file che portano ancora il numero vecchio dopo la scrittura. */
function residui(oldVersion) {
  const trovati = [];
  for (const rel of alberi(RADICE)) {
    if (rel.split('/').pop() === SE_STESSO) continue; // i propri casi di prova non sono un residuo
    let testo;
    try {
      testo = readFileSync(join(RADICE, rel), 'utf-8');
    } catch {
      continue; // binario o illeggibile: non e' una sede dove vive un numero
    }
    if (testo.includes(oldVersion) || testo.includes(scappato(oldVersion))) trovati.push(rel);
  }
  return trovati;
}

/* ------------------------------------------------------------------------- *
 * L'azione
 * ------------------------------------------------------------------------- */

function fail(messaggio) {
  process.stdout.write(`KO\n${messaggio}\n`);
  process.exit(1);
}

function act() {
  const p = params();
  if (!p.channels || !p.channels.production || !p.channels.development) {
    fail('questo progetto non dichiara i due canali: senza produzione non c\'e\' una beta da alzare');
  }
  if (!p.version || !p.version.file || !p.version.field) {
    fail('questo progetto non dichiara {version.file} e {version.field}');
  }

  const prod = versioneDiProduzione(p);
  const dev = versioneDiSviluppo(p);
  const count = conteggio(p.channels.development);
  const upstream = conteggio(`origin/${p.channels.development}`);
  if (count <= upstream && dev === nextVersion(prod, upstream)) {
    fail(`il numero e' fermo a ${dev}: il push non ha portato commit nuovi su ${p.channels.development}`);
  }
  if (count < upstream) {
    fail(`l'albero locale e' indietro: ${p.channels.development} conta ${count}, origin/${p.channels.development} conta ${upstream}`);
  }
  const nuova = nextVersion(prod, count);

  if (dev === nuova) {
    process.stdout.write(`OK\nmain: ${prod}\ndevelop: ${dev} (gia' allineato)\n`);
    return { produzione: prod, sviluppo_prima: dev, sviluppo_dopo: dev, residui: [] };
  }

  const scrivi = (rel, testo) => writeFileSync(join(RADICE, rel), testo, 'utf-8');

  // 1. La sede canonica.
  const prima = readFileSync(join(RADICE, p.version.file), 'utf-8');
  scrivi(p.version.file, conVersione(prima, p.version.field, nuova));

  // 2. Le repliche dichiarate dal progetto.
  for (const rel of p.version.replicated_in || []) {
    const testo = readFileSync(join(RADICE, rel), 'utf-8');
    scrivi(rel, conNumero(testo, dev, nuova));
  }

  // 3. Gli esempi vivi, che nessun programma legge.
  for (const rel of ESEMPI) {
    const path = join(RADICE, rel);
    if (!existsSync(path)) continue;
    const testo = readFileSync(path, 'utf-8');
    if (occorrenze(testo, dev)) scrivi(rel, conNumero(testo, dev, nuova));
  }

  return { produzione: prod, sviluppo_prima: dev, sviluppo_dopo: nuova, residui: residui(dev) };
}

/* ------------------------------------------------------------------------- *
 * Il banco di prova
 * ------------------------------------------------------------------------- */

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (nome, condizione, dettaglio = '') => {
    ran += 1;
    if (!condizione) failed.push(`${nome}: ${dettaglio}`);
  };
  const lancia = (fn) => {
    try {
      fn();
      return null;
    } catch (error) {
      return error.message;
    }
  };

  // La base segue la produzione e il contatore e' il conteggio, senza biforcazioni.
  check('il numero e base piu conteggio', nextVersion('1.2.3', 230) === '1.2.3-b.230', nextVersion('1.2.3', 230));
  check('la base nuova sposta il numero', nextVersion('1.2.4', 231) === '1.2.4-b.231', nextVersion('1.2.4', 231));
  check('il conteggio zero vale', nextVersion('1.2.3', 0) === '1.2.3-b.0', nextVersion('1.2.3', 0));

  // Una base che non e' un numero nudo e un conteggio che non conta si vedono.
  check('una base beta e rifiutata', (lancia(() => nextVersion('1.2.3-b.1', 230)) || '').includes('numero nudo'), 'passa una base beta');
  check('una base vuota e rifiutata', (lancia(() => nextVersion('', 230)) || '').includes('numero nudo'), 'passa una base vuota');
  check('un conteggio negativo e rifiutato', (lancia(() => nextVersion('1.2.3', -1)) || '').includes('intero non negativo'), 'passa un conteggio negativo');
  check('un conteggio non intero e rifiutato', (lancia(() => nextVersion('1.2.3', 2.5)) || '').includes('intero non negativo'), 'passa un conteggio non intero');

  // La forma scappata del badge.
  check('scappa il trattino del badge', scappato('1.2.3-b.230') === '1.2.3--b.230', scappato('1.2.3-b.230'));
  check('un numero nudo non si scappa', scappato('1.2.3') === '1.2.3', scappato('1.2.3'));

  // Il path su produzione.
  check('ri-radica il file di versione', prodPath('plugins', 'plugins/daiku/.claude-plugin/plugin.json') === 'daiku/.claude-plugin/plugin.json', String(prodPath('plugins', 'plugins/daiku/.claude-plugin/plugin.json')));
  check('un file fuori dal sottoalbero non esiste su produzione', prodPath('plugins', 'CLAUDE.md') === null, String(prodPath('plugins', 'CLAUDE.md')));
  check('senza sorgente il path resta', prodPath('', 'daiku/.claude-plugin/plugin.json') === 'daiku/.claude-plugin/plugin.json', String(prodPath('', 'daiku/.claude-plugin/plugin.json')));

  // Le due forme su una riga sola: e' il README di prodotto, col badge.
  const badge = 'alt="version 1.2.3-b.230" src="https://img.shields.io/badge/version-1.2.3--b.230-3b82f6"';
  const dopo = conNumero(badge, '1.2.3-b.230', '1.2.3-b.231');
  check('il badge si aggiorna in entrambe le forme', dopo.includes('version 1.2.3-b.231"') && dopo.includes('version-1.2.3--b.231-'), dopo);

  // Le due forme sono due stringhe diverse, e il conteggio le tiene separate: l'`alt` porta la
  // forma nuda, l'URL quella scappata, e nessuna delle due contiene l'altra.
  check('conta la forma nuda', occorrenze(badge, '1.2.3-b.230') === 1, String(occorrenze(badge, '1.2.3-b.230')));
  check('conta la forma scappata', occorrenze(badge, '1.2.3--b.230') === 1, String(occorrenze(badge, '1.2.3--b.230')));

  // La scansione trova il numero anche quando e' codice: questo file lo porta nei propri casi di
  // prova, quindi si esclude per nome, e il banco pretende che l'esclusione tenga **su un numero
  // che il file contiene davvero** — altrimenti il caso passerebbe a vuoto.
  check(
    'si esclude da solo dalla scansione',
    !residui('1.1.5-b.1').includes('.docs/tools/bump-beta.mjs'),
    'il proprio banco viene contato come residuo'
  );

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

const esito = act();
if (esito.residui.length) {
  process.stdout.write(
    `KO\nil numero ${esito.sviluppo_prima} sopravvive in ${esito.residui.join(', ')}\n`
  );
  process.exit(1);
}
process.stdout.write(`OK\nmain: ${esito.produzione}\ndevelop: ${esito.sviluppo_dopo}\n`);
