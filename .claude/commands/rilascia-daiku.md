---
description: 'Rilascia Daiku con bump di versione: se il working tree di plugins/ porta modifiche le fa passare da code review e commit, se invece è pulito prende i commit già in dev così come sono; poi verifiche, versione nei due manifest e nel badge, prosa AI, pubblicazione sul canale beta e promozione in produzione secondo il bump'
argument-hint: '[major | minor | patch] [--with-main]'
---

Rilasci Daiku. Il livello di bump lo decide l'owner: sta in `$ARGUMENTS`.
Se manca o non è uno fra `major`, `minor` e `patch`, chiedilo e fermati finché non arriva.
`--with-main` è l'ordine esplicito di portare in produzione anche una patch, e ha senso solo
con `patch`.

## I due canali

Il checkout di dist (`C:\dev\daiku-workspace\daiku`) lavora stabilmente sul ramo **beta**, e ogni
rilascio atterra lì. La produzione è il ramo **main**, e ci arriva solo per promozione, mai da
qui. La regola:

| Bump | Dove va il rilascio |
|---|---|
| `patch` | solo beta |
| `minor`, `major` | beta e main: la promozione fa parte del rilascio |

Una patch va in main solo quando l'owner lo chiede, cioè con `--with-main`. Quando main avanza
si porta dietro **tutte** le patch che non aveva ancora: è il fast-forward, non una scelta.

La divisione è fissa: **la versione la scrivi nei tre punti esatti e la verifichi, la prosa la
scrivi tu**. I numeri hanno una forma sola e un controllo che li rilegge; la sintesi delle note
in inglese, la voce di changelog e il messaggio di commit sono prosa, e li giudichi tu.

## 0. Da dove si parte: lo dice il disco

Quale strada prende il rilascio non è un giudizio e non si chiede all'owner: si misura una volta
all'inizio, e resta quella per tutto il rilascio. Il perimetro è `plugins/`, cioè ciò che la copia
della §6 porta: il resto del working tree non decide niente qui.

**Cosa resta da pubblicare lo dice il dist, non la storia di dev.** Un confine misurato sui commit
di dev — «l'ultimo che ha toccato la versione» — presume che ogni commit di versione in dev sia già
stato copiato, e non è sempre così: se la §5 ha committato la versione e la §6 è fallita (checkout
non su `beta`, gate dei residui), quel contenuto resta in dev senza essere mai uscito, e al rilascio
successivo un confine interno a dev lo scavalcherebbe — le note lo perderebbero e, ad albero pulito,
si sceglierebbe la strada C mentre il dist è indietro. La misura giusta è il confronto con ciò che
beta contiene davvero, lo stesso `diff` della §8:

```bash
# ciò che la copia porterebbe e non è ancora committato
git status --porcelain -- plugins/
# contenuto di dev non ancora nel dist: vuoto = allineati, righe = mai pubblicato
diff -rq plugins/ ../daiku -x .git
```

Il primo stampa una riga per file modificato o non tracciato dentro `plugins/`, o niente; il secondo
una riga per ciò che il dist non ha ancora, o niente. Da lì la strada, e non se ne esce:

| Working tree su `plugins/` | dist vs `plugins/` | Strada |
|---|---|---|
| sporco | qualsiasi | **A — review, poi commit** |
| pulito | diverso | **B — dritto al rilascio** |
| pulito | uguale | **C — niente da rilasciare** |

**A — il working tree porta modifiche.** Sono le richieste fatte via chat, e passano dalla review
prima di entrare nella storia:

1. **`/daiku:code-review`** sul solo diff del working tree: è il perimetro che ha qualcosa da
   leggere. Va in loop fino a che il codice smette di cambiare, applica da sé le correzioni reali,
   e si ferma al report.
2. **`/daiku:commit`** (`plugins/daiku/skills/commit/SKILL.md`), che conosce la convenzione del
   repository e separa i gruppi: porta ciò che la review ha lasciato.
3. Da qui la §1: versione e changelog nascono dopo, e li committa la §5.

**B — il working tree è pulito e il dist è indietro.** Il contenuto in attesa è già committato in
dev e il dist ancora non lo ha: o perché l'ha lasciato una consegna — `daiku:new-feature` o
`daiku:ship-feature` — che l'ha già fatto passare dalla propria review, o perché la pubblicazione di
un rilascio precedente non è arrivata a destinazione dopo che la versione era già committata.
**Non si rivede niente e non si committa niente**, e non c'è nessuna conferma da chiedere. Quel
contenuto *è* il rilascio: si va dritti alla §1.

**C — né modifiche né commit.** Non c'è altro da rilasciare che il numero nuovo: dillo e fermati,
senza chiedere.

Le modifiche del working tree che **non appartengono al rilascio** — il lavoro in corso di un'altra
sessione — restano fuori dai suoi commit: la copia della §6 prende `plugins/` e nient'altro.

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
node .docs/tools/check-channel.mjs
```

Il corpus non è qui: lo impone il gate dell'area `daiku` a ogni consegna che tocca il pacchetto.

Le due vetrine sono lì dentro perché il loro guasto non si vede da qui: si vede solo in chi
installa, dopo che il rilascio è già uscito. `check-no-push` non guarda il pacchetto ma il
cantiere: verifica che nessuno script invochi un push, perché una riga dentro un file non passa da
nessuna guardia — vedi `.docs/memory/push-solo-manuale.md`. `check-channel` prova i due script di
canale su repository usa e getta: che il rilascio si fermi se il checkout non sta su beta, e che la
promozione rifiuti un non fast-forward.

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

Leggi cosa è cambiato dall'ultimo stato che il dist già contiene — il perimetro è deterministico:
i commit di dev che toccano `plugins/` dopo il confine, più il diff del working tree. Il confine è
l'ultimo commit di dev il cui `plugins/` è identico alla radice del dist:

```bash
# il confine: l'ultimo commit il cui plugins/ è già nel dist
# (nessuno combacia = il dist non contiene ancora nulla, si parte dalla radice)
T=$(git -C ../daiku rev-parse 'HEAD^{tree}')
C=$(for c in $(git log --format=%H -n 400 -- plugins/); do [ "$(git rev-parse "$c:plugins")" = "$T" ] && { echo "$c"; break; }; done)
git log --format='%h %s' "${C:-$(git rev-list --max-parents=0 HEAD)}..HEAD" -- plugins/
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
`/daiku:commit` (`plugins/daiku/skills/commit/SKILL.md`), che li conosce già.

Poi verifica che il perimetro che la copia porta — `plugins/` — sia **pulito**:

```bash
git status --porcelain
```

Se resta qualcosa **dentro quel perimetro**, la copia della §6 lo porterebbe in pubblicazione senza
che nessun commit di dev lo dichiari: committalo, o toglilo dall'albero prima di copiare. Fuori da
lì il lavoro in corso di un'altra sessione resta dov'è, e la copia non lo prende. **Un rilascio non
parte con `plugins/` sporco.**

## 6. Pubblicazione

Componi il messaggio — `release <nuova>`, più ` — <prima riga delle note>` se le note ci sono —
e lancia:

```powershell
.docs/tools/pubblica-dist.ps1 -Messaggio '<messaggio>'
```

Fa gate stretto, riversa `plugins/` nel dist e committa su **beta** con UN commit solo. Se il
checkout di dist non stesse su beta lo script si ferma: la produzione non si tocca da qui.
**Non pusha**: il push è un gesto manuale dell'owner, e nessuno lo fa al posto suo — né questo
comando, né lo script. Il commit su beta resta locale finché l'owner non lo pusha.

**Un rilascio è sempre e solo un commit per bump**, che sia `major`, `minor` o `patch`: uno solo
e comprensivo di tutto — versione, changelog e ogni modifica del rilascio insieme. I commit separati
della §5 restano in dev; nel dist non si spezza mai un rilascio in più commit, e lo script si
lancia una volta sola.

## 7. Promozione in produzione

Solo se il bump è `minor` o `major`, oppure se l'owner ha chiesto `--with-main`. Negli altri
casi questo passo non si esegue e main resta dov'è.

```powershell
.docs/tools/promuovi-dist.ps1 -Versione <nuova>
```

Verifica che la promozione sia un fast-forward e sposta `main` locale sul rilascio appena
pubblicato, portandosi dietro tutte le patch arretrate. **Non pusha**, come lo script di
pubblicazione. Se main avesse un commit che beta non ha, lo script si ferma: allinealo prima.

## 8. Report

Versione vecchia e nuova, i commit del rilascio su dev con i loro SHA, il commit di beta col suo
SHA, se main è stato promosso e fino a dove — **e che i push restano all'owner**: quello di beta
sempre, quello di main quando la promozione c'è stata. Poi cosa contiene il rilascio in una riga,
e la prova che la copia è fedele:

```bash
diff -rq plugins/ ../daiku -x .git
```

Nessuna riga di output e uscita `0`: la dist è identica a ciò che dev ha committato.
