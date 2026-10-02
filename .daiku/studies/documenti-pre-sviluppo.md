# Documenti di pre-sviluppo — quali documenti si producono prima di costruire un'app

Appunti operativi raccolti da fonti reali. Oggetto: quali documenti (PRD, TRD, UI/UX, App Flow, Backend Schema, Implementation Plan e simili) si producono prima di sviluppare un'applicazione, se esiste uno standard o più di uno, e con quale forma.

- **Tipo di oggetto**: dominio/metodo, non una libreria. Non esiste un "ultima versione" da fissare; le versioni citate sono quelle degli standard e degli strumenti, con la data della loro pubblicazione.
- **Data di raccolta**: 2026-10-02.
- **Nota sul cutoff del modello**: le fonti sono state lette on-line alla data di raccolta; tutto ciò che non è stato confermato da una pagina letta è marcato `[to verify]`.

## Indice

1. **Standard formali dell'ingegneria del software**
   - 1.1 Requisiti: SRS, da IEEE 830 a ISO/IEC/IEEE 29148
   - 1.2 Concept: ConOps e SyRS
   - 1.3 Progetto: SDD e Architecture Description
   - 1.4 Cicli storici: MIL-STD-498 e DOD-STD-2167A
   - 1.5 Gestione: Charter, Business Case, Feasibility Study, BRD
   - 1.6 Modelli di processo e qualità (rilevanti ai documenti prodotti)
   - 1.7 Sintesi degli stati (il punto "esiste uno standard?")
2. **Product management — PRD, one-pager, canvas**
   - 2.1 PRD (Product Requirements Document)
   - 2.2 Amazon Working Backwards — il PR/FAQ
   - 2.3 Lean / strategia — i due canvas
   - 2.4 Shape Up (Basecamp) — il pitch
   - 2.5 Discovery — Torres, JTBD, product trio
   - 2.6 Vision — Product Vision Board (Roman Pichler)
   - 2.7 Metriche nel PRD — success metrics, North Star, KPI
   - 2.8 Sintesi: prassi diffusa vs posizione di un autore
3. **Documenti di progetto tecnico — design doc, RFC, ADR**
   - 3.1 Il panorama: come si chiamano le forme
   - 3.2 Design doc
   - 3.3 RFC
   - 3.4 ADR (Architecture Decision Record)
   - 3.5 Template di architettura
   - 3.6 TRD (Technical Requirements Document) vs PRD
   - 3.7 System Design Document / Technical Specification
   - 3.8 Convenzione di fatto vs standard formale
4. **UX/UI — flussi, wireframe, user story, design system**
   - 4.1 Distinzione portante: artefatto di design vs requisito
   - 4.2 Flussi
   - 4.3 Mappe
   - 4.4 Fedeltà crescente del disegno
   - 4.5 Requisiti dal lato utente
   - 4.6 Sistema di design
   - 4.7 Accessibilità e contenuto
   - 4.8 Strumenti e in quale fase
   - 4.9 Quadro sintetico artefatto vs requisito
5. **Schema dati e contratto delle API**
   - 5.1 Modello dati: ERD e livelli
   - 5.2 Formati di schema depositabili in repository
   - 5.3 Contratti API
   - 5.4 API-first / design-first
   - 5.5 Autenticazione e autorizzazione come parte dello schema
   - 5.6 Documento di schema vs contratto API
6. **Spec-driven development e file di contesto per agenti**
   - 6.1 Origine di "vibe coding"
   - 6.2 GitHub Spec Kit (`github/spec-kit`)
   - 6.3 AWS Kiro (`kiro.dev`)
   - 6.4 EARS (Easy Approach to Requirements Syntax)
   - 6.5 BMAD-METHOD
   - 6.6 Altri strumenti
   - 6.7 File di contesto per agenti
   - 6.8 Corpus e dati
7. **Le liste che circolano e la critica**
   - 7.1 Le liste di documenti (nessuna è "quella" lista)
   - 7.2 La critica e le evidenze

---

## 1. Standard formali dell'ingegneria del software

### 1.1 Requisiti: SRS, da IEEE 830 a ISO/IEC/IEEE 29148

**IEEE 830** — designazione IEEE 830-1998, titolo ufficiale verbatim **"IEEE Recommended Practice for Software Requirements Specifications"**. Pubblicato il 1998-10-20, stato verbatim **"Superseded Standard"**, con l'indicazione "Superseded by ISO/IEC/IEEE 29148:2011". Le edizioni precedenti: pubblicato nel 1984 come **IEEE-830-1984** col titolo *IEEE Guide for Software Requirements Specifications* e approvato da ANSI, poi revisionato nel 1993 e nel 1998. È lo standard storico della **Software Requirements Specification (SRS)**. (fonti: standards.ieee.org/ieee/830/1222/, en.wikipedia.org/wiki/IEEE_830, en.wikipedia.org/wiki/Software_requirements_specification)

Struttura raccomandata di una SRS secondo IEEE 830 (esempio ripreso da Stellman & Greene su Wikipedia) — tre parti top-level:

| Parte | Contenuto dichiarato dalla fonte |
|---|---|
| **1. Purpose** | definitions, background, system overview, references |
| **2. Overall description** | product perspective (system, user, hardware, software e communication interfaces; memory constraints), design constraints, product functions, user characteristics, constraints/assumptions/dependencies |
| **3. Specific requirements** | external interface, performance, logical database, "Software system attributes" (reliability, availability, security, maintainability, portability), functional requirements, environment characteristics |

La fonte aggiunge criteri di qualità: i requisiti individuali devono essere "necessary, appropriate, and unambiguous"; l'insieme "complete, consistent, feasible, and comprehensible". (fonte: en.wikipedia.org/wiki/Software_requirements_specification)

**ISO/IEC/IEEE 29148** — titolo ufficiale verbatim (pagina IEEE): **"ISO/IEC/IEEE International Standard - Systems and software engineering -- Life cycle processes -- Requirements engineering"**.
- **29148:2011** (designazione IEEE/ISO/IEC 29148-2011), pubblicata 2011-12-01, stato verbatim **"Superseded Standard"**, sostituita dalla 2018. La pagina dichiara verbatim: **"This standard replaces IEEE 830-1998, IEEE 1233-1998, IEEE 1362-1998."** (fonte: standards.ieee.org/ieee/29148/5289/)
- **29148:2018** (designazione IEEE/ISO/IEC 29148-2018), pubblicata **2018-11-30**, stato verbatim **"Active Standard"**, sostituisce 29148-2011. (fonte: standards-qa21.ieee.org/ieee/29148/6937/)
- L'edizione 2018 risulta però già in revisione nel sistema ISO (stage 90.92 "International Standard to be revised", con un progetto DIS 29148 in corso) — **[to verify]**, ricavato solo da riepiloghi di ricerca non letti integralmente. (fonte da verificare: iso.org/standard/72089.html)
- L'edizione 29148 amplia lo scope a **quattro tipi** di specifica — Business (BRS), Stakeholder (StRS), System (SyRS) e Software (SRS) — con criteri di qualità dei requisiti e processi di gestione. **[to verify]**: dettaglio presente solo in un riepilogo di ricerca (TechTarget/Wikipedia), non confermato su una pagina letta.

### 1.2 Concept: ConOps e SyRS

- **IEEE 1362-1998** — titolo ufficiale verbatim **"IEEE Guide for Information Technology - System Definition - Concept of Operations (ConOps) Document"**. Pubblicato 1998-12-22 (approvazione board 1998-03-19; reaffirmed 2007-12-05), stato verbatim **"Superseded Standard"**, **"Replaced by ISO/IEC/IEEE 29148:2011."** Definisce la **Concept of Operations (ConOps)**: documento orientato all'utente che descrive le caratteristiche del sistema proposto dal punto di vista degli utenti. (fonte: standards.ieee.org/ieee/1362/2047/)
- **IEEE 1233-1998** — titolo ufficiale verbatim **"IEEE Guide for Developing System Requirements Specifications"** (SyRS; a volte indicato come SOps). Sostituisce IEEE 1233-1996; risulta **Superseded/Withdrawn** e sostituito da **ISO/IEC/IEEE 29148:2011**. Data di pubblicazione 1998-12-29 **[to verify]**, ricavata solo da riepiloghi di ricerca (IEEE SA/Accuris), non da una pagina letta. (fonti da verificare: standards.ieee.org/ieee/1233/1879/, store.accuristech.com)

### 1.3 Progetto: SDD e Architecture Description

- **IEEE 1016-2009** — titolo ufficiale verbatim **"IEEE Standard for Information Technology--Systems Design--Software Design Descriptions"**. Pubblicato 2009-07-20, stato verbatim **"Inactive-Reserved Standard"** (inattivato 2020-03-05). Sostituisce IEEE 1016-1998 (che era una Recommended Practice; la 2009 la eleva a Standard). Definisce la **Software Design Description (SDD)**: contenuto informativo e organizzazione, con design viewpoint (logical, dependency, information, patterns, interface, structure, interaction, state dynamics, algorithm, resources). (fonte: standards.ieee.org/ieee/1016/4502/)
- **ISO/IEC/IEEE 42010:2011** — titolo ufficiale verbatim (pagina IEEE) **"ISO/IEC/IEEE Systems and software engineering -- Architecture description"**; titolo IEC **"Systems and software engineering - Architecture description"**. Pubblicato 2011-11-24 (ISO) / 2011-12-01 (IEEE), stato verbatim **"Inactive-Reserved Standard"** (inattivato 2022-03-24), **withdrawal date 2022-11-07**. Sostituisce **IEEE 1471-2000** e cancella/sostituisce **ISO/IEC 42010:2007**; è a sua volta **superseded by 42010-2022**. Definisce un modello concettuale con architecture view, viewpoint, framework, ADL e correspondences, e quattro casi di conformità. È lo **standard formale** dell'architecture description (a differenza di arc42 e C4, §3.5): fissa requisiti sulle *architecture descriptions* (non sulle architetture) — stakeholder, concerns, architecture viewpoint (le convenzioni per costruire una view), architecture view, model kind; la revisione 2011 ha **aggiunto** la modellazione delle architecture decisions e la rationale, oltre alle correspondences fra view. È pensato per integrarsi con TOGAF, Zachman, RM-ODP, ed è organizzato in 24 requisiti ("shalls") con annessi i template per definire i viewpoint. (fonti: standards.ieee.org/ieee/42010/5334/, webstore.iec.ch/en/publication/11978, http://www.iso-architecture.org/42010/)
- **ISO/IEC/IEEE 42010:2022** — titolo ufficiale verbatim **"Software, systems and enterprise - Architecture description"**, edizione **2.0**, pubblicato **2022-11-07**, stato corrente (BASE PUBLICATION). Sostituisce la 2011. (fonti: webstore.iec.ch/en/publication/80194, iso-architecture.org)
- **Software Architecture Document (SAD) di RUP** — non è uno standard IEEE/ISO ma un artefatto del Rational Unified Process. Definizione/purpose verbatim (pagina RUP): **"The software architecture document provides a comprehensive overview of the architecture of the software system."** Viste: Use-Case, Logical, Process, Deployment, Implementation, Data (obbligatorie solo Use-Case e Logical). Proprietario: Software Architect; prodotto principalmente in Elaboration. (fonte: docs.gehtsoftusa.com/rup/process/artifact/ar_sadoc.htm)

### 1.4 Cicli storici: MIL-STD-498 e DOD-STD-2167A

- **DOD-STD-2167A**, titolo ufficiale **"Defense Systems Software Development"**, pubblicato il 29 febbraio 1988 (aggiornava DOD-STD-2167, 4 giugno 1985). Cancellato/superato: **"On December 5, 1994 it was superseded by MIL-STD-498"**, che fuse DOD-STD-2167A, DOD-STD-7935A e DOD-STD-2168. La pagina Wikipedia **non nomina singolarmente** SDD/IRS/STP tra i documenti richiesti da 2167A (parla genericamente di "documentation item descriptions"); l'elenco puntuale dei DID di 2167A è **[to verify]**. (fonte: en.wikipedia.org/wiki/DOD-STD-2167A)
- **MIL-STD-498**, titolo ufficiale **"MIL-STD-498, Military Standard Software Development and Documentation"**, rilasciato l'8 novembre 1994. **Cancellato il 27 maggio 1998**, sostituito dalla versione "demilitarized" **EIA J-STD-016**. Sostituiva DOD-STD-2167A, DOD-STD-2168, DOD-STD-7935A e DOD-STD-1703. (fonte: en.wikipedia.org/wiki/MIL-STD-498)
- **I 22 Data Item Descriptions (DID)** di MIL-STD-498, tutti datati 1994-12-05 (fonte: segoldmine.ppi-int.com/node/44371):

| DID | Titolo | | DID | Titolo |
|---|---|---|---|---|
| DI-IPSC-81427 | Software Development Plan (SDP) | | DI-IPSC-81438 | Software Test Plan (STP) |
| DI-IPSC-81428 | Software Installation Plan (SIP) | | DI-IPSC-81439 | Software Test Description (STD) |
| DI-IPSC-81429 | Software Transition Plan (STrP) | | DI-IPSC-81440 | Software Test Report (STR) |
| DI-IPSC-81430 | Operational Concept Description (OCD) | | DI-IPSC-81441 | Software Product Specification (SPS) |
| DI-IPSC-81431 | System/Subsystem Specification (SSS) | | DI-IPSC-81442 | Software Version Description (SVD) |
| DI-IPSC-81432 | System/Subsystem Design Description (SSDD) | | DI-IPSC-81443 | Software User Manual (SUM) |
| DI-IPSC-81433 | Software Requirements Specification (SRS) | | DI-IPSC-81444 | Software Center Operator Manual (SCOM) |
| DI-IPSC-81434 | Interface Requirements Specification (IRS) | | DI-IPSC-81445 | Software Input/Output Manual (SIOM) |
| DI-IPSC-81435 | Software Design Description (SDD) | | DI-IPSC-81446 | Computer Operation Manual (COM) |
| DI-IPSC-81436 | Interface Design Description (IDD) | | DI-IPSC-81447 | Computer Programming Manual (CPM) |
| DI-IPSC-81437 | Database Design Description (DBDD) | | DI-IPSC-81448 | Firmware Support Manual (FSM) |

- **Artefatti RUP** (fonte: docs.gehtsoftusa.com/rup/process/artifact/):
  - **Vision** — "Defines the stakeholders view of the product to be developed"; verbatim: **"The Vision provides a high-level, sometimes contractual, basis for the more detailed technical requirements."** Creato in Inception; a volte chiamato "Product Requirement Document".
  - **Use-Case Model** — "a model of the system's intended functions and its environment"; **"serves as a contract between the customer and the developers."** Tre viste RUP, di cui obbligatorie Use-Case e Logical.
  - **Supplementary Specification** — cattura i requisiti "not readily captured in behavioral requirements artifacts such as use-case specifications" (requisiti legali/normativi e quality attributes: usability, reliability, performance, supportability). Insieme al use-case model "capture a complete set of requirements on the system".
  - **Software Architecture Document (SAD)** — sede canonica al §1.3.
  - **Test Plan** — copre "The definition of the goals and objectives of testing within the scope of the iteration (or project)"; scopo: "to outline and communicate the intent of the testing effort for a given schedule". Esistono Master Test Plan e Iteration Test Plan.

### 1.5 Gestione: Charter, Business Case, Feasibility Study, BRD

- **Project Charter** (PMI/PMBOK) — verbatim: **"A project charter provides the project manager with the authority to apply organizational resources to project activities."** "formally recognizes the existence of the project"; una volta approvato **"it becomes an agreement between the project leader and the project sponsor"** e "signals the transition into the planning phase". Template in 13 sezioni (purpose, SMART objectives, high-level requirements, boundaries and deliverables, assumptions and constraints, overall risk, milestone schedule, preapproved funds, key stakeholders, approval requirements, exit criteria, team, sponsor authority). (fonte: pressbooks.ulib.csuohio.edu/projectmanagement2ndedition/chapter/3-1-project-charter/)
- **Business Case** (PMI/PMBOK) — verbatim dalla stessa fonte: **"Project justification starts when a business case is prepared that addresses the needs and feasibility of solutions."** È un input richiesto per sviluppare lo charter, insieme a needs analysis e benefits management plan: "Developing a project charter requires inputs such as business documents (business case, needs analysis, and benefits management plan)". Nota: la fonte usata non elenca sezione per sezione il contenuto del business case (dettaglio **[to verify]**).
- **Feasibility Study** — definita come valutazione della praticabilità di un piano/progetto prima dell'avvio; framework comune **TELOS** (Technical, Economic, Legal, Operational, Scheduling). Nel materiale consultato è descritta come documento della fase pre-progetto che valuta il progetto da prospettive tecnica, economica, organizzativa e temporale. **Attenzione [to verify]**: questi contenuti provengono da riepiloghi di ricerca (ProjectManager.com, Wikipedia), non da una pagina letta integralmente né da una clausola PMBOK citata verbatim.
- **Business Requirements Document (BRD)** — le fonti consultate **non individuano** un singolo standard formale né un unico ente emittente per il BRD. Il termine è associato a **IIBA/BABOK** (Business Requirements come "statements of goals, objectives, and outcomes that describe why a change has been initiated") e alla prassi aziendale; il BRD è distinto da stakeholder requirements e solution requirements. Autore e approvatore variano per organizzazione (campi "Author"/"Source"/owner nei template). **[to verify]**: assenza di standard formale dichiarata esplicitamente solo in modo indiretto. (fonti da verificare: pmi-oc.org (slide 2016), iiba.si (presentazione 2023), orbussoftware.com)

### 1.6 Modelli di processo e qualità (rilevanti ai documenti prodotti)

- **ISO/IEC/IEEE 12207:2017** — titolo ufficiale verbatim **"Systems and software engineering — Software life cycle processes"**, edizione **1**, pubblicato **28 novembre 2017**, stato **"Withdrawn"** (withdrawn 2026-04-29); successore in corso **ISO/IEC/IEEE 12207:2026**. Revises ISO/IEC 12207:2008. Il dettaglio dei **quattro process groups** proviene solo da un riepilogo di ricerca ed è **[to verify]**. (fonte: connect.snv.ch/en/iso-iec-ieee-12207-2017)
- **ISO/IEC 25010:2011** — titolo ufficiale verbatim **"Systems and software engineering - Systems and software Quality Requirements and Evaluation (SQuaRE)"** / **"System and software quality models"**, edizione 1.0, pubblicato **2011-03-01**, **withdrawn 2024-03-04**, sostituito da **ISO/IEC 25010:2023**, **ISO/IEC 25002:2024** e **ISO/IEC 25019:2023**. (fonte: webstore.iec.ch/en/publication/11245)
- **ISO/IEC 25010:2023** — titolo ufficiale verbatim **"Systems and software engineering"** (serie SQuaRE) / **"Product quality model"**, edizione **2.0**, pubblicato **2023-11-15**. Il numero di caratteristiche (otto nel 2011, nove nel 2023, con rinominazione usability→"interaction capability" e portability→"flexibility") è **[to verify]**: ricavato da riepiloghi di ricerca, mentre le pagine IEC lette confermano solo titolo, edizione e date. (fonte: webstore.iec.ch/en/publication/90024)

### 1.7 Sintesi degli stati (il punto "esiste uno standard?")

| Standard | Titolo ufficiale (verbatim) | Pubblicato | Stato | Sostituito da |
|---|---|---|---|---|
| IEEE 830-1998 | "IEEE Recommended Practice for Software Requirements Specifications" | 1998-10-20 | Superseded | ISO/IEC/IEEE 29148:2011 |
| IEEE 1233-1998 | "IEEE Guide for Developing System Requirements Specifications" | [to verify] 1998-12-29 | Superseded/Withdrawn | ISO/IEC/IEEE 29148:2011 |
| IEEE 1362-1998 | "IEEE Guide for Information Technology - System Definition - Concept of Operations (ConOps) Document" | 1998-12-22 | Superseded | ISO/IEC/IEEE 29148:2011 |
| ISO/IEC/IEEE 29148:2011 | "…Systems and software engineering -- Life cycle processes -- Requirements engineering" | 2011-12-01 | Superseded | 29148:2018 |
| ISO/IEC/IEEE 29148:2018 | "…Systems and software engineering -- Life cycle processes -- Requirements engineering" | 2018-11-30 | Active | in revisione [to verify] |
| IEEE 1016-2009 | "IEEE Standard for Information Technology--Systems Design--Software Design Descriptions" | 2009-07-20 | Inactive-Reserved | — |
| ISO/IEC/IEEE 42010:2011 | "…Systems and software engineering -- Architecture description" | 2011-11-24 | Inactive-Reserved (withdrawn 2022-11-07) | 42010:2022 |
| ISO/IEC/IEEE 42010:2022 | "Software, systems and enterprise - Architecture description" | 2022-11-07 | Corrente | — |
| ISO/IEC/IEEE 12207:2017 | "Systems and software engineering — Software life cycle processes" | 2017-11-28 | Withdrawn (2026-04-29) | 12207:2026 |
| ISO/IEC 25010:2011 | "…SQuaRE… System and software quality models" | 2011-03-01 | Withdrawn (2024-03-04) | ISO/IEC 25010:2023 + 25002:2024 + 25019:2023 |
| ISO/IEC 25010:2023 | "Systems and software engineering — Product quality model" | 2023-11-15 | Corrente | — |

**Fonti** (pagine lette via WebFetch): https://standards.ieee.org/ieee/830/1222/ · https://standards.ieee.org/ieee/1016/4502/ · https://standards.ieee.org/ieee/1362/2047/ · https://standards.ieee.org/ieee/29148/5289/ · https://standards-qa21.ieee.org/ieee/29148/6937/ · https://standards.ieee.org/ieee/42010/5334/ · https://webstore.iec.ch/en/publication/11978 · https://webstore.iec.ch/en/publication/80194 · https://webstore.iec.ch/en/publication/11245 · https://webstore.iec.ch/en/publication/90024 · https://connect.snv.ch/en/iso-iec-ieee-12207-2017 · https://en.wikipedia.org/wiki/IEEE_830 · https://en.wikipedia.org/wiki/Software_requirements_specification · https://en.wikipedia.org/wiki/DOD-STD-2167A · https://en.wikipedia.org/wiki/MIL-STD-498 · https://segoldmine.ppi-int.com/node/44371 · https://docs.gehtsoftusa.com/rup/process/artifact/ar_vsion.htm · https://docs.gehtsoftusa.com/rup/process/artifact/ar_sadoc.htm · https://docs.gehtsoftusa.com/rup/process/artifact/ar_ucmod.htm · https://docs.gehtsoftusa.com/rup/process/artifact/ar_sspec.htm · https://docs.gehtsoftusa.com/rup/process/artifact/ar_tstpl.htm · https://pressbooks.ulib.csuohio.edu/projectmanagement2ndedition/chapter/3-1-project-charter/
Fonti solo a livello di ricerca (marcate [to verify] nei punti): iso.org/standard/72089.html · standards.ieee.org/ieee/1233/1879/ · techtarget.com · projectmanager.com · pmi-oc.org · iiba.si · orbussoftware.com · pub.dev / sis.se (ISO 25010 caratteristiche).

---

## 2. Product management — PRD, one-pager, canvas

### 2.1 PRD (Product Requirements Document)

**Definizione.** Non esiste una definizione unica: le fonti divergono nel perimetro. Le formulazioni verbatim dei vendor:

- Figma: *"A PRD defines the requirements for a product release."* e *"It guides your team through designing, building, and testing a product."* — [figma.com](https://www.figma.com/resource-library/product-requirements-document/)
- Product School: *"A PRD is a guide that defines a particular product's requirements"*, che copre *"its purpose, features, functionality, and behavior."* — [productschool.com](https://productschool.com/blog/product-strategy/product-template-requirements-document-prd)
- Aha!: *"a PRD simply contains all the requirements for a product"* e *"A PRD looks like a table of contents for a product."* — [aha-gatsby.netlify.app](https://aha-gatsby.netlify.app/roadmapping/guide/requirements-management/what-is-a-prd-(product-requirements-document))
- Atlassian: *"a guide that defines the requirements of a particular product or feature, including its purpose, features, and functionality."* — [atlassian.com](https://www.atlassian.com/software/confluence/templates/product-requirements)

Definizione sintetica ricorrente (usata nel contrasto col TRD al §3.6): scritto dal punto di vista dell'utente per capire **cosa** deve fare il prodotto; "normally prepared by the product manager". Sezioni tipiche: obiettivi del prodotto, feature, UX flow e design notes, requisiti di sistema e ambiente, assunzioni/vincoli/dipendenze, requisiti non funzionali (affidabilità, sicurezza, scalabilità).

**Da dove viene (eredità waterfall).** Fonte letta (Aha!): *"Waterfall dominated as the prevailing methodology from the 1970s up until the 2000s."* Poiché *"building scalable software products was expensive and time-intensive"*, i PRD *"which captured every aspect of the product in precise detail — became indispensable"*. Con l'agile *"many people found that PRDs were fundamentally at odds with the emerging methodology"* e li etichettarono *"relics of waterfall development"* — [aha-gatsby.netlify.app](https://aha-gatsby.netlify.app/roadmapping/guide/requirements-management/what-is-a-prd-(product-requirements-document)). Il dettaglio quantitativo (PRD waterfall da 40–100 pagine, emersi negli anni '80–'90, popolarizzati da Microsoft e IBM come "contratto" fra product e engineering) proviene solo dai riassunti di ricerca e non da una pagina letta: **[to verify]** sul numero di pagine e sulla paternità Microsoft/IBM.

**Chi lo usa oggi.** Prassi diffusa: è scritto dal Product Manager, spesso co-creato con design e engineering; è un *"living document"* aggiornato lungo il ciclo di vita (Product School: *"PRDs are living documents"*; Minal Mehta, citata nella pagina, lo chiama *"a living document that should be continuously updated"*). Figma: *"Product managers typically own the PRD"*, *"co-created with designers, engineers, and other stakeholders"*.

**Sezioni tipiche — quattro template reali (verbatim).**

| Template | Sezioni (titoli verbatim dove disponibili) | Fonte |
|---|---|---|
| **Atlassian** (Confluence) | Le aree nominate nella pagina: **Objective**, **Success metrics**, **Assumptions**, **Options**. I cinque passi di scrittura: *"Define PRD basics and team roles"*, *"Set product objectives and success metrics"*, *"List your assumptions and options to address them"*, *"Add supporting documentation"*, *"Anticipate open questions and scope creep"*. Un elenco più ampio (Project details/Team roles, Goals & Objectives, Success metrics, Assumptions, Requirements/Options considered, User interaction and design, Open questions, Out of scope) viene solo dai riassunti di ricerca: **[to verify]** | [atlassian.com](https://www.atlassian.com/software/confluence/templates/product-requirements) |
| **Product School** | **Title**, **Change History**, **Overview**, **Success Metrics**, **Messaging**, **Timeline/Release Planning**, **Personas**, **User Scenarios**, **User Stories/Features/Requirements**, **Features Out**, **Designs**, **Open Issues**, **Q&A**, **Other Considerations** | [productschool.com](https://productschool.com/blog/product-strategy/product-template-requirements-document-prd) |
| **Figma** (approccio moderno, tre blocchi) | **Problem Alignment**, **Solution Alignment**, **Launch Readiness** (contenuto da riassunto di ricerca): **[to verify]** | [figma.com](https://www.figma.com/resource-library/product-requirements-document/) |
| **Aha!** ("what to include", titoli verbatim) | **Overview** (*"The basics of what you are building, including status, team members, and release date"*), **Objective**, **Context**, **Assumptions**, **Scope**, **Requirements**, **Performance** (*"Success metrics"*), **Open questions** | [aha-gatsby.netlify.app](https://aha-gatsby.netlify.app/roadmapping/guide/requirements-management/what-is-a-prd-(product-requirements-document)) |

Componenti ricorrenti figmate: **product overview / purpose / value proposition**, **user personas & user stories**, **user flows**, **release criteria & timeline**, **risks**, **non-functional requirements**, **assumptions/dependencies/constraints**, **evaluation plan & success metrics** (Figma, elenco dei "core components"). Prassi diffusa: i PRD moderni tendono a 1–3 pagine (contro 20–40 del template classico "Microsoft / Marty Cagan era") — cifra dai riassunti di ricerca: **[to verify]**.

**PRD vs MRD vs BRD.** Fonte letta, verbatim (ClickHelp):

- **MRD**: *"a strategic document that explores whether there is a market opportunity worth pursuing"*; *"The MRD focuses on market opportunity and whether a product makes business sense."* (mercato, TAM/SAM/SOM, competitor, business case, rischi).
- **BRD**: *"The BRD captures what business problem we are solving and how solving it fits into the larger organizational picture."* (processi, compliance, KPI, budget).
- **PRD**: *"the PRD is about the actual product"*, *"the bridge between business requirements and technical execution."*

Differenze verbatim: *"The MRD talks to executives and investors in business language about markets and money"*, mentre il PRD parla a *"developers, designers, and testers"*; il BRD *"talks about business processes, organizational changes, and internal metrics"* contro il PRD che tratta *"user-facing features, customer experiences, and product functionality"* — [clickhelp.com](https://clickhelp.com/clickhelp-technical-writing-blog/prd-vs-mrd-brd-tech-spec-and-user-stories-whats-the-difference/). Catena tipica (prassi): **BRD → MRD → PRD → Tech Spec**.

**PRD vs one-pager / Product Brief.** Distinzione verbatim letta (Product School, articolo sul "PRO"): un one-pager è *"a brief document (typically one page)"* che *"replace[s] the bulky PRD during the early prototyping phase"*; *"A PRO is faster and clearer than a traditional PRD."* Regola sintetica: PRD *"Often 20+ pages"* vs one-pager *"Typically one page; roughly 500 words or less."* — [productschool.com](https://productschool.com/blog/skills/prototyping-requirements-the-one-pager-for-ai-pms). Formulazione da riassunto di ricerca (non da pagina letta): il brief risponde a *"should we build this?"*, il PRD a *"how should we build this?"* — **[to verify]**.

**Asana — Product Brief.** Asana non pubblica un "PRD template" bensì un **product brief**: sezioni (da riassunto di ricerca): Problem statement, Product objectives, Target audience, Key features and functionality, Competitive landscape, Timeline and milestones, Success metrics, Budget and resources, più Open questions — **[to verify]** su [asana.com/resources/product-brief-template](https://asana.com/resources/product-brief-template).

**Posizione di Marty Cagan / SVPG (non prassi diffusa, ma tesi di un autore).** Cagan non dichiara il PRD "obsoleto"; attacca gli spec scritti male e non testati: *"the typical spec is so poor (incomplete, ambiguous, and especially untested)"* che *"so few of the hard questions and critical details are actually addressed and resolved"*. Nel "Top 12 Product Management Mistakes" la mistake #10 è *"Confusing Impressive Specifications with an Impressive Product"*: i documenti *"can do very little to ensure you're actually building a product that your customers will want to buy."* Alternativa raccomandata: costruire un prototipo, mostrarlo agli utenti, iterare, e usarlo come base dello spec. Nel "How To Write a Good PRD" (SVPG, 2005): *"features should be in support of required tasks that map to customer objectives."* Fonti: PDF SVPG [svpg.com](https://www.svpg.com/wp-content/uploads/2024/07/How-To-Write-a-Good-PRD.pdf) e sintesi dalla ricerca [uservoice.com](https://uservoice.com/blog/is-the-product-requirements-document-dead); la citazione diretta esatta di ogni frase va ricontrollata sui PDF: **[to verify]** per la virgolettatura puntuale.

---

### 2.2 Amazon Working Backwards — il PR/FAQ

**Che cos'è (fonte letta, workingbackwards.com).** Lo strumento principale del metodo è *"Writing the press release and FAQ before you build the product"*. Il principio: *"start by defining the customer experience, then iteratively work backwards from that point."* Poiché normalmente il comunicato è l'ultimo passo del lancio, qui viene per primo: *"Writing a press release is a forcing function."* Definizione del metodo: *"Working Backwards is a systematic way to vet ideas and create new products."* — [workingbackwards.com](https://workingbackwards.com/resources/working-backwards-pr-faq/)

**Struttura del Press Release (sei componenti, verbatim).**

1. **Heading** — *"Name the product so the reader (i.e., your target customers) will understand—one sentence under the title."*
2. **Subheading** — *"Describe the customer for the product and what benefits they will gain from using it"*.
3. **Summary Paragraph** — apre con città, testata e data di lancio prevista.
4. **Problem Paragraph** — scritto *"from the customer's point of view"*, con il problema e un TAM ampio (TAM = numero clienti con il problema × disponibilità a pagare).
5. **Solution Paragraph(s)** — *"Today, customers with this problem use x, y, or z products to meet their needs."*
6. **Quotes & Getting Started** — una citazione dello spokesperson, una di un cliente ipotetico, più come iniziare.

**Struttura delle FAQ (due sezioni, verbatim).** *External FAQs* (per stampa e clienti: *"How does it work? What is the warranty? What is the return policy?"*, in linguaggio cliente) e *Internal FAQs*: *"A well-written internal FAQ section anticipates the most important questions that senior leaders and stakeholders"* will ask, coprendo *"every department and all hard technical, financial, legal, or operational problems."*

**Sforzo richiesto (verbatim).** *"the first draft of a PR/FAQ should take only a few hours, not a few days."* Prima review con *"a small group of about 10 contributors"*, lettura silenziosa prima della discussione. La versione a nove parti del comunicato e il tetto "4–7 pagine / FAQ ≤ 5 pagine / PR < 1 pagina" provengono dai riassunti di ricerca (blog ones.com, template su GitHub): **[to verify]** — la pagina ufficiale letta non dà un limite di pagine ma il tempo di stesura.

Nota di metodo: il PR/FAQ *precede* il PRD e serve da funding gate e stress-test del concetto; è sconsigliato per feature incrementali su prodotto esistente (da riassunto di ricerca): **[to verify]**.

---

### 2.3 Lean / strategia — i due canvas

**Business Model Canvas (Osterwalder & Pigneur).** Definizione verbatim: *"a visual framework that allows you to map out your entire business on a single page"*, diviso in nove blocchi collegati. Concetto di fondo: *"A business model describes the rationale of how an organization creates, delivers, and captures value."* I nove blocchi con la domanda guida verbatim: **Customer segments** (*"Who are your most important customers?"*), **Value propositions** (*"What value do you deliver to customers?"*), **Channels** (*"How do you reach your customers?"*), **Customer relationships** (*"What type of relationship do you establish with customers?"*), **Revenue streams** (*"How does your business earn money?"*), **Key resources** (*"What assets are indispensable to your business?"*), **Key activities** (*"What activities must you excel at?"*), **Key partnerships** (*"Who are your key partners and suppliers?"*), **Cost structure** (*"What are your most important costs?"*) — [strategyzer.com](https://www.strategyzer.com/library/business-model-generation-book-summary)

**Lean Canvas (Ash Maurya, 2010).** Nove blocchi verbatim: **Problem**, **Customer Segments**, **Unique Value Proposition**, **Solution**, **Channels**, **Revenue Streams**, **Cost Structure**, **Key Metrics**, **Unfair Advantage**. Maurya sostituisce quattro blocchi del BMC: **Key Partners → Problem**, **Key Activities → Solution**, **Key Resources → Key Metrics**, **Customer Relationships → Unfair Advantage**; *Unfair Advantage* è ciò che *"cannot be copied, mimicked, or acquired."* Posizione dell'autore (verbatim dalla fonte letta): *"one is not better than the other"* — il BMC racconta come è montata un'azienda operativa, il Lean Canvas *"focuses on the customer-problem-solution relationship"* e cattura ipotesi più che fatti; primo draft sotto i 20 minuti — [businessmodelanalyst.com](https://businessmodelanalyst.com/lean-canvas/)

**A chi servono prima di scrivere codice.** Prassi diffusa: il BMC per capire l'anatomia di un business (spesso insegnato per primo), il Lean Canvas quando c'è un'idea propria da testare, con l'attenzione sulle ipotesi più critiche — **Customer Segments, Problem, Solution** (sintesi dalla ricerca): **[to verify]**.

---

### 2.4 Shape Up (Basecamp) — il pitch

**I cinque ingredienti (verbatim, Ryan Singer, cap. 6).**

1. **Problem** — *"The raw idea, a use case, or something we've seen that motivates us to work on this"* (sviluppato con una storia specifica che mostra perché lo status quo non funziona, per avere una baseline con cui testare la fitness della soluzione).
2. **Appetite** — *"How much time we want to spend and how that constrains the solution"* (glossario: *"The amount of time we want to spend on a project, as opposed to an estimate."*).
3. **Solution** — *"The core elements we came up with, presented in a form that's easy for people to immediately understand"*.
4. **Rabbit holes** — *"Details about the solution worth calling out to avoid problems"*.
5. **No-gos** — *"Anything specifically excluded from the concept: functionality or use cases we intentionally aren't covering"*.

— [basecamp.com/shapeup/1.5-chapter-06](https://basecamp.com/shapeup/1.5-chapter-06)

Discipline (posizione dell'autore): non over-specify il design — *"we don't want to over-specify the design with wireframes or high-fidelity mocks"*, che rischia di *"box in the designers who do the work later"*; rabbit holes non devono mai essere vuoti; i no-gos devono essere non ovvi.

**Posizione contro il backlog (non contro i documenti lunghi).** Il cap. 7 si intitola *"Bets, Not Backlogs"*: *"Now that we've written a pitch, where does it go? It doesn't go onto a backlog."* Il backlog è *"a big weight we don't need to carry"*, *"big time wasters too"*, e *"The growing pile gives us a feeling like we're always behind even though we're not."* Al suo posto, davanti al betting table *"There are just a few well-shaped, risk-reduced options to review. The pitches are potential bets."* — [basecamp.com/shapeup/2.1-chapter-07](https://basecamp.com/shapeup/2.1-chapter-07). **Precisazione importante:** né il cap. 6 né il cap. 7 nominano i PRD o argomentano contro la lunghezza dei documenti; l'opposizione esplicita è all'accumulo di idee non finanziate. La critica ai "PRD lunghi" è attribuzione esterna, non presente in queste pagine: **[to verify]**.

---

### 2.5 Discovery — Torres, JTBD, product trio

**Opportunity Solution Tree (Teresa Torres).** Definizione verbatim: *"a simple way of visually representing the paths you might take to reach a desired outcome."* I livelli, dall'alto: **Outcome** (il bisogno di business che riflette come il team crea valore), **Opportunity space** (*"the customer needs, pain points, and desires that, if addressed, will drive your desired outcome"*; una opportunity è *"an unmet customer need, pain point, or desire"*), **Solution space**, **assumption tests** (*"This is how we'll evaluate which solutions will help us best create customer value in a way that drives business value."*). — [producttalk.org/opportunity-solution-trees](https://www.producttalk.org/opportunity-solution-trees/)

**Product trio (verbatim).** *"The product trio consists of a product manager, a designer, and a software engineer."* Le OST sono pensate per aiutare il trio: *"Opportunity solution trees are designed to help a product trio chart the best path to their desired outcome."* (stessa fonte).

**Continuous Discovery Habits.** Definizione (da riassunto di ricerca, non da pagina letta): *"weekly touchpoints with customers, run by the team building the product, in pursuit of a desired outcome"*; i prodotti sono guidati da *"small and frequent beats big and rare"* — **[to verify]** sulla virgolettatura esatta; la pagina [producttalk.org/2022/01/continuous-discovery-habits](https://www.producttalk.org/2022/01/continuous-discovery-habits/) letta non riporta la definizione ma descrive il libro come *"a product trio's guide to a structured and sustainable approach to continuous discovery."*

**Jobs-to-be-Done.** Definizione verbatim (Strategyn): *"Jobs-to-be-Done (JTBD) is a theory of innovation that holds that people buy products and services to get a job done."* Un job è *"the task, goal, or objective a customer is trying to accomplish in a given situation."* Principio: *"Jobs are stable; products are not."* La citazione classica è di **Theodore Levitt**: *"People don't want a quarter-inch drill; they want a quarter-inch hole."* Origine (posizione dello Strategyn): *"Clayton Christensen may have popularized Jobs-to-be-Done in his 2003 book The Innovator's Solution — but it was Tony Ulwick who introduced him to the concept"* (Ulwick concettualizza il JTBD nel 1990 con logica Six Sigma, poi Outcome-Driven Innovation). — [strategyn.com/jobs-to-be-done](https://strategyn.com/jobs-to-be-done/)

Posizione di **Christensen** (da riassunto di ricerca, HBR 2005 / *Competing Against Luck* 2016): un job è *"the progress that a person is trying to make in a particular circumstance"*; i clienti *"hire"* i prodotti e li *"fire"* quando ne trovano uno migliore; esempio celebre del **milkshake** (ricerca attribuita anche a Bob Moesta). Le "four forces" (Push, Pull, Anxiety, Habit) sono attribuite a Moesta e Chris Spiek — **[to verify]** sulle virgolette puntuali.

---

### 2.6 Vision — Product Vision Board (Roman Pichler)

**Sezioni verbatim del board:** **Vision**, **Target Group**, **Needs**, **Product**, **Business Goals**. La sezione in alto *"states your overarching goal, the ultimate reason for creating the product, and the positive change you want to bring about."* Indicazione dell'autore: *"Make your vision big and inspiring; use a brief statement or slogan"*, verificando che *"the stakeholders and development team(s) support it, that it is shared."* Senza visione e strategia condivise *"people are likely to pull in different directions."* Ordine di compilazione consigliato: partire dai blocchi in basso, compilare con team e stakeholder. — [romanpichler.com/blog/the-product-vision-board/](https://romanpichler.com/blog/the-product-vision-board/)

Pagina dello strumento (verbatim): il board *"helps you describe, visualise, and validate your product vision and product strategy"* (creato da Pichler nel 2011) e *"captures the target group, needs, key features, and business goals"*; la versione **estesa** aggiunge *"competitors, revenue sources, cost factors, and channels."* — [romanpichler.com/tools/product-vision-board/](https://www.romanpichler.com/tools/product-vision-board/). La definizione formale di "product vision statement" e i suoi elementi non erano presenti nelle pagine lette: **[to verify]** (rimanda a un articolo separato "8 Tips for Creating A Compelling Product Vision").

---

### 2.7 Metriche nel PRD — success metrics, North Star, KPI

- Nei template, la metrica di successo è una sezione fissa: **Success Metrics** (Product School), **Performance** = *"Success metrics"* (Aha!), **Success metrics** (Atlassian). Prassi diffusa: vanno legate all'obiettivo, non essere vanity metric.
- **North Star Metric** (posizione di Amplitude, da riassunto di ricerca): il North Star Framework è *"a model for managing products by identifying a single, crucial metric (the North Star Metric) that captures the core value that your product delivers to its customers"*; il NSM è *"one number, not a dashboard"*, leading indicator, non DAU/revenue; Sean Ellis ne ha diffuso il framing, Lean Analytics lo chiama "One Metric That Matters" (OMTM) — **[to verify]** sulla virgolettatura, letta solo da sommario di ricerca: [amplitude.com](https://amplitude.com/blog/north-star-metric).

---

### 2.8 Sintesi: prassi diffusa vs posizione di un autore

| Tema | Prassi diffusa | Posizione esplicita di un autore |
|---|---|---|
| PRD | documento vivo, 1–3 pagine, owner il PM, co-creato con design/eng | **Cagan/SVPG**: gli spec scritti non testati sono la causa del ritardo; sostituirli con prototipi validati |
| Precedenza | brief/one-pager → PRD → tech spec | **Amazon**: il PR/FAQ (comunicato + FAQ) *prima* di costruire, come forcing function |
| Piano | backlog prioritizzato e raffinato | **Basecamp/Shape Up**: *"Bets, Not Backlogs"* — nessun backlog, solo pitch shaped e appetite |
| Strategia | Business Model Canvas come anatomia del business | **Maurya**: Lean Canvas per le ipotesi di startup; *"one is not better than the other"* |
| Discovery | interviste e ricerca continue nel team | **Torres**: product trio (PM + design + eng) che intervista insieme, OST come mappa *"small and frequent beats big and rare"* |
| Visione | vision statement condiviso e stabile | **Pichler**: vision sopra il board, *"big and inspiring"*, separata dalla strategia che può cambiare |

**Fonti.** Pagine lette: [basecamp.com/shapeup/1.5-chapter-06](https://basecamp.com/shapeup/1.5-chapter-06) · [basecamp.com/shapeup/2.1-chapter-07](https://basecamp.com/shapeup/2.1-chapter-07) · [romanpichler.com/blog/the-product-vision-board](https://romanpichler.com/blog/the-product-vision-board/) · [romanpichler.com/tools/product-vision-board](https://www.romanpichler.com/tools/product-vision-board/) · [producttalk.org/opportunity-solution-trees](https://www.producttalk.org/opportunity-solution-trees/) · [producttalk.org/2022/01/continuous-discovery-habits](https://www.producttalk.org/2022/01/continuous-discovery-habits/) · [workingbackwards.com/resources/working-backwards-pr-faq](https://workingbackwards.com/resources/working-backwards-pr-faq/) · [businessmodelanalyst.com/lean-canvas](https://businessmodelanalyst.com/lean-canvas/) · [strategyn.com/jobs-to-be-done](https://strategyn.com/jobs-to-be-done/) · [figma.com/resource-library/product-requirements-document](https://www.figma.com/resource-library/product-requirements-document/) · [productschool.com/blog/product-strategy/product-template-requirements-document-prd](https://productschool.com/blog/product-strategy/product-template-requirements-document-prd) · [productschool.com/blog/skills/prototyping-requirements-the-one-pager-for-ai-pms](https://productschool.com/blog/skills/prototyping-requirements-the-one-pager-for-ai-pms) · [aha-gatsby.netlify.app/.../what-is-a-prd](https://aha-gatsby.netlify.app/roadmapping/guide/requirements-management/what-is-a-prd-(product-requirements-document)) · [atlassian.com/software/confluence/templates/product-requirements](https://www.atlassian.com/software/confluence/templates/product-requirements) · [strategyzer.com/library/business-model-generation-book-summary](https://www.strategyzer.com/library/business-model-generation-book-summary) · [clickhelp.com/.../prd-vs-mrd-brd-tech-spec-and-user-stories](https://clickhelp.com/clickhelp-technical-writing-blog/prd-vs-mrd-brd-tech-spec-and-user-stories-whats-the-difference/) · [svpg.com/.../How-To-Write-a-Good-PRD.pdf](https://www.svpg.com/wp-content/uploads/2024/07/How-To-Write-a-Good-PRD.pdf) · [uservoice.com/blog/is-the-product-requirements-document-dead](https://uservoice.com/blog/is-the-product-requirements-document-dead) · [asana.com/resources/product-brief-template](https://asana.com/resources/product-brief-template) · [amplitude.com/blog/north-star-metric](https://amplitude.com/blog/north-star-metric) · [library.hbs.edu/working-knowledge/what-customers-want-from-your-products](https://www.library.hbs.edu/working-knowledge/what-customers-want-from-your-products).

---

## 3. Documenti di progetto tecnico — design doc, RFC, ADR

### 3.1 Il panorama: come si chiamano le forme

| Forma | A cosa serve | Chi approva / decide | Natura |
|---|---|---|---|
| Design doc | Progettare *prima* di scrivere codice non banale; mettere per iscritto i trade-off | Review dei pari / ingegneri senior (informale) | Convenzione di fatto aziendale |
| RFC (Rust, PEP, IETF) | Proporre un cambiamento e raccogliere commenti fino al consenso | Sub-team (Rust), Steering Council (Python), IESG (IETF) | Processo proprio di un progetto/ente |
| ADR | Registrare *una* decisione architetturale e il suo perché, in modo immutabile | Autore + review; nessuna autorità centrale | Convenzione di fatto (format Nygard/MADR) |
| Template di architettura (arc42, C4, 4+1) | Descrivere l'architettura di un sistema | Nessuna approvazione formale | Convenzioni (42010 è invece standard) |
| PRD | Cosa deve fare il prodotto, dal punto di vista dell'utente | Product manager | Convenzione aziendale |
| TRD / Tech Spec / SDD | Come si costruisce: stack, architettura, interfacce, requisiti non funzionali | Engineering | Convenzione, nome non standardizzato |

Nota metodologica: il termine "design doc" e il termine "RFC" sono usati come quasi-sinonimi dalla survey di settore più citata — "RFCs - requests for comment - or Design Docs are a common tool that engineering teams use to build software faster" (https://blog.pragmaticengineer.com/rfcs-and-design-docs/). La stessa fonte separa i PRD dai documenti di ingegneria: "Product Requirement Documents (PRDs) are commonly run side by side with an engineering design document."

---

### 3.2 Design doc

**Fonte fondativa**: Malte Ubl, *Design Docs at Google*, **Published 06 Jul 2020** (https://www.industrialempathy.com/posts/design-docs-at-google/).

**Struttura — sezioni verbatim** elencate nell'articolo:
- `Context and scope`
- `Goals and non-goals`
- `The actual design` — al suo interno: `System-context-diagram`, `APIs`, `Data storage`, `Code and pseudo-code`, `Degree of constraint`
- `Alternatives considered`
- `Cross-cutting concerns`
- `The length of a design doc`

**Ciclo di vita (heading verbatim)**: `Creation and rapid iteration`, `Review`, `Implementation and iteration`, `Maintenance and learning`; più `When not to write a design doc`.

**Chi lo scrive**: "the primary author or authors of a software system or application … before they embark on the coding project", talvolta "together with a set of co-authors", di norma in Google Docs.

**Quando si scrive**: è l'ambiguità a innescarlo — "the solution to the design problem is ambiguous". L'articolo dà una checklist di cinque domande con la regola: "If you answer yes to 3 or more of these questions". Il valore sta in "benefits in organizational consensus around design, documentation, senior review, etc."

**Quando NON si scrive**: "Writing design docs is overhead." I doc che sono in realtà "implementation manuals" sono un segnale d'allarme (mancano trade-off e alternative); "the overhead of creating and reviewing a design doc may not be compatible with prototyping and rapid iteration".

**Review sì**: `Review` è il passo 2, "may be in multiple rounds", da una email leggera fino a "formal design review meetings in which the author presents the doc"; porta "the combined experience of the organization" quando i cambiamenti costano poco. Google richiede "a dedicated privacy design doc" per privacy e sicurezza.

**Lunghezza**: **non** compare un "10 pages" letterale. L'articolo dice "around 10-20ish pages" per i progetti grandi, e ammette una "mini design doc" di 1–3 pagine. L'articolo insiste che la forma è informale: "Rule #1 is: Write them in whatever form makes the most sense for the particular project."

**Pratica aziendale (Google / Amazon / Meta)**:
- **Google**: la struttura tipica (context/scope, goals and non-goals, design, diagrams, APIs, data storage, alternatives, cross-cutting concerns) è associata a Google, ma la survey precisa che Google non impone un template unico (https://blog.pragmaticengineer.com/rfcs-and-design-docs/).
- **Amazon**: "Engineering teams do design reviews on architecture with technical docs"; "Some orgs follow this process religiously". La pratica specifica di Amazon è il **narrative memo** — il "6-pager" e il **PR/FAQ** (Press Release + FAQ) della metodologia *Working Backwards* (per il PR/FAQ vedi §2.2). Origine del memo narrativo: Jeff Bezos vieta PowerPoint con un memo **9 giugno 2004** ("No powerpoint presentations from now on") e impone il memo narrativo di **4–6 pagine**. *[to verify: la struttura interna a 6 sezioni del 6-pager e i dettagli del PR/FAQ provengono da fonti secondarie — una guida di skill su GitHub e il podcast di Marcelo Calbucci — non da una fonte Amazon primaria.]*
- **Meta**: la survey la dichiara esplicitamente assente e osserva "Facebook is known to have the least emphasis on documentation across all of Big Tech". Fonti secondarie (deposizione legale, thread Blind, podcast) descrivono una cultura *code-first*: "we don't generate a lot of artifacts during the engineering process. Effectively the code is its own design document often." *[to verify: nessuna fonte primaria Meta; trattare come aneddotico.]*

---

### 3.3 RFC

**Rust** (https://rust-lang.github.io/rfcs/ — processo) e template `0000-template.md`. Metadata del template: `Feature Name`, `Start Date` (YYYY-MM-DD), `RFC PR`, `Rust Issue`. **Sezioni verbatim del template**:
`Summary`, `Motivation`, `Guide-level explanation`, `Reference-level explanation`, `Drawbacks`, `Rationale and alternatives`, `Prior art`, `Unresolved questions`, `Future possibilities`.

Meccanica di processo (verbatim):
- "Copy `0000-template.md` to `text/0000-my-feature.md`", poi "Submit a pull request".
- "A sub-team makes final decisions about RFCs after the benefits and drawbacks are well understood."
- **FCP**: "a member of the subteam will propose a 'motion for final comment period' (FCP)" con una "disposition" (merge, close, postpone); "Before actually entering FCP, all members of the subteam must sign off."; "The FCP lasts ten calendar days, so that it is open for at least 5 business days."
- Dopo l'accettazione: "Once accepted, RFCs should not be substantially changed. Only very minor changes should be submitted as amendments."

**Python (PEP 1)**: "PEP 1 – PEP Purpose and Guidelines", Process PEP, **Status: Active, created 13-Jun-2000** (https://peps.python.org/pep-0001/). **Sezioni verbatim** che un PEP dovrebbe contenere: `Preamble`, `Abstract`, `Motivation`, `Specification`, `Rationale`, `Backwards Compatibility`, `Security Implications`, `How to Teach This`, `Reference Implementation`, `Rejected Ideas`, `Open Issues`, `Acknowledgements`, `Footnotes`, `Change History`, `Copyright/license`. **Status possibili**: `Draft | Active | Accepted | Provisional | Deferred | Rejected | Withdrawn | Final | Superseded`. Autorità: "PEP editors don't pass judgment on PEPs"; "The final authority for PEP approval is the Steering Council". Esiste la figura del `PEP-Delegate` (in passato `BDFL-Delegate`, oggi "deprecated alias").

**IETF**: il processo è **BCP 9** = **RFC 2026**, aggiornato da **RFC 6410**; RFC 7127 ha aggiornato la caratterizzazione dei Proposed Standard. L'**IESG** approva le *standards actions*. Livelli di maturità: `Proposed Standard` e `Internet Standard` (RFC 6410 ha ridotto da tre a due livelli, eliminando `Draft Standard`); un documento deve restare Proposed Standard almeno **sei mesi** prima di avanzare; "Internet Standard" richiede almeno due implementazioni interoperabili indipendenti. Un Internet-Draft sta in review almeno due settimane. **Struttura del documento** secondo la guida di stile RFC 7322 (https://www.rfc-editor.org/rfc/rfc7322.html): front matter `Title`, `Abstract`, `Status of This Memo`, `Copyright Notice`, `Table of Contents`; corpo `Introduction` (obbligatoria), `Requirements Language` (per le parole chiave in stile RFC 2119), testo principale, `IANA Considerations`, `Internationalization Considerations`, `Security Considerations` (obbligatoria), `References` divise in `Normative References` e `Informative References`; back matter `Appendices`, `Acknowledgements`, `Contributors`, `Author's Address` / `Authors' Addresses`. *[to verify: l'elenco esatto delle parole chiave di RFC 2119 (MUST, SHOULD, MAY, …) non è stato letto verbatim; la pagina RFC 7322 conferma solo l'esistenza della sezione "Requirements Language" per le "RFC 2119-style capitalized keywords".]*

---

### 3.4 ADR (Architecture Decision Record)

**Articolo fondativo**: Michael Nygard, *Documenting Architecture Decisions*, **15 November 2011** (https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

**Formato — sezioni verbatim**: `Title`, `Context`, `Decision`, `Status`, `Consequences`. Ogni record copre una sola scelta: "An architecture decision record is … a set of forces and a single decision in response to those forces." Si registrano solo le decisioni "architecturally significant"; le conseguenze vanno elencate tutte, non solo quelle favorevoli; "The consequences of one ADR are very likely to become the context for subsequent ADRs."

**Deposito e forma**: "We will keep ADRs in the project repository under `doc/arch/adr-NNN.md`"; "We should use a lightweight text formatting language like Markdown or Textile"; "The whole document should be one or two pages long." La decisione stessa è descritta come "a short text file in a format similar to an Alexandrian pattern."

**Immutabilità e numerazione**: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." Sui ribaltamenti: "If a decision is reversed, we will keep the old one around, but mark it as superseded." Status citati: `proposed`, `accepted`, `deprecated`, `superseded` (con rimando al record che sostituisce).

**adr.github.io** (https://adr.github.io/): definisce una *Architectural Decision* come "a justified design choice that addresses a functional or non-functional requirement" di rilievo architetturale; un'ASR (*Architecturally Significant Requirement*) come requisito con effetto misurabile sull'architettura e sulla qualità; un ADR "captures a single AD and its rationale"; l'insieme dei record di un progetto è il suo **decision log**. L'uso si estende oltre l'architettura: "ADR usage can be extended to design and other decisions".

**Varianti (pagina templates, https://adr.github.io/adr-templates/)**:
- **MADR** (*Markdown Architectural Decision Records*): versione corrente **MADR 4.0.0**, rilasciata **2024-09-17** (beta 2024-09-02); licenza "MIT OR CC0-1.0". **Sezioni verbatim**: `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Decision Outcome`, `Consequences`, `Confirmation`, `Pros and Cons of the Options`, `More Information`. Ha forme "full" e "minimal", annotate e bare (https://adr.github.io/madr/). *[to verify: la pagina MADR non nomina né confronta il formato di Nygard, quindi la differenza rispetto a Nygard non è confermabile da questa fonte; il nome è stato anche "Markdown Any Decision Records".]*
- **Nygard ADR**: "title, status, context, decision, and consequences".
- **Y-Statement**: forma breve, "In the context of `<use case/user story>`, facing `<concern>` we decided for `<option>`…"; forma lunga con opzioni trascurate, un "because" e la rationale.
- **Altri template**: "Numerous other ADR formats", tra cui il template **ISO/IEC/IEEE 42010:2011**, che "suggests nine information items for ADRs its Appendix A".

*[to verify: le varianti Tyree/Akerman, planguage e arc42 non compaiono nelle pagine adr.github.io lette, pur essendo spesso citate altrove.]*

---

### 3.5 Template di architettura

**arc42** (https://arc42.org/overview) — **12 sezioni, verbatim, nell'ordine**:
`Introduction & Goals` — `Constraints` — `Context & Scope` — `Solution Strategy` — `Building Block View` — `Runtime View` — `Deployment View` — `Crosscutting Concepts` — `Architectural Decisions` — `Quality Requirements` — `Risks & Technical Debt` — `Glossary`.
Creato da **Peter Hruschka & Gernot Starke**; licenza "CC BY-SA 4.0", "Open source and free, also for commercial use"; "Proven in practice since 2005"; copyright 2003–2026. Nessun numero di versione né data di pubblicazione forniti dalla pagina.

**C4 model** (https://c4model.com/) — creato da **Simon Brown**; il sito è "the official website for the 'C4 model for visualising software architecture'". **Quattro diagrammi core**: `1. System context diagram`, `2. Container diagram`, `3. Component diagram`, `4. Code diagram`, con le astrazioni gerarchiche `software systems`, `containers`, `components`, `code`. Diagrammi supplementari: "system landscape, dynamic, and deployment". Il modello si dichiara "Notation independent" e "Tooling independent"; contenuti sotto "Creative Commons Attribution 4.0 International License".
- **System context**: scope "A single software system"; il sistema è "a box in the centre, surrounded by its users and the other systems that it interacts with"; audience "Everybody, both technical and non-technical people"; raccomandato **sì**.
- **Container**: un container è "an application or a data store" (server-side web app, SPA, desktop/mobile app, "a database schema, a folder on a file system", "an Amazon Web Services S3 bucket"); il diagramma "shows the high-level shape of the software architecture and how responsibilities are distributed" ed è "a simple, high-level technology focussed diagram"; audience "Technical people inside and outside the software development team"; raccomandato **sì**.
- **Component**: scope "A single container"; decomponi il container nei componenti e ne documenti "their responsibilities and the technology/implementation details"; audience "Software architects and developers"; raccomandato **No** ("only create component diagrams if you feel they add value").
- **Code**: scope "A single component"; mostra gli elementi interni "using UML class diagrams, entity relationship diagrams or similar"; "very much an optional level of detail"; raccomandato **No**.

**4+1 Architectural View Model** — P. B. Kruchten, ***Architectural Blueprints—The "4+1" View Model of Software Architecture*** (IEEE ne usa il titolo abbreviato *The 4+1 View Model of Architecture*), **IEEE Software, vol. 12, no. 6, pp. 42–50, Nov. 1995**, DOI 10.1109/52.469759. **Quattro viste**: `Logical View` (modello a oggetti, requisiti funzionali), `Process View` (concorrenza e sincronizzazione, requisiti non funzionali come performance e scalabilità), `Development View` (organizzazione statica dei moduli), `Physical View` (mappatura del software sull'hardware, distribuzione); più il quinto, `Scenarios` (o use-case view), che lega le altre quattro — è il "+1" perché è ridondante rispetto alle quattro. Le viste sono ritagliabili, la view di scenari generalmente no.

**ISO/IEC/IEEE 42010:2011** — lo **standard formale** dell'architecture description (a differenza di arc42 e C4): sede canonica, date, stato e contenuto al §1.3. Qui rileva solo per contrasto con le convenzioni di fatto che seguono.

---

### 3.6 TRD (Technical Requirements Document) vs PRD

**PRD** (Product Requirements Document) — trattazione canonica al §2.1; qui se ne riprende solo il verso per il contrasto: scritto dal punto di vista dell'utente per capire **cosa** deve fare il prodotto, "normally prepared by the product manager". Sezioni tipiche: obiettivi del prodotto, feature, UX flow e design notes, requisiti di sistema e ambiente, assunzioni/vincoli/dipendenze, requisiti non funzionali (affidabilità, sicurezza, scalabilità).

**TRD** (Technical Requirements Document): riguarda i requisiti **software, hardware e di piattaforma** del prodotto (es. linguaggio di programmazione, velocità del processore); "written by the engineering team" ed è la base su cui il team implementa. Sezioni tipiche: executive summary e contesto, assunzioni/rischi, requisiti funzionali e non funzionali, riferimenti; più — secondo un'altra fonte — elenco di funzioni e algoritmi, requisiti di interfaccia, requisiti di architettura di sistema, metodologia di sviluppo, **technological stack** (quali tecnologie e perché).

Formula sintetica (AWS sample patterns): "Product (PRD) — what the product does for its users; Software (SRS / FRD / TRD) — what it must do exactly, and under what constraints." Talvolta il TRD è chiamato anche *Functional Specification* (a valle dell'analisi del PRD). *[to verify: queste definizioni provengono da fonti secondarie/blog e linee guida aziendali — karokasb.org (PDF "9 Types Of Requirements Documents"), Brainscape, AWS Innovation Patterns — non da uno standard.]* Attenzione agli omonimi: in ambito fisico/istituzionale PRD = *Physics/Project Requirements Document*, TRS = *Technical Requirements Specifications* (Fermi, NOAA/STAR), contesti diversi dal PRD di prodotto.

---

### 3.7 System Design Document / Technical Specification

La differenza è di **livello di astrazione**: il design document dà una visione ampia e di alto livello, la technical specification scende nei dettagli implementativi.
- **System/Software Design Document** (astratto): obiettivi e requisiti (funzionali e non funzionali), struttura statica (componenti, interfacce, dipendenze), comportamento dinamico (come i componenti interagiscono), modelli dati/interfacce esterne, considerazioni di deployment. Scopo: dare "a broad general understanding of the system or component".
- **Technical Specification** (dettagliato): "describes the minute detail of either all or specific parts of a design" — firma di un'interfaccia con tutti i tipi di dato (input, output, eccezioni), modelli di classe completi (metodi, attributi, dipendenze, associazioni), gli algoritmi specifici di un componente, i modelli dati fisici con attributi e tipi. È scritta prima dello sviluppo, di norma a valle della SRS (System Requirements Specification).

Nota importante: la terminologia **non è standardizzata** e le fonti si contraddicono persino sull'ordine di astrazione (una fonte inverte SDD e tech spec). Un commento esplicito: "these terms are not standardized", quindi il contenuto varia per team e contesto (https://softwareengineering.stackexchange.com/questions/179554/what-is-the-difference-between-technical-specifications-and-design-documents). In contesti governativi/enterprise, il "system design document" copre anche hardware e topologia di rete, e i deliverable tecnici includono Data Dictionary, Interface Control Design, Low-level Technical Design (architettura tecnica, componenti software, ambienti, deployment, logging, monitoring, security). *[to verify: fonti secondarie — StackExchange, RISA guidelines, NY ITS/Deloitte, Ones.com.]*

---

### 3.8 Convenzione di fatto vs standard formale

- **Standard formali**: ISO/IEC/IEEE 42010:2011 (architecture description, §1.3); il processo IETF (BCP 9 = RFC 2026 + RFC 6410) con la struttura documentale di RFC 7322; storicamente IEEE 1471-2000 (assorbito nel 42010).
- **Convenzioni di fatto** (nessuna approvazione formale, adozione per diffusione):
  - *Design doc* di Google — esplicitamente informale: "Rule #1 is: Write them in whatever form makes the most sense for the particular project."
  - *Formato ADR di Nygard* (2011) e *MADR* — format pubblicati come blog/template, non standard.
  - *C4 model* e *arc42* — presentati come "approach"/"template", non come norme; il sito C4 non rivendica lo status di standard.
  - *6-pager / PR-FAQ* di Amazon, *PEP* (processo interno Python, governato dallo Steering Council), *RFC di Rust* (processo interno del progetto, deciso dai sub-team) — processi proprietari o di progetto, non standard di un ente di normazione.
  - *TRD / PRD / SDD / Tech Spec* — interamente convenzionali: "these terms are not standardized".

**Fonti**: https://www.industrialempathy.com/posts/design-docs-at-google/ · https://peps.python.org/pep-0001/ · https://rust-lang.github.io/rfcs/ · https://raw.githubusercontent.com/rust-lang/rfcs/master/0000-template.md · https://www.rfc-editor.org/rfc/rfc7322.html · https://www.ietf.org/process/ · https://datatracker.ietf.org/doc/draft-ietf-procon-2026bis/ · https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions · https://adr.github.io/ · https://adr.github.io/adr-templates/ · https://adr.github.io/madr/ · https://arc42.org/overview · https://c4model.com/ · https://c4model.com/diagrams/system-context · https://c4model.com/diagrams/container · https://c4model.com/diagrams/component · https://c4model.com/diagrams/code · https://ieeexplore.ieee.org/document/469759 · http://www.iso-architecture.org/42010/ · https://blog.pragmaticengineer.com/rfcs-and-design-docs/ · https://karokasb.org/wp-content/uploads/2020/05/9-Types-Of-Requirements-Documents_-What-They-Mean-And-Who-Writes-Them.pdf · https://aws-samples.github.io/sample-innovation-patterns/developer-docs/solution-design/template/requirements/ · https://softwareengineering.stackexchange.com/questions/179554/what-is-the-difference-between-technical-specifications-and-design-documents · https://guidelines.risa.gov.rw/books/software-technical-documentation-guidelines/chapter/product-documentation/export/pdf · https://ur.its.ny.gov/system/files/documents/2023/06/c000657_ies_tier-ii_lot-3_deloitte_technical-proposal_sec-d_part2_0.pdf · https://ones.com/blog/downloadable-software-design-document-sample-pdf-quick-ref/

---

## 4. UX/UI — flussi, wireframe, user story, design system

### 4.1 Distinzione portante: artefatto di design vs requisito
- **Artefatto di design** = rappresentazione visiva/strutturale di una soluzione già immaginata: flusso, wireframe, mockup, prototipo, journey map, sitemap, design system. Documenta *come* apparirà e funzionerà il prodotto.
- **Requisito** = enunciazione di ciò che il prodotto deve fare e di quando è accettabile: user story, acceptance criteria, definition of ready/done. Documenta *cosa* serve e *quando è finito*, prima e indipendentemente da come verrà disegnato.
- Ponte tra i due: la **user story mapping** (Patton) è un artefatto *di requisito* disposto nello spazio (una mappa), non un artefatto visivo di design.

---

### 4.2 Flussi

**User journey vs user flow — definizioni NN/g (verbatim)**
- *User journey*: "a scenario-based sequence of the steps that a user takes" verso "a high-level goal with a company or product", di norma "usually across channels and over time".
- *User flow*: "a set of interactions that describe the typical or ideal set of steps" che sono "needed to accomplish a common task performed with a product".
- Riga di distinzione: "User journeys describe a user's holistic, high-level experience across channels and over time."; "User flows zoom in to describe a set of specific, discrete interactions".
- La user flow "can be represented with artifacts such as low-fidelity wireflows, simple flow charts, or task diagrams" — artefatti che "capture key user steps and system responses" e "do not contextualize the process with emotions and thoughts" (a differenza di una journey map).
Fonte: https://www.nngroup.com/articles/user-journeys-vs-user-flows/

**Wireflow — definizione NN/g (verbatim)**
Un wireflow è "a design-specification format" che unisce "wireframe-style page layout designs" con "a simplified flowchart-like way of representing interactions". NN/g lo ritiene adatto a "representing dynamic changes on one or few pages inside an app"; i wireframe da soli "don't capture well the various layout possibilities"; i flowchart puri "lose sight of the information that's shown contextually on the page".
Fonte: https://www.nngroup.com/articles/wireflows/

**Task flow, app flow, screen flow — non definiti da NN/g (fonti secondarie)**
- *Task flow*: "a diagram showing a linear sequence of steps a user takes to complete a specific task", in linguaggio naturale, senza design visivo, di norma senza diramazioni. Fonte: https://uxcel.com/lessons/what-are-wireflows-804
- *App / application flow*: mapa che mostra dove gli utenti entrano nel prodotto e come procedono verso un obiettivo; Microsoft SketchFlow descrive l'application flow come mappa interattiva composta da un numero qualsiasi di *screen*. Fonti: https://pageflows.com/resources/app-user-flow/ , https://learn.microsoft.com/en-us/previous-versions/visualstudio/design-tools/expression-studio-4/ee341405%28v%3dexpression.40%29
- *Screen flow*: sinonimo di **wireflow**, "the representation of screen flow", wireframe ordinati secondo il percorso con forme decisionali per i bivi. Fonte: https://circle.visual-paradigm.com/docs/user-experience-design/wireflow/what-is-a-wireflow/
- Simbologia tipica di un app flow diagram: rectangles = una pagina/interfaccia; arrows = progressione; circles = azione dell'utente; diamonds = decisione con diramazioni. Fonte: https://pageflows.com/resources/app-user-flow/
- `[to verify]` Non ho trovato una pagina primaria autorevole (NN/g o W3C) che definisca "app flow" come termine distinto da user flow: le definizioni sopra vengono da fornitori/vendor.

---

### 4.3 Mappe

**Journey map — definizione NN/g (verbatim)**
"A journey map is a visualization of the process that a person goes through in order to accomplish a goal." Cinque componenti elencati nella sezione "Key Components of a Journey Map": "Actor", "Scenario + Expectations", "Journey Phases", "Actions, Mindsets, and Emotions", "Opportunities". I termini "user journey map" e "customer journey map" sono usati in modo intercambiabile.
Fonti: https://www.nngroup.com/articles/journey-mapping-101/ , https://www.nngroup.com/videos/journey-mapping-101/

**Service blueprint — definizione NN/g (verbatim)**
"a diagram that visualizes the relationships between different service components — people, props (physical or digital evidence), and processes — that are directly tied to touchpoints in a specific customer journey." Elementi: **Customer actions** ("Steps, choices, activities, and interactions that customers perform"); **Frontstage actions** ("Actions that occur directly in view of the customer"); **Backstage actions** ("Steps and activities that occur behind the scenes to support onstage happenings"); **Processes** ("Internal steps, and interactions that support the employees in delivering the service"). Tre linee: *line of interaction*, *line of visibility* ("separates all service activities that are visible to the customer from those that are not visible"), *line of internal interaction*. Rapporto con la journey map: "Think of service blueprints as a part two to customer journey maps."
Fonti: https://www.nngroup.com/articles/service-blueprints-definition/ , https://www.nngroup.com/articles/service-blueprinting-faq/

**Information architecture e sitemap — definizioni NN/g (verbatim)**
- Sitemap: "A sitemap is a visual representation of the organization of your site's content."
- IA (due significati): "The practice of deciding how to organize and maintain your content" (con "what the relationships are between each piece of content" e "how content is visibly displayed on your website's navigation"); e "The website's structure, its organization, and the nomenclature of its navigation elements".
- Regola: "The IA comes first, the sitemap follows." La sitemap è *uno solo* dei deliverable della IA.
- Tabella IA attività/deliverable (verbatim): *Content inventory* → "A (digital) catalog or table"; *Content audit* → "A table with all your content and whether you are keeping it, removing it, or planning to update it"; *Taxonomy development* → "A hierarchical structure…"; *IA UX research (card sorting, tree testing, usability testing)* → "Research reports…"; *Planning the website structure* → "Sitemap".
Fonte: https://www.nngroup.com/articles/information-architecture-sitemaps/
- `[to verify]` I "quattro sistemi" della IA (organization, labeling, navigation, search) sono attribuiti a Rosenfeld & Morville/Usability.gov, non confermati da una pagina NN/g letta in questa raccolta.

---

### 4.4 Fedeltà crescente del disegno

**Fidelity — definizione NN/g (verbatim, dall'articolo sui prototipi)**
"The _fidelity_ of the prototype refers to _how closely it matches_ the look-and-feel of the final system." La fedeltà varia lungo **tre dimensioni indipendenti**, e un prototipo "may have high or low fidelity in all or some of the above 3 areas":
1. "Interactivity" — alta: "Yes: Many or all are clickable."; bassa: "No: Targets do not work."
2. "Visuals" — alta: "look like a live system would look"; bassa: "Only some or none of the visual attributes of the final live system are captured" (es. sketch o wireframe).
3. "Content and commands" — alta: "includes all the content that would appear in the final design."; bassa: "includes only a summary of the content or a stand-in for product images."
Fonte: https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/

**Wireframe (NN/g)**
NN/g: i wireframe sono "visualizations of a user path or flow, as well as page layouts, information hierarchy, and even interactions", e "can vary in fidelity — from quick sketches to detailed representations of the final design"; per quelli a bassa fedeltà "messy is completely fine and expected".
Fonte: https://www.nngroup.com/articles/draw-wireframe-even-if-you-cant-draw/
- `[to verify]` La definizione attribuita a NN/g "a document showing page-level design and layout ideas, used mainly for products made of several distinct pages" e "a wireframe answers questions of structure, not of style" compare in sintesi di ricerca ma non l'ho verificata su pagina primaria.

**Mockup (fonte secondaria)**
`[to verify]` Non esiste, per quanto trovato, un articolo NN/g intitolato alla definizione di "mockup". Fonti terze che citano NN/g lo definiscono "a static yet realistic rendering" / "a static but visually complete design" — un wireframe con colori, font, immagini e branding, non interattivo, parte di un high-fidelity prototype.
Fonti: https://redeagle.tech/eaglepedia/wireframes-mockups-and-prototypes

**Prototipo e sequenza**
Il prototipo spazia da sketch/wireframe (bassa fedeltà) a design finiti, interattivi e cliccabili (alta fedeltà). La sequenza canonica dei materiali è **sketch → wireframe (low-fi) → mockup (hi-fi, statico) → prototype (cliccabile)**, con la fedeltà da scegliere in funzione della decisione da prendere, non dell'estetica.
Fonte: https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/
- `[to verify]` La definizione puntuale di "sketch" non è stata letta su una pagina NN/g in questa raccolta.

---

### 4.5 Requisiti dal lato utente

**User story — Mike Cohn / Mountain Goat Software (verbatim)**
- Definizione: "a short description of desired functionality told from the perspective of someone who wants or needs that functionality".
- Formato: "As a [type of user], I [need/want/am required] to [do something], so that [reason or benefit]."
- Esempio: "As a conference attendee, I need to filter sessions by topic so that I can quickly find the sessions most relevant to me."
- Natura: "A user story represents a requirement, but the written sentence is rarely the whole requirement." Modello *card, conversation, and confirmation*, dove la confirmation è "how the team knows the story is complete".
Fonte: https://www.mountaingoatsoftware.com/agile/user-stories

**Acceptance criteria (verbatim, stessa fonte)**
"Acceptance criteria are details that help the team understand whether a story has been completed correctly." Possono "take the form of examples, rules, tests, or brief notes"; lo scopo è che "the team knows what must be true for the story to be considered complete". `[to verify]` La formula "conditions of satisfaction" (3–5 per Cohn) non compare nella pagina letta: va confermata su altra fonte.

**Gherkin / Given-When-Then — Cucumber (verbatim)**
- `Given`: "describe the initial context of the system - the _scene_ of the scenario."; scopo: "put the system in a known state".
- `When`: "describe an event, or an _action_."
- `Then`: "describe an _expected_ outcome, or result." (la step definition "should use an _assertion_").
- `Scenario`: "a _concrete example_ that _illustrates_ a business rule. It consists of a list of steps."; "The keyword `Scenario` is a synonym of the keyword `Example`." Struttura in tre parti: "Describe an initial context (`Given` steps)", "Describe an event (`When` steps)", "Describe an expected outcome (`Then` steps)"; 3–5 step consigliati.
Fonte: https://cucumber.io/docs/gherkin/reference/

**Definition of Done / Definition of Ready — Scrum.org**
| | Definition of Ready (DoR) | Definition of Done (DoD) |
|---|---|---|
| In Scrum | Non citata (pratica complementare) | Parte ufficiale; commitment per l'Increment |
| Momento | Prima di iniziare il lavoro | Dopo aver completato il lavoro |
| Scopo | Item preparato/pronto a partire | Rispetta gli standard di qualità |
| Natura | Accordo per ridurre attrito | Commitment per garantire trasparenza |

Il DoD è "the commitment for the Increment"; il DoR è un "agreed-upon set of criteria that a Product Backlog item must meet before it is considered ready" e può includere "designs/mockups completed". Attenzione segnalata: il DoR "can lead to harmful behaviours such as gatekeeping".
Fonte: https://www.scrum.org/resources/blog/what-difference-between-definition-done-dod-and-definition-ready-dor

**User story mapping — Jeff Patton (verbatim, dal suo sito)**
- Il metodo è "Arranging user stories into a helpful shape – a map has worked well for me."
- **Backbone**: la riga alta di storie grandi, che Patton chiama "user activities"; "I refer to them as the "backbone" of the software." (termine attribuito a Dr. Dan Rawsthorne).
- **Walking skeleton**: "the smallest possible system you could build that would give you end to end functionality" — "This is what Alistair Cockburn refers to as the "walking skeleton"" (da costruire per primo).
- Mapping delle righe/slice: "user activities" (livello backbone) → "user tasks" (es. send, read, delete) → le card appese sono le "ribs"; le righe per il planning sono "swim lanes" (una per release). Ordine di lettura: da sinistra a destra, poi dall'alto in basso.
Fonte: https://www.jpattonassociates.com/the-new-backlog/

---

### 4.6 Sistema di design

**Design system — NN/g (verbatim)**
"A design system is a complete set of standards intended to manage design at scale using reusable components and patterns." Si compone di due parti: un **design repository** e **le persone** che lo mantengono. NN/g lo chiama anche "'pattern libraries' or 'component libraries'".
- **Style guide**: "guidelines, visual references, and design principles for creating interfaces or other design deliverables."
- **Component library** (detta anche design library): ospita "predetermined, reusable UI elements" ed è "a one-stop shop for designers and developers alike to learn about and implement specific UI elements"; contenuti elencati: "Component name", "Description", "Attributes", "State", "Code snippets", "Front-end & backend frameworks".
- **Pattern library**: "collections of UI-element groupings or layouts".
Fonte: https://www.nngroup.com/articles/design-systems-101/

**Atomic Design — Brad Frost (verbatim)**
Metodologia per creare design system basata sulla chimica: "all matter is comprised of atoms", gli atomi "bond together to form molecules", che "combine into more complex organisms". I cinque livelli:
1. **Atoms** — "the basic building blocks of matter" (label, input, button; palette colori, font, animazioni).
2. **Molecules** — "groups of atoms bonded together and are the smallest fundamental units of a compound"; "serve as the backbone of our design systems".
3. **Organisms** — "groups of molecules joined together to form a relatively complex, distinct section of an interface" (masthead, product grid).
4. **Templates** — "groups of organisms stitched together to form pages" (qui entra il layout).
5. **Pages** — "specific instances of templates", con contenuto reale; "the highest level of fidelity".
Fonte: https://bradfrost.com/blog/post/atomic-web-design/

---

### 4.7 Accessibilità e contenuto

**WCAG — W3C (verbatim)**
- Nome esteso: "Web Content Accessibility Guidelines (WCAG) 2.2".
- Quattro principi: "perceivable, operable, understandable, and robust" (POUR). Es. Principle 1: "Information and user interface components must be presentable to users in ways they can perceive."
- Livelli: "three levels of conformance are defined: A (lowest), AA, and AAA (highest)."
- Requisiti (verbatim): "For Level A conformance (the minimum level of conformance), the web page" deve soddisfare "all the Level A success criteria, or a conforming alternate version is provided."; "For Level AA conformance, the web page satisfies all the Level A and Level AA success criteria…"; "For Level AAA conformance, the web page satisfies all the Level A, Level AA and Level AAA success criteria…".
- Termine chiave: *satisfies a success criterion* = "the success criterion does not evaluate to 'false' when applied to the page."
Fonti: https://www.w3.org/TR/WCAG22/ , https://www.w3.org/WAI/WCAG22/Understanding/conformance
- `[to verify]` Il fatto che AA sia "the standard/expected level" per la conformità legale (ADA/EAA/Section 508) appare solo in fonti secondarie in questa raccolta, non in pagina W3C letta.

**UX writing, content design, content strategy — NN/g (verbatim)**
- **UX writing**: "UX writing involves creating clear, concise, and contextually appropriate copy that guides people through an experience."
- **Content design**: "Content design is closely related to UX writing" e "involves structuring, formatting, and presenting content in a visually appealing, accessible, and easy-to-navigate way." I content designer prendono in carico information architecture, wireframing/prototyping e la struttura del messaggio.
- **Content strategy**: "Content strategy involves setting up an intentional plan, practice, and process to reach specific goals with content."
Fonte: https://www.nngroup.com/articles/content-strategy-vs-ux-writing/

---

### 4.8 Strumenti e in quale fase

**Carta e penna / sketching (fase iniziale)**
NN/g: i wireframe possono partire da "quick sketches"; per il low-fi "messy is completely fine and expected", con vincoli fisici (pennarelli spessi, time boxing, spazio limitato) per non fissarsi sui dettagli estetici. La logica di costo: "ripping up code is very expensive, ripping up a prototype is not, especially if it is just a piece of paper".
Fonte: https://www.nngroup.com/articles/draw-wireframe-even-if-you-cant-draw/
- `[to verify]` L'articolo NN/g "Paper prototyping: Getting User Data Before You Code" è citato dalle ricerche ma non l'ho letto: la citazione del "pezzo di carta" va confermata lì.

**Figma (fase mockup → prototipo)**
- Wireframe: *frames* (una per schermata), rettangoli, text layer, Auto Layout, grid.
- Mockup: colore, tipografia, icone, componenti riusabili, design system/stili aggiornabili globalmente.
- Prototipo: hotspot interattivi, trigger (On click, On drag, While hovering…), azioni (Navigate to, Change to, Open/close overlay, Back, Scroll to), transizioni e "Smart animate", logica condizionale, anteprima su device.
- Distinzione di fedeltà: wireframe = low-fi strutturale; mockup = hi-fi statico; prototype = simulazione interattiva cliccabile.
Fonti: https://www.figma.com/resource-library/high-fidelity-prototyping/ , https://help.figma.com/hc/en-us/articles/13666942319127
- `[to verify]` Dettagli di nomi (trigger/azioni) provengono da materiale Figma/terze parti: da confermare sulla pagina ufficiale Figma Help corrispondente.

---

### 4.9 Quadro sintetico artefatto vs requisito
| Elemento | Categoria | Fase tipica | Forma |
|---|---|---|---|
| User journey / journey map | Artefatto design (mappa) | Ricerca / pre-design | Timeline narrativa + emozioni |
| User flow / task flow / wireflow | Artefatto design (flusso) | Pre-design / struttura | Diagramma di passi e schermate |
| Service blueprint | Artefatto design (mappa) | Service design | Frontstage/backstage + processi |
| Sitemap / IA | Artefatto design (struttura) | Architettura informazione | Albero di contenuti |
| Sketch / wireframe / mockup / prototype | Artefatto design | Fedeltà crescente | Disegno statico → cliccabile |
| Style guide / pattern library / design system | Artefatto design (sistema) | Trasversale | Componenti + standard |
| User story | Requisito | Backlog | "As a…, I want…, so that…" |
| Acceptance criteria / Gherkin | Requisito (verifica) | Backlog / test | Given–When–Then |
| Definition of Ready / Done | Requisito (processo) | Prima / dopo il lavoro | Checklist |
| User story map | Requisito (organizzato) | Backlog / release | Backbone + walking skeleton |

Fonti: https://www.nngroup.com/articles/journey-mapping-101/ — https://www.nngroup.com/articles/service-blueprints-definition/ — https://www.nngroup.com/articles/user-journeys-vs-user-flows/ — https://www.nngroup.com/articles/wireflows/ — https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/ — https://www.nngroup.com/articles/draw-wireframe-even-if-you-cant-draw/ — https://www.nngroup.com/articles/information-architecture-sitemaps/ — https://www.nngroup.com/articles/design-systems-101/ — https://www.nngroup.com/articles/content-strategy-vs-ux-writing/ — https://bradfrost.com/blog/post/atomic-web-design/ — https://www.mountaingoatsoftware.com/agile/user-stories — https://cucumber.io/docs/gherkin/reference/ — https://www.scrum.org/resources/blog/what-difference-between-definition-done-dod-and-definition-ready-dor — https://www.jpattonassociates.com/the-new-backlog/ — https://www.w3.org/TR/WCAG22/ — https://www.w3.org/WAI/WCAG22/Understanding/conformance — https://www.figma.com/resource-library/high-fidelity-prototyping/ — https://pageflows.com/resources/app-user-flow/ — https://circle.visual-paradigm.com/docs/user-experience-design/wireflow/what-is-a-wireflow/ — https://uxcel.com/lessons/what-are-wireflows-804

---

## 5. Schema dati e contratto delle API

### 5.1 Modello dati: ERD e livelli

**Origine — Chen (1976).** Il modello entity-relationship nasce dal paper di **Peter Pin-Shan Chen**, *"The Entity-Relationship Model—Toward a Unified View of Data,"* pubblicato su **ACM Transactions on Database Systems (TODS), Vol. 1, No. 1, March 1976, pp. 9–36** (DOI 10.1145/320434.320440). Chen era al Center for Information Systems Research, Sloan School of Management, MIT; una versione era stata presentata alla VLDB Conference (Framingham, Mass., 22–24 settembre 1975). Il paper introduce una "special diagrammatic technique" per il database design e usa il modello ER per unificare le viste di dati di network model, relational model ed entity set model. La notazione di Chen rappresenta entità come rettangoli, relazioni come rombi e attributi come ovali. *(Una fonte secondaria — Wiley Encyclopedia — data il modello ER al 1977; la data canonica ACM è 1976: la discrepanza è nella storia editoriale, non nel contenuto.)* [https://dl.acm.org/doi/abs/10.1145/320434.320440]

**Crow's foot.** La notazione trae origine da **Gordon Everest, 1976**, nel paper *"Basic Data Structure Models Explained with a Common Example"*, Proceedings of the **Fifth Texas Conference on Computing Systems (IEEE)**, Austin, TX, **18–19 ottobre 1976**, pp. 39–46. Everest chiamò originariamente il simbolo **"inverted arrow"**, per distinguerlo dalla notazione di Bachman, "visually intuitive, showing manyness"; altri lo ribattezzarono "chicken feet" e Everest ora preferisce **"FORK"**. La notazione è detta anche **IE notation** (Information Engineering). Il nome deriva dal simbolo a tre punte ("crow's foot") che indica il lato "many". *(Una fonte — un confronto di notazioni basato su un testo Cengage — attribuisce invece la crow's foot a C. W. Bachman, "made popular by the Knowledgeware modeling tool": attribuzione divergente, `[to verify]`.)* [https://www.red-gate.com/blog/crow-s-foot-notation/]

**I tre livelli del data model.** Le fonti li descrivono come una progressione top-down con tracciabilità:

| Livello | Cosa contiene | Chi lo legge |
|---|---|---|
| **Conceptual** | Entità maggiori e relazioni tra esse, **senza attributi né primary key**; ammette relazioni many-to-many; è il solo a supportare la **generalization** | Stakeholder di business, executive |
| **Logical** | Attributed completo, **primary key e foreign key**, risoluzione delle many-to-many, normalizzazione (tipicamente 3NF), domini e range validi; **indipendente dal DBMS** | Architect, systems analyst |
| **Physical** | Blueprint su uno **specifico DBMS**: index, partizioni, block size, constraint, linking table, cluster; struttura spesso de-normalizzata per performance | Developer, DBA |

La trasformazione logical → physical "traces directly from the logical one, introducing **no new semantics**". Storicamente la struttura è nota anche come "Three Schema" model. [https://circle.visual-paradigm.com/docs/database-design-engineering/database-designers-guide/conceptual-logical-and-physical-data-model/]

**Data model vs schema fisico.** Un data model (conceptual o logical) è **indipendente dal prodotto DBMS**; lo schema fisico è la sua istanziazione su un DBMS con tipi dati nativi, indici e artefatti di storage. Nel ciclo SDLC le fonti collocano la review di ERD e logical model **prima** che si generi qualunque definizione fisica: "The E-R diagram and logical model review must pass before any physical table definitions are generated" e "feedback at the design phase is critical before any code is written". [https://www2.gov.bc.ca/assets/gov/british-columbians-our-governments/services-policies-for-government/information-technology/standards/natural-resource-sector/sdlc/standards/nrs_developers_working_in_a_corporate_versioned_repository.pdf]

### 5.2 Formati di schema depositabili in repository

**DBML (Database Markup Language).** Si descrive come "open-source DSL designed to define and document database schemas and structures", "simple, consistent and highly-readable". "**DBML is declarative**" (contro il DDL, descritto come imperativo) e "**DBML is database-agnostic**", "designed for the high-level database architecting instead of low-level database creation". Creato e mantenuto da **Holistics**; nasce da **dbdiagram.io** intorno ad **agosto 2018** (dopo un anno: 100k diagrammi, 60k utenti; a febbraio 2025: 2.5M DBML docs, 1.4M utenti). Strumenti: dbdiagram.io (visualizer), dbdocs.io (documentation builder), runsql.com, una **CLI** per convertire SQL ↔ DBML, una **JS library** (NPM) e parser/generator della community. [https://dbml.dbdiagram.io/home/]

Sintassi (verbatim): tabella `Table table_name { ... }` o `Table schema_name.table_name { ... }` ("If omitted, `schema_name` will default to `public`"); colonne con tipo e setting in parentesi quadre. Setting: **primary key (`pk`)**, null/not null ("If you omit this setting, the column will be null by default"), unique, `default: some_value`, `increment`. Relazioni `Ref` in long/short/inline form, con operatori di cardinalità:

| Operatore | Significato |
|---|---|
| `<` | one-to-many |
| `>` | many-to-one |
| `-` | one-to-one |
| `<>` | many-to-many |

Il suffisso `?` rende un lato opzionale. Azioni referenziali con `delete`/`update` (cascade, restrict, set null, set default, no action). [https://dbml.dbdiagram.io/docs/]

**SQL DDL (`CREATE TABLE`).** Forma generale: `CREATE TABLE TableName ( attribute-declarations constraint-declarations )`. Primary key come **column constraint** se la chiave è un solo attributo (`EmployeeID int PRIMARY KEY`), altrimenti come **table constraint** (`PRIMARY KEY (OrderID, ProductID)`); la primary key non ammette NULL. Foreign key inline con `REFERENCES` (`SalesPersonID int NULL REFERENCES SalesPerson(SalesPersonID)`) o esplicita (`FOREIGN KEY (SalesPersonID) REFERENCES SalesPerson(SalesPersonID)`); multi-colonna come table constraint. Prima di definire una foreign key la colonna referenziata dev'essere primary key o unique key. Opzioni di integrità referenziale: `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT` su `ON DELETE`/`ON UPDATE`. Tabelle senza foreign key vanno create prima. [https://www.cs.purdue.edu/homes/bb/cs448_Spring2014/lecture-files/pdf/ch08-SQL-99%20SchemaDefinition,%20Constraints,%20and%20Queries%20and%20Views.pdf] [https://users.csc.calpoly.edu/~dekhtyar/365-Spring2023/lectures/lec04.365-mysql.pdf]

**Migrazioni (in repository).**

- **Prisma** — file `schema.prisma` in **Prisma Schema Language (PSL)**, con tre parti: **data sources** (`datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`), **generators** (`generator client { provider = "prisma-client-js" }`), **data model** (`model User { id Int @id @default(autoincrement()) ... }`). `prisma migrate dev` "generates SQL files inside `prisma/migrations`" e tiene "a versioned history of changes"; `prisma migrate deploy` per produzione. [https://www.prisma.io/docs/concepts/components/prisma-schema]

- **Rails / Active Record** — migrazioni in Ruby DSL; `create_table :products do |t| t.string :name end` crea la tabella con primary key implicita `id`. Il metodo `change` è reversibile solo per un elenco chiuso di definizioni (`create_table`, `add_column`, `add_index`, `add_reference`, `add_foreign_key`, `drop_table` (con blocco), `rename_table`, …); altrimenti servono `up`/`down` o `reversible`. Punto chiave per il repository: "migrations … are **not the authoritative source** for your database schema. That role falls to `db/schema.rb` (or an SQL file)", e "it is strongly recommended to add the schema file to source control". [https://guides.rubyonrails.org/v7.2/active_record_migrations.html]

- **Alembic (SQLAlchemy)** — version control dello schema con revisioni in `alembic/versions/`; `alembic revision --autogenerate -m "..."` confronta `Base.metadata` col DB e scrive le funzioni `upgrade()`/`downgrade()`. Operazioni tipiche: `op.create_table`, `op.add_column`, `op.drop_table`. Best practice citata: "always version control the `migrations/` directory". [https://alembic.sqlalchemy.org/en/latest/autogenerate.html]

### 5.3 Contratti API

**OpenAPI Specification (OpenAPI Initiative).** Campi obbligatori dell'OpenAPI Object: solo **`openapi`** e **`info`** sono marcati **_REQUIRED_**; `paths`, `components`, `webhooks` **non** lo sono individualmente, ma il documento "MUST contain at least one paths field, a components field or a webhooks field". Verbatim: `openapi` — "This string _MUST_ be the version number of the OpenAPI Specification that the OpenAPI Document uses" e "The `openapi` field _SHOULD_ be used by tooling to interpret the OpenAPI Document", distinto da `info.version`; `info` — "**_REQUIRED**. Provides metadata about the API." Il documento è un oggetto JSON, scrivibile in JSON o YAML; i nomi dei campi sono case sensitive. Versioning `major.minor.patch`. [https://spec.openapis.org/oas/v3.1.0]

Documento minimo valido (verbatim dalla fonte): `openapi: 3.1.0` / `info: { title, version }` / `paths: {}`. [https://spec.openapis.org/oas/v3.1.0]

Versioni pubblicate e date dichiarate dalle fonti:

| Versione | Data dichiarata | Fonte |
|---|---|---|
| 3.1.0 | 15 February 2021 | spec.openapis.org/oas/v3.1.0 |
| 3.1.1 | 24 October 2024 | spec.openapis.org/oas/v3.1.1 |
| 3.1.2 | (patch editoriale, citata insieme a 3.2.0) `[to verify]` | openapispec.com / redocly |
| 3.2.0 | annuncio 23 settembre 2025 | openapis.org blog |
| **3.2.1** | marcata "latest" nella listing | spec.openapis.org/oas/ |

La listing ufficiale elenca `v3.2.1` come **latest**, con `v3.2.0`, poi `v3.1.2/3.1.1/3.1.0` e la linea 3.0. Nota della listing: dove schema e testo della spec confliggono, **il testo prevale**. L'annuncio di v3.2.0 non nomina 3.1.2. [https://spec.openapis.org/oas/] [https://www.openapis.org/blog/2025/09/23/announcing-openapi-v3-2]

**AsyncAPI (event-driven).** Documento AsyncAPI Object: campi **_REQUIRED_** sono **`asyncapi`** ("Specifies the AsyncAPI Specification version being used") e **`info`** ("Provides metadata about the API"); `channels` e `operations` sono descritti ma **non** marcati REQUIRED nella tabella. L'`Info Object` richiede `title` e `version` (versione dell'API, distinta da quella della spec). Formato della versione: "`major`.`minor`.`patch`", con il patch non considerato dal tooling. Concetti v3.0: **channels**, **operations** (`send`/`receive`), **messages**, **servers**, **bindings** (Kafka, MQTT, AMQP, WebSocket, NATS, SNS, SQS, …). La 3.0.0 (dicembre 2023) ha **separato canali e operazioni**. Ultima versione: **3.1.0**, rilasciata **31 gennaio 2026**, minor senza breaking change (si cambia solo `asyncapi: '3.0.0'` → `'3.1.0'`), che aggiunge i binding **ROS 2**. [https://www.asyncapi.com/docs/reference/specification/v3.0.0] [https://www.asyncapi.com/blog/release-notes-3.1.0]

**GraphQL SDL.** SDL è il linguaggio per definire uno schema GraphQL, "a strongly typed contract between client and server". Il tipo radice `Query` definisce gli entry point di **lettura** ed è l'unico root type obbligatorio; `Mutation` e `Subscription` sono opzionali. Il keyword `schema` mappa le operazioni: `schema { query: Query mutation: Mutation subscription: Subscription }`. Scalari built-in: `Int`, `Float`, `String`, `Boolean`, `ID`; modificatori `!` (non-null) e `[...]` (list); direttiva `@deprecated`. Gli schemi SDL sono **introspectable**. [https://www.digitalocean.com/community/tutorials/graphql-graphql-sdl] Edizione corrente della specifica: **September 2025 Edition** (pagina marcata "_Latest Release_", pubblicata **Wed, Sep 3, 2025**), con una _Prerelease_ working draft del 28 settembre 2026 non ancora release. *(L'edizione October 2021 è descritta da più fonti come la prima ratificata dalla GraphQL Foundation, ma la pagina September2025 non lo dichiara: `[to verify]`.)* [https://spec.graphql.org/] [https://spec.graphql.org/September2025/]

**Protocol Buffers (proto3) e gRPC IDL.** Il file `.proto` inizia con `syntax = "proto3";` (in proto2/proto3 "must be the first non-empty, non-comment line"; se omesso il compilatore assume proto2). Messaggio: `message SearchRequest { string query = 1; }`. Regole verbatim sui field number: "You must give each field in your message definition a number between `1` and `536,870,911`"; "The given number must be unique among all fields for that message"; "Field numbers `19,000` to `19,999` are reserved for the Protocol Buffers implementation"; "You should use the field numbers 1 through 15 for the most-frequently-set fields" (1–15 occupano un byte); il numero "cannot be changed once your message type is in use". `reserved` blocca numeri/nomi (es. `reserved 2, 15, 9 to 11;`). Service/RPC: `service SearchService { rpc Search(SearchRequest) returns (SearchResponse); }`, con quattro forme di streaming (unary, server, client, bidirectional). I `.proto` sono l'IDL di gRPC; `protoc` genera stub client e interfacce server per più linguaggi. La pagina non dichiara un numero di versione né data (solo copyright "© 2026 Google LLC"). [https://protobuf.dev/programming-guides/proto3/]

**JSON Schema.** Versione corrente: **Draft 2020-12**, **pubblicata il 16 June 2022** (la precedente era 2019-09); autori Austin Wright, Henry Andrews, Ben Hutton, Greg Dennis. La spec è divisa in due parti: **Core** ("defines the basic foundation of JSON Schema") e **Validation** ("defines the validation keywords of JSON Schema"). Meta-schema più recente: **2020-12**. La pagina continua a etichettarlo **"Draft 2020-12"** (non "final"). URI del meta-schema: `https://json-schema.org/draft/2020-12/schema`. Cambi chiave: `items`/`additionalItems` → `prefixItems`/`items`; `$dynamicRef`/`$dynamicAnchor` al posto di `$recursiveRef`/`$recursiveAnchor`; `definitions` → `$defs`; `dependencies` → `dependentSchemas` + `dependentRequired`; vocaboli `format-annotation`/`format-assertion`; niente JSON Hyper-Schema per questa release. [https://json-schema.org/specification] [https://json-schema.org/draft/2020-12]

### 5.4 API-first / design-first

Definizione verbatim: "**API-first development treats an API contract as a product decision made before clients and implementations depend on it**". "API-first and contract-first are often used interchangeably, but API-first is broader" (copre ownership, lifecycle, governance, deployment, observability). Perché il contratto precede l'implementazione: "The contract makes security review possible before code exists"; "Mocks and generated types can unblock teams"; il ciclo ordinato è "consumer use cases → design contract → review and threat model → mock and validate → implement clients and provider"; "**An abandoned OpenAPI file is not API-first**". [https://api7.ai/learning-center/api-101/api-first-development]

**Mock.** "A mock server can unblock a client and reveal an awkward interface early", ma "**It does not prove the provider's behavior, authorization, latency, or side effects**"; i mock vanno tenuti deterministici e "labeled as simulations, not production evidence". [https://api7.ai/learning-center/api-101/api-first-development] Un mock server legge la spec e risponde con esempio conformi agli schemi; "When the spec changes, the mock changes with it". [https://apidog.com/blog/spec-first-api-development/]

**Codegen.** "Code generation can reduce repetitive serialization and HTTP plumbing"; l'output va trattato come "**a build artifact with a pinned generator, configuration, and templates**"; "Generation does not guarantee compatibility or correctness"; "Do not edit generated files manually". Sequenza sicura di aggiornamento: review della modifica di contratto → classificazione dell'impatto di compatibilità → rigenerazione → review del diff → test unit/integration/contract/security → pubblicazione con migration notes. [https://api7.ai/learning-center/api-101/api-first-development]

### 5.5 Autenticazione e autorizzazione come parte dello schema

OpenAPI copre entrambe sotto il termine **"security scheme"** — "authentication (who the user is) and authorization (what they can access)" — definiti in `components.securitySchemes` e applicati per operazione o globalmente con il keyword `security`. Tipi: HTTP (Basic, Bearer, Digest), API key (header/query/cookie), OAuth 2.x, OpenID Connect, mutual TLS. Bearer/JWT: `type: http`, `scheme: bearer`, con `bearerFormat: JWT` che è solo "a hint to the client" sulla formattazione del token. OAuth2: `type: oauth2` richiede l'oggetto **`flows`**; i flow sono `implicit` (`authorizationUrl`), `password` (`tokenUrl`), `clientCredentials` (`tokenUrl`), `authorizationCode` (`authorizationUrl` + `tokenUrl`, raccomandato con PKCE). **`scopes`** è una **map nome → descrizione breve**; in OpenAPI v3.1 solo OAuth 2 e OpenID Connect usano scope. Multiple requirement objects valgono come **OR**, più scheme in un unico object come **AND**; `security: []` disattiva la security globale per un'operazione. Avvertenza della fonte: documentare gli scheme descrive **come i client si autenticano**; la logica di autenticazione/autorizzazione va comunque implementata nel backend. [https://docs.bump.sh/openapi/v3.2/advanced/security/]

### 5.6 Documento di schema vs contratto API

Le fonti reali trattano **tabelle ed endpoint come artefatti distinti** ma componibili nella stessa consegna di pre-sviluppo. Nei SDLC pubblici (es. British Columbia, SCDHHS) il pacchetto di design del database è composto da: **ERD**, **logical model** (tabelle, attributi con nomi e tipi, primary key, foreign key, candidate key, altri constraint) e **script SQL `CREATE TABLE`** che "must actually run to create the database", più una cleanup script; il physical data model segue all'approvazione. [https://www2.gov.bc.ca/assets/gov/british-columbians-our-governments/services-policies-for-government/information-technology/standards/natural-resource-sector/sdlc/standards/nrs_developers_working_in_a_corporate_versioned_repository.pdf] Lato contratto API, il documento (OpenAPI/AsyncAPI/GraphQL SDL/`.proto`) è la fonte unica versionata nel repository e usato da mock, codegen e contract test. *(Sulla forma esatta in cui i repository pubblici conservano insieme schema DB e contratto — cartelle `docs/`, `openapi.yaml`, `prisma/migrations/`, `db/schema.rb` — le fonti lette confermano la collocazione dei singoli artefatti ma non una convenzione unica: `[to verify]` su una struttura "backend schema" canonica.)* [https://api7.ai/learning-center/api-101/api-first-development]

**Fonti**: https://dl.acm.org/doi/abs/10.1145/320434.320440 · https://www.red-gate.com/blog/crow-s-foot-notation/ · https://circle.visual-paradigm.com/docs/database-design-engineering/database-designers-guide/conceptual-logical-and-physical-data-model/ · https://www2.gov.bc.ca/assets/gov/british-columbians-our-governments/services-policies-for-government/information-technology/standards/natural-resource-sector/sdlc/standards/nrs_developers_working_in_a_corporate_versioned_repository.pdf · https://dbml.dbdiagram.io/home/ · https://dbml.dbdiagram.io/docs/ · https://www.prisma.io/docs/concepts/components/prisma-schema · https://guides.rubyonrails.org/v7.2/active_record_migrations.html · https://alembic.sqlalchemy.org/en/latest/autogenerate.html · https://www.cs.purdue.edu/homes/bb/cs448_Spring2014/lecture-files/pdf/ch08-SQL-99%20SchemaDefinition,%20Constraints,%20and%20Queries%20and%20Views.pdf · https://users.csc.calpoly.edu/~dekhtyar/365-Spring2023/lectures/lec04.365-mysql.pdf · https://spec.openapis.org/oas/v3.1.0 · https://spec.openapis.org/oas/v3.1.1 · https://spec.openapis.org/oas/ · https://www.openapis.org/blog/2025/09/23/announcing-openapi-v3-2 · https://docs.bump.sh/openapi/v3.2/advanced/security/ · https://www.asyncapi.com/docs/reference/specification/v3.0.0 · https://www.asyncapi.com/blog/release-notes-3.1.0 · https://www.digitalocean.com/community/tutorials/graphql-graphql-sdl · https://spec.graphql.org/ · https://spec.graphql.org/September2025/ · https://protobuf.dev/programming-guides/proto3/ · https://json-schema.org/specification · https://json-schema.org/draft/2020-12 · https://api7.ai/learning-center/api-101/api-first-development · https://apidog.com/blog/spec-first-api-development/

---

## 6. Spec-driven development e file di contesto per agenti

### 6.1 Origine di "vibe coding"

- **Andrej Karpathy, 2 febbraio 2025**, post su X (`x.com/karpathy/status/1886192184808149383`). Definizione originale verbatim: *"There's a new kind of coding I call 'vibe coding', where you fully give in to the vibes, embrace exponentials, and forget that the code even exists."* Segue: *"I 'Accept All' always, I don't read the diffs anymore."* L'autore lo limitava ai progetti usa-e-getta: *"It's not too bad for throwaway weekend projects"* ([Hindustan Times](https://www.hindustantimes.com/business/former-tesla-ai-czar-andrej-karpathy-coins-vibe-coding-heres-what-it-means-101740749179379.html), [Know Your Meme](https://knowyourmeme.com/memes/vibe-coding)).
- **Collins Word of the Year 2025**: annunciato il **6 novembre 2025**. Definizione Collins: *"the use of artificial intelligence prompted by natural language to assist with the writing of computer code"*. Scelto fra 10 parole, battendo `clanker` ([The Guardian, 6 nov 2025](https://www.theguardian.com/technology/2025/nov/06/vibe-coding-collins-dictionary-word-of-the-year-2025), [BBC](https://www.bbc.com/news/articles/cpd2y053nleo)). Il termine è passato da pratica descritta come deliberata a posizione "culturale" istituzionalizzata in meno di un anno.

### 6.2 GitHub Spec Kit (`github/spec-kit`)

- **Annuncio: 2 settembre 2025**, dal blog GitHub, titolo *"Spec-Driven Development with AI: Get started with a new open source toolkit"*. Frase chiave verbatim: *"We're moving from 'code is the source of truth' to 'intent is the source of truth.'"* Le fasi annunciate sono descritte come un processo *"in four phases with clear checkpoints"* — **"Specify", "Plan", "Tasks", "Implement"** ([github.blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)).
- **Fasi e comandi verbatim** (dalla quickstart ufficiale, prefisso `/speckit-*`, descritti come *"agent skills, not terminal commands"*):
  - percorso breve: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`;
  - percorso completo con tre quality gate: `/speckit-constitution` (una volta per progetto, *"set the ground rules"*), `/speckit-specify` (*"describe what to build"*), `/speckit-clarify` (*"resolve ambiguities"*), `/speckit-plan` (*"choose the tech stack"*), `/speckit-checklist` (*"validate the spec"*), `/speckit-tasks` (*"break the work down"*), `/speckit-analyze` (*"check consistency"*), `/speckit-implement` (*"build it"*), `/speckit-converge` (*"verify completeness"*) ([quickstart](https://github.github.com/spec-kit/quickstart.html)).
- **File prodotti**: `spec.md`, `plan.md`, `tasks.md`; checklist built-in in `checklists/requirements.md`; stato della feature in `.specify/feature.json` (con override via env var `SPECIFY_FEATURE_DIRECTORY`). La pagina quickstart **non nomina** `memory/constitution.md` (il path del constitution file non è dato lì). La landing (`github.github.com/spec-kit/index.html`, *"Last updated: September 28, 2026"*) ricapitola le fasi come **"Specify → Plan → Tasks → Implement → Converge"**, senza elencare i filename.
- **Agenti supportati**: la landing dichiara **"38 integrations"** (esempi: Copilot, Gemini, Codex, Kilo Code, Zed, Claude, Forge, Kiro), con una integrazione `generic` come via di fuga. La stessa pagina riporta *"270+ contributors"*, *"130K+ GitHub stars"*, 157 extensions, 33 presets — **numero di stelle `[to verify]`**, letto il 2026-10-02 e soggetto a storico crescente. Il post di annuncio citava solo tre agenti (Copilot, Claude Code, Gemini CLI): l'ecosistema è cresciuto dopo.

### 6.3 AWS Kiro (`kiro.dev`)

- **Date**: disponibile in preview a **luglio 2025**, raggiunge la **general availability a novembre 2025**. Il blog ufficiale *"One year of Kiro"* (datato 14 luglio 2026) dice che l'IDE arrivò *"in preview last July"* e arrivò *"to general availability"* quel novembre ([kiro.dev/blog/one-year](https://kiro.dev/blog/one-year/)). Alterazioni del giorno esatto (14 vs 16 luglio; 17 nov vs 3 dic a re:Invent) circolano in fonti secondarie — **`[to verify]`** il giorno preciso ([SiliconANGLE, 17 nov 2025](https://siliconangle.com/2025/11/17/aws-launches-kiro-general-availability-team-features-cli-support/)).
- **Cos'è**: IDE agentico (fork di VS Code) che ruota attorno a spec markdown salvate in `.kiro/specs/{feature_name}/`.
- **Le tre fasi** (dalla pagina ufficiale Requirements-First):
  1. `requirements.md` — *"User stories with clear acceptance criteria"*, *"System behaviors in EARS format (WHEN...THE SYSTEM SHALL...)"*, functional requirements, edge cases;
  2. `design.md` — *"System architecture and components"*, sequence diagrams, data models and interfaces, stack, error handling, testing strategy;
  3. `tasks.md` — *"Discrete, trackable tasks"*, dipendenze, optional vs required. Poi *"Execute tasks individually or run all tasks"* ([kiro.dev/docs/specs/feature-specs/requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/)).
  - Esempi verbatim di requisiti EARS dalla pagina: *"WHEN a user submits valid registration data THE SYSTEM SHALL create a new user account"*, *"WHEN a user submits an email that already exists THE SYSTEM SHALL display 'Email already registered' error"*. La pagina mostra **solo** la forma event-driven `WHEN...THE SYSTEM SHALL...` (*"Unambiguous and testable"*, *"Traceable through implementation"*); le varianti While/Where/If **non** compaiono lì — **`[to verify]`** come Kiro documenti le altre (fonti secondarie le elencano).
- **Steering files**: (dai doc ufficiali) *"Steering gives Kiro persistent knowledge about your project through markdown files."* Risiedono in `.kiro/steering/` (workspace) e `~/.kiro/steering/` (global); il workspace vince. Tre file di fondazione **`product.md`**, **`tech.md`**, **`structure.md`**, inclusi di default. Quattro **inclusion modes** via front matter YAML: `always`, `fileMatch` (glob), `manual` (`#steering-file-name`), `auto`. Nota: *"On Kiro CLI, inclusion modes are not currently supported."* ([kiro.dev/docs/steering](https://kiro.dev/docs/steering/)).
- **Hooks**: *"Hooks run shell commands or agent prompts automatically when specific events happen in your session."* Configurazioni **JSON** in **`.kiro/hooks/<id>.json`**, *"Hooks activate automatically when a session starts"*. Trigger nominati solo come esempi sulla pagina (elenco completo in "Hook types"): `PostFileSave`, `PreToolUse`/`PostToolUse`, `Stop` ([kiro.dev/docs/hooks](https://kiro.dev/docs/hooks/)).

### 6.4 EARS (Easy Approach to Requirements Syntax)

- **Alistair Mavin** e colleghi alla **Rolls-Royce PLC**, nato analizzando *"airworthiness regulations for a jet engine control system"*; **prima pubblicazione 2009** (Mavin, Wilkinson, Harwood, Novak, RE'09, IEEE) ([alistairmavin.com/ears](https://alistairmavin.com/ears/)).
- **Sintassi generica verbatim**: *"While \<optional pre-condition\>, when \<optional trigger\>, the \<system name\> shall \<system response\>"*. Ruleset ufficiale: *"Zero or many preconditions; Zero or one trigger; One system name; One or many system responses."* Il verbo normativo è **"shall"**.
- **Cinque pattern verbatim** (dalla guida ufficiale):

| Pattern | Keyword | Struttura |
|---|---|---|
| Ubiquitous | (nessuna) | `The <system name> shall <system response>` |
| State driven | While | `While <precondition(s)>, the <system name> shall <system response>` |
| Event driven | When | `When <trigger>, the <system name> shall <system response>` |
| Optional feature | Where | `Where <feature is included>, the <system name> shall <system response>` |
| Unwanted behaviour | If / Then | `If <trigger>, then the <system name> shall <system response>` |

  Combinazioni di più keyword = *"Complex requirements"*. Organizzazioni indicate come utilizzatrici: *"Airbus, Bosch, Dyson, Honeywell, Intel, NASA, Rolls-Royce and Siemens."*
- **Perché torna in uso con gli agenti**: le stesse fonti secondarie lo collegano a Kiro (2025) e a GitHub Spec Kit come formato canonico per specifiche assistite da AI; le fonti esterne citano una generalizzazione **GEARS** (2024–2025) che estende `<system>` a qualsiasi soggetto — **`[to verify]`** (non letto su fonte primaria).

### 6.5 BMAD-METHOD

- **"Breakthrough Method of Agile AI-Driven Development"**, framework open-source di persone-agente specializzate lungo il ciclo di vita; install con `npx bmad-method install`; ogni persona è un prompt markdown (`SKILL.md`), non un subagent nativo ([docs.bmad-method.org](https://docs.bmad-method.org/fr/reference/agents/)).
- **Ruoli** (skill ID + trigger):

| Ruolo | Nome | Skill ID | Trigger es. |
|---|---|---|---|
| Analyst | Mary | `bmad-analyst` | BP, MR, DR, CB |
| Product Manager | John | `bmad-pm` | CP, VP, EP, IR, CC |
| Architect | Winston | `bmad-architect` | CA, IR |
| Developer | Amelia | `bmad-agent-dev` | BD, QA, CR, SP, ER |
| UX Designer | Sally | `bmad-ux-designer` | CU |

  Fonti secondarie elencano anche Scrum Master (Bob), QA Engineer (Quinn), Tech Writer (Paige), Solo Dev (Barry) e il **BMad Master** orchestratore/validatore — **`[to verify]`**.
- **Flusso**: due mosse portanti — **Agentic Planning** (Analyst + PM + Architect producono PRD e Architecture) e **Context-Engineered Development** (lo Scrum Master trasforma i piani in development *stories* iper-dettagliate per il Dev). Un contributo esterno lo inquadra in **4 fasi** — Analysis, Planning, Solutioning, Implementation — più una fase Documentation.
- **Versione corrente**: il pacchetto npm `bmad-method` risulta a **6.12.0**; la v6 è una riscrittura con architettura a skill e file `SKILL.md` unificato; i moduli (BMM, BMB, TEA, BMGD, CIS, WDS, `bmad-loop`) sono versionati separatamente — **`[to verify]`** l'ultimissima (`unpkg` mostrava 6.9.0 con ultima 6.11.0 al momento della lettura).

### 6.6 Altri strumenti

| Strumento | Cosa produce | Dove / note |
|---|---|---|
| **OpenSpec** (Fission AI) | Framework brownfield *change-based*: loop `propose → apply → archive`, delta `ADDED / MODIFIED / REMOVED`; ogni change in `openspec/changes/<name>/` con proposal, spec, design, tasks; comandi `/opsx:` (`new`, `ff`, `apply`, `verify`, `archive`); `openspec init`; MIT; single-maintainer (**bus-factor risk**) | [Security Boulevard, giu 2026](https://securityboulevard.com/2026/06/7-spec-driven-development-tools-spec-kit-kiro-openspec-tessl-more/) |
| **Task Master AI** | Parsa un PRD in una lista di task ordinata e dependency-aware; `parse_prd`; ~36 MCP tools; `.taskmaster/` via `npx task-master-ai init`; multi-modello | MIT **with Commons Clause**; gestisce i task, non scrive la spec |
| **ai-dev-tasks** | Approccio minimale: markdown + tagging (`@requirement`, `@priority:high`, `@task`, `@status:in-progress`); zero installazione | Citato in [SoftwareSeni, 2026](https://www.softwareseni.com/the-30-plus-framework-landscape-navigating-spec-driven-development-options-in-2026/) |
| **spec-workflow-mcp** (`Pimzino/spec-workflow-mcp`) | MCP server con web dashboard real-time (porta **5000**), estensione VSCode, approval workflow, implementation logs; spec in `.spec-workflow/` (sottocartelle `approvals/`, `archive/`, `specs/`, `steering/`, `templates/`); supporto git worktrees; GPL-3.0 | Install: `npx @pimzino/spec-workflow-mcp`; versione elencata 2.2.5 |
| **Tessl** | *"spec as source"*: codice marcato *"GENERATED FROM SPEC - DO NOT EDIT"*; **Spec Registry** (10.000+ spec machine-readable, "npm for specifications") + **Framework**; `tessl init`; spec in `specs/` con sintassi `[@test]` | Lanciato **23 settembre 2025** (Guy Podjarny, fondatore Snyk); commerciale, Framework in closed beta, Registry in open beta |

### 6.7 File di contesto per agenti

| File / sistema | Sede | Contenuto | Distinzione dal PRD |
|---|---|---|---|
| **AGENTS.md** | radice repo (nestable in monorepo, *"the closest one takes precedence"*) | *"a README for agents"*: setup/build/test commands, code style, security, PR instructions; markdown libero, nessun campo obbligatorio | Istruzioni operative per la macchina, non requisiti di prodotto. *"used by over 60k open-source projects"*; emerso da OpenAI Codex, Amp, Jules (Google), Cursor, Factory; oggi *"stewarded by the Agentic AI Foundation"* (Linux Foundation) ([agents.md](https://agents.md/)) |
| **CLAUDE.md** | radice progetto (+ `CLAUDE.local.md` personale); nesting per directory | Project purpose, convenzioni, comandi chiave, regole path-specific in `.claude/rules/*.md`; permessi separati in `.claude/settings.json` | Memoria operativa dell'agente, non specifica |
| **`.cursor/rules`** | `.cursor/rules/*.mdc` (MDC = YAML + Markdown) | Frontmatter: `description` (USE WHEN), `globs`, `alwaysApply`, `priority`. Eredità: `.cursorrules` senza scoping | Regole di contesto caricabili condizionalmente |
| **Cline Memory Bank** | `memory-bank/` (istruzioni in `.clinerules/memory-bank.md`) | File core: `projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`; comandi *"initialize memory bank"*, *"update memory bank"* | *"transforms Cline from a stateless assistant into a persistent development partner"* ([docs.cline.bot](https://docs.cline.bot/best-practices/memory-bank)) |
| **GitHub Copilot custom instructions** | `.github/copilot-instructions.md` (+ org-level, + `.github/instructions/` con `applyTo:`) | Stack, convenzioni, sezioni "Do not"; l'unico con ereditarietà org; GitHub nota che *"are not guaranteed to be followed"* | Solo istruzioni, nessun enforcement |

- **Interoperabilità**: Claude Code ha aggiunto il supporto nativo ad **AGENTS.md come fallback** (letto solo se manca `CLAUDE.md`) a fine settembre 2026, in v.2.1.277 circa; opzioni `/config`: `claude-md-or-agents-md`, `claude-md-and-agents-md`, `claude-md`, `managed-only` — **`[to verify]`** la data/versione esatta ([InfoWorld](https://www.infoworld.com/article/4224410/claude-code-now-also-accepts-instructions-in-openais-agents-md-format.html), [DevOps.com](https://devops.com/claude-code-adds-agents-md-fallback-cutting-instruction-file-sprawl/)).
- **Ricerca sull'efficacia** (ETH Zurich, "Evaluating AGENTS.md"): i context file generati da LLM riducono leggermente il successo (~0,5 pp su SWE-bench Lite, 2–3 pp su AgentBench) e alzano i costi di inferenza ~20–23%; quelli scritti a mano vanno un po' meglio (~+4 pp su AgentBench) — **`[to verify]`** (letto solo via sintesi di ricerca).

### 6.8 Corpus e dati

- **SpecMine: A Large-Scale Corpus of Spec-Driven Development Artifacts** — Agarwal, Singhal, Breaux, Vasilescu (CMU), **arXiv:2608.25202**, dataset per la MSR 2027 Mining Challenge. Raccolto **luglio 2026**: **470.795** file `spec.md`/`specs.md` in **73.030** repository (17 tool SDD nominati); censimento Kiro **98.574** artefatti `requirements`/`design`/`tasks` in **12.910** repo; **5.992** PR toccanti spec in 581 repo; indice di tracciabilità **2.421.323** riferimenti spec→codice; 780.335 commit. Rilascio su Zenodo (DOI 10.5281/zenodo.22102779) — **`[to verify]`**: numeri letti da sintesi di ricerca, non dal PDF ([Zenodo](https://zenodo.org/records/22102780), [CatalyzeX](https://www.catalyzex.com/paper/specmine-a-large-scale-corpus-of-spec-driven)).
- Uno studio empirico su **2.923 repo** riporta i context file come dominanti nella configurazione agentica — **`[to verify]`** (citato da sintesi, fonte primaria non letta).

**Fonti**: [Hindustan Times](https://www.hindustantimes.com/business/former-tesla-ai-czar-andrej-karpathy-coins-vibe-coding-heres-what-it-means-101740749179379.html) · [Know Your Meme](https://knowyourmeme.com/memes/vibe-coding) · [The Guardian](https://www.theguardian.com/technology/2025/nov/06/vibe-coding-collins-dictionary-word-of-the-year-2025) · [BBC](https://www.bbc.com/news/articles/cpd2y053nleo) · [GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/) · [Spec Kit docs](https://github.github.com/spec-kit/index.html) · [Spec Kit quickstart](https://github.github.com/spec-kit/quickstart.html) · [Kiro Requirements-First](https://kiro.dev/docs/specs/feature-specs/requirements-first/) · [Kiro One year](https://kiro.dev/blog/one-year/) · [Kiro Steering](https://kiro.dev/docs/steering/) · [Kiro Hooks](https://kiro.dev/docs/hooks/) · [Alistair Mavin — EARS](https://alistairmavin.com/ears/) · [BMAD docs](https://docs.bmad-method.org/fr/reference/agents/) · [agents.md](https://agents.md/) · [Cline Memory Bank](https://docs.cline.bot/best-practices/memory-bank) · [InfoWorld](https://www.infoworld.com/article/4224410/claude-code-now-also-accepts-instructions-in-openais-agents-md-format.html) · [DevOps.com](https://devops.com/claude-code-adds-agents-md-fallback-cutting-instruction-file-sprawl/) · [Security Boulevard](https://securityboulevard.com/2026/06/7-spec-driven-development-tools-spec-kit-kiro-openspec-tessl-more/) · [SoftwareSeni](https://www.softwareseni.com/the-30-plus-framework-landscape-navigating-spec-driven-development-options-in-2026/) · [Spec Workflow MCP](https://github.com/madmatt112/spec-workflow-mcp/blob/main/README.md) · [Tessl docs](https://docs.tessl.io/use/spec-driven-development-with-tessl.md) · [Zenodo SpecMine](https://zenodo.org/records/22102780) · [CatalyzeX SpecMine](https://www.catalyzex.com/paper/specmine-a-large-scale-corpus-of-spec-driven)

---

## 7. Le liste che circolano e la critica

### 7.1 Le liste di documenti (nessuna è "quella" lista)

Non esiste un canone unico: il numero di voci va da 2 a 15 e l'ordine cambia con la fonte. Quello che ricorre quasi sempre è **PRD** (+ varianti: TRD/tech stack, app flow, UI/UX o design, backend schema/data model, implementation plan/tasks). Le prime tre voci della lista virale di partenza (PRD, TRD, UI/UX, AppFlow, Backend Schema, Implementation Plan) sono la "famiglia" più diffusa, ma esistono versioni da 2, 3, 4, 5, 6, 7, 8, 9 e 15 documenti.

| # | Fonte | N. | Voci verbatim | URL |
|---|---|---|---|---|
| 1 | `@softcollie/vibecoding-docs-skill` (npm, skill per Claude Code) | 6 | "**PRD** — Requisitos de producto" · "**TRD** — Requisitos técnicos / stack" · "**Diseño UI/UX** — Sistema de diseño" · "**AppFlow** — Flujo de pantallas (diagrama Mermaid)" · "**Esquema del BackEnd** — Modelo de datos (diagrama ER Mermaid)" · "**Plan de Implementación** — Fases, hitos y plazos" | npmjs.com/package/@softcollie/vibecoding-docs-skill |
| 2 | "Vibe Coding Template Pack" (Scribd, curato da @pranavv.ai) `[to verify: la pagina non rende l'elenco, voci ricavate dal risultato di ricerca]` | 6 | "PRD, TRD, App Flow, UI/UX Brief, Backend Schema, Impl. Plan" — presentati come pipeline: "The PRD constrains the TRD, the TRD shapes the schema, the schema dictates parts of the app flow." | scribd.com/document/1055397467/Vibe-Coding-Template-Pack |
| 3 | wu-jackie.github.io / tamata78 (memo di un post X) | 6 | "PRD.md" · "APP_FLOW.md" · "TECH_STACK.md" · "FRONTEND_GUIDELINES.md" · "BACKEND_STRUCTURE.md" · "IMPLEMENTATION_PLAN.md" (regola: "在写任何一行代码之前，先把这六份文档写掉" = prima di scrivere una riga di codice, scrivi questi sei documenti) | wu-jackie.github.io/2026/07/24/Vibe-Coding/ |
| 4 | mackstroke.com — "The 6 Essential .md Files You Need Before Vibe Coding" | 6 | "README.md, PRD.md, ARCHITECTURE.md, DESIGN-SYSTEM.md, AGENTS.md (or CLAUDE.md), and TASKS.md." | mackstroke.com/elementor-25809/ |
| 5 | learningspoons.com (guida coreana) `[to verify: pagina 403, voci da ricerca]` | 6 | "PRD, TRD, UI document, folder structure + DB schema, code guidelines", in una cartella `/docs` | learningspoons.com/creator/azakam/post/1275 |
| 6 | bighaeil/simple-vibe-coding-guide (GitHub) — "Phase 0" | 2 | "INIT.md 작성" · "PRD.md 작성" (poi "팀 합의" = accordo di team) | github.com/bighaeil/simple-vibe-coding-guide/blob/main/VIBE-CODING-CHECKLIST.md |
| 7 | woodyxu/vibe-coding-standard-workflow (SKILL.md, sezione "Target Artifacts") | 7 | "`PRD.md` as the temporary idea capture file" · "`memory-bank/design-document.md`" · "`memory-bank/tech-stack.md`" · "`memory-bank/implementation-plan.md`" · "`memory-bank/progress.md`" · "`memory-bank/architecture.md`" · "`AGENTS.md` and/or `CLAUDE.md`, depending on the agent environment" | raw.githubusercontent.com/NeverSight/skills_feed/.../vibe-coding-standard-workflow/SKILL.md |
| 8 | Abdiel49/spec-suite-skill (GitHub/npm) — Track A + Track B | 7 + 8 = 15 | Track A: "Product Requirements Document", "Technical Requirements Document", "Backend Schema", "Application Flow", "Design System Brief", "Implementation Roadmap", "Security Architecture". Track B: "Legal Compliance Annex", "Terms of Service", "Privacy Policy", "Data Processing Policy", "Acceptable Use Policy", "Content & Intellectual Property Policy", "AI & Automation Policy", "Service Warranty & Continuity" | github.com/abdiel49/spec-suite-skill |
| 9 | The Prompt Index — "Vibe-coding Documentation" | 9 | "Product Design Requirements (PDR):" · "Tech Stack:" · "App Flowchart:" · "Project Rules:" · "Implementation Plan:" · "Frontend Guidelines:" · "Backend Guidelines:" · "Optimised React Code Guidelines:" · "Security Checklist (MUST be enforced across the stack):" | thepromptindex.com/prompt/1055-vibe-coding-documentation |
| 10 | Crudely (Product Hunt) | 7 | "PRD, TRD, UI flow, app flow, backend schema, implementation plan, and policies." | producthunt.com/products/crudely |
| 11 | Vooster AI (pymm.ai) — "7 Essential Documents" | 7 | "PRD" · "User Journey" · "TRD" · "ERD" · "Design Guide" · "IA" · "Code Guideline" | pymm.ai/en/blog/vooster-7-documents-guide |
| 12 | ContextArk — "Spec-Driven Development Templates" | 8 | "PRD" · "API Spec" · "Database Schema" · "Architecture Doc" · "Component Inventory" · "Tech Stack Doc" · "Definition of Done" · "AI Rules File" | contextark.com/blog/spec-driven-development-template |
| 13 | Security Boulevard — "9 PRD and Spec Templates Built for AI Coding Agents" (strumenti, non documenti) | 9 | "GitHub Spec Kit" · "Kiro Specs" · "OpenSpec" · "Task Master" · "BMAD-METHOD" · "Tessl Spec Registry" · "AGENTS.md" · "ai-dev-tasks (Snarktank)" · "spec-workflow-mcp" | securityboulevard.com/2026/06/9-prd-and-spec-templates-built-for-ai-coding-agents/ |
| 14 | GitHub Spec Kit — `templates/` | 5 artefatti | "checklist-template.md", "constitution-template.md", "plan-template.md", "spec-template.md", "tasks-template.md" (+ "vscode-settings.json") | github.com/github/spec-kit/tree/main/templates |
| 15 | vibeworkflow.app — "The 5 Documents Every AI Coding Project Needs" `[to verify: il testo elenca i file ma non li presenta come "i cinque documenti"]` | 5 | "research, PRD, technical design, AGENTS.md, MEMORY.md" | vibeworkflow.app/blog/ai-docs |
| 16 | awslabs/aidlc-workflows — "AI-DLC Quick Start" | 2 | "Vision Document" ("what to build and why") · "Technical Environment Document" ("what tools to use") | github.com/awslabs/aidlc-workflows/blob/v1.0.1/docs/writing-inputs/inputs-quickstart.md |
| 17 | GeeksforGeeks — "Implementation Plan Using Claude" | 5 in ingresso → 1 in uscita | "PRD.md" · "TRD.md" · "AppFlow.md" · "Design.md" · "Schema.md" (input) → "Plan.md" (output) | geeksforgeeks.org/artificial-intelligence/implementation-plan-using-claude/ |
| 18 | wavestone-sa/agentic-spec-skills (GitHub) | pipeline a 4 fasi | "spec-research (existing code) or spec-prd (greenfield) → spec-plan → (optional spec-grill) → spec-implement" | github.com/wavestone-sa/agentic-spec-skills |
| 19 | BMAD-METHOD (descritto in *Specs as Source Code*, Agentic Engineering Book) `[to verify: 4 fasi, non 4 documenti]` | 4 fasi | "Analysis Phase (optional) – Product Brief, Research Summary" · "Planning Phase – PRD, UX Design" · "Solutioning Phase – Architecture Document, Epics/Stories, Readiness Assessment" · "Implementation Phase – Working Code, Code Reviews, Test Automation" | github.com/jayminwest/agentic-engineering-book/.../3-specs-as-source-code.md |
| 20 | Christopher S. Penn — "The Holy Trinity of AI Project Success" `[to verify: pagina non letta direttamente]` | 3 | "PRD (the 'why'), Spec (the 'what'), and Workplan (the 'how')" | christopherspenn.com/2026/04/the-holy-trinity-of-ai-project-success... |

**Una lista non numerata (Microsoft Learn, "Identify Product Requirements and Coding Guidelines")**: non dà un conteggio, ma chiede un PRD con sezioni fisse — "Product summary", "Target audience", "Core features", "UI descriptions", "Navigation", "Sample data", "Technical requirements", "Styling", "Use cases", "Out-of-scope" — più wireframe e coding guidelines. Testuale: "Well-defined requirements and wireframe diagrams lead to more accurate AI suggestions and fewer iterations needed."

**Voci che ricorrono sempre** (conta incrociata su tutte le fonti sopra): il **PRD** compare in 15+ liste su 15 e quasi sempre per primo; **TRD / Tech Stack / Technical Requirements**; **App Flow / User Journey**; **UI/UX / Design System / Frontend Guidelines**; **Backend Schema / DB Schema / ERD / API Spec**; **Implementation Plan / Tasks**. Compaiono invece solo in alcune: `AGENTS.md`/`CLAUDE.md`, README, `memory-bank/`, Security, Definition of Done, Policy legali, `progress.md`/`lessons.md`.

### 7.2 La critica e le evidenze

**Agile Manifesto (2001) — testo verbatim.** Le quattro proposizioni: "Individuals and interactions over processes and tools" · "Working software over comprehensive documentation" · "Customer collaboration over contract negotiation" · "Responding to change over following a plan". E la riga di chiusura che di solito si cita a metà: "That is, while there is value in the items on the right, we value the items on the left more." Il Manifesto **non vieta** la documentazione: l'interpretazione corrente (Aalto/software-engineering-handbook) è "Agile does not say 'no documentation' or 'no plans'. It says that when the two sides conflict, the left side wins"; Scrum.org — "we don't just say 'no' to the items on the right. That would be too black and white"; Plant Engineering — "there is value in documentation, and there is more value in working software. This is a statement about priorities and focus. It does not suggest one should apply sole focus on working software and ignore documentation." Un caso citato (PM World Journal): un team che abbandonò la documentazione subì buchi di conoscenza e "65% of sprint demos rejected".

**Shape Up (Basecamp) — pitch invece di PRD/backlog.** Il pitch (cinque ingredienti: **Problem, Appetite, Solution, Rabbit Holes, No-Gos** — sede canonica al §2.4) è la proposta alternativa a PRD e backlog; qui rileva la critica. Verbatim dalla fonte primaria (cap. 7, "Bets, Not Backlogs"): "Backlogs are a big weight we don't need to carry." · "Backlogs are big time wasters too." · "There's no giant list of ideas to review." Il lavoro entra come *pitch*: "The pitches are potential bets" · "If we decide to bet on a pitch, it goes into the next cycle to build. If we don't, we let it go." Il termine "PRD" non appare mai (cap. 6–7). La "Solution" è deliberatamente "a 'fat-marker' sketch", non una spec.

**Boehm e la "cost of change curve".** I numeri più citati (Boehm, *Software Engineering Economics*, 1981, via NIST 2002): requisiti 1X, coding 5X, integrazione/test 10X, beta 15X, post-release 30X. Una tabella riprodotta (University of Waterloo) attribuisce a Boehm 1981: Requirements = 1, Design = 5, Code = 10, Test = 50. **La critica:** la cifra precisa "1:100" non regge — Laurent Bossavit (*The Leprechauns of Software Engineering*) ha risalito la fonte fino a note interne IBM non pubblicate, definendola "既非已發表的研究，方法論也不可查核" (né ricerca pubblicata né metodologia verificabile); la fonte "IBM Systems Sciences Institute" è, secondo Bossavit, di esistenza dubbia, e il capitolo di sintesi conclude che "la direzione della curva di Boehm è ben sostenuta; il moltiplicatore esatto e lo studio IBM no." Anche la tesi "50–85% dei difetti a vita derivano dai requisiti" `[to verify: non confermata su fonte primaria]`.

**CHAOS Report di Standish — critica di Eveleens & Verhoef (2010).** In "The Rise and Fall of the Chaos Report Figures", *IEEE Software* 27(1):30–36. Standish nel 1994 pubblicò "a shocking 16 percent project success". Gli autori sostengono che le definizioni Standish "have four major problems": (1) "misleading because they're based solely on estimation accuracy of cost, time, and functionality"; (2) "their estimation accuracy measure is one-sided, leading to unrealistic success rates"; (3) "steering on their definitions perverts good estimation practice"; (4) "the resulting figures are meaningless because they average numbers with an unknown bias". Hanno replicato le definizioni su "5,457 forecasts of 1,211 real-world projects" e concluso che "The Standish figures didn't reflect the reality of the case studies at all." Standish, secondo Verhoef, si è definita "opinion based advisory organization" con un disclaimer per cui i dati CHAOS "should be considered Standish opinion". Corroborazione: Jørgensen & Moløkken-Østvold (2006), *Information and Software Technology* 48(4). Corollario per la pratica documentale: la rivendicazione tipo "80% dei fallimenti viene dai requisiti" va citata come "industry studies suggest", non come "research proves".

**Docs-as-code e documentation debt.** Lo studio Ericsson (TechDebt 2023, arXiv 2402.11048) su 1.663 bug risolti: 438 hanno prodotto aggiornamenti di documentazione, di cui 318 difetti "puramente" di documentazione — **circa il 19% di tutti i bug risolti**; su pacchetti R, "documentation debt was the most prominent, with close to 30% of all found instances of TD". I sottotipi più frequenti: "Erroneous code examples (23), Missing documentation (35), and Outdated content (19)". Il danno dichiarato: costi di manutenzione, ritardi, "loss of confidence in the product". Il **drift** è diffuso: un "2026 Documentation Debt Report" su 9 progetti open source (Grafana, PostHog, Elasticsearch, MongoDB, Airbyte, Sentry, Terragrunt, Mattermost, n8n) trova 6.397 findings su 2.996 feature, di cui 1.261 "Large" (breaking). L'approccio **docs-as-code** (doc come artefatto di prima classe, versionato, in CI/CD) in un caso riporta il ritardo medio di aggiornamento da settimane a "less than one hour" e i diagrammi obsoleti dal ~35% a sotto il 5% in sei mesi.

**Posizioni degli agenti AI — pro spec.**
- **Sean Grove (OpenAI, talk "The New Code", AI Engineer World's Fair 2025)**: la spec è la "source of truth"; il codice è una "lossy projection of intent"; scartare i prompt tenendo solo il codice equivale a "shred the source and then you very carefully version control the binary". La cifra "code 10–20% del valore / 80–90% structured communication" `[to verify: flaggata come trascrizione di community, non ricerca]`.
- **Zencoder**: "A prompt tells an AI what you'd like." / "A spec tells an AI what it must do." / "The difference is profound." E: "AI needs that backbone even more than humans do."
- **Tessl**: "a written specification effectively aligns humans"; chi scrive la spec "is now the programmer".
- Il dibattito corrente distingue tre livelli: **spec-first**, **spec-anchored** (spec e codice evolvono insieme, con test automatici di allineamento — indicato come "the right balance point"), **spec-as-source** (si modifica solo la spec, mai il codice generato — "still an early aspiration").

**Posizioni degli agenti AI — contro / scettiche.**
- **Prompt Crystallization (vprovorov/AgenticFuturism)**: "The problem is the dead nature of specifications." / "A spec is a document. You cannot execute it. You cannot test it. You cannot observe its behavior." / "The spec lives in one universe (human-readable text) and the code lives in another" — e "the translation between them is where things break". Contro: "This self-awareness is the core advantage of Prompt Crystallization over spec-driven development."
- **Critica "ritorno al waterfall"** (36kr, ripresa da più testate): il modello spec-first di OpenAI viene letto come "the return of the waterfall model: 'Listen to the PM and write requirement documents'", con la replica che "code is the ultimate executable truth".
- **Astenuti/misti**: le posizioni accademiche (arXiv/Semantic Scholar su SDD) notano che SDD "have not yet been the object of academic treatment" e nessuno studio peer-reviewed ne ha definito o misurato gli effetti; il white paper AFD segnala un "notable gap" — nessuna metodologia tratta gli strumenti dell'agente (invece della spec) come origine del design.

**Fonti**
- agilemanifesto.org — https://agilemanifesto.org/
- Aalto / software-engineering-handbook — https://github.com/maniebra/software-engineering-handbook/blob/main/Methodologies/Agile/Agile.md
- Scrum.org "The Agile Values in Practice" — https://www.scrum.org/resources/blog/agile-values-practice
- Plant Engineering "Benefits of agile documentation" — https://www.plantengineering.com/benefits-of-agile-documentation-for-projects/
- PM World Journal "Agile Documentation: Finding the Right Balance" — https://pmworldjournal.com/article/agile-documentation-finding-the-right-balance
- Basecamp Shape Up, cap. 6 — https://basecamp.com/shapeup/1.5-chapter-06 ; cap. 7 — https://basecamp.com/shapeup/2.1-chapter-07
- Eveleens & Verhoef 2010 — https://research.vu.nl/en/publications/the-rise-and-fall-of-the-chaos-report-figures/ ; https://dl.acm.org/doi/abs/10.1109/MS.2009.154
- Boehm cost of change (sintesi e critica Bossavit/Wayne) — https://github.com/yPin9/Learning-with-Claude/blob/main/ai/spec_driven_development/06-cost-of-change-curve.md ; Waterloo slides https://student.cs.uwaterloo.ca/~se463/pdfSlides/10FCCslides.pdf
- Documentation debt (Ericsson) — https://ar5iv.labs.arxiv.org/html/2402.11048 ; https://ieeexplore.ieee.org/document/10207098
- Documentation drift report — https://doc.holiday/assets/2026-Documentation-Debt-Report-White-Paper.pdf
- Sean Grove "The New Code" — https://ai.engineer/talks/8rABwKRsec4-specifications-are-the-new-code ; https://github.com/yPin9/Learning-with-Claude/blob/main/ai/spec_driven_development/24-the-new-code.md ; critica waterfall https://eu.36kr.com/en/p/3388182127870345
- Zencoder — https://zencoder.ai/blog/spec-driven-development-why-vibe-coding-will-fail-the-next-generation-of-ai-engineers
- Tessl — https://tessl.io/blog/the-most-valuable-developer-skill-in-2025-writing-code-specifications/
- Prompt Crystallization — https://github.com/vprovorov/AgenticFuturism/blob/main/articles/prompt-crystallization.md
- SDD accademico — https://export.arxiv.org/pdf/2609.00252 ; https://zenodo.org/records/18649254/files/AFD_White_Paper_20260214_en.pdf
- Liste: npm @softcollie — https://registry.npmjs.org/@softcollie/vibecoding-docs-skill ; Scribd — https://www.scribd.com/document/1055397467/Vibe-Coding-Template-Pack ; wu-jackie — https://wu-jackie.github.io/2026/07/24/Vibe-Coding/ ; mackstroke — https://mackstroke.com/elementor-25809/ ; bighaeil — https://github.com/bighaeil/simple-vibe-coding-guide/blob/main/VIBE-CODING-CHECKLIST.md ; woodyxu — https://raw.githubusercontent.com/NeverSight/skills_feed/refs/heads/main/data/skills-md/woodyxu/vibe-coding-standard-workflow/vibe-coding-standard-workflow/SKILL.md ; spec-suite-skill — https://github.com/abdiel49/spec-suite-skill ; The Prompt Index — https://www.thepromptindex.com/prompt/1055-vibe-coding-documentation ; Crudely — https://www.producthunt.com/products/crudely ; Vooster — https://www.pymm.ai/en/blog/vooster-7-documents-guide ; ContextArk — https://contextark.com/blog/spec-driven-development-template ; Security Boulevard — https://securityboulevard.com/2026/06/9-prd-and-spec-templates-built-for-ai-coding-agents/ ; Spec Kit — https://github.com/github/spec-kit/tree/main/templates ; vibeworkflow — https://vibeworkflow.app/blog/ai-docs ; awslabs AI-DLC — https://github.com/awslabs/aidlc-workflows/blob/v1.0.1/docs/writing-inputs/inputs-quickstart.md ; GeeksforGeeks — https://www.geeksforgeeks.org/artificial-intelligence/implementation-plan-using-claude/ ; wavestone — https://github.com/wavestone-sa/agentic-spec-skills ; Microsoft Learn — https://learn.microsoft.com/en-us/training/modules/introduction-vibe-coding/5-identify-product-requirements-guidelines

---

## Meta e fonti

URL consultati (cresce con la raccolta).

Convenzioni:

- **verbatim** = citato dalla fonte, non riscritto.
- `[to verify]` = non confermato da una fonte letta: dire cosa manca, non inventare.
- I titoli di documento citati in inglese restano in inglese (sono nomi propri di artefatti); la prosa è in italiano.
