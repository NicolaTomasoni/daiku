#!/usr/bin/env node
/**
 * Verificatore delle otto invarianti del corpus di Daiku.
 *
 * Attrezzo di sviluppo, non codice ospite: vive fuori da `plugins/`, non si pubblica, non si
 * installa in nessun progetto e non gira mai da un hook. Si lancia a mano prima di un rilascio,
 * accanto a `check-topology.mjs` e `check-marketplace.mjs`:
 *
 *   node .docs/tools/check-corpus.mjs plugins/daiku
 *
 * La radice arriva sempre come argomento e non si deduce mai dalla posizione di questo file. Uscita
 * JSON contata `{checks, passed, failed[]}`, `1` al primo rosso, `2` senza argomento. Non scrive
 * **mai** un file: l'unica scrittura avviene dentro `--self-check`, che crea le proprie fixture in
 * `os.tmpdir()` e le cancella alla fine. Non contiene, né lancia, nessun comando d'installazione.
 *
 * Imporre le otto invarianti che i contratti dichiarano in prosa ma nessun controllo verifica
 * (`CLAUDE.md`: «dove possiamo aggiungere un controllo deterministico, lo aggiungiamo sempre»):
 *
 * 1. nessuna riga di un file di testo porta un carattere di controllo C0 diverso da `\n` (0x0A);
 * 2. ogni `{chiave}` citata in un code span esiste nel vocabolario, e lo specchio
 *    `schemas/blocks.json` § `params` concorda con la prosa (§4 di `project-contract.md`,
 *    §7 di `orchestration.md`);
 * 3. ogni path citato con radice interna (`contracts/`, `skills/`, `architect/`, `templates/`,
 *    `schemas/`, `hooks/`, `agents/`) risolve dentro la radice del pacchetto;
 * 4. ogni blocco ` ```json ` di un markdown è parsabile, dopo un normalizzatore;
 * 5. nessuna skill (`skills/<nome>/SKILL.md`) nomina un modello (`opus`, `sonnet`, `haiku`);
 * 6. ogni skill che cita una chiave porta la riga d'apertura §5.1, `init` esentata;
 * 7. ogni `agents/*.md` ha `name`, `description` e `tools`, il `tools` è ristretto, e il `name`
 *    compare fra i `subagent_type` di §4 di `orchestration.md`.
 * 8. la parola in grassetto con cui una skill dichiara il ruolo di un passo è uno dei ruoli che §1 di
 *    `orchestration.md` dichiara nella sua tabella — il vocabolario si legge da lì, non si ricopia:
 *    una regola documentata dentro un code span o un fence non è una dichiarazione.
 *
 * Il totale è contato, non cablato, e ogni controllo ha accanto la sua regex o la sua costante —
 * la definizione è parte del controllo, non un dettaglio interno. Il banco `--self-check` porta
 * casi verdi e rossi per ciascuno degli otto e, accanto a `{checks, passed, failed}`, l'elenco
 * `never_red` — le regole che nessuna fixture ha mai reso rosse — perché una regola sempre verde
 * non si distingue da una che non può fallire (`hooks/self-check.mjs:130-136`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------------------------------------------------------------- definizioni */

/** Gli otto controlli, per identificatore: sono le «regole» del banco, quelle che `never_red` conta. */
const CONTROLLI = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

/** La riga d'apertura §5.1, verbatim da `contracts/project-contract.md` §5.1, a spazi normalizzati. */
const RIGA_51 = '**Parameters.** Every key in braces in this contract resolves on the project '
  + 'parameter files, never from memory and never by assumption: the rules are in §5 of '
  + '`contracts/project-contract.md`, which also says **in which language to write** and what to do '
  + 'when a key is missing.';

/** Le radici di sede interna al pacchetto: una citazione con una di queste radici deve risolvere qui. */
const RADICI_INTERNE = ['contracts', 'skills', 'architect', 'templates', 'schemas', 'hooks', 'agents'];

/** I controlli 2 e 6 riconoscono una citazione da un code span con dentro solo una `{chiave}` — o una
 *  `{chiave}` dentro un code span più lungo (una riga di comando, un path). I segnaposto `<…>` e i
 *  jolly `*` sono segmenti ammessi: `{areas.<area>.gate}`, `{commit.*}`. */
const CITAZIONE_RE = /\{([A-Za-z_][A-Za-z0-9_]*(?:\.(?:[A-Za-z0-9_*]+|<[^>]*>))*)\}/g;

/** I nomi di modello di cui l'invariante 5 vieta la citazione in una skill. */
const MODELLO_RE = /\b(opus|sonnet|haiku)\b/i;

/** Le tre forme con cui una skill dichiara il ruolo di un passo — `— **worker** role`, il lead-in in
 *  grassetto `**5a. Stage — worker role.**`, il bullet del chiamante `the **step role**: **worker**`.
 *  La convenzione è una sola: **la parola in grassetto davanti a `role` nomina il ruolo**, e se non è
 *  un ruolo non va in grassetto. Le tre alternative catturano quella parola, l'una o l'altra
 *  valorizzata; il lookbehind esclude la `**` che chiude uno span precedente. Una forma nuova che il
 *  corpus adotti va aggiunta qui, altrimenti il ruolo sfugge — la definizione è parte del controllo. */
const RUOLO_RE = /(?<![\w*])\*\*([A-Za-z]+)\*\*\s+roles?\b|(?<![\w*])\*\*[^*]*?[—,]\s*(?:as\s+)?(?:an?\s+)?([A-Za-z]+)\s+roles?\b[.,]?\*\*|\broles?\*\*:\s*\*\*([A-Za-z]+)\*\*/g;

/** La forma di una citazione di path con radice interna: la regex è la definizione del controllo 3. */
const PATH_RE = new RegExp('`((?:' + RADICI_INTERNE.join('|') + ')\\/[^`\\s]+)`', 'g');

/** I tool che l'invariante 7 vieta nel `tools:` di un agente: scrittura e delega. */
const TOOL_VIETATI = ['Edit', 'Write', 'Task', 'Agent'];

/** La dichiarazione con cui `init` si esenta dall'invariante 6. */
const ESENZIONE_INIT_RE = /You have no project parameters/i;

/* ---------------------------------------------------------------- util */

/** Tutti i file sotto `dir`, ricorsivamente, in path assoluti. */
function cammina(dir, out = []) {
  let voci;
  try {
    voci = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of voci) {
    const p = join(dir, e.name);
    if (e.isDirectory()) cammina(p, out);
    else out.push(p);
  }
  return out;
}

function leggiTesto(percorso) {
  return readFileSync(percorso, 'utf-8');
}

/** Un file è binario se i suoi byte contengono `0x00`: l'unico del pacchetto è `icon.png`, e si salta. */
function binario(buf) {
  return buf.includes(0);
}

/** I caratteri di controllo C0 di un testo, riga per riga: ogni byte 0x00–0x1F tranne `\n` (0x0A). */
function caratteriControllo(testo) {
  const cattivi = [];
  testo.split('\n').forEach((riga, i) => {
    const m = riga.match(/[\x00-\x08\x09\x0b-\x1f]/);
    if (m) cattivi.push({ riga: i + 1, codice: m[0].charCodeAt(0) });
  });
  return cattivi;
}

/** Le chiavi di una tabella di prosa: la prima cella racchiusa fra backtick di ogni riga, dalla riga
 *  di intestazione data fino alla fine della tabella. */
function chiaviTabella(righe, intestazioneRe) {
  let inTabella = false;
  const chiavi = [];
  for (const riga of righe) {
    if (intestazioneRe.test(riga)) { inTabella = true; continue; }
    if (!inTabella) continue;
    if (/^#{1,6}\s/.test(riga)) break;
    if (!riga.trim()) { if (chiavi.length) break; continue; }
    if (!riga.startsWith('|')) { if (chiavi.length) break; continue; }
    const cella = riga.split('|')[1];
    const m = cella && cella.match(/`([^`]+)`/);
    if (m) chiavi.push(m[1]);
  }
  return chiavi;
}

/** I ruoli che §1 di `orchestration.md` dichiara nella sua tabella, dove la prima cella è il nome in
 *  grassetto. È la sede del vocabolario — §1 si dichiara punto unico di modifica — e si legge, non si
 *  ricopia: l'invariante 8 chiude su quello che §1 dichiara, non su una copia che invecchia. */
function ruoliDichiarati(righe, intestazioneRe) {
  let inTabella = false;
  const ruoli = [];
  for (const riga of righe) {
    if (intestazioneRe.test(riga)) { inTabella = true; continue; }
    if (!inTabella) continue;
    if (/^#{1,6}\s/.test(riga)) break;
    if (!riga.trim()) { if (ruoli.length) break; continue; }
    if (!riga.startsWith('|')) { if (ruoli.length) break; continue; }
    const m = riga.split('|')[1].trim().match(/^\*\*([A-Za-z][A-Za-z0-9_-]*)\*\*$/);
    if (m) ruoli.push(m[1]);
  }
  return ruoli;
}

function segmenti(chiave) {
  return chiave.split('.').map((s) => s.trim());
}

function jolly(segmento) {
  return /^<.*>$/.test(segmento) || segmento === '*';
}

/** Due chiavi combaciano se hanno lo stesso numero di segmenti e i segmenti non-jolly coincidono. */
function chiaviCombaciano(a, b) {
  const A = segmenti(a);
  const B = segmenti(b);
  if (A.length !== B.length) return false;
  return A.every((s, i) => s === B[i] || jolly(s) || jolly(B[i]));
}

/** Il testo di un markdown senza i fence e i code span: una regola documentata dentro un esempio non è
 *  una dichiarazione. I fence si svuotano tenendone i ritorni a capo, così i numeri di riga restano —
 *  e si accoppiano a due a due: un fence spaiato resta in chiaro invece di accecare il resto del file,
 *  che è il modo in cui un controllo smette di vedere senza dirlo. */
function senzaCodice(testo) {
  return testo
    .replace(/```[\s\S]*?```/g, (blocco) => blocco.replace(/[^\n]/g, ''))
    .replace(/`[^`\n]*`/g, '');
}

/** Le chiavi citate in un testo, cioè i `{…}` dentro i code span. Una `${…}` (una variabile di
 *  shell, come `${CLAUDE_PLUGIN_ROOT}`) e un ref Git come `stash@{n}` non sono citazioni di chiave:
 *  si saltano, guardando il carattere che precede la graffa. */
function chiaviCitate(testo) {
  const out = [];
  for (const span of testo.matchAll(/`([^`\n]*)`/g)) {
    for (const m of span[1].matchAll(CITAZIONE_RE)) {
      if ('$@'.includes(span[1][m.index - 1])) continue;
      out.push(m[1]);
    }
  }
  return out;
}

/** I fence ` ```json ` di un markdown, col numero di riga del corpo e il corpo stesso. */
function blocchiJson(testo) {
  const righe = testo.split(/\r?\n/);
  const out = [];
  let dentro = false;
  let inizio = 0;
  let corpo = [];
  righe.forEach((riga, i) => {
    if (!dentro && /^\s*```json\s*$/.test(riga)) { dentro = true; inizio = i + 2; corpo = []; return; }
    if (dentro && /^\s*```\s*$/.test(riga)) { dentro = false; out.push({ riga: inizio, corpo: corpo.join('\n') }); return; }
    if (dentro) corpo.push(riga);
  });
  return out;
}

/**
 * Il normalizzatore del controllo 4: rende parsabile un blocco che porta segnaposto `<…>`, alternative
 * di enum (`a|b`) e unioni (`… | null`) senza toccare il corpus. Regole, in ordine di scanner:
 *  1. un segnaposto `<…>` nudo (fuori da una stringa) diventa la stringa `"<…>"`;
 *  2. un valore stringa che contiene `|` diventa la sua prima alternativa (trim);
 *  3. un'alternanza `X | null` o `null | X` in posizione di valore diventa la parte non nulla.
 * Un enum con un'alternativa vuota (`"a|"`) è un blocco malformato: solleva, e il controllo è rosso.
 */
function normalizza(testo) {
  let out = '';
  let i = 0;
  const n = testo.length;
  while (i < n) {
    const c = testo[i];
    if (c === '"') {
      let j = i + 1;
      let buf = '';
      while (j < n) {
        if (testo[j] === '\\') { buf += testo[j] + (testo[j + 1] ?? ''); j += 2; continue; }
        if (testo[j] === '"') break;
        buf += testo[j];
        j += 1;
      }
      if (j >= n) { out += testo.slice(i); break; }
      if (buf.includes('|')) {
        const parti = buf.split('|');
        if (parti.some((p) => p.trim() === '')) throw new Error('alternativa vuota in un enum');
        buf = parti[0].trim();
      }
      out += `"${buf}"`;
      i = j + 1;
      continue;
    }
    if (c === '|') {
      const destra = testo.slice(i + 1).match(/^\s*null\b/);
      if (destra) { i += 1 + destra[0].length; continue; }
      const sinistra = out.match(/null\s*$/);
      if (sinistra) { out = out.slice(0, out.length - sinistra[0].length); i += 1; continue; }
      let depth = 0;
      let k = i + 1;
      while (k < n) {
        const ch = testo[k];
        if (ch === '"') {
          k += 1;
          while (k < n) { if (testo[k] === '\\') { k += 2; continue; } if (testo[k] === '"') break; k += 1; }
        } else if (ch === '{' || ch === '[') depth += 1;
        else if (ch === '}' || ch === ']') { if (depth === 0) break; depth -= 1; }
        else if (ch === ',' && depth === 0) break;
        k += 1;
      }
      i = k;
      continue;
    }
    if (c === '<') {
      const chiuso = testo.indexOf('>', i);
      if (chiuso === -1) { out += c; i += 1; continue; }
      out += `"${testo.slice(i, chiuso + 1).replace(/"/g, '')}"`;
      i = chiuso + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Il testo a spazi normalizzati, coi marcatori di blockquote tolti: per confrontare la §5.1. */
function appiattisci(testo) {
  return testo.split(/\r?\n/).map((l) => l.replace(/^\s*>\s?/, '')).join(' ').replace(/\s+/g, ' ').trim();
}

/** Il frontmatter di un `.md`, fra i due `---`, o stringa vuota. */
function frontmatter(testo) {
  const m = testo.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

function campo(fm, nome) {
  const m = fm.match(new RegExp(`^\\s*${nome}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

/** I `subagent_type` elencati in §4 di `orchestration.md`: i backtick delle righe che continuano
 *  quella che nomina `subagent_type` (sulla stessa riga stanno i soli termini di contorno). */
function subagentType(testo) {
  const righe = testo.split(/\r?\n/);
  const idx = righe.findIndex((l) => /subagent_type/.test(l));
  if (idx < 0) return [];
  const out = [];
  for (let i = idx + 1; i < righe.length; i += 1) {
    if (!righe[i].trim()) break;
    for (const m of righe[i].matchAll(/`([^`]+)`/g)) out.push(m[1]);
  }
  return out;
}

/* ---------------------------------------------------------------- verifica */

/**
 * Esegue gli otto controlli su una radice di pacchetto già su disco. Non ha opzioni: le fixture del
 * banco sono radici temporanee costruite da `radiceBase`, non scorciatoie.
 */
function verifica(root) {
  const checks = [];
  const failed = [];
  const check = (id, ok, dettaglio) => {
    checks.push(id);
    if (!ok) failed.push(dettaglio ? `${id}: ${dettaglio}` : id);
  };

  const files = cammina(root);
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const skillFiles = mdFiles.filter((f) => /[\\/]skills[\\/][^\\/]+[\\/]SKILL\.md$/.test(f));
  const agentFiles = mdFiles.filter((f) => /[\\/]agents[\\/][^\\/]+\.md$/.test(f) && !/[\\/]skills[\\/]/.test(f));

  /* 1 — nessun carattere di controllo. */
  {
    const cattivi = [];
    for (const f of files) {
      const buf = readFileSync(f);
      if (binario(buf)) continue;
      for (const b of caratteriControllo(buf.toString('utf-8'))) {
        cattivi.push(`${f}:${b.riga}: 0x${b.codice.toString(16).padStart(2, '0')}`);
      }
    }
    check('c1', cattivi.length === 0, cattivi.join('; '));
  }

  /* 2 — la chiave citata esiste; lo specchio concorda con la prosa. */
  {
    const problemi = [];
    let projectProsa = [];
    let envProsa = [];
    let mirrorProject = [];
    let mirrorEnv = [];
    try {
      const pc = leggiTesto(join(root, 'contracts/project-contract.md')).split(/\r?\n/);
      projectProsa = chiaviTabella(pc, /^##\s+4\.\s/);
    } catch { problemi.push('contracts/project-contract.md illeggibile'); }
    try {
      const orch = leggiTesto(join(root, 'contracts/orchestration.md')).split(/\r?\n/);
      envProsa = chiaviTabella(orch, /^##\s+7\.\s/);
    } catch { problemi.push('contracts/orchestration.md illeggibile'); }
    try {
      const mirror = JSON.parse(leggiTesto(join(root, 'schemas/blocks.json')));
      mirrorProject = (mirror.params && mirror.params.project_json) || [];
      mirrorEnv = (mirror.params && mirror.params.environment_json) || [];
    } catch { problemi.push('schemas/blocks.json illeggibile'); }
    for (const k of projectProsa) if (!mirrorProject.some((m) => chiaviCombaciano(k, m))) problemi.push(`§4 '${k}' non è nello specchio project_json`);
    for (const k of envProsa) if (!mirrorEnv.some((m) => chiaviCombaciano(k, m))) problemi.push(`§7 '${k}' non è nello specchio environment_json`);
    for (const m of mirrorProject) if (!projectProsa.some((k) => chiaviCombaciano(k, m))) problemi.push(`specchio project_json '${m}' non è dichiarato in §4`);
    for (const m of mirrorEnv) if (!envProsa.some((k) => chiaviCombaciano(k, m))) problemi.push(`specchio environment_json '${m}' non è dichiarato in §7`);
    const vocabolario = [...projectProsa, ...envProsa];
    for (const f of mdFiles) {
      for (const c of chiaviCitate(leggiTesto(f))) {
        if (!vocabolario.some((v) => chiaviCombaciano(c, v))) problemi.push(`${f}: citazione {${c}} fuori vocabolario`);
      }
    }
    check('c2', problemi.length === 0, problemi.join('; '));
  }

  /* 3 — il path citato con radice interna risolve dentro il pacchetto. */
  {
    const problemi = [];
    for (const f of mdFiles) {
      leggiTesto(f).split(/\r?\n/).forEach((riga, i) => {
        for (const m of riga.matchAll(PATH_RE)) {
          let p = m[1];
          if (/[<>]/.test(p)) continue;          // segnaposto parametrico: non è un path concreto
          if (/[*?]/.test(p)) continue;          // glob: non è un path concreto
          p = p.replace(/:\d+$/, '').replace(/[.,;:)\]]+$/, '');
          if (!p) continue;
          if (!existsSync(join(root, p))) problemi.push(`${f}:${i + 1}: '${m[1]}' non risolve dentro il pacchetto`);
        }
      });
    }
    check('c3', problemi.length === 0, problemi.join('; '));
  }

  /* 4 — ogni blocco json è parsabile. */
  {
    const problemi = [];
    for (const f of mdFiles) {
      for (const b of blocchiJson(leggiTesto(f))) {
        try {
          JSON.parse(normalizza(b.corpo));
        } catch (e) {
          problemi.push(`${f}:${b.riga}: ${e.message}`);
        }
      }
    }
    check('c4', problemi.length === 0, problemi.join('; '));
  }

  /* 5 — nessuna skill nomina un modello. */
  {
    const problemi = [];
    for (const f of skillFiles) {
      const m = leggiTesto(f).match(MODELLO_RE);
      if (m) problemi.push(`${f}: nomina '${m[0]}'`);
    }
    check('c5', problemi.length === 0, problemi.join('; '));
  }

  /* 6 — chi cita una chiave apre la §5.1; `init` esentata. */
  {
    const problemi = [];
    for (const f of skillFiles) {
      const testo = leggiTesto(f);
      if (ESENZIONE_INIT_RE.test(testo)) continue;
      if (chiaviCitate(testo).length === 0) continue;
      if (!appiattisci(testo).includes(RIGA_51)) problemi.push(`${f}: cita una chiave ma non porta la riga §5.1`);
    }
    check('c6', problemi.length === 0, problemi.join('; '));
  }

  /* 7 — agent e `subagent_type` si nominano a vicenda, toolset ristretto. */
  {
    const problemi = [];
    let tipi = [];
    try {
      tipi = subagentType(leggiTesto(join(root, 'contracts/orchestration.md')));
    } catch { problemi.push('contracts/orchestration.md illeggibile'); }
    for (const f of agentFiles) {
      const fm = frontmatter(leggiTesto(f));
      const name = campo(fm, 'name');
      const desc = campo(fm, 'description');
      const tools = campo(fm, 'tools');
      if (!name || !desc || !tools) problemi.push(`${f}: frontmatter senza name, description o tools`);
      if (tools) {
        const nomi = tools.split(',').map((t) => t.split('(')[0].trim());
        const vietati = nomi.filter((t) => TOOL_VIETATI.includes(t));
        if (vietati.length) problemi.push(`${f}: tools riammette ${vietati.join(', ')}`);
      }
      if (name && !tipi.includes(name)) problemi.push(`${f}: name '${name}' non è fra i subagent_type di §4`);
    }
    check('c7', problemi.length === 0, problemi.join('; '));
  }

  /* 8 — la parola in grassetto che dichiara il ruolo di un passo è uno dei ruoli di §1. */
  {
    const problemi = [];
    let ruoli = [];
    try {
      ruoli = ruoliDichiarati(leggiTesto(join(root, 'contracts/orchestration.md')).split(/\r?\n/), /^##\s+1\.\s/);
    } catch { problemi.push('contracts/orchestration.md illeggibile'); }
    if (!ruoli.length) problemi.push('§1 di contracts/orchestration.md non dichiara nessun ruolo');
    for (const f of skillFiles) {
      senzaCodice(leggiTesto(f)).split(/\r?\n/).forEach((riga, i) => {
        for (const m of riga.matchAll(RUOLO_RE)) {
          const parola = m[1] || m[2] || m[3];
          if (!ruoli.includes(parola)) problemi.push(`${f}:${i + 1}: '${parola}' in grassetto davanti a 'role' non è uno dei ruoli di §1`);
        }
      });
    }
    check('c8', problemi.length === 0, problemi.join('; '));
  }

  return { checks, failed };
}

/* ---------------------------------------------------------------- banco di prova */

function scrivi(percorso, contenuto) {
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, contenuto);
}

/** Una radice di pacchetto finta e coerente: due contratti con le tabelle di vocabolario e la §5.1, lo
 *  specchio, una skill col suo `{code_root}` e l'agente `finder` valido. Ogni fixture parte da qui. */
function radiceBase(base) {
  const root = mkdtempSync(join(base, 'corpus-'));
  scrivi(join(root, 'contracts/project-contract.md'), [
    '# Project contract',
    '',
    '## 4. The keys',
    '',
    '| Key | Purpose |',
    '|---|---|',
    '| `code_root` | code root |',
    '| `memory.root` | memory |',
    '',
    '## 5. How a skill consumes it',
    '',
    '### 5.1 The opening line',
    '',
    '```markdown',
    `> ${RIGA_51}`,
    '```',
    '',
  ].join('\n'));
  scrivi(join(root, 'contracts/orchestration.md'), [
    '# Orchestration',
    '',
    '## 1. Roles',
    '',
    '| Role | When to use |',
    '|---|---|',
    '| **judge** | the step decides |',
    '| **worker** | the step executes |',
    '',
    '## 4. Delegation',
    '',
    '- **`claude`** — `Agent` tool, with `model` resolved per §2 and `subagent_type` chosen thus:',
    '  `finder` for analysis-only steps, `Explore` for search only, `general-purpose` for everything else.',
    '',
    '## 7. The `environment.json` keys',
    '',
    '| Key | Purpose |',
    '|---|---|',
    '| `hosts` | hosts |',
    '| `temp_dir` | temp |',
    '',
  ].join('\n'));
  scrivi(join(root, 'schemas/blocks.json'), JSON.stringify({
    $comment: 'fixture',
    params: { project_json: ['code_root', 'memory.root'], environment_json: ['hosts', 'temp_dir'] },
  }, null, 2));
  scrivi(join(root, 'skills/apply/SKILL.md'), [
    '---',
    "name: 'apply'",
    "description: 'fixture skill'",
    '---',
    '',
    `> ${RIGA_51}`,
    '',
    'Uses `{code_root}`.',
    '',
  ].join('\n'));
  scrivi(join(root, 'agents/finder.md'), [
    '---',
    'name: finder',
    'description: fixture finder',
    'tools: Read, Grep, Glob',
    '---',
    '',
    'Body.',
    '',
  ].join('\n'));
  return root;
}

function runSelfCheck() {
  const checks = [];
  const failed = [];
  const rossiVisti = new Set();
  const record = (name, ok, dettaglio) => {
    checks.push(name);
    if (!ok) failed.push(dettaglio ? `${name}: ${dettaglio}` : name);
  };

  const base = mkdtempSync(join(tmpdir(), 'daiku-check-corpus-'));
  try {
    // Senza argomenti: usage, uscita 2.
    const senzaArgomenti = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { encoding: 'utf-8', timeout: 15000 });
    record('senza-argomenti-esce-2', senzaArgomenti.status === 2, `uscita ${senzaArgomenti.status}`);

    /** Costruisce una radice (base + mutazione) ed esige che il controllo `id` dia il colore atteso. */
    const caso = (etichetta, id, attesoRosso, muta) => {
      const root = radiceBase(base);
      if (muta) muta(root);
      const res = verifica(root);
      for (const f of res.failed) {
        const m = f.match(/^(c\d)/);
        if (m) rossiVisti.add(m[1]);
      }
      const eRosso = res.failed.some((f) => f.startsWith(`${id}:`));
      record(`caso:${etichetta}`, eRosso === attesoRosso,
        `atteso ${attesoRosso ? 'rosso' : 'verde'} su ${id}, avuto ${eRosso ? 'rosso' : 'verde'} — ${res.failed.join(' | ') || 'nessun rosso'}`);
    };

    // 1 — caratteri di controllo.
    caso('ctrl-non-rosso-sul-corpus-pulito', 'c1', false, null);
    caso('ctrl-rosso-su-tabulazione', 'c1', true, (r) => scrivi(join(r, 'note.txt'), 'a\tb\n'));
    caso('ctrl-salta-il-binario', 'c1', false, (r) => writeFileSync(join(r, 'blob.bin'), Buffer.from([0x00, 0x09, 0x41])));

    // 2 — chiavi citate e specchio.
    caso('chiavi-verdi-sul-corpus-coerente', 'c2', false, null);
    caso('chiave-inventata-rossa', 'c2', true, (r) => scrivi(join(r, 'skills/bad/SKILL.md'),
      `---\nname: 'bad'\ndescription: 'x'\n---\n\n> ${RIGA_51}\n\nUses \`{chiave.inventata}\`.\n`));
    caso('specchio-incompleto-rosso', 'c2', true, (r) => scrivi(join(r, 'contracts/project-contract.md'),
      `# Project contract\n\n## 4. The keys\n\n| Key | Purpose |\n|---|---|\n| \`code_root\` | c |\n| \`memory.root\` | m |\n| \`ghost.key\` | g |\n\n## 5. How a skill consumes it\n\n### 5.1 The opening line\n\n\`\`\`markdown\n> ${RIGA_51}\n\`\`\`\n`));
    caso('specchio-eccesso-rosso', 'c2', true, (r) => scrivi(join(r, 'schemas/blocks.json'), JSON.stringify({
      $comment: 'fixture',
      params: { project_json: ['code_root', 'memory.root', 'extra.key'], environment_json: ['hosts', 'temp_dir'] },
    })));
    caso('variabile-shell-non-citazione', 'c2', false, (r) => scrivi(join(r, 'skills/sh/SKILL.md'),
      '---\nname: sh\ndescription: x\n---\n\nVedi `${CLAUDE_PLUGIN_ROOT}`.\n'));
    caso('ref-git-non-citazione', 'c2', false, (r) => scrivi(join(r, 'skills/stash/SKILL.md'),
      '---\nname: stash\ndescription: x\n---\n\nVedi `git stash show -p stash@{n}`.\n'));

    // 3 — path citati.
    caso('path-interno-verde', 'c3', false, (r) => scrivi(join(r, 'skills/tocca/SKILL.md'),
      '---\nname: tocca\ndescription: x\n---\n\nVedi `contracts/orchestration.md`.\n'));
    caso('path-inesistente-rosso', 'c3', true, (r) => scrivi(join(r, 'skills/rotto/SKILL.md'),
      '---\nname: rotto\ndescription: x\n---\n\nVedi `contracts/inesistente.md`.\n'));
    caso('path-segnaposto-ignorato', 'c3', false, (r) => scrivi(join(r, 'skills/ph/SKILL.md'),
      '---\nname: ph\ndescription: x\n---\n\nVedi `skills/<name>/SKILL.md`.\n'));
    caso('path-sede-ospite-ignorato', 'c3', false, (r) => scrivi(join(r, 'skills/ospite/SKILL.md'),
      '---\nname: ospite\ndescription: x\n---\n\nVedi `.daiku/project.json`.\n'));
    caso('path-glob-ignorato', 'c3', false, (r) => scrivi(join(r, 'skills/glob/SKILL.md'),
      '---\nname: glob\ndescription: x\n---\n\nVedi `agents/*.md`.\n'));

    // 4 — blocchi json.
    const skillConBlocco = (corpo) => (r) => scrivi(join(r, 'skills/json/SKILL.md'),
      `---\nname: json\ndescription: x\n---\n\nBlocco:\n\n\`\`\`json\n${corpo}\n\`\`\`\n`);
    caso('json-letterale-verde', 'c4', false, skillConBlocco('{"a": 1}'));
    caso('json-unione-normalizzata-verde', 'c4', false, skillConBlocco('{"direction": {"kind": "a"} | null}'));
    caso('json-segnaposto-nudo-verde', 'c4', false, skillConBlocco('<the block of § What you return>'));
    caso('json-segnaposto-non-chiuso-rosso', 'c4', true, skillConBlocco('<foo'));
    caso('json-enum-vuoto-rosso', 'c4', true, skillConBlocco('{"a": "x|"}'));

    // 5 — modelli nominati.
    caso('modello-nella-skill-rosso', 'c5', true, (r) => scrivi(join(r, 'skills/m/SKILL.md'),
      '---\nname: m\ndescription: x\n---\n\nGira su opus.\n'));
    caso('skill-senza-modello-verde', 'c5', false, (r) => scrivi(join(r, 'skills/sm/SKILL.md'),
      '---\nname: sm\ndescription: x\n---\n\nNessun modello.\n'));
    caso('modello-fuori-dalle-skill-ignorato', 'c5', false, (r) => scrivi(join(r, 'templates/project/environment.json'),
      '{\n  "judge": "opus",\n  "worker": "sonnet"\n}\n'));

    // 6 — riga d'apertura §5.1.
    caso('riga-51-mancante-rossa', 'c6', true, (r) => scrivi(join(r, 'skills/senza/SKILL.md'),
      '---\nname: senza\ndescription: x\n---\n\nUsa `{code_root}`.\n'));
    caso('riga-51-presente-verde', 'c6', false, (r) => scrivi(join(r, 'skills/con/SKILL.md'),
      `---\nname: con\ndescription: x\n---\n\n> ${RIGA_51}\n\nUsa \`{code_root}\`.\n`));
    caso('skill-senza-citazioni-verde', 'c6', false, (r) => scrivi(join(r, 'skills/nc/SKILL.md'),
      '---\nname: nc\ndescription: x\n---\n\nNessuna citazione.\n'));
    caso('init-esentata-verde', 'c6', false, (r) => scrivi(join(r, 'skills/init/SKILL.md'),
      '---\nname: init\ndescription: x\n---\n\n## You have no project parameters\n\nUsa `{code_root}`.\n'));

    // 7 — agent e subagent_type.
    caso('finder-valido-verde', 'c7', false, null);
    caso('tools-con-edit-rosso', 'c7', true, (r) => scrivi(join(r, 'agents/finder.md'),
      '---\nname: finder\ndescription: x\ntools: Read, Edit\n---\n\nBody.\n'));
    caso('agente-senza-name-rosso', 'c7', true, (r) => scrivi(join(r, 'agents/finder.md'),
      '---\ndescription: x\ntools: Read\n---\n\nBody.\n'));
    caso('name-estraneo-rosso', 'c7', true, (r) => scrivi(join(r, 'agents/finder.md'),
      '---\nname: estraneo\ndescription: x\ntools: Read\n---\n\nBody.\n'));

    // 8 — vocabolario dei ruoli.
    caso('ruolo-dei-due-verde', 'c8', false, (r) => scrivi(join(r, 'skills/ruoli/SKILL.md'),
      '---\nname: ruoli\ndescription: x\n---\n\n### Scope — **worker** role\n'));
    caso('terzo-ruolo-rosso', 'c8', true, (r) => scrivi(join(r, 'skills/terzo/SKILL.md'),
      '---\nname: terzo\ndescription: x\n---\n\n### Scope — **manager** role\n'));
    caso('ruolo-in-forma-colon-verde', 'c8', false, (r) => scrivi(join(r, 'skills/colong/SKILL.md'),
      '---\nname: colong\ndescription: x\n---\n\nthe **step role**: **worker**, model resolved\n'));
    caso('ruolo-in-forma-colon-rosso', 'c8', true, (r) => scrivi(join(r, 'skills/colon/SKILL.md'),
      '---\nname: colon\ndescription: x\n---\n\nthe **step role**: **supervisor**\n'));
    caso('ruolo-in-lead-in-verde', 'c8', false, (r) => scrivi(join(r, 'skills/leadin/SKILL.md'),
      '---\nname: leadin\ndescription: x\n---\n\n**5a. Stage — worker role.** In the prompt:\n'));
    caso('ruolo-in-lead-in-rosso', 'c8', true, (r) => scrivi(join(r, 'skills/leadinr/SKILL.md'),
      '---\nname: leadinr\ndescription: x\n---\n\n**5a. Stage — supervisor role.** In the prompt:\n'));
    caso('grassetto-che-non-e-ruolo-rosso', 'c8', true, (r) => scrivi(join(r, 'skills/grass/SKILL.md'),
      '---\nname: grass\ndescription: x\n---\n\nEach phase declares its **own** role below.\n'));
    caso('regola-in-code-span-verde', 'c8', false, (r) => scrivi(join(r, 'skills/span/SKILL.md'),
      '---\nname: span\ndescription: x\n---\n\nNever write `**manager** role`: the two are judge and worker.\n'));
    caso('regola-in-fence-verde', 'c8', false, (r) => scrivi(join(r, 'skills/fence/SKILL.md'),
      '---\nname: fence\ndescription: x\n---\n\nEsempio:\n\n```\n**manager** role\n```\n'));
    caso('fence-spaiato-non-acceca-rosso', 'c8', true, (r) => scrivi(join(r, 'skills/spaiato/SKILL.md'),
      '---\nname: spaiato\ndescription: x\n---\n\n```\nesempio\n\n### Scope — **manager** role\n'));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  const neverRed = CONTROLLI.filter((c) => !rossiVisti.has(c));
  return {
    checks: checks.length,
    passed: checks.length - failed.length - neverRed.length,
    failed: [...failed, ...neverRed.map((c) => `never_red: ${c} — nessuna fixture lo rende rosso`)],
    never_red: neverRed,
  };
}

/* ---------------------------------------------------------------- ingresso */

const args = process.argv.slice(2);

if (args.includes('--self-check')) {
  const result = runSelfCheck();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result.failed.length ? 1 : 0);
}

const [rootArg] = args;
if (!rootArg) {
  process.stderr.write('uso: node check-corpus.mjs <radice-del-pacchetto>\n');
  process.exit(2);
}

const result = verifica(rootArg);
process.stdout.write(JSON.stringify({
  checks: result.checks.length,
  passed: result.checks.length - result.failed.length,
  failed: result.failed,
}) + '\n');
process.exit(result.failed.length ? 1 : 0);
