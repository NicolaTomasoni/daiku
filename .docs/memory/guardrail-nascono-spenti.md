---
name: guardrail-nascono-spenti
description: "la guardia nega sempre push, --no-verify, il commit di ciò che sta sotto .daiku/, le firme di Claude o Codex e i nuovi file fuori sede, e solo il pool si dichiara; nessun hook esegue un file perché è appena comparso"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f30fa0d-9a97-482d-ba1b-c32231e0c9e1
  modified: 2026-09-26T00:08:47.000Z
---

**Deciso il 19 settembre 2026, preparando gli hook per la distribuzione.** Un pacchetto si
installa una volta ed è attivo su **ogni** repository che l'host apre. Da lì discendono due regole
che valgono per qualunque hook Daiku porti, oggi e in futuro.

**Primo: quasi niente si accende da solo.** Senza `.daiku/project.json` le guardie sui comandi
e sulle scritture non negano niente e non leggono nemmeno la riga — questo resta. Con quel file, dal 21 settembre 2026
negano sempre, senza interruttore: `git push`, `git commit
-n`/`--no-verify` e i commit che portano un path sotto `.daiku/`. Dal 23 settembre 2026 nega sempre, senza interruttore, anche la creazione di un
nuovo file fuori dalle sedi dichiarate (`edit-guard.mjs`: modificare un file esistente resta sempre
lecito, così i ritocchi a mano del proprietario non si bloccano mai). Dal 25 settembre 2026 nega sempre,
senza interruttore, anche il `git commit` il cui messaggio accredita l'agente — un `Co-Authored-By`
che nomina Claude o Codex, o una riga `Generated with` — in `-m`, `--trailer`, heredoc o file `-F`. L'unico ramo che resta spento finché il progetto non lo accende è il pool dei
worktree, con `{worktree.pool}`. La rimozione ricorsiva che attraversa una junction di Windows non
ha mai avuto interruttore: non è una policy ma un fatto del sistema operativo.

Il ribaltamento è una decisione dell'owner, non un fatto nuovo: a un agente non si lascia mai la
libertà di pushare, di saltare gli hook o di mettere nella storia condivisa ciò che appartiene a
una macchina sola — mai fidarsi di un LLM. Il
disegno opt-in del 19 settembre valeva finché il divieto viveva nel testo delle skill; dal momento
in cui il diniego è deterministico, una chiave per dichiararlo sarebbe una riga che nessuno guarda.

**Secondo: un hook non esegue un file perché è comparso.** Il controllo post-scrittura *ricorda* di
lanciare il banco di prova di una guardia riscritta, e non lo lancia.

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
progetto (il pool): push, `--no-verify` e il commit di ciò che sta sotto `.daiku/` negano sempre, perché un diniego che
dipende da una chiave che qualcuno deve ricordarsi di accendere protegge solo i progetti diligenti.
Il ramo di `edit-guard.mjs` del 23 settembre 2026 segue la stessa regola: nasce acceso, senza chiave,
perché le sedi di scrittura si leggono dalle chiavi che già esistono.

**How to apply:** un ramo nuovo nasce **acceso**, senza chiave — è la regola dal 21 settembre 2026:
dove un divieto può avere una sede deterministica, ce l'ha sempre. Fa eccezione il ramo che dipende
davvero dal progetto (oggi solo il pool dei worktree): quello nasce **spento**, con la sua chiave
nel JSON, e nel banco un caso che prova che da spento **non** nega. Ogni ramo ha la sua riga nella
tabella di `plugins/daiku/hooks/README.md`, e i banchi di tutto ciò che il pacchetto esegue — i
moduli di `hooks/lib/` con un banco, il banco dei manifest e i due programmi di `architect/` — si
lanciano insieme con `node plugins/daiku/hooks/self-check.mjs`, che somma i controlli e esce `1` al
primo rosso: va aggiunto a ogni verifica di rilascio accanto ai due validatori. Il numero dei banchi
e dei controlli lo dice l'uscita dello strumento, non questo file.

**La radice i hook la cercano, non la presumono.** `hooks/lib/project-root.mjs` non prende la radice
git: cerca la `.daiku/project.json` **più vicina salendo dalla cwd** — dopo aver accettato la radice
che l'host dichiara, se porta i parametri — e si ferma alla radice git. E quando la cwd sta in una
worktree del pool, che di `.daiku/` non ne ha perché non è versionato, ripete la posizione relativa
nell'albero principale via `git rev-parse --git-common-dir`: la consegna gira dentro le worktree, e
una guardia fail-open non può dipendere da un passo in prosa di un'altra skill. Ha un banco suo,
`node plugins/daiku/hooks/lib/project-root.mjs --self-check`.

Vedi [[tre-livelli-di-parametro]] per dove va un valore, e [[alberatura-pacchetto]] per la sede.
