---
name: costo-di-un-giro
description: "Daiku misura in modo deterministico il costo di un giro (architect/cost.mjs) e un hook che misura senza negare: una chiave di tetto nata spenta, e la leva del prompt non presa"
metadata:
  node_type: memory
  type: project
  originSessionId: a7373564-457c-438a-8cb2-d46d04a9fd26
  modified: 2026-10-17T13:32:38.013Z
---

**Dal 12 ottobre 2026 Daiku misura il costo di un giro.** Un giro costa per
**quanti** agenti invoca e per **quanto** contesto ognuno riceve, porta e restituisce: quattro voci —
la **testa** del prompt di ogni subagent, il **fan-out** della catena, il **ritorno** generato e il
**sempre-caricato** del progetto — che **si moltiplicano fra loro**, e che nessuna misurava. La
direzione dell'owner è stata che **la misura preceda la leva**: prima il numero, poi ciò che il
numero giustifica.

**La misura — `architect/cost.mjs`.** Un programma nuovo accanto agli altri di `architect/`, invocato
per path (`node <radice>/architect/cost.mjs <radice>`, un oggetto JSON su stdin) e **cablato in nessun
passo**: la consegna non inventa un invocatore, e resta un gesto dell'agente o dell'owner. Conta da
**disco** quattro voci — `head` (i byte del contratto condiviso: `contracts/orchestration.md` e
`contracts/project-contract.md`), `invocations` (le fasi del giro, contate nel blocco `PHASES` di
`architect/architect.mjs`, più i round dei ledger che il chiamante nomina), `return` (i byte degli
artefatti depositati), `always_loaded` (i byte di `{memory.index}`, del file di istruzioni e dei
`description` delle skill) — e vi aggiunge i `tokens` **solo dove il ledger li riporta** (il campo
`cost`): dove non ci sono, `null`, e **mai una stima**. Non legge lo schema per-riga del transcript,
dichiarato interno e mutevole fra versioni. Fallisce rumorosamente, col suo banco in
`hooks/self-check.mjs`.

**L'hook che misura e non nega — `hooks/lib/subagent-advice.mjs`.** Il settimo hook, su due eventi e
**senza negare niente**: a `SubagentStart` consegna a ogni figlio l'**unica affermazione di
concisione** del pacchetto — il blocco di ritorno resta intero, la prosa intorno è dove un report
cresce — in forma **fattuale e non imperativa** (una formulazione da comando di sistema fa scattare le
difese anti-prompt-injection); a `PreToolUse` sui tool di lancio (`Agent`/`Task`) nomina un prompt
oltre il `subagent.prompt_cap` del progetto. Non tocca il prompt: **nessun `permissionDecision`,
nessun `updatedInput`**. `SubagentStart` scatta **una volta per figlio**, quindi nessun marker
anti-doppione.

**La misura del contenuto — `payload`.** Un blocco di ritorno che porta contenuto e non un path
dichiara la sua misura in `payload: {bytes, lines}`; un passo che ha passato solo un path non ha il
campo (`contracts/orchestration.md` §4). È solo una misura: nessun passo taglia il contenuto che
attraversa.

**La chiave del progetto.** `subagent.prompt_cap` (i caratteri di un prompt di lancio) sta in
`.daiku/project.json` (gruppo `subagent`), con la riga in §4 di `contracts/project-contract.md` e lo
specchio `schemas/blocks.json` § params. Nasce **spenta**: senza di essa l'hook tace la dimensione
invece di indovinare una soglia (§6).

**Why.** Nessuna delle quattro voci era misurata, e una leva senza il numero che la giustifica è una
stima dichiarata: il metodo già conosce il costo di un divieto affidato alla sola prosa. Ma qui la
scelta dell'owner è **misurare prima di levare** — il presidio della testa **misura soltanto**, e la
**modifica** del prompt (appendere i valori già risolti) **resta non presa**, perché un hook che
riscrive l'input in silenzio può sorprendere. La voce del sempre-caricato l'owner l'ha chiusa con
**«niente»**: si **misura** (dentro `cost.mjs`) ma **non** si aggiunge né soglia né avviso — non si
riduce il corpus per decreto.

**How to apply:** `cost.mjs` si invoca per path come gli altri programmi di `architect/` (radice per
argomento, JSON su stdin, `--self-check` a totale contato); il suo banco gira con
`node plugins/daiku/hooks/self-check.mjs`. Il taglio del contenuto che attraversa un passo non si propone: vedi
[[nessun-taglio-del-contenuto]]. Vedi [[alberatura-pacchetto]] per dove stanno,
[[valutatore-deterministico]] e [[guardrail-nascono-spenti]] per gli altri programmi e per la
disciplina delle due sedi, [[confine-del-giro]] per la leva che ricorda e non nega.
