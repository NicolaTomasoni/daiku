---
name: subagent-codex-nessun-confine
description: "Su Codex i ruoli di subagent esistono e si scrivono in .codex/agents/*.toml, ma sandbox_mode lì dentro non è imposto — il confine resta prosa"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7ccc83c3-3daf-4c54-a155-05dbf01cc3f8
  modified: 2026-09-19T13:47:12.400Z
---

Codex ha i subagent per ruolo: un file TOML per ruolo, in `<repo>/.codex/agents/` o
`~/.codex/agents/`, con `name`, `description` e `developer_instructions` obbligatori. Le
istruzioni arrivano davvero al figlio. **`sandbox_mode` scritto lì dentro no**: un subagent che
dichiara `read-only` scrive comunque i file che gli si chiedono.

**Why:** provato il 19 settembre 2026 su `codex-cli 0.155.0`, con e senza `--enable
multi_agent_v2`. Non è un difetto di Windows: la stessa sandbox a livello di **sessione**
(`codex exec -s read-only`) rifiuta la scrittura con `patch rejected: writing is blocked by
read-only sandbox`. È la dichiarazione per ruolo a non arrivare da nessuna parte. Che il file sia
comunque letto è provato con una parola-spia nelle istruzioni: il subagent l'ha riportata nella
stessa risposta in cui scriveva il file.

**How to apply:** i ruoli si scrivono lo stesso — `sync-host` li genera dai `agents/*.md` del
pacchetto, e servono a far arrivare il contratto al figlio senza ricopiarlo nel prompt. Ma **non
scriverci `sandbox_mode`**: dichiarerebbe un confine che nessuno impone, e chi legge smetterebbe
di ripetere il vincolo nel prompt. Su Codex `{hosts.codex.enforcement}` resta `prosa`, e
l'unico confine vero dell'host è la sandbox di sessione, che sceglie chi lancia Codex.

Per le prove riga per riga, §3.6 di `sviluppo/RICOGNIZIONE.md`. Vale la pena ricordare che anche
su Claude Code il confine è parziale: la riga `tools:` toglie davvero Edit e Write, ma
`Bash(git diff:*)` non restringe nulla. Vedi [[alberatura-pacchetto]] e
[[tre-livelli-di-parametro]].

Una sessione Codex va aperta passando `-m` a mano: il `model` di `config.toml` (`gpt-5.2`) non è
servibile da questo account. I validi li elenca `codex debug models`.
