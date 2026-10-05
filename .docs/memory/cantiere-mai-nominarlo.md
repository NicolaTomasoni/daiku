---
name: cantiere-mai-nominarlo
description: "il cantiere e il ritardo dell'ultimo rilascio installato rispetto all'albero non sono un problema e non si nominano mai se non è l'owner a farlo"
metadata:
  type: feedback
  modified: 2026-10-02T09:23:40.000Z
---

**Il cantiere di `.claude/` — i due comandi che il prodotto non ha — e il fatto che l'ultimo
rilascio installato sia indietro rispetto a `plugins/` non sono un problema, e non si nominano mai
se non è l'owner a farlo.** Deciso dall'owner il 29 settembre 2026 per il cantiere, esteso il
2 ottobre 2026 al ritardo dello strumento installato, che l'owner ha dichiarato voluto.

**Why:** il cantiere sta a Daiku come il tavolo al mobile, e un tavolo non deve assomigliare al
mobile; il ritardo è la scelta di far girare lo sviluppo sull'ultimo rilascio pubblicato
invece che sull'albero vivo. Un elenco di ciò che è rimasto indietro costa attenzione a ogni
lettura e non cambia niente, perché nessuno lo stava per allineare.

**How to apply:** quando un lavoro tocca `plugins/daiku/`, non riportare in chat, in
`PUNTI-APERTI.md` né in una memoria che `.claude/` o lo strumento installato sono indietro, e non
proporre di allinearli. Si toccano solo su ordine esplicito dell'owner, e in quel momento è lui a
nominarli. Vedi [[corpus-di-sviluppo]].
