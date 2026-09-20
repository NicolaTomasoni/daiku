#!/usr/bin/env node
/**
 * I banchi di prova dei tre hook, in un colpo solo.
 *
 * `node hooks/self-check.mjs` dalla radice del pacchetto. Esce `0` se tutti i casi sono
 * verdi, `1` al primo rosso, e stampa il totale **contato** — la somma di quelli che i tre
 * banchi hanno davvero eseguito, non un numero scritto qui.
 *
 * Esiste perché tre hook fail-open sono tre modi di tacere, e un guasto in uno dei tre è
 * indistinguibile dal silenzio finché qualcuno non lancia il suo banco. Un comando solo
 * rende quel gesto ripetibile prima di un rilascio, in una CI, o dopo aver toccato un file
 * che tutti e tre importano.
 *
 * Non è un hook e non viene mai installato in un progetto: `sync-host` copia il contenuto di
 * `hooks/lib/`, e questo file sta un livello sopra. Chi prova un hook già installato lancia
 * il suo `--self-check`, che è quello che il referto del post-edit gli ricorda.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = join(dirname(fileURLToPath(import.meta.url)), 'lib');

/** Un `.mjs` di `lib/` è un hook se il suo banco risponde: gli altri moduli non ne hanno. */
function moduli() {
  try {
    return readdirSync(LIB)
      .filter((nome) => nome.endsWith('.mjs'))
      .sort();
  } catch (errore) {
    process.stderr.write(`impossibile leggere ${LIB}: ${errore.message}\n`);
    return [];
  }
}

function provaUno(nome) {
  const esito = spawnSync(process.execPath, [join(LIB, nome), '--self-check'], {
    encoding: 'utf-8',
    timeout: 60000,
  });

  if (esito.error) return { nome, stato: 'non parte', dettaglio: esito.error.message };
  if (!esito.stdout || !esito.stdout.trim()) {
    // Nessuna uscita: o il modulo non ha un banco — ed è il caso di `project-root.mjs` e
    // `daiku-config.mjs`, che sono importati dagli hook e provati dai loro banchi — oppure
    // è uscito male, e allora il codice di uscita lo dice.
    return { nome, stato: esito.status === 0 ? 'senza banco' : 'muto', dettaglio: (esito.stderr || '').trim() };
  }

  let referto;
  try {
    referto = JSON.parse(esito.stdout);
  } catch {
    return { nome, stato: 'illeggibile', dettaglio: esito.stdout.slice(0, 200) };
  }
  return {
    nome,
    stato: (referto.falliti || []).length ? 'rosso' : 'verde',
    controlli: referto.controlli || 0,
    falliti: referto.falliti || [],
  };
}

const esiti = moduli().map(provaUno);
const provati = esiti.filter((e) => e.stato === 'verde' || e.stato === 'rosso');
const totale = provati.reduce((somma, e) => somma + e.controlli, 0);
const rossi = esiti.filter((e) => e.stato !== 'verde' && e.stato !== 'senza banco');

for (const esito of esiti) {
  if (esito.stato === 'verde') {
    process.stdout.write(`  ok    ${esito.nome} — ${esito.controlli} controlli\n`);
  } else if (esito.stato === 'senza banco') {
    process.stdout.write(`  —     ${esito.nome} — nessun banco: è un modulo importato, non un hook\n`);
  } else if (esito.stato === 'rosso') {
    process.stdout.write(`  ROSSO ${esito.nome} — ${esito.falliti.length} casi su ${esito.controlli}\n`);
    for (const caso of esito.falliti) process.stdout.write(`        - ${caso}\n`);
  } else {
    process.stdout.write(`  ROSSO ${esito.nome} — ${esito.stato}: ${esito.dettaglio}\n`);
  }
}

process.stdout.write(
  `\n${provati.length} banchi, ${totale} controlli, ${rossi.length ? `${rossi.length} in rosso` : 'tutti verdi'}\n`
);
process.exit(rossi.length ? 1 : 0);
