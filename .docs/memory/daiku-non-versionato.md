---
name: daiku-non-versionato
description: "niente di ciò che sta sotto .daiku/ entra nei commit — il ramo di guardia che lo impone, e la conseguenza sulla sede della memoria"
metadata:
  type: project
---

Niente di ciò che sta sotto `.daiku/` **entra nella storia condivisa**: `project.json`,
`environment.json`, `domain/`, `policies/`. La cartella è lo **stato d'attrezzo** della macchina,
`init` la rigenera su ognuna, e un clone parte senza parametri e rilancia `/init`. `.gitignore`
dovrebbe escluderla, ma la riga la scrive l'utente: `init` la **dichiara**, non tocca mai
`.gitignore`.

**Il controllo che la impone è il ramo `.daiku/` di `command-guard.mjs`**, sempre acceso su ogni
progetto che ha aperto Daiku: nega un `git add`/`git commit` che nomini la cartella o qualunque path
dentro di essa, e nega il commit nudo o con `-a` quando lo stage — o, con `-a`, l'albero — ne porta
uno. Lo stage lo legge con un `git status` in sola lettura, che davanti a un guasto degrada ad
allow, come tutto il resto del presidio. Il banco del guard tiene i casi «`.daiku/` si nega» accanto
a quelli che devono restare permessi — un commit limitato ad altri path, e una cartella che si
chiama `a.daiku/` o `.daiku2/`.

**La conseguenza che non si vede: `{memory.root}` non può stare lì dentro.** Il corpus è del
progetto e si legge in un `diff`, e una memoria scritta sotto una cartella esclusa non si committa
mai — il gruppo memoria di `commit` verrebbe negato dalla guardia. La sede che `init` propone sta
quindi alla radice tecnica, fuori da `.daiku/`.

**La seconda conseguenza si vede solo dentro una consegna: una worktree del pool non ha `.daiku/`.**
La cartella non è versionata, quindi `git worktree add` non la porta con sé. Chi ci lavora non ha
parametri — li legge dall'albero principale, per path, e lo *Step 7* di `init` non è l'unico a
doverlo sapere — e ciò che scrivesse sotto `.daiku/` sparirebbe alla pulizia della fase 6c, perché
il merge porta in `main` solo ciò che è stato committato. È la ragione per cui la 5b di
`deliver-feature` scrive le **sedi versionate** (`{hosts.<host>.instructions_file}`, `{memory.root}`,
`{tech_doc}`) nella worktree e **tutto `.daiku/`** nell'albero principale.

**Why:** la cartella è attrezzo dell'agente, non sorgente del progetto — come `node_modules/`:
`init` la rigenera su ogni macchina, e ciò che un clone deve trovare è il codice, non la scheda che
qualcuno ha compilato per sé. Il prezzo è dichiarato e si paga: un clone non ha né parametri né
regole di area né criteri di dominio finché qualcuno non rilancia `/init`, e le policy e il domain
**scritti a mano** non si rigenerano — vanno riscritti su ogni macchina.

**How to apply:** la regola vive in cinque sedi e vanno tenute insieme — la §8 di
`contracts/project-contract.md`, lo *Step 4* e lo *Step 7* di `skills/init/SKILL.md`, la sezione
*`.daiku/` is never committed* di `skills/commit/SKILL.md` col punto 3 della sua procedura, il ramo
di `hooks/lib/command-guard.mjs`, e la tabella di `hooks/README.md`. La sesta è il banco del guard,
che si lancia con gli altri da `node plugins/daiku/hooks/self-check.mjs`.

Vedi [[tre-livelli-di-parametro]], [[guardrail-nascono-spenti]] e [[init-aggancia-la-memoria]].
