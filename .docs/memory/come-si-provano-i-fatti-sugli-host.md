---
name: come-si-provano-i-fatti-sugli-host
description: "Come si stabilisce un fatto su Claude Code o Codex — la specifica di prima parte su disco, le sei mosse in ordine di costo, e l'ambiente di questa macchina"
metadata:
  type: feedback
---

**Un fatto su un host è un fatto solo dopo essere passato dall'host.** La documentazione, prima di
parte compresa, è stata smentita due volte in un giorno: la «Field guide» dello stesso riferimento
di `plugin-creator` mostra `"hooks": "./hooks.json"` nel JSON d'esempio, ed è sbagliata — le note di
validazione in fondo allo stesso file la contraddicono. Vince il validatore.

**La fonte da leggere per prima è la specifica su disco, non il web.** `~/.codex/skills/.system/`
porta cinque skill di sistema preinstallate, fra cui `plugin-creator` (lo schema e il validatore
`scripts/validate_plugin.py`), `skill-creator` e `skill-installer`: sono ciò che l'host **esegue**,
e battono la documentazione perché non possono essere disallineate da esso. La documentazione web
intanto si è spostata: `developers.openai.com/codex` fa 308-redirect verso
`learn.chatgpt.com/docs/*`, i `docs/*.md` nel repo `openai/codex` sono stub che rimandano lì, e
l'indice è `https://learn.chatgpt.com/llms.txt`.

**Le mosse, in ordine di costo crescente.** (1) Leggere la specifica di prima parte. (2) Far girare
lo scaffold ufficiale e guardare cosa produce davvero: `create_basic_plugin.py daiku-prova
--with-skills --with-hooks --with-scripts` ha prodotto **solo** il manifest, nessuna cartella
`hooks/` e nessun campo `hooks`, malgrado il flag — un flag dello scaffold non prova che l'host
accetti il campo. (3) Passare al validatore un manifest **volutamente mutato**: è ciò che produce
l'elenco dei rifiuti, e i rifiuti verbatim sono la prova. (4) Validare il caso pulito, per sapere
che il rifiuto veniva dal campo e non dall'albero. (5) Installare per davvero, guardare cosa fa
l'host e disinstallare. (6) `codex features list`, che chiude le questioni sui gate di feature senza
aprire una sessione. Solo i fatti sul comportamento dei subagent hanno richiesto sessioni vere
(`codex exec --json`): sei turni su un repo vuoto con due ruoli.

**L'ambiente di questa macchina, al 19 settembre 2026.** Codex è installato — `codex-cli 0.155.0` —
con `npm install -g @openai/codex`, e non era nel `PATH`. Il `model` dichiarato in `config.toml`
(`gpt-5.2`) **non è servibile da questo account**: una sessione che parte con quello muore con
`400 · The 'gpt-5.2' model is not supported when using Codex with a ChatGPT account`. I validi li
elenca `codex debug models` — `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra` — e finché
quella riga resta lì va passato `-m` a mano a ogni invocazione. Ogni prova è stata chiusa
riportando l'ambiente allo stato iniziale: pacchetto e marketplace di prova rimossi, `config.toml`
senza una riga di residuo.

**Resta non provato** un solo fatto: interrogare una sessione Codex su quali skill vede. Non è più
un ostacolo tecnico, ma una risposta che le skill di sistema danno già per iscritto e che non vale
la quota.

**Why:** un fatto sugli host finisce nei contratti del pacchetto, che decidono cosa Daiku può
portarsi dietro; se è sbagliato, sbaglia in silenzio su una macchina che non è questa e non si vede
in locale — è il caso del manifest Codex che dichiarava cartelle che il validatore rifiuta.

**How to apply:** prima di scrivere in un contratto che «l'host fa X», chiedersi con quale delle sei
mosse lo si è stabilito. Se la risposta è «lo dice la documentazione», non è stabilito: si prova, o
si scrive che è un'assunzione. E una prova si annota con il comando e la data, perché è ciò che la
rende ripetibile e smentibile.

Vedi [[cosa-i-due-host-accettano]], [[cosa-codex-fa-allinstallazione]],
[[installazione-e-versionamento]] e [[subagent-codex-nessun-confine]].
