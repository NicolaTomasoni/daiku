---
name: alberatura-pacchetto
description: "Cosa contiene ogni cartella del repo e a cosa serve — il prodotto, lo sviluppo — con i nomi che si somigliano e non c'entrano niente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-09-28T14:36:00.297Z
---

Il repo ospita il prodotto Daiku. **In radice non entra
nessun file di prodotto**: ci sono le sedi di sviluppo e una cartella,
che è per intero la radice del suo repository pubblico — `plugins/`.

`plugins/` è **insieme marketplace e pacchetto**: una sola alberatura serve Claude Code e Codex,
perché i due host cercano file con nomi diversi e ignorano quelli dell'altro.

## 1. Il prodotto Daiku — `plugins/`

`plugins/daiku/` è il pacchetto vero e proprio: tutto ciò che un utente riceve e installa.

| Dentro il pacchetto | Cosa c'è | Chi lo legge |
|---|---|---|
| `skills/` | i **18 contratti** del metodo, uno per cartella | **entrambi** gli host, stessi identici file |
| `contracts/` | `orchestration.md`, `project-contract.md` | le skill li aprono per path; non sono skill loro stessi |
| `agents/` | `finder` — l'unico subagent a toolset ristretto | solo Claude Code: Codex lo rifiuta |
| `hooks/` | il wiring `hooks.json`, i **quattro hook** in `lib/` e i **due moduli** che importano (`project-root.mjs`, `daiku-config.mjs`); accanto, fuori da `lib/`, `self-check.mjs` e `README.md`, che sono di chi sviluppa il pacchetto e non si trasportano | solo Claude Code: su Codex `plugin_hooks` è rimossa |
| `architect/` | `architect.mjs`: il **valutatore deterministico** — risponde a nove domande meccaniche e tiene l'ordine della catena; `ledger.mjs`: lo **strumento lato disco della review** — legge Git, scrive il ledger e chiede i verdetti al valutatore. Ciascuno col suo banco, che `hooks/self-check.mjs` lancia (vedi [[valutatore-deterministico]]) | l'agente, che li invoca: non sono hook, nessun `hooks.json` li nomina, e non si installano in un progetto |
| `schemas/` | `blocks.json`: lo specchio controllabile dei blocchi di ritorno — la prosa del nodo resta normativa | i controlli scritti a mano e gli umani che scrivono i nodi |
| `templates/` | gli scheletri che `init` copierà nel progetto ospite | nessuno: non vengono mai letti in place |
| `.claude-plugin/`, `.codex-plugin/` | i due manifest, uno per host | gli host, all'installazione |

Accanto, nella radice di `plugins/`, le due **vetrine** — non sono il pacchetto, sono il cartello
che lo indica:

- `plugins/.claude-plugin/marketplace.json` — per Claude Code
- `plugins/.agents/plugins/marketplace.json` — per Codex

Due file separati perché i due host cercano nomi diversi. Entrambi dicono la stessa cosa: «qui
c'è un pacchetto che si chiama daiku, sta in `./daiku`». Con loro stanno il `.gitattributes` del
prodotto e, quando nascerà, il README pubblico. Il marketplace locale si registra su
`<repo>/plugins`, non sulla radice del repo.

## 2. Lo sviluppo *obbligato* a stare in radice

Non si possono spostare: gli host e git li cercano lì e basta. Oltre a questi, in radice ci sono
solo `.gitignore` e `.gitattributes` del repository di sviluppo.

- **`CLAUDE.md`** — le istruzioni per chi sviluppa Daiku. Non è Daiku.
- **`.claude/`** — come si lavora *su* Daiku, non come Daiku funziona. Dentro c'è:
  - `orchestration.md` + `commands/` (14 comandi) + `agents/finder.md` — il **corpus di sviluppo**,
    una derivazione dei contratti del prodotto adattata a questo repo: valori scritti per esteso
    invece che parametrizzati, e niente worktree. Non si sincronizza da solo col pacchetto:
    si scrive solo nel prodotto, e un ordine esplicito dell'owner può toccarlo. Vedi [[corpus-di-sviluppo]].
    Fra i 14, `confronta-repo.md` è il comando dell'owner, precedente al corpus.
  - `settings.local.json` — punta `autoMemoryDirectory` (vedi [[memoria-nel-repo]]).
- **`.vscode/`** — `tasks.json` con gli switch fra backend LLM: tooling personale dell'owner, con
  path della sua home. Non c'entra niente con Daiku.

## 3. Lo sviluppo che si è potuto raccogliere

`.docs/` tiene tutto ciò che serve a costruire il prodotto e che *non* era obbligato in radice:

- `RICOGNIZIONE.md` — il documento di riferimento: cosa offrono i due host, cosa manca, perché
  ogni file sta dove sta, con le prove eseguite sui validatori reali
- `PUNTI-APERTI.md` — le decisioni ancora da prendere
- `appunti.md` — gli appunti sparsi dell'owner
- `nuovi-sviluppi/<slug>/` — la cartella di un lavoro, con i file numerati `0.`–`5.`
- `consegne.md` — il registro ad append delle consegne di `deliver-feature`
- `runtime/review/` — i ledger dei giri di `review`
- `audit/` — i report del prompt audit, con il loro diff
- `scripts/` — script personali dell'owner, come `new-project.ps1` che `.vscode/tasks.json` lancia
- `memory/` — questa memoria; è versionata come tutto il resto, ma non viene pubblicata
- `backup/skill-estratte.md` — il registro ad append di ciò che è stato tolto dalle skill
- `esempi/reforgia/` — dominio e politiche di ReforgIA, come esempio di un livello Dominio
  compilato davvero
- `tools/check-topology.mjs` — verifica la topologia del corpus, nel gate e a mano prima del
  rilascio; sta qui e non sotto `plugins/` così non viaggia con ciò che si pubblica
- `tools/studia-sorgente/` — gli attrezzi deterministici del comando `studia-sorgente`

## I nomi che si somigliano e non c'entrano niente

È la parte che tradisce: tre coppie di nomi quasi identici fanno lavori diversi.

| Nome | Dov'è | Cos'è davvero |
|---|---|---|
| `.agents/` | in `plugins/` | vetrina **Codex** (un `marketplace.json`) |
| `agents/` | in `plugins/daiku/` | i **subagent Claude Code** — nessuna relazione col precedente |
| `.claude-plugin/` | in `plugins/` | la **vetrina** Claude Code |
| `.claude-plugin/` | in `plugins/daiku/` | il **manifest** del pacchetto |
| `.claude/` | radice del repo | come lavora l'owner, niente a che vedere col prodotto |

La regola che scioglie tutto: **in `plugins/` `.agents/` e `.claude-plugin/` sono vetrine; dentro
`plugins/daiku/` sono il pacchetto.**

## Le tre regole di collocazione

Verificate sui validatori di entrambi gli host.

- Una cosa che i due host devono vedere uguale va in `skills/<nome>/SKILL.md`: è l'unico
  primitivo con lo stesso identico layout su entrambi.
- Una cosa che le skill leggono ma che skill non è va in `contracts/`, **mai** sotto `skills/`:
  Claude Code scandisce anche le sottocartelle che iniziano col punto, quindi `skills/.contracts/`
  diventerebbe una skill rotta.
- Una cosa che vive nel progetto ospite va in `templates/`, perché **nessuno dei due host lascia
  che un pacchetto scriva nel progetto**: la deve scrivere un comando che l'utente lancia.

`agents/` e `hooks/` restano nel pacchetto ma valgono **solo su Claude Code**: il manifest Codex
rifiuta `agents`, `commands` e `hooks`, e `plugin_hooks` è una feature rimossa. Su Codex quei due
livelli li scrive `sync-host` dentro il progetto, in `.codex/hooks/` e `.codex/agents/` — non
`init`, che si ferma a `.daiku/`.

Cosa esce e cosa resta **non** lo decide più il `.gitignore`, che qui esclude solo
`.claude/settings.local.json`: lo decide la lista di copia dello script di pubblicazione. Vedi
[[si-pubblica-solo-il-prodotto]] e [[pubblicazione-su-github]]. Per il difetto che la migrazione a
`skills/` ha fatto emergere, vedi [[frontmatter-skill-va-quotato]].
