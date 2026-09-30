---
name: tre-livelli-di-parametro
description: "dove va un valore estratto da una skill — project.json, environment.json o domain/ — e le due trappole che non si vedono dal contratto"
metadata: 
  node_type: memory
  type: project
  originSessionId: 49e5cfe5-3f08-446f-a9cd-5cc35fba4682
  modified: 2026-09-20T15:38:47.133Z
---

Un valore tolto da una skill ha tre destinazioni possibili, e la domanda che le separa non è
«quanto è specifico» ma **chi lo aggiornerebbe al prossimo cambiamento**: `.daiku/project.json` se
descrive il codice davanti a te, `.daiku/environment.json` se descrive la macchina, l'host o
l'owner che lo esegue, `.daiku/domain/<role>.md` se per usarlo serve sapere *perché* esiste — cioè
se è giudizio e non valore.

**L'ambiente sta nel progetto, dal 29 settembre 2026.** `init` lo scrive in
`.daiku/environment.json` accanto a `project.json`, e niente di Daiku vive più nella home
dell'owner: quella è una sede che nessun clone porta, nessun `diff` mostra, e su una macchina col
recinto di Daiku nessun agente può nemmeno aprire, perché le radici di lavoro non la contengono —
`init` non poteva né leggerla né scriverla. Una macchina lo sostituisce **intero** con
`.daiku/environment.local.json`: chi legge prende il primo dei due che trova e non li fonde, come
per `settings.json` e `settings.local.json`. **Il primo si versiona, il secondo no**: la cartella è
sorgente del progetto, e resta fuori il solo override della macchina — vedi [[daiku-versionato]].

Il prezzo resta uno solo, e si paga lo stesso: cambiare l'alias di un modello si ripete in N
progetti. Si paga perché l'alternativa — la cartella in home — è peggiore: nessun clone la porta,
nessun `diff` la mostra, e su una macchina col recinto di Daiku nessun agente può nemmeno aprirla,
perché le radici di lavoro non la contengono. La valvola per l'owner multiplo o per la macchina con
uno switcher diverso resta `environment.local.json`.

**`temp_dir` non si scrive.** Assente significa la cartella temporanea del sistema operativo, che è
la risposta giusta su ogni macchina e che i lettori usano già: dichiararla serve solo dove quel
ripiego è sbagliato, e così l'unico path di macchina è uscito dal file dei parametri.

**Why:** il 18 settembre 2026 il corpus è stato separato dal progetto su cui era nato, e la scelta
è stata di non aprire un quarto livello: i tre bastavano tutti e tre, e un livello nuovo avrebbe
dovuto essere spiegato in ogni skill che lo tocca.

**Il dominio viaggia, ed è una scelta esplicita dell'owner della stessa giornata.** Il pacchetto
porta i default sotto `templates/project/domain/`, `init` li deposita una volta sola e
l'idempotenza garantisce che non tornino a ogni aggiornamento: restano una proposta, non diventano
una regola del pacchetto. Un default esiste solo dove la risposta è una convenzione
(`commit-convention.md`), mai dove dipende dallo stack — lì sarebbe un'invenzione travestita da
regola.

**How to apply:** due trappole che il contratto non nomina.

Primo, **il `description:` del frontmatter non può contenere `{chiavi}`**: l'host lo legge per
decidere quale skill invocare, prima che qualunque file di parametri sia stato aperto, quindi una
graffa lì resta letterale e la skill si descrive con un segnaposto. Nel frontmatter si scrive in
prosa; le graffe vivono solo nel corpo.

Secondo, **`init` è l'unica skill che non può citare nessuna chiave**, nemmeno
`{hosts.<host>.instructions_file}`: gira prima che `.daiku/project.json` esista ed è lei a scriverlo. Ogni
riscrittura di massa che sostituisce path con chiavi la tocca per errore — va ricontrollata a
mano.

Il backup di ciò che è stato tolto è `.docs/backup/skill-estratte.md`, ad append.
Vedi [[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
