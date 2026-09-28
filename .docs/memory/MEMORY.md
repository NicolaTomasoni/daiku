# Memoria di Daiku

Indice delle memorie del progetto. Una riga per file, nessun contenuto qui dentro.

- [Alberatura del pacchetto](alberatura-pacchetto.md) — nessun file di prodotto in radice: plugins/ è la radice pubblica; cosa contiene ogni cartella, i nomi che si somigliano e non c'entrano, le tre regole di collocazione
- [Il corpus di sviluppo](corpus-di-sviluppo.md) — i contratti in `.claude/` sono una derivazione di quelli del prodotto: in cosa divergono, perché non si toccano, e su quale premessa sono rimasti indietro
- [Si pubblica solo il prodotto](si-pubblica-solo-il-prodotto.md) — due repository: qui si sviluppa con tutto dentro, su GitHub si pubblica Daiku come albero generato dallo script
- [Pubblicazione su GitHub](pubblicazione-su-github.md) — i due repository stanno su GitHub, lo sviluppo privato è daiku-kaji-dev, e cosa ricontrollare prima di pubblicare
- [La memoria vive nel repo](memoria-nel-repo.md) — perché `autoMemoryDirectory` non si versiona e va riscritto su ogni macchina
- [Il frontmatter di una skill va quotato](frontmatter-skill-va-quotato.md) — il guasto silenzioso che svuota i metadati di una SKILL.md
- [init scrive il file di istruzioni](init-scrive-le-istruzioni.md) — il divieto ribaltato il 19 settembre 2026, le tre cose che lo contengono, e l'inglese di tutto ciò che init deposita
- [I tre livelli di parametro](tre-livelli-di-parametro.md) — dove va un valore estratto da una skill, e le due trappole che il contratto non nomina
- [I subagent di Codex non hanno confine](subagent-codex-nessun-confine.md) — i ruoli si scrivono in `.codex/agents/*.toml`, ma `sandbox_mode` lì dentro non è imposto
- [init aggancia la memoria dell'host](init-aggancia-la-memoria.md) — su Claude il corpus del repo diventa anche la sede della memoria dell'host; su Codex non si puo' fare
- [I guardrail nascono spenti](guardrail-nascono-spenti.md) — un hook del pacchetto nega solo ciò che il progetto dichiara, e non esegue mai un file appena scritto
- [I punti di ingresso del prodotto](punti-ingresso-prodotto.md) — i nove entry point in due gruppi, e tutto il resto che è contratto interno
- [Il confine degli identificatori](confine-degli-identificatori.md) — cosa si può rinominare nel pacchetto e cosa no: non conta il tipo del nome, conta chi lo legge
- [Il valutatore deterministico](valutatore-deterministico.md) — il prodotto ha un programma che possiede l'ordine della catena e risponde a nove domande meccaniche, e accanto uno strumento che misura il disco per la review: il verdetto vincola, e il banco è l'unica difesa
- [Kaji fuori dal monorepo](kaji-fuori-dal-monorepo.md) — dal 26 settembre 2026 Kaji vive in C:/dev/Kaji come progetto ospite di Daiku; cosa resta qui e cosa è ancora da decidere
