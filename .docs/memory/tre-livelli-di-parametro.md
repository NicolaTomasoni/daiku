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
«quanto è specifico» ma **chi lo aggiornerebbe al prossimo cambiamento**: `.daiku/project.json`
se cambia da progetto a progetto, `~/.daiku/environment.json` se è costante per l'owner e varia per
macchina, `.daiku/domain/<role>.md` se per usarlo serve sapere *perché* esiste — cioè se è
giudizio e non valore.

**L'ambiente sta nella home, non nel progetto, dal 19 settembre 2026.** Prima `init` lo scriveva in
`.daiku/environment.json` dentro ogni progetto, che era la duplicazione condannata dalla §8 del
`project-contract.md` stesso: cambiare l'alias di un modello voleva dire ripetere la stessa
modifica in N progetti, e la storia condivisa di un repository si portava dietro valori della
macchina di chi ci lavorava. Resta possibile un **override di progetto** in
`.daiku/environment.json`: chi legge prende il primo dei due che trova e lo prende **intero**, non
li fonde. Serve dove una home dell'owner non c'è — una CI, un container — o dove un progetto solo
gira su un backend diverso dagli altri.

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
`{instructions_file}`: gira prima che `.daiku/project.json` esista ed è lei a scriverlo. Ogni
riscrittura di massa che sostituisce path con chiavi la tocca per errore — va ricontrollata a
mano.

Il backup di ciò che è stato tolto è `.docs/backup/skill-estratte.md`, ad append.
Vedi [[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
