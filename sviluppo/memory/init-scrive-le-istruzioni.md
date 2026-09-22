---
name: init-scrive-le-istruzioni
description: "init scrive il file di istruzioni del progetto ospite — il divieto precedente è stato ribaltato, e le tre cose che lo contengono"
metadata: 
  node_type: memory
  type: project
  originSessionId: bb0219dd-76c8-4a09-bf9b-4cb040132a6e
  modified: 2026-09-19T19:09:39.682Z
---

Dal 19 settembre 2026 `init` **scrive il file di istruzioni** del progetto ospite (`CLAUDE.md` o
`AGENTS.md`), partendo da `templates/project/instructions.md` e compilandolo con quello che legge
nel repository. Se il file esiste, lo riscrive conservando verbatim ciò che è di merito.

**Why:** fino al giorno prima il contratto lo vietava, e con una motivazione che *non è stata
smentita*: «un file di istruzioni generato da un modello che ha letto la struttura per dieci
minuti è esattamente il tipo di file che poi nessuno si fida di cancellare». Il divieto è caduto
perché lasciava a metà la cosa più importante — su molti repository quel file non esiste, e senza
di esso ogni skill che cita `{instructions_file}` degrada in silenzio per sempre. Chi rileggesse
oggi quella frase e la trovasse ancora giusta avrebbe ragione: il punto è che ora è **contenuta**,
non revocata.

**How to apply:** le tre cose che la contengono si tengono insieme, e toglierne una riapre
esattamente il problema che la vecchia regola temeva.

- **La prosa già scritta nello scheletro è un default del pacchetto, non un'invenzione della
  sessione** — *Behaviour*, *Git and commits*, le quattro hard rule coi loro slug. Si copia com'è.
  Nessuno la sta deducendo da questo repository perché non parla di questo repository.
- **Un invariante si scrive solo dove lo si è visto affermato**: in un file di istruzioni che
  c'era già, in un documento del repository, o in una regola che la struttura rispetta senza
  eccezioni visibili. Mai dedotto da un'architettura intravista. Nel dubbio finisce fra le cose da
  compilare, non fra le hard rule.
- **Il file si riscrive una volta sola.** In fondo allo scheletro c'è una riga di commento
  `daiku:instructions`: se `init` la trova, lascia stare il file. È l'unica eccezione
  all'idempotenza di `init`, ed è sicura solo finché quella riga esiste — senza, ogni rilancio
  ristrutturerebbe il file che l'utente tocca più di ogni altro.

Nella stessa giornata è caduta anche la variante di lingua degli scheletri: **tutto ciò che `init`
deposita è in inglese**, e le due chiavi `language.chat` e `language.commit` riguardano solo come
le skill parlano all'utente e cosa lasciano nei commit. Le cartelle `templates/project/domain/it/`
e `policies/it/` non esistono più, i loro gemelli `en/` sono stati appiattiti di un livello. La
sede della regola è la §5.6 di `contracts/project-contract.md`. Il 22 settembre 2026 anche le skill, i contratti
e gli hook sono passati all'inglese: il pacchetto è tutto in una lingua, e il confine con
l'italiano coincide con quello fra `plugins/daiku/` e il corpus di sviluppo. Vedi [[tre-livelli-di-parametro]] e
[[alberatura-pacchetto]].
