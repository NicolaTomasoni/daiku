---
name: confine-del-giro
description: "Il turno dell'owner che chiede lavoro si delega, mai si esegue nella conversazione: la regola sta in new-feature §7 e un hook la ricorda — non la impone, perché l'owner ha scelto il promemoria e non il divieto"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-30T19:20:41.114Z
  originSessionId: 715311ff-404d-46a6-a631-04f17ff013e9
---

Dal 30 settembre 2026 `new-feature` ha una regola in più, e un hook che la ricorda.

**La regola.** `new-feature` è l'unico nodo che **conversa** con l'owner prima della consegna: apre la
cartella, pone le decisioni e aspetta. In quella conversazione il turno dell'owner può essere tre
cose, e la terza non era dichiarata: una risposta, una domanda (*An answer that asks is not an
answer*), oppure **una richiesta di lavoro** — una correzione a `0. problem.md`, un'altra tecnologia
da studiare, una decisione rimessa in discussione, e anche codice, dopo che la consegna è passata.
Quella richiesta è lavoro, e il lavoro è un subagent: un contesto fresco, ruolo **worker** dove
applica un cambiamento delimitato e **judge** dove decide, il contratto del passo che possiede
l'artefatto toccato, la richiesta dell'owner **verbatim** come input risolto. Qui torna solo il suo
blocco. Se la richiesta non è un cambiamento di ciò che il giro ha prodotto ma un **problema
diverso**, non si improvvisa un passo: si dice, e l'owner la apre come giro suo.

**L'hook ricorda, non nega.** `plugins/daiku/hooks/lib/run-advice.mjs`, registrato due volte in
`hooks/hooks.json`: su `UserPromptSubmit` — il prompt che apre un giro (`/…new-feature`) **marca la
sessione** e enuncia la regola una volta sola — e su `PreToolUse` di `Edit`/`Write`/`MultiEdit`, dove
una scrittura fatta **dalla conversazione** fuori dalle sedi del giro (`{paths.features}`,
`{paths.studies}`, `{write_roots}`) riceve di nuovo la regola in `additionalContext` e **passa**:
nessun `permissionDecision`, mai. Il marchio sta nello scratch della sessione o nella cartella
temporanea di sistema, mai nel repository; è l'accensione **per sessione e non per progetto**, ed è
l'unica che un hook scrive da sé.

**Why il promemoria e non il divieto** (decisione dell'owner, 30 settembre 2026). La regola è il
**default di un giro**, non un divieto su un gesto: la stessa conversazione fa anche altri mestieri in
cui scrivere è suo — `/commit` aggiorna changelog e versione a mano, per contratto — e un diniego
secco fermerebbe il nodo che è stato chiesto. E un diniego qui non avrebbe un rimedio solo da
nominare: «delega, o dichiara la cartella, o apri un'altra sessione» sono tre risposte diverse a un
gesto che non è sempre lo stesso errore. Il promemoria dice la regola a chi sta per romperla e lascia
il giudizio dove il contratto l'ha già messo.

**Il fatto sugli host su cui poggia, e da dove viene.** Un hook di plugin gira **anche** per i tool
di un subagent, e l'input porta `agent_id` **solo quando l'hook scatta dentro una chiamata di
subagent**: è quel campo, e non `agent_type`, a distinguere un figlio dalla conversazione —
`agent_type` c'è anche in una sessione avviata con `--agent`. Letto dalla reference dell'host
(`code.claude.com/docs/en/hooks`, tabella *Common input fields*, e *Add context for Claude*;
`code.claude.com/docs/en/sub-agents`, *Define hooks for subagents*), **30 settembre 2026**.
**Non riprodotto su questa macchina**: il pacchetto installato è una copia, e un esperimento qui
misurerebbe la versione in cache, non questa. Su **Codex** il modello non lo cabla — nessun
`UserPromptSubmit`, nessun `agent_id` — quindi là non marca e non parla: la regola ha una sede sola,
il §7 di `new-feature`.

**How to apply:** il banco è `node plugins/daiku/hooks/lib/run-advice.mjs --self-check`, e il totale
dei banchi lo dice `node plugins/daiku/hooks/self-check.mjs`. Un caso del banco tiene la forma che
questo file non deve mai prendere: la risposta lato scrittura porta `text` e **nessun campo che un
host possa leggere come una decisione**. La regola in prosa sta in
`plugins/daiku/skills/new-feature/SKILL.md` § *7. Decisions are asked in chat* e nelle sue
*Operational constraints*; la riga dell'hook sta nella tabella di `plugins/daiku/hooks/README.md`.
Cambiando la regola si cambiano **tutte e tre**, o il testo e il promemoria divergono in silenzio.

Vedi [[fase-strategica-non-si-salta]] per l'altra regola nata dalle stesse sessioni,
[[guardrail-nascono-spenti]] per la dottrina dei dinieghi — di cui questo non fa parte — e
[[punti-ingresso-prodotto]] per quale nodo conversa e quale no.
