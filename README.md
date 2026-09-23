# claude-code-router-extension

Un'estensione VS Code per redirigere il backend LLM di **Claude Code** — un clic nella status
bar, **per progetto**, senza lanciare nessun task e senza ricaricare la finestra.

Documento di progetto, scritto il **23 settembre 2026**. Raccoglie tutto quello che è stato
definito prima di scrivere una riga di codice: da dove nasce, cosa dice la documentazione
ufficiale, cosa si può fare e cosa no, e quali prove restano da fare.

> **Sul nome.** Si chiama "router" ma non fa routing e non è un proxy: nessun processo locale sta
> in mezzo al traffico. I backend qui supportati espongono già il protocollo Anthropic, quindi
> Claude Code ci parla diretto con `ANTHROPIC_BASE_URL`. Il nome è quello, la realtà è
> "selettore di backend".

---

## 1. Il problema

Oggi il backend si cambia con uno script PowerShell, `llm-switch.ps1`, che riscrive il blocco
`env` di `~/.claude/settings.json` — il file **dell'utente**, valido per ogni cartella aperta in
VS Code. È globale per costruzione, non per caso: lo dichiara il commento in testa allo script
(«Lo switch e' di macchina, non di progetto»).

Lo si invoca da un task VS Code, e i task sono **per workspace**: sono stati copiati a mano in
due progetti e nel terzo non ci sono. Ogni progetto nuovo è una copia da rifare. Da qui tre
fastidi:

- i task vanno replicati a mano in ogni `.vscode/tasks.json`;
- cambiare progetto non cambia backend: va lanciato il task **e** ricaricata la finestra, perché
  l'estensione rilegge quel file all'avvio della sessione;
- il valore non è una proprietà del progetto, quindi non può seguire il progetto.

L'obiettivo è ribaltare il rapporto: **la scelta del backend diventa una proprietà del progetto**,
visibile e modificabile da un elemento cliccabile nella status bar in basso.

---

## 2. Com'è adesso: i profili

Lo script conosce quattro backend. Nessuno richiede un proxy locale: tutti e tre i terzi espongono
un endpoint Anthropic-compatibile nativo.

| Profilo | Endpoint (`ANTHROPIC_BASE_URL`) | Modello principale | Haiku / side-query |
|---|---|---|---|
| `claude` | *(nessun override: si torna alla subscription)* | `opus[1m]` | — |
| `deepseek` | `https://api.deepseek.com/anthropic` | `deepseek-flash` | `deepseek-flash` |
| `muse` | `https://api.meta.ai` | `muse-spark-1.3-contributor` | `muse-spark-1.3-contributor` |
| `glm` | `https://api.z.ai/api/anthropic` | `glm-5.3[1m]` | `glm-5.3-flash[1m]` |

Tre dettagli dello script che vanno conservati, perché sono frutto di prove e non di gusto:

- **`ANTHROPIC_AUTH_TOKEN`, non `ANTHROPIC_API_KEY`.** Con una subscription attiva, Claude Code
  ignora `ANTHROPIC_API_KEY` e continua a spedire il token OAuth Anthropic, che il backend terzo
  rifiuta con 401. `ANTHROPIC_AUTH_TOKEN` scrive direttamente l'header `Authorization` e vince
  sull'OAuth.
- **I modelli vanno fissati esplicitamente.** `settings.json` ha `model = "opus[1m]"`, e un alias
  nudo su un backend terzo torna 400. Servono i nomi veri, più `ANTHROPIC_DEFAULT_OPUS_MODEL`,
  `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` e `CLAUDE_CODE_SUBAGENT_MODEL`.
- **`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`** evita i crash su header beta che il backend terzo
  non riconosce. Più `CLAUDE_CODE_MAX_CONTEXT_TOKENS=1000000` (o `CLAUDE_CODE_AUTO_COMPACT_WINDOW`
  per GLM), perché Claude Code assume 200K per un model ID che non riconosce.

Le chiavi API **non** stanno nei file versionati: oggi in `llm-switch.secrets.json`, domani nel
`SecretStorage` dell'estensione.

---

## 3. I fatti verificati sulla documentazione

Verificati il 23 settembre 2026 sulle pagine ufficiali, non a memoria.

1. **`env` ha scope "Any file".** Si può mettere in `~/.claude/settings.json`, in
   `.claude/settings.json` e in `.claude/settings.local.json`.
2. **La gerarchia è**: `managed` → argomenti da riga di comando → `.claude/settings.local.json` →
   `.claude/settings.json` → `~/.claude/settings.json`. Il livello più specifico vince.
3. **Dentro `env` il merge è per variabile, non per blocco**: il file di progetto sovrascrive le
   variabili che nomina e lascia in piedi le altre del file utente.
4. **Non si può disinserire una variabile dal file.** «In a settings file you can set a variable
   but you can't remove one». La stringa vuota conta come "unset" per la scelta del provider.
5. **Un `env` in un file di progetto richiede che la cartella sia trusted**, altrimenti non si
   applica — irrilevante sul proprio progetto, dove il trust c'è già.
6. **Esiste `claudeCode.environmentVariables`**, un'impostazione dell'estensione Claude Code che
   inietta variabili nel processo agente. Ma ha **scope di macchina**, non di progetto: quindi è la
   leva sbagliata per questo problema (vedi §4).

---

## 4. Il limite duro: il processo si spawna una volta

L'estensione Claude Code **spawna il processo agente dalla finestra VS Code**, e quel processo
legge il suo ambiente **una volta sola, alla nascita**. Nessuna estensione terza può cambiare
l'ambiente di un processo già partito: non esiste API per farlo.

Le tre leve possibili, e perché due sono sbagliate:

| Leva | Verdetto |
|---|---|
| `claudeCode.environmentVariables` | Scope di macchina, non di progetto. Non risolve il problema. |
| L'ambiente del processo VS Code | Fuori portata, e comunque globale. |
| **Il blocco `env` nel `settings.json` di Claude Code** | **È la strada.** È l'unica per progetto *per contratto*. |

**Sul "senza ricaricare" c'è una tensione fra le fonti, e va provata.** La documentazione ufficiale
dice che una sessione in corso applica i valori `env` nuovi o cambiati quando il file viene
salvato; il comportamento osservato dell'estensione dice il contrario, che l'agente legge una volta
e serve "Developer: Reload Window". Le due cose non possono essere entrambe vere.

**Ma se il valore vive nel progetto, il problema si svuota da solo.** Il reload serviva perché il
valore era globale e lo si cambiava *mentre si lavorava in un progetto che restava quello*. Con il
valore nel progetto, aprire la finestra è già "applicare": non c'è nessun momento in cui serve un
gesto. Il clic resta solo per **cambiare idea a metà lavoro** — e anche lì l'estensione può fare
ciò che il task non faceva: eseguire lei il reload (`workbench.action.reloadWindow` è invocabile da
un'estensione terza), o meglio invocare il comando di riavvio sessione dell'estensione Claude Code,
se ne espone uno.

---

## 5. Il disegno

**La verità è il file, non l'estensione.** Il clic scrive `<progetto>/.claude/settings.local.json`;
la status bar legge *da lì* il backend attivo. Nessuno stato parallelo tenuto in memoria: così la
scelta vale anche lanciando `claude` a mano dal terminale, e sopravvive alla disinstallazione
dell'estensione. Un'estensione che tiene la propria copia della verità è la prima cosa che si
disallinea.

Sopra a questo:

- **Status bar** in basso: `⚡ GLM 5.3`, aggiornata sulla cartella attiva, cliccabile → QuickPick
  con i profili (`DeepSeek`, `Muse`, `GLM`, `Claude (abbonamento)`, `nessun override`).
- **Multi-root**: un workspace con più cartelle ha più progetti; la status bar segue la cartella
  attiva.
- **Segreti in `SecretStorage`** (`context.secrets` di VS Code), non in chiaro dentro il progetto.
  È il posto che VS Code ha fatto apposta per questo, e toglie l'unica vera obiezione al fatto che
  la scelta viva in un file di progetto.
- **Il blocco si scrive sempre intero**, mai a pezzi: `base_url` di un profilo con i modelli di un
  altro è il guasto silenzioso da evitare per costruzione.
- **Default di macchina**: il file utente resta senza `env`, così i progetti che non dichiarano
  nulla vanno su Claude. Il profilo scritto nel progetto si conserva in un file per-utente
  dell'estensione, non nel codice.

### Il disegno scartato

Tenere un default globale e sovrascriverlo per progetto sembra più flessibile, ma il merge per
variabile lo rende una trappola: siccome nessuna variabile coincide fra due profili, l'override
deve riscrivere **il blocco intero** ogni volta — quindi tanto vale il disegno scelto. E per
tornare a Claude dentro un progetto servirebbe la stringa vuota (fatto 4 di §3), cioè proprio il
caso raro e delicato. Con l'`env` in un solo posto non esistono due fonti che possono
contraddirsi.

---

## 6. Cosa non fa, per onestà

- **Non cambia il backend di una sessione già viva**, con ogni probabilità (vedi §7, prova 2).
- **Non vale per un terminale aperto fuori dalla cartella del progetto**: il file è per-progetto,
  non per-utente.
- Se il cambio non si applica a caldo, **cambiare idea a metà lavoro costa la sessione in corso**.
  Accettabile, ma è un costo.
- **Se un giorno Claude Code cambia il modo in cui legge `env`, l'estensione è sul filo.** La
  mitigazione è leggere sempre lo stato dal file invece di fidarsi di una copia in memoria.

---

## 7. Le quattro prove, prima di scrivere codice

Nell'ordine. La prima è quella che fonda tutto: se cade, cade l'idea intera.

1. **`.claude/settings.local.json` di progetto con il blocco `env`: il pannello VS Code lo rispetta
   all'avvio della sessione?**
2. Cambiare il file **con la sessione aperta**: `/status` cambia senza reload?
3. **Togliere il blocco basta a tornare su Claude**, o serve `ANTHROPIC_BASE_URL: ""`?
4. **`claudeCode.environmentVariables` è impostata nel settings VS Code?** Se sì, potrebbe avere la
   precedenza sul file e va neutralizzata.

Le prove 1–3 sono dieci minuti su un progetto di scarto. La 4 richiede di guardare
`%APPDATA%\Code\User\settings.json`.

---

## 8. Come si costruisce

L'attrezzatura c'è già su questa macchina: Node 22, npm 10, `code` 1.139.

- Estensione TypeScript con `contributes.configuration` per i profili e
  `window.createStatusBarItem` per l'elemento cliccabile.
- Impacchettamento con `npx @vscode/vsce package`, installazione dal `.vsix`.
- **Nessun publisher e nessun marketplace**: resta tutto locale.

I due `.vscode/tasks.json` che oggi replicano i cinque task a mano diventano inutili, e si
cancellano **dopo** che l'estensione funziona, non prima.

---

## 9. Riferimenti

- [Settings files and precedence](https://code.claude.com/docs/en/settings)
- [Settings reference](https://code.claude.com/docs/en/settings-reference)
- [Environment variables](https://code.claude.com/docs/en/env-vars)
- [Use Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- [Exporting ANTHROPIC_BASE_URL does not reach the Claude Code panel in VSCode](https://dev.to/vinhnguyenthanhdn/exporting-anthropicbaseurl-does-not-reach-the-claude-code-panel-in-vscode-49n9)
