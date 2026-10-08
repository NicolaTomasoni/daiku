---
name: gate-rosso-pre-esistente
description: "Un gate rosso le cui sconfitte nominano solo file fuori dal diff è pre-esistente e non blocca più il commit: chi lo misura, il criterio, il campo `gate_origin`, le tre sedi del verdetto che lo leggono, e il riconoscimento di un ledger dal suo nucleo invece che dal numero di chiavi"
metadata:
  node_type: memory
  type: project
---

**Dall'8 ottobre 2026 un gate rosso che il diff non ha causato non blocca più il commit.** Il gate
di un'area è un comando che copre l'area intera e produce un booleano senza memoria: non sa se il
rosso l'ha portato il diff. `gate: "red"` produceva `BLOCKED_NO_COMMIT` deterministicamente, e la
consegna non poteva correggere il file offeso — il contratto la vincola alla lista dei file cambiati,
che non contiene i file invariati rispetto alla base. Siccome il gate di un'area è lo stesso per
ogni consegna futura, un difetto pre-esistente là sopra faceva chiudere **ogni** consegna su
quell'area in `BLOCKED_NO_COMMIT`, consumando una worktree del pool. Il difetto che l'ha rivelata
(ReforgIA, `supporto-ant`) era un `F841` di ruff e una riformattazione su un file di test **invariato
rispetto alla base**, che il gate già dichiarava pre-esistente dentro `gate_detail` — dove però
nessun verdetto lo leggeva.

**Il criterio è «tutti i file che i messaggi nominano sono fuori dal diff»**, non «confinato ai
test»: la natura del difetto — lint, formato, tipo, test — non cambia la classificazione, perché il
diff non l'ha causato. L'allargamento rispetto alla lettera della direttiva è voluto: il «test» è
l'istanza che ha rivelato il caso, non la regola, e restringere a `tests/` reintrodurrebbe una
convenzione di progetto in un contratto che deve restare identico ovunque. Confine: basta **un solo**
file nominato dentro la lista perché il rosso resti bloccante, e un rosso che **non nomina alcun
file** resta bloccante — il ripiego è lo stato di prima, perché il gate è una misura e un input che
manca è un errore, mai un `false` implicito.

**Chi lo misura: l'agente osserva, il programma giudica.** Il gate è l'unico a vedere l'output del
comando, quindi ne estrae i path nominati nella lista `gate_files` del blocco del gate; il
programma li confronta con la lista dei file cambiati. Il giudizio sta in **`architect/ledger.mjs`**,
nell'azione `tail` (`originOf`): scrive `gate_origin` (`"diff"` | `"pre-existing"` | `null`) nel
ledger e lo restituisce. La misura legge i file cambiati **freschi da Git**, mai lo `scope_files`
congelato all'apertura — il gate gira per ultimo e fix e coverage possono aver aggiunto file dopo lo
`scope`. I due `null` legittimi sono il gate verde e il rosso che non nomina file. Il confronto
normalizza i separatori, abbassa il case e toglie il `./` iniziale, poi accetta l'uguaglianza o il
suffisso di segmenti — il gate stampa dalla propria `cwd`, la lista sta sotto `{code_root}`.

**Dove il verdetto lo legge — tre sedi, non una.** In `architect/architect.mjs` lo leggono
`askDecision` (la riga 1 della tabella di § *4. Decision* di `ship-feature`: un rosso pre-esistente
non entra in `blockers`), `askClosing` (la condizione `['a green gate', …]` della § *Closing* di
`review`) e `askUnblock` (§ *Mechanical unblock*: un rosso pre-esistente non è la ragione di un
tentativo, come un gate verde). La **terza** sede è la guardia della review in
`hooks/lib/command-guard.mjs` (`justExited`): apre il commit anche su un ciclo appena uscito con un
rosso pre-esistente, e senza quella correzione lo stato che l'evaluator legge come non bloccante
sarebbe stato negato al `git commit` della fase di commit. È il finding del round 1 di questa
consegna: la stessa regola viveva già in due posti, la guardia era un terzo — vedi
[[guardrail-nascono-spenti]].

**La forma.** `gate` resta binario (`green`/`red`); l'origine viaggia nel campo nuovo. Il campo sta
nel blocco `review_outcome` (`required` da 19 a 20) e nel ledger (da 9 a 10) di
`schemas/blocks.json`, che è la sede normativa; la prosa sta in `skills/review/SKILL.md` § *Gate* e
§ *Outcome* e in `skills/ship-feature/SKILL.md` § *4. Decision* e § *Mechanical unblock*. Nessuna
chiave nuova in `project.json`, quindi `contract` non si incrementa.

**Le guardie riconoscono un ledger dal suo nucleo, non dalla lista intera.** Le sedi che leggono la
forma — `isLedger` in `hooks/lib/stop-advice.mjs`, che la guardia della review rilegge attraverso la
stessa funzione (`ledgers`), e `isLedgerShape` dell'azione `log` di `architect/ledger.mjs` — provano i
campi che **ogni** forma del ledger porta (`LEDGER_CORE`: da `base` a `gate_detail`, senza
`gate_origin`), non il numero esatto di chiavi. `gate_origin` è il campo aggiunto per ultimo, e la sua
aggiunta è ciò che rende necessario il nucleo: una guardia sopravvive alla build che la porta **nei due
versi** — un ledger di una build più vecchia non ha `gate_origin`, uno di una più nuova porta chiavi che
questa non conosce — e misurati sulla lista più recente o sul conteggio esatto l'uno e l'altro
leggerebbero come file di un altro strumento, sparendo dall'avviso dello Stop e smettendo di tenere
aperto `git commit`. `LEDGER_FIELDS` resta la copia della forma della build in corso, che il banco
confronta con `schemas/blocks.json`; `ledgerAt` invece resta stretto, perché risponde a un'altra domanda
— se il ledger che **riprende** combacia con lo schema in posto.

**Why:** un rosso è la ragione per cui il gate esiste — ma solo quello che il diff **introduce**. Un
rosso che il diff **eredita** non è una consegna fallita, è debito del repository, e bloccare su di
esso non protegge niente: costringe a un `BLOCKED_NO_COMMIT` che non si può riparare, perché
correggere il file significherebbe scrivere fuori dalla lista, cioè dopo l'ultimo finder — il rischio
che il perimetro di scrittura del gate esiste per evitare. L'origine va distinta, non il gate abolito:
il rosso che il diff porta, e il rosso non attribuibile, restano bloccanti.

**How to apply:** la sede deterministica è il banco — i casi `gate-origin:*` nel banco di
`architect/ledger.mjs` (con Git vero su un repository usa e getta: un file fuori dal diff → `pre-existing`,
un file del diff → `diff`, nessun file → `null`, un gate verde → `null`), i casi
`decision:row-1-gate-red-*`, `closing:condition-gate-red-*` e `unblock:gate-red-pre-existing-is-not-the-block`
in `architect/architect.mjs`, i due `reject:gate-origin-*`, e i casi del ramo review-guard in
`command-guard.mjs`. Il riconoscimento del ledger ha i suoi: i due casi del self-check di
`stop-advice.mjs` (un ledger di una build più nuova con una chiave in più, e uno di una più vecchia
senza `gate_origin` — entrambi nostri), il caso `log:a-ledger-of-an-earlier-build-is-still-ours` di
`ledger.mjs`, e il controllo che il nucleo sia un sottoinsieme dello schema. Si lanciano con
`node plugins/daiku/hooks/self-check.mjs`, e `never_red` pretende di vederli fallire. **Limite dichiarato:** il blocco del gate di `skills/code-review/SKILL.md`
resta a due campi e non nomina `gate_files`, quindi i suoi ledger portano `gate_origin: null` e il
suo comportamento non cambia. Vedi [[valutatore-deterministico]], [[test-mirati-nel-giro]],
[[correttore-copre-il-gate]] e [[confine-degli-identificatori]].
