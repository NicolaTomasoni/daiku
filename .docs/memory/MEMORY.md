# Memoria di Daiku

Indice delle memorie del progetto. Una riga per file, nessun contenuto qui dentro.

- [Alberatura del pacchetto](alberatura-pacchetto.md) — nessun file di prodotto in radice: plugins/ è la radice pubblica; cosa contiene ogni cartella, i nomi che si somigliano e non c'entrano, le tre regole di collocazione
- [Il corpus di sviluppo](corpus-di-sviluppo.md) — i contratti in `.claude/` sono una derivazione di quelli del prodotto: in cosa divergono, perché non si toccano, e su quale premessa sono rimasti indietro
- [Si pubblica solo il prodotto](si-pubblica-solo-il-prodotto.md) — due repository: qui si sviluppa con tutto dentro, su GitHub si pubblica Daiku come albero generato dallo script
- [Pubblicazione su GitHub](pubblicazione-su-github.md) — «prod» è NicolaTomasoni/daiku su GitHub e «dev» è questo repo; la storia di prod parte da una radice vuota; cosa ricontrollare prima di pubblicare
- [La memoria vive nel repo](memoria-nel-repo.md) — perché `autoMemoryDirectory` non si versiona e va riscritto su ogni macchina
- [Il frontmatter di una skill va quotato](frontmatter-skill-va-quotato.md) — il guasto silenzioso che svuota i metadati di una SKILL.md
- [init scrive il file di istruzioni](init-scrive-le-istruzioni.md) — il divieto ribaltato il 19 settembre 2026, il file trovato che si parcheggia come `.old`, la chiave per host scesa in `environment.json`, le sei regole della fusione (riga tenuta intera, sede non rinominata, titoli e numerazione del progetto), e l'inglese di tutto ciò che init deposita
- [I tre livelli di parametro](tre-livelli-di-parametro.md) — dove va un valore estratto da una skill, perché l'ambiente è sceso nel progetto, e le due trappole che il contratto non nomina
- [`.daiku/` non si versiona](daiku-non-versionato.md) — niente di quella cartella entra nei commit: è attrezzo della macchina, e il ramo di guardia che lo impone; la memoria però non può starci dentro
- [I subagent di Codex non hanno confine](subagent-codex-nessun-confine.md) — i ruoli si scrivono in `.codex/agents/*.toml`, ma `sandbox_mode` lì dentro non è imposto
- [Cosa i due host accettano](cosa-i-due-host-accettano.md) — un solo `skills/<nome>/SKILL.md` per entrambi, due manifest e due vetrine, i campi che Codex rifiuta, la via di fuga di `agents/openai.yaml`, e il confine che vale su entrambi: nessun pacchetto scrive nel progetto
- [Cosa Codex fa all'installazione](cosa-codex-fa-allinstallazione.md) — copia l'albero verbatim, migra i `commands/` storpiandone il nome, non fa partire gli hook di un pacchetto, e la fiducia di un hook è registrata sul suo hash
- [Installazione e versionamento](installazione-e-versionamento.md) — i comandi sui due host, cosa governa l'aggiornamento (il `version` del manifest), il cachebuster di Codex in locale, e il terzo canale `skill-installer`
- [Come si provano i fatti sugli host](come-si-provano-i-fatti-sugli-host.md) — la specifica di prima parte su disco batte il web, le mosse in ordine di costo, l'ambiente di questa macchina, e il solo fatto che resta non provato
- [I fatti verificati stanno in memoria](fatti-verificati-in-memoria.md) — non esiste un documento di ricognizione: un fatto verificato va nella memoria che lo dichiara, con il comando e la data, e perché quel documento non si ricrea
- [init aggancia la memoria dell'host](init-aggancia-la-memoria.md) — su Claude il corpus del repo diventa anche la sede della memoria dell'host; su Codex non si puo' fare
- [I guardrail nascono spenti](guardrail-nascono-spenti.md) — un hook del pacchetto nega solo ciò che il progetto dichiara, e non esegue mai un file appena scritto
- [I punti di ingresso del prodotto](punti-ingresso-prodotto.md) — i nove entry point in due gruppi, e tutto il resto che è contratto interno
- [Il confine degli identificatori](confine-degli-identificatori.md) — cosa si può rinominare nel pacchetto e cosa no: non conta il tipo del nome, conta chi lo legge
- [Il valutatore deterministico](valutatore-deterministico.md) — il prodotto ha un programma che possiede l'ordine della catena e risponde a nove domande meccaniche, e accanto uno strumento che misura il disco per la review: il verdetto vincola, e il banco è l'unica difesa
- [Guardie di macchina](guardie-di-macchina.md) — tutte le guardie vivono sotto Program Files e le gestisce solo lo strumento installato, dal task di VS Code; i sorgenti in .docs/tools/macchina/; le trappole di PowerShell 5.1
- [Il cantiere non si nomina](cantiere-mai-nominarlo.md) — le skill del workspace non sono un problema e non si segnalano mai se non è l'owner a farlo: il disallineamento è lo stato normale, non una dimenticanza
- [Kaji fuori dal monorepo](kaji-fuori-dal-monorepo.md) — dal 26 settembre 2026 Kaji vive in C:/dev/Kaji come progetto ospite di Daiku; cosa resta qui e cosa è ancora da decidere
- [Lotto di studi](lotto-di-studi.md) — più repository studiati in parallelo con una sessione headless per target, e le voci `allinea` che la corsa propone e il lotto applica: perché lanciare non si può da un tool Bash, e chi decide sui conflitti
- [Catalogo di feature](catalogo-di-feature.md) — il valore dello studio è il confronto fra repo che portano la stessa capacità: `.docs/features/<feature>/<slug-corsa>.md`, quando un contributo è dovuto, la forma fissa che lo rende confrontabile, e le due regex da non scambiare
- [Le trappole della prova di init](collauda-init-trappole.md) — l'harness del subagent rifiuta i nomi che cominciano per `report` (da lì `verbale.md` e il controllo in `cattura`), e il subagent cieco gira dentro il cantiere e può leggerne la memoria: i due modi in cui la prova misura altro
