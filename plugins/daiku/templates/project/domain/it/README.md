# Contesto di dominio delle skill

Un file qui dentro si chiama con il **ruolo** che una skill cita (`.daiku/domain/<ruolo>.md`):
il nome del file è l'indirizzo, il contenuto è dominio e giudizio di questo progetto. Chi scrive
qui risponde a una domanda che una skill pone; chi legge una skill non trova mai qui la risposta
scritta due volte.

**Tutto quello che sta in questa cartella è tuo.** Daiku ne deposita alcuni con un default già
scritto, la prima volta che `/init` gira, e da quel momento non li tocca più: nessun aggiornamento
del pacchetto sovrascrive quello che hai cambiato. Se un default non ti piace, riscrivilo. Se lo
cancelli, la skill che lo cita degrada e te lo dichiara — non si rompe.

Forma, convenzione di citazione e regola di degradazione stanno in `contracts/project-contract.md`.

## I ruoli che le skill di questo pacchetto citano

Nessuno è obbligatorio: una skill che non trova il proprio file di dominio **fa meno** e lo
dichiara nell'esito (§6 del contratto). Questa tabella dice a quale domanda ciascun file risponde
— la risposta non è qui, ed è questo il punto.

| Ruolo | A quale domanda risponde | Chi lo chiede | Default |
|---|---|---|---|
| `commit-convention.md` | quali tipi di commit ammette questo progetto e quando si usa ciascuno, che forma ha un messaggio, cosa entra nel changelog, quale incremento di versione è lecito | `commit` | **sì** |
| `changelog.md` | com'è fatta una sezione di versione del changelog e quali riferimenti al rilascio si allineano quando ne nasce una | `commit` | no |
| `memory-contract.md` | quali forme può avere una memoria, come si muta il corpus, quando si aggiorna l'indice e a quale artefatto tocca cosa | `update-memory`, `memory-review` | no |
| `test-strategy.md` | quali sono le macrocategorie, come si legge l'output dei comandi di misura, quale perimetro copre davvero ciascun runner, quali convenzioni seguono i test già scritti e da quale punto di forza si testa ciascun layer | `test-coverage` | no |
| `perf.md` | quali tecnologie occupano i livelli che l'indagine ispeziona e dove ciascuna paga, quali costi si manifestano a riposo e come si osserva il runtime | `perf` | no |

**Perché solo uno ha un default.** Una convenzione di commit va bene finché non ti dà fastidio, e
partire da una scritta è meglio che partire dal vuoto. Le macrocategorie di test e i punti caldi di
performance, invece, dipendono dal tuo stack e dalla tua architettura: un default lì sarebbe
un'invenzione travestita da regola, e la cosa giusta è che manchi finché non la scrivi tu.

Un ruolo nuovo nasce quando una skill nuova pone una domanda nuova: si aggiunge la riga qui e la
citazione nella skill, nella forma della §5.4 del contratto — mai il contenuto dentro la skill.
