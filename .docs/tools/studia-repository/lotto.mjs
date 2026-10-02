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
 *   node .docs/tools/studia-repository/lotto.mjs sintesi  [--lotto <id>] [--feature <slug>] [--verifica]
 *   node .docs/tools/studia-repository/lotto.mjs --self-check
 *
 * `prepara` non scrive niente: valida l'elenco, controlla la radice del pacchetto, guarda se `gh`
 * risponde e stampa il piano — i target e la riga di comando esatta che `lancia` eseguirebbe.
 * `lancia` esegue quel piano: una **sessione headless di Claude Code per target**, fino a
 * `--parallelo` insieme, ognuna con il proprio log in `%TEMP%/daiku-lotto/<id>/`, e aspetta che
 * finiscano tutte. `applica` chiude il lotto: passa il gate di ogni corsa nata dal lotto, raccoglie
 * le voci `allinea` dalle corse, applica quelle che si sostituiscono senza toccarsi, riporta le
 * altre all'owner ed **elenca il catalogo** — quali feature hanno ricevuto un contributo, da quali
 * corse. Non committa mai niente: quello resta dell'owner. `sintesi` riapre il lotto chiuso e
 * prepara il confronto: per ogni feature che ha ricevuto un contributo stampa i contributi delle
 * corse del lotto, gli altri file già nella cartella e la forma esatta della sintesi da scrivere in
 * `.daiku/studies/<feature>.md` — la sede degli appunti, una per feature. Con `--verifica` controlla
 * invece la sintesi già scritta: campi, sezioni, e che il blocco finale sia un prompt per
 * `/daiku:new-feature` che nomina la cartella della feature.
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
/** Le due sedi di una sintesi: il catalogo dove le corse depositano i contributi, e la sede degli
 *  appunti — `.daiku/studies/`, un file per feature, quella che `daiku:research` usa per una
 *  tecnologia. La sintesi di un lotto è un appunto della stessa specie: un documento per feature,
 *  che ogni lotto riscrive. */
const CATALOGO = join(DEV, '.daiku', 'features');
const APPUNTI = join(DEV, '.daiku', 'studies');

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
    + '     lotto.mjs sintesi [--lotto <id>] [--feature <slug>] [--verifica]\n'
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

// --- la sintesi: il confronto fra i contributi, e la forma che deve avere ------------------

/** Le sezioni di una sintesi, nell'ordine in cui devono comparire. Le cinque di un contributo non
 *  bastano: un contributo descrive **un** target, una sintesi **sceglie** — e le sue sezioni dicono
 *  cosa portano i target, quale approccio vince, quale feature se ne propone e cosa resta all'owner. */
const SEZIONI_SINTESI = [
  'Cosa portano i target',
  'Quale approccio vince, e perché',
  'La feature proposta',
  'Cosa resta aperto',
  'Prompt per new-feature',
];

/** Gli esiti ammessi per una sintesi: le azioni del censimento, meno `allinea` — che ripara il
 *  nostro corpus e non propone niente da costruire. */
const ESITI_SINTESI = ['adotta', 'adatta', 'ispira', 'scarta', 'confirm_with_owner'];

/** Il campo del prompt: il comando che l'owner incolla, e la cartella che deve nominare perché una
 *  corsa di `new-feature` lavori dentro i contributi invece di aprirne una nuova. */
const COMANDO_NEW_FEATURE = '/daiku:new-feature';

/** Il titolo di un markdown: la prima riga che comincia per `# `. */
function titolo(testo) {
  for (const riga of String(testo || '').split(/\r?\n/)) {
    const m = riga.match(/^#\s+(\S.*)$/);
    if (m) return m[1].trim();
  }
  return '';
}

/** I titoli di sezione, in ordine: `## ` e non `### `. */
function sezioniTitoli(testo) {
  const fuori = [];
  for (const riga of String(testo || '').split(/\r?\n/)) {
    const m = riga.match(/^##\s+(\S.*)$/);
    if (m) fuori.push(m[1].trim());
  }
  return fuori;
}

/** Il corpo di una sezione: quel che sta fra il suo titolo e il titolo successivo. `null` se la
 *  sezione non c'è. */
function corpoSezione(testo, titoloSezione) {
  const righe = String(testo || '').split(/\r?\n/);
  let dentro = false;
  const corpo = [];
  for (const riga of righe) {
    const m = riga.match(/^##\s+(\S.*)$/);
    if (m) {
      if (dentro) break;
      dentro = m[1].trim() === titoloSezione;
      continue;
    }
    if (dentro) corpo.push(riga);
  }
  return dentro || corpo.length ? corpo.join('\n').trim() : null;
}

/** Il valore di un campo `- **Nome:** valore`, o `null`. */
function campo(testo, nome) {
  for (const riga of String(testo || '').split(/\r?\n/)) {
    const m = riga.match(/^-\s+\*\*(.+?):\*\*\s*(.*)$/);
    if (m && m[1].trim() === nome) return m[2].trim();
  }
  return null;
}

/** Il primo blocco recintato di un testo, senza i recinti: il prompt dentro la sua sezione. */
function bloccoRecintato(testo) {
  const righe = String(testo || '').split(/\r?\n/);
  let dentro = null;
  for (const riga of righe) {
    if (dentro === null) {
      if (/^\s*```/.test(riga)) dentro = [];
      continue;
    }
    if (/^\s*```\s*$/.test(riga)) return dentro.join('\n').trim();
    dentro.push(riga);
  }
  return null;
}

/** I segnaposto che la sintesi non deve lasciare in piedi: `<qualcosa>`. È la stessa regola con cui
 *  `init` caccia i residui dei suoi scheletri — uno scheletro copiato e non riempito si legge come
 *  una sintesi, e nessuno se ne accorge. */
function segnaposto(testo) {
  return (String(testo || '').match(/<[^>\n]*>/g) || []);
}

/**
 * I rossi di una sintesi, `[]` se è a posto. Pura: prende il testo e quello che deve dire.
 *
 * `atteso` porta `{feature, lotto, corse}` — il nome della cartella, l'id del lotto che l'ha scritta
 * e le corse che le hanno dato un contributo. Il confronto coi tre campi è ciò che tiene la sintesi
 * agganciata alla sua feature: una sintesi che non nomina le corse da cui viene è un documento
 * orfano, e nessuno può risalire ai contributi che ha confrontato.
 */
function verificaSintesi(testo, atteso) {
  const fuori = [];
  if (testo === null || testo === undefined) return ['la sintesi non esiste'];
  const dove = (motivo) => `${atteso.feature}: ${motivo}`;

  if (!titolo(testo)) fuori.push(dove('manca il titolo `# …`'));
  const resti = segnaposto(testo);
  if (resti.length) fuori.push(dove(`segnaposto non riempiti: ${resti.slice(0, 3).join(' ')}`));

  const feature = campo(testo, 'Feature');
  const lotto = campo(testo, 'Lotto');
  const corse = campo(testo, 'Corse');
  const esito = campo(testo, 'Esito');
  if (feature !== atteso.feature) fuori.push(dove(`Feature = ${JSON.stringify(feature)}, atteso ${JSON.stringify(atteso.feature)}`));
  if (lotto !== atteso.lotto) fuori.push(dove(`Lotto = ${JSON.stringify(lotto)}, atteso ${JSON.stringify(atteso.lotto)}`));
  if (!corse) fuori.push(dove('Corse vuoto'));
  else {
    const mancanti = atteso.corse.filter((c) => !corse.includes(c));
    if (mancanti.length) fuori.push(dove(`Corse non nomina ${mancanti.join(', ')}`));
  }
  if (!ESITI_SINTESI.includes(esito)) fuori.push(dove(`Esito = ${JSON.stringify(esito)}, atteso uno di ${ESITI_SINTESI.join(', ')}`));

  const trovate = sezioniTitoli(testo);
  if (JSON.stringify(trovate) !== JSON.stringify(SEZIONI_SINTESI)) {
    fuori.push(dove(`sezioni = ${JSON.stringify(trovate)}, attese ${JSON.stringify(SEZIONI_SINTESI)}`));
  }

  for (const sezione of SEZIONI_SINTESI) {
    if (!corpoSezione(testo, sezione)) fuori.push(dove(`la sezione "${sezione}" è vuota`));
  }

  // Il prompt si pretende solo da una sintesi che propone qualcosa: un `scarta` non ha niente da
  // far costruire, e la sua ultima sezione dice perché.
  if (esito !== 'scarta') {
    const prompt = bloccoRecintato(corpoSezione(testo, 'Prompt per new-feature') || '');
    if (!prompt) fuori.push(dove('il prompt non è in un blocco recintato'));
    else {
      if (!prompt.startsWith(COMANDO_NEW_FEATURE)) fuori.push(dove(`il prompt non comincia per ${COMANDO_NEW_FEATURE}`));
      const cartella = `.daiku/features/${atteso.feature}/`;
      if (!prompt.includes(cartella)) fuori.push(dove(`il prompt non nomina ${cartella}`));
    }
  }
  return fuori;
}

/** Lo scheletro della sintesi, con i tre campi già compilati: è quello che `sintesi` stampa e che
 *  chi chiude il lotto riempie. I segnaposto sono voluti — `verificaSintesi` li rifiuta finché
 *  restano. */
function scheletroSintesi(feature, lotto, corse) {
  return [
    '# <titolo della feature> — sintesi',
    '',
    `- **Feature:** ${feature}`,
    `- **Lotto:** ${lotto}`,
    `- **Corse:** ${corse.join(', ')}`,
    `- **Esito:** ${ESITI_SINTESI.join(' | ')}`,
    '',
    '## Cosa portano i target',
    '',
    '<una voce per repo: `owner/repo` — il suo approccio in due righe>',
    '',
    '## Quale approccio vince, e perché',
    '',
    "<il confronto: chi fa meglio cosa, con quale criterio, e cosa si prende da chi — o \"nessuno vince\" col perché>",
    '',
    '## La feature proposta',
    '',
    '<una sola: cosa fa, dove atterra in Daiku, cosa tocca, a che costo>',
    '',
    '## Cosa resta aperto',
    '',
    '<le decisioni che toccano all owner — "Nessuna" è una risposta>',
    '',
    '## Prompt per new-feature',
    '',
    '```text',
    `${COMANDO_NEW_FEATURE} <descrizione in una riga, col problema per primo>`,
    '',
    `Lavora in .daiku/features/${feature}/: la cartella esiste già e contiene i contributi dello studio. Prosegui dentro quella.`,
    '```',
    '',
  ].join('\n');
}

/**
 * Il materiale di una sintesi: per ogni feature toccata dalle corse del lotto, i contributi che
 * quelle corse hanno depositato e gli altri file già nella cartella — contributi di lotti
 * precedenti, o una sintesi scritta prima. Pura: `leggi(path)` torna il testo o `null`,
 * `elenca(cartella)` i nomi dei file o `[]`.
 *
 * Gli altri file si nominano e non si stampano: sono fuori dal lotto, e leggerli per intero
 * gonfierebbe l'uscita di roba che il confronto non ha chiesto. Chi chiude il lotto li apre se la
 * sua feature li tocca.
 */
function materialeDelleFeature(contributi, { leggi, elenca }) {
  const perFeature = new Map();
  for (const { corsa, feature } of contributi) {
    if (!perFeature.has(feature)) perFeature.set(feature, { feature, delLotto: [], altre: [] });
    const path = `.daiku/features/${feature}/${corsa}.md`;
    perFeature.get(feature).delLotto.push({ corsa, path, testo: leggi(path) });
  }
  for (const voce of perFeature.values()) {
    for (const nome of elenca(`.daiku/features/${voce.feature}`)) {
      const path = `.daiku/features/${voce.feature}/${nome}`;
      if (voce.delLotto.some((c) => c.path === path)) continue;
      voce.altre.push({ path, titolo: titolo(leggi(path) || '') });
    }
  }
  return [...perFeature.values()].sort((a, b) => a.feature.localeCompare(b.feature));
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

/** I nomi dei file di una cartella, in ordine; `[]` se non c'è. */
function elencaFile(cartella) {
  try {
    return readdirSync(cartella, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
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

const VERBI = ['prepara', 'lancia', 'applica', 'sintesi'];

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
    else if (a === '--feature') opzioni.feature = valore(i), i += 1;
    else if (a === '--verifica') opzioni.verifica = true;
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

/** I contributi delle corse del lotto: `run.json.contributi`, una voce per corsa, nella forma
 *  `{corsa, feature}`. Li scrivono le corse, ognuna col proprio nome. */
function contributiDelleCorse(corse) {
  const fuori = [];
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
      fuori.push({ corsa: nome, feature: voce.feature });
    }
  }
  return fuori;
}

/** Le feature che le corse del lotto hanno toccato, con le corse che hanno contribuito a ciascuna.
 *  Il lotto le elenca, non le fonde. */
function catalogoDelleCorse(corse) {
  const catalogo = {};
  for (const { corsa, feature } of contributiDelleCorse(corse)) {
    catalogo[feature] = [...(catalogo[feature] || []), corsa];
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
  for (const [feature, daCorse] of Object.entries(catalogo)) process.stdout.write(`  catalogo: .daiku/features/${feature}/ ← ${daCorse.join(', ')}\n`);

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

// --- sintesi ------------------------------------------------------------------------------

/** Il materiale del lotto, letto dal disco: i contributi delle sue corse e gli altri file del
 *  catalogo. Il verso lo decide `--feature`; senza, tutte le feature che il lotto ha toccato. */
function materialeDelLotto(stato, voluta) {
  const corse = cartelleDelLotto(stato);
  const tutte = materialeDelleFeature(contributiDelleCorse(corse), {
    leggi: (p) => leggiFile(join(DEV, p)),
    elenca: (d) => elencaFile(join(DEV, d)),
  });
  return { corse, tutte, materiale: voluta ? tutte.filter((m) => m.feature === voluta) : tutte };
}

/** La verifica di una sintesi già scritta: i rossi di `verificaSintesi`, uno per feature. */
function verificaMateriale(stato, materiale) {
  const esiti = materiale.map((voce) => {
    const path = `.daiku/studies/${voce.feature}.md`;
    const failed = verificaSintesi(leggiFile(join(DEV, path)), {
      feature: voce.feature,
      lotto: stato.id,
      corse: voce.delLotto.map((c) => c.corsa),
    });
    return { feature: voce.feature, path, failed };
  });
  for (const e of esiti) {
    process.stdout.write(`  ${e.failed.length ? 'KO  ' : 'ok  '} ${e.feature} — ${e.path}\n`);
    for (const f of e.failed) process.stdout.write(`      ${f}\n`);
  }
  const rossi = esiti.filter((e) => e.failed.length);
  process.stdout.write(`${JSON.stringify({ lotto: stato.id, verificate: esiti.length, rosse: rossi.map((e) => e.feature) })}\n`);
  process.exit(rossi.length ? 1 : 0);
}

function sintesi() {
  const parsed = argomentiDaRiga(process.argv.slice(2));
  verificaRadice();
  const stato = statoDelLotto(parsed.opzioni.lotto);
  const { corse, tutte, materiale } = materialeDelLotto(stato, parsed.opzioni.feature);
  process.stdout.write(`lotto ${stato.id}: ${corse.length} corse, ${tutte.length} feature con un contributo\n`);

  const voluta = parsed.opzioni.feature;
  if (!materiale.length) {
    const motivo = voluta
      ? `${voluta} non ha ricevuto contributi in questo lotto`
      : 'il lotto non ha depositato contributi: niente da sintetizzare';
    process.stdout.write(`${motivo}\n`);
    process.stdout.write(`${JSON.stringify({ lotto: stato.id, feature: [], failed: voluta ? [motivo] : [] })}\n`);
    process.exit(voluta ? 1 : 0);
  }

  if (parsed.opzioni.verifica) verificaMateriale(stato, materiale);

  for (const voce of materiale) {
    process.stdout.write(`\n=== ${voce.feature} — .daiku/features/${voce.feature}/\n`);
    for (const c of voce.delLotto) {
      process.stdout.write(`--- contributo del lotto: ${c.path}${c.testo === null ? ' (ILLEGGIBILE)' : ''}\n\n`);
      if (c.testo !== null) process.stdout.write(`${c.testo.trimEnd()}\n\n`);
    }
    if (voce.altre.length) {
      process.stdout.write('altri file nella cartella (fuori dal lotto):\n');
      for (const a of voce.altre) process.stdout.write(`  ${a.path} — ${a.titolo || '(senza titolo)'}\n`);
    }
    process.stdout.write(`\nsintesi da scrivere: .daiku/studies/${voce.feature}.md\n\n`);
    process.stdout.write(`${scheletroSintesi(voce.feature, stato.id, voce.delLotto.map((c) => c.corsa))}`);
  }
  process.stdout.write(`\n${JSON.stringify({ lotto: stato.id, feature: materiale.map((m) => m.feature), contributi: materiale.reduce((n, m) => n + m.delLotto.length, 0) })}\n`);
  process.exit(0);
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

  // La sintesi: la forma che deve avere il documento che chiude un lotto, e il materiale che gli si
  // mette davanti. Una sintesi non è un contributo — sceglie — e le sue regole sono queste.
  const buona = [
    '# Gestione del contesto — sintesi', '',
    '- **Feature:** gestione-contesto',
    '- **Lotto:** 20261002120000',
    '- **Corse:** owner--uno, owner--due',
    '- **Esito:** adatta', '',
    '## Cosa portano i target', '', 'uno fa così, due fa cosà', '',
    '## Quale approccio vince, e perché', '', 'vince due, che compatta presto', '',
    '## La feature proposta', '', 'una skill nuova', '',
    '## Cosa resta aperto', '', 'Nessuna', '',
    '## Prompt per new-feature', '',
    '```text',
    '/daiku:new-feature tieni il contesto magro',
    '',
    'Lavora in .daiku/features/gestione-contesto/: la cartella esiste già.',
    '```', '',
  ].join('\n');
  const atteso = { feature: 'gestione-contesto', lotto: '20261002120000', corse: ['owner--uno', 'owner--due'] };
  const fuoriOrdine = buona
    .replace('## La feature proposta', '## __scambio__')
    .replace('## Cosa resta aperto', '## La feature proposta')
    .replace('## __scambio__', '## Cosa resta aperto');

  ok('sintesi: buona passa', uguale(verificaSintesi(buona, atteso), []));
  ok('sintesi: assente è rossa', verificaSintesi(null, atteso).length === 1);
  ok('sintesi: segnaposto residuo', verificaSintesi(buona.replace('una skill nuova', 'una <skill nuova>'), atteso).some((f) => f.includes('segnaposto')));
  ok('sintesi: feature sbagliata', verificaSintesi(buona, { ...atteso, feature: 'memoria' }).some((f) => f.includes('Feature')));
  ok('sintesi: lotto sbagliato', verificaSintesi(buona, { ...atteso, lotto: 'altro' }).some((f) => f.includes('Lotto')));
  ok('sintesi: una corsa non nominata', verificaSintesi(buona, { ...atteso, corse: ['owner--uno', 'owner--tre'] }).some((f) => f.includes('non nomina')));
  ok('sintesi: esito ignoto', verificaSintesi(buona.replace('**Esito:** adatta', '**Esito:** forse'), atteso).some((f) => f.includes('Esito')));
  ok('sintesi: sezioni fuori ordine', verificaSintesi(fuoriOrdine, atteso).some((f) => f.includes('sezioni')));
  ok('sintesi: sezione vuota', verificaSintesi(buona.replace('Nessuna\n\n## Prompt', '## Prompt'), atteso).some((f) => f.includes('"Cosa resta aperto"')));
  ok('sintesi: prompt senza il comando', verificaSintesi(buona.replace('/daiku:new-feature', 'new-feature'), atteso).some((f) => f.includes('non comincia')));
  ok('sintesi: prompt senza la cartella', verificaSintesi(buona.replace('.daiku/features/gestione-contesto/', 'la sua cartella'), atteso).some((f) => f.includes('non nomina')));
  ok('sintesi: prompt senza recinto', verificaSintesi(buona.replace('```text\n', '').replace(/```\s*$/, ''), atteso).some((f) => f.includes('recintato')));

  // Un `scarta` non ha niente da far costruire: la sua ultima sezione è la ragione, non un prompt.
  const scartata = buona
    .replace('**Esito:** adatta', '**Esito:** scarta')
    .replace(/\n```text[\s\S]*?```\n/, '\nNiente da costruire: nessuno dei tre batte quello che Daiku ha già.\n');
  ok('sintesi: un `scarta` senza prompt passa', uguale(verificaSintesi(scartata, atteso), []));
  ok('sintesi: un esito che propone vuole il prompt', verificaSintesi(
    buona.replace(/\n```text[\s\S]*?```\n/, '\nNiente da costruire.\n'), atteso
  ).some((f) => f.includes('recintato')));

  const estrattori = [
    titolo(buona) === 'Gestione del contesto — sintesi',
    sezioniTitoli(buona).length === 5,
    corpoSezione(buona, 'Cosa portano i target') === 'uno fa così, due fa cosà',
    corpoSezione(buona, 'Non esiste') === null,
    campo(buona, 'Feature') === 'gestione-contesto',
    campo(buona, 'Assente') === null,
    bloccoRecintato(corpoSezione(buona, 'Prompt per new-feature') || '').includes('Lavora in'),
    segnaposto('niente qui').length === 0,
  ];
  ok('sintesi: gli estrattori leggono il markdown', estrattori.every(Boolean));

  // Il materiale: i contributi delle corse del lotto, e gli altri file della cartella che restano
  // fuori — nominati, non stampati.
  const catalogo = {
    '.daiku/features/gestione-contesto/owner--uno.md': '# Uno — gestione\n\ntesto uno',
    '.daiku/features/gestione-contesto/owner--due.md': '# Due — gestione\n\ntesto due',
    '.daiku/features/gestione-contesto/owner--zero.md': '# Zero — gestione\n\ntesto zero',
  };
  const cartelle = { '.daiku/features/gestione-contesto': ['owner--uno.md', 'owner--due.md', 'owner--zero.md'] };
  const mat = materialeDelleFeature(
    [{ corsa: 'owner--uno', feature: 'gestione-contesto' }, { corsa: 'owner--due', feature: 'gestione-contesto' }],
    { leggi: (p) => catalogo[p] ?? null, elenca: (d) => cartelle[d] ?? [] }
  );
  ok('materiale: una voce per feature', uguale(mat.map((m) => m.feature), ['gestione-contesto']));
  ok('materiale: i contributi del lotto col loro testo', uguale(mat[0].delLotto.map((c) => c.corsa), ['owner--uno', 'owner--due']) && mat[0].delLotto[0].testo.includes('testo uno'));
  ok('materiale: gli altri file restano fuori', uguale(mat[0].altre.map((a) => a.path), ['.daiku/features/gestione-contesto/owner--zero.md']) && mat[0].altre[0].titolo === 'Zero — gestione');
  ok('materiale: le feature si ordinano', uguale(
    materialeDelleFeature([{ corsa: 'b', feature: 'zeta' }, { corsa: 'a', feature: 'alfa' }], { leggi: () => '# t', elenca: () => [] }).map((m) => m.feature),
    ['alfa', 'zeta']
  ));
  ok('materiale: un contributo illeggibile non sparisce', materialeDelleFeature(
    [{ corsa: 'x', feature: 'f' }], { leggi: () => null, elenca: () => [] }
  )[0].delLotto[0].testo === null);

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
else if (argv[0] === 'sintesi') sintesi();
else uso();
