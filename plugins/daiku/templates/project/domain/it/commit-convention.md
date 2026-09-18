# Convenzione di commit

Risponde alle domande che `/commit` pone: quali tipi di commit esistono in questo progetto e
quando si usa ciascuno, che forma ha un messaggio, cosa entra nel changelog, quale incremento di
versione è lecito.

**Questo file è arrivato con Daiku come default, e da adesso è tuo.** Riscrivilo come ti pare:
nessun aggiornamento del pacchetto lo sovrascrive. Se lo cancelli, `/commit` ricava la convenzione
dallo storico dei commit e te lo dichiara.

La **lingua** del messaggio non si dichiara qui: la porta `language.commit` in
`.daiku/project.json`, perché è un valore e non un giudizio.

## Tipi ammessi

| Tipo | Quando si usa |
|---|---|
| `feat` | comportamento nuovo, visibile a chi usa il sistema |
| `fix` | correzione di un difetto |
| `refactor` | ristrutturazione a comportamento invariato |
| `perf` | miglioramento di prestazioni a comportamento invariato |
| `test` | test aggiunti o modificati, senza toccare il codice che provano |
| `docs` | documentazione |
| `build` | dipendenze, packaging, versione |
| `ci` | pipeline di integrazione |
| `chore` | manutenzione che non rientra in nessuno dei precedenti |

Se un commit sembra appartenere a due tipi, **quasi sempre sono due commit**.

## Forma del messaggio

```
tipo(area): descrizione
```

- **descrizione** — all'imperativo, minuscola, senza punto finale, entro 72 caratteri.
- **area** — opzionale: il nome di un'area dichiarata in `project.json`, o il modulo toccato.
  Si omette quando il cambiamento non sta in una sola.
- **corpo** — opzionale, righe brevi che elencano *cosa* è stato fatto. Le motivazioni no: quelle
  vivono nel documento di decisione, che sopravvive al commit.

## Changelog

Producono una voce solo `feat` e `fix`, perché il changelog racconta cosa è cambiato per chi usa
il sistema. Tutto il resto — manutenzione, test, refactoring, documentazione — non ne produce.

## Versione

**Default: nessun bump.** La voce entra fra le modifiche non rilasciate e il numero di versione
resta dov'è; `/commit` te lo dichiara invece di decidere al posto tuo.

È il default conservativo perché una versione è un gesto di rilascio, e chi rilascia sei tu. Per
concedere un incremento, sostituisci questo paragrafo dicendo **quale cifra** è lecito muovere —
per esempio «puoi incrementare la patch da solo; minor e major restano miei» — e `/commit`
rispetterà quel confine, mai più di un incremento per invocazione.
