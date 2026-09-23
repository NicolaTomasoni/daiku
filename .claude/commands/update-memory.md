---
description: 'Passo obbligatorio prima del commit: allinea CLAUDE.md, sviluppo/memory/, RICOGNIZIONE.md e PUNTI-APERTI.md al diff di plugins/daiku appena consegnato. Delta minimo, nessuna scrittura se il diff non la giustifica, nessun commit.'
argument-hint: '[commit o range, opzionale — default: il diff in index]'
---

Sei il passo che tiene allineati gli artefatti di **sviluppo** al lavoro appena consegnato sul
**prodotto**. Il diff arriva prima del commit, non dopo, perché è lì che serve: nessuna consegna si
congela senza che ciò che la spiega sia stato riallineato sullo stesso identico diff.

**Non tocchi mai `plugins/daiku/`**: il tuo perimetro è l'altra metà del repository.

Sei invocato in tre modi: **dentro la consegna**, come passo obbligatorio prima del commit (fase
Memory di `deliver-feature`); **dentro un commit**, delegato da `commit` sul diff che sta per essere
congelato; **manuale**, in chat su un commit o un range specifico.

## Il tuo perimetro è nell'indice, ma non sei tu a committarlo

Il `.gitignore` esclude soltanto `.claude/settings.local.json`: i file del tuo perimetro —
`CLAUDE.md`, `sviluppo/**` — sono **nell'indice** come il prodotto, e la storia li conserva
(`.claude/orchestration.md` §8).

**Resti comunque tu a non committare.** Il tuo mestiere è scrivere sul disco; a mettere in stage e a
committare è chi ti ha chiamato: il nodo `commit`, che il gruppo memoria/documentazione lo committa
in un commit proprio, o la fase di commit di `deliver-feature`. Quindi in ogni invocazione: **nessun
`git add`, nessun `git commit`, nessun `git push`, e l'indice non si tocca** — se ti accorgi di
volerlo fare, ti sei allontanato dal perimetro di questa skill.

Restituisci **sempre** `committed: null`, e il campo si scrive lo stesso: un campo che manca non dice
«non ho committato», dice che non si sa. Un passo che torna con uno SHA ha committato qualcosa che non
doveva nemmeno poter mettere in stage, e chi ti ha chiamato deve saperlo: dichiaralo.

Ne segue una cosa da tenere presente mentre scrivi: quando torni, ciò che hai scritto **non è ancora
in nessun commit**. Se chi ti ha chiamato non lo mette in stage, resta sul disco e non lo recupera
nessuno — e il tuo blocco di ritorno è l'unico posto dove quel lavoro è dichiarato.

## Input: il diff da ispezionare

Argomenti: `$ARGUMENTS` — `[commit o range]`.

- **Dentro la consegna**, il diff è quello **in index** sotto `plugins/daiku/`:

  ```bash
  git diff --cached --stat -- plugins/daiku/
  git diff --cached -- plugins/daiku/
  ```

  È il diff integrale, file nuovi compresi (che `git diff` senza `--cached` non mostrerebbe). Non
  chiedere nulla.
- **Manuale con `$ARGUMENTS` vuoto**: il diff in index se c'è qualcosa in staging sotto
  `plugins/daiku/`, altrimenti l'ultimo commit (`HEAD`).
- **Con un commit o un range**: `git show <ref> --stat` e `git diff <ref>^ <ref>`. Se il commit non
  esiste, segnalalo e fermati.
- Se il diff tocca **solo** path fuori da `plugins/daiku/`, fermati: non hai un diff di consegna da
  riflettere.

## La divisione della documentazione di questo progetto

Quattro sedi, quattro mestieri. Un fatto che sta nella sede sbagliata non è un fatto scritto male:
è un fatto che nessuno troverà quando servirà.

| Sede | Cosa ci va | Cosa NON ci va |
|---|---|---|
| **`CLAUDE.md`** | gli invarianti di chi sviluppa Daiku: la divisione fra prodotto e sviluppo, la regola di pubblicazione, come si verifica il pacchetto, come ci si comporta | dettaglio su un singolo contratto, fatti che cambiano con una consegna |
| **`sviluppo/RICOGNIZIONE.md`** | i **fatti verificati**: cosa offrono i due host, cosa manca, cosa si è buttato e perché ogni file sta dove sta — ciascuno con la prova eseguita e la data | intenzioni, decisioni ancora aperte, opinioni |
| **`sviluppo/PUNTI-APERTI.md`** | le decisioni che l'owner non ha ancora preso | tutto ciò che è già deciso: quando una voce si chiude, esce da qui |
| **`sviluppo/memory/`** | i fatti **non deducibili** dal repository: perché una cosa è come è, cosa l'owner ha deciso, cosa si è già provato e non funziona | ciò che si legge dal codice, dai contratti o da `git log` |

**Il `README.md` del pacchetto non è tuo.** `plugins/daiku/README.md` sta sotto il perimetro del
prodotto: se una consegna cambia ciò che il pacchetto offre, quel file lo aggiorna l'esecutore,
dentro il proprio diff e dentro il proprio commit. Toccarlo da qui lo sposterebbe dal gruppo codice a
quello memoria/documentazione, cioè in un commit che non è il suo — e chi legge la storia troverebbe
il documento del pacchetto in mezzo al racconto di chi lo costruisce.

## La forma della memoria di questo progetto

Una memoria è **un file, un fatto**, in `sviluppo/memory/`, con questo frontmatter:

```markdown
---
name: <slug-kebab-case, uguale al nome del file senza estensione>
description: <una riga: serve a decidere se la memoria è pertinente, senza aprirla>
metadata:
  type: user | feedback | project | reference
---

<il fatto. Per feedback e project, seguito dalle righe **Why:** e **How to apply:**.
Le memorie collegate si citano con [[loro-name]].>
```

I quattro tipi:

- **`user`** — chi è l'owner: ruolo, competenze, preferenze.
- **`feedback`** — indicazioni su **come si lavora**, correzioni e approcci confermati. Sempre col
  perché.
- **`project`** — lavoro in corso, obiettivi e vincoli **non deducibili** dal repository o da
  `git log`. Le date relative si convertono in assolute.
- **`reference`** — puntatori a risorse esterne: URL, ticket, dashboard.

**L'indice.** `sviluppo/memory/MEMORY.md` porta **una riga per memoria** e nessun contenuto:
`- [Titolo](file.md) — gancio`. Si aggiorna **nella stessa modifica** in cui una memoria nasce,
viene rinominata, spostata o fusa. Un indice che non nomina un file è un file che nessuno apre.

**Cercare prima di creare.** Leggi `MEMORY.md` per intero e apri le memorie semanticamente vicine
prima di scrivere. Aggiorna o fondi un file esistente; creane uno nuovo solo se nessuno copre già lo
stesso confine. Un fatto sparso su due file è un fatto che diverge.

**Cosa non entra in memoria**, mai: ciò che il repository già registra (la struttura dei file, un
fix passato, la storia di git, il testo di `CLAUDE.md`), e ciò che conta solo per una sessione. Se
il diff sembra chiedere una memoria di quel tipo, la risposta è che non serve — non una memoria
scritta meglio.

**Un collegamento `[[nome]]` che non corrisponde ancora a nessuna memoria va bene**: segna una cosa
che vale la pena scrivere, non un errore.

## Principi

1. **Nessun aggiornamento non giustificato.** Se il diff non cambia nulla che questi artefatti
   debbano riflettere, non scrivi nulla. Una consegna che non tocca né invarianti né ricognizione né
   memoria è l'esito atteso, non un fallimento: molte consegne sono dettaglio puro.
2. **Cerca prima di creare.** Vale per la memoria (sopra) e per la ricognizione: una sezione che già
   copre l'argomento si aggiorna, non si affianca.
3. **Classifica prima di scrivere.** Un fatto verificato con una prova va in `RICOGNIZIONE.md` con
   la prova e la data; un fatto non deducibile ma non verificabile con un comando va in `memory/`;
   un invariante che vale in ogni sessione va in `CLAUDE.md`; una decisione che si è chiusa esce da
   `PUNTI-APERTI.md`. Non degradare mai un fatto con un perché a una riga descrittiva senza il
   perché: il perché è la sola parte che non si ricostruisce.
4. **Mai revocare da solo un fatto o una decisione dell'owner.** Se il diff sembra contraddire una
   memoria, o non ne consente più la verifica, **non cancellarla, non correggerla, non riassumerla e
   non fonderla alterandone il significato**: lasciala intatta e segnalala in `confirm_with_owner`.
5. **Delta minimo.** Niente pulizie opportunistiche di memorie non correlate al diff, niente
   riscritture di prosa già corretta, niente campo «aggiornato» solo per certificare una revisione
   senza cambiamento sostanziale.
6. **La data e la prova non si inventano.** `RICOGNIZIONE.md` è credibile perché ogni suo fatto dice
   *dove* è stato verificato e *quando*. Se scrivi lì dentro senza aver eseguito la prova, dichiara
   che è un'assunzione — o esegui la prova, che di solito costa un comando.
7. **Non è un audit.** Non stai rivedendo l'intero corpus di memoria: guardi solo cosa il diff di
   *questa* consegna giustifica.

## Procedura

1. **Ispeziona il diff** (vedi *Input*): file toccati, natura del cambiamento. Le domande che
   contano su questo repository:
   - è cambiato **cosa il pacchetto offre** a chi lo installa (una skill nuova, un contratto che
     cambia forma, un hook)?
   - è cambiato **cosa si pubblica** (un file nuovo sotto `plugins/`, una riga nel `.gitignore`)?
   - si è **verificato un fatto** su uno dei due host, con una prova che prima non c'era?
   - si è **chiusa una decisione** che stava in `PUNTI-APERTI.md`?
   - si è preso un **vincolo o una decisione non deducibile** dal diff, durante l'esecuzione?

2. **Per ciascun artefatto, decidi se il diff lo giustifica:**
   - **`CLAUDE.md`** — solo se è cambiato un invariante valido in ogni sessione: la divisione fra
     prodotto e sviluppo, la regola di pubblicazione, come si verifica il pacchetto, dove sta una
     cosa. Mai dettaglio su un singolo contratto.
   - **`sviluppo/RICOGNIZIONE.md`** — se una prova eseguita durante la consegna ha confermato o
     **smentito** una sua riga. Una riga smentita è la modifica più preziosa che tu possa fare: quel
     documento è la base su cui poggiano le decisioni del pacchetto. Aggiorna con l'esito verbatim e
     la data.
   - **`sviluppo/PUNTI-APERTI.md`** — se la consegna ha chiuso una di quelle decisioni, la voce esce
     con la risposta e la data. Se ne ha aperta una nuova che è dell'owner, entra.
   - **`sviluppo/memory/`** — segui § *La forma della memoria di questo progetto* alla lettera:
     leggi `MEMORY.md` per intero, individua il file più vicino, classifica, aggiorna o fondi, e
     **aggiorna `MEMORY.md` nella stessa modifica** se crei, rinomini, sposti o fondi una memoria.

3. **Applica le modifiche minime** ai soli artefatti che il passo 2 ha giustificato. Se nessuno lo
   è, fermati qui: non produrre nulla.

4. **Non modificare mai file sotto `plugins/daiku/`**, e non toccare l'indice di git: se ti accorgi
   di volerlo fare, ti sei allontanato dal perimetro di questa skill.

5. **Salva in UTF-8** con gli accenti italiani intatti.

6. **Verifica quello che hai scritto**: `MEMORY.md` ha una riga per ogni file di
   `sviluppo/memory/`, e ogni riga punta a un file che esiste. È un `ls` contro una lettura, e
   costa dieci secondi.

7. **Restituisci** — in chat se manuale, come blocco JSON se invocato dentro una catena. È lo schema
   che questa skill dichiara, e che il chiamante cita senza ricopiarlo:

   ```json
   {
     "updated": false,
     "files": ["<path toccato>"],
     "confirm_with_owner": ["<una frase per ogni fatto dubbio o in conflitto lasciato intatto>"],
     "detail": "<una frase sul perché hai aggiornato o non aggiornato>",
     "committed": null
   }
   ```

   `updated: false` con `files: []` è **l'esito atteso**, non un fallimento: significa che il diff
   non giustificava nulla.

   `committed` è **sempre** `null` in questo repository, per la ragione della § in cima.

   Se il prompt che ti ha invocato ti dà la **cartella dell'item**, scrivi lo stesso blocco anche in
   `3. memory-report.md` dentro quella cartella, prima di restituirlo — **sempre**, anche quando non
   hai aggiornato niente: dire che la fase è avvenuta è metà del suo mestiere. Senza quel file, una
   catena che si interrompe qui riparte trovando la memoria già allineata, e il tuo elenco di
   `files` e le tue voci `confirm_with_owner` spariscono senza traccia. Il file contiene **solo** il
   blocco e, per esteso, le frasi di `confirm_with_owner`: non è un diario, non racconta cosa hai
   letto né in che ordine, e il suo path non entra in `files`.

## Regola di taglio

Questa skill fa quattro cose: ispeziona il diff della consegna, decide quali artefatti di sviluppo
quel diff giustifica, li aggiorna con il delta minimo, e riporta l'esito. Non fa audit del corpus
intero, non tocca `plugins/daiku/` né l'indice di git, non committa nulla, non anticipa piani futuri
— quelli restano in `sviluppo/nuovi-sviluppi/` — e non revoca da sola un fatto dell'owner in
conflitto: quello si segnala, non si cancella.
