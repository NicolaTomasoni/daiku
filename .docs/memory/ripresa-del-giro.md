---
name: ripresa-del-giro
description: "new-feature accetta una cartella al posto della descrizione e riprende da lì: i documenti sono lo stato, il verdetto di `order` dice dove la catena riprende, e le schede senza `Choice:` tornano a essere chieste col loro numero; il guard legge la ripresa dal prompt"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-03
---

**Dal 3 ottobre 2026 `new-feature` accetta due argomenti**: una descrizione in linguaggio naturale
(come sempre) **oppure una cartella già aperta** — lo slug sotto `{paths.features}`, o il suo path.
Col secondo il giro è una **ripresa**, e non deriva nessuno slug dalla prosa né chiede conferma:
indicare la cartella *è* la conferma.

**Lo stato sono i documenti.** Il contratto lo dichiarava già — «Keep no log on file: the state
needed to resume is the documents the phases deposit in the folder» — ma nessun passo lo leggeva:
rilanciare il nodo rifaceva la ricognizione del codice e riscriveva `0. problem.md`. Ora la ripresa
legge quattro cose, in quest'ordine:

1. **il verdetto** — `architect/architect.mjs` con `question: "order"`, `entry: "new-feature"`,
   `present` (i documenti presenti) e `ledger`: `stop` ferma il giro, `remaining` nomina le fasi che
   restano, **il suo primo elemento è la fase da fare** e **quelle prima non si rifanno**;
2. **la domanda per prima, qualunque fase il verdetto nomini** — `1. decision-doc.md` presente prova
   le decisioni *studiate*, non risposte: se una scheda di `0.5. strategic-study.md` o
   `1. decision-doc.md` non porta la sua riga `Choice:`, la fase è il punto 7, e il punto 6 non gira.
   Un documento con tutte le schede risposte e lo stadio tecnico non ancora su disco è invece il
   punto 8 (incorporazione), e anche questo si legge prima della lista, perché la domanda viene prima;
3. **il riesame, che il verdetto non vede** — il punto 5 non ha artefatto: la sua unica traccia è la
   coda *What it rests on* di `0. problem.md`, che si scrive **sempre**, anche quando non c'era
   niente da studiare. Un `0. problem.md` senza quella coda è un problema scritto prima delle note, e
   la ripresa fa girare il punto 5 prima delle decisioni — altrimenti un giro interrotto dopo
   `research` entra nello studio delle decisioni con un problema che le fonti non hanno mai
   corretto, e niente lo dice;
4. **poi la fase del verdetto**, primo elemento di `remaining` — `problem` → punti 2 e 3, la
   ricognizione e la prima stesura; `decisions` → punto 5 (se la coda manca) e poi punto 6;
   `acquisition` o oltre → punto 10, la consegna, che riprende sul verdetto suo.

**Un'interruzione fra la domanda e l'incorporazione rifà la domanda, ed è dichiarato.** Le risposte
dell'owner vivono nella chat che le ha portate: la riga `Choice:` la scrive l'incorporazione, non la
domanda, quindi per il disco quella scheda è senza risposta. Il giro ripreso le richiede — è il caso
che `new-feature` § *If a step fails* già nomina per l'incorporazione fallita.

**Una scheda è risposta quando porta la sua riga `Choice:`** (`skills/decision-doc/SKILL.md`
§ *Phase 4*), e la ripresa chiede **solo quelle senza**, **col numero che hanno nella lista di quel
documento**: la numerazione del documento è l'identità della scheda, e rinumerare le aperte da `1`
farebbe contare cose diverse alla chat e al documento. Il documento di decisioni sotto un nome che
la catena non conosce è un guasto da **riportare**, non da ignorare: i numeri e le risposte vivono
nei nomi dichiarati.

**L'eccezione nel guard si legge dal prompt.** `hooks/lib/ask-guard.mjs` pretende che una prima
batch apra a `1/N` — è così che una lista non perde la testa — salvo quando il giro è una ripresa:
lì la prima batch apre dove il documento si è fermato. La ripresa si legge dal prompt che apre il
giro, perché è l'unico momento in cui la cartella viene nominata; un giro ripreso **senza** nominarla
(nasce da una descrizione, lo slug derivato dalla prosa) resta tenuto a `1/N`. Vedi
[[guardrail-nascono-spenti]] e [[confine-del-giro]].

**Why.** Il README del pacchetto prometteva la ripresa da prima che esistesse — «hand it the folder
where you already collected material, and it resumes from there» — mentre il contratto non la faceva:
era una promessa scritta e non mantenuta, il tipo di scostamento che l'owner scopre usandola. E nel
cantiere la situazione era viva: tre cartelle — `gate-rosso-pre-esistente`, `invarianti-non-verificate`
e `valori-di-macchina` — stavano su un documento di decisioni con le schede **mai risposte**, e
riaprirle significava rifare ricognizione e studio per arrivare dove si era già arrivati.
