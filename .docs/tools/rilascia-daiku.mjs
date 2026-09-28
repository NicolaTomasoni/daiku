#!/usr/bin/env node
/**
 * Rilascia Daiku: bump di versione, changelog di prodotto e pubblicazione dist.
 *
 * Attrezzo di sviluppo, non parte del prodotto: vive in `.docs/tools/` e non entra
 * mai in `plugins/`, quindi non viaggia con ciò che si pubblica. Lo lanciano i tre
 * task VS Code «Daiku: rilascio major/minor/patch», che differiscono solo nel livello
 * di bump passato con `--bump`:
 *
 *   node .docs/tools/rilascia-daiku.mjs --bump <major|minor|patch> [--notes "..."]
 *
 * `--dry-run` stampa il piano senza scrivere nulla né pubblicare; `--self-test`
 * lancia il banco delle funzioni pure; `--probe-ai` stampa le note risolte ed esce.
 *
 * Ogni lancio fa tre cose, in quest'ordine:
 *
 * 1. bump della versione nei due manifest (`plugins/daiku/.claude-plugin/` e
 *    `.codex-plugin/plugin.json`) e nel badge di `plugins/README.md`;
 * 2. voce in testa a `plugins/CHANGELOG.md`, il changelog ufficiale di prodotto —
 *    esiste solo lì, così la pubblicazione lo porta in radice del dist;
 * 3. chiamata a `pubblica-dist.ps1`, che riversa `plugins/` nel checkout dist con
 *    UN commit solo e lo pusha.
 *
 * Versione e messaggio di rilascio escono in inglese: il prodotto parla inglese.
 * Le note di `--notes` le redige l'agente AI, non l'owner a mano: legge cosa è
 * cambiato dall'ultimo rilascio e ne scrive la sintesi in inglese. Il perimetro
 * "dall'ultimo rilascio" è deterministico: i commit di dev dopo l'ultimo che ha
 * toccato la versione nei manifest, più il diff del working tree —
 *
 *   git log --format=%h\ %s $(git log --format=%H -n 1 -- plugins/daiku/.claude-plugin/plugin.json)..HEAD
 *
 * `--notes auto` non chiede all'owner: lo script raccoglie il diff dall'ultimo
 * rilascio (parte deterministica) e ne fa scrivere la sintesi in inglese a Claude
 * headless (parte AI). A qualunque guasto della chiamata vale il rimando al commit,
 * quindi l'AI non blocca mai il rilascio: la prosa è sua, i numeri restano deterministici.
 * Note vuote significano "senza sintesi": la voce rimanda allora al commit di rilascio,
 * che contiene il diff completo.
 *
 * `--solo-file` è il primo tempo del rilascio guidato dalla skill `.claude/commands/`
 * `rilascia-daiku.md`: scrive solo i numeri (manifest e badge) con verifica, stampa
 * `vecchia=` e `nuova=` ed esce. La skill scrive dopo la prosa (voce di changelog e
 * messaggio di commit) e pubblica con `pubblica-dist.ps1`.
 *
 * Convenzione d'uscita come gli altri attrezzi: `0` se tutto verde, `1` al primo
 * controllo rosso, `2` per uso errato. Nulla si scrive a metà: se una verifica
 * fallisce dopo aver toccato i file, il lancio esce `1` e il working tree di dev
 * resta da sistemare a mano prima di rilanciare.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_CLAUDE = join('plugins', 'daiku', '.claude-plugin', 'plugin.json');
const MANIFEST_CODEX = join('plugins', 'daiku', '.codex-plugin', 'plugin.json');
const README = join('plugins', 'README.md');
const CHANGELOG = join('plugins', 'CHANGELOG.md');

function muori(codice, messaggio) {
  process.stderr.write(`rilascia-daiku: ${messaggio}\n`);
  process.exit(codice);
}

/** "1.2.3" -> [1, 2, 3]; lancia su tutto il resto. */
function parseSemver(testo) {
  const parti = /^(\d+)\.(\d+)\.(\d+)$/.exec(testo.trim());
  if (!parti) throw new Error(`versione non semver: ${JSON.stringify(testo)}`);
  return [Number(parti[1]), Number(parti[2]), Number(parti[3])];
}

/** Livello major|minor|patch applicato alla terna; lancia su livello ignoto. */
function bumpSemver([major, minor, patch], livello) {
  if (livello === 'major') return [major + 1, 0, 0];
  if (livello === 'minor') return [major, minor + 1, 0];
  if (livello === 'patch') return [major, minor, patch + 1];
  throw new Error(`livello di bump ignoto: ${JSON.stringify(livello)}`);
}

/** Voce di changelog in inglese: versione, data ISO e note (o rimando al commit). */
function renderEntry(versione, data, note) {
  const corpo = note.trim() ? note.trim() : 'See the release commit for the full list of changes.';
  return `## ${versione} — ${data}\n\n${corpo}\n`;
}

/** Messaggio del commit dist, in inglese: "release X.Y.Z" più la prima riga delle note. */
function releaseMessage(versione, note) {
  const prima = note.split(/\r?\n/, 1)[0].trim();
  return prima ? `release ${versione} — ${prima}` : `release ${versione}`;
}

/** Perimetro "dall'ultimo rilascio" in forma di testo: soggetti dei commit più
 *  diff del working tree, troncato per tenere piccola la chiamata AI. */
function contestoDiff() {
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: DEV, encoding: 'utf-8', timeout: 30000 });
    if (r.error || r.status !== 0) throw new Error('git non riuscito');
    return r.stdout || '';
  };
  try {
    const base = (git(['log', '--format=%H', '-n', '1', '--', MANIFEST_CLAUDE]).trim().split(/\s+/)[0]) || 'HEAD';
    const log = git(['log', '--format=%h %s', `${base}..HEAD`]).split(/\r?\n/).slice(0, 30).join('\n');
    const stat = git(['diff', '--stat', 'HEAD', '--', '.']).split(/\r?\n/).slice(0, 30).join('\n');
    const nuovi = git(['status', '--porcelain']).split(/\r?\n/).slice(0, 30).join('\n');
    return `Commits since last release:\n${log || '(none)'}\n\nWorking tree diff:\n${stat || '(clean)'}\n\nUntracked or modified:\n${nuovi || '(none)'}\n`.slice(0, 4000);
  } catch {
    return '';
  }
}

/** Riduce l'output dell'AI a una riga di prosa: prima riga non vuota, senza
 *  virgolette o elenchi, spazi compattati, 200 caratteri al massimo. */
function pulisciNoteAI(testo) {
  const riga = (testo || '').split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0) ?? '';
  const senza = riga
    .replace(/^([>#*\-•\d.)\s]+|["'«»“”`]+)+/, '')
    .replace(/["'«»“”`\s.]+$/, '')
    .trim();
  return senza.replace(/\s+/g, ' ').slice(0, 200);
}

const PROMPT_BOZZA = 'Summarize this software release in ONE English line for a changelog entry and commit message. The input lists commit subjects and changed files since the last release. Output ONLY that line: no quotes, no bullet, no leading numbers, at most 120 characters, describing the user-visible change, never mentioning internal paths.';

/** Chiede a Claude headless la bozza delle note; a qualunque guasto torna ''
 *  e il rilascio prosegue col rimando al commit — l'AI non blocca mai. */
function bozzaNoteAI() {
  try {
    const r = spawnSync('claude', ['-p', '--model', 'haiku', PROMPT_BOZZA], {
      cwd: DEV,
      input: contestoDiff(),
      encoding: 'utf-8',
      timeout: 120000,
      shell: process.platform === 'win32',
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`uscita ${r.status}`);
    const pulite = pulisciNoteAI(r.stdout || '');
    if (!pulite) throw new Error('risposta vuota');
    return pulite;
  } catch (e) {
    process.stderr.write(`rilascia-daiku: bozza AI non riuscita (${e.message}), uso il rimando al commit\n`);
    return '';
  }
}

function leggi(rel) {
  return readFileSync(join(DEV, rel), 'utf-8');
}

function versioneManifest(rel) {
  let json;
  try {
    json = JSON.parse(leggi(rel));
  } catch (e) {
    throw new Error(`${rel} non è JSON valido: ${e.message}`);
  }
  if (typeof json.version !== 'string') throw new Error(`${rel} senza campo "version"`);
  return json.version;
}

/** Sostituzione puntuale della riga "version", senza riformattare il resto del file. */
function scriviVersioneManifest(rel, vecchia, nuova) {
  const prima = leggi(rel);
  const dopo = prima.replace(
    new RegExp(`"version":\\s*"${vecchia.replace(/\./g, '\\.')}"`),
    `"version": "${nuova}"`
  );
  if (dopo === prima) throw new Error(`${rel}: riga "version": "${vecchia}" non trovata`);
  writeFileSync(join(DEV, rel), dopo.replace(/\r?\n/g, '\n'));
}

/** Allinea il badge del README (alt e URL shields) alla nuova versione. */
function scriviVersioneBadge(vecchia, nuova) {
  const prima = leggi(README);
  const esc = vecchia.replace(/\./g, '\\.');
  const dopo = prima
    .replace(new RegExp(`alt="version ${esc}"`), `alt="version ${nuova}"`)
    .replace(new RegExp(`badge/version-${esc}-`), `badge/version-${nuova}-`);
  if (dopo === prima) throw new Error(`${README}: badge versione ${vecchia} non trovato`);
  writeFileSync(join(DEV, README), dopo.replace(/\r?\n/g, '\n'));
}

/** Scrive la nuova versione nei due manifest e nel badge, con rilettura di verifica. */
function applicaVersioni(vecchia, nuova) {
  scriviVersioneManifest(MANIFEST_CLAUDE, vecchia, nuova);
  scriviVersioneManifest(MANIFEST_CODEX, vecchia, nuova);
  scriviVersioneBadge(vecchia, nuova);
  if (versioneManifest(MANIFEST_CLAUDE) !== nuova) throw new Error('verifica manifest Claude fallita');
  if (versioneManifest(MANIFEST_CODEX) !== nuova) throw new Error('verifica manifest Codex fallita');
  if (!leggi(README).includes(`version-${nuova}-`)) throw new Error('verifica badge README fallita');
}

/** Prepone la voce al changelog, creandolo con intestazione se manca. */
function prependiChangelog(voce) {
  const percorso = join(DEV, CHANGELOG);
  const prima = existsSync(percorso) ? readFileSync(percorso, 'utf-8').replace(/\r?\n/g, '\n') : '';
  const base = prima.trim() ? prima : '# Changelog\n';
  const dopo = base.replace(/(# Changelog\n)/, `$1\n${voce}\n`);
  if (dopo === base) throw new Error(`${CHANGELOG}: intestazione "# Changelog" non trovata`);
  writeFileSync(percorso, dopo);
}

/** Banco di prova delle funzioni pure: niente scritture, solo asserzioni. */
function selfTest() {
  const casi = [];
  const ok = (nome, cond) => casi.push([nome, !!cond]);
  const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ok('parse 0.1.0', uguale(parseSemver('0.1.0'), [0, 1, 0]));
  ok('parse con spazi', uguale(parseSemver('  2.10.3\n'), [2, 10, 3]));
  ok('bump major', uguale(bumpSemver([0, 1, 0], 'major'), [1, 0, 0]));
  ok('bump minor', uguale(bumpSemver([0, 1, 0], 'minor'), [0, 2, 0]));
  ok('bump patch', uguale(bumpSemver([0, 1, 0], 'patch'), [0, 1, 1]));
  ok('bump azzera sotto-livelli', uguale(bumpSemver([1, 2, 3], 'major'), [2, 0, 0]));
  let lanciata = false;
  try { parseSemver('1.0'); } catch { lanciata = true; }
  ok('parse rifiuta non-semver', lanciata);
  lanciata = false;
  try { bumpSemver([1, 0, 0], 'premajor'); } catch { lanciata = true; }
  ok('bump rifiuta livello ignoto', lanciata);
  const voce = renderEntry('0.2.0', '2026-09-28', 'Moves the README to the marketplace root.');
  ok('voce con versione, data e note',
    voce.startsWith('## 0.2.0 — 2026-09-28\n\nMoves the README'));
  ok('voce senza note rimanda al commit',
    renderEntry('0.2.0', '2026-09-28', '  ').includes('See the release commit'));
  ok('messaggio con note', releaseMessage('0.2.0', 'Fixes the badge\nsecond line') === 'release 0.2.0 — Fixes the badge');
  ok('messaggio senza note', releaseMessage('0.2.0', '') === 'release 0.2.0');
  ok('pulizia: elenco e virgolette',
    pulisciNoteAI('- "Moves the README."\n- altro') === 'Moves the README');
  ok('pulizia: prima riga non vuota',
    pulisciNoteAI('\n\n  Moves the badge.  \nseconda') === 'Moves the badge');
  ok('pulizia: vuota resta vuota', pulisciNoteAI('  \n  ') === '');

  const rossi = casi.filter(([, passed]) => !passed);
  for (const [nome] of rossi) process.stderr.write(`red: ${nome}\n`);
  process.stdout.write(`${casi.length} checks, ${casi.length - rossi.length} green\n`);
  process.exit(rossi.length ? 1 : 0);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) selfTest();

  const bump = argv[argv.indexOf('--bump') + 1];
  if (!['major', 'minor', 'patch'].includes(bump)) {
    muori(2, 'uso: rilascia-daiku.mjs --bump <major|minor|patch> [--notes "..."|auto] [--solo-file] [--dry-run] [--probe-ai] [--self-test]');
  }
  const notesIdx = argv.indexOf('--notes');
  const rawNotes = notesIdx === -1 ? '' : (argv[notesIdx + 1] ?? '');

  if (argv.includes('--probe-ai')) {
    process.stdout.write(`${rawNotes === 'auto' ? bozzaNoteAI() : rawNotes}\n`);
    process.exit(0);
  }

  // 'auto' chiede la bozza all'AI (mai a secco: il dry-run non spende chiamate).
  const notes = rawNotes === 'auto' ? (argv.includes('--dry-run') ? '' : bozzaNoteAI()) : rawNotes;

  let vecchia, nuova;
  try {
    const vClaude = versioneManifest(MANIFEST_CLAUDE);
    const vCodex = versioneManifest(MANIFEST_CODEX);
    if (vClaude !== vCodex) throw new Error(`manifest disallineati: ${vClaude} contro ${vCodex}`);
    vecchia = vClaude;
    parseSemver(vecchia);
    nuova = bumpSemver(parseSemver(vecchia), bump).join('.');
  } catch (e) {
    muori(1, e.message);
  }

  // --solo-file: solo i numeri nei file, niente changelog né pubblicazione.
  // La skill scrive la prosa e pubblica dopo. Stampa vecchia= e nuova=.
  if (argv.includes('--solo-file')) {
    if (argv.includes('--dry-run')) {
      process.stdout.write(`dry-run: ${vecchia} -> ${nuova} (${bump}), solo file\n`);
      process.exit(0);
    }
    try {
      applicaVersioni(vecchia, nuova);
    } catch (e) {
      muori(1, e.message);
    }
    process.stdout.write(`vecchia=${vecchia}\nnuova=${nuova}\n`);
    process.exit(0);
  }

  const messaggio = releaseMessage(nuova, notes);
  if (argv.includes('--dry-run')) {
    process.stdout.write(`dry-run: ${vecchia} -> ${nuova} (${bump})\n`);
    process.stdout.write(`dry-run: messaggio dist: ${JSON.stringify(messaggio)}\n`);
    process.stdout.write(`dry-run: nessuna scrittura, nessuna pubblicazione\n`);
    process.exit(0);
  }

  try {
    applicaVersioni(vecchia, nuova);
    const oggi = new Date().toISOString().slice(0, 10);
    prependiChangelog(renderEntry(nuova, oggi, notes));

    // Rilettura di verifica del changelog.
    if (!leggi(CHANGELOG).includes(`## ${nuova} — ${oggi}`)) throw new Error('verifica changelog fallita');
  } catch (e) {
    muori(1, e.message);
  }

  const pub = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      join(DEV, '.docs', 'tools', 'pubblica-dist.ps1'),
      '-Messaggio', messaggio],
    { stdio: 'inherit', cwd: DEV }
  );
  if (pub.error) muori(1, `pubblica-dist non partito: ${pub.error.message}`);
  if (pub.status !== 0) muori(1, `pubblica-dist uscito con ${pub.status}: rilascio ${nuova} non pubblicato`);
  process.stdout.write(`rilasciata ${nuova} (da ${vecchia}, ${bump})\n`);
}

main();
