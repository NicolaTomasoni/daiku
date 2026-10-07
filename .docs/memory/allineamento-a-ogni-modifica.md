---
name: allineamento-a-ogni-modifica
description: "L'allineamento di memoria, istruzioni, policy e documenti gira a ogni modifica e non solo al commit: perché la prosa da sola non bastava, e dov'è il controllo che lo dice"
metadata:
  type: feedback
---

**Deciso dall'owner il 7 ottobre 2026.** Il passo che allinea memoria, file di istruzioni, policy e
documenti al lavoro appena fatto gira **a ogni modifica**, nella stessa tornata: il commit non è la
sede di quella regola, è l'ultima. Che non ci sia niente da scrivere è il verdetto di un passo che
ha guardato — mai il motivo per non guardare, e mai una domanda da rimandare all'owner. La regola
sta in `CLAUDE.md`, sezione *La memoria si aggiorna nella stessa tornata*.

**Why:** una sessione in un progetto ospite ha chiuso dicendo «non ho toccato memory né `.daiku/`»,
motivando che la memoria non porta piani futuri. La prosa che diceva «allinea ciò che la tua
modifica ha reso falso» non è un vincolo: un agente può concludere da solo che non c'era niente da
guardare, e quella conclusione non la vede nessuno. È la legge di *Mai fidarsi di un LLM* applicata
al corpus — se il divieto non ha una sede deterministica, non esiste.

**How to apply:** la regola vive nelle sedi che un progetto ospite legge — `[corpus-never-behind]`
nel file di istruzioni che `init` deposita
(`plugins/daiku/templates/project/instructions.md`), il contratto della memoria
(`templates/project/domain/memory-contract.md`), il primo principio di
`plugins/daiku/skills/update-memory/SKILL.md` — e il controllo è in
`plugins/daiku/hooks/lib/stop-advice.mjs`: alla fine del turno dice quando la sessione ha scritto
sotto `{code_root}` e non ha toccato `{memory.root}`, col suo banco dentro
`node plugins/daiku/hooks/self-check.mjs`.

**È un avviso, non un diniego, e la scelta è questa.** Al commit la guardia della review nega già
`git commit` fuori dal ciclo, e il ciclo delega `update-memory` sullo stesso diff: perciò un commit
tace l'avviso invece di scavalcarlo — dove la guardia arriva, l'avviso non serve. Fuori dal ciclo
non c'è nessun gesto da negare, solo un turno che finisce, ed è lì che l'avviso parla.

Vedi [[guardrail-nascono-spenti]] per la regola delle due sedi e [[init-aggancia-la-memoria]] per i
due scrittori del corpus.
