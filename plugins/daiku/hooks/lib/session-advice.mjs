#!/usr/bin/env node
/**
 * Session-start notice — SessionStart.
 *
 * It says at startup the two things whoever opens a session **cannot see alone**, and
 * would discover late and badly:
 *
 *  1. **Daiku is not opened on this project, or is halfway opened.** Without `.daiku/` every
 *     contract runs without project values: it does not fail, it *guesses*. And when
 *     `project.json` exists but is not valid JSON it is even worse, because every contract
 *     opens it before acting and stops there, one after another, without the reason ever
 *     being stated plainly.
 *  2. **There is work left halfway.** A working folder that already has the blueprint but
 *     not the review notes is work in flight: whoever opens a new session and restarts from
 *     scratch loses the brief already written, and almost always does not know it existed.
 *
 * **The project says where the working folders live**, via `{paths.studies}` in
 * `.daiku/project.json`: it is a parameter, not a convention to guess, and it is the same
 * key the method skills read to know where to deposit the numbered files. When it is not
 * declared, this notice does not exist — §6 of `contracts/project-contract.md`, *what the
 * JSON does not declare does not exist*. Better to stay silent than to rummage through two
 * folders picked from memory and report at every startup that nothing was found.
 *
 * The **names** of the numbered files stay hard-coded here, and that is no oversight: they are
 * the method, identical in every project, and a project renaming them would already have broken
 * the skills that write them.
 *
 * Contract: **fail-open and silent**. Nothing to say, unreadable file, missing folder,
 * any error → prints nothing and exits 0. It never blocks a session, and never speaks just
 * to say everything is fine: a notice that arrives every time stops being read.
 *
 * Test bench: `node session-advice.mjs --self-check`. It runs on a simulated filesystem and
 * touches nothing; the total is **counted**, not hard-coded. A broken fail-open hook is
 * indistinguishable from one with nothing to say: without a bench, a rename or a changed
 * layout would switch it off in silence.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext } from './daiku-config.mjs';

const ROOT = projectRoot();

const REAL_ENV = {
  exists: (path) => existsSync(path),
  read: (path) => readFileSync(path, 'utf-8'),
  list: (path) => {
    try {
      return readdirSync(path, { withFileTypes: true })
        .filter((v) => v.isDirectory())
        .map((v) => v.name);
    } catch {
      return [];
    }
  },
};

/** The file saying "the brief is here" and the one saying "the review landed". */
const BLUEPRINT = '2. blueprint.md';
const REVIEW = '4. review-notes.md';

/** Is Daiku opened on this project? And do its parameters read? */
export function installWarning(root, env) {
  const folder = join(root, '.daiku');
  if (!env.exists(folder)) return null;

  const params = join(root, '.daiku', 'project.json');
  if (!env.exists(params)) {
    return (
      '`.daiku/` exists but **`project.json` is missing**. Every contract opens it before acting: ' +
      'without it, this project\'s values are not read — they are guessed. ' +
      'Complete the installation with `/init`.'
    );
  }

  try {
    JSON.parse(env.read(params));
  } catch (error) {
    return (
      '**`.daiku/project.json` is not valid JSON** — ' +
      `\`${error.message}\`. Every contract opens it before acting and stops there. ` +
      'Fix it before running anything else.'
    );
  }

  return null;
}

/** Works left halfway: blueprint written, review never landed. */
export function openWorksWarning(root, env, ctx) {
  const pending = [];
  const sites = (ctx && ctx.present && ctx.studies) || [];

  for (const site of sites) {
    const base = join(root, site);
    if (!env.exists(base)) continue;
    for (const slug of env.list(base)) {
      const has = (file) => env.exists(join(base, slug, file));
      if (has(BLUEPRINT) && !has(REVIEW)) pending.push(`${site}/${slug}`);
    }
  }

  if (!pending.length) return null;

  const listing = pending.map((p) => `- \`${p}\``).join('\n');
  const single = pending.length === 1;
  return (
    `${single ? 'One work item is left' : `${pending.length} work items are left`} halfway: the ` +
    `brief is here, the review notes are not.\n\n${listing}\n\n` +
    `**Resume from there, not from scratch.** The blueprint carries the task plan, the Memory and the ` +
    `Journal of what was already done: restarting throws them away and remakes choices ` +
    `already made. If the work is dead instead, remove the folder — while it stays, this ` +
    `warning returns at every startup.`
  );
}

export function warnings(root, env, ctx) {
  return [installWarning(root, env), openWorksWarning(root, env, ctx)].filter(Boolean);
}

// --- test bench -----------------------------------------------------------

/** A simulated environment: a path → content map. Directories are inferred from paths. */
function fakeEnv(files) {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  const folders = new Set();
  for (const path of map.keys()) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) folders.add(parts.slice(0, i).join('/'));
  }
  return {
    exists: (p) => map.has(key(p)) || folders.has(key(p)),
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
    list: (p) => {
      const base = key(p) + '/';
      const children = new Set();
      for (const path of [...map.keys(), ...folders]) {
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length).split('/')[0];
        if (rest && folders.has(base + rest)) children.add(rest);
      }
      return [...children];
    },
  };
}

const R = 'C:/dev/project';

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- installation --------------------------------------------------------
  check('no .daiku/: no warning, not a Daiku project', installWarning(R, fakeEnv({})) === null);

  const healthy = { [`${R}/.daiku/project.json`]: '{"contract": 1, "name": "x"}' };
  check('healthy installation: no warning', installWarning(R, fakeEnv(healthy)) === null);

  const missingProject = { [`${R}/.daiku/environment.json`]: '{}' };
  const textMissing = installWarning(R, fakeEnv(missingProject));
  check('.daiku/ without project.json: warning', !!textMissing && textMissing.includes('`project.json` is missing'));
  check('the warning tells how to complete the installation', !!textMissing && textMissing.includes('/init'));

  const broken = { [`${R}/.daiku/project.json`]: '{"contract": 1,}' };
  const textBroken = installWarning(R, fakeEnv(broken));
  check('unparsable project.json: warning', !!textBroken && textBroken.includes('is not valid JSON'));
  check('the warning carries the parser message', !!textBroken && textBroken.length > 80);

  // --- works left halfway -------------------------------------------------------
  //
  // The location comes from the context, not the code: the three contexts below are the three
  // states a project can be in, and the first case of each group proves that without a
  // declaration nothing is searched anywhere.
  const CTX = fakeContext({ studies: ['docs/new-developments'] });
  const CTX_TWO = fakeContext({ studies: ['docs/new-developments', 'dev/new-developments'] });
  const CTX_NO_SITE = fakeContext({});
  const CTX_NO_DAIKU = fakeContext({ present: false });

  const open = { [`${R}/docs/new-developments/gamma/2. blueprint.md`]: 'x' };
  check('no declared location: no search', openWorksWarning(R, fakeEnv(open), CTX_NO_SITE) === null);
  check('project without Daiku: no search', openWorksWarning(R, fakeEnv(open), CTX_NO_DAIKU) === null);
  check('context missing entirely: no search', openWorksWarning(R, fakeEnv(open), undefined) === null);
  check('declared but empty location: no warning', openWorksWarning(R, fakeEnv({}), CTX) === null);

  const closed = {
    [`${R}/docs/new-developments/alfa/2. blueprint.md`]: 'x',
    [`${R}/docs/new-developments/alfa/4. review-notes.md`]: 'x',
  };
  check('closed work: no warning', openWorksWarning(R, fakeEnv(closed), CTX) === null);

  const problemOnly = { [`${R}/docs/new-developments/beta/0. problem.md`]: 'x' };
  check('study without blueprint: not an open work', openWorksWarning(R, fakeEnv(problemOnly), CTX) === null);

  const textOpen = openWorksWarning(R, fakeEnv(open), CTX);
  check('blueprint without review: warning', !!textOpen && textOpen.includes('gamma'));
  check('the warning says to resume, not to restart', !!textOpen && textOpen.includes('not from scratch'));
  check('the warning says how to stop it', !!textOpen && textOpen.includes('remove the folder'));
  check('a single work agrees in the singular', !!textOpen && textOpen.includes('One work item is left'));

  const otherSite = { [`${R}/dev/new-developments/delta/2. blueprint.md`]: 'x' };
  check('the second declared location is watched', (openWorksWarning(R, fakeEnv(otherSite), CTX_TWO) || '').includes('delta'));
  check('an undeclared location is not watched', openWorksWarning(R, fakeEnv(otherSite), CTX) === null);

  const two = {
    [`${R}/docs/new-developments/gamma/2. blueprint.md`]: 'x',
    [`${R}/dev/new-developments/delta/2. blueprint.md`]: 'x',
  };
  const textTwo = openWorksWarning(R, fakeEnv(two), CTX_TWO);
  check('two works: both listed', !!textTwo && textTwo.includes('gamma') && textTwo.includes('delta'));
  check('two works agree in the plural', !!textTwo && textTwo.includes('2 work items are left'));

  const outsideSite = { [`${R}/elsewhere/epsilon/2. blueprint.md`]: 'x' };
  check('outside the declared locations: silence', openWorksWarning(R, fakeEnv(outsideSite), CTX) === null);

  // --- the location read from a real project.json ----------------------------------
  const withSite = {
    exists: (p) => String(p).replace(/\\/g, '/').endsWith('.daiku/project.json'),
    read: () => '{"contract": 1, "paths": {"studies": "documentation/works"}}',
  };
  check('paths.studies comes from the JSON', loadContext(R, withSite).studies[0] === 'documentation/works');
  const withoutSite = {
    exists: (p) => String(p).replace(/\\/g, '/').endsWith('.daiku/project.json'),
    read: () => '{"contract": 1}',
  };
  check('paths.studies missing: no location', loadContext(R, withoutSite).studies.length === 0);

  // --- the combined set --------------------------------------------------------------
  check('clean project: no warnings', warnings(R, fakeEnv(healthy), CTX).length === 0);
  check('two distinct problems: two warnings', warnings(R, fakeEnv({ ...broken, ...open }), CTX).length === 2);
  check('fresh project: no warnings', warnings(R, fakeEnv({}), CTX_NO_DAIKU).length === 0);

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

function main() {
  const notices = warnings(ROOT, REAL_ENV, loadContext(ROOT, REAL_READS));
  if (!notices.length) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notices.join('\n\n---\n\n') },
    })
  );
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  try {
    main();
  } catch {
    /* fail-open: never block a session */
  }
  process.exit(0);
}
