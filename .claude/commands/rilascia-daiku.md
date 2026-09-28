---
description: 'Rilascia Daiku con bump di versione: verifiche, numeri dallo script, prosa AI, pubblicazione dist con un commit solo'
argument-hint: '[major | minor | patch]'
---

Rilasci Daiku in produzione. Orchestri tu, gli script eseguono i passi deterministici.
Il livello di bump lo decide l'owner: sta in `$ARGUMENTS`. Se manca o non è uno fra
`major`, `minor` e `patch`, chiedilo e fermati finché non arriva.

La divisione è fissa: **i numeri li scrive lo script, la prosa la scrivi tu**.
Versione nei manifest e badge, formato del messaggio, verifiche di coerenza — deterministico.
Sintesi delle note in inglese, voce di changelog, messaggio di commit — AI.

## 0. Working tree: committare prima?

Prima delle verifiche, guarda se il working tree di dev è sporco:

```bash
git status --porcelain
```

Se l'output è vuoto, vai oltre. Se c'è qualcosa, **chiedi all'owner con AskUserQuestion**
se vuole prima lanciare `/commit`, e fermati finché non risponde: opzioni «Sì, committa
prima» / «No, rilascia così».

Se risponde sì, esegui `/commit` (il comando `.claude/commands/commit.md`) e riprendi da
qui con l'albero pulito. Se risponde no, procedi: il perimetro delle note resta quello
della §3 — commit dopo l'ultimo rilascio più diff del working tree.

## 1. Verifiche pre-rilascio

Prima di toccare un file, tutte verdi o il rilascio si ferma qui:

```bash
claude plugin validate plugins/daiku
python "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" plugins/daiku
node plugins/daiku/hooks/self-check.mjs
node .docs/tools/check-topology.mjs plugins/daiku
```

## 2. I numeri: script, primo tempo

```bash
node .docs/tools/rilascia-daiku.mjs --bump <livello> --solo-file
```

Scrive la nuova versione nei due manifest e nel badge di `plugins/README.md`, con
rilettura di verifica, e stampa `vecchia=` e `nuova=`. Niente changelog, niente
pubblicazione. Se esce `1`, sistemi il working tree e rilanci da qui.

## 3. La prosa: note AI in inglese

Leggi cosa è cambiato dall'ultimo rilascio — il perimetro è deterministico: i commit
di dev dopo l'ultimo che ha toccato la versione, più il diff del working tree:

```bash
git log --format='%h %s' $(git log --format=%H -n 1 -- plugins/daiku/.claude-plugin/plugin.json)..HEAD
git diff --stat HEAD
```

Ne scrivi la sintesi in inglese, una riga: cosa cambia per chi installa, mai i path
interni. Se non c'è niente da dire oltre la versione, la riga resta vuota.

## 4. La prosa nei file: changelog

Preponi la voce a `plugins/CHANGELOG.md`, subito sotto l'intestazione (se il file
manca, crealo con `# Changelog` in testa):

```markdown
## <nuova> — <oggi YYYY-MM-DD>

<note, o la riga di rimando al commit>
```

## 5. Pubblicazione: script, secondo tempo

Componi il messaggio con la stessa regola dello script — `release <nuova>`, più
` — <prima riga delle note>` se le note ci sono — e lancia:

```powershell
.docs/tools/pubblica-dist.ps1 -Messaggio '<messaggio>'
```

Fa gate stretto, riversa `plugins/` nel dist con UN commit solo e pusha. Il bump e il
changelog nel working tree di dev non li committi qui: seguono il flusso normale.

## 6. Report

Versione vecchia e nuova, messaggio pubblicato, cosa contiene il rilascio in una riga.
I tre task «Daiku: rilascio major/minor/patch» restano per il lancio senza agente —
stesso script, note headless o forzate — ma il rilascio guidato è questo comando.
