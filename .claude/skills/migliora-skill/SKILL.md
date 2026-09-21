---
name: 'migliora-skill'
description: 'Migliora una skill del prodotto: applica i ritocchi sicuri, studia il contesto se serve, chiede solo le scelte vere'
argument-hint: '[nome skill del prodotto]'
---

Migliori una o più skill in `plugins/daiku/skills/`.
Sistemi ogni skill e **modifichi il suo file**.
Non fai solo un report.

## Input: quali skill sistemare

Argomenti: `$ARGUMENTS`

L'argomento sono i **nomi** delle skill (es. `review`, `study commit`).

- Se `$ARGUMENTS` è vuoto, **chiedi** quali skill sistemare e fermati finché non le ricevi.
- Se nomina più skill, sistemale tutte in ordine, una alla volta.
- Il file di ognuna è `plugins/daiku/skills/<nome>/SKILL.md`. Se un nome non esiste, dillo e passa alla successiva senza fermarti.

## Come lavori

All'inizio leggi `plugins/daiku/README.md`: accanto allo schema porta il censimento dei punti di ingresso, che ti serve al punto 4. Poi, per ogni skill: leggi il suo file per intero e giudica questi sei punti, in ordine:

1. **Frontmatter.** Tre chiavi, valori quotati con apice singolo: `name` uguale alla cartella, `description` una riga, `argument-hint` solo se la skill si lancia a mano.
2. **Chiarezza.** Il mestiere si capisce dal primo paragrafo. Una frase dice una cosa sola. Niente termini non definiti. Niente incisi che cambiano il vincolo.
3. **Ripetizioni.** La stessa regola detta due volte. Due sezioni che si sovrappongono. Uno schema ricopiato dove basterebbe citarlo. Un esempio che ripete la norma senza aggiungere casi.
4. **Struttura.** Ci sono, e al posto giusto: come si lancia, cosa può scrivere, cosa restituisce, quali vincoli rispetta. Niente sezioni che promettono e non mantengono. Il modo in cui si lancia corrisponde a `contracts/orchestration.md` §3: un contratto interno non dichiara modalità da lancio a mano.
5. **Atomicità.** La skill fa una cosa sola. Non invade il mestiere di un'altra. Non duplica il contratto di orchestrazione. Non porta valori che vivono in `environment.json` o `project.json`. Non nomina modelli.
6. **Lingua.** Italiano. I vincoli si riconoscono come tali (devi, mai, sempre, solo). Non sembrano consigli.

## Cosa sistemi da solo

Sistema subito nel file tutto ciò che non richiede una decisione umana:

- frontmatter rotto o non quotato
- errori di italiano, frasi doppie, formattazione
- ripetizioni evidenti
- vincoli scritti come consigli
- nomi di campo incoerenti quando il resto del file dice già quale è giusto

Non lasciare un ritocco sicuro in sospeso per metterlo nel report.
Se un dubbio si scioglie leggendo altrove, apri gli altri file che servono: orchestration, altre skill, contratti, README, template.
Studiali in lettura. Poi sistema e vai avanti.
Non fare domande per queste cose.

## Cosa chiedi

Fai una domanda solo quando senza l'owner non puoi decidere.
Esempi: scope della skill, permessi di scrittura, un tradeoff fra due comportamenti, un caso non coperto.

Poni la domanda con lo strumento per le domande.
Presenta sempre le scelte:

- da 2 a 4 opzioni
- la prima è quella che raccomandi
- ogni opzione dice cosa succede se la scegli
- una domanda alla volta

Mai domande per lingua, formattura o ripetizioni evidenti.

Non proporre ristrutturazioni del sistema intorno alla skill.
Se il problema è strutturale, fai una domanda invece di decidirlo tu.

## Come scrivi

Scrivi per chi non ha letto la skill e non la conosce.

- Frasi corte. Una frase dice una cosa sola.
- Spiega ogni termine tecnico in una riga quando lo usi la prima volta.
- Quando tocchi un punto del file, di dove sei in parole normali e aggiungi il numero di riga tra parentesi.
- Niente riferimenti soli tipo `r.53 contro r.181` senza dire cosa c'è scritto.

## Output finale

Modifica ogni file. Poi riferisci solo in chat, una skill alla volta, in quest'ordine:

1. **cosa hai cambiato** — elenco corto, un punto per modifica
2. **domande** — solo quelle con scelta vera, con le opzioni presentate
3. **cosa resta** — solo se hai saltato qualcosa e perché

Non scrivere mai una sezione `non guardato`.
Non lasciare micro-ritocchi nel report quando potevi applicarli.
