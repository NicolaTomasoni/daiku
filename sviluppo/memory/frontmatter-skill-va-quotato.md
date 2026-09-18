---
name: frontmatter-skill-va-quotato
description: I valori del frontmatter di una SKILL.md vanno quotati, altrimenti 8 contratti su 18 non caricano
metadata:
  type: project
---

Nel frontmatter di una `SKILL.md` i valori di `description` e `argument-hint` vanno **quotati con
apice singolo** (l'apice interno si raddoppia). Senza quote, otto contratti su diciotto avevano
YAML non valido.

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
Entrambi lo prendono. Vedi [[alberatura-pacchetto]].
