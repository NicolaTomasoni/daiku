#!/usr/bin/env node
/**
 * PostToolUse su `Edit|Write|MultiEdit` — accende i controlli deterministici sul gesto che
 * introduce il difetto, invece che su un gesto successivo che potrebbe non arrivare mai.
 *
 * Il motivo di stare qui e non in un gate di commit: chi riscrive un contratto puo' **non
 * committare**. Un frontmatter rotto resta nel working tree finche' qualcuno non se ne
 * accorge — e nel frattempo la skill si carica senza metadati e nessuno la trova piu'.
 *
 * Copre quattro cose, e sono le quattro che in un progetto Daiku si rompono in silenzio:
 *
 *  1. **Il frontmatter di una `SKILL.md`.** E' il guasto peggiore del corpus perche' non
 *     fallisce: la skill *si carica lo stesso*, con i metadati svuotati, quindi il modello
 *     non la trova mai per pertinenza. Due forme, entrambe viste dal vero: un valore non
 *     quotato che contiene `: ` chiude la chiave a meta' (succede in ogni `description` con
 *     un inciso), e uno che comincia con `[` viene letto come sequenza di flusso (succede in
 *     ogni `argument-hint`, che e' fatto di `[cartella] [soluzione]`).
 *  2. **I due JSON di `.daiku/`.** `project.json` e `environment.json` sono la sola fonte dei
 *     valori di progetto: ogni contratto li apre prima di agire. Un JSON non parsabile li
 *     spegne tutti insieme.
 *  3. **Le rule di area in `.daiku/policies/`.** Si selezionano per il `paths` del loro
 *     frontmatter: senza quella chiave la rule c'e' ma non viene mai scelta.
 *  4. **Le guardie stesse.** Una guardia riscritta si verifica col proprio banco di prova,
 *     non a occhio.
 *
 * **Segnala, non ferma.** L'uscita e' sempre `0` e non c'e' nessun ramo che blocchi: fermare
 * a meta' la scrittura di un contratto costa piu' del difetto che si chiude. Il referto
 * arriva come contesto, e chi ha appena scritto decide.
 *
 * **Fail-open e silenzioso.** Stdin illeggibile, path fuori perimetro, file sparito, `node`
 * che non parte, uscita non parsabile, timeout → non stampa niente ed esce 0. E' la stessa
 * scelta delle altre due guardie, con lo stesso prezzo: un guasto e' indistinguibile dal
 * silenzio. Per questo il perimetro ha un banco di prova.
 *
 * Banco di prova: `node contracts-post-edit.mjs --self-check`. Il totale e' contato, non
 * cablato.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative } from 'node:path';
import { radiceProgetto } from './project-root.mjs';

const RADICE = radiceProgetto();

/** Il path scritto, ridotto a relativo posix dalla radice. `null` se sta fuori. */
export function relativoAllaRadice(percorso, radice) {
  if (!percorso) return null;
  const assoluto = isAbsolute(percorso) ? percorso : join(radice, percorso);
  const rel = relative(radice, assoluto).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../')) return null;
  return rel;
}

/**
 * Cosa vale la pena controllare dopo aver scritto `rel`. Funzione pura: e' il perimetro, ed
 * e' la parte che il banco di prova verifica riga per riga.
 */
export function piano(rel) {
  if (!rel) return [];

  // Una guardia riscritta si verifica col proprio banco: gli altri controlli leggono
  // markdown e su un `.mjs` non hanno niente da dire.
  if (/^\.(claude|codex)\/hooks\/[A-Za-z0-9_.-]+\.mjs$/.test(rel)) {
    return [{ etichetta: `banco di prova di ${rel.split('/').pop()}`, tipo: 'banco', bersaglio: rel }];
  }

  // Il frontmatter di un contratto, ovunque stia: il pacchetto installato, `.claude/`,
  // `.codex/`, o una skill di progetto.
  if (/(^|\/)SKILL\.md$/.test(rel)) {
    return [{ etichetta: 'frontmatter del contratto', tipo: 'frontmatter', bersaglio: rel }];
  }

  if (rel === '.daiku/project.json' || rel === '.daiku/environment.json') {
    return [{ etichetta: `sintassi di ${rel.split('/').pop()}`, tipo: 'json', bersaglio: rel }];
  }

  if (/^\.daiku\/policies\/[^/]+\.md$/.test(rel) && !rel.endsWith('/README.md')) {
    return [{ etichetta: 'frontmatter della rule di area', tipo: 'policy', bersaglio: rel }];
  }

  return [];
}

// --- i controlli --------------------------------------------------------------
//
// Ognuno prende il testo e restituisce le righe di rilievo. Sono funzioni pure: leggono
// una stringa, non toccano il disco, e il banco le prova una per una.

/** Spezza il frontmatter YAML in testa. `null` se non c'e' o non si chiude. */
export function frontmatter(testo) {
  const normalizzato = String(testo).replace(/\r\n/g, '\n');
  if (!normalizzato.startsWith('---\n')) return null;
  const fine = normalizzato.indexOf('\n---', 3);
  if (fine === -1) return null;
  return normalizzato.slice(4, fine + 1);
}

/**
 * I rilievi sul frontmatter di una `SKILL.md`. Cerca le due forme che svuotano i metadati
 * senza fallire, piu' le due chiavi che i validatori dei due host pretendono.
 */
export function rilieviFrontmatter(testo) {
  const blocco = frontmatter(testo);
  if (blocco === null) {
    return ['il frontmatter manca o non si chiude: serve `---` in prima riga e `---` a chiudere'];
  }

  const rilievi = [];
  const visti = new Map();

  for (const riga of blocco.split('\n')) {
    // Solo le chiavi di primo livello: una riga indentata appartiene a un blocco annidato,
    // e li' le regole di quoting sono altre.
    const coppia = riga.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!coppia) continue;
    const chiave = coppia[1];
    const valore = coppia[2].trim();
    visti.set(chiave, valore);

    if (!valore) continue; // vuoto qui puo' essere un blocco su piu' righe: non si giudica
    const quotato = /^'.*'$/.test(valore) || /^".*"$/.test(valore);
    if (quotato) continue;

    if (valore.includes(': ')) {
      rilievi.push(
        `\`${chiave}\` non e' quotata e contiene \`: \` — YAML chiude la chiave a meta' e ` +
          `**tutti** i metadati vengono scartati in silenzio. Quota con apice singolo.`
      );
    } else if (valore.startsWith('[') || valore.startsWith('{')) {
      rilievi.push(
        `\`${chiave}\` non e' quotata e comincia con \`${valore[0]}\` — YAML la legge come ` +
          `sequenza di flusso, non come testo. Quota con apice singolo.`
      );
    }
  }

  for (const obbligatoria of ['name', 'description']) {
    if (!visti.has(obbligatoria)) {
      rilievi.push(`manca \`${obbligatoria}\`: i validatori di entrambi gli host la pretendono`);
    } else if (!visti.get(obbligatoria)) {
      rilievi.push(`\`${obbligatoria}\` e' vuota: i validatori di entrambi gli host la rifiutano`);
    }
  }

  return rilievi;
}

/** I rilievi sul frontmatter di una rule di area. */
export function rilieviPolicy(testo) {
  const blocco = frontmatter(testo);
  if (blocco === null) {
    return ['il frontmatter manca o non si chiude: senza `paths` la rule non viene mai selezionata'];
  }
  if (!/^paths:/m.test(blocco)) {
    return ['manca `paths`: la rule c\'e\' ma nessuna scansione la sceglie mai'];
  }
  return [];
}

/** I rilievi su un JSON di parametri. */
export function rilieviJson(testo) {
  try {
    JSON.parse(testo);
    return [];
  } catch (errore) {
    return [`non e' JSON valido (${errore.message}) — ogni contratto che lo apre si ferma qui`];
  }
}

/** Lancia un passo del piano e restituisce le righe da riportare. `[]` se tace o degrada. */
function esegui(passo, radice, amb) {
  const assoluto = join(radice, passo.bersaglio);

  if (passo.tipo === 'banco') {
    const esito = amb.lancia('node', [assoluto, '--self-check']);
    if (!esito || esito.stdout == null) return [];
    let referto;
    try {
      referto = JSON.parse(esito.stdout);
    } catch {
      return []; // uscita non parsabile: non si inventa un verdetto
    }
    const falliti = referto.falliti || [];
    if (!falliti.length) return [];
    return [`**${passo.etichetta}** — ${falliti.length} casi rossi:`, ...falliti.map((f) => `- ${f}`)];
  }

  let testo;
  try {
    testo = amb.leggi(assoluto);
  } catch {
    return []; // il file e' sparito fra la scrittura e il controllo: si tace
  }

  const rilievi =
    passo.tipo === 'frontmatter'
      ? rilieviFrontmatter(testo)
      : passo.tipo === 'policy'
        ? rilieviPolicy(testo)
        : rilieviJson(testo);

  if (!rilievi.length) return [];
  return [`**${passo.etichetta}** — ${rilievi.length} rilievi:`, ...rilievi.map((r) => `- ${r}`)];
}

export function referto(rel, radice, amb) {
  const righe = [];
  for (const passo of piano(rel)) righe.push(...esegui(passo, radice, amb));
  if (!righe.length) return null;
  return (
    `I controlli deterministici hanno qualcosa da dire su cio' che hai appena scritto ` +
    `(\`${rel}\`). **Non bloccano niente**: decidi tu.\n\n${righe.join('\n')}`
  );
}

const AMBIENTE_REALE = {
  leggi: (percorso) => readFileSync(percorso, 'utf-8'),
  lancia: (comando, argomenti) => {
    const esito = spawnSync(comando, argomenti, {
      cwd: RADICE,
      encoding: 'utf-8',
      timeout: 20000,
    });
    if (esito.error) return null;
    return esito;
  },
};

// --- banco di prova -----------------------------------------------------------

function ambienteFinto(file, risposte = {}) {
  const chiave = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const mappa = new Map(Object.entries(file).map(([k, v]) => [chiave(k), v]));
  return {
    leggi: (p) => {
      if (!mappa.has(chiave(p))) throw new Error(`ENOENT ${p}`);
      return mappa.get(chiave(p));
    },
    lancia: (comando, argomenti) => {
      const bersaglio = chiave(argomenti[0]);
      for (const [frammento, risposta] of Object.entries(risposte)) {
        if (bersaglio.includes(frammento)) return risposta;
      }
      return null;
    },
  };
}

const R = 'C:/dev/progetto';

function selfCheck() {
  const falliti = [];
  let eseguiti = 0;
  const verifica = (nome, condizione) => {
    eseguiti += 1;
    if (!condizione) falliti.push(nome);
  };

  // --- il perimetro: cosa accende cosa ---------------------------------------
  const tipoDi = (rel) => piano(rel).map((p) => p.tipo).join(',');
  verifica('una SKILL.md di progetto accende il frontmatter', tipoDi('.claude/skills/review/SKILL.md') === 'frontmatter');
  verifica('una SKILL.md di Codex accende il frontmatter', tipoDi('.codex/skills/review/SKILL.md') === 'frontmatter');
  verifica('una SKILL.md del pacchetto accende il frontmatter', tipoDi('plugins/daiku/skills/review/SKILL.md') === 'frontmatter');
  verifica('project.json accende il controllo JSON', tipoDi('.daiku/project.json') === 'json');
  verifica('environment.json accende il controllo JSON', tipoDi('.daiku/environment.json') === 'json');
  verifica('una rule di area accende il suo frontmatter', tipoDi('.daiku/policies/backend.md') === 'policy');
  verifica('una guardia Claude accende il proprio banco', tipoDi('.claude/hooks/command-guard.mjs') === 'banco');
  verifica('una guardia Codex accende il proprio banco', tipoDi('.codex/hooks/command-guard.mjs') === 'banco');
  verifica('una guardia non accende anche gli altri controlli', piano('.claude/hooks/command-guard.mjs').length === 1);

  // Fuori perimetro: silenzio, nessuna lettura e nessun processo.
  for (const fuori of [
    'src/index.ts',
    'README.md',
    '.daiku/domain/perf.md',
    '.daiku/policies/README.md',
    'docs/nuovi-sviluppi/x/0. problem.md',
    'package.json',
  ]) {
    verifica(`fuori perimetro: \`${fuori}\``, piano(fuori).length === 0);
  }
  verifica('path fuori dalla radice: nessun piano', piano(relativoAllaRadice('C:/altro/x.md', R)).length === 0);
  verifica('path assente: nessun piano', piano(null).length === 0);

  // --- la normalizzazione del path scritto -----------------------------------
  verifica('path assoluto normalizzato', relativoAllaRadice(`${R}/.daiku/project.json`, R) === '.daiku/project.json');
  verifica('path con backslash normalizzato', relativoAllaRadice('C:\\dev\\progetto\\.daiku\\project.json', R) === '.daiku/project.json');
  verifica('path relativo conservato', relativoAllaRadice('.daiku/project.json', R) === '.daiku/project.json');
  verifica('path fuori radice: null', relativoAllaRadice('C:/dev/altro/x.md', R) === null);

  // --- il frontmatter: le due forme che svuotano i metadati ------------------
  const sana = "---\nname: review\ndescription: 'Ciclo di review su un diff'\n---\n\nCorpo.\n";
  verifica('un frontmatter quotato non ha rilievi', rilieviFrontmatter(sana).length === 0);

  const duePunti = '---\nname: review\ndescription: Ciclo di review: un diff alla volta\n---\n';
  verifica('`: ` non quotato e\' un rilievo', rilieviFrontmatter(duePunti).some((r) => r.includes('chiude la chiave')));

  const quadra = "---\nname: review\ndescription: 'x'\nargument-hint: [cartella] [soluzione]\n---\n";
  verifica('`[` non quotata e\' un rilievo', rilieviFrontmatter(quadra).some((r) => r.includes('sequenza di flusso')));

  const quadraQuotata = "---\nname: review\ndescription: 'x'\nargument-hint: '[cartella] [soluzione]'\n---\n";
  verifica('`[` quotata non e\' un rilievo', rilieviFrontmatter(quadraQuotata).length === 0);

  const duePuntiQuotati = "---\nname: review\ndescription: 'Ciclo di review: un diff alla volta'\n---\n";
  verifica('`: ` dentro le quote non e\' un rilievo', rilieviFrontmatter(duePuntiQuotati).length === 0);

  verifica('niente frontmatter e\' un rilievo', rilieviFrontmatter('# Solo prosa\n').length === 1);
  verifica('frontmatter non chiuso e\' un rilievo', rilieviFrontmatter('---\nname: x\n').length === 1);
  verifica('name mancante e\' un rilievo', rilieviFrontmatter("---\ndescription: 'x'\n---\n").some((r) => r.includes('manca `name`')));
  verifica('description vuota e\' un rilievo', rilieviFrontmatter('---\nname: x\ndescription:\n---\n').some((r) => r.includes('`description` e\' vuota')));
  verifica('CRLF non cambia il verdetto', rilieviFrontmatter(sana.replace(/\n/g, '\r\n')).length === 0);
  verifica(
    'una chiave annidata non si giudica come di primo livello',
    rilieviFrontmatter("---\nname: x\ndescription: 'x'\nmetadata:\n  type: project: rotto\n---\n").length === 0
  );

  // --- gli altri due controlli ------------------------------------------------
  verifica('un JSON valido non ha rilievi', rilieviJson('{"a": 1}').length === 0);
  verifica('un JSON rotto e\' un rilievo', rilieviJson('{"a": 1,}').length === 1);
  verifica('una rule con paths non ha rilievi', rilieviPolicy("---\npaths: ['src/**']\n---\n").length === 0);
  verifica('una rule senza paths e\' un rilievo', rilieviPolicy('---\nnome: x\n---\n').length === 1);
  verifica('una rule senza frontmatter e\' un rilievo', rilieviPolicy('# prosa\n').length === 1);

  // --- il referto: cosa riporta e cosa tace -----------------------------------
  const pulito = ambienteFinto({ [`${R}/.claude/skills/review/SKILL.md`]: sana });
  verifica('contratto sano: nessun referto', referto('.claude/skills/review/SKILL.md', R, pulito) === null);

  const rotto = ambienteFinto({ [`${R}/.claude/skills/review/SKILL.md`]: duePunti });
  const testo = referto('.claude/skills/review/SKILL.md', R, rotto);
  verifica('un frontmatter rotto arriva nel referto', !!testo && testo.includes('chiude la chiave'));
  verifica('il referto dichiara che non blocca', !!testo && testo.includes('Non bloccano niente'));
  verifica('il referto nomina il file scritto', !!testo && testo.includes('review/SKILL.md'));

  const bancoRosso = ambienteFinto({}, {
    'command-guard': { stdout: JSON.stringify({ controlli: 57, passati: 56, falliti: ['un caso'] }) },
  });
  const testoBanco = referto('.claude/hooks/command-guard.mjs', R, bancoRosso);
  verifica('un banco rosso arriva nel referto', !!testoBanco && testoBanco.includes('un caso'));

  const bancoVerde = ambienteFinto({}, {
    'command-guard': { stdout: JSON.stringify({ controlli: 57, passati: 57, falliti: [] }) },
  });
  verifica('un banco verde tace', referto('.claude/hooks/command-guard.mjs', R, bancoVerde) === null);

  // --- le degradazioni: ciascuna tace, nessuna solleva ------------------------
  verifica('file sparito: nessun referto', referto('.claude/skills/review/SKILL.md', R, ambienteFinto({})) === null);
  verifica('processo che non parte: nessun referto', referto('.claude/hooks/command-guard.mjs', R, ambienteFinto({}, {})) === null);
  verifica(
    'uscita non parsabile: nessun referto',
    referto('.claude/hooks/command-guard.mjs', R, ambienteFinto({}, { 'command-guard': { stdout: 'BOOM' } })) === null
  );
  verifica(
    'uscita vuota: nessun referto',
    referto('.claude/hooks/command-guard.mjs', R, ambienteFinto({}, { 'command-guard': { stdout: null } })) === null
  );

  process.stdout.write(
    JSON.stringify({ controlli: eseguiti, passati: eseguiti - falliti.length, falliti }, null, 2) + '\n'
  );
  return falliti.length ? 1 : 0;
}

function main() {
  const evento = JSON.parse(readFileSync(0, 'utf-8'));
  const rel = relativoAllaRadice((evento.tool_input || {}).file_path, RADICE);
  const testo = referto(rel, RADICE, AMBIENTE_REALE);
  if (!testo) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: testo },
    })
  );
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

try {
  main();
} catch {
  /* fail-open: non si ferma mai una scrittura gia' avvenuta */
}
process.exit(0);
