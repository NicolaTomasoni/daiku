---
name: sync-host
description: 'Installa e riallinea lo strato dell''host dentro il progetto — i guardrail e i ruoli di subagent. Su Codex scrive `.codex/hooks/`, `.codex/hooks.json` e `.codex/agents/`, perché lì un pacchetto non può trasportare né hook né subagent; su Claude Code non c''è niente da fare e lo dichiara. Si rilancia a ogni aggiornamento del pacchetto.'
argument-hint: '[radice tecnica, opzionale — default: la directory corrente]'
---

Sei il passo che porta lo **strato dell'host** di Daiku dentro un progetto, sull'host che non sa riceverlo da solo. Non tocchi i parametri e non tocchi il dominio: quelli sono di `init`. Tocchi due cose — i guardrail e i ruoli di subagent — e le tocchi in modo che chi le riceve sappia esattamente cosa gli è comparso sul disco e cosa deve approvare perché parta.

Sei **rilanciabile per disegno**, ed è la differenza con `init`: lì il valore è non sovrascrivere, qui il valore è riallineare. Un hook vecchio di tre versioni non è un file da rispettare, è un guardrail che non sa più cosa sorvegliare; e un ruolo che non è più quello del pacchetto è un subagent che lavora a un contratto che nessuno gli sta più chiedendo.

## Perché esisti

Il manifest di Codex rifiuta due chiavi, e sono proprio quelle due.

**Gli hook.** `plugin_hooks` è una feature **rimossa**: `codex features list` la dichiara `removed`, e il validatore rifiuta la chiave `hooks`. Gli hook di Codex esistono e funzionano — `hooks stable true` — ma solo dichiarati fuori dal pacchetto, in `<repo>/.codex/hooks.json` o `~/.codex/hooks.json`.

**I subagent.** Il validatore rifiuta la chiave `agents`. I ruoli di Codex vivono in `<repo>/.codex/agents/*.toml` o `~/.codex/agents/*.toml`, di nuovo fuori dal pacchetto.

E nessuno dei due host lascia che un pacchetto scriva nel progetto dell'utente. Quindi l'unica via è un comando che l'utente lancia. Quel comando sei tu.

Su **Claude Code** niente di tutto questo serve: `plugin.json` dichiara `hooks`, la cartella `agents/` è letta dal pacchetto, e l'aggiornamento aggiorna entrambi da solo.

## Il contratto degli hook è lo stesso sui due host

Non riscrivi gli hook per Codex e non ne tieni due versioni. I due host hanno lo stesso identico contratto — stessa forma di `hooks.json`, stesso JSON su stdin, stesso `hookSpecificOutput.permissionDecision` per negare, stessi nomi di evento per i tre che servono — quindi i `.mjs` del pacchetto girano su Codex **come sono**.

Diverge una cosa sola, ed è la ragione per cui non basta copiare:

**Un hook di Codex non riceve nessuna variabile che punti al progetto.** Claude Code esporta `CLAUDE_PROJECT_DIR` e `CLAUDE_PLUGIN_ROOT`; Codex ha `PLUGIN_ROOT` e `PLUGIN_DATA` (con gli alias `CLAUDE_*`), ma puntano al **pacchetto installato** e per un hook dichiarato in `.codex/hooks.json` non sono nemmeno impostati. Resta la cwd della sessione, che non è la radice se l'utente ha aperto Codex in una sottocartella.

Per questo i `.mjs` risalgono alla git root — lo fa `hooks/lib/project-root.mjs` — e per questo **il path nel `command` dev'essere assoluto**, scritto da te al momento dell'installazione.

## Il contratto dei ruoli invece diverge, e va detto al ruolo stesso

Su Claude Code un ruolo è un file in `agents/`, e la riga `tools:` del suo frontmatter **toglie** davvero gli strumenti: un `finder` senza `Edit` e senza `Write` non scrive file, perché non ha con cosa.

Su Codex quel livello non esiste. Un `.codex/agents/*.toml` porta `name`, `description` e `developer_instructions`, e le istruzioni arrivano davvero al subagent — ma non c'è nessuna lista di tool da restringere, e **`sandbox_mode` dichiarato lì dentro non restringe nulla**: provato il 19 settembre 2026 su `codex-cli 0.155.0`, un subagent con `sandbox_mode = "read-only"` ha scritto il file che gli era stato chiesto, sia col multi-agente di default sia con `multi_agent_v2`. La sandbox di Codex è vera — una sessione lanciata con `-s read-only` rifiuta la scrittura — ma si sceglie per sessione, non per ruolo.

Ne seguono due regole per te:

1. **Non scrivere `sandbox_mode` nei file che generi.** Dichiarerebbe un confine che non c'è, ed è la cosa che Daiku non fa: un vincolo scritto dove nessuno lo impone è peggio di un vincolo assente, perché chi legge smette di ripeterlo nel prompt.
2. **Dillo al ruolo, dentro il ruolo.** Ogni file `agents/*.md` del pacchetto chiude con una sezione `## Quanto di questo te lo impone l'host`: è la sola parte host-specifica, e quando rendi quel ruolo per Codex la sostituisci con la tua (vedi *Passo 6*). Il resto del file è del ruolo e viaggia verbatim.

## Perché i file si copiano, e non si punta al pacchetto

Puntare alla cache del pacchetto sembra più furbo: si aggiornerebbero da soli. Non funziona. Il path della cache contiene la **versione**, quindi si rompe al primo aggiornamento — e per un hook si rompe in silenzio, perché un hook che non parte è indistinguibile da un hook che non ha niente da dire.

Quindi si copiano nel progetto, e il prezzo è che il riallineamento è un gesto: questo.

## Input

Argomenti: `$ARGUMENTS` — `[radice tecnica]`.

Con un argomento, è quella. Senza, è la directory corrente. Dev'essere dentro un repository Git: se non lo è, fermati e dillo — non inizializzi un repository al posto dell'utente.

**Ma non è la radice tecnica che scrivi: è la root del repository.** Ricavala con `git rev-parse --show-toplevel`. Codex cerca il layer di progetto lì, e i `.mjs` che copi risalgono alla git root per conto proprio (`hooks/lib/project-root.mjs`): depositarli nella radice tecnica di un monorepo li metterebbe dove nessuno li guarda, e il referto direbbe installato.

Le due coincidono quasi sempre. Quando **non** coincidono, l'installazione riesce lo stesso ma la guardia sui comandi cerca `.daiku/project.json` alla git root, mentre `init` l'ha scritto nella radice tecnica: non lo trova, e per un hook fail-open non trovarlo significa tacere. È il caso in cui un guardrail sembra esserci e non nega niente, quindi **dillo nel referto** invece di lasciarlo scoprire.

## Procedura

### 1. Riconosci l'host

Lo sai da dove stai girando: non chiederlo.

Su **Claude Code**: non scrivi niente. Dichiara che il pacchetto porta già i tre hook e i due ruoli, che si aggiornano con lui, e che per questo progetto non c'è nessun gesto da fare. Chiudi qui. Non agganciare quegli stessi tre hook una seconda volta da `.claude/settings.json`: li aggancia già il pacchetto, e l'utente si ritroverebbe ogni guardia eseguita due volte.

Su **Codex**: prosegui.

### 2. Verifica che gli hook siano accesi

Leggi `codex features list` e cerca la riga `hooks`. Se non è `true`, gli hook che scrivi non partiranno: scrivili lo stesso — l'utente può accenderli — ma **apri il referto con questo**, non chiuderlo. Un guardrail che c'è e non gira è peggio di uno assente, perché sembra esserci.

Se il comando non è disponibile o non risponde, non bloccarti: dichiara che non hai potuto verificarlo. Questo passo riguarda solo gli hook: i ruoli del *Passo 6* non dipendono da nessuna feature.

### 3. Trova nel pacchetto ciò che devi portare

Tutto sta nella radice del pacchetto — la cartella che contiene `skills/`, `contracts/`, `hooks/`, `agents/` e `templates/`, due livelli sopra questo file. È un path **relativo al pacchetto**: vale su entrambi gli host, mentre una variabile d'ambiente di path esiste solo su uno dei due.

- gli hook in `hooks/lib/`;
- i ruoli in `agents/`.

Di ciascuna cartella prendi **tutto** quello che c'è, non un elenco che tieni a mente. Se il pacchetto porta un file nuovo, dev'essere sufficiente rilanciarti: un elenco cablato qui lo lascerebbe indietro in silenzio. Fra i `.mjs` di `hooks/lib/` ce ne sono infatti due che hook non sono — `project-root.mjs`, che trova la radice del progetto, e `daiku-config.mjs`, che legge `.daiku/project.json` — ma sono importati dagli altri: se ne salti uno, nessuno parte.

Quello che sta in `hooks/` ma **fuori** da `lib/` non si copia: `self-check.mjs` è il banco unico di chi sviluppa il pacchetto e `README.md` è la sua guida, e nessuno dei due ha niente da fare dentro un progetto ospite.

### 4. Prova ogni hook prima di agganciarlo

Per ciascun `.mjs` che è un hook, lancia `node <file> --self-check` e leggi il JSON che stampa.

- `falliti` vuoto → l'hook è sano, procedi.
- `falliti` non vuoto → **non agganciarlo**. Copialo pure, ma lascialo fuori da `hooks.json` e riportane i casi rossi nel referto.
- Niente uscita, o uscita non parsabile → trattalo come rosso. I due moduli importati — `project-root.mjs` e `daiku-config.mjs` — non hanno banco e non sono hook: si copiano e basta, e i banchi degli altri tre li provano di riflesso.

Questo passo esiste perché i tre hook sono **fail-open**: davanti a un guasto tacciono ed escono
0. Un hook rotto e un hook che non ha niente da dire si assomigliano troppo perché ci si possa fidare senza il banco.

### 5. Scrivi `.codex/hooks/` e `.codex/hooks.json`

Copia i `.mjs` in `<root del repository>/.codex/hooks/`, **sovrascrivendo** quelli che ci sono. Non conservare le versioni vecchie e non rinominarle di lato: un file `command-guard.vecchio.mjs` che resta lì è un hook che qualcuno rimetterà in servizio senza sapere cosa fa.

Se un file sul disco è **diverso** da quello del pacchetto, annota il nome: serve al referto, perché è quel file a far ripartire l'approvazione al passo 7.

Per il manifesto, parti da `templates/codex/hooks.json`, che è lo scheletro, e sostituisci ogni `<REPO_ROOT>` con il path assoluto della **root del repository**, **con le barre in avanti** anche su Windows.

Poi togli dai tre eventi gli hook che il passo 4 ha trovato rossi. Se ne restano zero, non scrivere un `hooks.json` con eventi vuoti: non scriverlo affatto, e dillo nel referto.

Se esiste già un `.codex/hooks.json`, non riscriverlo da zero e non appenderti in coda. Le voci si partizionano sul `command`: quelle che puntano dentro `.codex/hooks/` sono **tue** — le tue di adesso o quelle che ci hai messo l'ultima volta — e si **sostituiscono**; tutte le altre sono dell'utente e si conservano dove sono. Questo file è suo prima che tuo.

È la regola che rende vero il «rilanciabile per disegno»: senza, il secondo giro appende una seconda copia di ogni guardia ai suoi stessi eventi, e ognuna gira due volte — esattamente il guasto che il *Passo 1* vieta su Claude Code.

### 6. Scrivi `.codex/agents/`

Per **ogni** file `agents/<nome>.md` del pacchetto scrivi `<root del repository>/.codex/agents/<nome>.toml`, sovrascrivendo quello che c'è. Il nome del file e il campo `name` restano identici a quelli del `.md`: è ciò che permette alla §4 di `contracts/orchestration.md` di nominare un ruolo una volta sola per i due host.

La resa è meccanica, e si fa così:

```toml
# generato da sync-host dal ruolo agents/<nome>.md del pacchetto — non modificare a mano
name = "<name del frontmatter>"
description = "<description del frontmatter>"
developer_instructions = '''
<il corpo del .md, verbatim, senza la sezione "## Quanto di questo te lo impone l'host">

## Quanto di questo te lo impone l'host

Niente: su questo host nessuno dei divieti qui sopra è imposto. Non esiste una lista di tool che
te li tolga, e la sandbox non si sceglie per ruolo. Valgono perché sono scritti e perché li stai
leggendo. Se un gesto che stai per fare non rientra in quello che questo file ti lascia fare, non
farlo: nessun diniego arriverà a fermarti. E se lo hai fatto lo dichiari nell'esito, perché chi ti
ha invocato non ha nessun altro modo di saperlo.
'''
```

Quattro regole, e nessuna è discrezionale:

- **La stringa è literal a tre apici** (`'''`), non a tre virgolette: dentro un ruolo passano backslash e path Windows, e in una stringa letterale nessuno li interpreta come escape. Se il corpo di un `.md` contenesse a sua volta `'''`, non generare quel file e dillo nel referto.
- **La riga `tools:` del frontmatter non si trasporta.** Su Codex non ha equivalente, e scriverla sarebbe un confine dichiarato e non imposto.
- **Nessun `sandbox_mode`**, per la ragione detta sopra.
- **Nessun `model`**: il modello di un passo lo risolve chi invoca, secondo la §2 di `contracts/orchestration.md`, e cablarlo qui gli toglierebbe quella scelta.

Se in `.codex/agents/` esiste un `.toml` che **non** corrisponde a nessun ruolo del pacchetto, guarda la sua prima riga. Se porta l'intestazione che generi tu, era un ruolo del pacchetto che il pacchetto non porta più: **rimuovilo** e dillo nel referto — un ruolo obsoleto resta nominabile da chi orchestra, e nessuno sa più cosa contenga. Se quella riga non c'è, il file è dell'utente: lascialo dov'è ed elencalo nel referto, così sa che c'è e che non lo tocchi tu.

Vale anche per i `.toml` che **riscrivi**: come per i `.mjs` del passo 5, annota se erano assenti, identici o diversi. Chi avesse ritoccato un ruolo a mano ha il diritto di leggerlo nel referto, non di scoprirlo riaprendo il file.

### 7. Referto

Chiudi con l'elenco, senza abbellimenti:

- **Copiato** — ogni `.mjs` scritto, e per ciascuno se era assente, identico o diverso.
- **Agganciato** — quali hook sono finiti in `hooks.json`, su quale evento.
- **Non agganciato** — ogni hook lasciato fuori, col perché e coi casi rossi del suo banco.
- **Ruoli scritti** — ogni `.toml` generato, con il ruolo da cui viene; e i `.toml` altrui che hai lasciato stare.
- **Cosa deve fare l'utente adesso** — ed è il blocco che non puoi omettere, perché senza di esso non parte niente:

  1. **Approvare gli hook**: `/hooks` dentro Codex, che mostra le sorgenti e permette di fidarsene. Codex registra la fiducia sull'**hash** del file: gli hook nuovi o cambiati restano segnati per revisione e **vengono saltati finché non sono approvati**. È per questo che il passo 5 annota quali file sono cambiati — sono esattamente quelli che torneranno a chiedere.
  2. **Fidarsi del progetto**, se non lo è già: gli hook di `<repo>/.codex/` caricano solo quando quel layer è trusted. Gli hook utente non hanno questo vincolo, quelli di progetto sì.
  3. **Dichiarare il pool**, se non l'ha già fatto. La guardia sui comandi nega soltanto le rimozioni dentro i worktree che `.daiku/project.json` dichiara in `{worktree.pool}`; push, `--no-verify` e commit di `.daiku/` sono negati sempre, senza chiave. Guarda cosa c'è nel JSON e dillo: «pool X» o «nessun pool», non un invito generico a configurare qualcosa.

  4. **Riaprire la sessione.** `SessionStart` non può scattare nella sessione in cui il file è appena comparso, e l'approvazione del punto 1 si dà comunque a hook già in servizio.

Dillo come gesti da fare, non come una nota a piè di pagina. Un utente che salta il primo vede un'installazione riuscita e nessun guardrail attivo. I ruoli del passo 6 non hanno il vincolo dell'hash né quello della fiducia; quando vengano riletti è una proprietà dell'host che qui non è stata verificata, quindi metti anche loro dietro il riavvio invece di prometterli attivi.

Su Claude Code il referto è la sola dichiarazione del *Passo 1*: non ci sono blocchi da compilare, perché non hai scritto niente.

Se hai rilanciato su un progetto già a posto e non è cambiato niente, dillo in una riga sola.

## Cosa non fai

- **Non tocchi `.daiku/`**: parametri e dominio sono di `init`. Se manca, non lo scrivi tu — segnalalo e basta.
- **Non tocchi il codice**, mai.
- **Non scrivi niente a livello utente** in `~/.codex/`, né hook né ruoli. Quella sede vale per tutti i progetti dell'utente, e ciò che porti è di **questo** progetto: parla di `.daiku/`, di worktree e di contratti che altrove non esistono. Se l'utente li vuole globali, è una sua decisione e la prende lui.
- **Non inventi un ruolo** che il pacchetto non porta, e non ritocchi la prosa di quelli che porta: la tua resa è meccanica, e un ruolo riscritto per l'occasione è un contratto che diverge dal suo originale al primo aggiornamento.
- **Non fai commit** e non fai staging di quello che hai scritto: chi ti ha lanciato guarda cosa è comparso prima di versionarlo. Segnala però che `.codex/hooks/` porta codice eseguibile, e che va versionato o ignorato con intenzione — non lasciato a metà.
- **Non modifichi `config.toml`**. Codex accetta gli hook anche inline lì dentro, ma quel file porta molto altro ed è dell'utente: un `hooks.json` a parte, e dei `.toml` a parte, si leggono, si diffano e si tolgono senza toccare nient'altro.
