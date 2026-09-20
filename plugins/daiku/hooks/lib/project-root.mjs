/**
 * La radice del progetto, per un hook che gira su Claude Code **o** su Codex.
 *
 * I due host non danno la stessa cosa, e la differenza non è cosmetica:
 *
 *  - **Claude Code** esporta `CLAUDE_PROJECT_DIR`, che è la radice vera comunque si sia
 *    aperta la sessione.
 *  - **Codex** non ha un equivalente. Documenta `PLUGIN_ROOT` e `PLUGIN_DATA` — più gli
 *    alias di compatibilità `CLAUDE_PLUGIN_ROOT` e `CLAUDE_PLUGIN_DATA` — ma quelli
 *    puntano al **pacchetto installato**, non al progetto, e per un hook dichiarato in
 *    `.codex/hooks.json` non sono nemmeno impostati. Lì resta la cwd della sessione.
 *
 * E la cwd della sessione **non è** la radice: chi apre Codex dentro una sottocartella la
 * riceve come cwd, e un hook che ci creda calcolerebbe path relativi sbagliati — con
 * l'effetto, per una guardia fail-open, di tacere invece di sbagliare rumorosamente. È la
 * documentazione di Codex a dire di risolvere dalla git root anziché fidarsi di un path
 * relativo alla cwd.
 *
 * Quindi l'ordine è: la variabile dell'host se c'è, poi la git root, poi la cwd come
 * ultima spiaggia. Nessuno dei tre passi solleva: una radice sbagliata degrada, una
 * eccezione qui spegnerebbe l'hook.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Questo modulo è stato lanciato come programma, o importato da qualcun altro?
 *
 * Serve perché i tre hook **esportano** le funzioni che il loro banco di prova verifica,
 * e un modulo che legge stdin ed esce `0` al solo caricamento non si lascia importare:
 * chi prova a chiamarne una funzione da fuori vede il processo morire in silenzio, che è
 * il modo peggiore di fallire in un file il cui contratto è «taci se non hai niente da
 * dire».
 *
 * Il confronto è fra path risolti e senza distinzione di maiuscole, perché su Windows lo
 * stesso file si scrive in più modi. Se qualcosa va storto la risposta è **sì**: nel
 * dubbio un hook fa il suo mestiere, invece di tacere per un confronto di stringhe.
 */
export function invocatoDirettamente(metaUrl) {
  try {
    const lanciato = process.argv[1];
    if (!lanciato) return true;
    return resolve(fileURLToPath(metaUrl)).toLowerCase() === resolve(lanciato).toLowerCase();
  } catch {
    return true;
  }
}

/** La git root a partire da `da`, o `null` se git non risponde o non siamo in un repo. */
export function gitRoot(da, lancia = spawnSync) {
  try {
    const esito = lancia('git', ['rev-parse', '--show-toplevel'], {
      cwd: da,
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (!esito || esito.status !== 0 || !esito.stdout) return null;
    const riga = String(esito.stdout).trim();
    return riga || null;
  } catch {
    return null;
  }
}

/**
 * La radice, con la catena completa. `amb` esiste per il banco di prova: porta le
 * variabili d'ambiente, la cwd e il lanciatore, così la funzione resta pura.
 */
export function radiceProgetto(amb = {}) {
  const env = amb.env || process.env;
  const cwd = amb.cwd || process.cwd();
  const lancia = amb.lancia || spawnSync;

  // Claude Code: la radice dichiarata dall'host, che è sempre quella giusta.
  if (env.CLAUDE_PROJECT_DIR) return env.CLAUDE_PROJECT_DIR;

  // Codex: nessuna variabile di progetto, si risale dalla cwd.
  const root = gitRoot(cwd, lancia);
  if (root) return root;

  // Fuori da un repo: resta la cwd, ed è quanto di meglio si possa dire.
  return cwd;
}
