# Il record di una run di abilitazione — ReforgIA

Risponde alle domande che un referto di abilitazione pone a questo progetto: quali categorie
classificano il residuo e in che ordine di precedenza, e quali esiti può avere una run.

Le semantiche — perché una categoria esiste, cosa vale un verde tollerante, a chi tocca una mossa —
non stanno qui: sono fatti del progetto e vivono in `memory/`. Qui ci sono solo i **nomi** e il
**criterio di lettura**, cioè ciò che serve per non riparsare un log e per non scambiare un campo
per un altro.

**Ogni lista qui è uno specchio del codice, e il codice vince.** Accanto a ciascuna c'è la sua
fonte: se una lista e la sua fonte divergono, quella giusta è la fonte, e questo file va allineato
nello stesso lavoro che ha mosso il codice.

## Le sette categorie del residuo

Fonte: le costanti `CATEGORY_*` in `apps/backend/app/mappers/maven_compilation_errors.py`.

Un sorgente bloccato può portarne **più di una**: si classifica causa per causa, mai una sola scelta
a forza per l'intero file. L'ordine qui sotto è quello di **precedenza** con cui il mapper sceglie
quando due categorie competono sulla stessa causa.

| # | Categoria | Cosa accerta |
|---|---|---|
| 1 | `jdk_internal_api` | il sorgente usa un'API interna della JDK che il target non espone più |
| 2 | `jdk_removed_module` | il sorgente usa un package rimosso dal JDK moderno — è un debito **riparabile**, il motore lo serve come dipendenza dichiarata |
| 3 | `unproven_system_scoped_gap` | il sorgente resta rosso su un simbolo di una coordinata che il motore stesso ha servito `system`-scoped senza prova che quel jar la contenga. Accertata aprendo il jar: il package deve avere **altre** classi presenti e la classe richiesta deve mancare |
| 4 | `structural_erasure` | la perdita silenziosa della compilazione tollerante: un `extends`, un `implements` o un'annotazione irrisolti spariscono dal bytecode, e l'errore che li ha causati sopravvive solo nel log |
| 5 | `renounced_dependency` | la **rinuncia del motore**: la coordinata è stata accertata irreperibile e il suo blocco `<dependency>` commentato senza che nessuno scegliesse. Il modulo resta nel perimetro apposta, perché qualcuno provi a farlo compilare senza quella libreria |
| 6 | `dependency_exclusion` | il modulo proprietario del sorgente porta un'**esclusione consapevole dell'utente**. È una **co-locazione, non una causalità**: che sia la coordinata esclusa a fornire il simbolo mancante nessuno può accertarlo |
| 7 | `unclassified` | nessuna delle precedenti ha potuto accertare la causa |

Due avvertenze che cambiano come si legge un referto:

- le categorie 3 e 6 non affermano una causalità sul modulo proprietario del sorgente — accanto a
  ognuna, `ClassifiedSource.packages` porta il package su cui il compilatore si è davvero fermato, ed
  è quello il fatto;
- `structural_erasure` senza `source_lines` e `unproven_system_scoped_gap` senza
  `served_jar_classes` **non scattano mai**, per omissione: la loro assenza in un referto può voler
  dire «non è successo» oppure «l'evidenza non c'era», e sono due cose diverse.

## Gli esiti di una run

Fonte: `EnablingOutcome` in `apps/backend/app/models.py`.

| Esito | Cosa vuol dire |
|---|---|
| `enabled` | verde vero: il perimetro compila |
| `enabled_tolerant` | verde ottenuto ignorando gli errori di compilazione — produce bytecode anche per moduli rotti, non è integrabile nella baseline, e `merge_enabling_run` lo rifiuta esplicitamente |
| `build_failed` | la compilazione non è passata e nessuna mossa l'ha recuperata |
| `repair_failed` | la riparazione è stata tentata e non ha chiuso il rosso |
