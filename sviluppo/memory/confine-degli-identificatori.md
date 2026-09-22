---
name: confine-degli-identificatori
description: "Quali nomi si possono rinominare dentro il pacchetto e quali no: il confine non è fra prosa e codice, è fra chi può aggiornare ogni lettore e chi no"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 126222c9-8135-4944-abbf-63c9ec0d2502
  modified: 2026-09-22T11:51:40.315Z
---

Il 22 settembre 2026, tradotto `plugins/daiku/` in inglese, l'owner ha **ribaltato la Regola 1 di
`/translate-skill`**, che fino a quel giorno diceva «traduci prosa e commenti, **mai** gli
identificatori» ed elencava fra gli intoccabili «nomi di variabili e funzioni, schemi JSON, nomi
di chiavi JSON». La traduzione li aveva rinominati tutti lo stesso; invece di ripristinarli, la
regola è stata riscritta attorno a quello che la traduzione aveva dimostrato.

**Il confine ora è questo: un identificatore *di confine* è un nome che qualcuno nomina da fuori
e che non puoi aggiornare insieme.** Quelli non si toccano mai:

- il `name` del frontmatter, i placeholder `{…}`, `$ARGUMENTS` e ogni `$…`;
- le chiavi di `project.json` e `environment.json`, che stanno **compilate nei file di un utente**;
- i nomi di campo dei blocchi di ritorno che le skill si scambiano, e i loro valori enum;
- i nomi dei file che il metodo deposita (`0. problem.md`, `2. blueprint.md`, …), già su disco
  nelle cartelle di lavoro aperte;
- path, comandi letterali, numeri di sezione e di versione.

Tutto il resto — variabili, funzioni, parametri, costanti, chiavi di oggetti interni, nomi dei
casi di prova — **si traduce con la prosa**, a una condizione sola: aggiorni ogni lettore nello
stesso diff, e lo **provi** con le tre prove che la regola scrive accanto a sé (il `grep` del nome
vecchio a vuoto su `plugins/`, `.claude/` e `.agents/`; il banco degli hook verde **con lo stesso
totale di prima**; i due validatori). Se non puoi fare tutte e tre, quel nome è di confine.

**Why:** la vecchia regola sembrava prudente e non lo era. Proibiva anche le rinomine che nessuno
può sbagliare — una variabile locale di `command-guard.mjs` la legge solo `command-guard.mjs` — e
in cambio produceva un pacchetto inglese con le variabili in italiano, cioè tradotto a metà, dove
chi legge non sa più quale delle due lingue sia quella che conta. Il rischio vero non sta nel tipo
del nome (variabile, chiave, campo): sta in **chi lo legge**. Un nome letto solo da file che stai
già toccando è sicuro; un nome letto da un file su una macchina che non vedi non lo è mai, fosse
anche una sola parola.

La prova del totale del banco è la parte che conta davvero: una rinomina incompleta lascia un banco
che non gira più, e un banco che non gira esce **verde** esattamente come uno che gira. Il verde
da solo non distingue i due casi; il numero sì. Vale la regola generale di [[guardrail-nascono-spenti]]
e del «mai fidarsi di un LLM» di `CLAUDE.md`: il divieto vive in due sedi, il testo e il controllo.

**How to apply:** prima di rinominare qualunque cosa dentro `plugins/daiku/`, chiediti chi legge
quel nome, non che tipo di nome è. Se la risposta include qualcuno fuori dal diff — un utente, un
progetto già aperto, una macchina che non vedi — fermati. Altrimenti rinomina e lancia le tre
prove, tutte e tre, prima di dire che hai finito.

Vedi [[tre-livelli-di-parametro]], [[corpus-di-sviluppo]] e [[punti-ingresso-prodotto]].
