Cosa resta da decidere
Le verifiche sono finite. Quello che resta sono scelte tue, non cose da scoprire. Sei, dalla più pesante alla più leggera.

1. Come si spacchetta CLAUDE.md. Metà di quel file è metodo — il contratto della memoria, la divisione della documentazione, quattro hard rule, le eccezioni di commit — e oggi vive in un file che è del progetto. Va deciso se quella metà diventa un contratto di riferimento che il pacchetto porta (contratti/invarianti.md), oppure se resta nel progetto e il pacchetto si limita a dichiarare gli slug che cita, lasciando che sia il progetto a definirli. È la decisione più grossa perché tocca due contratti che oggi dichiarano CLAUDE.md come fonte canonica.

2. Come si citano fra loro i contratti. I due host nominano le skill in modo incompatibile: /daiku:review su Claude, $review su Codex. Tre strade: scrivere il rimando in una forma che nomini entrambe, oppure lasciare che init lo risolva per host, oppure rinunciare al nome e usare sempre un path relativo. Non c'è una risposta ovvia.

3. Quali contratti sono invocabili a mano. orchestration.md §3 ne dichiara già 13 su ~20. Per gli altri va messo allow_implicit_invocation: false, che costa due campi di metadati per ciascuno. Va confermato che quella lista sia ancora quella giusta.

4. Dove va environment.json. Oggi si copia identico in ogni progetto — che è la duplicazione che il project-contract.md §8 condanna da sé. Il modello a pacchetto permette di spostarlo in ~/.daiku/environment.json, uno per macchina. È un miglioramento, ma cambia un'abitudine.

5. Come si chiamano le cose nel progetto ospite. Ho proposto .daiku/ con dentro dominio/ e politiche/. politiche/ esiste solo perché rules/ collide con un concetto di sicurezza di Codex — il nome è mio, va scelto da te.

6. Nomi in italiano o in inglese. Li ho lasciati come stanno. Il tentativo orfano li aveva anglicizzati; non c'è un vincolo tecnico in nessuna delle due direzioni.