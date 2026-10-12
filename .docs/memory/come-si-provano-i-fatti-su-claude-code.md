---
name: come-si-provano-i-fatti-su-claude-code
description: "Come si stabilisce un fatto su Claude Code — il validatore batte la documentazione, le mosse in ordine di costo, e la prova si annota col comando e la data"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:08:34.058Z
---

**Un fatto su un host è un fatto solo dopo essere passato dall'host.** La documentazione, prima di
parte compresa, è stata smentita: un esempio in una guida contraddiceva le note di validazione in
fondo allo stesso file. Vince il **validatore** — `claude plugin validate <pacchetto>` — perché è
ciò che l'host **esegue**, e non può essere disallineato da esso come lo può essere la prosa.

**Le mosse, in ordine di costo crescente.** (1) Leggere la specifica di prima parte, cioè lo
strumento che l'host esegue prima della prosa che lo racconta. (2) Far girare lo scaffold ufficiale,
dove ce n'è uno, e guardare cosa produce davvero: un flag dello scaffold non prova che l'host accetti
il campo. (3) Passare al validatore un file **volutamente mutato** — è ciò che produce l'elenco dei
rifiuti, e i rifiuti verbatim sono la prova. (4) Validare il caso pulito, per sapere che il rifiuto
veniva dal campo e non dall'albero. (5) Installare per davvero, guardare cosa fa l'host e
disinstallare.

**Why:** un fatto sull'host finisce nei contratti del pacchetto, che decidono cosa Daiku può portarsi
dietro; se è sbagliato, sbaglia in silenzio su una macchina che non è questa e non si vede in locale
— è il caso di un manifest che dichiarava cartelle che il validatore rifiuta.

**How to apply:** prima di scrivere in un contratto che «l'host fa X», chiedersi con quale delle
mosse lo si è stabilito. Se la risposta è «lo dice la documentazione», non è stabilito: si prova, o
si scrive che è un'assunzione. E una prova si annota con il comando e la data, perché è ciò che la
rende ripetibile e smentibile. Vedi [[fatti-verificati-in-memoria]] e [[cosa-claude-code-accetta]].
