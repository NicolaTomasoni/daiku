---
name: guardrail-nascono-spenti
description: "la guardia nega sempre push, --no-verify e le firme di Claude o Codex, e solo il pool dei worktree e i canali si dichiarano; ask-guard nega due gesti del giro, e nessun file; nessun hook esegue un file perché è appena comparso"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f30fa0d-9a97-482d-ba1b-c32231e0c9e1
  modified: 2026-10-03T17:37:57.485Z
---

**Deciso il 19 settembre 2026, preparando gli hook per la distribuzione.** Un pacchetto si
installa una volta ed è attivo su **ogni** repository che l'host apre. Da lì discendono due regole
che valgono per qualunque hook Daiku porti, oggi e in futuro.

**Primo: quasi niente si accende da solo.** Senza `.daiku/project.json` le guardie non negano
niente e non leggono nemmeno la riga — questo resta. Con quel file, dal 21 settembre 2026
negano sempre, senza interruttore: `git push` e `git commit
-n`/`--no-verify`. Dal 25 settembre 2026 nega sempre,
senza interruttore, anche il `git commit` il cui messaggio accredita l'agente — un `Co-Authored-By`
che nomina Claude o Codex, o una riga `Generated with` — in `-m`, `--trailer`, heredoc o file `-F`. I rami che restano spenti finché il progetto non li accende sono due: il pool dei
worktree, con `{worktree.pool}`, e la guardia del ramo, con `channels.production` (dal 3 ottobre 2026: nega `git commit` e `git merge` mentre è attivo il ramo di produzione e `git checkout`/`git switch` verso di esso, e legge il ramo solo sulle righe che nominano git). La rimozione ricorsiva che attraversa una junction di Windows non
ha mai avuto interruttore: non è una policy ma un fatto del sistema operativo.

Il ribaltamento è una decisione dell'owner, non un fatto nuovo: a un agente non si lascia mai la
libertà di pushare o di saltare gli hook — mai fidarsi di un LLM. Il
disegno opt-in del 19 settembre valeva finché il divieto viveva nel testo delle skill; dal momento
in cui il diniego è deterministico, una chiave per dichiararlo sarebbe una riga che nessuno guarda.

**Secondo: un hook non esegue un file perché è comparso.** Il controllo post-scrittura *ricorda* di
lanciare il banco di prova di una guardia riscritta, e non lo lancia.

**Terzo: un diniego nuovo è un diniego di gesto, non di file.** Dal 2 ottobre 2026
`hooks/lib/ask-guard.mjs` nega due gesti del solo giro `new-feature`: una domanda di decisione che
non porta il proprio posto nella lista (`k/N`) e il **lancio di un subagent** mentre la lista non è
stata chiesta tutta. Nasce **acceso**, senza chiave, come la regola del 21 settembre, con due confini
dichiarati: parla solo in una sessione che ha aperto un giro — legge il marchio che `run-advice`
scrive, non ne scrive un secondo — e solo dove `.daiku/project.json` esiste. Nega la **delega**
perché è la delega a portare il giro oltre la domanda (incorporazione, brief e consegna sono
subagenti), e **non nega nessun file**: la guardia sulle scritture è uscita il 1° ottobre 2026 e
resta fuori. Un messaggio dell'owner chiude la domanda come chiude tutto: la risposta libera prevale,
e al `UserPromptSubmit` lo stato cade.

**Why il terzo.** `new-feature` chiede all'owner una **lista** di decisioni, e `AskUserQuestion` ne
porta al massimo quattro per chiamata: una lista di sei si chiede in due chiamate, e il testo del
contratto — «make more calls in sequence» — la seconda non la imponeva. Un giro che ne chiedeva
quattro e tirava dritto **rispondeva al posto dell'owner** sulle altre due, in silenzio, e la perdita
non si vedeva da nessuna parte: il modulo era completo, il blocco tornava ben formato, il documento
veniva scritto. Da lì il posto nella domanda: non è una cortesia, è la sola cosa che dice quanto è
lunga la lista — e la lunghezza dichiarata dalla domanda è anche quella che l'owner legge, `3/6`,
mentre risponde.

**Why:** fino a quel giorno `command-guard.mjs` era la guardia di ReforgIA trapiantata nel
pacchetto — negava `git push` a chiunque, su qualunque repository, rimandando a sezioni di un
`CLAUDE.md` che nel progetto ospite non esistono. Un diniego che compare senza essere stato chiesto
è il motivo per cui un pacchetto si disinstalla, e la sua utilità non compensa mai quel primo
istante. Sull'esecuzione: il post-edit lanciava `node <file> --self-check` sul `.mjs` appena
scritto, cioè faceva partire codice che nessuno aveva ancora guardato, scavalcando sia la conferma
che l'host chiede prima di un comando sia l'approvazione per hash che Codex pretende proprio per
gli hook. Un hook che dice «lancia il banco» e uno che lo lancia da solo hanno lo stesso valore
diagnostico e un rischio molto diverso.

Il 21 settembre 2026 l'owner ha ristretto questa decisione ai soli rami che dipendono davvero dal
progetto (il pool dei worktree, e dal 3 ottobre 2026 la guardia del ramo, accesa dai canali): push e `--no-verify` negano sempre, perché un diniego che
dipende da una chiave che qualcuno deve ricordarsi di accendere protegge solo i progetti diligenti.

**How to apply:** un ramo nuovo nasce **acceso**, senza chiave — è la regola dal 21 settembre 2026:
dove un divieto può avere una sede deterministica, ce l'ha sempre. Fanno eccezione i rami che dipendono
davvero dal progetto (oggi il pool dei worktree e la guardia del ramo): quelli nascono **spenti**, con la loro chiave
nel JSON, e nel banco un caso che prova che da spenti **non** negano. Ogni ramo ha la sua riga nella
tabella di `plugins/daiku/hooks/README.md`, e i banchi di tutto ciò che il pacchetto esegue — i
moduli di `hooks/lib/` con un banco, il banco dei manifest, i quattro programmi di `architect/` e i due
passi di `init` (`skills/init/scan.mjs` e `skills/init/branch.mjs`) — si lanciano insieme con `node plugins/daiku/hooks/self-check.mjs`, che somma i controlli e esce `1` al
primo rosso: va aggiunto a ogni verifica di rilascio accanto ai due validatori. Il numero dei banchi
e dei controlli lo dice l'uscita dello strumento, non questo file.

**La radice i hook la cercano, non la presumono.** `hooks/lib/project-root.mjs` non prende la radice
git: cerca la `.daiku/project.json` **più vicina salendo dalla cwd** — dopo aver accettato la radice
che l'host dichiara, se porta i parametri — e si ferma alla radice git. E quando la cwd sta in una
worktree del pool **senza parametri** — la cartella si versiona, quindi di norma li ha, ma una
worktree nata prima che `.daiku/` fosse committata no — ripete la posizione relativa
nell'albero principale via `git rev-parse --git-common-dir`: la consegna gira dentro le worktree, e
una guardia fail-open non può dipendere da un passo in prosa di un'altra skill. Ha un banco suo,
`node plugins/daiku/hooks/lib/project-root.mjs --self-check`.

Vedi [[tre-livelli-di-parametro]] per dove va un valore, e [[alberatura-pacchetto]] per la sede.
