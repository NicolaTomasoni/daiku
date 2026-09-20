---
name: 'new-feature'
description: 'Apre una feature da una descrizione in linguaggio naturale e la porta fino al commit in un''unica esecuzione: indagine sul codice, studio delle tecnologie che non conosci abbastanza, documento di decisione, decisioni chieste in chat, e da lì la consegna intera delegata a develop-feature'
argument-hint: '<descrizione della feature o del problema>'
---

Sei il nodo che **apre** un lavoro e non lo lascia a metà. Ricevi una descrizione in linguaggio
naturale, indaghi il codice, ti procuri la conoscenza che ti manca, fai studiare le decisioni, le
porti all'owner in chat — e con le sue risposte in mano prosegui fino al commit senza che lui debba
rilanciare niente.

**L'owner interviene una volta sola**, quando risponde alle decisioni. Prima non gli chiedi nulla
perché non c'è ancora niente da chiedere; dopo non gli chiedi nulla perché ha già deciso, e una
conferma in più è un gesto che gli costa e non aggiunge informazione.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Quando usarla, e quando usare le altre

| Da dove parti | Cosa lanci |
|---|---|
| un'idea o un problema, e sul disco non c'è ancora niente | **questa** |
| una cartella che porta già materiale grezzo scritto a mano (note, requisiti, vincoli) | `decision-doc <cartella>` |
| una cartella con `1. decision-doc.md` già risolto | `develop-feature <cartella> <soluzione>` |

Le tre non si sovrappongono: questa skill è l'unica che parte dal **codice** invece che da un
documento, ed è l'unica che apre la cartella.

## Prima di iniziare

Leggi `contracts/orchestration.md`: ruoli, host, come si lancia un subagent, come si pone una
domanda all'owner, concorrenza. Ogni passo qui sotto dichiara il proprio ruolo (**judge** o
**worker**) e tu risolvi il modello con la regola della sua §2 — mai da qui.

## Input

Argomenti: `$ARGUMENTS` — la descrizione del lavoro in linguaggio naturale. Può essere una feature
da fare, una domanda su come si fa una cosa che il sistema non fa ancora, un gap («manca il
cablaggio fra X e Y»), una tensione architetturale («due componenti fanno la stessa cosa»).

Se `$ARGUMENTS` è vuoto, **chiedi** cosa si lavora e fermati finché non arriva. È l'unica domanda
ammessa prima delle decisioni.

## La sequenza

Le fasi sono ordinate e non saltabili. Ognuna dichiara il proprio ruolo, e ogni passo delegato è
**un subagent in contesto fresco** con il prompt che gli dà il contratto da leggere, l'input
risolto e il blocco da restituire (§4 di `contracts/orchestration.md`).

Avanzamento e rilievi vanno **in chat**, man mano: una riga quando una fase parte e quando torna,
e subito ciò che hai notato e che non entra in nessun blocco. Non tenere un log su file: lo stato
che serve a riprendere sono i documenti che le fasi depositano nella cartella.

### 1. Apri la cartella, e la memoria

Dalla descrizione ricava uno **slug** kebab-case che dica il *problema*, non la soluzione — la
soluzione non l'hai ancora scelta, e uno slug che la nomina orienta tutto ciò che viene dopo. La
cartella è `{paths.studies}/<slug>/`: creala. Se esiste già, chiedi conferma prima di lavorarci
dentro — è l'unica altra domanda ammessa prima delle decisioni.

Apri `{memory.index}` e le memorie che l'area del problema tocca: è il canale di §4.1 di
`contracts/orchestration.md`. Un gap che una memoria ha già chiuso non è un gap, e un trade-off
che l'owner ha già deciso non si riapre qui. I path che scegli ora li passerai a ogni passo che
decide o scrive.

### 2. Indagine sul codice — ruolo **worker**

Capisci come funziona oggi il sistema nell'area del problema. Lancia **subagent worker in
parallelo**, **uno per fronte d'indagine**. I fronti li ricavi dal problema, non da una lista:
tipicamente uno per ciascuna area di `{areas}` che il problema tocca, più due trasversali che
quasi sempre servono — **configurazione e avvio** (impostazioni, ambiente, ciò che il sistema
legge quando parte) e **architettura** (flussi, invarianti, confini fra layer).

Per ogni agente, nel prompt: i file da leggere (path concreti), l'obiettivo dell'analisi, e la
consegna — una sezione markdown pronta da incollare. Lanciali in un solo blocco di tool call.

Chiedi a ciascuno di riportare anche **quali tecnologie di terze parti** governano il suo fronte e
in quale versione il progetto le usa, letta dal manifest delle dipendenze e non a memoria. È ciò
su cui deciderai al punto 4, e un fronte che non te lo dice ti costringe a riaprire quei file da
solo.

Se un fronte resta scoperto o dubbio, fai tu una lettura mirata prima di chiudere il passo, e
dichiaralo nel documento.

### 3. Prima stesura di `0. problem.md`

Scrivi `{paths.studies}/<slug>/0. problem.md`: descrive il problema, documenta com'è fatto oggi,
identifica i gap concreti, evidenzia trade-off e dubbi, delimita il confine. **Non propone
soluzioni** — quelle arrivano dallo studio delle decisioni.

```markdown
# <Titolo del problema> — il problema

> Descrizione del problema, senza soluzione. Indagine sul codice.
> **Stato:** analisi sul codice al <data>.

## In una riga
[cosa non funziona, cosa manca, perché è un problema ora — 2-3 frasi]

## Com'è fatto oggi il livello "X"
[per ogni area coinvolta: come funziona, quali componenti, quali pattern,
 con file e righe citati]

## Perché questo diventa un problema (i gap)
[numerati, concreti]

## Trade-off e dubbi aperti
[le tensioni che il disegno dovrà sciogliere, con le opzioni in gioco]

## Confine del problema (cosa NON è in scope qui)
[cosa non si decide e non si propone qui]
```

Ogni affermazione è ancorata al codice (file + righe), con path relativi alla root del repo.

È una **prima** stesura: è scritta con la conoscenza che hai adesso, e il punto 5 la rimette in
discussione su ciò che le fonti diranno.

### 4. La conoscenza che ti manca — `study`, ruolo **worker**

Guarda le tecnologie di terze parti che l'indagine ha nominato e chiediti, per ciascuna, se la
conosci abbastanza per *decidere* su di essa. **Studiala se vale almeno una** di queste:

- il progetto la usa in una versione che non sai di conoscere, o più recente del tuo cutoff;
- rilascia spesso, e ciò che sai potrebbe essere di due versioni fa;
- è giovane o di nicchia;
- il lavoro ti farà scrivere firme, decoratori, import o file di configurazione suoi, e nel
  progetto non c'è già un esempio da cui copiarli.

Non studiarla se è ferma da anni e la feature non tocca la sua superficie pubblica. E se
`{paths.lib_notes}/<slug-tecnologia>.md` esiste già, **leggilo prima di decidere**: se copre la
versione in uso ed è recente, quello è lo studio — riusalo e non rilanciare niente. Se copre una
versione più vecchia, lancia `study`, che aggiorna invece di ripartire da zero.

**La decisione è tua e non si chiede.** L'owner ha chiesto una feature, non un piano di studi. E
non è una scelta a sensazione: il modello che «si sente sicuro» su una libreria giovane è
esattamente il caso in cui inventa firme plausibili e sbagliate. Nel dubbio studia — costa un
fan-out, mentre un'API inventata costa un giro di review, e a volte passa.

Un subagent per tecnologia, tutti nello stesso blocco di tool call. Nel prompt:

- il **contratto da leggere**: `skills/study/SKILL.md`, per intero, nella modalità
  *Da `new-feature`* che quel file dichiara;
- la **tecnologia** e la **versione in uso nel progetto**, come l'indagine l'ha letta dal manifest;
- le **domande** a cui gli appunti devono rispondere — tre-sei, concrete, ricavate dai gap e dai
  dubbi che hai appena scritto. Sono ciò che distingue uno studio mirato da un'enciclopedia che
  nessuno rilegge;
- il **vincolo di perimetro**: scrive solo `{paths.lib_notes}/<slug-tecnologia>.md`, non committa
  e non fa push;
- il **formato di ritorno**: il blocco che quel contratto dichiara, per intero.

Se nessuna tecnologia lo merita, dillo in una riga in chat e passa al punto 6: il punto 5 non ha
niente da riconfrontare.

### 5. Riconfronta, e riscrivi il problema

Gli appunti sono tornati, e `0. problem.md` è scritto su ciò che sapevi **prima**. Rileggilo
contro di loro e correggi ciò che smentiscono. Quello che tipicamente salta fuori:

- un gap che **non esiste**: la libreria lo copre già, con l'API che gli appunti riportano verbatim;
- un gap che esiste, ma per un motivo diverso da quello che avevi scritto;
- un trade-off che la versione in uso ha già chiuso — o uno nuovo, che non avevi visto;
- un'API che avevi nominato e che in quella versione non si chiama così, o non esiste più.

Le correzioni sono **chirurgiche**: tocchi le righe che gli appunti smentiscono, non riscrivi il
documento. Ogni affermazione che ora poggia sugli appunti cita il file e la sezione da cui viene.

Aggiungi in coda una sezione **Su cosa poggia**: gli appunti consultati con versione e data, e i
`[da verificare]` che restano. Quei marcatori sono i punti in cui nemmeno le fonti hanno risposto,
e chi decide deve sapere che sono lì invece di scoprirli mentre sceglie.

**Se gli appunti non smentiscono niente, scrivilo in una riga** e vai avanti: un riconfronto che
non trova nulla è un riconfronto riuscito, non uno saltato.

Questo passo è tuo e non si delega: il documento l'hai scritto tu, e sei l'unico che sa quali
affermazioni poggiavano su una conoscenza che non avevi verificato.

### 6. Lo studio delle decisioni — `decision-doc`, ruolo **judge**

Un subagent in contesto fresco. Nel prompt:

- il **contratto da leggere**: `skills/decision-doc/SKILL.md`, per intero, prima di agire, nella
  modalità *Da `new-feature` — studio* che quel file dichiara;
- l'**input risolto**: la cartella `{paths.studies}/<slug>/` e, dentro, `0. problem.md` — è già il
  documento base del problema, non c'è nulla da concatenare;
- i **path degli appunti** che il punto 4 ha prodotto o riusato, con l'istruzione di aprirli prima
  di studiare le opzioni. Sono la ragione per cui hai speso quel fan-out: un'opzione tecnica
  motivata sulla memoria del modello, quando sul disco c'è la fonte, è il difetto che questa
  catena esiste per evitare;
- la **memoria pertinente**: `{memory.index}` e i path che hai aperto al punto 1;
- il **vincolo di perimetro**: scrive solo dentro quella cartella, non committa e non fa push;
- il **formato di ritorno**: il blocco che quel contratto dichiara nella propria § *Il blocco che
  restituisci*, per intero.

### 7. Le decisioni si chiedono in chat

Il blocco è tornato e porta `decisioni` **verbatim**. Le poni all'owner come domanda strutturata,
secondo § *Domandare all'owner* di `contracts/orchestration.md`, che dice come quella forma si
rende sull'host corrente.

Da ogni decisione ricavi una domanda sola: il titolo e il problema in forma di domanda, le sue
2-4 opzioni mutuamente esclusive, ciascuna con una riga su cosa comporta, e quella raccomandata
**per prima** e dichiarata tale.

- **Non riassumere e non riordinare** ciò che il subagent ha scritto, e non aggiungere opzioni.
  Una lista riassunta è una lista a cui l'owner risponde con meno di quanto era stato studiato.
- **Non aggiungere un'opzione «decidi tu»**: la raccomandata è già quella, e l'owner che non ha
  preferenze la conferma in un gesto.
- **Non trasformare in domanda ciò che non è una decisione.** Il verdetto, i fix già applicati e i
  rilievi giudicati scelte legittime stanno nel blocco perché tu li **riporti**, non perché li
  chieda.
- Se l'owner risponde **fuori** dalle opzioni, quella risposta prevale e si passa verbatim al
  recepimento.

**È l'unico punto in cui ti fermi.** Quando le risposte arrivano non chiedi conferma per
proseguire: prosegui.

### 8. Il recepimento — `decision-doc`, ruolo **judge**

Un secondo subagent, contesto fresco. Stesso contratto, modalità *Da `new-feature` —
recepimento*. Nel prompt, oltre a cartella, appunti e memoria come al punto 6: le **risposte
dell'owner**, decisione per decisione, **verbatim**, comprese quelle libere.

### 9. Se lo stadio era strategico, si torna al 7

Il blocco del punto 6 dichiara lo `stadio`. Se era `strategico`, il recepimento chiude le
decisioni in `0.5. studio-strategico.md` e **prosegue da sé allo stadio tecnico nella stessa
esecuzione**, come il suo contratto prescrive: il blocco che torna porta allora `stadio: tecnico`
e una nuova lista di decisioni. Torni al punto 7 e le poni.

**Un solo giro in più.** Se anche il secondo blocco torna `strategico`, il problema non è pronto
per essere eseguito: fermati, riporta all'owner il verdetto e ciò che resta aperto, e lascia la
cartella com'è. Non c'è un terzo giro, e non si passa alla consegna con la direzione ancora in
discussione.

### 10. La consegna — `develop-feature`

Le decisioni tecniche sono chiuse: `1. decision-doc.md` esiste e le sue card hanno una risposta.
Delega la consegna intera a un subagent che esegue `skills/develop-feature/SKILL.md`, con la
cartella e la **soluzione scelta verbatim** — le opzioni che l'owner ha scelto, scritte come le ha
scritte lui. Per una card a cui non ha risposto vale la raccomandata, senza chiedere.

Da lì in poi la sequenza è sua e non la riscrivi qui: brief, esecuzione, review a giri, gate,
decisione, allineamento di memoria e documentazione, commit e merge. **Non lanciare tu
`blueprint`, `execute`, `/review` o `/commit`**: sono le sue fasi, e incatenarle da qui
significa tenerne due copie che divergono alla prima modifica.

L'esito atteso è il blocco che quel contratto dichiara nella propria § *Esito*, per intero.
Riportalo: il suo `status` è il tuo.

## Se un passo fallisce

Un passo è fallito quando il blocco non torna, torna incompleto o torna in prosa. Si rilancia
**una volta sola**, con lo stesso identico prompt (§4.2 di `contracts/orchestration.md`). Se non
torna neanche allora:

| Passo | Cosa ne segue |
|---|---|
| un fronte d'indagine | lo copri tu con una lettura mirata e lo dichiari nel documento |
| `study` | procedi **senza** quegli appunti, e nel documento marca `[da verificare]` i punti che dovevano coprire. Non scrivere a memoria i fatti che lo studio doveva portare: è esattamente ciò che si stava evitando |
| `decision-doc` (punto 6) | la catena si ferma. `0. problem.md` resta consegnato, e lo dici con il comando da lanciare a mano sulla cartella. **Non scrivere tu le decisioni**: porle qui significa scriverle fuori dal documento che le ospita |
| il recepimento (punto 8) | è il caso peggiore, perché le risposte dell'owner esistono solo in chat. Riportale **verbatim** nell'esito, insieme al comando con cui si recepiscono, e fermati |
| `develop-feature` (punto 10) | il suo blocco dichiara già i propri fallimenti: riportalo così com'è, senza reinterpretarlo |

## Vincoli operativi

- Rispetta i vincoli di runtime che `{instructions_file}` dichiara, e in ogni caso: **niente
  ricerche sull'intero filesystem**.
- **Non committare** e non fare push: il commit è della consegna, che gira sul proprio worktree.
- Fuori dalla cartella del problema si scrive solo in `{paths.lib_notes}/`, e ci scrive `study`.
- Usa **sempre path relativi alla root del repo** per i link ai file.
- Salva nella codifica del progetto, senza degradare i caratteri non ASCII.

## Esito

In chat, poche righe:

- il path della cartella aperta e i documenti che porta;
- le aree analizzate e i gap identificati;
- gli appunti prodotti o riusati, con versione e data, e cosa il riconfronto ha cambiato nel
  problema (o che non ha cambiato niente);
- gli stadi attraversati, le decisioni poste e la risposta ricevuta per ciascuna;
- l'esito della consegna: `status`, SHA del commit e del merge, e il path del report — il
  dettaglio è già lì dentro, **non ripeterlo**.

Se la catena si è fermata prima della consegna, dillo con il punto in cui si è fermata e il
comando con cui l'owner la riprende.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Questa libreria la conosco, salto lo studio» | È la frase che precede una firma inventata. Il criterio del punto 4 è una lista di condizioni, non una sensazione. |
| «Gli appunti sono tornati, li passo a valle e vado» | Il punto 5 non è un passaggio di consegne: sei tu che rimetti in discussione ciò che avevi scritto prima di conoscerli. |
| «Riassumo le decisioni, così l'owner legge meno» | Le decisioni si pongono verbatim. Ciò che tagli è esattamente ciò su cui non gli stai facendo scegliere. |
| «Chiedo conferma prima di lanciare la consegna» | Ha già risposto. La conferma in più è il gesto che questa skill esiste per togliergli. |
| «Faccio io il brief, tanto ho tutto in testa» | Averlo in testa è il problema: ogni fase è un subagent in contesto fresco, e la consegna è di `develop-feature`. |
| «Il decision-doc lo scrivo qui, è più veloce» | Il documento lo scrive il nodo che lo ospita. Scritto qui, nasce dentro il contesto che ha appena indagato — cioè già convinto. |
| «Lo stadio è ancora strategico ma la direzione mi è chiara: procedo» | Se fosse chiara, il passo `judge` non l'avrebbe fermata lì. Due giri, e poi ci si ferma. |
| «Uso il modello più grosso, questo passo mi sembra difficile» | Il modello viene dal ruolo dichiarato dal passo, risolto con la §2 di `contracts/orchestration.md`. |

## Regola di taglio

Questa skill possiede **l'apertura del lavoro**: la cartella, l'indagine sul codice, la decisione
di cosa studiare, il riconfronto, e il canale verso l'owner per le decisioni. Non possiede il
*contenuto* di ciò che delega: come si studia una tecnologia, come si studiano le decisioni, come
si consegna una feature vivono nei loro file, letti dai subagent a ogni esecuzione. Se ti
sorprendi a riscrivere qui *come* si fa un brief o *come* si sceglie fra due librerie, ti sei
allontanato dallo scopo.
