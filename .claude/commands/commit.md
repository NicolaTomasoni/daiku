---
description: 'Crea commit seguendo la convenzione di naming — allinea sempre prima gli artefatti di sviluppo al diff staged delegando a update-memory, controlla che i due manifest portino la stessa versione, poi committa in gruppi separati: codice, memoria e documentazione, versione. Mai push.'
argument-hint: '[file o perimetro, opzionale — default: lo stage corrente]'
---

Crea commit dei file indicati. Se non ne vengono indicati, committa lo stage corrente. **Mai**
`git push`.

## Cosa è committabile in questo repository

Il `.gitignore` esclude **soltanto** `.claude/settings.local.json`, che non deve stare in nessun git.
**Tutto il resto è nell'indice**, prodotto e sviluppo insieme: `CLAUDE.md`, `sviluppo/`, `.claude/`,
`.vscode/`.

Il confine di ciò che si pubblica **non passa da qui**, ed è per questo che il file è così corto:
chi aggiunge il marketplace riceve un clone dell'**intero** repository — lo schema di Claude Code lo
dice alla voce `sparsePaths`, «If omitted, the full repository is cloned» — quindi il filtro non può
stare in un `.gitignore`. Sta nella lista di copia dello script di pubblicazione, che prende i soli
path ammessi e li committa in un **secondo** repository su GitHub (`CLAUDE.md`, § *Due repository*).

Ne segue che **qui i gruppi di commit sono tre, come nel prodotto**, e che il terzo esiste dal 18
settembre 2026.

| Gruppo | Cosa | Committabile |
|---|---|---|
| **codice** | tutto ciò che il diff tocca sotto `plugins/`, più le due vetrine in radice se le tocca | sì |
| **memoria e documentazione** | `CLAUDE.md`, `sviluppo/**`, `.claude/**` — tutto il cantiere: memoria, ricognizione, punti aperti, contratti di sviluppo, registro delle consegne | sì, in un commit proprio |
| **versione** | `plugins/daiku/.claude-plugin/plugin.json` e `plugins/daiku/.codex-plugin/plugin.json`, quando il numero cambia | sì, in un commit proprio |

Il gruppo memoria/documentazione **si committa**, e in un commit proprio: raccoglie ciò che
`update-memory` ha appena scritto — vedi § *Allineamento*. Non lo si mescola al gruppo codice: un
diff di prodotto e il racconto che lo spiega sono due cose, e chi cerca il secondo non guarda il
primo.

> Un contratto di questo corpus che dica che il suo perimetro è fuori dall'indice, o che il gruppo
> memoria/documentazione non si committa, è un difetto da correggere (`.claude/orchestration.md`
> §8).

## Convenzione

| Tipo | Quando usarlo |
|---|---|
| `feat` | una capacità nuova del pacchetto: un contratto nuovo, una fase nuova, un hook nuovo |
| `fix` | correzione di un difetto: un rimando rotto, una chiave che un validatore rifiuta, un bug in un `.mjs` o in un `.py` |
| `refactor` | riorganizzazione che non cambia cosa il pacchetto fa: un contratto riscritto a parità di prescrizioni, file spostati |
| `docs` | `README.md` del pacchetto, prosa che spiega e non prescrive |
| `chore` | manutenzione che non cambia il comportamento |
| `build` | manifest, vetrine, versione, distribuzione |
| `style` | formattazione, spazi, senza cambi di merito |
| `test` | banchi `--self-check` e verifiche |
| `revert` | annullamento di un commit precedente |

**Formato:** `tipo(scope opzionale): descrizione breve in minuscolo, imperativo, max 72 caratteri`

Gli scope naturali di questo repository sono le sedi: `skills`, `contratti`, `hooks`, `tools`,
`templates`, `manifest`, `marketplace`.

**Descrizione:** descrivi solo il contenuto delle modifiche (cosa cambia), mai il nome dello
sviluppo o della cartella di lavoro da cui viene.

- ❌ `feat(rimandi-fra-contratti): applica la decisione 2B`
- ✅ `feat(contratti): cita le skill per path invece che per nome`

**Corpo (opzionale):** elenca solo *cosa* è stato fatto, in bullet brevi. Niente prosa, niente
motivazioni.

Scrivi sempre in italiano, con parole chiave in inglese quando necessario.

## Allineamento

Prima di congelare il codice in un commit, gli artefatti di sviluppo vanno riallineati **sullo
stesso diff**. Nessuna consegna entra in un commit lasciando indietro ciò che la spiega. Questa
skill non replica quel contratto: lo **delega**.

**La delega è un passo obbligatorio, non una tua decisione.** Ciò che arriva fin qui ha già passato
il gate e la review: è lavoro deciso, e un lavoro deciso si porta dietro i propri artefatti. Delega
**sempre**, senza giudicare prima se il diff «se lo merita» — quel giudizio è di `update-memory`,
che ha come primo principio «nessun aggiornamento non giustificato» e restituisce `updated: false`
senza scrivere niente quando non c'è nulla da riflettere.

L'unica condizione che salta il passo non è un giudizio ma l'assenza dell'ingresso: **il gruppo
codice è vuoto**. Lì non c'è un diff su cui allineare.

**Non si chiede mai all'owner.** Né prima, come conferma, né dopo, come promemoria da eseguire a
mano. Un allineamento rimandato è un allineamento che non avviene.

**E qui pesa il doppio, per la ragione opposta a quella di ieri.** Ciò che `update-memory` scrive
finisce nel **gruppo memoria/documentazione**, che è un commit vero come quello di codice: se salti
la delega, quel gruppo non si riempie, e il fatto che il diff aveva reso falso resta falso in un file
che la prossima sessione leggerà credendoci. Non è un documento in meno: è una bugia in più, e qui
non c'è nessun altro passo che la raccolga.

**Come delegare.** Un **subagent** in contesto fresco, ruolo **giudice** secondo
`.claude/orchestration.md` — leggilo e risolvi da lì il modello, mai da qui. Mai eseguire il passo
inline. Il prompt dev'essere autosufficiente:

- il **contratto da leggere**: `.claude/commands/update-memory.md`, per intero, prima di agire;
- l'**input risolto**: il diff **in index** sotto `plugins/daiku/`
  (`git diff --cached --stat -- plugins/daiku/` e `git diff --cached -- plugins/daiku/`), che in
  questo momento è già in stage;
- il **vincolo di perimetro**: mai toccare file sotto `plugins/`, e mai toccare l'indice di git —
  quello è perimetro tuo;
- il **formato di ritorno**: il blocco JSON che quel contratto dichiara nella propria § *Procedura*,
  punto 7, per intero.

Non c'è nessun permesso di commit da concedere: in questo repository quel contratto non committa in
nessuna invocazione, e il suo `committed` è sempre `null`.

**Dopo la delega.** I file che ha toccato **non entrano in alcun commit**: riportane i path
nell'esito, così chi legge sa cosa è cambiato sul disco. Se `confirm_with_owner` non è vuoto,
**riportane le voci all'owner nell'esito finale**: sono fatti in conflitto lasciati intatti di
proposito, e qui non c'è nemmeno un commit dentro cui potrebbero nascondersi.

**Se il blocco non torna** — prosa al posto del JSON, blocco incompleto, subagent che non risponde —
il passo è fallito: lo rilanci **una volta sola**, con lo stesso identico prompt (§4.2 di
`.claude/orchestration.md`). Se non torna neanche allora, prosegui con il commit del codice e
**dichiara nell'esito che l'allineamento non è stato fatto su questo diff** — è l'unica cosa che
impedisce a un artefatto rimasto indietro di sembrare allineato.

## Versione

La versione del pacchetto vive in **due** file, e portano lo stesso numero:

- `plugins/daiku/.claude-plugin/plugin.json`, campo `version`
- `plugins/daiku/.codex-plugin/plugin.json`, campo `version`

**Il controllo che fai sempre**, a ogni invocazione, prima di committare: i due numeri coincidono?
Se il diff ne ha toccato uno solo, hai un gruppo versione con **un file di troppo e uno di meno**:
allinea l'altro nella stessa modifica, e dillo nell'esito. Due manifest che dichiarano versioni
diverse sono il difetto che nessuno vede finché un host non aggiorna e l'altro no.

**Il bump non è tuo, ed è una decisione dell'owner.** Nel prodotto questa skill decide da sé il bump
minor; qui no, e la ragione è specifica di un pacchetto distribuito: `version` è ciò che governa
l'aggiornamento su entrambi gli host — si bumpa e tutti tirano la versione nuova, non si bumpa e
nessuno aggiorna. Bumpare a ogni consegna trasformerebbe ogni correzione di un rimando in un
aggiornamento per chiunque abbia installato. Il bump si fa al rilascio, e lo decide l'owner.

Se una consegna ti sembra meritare un bump, **dillo nell'esito** e fermati lì.

Per provare il pacchetto in locale su Codex non serve bumpare: esiste il **cachebuster**, cioè il
suffisso dopo `+` nella versione del manifest, che si **rimpiazza** e non si accumula —
`0.1.0+codex.local-20260918-143000`. Poi si reinstalla e si apre un thread nuovo.

**Il changelog di questo pacchetto non esiste ancora.** Crearne uno significa aggiungere un file
sotto `plugins/`, cioè **pubblicarlo**, e questa è una decisione che questo contratto non prende da
solo. Finché non esiste, non c'è un gruppo changelog e non se ne scrive uno altrove: se una consegna
ti sembra chiedere un registro delle versioni, è una cosa da portare all'owner, non da istituire in
un commit.

## Procedura

1. Esegui in parallelo, per contesto:
   - `git status` — stato della working tree e dello stage
   - `git log --oneline -10` — stile dei commit recenti

2. **Determina l'ambito.**
   - **Con parametri**: committa solo il perimetro indicato.
   - **Senza parametri**: committa lo stage corrente.

3. **Separa i gruppi.** Partiziona in **tre**: **codice** (tutto sotto `plugins/`, più le vetrine in
   radice se toccate), **memoria e documentazione** (`CLAUDE.md`, `sviluppo/**`) e **versione** (i
   due `plugin.json`, se il numero cambia). Verifica che nulla di ciò che stai per committare stia
   fuori da quei tre gruppi: se ci finisce, fermati e chiedi — un path che non sai collocare o è una
   pubblicazione che non hai deciso, o è una sede di questo repository che nessuno ha ancora
   dichiarato.

4. **Metti in stage il gruppo codice** (`git add <file>`, elencati singolarmente — mai `-A`, mai
   `.`), senza committare. Serve prima del passo 5: il diff su cui l'allineamento si fa è quello in
   index.

5. **Allinea gli artefatti di sviluppo**, delegando secondo § *Allineamento*. I file che la delega
   tocca entrano nel **gruppo memoria/documentazione**, e si mettono in stage al passo 7 come gli
   altri — `git add <file>`, elencati singolarmente. Se hai saltato la delega, dichiara in una riga
   perché (l'unico motivo ammesso è il gruppo codice vuoto).

6. **Controlla la versione** secondo § *Versione*: i due manifest coincidono? Se no, allineali e
   metti i due file nel gruppo versione.

7. **Crea i commit**, uno per gruppo non vuoto, nell'ordine: prima **codice**, poi **memoria e
   documentazione**, poi **versione**. Senza chiedere conferma su nome o descrizione.

   - Fai lo staging dei soli file del gruppo corrente, elencati singolarmente. Mai mescolare gruppi
     in un unico commit. Il gruppo codice è già in stage dal passo 4: verifica con `git status` che
     non vi sia entrato altro.
   - Scrivi il messaggio con la sintassi del tool che stai usando in quel momento, **mai
     mischiarle**:
     - **Tool Bash** (Git Bash / POSIX sh): `git commit -F -` alimentato da un heredoc quotato,
       oppure `git commit -m` con il messaggio in chiaro. Mai `@'...'@`, che è sintassi PowerShell e
       in sh produce un messaggio con `@` letterali in testa e in coda.
     - **Tool PowerShell**: here-string `git commit -m @'...'@`, con `'@` di chiusura a colonna 0.
   - Il messaggio del commit di versione è `build(manifest): allinea la versione dei due manifest a
     X.Y.Z`, oppure, se il bump è stato deciso dall'owner, `build(manifest): porta la versione del
     pacchetto a X.Y.Z`.
   - Dopo ogni commit, verifica il messaggio con `git log -1 --format="%s%n%n%b"` prima di passare al
     gruppo successivo: se compaiono `@` o altri artefatti di sintassi, correggi subito con
     `git commit --amend -m "..."`, passando il messaggio corretto in chiaro.

8. **Riporta al chiamante**, in chat:
   - `git log --oneline -1` per ogni commit prodotto, **dicendo di quale gruppo è**. Chi ti ha
     invocato lo mette in un campo del proprio blocco e non può ricavarlo da `git log -1`, che dopo
     di te restituisce l'ultimo gruppo e non quello del codice.
   - i **path che l'allineamento ha toccato**, con la riga che dice che non sono committati e
     perché;
   - le voci di `confirm_with_owner`, se ce ne sono;
   - l'esito del controllo di versione, e se il bump ti sembra dovuto;
   - se ti sei fermato fra un gruppo e il successivo, **dillo esplicitamente**: la sequenza è
     **parziale**, non eseguita.

**Mai** eseguire `git push`, `git push --force`, o qualsiasi comando che scriva sul remoto: il
repository è privato fino al rilascio, e nessun contratto di questo corpus ha motivo di toccare un
remoto.

**Mai** aggiungere il trailer `Co-Authored-By` né alcuna menzione dell'agente che ha generato il
lavoro ai messaggi di commit.
