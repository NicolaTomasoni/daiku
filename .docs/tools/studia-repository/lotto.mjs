#!/usr/bin/env node
/**
 * Lotto di corse di /studia-repository: prepara l'elenco, le lancia in parallelo, applica i gratuiti.
 *
 * Attrezzo di sviluppo, non parte del prodotto: vive fuori da `plugins/`, non si pubblica, non si
 * installa in nessun progetto e non gira mai da un hook. Lo lancia la skill
 * `.claude/commands/studia-repository-lotto.md`, che è il ciclo che lo consuma:
 *
 *   node .docs/tools/studia-repository/lotto.mjs prepara --lista <file> [<target> …] [flag]
 *   node .docs/tools/studia-repository/lotto.mjs lancia  --lista <file> [<target> …] [flag]
 *   node .docs/tools/studia-repository/lotto.mjs applica  [--lotto <id>] [--dry-run]
 *   node .docs/tools/studia-repository/lotto.mjs --self-check
 *
 * `prepara` non scrive niente: valida l'elenco, controlla la radice del pacchetto, guarda se `gh`
 * risponde e stampa il piano — i target e la riga di comando esatta che `lancia` eseguirebbe.
 * `lancia` esegue quel piano: una **sessione headless di Claude Code per target**, fino a
 * `--parallelo` insieme, ognuna con il proprio log in `%TEMP%/daiku-lotto/<id>/`, e aspetta che
 * finiscano tutte. `applica` chiude il lotto: passa il gate di ogni corsa nata dal lotto, raccoglie
 * le voci `allinea` dalle corse, applica quelle che si sostituiscono senza toccarsi, riporta le
 * altre all'owner ed **elenca il catalogo** — quali feature hanno ricevuto un contributo, da quali
 * corse. Non committa mai niente: quello resta dell'owner.
 *
 * **Perché una sessione headless e non un subagent.** `/studia-repository` è un contratto che
 * ri-delega: lanciarlo *dentro* una sessione la farebbe crescere di una corsa intera per ogni
 * target, e il fan-out dichiarato dal corpus (`.claude/orchestration.md` §4) è di subagent con un
 * contesto fresco — una sessione per target è quel contesto, preso alla radice. In più il
 * presidio di macchina nega le righe di comando che contengono un token che comincia per `/`
 * scambiandolo per un path assoluto, quindi `/studia-repository …` non si può scrivere da un tool
 * Bash: chi lo lancia deve essere un processo, non un comando.
 *
 * **Chi applica, e perché non lo fa la corsa.** Una corsa scrive solo sotto
 * `.docs/studia-repository/` e non tocca il prodotto: il gate `check-run.mjs` lo impone, ed è
 * quello che rende due corse parallele innocue. Le voci `allinea` — i miglioramenti che non
 * cambiano né il comportamento di Daiku né ciò che Daiku decide — le applica questo attrezzo,
 * dopo, in un colpo solo: due corse che propongono la stessa riparazione non si pestano i piedi, e
 * chi le applica è uno solo. Una voce `allinea` è applicabile solo se è una **sostituzione
 * puntuale**: `path`, il testo esatto che c'è e il testo esatto che ci va. Se due proposte toccano
 * lo stesso file con due intervalli che si sovrappongono, sono due forme diverse della stessa
 * regola: è una decisione, e va all'owner.
 *
 * Convenzione d'uscita come gli altri attrezzi: `0` se tutto verde, `1` al primo controllo rosso,
 * `2` per uso errato.
 */

import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const DEV = resolve(QUI, '..', '..', '..'); // radice del repository di sviluppo
const RADICE = join(DEV, 'plugins', 'daiku'); // la radice del pacchetto, sempre per argomento
const CORSE = join(DEV, '.docs', 'studia-repository'); // la radice di tutte le corse
const LOTTI = join(tmpdir(), 'daiku-lotto'); // lo stato dei lotti, fuori dal repository
const CHECK_RUN = join(QUI, 'check-run.mjs');
const RADICE_ARG = 'plugins/daiku';

/** Il validatore di Codex, che vive nella home dell'utente: il path si compone, non si scrive con
 *  una variabile di shell — la riga passa da `cmd.exe`, che `$HOME` non lo espande. */
function validatoreCodex() {
  const casa = process.env.USERPROFILE || process.env.HOME || '';
  return join(casa, '.codex', 'skills', '.system', 'plugin-creator', 'scripts', 'validate_plugin.py');
}

/** Le verifiche che il pacchetto deve passare dopo un'applicazione, nell'ordine di `CLAUDE.md`. */
function verifiche() {
  return [
    ['validatore Claude Code', 'claude plugin validate plugins/daiku'],
    ['validatore Codex', `python "${validatoreCodex()}" plugins/daiku`],
    ['banchi del pacchetto', 'node plugins/daiku/hooks/self-check.mjs'],
    ['topologia del corpus', 'node .docs/tools/check-topology.mjs plugins/daiku'],
  ];
}

function muori(codice, messaggio) {
  process.stderr.write(`lotto: ${messaggio}\n`);
  process.exit(codice);
}

function uso() {
  muori(2, 'uso: lotto.mjs <prepara|lancia|applica> [--lista <file>] [<target> …] '
    + '[--parallelo N] [--budget <usd>] [--modello <m>] [--tempo <minuti>] '
    + '[--assi <lista>] [--versione <v>] [--focus <domanda, ultima opzione>] [--cwd <path>] [--deep|--shallow-only]\n'
    + '     lotto.mjs --self-check');
}

// --- funzioni pure: quelle che il banco prova -------------------------------------------

/** Le righe utili di un elenco: una per riga, i vuoti si scartano, e ogni target compare una volta
 *  sola nell'ordine in cui è stato scritto. In un file di elenco `#` apre un commento; un target
 *  scritto sulla riga di comando no, perché un link può portarselo dietro (`…/repo#readme`). */
function leggiLista(testo, conCommenti = true) {
  const fuori = [];
  const visti = new Set();
  for (const riga of String(testo).split(/\r?\n/)) {
    const netta = (conCommenti ? riga.replace(/#.*$/, '') : riga).trim();
    if (!netta || visti.has(netta)) continue;
    visti.add(netta);
    fuori.push(netta);
  }
  return fuori;
}

/** I caratteri che una riga di comando di Windows non sa portare dentro un argomento quotato. */
const VIETATI = ['"', '%', '&', '|', '<', '>', '^', '\r', '\n'];

/** `null` se il testo può viaggiare come argomento quotato, altrimenti il carattere che lo rompe. */
function carattereVietato(testo) {
  for (const c of VIETATI) if (String(testo).includes(c)) return c;
  return null;
}

/** Due intervalli sullo stesso file si sovrappongono se ognuno comincia prima che l'altro finisca. */
function siSovrappongono(x, y) {
  return x.da < y.a && y.da < x.a;
}

/**
 * Classifica le voci `allinea` raccolte dalle corse di un lotto. Pura: i file li legge `leggi`, che
 * il banco sostituisce con una mappa. Ritorna `{applicabili, doppioni, conflitti, rifiutati}`, dove
 * `rifiutati` porta il motivo — una proposta che non si applica così com'è scritta non è una voce
 * da decidere, è una voce da riscrivere.
 *
 * `chiave` distingue la stessa voce proposta da due corse diverse: il numero `RI-*` è unico per
 * corsa, non per lotto.
 */
function classifica(allineamenti, leggi) {
  const doppioni = [];
  const rifiutati = [];
  const candidati = [];
  const visti = new Set();
  for (const voce of allineamenti) {
    const identificatore = `${voce.corsa}#${voce.voce}`;
    const impronta = `${voce.path}\u0000${voce.prima}\u0000${voce.dopo}`;
    if (visti.has(impronta)) { doppioni.push({ ...voce, identificatore }); continue; }
    visti.add(impronta);

    const path = String(voce.path || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const rifiuta = (motivo) => rifiutati.push({ ...voce, identificatore, motivo });
    if (!path.startsWith('plugins/')) { rifiuta(`path fuori dal prodotto: ${voce.path}`); continue; }
    if (typeof voce.prima !== 'string' || !voce.prima || typeof voce.dopo !== 'string' || !voce.dopo) {
      rifiuta('"prima" o "dopo" vuoti'); continue;
    }
    if (voce.prima === voce.dopo) { rifiuta('"prima" e "dopo" identici'); continue; }

    const testo = leggi(path);
    if (testo === null) { rifiuta(`${path} non leggibile`); continue; }
    const da = testo.indexOf(voce.prima);
    if (da < 0) { rifiuta(`"prima" non compare in ${path}`); continue; }
    if (testo.indexOf(voce.prima, da + 1) >= 0) { rifiuta(`"prima" compare più di una volta in ${path}`); continue; }
    candidati.push({ ...voce, identificatore, path, da, a: da + voce.prima.length });
  }

  const conflitti = [];
  for (let i = 0; i < candidati.length; i += 1) {
    for (let j = i + 1; j < candidati.length; j += 1) {
      if (candidati[i].path !== candidati[j].path) continue;
      if (siSovrappongono(candidati[i], candidati[j])) conflitti.push([candidati[i], candidati[j]]);
    }
  }
  const inConflitto = new Set(conflitti.flat().map((v) => v.identificatore));
  const applicabili = candidati.filter((v) => !inConflitto.has(v.identificatore));
  return { applicabili, doppioni, conflitti, rifiutati };
}

/** La riga di comando di una corsa, come la stampa `prepara` e come la esegue `lancia`. */
function rigaComando(target, flag, opzioni) {
  const argomenti = [target, ...flagInRiga(flag)];
  const prompt = `/studia-repository ${argomenti.join(' ')}`.trim();
  const parti = ['claude', '-p', `"${prompt}"`, '--permission-mode', 'bypassPermissions', '--no-session-persistence'];
  if (opzioni.modello) parti.push('--model', opzioni.modello);
  if (opzioni.budget) parti.push('--max-budget-usd', String(opzioni.budget));
  parti.push('--append-system-prompt', `"${NOTA_LOTTO}"`);
  return parti.join(' ');
}

const NOTA_LOTTO = 'Sei una corsa di un lotto: altre corse di /studia-repository girano in parallelo '
  + 'nello stesso albero di lavoro. Scrivi solo dentro la tua cartella sotto .docs/studia-repository/ '
  + 'e non toccare le cartelle delle altre corse. Non committare e non mettere niente in stage.';

/** Le opzioni di una corsa in forma di argomenti per `/studia-repository`, nell'ordine del contratto. */
function flagInRiga(flag) {
  const fuori = [];
  if (flag.assi) fuori.push('--assi', flag.assi);
  if (flag.versione) fuori.push('--versione', flag.versione);
  if (flag.cwd) fuori.push('--cwd', flag.cwd);
  if (flag.deep) fuori.push('--deep');
  if (flag.shallowOnly) fuori.push('--shallow-only');
  // `--focus` chiude la riga: la domanda è testo libero e la prende tutto quello che resta.
  if (flag.focus) fuori.push('--focus', flag.focus);
  return fuori;
}

// --- lettura dello stato del repository -------------------------------------------------

function leggiFile(percorso) {
  try {
    return readFileSync(percorso, 'utf-8');
  } catch {
    return null;
  }
}

/** La radice del pacchetto si verifica, non si indovina: senza `"name": "daiku"` non è Daiku. */
function verificaRadice() {
  const file = join(RADICE, '.claude-plugin', 'plugin.json');
  const testo = leggiFile(file);
  if (testo === null) muori(1, `${file} non leggibile`);
  let json;
  try {
    json = JSON.parse(testo);
  } catch (e) {
    muori(1, `${file} non è JSON valido: ${e.message}`);
  }
  if (json.name !== 'daiku') muori(1, `${file} non porta "name": "daiku"`);
}

/** Le cartelle di corsa presenti adesso sotto la radice delle corse, in ordine. */
function cartelleCorse() {
  try {
    return readdirSync(CORSE, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Se `gh` risponde: senza, le corse degradano al ramo leggero senza metriche pubbliche. */
function ghRisponde() {
  const res = spawnSync('gh', ['--version'], { encoding: 'utf-8', timeout: 20000, shell: process.platform === 'win32' });
  return !res.error && res.status === 0;
}

// --- gli argomenti ----------------------------------------------------------------------

const VERBI = ['prepara', 'lancia', 'applica'];

/** `{verbo, lista, target, flag, opzioni}` dagli argomenti; `muori(2)` su qualunque forma ignota. */
function argomentiDaRiga(argv) {
  const verbo = argv[0];
  if (!VERBI.includes(verbo)) uso();
  const flag = {};
  const target = [];
  const opzioni = {};
  const valore = (i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) muori(2, `${argv[i]} vuole un valore`);
    return v;
  };
  let lista = null;
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lista') lista = valore(i), i += 1;
    else if (a === '--parallelo') opzioni.parallelo = valore(i), i += 1;
    else if (a === '--budget') opzioni.budget = valore(i), i += 1;
    else if (a === '--modello') opzioni.modello = valore(i), i += 1;
    else if (a === '--tempo') opzioni.tempo = valore(i), i += 1;
    else if (a === '--lotto') opzioni.lotto = valore(i), i += 1;
    else if (a === '--assi') flag.assi = valore(i), i += 1;
    else if (a === '--versione') flag.versione = valore(i), i += 1;
    else if (a === '--focus') flag.focus = valore(i), i += 1;
    else if (a === '--cwd') flag.cwd = valore(i), i += 1;
    else if (a === '--deep') flag.deep = true;
    else if (a === '--shallow-only') flag.shallowOnly = true;
    else if (a === '--dry-run') opzioni.dryRun = true;
    else if (a.startsWith('--')) muori(2, `opzione ignota: ${a}`);
    else target.push(a);
  }
  if (flag.deep && flag.shallowOnly) muori(2, '--deep e --shallow-only si escludono');
  const parallelo = opzioni.parallelo === undefined ? 3 : Number(opzioni.parallelo);
  if (!Number.isInteger(parallelo) || parallelo < 1 || parallelo > 8) muori(2, `--parallelo vuole un intero fra 1 e 8, non ${opzioni.parallelo}`);
  opzioni.parallelo = parallelo;
  const tempo = opzioni.tempo === undefined ? 180 : Number(opzioni.tempo);
  if (!Number.isFinite(tempo) || tempo <= 0) muori(2, `--tempo vuole i minuti, non ${opzioni.tempo}`);
  opzioni.tempo = tempo;
  if (opzioni.budget !== undefined && !Number.isFinite(Number(opzioni.budget))) muori(2, `--budget vuole un numero, non ${opzioni.budget}`);
  if (flag.focus) {
    const vietato = carattereVietato(flag.focus);
    if (vietato) muori(2, `--focus non può contenere ${JSON.stringify(vietato)}: la riga di comando di Windows non lo porta`);
  }
  return { verbo, lista, target, flag, opzioni };
}

/** I target del lotto: il file di elenco se c'è, più quelli scritti a mano, senza doppioni. */
function targetDelLotto({ lista, target }) {
  const righe = [];
  if (lista) {
    const testo = leggiFile(resolve(lista));
    if (testo === null) muori(2, `elenco non leggibile: ${lista}`);
    righe.push(...leggiLista(testo));
  }
  righe.push(...leggiLista(target.join('\n'), false));
  if (!righe.length) muori(2, 'nessun target: --lista <file> oppure i target sulla riga');
  return righe;
}

// --- prepara ----------------------------------------------------------------------------

function prepara() {
  const parsed = argomentiDaRiga(process.argv.slice(2));
  verificaRadice();
  const target = targetDelLotto(parsed);
  const presenti = cartelleCorse();

  process.stdout.write(`target: ${target.length}\n`);
  process.stdout.write(`parallelo: ${parsed.opzioni.parallelo}${parsed.opzioni.budget ? `, budget per corsa: $${parsed.opzioni.budget}` : ''}\n`);
  process.stdout.write(`gh: ${ghRisponde() ? 'risponde' : 'NON risponde — le corse perdono le metriche pubbliche e lo dichiarano'}\n`);
  process.stdout.write(`cartelle di corsa già presenti: ${presenti.length}${presenti.length ? ` (${presenti.join(', ')})` : ''}\n\n`);
  for (const t of target) process.stdout.write(`${t}\n  ${rigaComando(t, parsed.flag, parsed.opzioni)}\n`);
}

// --- lancia ----------------------------------------------------------------------------

/** Lancia una corsa e torna una promessa col suo esito. Il log porta stdout e stderr insieme. */
function lanciaCorsa(target, indice, cartellaLotto, parsed) {
  const nome = `${String(indice + 1).padStart(2, '0')} — ${target.replace(/[^A-Za-z0-9._-]+/g, '-')}`.slice(0, 80);
  const log = join(cartellaLotto, `${nome}.log`);
  const fd = openSync(log, 'w');
  const riga = rigaComando(target, parsed.flag, parsed.opzioni);
  writeFileSync(fd, `$ ${riga}\n\n`);
  const figlio = spawn(riga, { cwd: DEV, shell: true, stdio: ['ignore', fd, fd], windowsHide: true });
  const inizio = Date.now();
  return new Promise((risolvi) => {
    let scaduto = false;
    let chiuso = false;
    const scadenza = setTimeout(() => {
      scaduto = true;
      try { figlio.kill(); } catch { /* già morto */ }
    }, parsed.opzioni.tempo * 60000);
    const chiudi = (uscita, motivo) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(scadenza);
      closeSync(fd);
      risolvi({ target, log, uscita, motivo, minuti: ((Date.now() - inizio) / 60000).toFixed(1) });
    };
    figlio.on('error', (e) => chiudi(null, `non partito: ${e.message}`));
    figlio.on('close', (codice) => chiudi(codice, scaduto ? `uccisa: tempo scaduto dopo ${parsed.opzioni.tempo} minuti` : null));
  });
}

async function lancia() {
  const parsed = argomentiDaRiga(process.argv.slice(2));
  verificaRadice();
  const target = targetDelLotto(parsed);
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const cartellaLotto = join(LOTTI, id);
  mkdirSync(cartellaLotto, { recursive: true });
  const prima = cartelleCorse();

  process.stdout.write(`lotto ${id}: ${target.length} corse, ${parsed.opzioni.parallelo} insieme\n`);
  const esiti = [];
  let prossimo = 0;
  async function lavoratore() {
    while (prossimo < target.length) {
      const indice = prossimo;
      prossimo += 1;
      const esito = await lanciaCorsa(target[indice], indice, cartellaLotto, parsed);
      esiti.push(esito);
      process.stdout.write(`  ${esito.uscita === 0 ? 'ok  ' : 'KO  '} ${esito.target} (${esito.minuti} min) — ${esito.log}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parsed.opzioni.parallelo, target.length) }, lavoratore));

  const dopo = cartelleCorse();
  const nuove = dopo.filter((c) => !prima.includes(c));
  const stato = {
    id, inizio: new Date().toISOString(), target, flag: parsed.flag, opzioni: { budget: parsed.opzioni.budget, modello: parsed.opzioni.modello },
    cartelle_prima: prima, cartelle_nuove: nuove, esiti,
  };
  writeFileSync(join(cartellaLotto, 'lotto.json'), JSON.stringify(stato, null, 2) + '\n');

  const fallite = esiti.filter((e) => e.uscita !== 0);
  process.stdout.write(`lotto ${id}: ${target.length - fallite.length}/${target.length} corse uscite 0, ${nuove.length} cartelle nuove: ${nuove.join(', ') || '(nessuna)'}\n`);
  process.stdout.write(`${JSON.stringify({ id, corse: esiti.length, fallite: fallite.map((f) => f.target), cartelle_nuove: nuove })}\n`);
  process.exit(fallite.length ? 1 : 0);
}

// --- applica ---------------------------------------------------------------------------

/** Il lotto da chiudere: quello di `--lotto`, o l'ultimo scritto. */
function statoDelLotto(id) {
  let cartella = id ? join(LOTTI, id) : null;
  if (!cartella) {
    let ultimo = null;
    let quando = 0;
    for (const nome of (existsSync(LOTTI) ? readdirSync(LOTTI) : [])) {
      const file = join(LOTTI, nome, 'lotto.json');
      try {
        const t = statSync(file).mtimeMs;
        if (t > quando) { quando = t; ultimo = nome; }
      } catch { /* nessuno stato lì */ }
    }
    if (!ultimo) muori(1, `nessun lotto in ${LOTTI}: lancia prima con "lancia"`);
    cartella = join(LOTTI, ultimo);
  }
  const testo = leggiFile(join(cartella, 'lotto.json'));
  if (testo === null) muori(1, `stato del lotto non leggibile in ${cartella}`);
  const stato = JSON.parse(testo);
  stato.cartella = cartella;
  return stato;
}

/** I file che una corsa scrive: se uno solo è stato toccato dopo l'inizio del lotto, la corsa è
 *  del lotto — anche se la sua cartella esisteva già. */
const FILE_DI_CORSA = ['run.json', '0. study.md', '1. daiku-comparison.md', '2. evidence-ledger.md'];

function toccataDopo(cartella, quando) {
  return FILE_DI_CORSA.some((f) => {
    try { return statSync(join(cartella, f)).mtimeMs > quando; } catch { return false; }
  });
}

/** Le corse di un lotto: quelle nate durante il lotto **e quelle che il lotto ha riscritto**. Un
 *  secondo studio sullo stesso target non crea una cartella nuova — riusa quella di prima, come
 *  dice il Passo 11 del contratto — e una lista delle sole cartelle nuove lo perderebbe. */
function cartelleDelLotto(stato) {
  const inizio = Date.parse(stato.inizio || '') || 0;
  const fuori = new Set(stato.cartelle_nuove || []);
  if (inizio) for (const nome of cartelleCorse()) if (!fuori.has(nome) && toccataDopo(join(CORSE, nome), inizio)) fuori.add(nome);
  return [...fuori].sort();
}

/** Le feature che le corse del lotto hanno toccato: `run.json.contributi`, una voce per corsa. I
 *  contributi li scrivono le corse, ognuna col proprio nome — il lotto li elenca, non li fonde. */
function catalogoDelleCorse(corse) {
  const catalogo = {};
  for (const nome of corse) {
    const testo = leggiFile(join(CORSE, nome, 'run.json'));
    if (testo === null) continue;
    let json;
    try {
      json = JSON.parse(testo);
    } catch {
      continue;
    }
    for (const voce of (Array.isArray(json.contributi) ? json.contributi : [])) {
      if (!voce || typeof voce.feature !== 'string') continue;
      catalogo[voce.feature] = [...(catalogo[voce.feature] || []), nome];
    }
  }
  return catalogo;
}

/** Il gate di chiusura di una corsa, come lo lancia il Passo 12 del contratto. */
function gateDellaCorsa(nome) {
  const cartella = join(CORSE, nome);
  const res = spawnSync(process.execPath, [CHECK_RUN, cartella, RADICE_ARG], { encoding: 'utf-8', timeout: 120000 });
  if (res.error || !res.stdout) return { corsa: nome, gate: 'non_partito', failed: [`${res.error?.message || 'uscita senza JSON'}`] };
  try {
    const report = JSON.parse(res.stdout);
    return { corsa: nome, gate: report.failed.length ? 'rosso' : 'verde', checks: report.checks, failed: report.failed };
  } catch {
    return { corsa: nome, gate: 'illeggibile', failed: [res.stdout.slice(0, 200)] };
  }
}

/** Le voci `allinea` di una corsa, con la corsa a cui appartengono. */
function allineamentiDellaCorsa(nome) {
  const testo = leggiFile(join(CORSE, nome, 'run.json'));
  if (testo === null) return [];
  let json;
  try {
    json = JSON.parse(testo);
  } catch {
    return [];
  }
  if (!Array.isArray(json.allineamenti)) return [];
  return json.allineamenti
    .filter((v) => v && typeof v.voce === 'string')
    .map((v) => ({ corsa: nome, voce: v.voce, path: v.path, prima: v.prima, dopo: v.dopo }));
}

/** Il testo con le sostituzioni applicate, dalla più alta alla più bassa per posizione: uno scarto
 *  sposta quello che sta dopo, e andando a ritroso le posizioni calcolate sul testo originale
 *  restano valide. Pura, così il banco la prova sull'ordine invece che sul file. */
function applicaSostituzioni(testo, voci) {
  let dopo = testo;
  for (const v of [...voci].sort((x, y) => y.da - x.da)) {
    dopo = dopo.slice(0, v.da) + v.dopo + dopo.slice(v.a);
  }
  return dopo;
}

/** Scrive le sostituzioni di un file e lo rilegge. Torna `true` se il file è stato riscritto. */
function applicaSuFile(path, voci) {
  const assoluto = join(DEV, path);
  const prima = readFileSync(assoluto, 'utf-8');
  const dopo = applicaSostituzioni(prima, voci);
  if (dopo === prima) return false;
  writeFileSync(assoluto, dopo);
  const riletto = readFileSync(assoluto, 'utf-8');
  for (const v of voci) {
    if (!riletto.includes(v.dopo)) muori(1, `${path}: la sostituzione di ${v.identificatore} non si legge dopo la scrittura`);
  }
  return true;
}

function applica() {
  const parsed = argomentiDaRiga(process.argv.slice(2));
  verificaRadice();
  const stato = statoDelLotto(parsed.opzioni.lotto);
  const corse = cartelleDelLotto(stato);
  process.stdout.write(`lotto ${stato.id}: ${corse.length} corse\n`);

  const gates = corse.map(gateDellaCorsa);
  for (const g of gates) process.stdout.write(`  ${g.gate === 'verde' ? 'ok  ' : 'KO  '} ${g.corsa} — gate ${g.gate}${g.checks ? ` (${g.checks} controlli)` : ''}\n`);
  const catalogo = catalogoDelleCorse(corse);
  for (const [feature, daCorse] of Object.entries(catalogo)) process.stdout.write(`  catalogo: .docs/features/${feature}/ ← ${daCorse.join(', ')}\n`);

  const rossi = gates.filter((g) => g.gate !== 'verde');
  if (rossi.length) {
    for (const g of rossi) for (const f of g.failed) process.stdout.write(`      ${f}\n`);
    process.stdout.write(`${JSON.stringify({ applicate: 0, gates: gates.map((g) => ({ corsa: g.corsa, gate: g.gate })), catalogo, rosso: 'una corsa rossa non si applica: il suo censimento non è affidabile' })}\n`);
    process.exit(1);
  }

  const raccolte = corse.flatMap(allineamentiDellaCorsa);
  const { applicabili, doppioni, conflitti, rifiutati } = classifica(raccolte, (p) => leggiFile(join(DEV, p)));

  if (doppioni.length) process.stdout.write(`doppioni (stessa proposta da più corse): ${doppioni.map((d) => d.identificatore).join(', ')}\n`);
  for (const r of rifiutati) process.stdout.write(`rifiutata ${r.identificatore}: ${r.motivo}\n`);
  for (const [x, y] of conflitti) {
    process.stdout.write(`conflitto su ${x.path}: ${x.identificatore} e ${y.identificatore} si sovrappongono — decide l'owner\n`);
    process.stdout.write(`  ${x.identificatore}: «${x.prima}» -> «${x.dopo}»\n  ${y.identificatore}: «${y.prima}» -> «${y.dopo}»\n`);
  }

  const perFile = new Map();
  for (const v of applicabili) {
    if (!perFile.has(v.path)) perFile.set(v.path, []);
    perFile.get(v.path).push(v);
  }

  if (parsed.opzioni.dryRun) {
    for (const [path, voci] of perFile) for (const v of voci) process.stdout.write(`dry-run: ${path} — ${v.identificatore}: «${v.prima}» -> «${v.dopo}»\n`);
    process.stdout.write(`${JSON.stringify({ applicate: 0, applicabili: applicabili.length, doppioni: doppioni.length, conflitti: conflitti.length, rifiutate: rifiutati.length, dryRun: true })}\n`);
    process.exit(0);
  }

  // Niente da applicare: le verifiche non girano. Un pacchetto che non è stato toccato non si
  // ricontrolla, e un rosso che non c'entra col lotto insegna a non fidarsi di questo esito.
  if (!applicabili.length) {
    process.stdout.write(`${JSON.stringify({ applicate: 0, applicabili: 0, doppioni: doppioni.length, conflitti: conflitti.length, rifiutate: rifiutati.length, catalogo })}\n`);
    process.exit(0);
  }

  let applicate = 0;
  for (const [path, voci] of perFile) {
    if (applicaSuFile(path, voci)) applicate += voci.length;
    process.stdout.write(`scritto ${path}: ${voci.length} sostituzion${voci.length === 1 ? 'e' : 'i'}\n`);
  }

  const esiti = verifiche().map(([nome, riga]) => {
    const res = spawnSync(riga, { cwd: DEV, encoding: 'utf-8', shell: true, timeout: 600000 });
    const uscita = res.error ? null : res.status;
    return { nome, uscita };
  });
  for (const e of esiti) process.stdout.write(`  ${e.uscita === 0 ? 'ok  ' : 'KO  '} ${e.nome}${e.uscita === 0 ? '' : ` (uscita ${e.uscita})`}\n`);
  const rosse = esiti.filter((e) => e.uscita !== 0);
  process.stdout.write(`${JSON.stringify({ applicate, file: [...perFile.keys()], conflitti: conflitti.length, rifiutate: rifiutati.length, verifiche_rosse: rosse.map((e) => e.nome), catalogo })}\n`);
  process.exit(rosse.length ? 1 : 0);
}

// --- il banco delle funzioni pure --------------------------------------------------------

function selfCheck() {
  const casi = [];
  const ok = (nome, cond) => casi.push([nome, !!cond]);
  const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ok('lista: commenti, vuoti e doppioni', uguale(
    leggiLista('# nota\nzod\n\n  zod  \nrequests # inline\n'),
    ['zod', 'requests']
  ));
  ok('lista: una riga sola', uguale(leggiLista('owner/repo'), ['owner/repo']));
  ok('lista: vuota resta vuota', uguale(leggiLista('\n\n# solo commenti\n'), []));
  ok('vietati: virgolette rifiutate', carattereVietato('la domanda "x"') === '"');
  ok('vietati: percento rifiutato', carattereVietato('100%') === '%');
  ok('vietati: testo normale ammesso', carattereVietato('come funziona l orchestratore') === null);
  ok('sovrapposizione: dentro', siSovrappongono({ da: 0, a: 10 }, { da: 5, a: 15 }));
  ok('sovrapposizione: adiacenti no', !siSovrappongono({ da: 0, a: 10 }, { da: 10, a: 20 }));
  ok('sovrapposizione: lontani no', !siSovrappongono({ da: 0, a: 10 }, { da: 30, a: 40 }));

  const file = { 'plugins/daiku/a.md': 'uno due uno', 'plugins/daiku/b.md': 'x' };
  const leggi = (p) => (p in file ? file[p] : null);
  const voce = (extra) => ({ corsa: 'c1', voce: 'RI-001', path: 'plugins/daiku/a.md', prima: 'due', dopo: 'tre', ...extra });

  ok('classifica: applicabile', uguale(classifica([voce({})], leggi).applicabili.length, 1));
  ok('classifica: prima assente', classifica([voce({ prima: 'zero' })], leggi).rifiutati[0].motivo.includes('non compare'));
  ok('classifica: prima non unica', classifica([voce({ prima: 'uno' })], leggi).rifiutati[0].motivo.includes('più di una volta'));
  ok('classifica: fuori dal prodotto', classifica([voce({ path: 'CLAUDE.md' })], leggi).rifiutati[0].motivo.includes('fuori dal prodotto'));
  ok('classifica: prima uguale a dopo', classifica([voce({ dopo: 'due' })], leggi).rifiutati[0].motivo.includes('identici'));
  ok('classifica: doppione', uguale(classifica([voce({}), voce({ corsa: 'c2' })], leggi).doppioni.length, 1));
  ok('classifica: l identificatore porta la corsa', classifica([voce({})], leggi).applicabili[0].identificatore === 'c1#RI-001');

  const spezzato = { 'plugins/daiku/a.md': 'alfa beta gamma' };
  const leggiSpezzato = (p) => spezzato[p] ?? null;
  const sovrapposte = classifica([
    { corsa: 'c1', voce: 'RI-001', path: 'plugins/daiku/a.md', prima: 'alfa beta', dopo: 'ALFA' },
    { corsa: 'c2', voce: 'RI-002', path: 'plugins/daiku/a.md', prima: 'beta gamma', dopo: 'GAMMA' },
  ], leggiSpezzato);
  ok('classifica: intervalli sovrapposti sono un conflitto', uguale(sovrapposte.conflitti.length, 1));
  ok('classifica: le voci in conflitto non si applicano', uguale(sovrapposte.applicabili.length, 0));

  const distinte = classifica([
    { corsa: 'c1', voce: 'RI-001', path: 'plugins/daiku/a.md', prima: 'alfa', dopo: 'ALFA' },
    { corsa: 'c2', voce: 'RI-002', path: 'plugins/daiku/a.md', prima: 'gamma', dopo: 'GAMMA' },
  ], leggiSpezzato);
  ok('classifica: intervalli distinti si applicano entrambi', uguale(distinte.applicabili.length, 2));
  ok('classifica: due file diversi non confliggono', uguale(
    classifica([
      { corsa: 'c1', voce: 'RI-001', path: 'plugins/daiku/a.md', prima: 'alfa', dopo: 'ALFA' },
      { corsa: 'c2', voce: 'RI-002', path: 'plugins/daiku/b.md', prima: 'x', dopo: 'y' },
    ], (p) => ({ 'plugins/daiku/a.md': 'alfa', 'plugins/daiku/b.md': 'x' }[p] ?? null)).conflitti.length,
    0
  ));

  // Lo scarto: due sostituzioni sullo stesso testo, applicate a ritroso perché la seconda non
  // sposti la prima. È l'unico punto in cui applicare due voci insieme può sbagliare in silenzio.
  ok('scarto: due sostituzioni in ordine', applicaSostituzioni('alfa beta gamma', [
    { da: 0, a: 4, dopo: 'ALFA' }, { da: 10, a: 15, dopo: 'GAMMA' },
  ]) === 'ALFA beta GAMMA');
  ok('scarto: la prima non sposta la seconda', applicaSostituzioni('aaa bbb', [
    { da: 0, a: 3, dopo: 'x' }, { da: 4, a: 7, dopo: 'y' },
  ]) === 'x y');
  ok('scarto: nessuna voce lascia il testo com e', applicaSostituzioni('testo', []) === 'testo');

  const riga = rigaComando('owner/repo', { assi: 'capacita', focus: 'come orchestra' }, { parallelo: 1 });
  ok('riga: comando slash in testa', riga.startsWith('claude -p "/studia-repository owner/repo --assi capacita --focus come orchestra"'));
  ok('riga: bypass e nessuna sessione', riga.includes('--permission-mode bypassPermissions') && riga.includes('--no-session-persistence'));
  ok('riga: la nota di lotto viaggia nel system prompt', riga.includes('--append-system-prompt'));
  ok('riga: --shallow-only in fondo', rigaComando('x', { shallowOnly: true }, {}).includes('--shallow-only'));
  ok('riga: modello e budget solo se chiesti', !rigaComando('x', {}, {}).includes('--model') && rigaComando('x', {}, { modello: 'opus', budget: '5' }).includes('--max-budget-usd 5'));

  const rossi = casi.filter(([, passed]) => !passed);
  for (const [nome] of rossi) process.stderr.write(`red: ${nome}\n`);
  process.stdout.write(JSON.stringify({ checks: casi.length, passed: casi.length - rossi.length, failed: rossi.map(([n]) => n) }) + '\n');
  process.exit(rossi.length ? 1 : 0);
}

// --- ingresso ------------------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes('--self-check')) selfCheck();
if (!argv.length) uso();
if (argv[0] === 'prepara') prepara();
else if (argv[0] === 'lancia') await lancia();
else if (argv[0] === 'applica') applica();
else uso();
