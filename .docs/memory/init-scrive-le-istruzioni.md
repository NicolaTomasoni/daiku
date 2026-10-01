---
name: init-scrive-le-istruzioni
description: "init scrive il file di istruzioni del progetto ospite — il divieto ribaltato, le tre cose che lo contengono, la lingua del file esistente e le sei regole della fusione"
metadata: 
  node_type: memory
  type: project
  originSessionId: bb0219dd-76c8-4a09-bf9b-4cb040132a6e
  modified: 2026-09-30T12:10:29.559Z
---

Dal 19 settembre 2026 `init` **scrive il file di istruzioni** del progetto ospite (`CLAUDE.md` o
`AGENTS.md`), partendo da `templates/project/instructions.md` e compilandolo con quello che legge
nel repository. Se il file esiste, lo riscrive conservando verbatim ciò che è di merito.

**Why:** fino al giorno prima il contratto lo vietava, e con una motivazione che *non è stata
smentita*: «un file di istruzioni generato da un modello che ha letto la struttura per dieci
minuti è esattamente il tipo di file che poi nessuno si fida di cancellare». Il divieto è caduto
perché lasciava a metà la cosa più importante — su molti repository quel file non esiste, e senza
di esso ogni skill che cita `{hosts.<host>.instructions_file}` degrada in silenzio per sempre. Chi rileggesse
oggi quella frase e la trovasse ancora giusta avrebbe ragione: il punto è che ora è **contenuta**,
non revocata.

**How to apply:** le tre cose che la contengono si tengono insieme, e toglierne una riapre
esattamente il problema che la vecchia regola temeva.

- **La prosa già scritta nello scheletro è un default del pacchetto, non un'invenzione della
  sessione** — *Behaviour*, *Git and commits*, le quattro hard rule coi loro slug. Si copia com'è.
  Nessuno la sta deducendo da questo repository perché non parla di questo repository.
- **Un invariante si scrive solo dove lo si è visto affermato**: in un file di istruzioni che
  c'era già, in un documento del repository, o in una regola che la struttura rispetta senza
  eccezioni visibili. Mai dedotto da un'architettura intravista. Nel dubbio non si scrive.
- **Il file si riscrive una volta sola.** In fondo allo scheletro c'è una riga di commento
  `daiku:instructions`: se `init` la trova, lascia stare il file. È l'unica eccezione
  all'idempotenza di `init`, ed è sicura solo finché quella riga esiste — senza, ogni rilancio
  ristrutturerebbe il file che l'utente tocca più di ogni altro.

**Il 29 settembre 2026 l'owner ha chiuso quattro scelte che il ciclo di collaudo lasciava aperte**, e
ognuna ha ora anche la sua sede deterministica:

- **la forma della riga di un comando d'area**: la riga si apre con `<FILES>` solo dove l'apertura
  **non cambia il controllo** — `tsc --noEmit` con file espliciti ignora `tsconfig.json` — e dove non
  si apre è lo **script chiamato per nome** attraverso il package manager (`pnpm run typecheck`), non
  il suo corpo nudo, che non girerebbe;
- **l'inventario dello stack** non era imposto da niente: ora è la sezione da scrivere per intero,
  **una riga per pacchetto del workspace** e **aggiunta** a quelle del progetto, mai al posto loro;
- **i nomi dei tre blocchi del report** restano in inglese qualunque sia `language.chat`: sono la
  forma che una macchina legge, come i campi di un blocco di un agente;
- **il testo dentro i blocchi** è nella lingua della chat.

I controlli sono due assi nuovi del banco — l'inventario che nomina ogni pacchetto, e il file trovato
parcheggiato **intatto** — provati in rosso contro l'output dei giri che li violavano.

**Il file trovato non si riscrive sul posto: si parcheggia.** `init` lo rinomina scambiando
l'estensione con `.old` — `CLAUDE.md` diventa `CLAUDE.old`, mai `CLAUDE.md.old` — e scrive il nuovo
accanto. Il parcheggio compra due cose: l'host smette di caricare il vecchio, perché `.old` non è un
file che legge, e il testo originale resta **com'era** come materiale e come prova. Il parcheggiato è
la fonte migliore del nuovo file: quello che dice e il repository contraddice non si corregge in
silenzio, si dichiara nel report. Un `CLAUDE.old` già presente si sovrascrive: è la versione
precedente dello stesso file, accanto a `{hosts.<host>.instructions_file}`.

**La chiave è una per host, ed è scesa in `environment.json`.** Il file di istruzioni è di un host —
`CLAUDE.md` e `AGENTS.md` sono due file diversi — quindi la chiave vive in
`hosts.<host>.instructions_file` (§7 di `contracts/orchestration.md`), e le skill la citano così.
`init` la tiene solo per gli host il cui file esiste davvero, e **il file dell'altro host non lo
tocca e non lo parcheggia**: lo compila un `init` lanciato lì.

**Il 29 settembre 2026 si è aggiunta la parte che mancava: il file si compila, non si accoda.**
«Conservato verbatim» senza una regola di fusione produce, su un file scritto in un'altra lingua,
due file in uno — i blocchi inglesi dello scheletro e le righe italiane del progetto, la stessa
regola scritta due volte. Sei regole, in *Step 6*:

- **i titoli sono del file, dove il file li ha**: le sezioni che il progetto ha già strutturato
  tengono le proprie intestazioni, anche quando una è in un'altra lingua ed è diventata lessico del
  progetto. I titoli dello scheletro servono **solo** alle sezioni che il file non ha — rinominare
  un'intestazione che c'era già cambia la forma senza guadagno e rompe ogni rinvio che la nomina;
- **la numerazione delle hard rule è del progetto e non si riavvia**: le regole nuove prendono i
  numeri liberi successivi, perché il progetto cita le hard rule per numero dalle sue memorie e dai
  suoi documenti, e rinumerare fa mentire quelle citazioni. Solo un progetto che non numera riceve i
  numeri dello scheletro;

- **una regola, una riga**: prima di aggiungere si guarda se quella regola c'è già, in un'altra
  sezione o in un'altra lingua, e si sposta la riga esistente invece di scriverne una seconda. Se la
  regola è già scritta, **vince la riga del progetto** e il gemello dello scheletro si butta: quella
  del progetto è reale, quella dello scheletro è un default;
- **la lingua del file esistente è la lingua del file**: la prosa dello scheletro si porta in
  quella, e il file finisce in **una** lingua sola. La §5.6 del `project-contract.md` ha
  l'eccezione: l'inglese resta la lingua di ciò che `init` deposita, e di un file creato da zero.
  L'unica riga che resta in inglese anche dentro un file italiano è il commento marcatore
  `daiku:instructions` in fondo, che è del pacchetto e non del file: è ciò che rende sicura
  l'eccezione all'idempotenza, e tradurlo rischia il riconoscimento che serve;
- **una riga tenuta resta intera**: non se ne aggiunge, toglie o sposta una parola. Un qualificatore
  dello scheletro che la riga del progetto non ha — *per ogni agente, qualunque file sia aperto* —
  non vi si infila dentro: prende una riga sua, o cade se la riga del progetto la regola la dice già.
  Una riga cucita non è più né del progetto né del pacchetto, e nessuno sa più quale metà era
  osservata e quale era un default;
- **una sede o un path nominato dentro una riga tenuta è parte della riga**, e non si rinomina.
  Dove il progetto scrive che le sue regole di area vivono in una cartella sua — `.claude/rules/` su
  Claude Code — e lo scheletro scrive `.daiku/policies/`, la riga del progetto resta com'è:
  le regole che il progetto ha già scritto restano dove sono, e `.daiku/policies/` le **punta** —
  una policy per area, col `paths` dell'area e l'elenco di quei file (*Step 5*). Riscrivere la sede
  non è mettere in forma: afferma il falso e perde una regola vera.

Nella stessa giornata è caduta anche la variante di lingua degli scheletri: **tutto ciò che `init`
deposita è in inglese**, e le due chiavi `language.chat` e `language.commit` riguardano solo come
le skill parlano all'utente e cosa lasciano nei commit. Le cartelle `templates/project/domain/it/`
e `policies/it/` non esistono più, i loro gemelli `en/` sono stati appiattiti di un livello. La
sede della regola è la §5.6 di `contracts/project-contract.md`. Il 22 settembre 2026 anche le skill, i contratti
e gli hook sono passati all'inglese: il pacchetto è tutto in una lingua, e il confine con
l'italiano coincide con quello fra `plugins/` e il resto del repo. Vedi [[tre-livelli-di-parametro]] e
[[alberatura-pacchetto]].
