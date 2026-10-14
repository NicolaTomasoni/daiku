# PRODUCT

> **Cosa va qui.** L'offerta: cosa fa il prodotto, per chi, perché esiste e cosa deliberatamente non
> è. È scritto per chi non sa niente del progetto — nessun nome di codice, nessun dettaglio
> implementativo, nessuna roadmap: quelli stanno in `STACK.md` e `ARCHITECTURE.md`. Leggilo quando
> devi decidere se una modifica appartiene a questo prodotto. Ogni affermazione o risale a qualcosa
> che il progetto già dichiara, o è dichiarata come lacuna.

## Indice

1. Cosa fa
2. Per chi è
3. Perché esiste
4. Cosa non è
5. Su cosa poggia

## 1. Cosa fa

Daiku tiene il lavoro di un agente di codice dentro i vincoli architetturali che il progetto ha
deciso. L'agente scrive veloce e in autonomia; Daiku gli impone la direzione, un intervento dopo
l'altro, come si guida un bonsai.

Tre promesse, e dietro ciascuna un meccanismo:

- **La forma è del progetto, e si dichiara una volta.** Architettura, convenzioni e criteri vivono
  nei file che l'agente legge prima di cambiare qualsiasi cosa, e le guardie rifiutano i gesti che
  li romperebbero.
- **Niente entra senza essere potato.** Ogni lavoro passa da un ciclo di revisione: revisori
  indipendenti leggono lo stesso diff senza vedersi — i difetti sempre, architettura e prestazioni
  dove il diff le tocca — poi quello che hanno trovato viene applicato e **riletto**, giro dopo
  giro, finché non resta niente da trovare.
- **Niente si perde fra le sessioni.** Un lavoro vive in una cartella di file, non nella memoria
  della chat: si può interrompere, chiudere tutto e riprendere una settimana dopo, e la catena
  rilegge i suoi file e riparte da dove si era fermata. Quello che il lavoro insegna si versiona
  insieme al codice.

Funziona su **Claude Code**.

## 2. Per chi è

Sviluppatori professionisti che lavorano su codebase grandi, già in produzione, che non si possono
fermare. È il lettore a cui il prodotto si rivolge, e la situazione che presuppone: un progetto
grande abbastanza perché rileggere tutto a mano non sia una risposta.

## 3. Perché esiste

Un agente scrive in fretta e in qualunque direzione gli capiti; senza un vincolo, il progetto perde
la forma che qualcuno gli aveva dato. Presidiare a mano ogni contributo non regge sulla scala di una
codebase grande. Daiku sposta quel presidio dove costa meno: il progetto dichiara i suoi vincoli una
volta, e il metodo li fa rispettare a ogni contributo.

Non è un metodo progettato a tavolino e poi provato altrove: è cresciuto per raffinamenti successivi
dentro progetti reali, grandi e già in corsa. Per questo assume fin dal primo minuto una codebase
molto più grande di una demo, e già avviata — e si adotta come è nato: gradualmente, un lavoro dopo
l'altro, senza mai fermare il progetto.

## 4. Cosa non è

- **Non è una libreria né un framework.** Non si importa nel codice dell'applicazione: è un corpus
  di contratti che gli agenti leggono, e vive accanto al progetto.
- **Non è un servizio ospitato.** Non c'è niente in rete da raggiungere e niente da configurare
  altrove: tutto sta nel repository, in locale.

## 5. Su cosa poggia

- `plugins/README.md`, il README del prodotto: l'offerta, la sezione *About me*, il pubblico;
- `.daiku/README.md`, la documentazione che Daiku deposita in ogni progetto che apre;
- le risposte dell'owner del 14 ottobre 2026 sul pubblico e sul perimetro.
