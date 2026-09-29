#!/usr/bin/env node
/**
 * Gate di chiusura di /studia-repository: verifica a macchina una corsa già depositata su file.
 *
 * Attrezzo di sviluppo di questo repository, non del pacchetto: vive fuori da `plugins/`, non si
 * pubblica, non si installa in nessun progetto e non gira mai da un hook. Si lancia a mano,
 * dall'orchestratore del comando (Passo 12), da `lotto.mjs` — che lo passa su ogni corsa del lotto
 * prima di applicarne le voci `allinea` — o da chi vuole solo controllare una corsa già scritta:
 *
 *   node .docs/tools/studia-repository/check-run.mjs .docs/studia-repository/<slug> plugins/daiku
 *
 * Entrambi gli argomenti sono obbligatori e arrivano sempre per riga di comando, mai dedotti
 * dalla posizione di questo file o dalla cwd. Senza uno dei due: usage su stderr, uscita `2`.
 * Altrimenti stampa un JSON contato `{"checks":N,"passed":N,"failed":[…]}` ed esce `1` al primo
 * rosso, `0` se tutto passa. Non scrive **mai** un file: l'unica scrittura su disco avviene
 * dentro `--self-check`, che crea le proprie fixture in `os.tmpdir()` (repo git compreso) e le
 * cancella alla fine. Non contiene, né lancia, nessun comando d'installazione.
 *
 *   node .docs/tools/studia-repository/check-run.mjs --self-check
 *
 * Verifica la forma esatta di `run.json`, di `1. daiku-comparison.md` e di `2. evidence-ledger.md`
 * come la descrive `.claude/commands/studia-repository.md` § *I file di una corsa*: la stessa
 * forma vive scritta due volte, nella prosa del contratto e nel parser qui sotto, ed è l'unico
 * punto in cui le due devono combaciare alla lettera. Un `run.json` senza `profondita` vale come
 * corsa profonda. In una corsa leggera i controlli su toolchain, grafo e source non si applicano,
 * e ogni scheda `adotta`/`adatta` è rossa: senza source non si adotta niente.
 *
 * **Le voci `allinea` si verificano qui, e per una ragione diversa dalle altre**: sono le sole che
 * qualcuno applica a macchina, quindi il gate non giudica la proposta, ne prova l'**applicabilità**
 * — il `path` sta sotto `plugins/`, il file esiste, `prima` vi compare una volta sola e `dopo` è
 * un testo diverso. Una `allinea` che non passa questi controlli non è una voce da decidere: è una
 * proposta che romperebbe il file a cui è destinata, e va riscritta o declassata a una voce che
 * chiede una decisione. La corrispondenza fra `run.json.allineamenti` e le schede è a doppio senso:
 * ogni voce ha la sua scheda, ogni scheda `allinea` ha la sua voce.
 *
 * **Lo stato git attuale si chiede con `-uall`.** Senza, git collassa una cartella interamente non
 * tracciata nella riga della cartella — `?? .docs/studia-repository/` invece dei file che ci stanno
 * dentro — e siccome la cartella della corsa nasce al primo uso ed è tutta non tracciata, ogni corsa
 * risultava aver scritto fuori dalla propria cartella: il contrario di quel che era successo. La
 * fotografia iniziale invece è testuale e può essere collassata (è così che la registra il Passo 0),
 * quindi i file che stanno dentro una cartella già non tracciata allora non si distinguono da quelli
 * che c'erano: è il limite dichiarato di un confronto fra due fotografie di granularità diversa, e
 * valeva anche prima, quando entrambe erano collassate.
 *
 * **I contributi: una cartella per feature, un file per corsa.** Le voci che descrivono una feature
 * che Daiku non ha finiscono in `.docs/features/<feature>/<slug-corsa>.md`, e sono l'unica scrittura
 * ammessa fuori dalla radice delle corse. Il nome del file è lo slug della corsa, quindi due corse
 * parallele non si incontrano mai; il gate verifica che la corsa tocchi solo file col proprio nome,
 * che non ne cancelli nessuno, e che ogni contributo abbia la forma fissa delle cinque sezioni — la
 * forma è ciò che rende confrontabili due repo che portano la stessa feature. Il legame è a doppio
 * senso con `run.json.contributi` e con la scheda: una voce `adotta`/`adatta` su qualcosa che Daiku
 * non ha (`ABSENT`) **deve** avere il suo contributo, e ogni contributo **deve** avere la sua voce.
 *
 * **Il perimetro delle scritture è `.docs/studia-repository/`, non la cartella della corsa.** Il
 * confronto chiede che nessuna riga nuova di `git status` stia fuori da quella radice, e che
 * nessuna stia sotto `plugins/`. Con il perimetro sulla sola cartella della corsa due corse
 * parallele si davano il rosso a vicenda — i file dell'una stanno fuori dalla cartella dell'altra,
 * e da qui non si distingue una corsa parallela da una scrittura fuori posto; il lotto di
 * `.docs/tools/studia-repository/lotto.mjs` le lancia insieme, quindi il confine si è spostato sulla
 * radice che le contiene tutte. Fuori da lì il controllo è quello di prima: niente nel prodotto,
 * niente nel cantiere, niente altrove.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const isWin = process.platform === 'win32';

/** La configurazione del presidio che gira: quella installata, non il sorgente del repository
 *  (`.docs/tools/macchina/README.md`). */
const PRESIDIO_MACCHINA = 'C:/Program Files/ClaudeCode/guardia-target.json';

/** La radice di tutte le corse, relativa alla radice del repository: il perimetro delle scritture
 *  di una corsa, e la sua stessa collocazione. Una corsa scritta altrove è fuori da qui. */
const RADICE_CORSE = '.docs/studia-repository';

/** Il catalogo delle feature: una cartella per feature, un contributo per corsa. L'unica altra sede
 *  in cui una corsa scrive, e solo col proprio nome. */
const RADICE_FEATURE = '.docs/features';

/** Le sezioni di un contributo, nell'ordine in cui devono comparire: è la forma che rende
 *  confrontabili due repo che portano la stessa feature. */
const SEZIONI_CONTRIBUTO = [
  'Cosa fa il target',
  'Come lo fa',
  'Cosa ha Daiku oggi, e cosa gli manca',
  'Cosa porterebbe in Daiku',
  'Evidenza',
];

const AZIONI = ['adotta', 'adatta', 'ispira', 'scarta', 'confirm_with_owner', 'allinea'];
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
  'allineamenti',
  'contributi',
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
 * Esegue tutti i controlli su una corsa già depositata. `opts.radiciNonEseguibili`,
 * `opts.presidioOverride` e `opts.gitStatusCorrente`/`opts.repoOverride` esistono solo per
 * `--self-check`: sostituiscono la lettura del presidio installato e dello stato git reali con
 * fixture, senza toccare né l'uno né l'altro.
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

  /** Lo slug della corsa, cioè il nome della sua cartella: è il nome che porta il suo contributo. */
  const slugCorsa = basename(cartellaArg.replace(/[\\/]+$/, ''));

  // Il presidio, in sola lettura: solo le radici_non_eseguibili servono qui.
  let radiciNonEseguibili = opts.radiciNonEseguibili ?? null;
  if (radiciNonEseguibili === null) {
    const filePresidio = opts.presidioOverride ?? PRESIDIO_MACCHINA;
    try {
      const json = JSON.parse(readFileSync(filePresidio, 'utf-8').replace(/^﻿/, ''));
      radiciNonEseguibili = json.radici_non_eseguibili || [];
      check('presidio-letto', true, '');
    } catch (error) {
      radiciNonEseguibili = [];
      check('presidio-letto', false, `${filePresidio} illeggibile: ${error.message}`);
    }
  } else {
    check('presidio-letto', true, '');
  }

  // run.json.
  let runJson = null;
  try {
    runJson = JSON.parse(readFileSync(join(cartellaArg, 'run.json'), 'utf-8'));
    check('run-json:esiste', true, '');
  } catch (error) {
    check('run-json:esiste', false, `${join(cartellaArg, 'run.json')} illeggibile: ${error.message}`);
  }

  const leggera = (runJson?.profondita ?? 'profonda') === 'leggera';

  if (runJson) {
    const missing = RUN_JSON_KEYS.filter((k) => !hasKey(runJson, k));
    check('run-json:chiavi-complete', missing.length === 0, missing.length ? `mancano: ${missing.join(', ')}` : '');

    const radiceCoincide = normPath(runJson.daiku?.radice) === normPath(radiceArg);
    check('run-json:daiku-radice-coincide', radiceCoincide, radiceCoincide ? '' : `run.json ha "${runJson.daiku?.radice}", l'argomento è "${radiceArg}"`);

    const profondita = runJson.profondita ?? 'profonda';
    const profonditaOk = ['leggera', 'mista', 'profonda'].includes(profondita);
    check('run-json:profondita-valida', profonditaOk, profonditaOk ? '' : `profondita = ${JSON.stringify(runJson.profondita)}`);

    if (!leggera) {
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
  }

  // Gli allineamenti: le proposte che il lotto applica a macchina. Non si giudica l'idea — si prova
  // che sia applicabile così com'è scritta, perché chi la applica sostituisce testo esatto e non
  // interpreta niente.
  const allineamenti = [];
  const allineamentiPerVoce = new Map();
  if (runJson) {
    const lista = runJson.allineamenti;
    const listaOk = Array.isArray(lista);
    check('run-json:allineamenti-lista', listaOk, listaOk ? '' : `allineamenti = ${JSON.stringify(lista)}`);
    if (listaOk) {
      const vociDuplicate = [];
      for (const voce of lista) {
        const id = voce?.voce;
        if (typeof id !== 'string' || !id.trim()) {
          check('allineamento:senza-voce', false, `voce = ${JSON.stringify(id)}`);
          continue;
        }
        if (allineamentiPerVoce.has(id)) vociDuplicate.push(id);
        allineamentiPerVoce.set(id, voce);
        allineamenti.push(voce);

        const pathRel = normPath(voce.path);
        const sottoPlugins = pathRel.startsWith('plugins/');
        check(`allineamento:${id}:path-sotto-plugins`, sottoPlugins, sottoPlugins ? '' : `"${voce.path}" non sta sotto plugins/`);

        let testo = null;
        if (repo && pathRel) {
          try { testo = readFileSync(join(repo, pathRel), 'utf-8'); } catch {}
        }
        check(`allineamento:${id}:path-esiste`, testo !== null, testo !== null ? '' : `${pathRel || '(path vuoto)'} non leggibile sotto la radice del repository`);

        const prima = voce.prima, dopo = voce.dopo;
        const testiOk = typeof prima === 'string' && prima.length > 0
          && typeof dopo === 'string' && dopo.length > 0 && prima !== dopo;
        check(`allineamento:${id}:prima-e-dopo`, testiOk, testiOk ? '' : 'prima e dopo devono essere due testi non vuoti e diversi');

        // Una riga sola: la sostituzione si legge nella scheda, e una proposta su più righe non ci
        // starebbe. Un allineamento che vuole toccare più righe si spezza in più voci o si porta
        // all'owner — non è più una riparazione meccanica.
        const unaRiga = !/[\r\n]/.test(`${prima ?? ''}${dopo ?? ''}`);
        check(`allineamento:${id}:una-riga`, unaRiga, unaRiga ? '' : 'prima o dopo contengono un a capo');

        if (testo !== null && typeof prima === 'string' && prima.length) {
          const occorrenze = testo.split(prima).length - 1;
          check(`allineamento:${id}:prima-unica`, occorrenze === 1, `"prima" compare ${occorrenze} volte in ${pathRel}`);
        }
      }
      check('allineamenti:voce-univoca', vociDuplicate.length === 0, vociDuplicate.length ? `duplicate: ${vociDuplicate.join(', ')}` : '');
    }
  }

  // I contributi: una voce per feature che Daiku non ha, un file per corsa dentro la cartella della
  // feature. La forma è fissa perché due repo che portano la stessa feature si leggano a confronto,
  // ed è l'unica cosa che il gate può pretendere: che il contributo sia confrontabile.
  const contributiPerVoce = new Map();

  function controllaContributo(id, feature) {
    const rel = `${RADICE_FEATURE}/${feature}/${slugCorsa}.md`;
    const nome = `contributo:${id}`;
    let testo = null;
    if (repo) {
      try { testo = readFileSync(join(repo, rel), 'utf-8'); } catch {}
    }
    check(`${nome}:file-esiste`, testo !== null, testo !== null ? '' : `${rel} non leggibile sotto la radice del repository`);
    if (testo === null) return;

    const righe = testo.split(/\r?\n/);
    check(`${nome}:titolo`, /^#\s+\S/.test(righe[0] || ''), `prima riga: ${JSON.stringify(righe[0] || '')}`);
    const bullet = (k) => {
      const riga = righe.find((l) => new RegExp(`^-\\s+\\*\\*${k}:\\*\\*`).test(l)) || '';
      return riga.replace(new RegExp(`^-\\s+\\*\\*${k}:\\*\\*\\s*`), '').trim();
    };
    check(`${nome}:feature-coerente`, bullet('Feature') === feature, `Feature: ${JSON.stringify(bullet('Feature'))}, cartella: ${feature}`);
    check(`${nome}:corsa-coerente`, normPath(bullet('Corsa')) === normPath(`${RADICE_CORSE}/${slugCorsa}/`), `Corsa: ${JSON.stringify(bullet('Corsa'))}`);
    check(`${nome}:ramo-coerente`, bullet('Ramo') === (runJson.profondita ?? 'profonda'), `Ramo: ${JSON.stringify(bullet('Ramo'))}, corsa: ${runJson.profondita ?? 'profonda'}`);

    const titoli = righe.filter((l) => /^##\s+/.test(l)).map((l) => l.replace(/^##\s+/, '').trim());
    check(`${nome}:sezioni-in-ordine`, titoli.join('|') === SEZIONI_CONTRIBUTO.join('|'), `sezioni: ${titoli.join(' | ') || '(nessuna)'}`);

    const inizioEvidenza = righe.findIndex((l) => /^##\s+Evidenza\s*$/.test(l));
    const corpoEvidenza = inizioEvidenza < 0 ? [] : righe.slice(inizioEvidenza + 1).filter((l) => l.trim());
    check(`${nome}:evidenza-non-vuota`, corpoEvidenza.length > 0, 'la sezione "Evidenza" è vuota: un contributo senza prove è un\'opinione');
  }

  if (runJson) {
    const lista = runJson.contributi;
    const listaOk = Array.isArray(lista);
    check('run-json:contributi-lista', listaOk, listaOk ? '' : `contributi = ${JSON.stringify(lista)}`);
    if (listaOk) {
      const featureRipetute = [];
      const viste = new Set();
      for (const voce of lista) {
        const id = voce?.voce;
        const feature = voce?.feature;
        if (typeof id !== 'string' || !id.trim() || typeof feature !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(feature)) {
          check('contributo:forma', false, `voce = ${JSON.stringify(id)}, feature = ${JSON.stringify(feature)}`);
          continue;
        }
        if (viste.has(`${id}@${feature}`)) continue;
        viste.add(`${id}@${feature}`);
        if ([...contributiPerVoce.values()].some((v) => v.feature === feature)) featureRipetute.push(feature);
        contributiPerVoce.set(id, voce);
        controllaContributo(id, feature);
      }
      // Un file per corsa e per feature: due voci nella stessa cartella si scriverebbero addosso.
      check('contributi:una-feature-una-volta', featureRipetute.length === 0, featureRipetute.length ? `due contributi nella stessa feature: ${featureRipetute.join(', ')}` : '');
    }
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
      // `allinea` non ha licenza né evidenza nel target da chiedere: non porta a casa niente dal
      // target, ripara un disallineamento del nostro corpus. Quello che deve avere è un posto dove
      // atterrare e la sua voce in `run.json`, perché la sostituzione la fa la macchina da lì.
      if (c['Azione'] === 'allinea') {
        const sedeOk = !!c['Sede di atterraggio'] && c['Sede di atterraggio'].trim().toLowerCase() !== 'nessuna';
        const voceOk = allineamentiPerVoce.has(s.id);
        check(`scheda:${s.id}:regola-allinea`, sedeOk && voceOk, `sede=${sedeOk} voce-in-run-json=${voceOk}`);

        // La scheda e `run.json` dicono la stessa cosa: le due stringhe che la macchina sostituirà
        // si leggono anche qui, altrimenti il censimento si legge solo a metà.
        const voce = allineamentiPerVoce.get(s.id);
        const riga = c['Allineamento'] || '';
        const coerente = !!voce && riga.includes(voce.prima) && riga.includes(voce.dopo);
        check(`scheda:${s.id}:allineamento-coerente`, coerente, coerente ? '' : 'il campo "Allineamento" non porta "prima" e "dopo" di run.json');
      }
      if (c['Classificazione'] === 'ALREADY_PRESENT' || c['Classificazione'] === 'PARTIAL') {
        const equivOk = !!c['Equivalente in Daiku'] && c['Equivalente in Daiku'].trim().toLowerCase() !== 'nessuno';
        check(`scheda:${s.id}:equivalente-in-daiku`, equivOk, equivOk ? '' : '"Equivalente in Daiku" assente o "nessuno"');
      }
      if (leggera && (c['Azione'] === 'adotta' || c['Azione'] === 'adatta')) {
        check(`scheda:${s.id}:leggera-solo-voci-leggere`, false, `Azione="${c['Azione']}" in una corsa leggera: serve il ramo profondo`);
      }
    }

    // Il verso opposto: una voce di `run.json.allineamenti` che non ha la sua scheda `allinea`, o
    // ce l'ha con un'altra azione, è una sostituzione che nessun censimento giustifica.
    const vociSenzaScheda = [...allineamentiPerVoce.keys()].filter((v) => schedeById.get(v)?.campi['Azione'] !== 'allinea');
    check('allineamenti:ogni-voce-ha-la-sua-scheda', vociSenzaScheda.length === 0, vociSenzaScheda.length ? `voci senza scheda "allinea": ${vociSenzaScheda.join(', ')}` : '');

    // Il catalogo delle feature, e il censimento, dicono la stessa cosa. Una capacità che Daiku non
    // ha e che la corsa propone di prendere — `adotta` o `adatta` su `ABSENT` — è esattamente un
    // contributo, e il catalogo è il posto in cui vive: senza, la voce si porta via il censimento e
    // non resta niente da confrontare col prossimo repo.
    // Una capacità mancante è una voce `ABSENT`: Daiku non ha quella cosa. Il contributo è
    // **dovuto** quando la corsa la propone di prenderla (`adotta`/`adatta`), ed è **lecito** anche
    // su `ispira` — la direzione è giusta e il come va studiato, che è esattamente il materiale di
    // una miniera. Senza questo, il catalogo crescerebbe solo dalle corse profonde, che sono le rare.
    const eCapacita = (s) => !!s && s.campi['Classificazione'] === 'ABSENT' && ['adotta', 'adatta', 'ispira'].includes(s.campi['Azione']);
    const eDovuto = (s) => !!s && s.campi['Classificazione'] === 'ABSENT' && ['adotta', 'adatta'].includes(s.campi['Azione']);
    const senzaContributo = [...schedeById.values()].filter(eDovuto).filter((s) => !contributiPerVoce.has(s.id)).map((s) => s.id);
    check('contributi:ogni-capacita-da-prendere-ha-il-suo', senzaContributo.length === 0, senzaContributo.length ? `capacità da prendere senza contributo: ${senzaContributo.join(', ')}` : '');

    const contributiSenzaCapacita = [...contributiPerVoce.keys()].filter((v) => !eCapacita(schedeById.get(v)));
    check('contributi:ogni-contributo-ha-la-sua-capacita', contributiSenzaCapacita.length === 0, contributiSenzaCapacita.length ? `contributi senza una scheda adotta/adatta su ABSENT: ${contributiSenzaCapacita.join(', ')}` : '');

    for (const [voce, contributo] of contributiPerVoce) {
      const dichiarata = schedeById.get(voce)?.campi['Feature'];
      check(`scheda:${voce}:feature-coerente`, dichiarata === contributo.feature, `Feature: ${JSON.stringify(dichiarata)}, run.json: ${JSON.stringify(contributo.feature)}`);
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
    // Le cartelle interamente non tracciate al Passo 0, lette dalla fotografia collassata: i file
    // che ci stanno dentro non erano distinguibili allora, e non lo sono adesso.
    const inizialeDentro = [];
    for (const riga of runJson.stato_git_iniziale) {
      const m = String(riga).match(/^\?\?\s+(.+)\/$/);
      if (m) inizialeDentro.push(normPath(m[1]));
    }
    let currentLines = opts.gitStatusCorrente ?? null;
    if (currentLines === null) {
      // `-uall`: per esteso, un file per riga. Senza, la cartella della corsa — nata al primo uso,
      // interamente non tracciata — arriverebbe come una riga sola, `?? .docs/…/`, che non è dentro
      // sé stessa: ogni corsa sarebbe rossa per una scrittura che è esattamente dove doveva stare.
      const statusRes = spawnSync('git', ['-C', repo, 'status', '--porcelain', '-uall'], { encoding: 'utf-8', timeout: 15000 });
      currentLines = !statusRes.error && statusRes.status === 0 ? statusRes.stdout.split(/\r?\n/).filter(Boolean) : [];
    }
    const nuove = currentLines.filter((l) => !iniziale.has(l));
    function pathsOf(line) {
      const rest = line.slice(3).trim();
      const parts = rest.split(' -> ').map((p) => p.replace(/^"|"$/g, ''));
      return parts;
    }
    const fuoriRadice = [];
    const fuoriContributo = [];
    const sottoPlugins = [];
    const cartellaRel = normPath(cartellaArgRelTo(repo, cartellaArg));
    const radiceCorse = normPath(RADICE_CORSE);
    const radiceFeature = normPath(RADICE_FEATURE);
    const slugNorm = normPath(slugCorsa);
    check('cartella:sotto-la-radice-delle-corse', cartellaRel.startsWith(`${radiceCorse}/`), `la corsa sta in "${cartellaRel}", fuori da ${RADICE_CORSE}/`);

    /**
     * I contributi ammessi fuori dalla radice delle corse: il proprio, e quello di un'altra corsa
     * **solo se quella corsa lo dichiara**. Il secondo caso non è una concessione: due corse
     * parallele che studiano due repo della stessa feature scrivono due file diversi nella stessa
     * cartella, e senza questa riga ognuna vedrebbe il file dell'altra come una scrittura fuori
     * posto. E un contributo che nessuna corsa dichiara resta rosso: una corsa non ne inventa uno a
     * nome di un'altra.
     */
    function contributoDiUnaCorsa(pn) {
      if (pn === radiceFeature || !pn.startsWith(`${radiceFeature}/`)) return false;
      const parti = pn.slice(radiceFeature.length + 1).split('/');
      // La cartella è una feature (trattini singoli); il file è lo slug di una corsa, e quello porta
      // i doppi trattini del confine (`owner--repo`), oltre a punti e trattini di un nome di cartella.
      if (parti.length !== 2) return false;
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(parti[0])) return false;
      if (!/^[a-z0-9][a-z0-9._-]*\.md$/.test(parti[1])) return false;
      const corsa = parti[1].slice(0, -3);
      if (corsa === slugNorm) return true;
      if (!repo) return false;
      let testo;
      try {
        testo = readFileSync(join(repo, RADICE_CORSE, corsa, 'run.json'), 'utf-8');
      } catch {
        return false;
      }
      try {
        const feature = normPath(`${radiceFeature}/${parti[0]}`);
        return (JSON.parse(testo).contributi || []).some((c) => c && normPath(`${radiceFeature}/${c.feature}`) === feature);
      } catch {
        return false;
      }
    }
    /** `true` se il path stava già dentro una cartella non tracciata al Passo 0: lì il confronto
     *  fra le due fotografie non distingue il file di allora da quello di adesso. */
    const dentroIniziale = (pn) => inizialeDentro.some((d) => pn === d || pn.startsWith(`${d}/`));
    for (const line of nuove) {
      for (const p of pathsOf(line)) {
        const pn = normPath(p);
        if (dentroIniziale(pn)) continue;
        if (pn === radiceFeature || pn.startsWith(`${radiceFeature}/`)) {
          // Nel catalogo delle feature: un contributo dichiarato, e solo per aggiungerlo o
          // riscriverlo — cancellarne uno cancellerebbe l'evidenza di quella corsa.
          if (!contributoDiUnaCorsa(pn) || /^\s*[DR]/.test(line)) fuoriContributo.push(line);
        } else if (!(pn === radiceCorse || pn.startsWith(`${radiceCorse}/`))) {
          fuoriRadice.push(line);
        }
        if (pn.startsWith('plugins/')) sottoPlugins.push(line);
      }
    }
    check('scrittura:solo-sotto-la-radice-delle-corse', fuoriRadice.length === 0, fuoriRadice.length ? `fuori da ${RADICE_CORSE}/: ${fuoriRadice.join(' | ')}` : '');
    check('scrittura:contributo-dichiarato', fuoriContributo.length === 0, fuoriContributo.length ? `nel catalogo ma non dichiarato da nessuna corsa: ${fuoriContributo.join(' | ')}` : '');
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

  const base = mkdtempSync(join(tmpdir(), 'ss-check-run-'));
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

    /** Lo stato git VERO di una fixture, come lo registra il Passo 0: senza iniettarlo. Serve ai
     *  casi che devono esercitare il collasso di git, che una lista scritta a mano non riproduce. */
    function gitStatus(dir) {
      const res = spawnSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf-8', timeout: 15000 });
      return (res.stdout || '').split(/\r?\n/).filter(Boolean);
    }

    function baseRunJson(dir, overrides = {}) {
      const sorgentePath = overrides.sorgentePathOverride ?? join(dir, 'analysis-root', 'opensrc', 'repos', 'example', 'fixture', '1.0.0').replace(/\\/g, '/');
      const leggera = overrides.leggera === true;
      return {
        target: 'fixture', slug: 'npm--fixture', tipo: 'npm', focus: null, data: '2026-09-25',
        profondita: leggera ? 'leggera' : undefined,
        acquisizione_leggera: leggera ? { via: 'api', sha: 'abc', data_commit: '2026-09-25' } : undefined,
        sorgente: leggera
          ? { path: null, acquisizione: null, versione_richiesta: null, versione_risolta: null, revisione: null }
          : { path: sorgentePath, acquisizione: 'opensrc', versione_richiesta: null, versione_risolta: '1.0.0', revisione: '1.0.0' },
        grafo: leggera
          ? { comando: null, path: null, nodi: 0, archi: 0 }
          : { comando: overrides.comando ?? 'graphify extract <path> --code-only --out <dir>', path: join(dir, 'grafo', 'graph.json').replace(/\\/g, '/'), nodi: overrides.nodi ?? 42, archi: 100 },
        daiku: { radice: overrides.daikuRadice ?? 'plugins/daiku', commit: 'abc1234', grafo: leggera ? null : join(dir, 'daiku-grafo', 'graph.json').replace(/\\/g, '/') },
        toolchain: leggera
          ? { opensrc: { versione: null, binario: null }, graphify: { versione: null, binario: null }, node: process.version, git: 'git 2.0.0', gh: null }
          : { opensrc: { versione: 'opensrc 9.9.9', binario: 'opensrc.cmd' }, graphify: { versione: 'graphify 8.8.8', binario: 'graphify.exe' }, node: process.version, git: 'git 2.0.0', gh: null },
        presidio: { acceso: false },
        stato_git_iniziale: overrides.statoGit ?? [],
        allineamenti: overrides.allineamenti ?? [],
        contributi: overrides.contributi ?? [],
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
      push('Allineamento', fields.allineamento);
      push('Feature', fields.feature);
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

    // `PARTIAL`, non `ABSENT`: una capacità che Daiku non ha affatto pretende il suo contributo nel
    // catalogo delle feature, e le fixture che non lo provano non devono inciamparci.
    const schedaAdottaOk = { id: 'RI-001', titolo: 'Esempio adottabile', azione: 'adotta', priorita: 'alta', classificazione: 'PARTIAL', modo: 'concept', evidenza: 'EV-001', equivalente: 'plugins/daiku/skills/esempio/SKILL.md', sede: 'plugins/daiku/skills/esempio/SKILL.md', blast: 'low', costo: 'basso', licenza: 'MIT — verificata in LICENSE', confidenza: 'HIGH' };
    const rowFor = (s) => `| ${s.id} | ${s.titolo} | ${s.azione} | ${s.priorita} | ${s.sede} |`;

    // Caso verde: corsa completa e coerente.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('caso-verde-nessun-fallito', res.failed.length === 0, res.failed.join(' | '));
    }

    // Caso verde leggero: senza toolchain, grafo e source, con una sola voce ispira.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      const schedaIspira = { id: 'RI-001', titolo: 'Direzione interessante', azione: 'ispira', priorita: 'bassa', classificazione: 'ABSENT', modo: 'no-action', evidenza: 'EV-001', equivalente: 'nessuno', sede: 'nessuna', blast: 'low', costo: 'basso', licenza: 'da verificare sul source', confidenza: 'LOW' };
      writeRun(dir, cartella, { runJsonOverrides: { leggera: true }, comparisonRows: [], schedeFields: [schedaIspira] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('caso-verde-leggero-nessun-fallito', res.failed.length === 0, res.failed.join(' | '));
    }

    // Corsa leggera con una scheda "adotta" -> rosso: senza source non si adotta niente.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { leggera: true }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('leggera-con-adotta-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:leggera-solo-voci-leggere')), res.failed.join(' | '));
    }

    // Scheda "adotta" senza licenza -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const scheda = { ...schedaAdottaOk, licenza: undefined };
      writeRun(dir, cartella, { comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('adotta-senza-licenza-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:regola-adotta-adatta')), res.failed.join(' | '));
    }

    // Scarta senza "Perché no" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const scheda = { id: 'RI-002', titolo: 'Esempio scartato', azione: 'scarta', priorita: 'bassa', classificazione: 'ABSENT', modo: 'no-action', evidenza: 'EV-001', sede: 'nessuna', blast: 'low', costo: 'basso', confidenza: 'LOW' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scarta-senza-perche-no-rosso', res.failed.some((f) => f.startsWith('scheda:RI-002:regola-scarta')), res.failed.join(' | '));
    }

    // --- Le voci `allinea`: si verifica l'applicabilità della sostituzione, non l'idea. ---

    /** Un file del prodotto dentro il repository finto, per le fixture degli allineamenti. */
    function scriviFileProdotto(dir, sotto, testo) {
      const partes = sotto.split('/');
      const cartella = join(dir, 'plugins', 'daiku', ...partes.slice(0, -1));
      mkdirSync(cartella, { recursive: true });
      writeFileSync(join(cartella, partes[partes.length - 1]), testo);
    }

    const FILE_ALLINEA = 'skills/esempio/SKILL.md';
    const TESTO_ALLINEA = '# Esempio\n\nVedi § *Il confine* per il resto.\n';
    const voceAllinea = (path, prima, dopo) => ({ voce: 'RI-003', path, prima, dopo });
    const schedaAllinea = (voce) => ({
      id: 'RI-003', titolo: 'Rimando che non risolve', azione: 'allinea', priorita: 'bassa',
      classificazione: 'ABSENT', modo: 'no-action', evidenza: 'EV-002', equivalente: 'nessuno',
      sede: `plugins/daiku/${FILE_ALLINEA}`, blast: 'low', costo: 'basso', confidenza: 'HIGH',
      allineamento: voce ? `${voce.prima} → ${voce.dopo}` : undefined,
    });

    /** Una fixture di allineamento: il file di prodotto, la voce e la scheda che la racconta. */
    function fixtureAllinea(dir, testo, voce, schedaExtra = {}) {
      scriviFileProdotto(dir, FILE_ALLINEA, testo);
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      writeRun(dir, cartella, {
        runJsonOverrides: { allineamenti: [voce] },
        comparisonRows: [],
        schedeFields: [{ ...schedaAllinea(voce), ...schedaExtra }],
      });
      return runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
    }

    const voceBuona = voceAllinea(`plugins/daiku/${FILE_ALLINEA}`, '§ *Il confine*', '§ *Confine*');

    // Allineamento applicabile, con la sua scheda -> nessun rosso.
    {
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voceBuona);
      record('allinea-verde-nessun-rosso', res.failed.length === 0, res.failed.join(' | '));
    }

    // `prima` che compare due volte nel file: la sostituzione non è applicabile -> rosso.
    {
      const res = fixtureAllinea(buildFakeRepo(), '# Esempio\n\nVedi § *Il confine*.\n\nAnche § *Il confine*.\n', voceBuona);
      record('allinea-prima-non-unica-rosso', res.failed.some((f) => f.startsWith('allineamento:RI-003:prima-unica')), res.failed.join(' | '));
    }

    // `prima` che nel file non c'è -> rosso, con lo stesso controllo.
    {
      const voce = voceAllinea(`plugins/daiku/${FILE_ALLINEA}`, 'testo che non esiste', 'altro');
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voce);
      record('allinea-prima-assente-rosso', res.failed.some((f) => f.startsWith('allineamento:RI-003:prima-unica')), res.failed.join(' | '));
    }

    // `prima` su più righe -> rosso: la sostituzione si legge nella scheda, e lì non ci sta.
    {
      const voce = voceAllinea(`plugins/daiku/${FILE_ALLINEA}`, '# Esempio\n\nVedi', '# Esempio\n\nGuarda');
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voce);
      record('allinea-multiriga-rosso', res.failed.some((f) => f.startsWith('allineamento:RI-003:una-riga')), res.failed.join(' | '));
    }

    // La scheda che non riporta le due stringhe di `run.json` -> rosso: le due sedi divergono.
    {
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voceBuona, { allineamento: 'qualcosa altro' });
      record('allinea-scheda-incoerente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-003:allineamento-coerente')), res.failed.join(' | '));
    }

    // Un allineamento che atterrerebbe fuori dal prodotto -> rosso.
    {
      const voce = voceAllinea('CLAUDE.md', 'a', 'b');
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voce, { sede: 'CLAUDE.md' });
      record('allinea-fuori-prodotto-rosso', res.failed.some((f) => f.startsWith('allineamento:RI-003:path-sotto-plugins')), res.failed.join(' | '));
    }

    // Scheda `allinea` senza la sua voce in run.json -> rosso: nessuno applicherebbe niente.
    {
      const dir = buildFakeRepo();
      scriviFileProdotto(dir, FILE_ALLINEA, TESTO_ALLINEA);
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaAllinea(null)] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('allinea-scheda-senza-voce-rosso', res.failed.some((f) => f.startsWith('scheda:RI-003:regola-allinea')), res.failed.join(' | '));
    }

    // Voce in run.json senza la sua scheda `allinea` -> rosso: una sostituzione senza censimento.
    {
      const res = fixtureAllinea(buildFakeRepo(), TESTO_ALLINEA, voceBuona, { azione: 'ispira', sede: 'nessuna' });
      record('allinea-voce-senza-scheda-rosso', res.failed.some((f) => f.startsWith('allineamenti:ogni-voce-ha-la-sua-scheda')), res.failed.join(' | '));
    }

    // --- I contributi: una cartella per feature, un file per corsa. ---

    const FEATURE = 'gestione-contesto';
    const CORSA_PROVA = 'owner--fixture';

    /** Un contributo nella forma fissa del contratto, coi campi che il gate confronta. */
    function testoContributo({ feature = FEATURE, corsa = CORSA_PROVA, ramo = 'profonda', sezioni = SEZIONI_CONTRIBUTO, evidenza = '`src/index.js` — estratto' } = {}) {
      const righe = ['# Gestione del contesto — fixture', '', `- **Feature:** ${feature}`, `- **Corsa:** .docs/studia-repository/${corsa}/`, `- **Ramo:** ${ramo}`, ''];
      for (const s of sezioni) righe.push(`## ${s}`, '', s === 'Evidenza' ? evidenza : 'testo', '');
      return righe.join('\n');
    }

    function scriviContributo(dir, feature, corsa, testo) {
      const cartella = join(dir, '.docs', 'features', feature);
      mkdirSync(cartella, { recursive: true });
      writeFileSync(join(cartella, `${corsa}.md`), testo);
    }

    /** Una capacità che Daiku non ha: `adotta` su `ABSENT`, col suo posto nel catalogo. */
    const schedaCapacita = (feature) => ({
      id: 'RI-010', titolo: 'Gestione del contesto', azione: 'adotta', priorita: 'alta',
      classificazione: 'ABSENT', modo: 'concept', evidenza: 'EV-001', equivalente: 'nessuno',
      sede: 'plugins/daiku/skills/esempio/SKILL.md', blast: 'medium', costo: 'medio',
      licenza: 'MIT — verificata in LICENSE', confidenza: 'HIGH', feature,
    });

    /** Una corsa che porta un contributo: la scheda, la voce in run.json e il file del catalogo. */
    function corsaConContributo(dir, { scheda = schedaCapacita(FEATURE), feature = FEATURE, testo, git } = {}) {
      const cartella = join(dir, '.docs', 'studia-repository', CORSA_PROVA);
      writeRun(dir, cartella, {
        runJsonOverrides: { contributi: [{ voce: scheda.id, feature }] },
        comparisonRows: [rowFor(scheda)], schedeFields: [scheda],
      });
      scriviContributo(dir, feature, CORSA_PROVA, testo ?? testoContributo({ feature }));
      return runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: git ?? [] });
    }

    // Contributo completo -> nessun rosso.
    {
      const res = corsaConContributo(buildFakeRepo());
      record('contributo-verde-nessun-rosso', res.failed.length === 0, res.failed.join(' | '));
    }

    // Anche una corsa leggera contribuisce, con un `ispira`: il catalogo cresce da entrambi i rami,
    // ed è la ragione per cui l'obbligo sta solo su chi propone di prendere.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', CORSA_PROVA);
      const scheda = {
        id: 'RI-011', titolo: 'Gestione del contesto', azione: 'ispira', priorita: 'media',
        classificazione: 'ABSENT', modo: 'no-action', evidenza: 'EV-001', equivalente: 'nessuno',
        sede: 'nessuna', blast: 'low', costo: 'medio', confidenza: 'MEDIUM', feature: FEATURE,
      };
      writeRun(dir, cartella, {
        runJsonOverrides: { leggera: true, contributi: [{ voce: scheda.id, feature: FEATURE }] },
        comparisonRows: [], schedeFields: [scheda],
      });
      scriviContributo(dir, FEATURE, CORSA_PROVA, testoContributo({ ramo: 'leggera' }));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('contributo-da-corsa-leggera-verde', res.failed.length === 0, res.failed.join(' | '));
    }

    // Il file del contributo col proprio nome è l'unica scrittura ammessa fuori dalla corsa -> verde.
    {
      const res = corsaConContributo(buildFakeRepo(), { git: [`?? .docs/features/${FEATURE}/${CORSA_PROVA}.md`] });
      record('contributo-nel-perimetro-verde', !res.failed.some((f) => f.startsWith('scrittura:')), res.failed.join(' | '));
    }

    // Capacità senza contributo -> rosso: il catalogo è il posto in cui quella voce vive.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', CORSA_PROVA);
      const scheda = schedaCapacita(FEATURE);
      writeRun(dir, cartella, { comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('capacita-senza-contributo-rosso', res.failed.some((f) => f.startsWith('contributi:ogni-capacita-da-prendere-ha-il-suo')), res.failed.join(' | '));
    }

    // Un contributo su una cosa che Daiku ha già -> rosso: il catalogo non è un secondo censimento.
    {
      const res = corsaConContributo(buildFakeRepo(), { scheda: { ...schedaAdottaOk, feature: FEATURE } });
      record('contributo-senza-capacita-rosso', res.failed.some((f) => f.startsWith('contributi:ogni-contributo-ha-la-sua-capacita')), res.failed.join(' | '));
    }

    // La voce dichiarata ma il file assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', CORSA_PROVA);
      const scheda = schedaCapacita(FEATURE);
      writeRun(dir, cartella, {
        runJsonOverrides: { contributi: [{ voce: scheda.id, feature: FEATURE }] },
        comparisonRows: [rowFor(scheda)], schedeFields: [scheda],
      });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('contributo-file-assente-rosso', res.failed.some((f) => f.startsWith('contributo:RI-010:file-esiste')), res.failed.join(' | '));
    }

    // Le sezioni in un altro ordine -> rosso: la forma è ciò che rende confrontabili due repo.
    {
      const sezioni = [...SEZIONI_CONTRIBUTO].reverse();
      const res = corsaConContributo(buildFakeRepo(), { testo: testoContributo({ sezioni }) });
      record('contributo-sezioni-fuori-ordine-rosso', res.failed.some((f) => f.startsWith('contributo:RI-010:sezioni-in-ordine')), res.failed.join(' | '));
    }

    // Evidenza vuota -> rosso: un contributo senza prove è un'opinione.
    {
      const res = corsaConContributo(buildFakeRepo(), { testo: testoContributo({ evidenza: '' }) });
      record('contributo-evidenza-vuota-rosso', res.failed.some((f) => f.startsWith('contributo:RI-010:evidenza-non-vuota')), res.failed.join(' | '));
    }

    // La scheda che dichiara una feature diversa da quella di run.json -> rosso.
    {
      const res = corsaConContributo(buildFakeRepo(), { scheda: schedaCapacita('altra-feature'), feature: FEATURE });
      record('contributo-scheda-incoerente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-010:feature-coerente')), res.failed.join(' | '));
    }

    // Il ramo dichiarato diverso da quello della corsa -> rosso.
    {
      const res = corsaConContributo(buildFakeRepo(), { testo: testoContributo({ ramo: 'leggera' }) });
      record('contributo-ramo-incoerente-rosso', res.failed.some((f) => f.startsWith('contributo:RI-010:ramo-coerente')), res.failed.join(' | '));
    }

    // Un file nel catalogo di una corsa che non lo dichiara -> rosso: una corsa non inventa un
    // contributo a nome di un'altra.
    {
      const res = corsaConContributo(buildFakeRepo(), { git: [`?? .docs/features/${FEATURE}/altro--repo.md`] });
      record('contributo-non-dichiarato-rosso', res.failed.some((f) => f.startsWith('scrittura:contributo-dichiarato')), res.failed.join(' | '));
    }

    // Il contributo di una corsa parallela che lo dichiara -> verde. Due corse che studiano due repo
    // della stessa feature scrivono due file diversi nella stessa cartella, e nessuna delle due deve
    // vedere il file dell'altra come una scrittura fuori posto.
    {
      const dir = buildFakeRepo();
      const mia = join(dir, '.docs', 'studia-repository', CORSA_PROVA);
      const scheda = schedaCapacita(FEATURE);
      writeRun(dir, mia, { runJsonOverrides: { contributi: [{ voce: scheda.id, feature: FEATURE }] }, comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      scriviContributo(dir, FEATURE, CORSA_PROVA, testoContributo());

      const altra = join(dir, '.docs', 'studia-repository', 'altro--repo');
      const schedaAltra = { ...schedaCapacita(FEATURE), id: 'RI-020' };
      writeRun(dir, altra, { runJsonOverrides: { contributi: [{ voce: 'RI-020', feature: FEATURE }] }, comparisonRows: [rowFor(schedaAltra)], schedeFields: [schedaAltra] });
      scriviContributo(dir, FEATURE, 'altro--repo', testoContributo({ corsa: 'altro--repo' }));

      const res = runChecks(mia, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: [`?? .docs/features/${FEATURE}/altro--repo.md`],
      });
      record('contributo-di-una-corsa-parallela-verde', !res.failed.some((f) => f.startsWith('scrittura:')), res.failed.join(' | '));
    }

    // Un contributo cancellato -> rosso: sparirebbe l'evidenza di quella corsa.
    {
      const res = corsaConContributo(buildFakeRepo(), { git: [` D .docs/features/${FEATURE}/${CORSA_PROVA}.md`] });
      record('contributo-cancellato-rosso', res.failed.some((f) => f.startsWith('scrittura:contributo-dichiarato')), res.failed.join(' | '));
    }

    // "## Da riprendere" non è la prima sezione -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const bassa = { ...schedaAdottaOk, id: 'RI-001', priorita: 'bassa' };
      const alta = { ...schedaAdottaOk, id: 'RI-002', priorita: 'alta' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(bassa), rowFor(alta)], schedeFields: [bassa, alta] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-fuori-ordine-rosso', res.failed.some((f) => f.startsWith('comparazione:da-riprendere-ordine-priorita')), res.failed.join(' | '));
    }

    // Un EV citato dalla scheda ma assente dal ledger -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const scheda = { ...schedaAdottaOk, evidenza: 'EV-999' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(scheda)], schedeFields: [scheda] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ev-citato-assente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:evidenza-esiste')), res.failed.join(' | '));
    }

    // daiku.radice diversa dall'argomento -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { daikuRadice: 'plugins/altro' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('radice-diversa-rosso', res.failed.some((f) => f.startsWith('run-json:daiku-radice-coincide')), res.failed.join(' | '));
    }

    // sorgente.path fuori dalla radice di analisi -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { sorgentePathOverride: join(dir, 'fuori-radice', 'fixture').replace(/\\/g, '/') }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('sorgente-fuori-radice-rosso', res.failed.some((f) => f.startsWith('run-json:sorgente-sotto-radice-analisi')), res.failed.join(' | '));
    }

    // grafo.comando senza --code-only -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { comando: 'graphify extract <path> --out <dir>' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comando-senza-code-only-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-comando-code-only')), res.failed.join(' | '));
    }

    // grafo.comando con "install" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      // La stringa evita di deragliare nella forma esatta che self-check.mjs vieta altrove
      // (`graphify … install`): qui basta la sotto-stringa "install" per collaudare la regola di
      // check-run.mjs, che è un semplice `comando.includes('install')`.
      writeRun(dir, cartella, { runJsonOverrides: { comando: 'graphify extract <path> --code-only --then-install-happens' }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comando-con-install-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-comando-no-install')), res.failed.join(' | '));
    }

    // File toccato fuori dalla radice delle corse -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? altrove/file-intruso.txt'],
      });
      record('file-fuori-radice-rosso', res.failed.some((f) => f.startsWith('scrittura:solo-sotto-la-radice-delle-corse')), res.failed.join(' | '));
    }

    // Il difetto del 29 settembre 2026: la cartella della corsa nasce al primo uso ed e' tutta non
    // tracciata, git la collassa in una riga sola, e il controllo la leggeva come "fuori cartella".
    // Si prova sullo stato git VERO, senza iniettarlo: il banco lo iniettava sempre, ed e' per
    // questo che non l'aveva mai visto.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      const prima = gitStatus(dir);
      writeRun(dir, cartella, { runJsonOverrides: { statoGit: prima }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')] });
      record('cartella-della-corsa-non-e-un-rosso', !res.failed.some((f) => f.startsWith('scrittura:')), res.failed.join(' | '));
    }

    // Lo stesso stato vero, ma con una scrittura davvero fuori: con `-uall` la cartella nuova si
    // vede file per file e il rosso resta. E' il verso che impedisce alla correzione di zittire il
    // controllo invece di ripararlo.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      const prima = gitStatus(dir);
      writeRun(dir, cartella, { runJsonOverrides: { statoGit: prima }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      mkdirSync(join(dir, '.docs', 'altro'), { recursive: true });
      writeFileSync(join(dir, '.docs', 'altro', 'intruso.txt'), 'x');
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')] });
      record('scrittura-fuori-radice-con-stato-vero-rosso', res.failed.some((f) => f.startsWith('scrittura:solo-sotto-la-radice-delle-corse')), res.failed.join(' | '));
    }

    // Il limite dichiarato, fissato come comportamento noto invece che lasciato scoprire a un rosso
    // altrui: un file nuovo dentro una cartella GIA' interamente non tracciata al Passo 0 non si
    // distingue da uno che c'era, perche' la fotografia iniziale e' collassata.
    {
      const dir = buildFakeRepo();
      mkdirSync(join(dir, 'scartoffie'), { recursive: true });
      writeFileSync(join(dir, 'scartoffie', 'vecchio.txt'), 'x');
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      const prima = gitStatus(dir);
      writeRun(dir, cartella, { runJsonOverrides: { statoGit: prima }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      writeFileSync(join(dir, 'scartoffie', 'nuovo.txt'), 'y');
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')] });
      record('limite-cartella-gia-non-tracciata', !res.failed.some((f) => f.startsWith('scrittura:')), res.failed.join(' | '));
    }

    // Una radice sorella con lo stesso prefisso (".docs/studia-repository-vecchia" contro
    // ".docs/studia-repository") non deve passare per "dentro" il perimetro: il confine vuole lo
    // slash, come `sottoRadice`.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? .docs/studia-repository-vecchia/npm--fixture/x.txt'],
      });
      record('radice-sorella-prefisso-non-passa', res.failed.some((f) => f.startsWith('scrittura:solo-sotto-la-radice-delle-corse')), res.failed.join(' | '));
    }

    // La corsa parallela: un'altra corsa del lotto, con la sua cartella sotto la stessa radice e le
    // sue scritture dentro, non deve dare il rosso alla prima. È il caso che il perimetro nuovo
    // esiste per rendere verde.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'owner--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: ['?? .docs/studia-repository/altro--fixture/run.json', '?? .docs/studia-repository/altro--fixture/0. study.md'],
      });
      record('corsa-parallela-non-e-un-rosso', !res.failed.some((f) => f.startsWith('scrittura:')), res.failed.join(' | '));
    }

    // La corsa scritta fuori dalla radice delle corse -> rosso, qualunque cosa contenga.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'altrove', 'owner--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', {
        repoOverride: dir,
        radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')],
        gitStatusCorrente: [],
      });
      record('corsa-fuori-radice-rosso', res.failed.some((f) => f.startsWith('cartella:sotto-la-radice-delle-corse')), res.failed.join(' | '));
    }

    // File nuovo sotto plugins/ -> rosso sul divieto specifico "niente-sotto-plugins".
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], skipRunJson: true });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('run-json-mancante-rosso', res.failed.some((f) => f.startsWith('run-json:esiste')), res.failed.join(' | '));
    }

    // run.json con una chiave mancante -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { runJsonOverrides: { nodi: 0 }, comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('grafo-nodi-zero-rosso', res.failed.some((f) => f.startsWith('run-json:grafo-nodi-positivo')), res.failed.join(' | '));
    }

    // "0. study.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '0. study.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('study-assente-rosso', res.failed.some((f) => f.startsWith('documento:0-study-esiste')), res.failed.join(' | '));
    }

    // "1. daiku-comparison.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '1. daiku-comparison.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('comparison-assente-rosso', res.failed.some((f) => f.startsWith('documento:1-comparison-esiste')), res.failed.join(' | '));
    }

    // "2. evidence-ledger.md" assente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      rmSync(join(cartella, '2. evidence-ledger.md'));
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-assente-rosso', res.failed.some((f) => f.startsWith('documento:2-ledger-esiste')), res.failed.join(' | '));
    }

    // Ledger con ID duplicato -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const ledgerDup = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | target | src/index.js | riga 10 | estratto | VERIFIED |\n| EV-001 | daiku | plugins/daiku/skills/x/SKILL.md | — | estratto | VERIFIED |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerDup });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-id-duplicato-rosso', res.failed.some((f) => f.startsWith('ledger:id-univoci')), res.failed.join(' | '));
    }

    // Ledger con "lato" fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const ledgerBadLato = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | targetX | src/index.js | riga 10 | estratto | VERIFIED |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerBadLato });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-lato-invalido-rosso', res.failed.some((f) => f.startsWith('ledger:lato-validi')), res.failed.join(' | '));
    }

    // Ledger con "verifica" fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const ledgerBadVerifica = `# Ledger\n\n${LEDGER_HEADER}| EV-001 | target | src/index.js | riga 10 | estratto | BOGUS |\n`;
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk], ledger: ledgerBadVerifica });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('ledger-verifica-invalida-rosso', res.failed.some((f) => f.startsWith('ledger:verifica-validi')), res.failed.join(' | '));
    }

    // Due schede con lo stesso ID -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaDup = { ...schedaAdottaOk, titolo: 'Duplicato' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk, schedaDup] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-id-duplicato-rosso', res.failed.some((f) => f.startsWith('comparazione:scheda-id-univoci')), res.failed.join(' | '));
    }

    // Scheda con Azione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadAzione = { ...schedaAdottaOk, azione: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadAzione] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-azione-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Priorità fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadPriorita = { ...schedaAdottaOk, priorita: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadPriorita] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-priorita-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Classificazione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadClassificazione = { ...schedaAdottaOk, classificazione: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadClassificazione] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-classificazione-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Modo di adozione fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadModo = { ...schedaAdottaOk, modo: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadModo] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-modo-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Blast radius fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadBlast = { ...schedaAdottaOk, blast: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadBlast] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-blast-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Costo fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadCosto = { ...schedaAdottaOk, costo: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadCosto] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-costo-invalido-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Scheda con Confidenza fuori insieme -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaBadConfidenza = { ...schedaAdottaOk, confidenza: 'invalido' };
      writeRun(dir, cartella, { comparisonRows: [], schedeFields: [schedaBadConfidenza] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('scheda-confidenza-invalida-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:campi-validi')), res.failed.join(' | '));
    }

    // Classificazione ALREADY_PRESENT senza "Equivalente in Daiku" -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaAlreadyPresent = { ...schedaAdottaOk, classificazione: 'ALREADY_PRESENT', equivalente: 'nessuno' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAlreadyPresent)], schedeFields: [schedaAlreadyPresent] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('already-present-senza-equivalente-rosso', res.failed.some((f) => f.startsWith('scheda:RI-001:equivalente-in-daiku')), res.failed.join(' | '));
    }

    // "Da riprendere" cita un ID senza scheda corrispondente -> rosso.
    {
      const dir = buildFakeRepo();
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
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
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      const schedaIspira = { ...schedaAdottaOk, azione: 'ispira', titolo: 'Solo ispirazione' };
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaIspira)], schedeFields: [schedaIspira] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, radiciNonEseguibili: [join(dir, 'analysis-root').replace(/\\/g, '/')], gitStatusCorrente: [] });
      record('da-riprendere-azione-non-adotta-adatta-rosso', res.failed.some((f) => f.startsWith('comparazione:da-riprendere-solo-adotta-adatta')), res.failed.join(' | '));
    }

    // Configurazione del presidio illeggibile -> "presidio-letto" rosso (fail-safe: la sorgente
    // risulta di conseguenza fuori da ogni radice_non_eseguibile).
    {
      const dir = buildFakeRepo();
      rmSync(join(dir, '.claude', 'guardia-target.json'));
      const cartella = join(dir, '.docs', 'studia-repository', 'npm--fixture');
      writeRun(dir, cartella, { comparisonRows: [rowFor(schedaAdottaOk)], schedeFields: [schedaAdottaOk] });
      const res = runChecks(cartella, 'plugins/daiku', { repoOverride: dir, presidioOverride: join(dir, '.claude', 'guardia-target.json'), gitStatusCorrente: [] });
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
