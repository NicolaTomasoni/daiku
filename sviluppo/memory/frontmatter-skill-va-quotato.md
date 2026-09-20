---
name: frontmatter-skill-va-quotato
description: "I valori del frontmatter di una SKILL.md vanno quotati, altrimenti la skill si carica coi metadati vuoti e nessuno la trova"
metadata:
  type: project
---

Nel frontmatter di una `SKILL.md` i valori di `description` e `argument-hint` vanno **quotati con
apice singolo** (l'apice interno si raddoppia). Quando il difetto fu trovato, il 18 settembre 2026,
otto contratti su diciotto avevano YAML non valido; oggi i contratti sono diciannove e l'albero
passa entrambi i validatori.

**Why:** i file nascevano come `commands/*.md`, e il parser dei comandi tollerava quello che
quello delle skill rifiuta. Due difetti distinti: un valore non quotato che contiene `: ` chiude
la chiave a metà — succede in ogni `description` con un incìso — e uno che comincia con `[`
viene letto come sequenza di flusso — succede in ogni `argument-hint`, che è fatto di
`[cartella] [soluzione]`.

**How to apply:** quando scrivi o modifichi una `SKILL.md`, quota sempre `description` e
`argument-hint`. Il guasto è silenzioso nel modo peggiore: Claude Code lo segnala come *«at
runtime this skill loads with empty metadata (all frontmatter fields silently dropped)»* — la
skill non sparisce, si carica senza descrizione, quindi il modello non la trova mai per
pertinenza e nessuno capisce perché.

Si verifica con `claude plugin validate <pacchetto>` e con il validatore Codex in
`~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py` (vuole `pyyaml`).
Entrambi lo prendono.

**Passare i validatori non vuol dire che la regola sia rispettata**, ed è il motivo per cui questa
memoria esiste: un `argument-hint` non quotato che comincia con `[` è una **sequenza di flusso**
YAML, quindi il valore si carica come lista invece che come stringa, e nessuno dei due validatori
lo segnala perché una lista è YAML valido.

Al 19 settembre 2026 il pacchetto è **pulito**: tutti e diciannove i contratti hanno ogni valore
di frontmatter quotato, verificato caricandoli uno per uno con `yaml.safe_load` e controllando che
ogni campo torni una stringa. È quel controllo, non il validatore, a dire se la regola è
rispettata.

Vedi [[alberatura-pacchetto]].
