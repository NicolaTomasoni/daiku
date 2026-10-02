# Ticket — `ship-feature`: il pool dei worktree si satura e non ricicla mai

> Segnalazione di incidente sul metodo Daiku.
> **Data:** 2026-10-02 · **Skill:** `daiku:ship-feature` (§ *Worktree pool*, fase 0, fase 6c) · **Pacchetto:** `daiku` 1.0.9
> (`C:\Users\tomas\.claude\plugins\cache\daiku\daiku\1.0.9`; identico a `plugins/daiku/` del cantiere)
> **Progetto:** ReforgIA (`repo_root` `C:/dev/ReforgIA`, root tecnica `src/`)
> **Host:** `claude`, `enforcement: harness`

## In una riga

Il criterio con cui la fase 0 dichiara «libero» uno slot del pool lo rende non riciclabile **subito dopo ogni delivery riuscita**, perché la fase 6c lo lascia esattamente un commit indietro rispetto a main: il pool si riempie di slot puliti e inutilizzabili fino al tetto, e da lì ogni nuova delivery si ferma con `blocked`.

## Che cosa si è osservato

`.claude/worktrees/` (pool `../.claude/worktrees`, prefisso `agent-tree-`) contiene **cinque** slot: tutti e cinque registrati in git, tutti e cinque con il branch **già mergiato su main**, e **zero riutilizzabili**. Stato al 2026-10-02, main a `c46ddf1`:

| Slot | HEAD | vs main | Stato | Chi/che cosa l'ha lasciato |
|---|---|---|---|---|
| `agent-tree-1` | `c46ddf1` | 0 / 0 | **sporco, grande** | delivery della migrazione layout Daiku (`.agents/skills/*`, `.claude/commands/deliver-feature/*`) **più** lavoro sul grafo strutturale: 25 file in stage, 20 modificati, 7 nuovi. Il grosso risulta già su main come `415f0d8` |
| `agent-tree-2` | `b4861fc` | 11 / 0 | pulito, **11 commit indietro** | ultima delivery: ricompilazione incrementale |
| `agent-tree-3` | `b4861fc` | 11 / 0 | pulito, **11 commit indietro** | ultima delivery: skew a catena |
| `agent-tree-4` | `b4861fc` | 11 / 0 | pulito, **11 commit indietro** | ultima delivery: traduzione build Ant |
| `agent-tree-5` | `c46ddf1` | 0 / 0 | **sporco** | la delivery `deliverable-cliente-da-kb` fermata dall'incidente omonimo (documentata in `TICKET-daiku-2026-10-02-new-feature-ask-tecnico-saltato.md`) |

Conseguenza immediata: **la prossima `ship-feature` non parte.** Fase 0, passo 2 non trova nessuno slot libero (1 e 5 sporchi; 2, 3 e 4 non al HEAD di `<INT>`), il passo 5 restituisce `ok: false` e la delivery si chiude `blocked` senza toccare niente. Il pool è saturo non perché cinque delivery siano in volo, ma perché **nessuna delivery riuscita è mai tornata disponibile**.

## Perché il pool si riempie — la causa

Il difetto sta nel **criterio di «libero»** della fase 0, in coppia con ciò che fa la fase 6c.

`plugins/daiku/skills/ship-feature/SKILL.md` § *0. Acquisition*, passo 2:

> Free = registered, with `git -C <pool>/<name> status --porcelain` empty **and** `git -C <pool>/<name> rev-parse HEAD` equal to the HEAD of `<INT>`.

Passo 3, subito dopo:

> If there is one: `git -C <pool>/<name> reset --hard <INT>` (clean tree: safe) and use it.

La seconda condizione è **ridondante**: il passo 3 riporta comunque lo slot a `<INT>`, quindi un worktree pulito può essere riusato qualunque cosa il suo HEAD sia. Ed è **letale**, perché è proprio la condizione che non si avvera quasi mai. § *6c. Cleanup*, ultima riga:

> `git -C <pool>/<name> reset --hard <merge_sha>` … The worktree stays registered with its name and its branch: **it is ready for the next delivery.**

L'intenzione dichiarata è «pronto per la prossima delivery», ma `merge_sha` è, in quell'istante, il HEAD di main. Appena main avanza di **un solo commit** — il merge della delivery successiva, o qualunque altro commit — lo slot scivola indietro e `rev-parse HEAD` non è più uguale a `<INT>`. Da quel momento non è più «libero», **per sempre**: niente lo riporta avanti.

Ne segue la matematica del pool: **al più uno slot alla volta soddisfa la condizione** (solo quello appena ripulito, prima che main si muova). Conseguenza: *N* delivery sequenziali consumano *N* slot. Non è una perdita rara, è il comportamento ordinario.

A questo si somma il secondo pozzo, che è dichiarato ma concorre alla saturazione:

> § *4. Decision*: On `BLOCKED_NO_COMMIT` … **the worktree stays dirty on purpose** … `on BLOCKED_NO_COMMIT` this phase [6c] does not exist: the worktree stays dirty and declared.

Uno slot sporco (interruzione, `BLOCKED_NO_COMMIT`, o delivery fermata a metà da un errore) non torna mai in pool: resta occupato finché un umano non lo pulisce. `agent-tree-1` e `agent-tree-5` sono esattamente questo caso.

## Perché Daiku non lo previene — nessuna traccia di chi e se è finito

Il contratto **non conserva da nessuna parte** quale delivery abbia preso quale slot, né se quel lavoro sia finito. Il campo `worktree` esiste solo nel blocco di chiusura del run (`§ 7. Report`) e nel report della cartella, non in un registro che la fase 0 possa leggere. Quindi la fase 0 **deduce** «finito» dallo stato git — pulito e a HEAD di main — e la deduzione è sbagliata nei due casi più comuni (riuscito-ma-indietro, interrotto).

Da qui i tre sintomi che l'owner ha visto insieme:

- **non previene**: il pool si satura in silenzio, e lo si scopre solo quando la delivery successiva si ferma con `blocked`;
- **non ricicla**: uno slot pulito e indietro è riciclabile per costruzione (passo 3), eppure viene scartato;
- **non traccia**: chi guarda il pool non può sapere chi ha usato `agent-tree-1`, se la sua delivery è finita, né se il suo contenuto è già su main sotto un altro commit. Oggi `agent-tree-1` ne è la prova: contiene una delivery intera che sembra già integrata altrove, e nulla nel pool lo dichiara.

Nota di contorno, non Daiku: `.claude/worktrees/` porta anche **tre directory orfane** del 27/09 (`agent-a4172cfb083ddae4d`, `agent-a84d86435c08670da`, `agent-aabdf4daa2caa3f3a`), non registrate in `git worktree list` e mai rimosse. Sono slot del meccanismo di isolamento dell'host, non del pool Daiku: si segnalano perché appartengono alla stessa famiglia — nessuno ripulisce i worktree quando il lavoro che li ha aperti finisce.

## Che cosa chiedo

1. **Rilassare il criterio di «libero».** `status --porcelain` vuoto **basta**: il passo 3 fa già `reset --hard <INT>`, quindi la condizione `HEAD == HEAD(<INT>)` va tolta. È la correzione minima, e da sola restituisce al pool gli slot 2, 3 e 4 di oggi.
2. **Un registro del pool.** Un file (es. `.dev-runtime/worktree-pool.json` accanto al ledger di review, o dentro `.daiku/`) con una riga per slot: `name`, `branch`, `delivery`/cartella che l'ha preso, `stato` (`free` | `in-uso` | `blocked-dichiarato` | `abbandonato`), `aggiornato`. Lo scrive la fase 0 quando assegna e la 6c quando libera; sui rami `blocked`/`BLOCKED_NO_COMMIT` lo scrive il report. Così «se il lavoro è finito» diventa un **fatto registrato nel momento giusto**, non una deduzione da git.
3. **Politica di riciclo e sgombero.** Con (1) e (2): uno slot pulito è sempre riciclabile (reset); uno slot `blocked-dichiarato` non conta come libero ma **dice chi l'ha lasciato** e non blocca gli altri; uno slot `abbandonato` (nessun run vivo, contenuto già su main) è ripulibile, e il contratto dice come — oggi non lo dice.
4. **Il tetto come manopola, e che cosa succede a pool pieno.** `worktree.max` **è già** una chiave editabile in `.daiku/project.json` (oggi `5`, mai cambiata da quando la chiave esiste). Il punto non è renderla editabile, è dichiararla nel contratto come manopola e rendere prevedibile il comportamento a tetto raggiunto: oggi l'unico esito è `blocked`. Con il riciclo riparato, il tetto conta il **parallelismo reale**, non il numero di delivery accumulate.

## Nota sul numero 5

`worktree.max` vale `5` da quando il blocco `worktree` è entrato in `src/.daiku/project.json`; **non è mai stato `3`** (verificato con `git log -S'"max"' -- src/.daiku/project.json`: una sola modifica, il valore è sempre stato 5). I cinque worktree trovati non sono il tetto alzato: sono il tetto **raggiunto** e mai svuotato. Se il numero atteso era 3, è perché tre delivery riuscite avrebbero dovuto rigirarsi su tre slot — non perché il tetto sia cambiato.

## Che cosa resta fuori

- La decisione su che fine fanno i contenuti sporchi di `agent-tree-1` e `agent-tree-5` è dell'owner su questo progetto, non una voce di questo ticket.
- La ripulitura delle tre directory orfane `agent-<hash>` è dell'host, non del pool Daiku.
