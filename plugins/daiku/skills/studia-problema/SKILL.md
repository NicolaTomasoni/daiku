---
name: studia-problema
description: Studia un problema tecnico/architetturale leggendo il codice, produce 0. problem.md in docs/nuovi-sviluppi/<nome>/ e chiude delegando /decision-doc su quella cartella
argument-hint: <descrizione problema>
---

Studia un problema tecnico o architetturale leggendo il codice e producendo un documento di analisi strutturato in `docs/nuovi-sviluppi/<nome>/0. problem.md`.

**La skill precede decision-doc, e lo chiama:** serve a capire e documentare un problema prima di passare alle decisioni strategiche e tecniche, e quando il documento è scritto passa il testimone a `/decision-doc` su subagent, sulla cartella appena aperta.

## Input: descrizione del problema

Argomenti: `$ARGUMENTS`

L'argomento è una **descrizione del problema** in linguaggio naturale. Può essere:
- una domanda concreta (es. "come abilitiamo una chiave API nvidia nim che punta a GM 5.2?")
- un gap identificato (es. "manca il cablaggio tra X e Y")
- una tensione architetturale (es. "due componenti fanno la stessa cosa")

- Se `$ARGUMENTS` è vuoto, **chiedi** all'utente quale problema studiare.
- Apri `memory/MEMORY.md` e le memorie che l'area del problema tocca prima di indagare: è il canale di §4.1 di `.claude/orchestration.md`. Se il chiamante te ne passa già i path, sono quelli; altrimenti li scegli tu sull'indice. Un gap che una memoria ha già chiuso non è un gap, e un trade-off che l'owner ha già deciso non si riapre qui.
- Indaga sul codice per capire:
  - qual è l'area coinvolta (backend/frontend/integrazione/architettura)
  - come funziona oggi il sistema in quell'area
  - quali sono i gap/problemi
  - quali sono le trade-off e i dubbi aperti

## Obiettivo del documento

Produrre un **unico file markdown** `docs/nuovi-sviluppi/<slug>/0. problem.md` che:

1. **Descrive il problema** in modo chiaro e circostanziato
2. **Documenta come funziona oggi** il sistema nell'area coinvolta
3. **Identifica i gap concreti** (cosa manca, cosa non funziona, cosa è contradittorio)
4. **Evidenzia i trade-off e i dubbi** che dovranno essere risolti
5. **Delimita il confine** del problema (cosa NON è in scope)

Il documento **non propone soluzioni** — quelle arriveranno in `1. decision-doc.md` via `/decision-doc`.

## Procedura

### 1. Risolvi il problema e crea la cartella

1. **Analizza la descrizione** del problema e identificare:
   - l'area tecnica coinvolta (backend, frontend, adapter, service, UI)
   - i componenti/file da indagare ( usa Grep/Glob/Read)
   - un nome slug kebab-case per la cartella (es. `nvidia-nim-api-switch`, `subagent-fanout-codex`)

2. **Crea la cartella** `docs/nuovi-sviluppi/<slug>/` se non esiste.
   - Verifica che non esista già una cartella con lo stesso slug
   - Se esiste, chiedi conferma all'utente prima di sovrascrivere

### 2. Indaga sul codice (fan-out mirato)

Analizza il codice per capire come funziona oggi il sistema nell'area del problema. Lancia **subagent worker in parallelo** (ruolo e modello da `.claude/orchestration.md`), **uno per area**, con:

- **Backend:** services, adapters, models, API routes
- **Frontend:** features, components, API client, domain models
- **Config/runtime:** settings, environment, startup
- **Architettura:** flussi, hard rules, layer coinvolti

Per ogni agente, specifica:
- i file da leggere (path concreti)
- l'obiettivo dell'analisi (capire come funziona X, identificare gap in Y)
- la consegna (sezione markdown pronta da incollare)

Lancia gli agenti in un solo messaggio (girano concorrenti) e **appendi** i loro risultati al file. Se un'area resta scoperta o dubbia, fai tu una lettura mirata del codice per colmarla prima di chiudere il passaggio, e dichiaralo nel documento.

### 3. Scrivi il documento

Crea `docs/nuovi-sviluppi/<slug>/0. problem.md` con questa struttura:

```markdown
# <Titolo del problema> — il problema

> Descrizione del problema, senza soluzione. Indagine sul codice.
>
> **Contesto.** [eventuale contesto più ampio o riferimento ad altri documenti]
> **Stato:** analisi sul codice al <data>.

---

## In una riga

[Riassunto del problema in 2-3 frasi: cosa non funziona, cosa manca, perché è un problema ora]

---

## Com'è fatto oggi il livello "X"

[Per ogni area coinvolta (backend, frontend, config, etc.) descrivi:
- come funziona oggi il sistema
- quali componenti sono coinvolti
- quali sono i pattern esistenti
- cita file e linee di codice specifiche]

---

## Perché questo diventa un problema (i gap)

[Identifica i gap concreti che rendono il problema tale:
1. Gap 1 — descrizione
2. Gap 2 — descrizione
...]

---

## Trade-off e dubbi aperti

[Le tensioni che il disegno dovrà sciogliere:
1. Tensione 1 — descrizione delle opzioni
2. Tensione 2 — descrizione delle opzioni
...]

---

## Confine del problema (cosa NON è in scope qui)

- **Non** è oggetto di questo documento [...]
- **Non** si decide qui [...]
- **Non** si propone qui [...]
```

### 4. Rileggi e perfeziona

- Verifica che ogni affermazione sia ancorata al codice (file + linee)
- Rimuovi duplicazioni
- Correggi refusi e imprecisioni
- Verifica che i link ai file siano corretti

### 5. Passa il testimone a `/decision-doc`

Il documento è scritto: la cartella del problema è aperta, e il passo che la legge è sempre lo
stesso. Lancialo tu, **sempre**, senza chiederlo all'owner — un `/decision-doc` lasciato come
promemoria in chiusura è un passo che l'owner esegue a mano ricopiando il path, o non esegue.

**Nessun passaggio umano fra le due skill.** Fra la scrittura del documento e il lancio del
subagent non si torna in chat e non si chiede niente: la skill finisce quando il file è
generato e la delega è partita. L'esito si riporta quando il subagent torna, secondo
§ *Output finale*; se il blocco non torna neanche al rilancio, vale il capoverso sopra e la
skill chiude comunque sul documento scritto.

**Come delegare.** Un **subagent** in contesto fresco, ruolo **giudice** secondo
`.claude/orchestration.md` — leggilo e risolvi da lì il modello e il modo di lanciarlo, mai da
qui. Mai eseguire il passo inline. Il prompt dev'essere autosufficiente, perché il subagent parte
da zero:

- il **contratto da leggere**: `.claude/commands/deliver-feature/decision-doc.md`, per intero, prima di agire, nella modalità *Da `studia-problema`* che quel file dichiara;
- l'**input risolto**: la cartella `docs/nuovi-sviluppi/<slug>/` e, dentro, il `0. problem.md` che hai appena scritto — è già il documento base del problema, non c'è nulla da concatenare;
- la **memoria pertinente**: `memory/MEMORY.md` e i **path** delle memorie che hai aperto al punto 1, con l'istruzione di aprirle prima di lavorare. Sono le stesse che hanno delimitato la tua indagine: senza, o le riapre da capo o riapre una decisione che l'owner ha già chiuso;
- il **vincolo di perimetro**: scrive solo dentro quella cartella, e non committa né fa push;
- il **formato di ritorno**: il blocco che quel contratto dichiara nella propria § *Modalità di invocazione*, per intero.

**Se il blocco non torna** — prosa al posto del JSON, blocco incompleto, subagent che non risponde
— il passo è fallito: lo rilanci **una volta sola**, con lo stesso identico prompt (§4.2 di
`.claude/orchestration.md`). Se non torna neanche allora, `0. problem.md` resta comunque
consegnato: dichiari nell'esito che lo stadio decisionale non è stato aperto e lasci all'owner il
comando da lanciare a mano sulla cartella. Non rifare tu il suo lavoro: le decisioni le pone quel
nodo, e porle qui significherebbe scriverle fuori dal file che le ospita.

**La Fase 4 non è sua.** Il recepimento delle risposte dell'owner è interattivo, e dentro un
subagent non esiste un canale per chiederle: lui si ferma alla lista di decisioni e te la
restituisce. Riportala in chat **verbatim**, e di' che si risponde rilanciando `/decision-doc`
sulla cartella con le scelte in forma compatta (`1A, 2B, ...`) — è lì che vive la Fase 4.

## Vincoli operativi

- Rispetta le regole runtime del `CLAUDE.md`: **niente ricerche sull'intero filesystem**
- **Non committare** e non fare push
- Lavora in autonomia end-to-end senza chiedere conferme, tranne nei due casi che questo file dichiara: `$ARGUMENTS` vuoto, e una cartella con lo stesso slug già esistente
- Usa **sempre path relativi alla root del repo** per i link ai file
- Salva in **UTF-8** con gli accenti italiani intatti

## Output finale

Riferisci in sintesi:
- il path del file prodotto
- le aree analizzate
- i gap identificati
- l'esito della delega: lo stadio che `/decision-doc` ha scelto e perché, il file che ha prodotto o
  aggiornato e, se ne è uscita una lista di decisioni, la lista **verbatim**, con l'invito a
  rispondere rilanciando `/decision-doc` sulla cartella in forma compatta (`1A, 2B, ...`). Se la
  delega è fallita anche al secondo tentativo, dillo e indica il comando da lanciare a mano.

