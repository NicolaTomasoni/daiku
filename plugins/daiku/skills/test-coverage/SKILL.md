---
name: 'test-coverage'
description: 'Default misura la copertura per macrocategorie del progetto e aspetta categoria + % target; in modalità --auto decide da sé se il diff introduce logica scoperta e scrive i test sul diff senza chiedere. Test di qualità nel layer corretto'
---

Skill per **creare test unitari** con un flusso a due tempi: prima misura e mostra la copertura per macrocategoria, **si ferma** e aspetta che tu scelga su cosa lavorare e con quale % target; poi scrive i test rispettando le convenzioni e le regole di qualità del progetto.

Le regole architetturali restano quelle del progetto — gli invarianti di `{instructions_file}` e le rule di area in `.daiku/policies/`: questa skill non le sostituisce, le applica anche ai test.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Contesto di dominio

Leggi `.daiku/domain/test-strategy.md`: porta le macrocategorie di questo progetto, come si legge l'output dei suoi comandi di misura e quali artefatti quella misura lascia da rimuovere, quale perimetro copre davvero il runner di ciascuna area, quali convenzioni seguono i test già scritti e da quale punto di forza si testa ciascun layer. Se non esiste, riporta la copertura per area senza suddividerla in macrocategorie e scrivi i test rispecchiando un test fratello dello stesso layer, e dichiaralo nell'esito.

## Due modalità

- **Default (interattiva).** Il flusso a due tempi descritto sotto: misura → STOP → scelta categoria + % target → scrive. È il comportamento per l'invocazione manuale.
- **`--auto` (invocata da `/review`).** Scope = il diff, non una macrocategoria. **Niente Fase 1 e niente STOP**: non misuri la copertura globale né chiedi target, scrivi direttamente i test per la logica introdotta dal diff. Vedi *Modalità automatica* in fondo. Le regole di qualità della **Fase 3** (convenzioni, strategia per layer, cosa rende un test di qualità) valgono identiche.

## Argomento

`$ARGUMENTS` è opzionale ed è solo un **suggerimento** di categoria su cui concentrare la tabella. Anche se presente, la Fase 1 mostra comunque la tabella completa e la Fase 2 **aspetta la conferma**: non partire mai a scrivere test senza input esplicito su categoria **e** % target.

---

## Fase 1 — Mappa di copertura per macrocategoria

Obiettivo: una tabella onesta che dica dove siamo, non un numero unico.

### 1.1 Misura ogni area

Per ogni area dichiarata in `{areas}` che ha `{areas.<area>.coverage}`, esegui quelle righe in ordine dalla cwd dichiarata. Una riga si esegue **così com'è**: non sostituirla con un equivalente che credi migliore, non installare nulla per farla girare. Se fallisce perché l'ambiente non c'è, **fermati e segnalalo** — è un esito reale, non una scorciatoia da cercare altrove.

Leggi il risultato che quei comandi producono e aggrega **sommando statement coperti e totali** per macrocategoria (media pesata sugli statement, non media delle percentuali per-file — altrimenti i file piccoli falsano il dato).

### 1.2 Macrocategorie (dai layer del progetto)

Mappa ogni file misurato al suo layer per path, secondo la tassonomia di `.daiku/domain/test-strategy.md`; i file che nessuna voce cattura finiscono nella macrocategoria residuale che quella tassonomia dichiara.

### 1.3 Il perimetro che la misura copre davvero

Il comando di un'area può coprire meno dell'area che lo dichiara: un runner esclude per configurazione ciò che non sa eseguire. La riga di quell'area riporta **la copertura del perimetro realmente misurato**, non quella dell'intera area; ciò che resta fuori dal runner si dichiara tale, non si conta come scoperto e non si aggira. Non installare nulla e non proporre scaffolding: il tooling è quello che il comando dichiarato usa.

### 1.4 Mostra la tabella e fermati

Presenta:

```
| Macrocategoria       | Coverage | Stmt coperti/totali | Peggiori file (miss) |
|----------------------|----------|---------------------|----------------------|
| <macrocategoria>     |  ...%    |  .../...            | file — N righe scoperte |
| ...                  |          |                     |                      |
| TOTALE <area>        |  ...%    |  .../...            | perimetro misurato — cosa resta fuori dal runner |
```

Una riga di totale per ogni area misurata. Per ogni categoria elenca i **2–3 file peggiori** per righe scoperte (statement totali meno coperti), non per percentuale: sono i candidati ad alto ritorno. Aggiungi una riga sintetica "quick win" con le macrocategorie che `.daiku/domain/test-strategy.md` indica a ritorno più alto, se hanno righe scoperte (vedi Fase 3).

Poi **STOP**. Chiudi con una domanda esplicita:

> Su quale macrocategoria (o file specifico) vuoi lavorare, e con quale **% target**?

Non proseguire finché non arriva la risposta. Pulisci gli artefatti che la misura ha lasciato nella cwd dei suoi comandi prima di passare oltre o a fine skill — non vanno committati.

---

## Fase 2 — Attendi la scelta

L'utente indica **categoria/file** e **% target** (es. "<macrocategoria> al 95%", "<file> oltre il 90%", "i file più scoperti di <macrocategoria> al 70%").

Se la richiesta è ambigua (categoria senza target, o "alza la coverage" senza scope), **chiedi**: un target verificabile è ciò che rende la Fase 3 autonoma (criteri di successo solidi, non "fai funzionare").

Traduci subito la scelta in un obiettivo verificabile, es.:
`copertura di <path della categoria> da X% a ≥95%, rimisurata con lo stesso comando della Fase 1`.

---

## Fase 3 — Scrivi i test (qualità del progetto)

### 3.1 Prima di scrivere

1. Dal risultato della misura ricava le **righe scoperte** dei file bersaglio. Quelle righe sono quasi sempre **rami di errore, branch vuoti, edge case**: sono lì il valore, non nell'happy path già coperto.
2. **Leggi il sorgente** dei file bersaglio e **almeno un test fratello esistente** dello stesso layer, per rispecchiarne stile, fixture e fake. Non inventare un pattern nuovo dove ne esiste già uno che quel layer segue.
3. Ordina il lavoro per **rischio × righe scoperte**, non per comodità.

### 3.2 Convenzioni del progetto (non negoziabili)

Le convenzioni concrete — framework e stile di test, forma dei doppi, lingua dei commenti, dove vivono le fixture, come si isola il filesystem — stanno in `.daiku/domain/test-strategy.md` e si rispecchiano alla lettera: sono quelle che i file fratelli già seguono. Sopra di esse valgono comunque:

- **Doppi espliciti, non mock opachi**: per ogni sistema esterno inietta un doppio, nella forma che il fratello usa, che **scripta gli output** e **registra le chiamate**. Un doppio esplicito dice cosa succede in modo leggibile; un mock generico nasconde il contratto.
- **Filesystem solo dal punto d'accesso** che le regole del progetto dichiarano — `{instructions_file}` e `.daiku/policies/` — puntato a una directory temporanea; se non ne dichiarano uno, isola comunque in temporanea. **Mai** dati, sandbox o artefatti reali: nessun test scrive nel repo dell'utente né nelle directory runtime dell'applicazione.
- **Golden fixture** per parsing/mapping: output reale del tool esterno salvato come file di fixture e letto dal test. Se serve una fixture nuova, cattura output realistico e mettila dove vivono le altre, non stringhe inline gigantesche.
- **Determinismo totale**: niente rete, niente subprocess reali, niente tempo reale o random. Se il codice accetta già l'istante come argomento, passaglielo invece di mockare l'orologio.

### 3.3 Strategia per layer

Ogni layer si testa dal suo punto di forza architetturale: quale sia — cosa asserire, cosa fingere, cosa non va mai chiamato davvero, e quali layer rendono di più per riga scritta — lo dice `.daiku/domain/test-strategy.md`. Non dedurlo dal nome della cartella: i confini fra layer sono quelli del `{instructions_file}` e delle rule di area in `.daiku/policies/`.

### 3.4 Cosa rende un test "di qualità" qui

- **Testa comportamento/contratto, non implementazione.** Asserisci su ciò che il codice produce e persiste, non sul fatto che un mock sia stato chiamato con l'argomento che gli hai dato tu (quello testa il test).
- **Un test deve poter fallire.** Prima di tenerlo, chiediti: se il comportamento fosse rotto, questo test diventerebbe rosso? Se passa comunque, non vale. Mentalità mutation-testing sui rami scoperti.
- **Un concetto per test**, con un nome descrittivo e parlante che dica *quale comportamento* in *quale condizione* ("mappa 1:1 le issue reali", "marca la run failed quando il doppio solleva"), nella convenzione di naming del file fratello.
- **Punta agli unhappy path** che il buco di coverage nasconde: errore, vuoto, edge, output esterno malformato, cancellazione. Non gonfiare l'happy path già coperto per far salire il numero.
- **Non inseguire il 100%.** Salta il boilerplate (costruttori vuoti, DTO puri, entry point del processo). Se lasci scoperto qualcosa di proposito, **dillo** e spiega perché (regola: nessun cap silenzioso).
- Rispetta **anche nei test** gli invarianti del progetto: filesystem solo dal punto d'accesso dichiarato, nessuna chiamata esterna reale, fixture e dati di prova isolati.

### 3.5 Colloca e verifica

1. Aggiungi i test nel file di test esistente del modulo; creane uno nuovo solo se il modulo non ne ha, con nome e posizione che `.daiku/domain/test-strategy.md` dichiara per quel layer. Fixture nuove dove vivono le altre.
2. Esegui il **solo** file mirato con `{areas.<area>.test_targeted}` dell'area a cui appartiene, sostituendo a `<FILES>` il file che hai scritto. La suite completa **non si lancia qui**: è il gate di `/review`, che gira subito dopo.
3. **Ri-misura** la coverage della categoria con `{areas.<area>.coverage}`, lo stesso comando della Fase 1, e confronta con il target. Itera sui rami ancora scoperti finché raggiungi il target o il ritorno diventa marginale.
4. Pulisci gli artefatti che la misura ha lasciato.
5. **Riporta onestamente**: coverage prima → dopo per la categoria, quanti test aggiunti, cosa resta scoperto di proposito e perché. Se non raggiungi il target, dillo con i numeri, non dichiarare fatto.

---

## Modalità automatica (`--auto`)

Attiva quando `/review` ti invoca, all'uscita del suo ciclo, sul diff finale sotto `{code_root}`. **Salti la Fase 1 e la Fase 2**: niente tabella globale, niente STOP, niente domanda su categoria/%. Lo scope non è una macrocategoria ma **il diff della feature** che il chiamante ti passa.

Il chiamante ti passa anche `{memory.index}` e i **path** delle memorie che il diff tocca, da aprire prima di scrivere: è il canale di §4.1 di `contracts/orchestration.md`. Se non te li passa, apri l'indice e scegli tu — un test che cristallizza un comportamento che una memoria dichiara sbagliato è un test che nessun giro rivedrà.

**Decidi tu** se il diff introduce logica nuova non coperta da test: se no, torni senza scrivere nulla e lo dichiari nel blocco di ritorno (`saltata: true` col perché). Se il chiamante ha passato `--with test-coverage`, perdi la facoltà di saltare: scrivi per ogni ramo nuovo testabile.

Obiettivo: coprire con test **la logica introdotta o cambiata dal diff**, non alzare un numero.

- **Scope = i file del diff** nei layer che `.daiku/domain/test-strategy.md` dichiara testabili, in ogni area di `{areas}` che il diff tocca. Fuori restano il boilerplate (DTO puri, costruttori vuoti) e ciò che il runner di un'area non copre (§1.3). Per ogni funzione/ramo nuovo o modificato, chiediti: *se questo comportamento si rompesse, un test lo becca?* Se no, è un candidato.
- **Scrivi i test per ciò che puoi asserire con certezza** dal contratto e dal codice: happy path del nuovo comportamento, rami d'errore, edge/vuoti, output esterno malformato. Qui la "confidenza medio-alta" significa: *so qual è il comportamento atteso corretto*.
- **Segnala, non fabbricare.** Dove il comportamento atteso è **ambiguo** (non è chiaro dal contratto se il codice attuale sia giusto), **non** scrivere un'asserzione che cristallizzerebbe un eventuale bug: annotalo come *Da confermare* con il caso concreto scoperto. Un test che asserisce «fa quello che fa oggi» senza sapere se è giusto è un test che non può fallire — vietato (§3.4). Segna `bloccante: true` quando l'ambiguità mette in dubbio la correttezza del codice consegnato (non è chiaro se il comportamento attuale sia giusto), `false` quando il codice resta corretto qualunque sia la risposta — stessa regola dell'applicatore di `/review`.
- **Qualità Fase 3 invariata**: convenzioni di §3.2, strategia per layer di §3.3 e criteri di §3.4, tutti come `.daiku/domain/test-strategy.md` li declina per questo progetto. Estendi il file di test esistente accanto al modulo, non crearne di paralleli.
- **Verifica**: esegui il **solo** file mirato con `{areas.<area>.test_targeted}` dell'area a cui appartiene, `<FILES>` sostituito dal file scritto; i test devono passare. La suite completa è il gate di `/review`, che gira subito dopo di te: non lanciarla. Non misuri la coverage globale (non è il compito in questa modalità); pulisci comunque eventuali artefatti di misura.
- **Nessuno stop, nessun output tabellare.** Il ritorno è **un blocco JSON a contratto** che `/review` legge senza interpretare la prosa:
  ```json
  {"test_scritti": [{"file": "<path>", "copre": "<cosa copre, una riga>"}], "da_confermare": [{"file": "<path>", "riga": 0, "scenario": "<il bivio in parole semplici: cosa è in gioco, le strade, cosa cambia>", "classe": "test-coverage", "bloccante": true}], "saltata": false, "perche": "<se saltata: perché non c'è logica nuova scoperta; altrimenti vuoto>"}
  ```
  Nessun campo si omette: a zero voci si scrive `[]`. La suite la esegue il Gate di `/review` subito dopo.
