#!/usr/bin/env node
/**
 * Gate di chiusura di /repo-intelligence: verifica a macchina una corsa già depositata su file.
 *
 * Attrezzo di sviluppo di questo repository, non del pacchetto: vive fuori da `plugins/`, non si
 * pubblica, non si installa in nessun progetto e non gira mai da un hook. Si lancia a mano,
 * dall'orchestratore del comando (Passo 9) o da chi vuole solo controllare una corsa già scritta:
 *
 *   node .docs/tools/repo-intelligence/check-run.mjs .docs/repo-intelligence/<slug> plugins/daiku
 *
 * Entrambi gli argomenti sono obbligatori e arrivano sempre per riga di comando, mai dedotti
 * dalla posizione di questo file o dalla cwd. Senza uno dei due: usage su stderr, uscita `2`.
 * Altrimenti stampa un JSON contato `{"checks":N,"passed":N,"failed":[…]}` ed esce `1` al primo
 * rosso, `0` se tutto passa. Non scrive **mai** un file: l'unica scrittura su disco avviene
 * dentro `--self-check`, che crea le proprie fixture in `os.tmpdir()` (repo git compreso) e le
 * cancella alla fine. Non contiene, né lancia, nessun comando d'installazione.
 *
 *   node .docs/tools/repo-intelligence/check-run.mjs --self-check
 *
 * Verifica la forma esatta di `run.json`, di `1. daiku-comparison.md` e di `2. evidence-ledger.md`
 * come la descrive `.claude/commands/repo-intelligence.md` § *I file di una corsa*: la stessa
 * forma vive scritta due volte, nella prosa del contratto e nel parser qui sotto, ed è l'unico
 * punto in cui le due devono combaciare alla lettera.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const isWin = process.platform === 'win32';

const AZIONI = ['adotta', 'adatta', 'ispira', 'scarta', 'confirm_with_owner'];
const PRIORITA = ['alta', 'media', 'bassa'];
const PRIORITA_RANGO = { alta: 3, media: 2, bassa: 1 };
const CLASSIFICAZIONI = ['ALREADY_PRESENT', 'PARTIAL', 'ABSENT', 'NEEDS_MORE_EVIDENCE'];
const MODI = ['concept', 'port', 'wrapper', 'dependency', 'no-action'];
const BLAST_RADIUS = ['low', 'medium', 'high'];
const COSTI = ['basso', 'medio', 'alto'];
const CONFIDENZE = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const LATI = ['target', 'daiku'];
const VERIFICHE = ['VERIFIED', 'PARTIALLY_VERIFIED', 'INFERRED', 'CONTRADICTED', 'NOT_FOUND'];

const RUN_JSON_KEYS = [
  'target', 'slug', 'tipo', 'focus', 'data',
  'sorgente.path', 'sorgente.acquisizione', 'sorgente.versione_richiesta', 'sorgente.versione_risolta', 'sorgente.revisione',
  'grafo.comando', 'grafo.path', 'grafo.nodi', 'grafo.archi',
  'daiku.radice', 'daiku.commit', 'daiku.grafo',
  'toolchain.opensrc.versione', 'toolchain.opensrc.binario',
  'toolchain.graphify.versione', 'toolchain.graphify.binario',
  'toolchain.node', 'toolchain.git', 'toolchain.gh',
  'presidio.acceso',
  'stato_git_iniziale',
  'stadi.avvio', 'stadi.acquisizione', 'stadi.grafo', 'stadi.studio', 'stadi.verifica', 'stadi.confronto', 'stadi.report',
  'limitations',
];

function normPath(p) {
  if (!p) return '';
  let s = String(p).replace(/\\/g, '/');
  const posixDrive = s.match(/^\/([a-zA-Z])\/(.*)$/);
  if (posixDrive) s = `${posixDrive[1]}:/${posixDrive[2]}`;
  s = s.replace(/\/+$/, '');
  return isWin ? s.toLowerCase() : s;
}

function hasKey(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

/** Divide una riga di tabella Markdown nelle sue celle, senza i `|` di bordo. */
function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

/** Legge la prima tabella Markdown a partire da `lines[0]` (che deve iniziare con `|`), come
 *  elenco di oggetti indicizzati per intestazione di colonna. */
function parseTable(lines) {
  if (!lines.length || !lines[0].trim().startsWith('|')) return { headers: [], rows: [] };
  const headers = splitRow(lines[0]);
  let i = 1;
  if (lines[1] && /^\|?[\s:-]*\|[\s:|-]*$/.test(lines[1].trim())) i = 2;
  const rows = [];
  for (; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    const cells = splitRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  return { headers, rows };
}

/** Estrae il contenuto di una sezione `## <titolo>`: le righe fra quell'intestazione e la
 *  prossima `## ` (o la fine del file). */
function sectionLines(lines, title) {
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${title}\\s*$`).test(l.trim()));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s+/.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

/** Le schede `### RI-NNN — <titolo>`, ovunque compaiano nel file, con i loro campi
 *  `- **Campo:** valore` come mappa. */
function parseSchede(lines) {
  const schede = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^###\s+(RI-\d+)\s*[—-]\s*(.*)$/);
    if (!m) { i++; continue; }
    const id = m[1];
    const titolo = m[2].trim();
    let j = i + 1;
    const campi = {};
    for (; j < lines.length; j++) {
      if (/^##\s+/.test(lines[j]) || /^###\s+/.test(lines[j])) break;
      const fm = lines[j].match(/^-\s+\*\*([^:*]+):\*\*\s*(.*)$/);
      if (fm) campi[fm[1].trim()] = fm[2].trim();
    }
    schede.push({ id, titolo, campi, riga: i + 1 });
    i = j;
  }
  return schede;
}

/**
 * Esegue tutti i controlli su una corsa già depositata. `opts.radiciNonEseguibili` e
 * `opts.gitStatusCorrente`/`opts.repoOverride` esistono solo per `--self-check`: sostituiscono la
 * lettura del presidio e dello stato git reali con fixture, senza toccare né l'uno né l'altro.
 */
function runChecks(cartellaArg, radiceArg, opts = {}) {
  const checks = [];
  const failed = [];
  function check(name, ok, detail) {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  }

  // Radice del repository, come check-toolchain.mjs: mai dalla posizione del file.
  let repo = opts.repoOverride ?? null;
  if (!repo) {
    const repoRes = spawnSync('git', ['-C', radiceArg, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8', timeout: 15000 });
    if (!repoRes.error && repoRes.status === 0) repo = repoRes.stdout.trim();
  }
  check('repo-git', !!repo, repo ? '' : `"git -C ${radiceArg} rev-parse --show-toplevel" non risponde con uscita 0`);

  // Il presidio, in sola lettura: solo le radici_non_eseguibili servono qui.
  let radiciNonEseguibili = opts.radiciNonEseguibili ?? null;
  if (radiciNonEseguibili === null && repo) {
    try {
      const json = JSON.parse(readFileSync(join(repo, '.claude', 'guardia-target.json'), 'utf-8'));
      radiciNonEseguibili = json.radici_non_eseguibili || [];
      check('presidio-letto', true, '');
    } catch (error) {
      radiciNonEseguibili = [];
      check('presidio-letto', false, `.claude/guardia-target.json illeggibile: ${error.message}`);
    }
  } else if (radiciNonEseguibili !== null) {
    check('presidio-letto', true, '');
  } else {
    check('presidio-letto', false, 'radice del repository non risolta');
  }

  // run.json.
  let runJson = null;
  try {
    runJson = JSON.parse(readFileSync(join(cartellaArg, 'run.json'), 'utf-8'));
    check('run-json:esiste', true, '');
  } catch (error) {
    check('run-json:esiste', false, `${join(cartellaArg, 'run.json')} illeggibile: ${error.message}`);
  }

  if (runJson) {
    const missing = RUN_JSON_KEYS.filter((k) => !hasKey(runJson, k));
    check('run-json:chiavi-complete', missing.length === 0, missing.length ? `mancano: ${missing.join(', ')}` : '');

    const radiceCoincide = normPath(runJson.daiku?.radice) === normPath(radiceArg);
    check('run-json:daiku-radice-coincide', radiceCoincide, radiceCoincide ? '' : `run.json ha "${runJson.daiku?.radice}", l'argomento è "${radiceArg}"`);

    const opensrcOk = !!runJson.toolchain?.opensrc?.versione && !!runJson.toolchain?.opensrc?.binario;
    check('run-json:toolchain-opensrc-non-vuoto', opensrcOk, opensrcOk ? '' : 'toolchain.opensrc.versione o .binario vuoti');
    const graphifyOk = !!runJson.toolchain?.graphify?.versione && !!runJson.toolchain?.graphify?.binario;
    check('run-json:toolchain-graphify-non-vuoto', graphifyOk, graphifyOk ? '' : 'toolchain.graphify.versione o .binario vuoti');

    const comando = runJson.grafo?.comando || '';
    check('run-json:grafo-comando-code-only', comando.includes('--code-only'), comando.includes('--code-only') ? '' : `"${comando}" non contiene --code-only`);
    check('run-json:grafo-comando-no-install', !comando.includes('install'), comando.includes('install') ? `"${comando}" contiene "install"` : '');

    const nodiOk = typeof runJson.grafo?.nodi === 'number' && runJson.grafo.nodi > 0;
    check('run-json:grafo-nodi-positivo', nodiOk, nodiOk ? '' : `grafo.nodi = ${runJson.grafo?.nodi}`);

    const sorgenteNorm = normPath(runJson.sorgente?.path);
    const sottoRadice = (radiciNonEseguibili || []).some((r) => sorgenteNorm.startsWith(`${normPath(r)}/`) || sorgenteNorm === normPath(r));
    check('run-json:sorgente-sotto-radice-analisi', sottoRadice, sottoRadice ? '' : `"${runJson.sorgente?.path}" non sta sotto nessuna radice_non_eseguibile (${(radiciNonEseguibili || []).join(', ')})`);
  }

  // I tre documenti.
  const studyPath = join(cartellaArg, '0. study.md');
  const comparisonPath = join(cartellaArg, '1. daiku-comparison.md');
  const ledgerPath = join(cartellaArg, '2. evidence-ledger.md');
  let studyText = null, comparisonText = null, ledgerText = null;
  try { studyText = readFileSync(studyPath, 'utf-8'); } catch {}
  try { comparisonText = readFileSync(comparisonPath, 'utf-8'); } catch {}
  try { ledgerText = readFileSync(ledgerPath, 'utf-8'); } catch {}
  check('documento:0-study-esiste', studyText !== null, studyText !== null ? '' : `${studyPath} assente`);
  check('documento:1-comparison-esiste', comparisonText !== null, comparisonText !== null ? '' : `${comparisonPath} assente`);
  check('documento:2-ledger-esiste', ledgerText !== null, ledgerText !== null ? '' : `${ledgerPath} assente`);

  // Il ledger delle evidenze: serve per cross-referenziare le schede, quindi si legge subito.
  let ledgerIds = new Set();
  let ledgerById = new Map();
  if (ledgerText !== null) {
    const lines = ledgerText.split(/\r?\n/);
    const tableStart = lines.findIndex((l) => l.trim().startsWith('|'));
    const table = tableStart >= 0 ? parseTable(lines.slice(tableStart)) : { rows: [] };
    const badLato = [];
    const badVerifica = [];
    const dup = [];
    for (const row of table.rows) {
      const id = row.ID || row.id;
      if (!id) continue;
      if (ledgerById.has(id)) dup.push(id);
      ledgerById.set(id, row);
      ledgerIds.add(id);
      const lato = row.lato;
      if (!LATI.includes(lato)) badLato.push(`${id}:${lato}`);
      const verifica = row.verifica;
      if (!VERIFICHE.includes(verifica)) badVerifica.push(`${id}:${verifica}`);
    }
    check('ledger:id-univoci', dup.length === 0, dup.length ? `duplicati: ${dup.join(', ')}` : '');
    check('ledger:lato-validi', badLato.length === 0, badLato.length ? `fuori insieme: ${badLato.join(', ')}` : '');
    check('ledger:verifica-validi', badVerifica.length === 0, badVerifica.length ? `fuori insieme: ${badVerifica.join(', ')}` : '');
  }

  // La comparazione: prima sezione, tabella "Da riprendere", e ogni scheda.
  let schedeById = new Map();
  if (comparisonText !== null) {
    const lines = comparisonText.split(/\r?\n/);

    const h1Index = lines.findIndex((l) => /^#\s+/.test(l));
    let firstH2 = null;
    for (let i = (h1Index >= 0 ? h1Index + 1 : 0); i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) { firstH2 = lines[i].replace(/^##\s+/, '').trim(); break; }
    }
    check('comparazione:prima-sezione-da-riprendere', firstH2 === 'Da riprendere', `prima sezione trovata: "${firstH2}"`);

    const schede = parseSchede(lines);
    const dupIds = [];
    for (const s of schede) {
      if (schedeById.has(s.id)) dupIds.push(s.id);
      schedeById.set(s.id, s);
    }
    check('comparazione:scheda-id-univoci', dupIds.length === 0, dupIds.length ? `duplicati: ${dupIds.join(', ')}` : '');

    for (const s of schede) {
      const c = s.campi;
      const enumProblems = [];
      if (c['Azione'] !== undefined && !AZIONI.includes(c['Azione'])) enumProblems.push(`Azione="${c['Azione']}"`);
      if (c['Priorità'] !== undefined && !PRIORITA.includes(c['Priorità'])) enumProblems.push(`Priorità="${c['Priorità']}"`);
      if (c['Classificazione'] !== undefined && !CLASSIFICAZIONI.includes(c['Classificazione'])) enumProblems.push(`Classificazione="${c['Classificazione']}"`);
      if (c['Modo di adozione'] !== undefined && !MODI.includes(c['Modo di adozione'])) enumProblems.push(`Modo di adozione="${c['Modo di adozione']}"`);
      if (c['Blast radius'] !== undefined && !BLAST_RADIUS.includes(c['Blast radius'])) enumProblems.push(`Blast radius="${c['Blast radius']}"`);
      if (c['Costo'] !== undefined && !COSTI.includes(c['Costo'])) enumProblems.push(`Costo="${c['Costo']}"`);
      if (c['Confidenza'] !== undefined && !CONFIDENZE.includes(c['Confidenza'])) enumProblems.push(`Confidenza="${c['Confidenza']}"`);
      check(`scheda:${s.id}:campi-validi`, enumProblems.length === 0, enumProblems.join('; '));

      const evCited = [...(c['Evidenza nel target'] || '').matchAll(/EV-\d+/g)].map((m) => m[0]);
      const evMissing = evCited.filter((ev) => !ledgerIds.has(ev));
      check(`scheda:${s.id}:evidenza-esiste`, evMissing.length === 0, evMissing.length ? `EV assenti dal ledger: ${evMissing.join(', ')}` : '');

      if (c['Azione'] === 'adotta' || c['Azione'] === 'adatta') {
        const licenzaOk = !!c['Licenza'] && c['Licenza'].trim() !== '';
        const sedeOk = !!c['Sede di atterraggio'] && c['Sede di atterraggio'].trim().toLowerCase() !== 'nessuna';
        const evTargetOk = evCited.some((ev) => ledgerById.get(ev)?.lato === 'target');
        const ok = licenzaOk && sedeOk && evTargetOk;
        check(`scheda:${s.id}:regola-adotta-adatta`, ok, ok ? '' : `licenza=${licenzaOk} sede=${sedeOk} evidenza-target=${evTargetOk}`);
      }
      if (c['Azione'] === 'scarta') {
        const percheOk = !!c['Perché no'] && c['Perché no'].trim() !== '';
        check(`scheda:${s.id}:regola-scarta`, percheOk, percheOk ? '' : '"Perché no" assente o vuoto');
      }
      if (c['Classificazione'] === 'ALREADY_PRESENT' || c['Classificazione'] === 'PARTIAL') {
        const equivOk = !!c['Equivalente in Daiku'] && c['Equivalente in Daiku'].trim().toLowerCase() !== 'nessuno';
        check(`scheda:${s.id}:equivalente-in-daiku`, equivOk, equivOk ? '' : '"Equivalente in Daiku" assente o "nessuno"');
      }
    }

    const sezioneDaRiprendere = sectionLines(lines, 'Da riprendere');
    if (sezioneDaRiprendere) {
      const tStart = sezioneDaRiprendere.findIndex((l) => l.trim().startsWith('|'));
      const table = tStart >= 0 ? parseTable(sezioneDaRiprendere.slice(tStart)) : { headers: [], rows: [] };
      const idCol = table.headers.find((h) => h.toLowerCase() === 'id') || 'ID';
      const soloAdottaAdatta = [];
      const idAssenti = [];
      const rangoRighe = [];
      for (const row of table.rows) {
        const id = row[idCol];
        const scheda = schedeById.get(id);
        if (!scheda) { idAssenti.push(id); continue; }
        const azione = scheda.campi['Azione'];
        if (azione !== 'adotta' && azione !== 'adatta') soloAdottaAdatta.push(`${id}:${azione}`);
        rangoRighe.push(PRIORITA_RANGO[scheda.campi['Priorità']] ?? 0);
      }
      check('comparazione:da-riprendere-id-esistono', idAssenti.length === 0, idAssenti.length ? `ID senza scheda: ${idAssenti.join(', ')}` : '');
      check('comparazione:da-riprendere-solo-adotta-adatta', soloAdottaAdatta.length === 0, soloAdottaAdatta.length ? soloAdottaAdatta.join(', ') : '');
      let ordinata = true;
      for (let i = 1; i < rangoRighe.length; i++) if (rangoRighe[i] > rangoRighe[i - 1]) ordinata = false;
      check('comparazione:da-riprendere-ordine-priorita', ordinata, ordinata ? '' : `priorità fuori ordine: ${rangoRighe.join(',')}`);
    }
  }

  // Scrittura solo nella cartella della corsa.
  if (repo && runJson && Array.isArray(runJson.stato_git_iniziale)) {
    const iniziale = new Set(runJson.stato_git_iniziale);
    let currentLines = opts.gitStatusCorrente ?? null;
    if (currentLines === null) {
      const statusRes = spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf-8', timeout: 15000 });
      currentLines = !statusRes.error && statusRes.status === 0 ? statusRes.stdout.split(/\r?\n/).filter(Boolean) : [];
    }
    const nuove = currentLines.filter((l) => !iniziale.has(l));
    function pathsOf(line) {
      const rest = line.slice(3).trim();
      const parts = rest.split(' -> ').map((p) => p.replace(/^"|"$/g, ''));
      return parts;
    }
    const fuoriCartella = [];
    const sottoPlugins = [];
    const cartellaRel = normPath(cartellaArgRelTo(repo, cartellaArg));
    for (const line of nuove) {
      for (const p of pathsOf(line)) {
        const pn = normPath(p);
        if (!(pn === cartellaRel || pn.startsWith(`${cartellaRel}/`))) fuoriCartella.push(line);
        if (pn.startsWith('plugins/')) sottoPlugins.push(line);
      }
    }
    check('scrittura:solo-nella-cartella-corsa', fuoriCartella.length === 0, fuoriCartella.length ? `fuori cartella: ${fuoriCartella.join(' | ')}` : '');
    check('scrittura:niente-sotto-plugins', sottoPlugins.length === 0, sottoPlugins.length ? `sotto plugins/: ${sottoPlugins.join(' | ')}` : '');
  }

  return { checks: checks.length, passed: checks.length - failed.length, failed };
}

/** La cartella della corsa, come path relativo alla radice del repository (per confrontarla con
 *  le righe di `git status --porcelain`, che sono sempre relative alla radice). */
function cartellaArgRelTo(repo, cartellaArg) {
  const repoN = normPath(repo);
  const cartN = normPath(cartellaArg);
  if (cartN.startsWith(repoN)) return cartN.slice(repoN.length).replace(/^\//, '');
  return cartN; // già relativo
}

function runSelfCheck() {
  const checks = [];
  const failed = [];
  function record(name, ok, detail) {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  }

  const base = mkdtempSync(join(tmpdir(), 'ri-check-run-'));
  try {
    // Senza argomenti: usage, uscita 2. L'unico spawn del proprio file.
    const noArgs = spawnSync(process.execPath, [THIS_FILE], { encoding: 'utf-8', timeout: 15000 });
    record('senza-argomenti-esce-2', noArgs.status === 2, `uscita ${noArgs.status}`);

    function buildFakeRepo() {
      const dir = mkdtempSync(join(base, 'repo-'));
      spawnSync('git', ['init', '--quiet', dir], { encoding: 'utf-8' });
      mkdirSync(join(dir, 'plugins', 'daiku', '.claude-plugin'), { recursive: true });
      writeFileSync(join(dir, 'plugins', 'daiku', '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'daiku' }));
      mkdirSync(join(dir, '.claude'), { recursive: true });
      writeFileSync(join(dir, '.claude', 'guardia-target.json'), JSON.stringify({ enabled: false, radici_non_eseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')] }));
      return dir;
    }

    function baseRunJson(dir, overrides = {}) {
      const sorgentePath = overrides.sorgentePathOverride ?? join(dir, 'analysis-root', 'opensrc', 'repos', 'example', 'fixture', '1.0.0').replace(/\\/g, '/');
      return {
        target: 'fixture', slug: 'npm--fixture', tipo: 'npm', focus: null, data: '2026-09-25',
        sorgente: { path: sorgentePath, acquisizione: 'opensrc', versione_richiesta: null, versione_risolta: '1.0.0', revisione: '1.0.0' },
        grafo: { comando: overrides.comando ?? 'graphify extract <path> --code-only --out <dir>', path: join(dir, 'grafo', 'graph.json').replace(/\\/g, '/'), nodi: overrides.nodi ?? 42, archi: 100 },
        daiku: { radice: overrides.daikuRadice ?? 'plugins/daiku', commit: 'abc1234', grafo: join(dir, 'daiku-grafo', 'graph.json').replace(/\\/g, '/') },
        toolchain: { opensrc: { versione: 'opensrc 9.9.9', binario: 'opensrc.cmd' }, graphify: { versione: 'graphify 8.8.8', binario: 'graphify.exe' }, node: process.version, git: 'git 2.0.0', gh: null },
        presidio: { acceso: false },
        stato_git_iniziale: [],
        stadi: { avvio: 'fatto', acquisizione: 'fatto', grafo: 'fatto', studio: 'fatto', verifica: 'fatto', confronto: 'fatto', report: 'fatto' },
        limitations: [],
      };
    }

    const LEDGER_HEADER = '| ID | lato | path | simbolo o righe | estratto | verifica |\n|---|---|---|---|---|---|\n';
    function baseLedger() {
      return `# Ledger delle evidenze\n\n${LEDGER_HEADER}| EV-001 | target | src/index.js | riga 10 | estratto | VERIFIED |\n| EV-002 | daiku | plugins/daiku/skills/x/SKILL.md | — | estratto | VERIFIED |\n`;
    }

    function schedaMarkdown(fields) {
      const lines = [`### ${fields.id} — ${fields.titolo}`, ''];
      const push = (k, v) => { if (v !== undefined) lines.push(`- **${k}:** ${v}`); };
      push('Azione', fields.azione);
      push('Priorità', fields.priorita);
      push('Classificazione', fields.classificazione);
      push('Modo di adozione', fields.modo);
      push('Evidenza nel target', fields.evidenza);
      push('Equivalente in Daiku', fields.equivalente);
      push('Sede di atterraggio', fields.sede);
      push('Blast radius', fields.blast);
      push('Costo', fields.costo);
      push('Rischio', fields.rischio ?? 'nessuno');
      push('Licenza', fields.licenza);
      push('Confidenza', fields.confidenza);
      push('Perché no', fields.perche);
      lines.push('');
      return lines.join('\n');
    }

    function baseComparison(daRiprendereRows, schede) {
      return [
        '# Confronto con Daiku: fixture',
        '',
        '## Da riprendere',
        '',
        '| ID | Titolo | Azione | Priorità | Sede di atterraggio |',
        '|---|---|---|---|---|',
        ...daRiprendereRows,
        '',
        '## Riferimento Daiku',
        '',
        'radice: plugins/daiku',
        '',
        '## Matrice di mapping',
        '',
        '## Schede',
        '',
        ...schede,
        '## Voci scartate',
        '',
        '## Unknown e voci bloccate',
        '',
        '## Esperimenti di validazione proposti',
        '',
      ].join('\n');
    }

    function writeRun(dir, cartella, { runJsonOverrides = {}, comparisonRows, schedeFields, ledger = baseLedger(), skipRunJson = false } = {}) {
      mkdirSync(cartella, { recursive: true });
      if (!skipRunJson) writeFileSync(join(cartella, 'run.json'), JSON.stringify(baseRunJson(dir, runJsonOverrides)));
      writeFileSync(join(cartella, '0. study.md'), '# Studio: fixture\n\n## Provenienza\n');
      const schedeMd = (schedeFields || []).map(schedaMarkdown);
      writeFileSync(join(cartella, '1. daiku-comparison.md'), baseComparison(comparisonRows || [], schedeMd));
      writeFileSync(join(cartella, '2. evidence-ledger.md'), ledger);
    }

    const schedaAdottaOk = { id: 'RI-001', titolo: 'Esempio adottabile', azione: 'adotta', priorita: 'alta', classificazione: 'ABSENT', modo: 'concept', evidenza: 'EV-001', equivalente: 'nessuno', sede: 'plugins/daiku/skills/esempio/SKILL.md', blast: 'low', costo: 'basso', licenza: 'MIT — verificata in LICENSE', confidenza: 'HIGH' };
    const rowFor = (s) => `| ${s.id} | ${s.titolo} | ${s.azione} | ${s.priorita} | ${s.sede} |`;

    // Caso verde: corsa completa e coerente.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('caso-verde-nessun-fallito', res.failed.length === 0, res.failed.join(' | '));
    }

    // Scheda "adotta" senza licenza -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const scheda = { ...schedaAdottaOk, licenza: undefined };
      writeRun(dir, cartella, { comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('adotta-senza-licenza-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:regola-adotta-adatta')), res.failed.join(' | '));
    }

    // Scarta senza "Perché no" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const scheda = { id: 'RI-002', titolo: 'Esempio scartato', azione: 'scarta', priorita: 'bassa', classificazione: 'ABSENT', modo: 'no-action', evidenza: 'EV-001', sede: 'nessuna', blast: 'low', costo: 'basso', confidenza: 'LOW' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scarta-senza-perche-no-rosso', res.failed.some((f) => f.startsWith('scheda:RI-002:regola-scarta')), res.failed.join(' | '));
    }

    // "## Da riprendere" non è la prima sezione -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const comparisonPath = join(cartella, '1. daiku-comparison.md');
      const original = readFileSync(comparisonPath, 'utf-8');
      writeFileSync(comparisonPath, original.replace('## Da riprendere', '## Altra sezione').replace('## Riferimento Daiku', '## Da riprendere'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-non-prima-rosso', res.failed.some((f) => f.startsWith('comparazione:prima-sezione-da-riprendere')), res.failed.join(' | '));
    }

    // "## Da riprendere" fuori ordine di priorità -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const bassa = { ...schedaAdottaOk, id: 'RI-001', priorita: 'bassa' };
      const alta = { ...schedaAdottaOk, id: 'RI-002', priorita: 'alta' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(bassa), rowFor(alta)], schedeFields: [bassa, alta] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-fuori-ordine-rosso', res.failed.some((f) => f.startsWith('comparazione:da-riprendere-ordine-priorita')), res.failed.join(' | '));
    }

    // Un EV citato dalla scheda ma assente dal ledger -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const scheda = { ...schedaAdottaOk, evidenza: 'EV-999' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ev-citato-assente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:evidenza-esiste')), res.failed.join(' | '));
    }

    // daiku.radice diversa dall'argomento -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { daikuRadice: 'plugins/altro' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('radice-diversa-rosso', res.failed.some((f) => f.startsWith('run-json:daiku-radice-coincide')), res.failed.join(' | '));
    }

    // sorgente.path fuori dalla radice di analisi -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { sorgentePathOverride: join(dir, 'fuori-radice', 'fixture').replace(/\\/g, '/') }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('sorgente-fuori-radice-rosso', res.failed.some((f) => f.startsWith('run-json:sorgente-sotto-radice-analisi')), res.failed.join(' | '));
    }

    // grafo.comando senza --code-only -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { comando: 'graphify extract <path> --out <dir>' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comando-senza-code-only-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-comando-code-only')), res.failed.join(' | '));
    }

    // grafo.comando con "install" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      // La stringa evita di deragliare nella forma esatta che self-check.mjs vieta altrove
      // (`graphify … install`): qui basta la sotto-stringa "install" per collaudare la regola di
      // check-run.mjs, che è un semplice `comando.includes('install')`.
      writeRun(dir, cartella, { runJsonOverrides: { comando: 'graphify extract <path> --code-only --then-install-happens' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comando-con-install-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-comando-no-install')), res.failed.join(' | '));
    }

    // File toccato fuori dalla cartella della corsa -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? altrove/file-intruso.txt'],
      });
      record('file-fuori-cartella-rosso', res.failed.some((f) => f.startsWith('scrittura:solo-nella-cartella-corsa')), res.failed.join(' | '));
    }

    // Cartella sorella con lo stesso prefisso ("npm--fixture-vecchia" vs "npm--fixture") non deve
    // passare per "dentro" la cartella della corsa: il confine vuole lo slash, come `sottoRadice`.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? .docs/repo-intelligence/npm--fixture-vecchia/x.txt'],
      });
      record('cartella-sorella-prefisso-non-passa', res.failed.some((f) => f.startsWith('scrittura:solo-nella-cartella-corsa')), res.failed.join(' | '));
    }

    // File nuovo sotto plugins/ -> rosso sul divieto specifico "niente-sotto-plugins".
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? plugins/daiku/file-intruso.txt'],
      });
      record('file-sotto-plugins-rosso', res.failed.some((f) => f.startsWith('scrittura:niente-sotto-plugins')), res.failed.join(' | '));
    }

    // run.json mancante -> rosso, e i controlli a valle non si eseguono a vuoto.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], skipRunJson: true });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('run-json-mancante-rosso', res.failed.some((f) => f.startsWith('run-json:esiste')), res.failed.join(' | '));
    }

    // run.json con una chiave mancante -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const runJsonPath = join(cartella, 'run.json');
      const runJsonObj = JSON.parse(readFileSync(runJsonPath, 'utf-8'));
      delete runJsonObj.focus;
      writeFileSync(runJsonPath, JSON.stringify(runJsonObj));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('run-json-chiave-mancante-rosso', res.failed.some((f) => f.startsWith('run-json:chiavi-complete')), res.failed.join(' | '));
    }

    // toolchain.opensrc vuoto -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const runJsonPath = join(cartella, 'run.json');
      const runJsonObj = JSON.parse(readFileSync(runJsonPath, 'utf-8'));
      runJsonObj.toolchain.opensrc.versione = '';
      writeFileSync(runJsonPath, JSON.stringify(runJsonObj));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('toolchain-opensrc-vuoto-rosso', res.failed.some((f) => f.startsWith('run-json:toolchain-opensrc-non-vuoto')), res.failed.join(' | '));
    }

    // toolchain.graphify vuoto -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const runJsonPath = join(cartella, 'run.json');
      const runJsonObj = JSON.parse(readFileSync(runJsonPath, 'utf-8'));
      runJsonObj.toolchain.graphify.binario = '';
      writeFileSync(runJsonPath, JSON.stringify(runJsonObj));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('toolchain-graphify-vuoto-rosso', res.failed.some((f) => f.startsWith('run-json:toolchain-graphify-non-vuoto')), res.failed.join(' | '));
    }

    // toolchain.opensrc.binario vuoto, versione presente -> rosso (l'altra metà della condizione).
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const runJsonPath = join(cartella, 'run.json');
      const runJsonObj = JSON.parse(readFileSync(runJsonPath, 'utf-8'));
      runJsonObj.toolchain.opensrc.binario = '';
      writeFileSync(runJsonPath, JSON.stringify(runJsonObj));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('toolchain-opensrc-binario-vuoto-rosso', res.failed.some((f) => f.startsWith('run-json:toolchain-opensrc-non-vuoto')), res.failed.join(' | '));
    }

    // toolchain.graphify.versione vuoto, binario presente -> rosso (l'altra metà della condizione).
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const runJsonPath = join(cartella, 'run.json');
      const runJsonObj = JSON.parse(readFileSync(runJsonPath, 'utf-8'));
      runJsonObj.toolchain.graphify.versione = '';
      writeFileSync(runJsonPath, JSON.stringify(runJsonObj));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('toolchain-graphify-versione-vuoto-rosso', res.failed.some((f) => f.startsWith('run-json:toolchain-graphify-non-vuoto')), res.failed.join(' | '));
    }

    // grafo.nodi = 0 -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { nodi: 0 }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('grafo-nodi-zero-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-nodi-positivo')), res.failed.join(' | '));
    }

    // "0. study.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '0. study.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('study-assente-rosso', res.failed.some((f) => f.startsWith('documento:0-study-esiste')), res.failed.join(' | '));
    }

    // "1. daiku-comparison.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '1. daiku-comparison.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comparison-assente-rosso', res.failed.some((f) => f.startsWith('documento:1-comparison-esiste')), res.failed.join(' | '));
    }

    // "2. evidence-ledger.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '2. evidence-ledger.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-assente-rosso', res.failed.some((f) => f.startsWith('documento:2-ledger-esiste')), res.failed.join(' | '));
    }

    // Ledger con ID duplicato -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const ledgerDup = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | target | src/index.js | riga 10 | estratto | VERIFIED |\n| EV-001 | daiku | plugins/daiku/skills/x/SKILL.md | — | estratto | VERIFIED |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerDup });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-id-duplicato-rosso', res.failed.some((f) => f.startsWith('ledger:id-univoci')), res.failed.join(' | '));
    }

    // Ledger con "lato" fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const ledgerBadLato = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | targetX | src/index.js | riga 10 | estratto | VERIFIED |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerBadLato });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-lato-invalido-rosso', res.failed.some((f) => f.startsWith('ledger:lato-validi')), res.failed.join(' | '));
    }

    // Ledger con "verifica" fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const ledgerBadVerifica = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | target | src/index.js | riga 10 | estratto | BOGUS |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerBadVerifica });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-verifica-invalida-rosso', res.failed.some((f) => f.startsWith('ledger:verifica-validi')), res.failed.join(' | '));
    }

    // Due schede con lo stesso ID -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaDup = { ...schedaAdottaOk, titolo: 'Duplicato' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk, schedaDup] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-id-duplicato-rosso', res.failed.some((f) => f.startsWith('comparazione:scheda-id-univoci')), res.failed.join(' | '));
    }

    // Scheda con Azione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadAzione = { ...schedaAdottaOk, azione: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadAzione] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-azione-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Priorità fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadPriorita = { ...schedaAdottaOk, priorita: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadPriorita] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-priorita-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Classificazione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadClassificazione = { ...schedaAdottaOk, classificazione: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadClassificazione] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-classificazione-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Modo di adozione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadModo = { ...schedaAdottaOk, modo: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadModo] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-modo-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Blast radius fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadBlast = { ...schedaAdottaOk, blast: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadBlast] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-blast-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Costo fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadCosto = { ...schedaAdottaOk, costo: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadCosto] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-costo-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Confidenza fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaBadConfidenza = { ...schedaAdottaOk, confidenza: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadConfidenza] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-confidenza-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Classificazione ALREADY_PRESENT senza "Equivalente in Daiku" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaAlreadyPresent = { ...schedaAdottaOk, classificazione: 'ALREADY_PRESENT' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAlreadyPresent)], schedeFields: [schedaAlreadyPresent] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('already-present-senza-equivalente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:equivalente-in-daiku')), res.failed.join(' | '));
    }

    // "Da riprendere" cita un ID senza scheda corrispondente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, {
        comparisonRows: ['| RI-999 | Fantasma | adotta | alta | plugins/daiku/skills/esempio/SKILL.md |'],
        schedeFields: [schedaAdottaOk],
      });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-id-senza-scheda-rosso', res.failed.some((f) => f.startsWith('comparazione:da-riprendere-id-esistono')), res.failed.join(' | '));
    }

    // "Da riprendere" cita una scheda con azione diversa da adotta/adatta -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      const schedaIspira = { ...schedaAdottaOk, azione: 'ispira', titolo: 'Solo ispirazione' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaIspira)], schedeFields: [schedaIspira] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-azione-non-adotta-adatta-rosso', res.failed.some((f) => f.startsWith('comparazione:da-riprendere-solo-adotta-adatta')), res.failed.join(' | '));
    }

    // ".claude/guardia-target.json" illeggibile -> "presidio-letto" rosso (fail-safe: la sorgente
    // risulta di conseguenza fuori da ogni radice_non_eseguibile).
    {
      const dir = buildFakeRepo();
      rmSync(join(dir, '.claude', 'guardia-target.json'));
      const cartella = join(dir, '.docs', 'repo-intelligence', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, gitStatusCorrente: [] });
      record('presidio-illeggibile-rosso', res.failed.some((f) => f.startsWith('presidio-letto')), res.failed.join(' | '));
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

const [cartellaArg, radiceArg] = args;
if (!cartellaArg || !radiceArg) {
  process.stderr.write('uso: node check-run.mjs <cartella-corsa> <radice-daiku>\n');
  process.exit(2);
}

const result = runChecks(cartellaArg, radiceArg);
process.stdout.write(JSON.stringify(result) + '\n');
process.exit(result.failed.length ? 1 : 0);
