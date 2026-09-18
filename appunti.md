che cazzo è contratti/





agents/ — subagent a toolset ristretto (solo Claude Code)
Due definizioni: finder.md (Read, Grep, Glob, più git diff/log/grep) e auditor-memoria.md (Read, Grep, Glob e basta). Il punto è rendere la sola lettura vera per costruzione, non promessa in prosa: il tool per scrivere non c'è. Su Codex non valgono, lì quel livello dovrà scriverlo init dentro il progetto.

non va bene solo per uno, come risolviamo





hooks/ — il wiring deterministico (solo Claude Code)
hooks.json collega tre script .mjs in lib/:

Evento	Script	Cosa fa
PreToolUse su Bash/PowerShell	guardia-comandi.mjs	ferma i gesti distruttivi — guardrail contro la distrazione, non barriera di sicurezza (quella sta nei managed settings)
PostToolUse su Edit/Write	contratti-post-edit.mjs	lancia i controlli sul corpus sul gesto che introduce il difetto, non aspettando un commit che può non arrivare
SessionStart	ciclo-aperto.mjs	avvisa se c'è un ciclo di abilitazione già in corso, e a che punto è
Tutti degradano aperto: davanti a un ambiente non pronto tacciono ed escono 0.

idem con patate










templates/ — gli scheletri per il progetto ospite
Non vengono mai letti in place: esistono perché nessuno dei due host lascia che un pacchetto scriva nel progetto, quindi la copia la deve fare un comando che l'utente lancia. Tre destinazioni:

claude/settings.json → il settings.json del progetto, con gli stessi tre hook ricablati su ${CLAUDE_PROJECT_DIR};
owner/environment.json → il livello Ambiente: host, modello per ruolo, i backend LLM alternativi con i loro caveat;
progetto/project.json + progetto/dominio/README.md → il livello Parametri (path, comandi di gate, aree) e lo scheletro di .claude/context/.

non ho capito un cazzo









tools/ — per chi sviluppa il metodo
Solo check-contratti.py: verifica a macchina le invarianti che i due contratti dichiarano — chiavi {...} inesistenti, path citati e mai creati, modelli nominati dentro una skill, e il \t mangiato dentro un comando (tests\test_x.py letto come tabulazione) che ha girato per mesi invisibile.

non ho capito








**fatto tutto**:
contracts


**fatto solo a livello architetturale**:
templates sistemato
hooks anche






**manca**:
agents
rivedere skill
tradurre tutte skill
tradurre tutti i riferimenti cross folder dentro plugins
