---
name: meno-giri-nel-ciclo-di-review
description: "Il ciclo di review costa meno giri e meno agenti dal 15 ottobre 2026: sharding calcolato sulle righe aggiunte, nuovo ciclo incrementale sulla stessa BASE, la regola 2 senza il conteggio dei severe, i due giudizi perf e dead in un solo passo `form`, e il giro di chiusura sui test che riferisce invece di applicare"
metadata:
  node_type: memory
  type: project
  originSessionId: 48aeb214-1693-4294-8f67-91e3a937e19b
  modified: 2026-10-15T14:15:49.385Z
---

Dal 15 ottobre 2026 il ciclo di review — `skills/review/SKILL.md`, che è la sorgente, e
`skills/code-review/SKILL.md`, che ne porta la stessa cosa ristretta al bug — costa meno giri e meno
agenti. Le leve sono cinque, e ognuna toglie un agente che non leggeva niente di nuovo.

**Lo sharding del finder `bug` è calcolato, non giudicato.** `added_lines` lo misura lo scope
(`architect/ledger.mjs`), e sotto **10.000 righe aggiunte** il round 1 gira **un solo** finder su
tutto il diff: sopra, `N = min(4, ceil(added_lines / 10.000))`. **Il numero di file non sdoppia più**:
la soglia indicativa precedente — più di 2.000 righe **o** più di 30 file — tagliava in cinque shard
un diff da ~1.050 righe, e ogni finder riceveva ~210 righe e rileggeva per intero contratti,
istruzioni e contesto del ledger.

**Un nuovo ciclo sulla stessa `BASE` è incrementale.** Quando nella cartella di stato sta un ledger
**chiuso** con la stessa `base`, il round 1 non rilegge il diff: copre solo il delta fra l'albero
finale di quel ledger e l'albero di adesso, e un delta vuoto chiude senza lanciare finder. Un ledger
**aperto** con la stessa `base` **e** `item` resta invece una ripresa, non un ciclo nuovo.

**La regola 2 ha perso il conteggio dei severe.** Resta il solo rosso — del fast check o dei test
mirati — che è prova meccanica che il codice appena scritto è rotto. Il conteggio dei severe dice
quanto era sporco il perimetro, non quanto è sporco il delta: quei difetti sono già corretti, e ciò
che il giro dopo rileggerebbe è la correzione. Li pesa la regola 3, che chiede la domanda giusta — se
i severe stanno su codice che il round ha riscritto in più punti.

**`perf` e `dead` sono un passo solo, `form`.** Prima erano due worker che rispondevano a due
booleani e, se attivi, due finder: fino a quattro agenti. Adesso è **un** subagent che legge i due
contratti, giudica le due domande e, dove la risposta è sì, cerca lì e allora — il blocco è in
`skills/finder-prompt/SKILL.md` § *Two disciplines in one context*, e il passo sta nel round 1, non
più nella preparazione. Giudicare in un agente e cercare in un altro pagava un secondo contesto per
una domanda che il primo aveva già risposto. `arch` resta da solo: legge le policy e il documento di
architettura, e la sua domanda non è la forma del codice ma le regole che il progetto si è già dato.

**Il giro di chiusura sui test riferisce, non applica.** Il finder `bug` sui test scritti dalla
Coverage resta; l'applicatore no. Il ciclo è chiuso, dopo il finder gira solo il gate, e una
correzione scritta in quella finestra sarebbe l'unica scrittura non riletta di tutta la catena:
`architect/ledger.mjs` costruisce le voci `to_confirm` dai finding del round, e la modalità
*Closing round on tests mode* di `skills/applier/SKILL.md` non esiste più.

**Why:** un giro costa per agente, e ognuno di questi agenti rileggeva un diff che qualcun altro aveva
già letto, o rispondeva a una domanda che era già stata posta. Il conteggio dei severe era il
moltiplicatore: nel resoconto del 15 ottobre 2026 un round 1 con tre severe ha forzato un round 2 che
ha trovato **zero** finding.

**Un rosso del check apre ancora un round intero**, finder compreso. Quel round non ripara soltanto:
è anche quello che rilegge il delta dell'applicatore, e saltarne il finder sposterebbe la rilettura a
un round successivo invece di risparmiarla — un round in più, non uno in meno.

**How to apply:** le sedi sono `skills/review/SKILL.md` § *Finder* (sharding e passo `form`),
§ *Which disciplines run, at which round* (il ciclo incrementale), § *When to run another round*
(regola 2 e regola 3), § *Coverage* (il giro di chiusura); `skills/finder-prompt/SKILL.md`
§ *Two disciplines in one context*; l'aritmetica in `askRound` di `architect/architect.mjs`, i casi
`round:the-severe-count-is-not-a-trigger` e `round:merit-decides-over-three-severe` in `CASES`; e il
lato disco del giro di chiusura in `actRound` di `architect/ledger.mjs`, col suo caso di banco.
Si lancia con `node plugins/daiku/hooks/self-check.mjs`. Vedi [[valutatore-deterministico]],
[[test-mirati-nel-giro]] e [[gate-rosso-pre-esistente]].
