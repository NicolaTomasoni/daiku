# Changelog — anatomia delle sezioni

Risponde a: com'è fatta una sezione di versione del changelog di questo progetto e quali
riferimenti al rilascio si allineano quando ne nasce una.

## Voci non ancora rilasciate

La sezione si chiama `## Non rilasciato` e sta fra l'indice e la sezione della versione più
recente. Raccoglie le voci per **area tematica**: una riga in grassetto apre l'area (es.
`**Abilitazione build**`), sotto un bullet per capacità.

## Sezione di una versione rilasciata

Nell'ordine, separati da righe vuote:

1. l'ancora `<a id="0160"></a>` — il numero di versione senza punti;
2. il titolo `## 0.16.0 &nbsp;<sub><sup>10 settembre 2026</sup></sub>` — numero, poi la data in
   forma estesa italiana;
3. la riga di sintesi in blockquote che nomina il tema del ciclo;
4. le aree tematiche con le loro voci, nella forma che avevano fra le non rilasciate.

## Riferimenti al rilascio

Due, entrambi in testa al file:

- la **tabella dell'indice**: una riga nuova in cima, nella forma
  `| [**0.16.0**](#0160) | 10 set 2026 | Tema del ciclo |`, con la data in forma breve;
- i **badge dell'header**: quello della versione corrente e quello dell'ultimo rilascio, che
  porta la data in forma breve con `%20` al posto degli spazi.
