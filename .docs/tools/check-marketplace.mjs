#!/usr/bin/env node
/**
 * Verificatore delle due vetrine del repository pubblicato.
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
 * Copre il solo punto del repository che nessun altro controllo guarda — le due vetrine — e cioè
 * il modo in cui il repository studiato è inciampato: un `marketplace.json` che il parser
 * dell'host rifiuta, o che punta altrove.
 *
 * 1. entrambe le vetrine sono JSON leggibili, portano un `name` non vuoto e un `plugins[]` non
 *    vuoto: `.claude-plugin/marketplace.json` per Claude Code, `.agents/plugins/marketplace.json`
 *    per Codex;
 * 2. ogni voce risolve a una cartella vera dentro la radice, che porta il manifest di quell'host e
 *    ne dichiara lo stesso nome, e le due vetrine portano alla stessa cartella.
 *
 * La regola di risoluzione non è indovinata, è letta: `source.path` è relativo alla radice del
 * marketplace, che per Codex sta due livelli sopra il suo `marketplace.json`; per Claude Code è la
 * cartella che contiene `.claude-plugin/`, che in questo repository è la stessa. `policy.installation`,
 * `policy.authentication` e `category` sono le tre chiavi obbligatorie di una voce Codex. Le due
 * sedi sono in `.docs/memory/installazione-e-versionamento.md`, verificate su un'installazione vera.
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

const CLAUDE_VETRINA = ['.claude-plugin', 'marketplace.json'];
const CODEX_VETRINA = ['.agents', 'plugins', 'marketplace.json'];
const CLAUDE_MANIFEST = ['.claude-plugin', 'plugin.json'];
const CODEX_MANIFEST = ['.codex-plugin', 'plugin.json'];

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

  const destinazioni = { claude: [], codex: [] };

  for (const [host, vetrinaParti, manifestParti] of [
    ['claude', CLAUDE_VETRINA, CLAUDE_MANIFEST],
    ['codex', CODEX_VETRINA, CODEX_MANIFEST],
  ]) {
    const rel = vetrinaParti.join('/');
    let vetrina = null;
    try {
      vetrina = leggiJson(join(root, ...vetrinaParti));
      check(`vetrina-${host}:leggibile`, true, '');
    } catch (error) {
      check(`vetrina-${host}:leggibile`, false, `${rel}: ${error.message}`);
      continue;
    }

    check(`vetrina-${host}:nome`, typeof vetrina?.name === 'string' && vetrina.name.trim() !== '', 'name assente o vuoto');
    const voci = Array.isArray(vetrina?.plugins) ? vetrina.plugins : [];
    check(`vetrina-${host}:plugins`, voci.length > 0, 'plugins[] assente o vuoto');

    for (const voce of voci) {
      const nome = typeof voce?.name === 'string' && voce.name.trim() !== '' ? voce.name : '(senza nome)';

      if (host === 'codex') {
        const policy = voce?.policy ?? {};
        const mancanti = [
          ['policy.installation', policy.installation],
          ['policy.authentication', policy.authentication],
          ['category', voce?.category],
        ].filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
        check(`voce-codex:${nome}:campi-obbligatori`, mancanti.length === 0, mancanti.length ? `mancano: ${mancanti.join(', ')}` : '');
      }

      const sorgente = sorgenteLocale(voce?.source);
      if (sorgente.tipo !== 'locale') {
        check(`voce-${host}:${nome}:sorgente`, false, sorgente.tipo === 'assente'
          ? 'nessun source dichiarato'
          : `sorgente "${sorgente.dichiarato}" non locale: questo controllo non sa risolverla, aggiornalo`);
        continue;
      }

      const cartella = resolve(root, sorgente.path);
      if (!dentroRadice(root, cartella)) {
        check(`voce-${host}:${nome}:sorgente`, false, `"${sorgente.path}" risolve fuori dalla radice del marketplace (${cartella})`);
        continue;
      }
      if (!existsSync(cartella)) {
        check(`voce-${host}:${nome}:sorgente`, false, `"${sorgente.path}" non esiste su disco`);
        continue;
      }
      check(`voce-${host}:${nome}:sorgente`, true, '');
      destinazioni[host].push(cartella);

      let manifest = null;
      try {
        manifest = leggiJson(join(cartella, ...manifestParti));
      } catch (error) {
        check(`voce-${host}:${nome}:manifest`, false, `${manifestParti.join('/')} illeggibile: ${error.message}`);
        continue;
      }
      check(`voce-${host}:${nome}:manifest`, manifest?.name === nome,
        `la cartella dichiara "${manifest?.name}", la vetrina "${nome}"`);
    }
  }

  const a = [...new Set(destinazioni.claude)].sort();
  const b = [...new Set(destinazioni.codex)].sort();
  check('vetrine:stessa-destinazione', a.length === 1 && b.length === 1 && a[0] === b[0],
    `Claude Code → ${a.join(', ') || 'nessuna'}; Codex → ${b.join(', ') || 'nessuna'}`);

  return { checks, failed };
}

/* ---------------------------------------------------------------- banco di prova */

function scrivi(percorso, contenuto) {
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, contenuto);
}

/** Una radice di marketplace finta: le due vetrine e i due manifest del pacchetto puntato. */
function costruisciRadice(base, opts = {}) {
  const {
    nomeVoce = 'daiku',
    sorgenteClaude = './daiku',
    sorgenteCodex = sorgenteClaude,
    nomeManifest = 'daiku',
    chiaviCodex = true,
  } = opts;
  const root = mkdtempSync(join(base, 'marketplace-'));

  scrivi(join(root, ...CLAUDE_VETRINA), JSON.stringify({
    name: 'daiku', owner: { name: 'finto' }, description: 'vetrina di prova',
    plugins: [{ name: nomeVoce, source: sorgenteClaude }],
  }));

  const voceCodex = { name: nomeVoce, source: { source: 'local', path: sorgenteCodex }, category: 'Developer Tools' };
  if (chiaviCodex) voceCodex.policy = { installation: 'AVAILABLE', authentication: 'ON_INSTALL' };
  scrivi(join(root, ...CODEX_VETRINA), JSON.stringify({ name: 'daiku', plugins: [voceCodex] }));

  // Solo dentro la radice: la fixture «sorgente fuori radice» deve restare senza la sua cartella,
  // e il banco non deve scrivere niente fuori dalla propria cartella usa-e-getta.
  for (const sorgente of new Set([sorgenteClaude, sorgenteCodex])) {
    const cartella = join(root, sorgente);
    if (!dentroRadice(root, cartella)) continue;
    scrivi(join(cartella, ...CLAUDE_MANIFEST), JSON.stringify({ name: nomeManifest, version: '1.0.0' }));
    scrivi(join(cartella, ...CODEX_MANIFEST), JSON.stringify({ name: nomeManifest, version: '1.0.0' }));
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

    // Caso verde: due vetrine coerenti che puntano allo stesso pacchetto.
    {
      const res = esitoDi(costruisciRadice(base));
      record('caso-verde-nessun-fallito', res.failed.length === 0, res.failed.join(' | '));
    }

    // Una voce che punta a una cartella inesistente -> rosso.
    {
      const root = costruisciRadice(base);
      rmSync(join(root, 'daiku'), { recursive: true, force: true });
      const res = esitoDi(root);
      record('sorgente-inesistente-rosso', res.failed.some((f) => f.startsWith('voce-claude:daiku:sorgente')), res.failed.join(' | '));
    }

    // La cartella dichiara un nome diverso da quello della voce -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { nomeManifest: 'altro' }));
      record('nome-disallineato-rosso',
        res.failed.some((f) => f.startsWith('voce-claude:daiku:manifest')) && res.failed.some((f) => f.startsWith('voce-codex:daiku:manifest')),
        res.failed.join(' | '));
    }

    // Voce Codex senza le tre chiavi obbligatorie -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { chiaviCodex: false }));
      record('chiavi-codex-mancanti-rosso', res.failed.some((f) => f.startsWith('voce-codex:daiku:campi-obbligatori')), res.failed.join(' | '));
    }

    // Le due vetrine puntano a pacchetti diversi -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { sorgenteClaude: './daiku', sorgenteCodex: './altrove' }));
      record('destinazioni-diverse-rosso', res.failed.some((f) => f.startsWith('vetrine:stessa-destinazione')), res.failed.join(' | '));
    }

    // Una vetrina illeggibile -> rosso, e i controlli a valle di quella vetrina non girano a vuoto.
    {
      const root = costruisciRadice(base);
      writeFileSync(join(root, ...CLAUDE_VETRINA), '{ rotto');
      const res = esitoDi(root);
      record('vetrina-illeggibile-rosso',
        res.failed.some((f) => f.startsWith('vetrina-claude:leggibile')) && res.failed.some((f) => f.startsWith('vetrine:stessa-destinazione')),
        res.failed.join(' | '));
    }

    // Una voce che risolve fuori dalla radice -> rosso.
    {
      const res = esitoDi(costruisciRadice(base, { sorgenteClaude: '../fuori', sorgenteCodex: './daiku' }));
      record('sorgente-fuori-radice-rosso', res.failed.some((f) => f.startsWith('voce-claude:daiku:sorgente')), res.failed.join(' | '));
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
