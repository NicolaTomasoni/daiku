#!/usr/bin/env node
/**
 * Collaudo di `init`: prepara la prova, cattura l'output, emette il verdetto.
 *
 * Attrezzo di sviluppo, non parte del prodotto: vive in `.docs/tools/` e non entra
 * mai in `plugins/`, quindi non viaggia con ciò che si pubblica. Lo lancia la skill
 * `.claude/commands/collauda-init.md`, che è il ciclo che lo consuma:
 *
 *   node .docs/tools/collauda-init.mjs prepara   # fotografia la baseline e butta l'output
 *   node .docs/tools/collauda-init.mjs cattura   # porta nella prova quello che init ha scritto
 *   node .docs/tools/collauda-init.mjs giudica   # confronta ed esce 1 se non è superiore
 *
 * Il verdetto è **meccanico**: nessun asse dipende dall'opinione di un modello. Gli
 * assi sono in `ASSI`, ognuno con la sua `regola` in chiaro, e l'uscita è JSON con
 * `{superiore, assi[], avvisi[]}`. Un asse rosso è un difetto del prodotto — salvo
 * quelli che il progetto ospite non può soddisfare, e per quelli la skill si ferma
 * e chiede.
 *
 * Il progetto ospite della prova è ReforgIA, e la sua radice tecnica è `RADICE`: la
 * prova confronta ciò che `init` scrive oggi con quello che quel progetto aveva
 * prima, che è la baseline presa dal suo `HEAD`.
 */

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- dove sta cosa ----------------------------------------------------------

const QUI = dirname(fileURLToPath(import.meta.url));
const DEV = resolve(QUI, '..', '..'); // radice del repo di sviluppo
const PACCHETTO = join(DEV, 'plugins', 'daiku');
const PROVA = join(DEV, '.docs', 'confronti', 'reforgia-init');
const BASELINE = join(PROVA, 'baseline');
const AFTER = join(PROVA, 'after');

const PROGETTO = 'C:/dev/ReforgIA'; // radice del repository ospite
const RADICE_REL = 'src'; // radice tecnica, relativa alla radice del repository
const RADICE = `${PROGETTO}/${RADICE_REL}`;

/** Il corpus di parametri e istruzioni che il progetto aveva prima di Daiku. */
const BASELINE_FILE = ['CLAUDE.md', '.claude/project.json', '.claude/environment.json'];
const BASELINE_DIR = ['.claude/rules', '.claude/context'];

/** Le chiavi di comando di un'area: §4 di `contracts/project-contract.md`. */
const CHIAVI_AREA = ['gate', 'check_fast', 'lint_fix', 'test_targeted', 'coverage'];

/** I path di `project.json` che devono esistere su disco per forza. */
const PATH_OBBLIGATI = [
  'code_root',
  'tech_doc',
  'changelog',
  'version.file',
  'memory.root',
  'memory.index',
];
const PATH_LISTA_OBBLIGATI = ['version.replicated_in'];

// --- piccole utilità --------------------------------------------------------

const sl = (p) => String(p).replace(/\\/g, '/');
const leggi = (p) => {
  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
};
const leggiJson = (p) => {
  const testo = leggi(p);
  if (testo === null) return null;
  try {
    return JSON.parse(testo);
  } catch {
    return null;
  }
};
const scriviJson = (p, dati) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(dati, null, 2) + '\n', 'utf-8');
};
const esiste = (p) => existsSync(p);
const git = (args) => execFileSync('git', ['-C', PROGETTO, ...args], { encoding: 'utf-8' });

/** Un path assoluto risolto contro la radice tecnica (§3 del contratto). */
function risolvi(valore, base) {
  if (typeof valore !== 'string' || !valore.trim()) return null;
  const pulito = valore.trim().replace(/\\/g, '/');
  return /^([A-Za-z]:|\/)/.test(pulito) ? resolve(pulito) : resolve(base, pulito);
}

/**
 * Una prova dichiarata in `assenze.json` esiste se esiste il file che nomina. Il
 * prompt della prova la chiede come «path del repository», e il repository è due
 * livelli sopra la radice tecnica: la si accetta da entrambe le basi, perché è il
 * file a essere la prova, non la convenzione con cui è stato scritto.
 */
function provaEsiste(valore) {
  for (const base of [RADICE, PROGETTO]) {
    const assoluto = risolvi(valore, base);
    if (assoluto && esiste(assoluto)) return true;
  }
  return false;
}

/** Tutti i file sotto una cartella, in path relativi, con `/`. */
function albero(cartella) {
  if (!esiste(cartella)) return [];
  const fuori = [];
  const scendi = (dir) => {
    for (const voce of readdirSync(dir, { withFileTypes: true })) {
      const pieno = join(dir, voce.name);
      if (voce.isDirectory()) scendi(pieno);
      else fuori.push(sl(relative(cartella, pieno)));
    }
  };
  scendi(cartella);
  return fuori.sort();
}

/** Spazi collassati: serve a riconoscere una riga anche se è stata riavvolta. */
const normalizza = (t) => t.replace(/\s+/g, ' ').trim();

/** Le intestazioni Markdown di un testo. */
const intestazioni = (testo) =>
  (testo || '')
    .split('\n')
    .map((r) => r.match(/^#{1,3}\s+(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[1]);

// --- prepara: baseline e scarto --------------------------------------------

function prepara() {
  mkdirSync(PROVA, { recursive: true });

  const sha = git(['rev-parse', 'HEAD']).trim();

  if (!esiste(BASELINE)) {
    mkdirSync(BASELINE, { recursive: true });
    for (const rel of BASELINE_FILE) {
      const testo = git(['show', `HEAD:${RADICE_REL}/${rel}`]);
      const destinazione = join(BASELINE, rel);
      mkdirSync(dirname(destinazione), { recursive: true });
      writeFileSync(destinazione, testo, 'utf-8');
    }
    for (const rel of BASELINE_DIR) {
      const sorgente = `${RADICE}/${rel}`;
      if (esiste(sorgente)) {
        cpSync(sorgente, join(BASELINE, rel), { recursive: true, force: true });
      }
    }
    scriviJson(join(BASELINE, 'manifest.json'), {
      progetto: PROGETTO,
      radice_tecnica: RADICE,
      sha,
      file: BASELINE_FILE,
      cartelle: BASELINE_DIR,
      presa_il: new Date().toISOString(),
    });
    console.log(`baseline presa da HEAD (${sha.slice(0, 8)})`);
  } else {
    console.log(`baseline già presente (${sha.slice(0, 8)}) — non la ritocco`);
  }

  // Scarto dell'output precedente: quello che `init` aveva scritto non deve
  // sopravvivere alla prova, o il confronto sarebbe con sé stesso.
  const scarto = join(PROVA, 'scarto');
  rmSync(scarto, { recursive: true, force: true });
  mkdirSync(scarto, { recursive: true });

  const daiku = `${RADICE}/.daiku`;
  if (esiste(daiku)) {
    cpSync(daiku, join(scarto, '.daiku'), { recursive: true, force: true });
    rmSync(daiku, { recursive: true, force: true });
    console.log('buttato: src/.daiku/ (copia in scarto/)');
  }

  const istruzioni = `${RADICE}/CLAUDE.md`;
  if (esiste(istruzioni)) {
    cpSync(istruzioni, join(scarto, 'CLAUDE.md'), { force: true });
  }
  try {
    git(['checkout', '--', `${RADICE_REL}/CLAUDE.md`]);
    console.log('ripristinato: src/CLAUDE.md da HEAD');
  } catch (errore) {
    console.log(`CLAUDE.md non ripristinato: ${String(errore.message).split('\n')[0]}`);
  }

  // Il parcheggio del giro prima non deve sopravvivere: l'asse che lo pretende misura
  // il parcheggio di **questo** giro, e un `.old` vecchio lo farebbe passare senza che
  // nessuno l'abbia scritto.
  const parcheggiato = `${RADICE}/CLAUDE.old`;
  if (esiste(parcheggiato)) {
    cpSync(parcheggiato, join(scarto, 'CLAUDE.old'), { force: true });
    rmSync(parcheggiato, { force: true });
    console.log('buttato: src/CLAUDE.old (copia in scarto/)');
  }

  const locale = `${RADICE}/.claude/settings.local.json`;
  if (esiste(locale)) {
    cpSync(locale, join(scarto, 'settings.local.json'), { force: true });
    rmSync(locale, { force: true });
    console.log('messo da parte: src/.claude/settings.local.json');
  }

  rmSync(AFTER, { recursive: true, force: true });
  // Anche `uscita/`, o un report del giro prima farebbe passare l'asse del report
  // a un giro che non ne ha scritto nessuno.
  rmSync(join(PROVA, 'uscita'), { recursive: true, force: true });
  console.log(`\nora lancia \`init\` su ${RADICE}, poi \`cattura\``);
}

// --- cattura: quello che init ha scritto ------------------------------------

function cattura() {
  // Il controllo viene **prima** dello svuotamento: una cattura che fallisce non
  // deve portarsi via il giro precedente, che è l'unica cosa da confrontare.
  const daiku = `${RADICE}/.daiku`;
  if (!esiste(daiku)) {
    console.error(`niente da catturare: ${daiku} non esiste — \`init\` non è ancora girato`);
    return 1;
  }

  // I tre artefatti della prova sono la materia di tre assi, e il report lo è di
  // A10: catturare un giro senza di essi darebbe un rosso **falso**, che manda a
  // correggere il prodotto per un guasto che non è suo. Meglio non giudicare.
  const mancanti = ['verbale.md', 'assenze.json', 'note.md'].filter(
    (nome) => !esiste(join(PROVA, 'uscita', nome))
  );
  if (mancanti.length) {
    console.error(
      `uscita/ incompleta: manca ${mancanti.join(', ')} — completa gli artefatti della prova e rilancia \`cattura\``
    );
    return 1;
  }

  rmSync(AFTER, { recursive: true, force: true });
  mkdirSync(AFTER, { recursive: true });
  cpSync(daiku, join(AFTER, '.daiku'), { recursive: true, force: true });

  // Il file di istruzioni trovato, parcheggiato da `init` come `<nome>.old`: senza
  // portarlo nella prova, l'asse che lo pretende misurerebbe il vuoto.
  for (const rel of ['CLAUDE.md', 'CLAUDE.old', '.claude/settings.local.json']) {
    const sorgente = `${RADICE}/${rel}`;
    if (esiste(sorgente)) {
      const destinazione = join(AFTER, rel);
      mkdirSync(dirname(destinazione), { recursive: true });
      cpSync(sorgente, destinazione, { force: true });
    }
  }

  // Quello che l'agente della prova scrive per il collaudo — report, assenze
  // dichiarate, note — sta in `uscita/` mentre `init` gira, e solo qui entra
  // in `after/`: così la cattura non cancella il lavoro di chi ha eseguito.
  const uscita = join(PROVA, 'uscita');
  if (esiste(uscita)) {
    for (const voce of readdirSync(uscita, { withFileTypes: true })) {
      if (!voce.isFile()) continue;
      cpSync(join(uscita, voce.name), join(AFTER, voce.name), { force: true });
    }
  }

  scriviJson(join(AFTER, 'manifest.json'), {
    scattato_il: new Date().toISOString(),
    file: albero(AFTER),
  });

  console.log(`catturato in ${sl(relative(DEV, AFTER))}:`);
  for (const f of albero(AFTER)) console.log(`  ${f}`);
  return 0;
}

// --- giudica: gli assi ------------------------------------------------------

/**
 * Ogni asse è `{id, nome, regola, esito()}` e `esito()` torna
 * `{verde, dettaglio[], avvisi[]}`. La `regola` è la frase che dice a chi legge
 * perché quell'asse esiste: un asse senza regola non è verificabile.
 */
const ASSI = [
  {
    id: 'A1-conservazione-chiavi',
    nome: "nessun comando del progetto sparisce senza una ragione provata",
    regola:
      "una chiave di area che il progetto dichiarava prima non può mancare nell'output: o c'è, o è in assenze.json con motivo e prova",
    esito: () => {
      const prima = leggiJson(join(BASELINE, '.claude/project.json')) || {};
      const dopo = leggiJson(join(AFTER, '.daiku/project.json')) || {};
      const assenze = leggiJson(join(AFTER, 'assenze.json')) || {};
      const dettaglio = [];
      let verde = true;
      for (const [area, corpo] of Object.entries(prima.areas || {})) {
        // Il nome dell'area è una scelta di `init` (§3): quella di prima si
        // riconosce dai `paths`, non dal nome.
        const corrispondenti = Object.entries(dopo.areas || {}).filter(([, altra]) =>
          incrocia(corpo && corpo.paths, altra && altra.paths)
        );
        for (const chiave of CHIAVI_AREA) {
          if (!corpo || corpo[chiave] === undefined) continue;
          const id = `areas.${area}.${chiave}`;
          if (corrispondenti.some(([, altra]) => altra && altra[chiave] !== undefined)) continue;
          const giustificazione = assenze[id];
          if (giustificazione && giustificazione.motivo && giustificazione.prova) {
            if (!provaEsiste(giustificazione.prova)) {
              verde = false;
              dettaglio.push(`ROSSO ${id}: sparita, e la prova "${giustificazione.prova}" non esiste`);
            } else {
              dettaglio.push(`ok    ${id}: sparita con prova (${giustificazione.prova})`);
            }
            continue;
          }
          verde = false;
          dettaglio.push(`ROSSO ${id}: sparita e non giustificata in assenze.json`);
        }
      }
      if (!dettaglio.length) dettaglio.push('ok    nessuna chiave persa');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A2-copertura-aree',
    nome: 'ogni pacchetto del workspace è un\'area, o ha una ragione',
    regola:
      'un pacchetto che dichiara un gate — uno script `check`, `verify`, `ci` o `test` — deve avere un\'area che lo copre: un gate senza area è lavoro che nessun gate tocca. Un pacchetto con i soli `build`, `lint`, `format` o `typecheck` non ha il comando intero che il gate è, quindi la sua ragione è nel manifest',
    esito: () => {
      const dopo = leggiJson(join(AFTER, '.daiku/project.json')) || {};
      const dettaglio = [];
      let verde = true;
      for (const pacchetto of pacchettiDelWorkspace()) {
        const coperto = Object.values(dopo.areas || {}).some((area) =>
          (area.paths || []).some((p) => {
            const normal = sl(p).replace(/\/+$/, '');
            return normal === pacchetto || pacchetto.startsWith(normal + '/');
          })
        );
        if (coperto) {
          dettaglio.push(`ok    ${pacchetto}: coperto da un'area`);
          continue;
        }
        // Qui non c'è giustificazione che tenga: se il manifest dichiara uno
        // script che §4 ammette come gate, l'area ci deve essere. È l'unico
        // asse dove l'assenza è sempre un difetto, e per questo è quello che
        // tiene onesta la tabella di derivazione di `init`.
        verde = false;
        dettaglio.push(`ROSSO ${pacchetto}: nessuna area lo copre`);
      }
      if (!dettaglio.length) dettaglio.push('avviso nessun pacchetto trovato nel workspace');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A3-forma',
    nome: 'i due parametri rispettano la forma dichiarata',
    regola:
      "ogni chiave sta in schemas/blocks.json § params, `contract` è quello atteso, e nessun segnaposto sopravvive fuori da <FILES>",
    esito: () => {
      const dettaglio = [];
      let verde = true;
      const schema = leggiJson(join(PACCHETTO, 'schemas', 'blocks.json'));
      if (!schema || !schema.params) {
        return { verde: false, dettaglio: ['ROSSO schemas/blocks.json illeggibile'] };
      }
      const attesi = schema.params.contract_expected || {};

      for (const [file, prefisso, chiaviAmmesse, atteso] of [
        ['.daiku/project.json', '', schema.params.project_json, attesi.project_json],
        ['.daiku/environment.json', '', schema.params.environment_json, attesi.environment_json],
      ]) {
        const percorso = join(AFTER, file);
        const testo = leggi(percorso);
        if (testo === null) {
          verde = false;
          dettaglio.push(`ROSSO ${file}: manca`);
          continue;
        }
        let dati;
        try {
          dati = JSON.parse(testo);
        } catch (errore) {
          verde = false;
          dettaglio.push(`ROSSO ${file}: non è JSON (${errore.message})`);
          continue;
        }
        if (atteso !== undefined && dati.contract !== atteso) {
          verde = false;
          dettaglio.push(`ROSSO ${file}: contract ${dati.contract}, atteso ${atteso}`);
        } else {
          dettaglio.push(`ok    ${file}: contract ${dati.contract}`);
        }
        const ammesse = chiaviAmmesse || [];
        const modelli = ammesse.map(modelloDiChiave);
        for (const chiave of chiaviDiPiu(dati, prefisso)) {
          if (!ammessa(chiave, ammesse, modelli)) {
            verde = false;
            dettaglio.push(`ROSSO ${file}: chiave fuori forma "${chiave}"`);
          }
        }
        const sospetti = (testo.match(/<[^>\n]*>/g) || []).filter((s) => s !== '<FILES>');
        for (const sospetto of sospetti) {
          verde = false;
          dettaglio.push(`ROSSO ${file}: segnaposto residuo ${sospetto}`);
        }
      }
      return { verde, dettaglio };
    },
  },
  {
    id: 'A4-fedelta-scheletri',
    nome: 'dominio e policy copiati sono identici agli scheletri',
    regola:
      'init copia gli scheletri senza toccarli: un byte di differenza è una regola inventata in una cartella che appartiene all\'utente',
    esito: () => {
      const dettaglio = [];
      let verde = true;
      for (const cartella of ['domain', 'policies']) {
        for (const file of albero(join(AFTER, '.daiku', cartella))) {
          const prodotto = join(AFTER, '.daiku', cartella, file);
          const scheletro = join(PACCHETTO, 'templates', 'project', cartella, file);
          if (!esiste(scheletro)) {
            // Un file nato dall'utente non è un difetto; uno nato da init lo è, ma
            // non è dato saperlo qui: lo segnala la skill nel suo report.
            dettaglio.push(`avviso ${cartella}/${file}: non è uno scheletro del pacchetto`);
            continue;
          }
          if (readFileSync(prodotto, 'utf-8') === readFileSync(scheletro, 'utf-8')) {
            dettaglio.push(`ok    ${cartella}/${file}`);
          } else {
            verde = false;
            dettaglio.push(`ROSSO ${cartella}/${file}: differisce dallo scheletro`);
          }
        }
      }
      if (!dettaglio.length) dettaglio.push('avviso nessun file in domain/ o policies/');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A5-niente-fuori-dal-progetto',
    nome: 'nessun valore di un\'altra macchina dentro .daiku/',
    regola:
      "un path assoluto dentro la home di un utente è un valore che il prossimo clone non può soddisfare. Un path relativo alla home (`~/…`) non lo è: si risolve su qualunque macchina, ed è la forma normale di una sede dell'host — `~/.claude/settings.json` per esempio",
    esito: () => {
      const dettaglio = [];
      let verde = true;
      for (const file of albero(join(AFTER, '.daiku')).filter((f) => f.endsWith('.json'))) {
        const testo = leggi(join(AFTER, '.daiku', file)) || '';
        // Solo la home **di qualcuno**, con un nome utente dentro: `~` da solo è
        // relativo e portabile, e flaggarlo era un rosso falso su una sede dell'host.
        const sporchi =
          testo.match(/(C:[\\/]Users[\\/][^\\/\s"]+|\/home\/[^\/\s"]+|\/Users\/[^\/\s"]+)[\\/]/gi) || [];
        if (sporchi.length) {
          verde = false;
          dettaglio.push(`ROSSO .daiku/${file}: valore di macchina ${sporchi[0]}`);
        } else {
          dettaglio.push(`ok    .daiku/${file}`);
        }
      }
      return { verde, dettaglio };
    },
  },
  {
    id: 'A6-path-dichiarati',
    nome: 'i path dichiarati esistono, o stanno dentro il repository',
    regola:
      'una sede che il progetto dichiara e che non esiste è una sede inventata se sta fuori dal repository, e una sede futura se ci sta dentro',
    esito: () => {
      const progetto = leggiJson(join(AFTER, '.daiku/project.json')) || {};
      const dettaglio = [];
      let verde = true;
      const controlla = (etichetta, valore) => {
        if (valore === undefined || valore === null) return;
        const assoluto = risolvi(valore, RADICE);
        if (!assoluto) return;
        if (esiste(assoluto)) {
          dettaglio.push(`ok    ${etichetta}: esiste`);
          return;
        }
        const dentro = sl(assoluto).toLowerCase().startsWith(sl(PROGETTO).toLowerCase() + '/');
        if (dentro) {
          dettaglio.push(`avviso ${etichetta}: non esiste ancora (sede dentro il repository)`);
        } else {
          verde = false;
          dettaglio.push(`ROSSO ${etichetta}: non esiste e sta fuori dal repository`);
        }
      };
      for (const percorso of PATH_OBBLIGATI) {
        controlla(percorso, percorso.split('.').reduce((o, k) => (o ? o[k] : undefined), progetto));
      }
      // L'istruzioni file è una chiave **per host**, e vive in `environment.json`:
      // ogni host dichiarato ne porta una, e ognuna deve esistere sul disco.
      const ambiente = leggiJson(join(AFTER, '.daiku/environment.json')) || {};
      const hosts = ambiente.hosts && typeof ambiente.hosts === 'object' ? ambiente.hosts : {};
      for (const [host, corpo] of Object.entries(hosts)) {
        controlla(`hosts.${host}.instructions_file`, corpo && corpo.instructions_file);
      }
      for (const percorso of PATH_LISTA_OBBLIGATI) {
        const lista = percorso.split('.').reduce((o, k) => (o ? o[k] : undefined), progetto);
        for (const voce of Array.isArray(lista) ? lista : []) controlla(`${percorso}[]`, voce);
      }
      for (const chiave of ['studies', 'features', 'review_state']) {
        controlla(`paths.${chiave}`, progetto.paths && progetto.paths[chiave]);
      }
      controlla('worktree.pool', progetto.worktree && progetto.worktree.pool);
      if (!dettaglio.length) dettaglio.push('avviso nessun path dichiarato');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A7-istruzioni-una-lingua',
    nome: "il file di istruzioni non mescola due lingue",
    regola:
      "con una lingua di chat diversa dall'inglese, nessuna intestazione inglese dello scheletro può comparire nel file: è la forma che produce l'invariante duplicato",
    esito: () => {
      const lingue = leggiJson(join(PROVA, 'lingue.json'));
      const dopo = leggi(join(AFTER, 'CLAUDE.md'));
      if (dopo === null) return { verde: false, dettaglio: ['ROSSO CLAUDE.md: manca'] };
      if (!lingue || !lingue.chat) {
        return {
          verde: false,
          dettaglio: ['ROSSO lingue.json mancante: la lingua della chat non è dichiarata'],
        };
      }
      if (String(lingue.chat).toLowerCase().startsWith('en')) {
        return { verde: true, dettaglio: ['ok    lingua di chat inglese: nessun controllo'] };
      }
      const scheletro = leggi(join(PACCHETTO, 'templates', 'project', 'instructions.md')) || '';
      const prima = leggi(join(BASELINE, 'CLAUDE.md')) || '';
      const giaSue = new Set(intestazioni(prima));
      const nelFile = new Set(intestazioni(dopo));
      const dettaglio = [];
      let verde = true;
      for (const titolo of intestazioni(scheletro)) {
        if (giaSue.has(titolo)) continue; // il progetto lo usava già: non è una mescolanza
        if (nelFile.has(titolo)) {
          verde = false;
          dettaglio.push(`ROSSO intestazione inglese dello scheletro rimasta: "${titolo}"`);
        }
      }
      if (verde) dettaglio.push('ok    una lingua sola');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A8-istruzioni-conservazione',
    nome: 'nessuna riga di merito del progetto è stata riassunta',
    regola:
      "ogni riga del file di istruzioni precedente sopravvive come testo, a meno che sia un'intestazione o un commento: 'conservato verbatim' detto e non fatto è il difetto che questo asse esiste per vedere",
    esito: () => {
      const prima = leggi(join(BASELINE, 'CLAUDE.md'));
      const dopo = leggi(join(AFTER, 'CLAUDE.md'));
      if (prima === null || dopo === null) {
        return { verde: false, dettaglio: ['ROSSO baseline o output mancanti'] };
      }
      const pagliaio = normalizza(dopo);
      const dettaglio = [];
      let verde = true;
      let perse = 0;
      for (const riga of prima.split('\n')) {
        const pulita = normalizza(riga);
        if (pulita.length < 15) continue;
        if (/^#{1,6}\s/.test(pulita)) continue;
        if (pulita.startsWith('<!--')) continue;
        if (pagliaio.includes(pulita)) continue;
        verde = false;
        perse += 1;
        dettaglio.push(`ROSSO riga persa: ${pulita.slice(0, 110)}`);
      }
      if (verde) dettaglio.unshift('ok    tutte le righe di merito sono sopravvissute');
      else dettaglio.unshift(`ROSSO ${perse} righe di merito non sopravvivono`);
      return { verde, dettaglio };
    },
  },
  {
    id: 'A9-istruzioni-sede-regole',
    nome: 'il file di istruzioni manda le regole di area dove Daiku le legge',
    regola:
      'una sede di regole che non è .daiku/policies/ è una cartella che nessun finder apre, e il file di istruzioni non può nominarla **di suo**: una riga che sopravvive al file precedente è conservazione — la difendono già A8 e S2 — e riscriverla affermerebbe il falso, perché init non popola policies/',
    esito: () => {
      const dopo = leggi(join(AFTER, 'CLAUDE.md'));
      if (dopo === null) return { verde: false, dettaglio: ['ROSSO CLAUDE.md: manca'] };
      const dettaglio = [];
      let verde = true;
      const pagliaio = normalizza(leggi(join(BASELINE, 'CLAUDE.md')) || '');
      const righe = dopo.split('\n');
      righe.forEach((riga, numero) => {
        if (!/(^|[^.\w])rules\//.test(riga)) return;
        // Conservata dal file precedente: la riga era già lì, e spostarla
        // sarebbe una riscrittura di merito, non una forma da sistemare.
        const pulita = normalizza(riga);
        if (pulita && pagliaio.includes(pulita)) return;
        verde = false;
        dettaglio.push(`ROSSO CLAUDE.md:${numero + 1}: nomina una sede di regole che Daiku non legge`);
      });
      if (verde) dettaglio.push('ok    nessuna sede di regole estranea');
      return { verde, dettaglio };
    },
  },
  {
    id: 'A10-report',
    nome: 'init ha chiuso col report che il contratto prescrive',
    regola:
      'i tre blocchi del report sono il modo in cui il progetto scopre cosa non è stato dichiarato: senza, la degradazione è silenziosa',
    esito: () => {
      const report = leggi(join(AFTER, 'verbale.md'));
      if (report === null) {
        return { verde: false, dettaglio: ['ROSSO after/verbale.md: manca'] };
      }
      const dettaglio = [];
      let verde = true;
      for (const blocco of ['Written', 'Left as it was', 'To fill in']) {
        if (report.includes(blocco)) dettaglio.push(`ok    blocco "${blocco}"`);
        else {
          verde = false;
          dettaglio.push(`ROSSO blocco "${blocco}" assente dal report`);
        }
      }
      return { verde, dettaglio };
    },
  },
  {
    id: 'S1-check_fast-ovunque',
    nome: 'ogni area ha il suo check_fast',
    regola:
      "il controllo rapido in sola lettura è ciò che execute lancia dopo ogni correzione: un'area senza è un preflight che si dichiara saltato per sempre",
    esito: () => {
      const dopo = leggiJson(join(AFTER, '.daiku/project.json')) || {};
      const aree = Object.entries(dopo.areas || {});
      if (!aree.length) return { verde: false, dettaglio: ['ROSSO nessuna area dichiarata'] };
      const dettaglio = [];
      let verde = true;
      for (const [area, corpo] of aree) {
        if (corpo && corpo.check_fast) dettaglio.push(`ok    ${area}`);
        else {
          verde = false;
          dettaglio.push(`ROSSO ${area}: nessun check_fast`);
        }
      }
      return { verde, dettaglio };
    },
  },
  {
    id: 'S2-istruzioni-arricchite',
    nome: 'la mappa della documentazione non perde artefatti',
    regola:
      'il file di istruzioni nuovo deve nominare almeno tutti gli artefatti che nominava il vecchio, e la sezione di stack deve portare l\'inventario letto dai manifest',
    esito: () => {
      const prima = leggi(join(BASELINE, 'CLAUDE.md')) || '';
      const dopo = leggi(join(AFTER, 'CLAUDE.md')) || '';
      const dettaglio = [];
      let verde = true;
      const percorsi = (testo) =>
        new Set((testo.match(/`[^`\n]+`/g) || []).map((s) => s.slice(1, -1)).filter((s) => s.includes('/')));
      for (const percorso of percorsi(prima)) {
        if (percorsi(dopo).has(percorso)) continue;
        // Un path sopravvissuto dentro una riga più lunga conta lo stesso.
        if (normalizza(dopo).includes(percorso)) continue;
        verde = false;
        dettaglio.push(`ROSSO artefatto sparito dalla mappa: ${percorso}`);
      }
      if (prima.length && dopo.length < prima.length) {
        verde = false;
        dettaglio.push(`ROSSO il file è più corto del precedente (${prima.length} -> ${dopo.length})`);
      }
      if (verde) dettaglio.push('ok    mappa conservata, file non accorciato');
      return { verde, dettaglio };
    },
  },
  {
    id: 'S3-inventario-stack',
    nome: "l'inventario dello stack nomina ogni pacchetto del workspace",
    regola:
      "la sezione di stack del file di istruzioni è l'inventario tecnologico letto dai manifest, e un pacchetto del workspace che non vi compare è una parte del progetto che il file non dichiara: è la parte che rende il file utile dal primo minuto, ed è quella che manca quando `init` legge «i titoli sono quelli del file» come licenza a non toccare la sezione",
    esito: () => {
      const dopo = normalizza(leggi(join(AFTER, 'CLAUDE.md')));
      if (!dopo) return { verde: false, dettaglio: ['ROSSO CLAUDE.md: manca o è vuoto'] };
      const pacchetti = pacchettiConManifesto();
      if (!pacchetti.length) {
        return { verde: true, dettaglio: ['avviso nessun pacchetto nel workspace: nulla da pretendere'] };
      }
      const dettaglio = [];
      let verde = true;
      for (const pacchetto of pacchetti) {
        if (dopo.includes(pacchetto)) dettaglio.push(`ok    ${pacchetto}`);
        else {
          verde = false;
          dettaglio.push(`ROSSO ${pacchetto}: non compare nel file di istruzioni`);
        }
      }
      return { verde, dettaglio };
    },
  },
  {
    id: 'S4-file-parcheggiato',
    nome: 'il file di istruzioni trovato è parcheggiato, e intatto',
    regola:
      "il file che il progetto cura più di ogni altro non si riscrive sul posto: `init` lo rinomina con l'estensione `.old` e scrive il nuovo accanto, così il testo originale resta come materiale e come prova. Un parcheggio mancante è una riscrittura che nessuno può più disfare",
    esito: () => {
      const trovato = leggi(join(BASELINE, 'CLAUDE.md'));
      const parcheggiato = leggi(join(AFTER, 'CLAUDE.old'));
      const dopo = leggi(join(AFTER, 'CLAUDE.md'));
      if (dopo === null) return { verde: false, dettaglio: ['ROSSO CLAUDE.md: manca'] };
      // Il file trovato era già marcato: `init` non lo tocca e non parcheggia nulla.
      if (trovato !== null && trovato.includes('daiku:instructions')) {
        return { verde: true, dettaglio: ['ok    il file trovato era già marcato: nessun parcheggio dovuto'] };
      }
      if (parcheggiato === null) {
        return {
          verde: false,
          dettaglio: ['ROSSO after/CLAUDE.old: manca — il file trovato non è stato parcheggiato'],
        };
      }
      // I fine-riga non sono il testo: la baseline esce da `git show` con LF, il file
      // parcheggiato è stato scritto dal checkout. Si confronta il contenuto.
      const senzaCr = (t) => (t === null ? null : t.replace(/\r\n/g, '\n'));
      if (trovato !== null && senzaCr(parcheggiato) !== senzaCr(trovato)) {
        return {
          verde: false,
          dettaglio: ['ROSSO after/CLAUDE.old: differisce dal file trovato — parcheggiato non vuol dire riscritto'],
        };
      }
      return { verde: true, dettaglio: ['ok    CLAUDE.old identico al file trovato'] };
    },
  },
];

/**
 * Le famiglie di script che sono il gate di un'area — §4 di `contracts/project-contract.md`
 * e la riga `gate` della tabella di derivazione di `init`: `lint`, `format`, `type-check`,
 * `test` e `package build` sono ciò che il gate **copre insieme**, non cinque gate alternativi
 * (`templates/project/instructions.md`, regola `[gate-owned-by-review]`). Un pacchetto col
 * solo `build` non ha un gate, e §6 già dichiara che cosa vuol dire la sua assenza.
 */
const GATE_AMMESSI = /^(check|verify|ci|test)$/i;

/** Due liste di `paths` si incrociano se una copre l'altra o ne è coperta. */
function incrocia(a, b) {
  const pulisci = (lista) =>
    (Array.isArray(lista) ? lista : [])
      .map((p) => sl(p).replace(/\/+$/, ''))
      .filter(Boolean);
  const uno = pulisci(a);
  const due = pulisci(b);
  return uno.some((x) => due.some((y) => x === y || x.startsWith(y + '/') || y.startsWith(x + '/')));
}

/**
 * Le cartelle candidate del workspace, come glob relativi alla radice tecnica: quelle
 * del file di workspace se c'è, altrimenti le prime cartelle sotto `code_root`.
 */
function globDelWorkspace() {
  const fileWorkspace = `${RADICE}/pnpm-workspace.yaml`;
  const glob = [];
  const testo = leggi(fileWorkspace);
  if (testo !== null) {
    let dentro = false;
    for (const riga of testo.split('\n')) {
      if (/^packages\s*:/.test(riga)) {
        dentro = true;
        continue;
      }
      if (dentro && /^\S/.test(riga) && !/^\s*#/.test(riga)) break;
      if (dentro) {
        const m = riga.match(/^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*$/);
        if (m) glob.push(m[1]);
      }
    }
  }
  if (!glob.length) {
    // Ripiego: le cartelle di primo livello sotto `code_root`.
    const codeRoot = leggiJson(join(AFTER, '.daiku/project.json'))?.code_root;
    const base = codeRoot ? risolvi(codeRoot, RADICE) : RADICE;
    for (const voce of readdirSync(base, { withFileTypes: true })) {
      if (voce.isDirectory()) glob.push(`${sl(relative(RADICE, join(base, voce.name)))}/*`);
    }
  }
  return glob;
}

/** I pacchetti del workspace che portano un manifest, in path relativi alla radice tecnica. */
function pacchettiConManifesto() {
  const fuori = [];
  for (const modello of globDelWorkspace()) {
    const normal = sl(modello).replace(/\/+$/, '');
    const stella = normal.lastIndexOf('*');
    if (stella === -1) {
      if (esiste(join(RADICE, normal, 'package.json'))) fuori.push(normal);
      continue;
    }
    const prefisso = normal.slice(0, stella);
    const coda = normal.slice(stella + 1);
    const cartella = join(RADICE, prefisso);
    if (!esiste(cartella)) continue;
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
      if (!voce.isDirectory()) continue;
      const rel = sl(prefisso) + voce.name + coda;
      if (leggiJson(join(RADICE, rel, 'package.json'))) fuori.push(rel.replace(/\/+$/, ''));
    }
  }
  return [...new Set(fuori)].sort();
}

/** I pacchetti del workspace che dichiarano un gate — quelli che devono essere un'area. */
function pacchettiDelWorkspace() {
  return pacchettiConManifesto().filter((rel) => {
    const manifest = leggiJson(join(RADICE, rel, 'package.json'));
    if (!manifest || !manifest.scripts) return false;
    // Solo i pacchetti che dichiarano un gate: un pacchetto col solo `dev` — o col
    // solo `build` — non è un'area, e pretenderlo sarebbe un rosso che nessuna
    // correzione di `init` può togliere, perché l'area senza gate non esiste.
    return Object.keys(manifest.scripts).some((n) => GATE_AMMESSI.test(n.split(':')[0]));
  }).map((rel) => rel + '/');
}

/** Le chiavi di un oggetto JSON in forma puntata, per confrontarle con lo schema. */
function chiaviDiPiu(dati, prefisso) {
  const fuori = [];
  const scendi = (valore, cammino) => {
    if (!valore || typeof valore !== 'object' || Array.isArray(valore)) return;
    for (const [chiave, sotto] of Object.entries(valore)) {
      const pieno = cammino ? `${cammino}.${chiave}` : chiave;
      fuori.push(pieno);
      if (sotto && typeof sotto === 'object' && !Array.isArray(sotto)) scendi(sotto, pieno);
    }
  };
  scendi(dati, prefisso || '');
  return fuori;
}

/** Una chiave dello schema (`areas.<area>.gate`) diventa il modello che la riconosce. */
function modelloDiChiave(chiave) {
  const pezzi = chiave
    .split('.')
    .map((pezzo) => (/^<.+>$/.test(pezzo) ? '[^.]+' : pezzo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  return new RegExp('^' + pezzi.join('\\.') + '$');
}

/**
 * Una chiave è in forma in tre casi, e sono tre cose diverse:
 *
 * - **è dichiarata**, con i suoi segnaposto risolti (`areas.backend.gate`);
 * - **è un contenitore**: `language` non è nell'elenco, ma `language.chat` sì,
 *   e chi scrive `language` sta scrivendo la forma giusta;
 * - **sta sotto una dichiarata**: `areas.backend.gate.cwd` è la forma dell'oggetto
 *   comando, che `areas.<area>.gate` dichiara senza scendere nei campi.
 */
function ammessa(chiave, chiavi, modelli) {
  if (chiavi.some((dichiarata) => dichiarata.startsWith(chiave + '.'))) return true;
  const pezzi = chiave.split('.');
  for (let n = pezzi.length; n >= 1; n -= 1) {
    if (modelli.some((m) => m.test(pezzi.slice(0, n).join('.')))) return true;
  }
  return false;
}

function giudica() {
  if (!esiste(join(AFTER, '.daiku'))) {
    console.error('niente da giudicare: lancia prima `cattura`');
    return 1;
  }
  if (!esiste(BASELINE)) {
    console.error('niente baseline: lancia prima `prepara`');
    return 1;
  }

  const assi = [];
  for (const asse of ASSI) {
    let risultato;
    try {
      risultato = asse.esito();
    } catch (errore) {
      risultato = { verde: false, dettaglio: [`ROSSO asse in errore: ${errore.message}`] };
    }
    assi.push({
      id: asse.id,
      nome: asse.nome,
      regola: asse.regola,
      verde: !!risultato.verde,
      dettaglio: risultato.dettaglio || [],
    });
  }

  const rossi = assi.filter((a) => !a.verde);
  const superiore = rossi.length === 0;

  const esito = {
    superiore,
    quando: new Date().toISOString(),
    assi,
    rossi: rossi.map((a) => a.id),
  };
  scriviJson(join(PROVA, 'esito.json'), esito);

  // La storia serve alla skill per accorgersi di uno stallo: due giri che non
  // cambiano niente sono il momento in cui si smette di girare e si chiede.
  const storia = leggiJson(join(PROVA, 'storia.json')) || [];
  storia.push({ quando: esito.quando, superiore, rossi: esito.rossi });
  scriviJson(join(PROVA, 'storia.json'), storia);

  const largo = Math.max(...assi.map((a) => a.id.length));
  for (const asse of assi) {
    console.log(`${asse.verde ? 'VERDE' : 'ROSSO'}  ${asse.id.padEnd(largo)}  ${asse.nome}`);
    for (const riga of asse.dettaglio) console.log(`         ${riga}`);
  }
  console.log();
  if (superiore) {
    console.log(`SUPERIORE — ${assi.length} assi verdi su ${assi.length}`);
  } else {
    console.log(`NON SUPERIORE — ${rossi.length} assi rossi su ${assi.length}: ${rossi.map((a) => a.id).join(', ')}`);
  }
  return superiore ? 0 : 1;
}

// --- avvio ------------------------------------------------------------------

const azione = process.argv[2];
const uscita =
  azione === 'prepara' ? (prepara(), 0) : azione === 'cattura' ? cattura() : azione === 'giudica' ? giudica() : null;

if (uscita === null) {
  console.error('uso: collauda-init.mjs <prepara|cattura|giudica>');
  process.exit(2);
}
if (uscita !== 0) process.exit(uscita);
