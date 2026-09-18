#!/usr/bin/env node
/**
 * Avviso di inizio sessione — SessionStart.
 *
 * Dice all'avvio le due cose che chi apre una sessione **non puo' vedere da solo**, e che
 * scoprirebbe tardi e male:
 *
 *  1. **Daiku non e' aperto su questo progetto, o e' aperto a meta'.** Senza `.daiku/` ogni
 *     contratto gira senza i valori di progetto: non fallisce, *indovina*. E se
 *     `project.json` c'e' ma non e' JSON valido e' peggio ancora, perche' ogni contratto lo
 *     apre prima di agire e si ferma li', uno dopo l'altro, senza che il motivo sia mai
 *     detto in chiaro.
 *  2. **C'e' un lavoro lasciato a meta'.** Una cartella di lavoro che ha gia' il blueprint ma
 *     non le note di review e' un lavoro in volo: chi apre una sessione nuova e ricomincia da
 *     capo perde il brief gia' scritto, e quasi sempre non sa che esisteva.
 *
 * **Le sedi delle cartelle di lavoro sono una convenzione, non un parametro.** `project.json`
 * non dichiara dove stanno, quindi qui si guardano le due sedi che i contratti nominano —
 * `docs/nuovi-sviluppi/` e `sviluppo/nuovi-sviluppi/` — e nient'altro. Chi le tiene altrove
 * non riceve l'avviso: e' una mancanza dichiarata, non un guasto. Meglio tacere che dire a
 * ogni avvio che non si e' trovato niente.
 *
 * Contratto: **fail-open e silenzioso**. Niente da dire, file illeggibile, cartella assente,
 * qualunque errore → non stampa ed esce 0. Non blocca mai una sessione, e non parla mai per
 * dire che va tutto bene: un avviso che arriva sempre smette di essere letto.
 *
 * Banco di prova: `node session-advice.mjs --self-check`. Gira su un filesystem simulato e non
 * tocca niente; il totale e' **contato**, non cablato. Un hook fail-open guasto e'
 * indistinguibile da uno che non ha niente da dire: senza banco, un rename o un layout
 * cambiato lo spegnerebbe in silenzio.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { radiceProgetto } from './project-root.mjs';

const RADICE = radiceProgetto();

const AMBIENTE_REALE = {
  esiste: (percorso) => existsSync(percorso),
  leggi: (percorso) => readFileSync(percorso, 'utf-8'),
  elenca: (percorso) => {
    try {
      return readdirSync(percorso, { withFileTypes: true })
        .filter((v) => v.isDirectory())
        .map((v) => v.name);
    } catch {
      return [];
    }
  },
};

/** Le sedi in cui i contratti tengono le cartelle di lavoro. Convenzione, non parametro. */
const SEDI = ['docs/nuovi-sviluppi', 'sviluppo/nuovi-sviluppi'];

/** Il file che dice «il brief c'e'» e quello che dice «la review e' atterrata». */
const BLUEPRINT = '2. blueprint.md';
const REVIEW = '4. review-notes.md';

/** Daiku e' aperto su questo progetto? E i suoi parametri si leggono? */
export function avvisoInstallazione(radice, amb) {
  const cartella = join(radice, '.daiku');
  if (!amb.esiste(cartella)) return null;

  const parametri = join(radice, '.daiku', 'project.json');
  if (!amb.esiste(parametri)) {
    return (
      '`.daiku/` esiste ma **manca `project.json`**. Ogni contratto lo apre prima di agire: ' +
      'senza, i valori di questo progetto non vengono letti e vengono indovinati. ' +
      'Chiudi l\'installazione con `/init`.'
    );
  }

  try {
    JSON.parse(amb.leggi(parametri));
  } catch (errore) {
    return (
      '**`.daiku/project.json` non e\' JSON valido** — ' +
      `\`${errore.message}\`. Ogni contratto lo apre prima di agire e si ferma li'. ` +
      'Sistemalo prima di lanciare qualunque altra cosa.'
    );
  }

  return null;
}

/** I lavori lasciati a meta': blueprint scritto, review mai atterrata. */
export function avvisoLavoriAperti(radice, amb) {
  const aperti = [];

  for (const sede of SEDI) {
    const base = join(radice, sede);
    if (!amb.esiste(base)) continue;
    for (const slug of amb.elenca(base)) {
      const ha = (file) => amb.esiste(join(base, slug, file));
      if (ha(BLUEPRINT) && !ha(REVIEW)) aperti.push(`${sede}/${slug}`);
    }
  }

  if (!aperti.length) return null;

  const elenco = aperti.map((p) => `- \`${p}\``).join('\n');
  const uno = aperti.length === 1;
  return (
    `${uno ? 'Un lavoro e\' rimasto' : `${aperti.length} lavori sono rimasti`} a meta': il ` +
    `brief c'e', le note di review no.\n\n${elenco}\n\n` +
    `**Riprendi da li', non da capo.** Il blueprint porta il piano a task, la Memoria e il ` +
    `Diario di quello che e' gia' stato fatto: ricominciare lo butta via e rifa' scelte ` +
    `gia' prese. Se invece il lavoro e' morto, togli la cartella — finche' resta, questo ` +
    `avviso torna a ogni avvio.`
  );
}

export function avvisi(radice, amb) {
  return [avvisoInstallazione(radice, amb), avvisoLavoriAperti(radice, amb)].filter(Boolean);
}

// --- banco di prova -----------------------------------------------------------

/** Un ambiente simulato: una mappa path → contenuto. Le directory si deducono dai path. */
function ambienteFinto(file) {
  const chiave = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const mappa = new Map(Object.entries(file).map(([k, v]) => [chiave(k), v]));
  const cartelle = new Set();
  for (const percorso of mappa.keys()) {
    const pezzi = percorso.split('/');
    for (let i = 1; i < pezzi.length; i += 1) cartelle.add(pezzi.slice(0, i).join('/'));
  }
  return {
    esiste: (p) => mappa.has(chiave(p)) || cartelle.has(chiave(p)),
    leggi: (p) => {
      if (!mappa.has(chiave(p))) throw new Error(`ENOENT ${p}`);
      return mappa.get(chiave(p));
    },
    elenca: (p) => {
      const base = chiave(p) + '/';
      const figli = new Set();
      for (const percorso of [...mappa.keys(), ...cartelle]) {
        if (!percorso.startsWith(base)) continue;
        const resto = percorso.slice(base.length).split('/')[0];
        if (resto && cartelle.has(base + resto)) figli.add(resto);
      }
      return [...figli];
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

  // --- l'installazione --------------------------------------------------------
  verifica('nessun .daiku/: nessun avviso, non e\' un progetto Daiku', avvisoInstallazione(R, ambienteFinto({})) === null);

  const sano = { [`${R}/.daiku/project.json`]: '{"contract": 1, "name": "x"}' };
  verifica('installazione sana: nessun avviso', avvisoInstallazione(R, ambienteFinto(sano)) === null);

  const senzaParametri = { [`${R}/.daiku/environment.json`]: '{}' };
  const testoSenza = avvisoInstallazione(R, ambienteFinto(senzaParametri));
  verifica('.daiku/ senza project.json: avviso', !!testoSenza && testoSenza.includes('manca `project.json`'));
  verifica('l\'avviso indica come chiudere l\'installazione', !!testoSenza && testoSenza.includes('/init'));

  const rotto = { [`${R}/.daiku/project.json`]: '{"contract": 1,}' };
  const testoRotto = avvisoInstallazione(R, ambienteFinto(rotto));
  verifica('project.json non parsabile: avviso', !!testoRotto && testoRotto.includes('non e\' JSON valido'));
  verifica('l\'avviso porta il messaggio del parser', !!testoRotto && testoRotto.length > 80);

  // --- i lavori a meta' -------------------------------------------------------
  verifica('nessuna sede: nessun avviso', avvisoLavoriAperti(R, ambienteFinto({})) === null);

  const chiuso = {
    [`${R}/docs/nuovi-sviluppi/alfa/2. blueprint.md`]: 'x',
    [`${R}/docs/nuovi-sviluppi/alfa/4. review-notes.md`]: 'x',
  };
  verifica('lavoro chiuso: nessun avviso', avvisoLavoriAperti(R, ambienteFinto(chiuso)) === null);

  const soloProblema = { [`${R}/docs/nuovi-sviluppi/beta/0. problem.md`]: 'x' };
  verifica('studio senza blueprint: non e\' un lavoro in volo', avvisoLavoriAperti(R, ambienteFinto(soloProblema)) === null);

  const aperto = { [`${R}/docs/nuovi-sviluppi/gamma/2. blueprint.md`]: 'x' };
  const testoAperto = avvisoLavoriAperti(R, ambienteFinto(aperto));
  verifica('blueprint senza review: avviso', !!testoAperto && testoAperto.includes('gamma'));
  verifica('l\'avviso dice di riprendere, non di ricominciare', !!testoAperto && testoAperto.includes('non da capo'));
  verifica('l\'avviso dice come farlo smettere', !!testoAperto && testoAperto.includes('togli la cartella'));
  verifica('un solo lavoro si accorda al singolare', !!testoAperto && testoAperto.includes('e\' rimasto'));

  const altraSede = { [`${R}/sviluppo/nuovi-sviluppi/delta/2. blueprint.md`]: 'x' };
  verifica('l\'altra sede convenzionale e\' guardata', (avvisoLavoriAperti(R, ambienteFinto(altraSede)) || '').includes('delta'));

  const due = {
    [`${R}/docs/nuovi-sviluppi/gamma/2. blueprint.md`]: 'x',
    [`${R}/sviluppo/nuovi-sviluppi/delta/2. blueprint.md`]: 'x',
  };
  const testoDue = avvisoLavoriAperti(R, ambienteFinto(due));
  verifica('due lavori: entrambi elencati', !!testoDue && testoDue.includes('gamma') && testoDue.includes('delta'));
  verifica('due lavori si accordano al plurale', !!testoDue && testoDue.includes('2 lavori sono rimasti'));

  const fuoriSede = { [`${R}/altrove/epsilon/2. blueprint.md`]: 'x' };
  verifica('fuori dalle sedi convenzionali: silenzio, come dichiarato', avvisoLavoriAperti(R, ambienteFinto(fuoriSede)) === null);

  // --- l'insieme --------------------------------------------------------------
  verifica('progetto pulito: nessun avviso', avvisi(R, ambienteFinto(sano)).length === 0);
  verifica('due problemi distinti: due avvisi', avvisi(R, ambienteFinto({ ...rotto, ...aperto })).length === 2);
  verifica('progetto vergine: nessun avviso', avvisi(R, ambienteFinto({})).length === 0);

  process.stdout.write(
    JSON.stringify({ controlli: eseguiti, passati: eseguiti - falliti.length, falliti }, null, 2) + '\n'
  );
  return falliti.length ? 1 : 0;
}

function main() {
  const testi = avvisi(RADICE, AMBIENTE_REALE);
  if (!testi.length) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: testi.join('\n\n---\n\n') },
    })
  );
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

try {
  main();
} catch {
  /* fail-open: non si blocca mai una sessione */
}
process.exit(0);
