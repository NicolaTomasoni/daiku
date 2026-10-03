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
legge tre cose, in quest'ordine:

1. **il verdetto** — `architect/architect.mjs` con `question: "order"`, `entry: "new-feature"`,
   `present` (i documenti presenti) e `ledger`: `stop` ferma il giro, `remaining` nomina le fasi che
   restano e **quelle prima non si rifanno**;
2. **la domanda per prima, qualunque fase il verdetto nomini** — `1. decision-doc.md` presente prova
   le decisioni *studiate*, non risposte: se una scheda di `0.5. strategic-study.md` o
   `1. decision-doc.md` non porta la sua riga `Choice:`, la fase è il punto 7, e il punto 6 non gira;
3. **poi la fase del verdetto** — nessun documento di decisioni, punto 6; documento tutto risposto e
   stadio tecnico non ancora su disco, punto 8 (incorporazione); `acquisition` o oltre, punto 10.

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
