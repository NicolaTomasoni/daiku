---
description: 'Rilascia Daiku con bump di versione: verifiche, versione nei due manifest e nel badge, prosa AI, commit in dev, poi pubblicazione dist con un commit solo e senza push'
argument-hint: '[major | minor | patch]'
---

Rilasci Daiku in produzione. Il livello di bump lo decide l'owner: sta in `$ARGUMENTS`.
Se manca o non è uno fra `major`, `minor` e `patch`, chiedilo e fermati finché non arriva.

La divisione è fissa: **la versione la scrivi nei tre punti esatti e la verifichi, la prosa la
scrivi tu**. I numeri hanno una forma sola e un controllo che li rilegge; la sintesi delle note
in inglese, la voce di changelog e il messaggio di commit sono prosa, e li giudichi tu.

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
claude plugin validate plugins
python "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" plugins/daiku
node plugins/daiku/hooks/self-check.mjs
node .docs/tools/check-topology.mjs plugins/daiku
node .docs/tools/check-marketplace.mjs plugins
node .docs/tools/check-no-push.mjs --self-check
```

Le due vetrine sono lì dentro perché il loro guasto non si vede da qui: si vede solo in chi
installa, dopo che il rilascio è già uscito. L'ultima non guarda il pacchetto ma il cantiere:
verifica che nessuno script invochi un push, perché una riga dentro un file non passa da nessuna
guardia — vedi `.docs/memory/push-solo-manuale.md`.

## 2. I numeri: i tre punti della versione

La versione vecchia esce dai manifest, e i due devono essere già uguali: se sono disallineati,
**fermati e chiedi all'owner** quale delle due vale — non scegliere tu, e non "aggiustare" in
silenzio. La nuova la calcoli da quella: `major` azzera minor e patch, `minor` azzera la patch,
`patch` sale di uno.

Poi la scrivi in **tre punti e in nessun altro**:

| Sede | Cosa cambia |
|---|---|
| `plugins/daiku/.claude-plugin/plugin.json` | il valore di `"version"` |
| `plugins/daiku/.codex-plugin/plugin.json` | il valore di `"version"` |
| `plugins/README.md` | il badge in testa: sia `alt="version <v>"` sia `badge/version-<v>-` |

Sostituzioni puntuali: il resto del file non si riformatta, e nessun altro file porta la
versione.

Verifica di rilettura, prima di andare avanti — deve stampare `versione coerente: <v>` con la
versione nuova:

```bash
node -e "const r=require('fs');const a=JSON.parse(r.readFileSync('plugins/daiku/.claude-plugin/plugin.json')).version,b=JSON.parse(r.readFileSync('plugins/daiku/.codex-plugin/plugin.json')).version,rd=r.readFileSync('plugins/README.md','utf8');if(a!==b||!rd.includes('badge/version-'+a+'-')){console.error('versioni disallineate');process.exit(1)};console.log('versione coerente: '+a)"
```

Rossa, sistemi i tre punti e rilanci: nessuna delle verifiche del §1 va rifatta, ma la versione
resta coerente prima di scrivere il changelog.

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
### <nuova> — <oggi YYYY-MM-DD>

<note, o la riga di rimando al commit>
```

Versione e data stanno sulla stessa riga, separate da un dash lungo. Il livello del titolo è
sempre lo stesso, quale che sia il bump: un titolo più alto porta con sé una linea propria, e
accanto a quella orizzontale farebbe due righe di fila.

Fra una voce e quella sotto va **sempre** una linea orizzontale, preceduta e seguita da una riga
vuota.

Il corpo è **sempre un elenco puntato**, quale che sia il bump. Una voce per **modifica visibile**,
non per commit: un rename interno, un messaggio riscritto, una lingua corretta sono variazioni che
chi ha installato non vede, e stanno in **una sola riga in fondo** — `Various fixes.` o simile.
Anche una modifica visibile sola resta un elenco, di una voce sola.

## 5. Commit in dev

**La versione nasce in dev, e il commit viene prima della copia.** Dev è la fonte, la dist è la
copia: pubblicare senza il commit a monte lascia in dev una versione che non esiste in nessun
commit, e la §3 del rilascio successivo calcolerebbe il perimetro da un albero sbagliato.

Committa in dev tutto ciò che compone questo rilascio: la versione nei tre punti della §2, la
voce di changelog della §4, e ogni altra modifica del working tree che appartiene al rilascio.
Sono gruppi distinti, e vanno in commit separati secondo la convenzione del repository: lancia
`/commit` (`.claude/commands/commit.md`), che li conosce già.

Poi verifica che l'albero sia **pulito**:

```bash
git status --porcelain
```

Se resta qualcosa, la copia della §6 lo porterebbe in pubblicazione senza che nessun commit di
dev lo dichiari: committalo, o toglilo dall'albero prima di copiare. **Un rilascio non parte
con dev sporco.**

## 6. Pubblicazione

Componi il messaggio — `release <nuova>`, più ` — <prima riga delle note>` se le note ci sono —
e lancia:

```powershell
.docs/tools/pubblica-dist.ps1 -Messaggio '<messaggio>'
```

Fa gate stretto, riversa `plugins/` nel dist e committa là con UN commit solo. **Non pusha**: il
push è un gesto manuale dell'owner, e nessuno lo fa al posto suo — né questo comando, né lo
script. Il commit nel dist resta locale finché l'owner non lo pusha.

**Su produzione va sempre e solo un commit per bump**, che sia `major`, `minor` o `patch`: uno solo
e comprensivo di tutto — versione, changelog e ogni modifica del rilascio insieme. I commit separati
della §5 restano in dev; nella dist non si spezza mai un rilascio in più commit, e lo script si
lancia una volta sola.

## 7. Report

Versione vecchia e nuova, i commit del rilascio su dev con i loro SHA, il commit della dist col
suo SHA — **e che il push resta all'owner**. Poi cosa contiene il rilascio in una riga, e la prova
che la copia è fedele:

```bash
diff -rq plugins/ ../daiku -x .git
```

Nessuna riga di output e uscita `0`: la dist è identica a ciò che dev ha committato.
