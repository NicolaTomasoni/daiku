---
name: commit
argument-hint: '[file..., opzionale — default: tutto ciò che è cambiato nel perimetro del codice]'
description: Crea commit seguendo la convenzione del progetto — allinea sempre prima memoria e documentazione al diff staged delegando a update-memory, decide il bump di versione e aggiorna il changelog, poi commit separati (codice, memoria/doc, versione/changelog), senza mai fare push
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git add:*), Bash(git commit:*), Read, Edit, Agent
---

Crea commit dei file che chi ti invoca ti indica — l'owner in chat, oppure la skill che ti delega. **Senza indicazioni, il perimetro è tutto ciò che è cambiato sotto `{code_root}`**, in stage o no, più i gruppi che la § *Procedura* 3 partiziona da lì. NON eseguire mai `git push`.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Convenzione di commit

Leggi `.daiku/domain/commit-convention.md`: porta quali tipi di commit ammette questo progetto e
quando si usa ciascuno, che forma ha il messaggio, cosa entra nel changelog e quale incremento di
versione è lecito qui. Daiku lo deposita con un default alla prima inizializzazione, quindi di
norma esiste; se **non** c'è — l'utente l'ha cancellato — **ricava la convenzione dallo storico**,
`git log --oneline -30` più i due o tre messaggi più recenti che somigliano al tuo aperti per
intero, rispecchiandola invece di importarne una tua, e dichiaralo nell'esito.

Il messaggio si scrive in `{language.commit}`, che non è detto sia la lingua in cui stai parlando
con l'utente: la storia di un repository ha lettori diversi da questa chat (§5.5 di
`contracts/project-contract.md`).

Sopra la convenzione, qualunque essa sia, valgono due cose che non dipendono dal progetto:

- **La descrizione dice cosa cambia, non come si chiama il lavoro.** Il nome dello sviluppo, della
  cartella o della feature non entra nel messaggio: chi rilegge lo storico fra un anno cerca il
  cambiamento, non l'etichetta con cui lo si era battezzato.
- **Il corpo, se c'è, elenca cosa è stato fatto**, in righe brevi. Niente prosa e niente
  motivazioni: quelle vivono nel documento di decisione, che sopravvive al commit.

## Allineamento di memoria e documentazione

Prima di congelare il codice in un commit, gli artefatti non-codice vanno riallineati **sullo stesso diff**: è il principio della fase `Memory` di `develop-feature`, e vale anche quando il commit arriva da una review standalone o da un lavoro fatto a mano. Nessuna feature entra in un commit lasciando l'artefatto indietro. Questa skill non replica quel contratto: lo **delega**.

**La delega è un passo obbligatorio e non ha eccezioni.** Ogni invocazione di questa skill la
esegue: quella che chiude una review, quella che l'owner lancia a mano su un diff scritto in chat,
quella su un gruppo di soli test, su una formattazione, su un revert, su una rinomina. Delega
**sempre**, senza giudicare prima se il diff «se lo merita» — quel giudizio è di `update-memory`,
che ha come primo principio «nessun aggiornamento non giustificato» e restituisce `updated: false`
senza scrivere niente quando non c'è nulla da riflettere. Costa un subagent che torna a mani
vuote; non delegare costa un artefatto che resta indietro dentro un commit, dove nessuno lo
ritrova più.

**Nemmeno il gruppo codice vuoto salta il passo.** Se stai committando solo memoria e
documentazione, non c'è un diff di feature da riflettere e il delegato tornerà `updated: false`
— ma il suo *Controllo aggiuntivo* sullo stage di `{memory.root}` vale **ogni esecuzione**, ed è
proprio il caso in cui serve: stai per congelare memoria scritta da qualcun altro. Dichiaraglielo
nel prompt («il gruppo codice è vuoto: non c'è diff di feature, fai il controllo sullo stage») e
lascialo decidere.

**Perché non ha eccezioni.** Nel pacchetto non esiste una revisione periodica del corpus: nessuno
passa dopo a correggere una memoria invecchiata. Il corpus resta sano perché **ogni** commit
attraversa questo passo, e una sola eccezione è sufficiente a far entrare nella storia un
artefatto rimasto indietro, che da lì in avanti nessuno ritrova.

**Non si chiede mai all'utente.** Né prima, come conferma, né dopo, come promemoria da eseguire a
mano. Un allineamento rimandato all'owner è un allineamento che non avviene: il commit parte, il
diff sparisce dentro la storia, e la riga che lo ricordava resta in una chat chiusa.

**Come delegare.** Un **subagent** in contesto fresco, ruolo **judge** secondo `contracts/orchestration.md` — leggilo e risolvi da lì il modello, mai da qui. Mai eseguire il passo inline. Il prompt dev'essere autosufficiente, perché il subagent parte da zero:

- il **contratto da leggere**: `skills/update-memory/SKILL.md`, per intero, prima di agire;
- l'**input risolto**: il diff **in index** sotto `{code_root}` (`git diff --cached --stat -- {code_root}` e `git diff --cached -- {code_root}`), che in questo momento è già in stage. Nessun argomento da passare: è il caso «dentro un commit» previsto dal suo stesso contratto;
- il **vincolo di perimetro**: mai toccare file sotto `{code_root}`, e mai toccare il **gruppo codice** già in stage — quello è perimetro tuo;
- il **permesso di commit, dichiarato esplicitamente**: «**sei autorizzato a committare il tuo gruppo** — `{memory.root}`, `{instructions_file}`, `.daiku/policies/`, `{tech_doc}` — mettendo in stage **solo quei path, elencati uno per uno**, e in tal caso dichiaralo in `committed`». Senza questa riga il suo default è **no** e lui non committa: il permesso è una proprietà dell'invocazione, e la stessa skill invocata dentro `develop-feature` non ce l'ha. Qui gliela dai perché è il gruppo che ha appena scritto, sa cosa ci ha messo e perché, e una consegna in meno è un punto in meno in cui la catena si può fermare a metà. **Il pathspec esplicito non è pedanteria**: in questo momento l'index porta già il gruppo codice (passo 4), e un `git add -A` o un `git commit -a` del delegato si porterebbe via la feature dentro un commit `{commit.memory_prefix}`;
- il **formato di ritorno**: il blocco JSON che quel contratto dichiara nella propria § *Procedura*, punto 7, per intero e con quei nomi di campo — leggilo da lì, non lo elenchi qui, perché un elenco ricopiato si restringe alla prima aggiunta di campo.

**Dopo la delega.** Se `updated` è `true`, i file che ha toccato — `{memory.root}`, `{instructions_file}`, `.daiku/policies/`, `{tech_doc}` — entrano nel gruppo memoria/doc e finiscono nel commit `{commit.memory_prefix}` separato: ripartiziona prima di procedere. Se ha già committato quel gruppo da sé, **non rifare quel commit**: verificalo con `git log` e prosegui col resto della sequenza, che resta tua. Se `confirm_with_owner` non è vuoto, **riportane le voci all'utente nell'esito finale**: sono fatti in conflitto lasciati intatti di proposito, e non si risolvono da soli né si nascondono dentro un commit.

**Se il blocco non torna** — prosa al posto del JSON, blocco incompleto, subagent che non risponde — il passo è fallito: lo rilanci **una volta sola**, con lo stesso identico prompt (§4.2 di `contracts/orchestration.md`). Se non torna neanche allora, **il gruppo memoria/doc di questa invocazione è vuoto**: non ricostruirlo guardando `git status`, perché committeresti file che nessuno ti ha dichiarato e che possono essere di un altro flusso. Prosegui con gli altri gruppi e dichiara nell'esito che l'allineamento non è stato fatto su questo diff — è l'unica cosa che impedisce a un artefatto rimasto indietro di sembrare allineato.

## Bump di versione e changelog

Il changelog `{changelog}` è il registro delle versioni rilasciate. La versione canonica dell'applicazione vive in `{version.file}`, alla voce `{version.field}`, ed è replicata in ogni file di `{version.replicated_in}`, in ciascuno nella voce che porta la versione del progetto: tutti questi file si aggiornano sempre insieme, e insieme al changelog.

**Il changelog registra ciò che cambia per chi usa l'applicazione.** Quando il gruppo codice cambia ciò che l'utente può fare o vedere, la voce corrispondente entra nel changelog nella stessa consegna, in `{language.commit}`, sotto la sezione delle voci non ancora rilasciate, nell'area tematica pertinente e **con lo stile già in uso nel file**. Il lavoro che per l'utente non cambia niente non produce voce: il changelog non è il registro della manutenzione.

**Dove passi esattamente quel confine — quali tipi di commit producono una voce e quali no — non lo decide questa skill**: lo dichiara `.daiku/domain/commit-convention.md`, e la risposta cambia da progetto a progetto (su molti un `fix` è proprio la cosa che l'utente vede cambiare). Senza quel file, lo dicono le voci già scritte in `{changelog}`. Non indovinare una lista di tipi: la lista è dominio, non metodo.

**Il bump di versione è una tua decisione autonoma, non una domanda all'utente.** Vale il criterio dell'importanza:

- **Bump** quando la feature — o il gruppo di feature accumulate fra le non rilasciate, di cui questa è il completamento — cambia ciò che l'utente può fare con l'applicazione. È il criterio con cui sono nate le versioni già in changelog: ogni sezione è un ciclo con un tema riconoscibile, e quel tema si legge aprendo il file.
- **Non bump** per rifiniture, correzioni, lavoro interno non visibile, o per un incremento su una capacità già rilasciata nella versione corrente.
- **Nel dubbio, non bumpare**: la voce resta fra le non rilasciate e il bump arriverà con il commit che chiude il tema. Astenersi qui non costa niente, perché il changelog è comunque aggiornato.

**Quale incremento ti è concesso lo dice il progetto**, non questa skill: `.daiku/domain/commit-convention.md` dichiara quale parte della versione puoi muovere e quale resta all'owner o ai flussi di packaging. Se non lo dichiara, **non bumpare affatto**: scrivi la voce fra le non rilasciate e dichiara nell'esito che il bump non era tuo da fare. In nessun caso più di **un bump per invocazione** di questa skill.

**Cosa comporta un bump.** Leggi `.daiku/domain/changelog.md`: porta com'è fatta una sezione di versione del changelog di questo progetto e quali riferimenti al rilascio si allineano quando ne nasce una. Se non esiste, ricava la forma dalle sezioni già presenti in `{changelog}` e dichiaralo nell'esito. Poi, in un'unica modifica coerente:

1. `{version.field}` in `{version.file}` e, in ogni file di `{version.replicated_in}`, la voce che porta la versione del progetto;
2. in `{changelog}`: la sezione delle voci non ancora rilasciate diventa la sezione della nuova versione, nella forma dichiarata lì — con la data del giorno e una riga di sintesi che nomina il tema del ciclo — e sopra di essa resta una sezione vuota per le non rilasciate solo se ci sono voci residue, altrimenti si rimuove;
3. sempre in `{changelog}`: i riferimenti al rilascio che il file tiene allineati alla versione corrente.

Il changelog è documentazione, ma **non appartiene al gruppo memoria/doc**: non delegarne la scrittura a `update-memory`, che ha un contratto e un perimetro diversi. Lo aggiorni tu, direttamente, e finisce nel proprio commit come descritto sotto.

## Commit separato della memoria e documentazione

Gli aggiornamenti agli artefatti non-codice — `{memory.root}`, `{instructions_file}`, `.daiku/policies/`, `{tech_doc}` — **non si mescolano mai** al commit di feature: vanno in un **commit distinto**, con prefisso `{commit.memory_prefix}` (convenzione del progetto, es. `{commit.memory_prefix} update`), esattamente come fa la fase `Commit` di `develop-feature`. Questo vale sia quando committi lo stage, sia quando committi un perimetro indicato dall'utente, sia quando i file arrivano dalla delega descritta sopra.

Regola pratica: se tra i file da committare compaiono **sia** file sotto `{code_root}` (o altro codice) **sia** modifiche a `{memory.root}`/`{instructions_file}`/`.daiku/policies/`/`{tech_doc}`, produci **un commit per gruppo** — prima quello di codice con il tipo appropriato (`feat`/`fix`/...), poi quello di memoria/doc con prefisso `{commit.memory_prefix}`, e per ultimo, se il bump lo tocca, quello di versione/changelog: sono i tre gruppi del punto 3 della § *Procedura*, non due.

**C'è un caso in cui quell'ordine non vale, ed è dichiarato.** Quando il delegato dell'allineamento usa il permesso che gli hai dato (§ *Allineamento di memoria e documentazione*), il commit `{commit.memory_prefix}` esce al passo 5, quindi **prima** di quello di codice. È il prezzo del fatto che l'allineamento gira sul diff **in index**, cioè prima che il codice sia congelato: per averlo dopo bisognerebbe committare il codice per primo, e allora non ci sarebbe più niente da allineare prima del congelamento — che è l'intera ragione per cui questo passo esiste. L'ordine dichiarato resta quello dei gruppi che **committi tu**, e l'esito dice chi ha prodotto quale SHA. È anche la differenza con `develop-feature`, che quel permesso non lo dà proprio perché lì l'ordine dei commit è suo. Il commit `{commit.memory_prefix}` include solo quegli artefatti; mai file sotto `{code_root}`. Se le uniche modifiche sono agli artefatti non-codice, fai un solo commit `{commit.memory_prefix}`.

Lo stesso principio vale per **versione e changelog**: `{changelog}`, `{version.file}` e i file di `{version.replicated_in}` formano un terzo gruppo, che va nel proprio commit **dopo** quello di codice e quello `{commit.memory_prefix}`. Il messaggio dipende dalla decisione presa:

- **con bump**: un messaggio che dice di aver portato la versione dell'applicazione al numero nuovo, con nel corpo la riga del tema del ciclo;
- **senza bump**: un messaggio che dice di aver registrato la capacità fra le modifiche non rilasciate.

Tipo e scope di entrambi seguono la convenzione di questo progetto (§ *Convenzione di commit*): lo storico dei commit di versione dice già quali usa.

Un gruppo vuoto non produce commit.

## Procedura

1. Esegui in parallelo per contesto:
   - `git status` — stato working tree e stage
   - `git log --oneline -10` — stile commit recenti

2. **Determina l'ambito.**
   - **Con parametri**: i path indicati, e nient'altro — anche se accanto c'è altro modificato.
   - **Senza parametri**: tutto ciò che `git status --porcelain` riporta come cambiato, dentro e
     fuori dall'index. Il perimetro del gruppo codice è `{code_root}`; gli altri due gruppi del
     passo 3 stanno fuori da lì per definizione, e si raccolgono dagli stessi path che quel passo
     enumera.
   - **Quello che trovi già in stage non è l'ambito**, è solo un fatto dello stato corrente: se
     porta file di gruppi diversi, il passo 7 li separa comunque. Non committare l'index così
     com'è con un `git commit` nudo — mescolerebbe i gruppi, che è esattamente ciò che questa
     skill esiste per evitare.

3. **Separa i gruppi.** Partiziona i file da committare in tre gruppi: **codice** (file sotto `{code_root}` e ogni altro sorgente), **memoria/doc** (`{memory.root}`, `{instructions_file}`, `.daiku/policies/`, `{tech_doc}`) e **versione/changelog** (`{changelog}`, `{version.file}` e i file di `{version.replicated_in}` quando li tocchi per il bump). I passi 6-7 si eseguono una volta per ciascun gruppo non vuoto, nell'ordine: codice, `{commit.memory_prefix}`, versione/changelog.

4. **Metti in stage il gruppo codice** (`git add <file>`), senza committare. Serve prima del passo 5: il diff su cui la memoria va allineata è quello in index, ed è lì che `update-memory` lo cerca.

5. **Allinea memoria e documentazione**, delegando al subagent secondo *Allineamento di memoria e documentazione*. Poi ripartiziona il gruppo memoria/doc con i file che la delega ha eventualmente toccato. **Non c'è nessun caso in cui questo passo si salta**, gruppo codice vuoto compreso: il giudizio su quanto il diff meriti è suo, non tuo, e la sezione qui sopra dice perché.

5-bis. **Aggiorna changelog e versione** secondo *Bump di versione e changelog*: se il gruppo codice introduce comportamento nuovo per l'utente, scrivi la voce fra le non rilasciate; poi decidi da solo se il lavoro merita il bump e se quell'incremento è tuo da fare; in caso, promuovi la sezione, allinea `{version.file}`, i file di `{version.replicated_in}` e i riferimenti al rilascio nel changelog. Se non aggiorni il changelog o non bumpi, dichiara in una riga perché. I file toccati vanno nel gruppo versione/changelog.

6. Determina file inclusi e messaggio commit, senza chiedere conferma su nome/descrizione né sul numero di versione scelto: procedi direttamente.

7. Crea il commit (per ciascun gruppo non vuoto, separatamente):
   - Fai staging dei soli file del gruppo corrente (`git add <file>`), mai mescolare gruppi diversi in un unico commit. Il gruppo codice è già in stage dal passo 4: verifica con `git status` che non vi sia entrato altro.
   - **Se nell'index c'è anche roba di un altro gruppo** — perché chi ti ha preceduto l'aveva già messa lì — non toglierla dall'index: committa **per pathspec**, `git commit -- <i file del gruppo>`, che congela quei soli path e lascia il resto in stage per il gruppo a cui appartiene. È l'unica forma che separa i gruppi senza toccare lo stato che l'owner aveva preparato.
   - Crea il commit con messaggio multiriga, con la sintassi del tool che stai usando in quel momento (mai mischiarle):
     - **Tool Bash** (Git Bash/POSIX sh): `git commit -F -` alimentato da un heredoc quotato, oppure `git commit -m` con il messaggio in chiaro. Mai `@'...'@` (è sintassi PowerShell, non valida in sh: produce un messaggio con `@` letterali in testa/coda).
     - **Tool PowerShell**: here-string `git commit -m @'...'@` con `'@` di chiusura a colonna 0.
   - Dopo il commit, verifica sempre il messaggio con `git log -1 --format="%s%n%n%b"` prima di passare al gruppo successivo: se compaiono `@` o altri artefatti di sintassi, correggi subito con `git commit --amend -m "..."` (nessuna nuova sintassi da indovinare: passa il messaggio corretto in chiaro nel `-m` dell'amend).

8. Mostra i commit creati con `git log --oneline -n <quanti ne sono stati prodotti>` — possono essere più di tre, se il delegato ha committato il proprio gruppo da sé — dichiara la decisione presa sulla versione — il numero nuovo con il tema del ciclo, oppure nessun bump e perché — e, se la delega ha restituito voci in `confirm_with_owner`, riportale.

   **Riporta al chiamante lo SHA di ogni commit prodotto, dicendo di quale gruppo è**, come già fai con `confirm_with_owner`: chi ti ha invocato lo mette in un campo del proprio blocco e non può ricavarlo da `git log -1`, che dopo di te restituisce l'ultimo gruppo e non quello del codice. Se ti fermi fra un gruppo e il successivo, dillo esplicitamente: la sequenza è **parziale**, non eseguita.

**Mai** eseguire `git push`, `git push --force`, o qualsiasi comando che scriva sul remoto.
**Mai** aggiungere il trailer `Co-Authored-By` né alcuna menzione dell'agente che ha generato il lavoro (`Generated with …` o simili) ai messaggi di commit.
