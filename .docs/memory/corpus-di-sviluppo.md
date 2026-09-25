---
name: corpus-di-sviluppo
description: "In .claude/ vive una derivazione dei contratti del prodotto, adattata a questo repo e mai sincronizzata automaticamente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-09-23T18:04:37.333Z
---

Dal 18 settembre 2026 `.claude/` porta un **corpus di sviluppo**: `orchestration.md`, i comandi in
`commands/` e `agents/finder.md`. Serve a sviluppare Daiku con il metodo di Daiku. Fino al 21
settembre 2026 i comandi erano dieci contratti in `skills/` (`studia-libreria`, `studia-problema`,
`decision-doc`, `blueprint`, `execute`, `review`, `code-review`, `commit`, `update-memory`,
`deliver-feature`); quel giorno, su ordine esplicito dell'owner, il cantiere è passato a **tredici
comandi** in `commands/` — i dodici convertiti (`translate-skill` e `migliora-skill` si erano
aggiunti nel frattempo senza aggiornare questa memoria) più `confronta-repo.md`, il comando
dell'owner precedente al corpus. Corpi identici, a parte il frontmatter (nei comandi non c'è la
riga `name:`, il nome lo dà il file) e i rimandi fra contratti.

**Dal 20 settembre 2026 i nomi non si corrispondono più**, e la derivazione non si trova più per
omonimia: nel prodotto quei contratti si chiamano `research` (raccolta, con il riordino delegato
a `study`), `new-feature` e `develop-feature`, dove
il cantiere ha ancora `studia-libreria`, `studia-problema` e `deliver-feature`. I rename sono stati
scritti solo nel prodotto, che è l'albero che si pubblica; riportarli qui è una decisione a parte,
che non è stata presa.

**Why:** è una derivazione dei contratti di `plugins/daiku/skills/`, non una copia, perché tre
scelte dell'owner le fanno divergere e non sono reversibili per copia:

- **Niente parametrizzazione.** Il prodotto tiene i valori fuori dalle skill (`project.json`,
  `environment.json`) perché deve girare su progetti diversi. Qui il progetto è uno: path, comandi e
  modelli sono scritti per esteso dentro il contratto che li usa. Una graffa `{…}` in questo corpus
  è un refuso.
- **Niente worktree.** Si lavora sul branch corrente dell'albero principale. La scelta resta in
  piedi ma **non ha una giustificazione scritta**: a un worktree di questo repository non
  mancherebbe niente, perché il repo versiona tutto e se lo porterebbe dietro, `CLAUDE.md`,
  `.docs/` e i contratti che ogni subagent deve leggere compresi.
- **Il commit di memoria e documentazione qui c'è**, e `commit` partiziona in **tre** gruppi come il
  contratto del prodotto: il perimetro di `update-memory` — `CLAUDE.md`, `.docs/`, `.claude/` — è
  nell'indice, e `deliver-feature` lo committa in una fase propria, dopo il report perché il
  registro delle consegne è di quel gruppo.

Il prodotto ha **diciotto** contratti, questo corpus ne ha **dodici** derivati, su **quattordici**
comandi: gli altri due, `confronta-repo.md` e `repo-intelligence.md`, sono comandi dell'owner senza
un gemello nel prodotto. Gli otto non derivati sono
`applier`, `arch-check`, `finder-prompt`, `init`, `perf`,
`research`, `sync-host`, `test-coverage`. Di questi, `finder-prompt` e `applier` sono stati **assorbiti**
dentro `review`, che quindi qui scrive in casa propria il prompt del finder e il mestiere
dell'applicatore; gli altri sei semplicemente non servono a sviluppare Daiku.

**`memory-review` non ha un gemello nel prodotto**, e la ragione vale la pena tenerla: se il corpus
avesse bisogno di una revisione periodica, vorrebbe dire che il modo in cui cresce non funziona, e
il rimedio andrebbe messo lì. Al suo posto, `update-memory` gira a **ogni** invocazione di `/commit`,
senza eccezioni. Nel cantiere la skill resta finché qualcuno non decide di toglierla anche di qui:
è una decisione a parte, non un allineamento.

**Due nomi non coincidono più**, dopo che il prodotto li ha rinominati: il `research` del pacchetto (con `study` come foglia di riordino) è lo `studia-libreria` di qui, e il suo `new-feature` è lo `studia-problema` di qui. Cercare il
contratto corrispondente per nome non funziona su questi due.

**Dal 22 settembre 2026 i due corpus non parlano più la stessa lingua.** `plugins/daiku/` è tutto
in inglese — contratti, skill, commenti e messaggi degli hook, `short_description` degli
`openai.yaml` — mentre il cantiere resta in italiano, e ci resta per scelta: lo legge chi
costruisce Daiku, non chi lo installa. Il confine fra le due lingue coincide ora con quello fra
prodotto e cantiere, che è più facile da tenere del confine fra due pubblici che si aveva prima.
Conseguenza pratica: **cercare un passaggio del prodotto per le sue parole italiane non funziona
più**, e un rilievo scritto in italiano su una riga del pacchetto va tradotto prima di applicarlo.
Nello stesso giorno, su ordine esplicito dell'owner, sono state corrette qui due citazioni rimaste
ai nomi morti delle chiavi dei banchi (`controlli`/`passati`/`falliti` → `checks`/`passed`/`failed`)
in `orchestration.md` e `commands/review.md`: erano le uniche due sedi del cantiere che nominavano
identificatori del prodotto. Vedi [[confine-degli-identificatori]].

**E dal 23 settembre 2026 diverge anche il metodo, insieme alla lingua.** Il prodotto ha un
**valutatore deterministico** — `plugins/daiku/architect/architect.mjs`, il suo blocco in
`schemas/blocks.json` e il campo `architect_agreement` nell'esito di `develop-feature` — e da lì le
skill del pacchetto **non dichiarano più la sequenza**: la chiedono a lui, e il verdetto vincola.
Qui non c'è niente di simile, e non ci sarà finché non lo autorizzi: `commands/deliver-feature.md`
recita ancora la sequenza a parole. Vedi [[valutatore-deterministico]].

**E dal 19 settembre 2026 diverge anche il nome di un ruolo.** Nel prodotto il ruolo che decide si
chiama `judge`, qui ancora `giudice` — 11 occorrenze in 6 file, `orchestration.md` compreso. Nel
prodotto è anche una chiave di `environment.json` (`hosts.<host>.models.judge`), e per questo la
forma di quel file è salita a `2`; qui non c'è niente da migrare, perché i modelli sono scritti per
esteso. Il nome resta disallineato finché non lo autorizzi, come tutto il resto del cantiere.

**How to apply:** dal 19 settembre 2026 `CLAUDE.md` dice che **le skill si modificano solo in
`plugins/daiku/skills/`**: quelle di qui si leggono e si eseguono, non si toccano, e vale allo
stesso modo per `.claude/orchestration.md` e `.claude/agents/`. **Deciso il 20 settembre 2026, precisato lo stesso giorno: «intoccabile» significa che il
cantiere non si aggiorna insieme a Daiku.** Quando il prodotto cambia, la
derivazione non si allinea da sé e non si propone di allinearla: il disallineamento non è una
dimenticanza da correggere, è lo stato normale. Un ordine esplicito dell'owner può toccarlo:
l'intoccabilità è contro l'allineamento automatico, non contro gli ordini. Il cantiere non è Daiku — è il tavolo su cui Daiku
si costruisce, e un tavolo non deve assomigliare al mobile. Anche una modifica che varrebbe per
entrambi i corpus si scrive solo nel prodotto e lì si ferma. Nessuno dei due alberi aggiorna l'altro, e nessuna skill di
questo corpus scrive dentro `plugins/daiku/skills/` per allinearlo a sé stessa.

**Il confine di git non è il `.gitignore`.** Il `.gitignore` del repository esclude soltanto
`.claude/settings.local.json`: i file di questo corpus — `CLAUDE.md`, `.docs/**`, `.claude/**` —
sono **nell'indice** come il prodotto, e il confine di ciò che si pubblica sta nella lista di copia
dello script di rilascio, che prende `plugins/` in blocco. Ne segue che i gruppi di commit sono
**tre** come nel prodotto — codice, memoria e documentazione, versione — e che il gruppo memoria e
documentazione **si committa**: `commit` lo fa in un commit proprio, e `deliver-feature` in una fase
8 dopo il report. Un contratto di questo corpus che dica il contrario è un difetto da correggere,
non una deroga da applicare.

**Una scelta senza la sua ragione.** La regola «questo corpus non usa worktree»
(`orchestration.md` § *Questo corpus non è il prodotto*, `deliver-feature` § *Dove si lavora*) **non
ha una motivazione scritta**: i due contratti la dichiarano senza dire perché, e a un worktree di
questo repository non mancherebbe niente — conterrebbe anche `CLAUDE.md`, `.docs/` e il corpus,
che il repository traccia come il prodotto.
È il caso più insidioso: la scelta regge, la ragione no, e chi legge crede di sapere perché.

Vedi [[alberatura-pacchetto]] e [[si-pubblica-solo-il-prodotto]].
