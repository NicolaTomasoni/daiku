---
description: 'Cerca difetti introdotti da un diff di plugins/daiku — contratti in prosa, manifest, codice eseguibile e template. Modalità finder quando la invoca review, modalità pull request quando la lanci tu.'
argument-hint: '[numero PR] [--comment]'
allowed-tools: Bash(git remote:*), Bash(git diff:*), Bash(git log:*), Bash(git grep:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh pr comment:*), Read, Grep, Glob
---

Trova i difetti che un diff **introduce** in `plugins/daiku/`. È la disciplina `bug` di questo
progetto, e qui «bug» è più largo che altrove: il pacchetto è fatto per due terzi di prosa che
qualcuno eseguirà, e un contratto che manda un subagent su un file inesistente si rompe esattamente
come una funzione che chiama un simbolo che non c'è.

## Due modalità

- **Finder (invocata da `review`).** Scope = il diff passato dal chiamante. **Sola analisi**: nessun
  commento da nessuna parte, nessun fan-out interno, nessuna modifica. È il caso normale, ed è la
  sezione qui sotto.
- **Pull request.** Il diff è già pubblicato su GitHub e l'esito sono commenti sulla PR. Vedi
  § *Modalità pull request*.

Chi ti invoca **sceglie** la modalità. I vincoli di ciascuna stanno qui e non si riscrivono nel
prompt di chi chiama.

---

## Che cosa è un difetto, in questo pacchetto

Cinque famiglie. Le prime tre sono le uniche che esistono davvero su un diff di soli contratti, e
sono quelle che si sbagliano di più.

### 1. Rimandi che non risolvono

Un contratto cita un file, una sezione, un campo. **Ogni citazione è verificabile**, e un rimando
rotto è un difetto grave: il subagent che lo riceve parte da zero e non ha modo di accorgersene.

- un path a un contratto che non esiste a quel path (`.claude/commands/...` in un albero che usa
  `skills/<nome>/SKILL.md`);
- un rimando «§ *X* del suo file» dove quell'heading non c'è;
- un campo di un blocco JSON citato dal chiamante e non più dichiarato dal nodo che lo produce;
- un comando che nomina un file, uno script o una directory che sul disco non ci sono.

Verificali: `grep`, `ls`, e il file citato aperto davvero. Un rimando dato per buono è il modo
principale in cui questo corpus si rompe in silenzio.

### 2. Due fonti per la stessa cosa

Il criterio che regge il metodo è che ogni cosa abbia **una sola** sede. Un diff che ne crea una
seconda è un difetto anche quando le due copie oggi dicono la stessa cosa: divergeranno alla prima
modifica, e a divergere per prima è sempre la riga che qualcuno ha aggiunto dopo.

- uno schema di ritorno ricopiato nel chiamante invece che citato dal nodo che lo produce;
- una disciplina riscritta nel chiamante invece che delegata;
- un comando di gate scritto in due contratti;
- un fatto riassunto nel prompt di un subagent invece del path della memoria che lo porta.

### 3. Violazioni degli invarianti dichiarati

Si citano con la regola esatta, e la regola sta in `CLAUDE.md` o nelle memorie sui due host. Le
ricorrenti:

- **un modello nominato dentro una skill.** Una skill dichiara un **ruolo**; il modello lo risolve
  `.claude/orchestration.md` §2. `opus`, `sonnet`, `gpt-…` dentro un contratto sono un difetto.
- **frontmatter non quotato** in una `SKILL.md`: `description` e `argument-hint` vogliono l'apice
  singolo, con l'apice interno raddoppiato. Il guasto è silenzioso — la skill si carica con i
  metadati vuoti — e il validatore di Claude Code lo prende.
- **una chiave di manifest che un validatore rifiuta.** `plugins/daiku/.codex-plugin/plugin.json`
  ammette solo `id · name · version · description · skills · apps · mcpServers · interface ·
  author · homepage · repository · license · keywords`. `agents`, `commands` e `hooks` sono
  rifiutati, e `disable-model-invocation: true` nel frontmatter di una skill pure.
- **versione fuori sync** fra `plugins/daiku/.claude-plugin/plugin.json` e
  `plugins/daiku/.codex-plugin/plugin.json`: sono due file che portano lo stesso numero e si
  aggiornano insieme.

  **I path si scrivono per esteso**, sempre: `.claude-plugin/` in `plugins/` è la **vetrina** (porta un
  `marketplace.json`), dentro `plugins/daiku/` è il **manifest** (porta un `plugin.json`). Sono tre
  coppie di nomi che si somigliano e fanno lavori diversi — la quarta è `.agents/` in `plugins/` contro
  `agents/` nel pacchetto — e un path scritto a metà manda chi legge sul file sbagliato.
- **una cosa messa dalla parte sbagliata del confine**: un file di sviluppo finito sotto
  `plugins/`, o un contratto che il prodotto deve portare finito fuori.
- **un rimando a una skill scritto per nome** invece che per path: i due host le nominano in modo
  incompatibile (`/daiku:review` contro `$review`).

### 4. Difetti di codice, nei file che codice sono

`plugins/daiku/hooks/lib/*.mjs` e `plugins/daiku/tools/*.py` sono codice vero, e valgono i criteri
di sempre: logica sbagliata a prescindere dagli input, riferimenti non risolti, path calcolati male,
errori che si manifestano solo a load-time. Due cose specifiche di questi file:

- **il totale contato**. Ogni hook ha un `--self-check` il cui numero di controlli è *contato*, non
  cablato. Un diff che aggiunge un controllo senza che il totale cresca, o che lo cabla, toglie
  al banco la sola proprietà che lo rende affidabile.
- **la radice risolta.** `Path(__file__).resolve().parents[N]` e gli equivalenti in `.mjs` sono il
  punto in cui questi file si rompono quando qualcosa si sposta. Se il diff muove un file o cambia
  un parents, verifica dove quella radice cade davvero.

### 5. Quello che si pubblica

Tutto ciò che sta sotto `plugins/` esce com'è scritto a chiunque aggiunga il marketplace, e il
confine di git **non guarda dentro i file**. Sono rilievi, e gravi:

- un valore di un altro progetto rimasto in un file del pacchetto (un `repo_root`, un comando
  `pnpm --filter @…`, un nome di progetto ospite);
- un path di questa macchina (`C:/dev/…`, uno username);
- un segreto, un token, un URL interno.

Al 18 settembre 2026 il pacchetto ne porta già di noti — i due template non svuotati, i banchi
`--self-check` con path cablati. **Quelli sono preesistenti e non si segnalano**: sono già censiti
in `.docs/memory/pubblicazione-su-github.md`. Si segnala ciò che il diff **aggiunge**.

## Cosa NON segnalare

I falsi positivi erodono la fiducia e costano un triage a ogni giro.

- **Difetti preesistenti**: ciò che il diff non ha toccato non è di questo giro.
- **Preferenze di stile e di prosa**: un paragrafo che avresti scritto diversamente non è un
  difetto. Questo corpus è scritto in una voce precisa, e riscriverla non è una correzione.
- **Nitpick** che un revisore esperto non solleverebbe.
- **Qualità generica** non richiesta da `CLAUDE.md`.
- **Una scelta dichiarata**: se il documento di decisione ha scelto una strada e il diff la segue,
  non è un difetto che tu ne preferissi un'altra.
- **Ciò che sta fuori da `plugins/daiku/`.**

---

## Modalità finder (invocata da `review`)

Sei **già** il subagent assegnato alla passata: la tua unica consegna è trovare i difetti che il
diff introduce e restituirli nel blocco JSON del chiamante. Non deleghi, non commenti, non scrivi.

**Il perimetro di lettura lo fissa l'effort** che il chiamante ti passa:

- **`low`** — il solo diff.
- **`medium`** (default) — il diff, i file che tocca per intero, e i contratti che quei file citano
  direttamente. È il minimo per verificare un rimando, che è la prima famiglia di difetti.
- **`high`** — anche i contratti che citano *loro*, la topologia di `.claude/orchestration.md` §5, e
  i documenti di riferimento che il prompt ti passa.

**Verifica prima di segnalare.** Qui un rilievo si può quasi sempre confermare con un comando —
`grep` di un heading, `ls` di un path, l'apertura del file citato. Un rilievo che si poteva
verificare e non è stato verificato vale meno di niente: costa all'applicatore lo stesso triage e
non porta l'evidenza.

**La scala di `confidenza`**, che è quella su cui il ciclo decide:

- **alta** — il difetto sta nel diff e l'hai **verificato**: il path non esiste, l'heading non c'è,
  il campo non è più dichiarato, il validatore lo rifiuta, la versione non coincide. `cambiamento`
  riporta il fix concreto.
- **media** — difetto reale che si manifesta solo in uno scenario specifico, ma **raggiungibile**:
  un contratto che regge finché lo invoca un chiamante e non l'altro, un comando che funziona finché
  il file sta lì. Nomina nella `descrizione` lo scenario che lo raggiunge. `cambiamento` riporta
  comunque il fix.
- **bassa** — sospetto che per confermarsi richiede di leggere oltre il perimetro che l'effort ti
  concede; nessun `cambiamento`, e la `descrizione` dice cosa resta da verificare. È informazione
  utile: l'applicatore riverifica ogni rilievo prima di toccare qualcosa.

Restituisci il blocco JSON e **nient'altro**:

```json
{"findings": [{"file": "<path>", "riga": 0, "simbolo": "<Classe.metodo | funzione | § Titolo della sezione>", "confidenza": "alta|media|bassa", "cambiamento": "<il fix concreto, per alta e media>", "descrizione": "<il difetto, l'evidenza che l'ha confermato, e lo scenario in cui si manifesta>"}]}
```

`simbolo` è l'unità di contenimento: su codice il nome qualificato, **su un contratto in prosa il
titolo della sezione**. È ciò con cui l'applicatore raggruppa i fix e con cui il ciclo riconosce
un'oscillazione.

---

## Modalità pull request

Il diff è già su GitHub e l'esito sono commenti sulla PR. Il repository di Daiku va su **GitHub**,
non su GitLab (decisione del 18 settembre 2026): non esiste un ramo `glab` di questo contratto.

Vale tutto ciò che sta sopra — le cinque famiglie e la lista dei falsi positivi — più questo:

1. **Verifica che la PR vada revisionata.** `gh pr view <N>` per stato e draft, e
   `gh pr view <N> --comments` per vedere se Claude ha già commentato. Se è chiusa, è draft, è già
   commentata, o è un cambiamento talmente banale da non richiedere revisione, **fermati e dillo**.
   Una PR generata da Claude si revisiona come le altre.

2. **Leggi il diff**: `gh pr diff <N>`, più titolo e descrizione della PR, che dicono l'intento
   dell'autore.

3. **Carica gli invarianti**: il `CLAUDE.md` in radice, e le memorie sui due host
   (`.docs/memory/cosa-i-due-host-accettano.md`, `.docs/memory/cosa-codex-fa-allinstallazione.md`) se
   il diff tocca manifest, skill o collocazione di file. Sono le due fonti contro cui si cita una
   violazione.

4. **Lancia due worker in parallelo** sullo stesso diff, ciechi fra loro, con lo stesso prompt: le
   cinque famiglie, la lista dei falsi positivi, e il diff. Il ruolo è **worker**, e lo risolvi con
   `.claude/orchestration.md` §2 — mai da qui.

5. **Valida ogni rilievo** prima di portarlo in superficie, con un subagent per rilievo o
   verificandolo tu: il path esiste davvero? l'heading c'è? il validatore lo rifiuta davvero? Filtra
   tutto ciò che non regge alla verifica.

6. **Riporta in chat** l'elenco dei rilievi sopravvissuti, ciascuno in una riga. Se non ce n'è
   nessuno: «Nessun rilievo. Controllati rimandi, doppie fonti, invarianti, codice e cosa si
   pubblica.»

   **Se `--comment` non è stato passato, fermati qui.** Non pubblicare niente.

7. **Con `--comment`**, pubblica: un commento inline per rilievo se il tool di commento inline è
   disponibile, altrimenti un solo `gh pr comment <N>` con un rilievo per sezione. Per ciascuno: una
   descrizione breve, e un blocco di suggerimento committabile **solo** se applicarlo chiude
   interamente il rilievo. Un commento per rilievo, mai doppioni.

   Quando linki una riga, il permalink vuole lo SHA completo e almeno una riga di contesto sopra e
   sotto: `https://github.com/<owner>/<repo>/blob/<sha completo>/<path>#L10-L15`.

Non usare il web fetch per interrogare la forge: c'è `gh`.
