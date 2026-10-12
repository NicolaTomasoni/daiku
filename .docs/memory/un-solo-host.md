---
name: un-solo-host
description: "Daiku supporta un solo host, Claude Code: la superficie dei parametri resta una mappa per host con una voce sola, e collassarla è un refactor rimandato"
metadata:
  node_type: memory
  type: project
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:12:26.325Z
---

**Daiku supporta un solo host: Claude Code.** La scelta è dichiarata: Codex non è un host di Daiku,
e non ce n'è un altro in arrivo.

**La superficie dei parametri resta una mappa per host, con una voce sola.** `{hosts}` in
`.daiku/environment.json` porta il solo `claude`, e le chiavi continuano a leggersi
`{hosts.<host>.instructions_file}`, `{hosts.<host>.models.<role>}` e così via. **Il collasso in uno
scalare è un refactor rimandato, non fatto**: chi trova la mappa con una voce sola non ha davanti un
residuo da ripulire.

**Why:** togliere un host è una cosa, cancellare la forma che lo nominava è un'altra, e la seconda
tocca ogni chiave, il contratto e le skill che la citano. La mappa con una voce sola è dichiarata e
coerente; il collasso si fa quando serve, non perché la voce è una.

**How to apply:** la sessione che trova `{hosts}` con la sola voce `claude` non riapre la domanda
«perché una mappa per un host solo?» — la risposta è che il collasso è rimandato. La cartella-feature
che lo tiene è `.daiku/features/frame-delle-feature-di-contesto/`. Vedi
[[tre-livelli-di-parametro]] e [[alberatura-pacchetto]].
