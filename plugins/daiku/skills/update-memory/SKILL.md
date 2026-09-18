---
name: update-memory
description: Passo obbligatorio di /deliver-feature prima del commit, aggiorna il file di istruzioni, .daiku/policies/, il corpus di memoria e il documento tecnico del progetto sulla base del diff della feature (in index, non ancora committato), seguendo il contratto della memoria già scritto altrove — mai duplicarlo, delta minimo, nessuna scrittura se il diff non la giustifica
argument-hint: [commit o range, opzionale — default: il diff in index]
---

Sei il passo che tiene allineati gli artefatti non-codice del progetto — `{instructions_file}`, `.daiku/policies/`, `{memory.root}`, `{tech_doc}` — al lavoro di feature appena consegnato. Non replichi il contratto che li governa: lo **leggi** ogni volta da `.daiku/domain/memory-contract.md` — o da `{instructions_file}`, se quel file non esiste — così resti allineato quando quel contratto cambia. Non tocchi mai il codice sotto `{code_root}`: il tuo perimetro è solo istruzioni, doc e memoria.

Sei invocato in tre modi: **dentro la consegna**, come passo obbligatorio **prima** del commit (fase `Memory` di `/deliver-feature`, sul diff già in index sotto `{code_root}`); **dentro un commit**, delegato da `/commit` sul diff che sta per essere congelato; **manuale**, da `/update-memory` in chat su un commit o range specifico.

**Non tocchi mai l'index di `{code_root}`** e non committi il gruppo codice: quello è perimetro di chi ti ha chiamato, in tutti e tre i casi. Il **commit del tuo gruppo** — `{memory.root}`, `{instructions_file}`, `.daiku/policies/`, `{tech_doc}` — dipende invece dall'**invocazione**, non da te: lo fai **solo se chi ti invoca te lo dichiara nel prompt**, e il default in assenza di quella riga è **no** — prepari le modifiche, lasci i file scritti e non staged, e restituisci `committed: null`. Non è una cautela: è che il valore giusto cambia col chiamante. `/commit` ti autorizza, perché il tuo gruppo è un commit che altrimenti deve rifare leggendo file che non ha scritto; `/deliver-feature` no, perché ha un ordine di commit da rispettare — prima la feature, poi doc e memoria — e quell'ordine è suo. Mai `git push`, in nessun caso e sotto nessuna autorizzazione.

Il diff arriva prima del commit, non dopo, perché è lì che serve: nessuna feature viene congelata in un commit senza che gli artefatti siano stati riallineati sullo stesso identico diff.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Input: il diff da ispezionare

Argomenti: `$ARGUMENTS` — `[commit o range]`.

- Se invocato dentro la consegna, il diff è quello **in index** sotto `{code_root}`: `git diff --cached --stat -- {code_root}` e `git diff --cached -- {code_root}`. È il diff integrale della feature, file nuovi compresi (che `git diff` senza `--cached` non mostrerebbe). Non chiedere nulla.
- Se invocato manualmente e `$ARGUMENTS` è vuoto, usa il diff in index se c'è qualcosa in staging sotto `{code_root}`, altrimenti l'ultimo commit (`HEAD`).
- Se `$ARGUMENTS` indica un commit o un range, ispeziona `git show <ref> --stat` e `git diff <ref>^ <ref>`. Se indica un commit inesistente, segnalalo e fermati.
- Se il diff tocca **solo** path fuori da `{code_root}` (es. un commit doc/memoria precedente), fermati: non hai un diff di feature da riflettere.

## Controllo aggiuntivo: stage Git su `{memory.root}`

Oltre al diff della consegna, **ogni esecuzione** verifica anche cosa c'è attualmente in
staging sotto `{memory.root}`, a prescindere dallo scope dichiarato `{code_root}` — è un controllo di igiene
sul corpus, non un'estensione dello scope della feature:

1. Esegui `git status --porcelain -- {memory.root}` e, per ogni file risultante staged (`A`/`M`/`R` in
   prima colonna), `git diff --cached -- <quel file>` per leggere esattamente cosa cambierebbe.
2. Se non c'è nulla in staging sotto `{memory.root}`, salta questo controllo senza commento.
3. Per ciascuna modifica staged, verificala contro il contratto della memoria (niente narrazione storica, niente
   duplicati con altri artefatti, mai fondere forme diverse, niente dettaglio deducibile dal
   codice degradato a fatto, `{memory.index}` coerente con i file). Le forme non conformi tipiche:
   - contenuto **narrativo/storico** ("prima si faceva X, poi si è passati a Y") invece di stato
     corrente + perché;
   - un **fatto duplicato** già coperto da un'altra memoria esistente, invece di essere fuso lì;
   - una **mappa o descrizione** scritta come se fosse un fatto non deducibile (o viceversa, un
     fatto degradato a semplice puntatore, perdendo il perché);
   - un file il cui frontmatter dichiara una forma incoerente col contenuto, o un `{memory.index}` non aggiornato
     a fronte di un file nuovo/rinominato/spostato/fuso presente nello stage.
4. **Se trovi un'incoerenza, correggila direttamente** (stessa working tree, stesso file in
   staging) prima di procedere con il resto della skill: riformula in tono corretto, fondi il
   duplicato nella destinazione canonica, correggi la forma dichiarata nel frontmatter o allinea `{memory.index}`. Non serve
   `confirm_with_owner` per questo — è un controllo di forma sul contenuto **appena staged in
   questa stessa sessione o da un flusso a monte**, non un fatto storico consolidato dell'owner
   (quello resta coperto dal principio "mai revocare da solo", punto 4 sotto). Lasci lo stage
   aggiornato. Il **gruppo codice** già in stage non lo tocchi e non lo committi: quello è perimetro
   della skill chiamante. Il commit del **tuo** gruppo segue la regola dell'invocazione dichiarata
   in cima a questo file: lo fai solo se il prompt te lo dichiara, e in quel caso lo riporti in
   `committed`.
5. Se l'incoerenza è ambigua (potrebbe essere un fatto legittimo scritto in modo insolito, non un
   errore di forma), non correggerla da solo: aggiungila a `confirm_with_owner` con lo scenario.

## Principi

1. **Nessun aggiornamento non giustificato.** Se il diff non cambia nulla che questi artefatti debbano riflettere, non scrivi nulla. Un ciclo che non tocca istruzioni/doc/memoria a ogni feature è l'esito atteso, non un fallimento: molte feature sono dettaglio implementativo puro.
2. **Cerca prima di creare.** Su questo il contratto della memoria è esplicito: leggi per intero `{memory.index}`, il file target più vicino e le memorie semanticamente vicine prima di scrivere. Aggiorna o fondi un file esistente; crea un nuovo file solo se nessuno copre già lo stesso confine o fatto.
3. **Classifica prima di scrivere.** Ciò che il codice rende deducibile — una mappa che punta a un nome stabile, un catalogo che dà la riga di confine di un componente — va in `{memory.root}` nella forma che il contratto della memoria prevede; un fatto (decisione, perché, feedback non deducibile) resta un fatto e non si degrada mai a puntatore. Comportamento e invarianti universali vanno in `{instructions_file}`; regole architetturali pertinenti solo a path reali vanno in `.daiku/policies/`, sempre con frontmatter `paths` e mai come regole globali. Il *cosa* e il *perché* superficiali, senza nomi di codice o variabile, vanno in `{tech_doc}`.
4. **Mai revocare da solo un fatto, una decisione o un feedback dell'owner.** Se il diff sembra contraddire un fatto esistente in `{memory.root}` o non ne consente più la verifica, **non cancellarlo, correggerlo, riassumerlo o fonderlo alterandone il significato**: lascialo intatto e segnalalo in `confirm_with_owner`.
5. **Delta minimo.** Niente pulizie opportunistiche di memorie non correlate al diff, niente riscritture di prosa già corretta, niente campo "aggiornato" solo per certificare una revisione senza cambiamento sostanziale.
6. **La versione del documento tecnico non si inventa.** Se tocchi `{tech_doc}` e quel documento porta in testa una versione, aggiornala leggendo quella canonica da `{version.file}`, campo `{version.field}`, insieme alla data.
7. **Non è un audit.** Non stai rivedendo l'intero corpus `{memory.root}` (quello è `/memory-review`, sola lettura): guardi solo cosa il diff di *questa* consegna giustifica, più lo stage corrente di `{memory.root}` (vedi *Controllo aggiuntivo* sopra) — quest'ultimo è un controllo di forma su ciò che è appena stato staged, non un audit storico del corpus.

## Procedura

1. **Leggi il contratto**: `.daiku/domain/memory-contract.md` — a quale artefatto tocca cosa, quali forme può avere una memoria, con quali regole il corpus si muta, quando si aggiorna l'indice. Se non esiste, quelle regole le dichiara `{instructions_file}`. Non copiarle qui a mano: rileggile a ogni esecuzione, perché è così che resti allineato quando cambiano.

2. **Ispeziona il diff** (vedi *Input*): file toccati, natura del cambiamento (nuovo componente? layer spostato? invariante violato e poi corretto? comportamento di un agente cambiato? decisione non ovvia presa durante l'esecuzione?).

3. **Per ciascun artefatto, decidi se il diff lo giustifica:**
   - **`{instructions_file}`**: solo se è cambiata un'invariante valida in ogni sessione, il comportamento globale, il contratto documentale o la struttura del repo. Mai dettaglio implementativo o regola limitata a un'area.
   - **`.daiku/policies/`**: se cambia un layer, un flusso architetturale o un confine pertinente solo a file specifici. Aggiorna la rule esistente più vicina; creane una solo se nessuna copre il confine. Ogni rule deve avere frontmatter `paths` con pattern reali che trovano almeno un file del repository; mai rule senza `paths`.
   - **`{memory.root}`**: segui il contratto della memoria alla lettera — leggi `{memory.index}` per intero, individua il file più vicino, classifica nella forma che quel contratto dichiara, aggiorna o fondi, e **aggiorna `{memory.index}` nella stessa modifica** se crei, rinomini, sposti o fondi una memoria.
   - **`{tech_doc}`**: solo se è cambiato qualcosa che un lettore umano, a livello di *cosa fa il sistema e perché* (mai nomi di codice o variabile), deve ora leggere in modo diverso. In particolare, un **cambiamento di comportamento visibile all'utente** introdotto dal diff — nuovo flusso, nuova azione, default o semantica cambiata — è l'innesco tipico: è proprio ciò che un lettore del Doc deve trovare aggiornato. Se una review a monte (`/review`) ha lasciato un promemoria di allineamento doc, è qui che si onora.

4. **Applica le modifiche minime** ai soli artefatti che il passo 3 ha giustificato. Se nessuno lo è, fermati qui: non produrre nulla.

5. **Non modificare mai file sotto `{code_root}`**: se ti accorgi di volerlo fare, ti sei allontanato dal perimetro di questa skill.

6. **Salva nella codifica del progetto**, senza degradare i caratteri non ASCII.

7. **Restituisci** (in chat se manuale, come blocco JSON a contratto se invocato dentro una catena — è lo schema che questa skill dichiara, e che il chiamante cita senza ricopiarlo): `updated` (booleano — true se hai scritto almeno un file, incluse le correzioni del controllo stage), `files` (i path toccati, incluse le correzioni del controllo stage), `confirm_with_owner` (elenco di frasi per ogni fatto dubbio o in conflitto lasciato intatto, incluse le incoerenze ambigue del controllo stage; vuoto se nessuno), `detail` (una frase sul perché hai aggiornato o non aggiornato), `committed` (lo SHA del commit del tuo gruppo se l'invocazione ti autorizzava e l'hai fatto, altrimenti `null` — e `null` è il valore normale: senza questo campo chi ti ha chiamato rifà il commit su file che nessuno ha più modificato, o resta ad aspettarlo).

   Il campo si scrive **sempre**, anche quando non eri autorizzato: è un `null` esplicito, non un campo omesso. Un campo che manca non dice «non ho committato», dice che non si sa.

   Se il prompt che ti ha invocato ti dà la **cartella dell'item**, scrivi lo stesso blocco anche in `3. memory-report.md` dentro quella cartella, prima di restituirlo in chat — **sempre**, anche quando non hai aggiornato niente: dire che la fase è avvenuta è metà del suo mestiere. È il passaggio di consegne: una catena che si interrompe qui riparte trovando la memoria già allineata — quindi `updated: false` e `files: []`, correttamente — e senza quel file il tuo elenco di `files` non esiste più, così le modifiche a `{memory.root}` già scritte non entrano in nessun commit e le voci `confirm_with_owner` spariscono senza traccia. Il file contiene **solo** il blocco e, per esteso, le frasi di `confirm_with_owner`: non è un diario di avanzamento, non racconta cosa hai letto, in che ordine né quanto è durato, e il suo path non entra in `files` — `files` è l'ambito del commit di memoria, l'artefatto è la traccia della fase.

## Regola di taglio

Questa skill fa cinque cose: legge il contratto della memoria da dove il progetto lo dichiara, ispeziona il diff della consegna (in index, o il commit indicato), verifica e corregge la forma di ciò che è staged in `{memory.root}`, aggiorna solo gli artefatti che il diff giustifica secondo il contratto, e riporta l'esito. Non fa audit del corpus intero (il controllo stage guarda solo ciò che è staged ora, non l'intera `{memory.root}`), non tocca `{code_root}` né il suo index, non committa il gruppo codice, non committa il proprio se l'invocazione non lo dichiara, non crea rule senza `paths` reali, non anticipa piani futuri (quelli restano in `{paths.studies}/`) e non revoca da sola un fatto o un feedback dell'owner in conflitto: quello si segnala, non si cancella.
