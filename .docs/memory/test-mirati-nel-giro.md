---
name: test-mirati-nel-giro
description: "A ogni round del ciclo di review i test mirati dei moduli toccati girano e il loro esito vive nel campo `check_tests` del ledger: perché un rosso diventa un finding `check` riparabile, perché il campo è nuovo invece di allargare `check_fast`, e perché il gap fra `check_fast` e gate in `init` si dichiara e non si ripara"
metadata:
  node_type: memory
  type: project
---

Dal 3 ottobre 2026 il giro del ciclo di review — `skills/review/SKILL.md` e quello ristretto di
`skills/code-review/SKILL.md` — esegue a **ogni** round i **test mirati**, non solo alla fine. Dopo
il fast check, per ogni area toccata che dichiara `{areas.<area>.test_targeted}`, l'agente **nomina**
i file di test che coprono i moduli toccati — leggendo il repository: la scelta è una lettura, non
una misura, come al gate — esegue il comando dichiarato su quei file e ne registra l'esito
`green|red|skipped` nella voce **`check_tests`** del round, con i **file di test** (non i file toccati)
in `files`. Un rosso impone un altro round per la regola 2 già esistente, estesa a leggere il campo
nuovo, e diventa un finding di disciplina `check` del round successivo che **nomina i file di test** —
che possono stare fuori dal diff — e che l'applier ripara. Il campo vive nel solo ledger: la sua forma
sta in `schemas/blocks.json` § *ledger*, la sintesi del finding e la validazione in
`architect/ledger.mjs`, la regola del round in `architect/architect.mjs`.

**Why:** il gate era l'unico passo a lanciare la suite, **una volta, dopo tutti i round**, e non
riapre il ciclo. Un test che il diff faceva precipitare — in un file che il diff non toccava —
attraversava ogni round a luci verdi e moriva al gate, dove nessun passo poteva più ripararlo: la
consegna chiudeva `BLOCKED_NO_COMMIT` con la worktree sporca, e l'owner finiva il lavoro a mano. Il
canale di riparazione esisteva già — il rosso del `check_fast` diventa un finding `check` che l'applier
sa correggere — ma `check_fast` per contratto non esegue test: mancava l'**ingresso**, non il canale.
Far produrre quell'esito anche ai test è tutta la correzione.

**Un campo nuovo, non l'allargamento di `check_fast`.** `check_fast` è una chiave di confine,
compilata in ogni `project.json` e nominata fuori dal diff; allargarne il significato ai test
riscriverebbe §4 di `contracts/project-contract.md` e il valore della chiave in ogni progetto già
aperto. Il campo `check_tests` tocca invece solo il ledger — forma **interna** che nessun progetto
compila — quindi il `contract` **non si incrementa** e `check_fast` resta «senza scrittura e senza
test». Vedi [[confine-degli-identificatori]] e, per il gemello fra comandi d'area,
[[correttore-copre-il-gate]].

**Il gap fra `check_fast` e gate si dichiara, non si ripara.** Poiché `check_fast` non può eseguire
test, una sua derivazione di solo lint copre una classe **più debole** del gate che esegue anche i
test: è la derivazione fedele, non un difetto, e `init` lo **segnala** di una riga accanto all'area.
Il divieto di §4 resta, e il ciclo compensa coi test mirati del round. Il prezzo è quello della
feature sorella: `init` non riscrive `project.json`, quindi l'avviso vale per i progetti aperti
d'ora in poi.

**Why il campo nuovo porta i file di test.** Il `check_fast` nomina i file **toccati**; un rosso di
test nomina il **file del test** rotto, che il diff non ha toccato. Senza i file di test nella voce,
il finding `check` non saprebbe quale file l'applier deve correggere.

**How to apply:** la sede deterministica è il banco — i casi `check-tests`, `check-tests-record` e
`check-tests-finding` nel banco del ledger, i casi `round:rule-2-a-red-check-tests` e
`round:a-green-check-tests-leaves-the-merit` in `CASES`, i due `reject:` in `REJECTED` — e `never_red`
pretende che la regola estesa sia vista fallire. Si lancia con gli altri con
`node plugins/daiku/hooks/self-check.mjs`. Vedi [[valutatore-deterministico]].
