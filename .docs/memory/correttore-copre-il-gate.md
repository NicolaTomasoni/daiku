---
name: correttore-copre-il-gate
description: "il correttore che un'area dichiara copre le classi del gate che un comando può applicare a semantica invariata — lint e formato — e non solo il lint: perché `lint_fix` porta due righe, da dove `init` deriva la seconda, e cosa resta scoperto nei progetti già aperti"
metadata:
  type: project
---

Dal 3 ottobre 2026 il correttore che un'area dichiara — `{areas.<area>.lint_fix}` — copre le
classi che il gate controlla e che un comando dichiarato può applicare a semantica invariata:
**lint e formato**. La sua `run` è una lista, e la riga di formato sta **dopo** quella del lint,
perché una correzione di lint può cambiare la formattazione e il formato deve essere l'ultima
scrittura. `init` deriva la riga di formato dalla **forma di controllo dichiarata dal gate**: ne
risolve il comando aggregato nei suoi script, riconosce quello che controlla il formato e ne ricava
la scrittura col flag di scrittura del formatter — `<FILES>` al posto dell'argomento — lo stesso
movimento con cui prende il flag di fix dal linter.

**Why:** prima `lint_fix` applicava «only safe lint fixes», mentre il gate copriva anche il formato.
La fase *Gate* di `review` applica solo ciò che il `lint_fix` tocca e non esegue comandi non
dichiarati: dove linter e formatter sono due comandi distinti — Ruff è il caso reale — un rosso di
sola formattazione diventava **irriparabile**, e la consegna si chiudeva `BLOCKED_NO_COMMIT` con la
worktree sporca e lo slot del pool `blocked`. Il criterio è lint e formato, non il gate intero:
type-check, test e build non sono applicabili da un comando a semantica invariata, e prenderli alla
lettera renderebbe il criterio indecidibile.

**La trappola che il contratto non nomina: i progetti già aperti restano incoerenti.** `init` è
idempotente e non riscrive `project.json`, quindi la prevenzione vale per i progetti aperti d'ora in
poi; un'area già aperta con la coppia incoerente si corregge a mano. È il costo dichiarato, non un
difetto da riparare con un `init` più aggressivo.

L'allargamento **non incrementa `contract`**: nessuna chiave cambia nome o forma e nessuna skill
legge male la chiave, che si esegue com'è dichiarata. Vedi [[confine-degli-identificatori]] per
perché la chiave si estende invece di rinominarla, e [[guardrail-nascono-spenti]] per la regola
generale «un divieto senza sede deterministica non esiste» — qui la sede è la derivazione di `init`
e la prosa di §4, senza runtime nuovo.
