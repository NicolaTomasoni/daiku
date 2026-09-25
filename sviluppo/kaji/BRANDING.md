Sì: **cambia il modo in cui lo nominiamo sul Marketplace, non necessariamente il brand**.

Per VS Code farei una distinzione molto netta:

**Brand:** `Kaname`
**Nome Marketplace:** `Kaname — Model & Provider Control for Claude Code`
**Tagline:** `The control center for your Claude Code backends.`

Questa secondo me è molto più forte di chiamarlo semplicemente `Kaname`, ma anche molto più riconoscibile di diventare l'ennesimo `Claude Code Provider Switcher`.

Microsoft dice esplicitamente che `displayName` e `description` vengono usati nella ricerca testuale di VS Code e che i `keywords` servono a rendere l'estensione più facile da trovare. I tag sono inoltre ricercabili direttamente dalla Extensions view. ([GitHub][1])

Il ranking esatto di “relevance” non è documentato, quindi non parlerei di SEO nel senso Google. Ma possiamo fare **search positioning** molto deliberato.

La struttura che userei è:

```json
{
  "name": "kaname-claude-code",
  "displayName": "Kaname — Model & Provider Control for Claude Code",
  "description": "Switch Claude Code providers and models per project from the VS Code status bar, with live model, effort, usage, context and automatic fallback.",
  "keywords": [
    "claude",
    "claude-code",
    "anthropic",
    "provider",
    "provider-switcher",
    "model",
    "model-switcher",
    "backend",
    "backend-switcher",
    "llm",
    "status-bar",
    "api-provider",
    "deepseek",
    "glm",
    "mimo",
    "failover",
    "fallback",
    "rate-limit",
    "context-window",
    "throughput"
  ]
}
```

In pratica vogliamo vincere almeno queste ricerche:

`claude code`
`claude code provider`
`claude provider`
`claude model switcher`
`provider switcher`
`model switcher`
`claude status bar`
`deepseek claude code`

Ed è importante perché il Marketplace è già pieno esattamente dei nomi generici che avevi previsto: ci sono **Claude Code Model Switcher**, **Claude Code API Switcher**, **Claude Code Provider Switcher**, **Claude Provider Switcher**, **Claude Switcher**, ecc. ([Marketplace di Visual Studio][2])

Quindi chiamarsi:

> **Claude Code Provider Switcher**

significa avere ottime keyword ma **zero identità**.

Chiamarsi soltanto:

> **Kaname**

significa avere identità ma chiedere al Marketplace di capire da solo cosa siamo.

La combinazione:

> **Kaname — Model & Provider Control for Claude Code**

fa entrambe le cose.

E sceglierei deliberatamente **Control**, non solo **Switcher**. Il prodotto è già più di uno switcher: mostra modello/effort/throughput, gestisce credenziali, contesto e quota, e il fallback automatico è nel disegno.  Quindi possiamo possedere una categoria leggermente diversa:

**Kaname is the control center for Claude Code backends.**

Poi nella seconda riga diciamo le parole che le persone cercano:

**Switch providers and models per project, directly from the VS Code status bar.**

Questa è una posizione molto migliore.

C'è anche un piccolo aspetto di branding/trademark: eviterei qualcosa che sembri il nome di un prodotto ufficiale Anthropic, tipo **Claude Code Control Center** come brand principale. Anthropic richiede che software di terzi non suggerisca partnership, sponsorship o endorsement. ([Claude Centro Assistenza][3]) Mettere **Kaname** davanti e usare “for Claude Code” descrittivamente è anche più pulito da quel punto di vista.

Perciò la gerarchia visiva diventerebbe:

**KANAME**
*Model & Provider Control for Claude Code*

e nell'icona/status bar semplicemente:

**Kaname**

Non porterei invece tutto il sottotitolo dentro l'interfaccia.

Una cosa però mi farebbe ancora riflettere sul nome `Kaname`: **il problema non è VS Code SEO, è la proprietà del brand fuori da VS Code**. Sul Marketplace non mi è emerso un omonimo evidente, ma come avevamo visto nella ricerca precedente `Kaname` esiste già in contesti software abbastanza vicini. Se vogliamo qualcosa che tra un anno abbia repo GitHub, dominio, docs e magari altri plugin, io continuerei ancora un giro di naming cercando **“significato Kaname + unicità forte”**.

In altre parole: ora abbiamo anche un nuovo requisito molto utile per scegliere il nome:

> **Deve funzionare in “_____ — Model & Provider Control for Claude Code”.**

Questo elimina parecchi candidati. `Kaname` lì funziona molto bene.

Se vuoi, farei adesso una ricerca mirata di **10–15 nomi tipo Kaname**, ma stavolta li valuterei contemporaneamente su **GitHub + VS Code Marketplace + dominio/Googleability + pronuncia + resa con il sottotitolo**. È probabilmente il giro che ci porta davvero al nome definitivo.

[1]: https://github.com/Microsoft/vscode-docs/blob/main/api/references/extension-manifest.md?utm_source=chatgpt.com "vscode-docs/api/references/extension-manifest.md at main · microsoft/vscode-docs · GitHub"
[2]: https://marketplace.visualstudio.com/items?itemName=xiaomila.claude-api-switcher&utm_source=chatgpt.com "Claude Code API Switcher - Visual Studio Marketplace"
[3]: https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms?utm_source=chatgpt.com "Anthropic Software Directory Terms | Claude Help Center"




Nome scelto: Kaji (Timone)