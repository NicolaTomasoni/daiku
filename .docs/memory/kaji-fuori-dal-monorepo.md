---
name: kaji-fuori-dal-monorepo
description: "Dal 26 settembre 2026 Kaji si sviluppa fuori dal repo Daiku, in C:/dev/Kaji come progetto ospite"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-26T19:05:02.052Z
---

Dal 26 settembre 2026 Kaji non sta più in `extensions/kaji/`: vive in `C:/dev/Kaji` come
repository autonomo, con la versione evoluta dei documenti (README rigenerato il 24 settembre,
TECH-STACK, BRANDING, `.gitignore` in inglese, `.gitattributes`). La copia vecchia in italiano con
CRLF è stata sostituita; le tre righe che dicevano "monorepo" sono state riscritte sul posto (dove
vive, radice del prodotto, CI senza `working-directory`).

**Why:** usare Daiku per sviluppare Kaji come progetto ospite — `init` con radice tecnica in
`C:/dev/Kaji` — invece che come area dello stesso repository: niente dominio mescolato, niente file
del metodo dentro l'albero pubblicato, gate di Kaji (`npm run check && npm run package`) separati
da quelli di Daiku.

**How to apply:**

- In questo repo non resta traccia di Kaji.
- Il remote di `C:/dev/Kaji` punta ancora al vecchio progetto GitLab
  `claude-code-router-extension`: la sede GitHub di Kaji non è decisa.
- Ciò che i due prodotti condividono resta un contratto versionato per copia, non un file letto
  dall'altro repository; se manca, chi lo cerca degrada in silenzio.

Vedi [[pubblicazione-su-github]] per le sedi e [[alberatura-pacchetto]] per cosa resta in radice.
