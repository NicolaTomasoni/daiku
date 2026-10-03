---
name: catalogo-di-feature
description: "il valore di uno studio non è il censimento per repo ma il catalogo per feature: .daiku/features/<feature>/<slug-corsa>.md, una cartella per feature che cresce da repo diversi e fa da miniera"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-02
---

Dal 29 settembre 2026 `studia-repository` non produce solo un censimento per repo. Il censimento
vale per quel repo e serve alla verifica; **il confronto che vale è fra repo diversi che portano la
stessa cosa**, e vive in `.daiku/features/<feature>/<slug-corsa>.md` — una cartella per feature, un
file per corsa. Il catalogo cresce a strati, un repo alla volta, e quando si deciderà di costruire
quella feature la si svilupperà da lì: tre progetti che l'hanno risolta, con l'evidenza accanto.

**Cosa è un contributo, e quando è dovuto.** Una voce del censimento che è una **capacità
mancante** — `Classificazione: ABSENT`, cioè Daiku non ha quella cosa — diventa un contributo.
È **dovuto** quando la corsa propone di prenderla (`adotta`/`adatta`); è **lecito** anche su
`ispira` (la direzione è giusta e il come va studiato, che è esattamente materiale di miniera), e
questo è ciò che permette a una corsa **leggera** di contribuire. Una voce `allinea` non lo ha mai:
ripara il nostro corpus, non porta a casa niente dal target.

**La forma è fissa, ed è ciò che rende confrontabili due repo**: `# <titolo>`, tre campi —
`Feature` (uguale al nome della cartella), `Corsa` (uguale alla propria), `Ramo` (uguale a quello
registrato in `run.json`) — e cinque sezioni in quest'ordine: *Cosa fa il target*, *Come lo fa*,
*Cosa ha Daiku oggi, e cosa gli manca*, *Cosa porterebbe in Daiku*, *Evidenza*. L'evidenza sta
**dentro** il contributo, non solo come rinvio al ledger: il catalogo deve restare leggibile anche
quando la cartella della corsa non c'è più.

**Lo slug è condiviso e si riusa.** Minuscolo coi trattini singoli (`gestione-contesto`, `memoria`).
Prima di scrivere si elenca `.daiku/features/`: se la feature c'è, si scrive lì. Uno slug nuovo si
crea solo quando la feature è davvero un'altra, e un catalogo che si frammenta in tre nomi per la
stessa cosa non serve a nessuno. *(Il nome del file invece è lo slug della **corsa**, e quello porta
i doppi trattini di `owner--repo`: due regex diverse, e scambiarle è il modo di rompere il gate.)*

**La scrive la corsa, una per feature.** Il file si chiama come la corsa, quindi due corse parallele
sulla stessa feature scrivono due file diversi e non si incontrano. Il gate ammette, fuori dalla
radice delle corse, **solo** un file di contributo, e quello di un'altra corsa **solo se quella
corsa lo dichiara** in `run.json.contributi` — senza quella riga, due corse parallele si darebbero
il rosso a vicenda, come facevano col perimetro. Un contributo che nessuna corsa dichiara resta
rosso: una corsa non ne inventa uno a nome di un'altra. Le cancellazioni nel catalogo sono sempre
rosse.

**Why:** l'owner ha chiesto il 29 settembre 2026 di espandere lo studio in questa direzione, e ha
detto perché: «quasi nessuno sarà meglio di Daiku a essere Daiku», quindi i miglioramenti gratuiti
saranno pochi; il confronto interessante è «questo repo offre una feature che Daiku non ha e si
potrebbe inglobare?», e la sua risposta è una cartella **per feature** invece che per repo, «che può
fare da miniera per sviluppare quella feature in futuro, confrontando repo diversi che portano la
stessa».

**How to apply:**
- Il seat è dichiarato, non dedotto: `.claude/orchestration.md` § *Le sedi di questo progetto*, e
  `.claude/commands/studia-repository.md` § *Il catalogo delle feature* è il contratto.
- Il gate è tutto in `check-run.mjs`: la forma del contributo, il doppio senso con
  `run.json.contributi` e con la scheda, e il perimetro. `self-check.mjs` somma i due fratelli.
- Chi riprende una voce per costruirla parte da `.daiku/features/<feature>/`, non dal censimento di
  una corsa: il censimento è la prova che quel repo ha quella cosa, il catalogo è il confronto.
- `lotto.mjs applica` **elenca** il catalogo del lotto, non lo fonde: i contributi li scrivono le
  corse, e il lotto li legge da `run.json.contributi`.

Vedi [[lotto-di-studi]] per il lotto, le voci `allinea` e la sintesi — il problema in
`.daiku/features/<feature>/0. problem.md` che dal catalogo trae la scelta e lo scrive per
`new-feature`.
