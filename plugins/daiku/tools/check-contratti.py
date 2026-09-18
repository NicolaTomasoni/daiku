#!/usr/bin/env python
"""Controlli deterministici sul corpus dei contratti (`.claude/`).

`project-contract.md` e `orchestration.md` dichiarano invarianti verificabili a
macchina, e finora nessuno le verificava: il corpus e' grande, si muove in fretta, e
i difetti che conta sono quelli che una rilettura umana non vede. La prova che
serviva: per mesi un contratto ha portato `pytest tests<TAB>est_technology_catalog.py`
— il `\\t` di `tests\\test_...` interpretato come tabulazione — invisibile a schermo e
consegnato a un subagent come istruzione da eseguire.

Come il `--self-check` del driver di abilitazione, il totale dei controlli e'
**contato**, non cablato: un totale fermo mentre i controlli crescono fa credere a
chi legge di averli girati tutti.

**Due domande diverse, due gradi diversi.** «Esiste sul disco» e' una proprieta' di
questa macchina; «esiste per chi clona» e' una proprieta' del repository, e finora
solo la prima veniva posta: un path citato e mai tracciato passava per esistente.
Ora si pongono entrambe, ma non pesano uguale. Un path citato e **assente** e' un
difetto del testo, e blocca: si corregge riscrivendo la riga. Un path presente e
**non tracciato** non si corregge riscrivendo niente — la sua unica cura e' un
commit, e farne una violazione significherebbe rifiutare proprio il commit che lo
cura. Esce quindi in `non_tracciati`, elencato e non bloccante.

Uscita `0` se tutto passa, `1` al primo insieme di violazioni, con l'elenco.
`non_tracciati` non cambia mai l'uscita.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RADICE = Path(__file__).resolve().parents[2]
CLAUDE = RADICE / ".claude"
# `.githooks/` sta nella radice del **repository**, non in quella tecnica: i path che
# lo nominano si risolvono da qui, non da `RADICE`, altrimenti sono falsi in partenza.
REPO = RADICE.parent

# Un modello non si nomina mai in una skill: si dichiara un ruolo, e
# `orchestration.md` lo risolve sull'ambiente. I file di ambiente, che i modelli li
# dichiarano per mestiere, restano fuori dal perimetro di questo controllo.
# `claude-code` e' il nome del prodotto, non di un modello, e compare negli URL di
# esempio dei contratti: il criterio richiede una famiglia di modello vera dopo il prefisso.
NOMI_MODELLO = re.compile(
    r"\b(opus|sonnet|haiku|gpt-[0-9]|claude-(?:opus|sonnet|haiku|[0-9])[a-z0-9.-]*)\b", re.I
)


# Una chiave si cita dentro un code span (`project-contract.md` §5.2), non per forza
# all'inizio: `git status --porcelain -- {code_root}` e' una citazione quanto
# `` `{code_root}` ``. Il controllo 2 vede solo la seconda forma; il controllo 8 le
# vuole entrambe, perche' e' dentro un comando che una chiave non risolta fa saltare
# la riga che la usa.
CODE_SPAN = re.compile(r"`[^`]*?`", re.S)
CHIAVE_CITATA = re.compile(r"\{([a-z_][a-zA-Z_.<>-]*)\}")

# Chi cita una chiave apre con il blocco che dice dove risolverla: `project-contract.md`
# §5.1 per il progetto, lo stesso blocco col nome del file cambiato per l'ambiente (§8).
BLOCCHI_DI_APERTURA = (
    ("project.json", "## Parametri di progetto"),
    ("environment.json", "## Parametri di ambiente"),
)


# I prefissi che il controllo 3 riconosce come path del progetto. Erano tre — `.claude`,
# `memory`, `docs/scripts` — e lasciavano fuori tutto il resto di `docs/` e `.agents/`:
# e' da li' che e' passata una cartella citata come lettura obbligatoria e mai esistita
# in nessun commit. `.docs/` **non** e' nell'elenco, e non ci va: sono le note locali di
# chi lavora, per costruzione assenti su ogni altra macchina, e pretenderle sul disco
# darebbe una violazione che nessuno puo' correggere.
PREFISSI_DI_PROGETTO = r"\.claude|\.agents|\.githooks|apps|docs|memory|packages"
PATH_CITATO = re.compile(
    r"`((?:" + PREFISSI_DI_PROGETTO + r")/[A-Za-z0-9_.<>{} /-]*)`"
)
# Una memoria si richiama anche per rinvio, non solo per path: `[[slug]]` risolve in
# `memory/slug.md`. Il segnaposto con cui i contratti descrivono la convenzione — `[[...]]` —
# non ha uno slug e non entra.
RINVIO_MEMORIA = re.compile(r"\[\[([a-z0-9][a-z0-9-]*)\]\]")

# Un contratto cita anche i path che **produce**. Esistono dopo che il flusso ha girato,
# non prima: pretenderli sul disco trasformerebbe il controllo in un generatore di falsi.
# Si dichiarano qui, col flusso che li scrive accanto.
USCITE_DI_FLUSSO = (
    "docs/nightly/",  # coda e referto della notte, scritti da /nightly-plan e /nightly-orchestrator
)

# `orchestration.md` §4: gli agent di `.claude/agents/` «non possono scrivere file ne'
# delegare ad altri agent». E' l'invariante che li rende un confine vero invece di una
# promessa scritta nel prompt, ed e' verificabile sulla sola riga `tools:`.
TOOL_VIETATI_A_UN_AGENT = ("Write", "Edit", "MultiEdit", "NotebookEdit", "Agent", "Task")
# I `subagent_type` che l'host offre da se': non hanno un file in `.claude/agents/` e non
# devono averlo.
SUBAGENT_DELL_HOST = ("Explore", "general-purpose")

# Un contratto cita il path di un altro per due ragioni diverse, e solo una e' un **arco**:
# consegnarlo a un subagent come *contratto da leggere*. Le altre sono rimandi — «conforme a», «e'
# dichiarato in», «§ *X* di» — e non collegano niente. Queste sono le forme con cui il corpus
# delega davvero, cercate in una finestra stretta intorno alla citazione: una forma nuova si
# aggiunge qui, altrimenti quell'arco non e' verificato da nessuno.
FORME_DI_DELEGA = (
    "per intero",
    "integralmente",
    "contratto da leggere",
    "path del contratto",
    "contratto `",
    "esegue ",
)
PATH_CONTRATTO = re.compile(r"`(\.claude/commands/[A-Za-z0-9_./-]+\.md)`")
# La topologia rimanda a una sezione in due forme: «§ *Nome*» (con o senza numero) e
# «*Nome* del suo file». Il resto del corsivo — un `**grassetto**` in mezzo a una cella — non e'
# un rimando e non va interrogato.
RINVIO_SEZIONE = re.compile(r"§\s*(?:\d+[.\s]*)?\*([^*]+)\*|\*([^*]+)\*\s+del suo file")
NOME_IN_CODE_SPAN = re.compile(r"`([a-z][a-z0-9-]*)`")


def contratti() -> list[Path]:
    return sorted(CLAUDE.glob("commands/**/*.md"))


def documenti() -> list[Path]:
    # `CLAUDE.md` di radice e i pointer portabili stanno dentro il perimetro: sono il
    # posto in cui il primo giro aveva trovato i path sbagliati che questi controlli
    # esistono per prevenire, e il pointer e' l'unica cosa che una skill su un altro
    # host legge per sapere quale contratto aprire.
    #
    # Il perimetro segue il trigger del `pre-commit` — `src/.claude/`, `src/.agents/`,
    # `src/CLAUDE.md` — e non deve restare indietro: `.claude/agents/` faceva scattare i
    # controlli senza che nessuno di loro aprisse quei due file, cioe' i soli che *sono*
    # il toolset ristretto con cui si verifica tutto il resto.
    return sorted(
        [
            *contratti(),
            *CLAUDE.glob("*.md"),
            *CLAUDE.glob("rules/*.md"),
            *CLAUDE.glob("context/*.md"),
            *CLAUDE.glob("agents/*.md"),
            *RADICE.glob("CLAUDE.md"),
            *RADICE.glob(".agents/skills/*/SKILL.md"),
        ]
    )


def tracciati() -> set[str] | None:
    """I path che Git conosce, relativi alla radice del repository. Una chiamata sola.

    `None` se Git non e' interrogabile: senza risposta non si inventa un verdetto, e la
    domanda «esiste per chi clona» semplicemente non viene posta.
    """
    try:
        esito = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=REPO,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if esito.returncode != 0:
        return None
    return {p for p in esito.stdout.decode("utf-8", "replace").split("\0") if p}


def e_tracciato(percorso: Path, noti: set[str]) -> bool:
    """Un file se e' nell'elenco; una directory se almeno un file dentro ci sta."""
    try:
        relativo = percorso.resolve().relative_to(REPO).as_posix()
    except ValueError:
        return True  # fuori dal repository: non e' una domanda che questo controllo pone
    return relativo in noti or any(n.startswith(relativo + "/") for n in noti)


def chiavi_note() -> set[str]:
    """Ogni percorso puntato dichiarato dai due JSON di configurazione."""
    note: set[str] = set()

    def cammina(nodo: object, prefisso: str = "") -> None:
        if not isinstance(nodo, dict):
            return
        for chiave, valore in nodo.items():
            intero = f"{prefisso}.{chiave}" if prefisso else chiave
            note.add(intero)
            cammina(valore, intero)

    for nome in ("project.json", "environment.json"):
        percorso = CLAUDE / nome
        if percorso.is_file():
            cammina(json.loads(percorso.read_text("utf-8")))
    return note


def radici_dichiarate() -> dict[str, set[str]]:
    """Le chiavi di primo livello di ciascun JSON: dicono a quale dei due appartiene una citazione."""
    radici: dict[str, set[str]] = {}
    for nome in ("project.json", "environment.json"):
        percorso = CLAUDE / nome
        if percorso.is_file():
            radici[nome] = set(json.loads(percorso.read_text("utf-8")))
    return radici


def risolve(chiave: str, note: set[str]) -> bool:
    """La chiave citata esiste? `<area>` e `<host>` sono segnaposto di iterazione."""
    if chiave in note:
        return True
    schema = "^" + re.escape(chiave).replace(r"<area>", "[^.]+").replace(r"<host>", "[^.]+")
    schema = schema.replace(r"<backend>", "[^.]+").replace(r"<ruolo>", "[^.]+") + "$"
    compilato = re.compile(schema)
    return any(compilato.match(nota) for nota in note)


def controlla() -> tuple[int, list[str], list[str], bool]:
    violazioni: list[str] = []
    controlli = 0
    note = chiavi_note()
    radici = radici_dichiarate()
    noti = tracciati()
    # Esce come elenco, mai come violazione: vedi il blocco in cima al file.
    non_tracciati: set[str] = set()

    def segnala_non_tracciato(percorso: Path, nome: str) -> None:
        if noti is None or e_tracciato(percorso, noti):
            return
        non_tracciati.add(nome)

    for documento in documenti():
        testo = documento.read_text("utf-8")
        relativo = documento.relative_to(RADICE).as_posix()

        # 1. nessun carattere di controllo: un `\t` dentro un comando in backtick
        #    e' un escape mangiato, e il comando non e' piu' eseguibile
        controlli += 1
        for numero, riga in enumerate(testo.splitlines(), 1):
            sporchi = [c for c in riga if c in "\t\r\v\f" or (ord(c) < 32 and c != "\n")]
            if sporchi:
                violazioni.append(
                    f"{relativo}:{numero} carattere di controllo {sporchi!r} nella riga: "
                    f"probabile escape mangiato (`\\t` di un path Windows)"
                )

        # 2. ogni chiave `{...}` citata in un code span esiste nei JSON
        controlli += 1
        for chiave in sorted(set(re.findall(r"`\{([a-z_][a-zA-Z_.<>-]*)\}`", testo))):
            if not risolve(chiave, note):
                violazioni.append(f"{relativo} cita `{{{chiave}}}`, che non esiste nei JSON")

        # 3. ogni path del progetto citato — in un code span o per rinvio `[[...]]` —
        #    esiste sul filesystem (violazione) ed e' tracciato da Git (elenco a parte)
        controlli += 1
        citati = set(PATH_CITATO.findall(testo))
        citati.update(f"memory/{slug}.md" for slug in RINVIO_MEMORIA.findall(testo))
        for citato in sorted(citati):
            if "<" in citato or "{" in citato:
                continue  # segnaposto di iterazione, non un path
            if citato.startswith(USCITE_DI_FLUSSO):
                continue  # lo scrive il flusso, non lo trova il controllo
            if " " in citato and not re.search(r"\.[A-Za-z0-9]{1,5}$", citato):
                continue  # una riga di comando o una perifrasi, non un path
            base = REPO if citato.startswith(".githooks/") else RADICE
            bersaglio = base / citato
            if not (bersaglio.is_dir() if citato.endswith("/") else bersaglio.exists()):
                violazioni.append(f"{relativo} cita `{citato}`, che non esiste")
                continue
            segnala_non_tracciato(bersaglio, citato)

        # 4. ogni blocco json e' parsabile, una volta tolti i segnaposto
        controlli += 1
        for blocco in re.findall(r"```json\n(.*?)```", testo, re.S):
            pulito = re.sub(r"<[^>\n]*>", "X", blocco)
            pulito = re.sub(r"\|[a-z-]+", "", pulito)
            try:
                json.loads(pulito)
            except json.JSONDecodeError as errore:
                violazioni.append(f"{relativo} ha un blocco json non parsabile: {errore.msg}")

    # 5. nessuna skill nomina un modello
    for contratto in contratti():
        controlli += 1
        for numero, riga in enumerate(contratto.read_text("utf-8").splitlines(), 1):
            trovato = NOMI_MODELLO.search(riga)
            if trovato:
                violazioni.append(
                    f"{contratto.relative_to(RADICE).as_posix()}:{numero} nomina il modello "
                    f"'{trovato.group(0)}': una skill dichiara un ruolo, mai un modello"
                )

    # 6. la tabella della topologia (`orchestration.md` §3) copre tutti i nodi, e solo quelli:
    #    un arco nuovo si dichiara li', e una riga che nessuno aggiorna e' un arco che esiste
    #    nei prompt e in nessun posto leggibile
    controlli += 1
    orchestrazione = CLAUDE / "orchestration.md"
    # Dichiarate qui e non dentro il ramo: i controlli 11 e 12 le leggono comunque, e senza
    # `orchestration.md` restano vuote — il che li fa degradare aperti, non esplodere.
    righe_topologia: dict[str, list[str]] = {}
    file_dei_nodi = {p.stem: p for p in contratti() if p.name != "README.md"}
    if orchestrazione.is_file():
        testo = orchestrazione.read_text("utf-8")
        blocco = re.search(
            r"\| Nodo \| Chi lo invoca \|.*?\n((?:\|.*\n)+)", testo
        )
        in_tabella: set[str] = set()
        # Le righe intere servono ai controlli 11 e 12: la prima colonna dice *chi* c'e', le altre
        # dicono *com'e' collegato*, ed e' li' che l'invariante della topologia vive davvero.
        if blocco:
            for riga in blocco.group(1).splitlines():
                celle = riga.split("|")
                if len(celle) < 3 or set(celle[1].strip()) <= {"-", ":"}:
                    continue
                nome = re.search(r"`([a-z][a-z0-9-]*)`", celle[1])
                if nome:
                    in_tabella.add(nome.group(1))
                    righe_topologia[nome.group(1)] = celle
        else:
            violazioni.append(
                ".claude/orchestration.md non ha la tabella della topologia: "
                "senza, nessun nodo dichiara chi lo invoca e con quale permesso"
            )
        # «Sul disco» e «nel repository» non sono la stessa cosa: un nodo che esiste solo
        # qui rende la topologia vera su questa macchina e falsa in un clone, dove la
        # stessa riga diventa un fantasma. Stessa domanda del controllo 3, stesso grado.
        for contratto in contratti():
            segnala_non_tracciato(contratto, contratto.relative_to(RADICE).as_posix())
        sul_disco = {p.stem for p in contratti() if p.name != "README.md"}
        for mancante in sorted(sul_disco - in_tabella):
            violazioni.append(
                f".claude/orchestration.md non ha la riga di `{mancante}` nella tabella della "
                f"topologia: chi lo invoca, con quale input e con quale ritorno non e' dichiarato"
            )
        for fantasma in sorted(in_tabella - sul_disco):
            violazioni.append(
                f".claude/orchestration.md dichiara nella topologia il nodo `{fantasma}`, "
                f"che non esiste in .claude/commands/"
            )

    # 7. ogni rule dichiara almeno un `paths` che trova un file reale
    for rule in sorted(CLAUDE.glob("rules/*.md")):
        controlli += 1
        testa = rule.read_text("utf-8").split("---")
        frontmatter = testa[1] if len(testa) > 2 else ""
        schemi = re.findall(r"^\s*-?\s*[\"']?([A-Za-z0-9_*./-]+)[\"']?\s*$", frontmatter, re.M)
        schemi = [s for s in schemi if "/" in s or "*" in s]
        if not schemi:
            violazioni.append(f"{rule.relative_to(RADICE).as_posix()} non dichiara alcun `paths`")
            continue
        trovati = [f for s in schemi for f in RADICE.glob(s)]
        if not trovati:
            violazioni.append(
                f"{rule.relative_to(RADICE).as_posix()} dichiara `paths` che non trovano "
                f"nessun file: {schemi}"
            )
            continue
        # Stessa distinzione del controllo 3: una rule che aggancia solo file non
        # tracciati e' attiva qui e muta in un clone.
        if noti is not None and not any(e_tracciato(f, noti) for f in trovati):
            non_tracciati.add(
                f"{rule.relative_to(RADICE).as_posix()} (i file agganciati dai suoi `paths`)"
            )

    # 8. chi cita una chiave apre con il blocco che dice dove risolverla. Senza, la chiave
    #    non si risolve e la degradazione di `project-contract.md` §6 non salta un passo
    #    inesistente: salta un passo che esiste. E' la classe di difetto che una rilettura
    #    umana non vede — l'assenza di un blocco, in un file che per tutto il resto e' a
    #    contratto — ed e' cosi' che `nightly-orchestrator.md` ha citato `{code_root}`
    #    senza mai aprire `project.json`, disattivando da se' la guardia sull'albero pulito.
    for documento in documenti():
        controlli += 1
        testo = documento.read_text("utf-8")
        relativo = documento.relative_to(RADICE).as_posix()
        citate = {
            chiave for span in CODE_SPAN.findall(testo) for chiave in CHIAVE_CITATA.findall(span)
        }
        for nome, apertura in BLOCCHI_DI_APERTURA:
            mie = radici.get(nome, set())
            altrui = {r for altro, valori in radici.items() if altro != nome for r in valori}
            proprie = sorted(c for c in citate if c.split(".")[0] in mie - altrui)
            if not proprie:
                continue
            sentinella = f"Leggi `.claude/{nome}` prima di agire"
            if apertura not in testo or sentinella not in testo:
                violazioni.append(
                    f"{relativo} cita {', '.join(f'`{{{c}}}`' for c in proprie)} "
                    f"di .claude/{nome} senza il blocco `{apertura}`: "
                    f"quelle chiavi non hanno una fonte dichiarata"
                )

    # 9. gli agent di `.claude/agents/` e i `subagent_type` di `orchestration.md` §4 si
    #    nominano a vicenda, e il toolset ristretto e' davvero ristretto. Un rename che
    #    tocca uno solo dei due lati lascia un `subagent_type` che l'host non risolve, e
    #    di notte si manifesta come disciplina mancata, non come errore.
    sezione_4 = ""
    if orchestrazione.is_file():
        taglio = re.search(r"\n## 4\.(.*?)(?=\n## 5\.)", orchestrazione.read_text("utf-8"), re.S)
        sezione_4 = taglio.group(1) if taglio else ""
    nomi_agent: set[str] = set()
    for agent in sorted(CLAUDE.glob("agents/*.md")):
        controlli += 1
        relativo = agent.relative_to(RADICE).as_posix()
        testa = agent.read_text("utf-8").split("---")
        frontmatter = testa[1] if len(testa) > 2 else ""
        nome = re.search(r"^\s*name:\s*(\S+)\s*$", frontmatter, re.M)
        if not nome:
            violazioni.append(f"{relativo} non dichiara `name:`: nessun `subagent_type` lo risolve")
            continue
        nomi_agent.add(nome.group(1))
        if nome.group(1) != agent.stem:
            violazioni.append(
                f"{relativo} dichiara `name: {nome.group(1)}`, diverso dal nome del file: "
                f"chi delega cabla l'uno o l'altro, e uno dei due non esiste"
            )
        riga_tools = re.search(r"^\s*tools:\s*(.+)$", frontmatter, re.M)
        if not riga_tools:
            violazioni.append(
                f"{relativo} non dichiara `tools:`: senza quella riga l'agent ha ogni tool, "
                f"e il confine che `.claude/orchestration.md` §4 gli attribuisce non esiste"
            )
        else:
            elenco = {t.strip() for t in re.split(r"[,\s]+", riga_tools.group(1)) if t.strip()}
            concessi = sorted(t for t in TOOL_VIETATI_A_UN_AGENT if t in elenco)
            if concessi:
                violazioni.append(
                    f"{relativo} concede {concessi} in `tools:`: "
                    f"`.claude/orchestration.md` §4 dichiara che questi agent non scrivono "
                    f"file ne' delegano ad altri agent"
                )
        if f"`{nome.group(1)}`" not in sezione_4:
            violazioni.append(
                f".claude/orchestration.md §4 non nomina l'agent `{nome.group(1)}`: "
                f"nessun chiamante sa che esiste, e un rename lascia cablato il nome vecchio"
            )
    controlli += 1
    citati_in_sezione_4 = {t for t in re.findall(r"`([A-Za-z][A-Za-z0-9_-]*)` per ", sezione_4)}
    if not citati_in_sezione_4:
        violazioni.append(
            ".claude/orchestration.md §4 non enumera piu' i `subagent_type` nella forma "
            "`nome` per ...: il controllo che li verifica non ha piu' niente da leggere"
        )
    for tipo in sorted(citati_in_sezione_4 - nomi_agent - set(SUBAGENT_DELL_HOST)):
        violazioni.append(
            f".claude/orchestration.md §4 sceglie `{tipo}` come `subagent_type`, che non e' "
            f"ne' un agent di .claude/agents/ ne' uno offerto dall'host"
        )

    # 10. ogni hook registrato in `settings.json` punta a un file che esiste. Un hook
    #     registrato su un file assente non parte, e un `PreToolUse` che non parte e'
    #     indistinguibile da uno che permette. `settings.local.json` resta fuori: non e'
    #     versionato, e un suo guasto non deve rifiutare il commit di chiunque altro.
    controlli += 1
    impostazioni = CLAUDE / "settings.json"
    if impostazioni.is_file():
        configurazione = json.loads(impostazioni.read_text("utf-8"))
        for evento, gruppi in (configurazione.get("hooks") or {}).items():
            for gruppo in gruppi:
                for hook in gruppo.get("hooks") or []:
                    if hook.get("type") != "command":
                        continue
                    comando = hook.get("command", "")
                    for puntato in re.findall(r"\$\{CLAUDE_PROJECT_DIR\}/([^\"'\s]+)", comando):
                        bersaglio = RADICE / puntato
                        if not bersaglio.exists():
                            violazioni.append(
                                f".claude/settings.json registra su {evento} un hook che punta a "
                                f"`{puntato}`, che non esiste: non parte, e la sua assenza e' "
                                f"indistinguibile da un permesso"
                            )
                        else:
                            segnala_non_tracciato(bersaglio, puntato)

    # 11. un arco che esiste nei prompt esiste anche nella topologia. Un contratto che consegna a
    #     un subagent il path di un altro **come contratto da leggere** sta creando un arco: se la
    #     cella *Chi lo invoca* di quel nodo non lo nomina, quell'arco esiste nei prompt e in
    #     nessun posto che si possa leggere — ed e' la forma in cui il permesso di un nodo finisce
    #     per dipendere da chi lo chiama senza che nessuno l'abbia deciso (`orchestration.md` §3).
    #     Un **rimando** non e' un arco: «conforme a», «e' dichiarato in», «§ *X* di» citano un
    #     contratto senza consegnarlo, e restano fuori per costruzione (FORME_DI_DELEGA).
    #     `README.md` non e' un nodo e non invoca niente: e' la guida, e cita i contratti per
    #     raccontarli.
    for contratto in contratti():
        if contratto.name == "README.md":
            continue
        controlli += 1
        testo = contratto.read_text("utf-8")
        relativo = contratto.relative_to(RADICE).as_posix()
        for trovato in PATH_CONTRATTO.finditer(testo):
            invocato = Path(trovato.group(1)).stem
            if invocato == contratto.stem or invocato not in righe_topologia:
                continue
            prima = testo[max(0, trovato.start() - 160) : trovato.start()]
            dopo = testo[trovato.end() : trovato.end() + 40]
            # La finestra non attraversa una riga vuota: una consegna e la sua forma stanno nello
            # stesso paragrafo, mentre il titolo o l'elenco che vengono dopo parlano d'altro — ed e'
            # cosi' che una tabella di rimandi finiva per prendersi il «Leggi integralmente» della
            # sezione successiva.
            prima = prima.rsplit("\n\n", 1)[-1]
            dopo = dopo.split("\n\n", 1)[0]
            finestra = " ".join((prima + trovato.group(0) + dopo).split()).lower()
            if not any(forma in finestra for forma in FORME_DI_DELEGA):
                continue
            chiamanti = set(NOME_IN_CODE_SPAN.findall(righe_topologia[invocato][2]))
            if contratto.stem not in chiamanti:
                violazioni.append(
                    f"{relativo} consegna `{invocato}` a un subagent come contratto da leggere, "
                    f"ma .claude/orchestration.md non lo elenca fra i chiamanti di quel nodo: "
                    f"un arco nuovo si dichiara li', nella stessa modifica che lo scrive"
                )

    # 12. i rimandi a sezione della topologia risolvono davvero. Ogni cella e' un rimando e mai una
    #     copia — «§ *Esito* del suo file» vale esattamente quanto l'heading che nomina — e un
    #     heading rinominato lascia il rimando grammaticale e vuoto: chi legge la topologia prima di
    #     delegare non trova la sezione, e la strada breve e' ricopiarne il contenuto nella cella.
    for nodo, celle in sorted(righe_topologia.items()):
        controlli += 1
        for indice in (2, 3, 4):
            if indice >= len(celle):
                continue
            cella = celle[indice]
            for trovato in RINVIO_SEZIONE.finditer(cella):
                sezione = (trovato.group(1) or trovato.group(2) or "").strip()
                if not sezione:
                    continue
                # «del suo file» dice esplicitamente di chi e' la sezione; altrimenti e' del nodo
                # nominato appena prima **nella stessa cella**, e in mancanza di quello del nodo
                # della riga.
                if "del suo file" in cella[trovato.start() : trovato.start() + 80]:
                    bersaglio = nodo
                else:
                    vicini = [
                        n
                        for n in NOME_IN_CODE_SPAN.findall(cella[: trovato.start()])
                        if n in righe_topologia
                    ]
                    bersaglio = vicini[-1] if vicini else nodo
                percorso = file_dei_nodi.get(bersaglio)
                if percorso is None:
                    continue
                titoli = [r for r in percorso.read_text("utf-8").splitlines() if r.startswith("#")]
                if not any(sezione in titolo for titolo in titoli):
                    violazioni.append(
                        f".claude/orchestration.md, riga `{nodo}` della topologia: rimanda alla "
                        f"sezione «{sezione}» di `{bersaglio}`, che in "
                        f"{percorso.relative_to(RADICE).as_posix()} non esiste"
                    )

    return controlli, violazioni, sorted(non_tracciati), noti is not None


def main() -> int:
    controlli, violazioni, non_tracciati, git_interrogato = controlla()
    esito = {
        "controlli": controlli,
        "violazioni": violazioni,
        "non_tracciati": non_tracciati,
        "git": "interrogato" if git_interrogato else "non interrogabile",
    }
    print(json.dumps(esito, indent=2, ensure_ascii=False))
    if non_tracciati:
        # Su stderr, perche' chi legge il `pre-commit` vede una riga e non deve
        # rileggersi il JSON per accorgersene. Non tocca l'uscita: non blocca.
        print(
            f"AVVISO: {len(non_tracciati)} path citati dal corpus esistono su questo disco "
            f"ma Git non li traccia — in un clone non ci sono. Non blocca: la cura e' un "
            f"commit, non una riscrittura.",
            file=sys.stderr,
        )
    return 1 if violazioni else 0


if __name__ == "__main__":
    sys.exit(main())
