Cosa resta da decidere

1. **Il nome definitivo di Kaji.** `extensions/kaji/BRANDING.md` propone *Kaname*; fino alla scelta
   restano il nome di lavoro e il prefisso `CCR` dei comandi. Il nome decide anche quello del
   repository pubblico di Kaji.
2. **La lingua del prodotto Kaji.** La regola d'inglese di `CLAUDE.md` copre `plugins/daiku/`;
   `extensions/kaji/TECH-STACK.md` P21 fissa una UI in italiano, ma il Marketplace di VS Code —
   `displayName`, `description`, README — parla inglese.
3. **Dove vive il contratto fra Daiku e Kaji.** Il primo è lo schema degli eventi degli agenti:
   Daiku sa ruolo e fase della catena, Kaji modello, token e costo. Nessuno dei due può leggere
   un file dell'altro, quindi ciascuno deve portarne una copia o una sua lettura; va deciso chi
   lo possiede e come si tiene allineato.
4. **Le skill del cantiere su Kaji.** Tutte le skill di `.claude/commands/` sono scritte sulla forma
   di Daiku (validatori, liste di copia, `plugins/daiku/`). Farle valere anche per Kaji è una
   modifica al cantiere, e va decisa.
5. **Gli script di pubblicazione.** Uno per prodotto, a lista di ammissione; nessuno dei due esiste.
6. **Tre classificazioni di Daiku che il modello calcola ancora a mano.** Le ha trovate il prompt
   audit (`.docs/audit/prompt-audit-2026-09-25.md`), e ciascuna diventerebbe codice con il suo banco:
   il verdetto di giro di `review` (oscillazione, fix su fix precedente, conteggio dei severi), che
   dipende solo dal ledger e potrebbe essere una domanda `round` di `architect/architect.mjs`; il
   controllo `layers:` di `arch-check`, che è cartelle × righe aggiunte × sottostringa; la forma del
   blocco che `decision-doc` restituisce, già scritta in `schemas/blocks.json` ma che nessuno script
   verifica. Cambiano chi possiede quelle decisioni, quindi sono una scelta di metodo.
7. **Il divieto del trailer `Co-Authored-By` in `commit`.** È portante — l'host lo chiede — ma non
   ha né un perché scritto accanto né un controllo deterministico che lo imponga: o gli si
   costruisce una sede (un ramo del command guard, un hook `commit-msg`), o per la regola di
   `CLAUDE.md` il divieto non esiste.
