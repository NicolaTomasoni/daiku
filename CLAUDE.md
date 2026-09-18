In questo progetto sviluppiamo Daiku, un'estensione per Claude Code e Codex che implementa un
agent loop.

## Comportamento
Rispondi in italiano e in modo chiaro e semplice, non dare per scontato che l'utente conosca il progetto perché cambia spesso e va rispegato.

## Questo file non fa parte di Daiku

`CLAUDE.md` è come si **sviluppa** Daiku, non è Daiku. Lo stesso vale per `.claude/`, `.vscode/`
e tutto ciò che sta sotto `sviluppo/`. Restano in radice perché gli host li cercano lì, non
perché appartengano al prodotto.

**Il prodotto è `plugins/daiku/`, e nient'altro.** È l'unico albero che viene distribuito e
installato; i due `marketplace.json` in radice sono la vetrina che lo indirizza.

| Sede | Cos'è |
|---|---|
| `plugins/daiku/` | **il prodotto** — l'unica cosa che l'utente riceve |
| `.claude-plugin/marketplace.json` | vetrina Claude Code, punta a `./plugins/daiku` |
| `.agents/plugins/marketplace.json` | vetrina Codex, stessa destinazione |
| `sviluppo/` | ricognizione, punti aperti, memoria, esempi |
| `CLAUDE.md`, `.claude/`, `.vscode/` | sviluppo, obbligati in radice dagli host |

Prima di aggiungere un file, decidi a quale delle due metà appartiene. Se serve a chi *usa*
Daiku va sotto `plugins/daiku/`; se serve a chi lo *costruisce*, no.

## Due repository: qui si sviluppa, altrove si pubblica

Questo repository è lo **sviluppo**: privato, e con dentro tutto — prodotto, ricognizione, punti
aperti, memoria, esempi, istruzioni. Non diventa mai pubblico, e la sua storia non si ripulisce:
porta `CLAUDE.md` nel commit iniziale.

La **pubblicazione** è un secondo repository su GitHub, che non è un branch di questo né un fork:
è un albero generato. A ogni rilascio uno script copia lì i soli path ammessi — `plugins/`,
`.claude-plugin/`, `.agents/`, `README.md`, `.gitattributes` — e committa. Là dentro non si
lavora mai. *(Lo script
non esiste ancora, e nemmeno il repository su GitHub: al 18 settembre 2026 la pubblicazione è
decisa ma non ancora attrezzata.)*

Serve perché chi aggiunge il marketplace riceve un clone dell'**intero** repository, non solo di
`plugins/daiku/` — lo schema di Claude Code lo dice alla voce `sparsePaths`, «If omitted, the
full repository is cloned». Il repo *è* l'artefatto consegnato: non c'è un passo di
impacchettamento dove mettere il filtro, come farebbe il campo `files` di un `package.json`.

Il confine quindi non sta più nel `.gitignore`, che ora esclude solo `.claude/settings.local.json`.
Sta nella lista di copia dello script, e va tenuto nella stessa forma a lista di ammissione:
«copia questi path», mai «copia tutto tranne». Un file nuovo nasce così fuori dal pacchetto
pubblicato, ed è il contrario di una dimenticanza che pubblica.

E il confine non guarda *dentro* i file: ciò che sta sotto `plugins/` viene pubblicato com'è.
Prima di un rilascio, controlla che non porti con sé valori di un progetto ospite o path di
questa macchina.

## ReforgIA non è Daiku: ignorala, sempre

Daiku nasce estraendo il metodo da **ReforgIA**, il progetto su cui è stato costruito. Nel
pacchetto sopravvivono residui di quell'estrazione: path (`apps/backend/venv`, `docs/scripts/`,
`.dev-runtime/enabling-loop`), macchinari che qui non esistono (il ciclo di abilitazione), nomi
e valori di quel dominio.

Non segnalarli a meno che non ti venda chiesto. 

## Dove sta ogni cosa

`sviluppo/RICOGNIZIONE.md` è il documento di riferimento: dice cosa offrono i due host, cosa
manca, cosa è stato buttato e perché ogni file sta dove sta — con le prove eseguite sui
validatori reali di Claude Code e Codex.

`sviluppo/memory/` è la memoria persistente del progetto, versionata. Non è il path predefinito:
lo dichiara `autoMemoryDirectory` in `.claude/settings.local.json`, che **non** si versiona
perché Claude Code ignora quella chiave quando arriva da un file committato. Su una macchina
nuova va riscritto, altrimenti la memoria torna silenziosamente sotto `~/.claude/projects/`.

## Verificare il pacchetto

Le due validazioni vanno passate entrambe, sullo stesso albero:

```bash
claude plugin validate plugins/daiku
python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/daiku
```

La seconda richiede `pyyaml`. Non saltarla: i due validatori non coprono le stesse cose — è
quello di Codex a rifiutare i campi di manifest non ammessi, ed è quello di Claude Code a
segnalare le skill che si caricherebbero con i metadati vuoti.
