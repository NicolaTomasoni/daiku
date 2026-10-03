---
name: studio-solo-online
description: "studia-repository legge il target solo via API, agganciata a uno sha: non clona, non scrive il target su disco e non esegue niente, e una voce `adotta`/`adatta` vuole l'evidenza letta a file più la licenza — non un ramo profondo"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-03
---

Dal 3 ottobre 2026 `studia-repository` ha **un solo ramo**: legge il target online — `gh api` per
l'albero e i file, il registry o `WebFetch` per il resto — agganciata a uno sha di commit. Non clona,
non copia il target su disco, non lo esegue: `run.json` registra la via (`api`/`registry`/`web`) e lo
sha, e un `acquisizione.path` valorizzato è rosso al gate `check-run.mjs`.

**Il gate `adotta`/`adatta` non chiede più il ramo profondo: chiede l'evidenza letta a file.** Almeno
un `EV-*` che il ledger classifica `lato: target` con `verifica` in `VERIFIED`/`PARTIALLY_VERIFIED`, e
il campo `Licenza` non vuoto. La regola vecchia — «una corsa leggera non può adottare niente» — è
caduta con il ramo: adesso è la qualità dell'evidenza a decidere, non la profondità
dell'acquisizione.

**Why:** l'owner non vuole portare in casa il codice di repository di terzi non verificati. Un
`git clone` di per sé non esegue niente — gli hook non viaggiano col clone — ma il vincolo è più
stretto, ed è gratis: l'API dà l'albero intero e i byte dei file agganciati a uno sha, che è forte
quanto un clone, e ciò che l'API non raggiunge è un gap dichiarato, non un motivo per clonare. Una
corsa non ha quindi né una radice di analisi in `%TEMP%` né una toolchain da installare: legge e
basta.

**How to apply:**
- Il contratto è `.claude/commands/studia-repository.md`; i divieti e il loro banco sono nella sua
  § *I divieti*. `check-run.mjs` prova che `acquisizione.via` stia in `api`/`registry`/`web` e che
  non ci sia un path del target.
- Un target che l'API non raggiunge — host senza API, repo troppo grande da enumerare — finisce fra i
  gap e le `limitations`: non si aggira clonando.
- I banchi: `node .docs/tools/studia-repository/self-check.mjs` somma `check-run.mjs` e `lotto.mjs`.

Vedi [[lotto-di-studi]] per il lotto, le voci `allinea` e il problema che ne esce, e
[[catalogo-di-feature]] per il catalogo dei contributi.
