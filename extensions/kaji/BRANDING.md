# Kaji — branding

The brand and the Marketplace name are two different things.

**Brand:** `Kaji` (舵, the helm)
**Marketplace name:** `Kaji — Model & Provider Control for Claude Code`
**Tagline:** `The control center for your Claude Code backends.`

This is much stronger than calling it just `Kaji`, and much more recognisable than becoming yet
another `Claude Code Provider Switcher`.

Microsoft states explicitly that `displayName` and `description` are used by VS Code's text search,
and that `keywords` make the extension easier to find. Tags are also searchable directly from the
Extensions view. ([GitHub][1])

The exact "relevance" ranking is not documented, so this is not SEO in the Google sense. But the
search positioning can be very deliberate.

The structure:

```json
{
  "name": "kaji",
  "displayName": "Kaji — Model & Provider Control for Claude Code",
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

The searches to win, at least:

`claude code`
`claude code provider`
`claude provider`
`claude model switcher`
`provider switcher`
`model switcher`
`claude status bar`
`deepseek claude code`

This matters because the Marketplace is already full of exactly the generic names one would
expect: **Claude Code Model Switcher**, **Claude Code API Switcher**, **Claude Code Provider
Switcher**, **Claude Provider Switcher**, **Claude Switcher**, and so on. ([Visual Studio
Marketplace][2])

So being called:

> **Claude Code Provider Switcher**

means great keywords and **zero identity**.

Being called only:

> **Kaji**

means identity, but asks the Marketplace to work out on its own what the product is.

The combination:

> **Kaji — Model & Provider Control for Claude Code**

does both.

**Control** is chosen deliberately over **Switcher**. The product is already more than a switcher:
it shows model, effort and throughput, manages credentials, context and quota, and automatic
fallback is in the design. So it can own a slightly different category:

**Kaji is the control center for Claude Code backends.**

The second line then carries the words people search for:

**Switch providers and models per project, directly from the VS Code status bar.**

There is also a branding and trademark aspect: the main brand must not look like the name of an
official Anthropic product, such as **Claude Code Control Center**. Anthropic requires third-party
software not to suggest partnership, sponsorship or endorsement. ([Claude Help Center][3]) Putting
**Kaji** first and using "for Claude Code" descriptively is cleaner from that point of view too.

The visual hierarchy is therefore:

**KAJI**
*Model & Provider Control for Claude Code*

and in the icon and the status bar simply:

**Kaji**

The subtitle does not go inside the interface.

[1]: https://github.com/Microsoft/vscode-docs/blob/main/api/references/extension-manifest.md "vscode-docs/api/references/extension-manifest.md at main · microsoft/vscode-docs · GitHub"
[2]: https://marketplace.visualstudio.com/items?itemName=xiaomila.claude-api-switcher "Claude Code API Switcher - Visual Studio Marketplace"
[3]: https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms "Anthropic Software Directory Terms | Claude Help Center"
