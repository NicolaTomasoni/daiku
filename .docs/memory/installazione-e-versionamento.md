---
name: installazione-e-versionamento
description: "I comandi di installazione e aggiornamento sui due host, cosa governa l'aggiornamento, il cachebuster di Codex in sviluppo locale e il terzo canale di distribuzione"
metadata:
  node_type: memory
  type: project
  originSessionId: 74fa8bc9-dbb1-4c77-bf91-e6ec34544097
  modified: 2026-09-30T13:27:32.355Z
---

**I comandi, verificati il 18 settembre 2026.** Su Claude Code `/plugin marketplace add
<owner>/<repo>`, `/plugin install daiku@<marketplace>`, `/plugin update daiku@<marketplace>`, e in
non interattivo `claude plugin install daiku@<marketplace> --yes`. Su Codex `codex plugin
marketplace add <owner>/<repo> [--ref <tag>] [--sparse <path>]`, poi `codex plugin add
daiku@<marketplace>` e `codex plugin marketplace upgrade daiku`. `codex plugin` esiste in
`codex-cli 0.155.0` coi sottocomandi `add`, `list`, `marketplace`, `remove`, e `marketplace add`
accetta un path locale, `owner/repo[@ref]`, un URL Git HTTPS o SSH.

**Il marketplace personale non si registra.** `~/.agents/plugins/marketplace.json` è scoperto
implicitamente da Codex: per quel path `codex plugin marketplace add` non va usato. Si registrano
solo i marketplace non-default.

**La forma di una voce di marketplace**, verificata: `policy.installation`, `policy.authentication`
e `category` sono tutti e tre obbligatori. La radice porta `name`, un `interface.displayName`
opzionale e `plugins[]`, il cui **ordine è l'ordine di resa** nella UI di Codex. `source.path` è
relativo alla radice del marketplace, che sta **due livelli sopra** il `marketplace.json`.

**Cosa governa l'aggiornamento: il campo `version` del manifest, in semver stretto.** Si bumpa
quello e i due host tirano la versione nuova; finché non si bumpa, nessuno aggiorna. Claude Code
tiene ogni versione in una cartella propria e conserva le orfane per 14 giorni.

**Su Claude Code l'aggiornamento da riga di comando è in due tempi**, verificato il 30 settembre
2026 su `claude` 2.1.276 con `--help`: `claude plugin marketplace update [name]` («Update
marketplace(s) from their source»), poi `claude plugin update <plugin>` («Update a plugin to the
latest version (restart required to apply)»). Il pacchetto li porta al progetto ospite in
quest'ordine, come task VS Code `daiku: update` che `init` deposita. Che `plugin update` da solo non
rinfreschi il catalogo del marketplace è un'assunzione, non una prova.

**In sviluppo locale, su Codex, il bump non è la via: c'è il cachebuster.** Si sostituisce il
suffisso dopo `+` nella versione — `0.1.0` → `0.1.0+codex.local-20260918-143000` — e si reinstalla
con `codex plugin add <nome>@<marketplace>`. Il suffisso si **rimpiazza**, non si accumula, e i
componenti numerici non si incrementano solo per forzare la reinstallazione. Poi serve **un thread
nuovo**: è il confine oltre il quale Codex rilegge skill e tool. Per le estensioni Codex non esiste
**nessun** meccanismo npm — npm è solo il modo in cui si distribuisce la CLI `codex` stessa.

**Il terzo canale, più corto del pacchetto.** Codex porta una skill di sistema, `skill-installer`,
che installa skill **da un qualunque repository GitHub** dentro `$CODEX_HOME/skills/<nome>`, con
download diretto o ripiego a sparse checkout, anche da repo privati, senza manifest, marketplace né
policy. È la via più breve per distribuire il solo livello Metodo, e vale su entrambi gli host —
Claude Code legge `~/.claude/skills/`. Il prezzo è dichiarato: si perdono versionamento,
aggiornamento comandato e tutto ciò che non è una skill. Se la macchina del pacchetto diventasse
troppo cara da mantenere su due host, è lì che si ripiega.

**Why:** la forma breve `owner/repo` la accettano entrambi gli host solo per GitHub, ed è ciò che
tiene le istruzioni di installazione corte — vedi [[pubblicazione-su-github]].

Vedi [[cosa-i-due-host-accettano]] e [[cosa-codex-fa-allinstallazione]].
