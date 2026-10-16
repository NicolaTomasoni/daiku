---
name: due-host
description: "Il prodotto serve due host — Claude Code e opencode — mentre il cantiere ne dichiara uno solo; la mappa dei parametri resta una mappa per host"
metadata:
  node_type: memory
  type: project
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-14T18:01:27.000Z
---

**Il prodotto Daiku serve due host: Claude Code e opencode.** Non è un backend né un fornitore di
modello — è il CLI che esegue il giro, carica le skill e lancia i subagenti — e ogni sede che ne
dichiara uno ha il suo ramo per ciascuno dei due. Codex non è un host di Daiku.

**Il cantiere ne dichiara uno solo.** `{hosts}` in `.daiku/environment.json` di questo repository
porta il solo `claude`, perché è l'host su cui il cantiere gira: una voce sola lì è lo stato
dichiarato, non un residuo da ripulire.

**Lo scheletro del prodotto ne porta due.** `templates/project/environment.json` — quello che `init`
deposita nei progetti ospiti — dichiara `claude` e `opencode`, con `default_host` su `claude`. La
voce di opencode porta `instructions_file: "AGENTS.md"` e **nessun `enforcement`**: quel contratto
ammette `harness` e `prose`, e opencode non è né l'uno né l'altro — impone i permessi dal runtime ma
non copre il contenuto di un comando di shell — quindi la chiave si omette invece di dichiarare il
falso.

**Dove i due si separano.** Il ramo di delega di §4 di `contracts/orchestration.md` (per opencode il
tool è `subagent`, con il **nome** dell'agente come parametro); il ramo di § *Ask the owner* (il tool
`question`); la riga di `instructions_file` in §7 — `CLAUDE.md` di qua, `AGENTS.md` di là;
l'**ancora** alla radice di supporto, che di qua è la variabile sostituita dall'host e di là va
**calcolata** dalla base directory della skill, perché opencode non sostituisce nessuna variabile; la
resa del ruolo in `agents/` — la radice per Claude Code, `agents/opencode/` per opencode, e il
controllo del corpus impone che ogni host renda ogni ruolo; il **canale**, che di qua è
l'installazione da un marketplace e di là il **deposito dentro il progetto**, con l'annidamento che di
là si dichiara in `experimental.subagent_depth` e di qua non esiste ([[deposito-opencode]]); la **sede
delle guardie**, `hooks.json` di qua e un plugin-adattatore di là; la **memoria dell'host** dello
*Step 7* di `init`, che è una sede che opencode non ha e che `init` lì **dichiara** assente
([[init-aggancia-la-memoria]]). Su opencode le regole di permesso **tolgono davvero il tool** al
modello, quindi il read-only del finder è imposto dalla costruzione e non solo dalla prosa.

**Why:** aggiungere un host non è una sede in più, è una superficie che si moltiplica — due rami di
delega, due rese di ruolo, due file di istruzioni, due vie di installazione — e il costo si paga a
ogni aggiornamento dell'host. È una scelta dell'owner, non una conseguenza tecnica.

**How to apply:** prima di scrivere una sede che nomina un host, chiedersi se vale per entrambi; una
sede scritta per un host solo o ha il suo ramo, o dichiara di non coprire l'altro. La mappa con una
voce sola nel **cantiere** non riapre la domanda «perché una mappa per un host solo?». Vedi
[[tre-livelli-di-parametro]], [[alberatura-pacchetto]] e [[guardrail-nascono-spenti]].
