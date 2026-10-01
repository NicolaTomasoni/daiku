#!/usr/bin/env node
/**
 * Il banco dei due script di canale: `pubblica-dist.ps1` e `promuovi-dist.ps1`.
 *
 * Attrezzo di sviluppo: vive fuori da `plugins/`, non si pubblica e non gira da un hook.
 *
 * Perche' esiste. Il canale beta regge su due divieti che vivono dentro due script
 * PowerShell, e uno script non passa da nessuna guardia: la riga che l'agente digita
 * e' `.\pubblica-dist.ps1`. Senza un banco, un controllo che smettesse di fermarsi
 * sarebbe indistinguibile dal silenzio — e il guasto che il canale esiste per evitare
 * e' un rilascio che finisce in produzione senza passare dal test.
 *
 * Ogni caso costruisce un repository usa e getta nella cartella temporanea di sistema,
 * con un `main` e un `beta` veri, e lancia lo script vero. Non invoca mai un push:
 * popola il remoto con `git fetch`, che e' come il push si vedrebbe dall'altra parte.
 *
 * Uso:
 *   node .docs/tools/check-channel.mjs
 *
 * Stampa un JSON contato ed esce `1` al primo rosso. Vuole `git` e PowerShell nel PATH.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const PUBBLICA = join(QUI, 'pubblica-dist.ps1');
const PROMUOVI = join(QUI, 'promuovi-dist.ps1');
const POWERSHELL = 'powershell';

const MESSAGGIO = 'release 1.0.9 - prova';

/** Le radici temporanee da togliere comunque, anche se un caso lancia. */
const temporanee = [];

const failed = [];
let ran = 0;

function check(nome, condizione, dettaglio = '') {
  ran += 1;
  if (!condizione) failed.push(`${nome}: ${dettaglio}`);
}

/** git senza pretese: ritorna l'esito invece di lanciare. */
function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** git che deve riuscire. */
function deve(args) {
  const r = git(args);
  if (!r.ok) throw new Error(`git ${args.join(' ')}: ${r.err || r.out}`);
  return r.out;
}

/** Uno script del canale, lanciato come lo lancerebbe la sessione. */
function ps(script, args) {
  const r = spawnSync(POWERSHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], {
    encoding: 'utf8',
  });
  if (r.error) return { status: -1, out: '', err: r.error.message, manca: r.error.code === 'ENOENT' };
  return { status: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), manca: false };
}

/** Un remoto con `main` alla 1.0.8 e `beta` alla 1.0.9, e un dist posato su beta. */
function scenario() {
  const radice = mkdtempSync(join(tmpdir(), 'canale-'));
  temporanee.push(radice);
  const lavoro = join(radice, 'lavoro');
  const remoto = join(radice, 'remoto.git');
  const dist = join(radice, 'dist');

  deve(['init', '-q', '-b', 'main', lavoro]);
  deve(['-C', lavoro, 'config', 'user.email', 't@t']);
  deve(['-C', lavoro, 'config', 'user.name', 't']);
  writeFileSync(join(lavoro, 'f.txt'), 'uno\n');
  deve(['-C', lavoro, 'add', '-A']);
  deve(['-C', lavoro, 'commit', '-qm', 'release 1.0.8']);
  deve(['-C', lavoro, 'checkout', '-qb', 'beta']);
  writeFileSync(join(lavoro, 'g.txt'), 'due\n');
  deve(['-C', lavoro, 'add', '-A']);
  deve(['-C', lavoro, 'commit', '-qm', 'release 1.0.9']);

  deve(['init', '-q', '--bare', '-b', 'main', remoto]);
  deve(['-C', remoto, 'fetch', '-q', lavoro, 'refs/heads/*:refs/heads/*']);
  deve(['clone', '-q', remoto, dist]);
  deve(['-C', dist, 'config', 'user.email', 't@t']);
  deve(['-C', dist, 'config', 'user.name', 't']);
  deve(['-C', dist, 'checkout', '-q', 'beta']);

  return { radice, lavoro, remoto, dist };
}

/** Il dist con un rilascio gia' pubblicato su beta. */
function pubblicato() {
  const s = scenario();
  const r = ps(PUBBLICA, ['-Destinazione', s.dist, '-Messaggio', MESSAGGIO]);
  if (r.manca) throw new Error('PowerShell non trovato nel PATH');
  if (r.status !== 0) throw new Error(`pubblica-dist.ps1 e' fallito: ${r.out} ${r.err}`);
  return s;
}

/** Porta nel remoto gli oggetti e i rami del dist: e' cio' che un push farebbe. */
function comeUnPush(s) {
  deve(['-C', s.remoto, 'fetch', '-q', s.dist, 'refs/heads/beta:refs/heads/beta']);
  deve(['-C', s.remoto, 'fetch', '-q', s.dist, 'refs/heads/main:refs/heads/main']);
  deve(['-C', s.dist, 'fetch', '-q', 'origin']);
}

function casi() {
  // 1. Il dist su main: il rilascio deve fermarsi, e per il motivo giusto.
  {
    const s = scenario();
    deve(['-C', s.dist, 'checkout', '-q', 'main']);
    const r = ps(PUBBLICA, ['-Destinazione', s.dist, '-Messaggio', 'non deve passare']);
    check('pubblica rifiuta un dist su main', r.status !== 0 && /non su 'beta'/.test(r.out + r.err),
      `status=${r.status} ${r.out} ${r.err}`);
    check('e non ha committato su beta',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'beta']).out === 'release 1.0.9');
    check('e non ha committato su main',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'main']).out === 'release 1.0.8');
  }

  // 2. Il dist su beta: il rilascio passa.
  {
    const s = scenario();
    const r = ps(PUBBLICA, ['-Destinazione', s.dist, '-Messaggio', MESSAGGIO]);
    check('pubblica riesce da beta', r.status === 0, `status=${r.status} ${r.out} ${r.err}`);
    check('e il rilascio sta su beta',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'beta']).out === MESSAGGIO);
    check('e main non si e mosso',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'main']).out === 'release 1.0.8');
  }

  // 3. La promozione: main va al rilascio di beta.
  {
    const s = pubblicato();
    const r = ps(PROMUOVI, ['-Destinazione', s.dist, '-Versione', '1.0.9']);
    check('promuove un fast-forward', r.status === 0, `status=${r.status} ${r.out} ${r.err}`);
    check('e main e ora il rilascio',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'main']).out === MESSAGGIO);
  }

  // 4. main con un commit che beta non ha: la promozione si ferma.
  {
    const s = pubblicato();
    deve(['-C', s.lavoro, 'checkout', '-q', 'main']);
    writeFileSync(join(s.lavoro, 'x.txt'), 'x\n');
    deve(['-C', s.lavoro, 'add', '-A']);
    deve(['-C', s.lavoro, 'commit', '-qm', 'solo su main']);
    deve(['-C', s.remoto, 'fetch', '-q', s.lavoro, 'refs/heads/main:refs/heads/main']);
    const r = ps(PROMUOVI, ['-Destinazione', s.dist]);
    check('promuovi rifiuta un non fast-forward',
      r.status !== 0 && /fast-forward/.test(r.out + r.err), `status=${r.status} ${r.out} ${r.err}`);
    check('e main locale non si e mosso',
      git(['-C', s.dist, 'log', '--format=%s', '-n', '1', 'main']).out === 'release 1.0.8');
  }

  // 5. Gia' promosso: niente da fare, e nessuno spostamento.
  {
    const s = pubblicato();
    ps(PROMUOVI, ['-Destinazione', s.dist, '-Versione', '1.0.9']);
    comeUnPush(s);
    const r = ps(PROMUOVI, ['-Destinazione', s.dist, '-Versione', '1.0.9']);
    check('promuovi riconosce una produzione gia a posto',
      r.status === 0 && /niente da promuovere/.test(r.out), `status=${r.status} ${r.out} ${r.err}`);
  }

  // 6. La promozione si fa dal canale: da main si ferma.
  {
    const s = pubblicato();
    deve(['-C', s.dist, 'checkout', '-q', 'main']);
    const r = ps(PROMUOVI, ['-Destinazione', s.dist]);
    check('promuovi rifiuta un dist su main',
      r.status !== 0 && /non su 'beta'/.test(r.out + r.err), `status=${r.status} ${r.out} ${r.err}`);
  }
}

let guasto = null;
try {
  casi();
} catch (e) {
  guasto = e.message;
} finally {
  for (const r of temporanee) rmSync(r, { recursive: true, force: true });
}

if (guasto) {
  ran += 1;
  failed.push(`il banco non ha potuto girare: ${guasto}`);
}

process.stdout.write(
  JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
);
process.exit(failed.length ? 1 : 0);
