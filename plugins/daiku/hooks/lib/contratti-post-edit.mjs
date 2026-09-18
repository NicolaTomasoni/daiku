#!/usr/bin/env node
/**
 * PostToolUse su `Edit|Write|MultiEdit` — accende i controlli deterministici sul gesto
 * che introduce il difetto, invece che sul gesto che questo progetto non fa.
 *
 * `docs/scripts/check-contratti.py` deve partire sul gesto che riscrive il corpus, perché
 * gli applicatori che lo riscrivono ogni giorno possono **non committare**: due giri di audit
 * si sono chiusi entrambi con «nessun commit, tutto nel working tree», e in due giri quei
 * controlli non sono mai scattati da soli. Un
 * `{chiave}` inesistente, un path citato e mai creato, un `\t` mangiato dentro un comando
 * restano nel corpus finche' qualcuno non committa — e nel frattempo un subagent li esegue
 * alla lettera. Stessa storia per i banchi di prova delle guardie e del driver: esistono,
 * e nessun gesto li lancia.
 *
 * **Segnala, non ferma.** L'uscita e' sempre `0` e non c'e' nessun ramo che blocchi:
 * fermare a meta' la scrittura di un applicatore costa piu' del difetto che si chiude. Il
 * referto arriva come contesto, e chi ha appena scritto decide.
 *
 * **Fail-open e silenzioso.** Stdin illeggibile, path fuori perimetro, venv assente, `node`
 * o `python` che non partono, uscita non parsabile, timeout → non stampa niente ed esce 0.
 * E' la stessa scelta delle altre due guardie, con lo stesso prezzo: un guasto e'
 * indistinguibile dal silenzio. Per questo il perimetro ha un banco di prova.
 *
 * `non_tracciati` **non** compare nel referto, per disegno: e' una proprieta' del
 * repository, non di quello che hai appena scritto, e ripeterla a ogni Edit farebbe
 * ignorare anche le violazioni vere.
 *
 * Banco di prova: `node .claude/hooks/contratti-post-edit.mjs --self-check`. Il totale e'
 * contato, non cablato.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative } from 'node:path';

const RADICE = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** I due layout del venv del backend. */
const PYTHON = ['apps/backend/venv/Scripts/python.exe', 'apps/backend/venv/bin/python'];

/** Il path scritto, ridotto a relativo posix dalla radice tecnica. `null` se sta fuori. */
function relativoAllaRadice(percorso, radice) {
  if (!percorso) return null;
  const assoluto = isAbsolute(percorso) ? percorso : join(radice, percorso);
  const rel = relative(radice, assoluto).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../')) return null;
  return rel;
}

/**
 * Cosa vale la pena lanciare dopo aver scritto `rel`. Funzione pura: e' il perimetro, ed e'
 * la parte che il banco di prova verifica.
 */
export function piano(rel) {
  if (!rel) return [];

  // Una guardia riscritta si verifica col proprio banco, non col checker del corpus: il
  // checker legge markdown e su un `.mjs` non ha niente da dire.
  const guardia = rel.match(/^\.claude\/hooks\/([A-Za-z0-9_.-]+)\.mjs$/);
  if (guardia) {
    return [{ etichetta: `banco di prova di ${guardia[1]}`, tipo: 'node', script: rel }];
  }

  if (rel === 'docs/scripts/enabling-loop.py') {
    return [{ etichetta: 'banco di prova del driver di abilitazione', tipo: 'python', script: rel }];
  }

  // Il checker del corpus: sul corpus, e su se stesso.
  if (
    rel === 'docs/scripts/check-contratti.py' ||
    rel === 'CLAUDE.md' ||
    rel.startsWith('.claude/') ||
    rel.startsWith('.agents/')
  ) {
    return [
      { etichetta: 'controlli sul corpus dei contratti', tipo: 'contratti', script: 'docs/scripts/check-contratti.py' },
    ];
  }

  return [];
}

function python(radice, amb) {
  for (const candidato of PYTHON) {
    if (amb.esiste(join(radice, candidato))) return join(radice, candidato);
  }
  return null;
}

/** Lancia un passo del piano e restituisce le righe da riportare. `[]` se tace o se degrada. */
function esegui(passo, radice, amb) {
  let argv;
  if (passo.tipo === 'node') {
    argv = ['node', [join(radice, passo.script), '--self-check']];
  } else {
    const py = python(radice, amb);
    if (!py) return []; // venv assente: degradazione aperta
    argv = [py, [join(radice, passo.script), ...(passo.tipo === 'python' ? ['--self-check'] : [])]];
  }

  const esito = amb.lancia(argv[0], argv[1]);
  if (!esito || esito.stdout == null) return [];
  let referto;
  try {
    referto = JSON.parse(esito.stdout);
  } catch {
    return []; // uscita non parsabile: non si inventa un verdetto
  }

  // Solo le violazioni. `non_tracciati` e' una proprieta' del repository, non del gesto.
  const rilievi = referto.violazioni || referto.falliti || [];
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
  esiste: (percorso) => existsSync(percorso),
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

function ambienteFinto(presenti, risposte) {
  const chiave = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const insieme = new Set(presenti.map(chiave));
  return {
    esiste: (p) => insieme.has(chiave(p)),
    lancia: (comando, argomenti) => {
      const script = chiave(argomenti[0]);
      for (const [frammento, risposta] of Object.entries(risposte)) {
        if (script.includes(frammento)) return risposta;
      }
      return null;
    },
  };
}

const R = 'C:/dev/ReforgIA/src';
const VENV = `${R}/apps/backend/venv/Scripts/python.exe`;

function selfCheck() {
  const falliti = [];
  let eseguiti = 0;
  const verifica = (nome, condizione) => {
    eseguiti += 1;
    if (!condizione) falliti.push(nome);
  };

  // Il perimetro: cosa fa scattare cosa.
  const tipoDi = (rel) => piano(rel).map((p) => p.tipo).join(',');
  verifica('un contratto accende il checker del corpus', tipoDi('.claude/commands/review.md') === 'contratti');
  verifica('un agent accende il checker del corpus', tipoDi('.claude/agents/finder.md') === 'contratti');
  verifica('una rule accende il checker del corpus', tipoDi('.claude/rules/backend-architecture.md') === 'contratti');
  verifica('il CLAUDE.md di radice accende il checker', tipoDi('CLAUDE.md') === 'contratti');
  verifica('un pointer portabile accende il checker', tipoDi('.agents/skills/review/SKILL.md') === 'contratti');
  verifica('il checker accende se stesso', tipoDi('docs/scripts/check-contratti.py') === 'contratti');
  verifica('una guardia accende il proprio banco', tipoDi('.claude/hooks/guardia-comandi.mjs') === 'node');
  verifica('l\'altro hook accende il proprio banco', tipoDi('.claude/hooks/ciclo-aperto.mjs') === 'node');
  verifica('il driver accende il proprio banco', tipoDi('docs/scripts/enabling-loop.py') === 'python');
  verifica('una guardia non accende anche il checker del corpus', piano('.claude/hooks/guardia-comandi.mjs').length === 1);

  // Fuori perimetro: silenzio, nessun processo lanciato.
  for (const fuori of [
    'apps/backend/app/models.py',
    'memory/MEMORY.md',
    'docs/nuovi-sviluppi/x/0. problem.md',
    '.dev-runtime/enabling-loop/corrente.json',
    'docs/scripts/propose-catalog-entries.py',
  ]) {
    verifica(`fuori perimetro: \`${fuori}\``, piano(fuori).length === 0);
  }
  verifica('path fuori dalla radice: nessun piano', piano(relativoAllaRadice('C:/altro/x.md', R)).length === 0);
  verifica('path assente: nessun piano', piano(null).length === 0);

  // La normalizzazione del path scritto.
  verifica('path assoluto normalizzato', relativoAllaRadice(`${R}/.claude/orchestration.md`, R) === '.claude/orchestration.md');
  verifica('path con backslash normalizzato', relativoAllaRadice('C:\\dev\\ReforgIA\\src\\CLAUDE.md', R) === 'CLAUDE.md');
  verifica('path relativo conservato', relativoAllaRadice('.claude/project.json', R) === '.claude/project.json');
  verifica('path fuori radice: null', relativoAllaRadice('C:/dev/altro/x.md', R) === null);

  // Il referto: cosa riporta e cosa tace.
  const sano = ambienteFinto([VENV], {
    'check-contratti': { stdout: JSON.stringify({ controlli: 281, violazioni: [], non_tracciati: ['a', 'b'] }) },
  });
  verifica('corpus pulito: nessun referto', referto('.claude/commands/review.md', R, sano) === null);
  verifica(
    'non_tracciati non entra mai nel referto',
    referto('.claude/commands/review.md', R, sano) === null
  );

  const sporco = ambienteFinto([VENV], {
    'check-contratti': {
      stdout: JSON.stringify({ controlli: 281, violazioni: ['x cita `y`, che non esiste'], non_tracciati: ['a'] }),
    },
  });
  const testo = referto('CLAUDE.md', R, sporco);
  verifica('una violazione arriva nel referto', !!testo && testo.includes('che non esiste'));
  verifica('il referto dichiara che non blocca', !!testo && testo.includes('Non bloccano niente'));
  verifica('il referto nomina il file scritto', !!testo && testo.includes('CLAUDE.md'));
  verifica('il referto non nomina i non tracciati', !!testo && !testo.includes('non_tracciati'));

  const bancoRosso = ambienteFinto([VENV], {
    'guardia-comandi': { stdout: JSON.stringify({ controlli: 66, passati: 65, falliti: ['un caso'] }) },
  });
  const testoBanco = referto('.claude/hooks/guardia-comandi.mjs', R, bancoRosso);
  verifica('un banco rosso arriva nel referto', !!testoBanco && testoBanco.includes('un caso'));

  // Le degradazioni: ciascuna tace, nessuna solleva.
  verifica(
    'venv assente: nessun referto',
    referto('.claude/commands/review.md', R, ambienteFinto([], { 'check-contratti': { stdout: '{}' } })) === null
  );
  verifica(
    'processo che non parte: nessun referto',
    referto('.claude/commands/review.md', R, ambienteFinto([VENV], {})) === null
  );
  verifica(
    'uscita non parsabile: nessun referto',
    referto('.claude/commands/review.md', R, ambienteFinto([VENV], { 'check-contratti': { stdout: 'BOOM' } })) === null
  );
  verifica(
    'uscita vuota: nessun referto',
    referto('.claude/commands/review.md', R, ambienteFinto([VENV], { 'check-contratti': { stdout: null } })) === null
  );
  verifica(
    'il banco di un hook non ha bisogno del venv',
    referto('.claude/hooks/ciclo-aperto.mjs', R, ambienteFinto([], { 'ciclo-aperto': { stdout: JSON.stringify({ falliti: ['rotto'] }) } })) !== null
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
