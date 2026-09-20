# Commit convention

Answers the questions `/commit` asks: which commit types exist in this project and when each one
is used, what shape a message has, what goes into the changelog, and which version bump is
allowed.

**This file shipped with Daiku as a default, and from now on it is yours.** Rewrite it however you
like: no package update overwrites it. If you delete it, `/commit` derives the convention from the
commit history and says so in its report.

The **language** of the message is not declared here: `language.commit` in
`.daiku/project.json` carries it, because it is a value and not a judgement.

## Allowed types

| Type | When to use it |
|---|---|
| `feat` | new behaviour, visible to whoever uses the system |
| `fix` | a defect corrected |
| `refactor` | restructuring with behaviour unchanged |
| `perf` | performance improvement with behaviour unchanged |
| `test` | tests added or changed, without touching the code they cover |
| `docs` | documentation |
| `build` | dependencies, packaging, version |
| `ci` | integration pipeline |
| `chore` | maintenance that fits none of the above |

If a commit seems to belong to two types, **it is almost always two commits**.

## Message shape

```
type(area): description
```

- **description** — imperative, lowercase, no trailing period, within 72 characters.
- **area** — optional: the name of an area declared in `project.json`, or the module touched.
  Leave it out when the change does not sit in a single one.
- **body** — optional, short lines listing *what* was done. Not the reasoning: that lives in the
  decision document, which outlives the commit.

## Changelog

Only `feat` and `fix` produce an entry, because the changelog tells what changed for whoever uses
the system. Everything else — maintenance, tests, refactoring, documentation — produces none.

## Version

**Default: no bump.** The entry goes under the unreleased changes and the version number stays
where it is; `/commit` tells you so instead of deciding for you.

This is the conservative default because a version is a release gesture, and you are the one who
releases. To grant a bump, replace this paragraph by saying **which digit** may be moved — for
example "you may raise the patch yourself; minor and major stay mine" — and `/commit` will respect
that boundary, never more than one bump per invocation.
