---
name: fase-strategica-non-si-salta
description: "Il giudizio di stadio di decision-doc chiede di chi è la direzione e se è stata messa alla prova: quattro segnali che vietano il tecnico, quattro campi del blocco e undici regole nel valutatore"
metadata:
  node_type: memory
  type: feedback
  modified: 2026-10-02
  originSessionId: 9d0e0f3c-20c8-430f-9f2e-80b298a2abee
---

Dal 30 settembre 2026 il nodo `decision-doc` **non** chiede più «esiste già una direzione scritta?»
ma «**la direzione è dell'owner, ed è stata messa alla prova?**». Le due domande coincidono solo se
il brief dell'owner è un oracolo, e non lo è: è il primo input. Chi apre una feature con un'analisi,
un piano o una lista di punti di implementazione ha **proposto** una direzione, non l'ha chiusa — e
quel materiale è `material`, non una direzione da eseguire.

Quattro segnali vietano lo stadio `technical`, e ognuno basta da solo:

1. **Nessuna domanda di direzione nella lista.** Solo *come*, nessun *se*, *per chi*, *chi decide*:
   è la strategia data per scontata, non una prova di maturità.
2. **Un precedente che dice l'opposto.** Una decisione già chiusa, in memoria o in `{paths.features}`,
   che questo lavoro contraddice è una **domanda per l'owner** — *avevi rinunciato a questo; cosa è
   cambiato?* — mai una nota liquidata per deduzione.
3. **Una strategia giustificata dai documenti della catena stessa.** Se l'unico modo di dichiarare
   assestata la direzione è citare `0. problem.md` o una passata precedente di `1. decision-doc.md`,
   non è assestata: un documento non può validare la propria premessa.
4. **Una premessa portante mai verificata.** Le frasi su cui poggia la soluzione si verificano come
   si verifica un'asserzione sul codice: senza fonte non sono premesse, sono atti di fede.

Quattro campi del blocco le rendono dichiarabili e controllabili: `direction` (di chi sono le parole
che hanno fissato la direzione — `owner-request`, `owner-answer`, `material`; al tecnico valgono solo
i primi due), `premises` (le frasi su cui la soluzione poggia, ciascuna con la fonte che la
corrobora: mai vuoto al tecnico, `[]` allo strategico), `precedents` (le decisioni già chiuse che
toccano il problema: una che non regge è `stands: no` e nomina in `answered_by` la decisione della
lista che la rimette all'owner, mentre una che lo stadio strategico di questa stessa catena ha già
chiuso è `stands: closed-elsewhere`, con in `closed_by` la decisione che l'ha chiusa e dove è
scritta) e `crossed_stages` (se questa invocazione ha attraversato i due stadi: `true` esattamente
quando lo stadio è tecnico, `incorporated` non è vuoto e `decisions` è una lista non vuota — la lista
nuova che l'owner non ha mai visto, e che per questo va richiesta).

**Why:** è una sessione reale su un progetto ospite, che doveva tradurre i suoi script di build in
descrittori Maven. Il brief arrivava con un piano di implementazione e un elenco di decisioni
aperte; la catena l'ha letto come direzione stabilita, e `decision-doc` ha reso `technical` due
volte — otto e poi nove decisioni, tutte della forma «A o B su una forma tecnica», zero domande di
direzione. La premessa centrale — «tutto ciò che sta a valle parla Maven» — è caduta alla prima
verifica: ciò che sta a valle vuole classi compilate e un classpath, non un POM. Il repository
conteneva il precedente opposto, una rinuncia dell'owner di tre settimane prima, citata in una riga
e superata per deduzione. Nessuna di quelle scelte è mai stata presentata all'owner: la domanda è
arrivata da lui, e ha smontato lo studio.

**How to apply:** la prosa sta in `plugins/daiku/skills/decision-doc/SKILL.md` § *The two stages*
(i quattro segnali) e § *The block you return* (i quattro campi); il dominio dei campi in
`schemas/blocks.json` § *decision-doc*; le regole in `SHAPES['decision-doc']` di
`architect/architect.mjs`, dove un blocco `technical` con `direction: material`, con `premises`
vuoto, o con `crossed_stages` che non concorda coi fatti, è **invalido**: è un blocco che è
**tornato**, e si rilancia una volta col motivo che la validazione ha detto, non col prompt
identico. Le undici regole si lanciano con `node plugins/daiku/hooks/self-check.mjs`, e ognuna vuole
una fixture che la renda rossa: il banco riporta `never_red` e fa rosso un banco tutto verde con una
regola mai vista fallire (vedi [[valutatore-deterministico]]). `new-feature` porta nel prompt di
`decision-doc` il materiale con cui la richiesta è arrivata, come materiale da interrogare, e
riporta all'owner `direction` e `premises` prima di porgli le domande.

Vedi [[punti-ingresso-prodotto]].
