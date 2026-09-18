---
name: sync-hooks
description: 'Installa e riallinea i guardrail di Daiku nello strato dell''host del progetto. Su Codex scrive `.codex/hooks/` e `.codex/hooks.json`, perché lì un pacchetto non può trasportare hook; su Claude Code non c''è niente da fare e lo dichiara. Si rilancia a ogni aggiornamento del pacchetto.'
argument-hint: '[radice tecnica, opzionale — default: la directory corrente]'
---

Sei il passo che porta i **guardrail** di Daiku dentro un progetto, sull'host che non sa
riceverli da solo. Non tocchi i parametri e non tocchi il dominio: quelli sono di `init`. Tocchi
una cosa sola — gli hook — e la tocchi in modo che chi la riceve sappia esattamente cosa gli è
comparso sul disco e cosa deve approvare perché parta.

Sei **rilanciabile per disegno**, ed è la differenza con `init`: lì il valore è non sovrascrivere,
qui il valore è riallineare. Un hook vecchio di tre versioni non è un file da rispettare, è un
guardrail che non sa più cosa sorvegliare.

## Perché esisti

`plugin_hooks` è una feature **rimossa** su Codex: `codex features list` la dichiara `removed`,
e il validatore del manifest rifiuta la chiave `hooks`. Un pacchetto Codex non trasporta hook,
punto. Gli hook di Codex esistono e funzionano — `hooks stable true` — ma solo dichiarati fuori
dal pacchetto, in `<repo>/.codex/hooks.json` o `~/.codex/hooks.json`.

E nessuno dei due host lascia che un pacchetto scriva nel progetto dell'utente. Quindi l'unica
via è un comando che l'utente lancia. Quel comando sei tu.

Su **Claude Code** niente di tutto questo serve: `plugin.json` dichiara `hooks`, il pacchetto li
porta e l'aggiornamento li aggiorna da solo.

## Il contratto è lo stesso sui due host

Non riscrivi gli hook per Codex e non ne tieni due versioni. I due host hanno lo stesso identico
contratto — stessa forma di `hooks.json`, stesso JSON su stdin, stesso
`hookSpecificOutput.permissionDecision` per negare, stessi nomi di evento per i tre che servono —
quindi i `.mjs` del pacchetto girano su Codex **come sono**.

Diverge una cosa sola, ed è la ragione per cui non basta copiare:

**Un hook di Codex non riceve nessuna variabile che punti al progetto.** Claude Code esporta
`CLAUDE_PROJECT_DIR` e `CLAUDE_PLUGIN_ROOT`; Codex ha `PLUGIN_ROOT` e `PLUGIN_DATA` (con gli alias
`CLAUDE_*`), ma puntano al **pacchetto installato** e per un hook dichiarato in `.codex/hooks.json`
non sono nemmeno impostati. Resta la cwd della sessione, che non è la radice se l'utente ha aperto
Codex in una sottocartella.

Per questo i `.mjs` risalgono alla git root — lo fa `hooks/lib/project-root.mjs` — e per questo
**il path nel `command` dev'essere assoluto**, scritto da te al momento dell'installazione.

## Perché i `.mjs` si copiano, e non si punta al pacchetto

Puntare alla cache del pacchetto sembra più furbo: si aggiornerebbero da soli. Non funziona. Il
path della cache contiene la **versione**, quindi si rompe al primo aggiornamento — e si rompe in
silenzio, perché un hook che non parte è indistinguibile da un hook che non ha niente da dire.

Quindi si copiano nel progetto, e il prezzo è che il riallineamento è un gesto: questo.

## Input

Argomenti: `$ARGUMENTS` — `[radice tecnica]`.

Con un argomento, è quella. Senza, è la directory corrente. Dev'essere dentro un repository Git:
se non lo è, fermati e dillo — non inizializzi un repository al posto dell'utente.

## Procedura

### 1. Riconosci l'host

Lo sai da dove stai girando: non chiederlo.

Su **Claude Code**: non scrivi niente. Dichiara che il pacchetto porta già i tre hook, che si
aggiornano con lui, e che per questo progetto non c'è nessun gesto da fare. Chiudi qui. Non
copiare `templates/claude/settings.json`: aggancerebbe gli stessi tre hook una seconda volta, per
una via che su Claude Code non serve, e l'utente si ritroverebbe ogni guardia eseguita due volte.

Su **Codex**: prosegui.

### 2. Verifica che gli hook siano accesi

Leggi `codex features list` e cerca la riga `hooks`. Se non è `true`, gli hook che scrivi non
partiranno: scrivili lo stesso — l'utente può accenderli — ma **apri il referto con questo**, non
chiuderlo. Un guardrail che c'è e non gira è peggio di uno assente, perché sembra esserci.

Se il comando non è disponibile o non risponde, non bloccarti: dichiara che non hai potuto
verificarlo.

### 3. Trova gli hook nel pacchetto

Stanno in `hooks/lib/`, nella radice del pacchetto — la cartella che contiene `skills/`,
`contracts/`, `hooks/` e `templates/`, due livelli sopra questo file. È un path **relativo al
pacchetto**: vale su entrambi gli host, mentre una variabile d'ambiente di path esiste solo su
uno dei due.

Copi **tutti** i `.mjs` che trovi lì, non un elenco che tieni a mente. Se il pacchetto ne porta
uno nuovo, dev'essere sufficiente rilanciarti: un elenco cablato qui lo lascerebbe indietro in
silenzio. Fra questi c'è `project-root.mjs`, che non è un hook ma è importato dagli altri tre —
se lo salti, nessuno parte.

### 4. Prova ogni hook prima di agganciarlo

Per ciascun `.mjs` che è un hook, lancia `node <file> --self-check` e leggi il JSON che stampa.

- `falliti` vuoto → l'hook è sano, procedi.
- `falliti` non vuoto → **non agganciarlo**. Copialo pure, ma lascialo fuori da `hooks.json` e
  riportane i casi rossi nel referto.
- Niente uscita, o uscita non parsabile → trattalo come rosso. `project-root.mjs` non ha banco e
  non è un hook: si copia e basta.

Questo passo esiste perché i tre hook sono **fail-open**: davanti a un guasto tacciono ed escono
0. Un hook rotto e un hook che non ha niente da dire si assomigliano troppo perché ci si possa
fidare senza il banco.

### 5. Scrivi `.codex/hooks/`

Copia i `.mjs` in `<radice>/.codex/hooks/`, **sovrascrivendo** quelli che ci sono. Non conservare
le versioni vecchie e non rinominarle di lato: un file `command-guard.vecchio.mjs` che resta lì
è un hook che qualcuno rimetterà in servizio senza sapere cosa fa.

Se un file sul disco è **diverso** da quello del pacchetto, annota il nome: serve al referto,
perché è quel file a far ripartire l'approvazione al passo 7.

### 6. Scrivi `.codex/hooks.json`

Parti da `templates/codex/hooks.json`, che è lo scheletro, e sostituisci ogni `{RADICE}` con il
path assoluto della radice tecnica, **con le barre in avanti** anche su Windows.

Poi togli dai tre eventi gli hook che il passo 4 ha trovato rossi. Se ne restano zero, non
scrivere un `hooks.json` con eventi vuoti: non scriverlo affatto, e dillo nel referto.

Se esiste già un `.codex/hooks.json` che contiene hook **non di Daiku**, non buttarli: aggiungi i
tuoi ai suoi eventi e conserva il resto. Sono dell'utente, e questo file è suo prima che tuo.

### 7. Referto

Chiudi con l'elenco, senza abbellimenti:

- **Copiato** — ogni `.mjs` scritto, e per ciascuno se era assente, identico o diverso.
- **Agganciato** — quali hook sono finiti in `hooks.json`, su quale evento.
- **Non agganciato** — ogni hook lasciato fuori, col perché e coi casi rossi del suo banco.
- **Cosa deve fare l'utente adesso** — ed è il blocco che non puoi omettere, perché senza di
  esso non parte niente:

  1. **Approvare gli hook**: `/hooks` dentro Codex, che mostra le sorgenti e permette di
     fidarsene. Codex registra la fiducia sull'**hash** del file: gli hook nuovi o cambiati
     restano segnati per revisione e **vengono saltati finché non sono approvati**. È per questo
     che il passo 5 annota quali file sono cambiati — sono esattamente quelli che torneranno a
     chiedere.
  2. **Fidarsi del progetto**, se non lo è già: gli hook di `<repo>/.codex/` caricano solo quando
     quel layer è trusted. Gli hook utente non hanno questo vincolo, quelli di progetto sì.

  Dillo come due gesti da fare, non come una nota a piè di pagina. Un utente che salta il primo
  vede un'installazione riuscita e nessun guardrail attivo.

Se hai rilanciato su un progetto già a posto e non è cambiato niente, dillo in una riga sola.

## Cosa non fai

- **Non tocchi `.daiku/`**: parametri e dominio sono di `init`. Se manca, non lo scrivi tu —
  segnalalo e basta.
- **Non tocchi il codice**, mai.
- **Non scrivi hook a livello utente** in `~/.codex/`. Quella sede vale per tutti i progetti
  dell'utente, e i guardrail di Daiku sono di **questo** progetto: parlano di `.daiku/`, di
  worktree e di contratti che altrove non esistono. Se l'utente li vuole globali, è una sua
  decisione e la prende lui.
- **Non fai commit** e non fai staging di quello che hai scritto: chi ti ha lanciato guarda cosa
  è comparso prima di versionarlo. Segnala però che `.codex/hooks/` porta codice eseguibile, e
  che va versionato o ignorato con intenzione — non lasciato a metà.
- **Non modifichi `config.toml`**. Codex accetta gli hook anche inline lì dentro, ma quel file
  porta molto altro ed è dell'utente: un `hooks.json` a parte si legge, si diffa e si toglie
  senza toccare nient'altro.
