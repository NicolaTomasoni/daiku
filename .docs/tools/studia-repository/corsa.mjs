#!/usr/bin/env node
/**
 * corsa.mjs — l'attrezzo della skill `studia-repository`.
 *
 * Il ferro sta qui; il giudizio sta in `.claude/commands/studia-repository.md`.
 * Tre verbi, piu' il banco:
 *
 *   prepara  --lista <file> [--sezione "<titolo>"] [--nome <slug>] [<owner/repo> ...]
 *            Legge l'elenco, calcola gli slug e stampa il piano: quali target, dove
 *            atterra l'appunto di ciascuno, quale cartella. Non scrive niente.
 *
 *   apri     ...gli stessi argomenti di `prepara`
 *            Crea la cartella della corsa e ci scrive `corsa.json`: la fotografia
 *            dell'avvio, da cui il gate ricava l'elenco atteso e la freschezza.
 *
 *   verifica <cartella> [--appunti | --sintesi]
 *            Il gate: la forma degli appunti e della sintesi, la freschezza, i file
 *            estranei. Esce 1 al primo rosso, stampando tutti i rossi.
 *
 *   --self-check
 *            Il banco: i casi qui sotto piu' la scansione della cartella. Stampa
 *            {checks, passed, failed} ed esce 1 se qualcosa e' rosso.
 *
 * La radice del cantiere non si indovina: si ricava dal path di questo file, e il
 * verbo la usa solo per leggere `.daiku/project.json`, che e' l'unico posto in cui
 * la sede degli appunti e' dichiarata.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const RADICE = resolve(QUI, '..', '..', '..')

// --- La forma che il gate verifica alla lettera -------------------------------

const SEZIONI_APPUNTO = [
  '## Cosa fa, e come lo fa',
  '## Asse A — Daiku lo fa già, e loro lo fanno meglio?',
  '## Asse B — Daiku non lo fa, e si potrebbe aggiungere?',
  '## Evidenza',
  '## Domande aperte',
]

const CAMPI_APPUNTO = ['- **URL:**', '- **Licenza:**', '- **Ultimo commit:**', '- **Stelle:**', '- **Archivio:**', '- **Letto via:**']

const CAMPI_ASSI_A = ['- **In Daiku oggi:**', '- **Nel target:**', '- **Chi vince:**', '- **Proposta:**']
const CAMPI_ASSI_B = ['- **Capacità:**', '- **Nel target:**', '- **Proposta:**']

const SEZIONI_SINTESI = [
  '## Cosa hanno portato i target',
  '## Interventi approvati',
  '## Dove i target divergono, e chi vince',
  '## Cosa resta aperto',
  '## Limiti',
]

const CAMPI_SINTESI = ['- **Corsa:**', '- **Data:**', '- **Target studiati:**', '- **Esito:**']
const CAMPI_INTERVENTO = ['- **Cosa cambia:**', '- **Dove atterra:**', '- **Perché subito:**', '- **Senza tradeoff:**', '- **Da quale target:**']
// Le voci di "## Dove i target divergono, e chi vince": i tre campi che il documento dichiara.
const CAMPI_DIVERGENZA = ['- **Le soluzioni:**', '- **Chi vince:**', '- **Perché:**']

// Le feature non vivono nella sintesi: ognuna è un file, chiamato come il suo slug,
// in una sottocartella di `paths.features` col nome della corsa. Questi sono i suoi campi.
const CAMPI_FEATURE = ['- **Slug:**', '- **Cosa fa:**', '- **Dove atterra:**', '- **Come si costruisce:**', '- **Prompt per new-feature:**']
const ESITI = ['interventi', 'feature', 'entrambi', 'niente']

// Il testo di un divieto, tenuto a pezzi perche' la scansione del banco non trovi se stessa.
const VERBI_INSTALL = ['install', 'i', 'add', 'get']
const CHIAVI_INSTALL = ['npm', 'pnpm', 'yarn', 'bun', 'pip', 'pipx', 'cargo', 'go', 'winget', 'choco', 'scoop', 'gem']
const VERBO_CLONE = ['git', 'clone'].join(' ')

// --- Piccole utilita' ---------------------------------------------------------

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function slug(testo) {
  return String(testo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function slugTarget(nome) {
  return String(nome).toLowerCase()
    .replace(/\//g, '--')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-{3,}/g, '--')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/** I blocchi di un elenco: ogni titolo da `##` a `######`, col suo livello. */
function blocchiElenco(testo) {
  const out = []
  let cur = { livello: 0, titolo: null, righe: [] }
  for (const r of String(testo).split(/\r?\n/)) {
    const m = r.match(/^(#{2,6})\s+(.*?)\s*$/)
    if (m) { out.push(cur); cur = { livello: m[1].length, titolo: m[2], righe: [] } } else cur.righe.push(r)
  }
  out.push(cur)
  return out
}

/** Il corpo di una sezione di un elenco: fino al prossimo titolo di livello pari o superiore. */
function corpoSezione(bs, i) {
  const liv = bs[i].livello
  let j = i + 1
  while (j < bs.length && !(bs[j].titolo !== null && bs[j].livello <= liv)) j++
  const righe = [...bs[i].righe]
  for (let k = i + 1; k < j; k++) {
    if (bs[k].titolo !== null) righe.push('#'.repeat(bs[k].livello) + ' ' + bs[k].titolo)
    righe.push(...bs[k].righe)
  }
  return righe.join('\n')
}

/** I blocchi `## ` di un Markdown: `[{titolo, corpo}]`, il primo con `titolo: null`. */
function blocchi(testo) {
  const out = []
  let cur = { titolo: null, righe: [] }
  for (const r of String(testo).split(/\r?\n/)) {
    const m = r.match(/^##\s+(.*?)\s*$/)
    if (m) { out.push(cur); cur = { titolo: m[1], righe: [] } } else cur.righe.push(r)
  }
  out.push(cur)
  return out.map(s => ({ titolo: s.titolo, corpo: s.righe.join('\n').trim() }))
}

/** Le voci `### ` dentro un corpo: `[{titolo, corpo}]`. */
function sottoblocchi(corpo) {
  const out = []
  let cur = null
  for (const r of String(corpo).split(/\r?\n/)) {
    const m = r.match(/^###\s+(.*?)\s*$/)
    if (m) { if (cur) out.push(cur); cur = { titolo: m[1], righe: [] } } else if (cur) cur.righe.push(r)
  }
  if (cur) out.push(cur)
  return out.map(b => ({ titolo: b.titolo, corpo: b.righe.join('\n').trim() }))
}

/** I segnaposto `<...>` rimasti: quelli con `://` sono URL, non segnaposto. */
function segnaposti(testo) {
  return (String(testo).match(/<[^<>\n]{1,60}>/g) || []).filter(x => !x.includes('://'))
}

/** Un path locale, che un appunto non deve contenere: la prova sta nel repository, non sul disco. */
const PATH_LOCALE = /(?:[A-Za-z]:\\|\\\\[A-Za-z0-9]|%TEMP%|%USERPROFILE%|AppData|repo-intelligence)/

function campo(testo, etichetta) {
  return new RegExp('^' + esc(etichetta) + '\\s*\\S', 'm').test(testo)
}

function campoIn(corpo, elenco, rossi, dove) {
  for (const c of elenco) if (!campo(corpo, c)) rossi.push(`${dove}: manca o è vuoto il campo ${c}`)
}

/** La sezione il cui titolo, ricomposto, è quello atteso. */
function sezione(sez, attesa) {
  return sez.find(s => s.titolo !== null && `## ${s.titolo}` === attesa) || null
}

// --- L'elenco -----------------------------------------------------------------

/** Una riga d'elenco: `- [nome](https://github.com/owner/repo) — descrizione`. */
function rigaElenco(riga) {
  const m = String(riga).match(/^\s*[-*]\s+\[([^\]]*)\]\(([^)\s]+)\)\s*(?:[—–]\s*(.*))?$/)
  if (!m) return null
  const url = m[2].trim().replace(/\/+$/, '').replace(/\.git$/, '')
  const g = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)$/i)
  if (!g) return { errore: `riga non GitHub: ${String(riga).trim()}` }
  return { nome: `${g[1]}/${g[2]}`, url: `https://github.com/${g[1]}/${g[2]}`, descrizione: (m[3] || '').trim() }
}

function targetDaArgomento(t) {
  const g = String(t).replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').replace(/\.git$/, '').match(/^([^/\s]+)\/([^/\s]+)$/)
  if (!g) return null
  return { nome: `${g[1]}/${g[2]}`, url: `https://github.com/${g[1]}/${g[2]}`, descrizione: '' }
}

/**
 * Risolve l'input in un elenco di target. Non scrive niente e non indovina niente:
 * un target che non è GitHub, una sezione che non esiste, una collisione di slug
 * fermano qui, prima che parta una corsa sola.
 */
function leggiElenco(o) {
  if (o.targets.length) {
    const target = []
    for (const t of o.targets) {
      const v = targetDaArgomento(t)
      if (!v) return { ok: false, errore: `target non riconosciuto: ${t} (serve owner/repo o un URL GitHub)` }
      target.push(v)
    }
    return { ok: true, target, sezione: null, lista: null }
  }
  if (!o.lista) return { ok: false, errore: 'serve --lista <file>, una sezione di quel file, o almeno un target owner/repo' }
  if (!existsSync(o.lista)) return { ok: false, errore: `elenco non trovato: ${o.lista}` }
  const testoElenco = readFileSync(o.lista, 'utf8')
  const sezioni = blocchiElenco(testoElenco)
  const titoli = sezioni.filter(s => s.titolo !== null).map(s => `"${s.titolo}"`)
  let utili = [{ titolo: null, corpo: testoElenco }]
  let sezione = null
  if (o.sezione) {
    const i = sezioni.findIndex(s => s.titolo !== null && s.titolo.toLowerCase() === o.sezione.trim().toLowerCase())
    if (i === -1) return { ok: false, errore: `sezione non trovata: "${o.sezione}". Nel file: ${titoli.join(', ') || 'nessuna sezione'}` }
    utili = [{ titolo: sezioni[i].titolo, corpo: corpoSezione(sezioni, i) }]
    sezione = sezioni[i].titolo
  }
  const target = []
  for (const s of utili) {
    for (const r of s.corpo.split(/\r?\n/)) {
      if (!/^\s*[-*]\s+\[/.test(r)) continue
      const v = rigaElenco(r)
      if (!v) return { ok: false, errore: `riga d'elenco illeggibile: ${r.trim()}` }
      if (v.errore) return { ok: false, errore: v.errore }
      target.push(v)
    }
  }
  if (!target.length) return { ok: false, errore: sezione ? `la sezione "${sezione}" non ha righe d'elenco` : "l'elenco non ha righe d'elenco (`- [owner/repo](url) — descrizione`)" }
  return { ok: true, target, sezione, lista: o.lista }
}

function conSlug(target) {
  const visti = new Map()
  for (const t of target) {
    t.slug = slugTarget(t.nome)
    t.appunto = `appunti/${t.slug}.md`
    if (visti.has(t.slug)) return { ok: false, errore: `due target collassano sullo stesso appunto: ${visti.get(t.slug)} e ${t.nome} → ${t.slug}` }
    visti.set(t.slug, t.nome)
  }
  return { ok: true, target }
}

/** Il nome della corsa: `--nome`, altrimenti il titolo della sezione, altrimenti il file. */
function nomeCorsa(o, elenco) {
  if (o.nome) return slug(o.nome)
  if (elenco.sezione) return slug(elenco.sezione)
  if (elenco.lista) return slug(basename(elenco.lista).replace(/\.[^.]+$/, ''))
  return ''
}

function piano(o) {
  const elenco = leggiElenco(o)
  if (!elenco.ok) return elenco
  const con = conSlug(elenco.target)
  if (!con.ok) return con
  const nome = nomeCorsa(o, elenco)
  if (!nome) return { ok: false, errore: "serve --nome <slug>: senza una lista e senza una sezione non c'è niente da cui ricavare il nome della corsa" }
  return { ok: true, nome, sezione: elenco.sezione, lista: elenco.lista, target: elenco.target }
}

// --- La sede ------------------------------------------------------------------

/** La radice del cantiere e la sede degli appunti, letta da `.daiku/project.json`. */
function progetto() {
  const p = join(RADICE, '.daiku', 'project.json')
  if (!existsSync(p)) return { ok: false, errore: `nessun .daiku/project.json sotto ${RADICE}: non è la radice del cantiere` }
  let cfg
  try { cfg = JSON.parse(readFileSync(p, 'utf8')) } catch (e) { return { ok: false, errore: `.daiku/project.json illeggibile: ${e.message}` } }
  const studies = cfg && cfg.paths && cfg.paths.studies
  const features = cfg && cfg.paths && cfg.paths.features
  const code = cfg && cfg.code_root
  if (!studies) return { ok: false, errore: '.daiku/project.json non dichiara paths.studies' }
  if (!features) return { ok: false, errore: '.daiku/project.json non dichiara paths.features' }
  return {
    ok: true,
    studies: String(studies).replace(/\\/g, '/'),
    sede: join(RADICE, studies),
    features: String(features).replace(/\\/g, '/'),
    sedeFeatures: join(RADICE, features),
    code: code ? String(code).replace(/\\/g, '/') : null,
  }
}

// --- Il gate ------------------------------------------------------------------

/**
 * La forma di un appunto. Ritorna i rossi di quel target; lista vuota vuol dire
 * che l'appunto c'è, è fresco ed è completo.
 */
function controllaAppunto(file, mtimeCorsa, nome) {
  const rossi = []
  if (!existsSync(file)) return [`${nome}: appunto mancante (${file})`]
  const testo = readFileSync(file, 'utf8')
  if (!testo.trim()) return [`${nome}: appunto vuoto`]
  if (statSync(file).mtimeMs < mtimeCorsa) rossi.push(`${nome}: appunto più vecchio dell'avvio della corsa`)
  if (!/^#\s+\S/m.test(testo)) rossi.push(`${nome}: manca il titolo (# …)`)
  for (const c of CAMPI_APPUNTO) if (!campo(testo, c)) rossi.push(`${nome}: manca o è vuoto il campo ${c}`)

  const sez = blocchi(testo)
  const indici = SEZIONI_APPUNTO.map(a => sez.findIndex(s => s.titolo !== null && `## ${s.titolo}` === a))
  indici.forEach((i, k) => { if (i === -1) rossi.push(`${nome}: manca la sezione "${SEZIONI_APPUNTO[k]}"`) })
  if (indici.every(i => i >= 0)) {
    for (let k = 1; k < indici.length; k++) if (indici[k] < indici[k - 1]) { rossi.push(`${nome}: le sezioni non sono nell'ordine dichiarato`); break }
  }

  const a = sezione(sez, SEZIONI_APPUNTO[1])
  const b = sezione(sez, SEZIONI_APPUNTO[2])
  const ev = sezione(sez, SEZIONI_APPUNTO[3])
  const ap = sezione(sez, SEZIONI_APPUNTO[4])
  for (const s of [a, b, ev, ap]) if (s && !s.corpo) rossi.push(`${nome}: la sezione "## ${s.titolo}" è vuota`)

  if (a) {
    const voci = sottoblocchi(a.corpo)
    if (!voci.length) { if (!/^Nessuna\.$/m.test(a.corpo)) rossi.push(`${nome}: l'Asse A non ha voci e non dice "Nessuna."`) }
    else voci.forEach((v, k) => campoIn(v.corpo, CAMPI_ASSI_A, rossi, `${nome}: Asse A voce ${k + 1}`))
  }
  if (b) {
    const voci = sottoblocchi(b.corpo)
    if (!voci.length) { if (!/^Nessuna\.$/m.test(b.corpo)) rossi.push(`${nome}: l'Asse B non ha voci e non dice "Nessuna."`) }
    else voci.forEach((v, k) => campoIn(v.corpo, CAMPI_ASSI_B, rossi, `${nome}: Asse B voce ${k + 1}`))
  }
  if (ev) {
    const righe = ev.corpo.split(/\r?\n/).filter(r => /^\s*\|/.test(r))
    if (righe.length < 3) rossi.push(`${nome}: la tabella dell'Evidenza ha meno di una riga di dati`)
  }
  if (PATH_LOCALE.test(testo)) rossi.push(`${nome}: l'appunto cita un path locale — la prova sta nel repository, non sul disco`)
  const seg = segnaposti(testo)
  if (seg.length) rossi.push(`${nome}: segnaposto rimasti: ${seg.join(' ')}`)
  return rossi
}

/**
 * La forma della cartella delle feature di una corsa: un file `.md` per feature,
 * chiamato come il suo slug, coi cinque campi. Ritorna quante feature ci sono —
 * `0` se la cartella non esiste, che è una corsa senza feature e non un rosso.
 */
function controllaFeature(cartellaFeatures, rossi) {
  if (!cartellaFeatures || !existsSync(cartellaFeatures)) return 0
  let n = 0
  for (const voce of readdirSync(cartellaFeatures)) {
    const file = join(cartellaFeatures, voce)
    if (statSync(file).isDirectory()) { rossi.push(`feature: "${voce}" è una cartella, non un file di feature`); continue }
    if (!voce.endsWith('.md')) { rossi.push(`feature: file estraneo nella cartella delle feature: ${voce}`); continue }
    n++
    const testo = readFileSync(file, 'utf8')
    if (!testo.trim()) { rossi.push(`feature ${voce}: file vuoto`); continue }
    if (!/^#\s+\S/m.test(testo)) rossi.push(`feature ${voce}: manca il titolo (# …)`)
    for (const c of CAMPI_FEATURE) if (!campo(testo, c)) rossi.push(`feature ${voce}: manca o è vuoto il campo ${c}`)
    const slug = (testo.match(/^-\s*\*\*Slug:\*\*\s*(\S+)/m) || [])[1]
    if (slug && `${slug}.md` !== voce) rossi.push(`feature ${voce}: il nome del file non è "<slug>.md"`)
    const seg = segnaposti(testo)
    if (seg.length) rossi.push(`feature ${voce}: segnaposto rimasti: ${seg.join(' ')}`)
    if (PATH_LOCALE.test(testo)) rossi.push(`feature ${voce}: cita un path locale`)
  }
  return n
}

/**
 * La forma della sintesi. `assenti` sono i target senza appunto valido;
 * `nFeature` quante feature ha prodotto la corsa, lette dalla loro cartella.
 */
function controllaSintesi(file, target, assenti, rossi, nFeature) {
  if (!existsSync(file)) { rossi.push(`sintesi mancante (${file})`); return }
  const testo = readFileSync(file, 'utf8')
  if (!testo.trim()) { rossi.push('sintesi vuota'); return }
  if (!/^#\s+\S/m.test(testo)) rossi.push('sintesi: manca il titolo (# …)')
  for (const c of CAMPI_SINTESI) if (!campo(testo, c)) rossi.push(`sintesi: manca o è vuoto il campo ${c}`)

  const sez = blocchi(testo)
  const indici = SEZIONI_SINTESI.map(a => sez.findIndex(s => s.titolo !== null && `## ${s.titolo}` === a))
  indici.forEach((i, k) => { if (i === -1) rossi.push(`sintesi: manca la sezione "${SEZIONI_SINTESI[k]}"`) })
  if (indici.every(i => i >= 0)) {
    for (let k = 1; k < indici.length; k++) if (indici[k] < indici[k - 1]) { rossi.push('sintesi: le sezioni non sono nell\'ordine dichiarato'); break }
  }

  const portati = sezione(sez, SEZIONI_SINTESI[0])
  const interventi = sezione(sez, SEZIONI_SINTESI[1])
  const divergono = sezione(sez, SEZIONI_SINTESI[2])
  const restaperto = sezione(sez, SEZIONI_SINTESI[3])
  const limiti = sezione(sez, SEZIONI_SINTESI[4])

  for (const s of [portati, interventi, divergono, restaperto, limiti]) if (s && !s.corpo) rossi.push(`sintesi: la sezione "## ${s.titolo}" è vuota`)

  if (portati && limiti) {
    for (const t of target) {
      const dove = `${t.nome}`
      if (assenti.includes(dove)) {
        if (!limiti.corpo.includes(dove)) rossi.push(`sintesi: ${dove} non ha appunto e non è nominato in "Limiti"`)
      } else if (!portati.corpo.includes(dove) && !limiti.corpo.includes(dove)) {
        rossi.push(`sintesi: ${dove} non è nominato in "Cosa hanno portato i target"`)
      }
    }
  }

  const haInterventi = interventi ? sottoblocchi(interventi.corpo).length > 0 : false
  const haFeature = nFeature > 0

  if (interventi) {
    if (haInterventi) sottoblocchi(interventi.corpo).forEach((v, k) => campoIn(v.corpo, CAMPI_INTERVENTO, rossi, `sintesi: intervento ${k + 1}`))
    else if (!/^Nessuno\.$/m.test(interventi.corpo)) rossi.push('sintesi: "Interventi approvati" non ha voci e non dice "Nessuno."')
  }
  if (divergono) {
    const voci = sottoblocchi(divergono.corpo)
    if (!voci.length) { if (!/^Nessuno\.$/m.test(divergono.corpo)) rossi.push('sintesi: "Dove i target divergono" non ha voci e non dice "Nessuno."') }
    else voci.forEach((v, k) => campoIn(v.corpo, CAMPI_DIVERGENZA, rossi, `sintesi: divergenza ${k + 1}`))
  }

  const esito = (testo.match(/^-\s*\*\*Esito:\*\*\s*(\S+)/m) || [])[1]
  if (esito && !ESITI.includes(esito)) rossi.push(`sintesi: l'esito "${esito}" non è fra ${ESITI.join('|')}`)
  if (esito) {
    const atteso = haInterventi && haFeature ? 'entrambi' : haInterventi ? 'interventi' : haFeature ? 'feature' : 'niente'
    if (esito !== atteso) rossi.push(`sintesi: l'esito dichiara "${esito}" ma le sezioni ne fanno "${atteso}"`)
  }

  const seg = segnaposti(testo)
  if (seg.length) rossi.push(`sintesi: segnaposto rimasti: ${seg.join(' ')}`)
  if (PATH_LOCALE.test(testo)) rossi.push('sintesi: cita un path locale')
}

/**
 * Il rientro: ogni target studiato lascia una voce in fondo a "## Inspirations" del README di
 * prodotto, e non è più nell'elenco da cui la corsa è partita. `readme` e `lista` sono path
 * assoluti; `lista` è `null` quando la corsa non è partita da un elenco.
 */
function controllaRientro(readme, lista, target, rossi) {
  if (!readme) return
  if (!existsSync(readme)) { rossi.push(`rientro: manca il README di prodotto (${readme})`); return }
  const testo = readFileSync(readme, 'utf8')
  const testate = [...testo.matchAll(/^##\s+Inspirations\s*$/gm)]
  if (!testate.length) { rossi.push('rientro: il README di prodotto non ha la sezione "## Inspirations"'); return }
  const coda = testo.slice(testate[testate.length - 1].index)
  const elenco = lista && existsSync(lista) ? readFileSync(lista, 'utf8') : null
  for (const t of target) {
    if (!coda.includes(t.url)) rossi.push(`rientro: ${t.nome} non è in fondo alla sezione "## Inspirations" del README di prodotto`)
    if (elenco && elenco.includes(t.url)) rossi.push(`rientro: ${t.nome} è ancora nell'elenco da studiare`)
  }
}

/**
 * Il gate di una corsa. `modalita` è `appunti`, `sintesi` o `null` (tutto);
 * `cartellaFeatures` è la cartella delle feature della corsa, che vive fuori da
 * quella della corsa (`null` quando non si sa: le feature non si guardano);
 * `readme` è il README di prodotto, dove ogni target deve essere rientrato.
 */
function verificaCartella(cartella, modalita = null, cartellaFeatures = null, readme = null) {
  const pj = join(cartella, 'corsa.json')
  if (!existsSync(pj)) return { ok: false, rossi: [`corsa.json mancante in ${cartella}`] }
  let m
  try { m = JSON.parse(readFileSync(pj, 'utf8')) } catch (e) { return { ok: false, rossi: [`corsa.json illeggibile: ${e.message}`] } }
  if (!Array.isArray(m.target) || !m.target.length) return { ok: false, rossi: ['corsa.json non elenca nessun target'] }

  const rossi = []
  const mtimeCorsa = statSync(pj).mtimeMs
  const attesi = m.target.map(t => ({ nome: t.nome, url: t.url, slug: t.slug, appunto: t.appunto || `appunti/${t.slug}.md` }))
  const perTarget = attesi.map(t => ({ t, errori: controllaAppunto(join(cartella, t.appunto), mtimeCorsa, t.nome) }))
  const assenti = perTarget.filter(x => x.errori.length).map(x => x.t.nome)

  // Un target senza appunto valido è un gap dichiarato solo se la sintesi lo nomina
  // in "Limiti". Il gate intermedio (`--appunti`) non ammette la dichiarazione: lì un
  // appunto mancante è rosso e basta, ed è ciò che fa rilanciare il subagent.
  const sintesiFile = join(cartella, 'sintesi.md')
  let limitiCorpo = ''
  if (existsSync(sintesiFile)) {
    const s = sezione(blocchi(readFileSync(sintesiFile, 'utf8')), SEZIONI_SINTESI[4])
    limitiCorpo = s ? s.corpo : ''
  }

  if (modalita !== 'sintesi') {
    for (const x of perTarget) {
      if (modalita === 'appunti' || !limitiCorpo.includes(x.t.nome)) rossi.push(...x.errori)
    }
    const ammessi = new Set(['corsa.json', 'sintesi.md', ...attesi.map(t => t.appunto.replace(/\\/g, '/'))])
    for (const voce of readdirSync(cartella)) {
      if (voce === 'appunti') {
        for (const f of readdirSync(join(cartella, 'appunti'))) if (!ammessi.has(`appunti/${f}`)) rossi.push(`file estraneo nella corsa: appunti/${f}`)
      } else if (!ammessi.has(voce)) rossi.push(`file estraneo nella corsa: ${voce}`)
    }
  }
  let nFeature = 0
  if (modalita !== 'appunti') nFeature = controllaFeature(cartellaFeatures, rossi)
  if (modalita !== 'appunti') controllaSintesi(join(cartella, 'sintesi.md'), attesi, assenti, rossi, nFeature)
  if (modalita !== 'appunti') controllaRientro(readme, m.lista ? resolve(RADICE, m.lista) : null, attesi, rossi)
  return { ok: rossi.length === 0, rossi }
}

// --- I verbi ------------------------------------------------------------------

function esci(codice, messaggio) {
  if (messaggio) console.error(messaggio)
  process.exit(codice)
}

function opzioni(args) {
  const o = { lista: null, sezione: null, nome: null, targets: [], modalita: null }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--lista' || a === '--sezione' || a === '--nome') {
      const v = args[++i]
      if (v === undefined) throw new Error(`${a} vuole un valore`)
      o[a.slice(2)] = v
    } else if (a === '--appunti') o.modalita = 'appunti'
    else if (a === '--sintesi') o.modalita = 'sintesi'
    else if (a.startsWith('--')) throw new Error(`opzione non riconosciuta: ${a}`)
    else o.targets.push(a)
  }
  return o
}

function cmdPrepara(o) {
  const p = piano(o)
  if (!p.ok) return esci(2, p.errore)
  const cfg = progetto()
  if (!cfg.ok) return esci(2, cfg.errore)
  console.log(`corsa:    ${p.nome}`)
  console.log(`cartella: ${cfg.studies}/${p.nome}/`)
  if (p.lista) console.log(`lista:    ${p.lista}${p.sezione ? `   sezione: ${p.sezione}` : ''}`)
  console.log(`target:   ${p.target.length}`)
  for (const t of p.target) console.log(`  ${t.nome}  →  ${t.appunto}${t.descrizione ? `   — ${t.descrizione}` : ''}`)
  console.log(JSON.stringify({
    corsa: p.nome,
    cartella: `${cfg.studies}/${p.nome}`,
    lista: p.lista,
    sezione: p.sezione,
    target: p.target.map(t => ({ nome: t.nome, url: t.url, slug: t.slug, appunto: t.appunto })),
  }, null, 2))
  return 0
}

function cmdApri(o) {
  const p = piano(o)
  if (!p.ok) return esci(2, p.errore)
  const cfg = progetto()
  if (!cfg.ok) return esci(2, cfg.errore)
  const cartella = join(cfg.sede, p.nome)
  const cartellaFeatures = join(cfg.sedeFeatures, p.nome)
  mkdirSync(join(cartella, 'appunti'), { recursive: true })
  mkdirSync(cartellaFeatures, { recursive: true })
  const ora = new Date()
  const manifest = {
    corsa: p.nome,
    data: ora.toISOString().slice(0, 10),
    avvio: ora.toISOString(),
    lista: p.lista,
    sezione: p.sezione,
    target: p.target.map(t => ({ nome: t.nome, url: t.url, descrizione: t.descrizione, slug: t.slug, appunto: t.appunto })),
    attrezzo: { node: process.version },
  }
  writeFileSync(join(cartella, 'corsa.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`corsa aperta: ${cfg.studies}/${p.nome}/`)
  for (const t of p.target) console.log(`  appunto: ${cfg.studies}/${p.nome}/${t.appunto}   (${t.nome})`)
  console.log(`  sintesi: ${cfg.studies}/${p.nome}/sintesi.md`)
  console.log(`  feature: ${cfg.features}/${p.nome}/`)
  return 0
}

function cmdVerifica(args) {
  const o = opzioni(args)
  const cartella = o.targets[0]
  if (!cartella) return esci(2, 'verifica vuole la cartella della corsa: verifica <cartella> [--appunti|--sintesi]')
  if (o.targets.length > 1) return esci(2, `verifica vuole una sola cartella, non ${o.targets.length}`)
  const cfg = progetto()
  const cartellaFeatures = cfg.ok ? join(cfg.sedeFeatures, basename(resolve(cartella))) : null
  const readme = cfg.ok && cfg.code ? join(RADICE, cfg.code, 'README.md') : null
  const r = verificaCartella(cartella, o.modalita, cartellaFeatures, readme)
  if (r.ok) { console.log(`ok — ${cartella}${o.modalita ? ` (${o.modalita})` : ''}`); return 0 }
  for (const x of r.rossi) console.error(`rosso: ${x}`)
  console.error(`\n${r.rossi.length} rossi in ${cartella}`)
  return 1
}

// --- Il banco -----------------------------------------------------------------

const casi = []
function caso(nome, fn) { casi.push({ nome, fn }) }

function nuovaCartella(nome) {
  const dir = join(tmpdir(), `daiku-corsa-banco-${process.pid}-${nome}`)
  for (const p of [dir, featureDir(dir), readmeFinto(dir), `${dir}-lista.md`]) rmSync(p, { recursive: true, force: true })
  mkdirSync(join(dir, 'appunti'), { recursive: true })
  return dir
}

/** Nel banco la cartella delle feature, il README di prodotto e l'elenco stanno fuori dalla corsa. */
function featureDir(dir) { return `${dir}-feature` }
function readmeFinto(dir) { return `${dir}-readme.md` }

function scriviCorsa(dir, target, lista = null) {
  const manifest = {
    corsa: 'banco', data: '2026-10-03', avvio: new Date().toISOString(), lista, sezione: null,
    target: target.map(n => ({ nome: n, url: `https://github.com/${n}`, slug: slugTarget(n), appunto: `appunti/${slugTarget(n)}.md` })),
    attrezzo: { node: process.version },
  }
  writeFileSync(join(dir, 'corsa.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

function appuntoBuono(nome, { asseA = 'voce', asseB = 'Nessuna.', vuota = null, segnaposto = false, pathLocale = false, senzaCampo = null } = {}) {
  const a = asseA === 'voce'
    ? `### A1 — Il gate\n\n- **In Daiku oggi:** plugins/daiku/hooks/hooks.json\n- **Nel target:** un gate più stretto\n- **Chi vince:** target\n- **Proposta:** stringere il gate in hooks.json`
    : 'Nessuna.'
  const b = asseB === 'voce'
    ? `### B1 — La memoria\n\n- **Capacità:** una memoria persistente\n- **Nel target:** un indice\n- **Proposta:** una feature in skills/memoria/SKILL.md`
    : 'Nessuna.'
  const testo = `# ${nome} — un harness di prova

- **URL:** https://github.com/${nome}
- **Licenza:** MIT
- **Ultimo commit:** 2026-09-01
- **Stelle:** 100
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Un harness che fa cose${pathLocale ? ' in C:\\dev\\roba' : ''}${segnaposto ? ' e <titolo> da riempire' : ''}.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

${vuota === 'a' ? '' : a}

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

${vuota === 'b' ? '' : b}

## Evidenza

| path | estratto |
|---|---|
| src/gate.ts | nega il comando |

## Domande aperte

Nessuna.
`
  return senzaCampo ? testo.replace(`- **${senzaCampo}:** ${senzaCampo === 'Licenza' ? 'MIT' : senzaCampo === 'URL' ? `https://github.com/${nome}` : senzaCampo === 'Stelle' ? '100' : senzaCampo === 'Archivio' ? 'no' : senzaCampo === 'Letto via' ? 'api' : '2026-09-01'}\n`, '') : testo
}

/** Un file di feature, come ne deposita l'orchestratore: `# …` e i cinque campi. */
function featureBuona(slug) {
  return `# La memoria\n\n- **Slug:** ${slug}\n- **Cosa fa:** un indice delle memorie\n- **Dove atterra:** plugins/daiku/skills/memoria/SKILL.md\n- **Come si costruisce:** una skill nuova\n- **Prompt per new-feature:** /daiku:new-feature apri la feature memoria\n`
}

function sintesiBuona(nome, target, { interventi = true, feature = false, esito = null, senzaTarget = false, segnaposto = false, senzaSezione = null, divergenze = null } = {}) {
  const int = interventi ? `### I1 — Stringere il gate\n\n- **Cosa cambia:** la riga del gate\n- **Dove atterra:** plugins/daiku/hooks/hooks.json\n- **Perché subito:** non decide niente, allinea una riga\n- **Senza tradeoff:** non costa niente, allinea una riga\n- **Da quale target:** ${target[0]}` : 'Nessuno.'
  const e = esito || (interventi && feature ? 'entrambi' : interventi ? 'interventi' : feature ? 'feature' : 'niente')
  const elenco = senzaTarget ? '' : target.map(t => `- ${t} — un gate più stretto.`).join('\n')
  const sez = {
    portati: `## Cosa hanno portato i target\n\n${elenco || 'Nessuno.'}\n`,
    divergono: `## Dove i target divergono, e chi vince\n\n${divergenze || 'Nessuno.'}\n`,
    aperti: '## Cosa resta aperto\n\nNessuna.\n',
    limiti: '## Limiti\n\nNessuna.\n',
  }
  return `# banco${segnaposto ? ' <titolo>' : ''}

- **Corsa:** banco
- **Data:** 2026-10-03
- **Target studiati:** ${target.length}
- **Esito:** ${e}

${sez.portati}
${senzaSezione === 'Interventi approvati' ? '' : `## Interventi approvati\n\n${int}\n`}
${sez.divergono}
${senzaSezione === 'Cosa resta aperto' ? '' : sez.aperti}
${sez.limiti}`
}

function verde(dir, modalita = null) {
  const r = verificaCartella(dir, modalita, featureDir(dir), readmeFinto(dir))
  if (!r.ok) throw new Error(`atteso verde, è rosso: ${r.rossi[0]}`)
}

function rosso(dir, modalita = null) {
  const r = verificaCartella(dir, modalita, featureDir(dir), readmeFinto(dir))
  if (r.ok) throw new Error('atteso rosso, è verde')
  return r.rossi
}

function corsaFinta(nome, target, appunti, sintesi, features = {}) {
  const dir = nuovaCartella(nome)
  const lista = `${dir}-lista.md`
  writeFileSync(lista, '# elenco da studiare\n')
  const m = scriviCorsa(dir, target, lista)
  for (const t of m.target) {
    const testo = appunti[t.nome]
    if (testo !== undefined) writeFileSync(join(dir, t.appunto), testo)
  }
  if (sintesi !== null && sintesi !== undefined) writeFileSync(join(dir, 'sintesi.md'), sintesi)
  mkdirSync(featureDir(dir), { recursive: true })
  for (const [slug, testo] of Object.entries(features)) writeFileSync(join(featureDir(dir), `${slug}.md`), testo)
  // Il rientro: il README di prodotto porta le voci dei target in fondo a "## Inspirations".
  writeFileSync(readmeFinto(dir), `# Prodotto\n\n## Why\n\ntesto\n\n## Inspirations\n\nDaiku stands on the shoulders of public work:\n\n${m.target.map(t => `- [${t.nome}](${t.url}) — un progetto studiato`).join('\n')}\n`)
  return dir
}

function banco() {
  const A = 'a/uno'
  const B = 'b/due'

  caso('slug del titolo', () => {
    if (slug('Compaction e finestra di contesto') !== 'compaction-e-finestra-di-contesto') throw new Error(slug('Compaction e finestra di contesto'))
  })
  caso('slug del target', () => {
    if (slugTarget('NicolaTomasoni/daiku') !== 'nicolatomasoni--daiku') throw new Error(slugTarget('NicolaTomasoni/daiku'))
    if (slugTarget('affaan-m/ECC') !== 'affaan-m--ecc') throw new Error(slugTarget('affaan-m/ECC'))
  })

  caso('elenco letto per intero', () => {
    const f = join(nuovaCartella('lista'), 'elenco.md')
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, '## Uno\n\n- [a/uno](https://github.com/a/uno) — primo\n- [b/due](https://github.com/b/due) — secondo\n\n## Due\n\n- [c/tre](https://github.com/c/tre)\n')
    const r = leggiElenco(opzioni(['--lista', f]))
    if (!r.ok) throw new Error(r.errore)
    if (r.target.length !== 3) throw new Error(`attesi 3, letti ${r.target.length}`)
    if (r.target[0].descrizione !== 'primo') throw new Error(r.target[0].descrizione)
  })
  caso('elenco per sezione', () => {
    const f = join(nuovaCartella('lista2'), 'elenco.md')
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, '## Uno\n\n- [a/uno](https://github.com/a/uno) — primo\n\n## Due\n\n- [c/tre](https://github.com/c/tre) — terzo\n')
    const r = leggiElenco(opzioni(['--lista', f, '--sezione', 'due']))
    if (!r.ok) throw new Error(r.errore)
    if (r.target.length !== 1 || r.target[0].nome !== 'c/tre') throw new Error(JSON.stringify(r.target))
    if (r.sezione !== 'Due') throw new Error(r.sezione)
  })
  caso('sezione inesistente → rosso', () => {
    const f = join(nuovaCartella('lista3'), 'elenco.md')
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, '## Uno\n\n- [a/uno](https://github.com/a/uno)\n')
    const r = leggiElenco(opzioni(['--lista', f, '--sezione', 'tre']))
    if (r.ok) throw new Error('atteso rosso')
  })
  caso('riga non GitHub → rosso', () => {
    const f = join(nuovaCartella('lista4'), 'elenco.md')
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, '- [x](https://gitlab.com/a/uno)\n')
    const r = leggiElenco(opzioni(['--lista', f]))
    if (r.ok) throw new Error('atteso rosso')
  })
  caso('due target sullo stesso slug → rosso', () => {
    const r = conSlug([{ nome: 'a/uno', url: '', descrizione: '' }, { nome: 'A/UNO', url: '', descrizione: '' }])
    if (r.ok) throw new Error('atteso rosso')
  })
  caso('nessun elenco → rosso', () => {
    if (piano(opzioni([])).ok) throw new Error('atteso rosso')
  })

  caso('appunto buono → verde', () => {
    const dir = corsaFinta('buono', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    verde(dir)
  })
  caso('appunto mancante → rosso', () => {
    const dir = corsaFinta('mancante', [A], {}, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('appunto vuoto → rosso', () => {
    const dir = corsaFinta('vuoto', [A], { [A]: '   \n' }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('appunto vecchio → rosso', () => {
    const dir = corsaFinta('vecchio', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    const vecchio = new Date(Date.now() - 3600_000)
    utimesSync(join(dir, 'appunti', `${slugTarget(A)}.md`), vecchio, vecchio)
    rosso(dir, 'appunti')
  })
  caso('sezione fuori ordine → rosso', () => {
    const t = appuntoBuono(A)
    const rotto = t.replace('## Cosa fa, e come lo fa', '## Domande aperte')
    const dir = corsaFinta('ordine', [A], { [A]: rotto }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('sezione vuota → rosso', () => {
    const dir = corsaFinta('vuota', [A], { [A]: appuntoBuono(A, { vuota: 'a' }) }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('campo mancante → rosso', () => {
    const dir = corsaFinta('campo', [A], { [A]: appuntoBuono(A, { senzaCampo: 'Licenza' }) }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('asse A senza Chi vince → rosso', () => {
    const t = appuntoBuono(A).replace('- **Chi vince:** target\n', '')
    const dir = corsaFinta('chivince', [A], { [A]: t }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('asse B senza Proposta → rosso', () => {
    const t = appuntoBuono(A, { asseB: 'voce' }).replace('- **Proposta:** una feature in skills/memoria/SKILL.md\n', '')
    const dir = corsaFinta('proposta', [A], { [A]: t }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('asse senza voci né "Nessuna." → rosso', () => {
    const t = appuntoBuono(A).replace('## Asse B — Daiku non lo fa, e si potrebbe aggiungere?\n\nNessuna.', '## Asse B — Daiku non lo fa, e si potrebbe aggiungere?\n\nniente da dire')
    const dir = corsaFinta('nessuna', [A], { [A]: t }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('segnaposto → rosso', () => {
    const dir = corsaFinta('segnaposto', [A], { [A]: appuntoBuono(A, { segnaposto: true }) }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('path locale → rosso', () => {
    const dir = corsaFinta('pathlocale', [A], { [A]: appuntoBuono(A, { pathLocale: true }) }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('evidenza senza righe → rosso', () => {
    const t = appuntoBuono(A).replace('| path | estratto |\n|---|---|\n| src/gate.ts | nega il comando |', 'vuota')
    const dir = corsaFinta('evidenza', [A], { [A]: t }, sintesiBuona('banco', [A]))
    rosso(dir, 'appunti')
  })
  caso('appunto estraneo nella cartella → rosso', () => {
    const dir = corsaFinta('estraneo', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    writeFileSync(join(dir, 'appunti', 'altro.md'), appuntoBuono('c/tre'))
    rosso(dir, 'appunti')
  })

  caso('sintesi buona → verde', () => {
    const dir = corsaFinta('sintesibuona', [A, B], { [A]: appuntoBuono(A), [B]: appuntoBuono(B) }, sintesiBuona('banco', [A, B]))
    verde(dir, 'sintesi')
  })
  caso('sintesi mancante → rosso', () => {
    const dir = corsaFinta('sintesimancante', [A], { [A]: appuntoBuono(A) }, null)
    rosso(dir, 'sintesi')
  })
  caso('sintesi senza una sezione → rosso', () => {
    const dir = corsaFinta('sintesisezione', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { senzaSezione: 'Cosa resta aperto' }))
    rosso(dir, 'sintesi')
  })
  caso('sintesi che non nomina un target → rosso', () => {
    const dir = corsaFinta('sintesitarget', [A, B], { [A]: appuntoBuono(A), [B]: appuntoBuono(B) }, sintesiBuona('banco', [A, B], { senzaTarget: true }))
    rosso(dir, 'sintesi')
  })
  caso('divergenza con i tre campi → verde', () => {
    const d = '### D1 — Il gate\n\n- **Le soluzioni:** uno stringe il gate, l\'altro lo lascia\n- **Chi vince:** ibrido\n- **Perché:** tiene il meglio dei due'
    const dir = corsaFinta('divergenzabuona', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { divergenze: d }))
    verde(dir, 'sintesi')
  })
  caso('divergenza senza il criterio → rosso', () => {
    const d = '### D1 — Il gate\n\n- **Le soluzioni:** uno stringe il gate\n- **Chi vince:** ibrido'
    const dir = corsaFinta('divergenzacampo', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { divergenze: d }))
    rosso(dir, 'sintesi')
  })
  caso('esito incoerente con le sezioni → rosso', () => {
    const dir = corsaFinta('esito', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true, esito: 'interventi' }), { memoria: featureBuona('memoria') })
    rosso(dir, 'sintesi')
  })
  caso('esito coerente → verde', () => {
    const dir = corsaFinta('esito2', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { memoria: featureBuona('memoria') })
    verde(dir, 'sintesi')
  })
  caso('feature buona → verde', () => {
    const dir = corsaFinta('featurebuona', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { memoria: featureBuona('memoria') })
    verde(dir)
  })
  caso('feature senza un campo → rosso', () => {
    const rotta = featureBuona('memoria').replace('- **Cosa fa:** un indice delle memorie\n', '')
    const dir = corsaFinta('featurecampo', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { memoria: rotta })
    rosso(dir, 'sintesi')
  })
  caso('feature col nome diverso dallo slug → rosso', () => {
    const dir = corsaFinta('featureslug', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { altronome: featureBuona('memoria') })
    rosso(dir, 'sintesi')
  })
  caso('file estraneo nella cartella delle feature → rosso', () => {
    const dir = corsaFinta('featureestraneo', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { memoria: featureBuona('memoria') })
    writeFileSync(join(featureDir(dir), 'nota.txt'), 'x')
    rosso(dir, 'sintesi')
  })
  caso('feature con segnaposto → rosso', () => {
    const seg = featureBuona('memoria').replace('un indice delle memorie', 'un <indice> delle memorie')
    const dir = corsaFinta('featuresegnaposto', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { feature: true }), { memoria: seg })
    rosso(dir, 'sintesi')
  })
  caso('un target assente dal README di prodotto → rosso', () => {
    const dir = corsaFinta('rientroreadme', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    writeFileSync(readmeFinto(dir), '# Prodotto\n\n## Inspirations\n\n- [altro](https://github.com/z/altro) — x\n')
    rosso(dir)
  })
  caso("un target ancora nell'elenco da studiare → rosso", () => {
    const dir = corsaFinta('rientroelenco', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    writeFileSync(`${dir}-lista.md`, `# elenco da studiare\n\n- [${A}](https://github.com/${A}) — da studiare\n`)
    rosso(dir)
  })
  caso('sintesi con segnaposto → rosso', () => {
    const dir = corsaFinta('sintesisegnaposto', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A], { segnaposto: true }))
    rosso(dir, 'sintesi')
  })
  caso('file estraneo nella corsa → rosso', () => {
    const dir = corsaFinta('estraenesintesi', [A], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A]))
    writeFileSync(join(dir, 'appunti.txt'), 'x')
    rosso(dir)
  })
  caso("un target senza appunto dichiarato in Limiti → verde", () => {
    const s = sintesiBuona('banco', [A, B]).replace('## Limiti\n\nNessuna.', `## Limiti\n\n${B} non è stato leggibile: la pagina non risponde.`)
    const dir = corsaFinta('limiti', [A, B], { [A]: appuntoBuono(A) }, s)
    verde(dir)
  })
  caso('lo stesso target senza appunto e non in Limiti → rosso', () => {
    const dir = corsaFinta('limitirossi', [A, B], { [A]: appuntoBuono(A) }, sintesiBuona('banco', [A, B]))
    rosso(dir)
  })
  caso('modalità appunti non guarda la sintesi', () => {
    const dir = corsaFinta('soloappunti', [A], { [A]: appuntoBuono(A) }, null)
    verde(dir, 'appunti')
  })
  caso('modalità sintesi non guarda gli appunti', () => {
    const dir = corsaFinta('solosintesi', [A], {}, sintesiBuona('banco', [A]).replace('## Limiti\n\nNessuna.', `## Limiti\n\n${A} non è stato leggibile.`))
    verde(dir, 'sintesi')
  })

  caso("l'attrezzo non installa e non porta il target sul disco", () => {
    const re = new RegExp(`\\b(?:${CHIAVI_INSTALL.join('|')})\\s+(?:${VERBI_INSTALL.join('|')})\\b|\\b${VERBO_CLONE}\\b`)
    for (const f of readdirSync(QUI)) {
      if (!f.endsWith('.mjs')) continue
      const trovato = readFileSync(join(QUI, f), 'utf8').split(/\r?\n/).find(r => re.test(r))
      if (trovato) throw new Error(`${f}: ${trovato.trim()}`)
    }
  })

  let passed = 0
  const failures = []
  for (const c of casi) {
    try { c.fn(); passed++ } catch (e) { failures.push(`${c.nome}: ${e.message}`) }
  }
  const esito = { checks: casi.length, passed, failed: failures.length, failures }
  console.log(JSON.stringify(esito, null, 2))
  return failures.length ? 1 : 0
}

// --- Avvio --------------------------------------------------------------------

const [verbo, ...resto] = process.argv.slice(2)
try {
  if (verbo === '--self-check') process.exit(banco())
  else if (verbo === 'prepara') process.exit(cmdPrepara(opzioni(resto)))
  else if (verbo === 'apri') process.exit(cmdApri(opzioni(resto)))
  else if (verbo === 'verifica') process.exit(cmdVerifica(resto))
  else {
    console.error('verbi: prepara | apri | verifica | --self-check')
    process.exit(2)
  }
} catch (e) {
  esci(2, e.message)
}
