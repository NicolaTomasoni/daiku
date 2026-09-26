#!/usr/bin/env node
/**
 * Topology verifier for the Daiku contract corpus.
 *
 * Development tool, not guest code: it lives outside `plugins/daiku/` so it never
 * ships with the package, it is never installed into a project and is never
 * hooked to an event. Run by hand and before a release, beside `hooks/self-check.mjs`:
 *
 *   node .docs/tools/check-topology.mjs plugins/daiku
 *
 * The root always arrives as an argument and is never derived from this file's position
 * on disk. Output is counted JSON `{checks, passed, failed[]}`; exit `1` on the first
 * red, same convention as the hook benches.
 *
 * It verifies four machine-checkable properties of the corpus:
 *
 * 1. the nodes on disk are all and only the table rows of `contracts/orchestration.md` §3;
 * 2. every contract handed to a subagent as a contract to read appears among the
 *    callers of its own row (mere block citations are not handoffs and are ignored);
 * 3. every `§ *X*` section reference resolves to a heading in the cited file;
 * 4. every handoff of an orchestrating contract declares the role it runs on — with its own
 *    fixtures, green and red, counted among the checks.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) {
  process.stderr.write('usage: node check-topology.mjs <package-root>\n');
  process.exit(2);
}

const checks = [];
const failed = [];
function check(name, ok, detail) {
  checks.push(name);
  if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf-8').split(/\r?\n/);
}

/** Disk nodes: every folder under skills/ carrying a SKILL.md. */
let diskNodes = [];
try {
  diskNodes = readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => {
      try {
        readFileSync(join(ROOT, 'skills', n, 'SKILL.md'));
        return true;
      } catch {
        return false;
      }
    })
    .sort();
} catch (error) {
  process.stdout.write(JSON.stringify({ checks: 0, passed: 0, failed: [`skills-unreadable: ${error.message}`] }) + '\n');
  process.exit(1);
}

/** Table rows: first cell (node) and second cell (callers) of the §3 table. */
const orchLines = read('contracts/orchestration.md');
const rows = [];
{
  let inTable = false;
  for (const line of orchLines) {
    if (/^\|\s*Node\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    if (/^\|[\s:\-|]+\|$/.test(line)) continue;
    const cells = line.split('|');
    if (cells.length < 4) continue;
    const tokens = [...cells[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!tokens.length) continue;
    rows.push({ node: tokens[0], callers: cells[2] });
  }
}
const rowNames = rows.map((r) => r.node).sort();

/* Property 1: disk nodes = table rows, both directions. */
for (const n of diskNodes) check(`node-row:${n}`, rowNames.includes(n), 'on disk but not a table row');
for (const n of rowNames) check(`row-node:${n}`, diskNodes.includes(n), 'table row with no file on disk');

const nodeSet = new Set(diskNodes);
function skillFile(name) {
  return `skills/${name}/SKILL.md`;
}

/* Property 2: handoffs. A line naming skills/<n>/SKILL.md is a handoff only when the
   surrounding lines carry a handoff verb; block citations never match. */
const HANDOFF_VERBS = [
  'contract to read',
  'read in full',
  'fully reading',
  'fully run',
  'delegate it to a subagent',
  'to a subagent running',
  'it runs',
];
const skillTexts = {};
for (const n of diskNodes) skillTexts[n] = read(skillFile(n)).join('\n');
for (const citer of diskNodes) {
  const lines = read(skillFile(citer));
  lines.forEach((line) => {
    for (const m of line.matchAll(/skills\/([a-z-]+)\/SKILL\.md/g)) {
      const cited = m[1];
      if (cited === citer || !nodeSet.has(cited)) continue;
      // Handoff = path and verb on the SAME line: a block citation below never
      // matches, and a verb two lines away belongs to another sentence.
      if (!HANDOFF_VERBS.some((v) => line.toLowerCase().includes(v))) continue;
      const row = rows.find((r) => r.node === cited);
      const ok = !!row && new RegExp(`\`${citer}\``).test(row.callers);
      check(`caller:${citer}->${cited}`, ok, ok ? '' : `skills/${citer}/SKILL.md hands ${cited} to a subagent but ${citer} is not among its row callers`);
    }
  });
}

/* Property 4: every handoff of an orchestrating contract declares the role it runs on. The
   model resolves from the role alone (§2 of contracts/orchestration.md): a delegation without
   one runs on whatever the host defaults to, and nothing says so. The orchestrating contracts
   are the rows whose "Re-delegates" cell opens with "yes"; a handoff is Property 2's (path and
   verb on the same line). The role counts on the handoff line, in its paragraph or list, in the
   heading of its section, or in the bold lead-in opening its step inside that section. */
const ROLE = /\*\*(judge|worker)\*\*|\b(judge|worker) role\b/i;
function unroledHandoffs(lines, self) {
  const out = [];
  let heading = -1;
  lines.forEach((line, i) => {
    if (/^#{1,4}\s/.test(line)) heading = i;
    for (const m of line.matchAll(/skills\/([a-z-]+)\/SKILL\.md/g)) {
      if (m[1] === self || !HANDOFF_VERBS.some((v) => line.toLowerCase().includes(v))) continue;
      let from = i;
      while (from > 0 && lines[from - 1].trim() !== '' && !/^#{1,4}\s/.test(lines[from - 1])) from -= 1;
      let to = i;
      while (to < lines.length - 1 && lines[to + 1].trim() !== '' && !/^#{1,4}\s/.test(lines[to + 1])) to += 1;
      let lead = '';
      for (let k = i; k > heading; k -= 1) {
        if (/^\*\*/.test(lines[k])) {
          lead = lines[k];
          break;
        }
      }
      const declared = [line, lines.slice(from, to + 1).join('\n'), heading >= 0 ? lines[heading] : '', lead].some((t) => ROLE.test(t));
      if (!declared) out.push({ line: i + 1, cited: m[1] });
    }
  });
  return out;
}
const ROLE_FIXTURES = [
  { id: 'role-in-the-heading', ok: true, text: '### 1. Brief — **judge** role\n\n- read in full `skills/blueprint/SKILL.md` and follow it' },
  { id: 'role-in-the-list', ok: true, text: '## Step 2\n\nLaunch a subagent:\n\n- the **contract to read**: `skills/study/SKILL.md`;\n- the **step role**: **worker**;' },
  { id: 'role-in-the-lead-in', ok: true, text: '### 5. Memory\n\n**5b. Update — judge role.** In the prompt:\n\n- read in full `skills/update-memory/SKILL.md`' },
  { id: 'role-on-the-line', ok: true, text: '### Closing\n\nDelegate it to a **judge** subagent fully reading `skills/commit/SKILL.md`.' },
  { id: 'no-role-anywhere', ok: false, text: '### 10. Delivery — `develop-feature`\n\nDelegate the whole delivery to a subagent running `skills/develop-feature/SKILL.md`.' },
  { id: 'a-role-of-another-section', ok: false, text: '### 1. Brief — **judge** role\n\nx\n\n### 3. Review\n\nFully run `skills/review/SKILL.md`.' },
  { id: 'a-role-of-another-paragraph', ok: false, text: '### 3. Review\n\nThe **worker** of phase 2 left notes.\n\nFully run `skills/review/SKILL.md`.' },
];
for (const fixture of ROLE_FIXTURES) {
  const found = unroledHandoffs(fixture.text.split('\n'), 'fixture');
  check(`role-fixture:${fixture.id}`, (found.length === 0) === fixture.ok, `expected ${fixture.ok ? 'no' : 'an'} unroled handoff, found ${found.length}`);
}
const orchestrating = [];
{
  let inTable = false;
  for (const line of orchLines) {
    if (/^\|\s*Node\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    const cells = line.split('|');
    const node = ((cells[1] || '').match(/`([^`]+)`/) || [])[1];
    if (node && nodeSet.has(node) && /^\s*yes\b/i.test(cells[5] || '')) orchestrating.push(node);
  }
}
check('role:orchestrating-rows-read', orchestrating.length > 0, 'no row of the §3 table re-delegates');
for (const node of orchestrating) {
  const unroled = unroledHandoffs(read(skillFile(node)), node);
  check(`role:${node}`, unroled.length === 0, unroled.map((u) => `skills/${node}/SKILL.md:${u.line} hands ${u.cited} to a subagent with no role`).join('; '));
}

/* Property 3: section references. */
function norm(s) {
  return s.toLowerCase().replace(/[*`"'()]/g, '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim();
}
function headingsOf(rel) {
  return read(rel)
    .filter((l) => /^#{1,4}\s/.test(l))
    .map((l) => norm(l.replace(/^#{1,4}\s*/, '')));
}
const headingCache = {};
function headings(rel) {
  if (!headingCache[rel]) {
    try {
      headingCache[rel] = headingsOf(rel);
    } catch {
      headingCache[rel] = null;
    }
  }
  return headingCache[rel];
}
function matchHeading(heads, ref) {
  const r = norm(ref);
  if (!r) return false;
  return heads.some((h) => h === r || h.startsWith(r) || h.includes(` ${r}`));
}
function matchNumbered(heads, ref) {
  const major = ref.split('.')[0];
  return heads.some((h) => h.startsWith(`${major}.`) || h.startsWith(`${major} `));
}

const SREF = /§\s*\*([^*]{1,120})\*/g;
const NREF = /§\s*(\d+(?:\.\d+)?)/g;
const PATH_RE = /(skills\/[a-z-]+\/SKILL\.md|contracts\/[a-z-]+\.md|schemas\/blocks\.json)/g;

/* Headings of schemas/blocks.json: top-level keys and block names. */
function blocksKeys() {
  try {
    const b = JSON.parse(readFileSync(join(ROOT, 'schemas/blocks.json'), 'utf-8'));
    return ['blocks', 'ledger', 'params', ...Object.keys(b.blocks || {}), 'round_required', 'project_json', 'environment_json', 'contract_expected'];
  } catch {
    return [];
  }
}

/**
 * Resolve the file a `§ *X*` reference on `line` (in `rel`) points at.
 * Returns {target, strict}: strict forms name their file explicitly and are
 * checked there alone; the fallback (the current file) is checked together
 * with the last skills path of the section by the caller. `null` target means
 * owner's prose: nothing to check.
 */
function resolveTarget(rel, line, refIndex, rowNode) {
  const paths = [...line.matchAll(PATH_RE)].map((m) => m[1]);
  // Form 1: § *X* of `PATH` — the path follows the reference.
  const tail1 = line.slice(refIndex);
  const suffix = tail1.match(/^§\s*\*[^*]+\*\s*(?:,[^*`]*?)?of\s+`?(skills\/[a-z-]+\/SKILL\.md|contracts\/[a-z-]+\.md|schemas\/blocks\.json)`?/);
  if (suffix) return { target: suffix[1], strict: true };
  // Form 1b: § *X* of `node` — the node follows the reference.
  const tail = line.slice(refIndex);
  const suffixBare = tail.match(/^§\s*\*[^*]+\*\s*(?:,[^*`]*?)?of\s+`([a-z-]+)`/);
  if (suffixBare && nodeSet.has(suffixBare[1])) return { target: skillFile(suffixBare[1]), strict: true };
  // Form 2: `PATH`, § *X* — nearest path before the reference, adjacent to it
  // (only a closing backtick, comma or spaces between).
  for (const p of paths) {
    const at = line.indexOf(p);
    if (at >= 0 && at < refIndex && /^`?\s*,?\s*$/.test(line.slice(at + p.length, refIndex))) {
      // Nearest path only: a farther one belongs to another reference.
      const nearer = paths.some((q) => q !== p && line.indexOf(q) > at && line.indexOf(q) < refIndex);
      if (!nearer) return { target: p, strict: true };
    }
  }
  // Form 3: `node` § *X* — a bare node name adjacent before the reference.
  const adj = line.slice(0, refIndex).match(/`([a-z-]+)`\s*$/);
  if (adj && nodeSet.has(adj[1])) return { target: skillFile(adj[1]), strict: true };
  // Form 4: rows of the §3 table.
  if (rowNode) {
    const cell = line;
    if (/\bits\s+§|\bof its file\b|\bin its file\b/.test(cell)) return { target: skillFile(rowNode), strict: true };
    const names = [...cell.slice(0, refIndex).matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).filter((n) => nodeSet.has(n) || n === 'owner');
    const last = names.filter((n) => n !== 'owner').pop();
    if (last) return { target: skillFile(last), strict: true };
    if (names.includes('owner')) return { target: null, strict: true }; // owner's prose: nothing to check
    return { target: skillFile(rowNode), strict: true };
  }
  // Form 5: /node/ pointer on the line — outside paths (a path's own
  // slashes, as in skills/<node>/SKILL.md, never count).
  const depathed = line.replace(PATH_RE, '');
  const slash = depathed.match(/\/([a-z-]+)[`/]/);
  if (slash && nodeSet.has(slash[1])) return { target: skillFile(slash[1]), strict: true };
  // Form 6: "its own §" — the owning node named just before it.
  if (/its own\s+§/.test(line.slice(Math.max(0, refIndex - 30), refIndex + 40))) {
    const prev = line.slice(Math.max(0, refIndex - 120), refIndex);
    const fromPath = [...prev.matchAll(/skills\/([a-z-]+)\/SKILL\.md/g)].map((m) => m[1]).filter((n) => nodeSet.has(n)).pop();
    const backt = [...prev.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).filter((n) => nodeSet.has(n)).pop();
    const plain = prev.replace(/`[^`]*`/g, ' ');
    const word = [...plain.matchAll(/\b([a-z-]+)\b/g)].map((m) => m[1]).filter((n) => nodeSet.has(n)).pop();
    if (fromPath || backt || word) return { target: skillFile(fromPath || backt || word), strict: true };
  }
  // Form 7: § *X* above|below — the current file.
  if (/§\s*\*[^*]+\*\s*(above|below)/.test(tail1)) return { target: rel, strict: true };
  return { target: rel, strict: false };
}

function filesToScan() {
  const out = ['contracts/orchestration.md', 'contracts/project-contract.md'];
  for (const n of diskNodes) out.push(skillFile(n));
  return out;
}

for (const rel of filesToScan()) {
  const lines = read(rel);
  let sectionPath = null;
  lines.forEach((line, i) => {
    if (/^#{1,4}\s/.test(line)) sectionPath = null;
    for (const pm of line.matchAll(PATH_RE)) {
      if (/^skills\//.test(pm[1])) sectionPath = pm[1];
    }
    const isTableRow = rel.endsWith('orchestration.md') && line.startsWith('|');
    const rowNode = isTableRow
      ? ((line.split('|')[1].match(/`([^`]+)`/) || [])[1] || null)
      : null;
    const rowName = rowNode && nodeSet.has(rowNode) ? rowNode : null;
    // Named references.
    for (const m of line.matchAll(SREF)) {
      if (/["']$/.test(line.slice(0, m.index))) continue; // quoted example, not a reference
      const r = resolveTarget(rel, line, m.index, rowName);
      const headList = (t) => (t === 'schemas/blocks.json' ? blocksKeys() : headings(t));
      const name = `secref:${rel}:${i + 1}:${m[1]}`;
      if (r.target === null) {
        check(name, true, '');
        continue;
      }
      if (r.strict) {
        const heads = headList(r.target);
        const ok = !!heads && matchHeading(heads, m[1]);
        check(name, ok, ok ? '' : `no heading for '${m[1]}' in ${r.target}`);
        continue;
      }
      // Fallback: the current file first, then the last skills path of the section.
      const tried = [rel];
      let heads = headList(rel);
      let ok = !!heads && matchHeading(heads, m[1]);
      if (!ok && sectionPath && sectionPath !== rel) {
        tried.push(sectionPath);
        heads = headList(sectionPath);
        ok = !!heads && matchHeading(heads, m[1]);
      }
      check(name, ok, ok ? '' : `no heading for '${m[1]}' in ${tried.join(' or ')}`);
    }
    // Numbered references (§4, §4.2): current file, else either contract.
    for (const m of line.matchAll(NREF)) {
      const ref = m[1];
      const inPath = [...line.matchAll(PATH_RE)].map((x) => x[1]);
      const candidates = inPath.length ? inPath : [rel, 'contracts/orchestration.md', 'contracts/project-contract.md'];
      let ok = false;
      for (const c of candidates) {
        const heads = headings(c);
        if (heads && matchNumbered(heads, ref)) {
          ok = true;
          break;
        }
      }
      check(`secref:${rel}:${i + 1}:§${ref}`, ok, ok ? '' : `no §${ref} heading in ${candidates.join(' or ')}`);
    }
  });
}

const passed = checks.length - failed.length;
process.stdout.write(JSON.stringify({ checks: checks.length, passed, failed }) + '\n');
process.exit(failed.length ? 1 : 0);
