#!/usr/bin/env node
/**
 * Gate di avvio di /studia-repository, ramo profondo: verifica la toolchain prima che una corsa parta.
 *
 * Attrezzo di sviluppo di questo repository, non del pacchetto: vive fuori da `plugins/`, non
 * si pubblica, non si installa in nessun progetto e non gira mai da un hook. Si lancia a mano,
 * dall'orchestratore del comando (Passo 0) o da chi vuole solo controllare la macchina:
 *
 *   node .docs/tools/studia-repository/check-toolchain.mjs plugins/daiku
 *
 * La radice di Daiku arriva sempre per argomento, mai dedotta dalla posizione di questo file o
 * dalla cwd. Uscita `2` con la usage se manca; altrimenti stampa un JSON contato
 * `{"checks":N,"passed":N,"failed":[…]}` (più i campi propri: `toolchain`, `presidio`,
 * `stato_git`, `avvisi`) ed esce `1` al primo rosso, `0` se tutto passa. Non scrive mai un file
 * del repository: le sole scritture sono le proprie fixture in `os.tmpdir()` — quelle di
 * `--self-check`, e la fixture minima con cui la prova di estrazione interroga `graphify` — tutte
 * cancellate prima di uscire.
 *
 * Non contiene, né lancia, nessun comando d'installazione: quando `opensrc` o `graphify`
 * mancano, il rosso rimanda l'installazione all'owner, a mano.
 *
 * **Gli ultimi controlli sono quelli che rendono il gate una prova e non una dichiarazione.** Che
 * i due CLI rispondano a `--version` non basta, in due modi che si vedono solo eseguendoli.
 *
 * Il primo: `graphify` che risponde alla versione e non estrae niente. La prova `graphify-extract`
 * gli fa costruire un grafo su una fixture minima e pretende il `graph.json`.
 *
 * Il secondo: il ramo profondo invoca `opensrc` con l'ambiente in testa
 * (`OPENSRC_HOME="<radice>/opensrc" opensrc path <spec>`), e il presidio di macchina nega un
 * comando che nomina una `radici_non_eseguibili` a meno che il primo *programma* della riga sia fra
 * i `programmi_permessi_sulle_radici` e la riga non concateni un secondo comando. Un presidio che
 * legge `OPENSRC_HOME` come programma nega quella forma, e il ramo profondo non parte — mentre
 * `--version` risponde lo stesso, verde. Il gate lo chiede quindi al presidio stesso, importando la
 * sua `valuta()` **nella copia installata** (mai nel sorgente, come per l'interruttore) e ponendogli
 * due domande: la forma documentata passa? un'esecuzione dentro la radice e' ancora negata?
 * Se la copia installata e' piu' vecchia del sorgente che la sa leggere, il rosso lo dice e rimanda
 * all'owner, che la porta dentro dal task «Daiku: gestisci guardie (amministratore)» → «Aggiorna da
 * repository»: il passo non e' di una sessione.
 *
 *   node .docs/tools/studia-repository/check-toolchain.mjs --self-check
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const isWin = process.platform === 'win32';

/** La configurazione del presidio che gira: quella installata, non il sorgente del repository
 *  (`.docs/tools/macchina/README.md`). */
const PRESIDIO_MACCHINA = 'C:/Program Files/ClaudeCode/guardia-target.json';

/** Risolve un eseguibile cercandolo nelle directory di un PATH, con le estensioni di Windows
 *  quando serve. Il PATH si legge dall'ambiente del processo per default, ma si può sostituire
 *  con un altro (il banco lo svuota o lo punta a una fixture, senza toccare il PATH reale). */
function findExecutable(name, searchPath) {
  const raw = searchPath ?? process.env.PATH ?? process.env.Path ?? '';
  const dirs = raw.split(delimiter).filter(Boolean);
  const exts = isWin ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // non esiste in questa directory con questa estensione: si continua
      }
    }
  }
  return null;
}

/** Lancia `<eseguibile> --version`. Gli shim npm su Windows sono `.cmd`/`.bat` e vanno passati
 *  per la shell; gli altri si eseguono direttamente. */
function runVersion(execPath) {
  const useShell = isWin && /\.(cmd|bat)$/i.test(execPath);
  const result = spawnSync(execPath, ['--version'], { encoding: 'utf-8', timeout: 15000, shell: useShell });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  return { ok: !result.error && result.status === 0, output: stdout || stderr };
}

/** opensrc/graphify: trovato sul PATH e "--version" risponde con uscita 0. */
function checkTool(name, label, searchPath) {
  const execPath = findExecutable(name, searchPath);
  if (!execPath) {
    return {
      ok: false,
      versione: null,
      binario: null,
      detail: `${label} non trovato sul PATH: installalo tu, a mano (vedi .claude/commands/studia-repository.md, sezione Prerequisiti)`,
    };
  }
  const { ok, output } = runVersion(execPath);
  if (!ok) {
    return {
      ok: false,
      versione: null,
      binario: execPath,
      detail: `${label} trovato in ${execPath} ma "--version" non risponde con uscita 0`,
    };
  }
  return { ok: true, versione: output, binario: execPath, detail: '' };
}

/**
 * Prova funzionale di `graphify`. Che il CLI risponda a `--version` non basta: un graphify puo'
 * rispondere alla versione e non estrarre niente, perche' il sottocomando ri-esegue sé stesso e su
 * Windows quel re-exec puo' partire come processo staccato — l'uscita resta `0` e il grafo non
 * viene mai scritto. Un graphify cosi' e' verde al controllo di versione, ed e' il guasto che il
 * gate lasciava passare.
 *
 * La prova gli fa costruire un grafo su una fixture minima in `os.tmpdir()`, scritta e cancellata
 * qui — nessun file tocca il repository.
 */
function checkExtract(binario) {
  const base = mkdtempSync(join(tmpdir(), 'ss-graphify-'));
  try {
    const src = join(base, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'a.mjs'), 'export const x = 1;\n');
    const out = join(base, 'out');
    // L'ambiente si ripulisce da `PYTHONHASHSEED`: la prova misura la toolchain, e una variabile
    // lasciata dal chiamante non deve mascherarne un guasto.
    const env = { ...process.env };
    delete env.PYTHONHASHSEED;
    const res = spawnSync(binario, ['extract', src, '--code-only', '--out', out], {
      encoding: 'utf-8',
      timeout: 120000,
      shell: isWin && /\.(cmd|bat)$/i.test(binario),
      env,
    });
    if (res.error) return { ok: false, detail: `graphify extract non parte: ${res.error.message}` };
    const graph = join(out, 'graphify-out', 'graph.json');
    if (res.status !== 0) {
      return { ok: false, detail: `graphify extract esce ${res.status}: ${(res.stderr || res.stdout || '').trim().slice(0, 200)}` };
    }
    if (!existsSync(graph)) {
      return {
        ok: false,
        detail: `graphify extract esce 0 ma non scrive ${graph}: la toolchain risponde a --version e non estrae (su Windows, il re-exec di graphify per PYTHONHASHSEED)`,
      };
    }
    return { ok: true, detail: '' };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** Home dell'utente. Su Windows segue USERPROFILE (il banco la ridirige senza toccare quella
 *  reale); altrove HOME. `os.homedir()` resta il ripiego se la variabile manca. */
function realHomeDir(override) {
  if (override) return override;
  if (isWin) return process.env.USERPROFILE || homedir();
  return process.env.HOME || homedir();
}

/** Elenco ricorsivo e ordinato dei path relativi sotto una directory: serve al banco per
 *  confrontare "prima" e "dopo" e dimostrare che nessun file nuovo è comparso. */
function listTree(dir, prefix = '') {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listTree(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * La forma con cui il contratto di `studia-repository` invoca opensrc (Passo 6): l'ambiente in
 * testa, poi il programma. Se il presidio la nega, il ramo profondo non parte.
 */
function comandoDocumentato(radice) {
  return `OPENSRC_HOME="${radice}/opensrc" opensrc path <spec>`;
}

/** L'altra meta' del controllo: un'esecuzione dentro la radice, che il presidio deve negare. */
function comandoDiControllo(radice) {
  return `node ${radice}/progetto/bin/tool`;
}

/**
 * Il verdetto del presidio, chiesto al presidio stesso. Gira in un processo figlio per due ragioni:
 * la `valuta()` che interessa e' quella della copia che gira, accanto alla sua configurazione, e una
 * copia piu' vecchia del sorgente fa partire il suo `main()` all'importazione — che legge lo stdin e,
 * su un terminale, non tornerebbe mai. Lo stdin del figlio e' chiuso e c'e' un tetto di tempo: una
 * copia che non risponde diventa un rosso, non un blocco.
 */
const SCRIPT_VERDETTO = `
const [guardia, config, progetto, documentata, controllo] = process.argv.slice(1);
const mod = await import(guardia);
if (typeof mod.valuta !== 'function') throw new Error('valuta non esportata');
const c = JSON.parse(config);
const evento = (command) => ({ tool_name: 'Bash', tool_input: { command }, cwd: progetto });
process.stdout.write(JSON.stringify({
  documentata: mod.valuta(evento(documentata), c, progetto),
  controllo: mod.valuta(evento(controllo), c, progetto),
}));
`;

function verdettoDelPresidio(guardia, config, progetto) {
  const radice = (config?.radici_non_eseguibili || [])[0];
  if (!radice) return { errore: 'il presidio non dichiara nessuna radice non eseguibile' };
  const res = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', SCRIPT_VERDETTO, pathToFileURL(guardia).href, JSON.stringify(config), progetto, comandoDocumentato(radice), comandoDiControllo(radice)],
    { encoding: 'utf-8', timeout: 20000, input: '' },
  );
  if (res.error) return { errore: `non riesco a chiedere il verdetto a ${guardia}: ${res.error.message}`, radice };
  try {
    return { ...JSON.parse(res.stdout), radice };
  } catch {
    return { errore: `${guardia} non ha risposto con un verdetto (uscita ${res.status}): la copia installata e' piu' vecchia del sorgente, o non esporta "valuta"`, radice };
  }
}

/**
 * Esegue tutti i controlli per una radice. `opts.pathOverride` sostituisce il PATH usato per
 * risolvere opensrc/graphify; `opts.homeOverride` sostituisce la home usata per la scansione
 * delle skill native; `opts.presidioOverride` sostituisce la configurazione installata del
 * presidio. Esistono solo per `--self-check`: una corsa reale non li passa mai.
 */
function runChecks(radiceArg, opts = {}) {
  const checks = [];
  const failed = [];
  const avvisi = [];
  function check(name, ok, detail) {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  }

  // 1. La radice porta il manifest di Daiku.
  try {
    const pluginPath = join(radiceArg, '.claude-plugin', 'plugin.json');
    const json = JSON.parse(readFileSync(pluginPath, 'utf-8'));
    check('plugin-json', json.name === 'daiku', json.name === 'daiku' ? '' : `"name" è "${json.name}", non "daiku", in ${pluginPath}`);
  } catch (error) {
    check('plugin-json', false, `${join(radiceArg, '.claude-plugin', 'plugin.json')} illeggibile: ${error.message}`);
  }

  // 2. La radice del repository, derivata dall'argomento via git — mai dalla posizione del file.
  let repo = null;
  const repoRes = spawnSync('git', ['-C', radiceArg, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8', timeout: 15000 });
  if (!repoRes.error && repoRes.status === 0) repo = repoRes.stdout.trim();
  check('repo-git', !!repo, repo ? '' : `"git -C ${radiceArg} rev-parse --show-toplevel" non risponde con uscita 0`);

  // 3/4. opensrc e graphify.
  const opensrc = checkTool('opensrc', 'opensrc', opts.pathOverride);
  check('opensrc', opensrc.ok, opensrc.detail);
  const graphify = checkTool('graphify', 'graphify', opts.pathOverride);
  check('graphify', graphify.ok, graphify.detail);
  // 4b. E che sappia davvero estrarre: la versione da sola non lo dice.
  if (graphify.ok) {
    const extract = checkExtract(graphify.binario);
    check('graphify-extract', extract.ok, extract.detail);
  } else {
    check('graphify-extract', false, 'graphify non trovato sul PATH: nessuna prova di estrazione');
  }

  // 5. node — si è già dentro node: sempre presente.
  const nodeVersione = process.version;
  check('node', true, '');

  // 6. git.
  const gitRes = spawnSync('git', ['--version'], { encoding: 'utf-8', timeout: 15000 });
  const gitOk = !gitRes.error && gitRes.status === 0;
  const gitVersione = gitOk ? gitRes.stdout.trim() : null;
  check('git', gitOk, gitOk ? '' : '"git --version" non risponde con uscita 0');

  // 7. gh — facoltativo: si registra ma non blocca mai.
  const ghRes = spawnSync('gh', ['--version'], { encoding: 'utf-8', timeout: 15000 });
  const ghOk = !ghRes.error && ghRes.status === 0;
  const ghVersione = ghOk ? ghRes.stdout.trim().split(/\r?\n/)[0] : null;
  check('gh', true, '');

  // 8. Nessuna skill nativa di graphify/opensrc, né nella home né nel repo.
  const home = realHomeDir(opts.homeOverride);
  const skillLocations = [
    join(home, '.claude', 'skills'),
    join(home, '.agents', 'skills'),
    join(home, '.codex', 'skills'),
  ];
  if (repo) {
    skillLocations.push(join(repo, '.claude', 'skills'));
    skillLocations.push(join(repo, '.agents', 'skills'));
  }
  const nativeFound = [];
  for (const dir of skillLocations) {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (/^(graphify|opensrc)/i.test(entry)) nativeFound.push(join(dir, entry));
    }
  }
  check('skill-nativa-assente', nativeFound.length === 0, nativeFound.length ? `trovate: ${nativeFound.join(', ')}` : '');

  // 9. Nessuna intestazione Markdown "graphify" in <repo>/CLAUDE.md.
  let claudeMdOk = true;
  let claudeMdDetail = '';
  if (repo) {
    try {
      const claudeMd = readFileSync(join(repo, 'CLAUDE.md'), 'utf-8');
      const hit = claudeMd.split(/\r?\n/).find((line) => /^#{1,6}\s*.*graphify/i.test(line));
      if (hit) {
        claudeMdOk = false;
        claudeMdDetail = `intestazione trovata: "${hit.trim()}"`;
      }
    } catch {
      // CLAUDE.md assente: nessuna intestazione da negare, va bene così.
    }
  } else {
    claudeMdOk = false;
    claudeMdDetail = 'radice del repository non risolta';
  }
  check('claude-md-senza-graphify', claudeMdOk, claudeMdDetail);

  // 10. Il presidio si legge in sola lettura: spento è un avviso, illeggibile è rosso.
  let presidio = null;
  let configPresidio = null;
  const filePresidio = opts.presidioOverride ?? PRESIDIO_MACCHINA;
  try {
    const json = JSON.parse(readFileSync(filePresidio, 'utf-8').replace(/^﻿/, ''));
    configPresidio = json;
    presidio = { enabled: json.enabled === true, radici_non_eseguibili: json.radici_non_eseguibili || [] };
    check('presidio-letto', true, '');
    if (!presidio.enabled) {
      avvisi.push(
        `presidio spento (enabled: false in ${filePresidio}): le regole su esecuzione del target e installazioni tacciono. Non si controlla quindi nemmeno che accetti la forma documentata di opensrc: a interruttore spento quella forma passa comunque.`,
      );
    }
  } catch (error) {
    check('presidio-letto', false, `${filePresidio} illeggibile: ${error.message}`);
  }

  // 10b. Il presidio accetta la forma con cui il ramo profondo invoca opensrc? La domanda si fa al
  // presidio che gira — quello accanto alla configurazione letta, mai al sorgente del repository
  // (che puo' essere piu' nuovo di quello installato, ed e' esattamente il caso da scoprire).
  if (presidio && configPresidio && presidio.enabled) {
    const guardia = opts.guardiaOverride ?? join(dirname(filePresidio), 'guardia-target.mjs');
    const verdetto = verdettoDelPresidio(guardia, configPresidio, repo ?? process.cwd());
    if (verdetto.errore) {
      check('presidio-permette-la-forma-documentata', false, verdetto.errore);
      check('presidio-nega-ancora-lesecuzione', false, verdetto.errore);
    } else {
      check(
        'presidio-permette-la-forma-documentata',
        verdetto.documentata?.nega === false,
        verdetto.documentata?.nega
          ? `il presidio che gira nega ${comandoDocumentato(verdetto.radice)}: portalo dentro dal repository col task "Daiku: gestisci guardie (amministratore)" → "Aggiorna da repository" (passo dell'owner, non di una sessione)`
          : '',
      );
      check(
        'presidio-nega-ancora-lesecuzione',
        verdetto.controllo?.nega === true,
        verdetto.controllo?.nega
          ? ''
          : `il presidio che gira non nega piu' l'esecuzione dentro la radice (${comandoDiControllo(verdetto.radice)}): la guardia e' spenta o la lista dei programmi permessi e' troppo larga`,
      );
    }
  }

  // 11. Fotografia dello stato git, per run.json.
  let statoGit = [];
  if (repo) {
    const statusRes = spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf-8', timeout: 15000 });
    if (!statusRes.error && statusRes.status === 0) statoGit = statusRes.stdout.split(/\r?\n/).filter(Boolean);
  }

  return {
    checks: checks.length,
    passed: checks.length - failed.length,
    failed,
    radice: radiceArg,
    repo,
    toolchain: {
      opensrc: { versione: opensrc.versione ?? null, binario: opensrc.binario ?? null },
      graphify: { versione: graphify.versione ?? null, binario: graphify.binario ?? null },
      node: nodeVersione,
      git: gitVersione,
      gh: ghVersione,
    },
    presidio,
    stato_git: statoGit,
    avvisi,
  };
}

/** Un eseguibile finto che stampa una versione ed esce 0: su Windows un `.cmd`, altrove uno
 *  script con shebang. Serve solo al banco. */
function fakeCli(dir, name, version) {
  mkdirSync(dir, { recursive: true });
  if (isWin) {
    writeFileSync(join(dir, `${name}.cmd`), `@echo off\r\necho ${name} ${version}\r\n`);
  } else {
    const p = join(dir, name);
    writeFileSync(p, `#!/bin/sh\necho "${name} ${version}"\n`);
    chmodSync(p, 0o755);
  }
}

/** Un graphify finto che risponde a `--version` **e**, su `extract`, scrive davvero un grafo
 *  minimo: senza la seconda parte il controllo funzionale renderebbe rossi tutti i casi verdi del
 *  banco, che non provano più niente. Lo script vero sta in un `.mjs` accanto, così il parsing di
 *  `--out` non passa per il batch. */
function fakeGraphify(dir, version) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'graphify-fake.mjs'),
    [
      "import { mkdirSync, writeFileSync } from 'node:fs';",
      "import { dirname, join } from 'node:path';",
      'const args = process.argv.slice(2);',
      'if (args[0] === "extract") {',
      '  const i = args.indexOf("--out");',
      '  const out = i >= 0 ? args[i + 1] : process.cwd();',
      '  const g = join(out, "graphify-out", "graph.json");',
      '  mkdirSync(dirname(g), { recursive: true });',
      '  writeFileSync(g, JSON.stringify({ nodes: [], edges: [] }));',
      '}',
      `process.stdout.write("graphify ${version}\\n");`,
      '',
    ].join('\n'),
  );
  if (isWin) {
    writeFileSync(join(dir, 'graphify.cmd'), '@echo off\r\nnode "%~dp0graphify-fake.mjs" %*\r\n');
  } else {
    const p = join(dir, 'graphify');
    writeFileSync(p, '#!/bin/sh\nexec node "$(dirname "$0")/graphify-fake.mjs" "$@"\n');
    chmodSync(p, 0o755);
  }
}

/** Un repository di fixture minimo: `.git` reale, il manifest di Daiku sotto `plugins/daiku/`,
 *  il presidio, `CLAUDE.md`. Ogni caso del banco ne modifica un pezzo solo. */
/**
 * I presidi finti del banco, accanto alla configurazione finta come lo e' quello vero. `ok` legge la
 * forma documentata come la legge il presidio corretto; `nega` la rifiuta; `permette` lascia passare
 * tutto. Servono a provare che i due controlli nuovi sanno diventare rossi: senza, un controllo che
 * non ha mai visto un rosso e' indistinguibile dal silenzio.
 */
const GUARDIE_FINTE = {
  ok: 'export function valuta(evento) {\n  return { nega: !/opensrc/.test(evento.tool_input.command) };\n}\n',
  nega: 'export function valuta() {\n  return { nega: true };\n}\n',
  permette: 'export function valuta() {\n  return { nega: false };\n}\n',
};

function buildRepo(base, opts = {}) {
  const { withPlugin = true, pluginName = 'daiku', withPresidio = true, presidioEnabled = false, claudeMdBody = '# Progetto di fixture\n', guardia = 'ok' } = opts;
  const dir = mkdtempSync(join(base, 'repo-'));
  spawnSync('git', ['init', '--quiet', dir], { encoding: 'utf-8' });
  mkdirSync(join(dir, 'plugins', 'daiku', '.claude-plugin'), { recursive: true });
  if (withPlugin) {
    writeFileSync(join(dir, 'plugins', 'daiku', '.claude-plugin', 'plugin.json'), JSON.stringify({ name: pluginName }));
  }
  mkdirSync(join(dir, '.claude'), { recursive: true });
  if (withPresidio) {
    writeFileSync(join(dir, '.claude', 'guardia-target.json'), JSON.stringify({ enabled: presidioEnabled, radici_non_eseguibili: ['X/Y'], programmi_permessi_sulle_radici: ['opensrc', 'graphify'] }));
  }
  writeFileSync(join(dir, '.claude', 'guardia-target.mjs'), GUARDIE_FINTE[guardia]);
  writeFileSync(join(dir, 'CLAUDE.md'), claudeMdBody);
  return dir;
}

function runSelfCheck() {
  const checks = [];
  const failed = [];
  function record(name, ok, detail) {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  }

  const base = mkdtempSync(join(tmpdir(), 'ss-check-toolchain-'));
  try {
    // Senza argomento: usage su stderr, uscita 2. L'unico spawn del proprio file.
    const noArg = spawnSync(process.execPath, [THIS_FILE], { encoding: 'utf-8', timeout: 15000 });
    record('senza-argomento-esce-2', noArg.status === 2, `uscita ${noArg.status}`);

    const cliDir = join(base, 'cli-ok');
    fakeCli(cliDir, 'opensrc', '9.9.9');
    fakeGraphify(cliDir, '8.8.8');

    // Caso verde: repo valido, CLI finti presenti, presidio spento -> avviso, non rosso.
    const repoGreen = buildRepo(base);
    const resGreen = runChecks(join(repoGreen, 'plugins', 'daiku'), { presidioOverride: join(repoGreen, '.claude', 'guardia-target.json'), pathOverride: cliDir });
    record('caso-verde-nessun-fallito', resGreen.failed.length === 0, resGreen.failed.join(' | '));
    record(
      'caso-verde-versioni-lette',
      Boolean(resGreen.toolchain.opensrc.versione?.includes('9.9.9')) && Boolean(resGreen.toolchain.graphify.versione?.includes('8.8.8')),
      JSON.stringify(resGreen.toolchain)
    );
    record('caso-verde-presidio-avviso', resGreen.presidio?.enabled === false && resGreen.avvisi.length > 0, JSON.stringify(resGreen.avvisi));

    // Radice senza plugin.json -> rosso.
    const repoNoPlugin = buildRepo(base, { withPlugin: false });
    const resNoPlugin = runChecks(join(repoNoPlugin, 'plugins', 'daiku'), { presidioOverride: join(repoNoPlugin, '.claude', 'guardia-target.json'), pathOverride: cliDir });
    record('radice-senza-plugin-json-rossa', resNoPlugin.failed.some((f) => f.startsWith('plugin-json')), resNoPlugin.failed.join(' | '));

    // plugin.json con un altro "name" -> rosso.
    const repoWrongName = buildRepo(base, { pluginName: 'altro' });
    const resWrongName = runChecks(join(repoWrongName, 'plugins', 'daiku'), { presidioOverride: join(repoWrongName, '.claude', 'guardia-target.json'), pathOverride: cliDir });
    record('plugin-json-nome-sbagliato-rosso', resWrongName.failed.some((f) => f.startsWith('plugin-json')), resWrongName.failed.join(' | '));

    // PATH senza i CLI -> rosso, e nessun file nuovo nella cartella di fixture.
    const repoNoCli = buildRepo(base);
    const before = listTree(repoNoCli);
    const resNoCli = runChecks(join(repoNoCli, 'plugins', 'daiku'), { presidioOverride: join(repoNoCli, '.claude', 'guardia-target.json'), pathOverride: join(base, 'cli-inesistente') });
    const after = listTree(repoNoCli);
    record(
      'path-senza-cli-rosso',
      resNoCli.failed.some((f) => f.startsWith('opensrc')) && resNoCli.failed.some((f) => f.startsWith('graphify')),
      resNoCli.failed.join(' | ')
    );
    record('path-senza-cli-nessun-file-nuovo', JSON.stringify(before) === JSON.stringify(after), `prima: ${before.join(',')} — dopo: ${after.join(',')}`);

    // Home finta con una skill graphify/opensrc -> rosso.
    const repoHomeSkill = buildRepo(base);
    const fakeHome = join(base, 'home-skill');
    mkdirSync(join(fakeHome, '.claude', 'skills', 'graphify-nativa'), { recursive: true });
    const resHomeSkill = runChecks(join(repoHomeSkill, 'plugins', 'daiku'), { presidioOverride: join(repoHomeSkill, '.claude', 'guardia-target.json'), pathOverride: cliDir, homeOverride: fakeHome });
    record('home-con-skill-graphify-rosso', resHomeSkill.failed.some((f) => f.startsWith('skill-nativa-assente')), resHomeSkill.failed.join(' | '));

    // CLAUDE.md con un'intestazione "## graphify" -> rosso.
    const repoClaudeGraphify = buildRepo(base, { claudeMdBody: '# Progetto\n\n## graphify\n\ntesto\n' });
    const resClaudeGraphify = runChecks(join(repoClaudeGraphify, 'plugins', 'daiku'), { presidioOverride: join(repoClaudeGraphify, '.claude', 'guardia-target.json'), pathOverride: cliDir });
    record('claude-md-graphify-rosso', resClaudeGraphify.failed.some((f) => f.startsWith('claude-md-senza-graphify')), resClaudeGraphify.failed.join(' | '));

    // Presidio illeggibile (file assente) -> rosso.
    const repoNoPresidio = buildRepo(base, { withPresidio: false });
    const resNoPresidio = runChecks(join(repoNoPresidio, 'plugins', 'daiku'), { presidioOverride: join(repoNoPresidio, '.claude', 'guardia-target.json'), pathOverride: cliDir });
    record('presidio-illeggibile-rosso', resNoPresidio.failed.some((f) => f.startsWith('presidio-letto')), resNoPresidio.failed.join(' | '));

    // Presidio acceso che legge la forma documentata come la legge quello corretto: verde sui due
    // controlli nuovi. E' il caso che prova il verso verde — senza, si proverebbe solo il rosso.
    {
      const dir = buildRepo(base, { presidioEnabled: true });
      const res = runChecks(join(dir, 'plugins', 'daiku'), { presidioOverride: join(dir, '.claude', 'guardia-target.json'), pathOverride: cliDir });
      record(
        'forma-documentata-permessa-verde',
        !res.failed.some((f) => f.startsWith('presidio-permette-la-forma-documentata') || f.startsWith('presidio-nega-ancora-lesecuzione')),
        res.failed.join(' | '),
      );
    }

    // Il presidio che gira nega la forma documentata (e' il difetto trovato il 29 settembre 2026:
    // leggeva `OPENSRC_HOME` come programma) -> rosso.
    {
      const dir = buildRepo(base, { presidioEnabled: true, guardia: 'nega' });
      const res = runChecks(join(dir, 'plugins', 'daiku'), { presidioOverride: join(dir, '.claude', 'guardia-target.json'), pathOverride: cliDir });
      record('presidio-che-nega-la-forma-documentata-rosso', res.failed.some((f) => f.startsWith('presidio-permette-la-forma-documentata')), res.failed.join(' | '));
    }

    // Il presidio che gira lascia passare tutto -> rosso sul controllo: la guardia non e' piu' tale,
    // e il verso verde di sopra non direbbe piu' niente.
    {
      const dir = buildRepo(base, { presidioEnabled: true, guardia: 'permette' });
      const res = runChecks(join(dir, 'plugins', 'daiku'), { presidioOverride: join(dir, '.claude', 'guardia-target.json'), pathOverride: cliDir });
      record('presidio-che-permette-tutto-rosso', res.failed.some((f) => f.startsWith('presidio-nega-ancora-lesecuzione')), res.failed.join(' | '));
    }

    // Il presidio che gira non risponde (copia piu' vecchia del sorgente, o nessun `valuta`) ->
    // rosso dichiarato, non un silenzio e non un blocco.
    {
      const dir = buildRepo(base, { presidioEnabled: true });
      rmSync(join(dir, '.claude', 'guardia-target.mjs'));
      const res = runChecks(join(dir, 'plugins', 'daiku'), { presidioOverride: join(dir, '.claude', 'guardia-target.json'), pathOverride: cliDir });
      record('presidio-che-non-risponde-rosso', res.failed.some((f) => f.startsWith('presidio-permette-la-forma-documentata')), res.failed.join(' | '));
    }

    // Un graphify che risponde a `--version` ma non estrae niente (il re-exec di Windows) -> rosso
    // sul controllo funzionale. E' esattamente il guasto che il solo controllo di versione lasciava
    // passare verde.
    {
      const cliRotta = join(base, 'cli-graphify-rotto');
      fakeCli(cliRotta, 'opensrc', '9.9.9');
      fakeCli(cliRotta, 'graphify', '8.8.8');
      const dir = buildRepo(base);
      const res = runChecks(join(dir, 'plugins', 'daiku'), { presidioOverride: join(dir, '.claude', 'guardia-target.json'), pathOverride: cliRotta });
      record('graphify-che-non-estrae-rosso', res.failed.some((f) => f.startsWith('graphify-extract')), res.failed.join(' | '));
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  return { checks: checks.length, passed: checks.length - failed.length, failed };
}

const args = process.argv.slice(2);

if (args.includes('--self-check')) {
  const result = runSelfCheck();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result.failed.length ? 1 : 0);
}

const radiceArg = args[0];
if (!radiceArg) {
  process.stderr.write('uso: node check-toolchain.mjs <radice-daiku>\n');
  process.exit(2);
}

const result = runChecks(radiceArg);
process.stdout.write(JSON.stringify(result) + '\n');
process.exit(result.failed.length ? 1 : 0);
