---
description: 'Migliora una skill del prodotto: taglia il superfluo, precisa i vincoli riga per riga, chiede solo le scelte vere'
argument-hint: '[nome skill del prodotto]'
---

Migliori una o più skill in `plugins/daiku/skills/`. Modifichi il file. Non fai solo un report.

## Input

Argomenti: `$ARGUMENTS`, i nomi delle skill.

- Se vuoto, chiedi i nomi e fermati finché non arrivano.
- Sistemale una alla volta, in ordine.
- Il file è `plugins/daiku/skills/<nome>/SKILL.md`. Se un nome non esiste, dillo e passa alla successiva.

## Letture

Prima di toccare la prima skill leggi `plugins/daiku/README.md` (punti di ingresso) e `contracts/orchestration.md` §3 (chi si lancia a mano, chi è interno). Basta questo. Altri file solo se un dubbio si scioglie lì.

## I cinque controlli

Per ogni skill, leggi il file per intero e applichi questi, in ordine, riga per riga:

1. **Frontmatter.** `name` uguale alla cartella, `description` una riga, valori quotati con apice singolo. `argument-hint` solo se si lancia a mano. Un interno non lo ha.
2. **Taglio.** Ogni frase, sezione, esempio deve cambiare il comportamento se tolta. Se non lo cambia, toglila. Il file corto che resta è quello giusto.
3. **Un posto solo.** La stessa regola vive in un punto solo. Niente doppioni nel file, niente copie da orchestration o da altre skill: cita il path, non ricopiare.
4. **Precisione locale.** Ogni vincolo dice dove vale e si riconosce come tale: `devi`, `mai`, `sempre`, `solo`. Niente consigli, niente termini non definiti, niente incisi che spostano il vincolo. Ogni rilievo che applichi è locale: sai dire `path:riga`, cosa c'è e cosa diventa.
5. **Atomicità.** Una skill fa una cosa sola. Non invade un'altra skill, non porta valori di `environment.json` o `project.json`, non nomina modelli.

## Applica o chiedi

**Applica subito** tutto ciò che non richiede l'owner: frontmatter, italiano, formattazione, doppioni evidenti, vincoli scritti come consigli, nomi di campo che il resto del file già risolve. Non lasciare un ritocco sicuro nel report.

**Chiedi solo** quando senza l'owner non decidi: scope, permessi di scrittura, tradeoff fra comportamenti, caso non coperto. Una domanda alla volta, 2-4 opzioni, la prima è la raccomandata, ognuna dice cosa comporta. Mai domande su lingua, formattazione o doppioni. Se il problema è strutturale, chiedi invece di ridisegnare tu.

## Output

Modifica ogni file. Poi in chat, una skill alla volta:

- **cambiato** — un punto per modifica, con `path:riga`
- **domande** — solo le scelte vere
- **saltato** — solo se c'è, con il perché

Niente sezione `non guardato`. Niente ritocchi lasciati nel report.
