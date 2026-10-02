#!/usr/bin/env node
/**
 * Fan-out di `/daiku:research`: N tecnologie in parallelo, un file di appunti ciascuna in
 * `.daiku/studies/`.
 *
 *   node .docs/tools/ricerca.mjs <tecnologia> […] [--elenco <file>] [--parallelo N]
 *                                [--budget <usd>] [--modello <m>] [--tempo <minuti>]
 *   node .docs/tools/ricerca.mjs --self-check
 *
 * **Perché un processo e non un subagent.** `/daiku:research` non si può scrivere da un tool Bash —
 * il presidio di macchina nega le righe di comando che contengono un token che comincia per `/`,
 * scambiandolo per un path assoluto — quindi chi lo lancia deve essere un processo. E una corsa di
 * `research` è già un orchestratore, che apre i suoi subagent uno per blocco tematico: tenerla dentro
 * un'altra sessione la farebbe crescere di una corsa intera per tecnologia.
 *
 * **Un target è il nome di una tecnologia** (`TanStack Query`, `pydantic v2`, `DBOS`), ed è tutto il
 * suo `$ARGUMENTS`. `research` ne deriva lo slug e scrive `.daiku/studies/<slug>.md`; lo slug lo
 * calcola anche questo script, **prima** di lanciare, perché è l'unico modo per sapere dove guardare
 * alla fine e per accorgersi che due target collassano sullo stesso file: due corse scriverebbero lo
 * stesso appunto, e una delle due sparirebbe in silenzio.
 *
 * **Alla fine ogni appunto si controlla**: esiste, non è vuoto, ed è stato scritto dopo l'avvio —
 * `research` aggiorna un file che trova invece di ricrearlo, e senza la data un appunto vecchio
 * passerebbe per il lavoro di questa corsa. I file toccati che nessun target rivendica si stampano
 * come **orfani**: una corsa ha scritto con un altro nome, e si legge invece di perderla.
 *
 * Nessuno stato su disco e nessun verbo: si lancia, aspetta, e dice cosa è atterrato. I log stanno in
 * `%TEMP%/daiku-ricerca/<id>/`, fuori dal repository — sono attrezzo, non risultato.
 *
 * Convenzione d'uscita come gli altri attrezzi: `0` se tutto verde, `1` al primo controllo rosso,
 * `2` per uso errato.
 */

import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const DEV = resolve(QUI, '..', '..'); // radice del repository di sviluppo
const APPUNTI_REL = '.daiku/studies'; // la sede degli appunti, relativa alla radice
const APPUNTI = join(DEV, APPUNTI_REL);
const LOG = join(tmpdir(), 'daiku-ricerca');

/** La nota che viaggia in ogni corsa: senza, due corse parallele si pestano i piedi. */
const NOTA = 'Sei una corsa di un fan-out: altre corse di /daiku:research girano in parallelo nello '
  + 'stesso albero di lavoro. Scrivi solo il tuo file in .daiku/studies/ e non toccare gli altri file '
  + 'o le cartelle delle altre corse. Non committare e non mettere niente in stage.';

function muori(codice, messaggio) {
  process.stderr.write(`ricerca: ${messaggio}\n`);
  process.exit(codice);
}

function uso() {
  muori(2, 'uso: ricerca.mjs <tecnologia> […] [--elenco <file>] [--parallelo N] [--budget <usd>] '
    + '[--modello <m>] [--tempo <minuti>]\n'
    + '     ricerca.mjs --self-check');
}

// --- funzioni pure: quelle che il banco prova -------------------------------------------

/** Le righe utili di un elenco: una per riga, i vuoti si scartano, e ogni target compare una volta
 *  sola nell'ordine in cui è stato scritto. In un file `#` apre un commento. */
function leggiLista(testo) {
  const fuori = [];
  const visti = new Set();
  for (const riga of String(testo).split(/\r?\n/)) {
    const netta = riga.replace(/#.*$/, '').trim();
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

/** Lo slug di una tecnologia, come `/daiku:research` lo deriva dal nome: minuscolo, ogni sequenza di
 *  caratteri che non sia lettera o cifra diventa un trattino, e i trattini di bordo si tolgono —
 *  `TanStack Query` → `tanstack-query`. */
function slugDaTecnologia(nome) {
  return String(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Gli appunti attesi: `{target, slug, path}` per target, o `muori(2)` se due target collassano
 *  sullo stesso file. */
function appuntiAttesi(target) {
  const attesi = [];
  const perSlug = new Map();
  for (const t of target) {
    const slug = slugDaTecnologia(t);
    if (!slug) muori(2, `il target ${JSON.stringify(t)} non ha nessuna lettera o cifra da cui trarre uno slug`);
    if (perSlug.has(slug)) {
      muori(2, `${perSlug.get(slug)} e ${t} scriverebbero lo stesso appunto: ${APPUNTI_REL}/${slug}.md`);
    }
    const vietato = carattereVietato(t);
    if (vietato) muori(2, `il target ${JSON.stringify(t)} contiene ${JSON.stringify(vietato)}: la riga di comando di Windows non lo porta`);
    perSlug.set(slug, t);
    attesi.push({ target: t, slug, path: `${APPUNTI_REL}/${slug}.md` });
  }
  return attesi;
}

/** La riga di comando di una corsa, come la esegue `lancia`. */
function rigaComando(target, opzioni) {
  const parti = ['claude', '-p', `"/daiku:research ${target}"`, '--permission-mode', 'bypassPermissions', '--no-session-persistence'];
  if (opzioni.modello) parti.push('--model', opzioni.modello);
  if (opzioni.budget) parti.push('--max-budget-usd', String(opzioni.budget));
  parti.push('--append-system-prompt', `"${NOTA}"`);
  return parti.join(' ');
}

/**
 * L'esito di un target: l'appunto c'è, non è vuoto, ed è stato scritto dopo l'avvio. Pura: `leggi` e
 * `mtime` leggono il disco, il banco li sostituisce con una mappa.
 *
 * I file toccati che nessun target rivendica sono `orfani` — una corsa ha scritto con un altro nome,
 * e si legge invece di perderla.
 */
function esitoDegliAppunti(attesi, { leggi, mtime, elenca, inizio }) {
  const esiti = attesi.map((a) => {
    const testo = leggi(a.path);
    if (testo === null) return { ...a, stato: 'assente' };
    if (!testo.trim()) return { ...a, stato: 'vuoto' };
    const quando = mtime(a.path);
    return { ...a, stato: quando === null || quando <= inizio ? 'non riscritto' : 'ok' };
  });
  const rivendicati = new Set(attesi.map((a) => a.path));
  const orfani = elenca(APPUNTI_REL)
    .filter((n) => n.endsWith('.md'))
    .map((n) => `${APPUNTI_REL}/${n}`)
    .filter((p) => !rivendicati.has(p) && (mtime(p) ?? 0) > inizio);
  return { esiti, orfani };
}

// --- gli argomenti ----------------------------------------------------------------------

/** `{target, opzioni}` dagli argomenti; `muori(2)` su qualunque forma ignota. */
function argomentiDaRiga(argv) {
  const target = [];
  const opzioni = {};
  const valore = (i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) muori(2, `${argv[i]} vuole un valore`);
    return v;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--elenco') opzioni.elenco = valore(i), i += 1;
    else if (a === '--parallelo') opzioni.parallelo = valore(i), i += 1;
    else if (a === '--budget') opzioni.budget = valore(i), i += 1;
    else if (a === '--modello') opzioni.modello = valore(i), i += 1;
    else if (a === '--tempo') opzioni.tempo = valore(i), i += 1;
    else if (a.startsWith('--')) muori(2, `opzione ignota: ${a}`);
    else target.push(a);
  }
  const parallelo = opzioni.parallelo === undefined ? 3 : Number(opzioni.parallelo);
  if (!Number.isInteger(parallelo) || parallelo < 1 || parallelo > 8) muori(2, `--parallelo vuole un intero fra 1 e 8, non ${opzioni.parallelo}`);
  opzioni.parallelo = parallelo;
  const tempo = opzioni.tempo === undefined ? 180 : Number(opzioni.tempo);
  if (!Number.isFinite(tempo) || tempo <= 0) muori(2, `--tempo vuole i minuti, non ${opzioni.tempo}`);
  opzioni.tempo = tempo;
  if (opzioni.budget !== undefined && !Number.isFinite(Number(opzioni.budget))) muori(2, `--budget vuole un numero, non ${opzioni.budget}`);
  return { target, opzioni };
}

/** L'elenco: il file se c'è, più i target scritti a mano, senza doppioni e senza commenti. */
function elencoDelFanout({ elenco, target }) {
  const righe = [];
  if (elenco) {
    const testo = (() => {
      try {
        return readFileSync(resolve(elenco), 'utf-8');
      } catch {
        muori(2, `elenco non leggibile: ${elenco}`);
      }
    })();
    righe.push(...leggiLista(testo));
  }
  righe.push(...leggiLista(target.join('\n')));
  if (!righe.length) muori(2, 'nessun target: le tecnologie sulla riga, oppure --elenco <file>');
  return righe;
}

// --- lancia -----------------------------------------------------------------------------

/** Lancia una corsa e torna una promessa col suo esito. Il log porta stdout e stderr insieme. */
function lanciaCorsa(target, indice, cartellaLog, opzioni) {
  const nome = `${String(indice + 1).padStart(2, '0')} — ${target.replace(/[^A-Za-z0-9._-]+/g, '-')}`.slice(0, 80);
  const log = join(cartellaLog, `${nome}.log`);
  const fd = openSync(log, 'w');
  const riga = rigaComando(target, opzioni);
  writeFileSync(fd, `$ ${riga}\n\n`);
  const figlio = spawn(riga, { cwd: DEV, shell: true, stdio: ['ignore', fd, fd], windowsHide: true });
  const inizio = Date.now();
  return new Promise((risolvi) => {
    let scaduto = false;
    let chiuso = false;
    const scadenza = setTimeout(() => {
      scaduto = true;
      try {
        figlio.kill();
      } catch {
        /* già morto */
      }
    }, opzioni.tempo * 60000);
    const chiudi = (uscita) => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(scadenza);
      closeSync(fd);
      risolvi({ target, log, uscita, scaduto, minuti: ((Date.now() - inizio) / 60000).toFixed(1) });
    };
    figlio.on('error', () => chiudi(null));
    figlio.on('close', (codice) => chiudi(codice));
  });
}

const STATI = {
  ok: 'scritto',
  assente: 'non esiste',
  vuoto: 'vuoto',
  'non riscritto': 'non riscritto dopo l avvio',
};

async function fanout() {
  const parsed = argomentiDaRiga(process.argv.slice(2));
  const target = elencoDelFanout(parsed);
  const attesi = appuntiAttesi(target);
  const id = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const cartellaLog = join(LOG, id);
  mkdirSync(cartellaLog, { recursive: true });
  const inizio = Date.now();

  process.stdout.write(`ricerca: ${target.length} tecnologie, ${parsed.opzioni.parallelo} insieme, log in ${cartellaLog}\n`);
  const esiti = [];
  let prossimo = 0;
  async function lavoratore() {
    while (prossimo < target.length) {
      const indice = prossimo;
      prossimo += 1;
      const esito = await lanciaCorsa(target[indice], indice, cartellaLog, parsed.opzioni);
      esiti.push(esito);
      process.stdout.write(`  ${esito.uscita === 0 ? 'ok  ' : 'KO  '} ${esito.target} (${esito.minuti} min)${esito.scaduto ? ' — uccisa: tempo scaduto' : ''}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parsed.opzioni.parallelo, target.length) }, lavoratore));

  const { esiti: appunti, orfani } = esitoDegliAppunti(attesi, {
    leggi: (p) => {
      try {
        return readFileSync(join(DEV, p), 'utf-8');
      } catch {
        return null;
      }
    },
    mtime: (p) => {
      try {
        return statSync(join(DEV, p)).mtimeMs;
      } catch {
        return null;
      }
    },
    elenca: () => {
      try {
        return readdirSync(APPUNTI);
      } catch {
        return [];
      }
    },
    inizio,
  });

  process.stdout.write(`\nappunti:\n`);
  for (const a of appunti) {
    process.stdout.write(`  ${a.stato === 'ok' ? 'ok  ' : 'KO  '} ${a.target} — ${a.path}: ${STATI[a.stato] || a.stato}\n`);
  }
  for (const o of orfani) process.stdout.write(`  orfano: ${o} — nessun target lo rivendica\n`);

  const rossi = appunti.filter((a) => a.stato !== 'ok');
  process.stdout.write(`${JSON.stringify({ tecnologie: target.length, scritti: appunti.length - rossi.length, ko: rossi.map((a) => a.path), orfani })}\n`);
  process.exit(rossi.length ? 1 : 0);
}

// --- il banco delle funzioni pure --------------------------------------------------------

function selfCheck() {
  const casi = [];
  const ok = (nome, cond) => casi.push([nome, !!cond]);
  const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  ok('lista: commenti, vuoti e doppioni', uguale(
    leggiLista('# nota\nzod\n\n  zod  \nTanStack Query # inline\n'),
    ['zod', 'TanStack Query']
  ));
  ok('lista: il nome con lo spazio resta intero', uguale(leggiLista('pydantic v2'), ['pydantic v2']));
  ok('lista: vuota resta vuota', uguale(leggiLista('\n\n# solo commenti\n'), []));

  ok('vietati: virgolette rifiutate', carattereVietato('la libreria "x"') === '"');
  ok('vietati: percento rifiutato', carattereVietato('100%') === '%');
  ok('vietati: un nome normale è ammesso', carattereVietato('TanStack Query v2') === null);

  ok('slug: TanStack Query', slugDaTecnologia('TanStack Query') === 'tanstack-query');
  ok('slug: dbos python', slugDaTecnologia('dbos python') === 'dbos-python');
  ok('slug: un pacchetto con scope', slugDaTecnologia('@tanstack/react-query') === 'tanstack-react-query');
  ok('slug: i trattini di bordo se ne vanno', slugDaTecnologia('  --DBOS--  ') === 'dbos');
  ok('slug: gli appunti attesi portano slug e path', uguale(
    appuntiAttesi(['pydantic v2', 'DBOS']),
    [
      { target: 'pydantic v2', slug: 'pydantic-v2', path: '.daiku/studies/pydantic-v2.md' },
      { target: 'DBOS', slug: 'dbos', path: '.daiku/studies/dbos.md' },
    ]
  ));

  const riga = rigaComando('pydantic v2', {});
  ok('riga: comando slash in testa', riga.startsWith('claude -p "/daiku:research pydantic v2"'));
  ok('riga: bypass e nessuna sessione', riga.includes('--permission-mode bypassPermissions') && riga.includes('--no-session-persistence'));
  ok('riga: modello e budget solo se chiesti', !riga.includes('--model') && rigaComando('x', { modello: 'opus', budget: '5' }).includes('--max-budget-usd 5'));

  // L'esito: il file c'è, non è vuoto, ed è stato toccato dopo l'avvio.
  const INIZIO = Date.parse('2026-10-02T10:00:00.000Z');
  const attesi = [
    { target: 'uno', slug: 'uno', path: '.daiku/studies/uno.md' },
    { target: 'due', slug: 'due', path: '.daiku/studies/due.md' },
    { target: 'tre', slug: 'tre', path: '.daiku/studies/tre.md' },
    { target: 'quattro', slug: 'quattro', path: '.daiku/studies/quattro.md' },
  ];
  const testi = {
    '.daiku/studies/uno.md': '# Uno\n\nroba',
    '.daiku/studies/due.md': '   ',
    '.daiku/studies/tre.md': '# Tre\n\nroba',
    '.daiku/studies/altro-nome.md': '# Altro\n\nroba',
  };
  const quando = {
    '.daiku/studies/uno.md': INIZIO + 60000,
    '.daiku/studies/due.md': INIZIO + 60000,
    '.daiku/studies/tre.md': INIZIO - 60000,
    '.daiku/studies/altro-nome.md': INIZIO + 60000,
  };
  const esito = esitoDegliAppunti(attesi, {
    leggi: (p) => testi[p] ?? null,
    mtime: (p) => quando[p] ?? null,
    elenca: () => Object.keys(testi).map((p) => p.split('/').pop()),
    inizio: INIZIO,
  });
  ok('esito: un appunto riscritto è ok', esito.esiti[0].stato === 'ok');
  ok('esito: un appunto vuoto è rosso', esito.esiti[1].stato === 'vuoto');
  ok('esito: un appunto non riscritto è rosso', esito.esiti[2].stato === 'non riscritto');
  ok('esito: un appunto assente è rosso', esito.esiti[3].stato === 'assente');
  ok('esito: chi scrive con un altro nome resta orfano', uguale(esito.orfani, ['.daiku/studies/altro-nome.md']));

  const rossi = casi.filter(([, passed]) => !passed);
  for (const [nome] of rossi) process.stderr.write(`red: ${nome}\n`);
  process.stdout.write(`${JSON.stringify({ checks: casi.length, passed: casi.length - rossi.length, failed: rossi.map(([n]) => n) })}\n`);
  process.exit(rossi.length ? 1 : 0);
}

// --- ingresso ------------------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes('--self-check')) selfCheck();
if (!argv.length) uso();
await fanout();
