# Prima che arrivi al modello — output dei tool e serializzazione

- **Corsa:** prima-che-arrivi-al-modello-output-dei-tool-e-serializzazione
- **Data:** 2026-10-03
- **Target studiati:** 9
- **Esito:** entrambi

## Cosa hanno portato i target

- rtk-ai/rtk — proxy CLI in Rust fra agente e shell: riscrive il comando (git status diventa rtk git status) e filtra l'output per famiglia con quattro strategie, un registro unico di regole, guardie sull'output strutturato e sui redirect, e il recupero dell'output integrale da uno store content-addressed.
- headroomlabs-ai/headroom — livello di compressione del contesto: instrada per tipo di contenuto a riduttori deterministici, salva l'originale e inietta un tool di recupero (CCR); in più mina le sessioni passate per proporre correzioni e scrive blocchi a marker reversibili nei file dell'host.
- claudioemmanuel/squeez — compressore a hook su sette host: pipeline deterministica (strip ANSI, dedup in gruppi, log-template, troncamento per rilevanza), gate del guadagno netto, preservazione degli identificatori esatti e un tetto numerico ai subagent in volo.
- Mibayy/token-savior — server MCP che riscrive la chiamata prima che produca output e, dopo, mette l'output in una sandbox con puntatore; generalizza la dichiarazione del taglio a ogni risultato limitato e la tiene con un test di copertura.
- mksglu/context-mode — sandbox dell'output dei tool, base FTS5, continuità di sessione (snapshot prima della compattazione) e routing imposto, con un terzo esito dell'hook che riscrive la chiamata invece di negarla.
- Madhan230205/token-reducer — plugin locale senza API: RAG ibrido e un motore di compressione deterministico (firme, docstring, TextRank, relevance floor); il suo hook però aggancia l'evento sbagliato e non comprime nulla davvero.
- CoderDayton/semantic-cache-mcp — cache semantica dei file dietro un server MCP: payload minimale che dichiara il taglio, diff sagomato e la misura del costo fisso pubblicizzato a ogni richiesta.
- toon-format/toon — seconda codifica del JSON: l'header dichiara la propria forma e il decoder strict rifiuta un numero di righe diverso, cioè il meccanismo con cui una lista troncata diventa rilevabile.
- microsoft/LLMLingua — libreria di ricerca: rimuove token non essenziali con budget dichiarati per contesto, frase e token, protegge gli span con un flag di non-compressione e restituisce sempre la misura del lavoro fatto.

## Interventi approvati

### I1 — Diff sagomato per i finder

- **Cosa cambia:** il diff che i finder e l'applier calcolano è consegnato con due righe di contesto sotto le 100 righe di file e tre sopra, senza le intestazioni di file di difflib, tenendo l'header di hunk che porta i numeri di riga; ogni token del diff entra nel contesto dei finder a ogni round, e le intestazioni sono costo puro.
- **Dove atterra:** `plugins/daiku/skills/review/SKILL.md` § *Scope* e `plugins/daiku/skills/finder-prompt/SKILL.md`.
- **Perché subito:** è una scelta di forma, non introduce un divieto né un programma; non contraddice i tre principi e non chiede nessuna decisione.
- **Da quale target:** CoderDayton/semantic-cache-mcp

### I2 — Dichiarare il taglio e la lunghezza nei blocchi di ritorno

- **Cosa cambia:** i blocchi che portano collezioni dichiarano la loro lunghezza, e un campo `truncated`/`has_more` quando un tetto li ha tagliati; un blocco oltre il tetto degrada tenendo gli scalari e il path del log intero nella sede del giro, invece di superare il tetto o perdere tutto; il banco del valutatore fallisce quando compare una chiave di borne che nessun caso copre.
- **Dove atterra:** `plugins/daiku/schemas/blocks.json` (un campo per i blocchi con collezioni), `plugins/daiku/contracts/orchestration.md` §4 *Validation*, `plugins/daiku/skills/finder-prompt/SKILL.md`, e la regola negli `SHAPES` di `plugins/daiku/architect/architect.mjs` col caso nel banco.
- **Perché subito:** generalizza un principio che Daiku ha già in un punto solo (l'uscita `rounds-truncated`), non apre nessuna decisione e allinea contratto, specchio e banco nella stessa sede; costo di una riga di schema, una di contratto e un caso.
- **Da quale target:** Mibayy/token-savior, CoderDayton/semantic-cache-mcp, toon-format/toon

### I3 — Citazione protetta delle parti non perdibili

- **Cosa cambia:** una convenzione di marcatura per i fatti che devono attraversare intatti — path, nomi di simbolo, riferimenti riga, letterali di codice — così che un eventuale riduttore meccanico sia tenuto a preservarli byte-exact; oggi «verbatim» vive solo in prosa sparsa e non ha una forma riconoscibile.
- **Dove atterra:** `plugins/daiku/contracts/project-contract.md` §5, accanto alla citazione delle chiavi, e la prosa di `plugins/daiku/skills/research/SKILL.md` e `plugins/daiku/skills/blueprint/SKILL.md`.
- **Perché subito:** è una convenzione, non un programma; non contraddice nessun principio e rafforza «path, non trascrizione» e il divieto di riassumere, senza chiedere una decisione.
- **Da quale target:** microsoft/LLMLingua, claudioemmanuel/squeez

### I4 — Misura del costo fisso che il pacchetto inietta per sessione

- **Cosa cambia:** una regola e il suo banco in `.docs/tools/check-corpus.mjs` misurano le descrizioni delle 21 skill e i testi iniettati (l'avviso di avvio, i frontmatter) e rifiutano la crescita oltre una soglia; oggi quel numero non lo guarda nessuno, e il costo pubblicizzato a ogni richiesta batte quello per chiamata.
- **Dove atterra:** `.docs/tools/check-corpus.mjs` col suo `--self-check`.
- **Perché subito:** è un controllo di cantiere, non tocca il prodotto né il metodo; non apre decisioni.
- **Da quale target:** CoderDayton/semantic-cache-mcp

### I5 — Avviso sul prompt d'apertura che porta un dump grezzo

- **Cosa cambia:** quando il prompt che apre un giro contiene un dump grezzo oltre una soglia, `run-advice` risponde con un avviso che indica la sede giusta — mettere il testo in un file e passarne il path, oppure `research` — invece di lasciarlo entrare intero; mai un blocco, mai un troncamento.
- **Dove atterra:** `plugins/daiku/hooks/lib/run-advice.mjs`, la soglia in `.daiku/environment.json`, una riga in `plugins/daiku/hooks/README.md` e il caso in `plugins/daiku/hooks/self-check.mjs`.
- **Perché subito:** estende un hook che già avvisa, non ferma niente, non apre decisioni e non contraddice il registro non-imperativo degli avvisi.
- **Da quale target:** Madhan230205/token-reducer

### I6 — Ri-enunciazione a cadenza rada della sola regola del giro

- **Cosa cambia:** finché il marchio del giro è presente, la regola del turno che chiede lavoro si riafferma una volta ogni N lanci di subagent, con N alto e dichiarato — perché una sola enunciazione cade con la compattazione, e la sua perdita fa eseguire in conversazione un turno che andava delegato; nessun altro avviso cambia cadenza.
- **Dove atterra:** un ramo di `plugins/daiku/hooks/lib/run-advice.mjs`, la riga in `plugins/daiku/hooks/README.md` e il caso nel banco.
- **Perché subito:** costo basso, nessuna decisione, e rispetta la regola di casa «un avviso che arriva ogni volta smette di essere letto» con una cadenza alta e una sola regola.
- **Da quale target:** mksglu/context-mode

## Dove i target divergono, e chi vince

### D1 — Dove si comprime l'output

- **Le soluzioni:** `PreToolUse` che riscrive il comando in un wrap e risponde `allow` (rtk-ai/rtk, Mibayy/token-savior, claudioemmanuel/squeez sul ramo Bash); `PostToolUse` con `updatedToolOutput` che sostituisce il risultato (claudioemmanuel/squeez sul ramo letture, Madhan230205/token-reducer); `PostToolUse` che aggiunge un puntatore senza toccare il risultato (Mibayy/token-savior, il suo capture).
- **Chi vince:** `PostToolUse` con `updatedToolOutput`.
- **Perché:** la riscrittura in `PreToolUse` con `allow` implicito lascia scoperta la regola di permesso scritta sul comando originale (lo ammette il `SECURITY.md` di squeez), e Daiku ha già scelto di negare, non di riscrivere-per-permettere; il puntatore aggiunto non riduce il turno, perché quando l'hook `PostToolUse` parte l'output è già stato consegnato. `updatedToolOutput` è l'unico che sostituisce il risultato prima che il modello lo veda, e resta sul ramo che non altera i permessi.

### D2 — Dove vive l'originale recuperabile

- **Le soluzioni:** store content-addressed sotto la home con chiave hash e scadenza (rtk-ai/rtk, headroomlabs-ai/headroom, claudioemmanuel/squeez); path puntatore nella scratch di sessione (claudioemmanuel/squeez, Madhan230205/token-reducer); artefatto versionato nel progetto, che è la forma che Daiku ha già.
- **Chi vince:** ibrido — la forma di Daiku (un path, non una chiave) su una sede fuori dal progetto, la scratch di sessione che l'host nomina, dove già scrivono gli avvisi.
- **Perché:** un puntatore che scade non è una garanzia, come osserva Daiku contro lo stash di squeez; il confine di Daiku vieta a un pacchetto di scrivere nel progetto, quindi il path non può stare lì; e la chiave hash di uno store nascosto è più fragile di un path leggibile.

### D3 — Come si riduce: deterministico, a modello o a sandbox

- **Le soluzioni:** riduttori strutturali deterministici (headroomlabs-ai/headroom, claudioemmanuel/squeez); modello piccolo che misura la perplessità o classificatore distillato (microsoft/LLMLingua); codice eseguito in sandbox che restituisce solo lo stdout (mksglu/context-mode).
- **Chi vince:** il riduttore deterministico, con la dichiarazione del budget presa da LLMLingua e la disciplina testuale «processa, non leggere» presa da context-mode.
- **Perché:** Daiku è Node a dipendenze zero e senza rete, e la sua dottrina è «mai fidarsi di un LLM»: il motore a perplessità di LLMLingua non è importabile (torch, transformer, GPU) e il sandbox di context-mode è un runtime esterno, fuori dal confine del pacchetto. Restano la parte deterministica e le due idee di forma.

## Cosa resta aperto

- **L'identità di Daiku.** Se Daiku debba possedere un riduttore di contesto e non solo guardie: la compressione cambia ciò che il modello legge, e oggi Daiku è «metodo, non ottimizzatore di token». Squeez e headroom lo dichiarano come decisione dell'owner e non come allineamento: è la condizione che apre o chiude la feature F1.
- **Entry point o contratto interno.** Se i nodi nuovi (la riduzione dei payload, la miniera delle sessioni) diventino contratti interni o entry point — `contracts/orchestration.md` §3 dice che i dieci non crescono da soli.
- **Il comando di rimozione.** Se accompagnare `init` con un `daiku: remove` che ripristina le aggiunte a `.claude/settings.local.json` e al task di VS Code, oppure lasciare la simmetria com'è oggi.
- **La parità Codex.** La riduzione con `updatedToolOutput` e il governo del lancio del subagent vivono solo su Claude Code: se cercare una parità, o dichiarare la asimmetria come si fa oggi.
- **La contabilità dell'adozione.** La misura delle occasioni perse di rtk-ai/rtk si sovrappone alla feature `contabilita-contesto-runtime` già abbozzata nel cantiere: fondere o tenere separate.

## Limiti

Nessuno dei nove target è rimasto senza appunto. Restano fuori, dichiarati dagli appunti: nessun target è stato eseguito né portato sul disco, quindi ogni numero è una dichiarazione e non una misura — il 42,6% di toon-format/toon è contro il JSON indentato e non contro il compatto, il 97,9% di Mibayy/token-savior è ritirato dallo stesso progetto, il 98% di mksglu/context-mode è un banco su fixture con stime costanti nei byte evitati, il 91,2% di claudioemmanuel/squeez non è riprodotto, e il «20 volte» di microsoft/LLMLingua è un numero dei paper non presente nel repository. Il codice non è stato letto riga per riga ovunque (i riduttori di headroomlabs-ai/headroom, i molti handler di rtk-ai/rtk, `wrap.rs` e i compattatori di squeez, il core di LLMLingua): il giudizio sul meccanismo poggia su hook, strategie e documentazione. Due appunti — Madhan230205/token-reducer e Mibayy/token-savior — si appoggiano a una lettura di seconda parte della specifica degli hook dell'host: il verdetto sui campi di output va riconfermato sulla specifica di prima parte prima di costruirvi un divieto.
