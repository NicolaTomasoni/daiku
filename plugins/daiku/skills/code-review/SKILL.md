---
name: code-review
allowed-tools: Bash(git remote:*), Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(glab mr view:*), Bash(glab mr diff:*), Bash(glab mr list:*), Bash(glab mr note:*), Bash(glab issue view:*), Bash(glab issue list:*), mcp__github_inline_comment__create_inline_comment
argument-hint: '[numero della PR, opzionale — senza, elenca quelle aperte e chiede quale] [--comment]'
description: 'Review di una pull request già pubblicata su GitHub o GitLab, con commenti inline sulla forge; è anche il contratto del finder `bug` che /review delega su un diff locale, e in quella modalità non scrive niente da nessuna parte'
---

Provide a code review for the given pull request (GitHub) or merge request (GitLab).

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Due modalità

- **Default (pull request).** Il diff è già pubblicato su una forge e l'esito sono commenti sulla PR: è il comportamento descritto in tutto il resto di questo file, dalla *Forge selection* in giù. Scope, permessi ed esito stanno in § *Modalità pull request* qui sotto.
- **Finder `bug` (invocata da `/review`).** Scope = il diff passato dal chiamante, non una PR. **Sola analisi**: nessun commento sulla forge, nessun fan-out interno, nessuna modifica al codice. Vedi *Modalità finder* qui sotto, che ha la precedenza su tutto il resto del file dove confligge.

## Modalità pull request (lanciata dall'owner)

**Argomenti**: `$ARGUMENTS` — il numero della PR, opzionale, e `--comment`. Senza numero, elenca
le PR aperte (`gh pr list` / `glab mr list`) e chiedi quale: qui l'owner c'è, ed è l'unica
modalità in cui puoi chiedergli qualcosa.

**Scope**: la PR indicata, e solo lei. Il working tree non c'entra: il diff lo prendi dalla
forge.

**Permessi di scrittura**: **nessun file, mai** — né nel repository né altrove. L'unica scrittura
ammessa sono i **commenti sulla forge**, e solo con `--comment`: senza quell'argomento la review
resta in chat. Nessun commit, nessun push, nessuna modifica al codice della PR.

**Esito**: il riepilogo in chat che il passo 7 descrive, in `{language.chat}`, e — con
`--comment` — i commenti inline che i passi 8 e 9 pubblicano. Non c'è un blocco JSON: questa
modalità non alimenta nessuna decisione a valle, perché chi l'ha lanciata legge l'esito da sé.

## Modalità finder (invocata da `/review`)

Attiva quando `/review` ti invoca come disciplina `bug`. Sei **già** il subagent assegnato a quella disciplina: la tua unica consegna è trovare difetti di correttezza introdotti dal diff e restituirli nel blocco JSON del chiamante.

**Non si esegue nulla di ciò che presuppone una PR o altri agenti.** In particolare: la *Forge selection* e ogni comando `gh`/`glab` (non c'è una forge in gioco — il frontmatter `allowed-tools` riguarda l'invocazione su PR, qui il perimetro te lo passa il chiamante); il **passo 1** e le sue condizioni di arresto (PR chiusa, draft, già commentata — nessuna si applica a un diff locale: non fermarti mai per quelle ragioni); i **passi 2-6**, cioè l'intero fan-out interno di agenti e la loro validazione, perché il ciclo di `/review` lo fa già a monte con finder indipendenti e a valle con un applicatore che riverifica ogni rilievo; i **passi 7-9**, riepilogo in chat, `--comment`, commenti inline e permalink.

**Tre regole di questo file qui non valgono**, perché sono tarate su commenti in una PR e non su un ciclo che riverifica:

- «Focus only on the diff itself without reading extra context» e «Do not flag issues that you cannot validate without looking at context outside of the git diff» — il perimetro di lettura lo fissa il livello di **effort** che il chiamante ti passa, non questo file: a `medium` apri i file che il diff tocca e i loro chiamanti diretti, a `high` anche i contratti e lo stato persistito attraversati.
- «Potential issues that depend on specific inputs or state» fra i *Do NOT flag* — qui i difetti input-dipendenti su scenari **raggiungibili** sono esattamente quelli che il ciclo classifica gravi. Restano fuori solo gli scenari non raggiungibili dal flusso.
- «If you are not certain an issue is real, do not flag it» — la certezza si esprime nel campo `confidenza`, perché l'applicatore riverifica ogni rilievo prima di applicarlo. Un rilievo verificato a confidenza bassa è informazione; un rilievo taciuto no.

**Resta valido, e vale il doppio:** i criteri **HIGH SIGNAL** del passo 4 (codice che non compila o non parsa, simboli non risolti, logica sbagliata a prescindere dagli input, violazioni di `{instructions_file}` di cui puoi citare la regola esatta) e la lista dei **falsi positivi** in fondo al file (difetti preesistenti, nitpick, cose che un linter prende, qualità generica non richiesta da `{instructions_file}`). Un rilievo su codice non toccato dal diff non è di questo giro.

**La scala di `confidenza`** è tarata sui criteri che questo file già porta, ed è quella su cui il
ciclo decide a ogni giro: dal giro 2 in poi `bug` è l'unica disciplina attiva, quindi da lì la
confidenza del ciclo è tutta tua.

- **Confidenza alta:** il difetto sta nel diff e non dipende da nulla fuori da esso. Sono i criteri
  **HIGH SIGNAL** del passo 4: codice che non compila o non parsa (errore di sintassi o di tipo,
  import mancante, riferimento non risolto), logica che produce il risultato sbagliato **a
  prescindere dagli input**, violazione di `{instructions_file}` di cui citi la regola esatta. `cambiamento`
  riporta il fix concreto.
- **Confidenza media:** difetto reale che si manifesta solo su **input o stato specifici** — la
  seconda deroga qui sopra li riammette quando lo scenario è raggiungibile dal flusso: nomina nella
  `descrizione` lo scenario che lo raggiunge. `cambiamento` riporta comunque il fix concreto.
- **Confidenza bassa:** sospetto che per confermarsi richiede di leggere oltre il perimetro che
  l'effort ti concede — un chiamante più lontano, un contratto o uno stato persistito che il diff
  non mostra — nessun `cambiamento`; la `descrizione` dice cosa resta da verificare. È il caso che
  la terza deroga tiene in vita: un rilievo verificato a confidenza bassa è informazione, e
  l'applicatore lo riverifica prima di toccare qualsiasi cosa.

Restituisci il blocco dichiarato da `skills/finder-prompt/SKILL.md` § *Il blocco che
restituisci*, per intero e con quei nomi di campo, e nient'altro: leggilo da lì, qui non è
ricopiato. Per questa disciplina `simbolo` è la classe, la funzione o il componente che porta il
difetto, `cambiamento` è il fix concreto, e `descrizione` porta il difetto, l'evidenza sulla riga
e lo scenario in cui si manifesta.

---

**Forge selection (do this first):** read `git remote get-url origin`. If the host is github.com or a GitHub Enterprise instance, use the `gh` CLI and the GitHub column below. Otherwise the remote is GitLab: use the `glab` CLI and the GitLab column. Every step that names a command has both forms; substitute "pull request"/"PR" with "merge request"/"MR" throughout when on GitLab.

| purpose | GitHub | GitLab |
| --- | --- | --- |
| view + state/draft | `gh pr view <N>` | `glab mr view <N>` |
| view comments | `gh pr view <N> --comments` | `glab mr view <N> --comments` |
| diff | `gh pr diff <N>` | `glab mr diff <N>` |
| list | `gh pr list` | `glab mr list` |
| post a summary comment | `gh pr comment <N> --body ...` | `glab mr note <N> -m ...` |
| post an inline comment | `mcp__github_inline_comment__create_inline_comment` | not available — see step 9 |

If the required CLI for the detected forge is not installed, stop and report that instead of falling back to the other one.

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls. Make sure this is clear to every subagent that is launched.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.
- Every agent below is named by its **role** — `judge` or `worker` — never by a model. `contracts/orchestration.md` is the single place that resolves a role to the model of the current host, and the single place that says how a subagent is launched there: read it before launching any of them.

To do this, follow these steps precisely:

1. Launch a worker agent to check if any of the following are true:
   - The pull request is closed
   - The pull request is a draft
   - The pull request does not need code review (e.g. automated PR, trivial change that is obviously correct)
   - Claude has already commented on this PR (check `gh pr view <PR> --comments` / `glab mr view <MR> --comments` for comments left by claude)

   If any condition is true, stop and do not proceed.

Note: Still review Claude generated PR's.

2. Launch a worker agent to return a list of file paths (not their contents) for all relevant `{instructions_file}` files including:
   - The root `{instructions_file}` file, if it exists
   - Any `{instructions_file}` files in directories containing files modified by the pull request

3. Launch a worker agent to view the pull request and return a summary of the changes

4. Launch 4 agents in parallel to independently review the changes. Each agent should return the list of issues, where each issue includes a description and the reason it was flagged (e.g. "`{instructions_file}` adherence", "bug"). The agents should do the following:

   Agents 1 + 2: `{instructions_file}` compliance worker agents
   Audit changes for `{instructions_file}` compliance in parallel. Note: When evaluating `{instructions_file}` compliance for a file, you should only consider `{instructions_file}` files that share a file path with the file or parents.

   Agent 3: judge bug agent (parallel subagent with agent 4)
   Scan for obvious bugs. Focus only on the diff itself without reading extra context. Flag only significant bugs; ignore nitpicks and likely false positives. Do not flag issues that you cannot validate without looking at context outside of the git diff.

   Agent 4: judge bug agent (parallel subagent with agent 3)
   Look for problems that exist in the introduced code. This could be security issues, incorrect logic, etc. Only look for issues that fall within the changed code.

   **CRITICAL: We only want HIGH SIGNAL issues.** Flag issues where:
   - The code will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
   - The code will definitely produce wrong results regardless of inputs (clear logic errors)
   - Clear, unambiguous `{instructions_file}` violations where you can quote the exact rule being broken

   Do NOT flag:
   - Code style or quality concerns
   - Potential issues that depend on specific inputs or state
   - Subjective suggestions or improvements

   If you are not certain an issue is real, do not flag it. False positives erode trust and waste reviewer time.

   In addition to the above, each subagent should be told the PR title and description. This will help provide context regarding the author's intent.

5. For each issue found in the previous step by agents 3 and 4, launch parallel subagents to validate the issue. These subagents should get the PR title and description along with a description of the issue. The agent's job is to review the issue to validate that the stated issue is truly an issue with high confidence. For example, if an issue such as "variable is not defined" was flagged, the subagent's job would be to validate that is actually true in the code. Another example would be `{instructions_file}` issues. The agent should validate that the `{instructions_file}` rule that was violated is scoped for this file and is actually violated. Use judge subagents for bugs and logic issues, and worker subagents for `{instructions_file}` violations.

6. Filter out any issues that were not validated in step 5. This step will give us our list of high signal issues for our review.

7. Output a summary of the review findings to the terminal:
   - If issues were found, list each issue with a brief description.
   - If no issues were found, state: "No issues found. Checked for bugs and `{instructions_file}` compliance."

   If `--comment` argument was NOT provided, stop here. Do not post any comments to the forge.

   If `--comment` argument IS provided and NO issues were found, post a summary comment using `gh pr comment` / `glab mr note` and stop.

   If `--comment` argument IS provided and issues were found, continue to step 8.

8. Create a list of all comments that you plan on leaving. This is only for you to make sure you are comfortable with the comments. Do not post this list anywhere.

9. Post the comments.

   **On GitHub**, post one inline comment per issue using `mcp__github_inline_comment__create_inline_comment` with `confirmed: true`.

   **On GitLab**, there is no inline-comment tool available, so post a single `glab mr note` containing every issue as a section, each headed by a permalink to the offending lines. Everything below still applies to those sections.

   For each comment:
   - Provide a brief description of the issue
   - For small, self-contained fixes, include a committable suggestion block
   - For larger fixes (6+ lines, structural changes, or changes spanning multiple locations), describe the issue and suggested fix without a suggestion block
   - Never post a committable suggestion UNLESS committing the suggestion fixes the issue entirely. If follow up steps are required, do not leave a committable suggestion.

   **IMPORTANT: Only post ONE comment per unique issue. Do not post duplicate comments.**

Use this list when evaluating issues in Steps 4 and 5 (these are false positives, do NOT flag):

- Pre-existing issues
- Something that appears to be a bug but is actually correct
- Pedantic nitpicks that a senior engineer would not flag
- Issues that a linter will catch (do not run the linter to verify)
- General code quality concerns (e.g., lack of test coverage, general security issues) unless explicitly required in `{instructions_file}`
- Issues mentioned in `{instructions_file}` but explicitly silenced in the code (e.g., via a lint ignore comment)

Notes:

- Use the `gh` CLI on GitHub and the `glab` CLI on GitLab to interact with the forge (e.g., fetch pull/merge requests, create comments). Do not use web fetch.
- Create a todo list before starting.
- You must cite and link each issue in inline comments (e.g., if referring to a `{instructions_file}`, include a link to it).
- If no issues are found and `--comment` argument is provided, post a comment with the following format:

---

## Code review

No issues found. Checked for bugs and `{instructions_file}` compliance.

---

- When linking to code in inline comments, follow the following format precisely, otherwise the Markdown preview won't render correctly:
  - GitHub: https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - GitLab: same shape but with a `/-/` segment before `blob` and a `L10-15` line range (no second `L`), e.g. https://gitlab.example.com/group/project/-/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Host and repo path must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
