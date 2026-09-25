---
name: valutatore-deterministico
description: "Il prodotto ha un valutatore deterministico che possiede l'ordine della catena e risponde a sei domande meccaniche: il verdetto vincola, e il banco è l'unica difesa"
metadata:
  node_type: memory
  type: project
  originSessionId: 43bcfac4-1cc3-4310-acf9-530699fcf261
  modified: 2026-09-23T18:04:50.082Z
---

**Dal 23 settembre 2026 il prodotto ha un valutatore deterministico.** È
`plugins/daiku/architect/architect.mjs`, in una cartella di primo livello nuova del pacchetto,
sorella di `skills/`, `contracts/`, `hooks/` e `schemas/`. Il nome l'ha scelto l'owner in
conversazione, al posto delle tre opzioni che erano in campo — `evaluator/`, `planner/`,
`verdicts/` — e **non si rinomina più**: è un path, e dentro le skill lo nominano da fuori (vedi
[[confine-degli-identificatori]]).

Fa due mestieri: **valuta** le sei classificazioni che i contratti dichiaravano già meccaniche —
la decisione finale, la chiusura del ciclo, lo sblocco meccanico, la propagazione del fallimento,
la ripresa, l'ordine — e **possiede l'ordine della catena**: la tabella di §3 di
`contracts/orchestration.md` non lo dichiara più, ne è il riflesso, e il banco del valutatore
rifiuta la divergenza nei due versi.

**Why:** un modello che legge una tabella di sei righe e deve applicarle tutte è un modo costoso e
non riproducibile di fare un `if`; e la sequenza era dichiarata a parole in tre contratti, quindi
ogni tabella che decide un passo la ripeteva per poter dire cosa viene dopo. Due scostamenti dal
resto del pacchetto discendono da qui, e sono la parte che conta:

- **Fallisce rumorosamente, al contrario delle guardie.** Un hook tace perché parte da solo su ogni
  repository che l'host apre; questo parte su invocazione, e il suo verdetto **vincola**: un input
  che manca o è malformato è un errore, mai un `false` implicito, e se non gira la consegna si
  ferma. Conseguenza dichiarata a chi installa: `node` che manca smette di essere un controllo che
  tace e diventa un requisito che ferma il lavoro. Vedi [[guardrail-nascono-spenti]].
- **La radice si passa per argomento, mai dedotta dalla posizione.** Un programma che deduce la
  propria radice dal posto in cui si trova è corretto fino al primo spostamento dell'albero e
  sbaglia in silenzio: è esattamente come è morto il verificatore rimosso il 18 settembre 2026.

**Il banco è l'unica difesa:** un caso che non copre non è un verdetto sbagliato, è una consegna che
si ferma. Il suo banco sta accanto al programma e non in `hooks/lib/`, che viene copiata nel
progetto dell'utente; si lancia con gli altri con `node plugins/daiku/hooks/self-check.mjs`, che da
qui lancia **cinque** banchi.

**E c'è un campo che misura.** `architect_agreement`, nell'esito di `develop-feature`, dice se la
lettura dell'agente coincideva col verdetto: è il primo uso del valutatore per misurare Daiku
stessa, e se le due letture coincidono sempre allora il valutatore ha reso poco.

**How to apply:** si invoca con `node <radice del pacchetto>/architect/architect.mjs <radice>`, un
oggetto JSON su stdin e uno su stdout. La forma d'ingresso e il blocco di ritorno sono dichiarati in
`skills/develop-feature/SKILL.md` § *The evaluator* e in `schemas/blocks.json` § *architect*: si
citano, non si ricopiano. La forma del banco — `.mjs` Node senza dipendenze, radice per argomento,
`--self-check` a totale contato — è ormai la convenzione di questo repository: chi ne scrive un
altro la prende da `.docs/tools/check-topology.mjs` invece di reinventarla. Vedi
[[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
