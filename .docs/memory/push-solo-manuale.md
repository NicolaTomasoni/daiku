---
name: push-solo-manuale
description: "il push non parte mai da solo — le tre sedi che lo negano nel cantiere, e il buco che le ha fatte scrivere: uno script che pushava al posto dell'owner"
metadata:
  type: project
  modified: 2026-10-05T00:00:00.000Z
---

Il push è un gesto manuale dell'owner, e **tre sedi** lo impongono nel cantiere:

- **`.claude/settings.json`** — `permissions.deny` su `git push`, `git push:*` e `git -C * push:*`.
  È la porta che l'hook non chiude: una permission rule dell'host sta sopra ogni altra regola e non
  la si aggira con un wrapper. Provata col dry-run, che è stato negato.
- **`.daiku/project.json`** — accende il gate del pacchetto su questo repository, e da lì il
  command-guard nega `git push`, `--no-verify` e le firme dell'agente. Vedi [[guardie-di-macchina]].
- **`.docs/tools/check-no-push.mjs`** — scansiona gli script del cantiere e segnala chi invoca un
  push. Col suo banco (`--self-check`), e si lancia prima di un rilascio accanto agli altri.

**Il buco che le ha fatte scrivere.** Il 30 settembre 2026 un rilascio è uscito prima che l'owner lo
decidesse: lo script di pubblicazione pushava **da sé**, e nessuna guardia poteva vederlo — il gate
di Daiku era spento, perché il cantiere non aveva il suo `project.json`, e comunque un hook legge la
**riga di comando**, non dentro uno script. La riga che l'agente digita è lo script.

**Why:** un divieto che vive solo nella prosa è un divieto che un agente può non leggere — e
«non pushare» era scritto in tre contratti mentre lo script pushava. La lezione non è «scrivere
meglio»: è che ogni divieto che conta ha bisogno di una sede che lo esegue, e dove la sede non
esiste il divieto non esiste. Vedi [[daiku-versionato]] per la stessa dottrina applicata al gate.

**How to apply:** quando aggiungi uno script al cantiere, non fargli fare il push — il commit sì,
il push no. `check-no-push.mjs` te lo ricorda, ma il controllo legge gli script, non le intenzioni:
se un giorno servisse davvero un push automatico, va deciso dall'owner e il controllo va cambiato
con lui, non aggirato. Dal 5 ottobre 2026 il cantiere non ha più script di pubblicazione: il
rilascio scrive un ref locale e si ferma, e il push di `develop` e di `main` è dell'owner —
[[pubblicazione-su-github]].
