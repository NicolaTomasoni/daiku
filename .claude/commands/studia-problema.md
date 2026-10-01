---
description: 'Studia un problema di Daiku leggendo il pacchetto e i documenti di riferimento, produce 0. problem.md in .docs/features/<slug>/ e chiude delegando decision-doc su quella cartella'
argument-hint: '<descrizione problema>'
---

Studia un problema di Daiku leggendo il pacchetto e i documenti di riferimento, e producendo un
documento di analisi strutturato in `.docs/features/<slug>/0. problem.md`.

**La skill precede decision-doc, e lo chiama:** serve a capire e documentare un problema prima di
passare alle decisioni, e quando il documento è scritto passa il testimone a `decision-doc` su
subagent, sulla cartella appena aperta.

## Input: descrizione del problema

Argomenti: `$ARGUMENTS`

L'argomento è una **descrizione del problema** in linguaggio naturale. Può essere:

- una domanda concreta (es. «come si citano fra loro i contratti sui due host?»)
- un gap identificato (es. «`check-contratti.py` cerca il corpus nella cartella sbagliata»)
- una tensione (es. «due contratti dichiarano `CLAUDE.md` fonte canonica di una sezione che qui non
  esiste»)

Se `$ARGUMENTS` è vuoto, **chiedi** quale problema studiare.

## Prima di indagare: quattro documenti, in quest'ordine

Questo repository ha già scritto molto di sé, e un'indagine che lo ignora riscopre a proprie spese
prove già eseguite — o, peggio, chiude da sola una decisione che è dell'owner.

1. **`.docs/PUNTI-APERTI.md`** — le decisioni ancora da prendere. Se il tuo problema è uno di
   quei punti, **dillo in apertura del documento e non deciderlo**: il tuo mestiere è istruirlo,
   non chiuderlo.
2. **Le memorie sui due host** — cosa offrono, cosa accettano e rifiutano, come si installa e si
   aggiorna un pacchetto, con le prove eseguite sui validatori reali e la data. Un fatto che hanno
   già stabilito non è una tua scoperta; una prova che hanno già eseguito non si rifà a memoria.
3. **`CLAUDE.md`** — gli invarianti di chi sviluppa Daiku: la divisione fra prodotto e sviluppo, la
   regola di pubblicazione, come si verifica il pacchetto.
4. **`.docs/memory/MEMORY.md`** e le memorie che l'area del problema tocca. Se il chiamante te
   ne passa i path, sono quelli; altrimenti li scegli tu sull'indice. Un gap che una memoria ha già
   chiuso non è un gap, e un fatto che l'owner ha già accertato non si riapre qui.

## Le aree di questo progetto

Il problema va collocato. Le aree sono queste, e non sono backend e frontend:

| Area | Cosa ci sta dentro |
|---|---|
| **contratti** | `plugins/daiku/skills/**/SKILL.md` e `plugins/daiku/contratti/*.md` — il metodo in prosa: cosa va fatto, in che ordine, chi delega a chi |
| **host** | cosa Claude Code e Codex accettano davvero: manifest, marketplace, skill, agent, hook, invocazione, installazione |
| **impacchettamento** | `.claude-plugin/`, `.agents/`, i due `plugin.json`, la lista di copia dello script di rilascio, versione e distribuzione |
| **strumenti** | `plugins/daiku/hooks/lib/*.mjs` e `plugins/daiku/architect/*.mjs` — il codice eseguibile del pacchetto, con i suoi banchi `--self-check` |
| **progetto ospite** | `plugins/daiku/templates/` e tutto ciò che un `init` dovrebbe scrivere nel progetto di destinazione |

Un problema che non cade in nessuna di queste è un segnale: o è di sviluppo e non di prodotto
(allora non apre una cartella qui), o l'elenco è incompleto e va detto nel documento.

## Obiettivo del documento

Produrre un **unico file markdown** `.docs/features/<slug>/0. problem.md` che:

1. **Descrive il problema** in modo chiaro e circostanziato
2. **Documenta com'è fatto oggi** il pacchetto nell'area coinvolta
3. **Identifica i gap concreti** (cosa manca, cosa non funziona, cosa si contraddice)
4. **Evidenzia i trade-off e i dubbi** che il disegno dovrà sciogliere
5. **Delimita il confine** del problema (cosa NON è in scope)

Il documento **non propone soluzioni** — quelle arrivano in `1. decision-doc.md`, via
`decision-doc`.

## Procedura

### 1. Risolvi il problema e crea la cartella

1. **Analizza la descrizione** e identifica:
   - l'**area** fra quelle della tabella sopra;
   - i file da indagare, con path concreti (usa Grep/Glob/Read);
   - uno **slug** kebab-case per la cartella (es. `rimandi-fra-contratti`,
     `check-contratti-radice-sbagliata`).

2. **Crea la cartella** `.docs/features/<slug>/` se non esiste.
   - Verifica che non esista già una cartella con lo stesso slug.
   - Se esiste, chiedi conferma all'owner prima di sovrascrivere.

### 2. Indaga (fan-out mirato)

Lancia **subagent worker in parallelo** (ruolo e modo di lanciarli da `.claude/orchestration.md`),
**uno per taglio d'indagine**, scelti fra questi secondo l'area:

- **il testo dei contratti**: cosa dicono oggi, chi cita chi, quali rimandi puntano a file che non
  esistono più;
- **i fatti sugli host**: cosa il validatore reale accetta e rifiuta, cosa l'installazione fa
  davvero — con le prove eseguibili su questa macchina, non con la documentazione a memoria;
- **la forma del pacchetto**: manifest, vetrine, la lista di copia dello script di rilascio — è lei
  a decidere cosa esce, non più il `.gitignore`;
- **il codice eseguibile**: `hooks/lib/*.mjs`, `architect/*.mjs`, i loro `--self-check` e cosa
  contano davvero;
- **il confronto con le memorie sui due host**: cosa dichiarano sull'area, e se regge ancora.

Per ogni agente, specifica: i file da leggere (path concreti), l'obiettivo dell'analisi, il vincolo
di **sola lettura** ripetuto nel prompt, e la consegna (una sezione markdown pronta da incollare).

Lancia gli agenti in un solo messaggio e **appendi tu** i loro risultati al file. Se un taglio resta
scoperto o dubbio, fai tu una lettura mirata per colmarlo prima di chiudere il passaggio, e
dichiaralo nel documento.

**Dove una prova si può eseguire, eseguila.** Validare il pacchetto, lanciare un `--self-check`,
leggere lo schema del validatore Codex: sono comandi da secondi, e questo progetto è stato
costruito così. Un gap dimostrato da un esito verbatim vale dieci righe di ragionamento.

### 3. Scrivi il documento

Crea `.docs/features/<slug>/0. problem.md` con questa struttura:

```markdown
# <Titolo del problema> — il problema

> Descrizione del problema, senza soluzione. Indagine sul pacchetto.
>
> **Area.** <una delle cinque>
> **Contesto.** <riferimento a PUNTI-APERTI.md / memorie pertinenti>
> **Stato:** analisi al <data>.

---

## In una riga

[Cosa non funziona, cosa manca, perché è un problema ora: 2-3 frasi]

---

## Com'è fatto oggi

[Per ogni taglio indagato: come funziona oggi, quali file sono coinvolti, quali
pattern esistono. Cita sempre file e riga.]

---

## Perché questo diventa un problema (i gap)

[I gap concreti, numerati, ciascuno ancorato a un file:riga o a un esito eseguito]

---

## Trade-off e dubbi aperti

[Le tensioni che il disegno dovrà sciogliere, numerate, con le opzioni in gioco]

---

## Confine del problema (cosa NON è in scope qui)

- **Non** è oggetto di questo documento [...]
- **Non** si decide qui [...]
- **Non** si propone qui [...]
```

### 4. Rileggi e perfeziona

- Verifica che ogni affermazione sia ancorata a un file (path + riga) o a un esito eseguito.
- Rimuovi duplicazioni, correggi refusi, verifica che i link ai file siano corretti.
- Usa **sempre path relativi alla radice del repository**.
- Salva in **UTF-8** con gli accenti italiani intatti.

### 5. Passa il testimone a `decision-doc`

Il documento è scritto: la cartella del problema è aperta, e il passo che la legge è sempre lo
stesso. Lancialo tu, **sempre**, senza chiederlo all'owner — un rimando lasciato come promemoria in
chiusura è un passo che l'owner esegue a mano ricopiando il path, o non esegue.

**Nessun passaggio umano fra le due skill.** Fra la scrittura del documento e il lancio del subagent
non si torna in chat e non si chiede niente: la skill finisce quando il file è generato e la delega
è partita.

**Come delegare.** Un **subagent** in contesto fresco, ruolo **giudice** secondo
`.claude/orchestration.md` — leggilo e risolvi da lì il modello e il modo di lanciarlo, mai da qui.
Mai eseguire il passo inline. Il prompt dev'essere autosufficiente, perché il subagent parte da
zero:

- il **contratto da leggere**: `.claude/commands/decision-doc.md`, per intero, prima di agire,
  nella modalità *Da `studia-problema`* che quel file dichiara;
- l'**input risolto**: la cartella `.docs/features/<slug>/` e, dentro, il `0. problem.md`
  che hai appena scritto — è già il documento base, non c'è nulla da concatenare;
- i **documenti di riferimento**: `CLAUDE.md`, le memorie sui due host e, se il problema tocca
  una decisione già in lista, `.docs/PUNTI-APERTI.md`;
- la **memoria pertinente**: `.docs/memory/MEMORY.md` e i **path** delle memorie che hai aperto,
  con l'istruzione di aprirle prima di lavorare. Sono le stesse che hanno delimitato la tua
  indagine: senza, o le riapre da capo o riapre un fatto che l'owner ha già chiuso;
- il **vincolo di perimetro**: scrive solo dentro quella cartella, e non committa né fa push;
- il **formato di ritorno**: il blocco che quel contratto dichiara nella propria § *Modalità di
  invocazione*, per intero.

**Se il blocco non torna** — prosa al posto del JSON, blocco incompleto, subagent che non risponde
— il passo è fallito: lo rilanci **una volta sola**, con lo stesso identico prompt (§4.2 di
`.claude/orchestration.md`). Se non torna neanche allora, `0. problem.md` resta comunque
consegnato: dichiari nell'esito che lo stadio decisionale non è stato aperto e lasci all'owner il
comando da lanciare a mano sulla cartella. Non rifare tu il suo lavoro: le decisioni le pone quel
nodo, e porle qui significherebbe scriverle fuori dal file che le ospita.

**La Fase 4 non è sua.** Il recepimento delle risposte dell'owner è interattivo, e dentro un
subagent non esiste un canale per chiederle: lui si ferma alla lista di decisioni e te la
restituisce. Riportala in chat **verbatim**, e di' che si risponde rilanciando `decision-doc` sulla
cartella con le scelte in forma compatta (`1A, 2B, ...`) — è lì che vive la Fase 4.

## Vincoli operativi

- **Non scrivi mai sotto `plugins/`.** Indaghi il prodotto, non lo tocchi: la modifica è una
  consegna, e comincia dopo, da `decision-doc`.
- **Non committare** e non fare push.
- Lavora in autonomia end-to-end senza chiedere conferme, tranne nei due casi che questo file
  dichiara: `$ARGUMENTS` vuoto, e una cartella con lo stesso slug già esistente.

## Output finale

Riferisci in sintesi:

- il path del file prodotto e l'area in cui hai collocato il problema;
- i tagli d'indagine coperti e le prove che hai eseguito, con il loro esito;
- i gap identificati;
- se il problema tocca un punto di `.docs/PUNTI-APERTI.md`, **quale** — e che non l'hai deciso;
- l'esito della delega: lo stadio che `decision-doc` ha scelto e perché, il file che ha prodotto o
  aggiornato e, se ne è uscita una lista di decisioni, la lista **verbatim**, con l'invito a
  rispondere rilanciando `decision-doc` sulla cartella in forma compatta (`1A, 2B, ...`). Se la
  delega è fallita anche al secondo tentativo, dillo e indica il comando da lanciare a mano.
