#!/usr/bin/env node
/**
 * Alza il ramo `edge`: la copia del prodotto che segue `develop` a ogni push.
 *
 * Attrezzo di sviluppo: vive fuori da `plugins/`, non si pubblica e non gira da un hook.
 *
 * Perche' esiste. `develop` non porta nessun numero di versione: il numero sta su `main`, e lo scrive
 * il rilascio. Un progetto che vuole seguire `develop` da fuori ha bisogno di un numero che l'host
 * confronti e che cambi a ogni push: lo porta il ramo `edge`, copia di `plugins/` ri-radicata come lo
 * e' la produzione, senza changelog, col manifest che dichiara `<produzione>-edge.<N>+<tip>`.
 *
 * Le tre parti del numero. `<produzione>` e' il numero nudo che `main` dichiara adesso: la base
 * imminente. `<N>` e' il conteggio dei commit di `develop` dopo l'ancora, cioe' il trailer
 * `Development:` del tip di `main`, la sede che ogni rilascio registra. `<tip>` e' il sha corto del tip
 * di `develop`. Il numero cambia a ogni tip, quindi l'host muove la copia a ogni push.
 *
 * Cosa scrive. Un commit su `edge` con il tree di `develop:plugins`, letto con `read-tree` su un indice
 * usa-e-getta, e il solo manifest col numero nuovo; poi `update-ref` muove il ramo. Il ramo nasce se
 * manca, e ogni commit ha il precedente come padre. Niente checkout, niente `git commit`, niente stage,
 * niente fetch, niente push: il push resta il gesto manuale dell'owner, che spinge `develop` ed `edge`.
 *
 * Cosa verifica. Un albero con modifiche tracciate si rifiuta prima di scrivere: il tip non sarebbe quello
 * che si pubblica. `develop` non deve essere indietro rispetto a `origin/develop`, perche' il tip locale
 * sarebbe vecchio. L'ancora dev'esistere sul tip di `main`. Se `edge` dichiara gia' il numero che
 * `develop` produce, non scrive niente.
 *
 * Uso:
 *   node .docs/tools/bump-edge.mjs              # alza edge
 *   node .docs/tools/bump-edge.mjs --self-check
 *
 * L'uscita e' tre righe: `OK`, il numero che la produzione dichiara, il numero di `edge` dopo.
 * Un `KO` aggiunge **una** riga: il motivo. Esce `1` sul `KO`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(QUI, '..', '..');

/** Il nome del ramo di copia: fisso, non e' una chiave del progetto. */
const EDGE = 'edge';
/** Il sha che git usa per dire "il ramo non deve esistere": crea senza sovrascrivere. */
const NULO = '0'.repeat(40);

const NUMERO = /^\d+\.\d+\.\d+$/;
const SHA_CORTO = /^[0-9a-f]{7,40}$/;
const SHA = /^[0-9a-f]{40}$/;
const FORMA_EDGE = /^\d+\.\d+\.\d+-edge\.\d+\+[0-9a-f]{7,40}$/;
const TRAILER = 'Development';

/* ------------------------------------------------------------------------- *
 * La forma, che e' la sola cosa che il banco prova da solo
 * ------------------------------------------------------------------------- */

/** Il numero che `edge` dichiara: la base della produzione, la distanza dall'ancora, il tip corto. */
export function numeroEdge(produzione, distanza, tip) {
  if (typeof produzione !== 'string' || !NUMERO.test(produzione)) {
    throw new Error(`la base deve essere un numero nudo, non ${JSON.stringify(produzione)}`);
  }
  if (!Number.isInteger(distanza) || distanza < 0) {
    throw new Error(`la distanza deve essere un intero non negativo, non ${JSON.stringify(distanza)}`);
  }
  if (typeof tip !== 'string' || !SHA_CORTO.test(tip)) {
    throw new Error(`il tip deve essere un sha corto, non ${JSON.stringify(tip)}`);
  }
  return `${produzione}-edge.${distanza}+${tip}`;
}

/** La forma che `edge` accetta. La forma di `develop` (nessun numero) non e' questa. */
export function formaEdge(version) {
  return FORMA_EDGE.test(version);
}

/** Il path del file su produzione: la sorgente pubblicata e' ri-radicata, quindi il prefisso esce. */
export function prodPath(source, path) {
  const src = source ? `${source.replace(/\/+$/, '')}/` : '';
  if (!src) return path;
  if (path.startsWith(src)) return path.slice(src.length);
  return null; // fuori dal sottoalbero pubblicato: su produzione quel file non esiste
}

function indentOf(text) {
  const line = text.split('\n').find((l) => /^\s+\S/.test(l));
  if (!line) return 2;
  const spaces = line.match(/^ */)[0].length;
  return spaces > 0 ? spaces : 2;
}

/** Il manifest col numero nel campo: la chiave nuova sta dopo `name`, come nel file di produzione. */
export function conVersione(prima, field, version) {
  const parsed = JSON.parse(prima);
  const out = {};
  for (const [chiave, valore] of Object.entries(parsed)) {
    if (chiave === field) continue;
    out[chiave] = valore;
    if (chiave === 'name') out[field] = version;
  }
  if (!(field in out)) out[field] = version;
  const eol = prima.includes('\r\n') ? '\r\n' : '\n';
  const scritto = JSON.stringify(out, null, indentOf(prima)).split('\n').join(eol);
  return scritto.endsWith(eol) ? scritto : `${scritto}${eol}`;
}

/* ------------------------------------------------------------------------- *
 * La lettura, in Git vero, senza toccare la rete
 * ------------------------------------------------------------------------- */

function params(root) {
  const file = join(root, '.daiku', 'project.json');
  if (!existsSync(file)) throw new Error(`.daiku/project.json non esiste in ${root}`);
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new Error(`.daiku/project.json non e' JSON valido: ${error.message}`);
  }
}

function git(root, args, { env = {}, input } = {}) {
  return execFileSync('git', args, {
    cwd: root,
    env: { ...process.env, ...env },
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/** Come `git`, ma `null` invece dell'errore: per le letture che possono non avere risposta. */
function gitOpt(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

/** Il campo di versione che un ramo porta in un suo file, o `null` se il file o il campo non ci sono. */
function versioneIn(root, ramo, path, field) {
  const raw = gitOpt(root, ['show', `${ramo}:${path}`]);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw)[field];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** L'ancora: il trailer `Development:` del tip del ramo, cioe' il commit di develop che l'ultimo rilascio ha registrato. */
function ancoraDi(root, ramo) {
  const body = git(root, ['log', '-1', '--format=%B', ramo]);
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.startsWith(`${TRAILER}:`));
  const sha = line ? line.slice(TRAILER.length + 1).trim() : '';
  if (!SHA.test(sha)) {
    throw new Error(`il tip di ${ramo} non porta il trailer ${TRAILER}: senza ancora non si conta N`);
  }
  return sha;
}

/** Il totale dei commit di un intervallo, letto in locale. */
function conta(root, intervallo) {
  const n = Number(git(root, ['rev-list', '--count', intervallo]));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${intervallo} non conta`);
  return n;
}

/** Le modifiche a file gia' tracciati: i file non tracciati (il cantiere ne ha) non contano. */
function modificheTracciate(root) {
  return git(root, ['status', '--porcelain', '--untracked-files=no']) !== '';
}

/* ------------------------------------------------------------------------- *
 * La scrittura, con la plumbing: nessun checkout, nessun commit, nessun push
 * ------------------------------------------------------------------------- */

/**
 * Costruisce il numero di `edge` e lo muove. Ritorna il numero prima e dopo, e il commit scritto
 * (`null` se il numero era gia' quello).
 */
export function costruisci(root = RADICE) {
  const p = params(root);
  if (!p.channels || !p.channels.production || !p.channels.development) {
    throw new Error("questo progetto non dichiara i due canali: senza produzione non c'e' un numero da cui partire");
  }
  if (!p.version || !p.version.file || !p.version.field) {
    throw new Error('questo progetto non dichiara {version.file} e {version.field}');
  }
  const sorgente = (p.release && p.release.source) || '';
  if (p.release && Array.isArray(p.release.never) && p.release.never.length) {
    throw new Error('release.never elenca percorsi che produzione non porta, e il passo edge non li esclude ancora');
  }

  const sviluppo = p.channels.development;
  const produzione = p.channels.production;
  if (modificheTracciate(root)) {
    throw new Error(`l'albero di lavoro ha modifiche tracciate: ${EDGE} si alza dai commit di ${sviluppo}, non da un albero sporco`);
  }
  if (conta(root, `${sviluppo}..origin/${sviluppo}`) > 0) {
    throw new Error(`${sviluppo} e' indietro rispetto a origin/${sviluppo}: il tip locale sarebbe vecchio`);
  }

  const pathProduzione = prodPath(sorgente, p.version.file);
  if (!pathProduzione) throw new Error(`${p.version.file} sta fuori dal sottoalbero pubblicato ${sorgente}`);
  const base = versioneIn(root, produzione, pathProduzione, p.version.field);
  if (!base || !NUMERO.test(base)) {
    throw new Error(`${produzione} dichiara ${JSON.stringify(base)}, che non e' un numero nudo`);
  }

  const ancora = ancoraDi(root, produzione);
  const tip = git(root, ['rev-parse', sviluppo]);
  const corto = git(root, ['rev-parse', '--short', sviluppo]);
  const nuova = numeroEdge(base, conta(root, `${ancora}..${sviluppo}`), corto);

  const padre = gitOpt(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${EDGE}`]);
  const prima = padre ? versioneIn(root, padre, pathProduzione, p.version.field) : null;
  if (prima === nuova) return { produzione: base, prima, dopo: nuova, commit: null };

  const dir = mkdtempSync(join(tmpdir(), 'daiku-edge-'));
  try {
    const env = { GIT_INDEX_FILE: join(dir, 'index') };
    const fonte = sorgente ? `${sviluppo}:${sorgente.replace(/\/+$/, '')}` : sviluppo;
    git(root, ['read-tree', fonte], { env });

    const manifest = git(root, ['show', `${sviluppo}:${p.version.file}`]);
    const blob = git(root, ['hash-object', '-w', '--stdin'], { input: conVersione(manifest, p.version.field, nuova) });
    git(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${pathProduzione}`], { env });
    const albero = git(root, ['write-tree'], { env });

    const args = ['commit-tree', albero, '-m', `edge ${nuova}\n\n${TRAILER}: ${tip}\n`];
    if (padre) args.push('-p', padre);
    const commit = git(root, args);
    git(root, ['update-ref', `refs/heads/${EDGE}`, commit, padre || NULO]);
    return { produzione: base, prima, dopo: nuova, commit };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------------- *
 * Il banco di prova: la forma, poi Git vero su repository usa e getta
 * ------------------------------------------------------------------------- */

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'banco',
  GIT_AUTHOR_EMAIL: 'banco@example.invalid',
  GIT_COMMITTER_NAME: 'banco',
  GIT_COMMITTER_EMAIL: 'banco@example.invalid',
};

function gitT(cwd, args, { env = {}, input } = {}) {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    env: { ...process.env, ...GIT_ENV, ...env },
    input,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function scrivi(repo, rel, testo) {
  const path = join(repo, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, testo, 'utf-8');
}

const PARAMETRI = {
  channels: { development: 'develop', production: 'main' },
  version: { file: 'plugins/daiku/.claude-plugin/plugin.json', field: 'version' },
  release: { source: 'plugins', never: [] },
};

/** Un repository con develop (ancora + due commit dopo), main che porta l'ancora, e origin allineato. */
function fixture({ trailer = true } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'daiku-edge-banco-'));
  gitT(repo, ['init', '-q', '-b', 'develop']);
  scrivi(repo, '.daiku/project.json', JSON.stringify(PARAMETRI));
  scrivi(repo, 'plugins/daiku/.claude-plugin/plugin.json', '{\n  "name": "daiku"\n}\n');
  scrivi(repo, 'plugins/README.md', '# daiku\n');
  scrivi(repo, 'CLAUDE.md', 'cantiere\n');
  gitT(repo, ['add', '-A']);
  gitT(repo, ['commit', '-qm', 'anchor']);
  const ancora = gitT(repo, ['rev-parse', 'develop']);

  // main: la produzione, col numero nel manifest ri-radicato e l'ancora nel trailer.
  const blob = gitT(repo, ['hash-object', '-w', '--stdin'], { input: '{\n  "name": "daiku",\n  "version": "1.2.3"\n}\n' });
  const idx = join(repo, '.git', 'prod-index');
  gitT(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},daiku/.claude-plugin/plugin.json`], { env: { GIT_INDEX_FILE: idx } });
  const tree = gitT(repo, ['write-tree'], { env: { GIT_INDEX_FILE: idx } });
  const msg = `release 1.2.3\n\n${trailer ? `${TRAILER}: ${ancora}` : ''}\n`;
  const prod = gitT(repo, ['commit-tree', tree, '-m', msg]);
  gitT(repo, ['update-ref', 'refs/heads/main', prod]);

  scrivi(repo, 'plugins/daiku/nota.md', 'uno\n');
  gitT(repo, ['add', '-A']);
  gitT(repo, ['commit', '-qm', 'commit uno']);
  scrivi(repo, 'plugins/daiku/nota.md', 'due\n');
  gitT(repo, ['add', '-A']);
  gitT(repo, ['commit', '-qm', 'commit due']);
  gitT(repo, ['update-ref', 'refs/remotes/origin/develop', 'develop']);
  return repo;
}

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

  // Il numero: base, distanza e tip, e il rifiuto di ciò che non lo è.
  check('il numero e base piu distanza piu tip', numeroEdge('1.2.3', 12, 'abc1234') === '1.2.3-edge.12+abc1234', numeroEdge('1.2.3', 12, 'abc1234'));
  check('la distanza zero vale', numeroEdge('1.2.3', 0, 'abc1234') === '1.2.3-edge.0+abc1234', numeroEdge('1.2.3', 0, 'abc1234'));
  check('una base beta e rifiutata', (lancia(() => numeroEdge('1.2.3-b.1', 1, 'abc1234')) || '').includes('numero nudo'), 'passa una base beta');
  check('una distanza negativa e rifiutata', (lancia(() => numeroEdge('1.2.3', -1, 'abc1234')) || '').includes('intero non negativo'), 'passa una distanza negativa');
  check('un tip non esadecimale e rifiutato', (lancia(() => numeroEdge('1.2.3', 1, 'XYZ')) || '').includes('sha corto'), 'passa un tip non esadecimale');

  // La forma che `edge` accetta: le cinque righe del brief.
  check('la forma edge passa', formaEdge('1.2.4-edge.12+abc1234'));
  check('il numero senza tip e rifiutato', !formaEdge('1.2.4-edge.12'), 'passa senza tip');
  check('il tip senza distanza e rifiutato', !formaEdge('1.2.4-edge.+abc1234'), 'passa senza N');
  check('la forma mista con il contatore beta e rifiutata', !formaEdge('1.2.4-b.12+abc1234'), 'passa la forma mista');
  check('un numero con contatore beta e rifiutato', !formaEdge('1.2.3-b.230'), 'passa un contatore beta');
  check('un numero nudo e rifiutato', !formaEdge('1.2.3'), 'passa un numero nudo');

  // Il manifest: la versione va dopo il nome, e le altre chiavi restano nel loro ordine.
  const manifest = '{\n  "name": "daiku",\n  "description": "x"\n}\n';
  check(
    'la versione va dopo il nome',
    conVersione(manifest, 'version', '1.2.3-edge.2+abc1234') === '{\n  "name": "daiku",\n  "version": "1.2.3-edge.2+abc1234",\n  "description": "x"\n}\n',
    JSON.stringify(conVersione(manifest, 'version', '1.2.3-edge.2+abc1234'))
  );
  check(
    'una versione gia presente si sostituisce al suo posto',
    conVersione('{\n  "name": "daiku",\n  "version": "1.0.0",\n  "x": 1\n}\n', 'version', '2.0.0-edge.1+abc1234') === '{\n  "name": "daiku",\n  "version": "2.0.0-edge.1+abc1234",\n  "x": 1\n}\n',
    'la sostituzione sposta la chiave'
  );

  // Il path su produzione: il sottoalbero esce, il resto no.
  check('ri-radica il file di versione', prodPath('plugins', 'plugins/daiku/.claude-plugin/plugin.json') === 'daiku/.claude-plugin/plugin.json', String(prodPath('plugins', 'plugins/daiku/.claude-plugin/plugin.json')));
  check('un file fuori dal sottoalbero non esiste su produzione', prodPath('plugins', 'CLAUDE.md') === null, String(prodPath('plugins', 'CLAUDE.md')));

  // Git vero: edge nasce, avanza, resta fermo, e si rifiuta quando non deve scrivere.
  let repo = null;
  try {
    repo = fixture();
    const primo = costruisci(repo);
    const tip1 = gitT(repo, ['rev-parse', 'edge']);
    check('edge assente: il ramo nasce col numero edge', primo.commit !== null && primo.dopo === '1.2.3-edge.2+' + gitT(repo, ['rev-parse', '--short', 'develop']), JSON.stringify(primo));
    check('edge ha il manifest col numero e niente changelog', gitT(repo, ['show', 'edge:daiku/.claude-plugin/plugin.json']).includes('"version": "1.2.3-edge.2+'), 'il manifest non dichiara il numero');
    check('edge ha solo la copia del prodotto, nessun changelog', !gitT(repo, ['ls-tree', '-r', '--name-only', 'edge']).split('\n').some((p) => p.includes('CHANGELOG') || p.startsWith('plugins/')), gitT(repo, ['ls-tree', '-r', '--name-only', 'edge']));
    check('il checkout non cambia: resta su develop', gitT(repo, ['symbolic-ref', '--short', 'HEAD']) === 'develop', gitT(repo, ['symbolic-ref', '--short', 'HEAD']));
    check('l albero di lavoro resta pulito', gitT(repo, ['status', '--porcelain', '--untracked-files=no']) === '', 'modifiche tracciate dopo la scrittura');

    const tipVecchio = gitT(repo, ['rev-parse', 'develop']);
    scrivi(repo, 'plugins/daiku/nota.md', 'tre\n');
    gitT(repo, ['add', '-A']);
    gitT(repo, ['commit', '-qm', 'commit tre']);
    const tipNuovo = gitT(repo, ['rev-parse', 'develop']);
    gitT(repo, ['update-ref', 'refs/remotes/origin/develop', 'develop']);
    const secondo = costruisci(repo);
    check('edge esistente e indietro: avanza col numero nuovo', secondo.commit !== null && secondo.dopo === '1.2.3-edge.3+' + gitT(repo, ['rev-parse', '--short', 'develop']), JSON.stringify(secondo));
    check('il nuovo commit ha il precedente come padre', gitT(repo, ['rev-parse', 'edge^']) === tip1, 'il padre non e il tip precedente');
    const trailer = gitT(repo, ['log', '-1', '--format=%B', 'edge']);
    check('il trailer dice il tip nuovo di develop, non il vecchio', trailer.includes(`Development: ${tipNuovo}`) && !trailer.includes(tipVecchio), trailer);

    const tip2 = gitT(repo, ['rev-parse', 'edge']);
    const fermo = costruisci(repo);
    check('nessun cambio di develop: non scrive niente', fermo.commit === null && gitT(repo, ['rev-parse', 'edge']) === tip2, JSON.stringify(fermo));

    scrivi(repo, 'plugins/daiku/nota.md', 'sporco\n');
    const sporco = lancia(() => costruisci(repo));
    check('un albero con modifiche tracciate e rifiutato senza scrivere', (sporco || '').includes('modifiche tracciate') && gitT(repo, ['rev-parse', 'edge']) === tip2, sporco || 'non rifiutato');
    gitT(repo, ['checkout', '--', 'plugins/daiku/nota.md']);

    // origin avanti di develop: un commit che develop non ha, figlio del tip.
    const remoto = gitT(repo, ['commit-tree', 'develop^{tree}', '-p', 'develop', '-m', 'remoto']);
    gitT(repo, ['update-ref', 'refs/remotes/origin/develop', remoto]);
    const indietro = lancia(() => costruisci(repo));
    check('develop indietro rispetto a origin e rifiutato', (indietro || '').includes('indietro rispetto'), indietro || 'non rifiutato');
    gitT(repo, ['update-ref', 'refs/remotes/origin/develop', 'develop']);
  } finally {
    if (repo) rmSync(repo, { recursive: true, force: true });
  }

  let senza = null;
  try {
    senza = fixture({ trailer: false });
    const senzaAncora = lancia(() => costruisci(senza));
    check('main senza trailer Development e rifiutato', (senzaAncora || '').includes('trailer'), senzaAncora || 'non rifiutato');
  } finally {
    if (senza) rmSync(senza, { recursive: true, force: true });
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

try {
  const esito = costruisci(RADICE);
  const fine = esito.commit ? '' : " (gia' allineato)";
  process.stdout.write(`OK\nmain: ${esito.produzione}\nedge: ${esito.dopo}${fine}\n`);
} catch (error) {
  process.stdout.write(`KO\n${String(error.message).split('\n')[0]}\n`);
  process.exitCode = 1;
}
