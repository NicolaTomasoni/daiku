# Memoria di Daiku

Indice delle memorie del progetto. Una riga per file, nessun contenuto qui dentro.

- [Alberatura del pacchetto](alberatura-pacchetto.md) — cosa contiene ogni cartella e a cosa serve, i nomi che si somigliano e non c'entrano, le tre regole di collocazione
- [Il corpus di sviluppo](corpus-di-sviluppo.md) — i contratti in `.claude/` sono una derivazione di quelli del prodotto: in cosa divergono, perché non si toccano, e su quale premessa sono rimasti indietro
- [Si pubblica solo il prodotto](si-pubblica-solo-il-prodotto.md) — due repository: qui si sviluppa con tutto dentro, su GitHub si pubblica un albero generato dallo script
- [Pubblicazione su GitHub](pubblicazione-su-github.md) — perché il repo pubblico va su GitHub e non su GitLab, e cosa ripulire prima di crearlo
- [La memoria vive nel repo](memoria-nel-repo.md) — perché `autoMemoryDirectory` non si versiona e va riscritto su ogni macchina
- [Il frontmatter di una skill va quotato](frontmatter-skill-va-quotato.md) — il guasto silenzioso che svuota i metadati di una SKILL.md
- [init scrive il file di istruzioni](init-scrive-le-istruzioni.md) — il divieto ribaltato il 19 settembre 2026, le tre cose che lo contengono, e l'inglese di tutto ciò che init deposita
- [I tre livelli di parametro](tre-livelli-di-parametro.md) — dove va un valore estratto da una skill, e le due trappole che il contratto non nomina
- [I subagent di Codex non hanno confine](subagent-codex-nessun-confine.md) — i ruoli si scrivono in `.codex/agents/*.toml`, ma `sandbox_mode` lì dentro non è imposto
- [init aggancia la memoria dell'host](init-aggancia-la-memoria.md) — su Claude il corpus del repo diventa anche la sede della memoria dell'host; su Codex non si puo' fare
- [I guardrail nascono spenti](guardrail-nascono-spenti.md) — un hook del pacchetto nega solo ciò che il progetto dichiara, e non esegue mai un file appena scritto
- [I punti di ingresso del prodotto](punti-ingresso-prodotto.md) — i sette entry point in due gruppi, e tutto il resto che è contratto interno
