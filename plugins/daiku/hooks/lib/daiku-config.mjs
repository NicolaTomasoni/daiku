/**
 * Il contesto di Daiku su questo progetto, letto da `.daiku/project.json`.
 *
 * Esiste perché due delle tre guardie hanno bisogno degli stessi due fatti — **questo
 * progetto ha aperto Daiku?** e **cosa ha dichiarato?** — e perché la risposta non può
 * stare cablata dentro un hook: un pacchetto installato su un host gira su *ogni*
 * repository che quell'host apre, compresi quelli che Daiku non l'hanno mai visto.
 *
 * Da qui discende la regola che governa tutti e tre gli hook:
 *
 * > **Senza `.daiku/project.json` le guardie tacciono.** Non è una degradazione: è il
 * > confine. Un progetto che non ha aperto Daiku non ha chiesto niente a Daiku, e un
 * > guardrail che nega un comando a chi non l'ha installato è un guasto, non una tutela.
 *
 * È la stessa §6 di `contracts/project-contract.md` — *ciò che il JSON non dichiara non
 * esiste* — applicata a un hook invece che a una skill: nessun valore di ripiego, nessuna
 * euristica, nessun perimetro indovinato.
 *
 * Fail-open come il resto: file assente, JSON rotto, disco irraggiungibile → contesto
 * assente, quindi silenzio.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Il contesto vuoto: ciò che si legge quando non c'è niente da leggere. */
const ASSENTE = Object.freeze({
  presente: false,
  pool: null,
  studi: [],
  guardrails: Object.freeze({}),
});

/** Un path del JSON, risolto rispetto alla radice tecnica (§3 del contratto). */
function risolvi(valore, radice) {
  if (typeof valore !== 'string' || !valore.trim()) return null;
  const pulito = valore.trim().replace(/\\/g, '/');
  return isAbsolute(pulito) || /^[A-Za-z]:/.test(pulito) ? resolve(pulito) : resolve(radice, pulito);
}

/**
 * Cosa questo progetto ha dichiarato. `amb` porta le letture, così il banco di prova di
 * ciascun hook può costruire un contesto senza toccare il disco.
 */
export function contesto(radice, amb = AMBIENTE_REALE) {
  try {
    const percorso = join(radice, '.daiku', 'project.json');
    if (!amb.esiste(percorso)) return ASSENTE;

    let json;
    try {
      json = JSON.parse(amb.leggi(percorso));
    } catch {
      // JSON rotto: `session-advice` lo dice all'avvio, ed è il suo mestiere. Qui no —
      // una guardia che negasse comandi su un JSON illeggibile negherebbe a caso.
      return ASSENTE;
    }
    if (!json || typeof json !== 'object') return ASSENTE;

    const grezzo = json.paths && json.paths.studies;
    const studi = (Array.isArray(grezzo) ? grezzo : [grezzo])
      .map((x) => (typeof x === 'string' ? x.trim().replace(/\\/g, '/').replace(/\/+$/, '') : null))
      .filter(Boolean);

    const dichiarati = json.guardrails;
    return {
      presente: true,
      pool: risolvi(json.worktree && json.worktree.pool, radice),
      studi,
      guardrails: dichiarati && typeof dichiarati === 'object' ? dichiarati : {},
    };
  } catch {
    return ASSENTE;
  }
}

/** Un guardrail acceso è `true` scritto nel JSON, non un default. */
export function acceso(ctx, nome) {
  return !!ctx && ctx.presente === true && !!ctx.guardrails && ctx.guardrails[nome] === true;
}

/** `assoluto` sta dentro `base`? Confronto per prefisso, insensibile al caso di Windows. */
export function dentro(assoluto, base) {
  if (!assoluto || !base) return false;
  const n = (p) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const a = n(assoluto);
  const b = n(base);
  return a === b || a.startsWith(b + '/');
}

export const AMBIENTE_REALE = {
  esiste: (percorso) => {
    try {
      return existsSync(percorso);
    } catch {
      return false;
    }
  },
  leggi: (percorso) => readFileSync(percorso, 'utf-8'),
};

/** Un contesto costruito a mano: lo usano i banchi di prova dei tre hook. */
export function contestoFinto(campi = {}) {
  return {
    presente: campi.presente !== false,
    pool: campi.pool ? resolve(campi.pool) : null,
    studi: campi.studi || [],
    guardrails: campi.guardrails || {},
  };
}
