---
description: "Collauda init in ciclo finché il suo output non batte quello che ReforgIA aveva prima: butta l'output, rilancia a freddo, confronta con l'asse meccanico, applica le correzioni al prodotto e rigira — si ferma solo per chiedere"
---

Fai girare il collaudo di `init` in ciclo, e non ti fermi finché l'output di Daiku non è
**superiore** a quello che il progetto ospite aveva prima di Daiku. Non chiedi argomenti: la
prova è sempre la stessa, e il suo verdetto lo emette uno script, non tu.

La divisione è fissa e non si sposta: **il giudizio è del banco, la correzione è tua, la
decisione è dell'owner.** Il banco dice dove passa il confine fra ciò che Daiku produce e ciò
che il progetto aveva; tu chiudi ogni divario toccando **solo il prodotto**; l'owner decide
solo quello che il banco non può decidere.

## 1. Il banco

```bash
node .docs/tools/collauda-init.mjs prepara   # fotografia la baseline, butta l'output di init
node .docs/tools/collauda-init.mjs cattura   # porta nella prova quello che init ha scritto
node .docs/tools/collauda-init.mjs giudica   # confronta: esce 0 se superiore, 1 se no
```

Quattordici assi, ognuno con la sua regola scritta nel sorgente: conservazione delle chiavi, copertura
delle aree del workspace, forma dei due parametri, fedeltà agli scheletri, nessun valore di
macchina, path dichiarati, una lingua sola nel file di istruzioni, righe di merito conservate,
sede delle regole, report chiuso, `check_fast` ovunque, mappa non impoverita, inventario dello
stack che nomina ogni pacchetto, file trovato parcheggiato intatto. **Non aggiungere
assi a mano e non interpretarne uno a occhio**: se un asse è rosso, è rosso. Se il verdetto ti
sembra sbagliato, la correzione è nel banco — e vale come le altre.

Il banco non giudica se una *motivazione* è onesta. `after/assenze.json` dichiara le chiavi non
scritte con `motivo` e `prova`; il banco verifica solo che la prova esista su disco. Che il
motivo regga contro il manifest lo verifichi tu, leggendo il file che la prova nomina, **prima**
di dichiarare verde un asse.

## 2. Le lingue: l'unica cosa che chiedi all'inizio

`init` fa una domanda sola, lo *Step 0*: le due lingue. Se `lingue.json` non esiste in
`.docs/confronti/reforgia-init/`, chiedile con `AskUserQuestion` — chat e commit, le stesse due
domande dello Step 0 — e scrivile lì in `{ "chat": "...", "commit": "..." }`. Da quel momento
non si chiedono più: il ciclo le riusa, perché sono una risposta dell'owner e non una variabile
della prova. Se il file c'è, vai avanti senza chiedere niente.

## 3. Il giro

Ripeti questi cinque passi, numerando i giri dal primo:

1. **Prepara.** `prepara` — la baseline si prende da `HEAD` la prima volta e non si rifà mai più;
   ai giri successivi butta l'output del giro prima e ripristina `CLAUDE.md`.
2. **Lancia `init` a freddo.** Un **subagent** nuovo, di cui non riusi il contesto. Il prompt è
   in §4, ed è quello che è: non aggiungerci la tua conoscenza del difetto che stai cercando di
   chiudere, altrimenti la prova misura te e non Daiku.
3. **Cattura.** Prima di `cattura`, accertati che `uscita/` porti i tre artefatti del passo 2 —
   `verbale.md`, `assenze.json`, `note.md`. Se il subagent te ne ha restituito uno nel messaggio
   di ritorno invece di scriverlo, **trascrivilo tu, verbatim**, prima di `cattura`: `cattura` non
   parte su un giro incompleto, e giudicarlo darebbe ad A10 un rosso falso, che manda a correggere
   il prodotto per un guasto che non è suo. Poi lancia `cattura`.
4. **Giudica.** `giudica`. Se esce `0`, il giro è verde: vai a §6. Se esce `1`, continua.
5. **Correggi.** Per **ogni** asse rosso, aggiusta `plugins/daiku` — vedi §5 — e poi rigira
   dal passo 1.

Un giro non finisce mai senza che il banco sia stato rilanciato: una correzione non verificata
non è una correzione, è una speranza.

## 4. Il lancio a freddo

Il subagent deve arrivare **cieco**. Non dirgli cosa cercare, non nominargli gli assi, non
lasciargli leggere `.docs/confronti/`: la prova vale solo se misura la skill e non la tua
ipotesi. Il prompt contiene queste cinque cose e nient'altro:

- **leggi in pieno ed esegui** `plugins/daiku/skills/init/SKILL.md` — è un contratto, e tutto
  quello che ti dice di aprire (gli scheletri, `contracts/project-contract.md` §4 e §8,
  `contracts/orchestration.md` §7, `schemas/blocks.json` § *params*) lo apri davvero;
- la **radice del pacchetto** è `plugins/daiku` di questo repository; la **radice tecnica** della
  prova è `C:/dev/ReforgIA/src`, e gli argomenti sono quella stessa radice;
- **lo Step 0 è già risposto**, con le due lingue di `lingue.json`, verbatim: non chiedere nulla,
  non usare `AskUserQuestion`, non omettere le chiavi;
- i vincoli della macchina: il recinto nega ogni lettura fuori da `c:/dev`, `~/.claude`, `~/.codex`,
  `~/.agents` e la Temp — se qualcosa è negato, non cercare una via alternativa, annotalo;
- **il muro del cantiere**: di questo repository leggi **solo `plugins/daiku/`**, che è il prodotto
  che stai eseguendo. Tutto il resto è il cantiere che lo costruisce — `.docs/`, `.claude/`, il
  `CLAUDE.md` di radice, la memoria dell'host — e leggerlo o lasciartene guidare falsa la prova,
  perché misurerebbe le note di chi l'ha scritta invece della skill. Se ci inciampi, non usarlo;
- **non committare, non mettere in stage, non toccare `.gitignore` né il codice.**

E tre cose da **scrivere**, che sono la forma macchina-rileggibile di ciò che lo *Step 8* già
prescrive, in `.docs/confronti/reforgia-init/uscita/`:

| File | Cosa contiene |
|---|---|
| `verbale.md` | il report dello *Step 8* alla lettera: i tre blocchi `Written`, `Left as it was`, `To fill in`. Il nome non comincia per `report`: l'harness di un subagent rifiuta quel prefisso — «Subagents should return findings as text, not write report files» — e un artefatto che non si può scrivere è un asse che dà un rosso falso |
| `assenze.json` | una voce per ogni chiave che **non** hai scritto: `{ "<chiave>": { "motivo": "...", "prova": "<path del repository che hai letto>" } }`. La chiave è `areas.<area>.<chiave>` per un comando di area |
| `note.md` | cosa hai notato eseguendo: un passo ambiguo, un punto in cui la skill non bastava, una decisione presa da te che la skill non copre, un'istruzione di cui non sei sicuro, un comando rifiutato |

E la stessa cosa in coda al messaggio di ritorno, sotto `NOTE PER LA PROVA`, perché è quella
sezione che dice **dove si migliora Daiku** — ed è il motivo per cui il ciclo esiste.

## 5. Correggere: solo il prodotto

Si tocca **`plugins/daiku/`**, e nient'altro. Il cantiere `.claude/` è una derivazione e portarci
una modifica è una decisione a parte, che non prendi qui. Se un asse rosso chiede una modifica al
cantiere, è una domanda da fare all'owner, non una modifica da fare.

Tre regole, e sono quelle di `CLAUDE.md`:

- **Un divieto che conta vive in due sedi**: il testo della skill e un controllo che lo impone.
  Se aggiungi un obbligo a una skill, chiediti dove sta il banco che lo verifica — e se non c'è,
  o lo costruisci o non aggiungi l'obbligo.
- **I numeri del `contract` non si incrementano da soli.**
- **L'elenco delle verifiche si lancia a ogni correzione**, e non si salta:

```bash
claude plugin validate plugins/daiku
claude plugin validate plugins
python "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" plugins/daiku
node plugins/daiku/hooks/self-check.mjs
node .docs/tools/check-topology.mjs plugins/daiku
node .docs/tools/check-corpus.mjs plugins/daiku
node .docs/tools/check-marketplace.mjs plugins
node .docs/tools/check-no-push.mjs --self-check
node .docs/tools/check-channel.mjs
```

Un rosso qui batte qualunque asse: si sistema prima quello.

## 6. Uscita: due giri verdi, e nessuna modifica in mezzo

Il ciclo si chiude quando **due giri consecutivi escono verdi senza che tu abbia toccato una riga
di `plugins/daiku` fra i due.** Un verde solo non basta: il giro è un modello che lavora, e un
modello è stocastico — il secondo giro serve a dire che il pacchetto produce quell'esito, non che
quella volta è andata bene.

## 7. Quando fermarsi e chiedere

Ti fermi e chiedi **solo** in uno di questi cinque casi, e in nessun altro:

1. **Il rosso chiede una modifica al metodo e non a un fatto.** Una scelta che cambia come Daiku
   funziona — dove vive un file, cosa si versiona, chi possiede una sede — non la prendi da solo:
   la presenti all'owner con l'asse che l'ha rivelata e le due opzioni.
2. **Il rosso è nel progetto ospite e non nel prodotto.** ReforgIA ha scelte che Daiku non può
   soddisfare, come le regole di area in una cartella che Daiku non legge. Non "aggiusti" ReforgIA
   e non pieghi Daiku alla sua storia: chiedi cosa spostare.
3. **Due giri consecutivi non migliorano niente.** Stesso insieme di assi rossi, e nulla di nuovo
   nelle note: il ciclo non sta più imparando, e rigirare è tempo speso a caso.
4. **Un asse resta rosso e la correzione non è ovvia.** Se non sai quale riga di quale file lo
   chiude, dillo invece di provare a caso: un giro che cambia la skill a sentimento è un giro che
   peggiora ciò che non stavi guardando.
5. **Sei al sesto giro.** La prova è reverente e non infinita: fermati e porta i conti.

In tutti gli altri casi **non ti fermi**: correggi, rigiri, e vai avanti.

## 8. Report finale

Quando ti fermi — per uscita o per domanda — porta:

- **i giri fatti**, con l'esito di ognuno in una riga (`giro 3: 2 assi rossi — A2, A9`);
- **cosa hai corretto in `plugins/daiku`**, file per file, con l'asse che lo aveva rivelato;
- **gli assi ancora rossi**, ognuno con la sua riga di `dettaglio` e la domanda che apre;
- **i rilievi di `note.md`**, che sono i difetti che nessun asse vede ancora: è da lì che esce
  l'asse del giro dopo.

E non committi: quello resta dell'owner.
