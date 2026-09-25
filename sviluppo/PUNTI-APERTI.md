Cosa resta da decidere

1. **Il nome definitivo di Kaji.** `sviluppo/kaji/BRANDING.md` propone *Kaname*; fino alla scelta
   restano il nome di lavoro e il prefisso `CCR` dei comandi. Il nome decide anche quello del
   repository pubblico di Kaji.
2. **La lingua del prodotto Kaji.** La regola d'inglese di `CLAUDE.md` copre `plugins/daiku/`;
   `sviluppo/kaji/TECH-STACK.md` P21 fissa una UI in italiano, ma il Marketplace di VS Code —
   `displayName`, `description`, README — parla inglese.
3. **Dove vive il contratto fra Daiku e Kaji.** Il primo è lo schema degli eventi degli agenti:
   Daiku sa ruolo e fase della catena, Kaji modello, token e costo. Nessuno dei due può leggere
   un file dell'altro, quindi ciascuno deve portarne una copia o una sua lettura; va deciso chi
   lo possiede e come si tiene allineato.
4. **Le skill del cantiere su Kaji.** Tutte le skill di `.claude/commands/` sono scritte sulla forma
   di Daiku (validatori, liste di copia, `plugins/daiku/`). Farle valere anche per Kaji è una
   modifica al cantiere, e va decisa.
5. **Gli script di pubblicazione.** Uno per prodotto, a lista di ammissione; nessuno dei due esiste.
