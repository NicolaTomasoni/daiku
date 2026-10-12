#!/usr/bin/env node
/**
 * Verificatore della vetrina del repository pubblicato.
 *
 * Attrezzo di sviluppo, non codice ospite: vive fuori da `plugins/`, non si pubblica, non si
 * installa in nessun progetto e non gira mai da un hook. Si lancia a mano prima di un rilascio,
 * accanto a `check-topology.mjs` e a `hooks/self-check.mjs`:
 *
 *   node .docs/tools/check-marketplace.mjs plugins
 *
 * La radice arriva sempre come argomento e non si deduce mai dalla posizione di questo file, che
 * è un livello sotto quella radice. Uscita JSON contata `{checks, passed, failed[]}`, `1` al primo
 * rosso, `2` senza argomento. Non scrive **mai** un file: l'unica scrittura su disco avviene dentro
 * `--self-check`, che crea le proprie fixture in `os.tmpdir()` e le cancella alla fine. Non
 * contiene, né lancia, nessun comando d'installazione.
 *
 * Copre il solo punto del repository che nessun altro controllo guarda — la vetrina — e cioè
 * il modo in cui il repository studiato è inciampato: un `marketplace.json` che il parser
 * dell'host rifiuta, o che punta altrove.
 *
 * 1. la vetrina è JSON leggibile, porta un `name` non vuoto e un `plugins[]` non vuoto:
 *    `.claude-plugin/marketplace.json`;
 * 2. ogni voce risolve a una cartella vera dentro la radice, che porta il manifest dell'host e
 *    ne dichiara lo stesso nome.
 *
 * La regola di risoluzione non è indovinata, è letta: `source.path` è relativo alla radice del
 * marketplace, che per Claude Code è la cartella che contiene `.claude-plugin/`. La sede della
 * regola è in `.docs/memory/installazione-e-versionamento.md`, verificata su un'installazione vera.
 *
 *   node .docs/tools/check-marketplace.mjs --self-check
 *
 * Lancia il banco: le proprie fixture in `os.tmpdir()`, verdi e rosse, contate fra i controlli.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VETRINA = ['.claude-plugin', 'marketplace.json'];
const MANIFEST = ['.claude-plugin', 'plugin.json'];

function leggiJson(percorso) {
  return JSON.parse(readFileSync(percorso, 'utf-8').replace(/^﻿/, ''));
}

/** Il path locale che una voce dichiara, o il motivo per cui non è risolvibile da qui. Una
 *  sorgente remota (`github`, `git`, `url`) è legittima per l'host ma non risolvibile su disco:
 *  il controllo non finge di averla verificata, e chiede di essere aggiornato. */
function sorgenteLocale(sorgente) {
  if (typeof sorgente === 'string') return { tipo: 'locale', path: sorgente };
  if (sorgente && typeof sorgente === 'object') {
    const dichiarato = sorgente.source ?? sorgente.type;
    if (dichiarato === 'local' && typeof sorgente.path === 'string') return { tipo: 'locale', path: sorgente.path };
    return { tipo: 'non-locale', dichiarato: String(dichiarato) };
  }
  return { tipo: 'assente' };
}

/** `true` se `percorso` sta dentro `root` — la vetrina deve puntare dentro l'albero pubblicato. */
function dentroRadice(root, percorso) {
  const rel = relative(resolve(root), resolve(percorso));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Esegue tutti i controlli su una radice di marketplace già su disco. Non ha opzioni: le fixture
 * del banco sono radici temporanee costruite da `costruisciRadice`, non scorciatoie.
 */
function verifica(root) {
  const checks = [];
  const failed = [];
  const check = (name, ok, detail) => {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  };

  const rel = VETRINA.join('/');
  let vetrina = null;
  try {
    vetrina = leggiJson(join(root, ...VETRINA));
    check('vetrina:leggibile', true, '');
  } catch (error) {
    check('vetrina:leggibile', false, `${rel}: ${error.message}`);
    return { checks, failed };
  }

  check('vetrina:nome', typeof vetrina?.name === 'string' && vetrina.name.trim() !== '', 'name assente o vuoto');
  const voci = Array.isArray(vetrina?.plugins) ? vetrina.plugins : [];
  check('vetrina:plugins', voci.length > 0, 'plugins[] assente o vuoto');

  for (const voce of voci) {
    const nome = typeof voce?.name === 'string' && voce.name.trim() !== '' ? voce.name : '(senza nome)';

    const sorgente = sorgenteLocale(voce?.source);
    if (sorgente.tipo !== 'locale') {
      check(`voce:${nome}:sorgente`, false, sorgente.tipo === 'assente'
        ? 'nessun source dichiarato'
        : `sorgente "${sorgente.dichiarato}" non locale: questo controllo non sa risolverla, aggiornalo`);
      continue;
    }

    const cartella = resolve(root, sorgente.path);
    if (!dentroRadice(root, cartella)) {
      check(`voce:${nome}:sorgente`, false, `"${sorgente.path}" risolve fuori dalla radice del marketplace (${cartella})`);
      continue;
    }
    if (!existsSync(cartella)) {
      check(`voce:${nome}:sorgente`, false, `"${sorgente.path}" non esiste su disco`);
      continue;
    }
    check(`voce:${nome}:sorgente`, true, '');

    let manifest = null;
    try {
      manifest = leggiJson(join(cartella, ...MANIFEST));
    } catch (error) {
      check(`voce:${nome}:manifest`, false, `${MANIFEST.join('/')} illeggibile: ${error.message}`);
      continue;
    }
    check(`voce:${nome}:manifest`, manifest?.name === nome,
      `la cartella dichiara "${manifest?.name}", la vetrina "${nome}"`);
  }

  return { checks, failed };
}

/* ---------------------------------------------------------------- banco di prova */

function scrivi(percorso, contenuto) {
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, contenuto);
}

/** Una radice di marketplace finta: la vetrina e il manifest del pacchetto puntato. */
function costruisciRadice(base, opts = {}) {
  const { nomeVoce = 'daiku', sorgente = './daiku', nomeManifest = 'daiku' } = opts;
  const root = mkdtempSync(join(base, 'marketplace-'));

  scrivi(join(root, ...VETRINA), JSON.stringify({
    name: 'daiku', owner: { name: 'finto' }, description: 'vetrina di prova',
    plugins: [{ name: nomeVoce, source: sorgente }],
  }));

  // Solo dentro la radice: la fixture «sorgente fuori radice» deve restare senza la sua cartella,
  // e il banco non deve scrivere niente fuori dalla propria cartella usa-e-getta.
  const cartella = join(root, sorgente);
  if (dentroRadice(root, cartella)) {
    scrivi(join(cartella, ...MANIFEST), JSON.stringify({ name: nomeManifest, version: '1.0.0' }));
  }
  return root;
}

function runSelfCheck() {
  const checks = [];
  const failed = [];
  const record = (name, ok, detail) => {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  };

  const base = mkdtempSync(join(tmpdir(), 'ss-check-marketplace-'));
  try {
    // Senza argomenti: usage, uscita 2.
    const noArgs = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { encoding: 'utf-8', timeout: 15000 });
    record('senza-argomenti-esce-2', noArgs.status === 2, `uscita ${noArgs.status}`);

    function esitoDi(root) {
      return verifica(root);
    }

    // Caso verde: la vetrina coerente che punta al pacchetto.
    {
      const res = esitoDi(costruisciRadice(base));
      record('caso-verde-nessun-fallito', res.failed.length === 0, res.failed.join(' | '));
    }

    // Una voce che punta a una cartella inesistente -> rosso.
    {
      const root = costruisciRadice(base);
      rmSync(join(root, 'daiku'), { recursive: true, force: true });
      const res = esitoDi(root);
      record('sorgente-inesistente-rosso', res.failed.some((f) => f.startsWith('voce:daiku:sorgente')), res.failed.join(' | '));
    }

    // La cartella dichiara un nome diverso da quello della voce -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { nomeManifest: 'altro' }));
      record('nome-disallineato-rosso',
        res.failed.some((f) => f.startsWith('voce:daiku:manifest')),
        res.failed.join(' | '));
    }

    // Una vetrina illeggibile -> rosso, e i controlli a valle non girano a vuoto.
    {
      const root = costruisciRadice(base);
      writeFileSync(join(root, ...VETRINA), '{ rotto');
      const res = esitoDi(root);
      record('vetrina-illeggibile-rosso',
        res.failed.length === 1 && res.failed[0].startsWith('vetrina:leggibile'),
        res.failed.join(' | '));
    }

    // Una voce che risolve fuori dalla radice -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { sorgente: '../fuori' }));
      record('sorgente-fuori-radice-rosso', res.failed.some((f) => f.startsWith('voce:daiku:sorgente')), res.failed.join(' | '));
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  return { checks: checks.length, passed: checks.length - failed.length, failed };
}

const args = process.argv.slice(2);

if (args.includes('--self-check')) {
  const result = runSelfCheck();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result.failed.length ? 1 : 0);
}

const [rootArg] = args;
if (!rootArg) {
  process.stderr.write('uso: node check-marketplace.mjs <radice-del-marketplace>\n');
  process.exit(2);
}

const result = verifica(rootArg);
process.stdout.write(JSON.stringify({ checks: result.checks.length, passed: result.checks.length - result.failed.length, failed: result.failed }) + '\n');
process.exit(result.failed.length ? 1 : 0);
