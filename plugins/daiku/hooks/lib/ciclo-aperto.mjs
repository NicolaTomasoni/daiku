#!/usr/bin/env node
/**
 * Avviso di inizio sessione — SessionStart.
 *
 * **1. Il ciclo di abilitazione aperto.**
 * Per tutta la corsa l'albero sotto `apps/` è del ciclo: una modifica fatta a mano
 * mentre gira viene persa al primo ripristino (che riporta i file tracciati a `HEAD`
 * prima di riapplicare la patch), oppure — peggio — entra nello snapshot
 * dell'iterazione successiva, finisce nel diff che la review di chiusura giudica, e
 * quindi nel commit unico della corsa, attribuita al ciclo.
 *
 * Chi apre una seconda sessione non ha nessun segnale: `git status` mostra un albero
 * sporco che sembra lavoro proprio. Questo hook glielo dice, una volta, all'avvio —
 * e gli dice anche **a che punto** è la corsa, perché «aperta» e «in chiusura» non
 * chiedono la stessa cautela.
 *
 * Contratto: **fail-open e silenzioso**. Nessun ciclo aperto, file illeggibile,
 * `git` non interrogabile, qualunque errore → non stampa quell'avviso ed esce 0. Non
 * blocca mai una sessione.
 *
 * Banco di prova: `node .claude/hooks/ciclo-aperto.mjs --self-check`. Gira su un
 * filesystem simulato e non tocca niente; il totale è **contato**, non cablato. Un
 * hook fail-open guasto è indistinguibile da uno che non ha niente da dire: senza
 * banco, un rename o un layout cambiato lo spegnerebbero in silenzio.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RADICE = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const AMBIENTE_REALE = {
  esiste: (percorso) => existsSync(percorso),
  leggi: (percorso) => readFileSync(percorso, 'utf-8'),
};

/** Come si legge lo stadio dichiarato dal ledger, per chi apre una sessione adesso. */
const STADI = {
  'fase-1': 'in **fase 1**, senza agente: il motore sta allargando le mosse deterministiche',
  checkpoint: 'al **checkpoint** fra le due fasi: si sta decidendo se accendere l\'agente',
  'fase-2': 'in **fase 2**, con l\'agente acceso',
  chiusura: 'in **chiusura**: la review finale sta girando, e il commit unico della corsa è vicino',
  chiusa: 'dichiarata **chiusa**, ma `corrente.json` è ancora lì: o la chiusura si è interrotta, o nessuno lo ha rimosso',
};

function avvisoCicloAperto(radice, amb) {
  const puntatore = join(radice, '.dev-runtime', 'enabling-loop', 'corrente.json');
  if (!amb.esiste(puntatore)) return null;

  let stato;
  try {
    const slug = JSON.parse(amb.leggi(puntatore)).slug;
    if (!slug) return null;
    stato = JSON.parse(amb.leggi(join(radice, '.dev-runtime', 'enabling-loop', slug, 'stato.json')));
  } catch {
    return null;
  }

  let iterazioni = 0;
  let stadio = null;
  try {
    // Dalla corsa che dichiara il proprio `corsa` il ledger vive nella sua sottocartella;
    // le corse anteriori a quel cambio lo tengono alla radice dello slug.
    const radiceCiclo = join(radice, '.dev-runtime', 'enabling-loop', stato.slug);
    const ledger = JSON.parse(
      amb.leggi(
        stato.corsa ? join(radiceCiclo, stato.corsa, 'ledger.json') : join(radiceCiclo, 'ledger.json')
      )
    );
    iterazioni = (ledger.iterazioni || []).length;
    stadio = (ledger.corsa && ledger.corsa.stadio) || null;
  } catch {
    /* il ledger può non esserci ancora: l'avviso vale lo stesso */
  }

  const dove = stadio && STADI[stadio] ? ` La corsa è ${STADI[stadio]}.` : '';

  return (
    `Un ciclo di abilitazione è aperto su **${stato.progetto || stato.slug}** ` +
    `(avviato il ${stato.avviato || '?'}, ${iterazioni} iterazioni registrate).${dove}\n\n` +
    `**Per tutta la corsa l'albero sotto \`apps/\` è del ciclo.** Una modifica fatta a mano ` +
    `mentre gira si perde al primo ripristino, oppure entra nello snapshot dell'iterazione ` +
    `successiva e finisce nel commit unico della corsa, attribuita al ciclo. Se \`git status\` ` +
    `mostra sporco sotto \`apps/\`, non è lavoro tuo.\n\n` +
    `Non lanciare \`pytest\`, né un secondo backend (\`pnpm dev\`, \`uvicorn\` a mano), finché ` +
    `la corsa è in volo: istanziano l'app, il suo avvio recupera le run orfane sulla stessa ` +
    `\`DATA_DIR\`, e la run viva si chiude come fallita. Lo stato della corsa: ` +
    `\`enabling-loop.py stato\`.`
  );
}

function avvisi(radice, amb) {
  return [avvisoCicloAperto(radice, amb)].filter(Boolean);
}

// --- banco di prova -----------------------------------------------------------

/** Un ambiente simulato: una mappa path → contenuto. */
function ambienteFinto(file) {
  const chiave = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const mappa = new Map(Object.entries(file).map(([k, v]) => [chiave(k), v]));
  return {
    esiste: (p) => mappa.has(chiave(p)),
    leggi: (p) => {
      if (!mappa.has(chiave(p))) throw new Error(`ENOENT ${p}`);
      return mappa.get(chiave(p));
    },
  };
}

const R = 'C:/dev/ReforgIA/src';
const P = `${R}/.dev-runtime/enabling-loop`;

function selfCheck() {
  const falliti = [];
  let eseguiti = 0;
  const verifica = (nome, condizione) => {
    eseguiti += 1;
    if (!condizione) falliti.push(nome);
  };

  const corsaViva = {
    [`${P}/corrente.json`]: JSON.stringify({ slug: 'gpter-local' }),
    [`${P}/gpter-local/stato.json`]: JSON.stringify({
      slug: 'gpter-local',
      progetto: 'GPTER local',
      avviato: '2026-09-12T11:50:47+00:00',
      corsa: '2026-09-12T11-50-47',
    }),
    [`${P}/gpter-local/2026-09-12T11-50-47/ledger.json`]: JSON.stringify({
      iterazioni: [{ n: 1 }, { n: 2 }, { n: 3 }],
      corsa: { stadio: 'fase-1' },
    }),
  };

  const conCorsa = avvisoCicloAperto(R, ambienteFinto(corsaViva, '.githooks'));
  verifica('la corsa aperta produce un avviso', typeof conCorsa === 'string');
  verifica('l\'avviso nomina il progetto', !!conCorsa && conCorsa.includes('GPTER local'));
  verifica('l\'avviso conta le iterazioni', !!conCorsa && conCorsa.includes('3 iterazioni'));
  verifica('l\'avviso dice a che punto è la corsa', !!conCorsa && conCorsa.includes('fase 1'));
  verifica('l\'avviso ripete il divieto di pytest', !!conCorsa && conCorsa.includes('pytest'));

  // Gli altri quattro stadi che il ledger può dichiarare.
  for (const stadio of ['checkpoint', 'fase-2', 'chiusura', 'chiusa']) {
    const file = { ...corsaViva };
    file[`${P}/gpter-local/2026-09-12T11-50-47/ledger.json`] = JSON.stringify({
      iterazioni: [],
      corsa: { stadio },
    });
    const testo = avvisoCicloAperto(R, ambienteFinto(file, '.githooks'));
    verifica(`lo stadio \`${stadio}\` compare nell'avviso`, !!testo && testo.includes(STADI[stadio].slice(0, 14)));
  }

  // Il ripiego sul layout vecchio: ledger alla radice dello slug, senza `corsa`.
  const layoutVecchio = {
    [`${P}/corrente.json`]: JSON.stringify({ slug: 'gpter-local' }),
    [`${P}/gpter-local/stato.json`]: JSON.stringify({ slug: 'gpter-local', progetto: 'GPTER local' }),
    [`${P}/gpter-local/ledger.json`]: JSON.stringify({ iterazioni: [{ n: 1 }] }),
  };
  const vecchio = avvisoCicloAperto(R, ambienteFinto(layoutVecchio, '.githooks'));
  verifica('il layout anteriore alla sottocartella resta leggibile', !!vecchio && vecchio.includes('1 iterazioni'));

  // Le degradazioni: ciascuna tace, nessuna solleva.
  verifica('nessun ciclo aperto: nessun avviso', avvisoCicloAperto(R, ambienteFinto({}, '.githooks')) === null);
  verifica(
    'corrente.json illeggibile: nessun avviso',
    avvisoCicloAperto(R, ambienteFinto({ [`${P}/corrente.json`]: '{ rotto' }, '.githooks')) === null
  );
  verifica(
    'corrente.json senza slug: nessun avviso',
    avvisoCicloAperto(R, ambienteFinto({ [`${P}/corrente.json`]: '{}' }, '.githooks')) === null
  );
  verifica(
    'stato.json assente: nessun avviso',
    avvisoCicloAperto(R, ambienteFinto({ [`${P}/corrente.json`]: JSON.stringify({ slug: 'x' }) }, '.githooks')) === null
  );
  const senzaLedger = { ...corsaViva };
  delete senzaLedger[`${P}/gpter-local/2026-09-12T11-50-47/ledger.json`];
  const primaDelLedger = avvisoCicloAperto(R, ambienteFinto(senzaLedger, '.githooks'));
  verifica('ledger assente: l\'avviso resta, a zero iterazioni', !!primaDelLedger && primaDelLedger.includes('0 iterazioni'));
  verifica('ledger assente: nessuno stadio inventato', !!primaDelLedger && !primaDelLedger.includes('La corsa è'));
  const stadioIgnoto = { ...corsaViva };
  stadioIgnoto[`${P}/gpter-local/2026-09-12T11-50-47/ledger.json`] = JSON.stringify({
    iterazioni: [],
    corsa: { stadio: 'qualcosa-di-nuovo' },
  });
  verifica(
    'uno stadio che questo hook non conosce non compare, e non rompe',
    !avvisoCicloAperto(R, ambienteFinto(stadioIgnoto, '.githooks')).includes('La corsa è')
  );

  verifica('un ciclo aperto produce un solo avviso', avvisi(R, ambienteFinto(corsaViva)).length === 1);
  verifica('nessun avviso', avvisi(R, ambienteFinto({}, '.githooks')).length === 0);

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
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: testi.join('\n\n---\n\n'),
      },
    })
  );
}

if (process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}

try {
  main();
} catch {
  /* fail-open: mai rompere l'avvio di una sessione */
}
process.exit(0);
