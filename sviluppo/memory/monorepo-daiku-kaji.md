---
name: monorepo-daiku-kaji
description: "Daiku e Kaji si sviluppano nello stesso repository ma sono due prodotti autonomi — dove sta ciascuno, cosa condividono e la regola che li tiene separati"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-25T18:08:22.737Z
---

Dal 25 settembre 2026 questo repository ospita due prodotti: **Daiku** (`plugins/`, con il
pacchetto in `plugins/daiku/`) e **Kaji** (`extensions/kaji/`), un'estensione VS Code che mostra quale agente, provider e modello
stanno lavorando e cambia ciò che il runtime permette di cambiare. Kaji è un nome di lavoro:
`sviluppo/kaji/BRANDING.md` propone *Kaname*, e il nome definitivo è un punto aperto.

Kaji è arrivato con la sua storia (merge `5b2d198`, due commit), dal repository GitLab
`claude-code-router-extension`. I suoi documenti di progetto stanno in `sviluppo/kaji/`
(`README.md` prodotto, `TECH-STACK.md` architettura, `BRANDING.md` nome); in `extensions/kaji/`
per ora ci sono solo `.gitignore` e `.gitattributes`, perché il codice non è ancora cominciato.

In radice non entra nessun file di prodotto: `plugins/` ed `extensions/kaji/` sono ciascuna per
intero la radice del repository pubblico del proprio prodotto (vedi [[alberatura-pacchetto]]).

**Why:** i due prodotti si parlano. Kaji ha già in disegno la F17, *Subagent observability*, che è
esattamente la vista degli agenti che Daiku orchestra; e `plugins/daiku/contracts/orchestration.md`
§2 presuppone uno switcher che rimappi gli alias di modello sul backend reale, che è il mestiere di
Kaji. Svilupparli insieme tiene allineato il formato che si scambiano nello stesso commit. Ma chi
usa Claude Code senza Daiku deve poter usare Kaji, e viceversa: per questo restano **prodotti
autonomi**, con repository pubblici separati.

**How to apply:**

- **Nessuno dei due alberi legge, importa o copia un file dell'altro.** Ciò che condividono è un
  contratto versionato che ciascuno porta dentro di sé; se l'altro manca, si degrada in silenzio.
  Una funzione di Kaji che richiede Daiku installato è un difetto, e viceversa.
- Il contratto comune ancora non esiste: la prima forma attesa è lo schema degli eventi degli
  agenti — Daiku sa ruolo e fase della catena, Kaji sa modello, token e costo. Dove vive e chi lo
  possiede è un punto aperto.
- Resto in comune: `sviluppo/` (memoria, punti aperti, nuovi sviluppi), `CLAUDE.md`, `.claude/`.
  Le skill di `.claude/commands/` però sono tutte scritte sulla forma di Daiku; portarle su Kaji è
  una decisione da chiedere, non da prendere (vedi [[corpus-di-sviluppo]]).
- La regola d'inglese di `CLAUDE.md` vale per `plugins/daiku/`. Per `extensions/kaji/` la lingua è
  un punto aperto: `TECH-STACK.md` P21 fissa una UI in italiano, il Marketplace chiede inglese.
