# Punti caldi e osservazione del runtime — ReforgIA

Risponde alle domande che `/perf` pone a questo progetto: quali tecnologie occupano i tre livelli
che quella skill ispeziona e dove ciascuna paga davvero, quali tool esterni entrano nel costo di un
flusso, quali costi si manifestano a riposo, come si risolve il nome breve di un'unità nella sua
cartella e come si osserva il runtime.

I valori di ambiente non stanno qui: come si avvia l'applicazione e su quali host e porte risponde
lo dichiara `CLAUDE.md`, sezione *Avvio e ambiente locale*, che è la sola fonte — e che dichiara
anche cosa va tenuto allineato quando host o porte cambiano. I comandi delle aree stanno in
`.claude/project.json`; le regole architetturali nelle hard rule del `CLAUDE.md` e nelle rule di
area in `.claude/rules/`.

## Chi occupa i tre livelli, e dove paga

**Interfaccia e rendering — Tauri / React / TanStack.** I punti caldi ricorrenti: query TanStack,
hook, effect e subscription gestiti male; polling aggressivo o senza bail-out; invalidazione troppo
ampia; GPU tenuta sveglia da animazioni continue, SMIL infinite, canvas, WebView o effetti visivi
non necessari.

**Servizio applicativo — FastAPI, service e adapter.** I punti caldi ricorrenti: dati riletti o
ricaricati più volte e più grandi del necessario (rileggere tutte le run per uno stato aggregato è
il caso tipico); trasformazioni costose nel punto sbagliato; operazioni sincrone che bloccano il
flusso; log verbosi nei percorsi caldi.

**Processi e tool esterni — Sonar, Maven, scanner, test runner, Codex, jQAssistant.** Il costo di
un flusso qui è quasi sempre di orchestrazione, non del tool: processi rilanciati senza cache,
retry, scansioni duplicate, invocazione subottimale.

## Il costo a riposo

Molti costi di questo stack si manifestano **in idle** e non sotto carico: animazioni WebView2,
polling di stato, un `--reload` che osserva il venv. Un'indagine che misura solo sotto carico li
perde tutti.

## Risolvere il nome breve di un'unità

I cataloghi descrittivi di `memory/` mappano il nome di un componente sulla sua cartella:
`memory/backend-services.md`, `memory/backend-adapters.md`, `memory/backend-agents.md` e
`memory/frontend-features.md`, con l'indice in `memory/architecture-map.md`. Sono anche l'elenco da
cui si propongono le aree plausibili quando lo scope non è stato dato.

## Osservare il runtime

L'applicazione si avvia con il comando che `CLAUDE.md` § *Avvio e ambiente locale* dichiara, e
risponde sugli host e sulle porte dichiarati lì: leggili da quella sezione invece di ricordarli —
il giorno in cui cambiano, cambia con loro ciò che quella stessa sezione impone di tenere
allineato, e una copia tenuta altrove resterebbe indietro in silenzio.
