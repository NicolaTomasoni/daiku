#!/usr/bin/env node
/**
 * Guardia sui comandi distruttivi — PreToolUse su Bash e PowerShell.
 *
 * **Questo file non è una barriera di sicurezza, ed è bene che si sappia.** La policy
 * che un agente non può togliersi vive nei managed settings dell'host, che stanno sopra
 * ogni altra sorgente e che un processo non elevato non scrive. Qui resta un guardrail
 * contro la **distrazione**: i gesti che costano lavoro perso e che nessuna regola per
 * prefisso sa riconoscere. Chi lo riscrive non guadagna niente che `Bash(*)` non gli
 * avesse già dato.
 *
 * **Niente si accende da solo.** Questo file arriva dentro un pacchetto installato una
 * volta e attivo su *ogni* repository che l'host apre. Perciò la prima domanda non è
 * «questo comando è pericoloso?» ma «questo progetto mi ha chiesto qualcosa?», e la
 * risposta la dà `.daiku/project.json`, non il codice qui sotto:
 *
 *  - **senza `.daiku/project.json` la guardia permette tutto**, sempre, senza guardare
 *    la riga. È il confine, non una degradazione: vedi `daiku-config.mjs`;
 *  - **ogni ramo ha il proprio interruttore** nel JSON, e un interruttore assente è un
 *    ramo spento — §6 di `contracts/project-contract.md`, *ciò che il JSON non dichiara
 *    non esiste*.
 *
 * I rami sono cinque, e si dividono in tre famiglie.
 *
 * **Un fatto del sistema operativo**, acceso su ogni progetto Daiku perché non dipende
 * da nessuna scelta di chi lavora:
 *
 *  1. **I link di Windows.** `rm -rf`, `Remove-Item -Recurse` e `git worktree remove`
 *     ricorrono *dentro* una junction e svuotano la directory reale che sta dall'altra
 *     parte; solo `rd /s` si limita a sganciarla. Vale ovunque ci sia una junction, e
 *     una junction non si vede leggendo la riga di comando.
 *
 * **Sempre accesi**, su ogni progetto Daiku, perché a un agente non si lascia mai
 * nessuna di queste libertà — mai fidarsi di un LLM, vedi `CLAUDE.md`:
 *
 *  2. **I commit che contengono `.daiku/`.** Il repository è del cliente e non vede
 *     nulla del metodo: niente di `.daiku/` entra in un commit, in qualunque caso.
 *     `git add` e `git commit` con un pathspec sotto `.daiku/`, e il `git commit` nudo
 *     o con `-a` quando in stage — o, con `-a`, nell'albero — risulta una modifica
 *     sotto `.daiku/`. Lo stage si legge con un `git status` in sola lettura, che
 *     quando fallisce degrada a permesso.
 *  3. **`git commit --no-verify`.** Una regola per prefisso combacia sull'inizio della
 *     riga, quindi `git commit -m "…" -n` le passa accanto: qui il sottocomando si
 *     guarda davvero, in qualunque posizione stia il flag. Gli hook di commit devono
 *     sempre girare.
 *  4. **`git push`.** Stessa ragione: una regola per prefisso non entra dentro `sh -c`,
 *     mentre qui il push si riconosce anche dentro un wrapper, dietro un `sudo` o in
 *     coda a un altro comando. Il push resta un gesto manuale dell'owner. `--dry-run`
 *     no: quello non spinge niente.
 *
 * **Una policy di progetto**, spenta finché il JSON non l'accende:
 *
 *  5. **Il pool di worktree** (`{worktree.pool}`). Dentro un worktree del pool una
 *     rimozione porta via file non committati senza recupero, e `pnpm install` riscrive
 *     il `virtualStoreDir` del `node_modules` condiviso rendendo incoerente
 *     l'installazione della radice. Nessun pool dichiarato, nessuno dei due controlli.
 *
 * Dove l'host ha un `deny` di sistema, quello resta la porta vera per 3 e 4: assoluto, e
 * nessuna sorgente sotto lo può togliere. I due rami qui chiudono le forme che il
 * combaciare per prefisso non vede, e per questo stanno qui e non lì.
 *
 * **Una forma sola non basta.** La shell accetta lo stesso gesto scritto in molti modi,
 * e la guardia deve conoscerli tutti: un `cd` in testa alla riga che cambia la base dei
 * path relativi, le virgolette intorno al nome del programma, un wrapper (`bash -c`,
 * `powershell -Command`, `cmd /c`), gli alias di PowerShell, i path in stile MSYS
 * (`/c/dev/…`) che Git Bash produce. La § *Forme che questa guardia non copre*, in fondo
 * al file, dice quelle che restano fuori: sono dichiarate apposta, perché una guardia
 * che tace su ciò che non vede fa credere di coprirlo.
 *
 * Contratto di questo file: **fail-open**. Qualunque cosa vada storta — stdin malformato,
 * filesystem irraggiungibile, eccezione — si permette e si esce 0. Una guardia che rompe
 * il turno costa più di quanto protegga, e il rischio che copre è raro.
 *
 * Banco di prova: `node command-guard.mjs --self-check`, dalla cartella in cui sta. Gira su un
 * filesystem simulato e non tocca niente; il totale è **contato**, non cablato. Un hook
 * fail-open guasto è indistinguibile da uno che non ha niente da dire.
 */

import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { invocatoDirettamente, radiceProgetto } from './project-root.mjs';
import { AMBIENTE_REALE as LETTURE, contesto, contestoFinto, dentro } from './daiku-config.mjs';

const RADICE = radiceProgetto();

function permetti() {
  process.exit(0);
}

function nega(motivo) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: motivo,
      },
    })
  );
  process.exit(0);
}

async function leggiStdin() {
  if (process.stdin.isTTY) return '';
  const pezzi = [];
  for await (const pezzo of process.stdin) pezzi.push(pezzo);
  return Buffer.concat(pezzi).toString('utf-8');
}

// --- tokenizzazione -----------------------------------------------------------
//
// Tutto ciò che segue ragiona su **token**, non su una passata di regex sulla riga
// grezza: è la lezione del giro in cui `"git" push` scavalcava tutti e tre gli strati
// che difendono il push, perché la passata azzerava le stringhe fra virgolette prima
// di cercare il token `git`. Qui le virgolette si **tolgono** — chi le mette intorno
// al nome del programma non guadagna niente — ma ogni token ricorda se era quotato,
// così un `-n` dentro un messaggio di commit non si confonde con il flag.

/** Spezza un segmento in token, rispettando le virgolette. */
function tokenizza(segmento) {
  const token = [];
  let corrente = '';
  let quotato = false;
  let aperta = null;
  let pieno = false;
  const chiudi = () => {
    if (pieno) token.push({ t: corrente, q: quotato });
    corrente = '';
    quotato = false;
    pieno = false;
  };
  for (const carattere of segmento) {
    if (aperta) {
      if (carattere === aperta) aperta = null;
      else corrente += carattere;
      continue;
    }
    if (carattere === '"' || carattere === "'") {
      aperta = carattere;
      quotato = true;
      pieno = true;
      continue;
    }
    if (/\s/.test(carattere)) {
      chiudi();
      continue;
    }
    corrente += carattere;
    pieno = true;
  }
  chiudi();
  return token;
}

/** Spezza una riga nei suoi segmenti di comando, rispettando le virgolette. */
function segmenta(riga) {
  const segmenti = [];
  let corrente = '';
  let aperta = null;
  for (const carattere of riga) {
    if (aperta) {
      corrente += carattere;
      if (carattere === aperta) aperta = null;
      continue;
    }
    if (carattere === '"' || carattere === "'") {
      aperta = carattere;
      corrente += carattere;
      continue;
    }
    if (carattere === ';' || carattere === '|' || carattere === '&' || carattere === '\n') {
      segmenti.push(corrente);
      corrente = '';
      continue;
    }
    corrente += carattere;
  }
  segmenti.push(corrente);
  return segmenti.filter((s) => s.trim());
}

/** Token che precedono il comando vero e non lo cambiano: li si salta e basta. */
const PREFISSI_NEUTRI = new Set([
  'sudo',
  'env',
  'time',
  'nohup',
  'winpty',
  'stdbuf',
  'xargs',
  'exec',
  'command',
  'builtin',
  'do',
  'then',
  'else',
  'elif',
  'if',
  'while',
  'for',
  'until',
  '!',
  '{',
  '(',
  '&&',
  '||',
]);

const WRAPPER = /^(?:bash|sh|zsh|dash|ash|powershell|pwsh|cmd|wsl|busybox)(?:\.exe)?$/i;
const GIT = /(?:^|[\\/])git(?:\.exe)?$/i;

/** Il primo token che conta, saltati prefissi neutri, assegnazioni e parentesi. */
function testa(token) {
  let i = 0;
  while (i < token.length) {
    let t = token[i].t;
    if (!token[i].q) t = t.replace(/^[({]+/, '');
    if (!t) {
      i += 1;
      continue;
    }
    if (PREFISSI_NEUTRI.has(t) || (!token[i].q && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t))) {
      i += 1;
      continue;
    }
    return { indice: i, nome: t };
  }
  return null;
}

/** È un'opzione, non un bersaglio?
 *
 * `/s` e `/q` di cmd sono opzioni; `/c/dev/progetto-wt/src` è il path che **Git Bash**
 * produce, ed è la forma in cui gli agenti scrivono i path assoluti su questa
 * macchina. Scambiarlo per un'opzione è come non vederlo: solo una lettera o due
 * dopo la barra fanno un'opzione.
 */
function eFlag(pezzo) {
  if (pezzo.q) return false;
  if (pezzo.t.startsWith('-')) return true;
  return /^\/[A-Za-z]{1,3}$/.test(pezzo.t);
}

/** Il payload di un wrapper: `bash -c "<riga>"`, `cmd /c "<riga>"`, `-Command "<riga>"`. */
function payloadWrapper(token, indice) {
  for (let j = indice + 1; j < token.length; j += 1) {
    if (eFlag(token[j])) continue;
    // **Tutto** il resto del segmento, non il solo primo pezzo. Le virgolette intorno al
    // payload sono una convenzione di chi scrive, non un obbligo della shell: `cmd /c del
    // c:\dev\progetto-wt\src\node_modules` passa gli argomenti sciolti, e fermarsi al primo
    // token significherebbe giudicare `del` senza il suo bersaglio — cioè permettere ogni
    // gesto scritto senza virgolette. La forma quotata è già un token solo e si comporta
    // esattamente come prima.
    return token
      .slice(j)
      .map((x) => x.t)
      .join(' ');
  }
  return null;
}

/** Il comando che segue un `-exec` di `find`, che è una riga a sé. */
function payloadExec(token, indice) {
  for (let j = indice; j < token.length; j += 1) {
    if (token[j].t === '-exec' || token[j].t === '-execdir') {
      return token
        .slice(j + 1)
        .map((x) => x.t)
        .filter((x) => x !== ';' && x !== '\\;' && x !== '+')
        .join(' ');
    }
  }
  return null;
}

// --- path ---------------------------------------------------------------------

/** `/c/dev/x` è il path che Git Bash produce e che `resolve` di Windows sbaglia. */
function normalizzaMsys(percorso) {
  const esito = /^\/([A-Za-z])(\/.*)?$/.exec(percorso);
  return esito ? `${esito[1]}:${esito[2] || '/'}` : percorso;
}

/** Le variabili d'ambiente che il hook **conosce** si espandono prima del giudizio:
 * `%APPDATA%\x`, `$APPDATA/x`, `${APPDATA}/x`, `$env:APPDATA\x`. Senza questo passo lo
 * stesso bersaglio ha due esiti a seconda di come lo si scrive.
 *
 * Solo quelle presenti in `process.env`: una variabile di shell (`$DIR`, `%MIO%`) il
 * hook non la puo' conoscere, resta com'e' e ricade nel limite dichiarato in "Forme che
 * questa guardia NON copre" — si permette, e non e' una copertura. L'ordine conta:
 * `$env:NOME` di PowerShell va provato prima di `$NOME`, o resterebbe `:NOME` appeso. */
function espandiVariabili(percorso) {
  const valore = (nome) => process.env[nome] ?? process.env[nome.toUpperCase()];
  return String(percorso)
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (intero, nome) => valore(nome) ?? intero)
    .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, (intero, nome) => valore(nome) ?? intero)
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (intero, nome) => valore(nome) ?? intero)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (intero, nome) => valore(nome) ?? intero);
}

function assolutizza(bersaglio, base) {
  const pulito = normalizzaMsys(espandiVariabili(bersaglio));
  if (isAbsolute(pulito) || /^[A-Za-z]:/.test(pulito)) return resolve(pulito);
  if (!base) return null; // base ignota: non si inventa un verdetto
  return resolve(base, pulito);
}

/** Il worktree del pool in cui `assoluto` cade, o `null` se cade fuori.
 *
 * Il pool è quello che il progetto ha dichiarato in `{worktree.pool}`, e i suoi worktree
 * sono le sue directory di primo livello. Si ragiona per **prefisso di path**, non
 * risalendo a cercare un `.git`: il perimetro deve combaciare con quello che il JSON
 * dichiara, e un worktree che sta fuori dal pool è di qualcun altro — Daiku non l'ha
 * creato e non sa cosa ci sia dentro.
 */
function worktreeDelPool(assoluto, ctx) {
  if (!ctx || !ctx.pool || !dentro(assoluto, ctx.pool)) return null;
  const pool = resolve(ctx.pool).replace(/\\/g, '/').replace(/\/+$/, '');
  const pieno = resolve(assoluto).replace(/\\/g, '/');
  const resto = pieno.slice(pool.length).replace(/^\/+/, '');
  const primo = resto.split('/')[0];
  return primo ? `${pool}/${primo}` : pool;
}

/** Qualche componente del path è un link (symlink o junction Windows)? */
function attraversaLink(assoluto, amb) {
  const pezzi = assoluto.split(/[\\/]/);
  let corrente = pezzi[0] + '/';
  for (const pezzo of pezzi.slice(1)) {
    if (!pezzo) continue;
    corrente = join(corrente, pezzo);
    const link = amb.eLink(corrente);
    if (link === null) return null; // non esiste ancora: niente da proteggere
    if (link) return corrente;
  }
  return null;
}

/** I path che un comando distruttivo prende di mira, come stringhe grezze.
 *
 * Ogni bersaglio porta con sé se il comando che lo nomina è lo **sgancio** del link
 * (`rd /s`, che non ricorre dentro la junction) o una rimozione che ricorre. In
 * PowerShell `rmdir`, `del`, `ri` ed `erase` sono alias di `Remove-Item`: senza di
 * loro la stessa cancellazione passa riscritta. La forma cmd `rmdir /s` è invece lo
 * sgancio, e per questo si guarda se `/s` c'è.
 *
 * Il comando dev'essere in **testa** al segmento (saltati i prefissi neutri): così
 * `npm rm <pacchetto>` e `pnpm remove` non si scambiano per una rimozione di path,
 * che è il falso positivo che questa forma evita.
 */
function bersagli(token) {
  const capo = testa(token);
  if (!capo) return [];
  const nome = capo.nome.replace(/\.exe$/i, '').toLowerCase();
  const resto = token.slice(capo.indice + 1);
  const raccogli = (argomenti, sgancio) =>
    argomenti
      .filter((x) => !eFlag(x))
      .map((x) => ({ bersaglio: x.t.replace(/;$/, ''), sgancio }))
      .filter((x) => x.bersaglio);

  if (nome === 'rd' || nome === 'rmdir') {
    // `rd`/`rmdir` con `/s` è la forma cmd: sgancia il link senza ricorrervi dentro.
    const sgancio = resto.some((x) => !x.q && /^\/s$/i.test(x.t));
    return raccogli(resto, sgancio);
  }
  if (nome === 'rm' || /^(?:remove-item|erase|del|ri)$/i.test(nome)) {
    return raccogli(resto, false);
  }
  if (GIT.test(capo.nome)) {
    let j = capo.indice + 1;
    while (j < token.length && !token[j].q && token[j].t.startsWith('-')) {
      if (token[j].t === '-C' || token[j].t === '-c') j += 1;
      j += 1;
    }
    if (token[j] && token[j].t === 'worktree' && token[j + 1] && token[j + 1].t === 'remove') {
      return raccogli(token.slice(j + 2), false);
    }
  }
  return [];
}

/** `pnpm install` e i suoi equivalenti: tutti riscrivono il `virtualStoreDir`. */
function installaPnpm(token) {
  const capo = testa(token);
  if (!capo || capo.nome.replace(/\.(?:exe|cmd)$/i, '').toLowerCase() !== 'pnpm') return false;
  const sotto = token.slice(capo.indice + 1).find((x) => !eFlag(x));
  return !!sotto && /^(?:install|i|add|update|up|dedupe)$/i.test(sotto.t);
}

/** Un `cd` che cambia la base da cui si risolvono i path relativi del resto della riga. */
function cambioDirectory(token) {
  const capo = testa(token);
  if (!capo) return null;
  if (!/^(?:cd|chdir|set-location|sl|pushd)$/i.test(capo.nome)) return null;
  const argomenti = token.slice(capo.indice + 1).filter((x) => !eFlag(x));
  if (!argomenti.length) return { ignoto: true }; // `cd` nudo: la home, che non si indovina
  // Espanso prima del test: se la variabile e' nell'ambiente del hook il `cd` si
  // risolve e la base resta nota; se non lo e', il marcatore sopravvive e vale il
  // verdetto di prima — base ignota, bersagli relativi non giudicati.
  const dir = espandiVariabili(argomenti[0].t);
  if (dir === '-' || /[$%`]/.test(dir)) return { ignoto: true }; // variabile ignota: non risolvibile
  return { dir };
}

// --- guardia sui path ---------------------------------------------------------

function guardiaPath(riga, cwd, amb, ctx, profondita = 0) {
  let base = cwd;
  for (const segmento of segmenta(riga)) {
    const token = tokenizza(segmento);
    if (!token.length) continue;
    const capo = testa(token);
    if (!capo) continue;

    // Un wrapper porta dentro le virgolette una riga intera: la si giudica come tale,
    // con la base corrente, invece di lasciarla passare perché è un argomento.
    if (WRAPPER.test(capo.nome) && profondita < 3) {
      const payload = payloadWrapper(token, capo.indice);
      if (payload) {
        const esito = guardiaPath(payload, base, amb, ctx, profondita + 1);
        if (esito) return esito;
      }
      continue;
    }
    const eseguito = payloadExec(token, capo.indice);
    if (eseguito && profondita < 3) {
      const esito = guardiaPath(eseguito, base, amb, ctx, profondita + 1);
      if (esito) return esito;
    }

    const cambio = cambioDirectory(token);
    if (cambio) {
      base = cambio.ignoto ? null : assolutizza(cambio.dir, base);
      continue;
    }

    for (const { bersaglio, sgancio } of bersagli(token)) {
      const assoluto = assolutizza(bersaglio, base);
      if (!assoluto) continue; // bersaglio relativo con base ignota: vedi § Forme non coperte
      // Il disco è l'unica cosa che questa guardia chiede al mondo, ed è anche l'unica
      // che può non rispondere. Se non risponde non si sa se c'è un link — ma il ramo
      // del pool, che legge solo path e parametri, deve poter decidere lo stesso: per
      // questo l'eccezione si ferma qui e non spegne l'intera valutazione.
      let link = null;
      try {
        link = attraversaLink(assoluto, amb);
      } catch {
        link = null;
      }
      // Lo sgancio del link, quando il link **è** il bersaglio, è il rimedio che questa
      // stessa guardia prescrive: negarlo lascia senza passo 1 chi smonta un worktree.
      if (sgancio && link && resolve(link) === resolve(assoluto)) continue;
      if (link) {
        return {
          motivo:
            `\`${bersaglio}\` attraversa un link di Windows (\`${link}\`): una rimozione ricorsiva ` +
            `entra nella junction e svuota la directory reale che sta dall'altra parte, non il ` +
            `link. Sgancia prima il link con \`rd\` (sul solo link), poi rimuovi quello che resta.`,
        };
      }
      const worktree = worktreeDelPool(assoluto, ctx);
      if (worktree) {
        return {
          motivo:
            `\`${bersaglio}\` sta nel worktree \`${worktree}\` del pool che questo progetto ` +
            `dichiara in \`{worktree.pool}\`. Prima di rimuoverlo: enumera **tutte** le junction ` +
            `(\`Get-ChildItem -Recurse -Force -Attributes ReparsePoint\`), sganciale con \`rd\` sul ` +
            `solo link, e porta al sicuro i file non committati — \`git worktree remove --force\` ` +
            `li cancella senza recupero.`,
        };
      }
    }

    if (installaPnpm(token) && base) {
      const worktree = worktreeDelPool(resolve(base), ctx);
      if (worktree) {
        return {
          motivo:
            `\`pnpm install\` dentro il worktree \`${worktree}\` del pool: riscrive ` +
            `\`virtualStoreDir\` nel \`node_modules\` condiviso, e al rientro nella radice pnpm ` +
            `considera l'installazione incoerente e chiede di ricrearla da zero. Installa dalla ` +
            `radice tecnica, non da qui.`,
        };
      }
    }
  }
  return null;
}

// --- guardia su git -----------------------------------------------------------
//
// Quattro rami dietro il gate del progetto, e un solo interruttore in tutto il file.
// Il gate resta: senza `.daiku/project.json` questo progetto non ha aperto Daiku, e la
// guardia non legge nemmeno la riga. Dietro il gate, push, `--no-verify` e commit di
// `.daiku/` sono negati **sempre** — a un agente non si lascia mai nessuna di queste
// libertà, e mai fidarsi di un LLM è la regola che lo dice (vedi `CLAUDE.md`). L'unica
// cosa che il progetto dichiara è il pool dei worktree.
//
// La ragione di leggere la riga invece di affidarsi a una regola dell'host è che una
// regola combacia per **prefisso** e non entra dentro `sh -c`, quindi non vede né un
// flag spostato in coda né un wrapper.

/** Le invocazioni di `git` nella riga, ciascuna come token `[sottocomando, …argomenti]`.
 *
 * `git` si riconosce **in testa** al segmento (saltati i prefissi neutri) o dentro il
 * payload di un wrapper noto, mai in una posizione qualunque: così
 * `echo "git push"` e `grep -rn "git push" .claude/` restano permessi, mentre una
 * vera invocazione Git può avere virgolette intorno all'eseguibile o stare nel payload
 * di un wrapper noto.
 *
 * Le opzioni globali si saltano, comprese `-C` e `-c` che prendono un valore a parte.
 */
function invocazioniGit(riga, profondita = 0) {
  const trovate = [];
  for (const segmento of segmenta(riga)) {
    const token = tokenizza(segmento);
    const capo = testa(token);
    if (!capo) continue;
    if (WRAPPER.test(capo.nome) && profondita < 3) {
      const payload = payloadWrapper(token, capo.indice);
      if (payload) trovate.push(...invocazioniGit(payload, profondita + 1));
      continue;
    }
    if (!GIT.test(capo.nome)) continue;
    let j = capo.indice + 1;
    while (j < token.length && !token[j].q && token[j].t.startsWith('-')) {
      if (token[j].t === '-C' || token[j].t === '-c') j += 1;
      j += 1;
    }
    if (j < token.length) trovate.push(token.slice(j));
  }
  return trovate;
}

/** `git commit` con `-n`/`--no-verify`, in qualunque posizione stia il flag.
 *
 * Un `-n` **quotato** non è il flag: sta dentro il messaggio di commit. È la sola
 * ragione per cui i token ricordano di essere stati fra virgolette.
 */
function guardiaCommit(riga) {
  for (const invocazione of invocazioniGit(riga)) {
    if (!invocazione.length || invocazione[0].t !== 'commit') continue;
    const argomenti = invocazione.slice(1);
    if (argomenti.some((x) => !x.q && (x.t === '--no-verify' || /^-[a-z]*n/i.test(x.t)))) {
      return {
        motivo:
          '`git commit` con `-n`/`--no-verify` non è ammesso: usa il commit normale ' +
          'e lascia girare gli hook. Se un hook di commit è rotto, si aggiusta quello ' +
          '— saltarlo lascia il difetto nella storia.',
      };
    }
  }
  return null;
}

/** `git push`, che resta un gesto manuale dell'owner. */
function guardiaPush(riga) {
  for (const invocazione of invocazioniGit(riga)) {
    if (!invocazione.length || invocazione[0].t !== 'push') continue;
    const argomenti = invocazione.slice(1);
    // `--dry-run` (e il suo `-n`) non spinge niente: negarlo sarebbe un falso positivo.
    if (argomenti.some((x) => !x.q && (x.t === '--dry-run' || /^-[a-zA-Z]*n/.test(x.t)))) continue;
    return {
      motivo:
        '`git push` non è ammesso: il push resta un gesto manuale ' +
        "dell'owner. Se il lavoro è pronto, fermati e dillo: lo lancia chi ha le " +
        'credenziali.',
    };
  }
  return null;
}

/** Un pathspec che nomina `.daiku/`, in qualunque forma la shell lo scriva.
 *
 * Il confronto è sul testo del token, non sul disco: chi nomina esplicitamente
 * `.daiku/` in un `add` o un `commit` sta facendo il gesto vietato, in qualunque
 * directory lo faccia. Le virgolette non cambiano il significato di un pathspec —
 * `"..."` intorno a un path resta quel path — quindi si guardano anche i token
 * quotati. Solo un segmento intero conta: `.daiku.md` o `x.daiku/y` non sono
 * `.daiku/`, e restano permessi.
 */
function ePathDaiku(testo) {
  const normalizzato = String(testo).replace(/\\/g, '/').replace(/^\.\//, '');
  return /(^|\/)\.daiku(\/|$)/.test(normalizzato);
}

/** Le opzioni di `git commit` che mangiano il token dopo di sé: quel token è un
 * valore (un messaggio, un autore, una data), non un pathspec. La forma compatta
 * (`-am`, `-sm`) vale come la sciolta: la `m` dentro un gruppo di flag corte vuole
 * comunque il suo messaggio dopo. */
const OPZIONI_CON_VALORE = new Set([
  '-m',
  '--message',
  '--author',
  '--date',
  '--cleanup',
  '--untracked-files',
  '--template',
  '--fixup',
  '--squash',
]);

function mangiaValore(pezzo) {
  if (pezzo.q) return false;
  if (OPZIONI_CON_VALORE.has(pezzo.t)) return true;
  return /^-[a-z]*m[a-z]*$/i.test(pezzo.t);
}

/** Una riga di `git status --porcelain` con qualcosa in stage (prima colonna):
 * è ciò che un `git commit` nudo congelerebbe. `??` e `!!` non sono in stage. */
function eStaged(riga) {
  const x = riga[0];
  return !!x && x !== ' ' && x !== '?' && x !== '!';
}

/** Una riga con una modifica tracciata, in stage o nell'albero: è ciò che
 * `git commit -a` si porterebbe dentro. */
function eTracciata(riga) {
  return eStaged(riga) || (riga.length > 1 && riga[1] !== ' ' && riga[1] !== '?' && riga[1] !== '!');
}

/** `git add` e `git commit` che toccano `.daiku/`, senza interruttore.
 *
 * Due strati, perché il divieto regga in qualunque caso senza leggere più del
 * necessario:
 *
 *  1. **il pathspec esplicito** — `add` o `commit` che nominano `.daiku/` — si nega
 *     sul testo della riga, senza toccare il disco;
 *  2. **lo stage** — il `commit` nudo congela tutto l'index, e `commit -a` allarga
 *     lo stage all'albero tracciato — si legge con un `git status` in sola lettura
 *     confinato a `.daiku/`. Se git non risponde, degrada a permesso: è il contratto
 *     fail-open, e lo prova il banco.
 *
 * Un `commit` limitato per pathspec a path fuori da `.daiku/` non congela ciò che
 * resta in stage, e resta permesso: è la forma con cui le skill consegnano gli altri
 * gruppi lasciando `.daiku/` dov'è.
 */
function guardiaDaiku(riga, cwd, amb, profondita = 0) {
  let base = cwd;
  for (const segmento of segmenta(riga)) {
    const token = tokenizza(segmento);
    if (!token.length) continue;
    const capo = testa(token);
    if (!capo) continue;

    if (WRAPPER.test(capo.nome) && profondita < 3) {
      const payload = payloadWrapper(token, capo.indice);
      if (payload) {
        const esito = guardiaDaiku(payload, base, amb, profondita + 1);
        if (esito) return esito;
      }
      continue;
    }
    const eseguito = payloadExec(token, capo.indice);
    if (eseguito && profondita < 3) {
      const esito = guardiaDaiku(eseguito, base, amb, profondita + 1);
      if (esito) return esito;
    }

    const cambio = cambioDirectory(token);
    if (cambio) {
      base = cambio.ignoto ? null : assolutizza(cambio.dir, base);
      continue;
    }

    const esito = giudizioDaikuSegmento(token, base, amb);
    if (esito) return esito;
  }
  return null;
}

function giudizioDaikuSegmento(token, base, amb) {
  const capo = testa(token);
  if (!capo || !GIT.test(capo.nome)) return null;

  // Le opzioni globali si saltano come fa `invocazioniGit`, ma il `-C` si ricorda:
  // è la directory in cui lo stage va letto.
  let j = capo.indice + 1;
  let dirC = null;
  while (j < token.length && !token[j].q && token[j].t.startsWith('-')) {
    if ((token[j].t === '-C' || token[j].t === '-c') && j + 1 < token.length) {
      if (token[j].t === '-C') dirC = token[j + 1].t;
      j += 2;
      continue;
    }
    j += 1;
  }
  if (j >= token.length) return null;
  const sottocomando = token[j].t;
  if (sottocomando !== 'add' && sottocomando !== 'commit') return null;

  let tutto = false; // `-a`/`--all` di `commit`
  const bersagli = [];
  let saltaProssimo = false;
  let dopoSeparatore = false;
  for (const x of token.slice(j + 1)) {
    if (saltaProssimo) {
      saltaProssimo = false;
      continue;
    }
    if (!dopoSeparatore && !x.q && x.t === '--') {
      dopoSeparatore = true;
      continue;
    }
    if (!dopoSeparatore && !x.q && x.t.startsWith('-')) {
      if (sottocomando === 'commit' && mangiaValore(x)) saltaProssimo = true;
      if (sottocomando === 'commit' && (x.t === '-a' || x.t === '--all')) tutto = true;
      continue;
    }
    bersagli.push(x.t);
  }

  if (bersagli.some(ePathDaiku)) {
    return {
      motivo:
        'questo comando nomina `.daiku/`: niente di Daiku entra in un commit, in ' +
        'qualunque caso — il repository è del cliente e non vede nulla del metodo. ' +
        'Togli quel path dal comando. Vedi `skills/commit/SKILL.md`, “Daiku non si committa”.',
    };
  }

  // Un `add` senza pathspec esplicito decide al commit, non qui.
  if (sottocomando === 'add') return null;
  // Un `commit` limitato a path altrui non congela lo stage che resta.
  if (bersagli.length) return null;

  const dirGit = dirC ? (base ? assolutizza(dirC, base) : null) : base;
  if (!dirGit) return null; // base ignota: vedi § Forme non coperte
  // L'eccezione resta dentro questo ramo: se git non risponde, questo ramo permette
  // e gli altri decidono — è il contratto di `valuta`, provato dal banco.
  let righe;
  try {
    righe = amb.statoDaiku(dirGit);
  } catch {
    return null; // git irraggiungibile: fail-open
  }
  if (!righe) return null; // git irraggiungibile: fail-open
  const tocca = tutto ? righe.some(eTracciata) : righe.some(eStaged);
  if (!tocca) return null;
  return {
    motivo: tutto
      ? '`git commit -a` allarga lo stage a tutto l’albero tracciato, e sotto `.daiku/` ' +
        'risulta una modifica: niente di Daiku entra in un commit, in qualunque caso. ' +
        'Togli `.daiku/` dallo stage (`git restore --staged -- .daiku/`) oppure committi ' +
        'per pathspec i soli file fuori da `.daiku/`.'
      : 'lo stage contiene modifiche sotto `.daiku/`, e un `git commit` nudo le ' +
        'congelerebbe: niente di Daiku entra in un commit, in qualunque caso. Toglile ' +
        'dallo stage (`git restore --staged -- .daiku/`) oppure committi per pathspec ' +
        'i soli file fuori da `.daiku/`.',
  };
}

// --- ambiente -----------------------------------------------------------------
//
// Tutto ciò che la guardia sa del mondo passa di qui, così il banco di prova può
// sostituirlo con un filesystem simulato e girare senza toccare niente.

const AMBIENTE_REALE = {
  eLink: (percorso) => {
    try {
      // Una junction di Windows non è un symlink per l'API POSIX, ma `lstat` la segna
      // comunque come link simbolico: è il solo modo di vederla senza attraversarla.
      return lstatSync(percorso).isSymbolicLink();
    } catch {
      return null; // non esiste
    }
  },
  /** Le righe di `git status --porcelain` confinate a `.daiku/`, dalla directory
   * indicata. Sola lettura: `[]` è pulito, `null` è git irraggiungibile — e `null`
   * degrada a permesso, per il contratto fail-open. */
  statoDaiku: (dir) => {
    try {
      const esito = spawnSync('git', ['status', '--porcelain', '--', '.daiku'], {
        cwd: dir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      if (esito.error || esito.status !== 0 || typeof esito.stdout !== 'string') return null;
      return esito.stdout
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l);
    } catch {
      return null;
    }
  },
};

/** La decisione, senza uscire dal processo: è ciò che il banco di prova chiama.
 *
 * Il disco lo interrogano due rami — quello dei link e quello dello stage di
 * `.daiku/` — e la loro eccezione resta dentro di loro: gli altri decidono su path
 * e parametri, quindi reggono anche a filesystem irraggiungibile. È provato dal
 * banco, non dichiarato qui.
 */
function valuta(riga, cwd, amb, ctx) {
  // Il gate, prima di ogni altra cosa: senza `.daiku/project.json` questo progetto non ha
  // aperto Daiku, e la guardia non ha niente da sorvegliare. Non si legge nemmeno la riga.
  if (!ctx || !ctx.presente) return null;
  return (
    guardiaPath(riga, cwd, amb, ctx) ||
    guardiaDaiku(riga, cwd, amb) ||
    guardiaCommit(riga) ||
    guardiaPush(riga)
  );
}

/** La stessa decisione, con il contratto **fail-open** addosso: qualunque eccezione
 * diventa un permesso. È l'unica forma che `principale` usa, ed è verificabile dal
 * banco di prova — perché «permette in silenzio» e «protegge» si distinguono solo
 * provandolo. */
function decisioneSicura(riga, cwd, amb, ctx) {
  try {
    return valuta(riga, cwd, amb, ctx);
  } catch {
    return null;
  }
}

// --- banco di prova -----------------------------------------------------------

/** Un filesystem simulato: la radice tecnica del progetto, e accanto un pool di worktree
 * in cui `node_modules` e il venv sono junction — il layout che questa guardia sorveglia
 * quando un progetto dichiara `{worktree.pool}`. */
function ambienteFinto() {
  const chiave = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const albero = new Map(
    Object.entries({
      'c:/dev/progetto/.git': { tipo: 'dir' },
      'c:/dev/progetto/node_modules': { tipo: 'dir' },
      'c:/dev/progetto/backend': { tipo: 'dir' },
      'c:/dev/progetto/backend/.venv': { tipo: 'dir' },
      'c:/dev/progetto/docs': { tipo: 'dir' },
      // Il pool sta fuori dalla radice tecnica, che è il caso reale: un worktree non si
      // annida dentro il repository da cui nasce.
      'c:/dev/wt': { tipo: 'dir' },
      'c:/dev/wt/wt-1': { tipo: 'dir' },
      'c:/dev/wt/wt-1/.git': { tipo: 'file' },
      'c:/dev/wt/wt-1/node_modules': { tipo: 'link' },
      'c:/dev/wt/wt-1/backend': { tipo: 'dir' },
      'c:/dev/wt/wt-1/backend/.venv': { tipo: 'link' },
      'c:/dev/wt/wt-1/docs': { tipo: 'dir' },
      // Un worktree di qualcun altro, fuori dal pool dichiarato: la guardia non lo tocca.
      'c:/dev/altrove/.git': { tipo: 'file' },
      'c:/dev/altrove/docs': { tipo: 'dir' },
    })
  );
  // Gli antenati di una voce esistono come directory ordinarie: `attraversaLink`
  // cammina il path componente per componente, e senza di loro si fermerebbe al primo
  // pezzo sconosciuto — cioè permetterebbe, e il banco proverebbe la cosa sbagliata.
  const antenati = new Set();
  for (const percorso of albero.keys()) {
    const pezzi = percorso.split('/');
    for (let i = 1; i < pezzi.length; i += 1) antenati.add(pezzi.slice(0, i).join('/'));
  }
  const voce = (p) => albero.get(chiave(p)) || (antenati.has(chiave(p)) ? { tipo: 'dir' } : undefined);
  return {
    eLink: (p) => (voce(p) ? voce(p).tipo === 'link' : null),
    // Di default lo stage di `.daiku/` è pulito: i casi che provano lo stage sporco
    // passano il proprio settimo elemento e il ciclo lo innesta qui sotto.
    statoDaiku: () => [],
  };
}

const CWD_RADICE = 'C:/dev/progetto';
const CWD_WT = 'C:/dev/wt/wt-1';

/** Un progetto che ha aperto Daiku e dichiara il pool: tutto ciò che resta da accendere. */
const CTX_PIENO = contestoFinto({ pool: 'C:/dev/wt' });

/** Un progetto che ha aperto Daiku e non ha dichiarato né pool né guardrail. */
const CTX_NUDO = contestoFinto({});

/** Un repository che Daiku non l'ha mai visto: qui la guardia non esiste. */
const CTX_ASSENTE = contestoFinto({ presente: false });

/** Righe di comando con la decisione attesa. `contiene` è un pezzo del motivo.
 *
 * Tre cose vanno provate insieme, e la lista è ordinata così: che **il gate tenga** —
 * un progetto che non ha aperto Daiku non riceve nessun diniego — che **ogni
 * interruttore accenda solo il suo ramo**, e che le forme note di ciascun gesto siano
 * riconosciute. I gesti legittimi che devono restare permessi sono metà della lista, ed
 * è la metà che conta: una guardia che nega tutto passerebbe l'altra.
 */
const CASI = [
  // --- il gate: senza `.daiku/project.json` non si nega niente ----------------
  ['progetto senza Daiku: il push passa', 'git push', CWD_RADICE, 'permetti', '', CTX_ASSENTE],
  ['progetto senza Daiku: la junction non è affare suo', 'rm -rf c:/dev/wt/wt-1/node_modules', CWD_RADICE, 'permetti', '', CTX_ASSENTE],
  ['progetto senza Daiku: nemmeno --no-verify', 'git commit -n -m wip', CWD_RADICE, 'permetti', '', CTX_ASSENTE],
  ['progetto senza Daiku: nemmeno .daiku/', 'git add .daiku/project.json', CWD_RADICE, 'permetti', '', CTX_ASSENTE],

  // --- l'unico interruttore rimasto è il pool: push, --no-verify e .daiku/ negano
  // sempre, senza chiave, e i casi qui sotto lo provano a interruttori spenti -----
  ['senza dichiarazione il push è negato lo stesso', 'git push', CWD_RADICE, 'nega', 'gesto manuale', CTX_NUDO],
  ['senza dichiarazione --no-verify è negato lo stesso', 'git commit --no-verify -m wip', CWD_RADICE, 'nega', 'non è ammesso', CTX_NUDO],
  ['chiavi spente esplicite non spengono niente', 'git push', CWD_RADICE, 'nega', 'gesto manuale', contestoFinto({ guardrails: { deny_push: false, deny_no_verify: false } })],
  ['nessun pool dichiarato: il worktree altrui non si tocca', 'rm -rf c:/dev/wt/wt-1/docs', CWD_RADICE, 'permetti', '', CTX_NUDO],
  ['nessun pool dichiarato: nemmeno pnpm install', 'pnpm install', CWD_WT, 'permetti', '', CTX_NUDO],
  ['il link però resta protetto: è un fatto del sistema, non una policy', 'rm -rf c:/dev/wt/wt-1/node_modules', CWD_RADICE, 'nega', 'attraversa un link', CTX_NUDO],
  ['.daiku/ nega lo stesso senza interruttori: non ne ha', 'git add .daiku/project.json', CWD_RADICE, 'nega', '.daiku/', CTX_NUDO],
  ['un worktree fuori dal pool dichiarato non è sorvegliato', 'rm -rf c:/dev/altrove/docs', CWD_RADICE, 'permetti', '', CTX_PIENO],

  // --- il cd che sposta la base, che è la forma che sfuggiva ------------------
  ['cd nella stessa riga, poi rm su una junction', 'cd /c/dev/wt/wt-1 && rm -rf node_modules', CWD_RADICE, 'nega', 'attraversa un link'],
  ['cd nella stessa riga, poi pnpm install nel worktree', 'cd /c/dev/wt/wt-1 && pnpm install', CWD_RADICE, 'nega', 'virtualStoreDir'],
  ['cd con Set-Location, poi Remove-Item sulla junction', 'Set-Location C:/dev/wt/wt-1; Remove-Item -Recurse -Force node_modules', CWD_RADICE, 'nega', 'attraversa un link'],
  ['cd relativo che scende nel pool', 'cd ../wt/wt-1 && rm -rf backend/.venv', CWD_RADICE, 'nega', 'attraversa un link'],
  ['wrapper bash -c con cd dentro le virgolette', 'bash -c "cd /c/dev/wt/wt-1 && rm -rf node_modules"', CWD_RADICE, 'nega', 'attraversa un link'],
  ['cd verso una variabile: base ignota, nessun verdetto inventato', 'cd $ALTRO && rm -rf node_modules', CWD_RADICE, 'permetti', ''],
  ['il cd che torna indietro riporta la base nella radice', 'cd /c/dev/wt/wt-1; cd /c/dev/progetto; rm -rf node_modules', CWD_RADICE, 'permetti', ''],
  ['find -exec rm sulla junction', 'find /c/dev/wt/wt-1 -name x -exec rm -rf /c/dev/wt/wt-1/node_modules ;', CWD_RADICE, 'nega', 'attraversa un link'],
  ['pnpm i è pnpm install', 'cd /c/dev/wt/wt-1 && pnpm i', CWD_RADICE, 'nega', 'virtualStoreDir'],

  // --- le junction e il pool, forma per forma --------------------------------
  ['rm -rf sulla junction, path assoluto', 'rm -rf /c/dev/wt/wt-1/node_modules', CWD_RADICE, 'nega', 'attraversa un link'],
  ['rm -rf sulla junction, path Windows', 'rm -rf "C:\\dev\\wt\\wt-1\\node_modules"', CWD_RADICE, 'nega', 'attraversa un link'],
  ['rm -rf dentro la junction', 'rm -rf c:/dev/wt/wt-1/node_modules/.pnpm', CWD_RADICE, 'nega', 'attraversa un link'],
  ['Remove-Item con alias ri', 'ri -Recurse -Force c:/dev/wt/wt-1/node_modules', CWD_RADICE, 'nega', 'attraversa un link'],
  ['Remove-Item con alias del', 'del c:/dev/wt/wt-1/backend/.venv', CWD_RADICE, 'nega', 'attraversa un link'],
  ['git worktree remove su un worktree del pool', 'git worktree remove c:/dev/wt/wt-1', CWD_RADICE, 'nega', 'del pool'],
  ['rm dentro il worktree ma fuori dalle junction', 'rm -rf c:/dev/wt/wt-1/docs', CWD_RADICE, 'nega', 'del pool'],
  ['rd /s sul link è lo sgancio che la guardia stessa prescrive', 'rd /s /q c:\\dev\\wt\\wt-1\\node_modules', CWD_RADICE, 'permetti', ''],
  ['rd /s dentro la junction non è uno sgancio', 'rd /s /q c:\\dev\\wt\\wt-1\\node_modules\\.pnpm', CWD_RADICE, 'nega', 'attraversa un link'],
  ['rm nella radice tecnica, che è il repo vero', 'rm -rf c:/dev/progetto/node_modules', CWD_RADICE, 'permetti', ''],
  ['rm di un path che non esiste', 'rm -rf c:/dev/progetto/build-che-non-ce', CWD_RADICE, 'permetti', ''],
  ['pnpm install nella radice tecnica', 'pnpm install', CWD_RADICE, 'permetti', ''],
  ['pnpm install nel worktree, cwd della sessione', 'pnpm install', CWD_WT, 'nega', 'virtualStoreDir'],
  ['npm rm <pacchetto> non è una rimozione di path', 'npm rm left-pad', CWD_WT, 'permetti', ''],
  ['pnpm remove <pacchetto> non è una rimozione di path', 'pnpm remove left-pad', CWD_WT, 'permetti', ''],

  // --- il ramo commit: le forme che una regola per prefisso non vede ---------
  ['git commit --no-verify', 'git commit --no-verify -m "wip"', CWD_RADICE, 'nega', 'non è ammesso'],
  ['git commit -n in coda', 'git commit -m "wip" -n', CWD_RADICE, 'nega', 'non è ammesso'],
  ['git commit -n dentro un wrapper', 'bash -lc "git commit -n -m wip"', CWD_RADICE, 'nega', 'non è ammesso'],
  ['git commit con -n dentro il messaggio non è il flag', 'git commit -m "fix -n del parser"', CWD_RADICE, 'permetti', ''],
  ['git commit normale', 'git commit -m "feat: qualcosa"', CWD_RADICE, 'permetti', ''],

  // --- il ramo .daiku/: nessun commit contiene `.daiku/`, in qualunque caso ----
  ['git add con pathspec .daiku/', 'git add .daiku/policies/area.md', CWD_RADICE, 'nega', '.daiku/'],
  ['git add misto codice + .daiku/', 'git add apps/x.py .daiku/project.json', CWD_RADICE, 'nega', '.daiku/'],
  ['git add .daiku/ dentro un wrapper', 'bash -c "git add .daiku/project.json"', CWD_RADICE, 'nega', '.daiku/'],
  ['git commit con pathspec .daiku/ dopo --', 'git commit -m "x" -- .daiku/domain/commit-convention.md', CWD_RADICE, 'nega', '.daiku/'],
  ['cd + commit con pathspec .daiku/', 'cd /c/dev/progetto && git commit -- .daiku/project.json', CWD_RADICE, 'nega', '.daiku/'],
  ['il messaggio che nomina .daiku/ non è un pathspec', 'git commit -m "fix .daiku loader"', CWD_RADICE, 'permetti', ''],
  ['git commit nudo con .daiku/ in stage', 'git commit -m "feat: x"', CWD_RADICE, 'nega', 'stage', CTX_PIENO, ['M  .daiku/project.json']],
  ['git commit -a con .daiku/ modificato', 'git commit -a -m "x"', CWD_RADICE, 'nega', '.daiku/', CTX_PIENO, [' M .daiku/policies/area.md']],
  ['git commit -a pulito', 'git commit -a -m "x"', CWD_RADICE, 'permetti', '', CTX_PIENO, []],
  ['commit limitato ad altri path con .daiku/ in stage', 'git commit -- docs/x.md', CWD_RADICE, 'permetti', '', CTX_PIENO, ['M  .daiku/project.json']],
  ['git add -A passa qui: decide il commit', 'git add -A', CWD_RADICE, 'permetti', ''],
  ['git commit nudo pulito', 'git commit -m "docs: x"', CWD_RADICE, 'permetti', ''],

  // --- il push: negato dove è dichiarato, e le forme che restano permesse -----
  ['git push nudo', 'git push', CWD_RADICE, 'nega', 'gesto manuale'],
  ['git -C con un altro albero', 'git -C c:/dev/wt/wt-1 push origin main', CWD_RADICE, 'nega', 'gesto manuale'],
  ['powershell -Command "git push"', 'powershell -NoProfile -Command "git push"', CWD_RADICE, 'nega', 'gesto manuale'],
  ['bash -lc "git push"', 'bash -lc "git push --force"', CWD_RADICE, 'nega', 'gesto manuale'],
  ['cmd /c "git push"', 'cmd /c "git push"', CWD_RADICE, 'nega', 'gesto manuale'],
  ['git.exe con path quotato e spazi', '"C:\\Program Files\\Git\\cmd\\git.exe" push', CWD_RADICE, 'nega', 'gesto manuale'],
  ['sudo davanti a git push', 'sudo git push', CWD_RADICE, 'nega', 'gesto manuale'],
  ['git push in coda a un altro comando', 'npm test && git push', CWD_RADICE, 'nega', 'gesto manuale'],
  ['git push --dry-run non spinge niente', 'git push --dry-run', CWD_RADICE, 'permetti', ''],
  ['git fetch non è un push', 'git fetch origin main', CWD_RADICE, 'permetti', ''],
  ['echo di una frase che parla di git push', 'echo "git push is forbidden"', CWD_RADICE, 'permetti', ''],
  ['grep di git push nel corpus', 'grep -rn "git push" .daiku/', CWD_RADICE, 'permetti', ''],

  // --- ciò che non è affare di questa guardia --------------------------------
  // Restano qui come prova esplicita: chi legge deve vedere che il perimetro di lettura,
  // la superficie di enforcement e i gesti Git verso HEAD appartengono alla policy
  // dell'host, non che sono stati dimenticati qui.
  ['il perimetro di lettura è della policy dell\'host', 'cat C:\\Windows\\System32\\drivers\\etc\\hosts', CWD_RADICE, 'permetti', ''],
  ['la superficie degli hook è delle ACL di sistema', 'echo x > .codex/hooks/command-guard.mjs', CWD_RADICE, 'permetti', ''],
  ['git clean non è suo', 'git clean -fd', CWD_RADICE, 'permetti', ''],
  ['git reset --hard non è suo', 'git reset --hard HEAD', CWD_RADICE, 'permetti', ''],

  // --- righe malformate: non devono sollevare, mai ---------------------------
  ['riga vuota', '   ', CWD_RADICE, 'permetti', ''],
  ['virgoletta non chiusa: il bersaglio si legge lo stesso', 'rm -rf "c:/dev/wt/wt-1', CWD_RADICE, 'nega', 'del pool'],
  ['solo separatori', '&& || ; | &', CWD_RADICE, 'permetti', ''],
  ['parentesi e graffe nude', '( { rm } )', CWD_RADICE, 'permetti', ''],
  ['wrapper senza payload', 'bash -c', CWD_RADICE, 'permetti', ''],
  ['cwd assente', 'rm -rf node_modules', null, 'permetti', ''],
  ['un comando qualunque', 'git status --short', CWD_RADICE, 'permetti', ''],
  ['una lettura del corpus', 'cat .daiku/project.json', CWD_RADICE, 'permetti', ''],
];

function selfCheck() {
  const amb = ambienteFinto();
  const falliti = [];
  let eseguiti = 0;

  for (const [nome, riga, cwd, atteso, contiene, ctx, stato] of CASI) {
    eseguiti += 1;
    let esito;
    try {
      const ambCaso = stato === undefined ? amb : { ...amb, statoDaiku: () => stato };
      esito = valuta(riga, cwd, ambCaso, ctx || CTX_PIENO);
    } catch (errore) {
      falliti.push(`${nome}: eccezione ${errore && errore.message}`);
      continue;
    }
    const deciso = esito ? 'nega' : 'permetti';
    if (deciso !== atteso) {
      falliti.push(`${nome}: atteso ${atteso}, ottenuto ${deciso}${esito ? ` (${esito.motivo.slice(0, 120)})` : ''}`);
      continue;
    }
    if (atteso === 'nega' && contiene && !esito.motivo.includes(contiene)) {
      falliti.push(`${nome}: nega, ma il motivo non contiene "${contiene}"`);
    }
  }

  // Il contratto fail-open, provato invece che dichiarato: davanti a un ambiente che
  // solleva su ogni domanda, la decisione dev'essere un permesso, non un'eccezione.
  const rotto = {
    eLink: () => {
      throw new Error('filesystem irraggiungibile');
    },
    statoDaiku: () => {
      throw new Error('git irraggiungibile');
    },
  };
  // Il disco e git li interrogano i rami dei link e dello stage di `.daiku/`: senza
  // quelli, permettono. Gli altri decidono su path e parametri, che il disco non serve
  // a leggere, e restano negati — compreso il pathspec `.daiku/`, che non chiede niente
  // a nessuno.
  const ambienteRotto = [
    ['rm -rf c:/dev/wt/wt-1/node_modules', CWD_RADICE, 'nega'],
    ['rm -rf c:/dev/progetto/node_modules', CWD_RADICE, 'permetti'],
    ['pnpm install', CWD_WT, 'nega'],
    ['git push', CWD_RADICE, 'nega'],
    ['git commit -n -m x', CWD_RADICE, 'nega'],
    ['git add .daiku/project.json', CWD_RADICE, 'nega'],
    ['git commit -m x', CWD_RADICE, 'permetti'],
  ];
  for (const [riga, cwd, atteso] of ambienteRotto) {
    eseguiti += 1;
    let deciso;
    try {
      deciso = decisioneSicura(riga, cwd, rotto, CTX_PIENO);
    } catch (errore) {
      falliti.push(`fail-open su \`${riga}\`: ha sollevato ${errore && errore.message}`);
      continue;
    }
    const letto = deciso ? 'nega' : 'permetti';
    if (letto !== atteso) falliti.push(`ambiente rotto su \`${riga}\`: atteso ${atteso}, ottenuto ${letto}`);
  }

  // Il contesto si legge davvero da un `project.json`, e il gate tiene anche quando quel
  // file è illeggibile: è la degradazione che conta di più, perché è quella che
  // trasformerebbe la guardia in un diniego a caso.
  const letture = (file) => ({
    esiste: (p) => Object.prototype.hasOwnProperty.call(file, String(p).replace(/\\/g, '/')),
    leggi: (p) => {
      const chiave = String(p).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(file, chiave)) throw new Error('ENOENT');
      return file[chiave];
    },
  });
  const daJson = [
    ['nessun file: contesto assente', {}, false],
    ['JSON rotto: contesto assente', { 'C:/dev/progetto/.daiku/project.json': '{"contract": 2,}' }, false],
    ['JSON valido: contesto presente', { 'C:/dev/progetto/.daiku/project.json': '{"contract": 2}' }, true],
  ];
  for (const [nome, file, atteso] of daJson) {
    eseguiti += 1;
    const letto = contesto('C:/dev/progetto', letture(file));
    if (letto.presente !== atteso) falliti.push(`${nome}: atteso presente=${atteso}`);
  }

  eseguiti += 1;
  const conChiaviMorte = contesto('C:/dev/progetto', letture({
    'C:/dev/progetto/.daiku/project.json':
      '{"contract": 2, "worktree": {"pool": "../wt"}, "guardrails": {"deny_push": false, "deny_no_verify": false}}',
  }));
  if (!conChiaviMorte.presente || !dentro('C:/dev/wt/wt-1', conChiaviMorte.pool)) {
    falliti.push('un project.json con pool e chiavi legacy non si legge come dichiarato');
  }

  process.stdout.write(
    JSON.stringify({ controlli: eseguiti, passati: eseguiti - falliti.length, falliti }, null, 2) + '\n'
  );
  return falliti.length ? 1 : 0;
}

// --- Forme che questa guardia NON copre ---------------------------------------
//
// Dichiarate apposta: una guardia che tace su ciò che non vede fa credere di coprirlo,
// e chi legge il file smette di stare attento proprio dove dovrebbe. Tutte le voci qui
// sotto sono la stessa famiglia — un bersaglio che nella riga non si legge — e nessuna
// si chiude rattoppando questo file: la chiusura per effetto invece che per testo è del
// sandbox, che su Windows nativo non esiste, e della policy di sistema.
//
//  - **Un bersaglio costruito da una variabile di shell** (`rm -rf "$DIR"`,
//    `cd $ALTRO && rm -rf node_modules`). La guardia vede il testo, non il valore: dopo
//    un `cd` non risolvibile la base diventa *ignota* e i bersagli **relativi** non si
//    giudicano affatto — si permette, e non è una copertura. Vale anche per lo stage
//    di `.daiku/`: senza base il `git status` non si lancia.
//  - **Un bersaglio che arriva da una pipeline** (`Get-ChildItem x | Remove-Item -Recurse`,
//    `find … -print0 | xargs -0 rm -rf`): nella riga non c'è nessun path da leggere.
//  - **`powershell -EncodedCommand <base64>`** e ogni altra forma offuscata.
//  - **Uno script già scritto** (`bash pulisci.sh`, `python pulisci.py`): il gesto
//    distruttivo sta nel file, non nella riga. Il `PreToolUse` vede solo la riga.
//  - **Altri strumenti che cancellano**: `robocopy /MIR`, `git rm -r`. Non sono forme
//    *equivalenti* dei gesti qui sopra: sono gesti diversi, e aggiungerli è una
//    decisione, non una manutenzione.
//  - **Il corpo di un heredoc** conta come comando, di proposito: `bash <<'EOF'` lo
//    esegue davvero. Chi scrive un heredoc che *cita* `rm -rf` in un testo può vedersi
//    negare la scrittura — è un falso positivo noto, e il rimedio è usare uno strumento
//    di scrittura file invece della shell.
//  - **I subagent lanciati fuori da questo harness**, che questa guardia non vede affatto.
//  - **Ogni progetto che non ha aperto Daiku**, e ogni ramo che il suo `project.json` non
//    accende. Non è un limite tecnico ma il confine voluto: un pacchetto installato una
//    volta è attivo ovunque, e negare un comando a chi non ha dichiarato niente sarebbe
//    un guasto con l'aspetto di una tutela. Chi vuole la copertura la dichiara. Il ramo
//    `.daiku/` è l'eccezione che conferma il confine: interruttore non ne ha, ma il gate
//    sì — senza `.daiku/project.json` resta spento anche lui.
//  - **Il terminale dell'owner**, dove questo hook non gira affatto: lì il divieto su
//    `.daiku/` vive nel testo della skill commit, e nessun diniego lo impone. Se un
//    comando manuale mette `.daiku/` in stage, il `commit` nudo di un agente dopo di lui
//    resta negato dallo stage che si legge qui — un commit manuale, no.

async function principale() {
  const grezzo = await leggiStdin();
  if (!grezzo.trim()) permetti();
  let evento;
  try {
    evento = JSON.parse(grezzo);
  } catch {
    permetti();
  }
  const input = (evento && evento.tool_input) || {};
  const cwd = (evento && evento.cwd) || RADICE;
  const riga = input.command || '';
  if (!riga.trim()) permetti();
  // La radice si risolve dalla cwd dell'evento quando l'host non la dichiara: su Codex è
  // l'unico appiglio, e una sessione aperta in una sottocartella non deve perdere il
  // proprio `.daiku/` — vedi `project-root.mjs`.
  const radice = radiceProgetto({ cwd });
  const esito = decisioneSicura(riga, cwd, AMBIENTE_REALE, contesto(radice, LETTURE));
  if (esito) nega(esito.motivo);
  permetti();
}

if (invocatoDirettamente(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  principale().catch(() => process.exit(0));
}
