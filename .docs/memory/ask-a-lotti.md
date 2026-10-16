---
name: ask-a-lotti
description: "L'owner vuole AskUserQuestion usato a lotti con il massimo numero di domande per chiamata, mai una domanda alla volta"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9aedd0db-fce0-4b17-acaa-05166383394b
  modified: 2026-10-16T16:36:40.279Z
---

**Le domande all'owner si chiedono a lotti, col massimo che lo strumento ammette, mai una alla
volta.** Detto dall'owner il 16 ottobre 2026, rispondendo a una scheda di decisioni di
`new-feature`: «smetti di chiedere una a una, user ask va sempre usato con massime opzioni
disponibili, non una alla volta».

**Why:** una domanda per volta costringe l'owner a una sequenza di giri su una lista che già
conosce: ogni attesa è tempo suo senza aggiungere informazione. Il tetto dello strumento (quattro
domande per chiamata su AskUserQuestion) è un limite tecnico, non il ritmo desiderato — il lotto
è la cosa più vicina alla lista intera che lo strumento permetta.

**How to apply:** quando una lista di decisioni va chiesta con `AskUserQuestion`, riempi ogni
chiamata fino a quattro domande e continua nelle chiamate successive finché la lista non è
esaurita; ogni domanda resta numerata `k/N` come vuole il contratto dell'ask. Vale per le liste
che l'owner non ha ancora visto — su una lista su cui hanno già risposto vale la loro istruzione.
**La regola ha due sedi, dal 16 ottobre 2026**: la prosa, in `contracts/orchestration.md`
§ *Ask the owner* e nel punto 7 di `new-feature`, e il controllo in `hooks/lib/ask-guard.mjs`, che
rifiuta un batch che si ferma sotto il tetto mentre restano carte — con il suo banco nel
`--self-check`. Vedi [[confine-del-giro]] per il canale delle decisioni,
[[guardrail-nascono-spenti]] per il diniego.
