---
name: daiku-versionato
description: "`.daiku/` è sorgente del progetto e entra nei commit — cosa resta fuori, e perché il disegno è cambiato il 30 settembre 2026"
metadata:
  node_type: memory
  type: project
  originSessionId: 74fa8bc9-dbb1-4c77-bf91-e6ec34544097
  modified: 2026-09-30T12:10:38.947Z
---

`.daiku/` **entra nella storia condivisa** del progetto che l'ha aperta: `project.json`,
`environment.json`, `domain/`, `policies/` e la documentazione di Daiku su sé stesso, che `init`
deposita come `.daiku/README.md`. È la configurazione che il progetto ha scritto di sé,
e parte di essa è scritta a mano — le policy e il domain, che nessun `init` rigenera — quindi un
clone deve trovarla senza rifare `/init`. **L'unica cosa che resta fuori è
`.daiku/environment.local.json`**, l'override della singola macchina: `init` scrive nel
`.gitignore` del repository la riga che lo esclude, dove nessuna riga del repository lo copre ancora.

**Why:** il disegno precedente trattava la cartella come `node_modules/` — attrezzo della macchina,
rigenerabile — e ne pagava il prezzo dichiarato: un clone senza parametri, e policy e domain
**scritti a mano** da riscrivere su ogni macchina, perché non si rigenerano. E la cartella vive nel
repository **del progetto**, che è il suo repository di sviluppo: versionarla non porta niente di
privato nel repository di prodotto di Daiku.

**Le conseguenze, in ordine di quanto si vedono.**

- **La guardia non esiste più.** Il ramo `.daiku/` di `command-guard.mjs` è uscito: negava un gesto
  ora legittimo. Il guard passa da sei rami a cinque, e il suo banco con esso.
- **Una worktree del pool ha `.daiku/`.** `git worktree add` porta il contenuto versionato, quindi i
  parametri viaggiano con la consegna: la regola «leggili dall'albero principale per path assoluto»
  cade, e `update-memory` non ha più una sede del suo perimetro che non viaggia.
- **`{memory.root}` può stare sotto `.daiku/`**, e il divieto cade: era la conseguenza del
  versionamento mancante. La sede che `init` propone resta la radice tecnica.
- **`paths.review_state` resta fuori dal versionamento** — è un ledger, non sorgente — e proprio per
  questo non sta sotto `.daiku/`, che ora è versionata: la ragione si ribalta, la regola resta.

**How to apply:** la regola vive in cinque sedi e vanno tenute insieme — la §8 di
`contracts/project-contract.md`, la § *Where each of the two lives*, gli *Step 3*, *4* e *8* di
`skills/init/SKILL.md`, la § *Commit convention* e la § *Separate commit of memory and
documentation* di `skills/commit/SKILL.md`, e la tabella dei rami di `hooks/README.md`. Il banco dei
guard si lancia con gli altri da `node plugins/daiku/hooks/self-check.mjs`.

Vedi [[tre-livelli-di-parametro]], [[guardrail-nascono-spenti]] e [[init-aggancia-la-memoria]].
