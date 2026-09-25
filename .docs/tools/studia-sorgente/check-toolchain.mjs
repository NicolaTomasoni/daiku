#!/usr/bin/env node
/**
 * Gate di avvio di /studia-sorgente: verifica la toolchain prima che una corsa parta.
 *
 * Attrezzo di sviluppo di questo repository, non del pacchetto: vive fuori da `plugins/`, non
 * si pubblica, non si installa in nessun progetto e non gira mai da un hook. Si lancia a mano,
 * dall'orchestratore del comando (Passo 0) o da chi vuole solo controllare la macchina:
 *
 *   node .docs/tools/studia-sorgente/check-toolchain.mjs plugins/daiku
 *
 * La radice di Daiku arriva sempre per argomento, mai dedotta dalla posizione di questo file o
 * dalla cwd. Uscita `2` con la usage se manca; altrimenti stampa un JSON contato
 * `{"checks":N,"passed":N,"failed":[…]}` (più i campi propri: `toolchain`, `presidio`,
 * `stato_git`, `avvisi`) ed esce `1` al primo rosso, `0` se tutto passa. Non scrive mai un file,
 * in nessuna delle due modalità — l'unica scrittura su disco avviene dentro `--self-check`, che
 * crea le proprie fixture in `os.tmpdir()` e le cancella alla fine.
 *
 * Non contiene, né lancia, nessun comando d'installazione: quando `opensrc` o `graphify`
 * mancano, il rosso rimanda l'installazione all'owner, a mano.
 *
 *   node .docs/tools/studia-sorgente/check-toolchain.mjs --self-check
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE = fileURLToPath(import.meta.url);
const isWin = process.platform === 'win32';

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
      detail: `${label} non trovato sul PATH: installalo tu, a mano (vedi .claude/commands/studia-sorgente.md, sezione Prerequisiti)`,
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
 * Esegue tutti i controlli per una radice. `opts.pathOverride` sostituisce il PATH usato per
 * risolvere opensrc/graphify; `opts.homeOverride` sostituisce la home usata per la scansione
 * delle skill native. Entrambi esistono solo per `--self-check`: una corsa reale non li passa
 * mai, e il PATH e la HOME restano quelli veri del processo.
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
  if (repo) {
    try {
      const json = JSON.parse(readFileSync(join(repo, '.claude', 'guardia-target.json'), 'utf-8'));
      presidio = { enabled: json.enabled === true, radici_non_eseguibili: json.radici_non_eseguibili || [] };
      check('presidio-letto', true, '');
      if (!presidio.enabled) {
        avvisi.push('presidio spento (enabled: false in .claude/guardia-target.json): il ramo "esecuzione del target" del guardiano tace, il deny resta acceso.');
      }
    } catch (error) {
      check('presidio-letto', false, `.claude/guardia-target.json illeggibile: ${error.message}`);
    }
  } else {
    check('presidio-letto', false, 'radice del repository non risolta');
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

/** Un repository di fixture minimo: `.git` reale, il manifest di Daiku sotto `plugins/daiku/`,
 *  il presidio, `CLAUDE.md`. Ogni caso del banco ne modifica un pezzo solo. */
function buildRepo(base, opts = {}) {
  const { withPlugin = true, pluginName = 'daiku', withPresidio = true, presidioEnabled = false, claudeMdBody = '# Progetto di fixture\n' } = opts;
  const dir = mkdtempSync(join(base, 'repo-'));
  spawnSync('git', ['init', '--quiet', dir], { encoding: 'utf-8' });
  mkdirSync(join(dir, 'plugins', 'daiku', '.claude-plugin'), { recursive: true });
  if (withPlugin) {
    writeFileSync(join(dir, 'plugins', 'daiku', '.claude-plugin', 'plugin.json'), JSON.stringify({ name: pluginName }));
  }
  mkdirSync(join(dir, '.claude'), { recursive: true });
  if (withPresidio) {
    writeFileSync(join(dir, '.claude', 'guardia-target.json'), JSON.stringify({ enabled: presidioEnabled, radici_non_eseguibili: ['X/Y'] }));
  }
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
    fakeCli(cliDir, 'graphify', '8.8.8');

    // Caso verde: repo valido, CLI finti presenti, presidio spento -> avviso, non rosso.
    const repoGreen = buildRepo(base);
    const resGreen = runChecks(join(repoGreen, 'plugins', 'daiku'), { pathOverride: cliDir });
    record('caso-verde-nessun-fallito', resGreen.failed.length === 0, resGreen.failed.join(' | '));
    record(
      'caso-verde-versioni-lette',
      Boolean(resGreen.toolchain.opensrc.versione?.includes('9.9.9')) && Boolean(resGreen.toolchain.graphify.versione?.includes('8.8.8')),
      JSON.stringify(resGreen.toolchain)
    );
    record('caso-verde-presidio-avviso', resGreen.presidio?.enabled === false && resGreen.avvisi.length > 0, JSON.stringify(resGreen.avvisi));

    // Radice senza plugin.json -> rosso.
    const repoNoPlugin = buildRepo(base, { withPlugin: false });
    const resNoPlugin = runChecks(join(repoNoPlugin, 'plugins', 'daiku'), { pathOverride: cliDir });
    record('radice-senza-plugin-json-rossa', resNoPlugin.failed.some((f) => f.startsWith('plugin-json')), resNoPlugin.failed.join(' | '));

    // plugin.json con un altro "name" -> rosso.
    const repoWrongName = buildRepo(base, { pluginName: 'altro' });
    const resWrongName = runChecks(join(repoWrongName, 'plugins', 'daiku'), { pathOverride: cliDir });
    record('plugin-json-nome-sbagliato-rosso', resWrongName.failed.some((f) => f.startsWith('plugin-json')), resWrongName.failed.join(' | '));

    // PATH senza i CLI -> rosso, e nessun file nuovo nella cartella di fixture.
    const repoNoCli = buildRepo(base);
    const before = listTree(repoNoCli);
    const resNoCli = runChecks(join(repoNoCli, 'plugins', 'daiku'), { pathOverride: join(base, 'cli-inesistente') });
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
    const resHomeSkill = runChecks(join(repoHomeSkill, 'plugins', 'daiku'), { pathOverride: cliDir, homeOverride: fakeHome });
    record('home-con-skill-graphify-rosso', resHomeSkill.failed.some((f) => f.startsWith('skill-nativa-assente')), resHomeSkill.failed.join(' | '));

    // CLAUDE.md con un'intestazione "## graphify" -> rosso.
    const repoClaudeGraphify = buildRepo(base, { claudeMdBody: '# Progetto\n\n## graphify\n\ntesto\n' });
    const resClaudeGraphify = runChecks(join(repoClaudeGraphify, 'plugins', 'daiku'), { pathOverride: cliDir });
    record('claude-md-graphify-rosso', resClaudeGraphify.failed.some((f) => f.startsWith('claude-md-senza-graphify')), resClaudeGraphify.failed.join(' | '));

    // Presidio illeggibile (file assente) -> rosso.
    const repoNoPresidio = buildRepo(base, { withPresidio: false });
    const resNoPresidio = runChecks(join(repoNoPresidio, 'plugins', 'daiku'), { pathOverride: cliDir });
    record('presidio-illeggibile-rosso', resNoPresidio.failed.some((f) => f.startsWith('presidio-letto')), resNoPresidio.failed.join(' | '));
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
