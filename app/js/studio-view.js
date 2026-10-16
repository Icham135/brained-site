// Brainy Exam Studio 2 – Ansichten: Hochladen → Scan → «Prüfung bereinigt» → Aufbereiten → Bereit → Prüfungsumgebung → Ergebnis
// Vertrag mit Logik und Scanner: docs/EXAM-UMGEBUNG.md. Alle Nutzer- und KI-Texte laufen über esc() bzw. rich().
import { U } from './view-state.js';
import { esc, I } from './ui.js';
import { imgSync } from './idb.js';
import * as SX from './studio.js';
import { aiStatus, KIND, MAX_PAGES, studioData, docById, lastAttempt, orderedQs, V } from './studio.js';
import * as G from './grades.js';
import { scanView } from './studio-scan.js';

const sel = (a, b) => a === b ? 'on' : '';
const nl = s => esc(s).replace(/\n/g, '<br>');
const total = qs => qs.reduce((s, q) => s + (+q.maxPoints || 0), 0);
const pts = n => String(Math.round(n * 2) / 2);
const L = i => String.fromCharCode(65 + i);
const strip = o => String(o ?? '').replace(/^[A-H][:.)]\s*/, '');
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
// Helfer aus der Logik (mit Rückfall, falls eine Funktion noch fehlt)
const pen = l => SX.hintPenalty ? SX.hintPenalty(l) : [0, 0.25, 0.5, 0.75, 1][l] || 0;
const clock = t => t && SX.timerLeft && SX.fmtClock ? SX.fmtClock(SX.timerLeft(t)) : '00:00';

// Formeln: Klartext hübsch setzen (x^2 → x², \frac → Bruch); $…$ über KaTeX (lokal, erst bei Bedarf geladen)
let katexState = 0;
function loadKatex() {
  if (katexState) return; katexState = 1;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./vendor/katex/katex.min.css', import.meta.url).href; document.head.appendChild(css);
  const s = document.createElement('script'); s.src = new URL('./vendor/katex/katex.min.js', import.meta.url).href;
  s.onload = () => { katexState = 2; window.dispatchEvent(new Event('brained:rerender')); }; s.onerror = () => { katexState = 3; };
  document.head.appendChild(s);
}
function prettyMath(h) {
  h = h.replace(/([A-Za-zΔ])_([A-Za-z0-9]{1,3})\b/g, '$1<sub>$2</sub>');
  let x = h.replace(/\^\{([^{}]{1,12})\}/g, '<sup>$1</sup>').replace(/\^(-?[0-9a-z]{1,3})/gi, '<sup>$1</sup>').replace(/_\{([^{}]{1,10})\}/g, '<sub>$1</sub>');
  for (let k = 0; k < 3; k++) x = x.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  return x.replace(/\\cdot|\\times/g, '·').replace(/\\pm/g, '±').replace(/\\(le|leq)\b/g, '≤').replace(/\\(ge|geq)\b/g, '≥').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
    .replace(/\\,|\\;|\\!|\\left|\\right/g, '').replace(/\\text\{([^{}]*)\}/g, '$1').replace(/sqrt\(/g, '√(');
}
const rich = s => { const t = String(s ?? ''); if (!t.includes('$')) return prettyMath(nl(t));
  return t.split(/(\$[^$]+\$)/g).map(p => p.length > 2 && p.startsWith('$') && p.endsWith('$') ? (loadKatex(), katexState === 2 && window.katex ? window.katex.renderToString(p.slice(1, -1), { throwOnError: false }) : `<code>${esc(p.slice(1, -1))}</code>`) : prettyMath(nl(p))).join(''); };
const plain = (s, n = 60) => { const t = String(s ?? '').replace(/\$|\\[a-z]+|[{}]/gi, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
  pdf: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15l3 3 3-3"/>'),
  pen: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>'),
  room: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 9h5M13 13h5"/>'),
  power: svg('<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>'),
  calc: svg('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  list: svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  crop: svg('<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/>'),
};
const TOOL_EM = t => /rechner/i.test(t) ? '🧮' : /formel/i.test(t) ? '📐' : /geodreieck|zirkel|lineal/i.test(t) ? '📏' : /wörterbuch|lexikon/i.test(t) ? '📕' : /gesetz/i.test(t) ? '⚖️' : '✏️';
const toolBadges = doc => (doc.tools?.length ? doc.tools : ['Stift & Papier']).map(t => `<span class="ex-badge">${TOOL_EM(t)} ${esc(t)}</span>`).join('');
const fig = (q, cls = 'ex-fig') => { const src = q.crop && imgSync(q.crop); return src ? `<figure class="${cls}"><img src="${src}" alt="${esc(q.graphicBoundingBox?.label || 'Abbildung')}"></figure>` : ''; };
const spin = '<i class="ex-spin" aria-hidden="true"></i>';
const logo = '<img class="ex-logo" src="assets/icon.svg" alt="" width="30" height="30">';

/* ---------------------------------- Bausteine: Hilfen ---------------------------------- */
const NAMES = { number_line: 'Zahlenstrahl', code: 'Programmcode', image_hotspot: 'Stelle antippen', text_select: 'Im Text markieren', single_choice: 'Einfachauswahl', multiple_choice: 'Einfachauswahl', multi_select: 'Mehrfachauswahl', true_false: 'Richtig / Falsch', fill_blanks: 'Lückentext', matching: 'Zuordnen', ordering: 'Reihenfolge', numeric: 'Zahl mit Einheit', math_calculation: 'Rechnen', short_answer: 'Kurzantwort', essay_open_text: 'Freitext', formula: 'Formel', sketch: 'Skizze', table_fill: 'Tabelle', label_image: 'Beschriften', graph_plot: 'Koordinatensystem', categorize: 'Zuordnen in Gruppen' };
const kindOf = q => q.taskKind === 'multiple_choice' ? 'single_choice' : q.taskKind;
const kindName = q => KIND[q.taskKind]?.name || NAMES[q.taskKind] || 'Aufgabe';
const filled = x => x == null ? false : typeof x === 'number' ? Number.isFinite(x) : typeof x === 'boolean' ? true : typeof x === 'string' ? x.trim() !== ''
  : Array.isArray(x) ? x.some(filled) : typeof x === 'object' ? Object.values(x).some(filled) : false;
const codeSame = (x, v) => !!v?.starter && String(x ?? '').replace(/\s+/g, '') === String(v.starter).replace(/\s+/g, '');   // unveränderter Vorgabecode zählt nicht
const answered = (a, q) => kindOf(q) === 'sketch' ? !!a.photos[q.id] : kindOf(q) === 'ordering' ? !!a.touched?.[q.id] : kindOf(q) === 'code' ? filled(a.ans[q.id]) && !codeSame(a.ans[q.id], V(q, a.variant)) : filled(a.ans[q.id]);
// Texteingabe: data-bind (Vertrag) + studioAns (Nachtrag: legt Form an und zeichnet neu, damit der Status stimmt)
const bind = (q, k) => `data-bind="ai.ans.${esc(q.id)}${k == null ? '' : '.' + k}" data-a-change="studioAns" data-q="${esc(q.id)}"`;
const sub = (x, k) => esc(x && typeof x === 'object' ? x[k] ?? '' : '');
const allowsCalc = doc => (doc.tools || []).some(t => /rechner/i.test(t));
// Prüfungsteile: Überschrift, wenn der Teil wechselt; Rechner nur in Teilen, die ihn erlauben
const partOf = (doc, q) => q?.partId ? (doc.parts || []).find(p => p?.id === q.partId) || null : null;
const partFirst = (doc, qs, i) => !!partOf(doc, qs[i]) && qs[i - 1]?.partId !== qs[i].partId;
const partTools = p => Array.isArray(p.tools) ? (p.tools.length ? p.tools.join(', ') : 'keine') : 'wie Prüfung';
const partHead = (p, cls = 'ex-part') => `<header class="${cls}"><b>${esc(p.title)}</b><span>${p.timeLimitMin ? `${esc(p.timeLimitMin)} min · ` : ''}Hilfsmittel: ${esc(partTools(p))}</span></header>`;
const calcOk = (doc, a) => SX.calcAllowed ? SX.calcAllowed(doc, a) : allowsCalc(doc);
const num = v => +(+v).toFixed(4);

// Tabelle (table_fill): null-Zellen sind Eingaben, Schlüssel «Zeile,Spalte»
function tableView(v, cell) {
  return `<div class="ex-tablewrap"><table class="ex-table">${v.columns?.length ? `<thead><tr>${v.columns.map(c => `<th>${rich(c)}</th>`).join('')}</tr></thead>` : ''}
    <tbody>${(v.rows || []).map((row, r) => `<tr>${(row || []).map((c, k) => `<td>${c === null ? cell(r, k) : rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Abbildung mit nummerierten Markern (label_image)
function markedFig(q, v) {
  const src = q.crop && imgSync(q.crop);
  return src ? `<figure class="ex-limg"><div><img src="${src}" alt="${esc(q.graphicBoundingBox?.label || 'Abbildung')}">${(v.markers || []).map((m, n) => `<span class="ex-marker" style="left:${(+m?.x || 0) / 10}%;top:${(+m?.y || 0) / 10}%">${n + 1}</span>`).join('')}</div></figure>` : '';
}
// Koordinatensystem als SVG-Raster (graph_plot); mit q → Klickflächen zum Setzen/Entfernen
function plotSvg(v, pts0 = [], q = null) {
  const ax = v.axes || {}, f = (k, d) => ax[k] != null && Number.isFinite(+ax[k]) ? +ax[k] : d;
  const A = { xmin: f('xmin', -5), xmax: f('xmax', 5), ymin: f('ymin', -5), ymax: f('ymax', 5) };
  if (A.xmax <= A.xmin) A.xmax = A.xmin + 10; if (A.ymax <= A.ymin) A.ymax = A.ymin + 10;
  let st = +ax.step > 0 ? +ax.step : 1; while ((A.xmax - A.xmin) / st > 40 || (A.ymax - A.ymin) / st > 40) st *= 2;
  const u = 32, pad = 26, nx = Math.round((A.xmax - A.xmin) / st), ny = Math.round((A.ymax - A.ymin) / st), W = nx * u + pad * 2, H = ny * u + pad * 2;
  const X = x => pad + (x - A.xmin) / st * u, Y = y => pad + (A.ymax - y) / st * u, lab = Math.max(1, Math.ceil(Math.max(nx, ny) / 12));
  let g = '';
  for (let i = 0; i <= nx; i++) { const x = num(A.xmin + i * st); g += `<line class="${x === 0 ? 'ax' : 'gr'}" x1="${X(x)}" y1="${pad}" x2="${X(x)}" y2="${H - pad}"/>`; if (i % lab === 0 && x !== 0) g += `<text x="${X(x)}" y="${Math.min(H - 8, Math.max(pad + 12, Y(0) + 14))}" text-anchor="middle">${x}</text>`; }
  for (let j = 0; j <= ny; j++) { const y = num(A.ymin + j * st); g += `<line class="${y === 0 ? 'ax' : 'gr'}" x1="${pad}" y1="${Y(y)}" x2="${W - pad}" y2="${Y(y)}"/>`; if (j % lab === 0 && y !== 0) g += `<text x="${Math.max(12, Math.min(W - pad - 4, X(0) - 6))}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`; }
  const P = (Array.isArray(pts0) ? pts0 : []).filter(p => Array.isArray(p) && p.length >= 2).map(p => [+p[0], +p[1]]);
  const s2 = [...P].sort((a, b) => a[0] - b[0]);
  const line = v.line && s2.length >= 2 ? `<polyline class="pl" points="${s2.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}"/>` : '';
  // Klickflächen höchstens 14 × 14, damit sie auf dem Handy gross genug bleiben
  let hit = '', hs = 1; while (nx / hs > 14 || ny / hs > 14) hs++;
  if (q) for (let i = 0; i <= nx; i += hs) for (let j = 0; j <= ny; j += hs) { const x = num(A.xmin + i * st), y = num(A.ymin + j * st), w = u * hs;
    hit += `<rect class="hit" x="${X(x) - w / 2}" y="${Y(y) - w / 2}" width="${w}" height="${w}" data-a="studioPlot" data-q="${esc(q.id)}" data-x="${x}" data-y="${y}"><title>(${x} | ${y})</title></rect>`; }
  return `<svg class="ex-plot" viewBox="0 0 ${W} ${H}" role="${q ? 'group' : 'img'}" aria-label="Koordinatensystem">${g}${line}${P.map(p => `<circle class="pt" cx="${X(p[0])}" cy="${Y(p[1])}" r="6"/>`).join('')}${hit}</svg>`;
}
const ptList = P => (Array.isArray(P) ? P : []).filter(p => Array.isArray(p)).map(p => `(${esc(p[0])} | ${esc(p[1])})`).join(', ');

// Im Text markieren: Wörter/Satzzeichen als Tipp-Knöpfe; Ergebnis farbig (richtig, falsch, verpasst)
const isPunct = t => /^[^\p{L}\p{N}]+$/u.test(String(t));
const glue = (ts, i) => i && (/^[.,;:!?)\]}»“”%…]$/.test(ts[i]) || /^[(\[{«„]$/.test(ts[i - 1])) ? ' g' : '';
function tokView(v, cls) { const c = new Set(v.correct || []), ts = v.tokens || [];
  return `<div class="ex-toks r">${ts.map((t, j) => { const k = cls(j, c.has(j)); return `${j && !glue(ts, j) ? ' ' : ''}<span class="ex-tokr ${k}">${esc(t)}</span>`; }).join('')}</div>`; }   // echte Leerzeichen = Umbruchstellen
// Stelle antippen: Bild mit Markierung; Lösungsstellen als Ellipsen (Koordinaten 0–1000 je Achse)
const hotPin = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) ? `<span class="ex-hotpin" style="left:${+p[0] / 10}%;top:${+p[1] / 10}%"></span>` : '';
const hotZones = v => (v.targets || []).map(t => `<span class="ex-hotzone" style="left:${(+t.x - +t.r) / 10}%;top:${(+t.y - +t.r) / 10}%;width:${+t.r / 5}%;height:${+t.r / 5}%"></span>`).join('');
function hotFig(q, v, p, sol) { const src = q.crop && imgSync(q.crop); if (!src) return '';
  return `<div class="ex-hot r"><img src="${src}" alt="${esc(q.graphicBoundingBox?.label || 'Abbildung')}" draggable="false">${sol ? hotZones(v) : ''}${hotPin(p)}</div>`; }
// Zahlenstrahl als SVG: Striche je «step» (falls nicht zu fein), Beschriftung je «schönem» Hauptschritt; mit q → Tippflächen
const fmtN = n => String(Math.round((+n || 0) * 1e6) / 1e6).replace('-', '−');
function nlSvg(v, vals = [], q = null, sol = null) {
  let lo = +v.min, hi = +v.max; if (!(hi > lo)) { lo = 0; hi = 10; }
  const st = +v.step > 0 ? +v.step : 1, W = 440, pad = 26, H = 96, ly = 54, X = t => pad + (t - lo) / (hi - lo) * (W - 2 * pad), n = Math.round((hi - lo) / st);
  const r = (hi - lo) / 10, p10 = 10 ** Math.floor(Math.log10(r || 1)), maj = Math.max(st, [1, 2, 5, 10].map(m => m * p10).find(s0 => s0 >= r) || st), fine = n <= 120;
  let g = `<line class="ax" x1="${pad - 12}" y1="${ly}" x2="${W - pad + 12}" y2="${ly}"/><path class="ar" d="M${W - pad + 12} ${ly - 5} L${W - pad + 20} ${ly} L${W - pad + 12} ${ly + 5}z"/>`;
  if (fine) for (let i = 0; i <= n; i++) { const t = lo + i * st; g += `<line class="mi" x1="${X(t)}" y1="${ly - 6}" x2="${X(t)}" y2="${ly + 6}"/>`; }
  for (let t = Math.ceil(lo / maj - 1e-9) * maj; t <= hi + 1e-9; t += maj) g += `<line class="ma" x1="${X(t)}" y1="${ly - 11}" x2="${X(t)}" y2="${ly + 11}"/><text x="${X(t)}" y="${ly + 30}" text-anchor="middle">${fmtN(t)}</text>`;
  const dot = (t, cls) => Number.isFinite(+t) && +t >= lo - 1e-9 && +t <= hi + 1e-9 ? `<circle class="${cls}" cx="${X(+t)}" cy="${ly}" r="8"/><text class="vl ${cls}" x="${X(+t)}" y="${ly - 16}" text-anchor="middle">${fmtN(t)}</text>` : '';
  const pts = (Array.isArray(sol) ? sol.map(t => dot(t, 'sol')).join('') : '') + (Array.isArray(vals) ? vals.map(t => dot(t, 'pt')).join('') : '');
  let hit = '';
  if (q) { const id = esc(q.id); if (n <= 60) for (let i = 0; i <= n; i++) { const t = Math.round((lo + i * st) * 1e6) / 1e6, bw = (W - 2 * pad) / Math.max(1, n); hit += `<rect class="hit" x="${X(t) - bw / 2}" y="0" width="${bw}" height="${H}" data-a="studioNL" data-q="${id}" data-v="${t}"><title>${fmtN(t)}</title></rect>`; }
    else hit = `<rect class="hit" x="${pad}" y="0" width="${W - 2 * pad}" height="${H}" data-a="studioNL" data-q="${id}"/>`; }
  return `<svg class="ex-nl" viewBox="0 0 ${W} ${H}" role="${q ? 'group' : 'img'}" aria-label="Zahlenstrahl von ${fmtN(lo)} bis ${fmtN(hi)}">${g}${pts}${hit}</svg>`;
}
const CODE_KEYS = ['{', '}', '(', ')', '[', ']', ';', ':', '=', '<', '>', '"', "'", '_'];
const tfName = c => c === 'ng' ? 'Nicht im Text' : c === true ? 'Richtig' : c === false ? 'Falsch' : '–';
const SCORE_TXT = { all_or_nothing: 'Wertung: nur ganz richtig zählt', minus: 'Wertung: falsche Antworten geben Abzug (nie unter 0)', kprim: 'Wertung Kprim: alles richtig = volle Punkte, 1 Fehler = halbe' };
const scoreLine = (v, inline) => SCORE_TXT[v?.scoring] ? (inline ? ` · ${SCORE_TXT[v.scoring]}` : `<p class="ex-sub ex-score-l">${SCORE_TXT[v.scoring]}</p>`) : '';
const CHEM_KEYS = ['₂', '₃', '₄', '⁺', '⁻', '²⁺', '→', '⇌', '·', 'Δ', '°'], MATH_KEYS = ['x', '²', '³', '√', 'π', '·', '÷', '±', '(', ')', '≤', '≥', '≠', '°'];
const isChem = (doc, v) => /chem/i.test(doc?.subject || '') || /[A-Z][a-z]?[₂₃₄]|→|⇌|reaktion/i.test(v?.text || '');

// Gemeinsames Material (M1 …): einmal über den zugehörigen Aufgaben, auf dem Handy einklappbar; Zeilennummern alle 5 Zeilen
const matOf = (doc, q) => q?.materialId ? (doc.materials || []).find(m => m?.id === q.materialId) || null : null;
const matFirst = (qs, i) => !!qs[i]?.materialId && qs[i - 1]?.materialId !== qs[i].materialId;
function matText(m) {
  const ls = String(m.text || '').split('\n');
  return ls.length >= 5 ? `<ol class="ex-mat-lines">${ls.map((l, n) => `<li${(n + 1) % 5 ? '' : ` data-n="${n + 1}"`}>${rich(l) || '&nbsp;'}</li>`).join('')}</ol>` : `<div class="ex-mat-t">${rich(m.text)}</div>`;
}
function matView(a, doc, q, cls = 'ex-mat') {
  const m = matOf(doc, q); if (!m) return '';
  const closed = !!a.matClosed?.[m.id], src = m.crop && imgSync(m.crop), body = `${src ? `<figure class="ex-fig"><img src="${src}" alt="${esc(m.title || m.label)}"></figure>` : ''}${m.text ? matText(m) : ''}`;
  if (cls !== 'ex-mat') return `<section class="${cls}"><h4>${esc(m.label)}${m.title ? ` · ${esc(m.title)}` : ''}</h4>${body}</section>`;
  return `<section class="ex-mat ${closed ? 'closed' : ''}" aria-label="Material ${esc(m.label)}">
    <button class="ex-mat-h" data-a="studioMat" data-id="${esc(m.id)}" aria-expanded="${!closed}"><span class="ex-mat-l">${esc(m.label)}</span><span class="grow"><b>${esc(m.title || m.kind || 'Material')}</b><small>${esc(m.kind || 'Material')}</small></span>${closed ? ICON.down : ICON.up}</button>
    ${closed ? '' : `<div class="ex-mat-b">${body}</div>`}
  </section>`;
}

/* ---------------------------------- Karte im Brainy-Tab ---------------------------------- */
export function studioCard() {
  const n = studioData().docs.length;
  return `<button class="ex-card" data-a="aiTool" data-id="exam">
    <span class="ex-kicker">BRAINY EXAM STUDIO</span>
    <h3>Alte Prüfung rein.<br>Perfekte Übung raus.</h3>
    <p>Foto oder PDF hochladen – Brainy entfernt die Handschrift, mischt auf Wunsch neue Zahlen und bewertet dich mit Teilpunkten und Note.</p>
    <span class="ex-cta">${ICON.upload} Prüfung scannen</span>${n ? `<span class="ex-meta">${n} Prüfung${n > 1 ? 'en' : ''} gespeichert</span>` : ''}
  </button>`;
}
export const studioCalendar = () => '';

/* ---------------------------------- Router ---------------------------------- */
export function studioView() {
  const a = U.ai, doc = docById(a.docId), p = a.phase;
  const body = p === 'scan' ? scanView(a)
    : (p === 'cleaned' || p === 'choice') && doc ? cleanedView(a, doc)
    : p === 'build' && doc ? buildView(a, doc)
    : p === 'ready' && doc ? readyView(a, doc)
    : p === 'run' && doc ? runView(a, doc)
    : p === 'result' && doc ? resultView(a, doc)
    : p === 'paper' && doc ? paperView(a, doc)
    : homeView(a);
  return `<div class="ex ex-p-${esc(p)}" data-keep="studio-${esc(p)}">${body}${a.crop && doc ? cropEditor(a, doc) : ''}</div>`;
}

/* ---------------------------------- 1) Hochladen ---------------------------------- */
function homeView(a) {
  const docs = studioData().docs;
  return `<section class="ex-home">
    <label class="ex-upload">
      <input type="file" accept="image/*,application/pdf" multiple data-a-change="studioFiles" class="ex-file"/>
      <span class="ex-upload-ic">${ICON.upload}</span>
      <b>Prüfung hochladen</b>
    </label>
    <p class="ex-hint-line">Foto, Screenshot oder PDF · bis ${MAX_PAGES} Seiten</p>
    ${a.err ? `<div class="ex-err" role="alert">${esc(a.err)}</div>` : ''}
    ${docs.length ? `<h3 class="ex-sec">Zuletzt</h3><div class="ex-list">${docs.slice(0, 8).map(d => { const la = lastAttempt(d.id);
      return `<button class="ex-row" data-a="studioOpen" data-id="${esc(d.id)}"><span class="ex-row-ic">${ICON.room}</span><span class="grow"><b>${esc(d.title)}</b><small>${d.questions.length} Aufgaben · ${pts(total(d.questions))} P${la ? ` · zuletzt Note ${Number(la.grade).toFixed(1)}` : ''}</small></span>${I.chev}</button>`; }).join('')}</div>` : ''}
    <button class="ex-link" data-a="studioDemoPage">Beispiel-Prüfung</button>
    <button class="ex-link sm" data-a="studioDemoPage" data-set="2">Beispiel 2: Lesetext, Prüfungsteile, neue Aufgabentypen</button>
  </section>`;
}

/* ---------------------------------- 3) Prüfung bereinigt + Moduswahl ---------------------------------- */
const MODES = [
  ['original', ICON.pen, 'Original schreiben', 'Genau die Aufgaben deiner Prüfung, sauber ohne Handschrift.'],
  ['shuffle', ICON.shuffle, 'Aufgaben neu mischen', 'Gleiche Aufgaben in neuer Reihenfolge.'],
  ['remix', ICON.dice, 'Neue Zahlen', 'Gleiche Aufgabentypen mit neuen Zahlen und Fällen.'],
];
function cleanedView(a, doc) {
  const qs = doc.questions, figs = qs.filter(q => q.crop || q.graphicBoundingBox);
  return `<section class="ex-wrap">
    <div class="ex-top"><button class="ex-ic" data-a="studioHome" aria-label="Zurück">${I.back}</button><span class="grow"></span><button class="ex-ic" data-a="studioDel" data-id="${esc(doc.id)}" aria-label="Prüfung löschen">${I.trash}</button></div>
    <div class="ex-banner" role="status">
      <svg class="ex-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>
      <div><b>Prüfung bereinigt</b><span>Handschrift entfernt – bereit zum Üben</span></div>
    </div>
    <header class="ex-doc"><span class="ex-kicker">${esc(doc.subject || 'Prüfung')}</span><h2>${esc(doc.title)}</h2>
      <p>${qs.length} Aufgabe${qs.length === 1 ? '' : 'n'} · ${pts(total(qs))} Punkte${doc.timeLimitMin ? ` · ${esc(doc.timeLimitMin)} min` : ''}${doc.parts?.length ? ` · ${doc.parts.length} Teile` : ''}</p><div class="ex-badges">${toolBadges(doc)}</div></header>
    <h3 class="ex-sec">Wie willst du üben?</h3>
    <div class="ex-modes">${MODES.map(([id, ic, t, d]) => `<button class="ex-mode ${sel(a.mode, id)}" data-a="studioMode" data-id="${id}" ${a.busy ? 'disabled' : ''}><span class="ex-mode-ic">${ic}</span><span class="grow"><b>${t}</b><small>${d}</small></span>${I.chev}</button>`).join('')}</div>
    ${figs.length ? `<section class="ex-figs"><h3 class="ex-sec">Grafiken prüfen (${figs.length})</h3><div class="ex-thumbs">${figs.map(q => { const src = q.crop && imgSync(q.crop);
      return `<button class="ex-thumb" data-a="studioCropEdit" data-q="${esc(q.id)}" aria-label="Ausschnitt Aufgabe ${esc(q.questionNumber)} anpassen">${src ? `<img src="${src}" alt="">` : ICON.crop}<span>${esc(q.questionNumber)}</span></button>`; }).join('')}</div><p class="ex-sub">Antippen, um den Ausschnitt anzupassen</p></section>` : ''}
  </section>`;
}

/* ---------------------------------- 4) Aufbereiten ---------------------------------- */
function buildView(a, doc) {
  const [t, s] = a.mode === 'remix' ? ['Neue Zahlen werden gewürfelt', 'Gleiche Aufgabentypen, neue Werte – mit Lösungen.']
    : a.mode === 'shuffle' ? ['Aufgaben werden gemischt', 'Gleich geht’s los.'] : ['Prüfung wird vorbereitet', 'Gleich geht’s los.'];
  const wait = aiStatus.wait > Date.now() ? Math.ceil((aiStatus.wait - Date.now()) / 1000) : 0;
  return `<section class="ex-build" role="status" aria-live="polite">
    <div class="ex-orb" aria-hidden="true"><i></i><i></i><i></i>${logo}</div>
    <b>${t}</b><p>${wait ? `Brainy ist kurz ausgelastet – geht in ${wait} s automatisch weiter` : s}</p>
    <div class="ex-shimmer" aria-hidden="true"><i></i></div>
    <small>${esc(doc.title)}</small>
    ${a.err ? `<div class="ex-err" role="alert">${esc(a.err)}</div><button class="ex-btn ghost" data-a="studioBack">Zurück</button>` : ''}
  </section>`;
}

/* ---------------------------------- 5) Bereit ---------------------------------- */
function readyView(a, doc) {
  const qs = orderedQs(doc, a.order), pdfBusy = a.busy === 'pdf';
  const m = MODES.find(x => x[0] === a.mode);
  return `<section class="ex-wrap">
    <div class="ex-top"><button class="ex-ic" data-a="studioBack" aria-label="Zurück">${I.back}</button><span class="grow"></span></div>
    <header class="ex-doc center"><span class="ex-kicker">${m ? m[2] : 'Bereit'}</span><h2>${esc(doc.title)}</h2><p>${qs.length} Aufgaben · ${pts(total(qs))} Punkte</p></header>
    <div class="ex-ready">
      <button class="ex-rcard" data-a="studioPdf" ${a.busy ? 'disabled' : ''} aria-busy="${pdfBusy}">
        <span class="ex-rcard-ic">${pdfBusy ? spin : ICON.pdf}</span><b>${pdfBusy ? 'PDF wird erstellt…' : 'Als PDF herunterladen'}</b><small>Druckfertig auf A4 – zum Lösen auf Papier.</small></button>
      <button class="ex-rcard primary" data-a="studioStartInteractive" ${a.busy ? 'disabled' : ''}>
        <span class="ex-rcard-ic">${ICON.room}</span><b>Online ausfüllen</b><small>Prüfungsumgebung mit Timer, Lernhinweisen und Note.</small></button>
    </div>
    <button class="ex-link" data-a="studioOpenPaper">A4-Vorschau ansehen</button>
  </section>`;
}

/* ---------------------------------- 6) Prüfungsumgebung ---------------------------------- */
const CALC_KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '√', '^', 'π', '%', '⌫', '='];
function runView(a, doc) {
  const qs = orderedQs(doc, a.order), n = qs.length, done = qs.filter(q => answered(a, q)).length, calc = calcOk(doc, a);
  return `<div class="ex-run" role="dialog" aria-modal="true" aria-label="Prüfungsumgebung">
    ${sideView(a, qs, done, doc)}
    <main class="ex-main">
      <header class="ex-bar">
        <div class="ex-title grow"><small>${esc(doc.subject || 'Prüfung')}</small><b>${esc(doc.title)}</b></div>
        ${timerView(a, doc)}
        ${calc ? `<button class="ex-ic ${a.calcOpen ? 'on' : ''}" data-a="studioToggleCalc" aria-pressed="${!!a.calcOpen}" aria-label="Taschenrechner">${ICON.calc}</button>` : ''}
        <button class="ex-btn dark sm" data-a="studioSubmitAsk" ${a.busy ? 'disabled' : ''}>Abgeben</button>
        <button class="ex-power" data-a="studioLeave" aria-label="Prüfung verlassen">${ICON.power}</button>
      </header>
      <div class="ex-sheet">
        <header class="ex-sheet-h"><span class="ex-kicker">${esc(doc.subject || 'Prüfung')}${a.mode === 'remix' ? ' · Neue Zahlen' : a.mode === 'shuffle' ? ' · Gemischt' : ''}</span><h1>${esc(doc.title)}</h1>
          <p>${n} Aufgaben · ${pts(total(qs))} Punkte · ${doc.timeLimitMin ? `${esc(doc.timeLimitMin)} min` : 'Keine Zeit gefunden'}</p><div class="ex-badges">${toolBadges(doc)}</div></header>
        ${qs.map((q, i) => (partFirst(doc, qs, i) ? partHead(partOf(doc, q)) : '') + (matFirst(qs, i) ? matView(a, doc, q) : '') + taskView(a, q, i, doc)).join('')}
        <footer class="ex-sheet-f"><p>${done} von ${n} Aufgaben beantwortet</p><button class="ex-btn dark" data-a="studioSubmitAsk" ${a.busy ? 'disabled' : ''}>Prüfung abgeben</button></footer>
      </div>
    </main>
    ${calc && a.calcOpen ? `<div class="ex-calc" role="group" aria-label="Taschenrechner"><div class="ex-calc-d"><small>${esc(a.calc || '0')}</small><b>${esc(a.calcOut || '')}</b></div><div class="ex-calc-k">${CALC_KEYS.map(k => `<button class="${k === '=' ? 'eq' : /[÷×−+^]/.test(k) ? 'op' : ''}" data-a="studioCalc" data-k="${k}">${k}</button>`).join('')}</div></div>` : ''}
    ${a.busy === 'grade' && !a.confirm ? `<div class="ex-dlg-w"><div class="ex-dlg center" role="status">${spin}<h3>Brainy bewertet…</h3><p>Teilpunkte werden vergeben.</p></div></div>` : ''}
    ${confirmView(a, n, done)}
  </div>`;
}

// Seitenleiste (Desktop/Tablet links, Handy oben mit Schublade)
function sideView(a, qs, done, doc) {
  const n = qs.length;
  return `<aside class="ex-side ${a.sideOpen ? 'open' : ''}" aria-label="Aufgaben">
    <div class="ex-brand">${logo}<b>Brained</b><span>Exam</span></div>
    <nav class="ex-nav">${qs.map((q, i) => { const ok = answered(a, q), h = a.hints[q.id] || 0, v = V(q, a.variant), pt = doc && partFirst(doc, qs, i) ? partOf(doc, q) : null;
      return `${pt ? `<div class="ex-nav-part" role="presentation"><span class="l">${esc(pt.title)}${pt.timeLimitMin ? ` · ${esc(pt.timeLimitMin)} min` : ''}</span><span class="s">${esc(SX.partShort ? SX.partShort(pt) : pt.title)}</span></div>` : ''}<button class="ex-nav-i ${i === a.qi ? 'on' : ''} ${ok ? 'done' : ''}" data-a="studioQ" data-i="${i}" ${i === a.qi ? 'aria-current="true"' : ''} aria-label="Aufgabe ${esc(q.questionNumber)}${ok ? ', beantwortet' : ''}${h ? ', Hinweis genutzt' : ''}">
        <span class="n">${esc(q.questionNumber || i + 1)}</span><span class="t">${esc(plain(v?.text, 70) || kindName(q))}</span>
        <span class="st">${h ? `<i class="hint" title="${h >= 4 ? 'Lösung angesehen' : `Hinweis ${h}`}">${h >= 4 ? 'L' : h}</i>` : ''}${ok ? `<i class="ok">${I.check}</i>` : ''}</span></button>`; }).join('')}</nav>
    <div class="ex-prog"><div><span>Fortschritt</span><b>${done} / ${n}</b></div><i><b style="width:${n ? Math.round(done / n * 100) : 0}%"></b></i></div>
    <button class="ex-side-tog" data-a="studioSide" aria-expanded="${!!a.sideOpen}" aria-label="${a.sideOpen ? 'Aufgabenliste schliessen' : 'Aufgabenliste öffnen'}">${a.sideOpen ? I.x : ICON.list}</button>
  </aside>`;
}

// Timer-Punkt mit Menü
function timerView(a, doc) {
  const t = a.timer, lim = +doc.timeLimitMin || 0, mins = [...new Set([15, 30, 45, 60, 90, ...(lim ? [lim] : [])])].sort((x, y) => x - y);
  const p = SX.curPart ? SX.curPart(doc, a) : null, pc = p && SX.partClock ? SX.partClock(a, p) : '';
  return `<div class="ex-timer">${pc ? `<span class="ex-ptime ${SX.partLeft(a, p) < 120000 ? 'warn' : ''}" data-live="studioPartClock" title="Restzeit ${esc(p.title)}">${esc(SX.partShort(p))} · ${esc(pc)}</span>` : ''}
    ${!t ? '<span class="ex-nolim">Keine Zeit gefunden</span>' : ''}
    <button class="ex-tdot ${t ? (t.mode === 'up' ? 'up' : 'down') : 'off'} ${t?.paused ? 'paused' : ''}" data-a="studioTimerMenu" aria-expanded="${!!a.timerMenu}" aria-haspopup="true" aria-label="${t ? 'Timer-Menü' : 'Timer starten'}">
      <i></i><b data-live="studioClock">${t ? clock(t) : ''}</b>${t ? '' : '<span class="ex-tstart"><span class="long">Timer starten</span><span class="short">Timer</span></span>'}</button>
    ${a.timerMenu ? `<div class="ex-tmenu" role="menu">
      <small>${t ? (t.mode === 'up' ? 'Stoppuhr läuft' : 'Countdown') : lim ? `Prüfungszeit: ${lim} min` : 'Keine Zeit gefunden – wähle eine Dauer'}</small>
      <div class="ex-tgrid">${mins.map(m => `<button role="menuitem" class="${t?.mode === 'down' && t.limitMs === m * 60000 ? 'on' : ''}" data-a="studioTimerSet" data-min="${m}">${m} min</button>`).join('')}</div>
      <button role="menuitem" class="ex-tline ${t?.mode === 'up' ? 'on' : ''}" data-a="studioTimerSet" data-min="0">Stoppuhr</button>
      ${t ? '<button role="menuitem" class="ex-tline" data-a="studioTimerOff">Aus</button>' : ''}
    </div>` : ''}
  </div>`;
}

// Eine Aufgabe auf dem Blatt
function taskView(a, q, i, doc) {
  const v = V(q, a.variant) || {}, h = a.hints[q.id] || 0, k = kindOf(q), hs = (v.hints || []).filter(Boolean);
  const canHint = h < Math.min(3, hs.length), solved = h >= 4;
  const text = k === 'fill_blanks' && /_{3,}/.test(v.text || '') ? '' : `<div class="ex-qtext">${rich(v.text)}</div>`;
  return `<article class="ex-task ${i === a.qi ? 'on' : ''}" id="ex-q-${i}" data-qi="${i}" aria-labelledby="ex-qn-${i}">
    <header class="ex-task-h"><span class="ex-qn" id="ex-qn-${i}">${esc(q.questionNumber || i + 1)}</span><span class="ex-kind">${kindName(q)}</span>${doc && matOf(doc, q) ? `<span class="ex-matref">${esc(matOf(doc, q).label)}</span>` : ''}<span class="grow"></span>
      ${h ? `<span class="ex-cost">${solved ? '0 P' : `−${Math.round(pen(h) * 100)} %`}</span>` : ''}<span class="ex-pts">${pts(q.maxPoints)} P</span></header>
    ${k === 'label_image' ? markedFig(q, v) : k === 'image_hotspot' ? '' : fig(q)}${text}
    <div class="ex-answer">${solved ? `<p class="ex-locked">Lösung angesehen – diese Aufgabe gibt 0 Punkte.</p>` : answerView(a, q, v, k)}</div>
    ${h ? `<ol class="ex-hints">${hs.slice(0, Math.min(h, 3)).map((t, j) => `<li><b>Lernhinweis ${j + 1}</b><div>${rich(t)}</div></li>`).join('')}</ol>` : ''}
    ${solved ? `<div class="ex-solution"><b>Lösung</b>${solText(q, v)}${v.stepByStepSolution ? `<div>${rich(v.stepByStepSolution)}</div>` : ''}</div>` : ''}
    ${solved ? '' : `<div class="ex-help">
      <button class="ex-help-btn" data-a="studioHint" data-q="${esc(q.id)}" ${canHint ? '' : 'disabled'}>${ICON.bulb} ${canHint ? `Lernhinweis ${h + 1} · −${Math.round(pen(h + 1) * 100)} %` : hs.length ? 'Keine weiteren Hinweise' : 'Kein Lernhinweis'}</button>
      <button class="ex-help-btn sol" data-a="studioSolution" data-q="${esc(q.id)}">${ICON.key} Lösung · 0 P</button>
    </div>`}
  </article>`;
}

// Antwort-Bausteine (Antwort-Formen exakt wie im Bauplan)
function answerView(a, q, v, k) {
  const x = a.ans[q.id], id = esc(q.id), doc = docById(a.docId);
  switch (k) {
    case 'single_choice': return `<div class="ex-opts" role="radiogroup">${(v.options || []).map((o, j) => `<button class="ex-opt ${x === j ? 'on' : ''}" role="radio" aria-checked="${x === j}" data-a="studioPick" data-q="${id}" data-i="${j}"><i class="ex-radio"></i><span>${rich(strip(o))}</span></button>`).join('')}</div>`;
    case 'multi_select': return `<p class="ex-sub">${v.scoring === 'kprim' ? 'Kprim: Beurteile jede Aussage – angekreuzt = stimmt' : 'Mehrere Antworten möglich'}${scoreLine(v, true)}</p><div class="ex-opts">${(v.options || []).map((o, j) => { const on = Array.isArray(x) && x.includes(j);
      return `<button class="ex-opt ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" data-a="studioToggle" data-q="${id}" data-i="${j}"><i class="ex-box"></i><span>${rich(strip(o))}</span></button>`; }).join('')}</div>`;
    case 'true_false': return `<div class="ex-tf">${(v.statements || []).map((s, j) => { const c = Array.isArray(x) ? x[j] : null;
      return `<div class="ex-tf-row"><div class="grow">${rich(s?.text ?? (typeof s === 'string' ? s : ''))}</div><div class="ex-seg2 ${v.notGiven ? 'ng' : ''}" role="radiogroup" aria-label="Aussage ${j + 1}">
        <button class="${c === true ? 'on' : ''}" role="radio" aria-checked="${c === true}" data-a="studioTF" data-q="${id}" data-i="${j}" data-v="1">Richtig</button>
        <button class="${c === false ? 'on' : ''}" role="radio" aria-checked="${c === false}" data-a="studioTF" data-q="${id}" data-i="${j}" data-v="0">Falsch</button>${v.notGiven ? `
        <button class="${c === 'ng' ? 'on' : ''}" role="radio" aria-checked="${c === 'ng'}" data-a="studioTF" data-q="${id}" data-i="${j}" data-v="n">Nicht im Text</button>` : ''}</div></div>`; }).join('')}${scoreLine(v)}</div>`;
    case 'fill_blanks': {
      const parts = String(v.text || '').split(/_{3,}/), arr = Array.isArray(x) ? x : [], bo = v.blankOptions || [], used = new Set(arr.filter(Boolean).map(t => String(t).toLowerCase()));
      const inp = n => bo[n]?.length ? `<select class="ex-blank sel" ${bind(q, n)} aria-label="Lücke ${n + 1}"><option value="">…</option>${bo[n].map(o => `<option value="${esc(o)}"${arr[n] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
        : `<input class="ex-blank" ${bind(q, n)} value="${esc(arr[n] ?? '')}" aria-label="Lücke ${n + 1}" autocomplete="off" autocapitalize="off">`;
      const bank = v.wordBank?.length ? `<div class="ex-bank" role="group" aria-label="Wortliste – antippen setzt das Wort in die nächste leere Lücke">${v.wordBank.map(w => `<button class="ex-bankw ${used.has(String(w).toLowerCase()) ? 'used' : ''}" data-a="studioBank" data-q="${id}" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : '';
      if (bank) return bank + (parts.length > 1 ? `<div class="ex-qtext ex-cloze">${parts.map((p, n) => rich(p) + (n < parts.length - 1 ? inp(n) : '')).join('')}</div>` : `<div class="ex-blanks">${Array.from({ length: Math.max(1, (v.blanks || []).length) }, (_, n) => `<label class="ex-line"><span class="ex-lab">Lücke ${n + 1}</span>${inp(n)}</label>`).join('')}</div>`);
      return parts.length > 1 ? `<div class="ex-qtext ex-cloze">${parts.map((p, n) => rich(p) + (n < parts.length - 1 ? inp(n) : '')).join('')}</div>`
        : `<div class="ex-blanks">${Array.from({ length: Math.max(1, (v.blanks || []).length) }, (_, n) => `<label class="ex-line"><span class="ex-lab">Lücke ${n + 1}</span>${inp(n)}</label>`).join('')}</div>`;
    }
    case 'matching': {
      const R = v.right || [];
      return `<div class="ex-match"><ol class="ex-right">${R.map((r, j) => `<li><b>${L(j)}</b><span>${rich(r)}</span></li>`).join('')}</ol>
        ${(v.left || []).map((l, j) => `<div class="ex-mrow"><div class="ex-mleft">${rich(l)}</div><div class="ex-chips" role="radiogroup" aria-label="Zuordnung ${j + 1}">${R.map((_, r) => { const on = Array.isArray(x) && x[j] === r;
          return `<button class="ex-chip ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-a="studioMatch" data-q="${id}" data-i="${j}" data-r="${r}">${L(r)}</button>`; }).join('')}</div></div>`).join('')}</div>`;
    }
    case 'ordering': {
      const items = v.items || [], ord = Array.isArray(x) && x.length === items.length ? x : items.map((_, j) => j);
      return `<p class="ex-sub">Bring die Einträge in die richtige Reihenfolge</p><ol class="ex-order">${ord.map((it, p) => `<li><span class="ex-onum">${p + 1}</span><span class="grow">${rich(items[it])}</span>
        <button class="ex-mv" data-a="studioOrderMove" data-q="${id}" data-i="${p}" data-d="-1" ${p ? '' : 'disabled'} aria-label="Nach oben">${ICON.up}</button>
        <button class="ex-mv" data-a="studioOrderMove" data-q="${id}" data-i="${p}" data-d="1" ${p < ord.length - 1 ? '' : 'disabled'} aria-label="Nach unten">${ICON.down}</button></li>`).join('')}</ol>`;
    }
    case 'text_select': { const on = new Set(Array.isArray(x) ? x : []), ts = v.tokens || [];
      const btn = j => `<button class="ex-tok${on.has(j) ? ' on' : ''}${isPunct(ts[j]) ? ' p' : String(ts[j]).length <= 2 ? ' sm' : ''}" aria-pressed="${on.has(j)}" data-a="studioTok" data-q="${id}" data-i="${j}">${esc(ts[j])}</button>`;
      const groups = ts.reduce((g, _, j) => (glue(ts, j) && g.length ? g[g.length - 1].push(j) : g.push([j]), g), []);   // Satzzeichen bleiben am Wort (kein Umbruch davor)
      return `<p class="ex-sub">Tippe an, was du markieren willst – nochmals tippen hebt die Markierung auf</p><div class="ex-toks" role="group" aria-label="Text zum Markieren">${groups.map(g => `<span class="ex-tokg">${g.map(btn).join('')}</span>`).join('')}</div>`; }
    case 'image_hotspot': { const src = q.crop && imgSync(q.crop), p = Array.isArray(x) && x.length >= 2 ? x : null;
      if (!src) return '<p class="ex-sub">Abbildung nicht verfügbar.</p>';
      return `<p class="ex-sub">Tippe auf die gesuchte Stelle im Bild${p ? ' – nochmals tippen verschiebt die Markierung' : ''}</p>
        <div class="ex-hotwrap"><div class="ex-hot" data-a="studioHot" data-q="${id}" role="button" aria-label="Bild: gesuchte Stelle antippen"><img src="${src}" alt="${esc(q.graphicBoundingBox?.label || 'Abbildung')}" draggable="false">${hotPin(p)}</div></div>
        ${p ? `<div class="ex-sketch-f"><span class="ex-sub">Stelle markiert</span><button class="ex-btn ghost sm" data-a="studioHotClear" data-q="${id}">Markierung entfernen</button></div>` : ''}`; }
    case 'number_line': { const vals = Array.isArray(x) ? x.filter(t => Number.isFinite(+t)) : [];
      return `<p class="ex-sub">Tippe auf den Zahlenstrahl, um einen Wert zu setzen (nochmals tippen entfernt ihn); mit − / + fein verschieben</p>
        <div class="ex-nlwrap">${nlSvg(v, vals, q)}</div>
        ${vals.length ? `<div class="ex-nlvals">${vals.map((t, j) => `<span class="ex-nlv"><button data-a="studioNLMove" data-q="${id}" data-i="${j}" data-d="-1" aria-label="${esc(fmtN(t))} verkleinern">−</button><b>${esc(fmtN(t))}</b><button data-a="studioNLMove" data-q="${id}" data-i="${j}" data-d="1" aria-label="${esc(fmtN(t))} vergrössern">+</button><button class="x" data-a="studioNLDel" data-q="${id}" data-i="${j}" aria-label="${esc(fmtN(t))} entfernen">×</button></span>`).join('')}</div>` : ''}`; }
    case 'code': { const val = typeof x === 'string' && x ? x : v.starter || '';
      return `<div class="ex-codehead"><span class="ex-lang">${esc(v.language || 'Code')}</span><span class="ex-sub">Tab rückt ein</span></div>
        <textarea class="ex-area ex-code" ${bind(q)} data-code="1" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" rows="${Math.min(18, Math.max(6, val.split('\n').length + 2))}" placeholder="Dein Code…" aria-label="Programmcode">${esc(val)}</textarea>
        <div class="ex-fkeys" role="toolbar" aria-label="Code-Zeichen"><button data-a="studioInsert" data-q="${id}" data-t="  " aria-label="Einrücken">⇥</button>${CODE_KEYS.map(t => `<button data-a="studioInsert" data-q="${id}" data-t="${esc(t)}" aria-label="${esc(t)} einfügen">${esc(t)}</button>`).join('')}</div>`; }
    case 'numeric': return `<div class="ex-line"><span class="ex-lab">Resultat</span><input class="ex-in num" inputmode="decimal" autocomplete="off" ${bind(q, 'value')} value="${sub(x, 'value')}" aria-label="Wert">
      <input class="ex-in unit" autocomplete="off" autocapitalize="off" ${bind(q, 'unit')} value="${sub(x, 'unit')}" placeholder="Einheit" aria-label="Einheit"></div>`;
    case 'math_calculation': return `<textarea class="ex-area" ${bind(q, 'work')} placeholder="Rechenweg…" aria-label="Rechenweg">${sub(x, 'work')}</textarea>
      <div class="ex-line"><span class="ex-lab">Resultat</span><input class="ex-in wide" autocomplete="off" ${bind(q, 'result')} value="${sub(x, 'result')}" aria-label="Resultat"></div>`;
    case 'short_answer': return `<div class="ex-line"><input class="ex-in wide" autocomplete="off" ${bind(q)} value="${esc(typeof x === 'string' ? x : '')}" placeholder="Antwort" aria-label="Antwort"></div>`;
    case 'formula': return `<div class="ex-line"><input class="ex-in wide formula" autocomplete="off" autocapitalize="off" spellcheck="false" ${bind(q)} value="${esc(typeof x === 'string' ? x : '')}" placeholder="${isChem(doc, v) ? 'z. B. 2 H₂ + O₂ → 2 H₂O' : 'Deine Antwort, z. B. 15 + x'}" aria-label="Formel"></div>
      <div class="ex-fkeys" role="toolbar" aria-label="Sonderzeichen">${(isChem(doc, v) ? CHEM_KEYS : MATH_KEYS).map(t => `<button data-a="studioInsert" data-q="${id}" data-t="${t}" aria-label="${t} einfügen">${t}</button>`).join('')}</div>`;
    case 'table_fill': return tableView(v, (r, c) => `<input class="ex-cell" autocomplete="off" ${bind(q, `${r},${c}`)} value="${sub(x, `${r},${c}`)}" aria-label="Zeile ${r + 1}, Spalte ${c + 1}">`);
    case 'label_image': return `${v.wordBank?.length ? `<div class="ex-bank" aria-label="Wortliste">${v.wordBank.map(w => `<span>${esc(w)}</span>`).join('')}</div>` : ''}
      <div class="ex-labels">${(v.markers || []).map((_, n) => `<label class="ex-line"><span class="ex-mk">${n + 1}</span><input class="ex-in wide" autocomplete="off" ${bind(q, n)} value="${esc(Array.isArray(x) ? x[n] ?? '' : '')}" aria-label="Beschriftung ${n + 1}"></label>`).join('')}</div>`;
    case 'graph_plot': return `<p class="ex-sub">Tippe ins Raster, um einen Punkt zu setzen oder zu entfernen${Array.isArray(x) && x.length ? ` · gesetzt: ${ptList(x)}` : ''}</p>
      <div class="ex-plotwrap">${plotSvg(v, x, q)}</div><div class="ex-sketch-f"><span></span><button class="ex-btn ghost sm" data-a="studioPlotClear" data-q="${id}">Punkte löschen</button></div>`;
    case 'categorize': { const gs = v.groups || [];
      return `<div class="ex-cat">${(v.items || []).map((it, j) => `<div class="ex-mrow"><div class="ex-mleft">${rich(it)}</div><div class="ex-chips" role="radiogroup" aria-label="Gruppe für Begriff ${j + 1}">${gs.map((gname, g) => { const on = Array.isArray(x) && x[j] === g;
        return `<button class="ex-chip wide ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-a="studioCat" data-q="${id}" data-i="${j}" data-g="${g}">${esc(plain(gname, 28))}</button>`; }).join('')}</div></div>`).join('')}</div>`; }
    case 'sketch': return `<div class="ex-sketch"><canvas data-sketch="${id}" width="1000" height="625" aria-label="Zeichenfläche"></canvas>
      <div class="ex-sketch-f"><span class="ex-sub">Mit Finger oder Stift zeichnen</span><button class="ex-btn ghost sm" data-a="studioSketchClear" data-q="${id}">Löschen</button></div></div>`;
    case 'essay_open_text': default: {
      const s = typeof x === 'string' ? x : '';
      return `<textarea class="ex-area ${k === 'essay_open_text' ? 'big' : ''}" ${bind(q)} data-a-input="studioWords" placeholder="${k === 'essay_open_text' ? 'Deine Antwort in ganzen Sätzen…' : 'Deine Antwort…'}" aria-label="Antwort">${esc(s)}</textarea>
        ${k === 'essay_open_text' ? `<div class="ex-words" data-live="words-${id}">${words(s)} Wörter</div>` : ''}`;
    }
  }
}

// Lösung lesbar je Baustein (Lösung zeigen + Ergebnis)
function solText(q, v) {
  const k = kindOf(q), li = a => `<ul>${a.join('')}</ul>`;
  const opt = j => rich(strip(v.options?.[j]));
  const s = k === 'single_choice' && Number.isInteger(v.correctOption) && v.correctOption >= 0 ? `<p>${opt(v.correctOption)}</p>`
    : k === 'multi_select' && Array.isArray(v.correctOptions) ? li(v.correctOptions.map(j => `<li>${opt(j)}</li>`))
    : k === 'true_false' ? li((v.statements || []).map(t => `<li>${rich(t?.text)} → <b>${tfName(t?.correct)}</b></li>`))
    : k === 'fill_blanks' && v.blanks?.length ? li(v.blanks.map((b, n) => `<li>Lücke ${n + 1}: <b>${esc(String(b).split('|')[0])}</b></li>`))
    : k === 'matching' ? li((v.left || []).map((l, j) => `<li>${rich(l)} → <b>${rich(v.right?.[v.pairs?.[j]])}</b></li>`))
    : k === 'ordering' ? `<ol>${(v.items || []).map(t => `<li>${rich(t)}</li>`).join('')}</ol>`
    : k === 'text_select' ? tokView(v, (j, ok) => ok ? 'ok' : '')
    : k === 'code' ? `<pre class="ex-codeout">${esc(v.correctAnswer)}</pre>`
    : k === 'number_line' ? `<p><b>${esc((v.points || []).map(fmtN).join(' · '))}</b></p><div class="ex-nlwrap sm">${nlSvg(v, [], null, v.points || [])}</div>`
    : k === 'image_hotspot' ? `${v.correctAnswer ? `<p><b>${rich(v.correctAnswer)}</b></p>` : ''}<div class="ex-hotwrap sm">${hotFig(q, v, null, true)}</div>`
    : k === 'table_fill' && v.solution ? tableView(v, (r, c) => `<b>${esc(v.solution?.[r]?.[c] ?? '')}</b>`)
    : k === 'label_image' ? `<ol>${(v.labels || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol>`
    : k === 'graph_plot' ? `<p>${v.points?.length ? `Punkte: ${ptList(v.points)}` : ''}${v.line ? `${v.points?.length ? ' · ' : ''}Gerade: y = ${esc(v.line.m)} · x ${+v.line.q < 0 ? '−' : '+'} ${esc(Math.abs(+v.line.q))}` : ''}</p>${v.points?.length ? `<div class="ex-plotwrap sm">${plotSvg(v, v.points)}</div>` : ''}`
    : k === 'categorize' ? li((v.groups || []).map((g, gi) => `<li><b>${rich(g)}:</b> ${(v.items || []).filter((_, j) => v.itemGroup?.[j] === gi).map(rich).join(', ') || '–'}</li>`))
    : v.correctAnswer ? `<p><b>${rich(v.correctAnswer)}${k === 'numeric' && v.unit ? ' ' + esc(v.unit) : ''}</b></p>` : '';
  return s;
}

// Bestätigungs-Dialoge (a.confirm)
function confirmView(a, n, done) {
  const D = {
    leave: ['Prüfung verlassen?', 'Deine Antworten in dieser Runde gehen verloren.', 'Verlassen', 'Weiterschreiben', 'bad'],
    submit: ['Prüfung abgeben?', `${done} von ${n} Aufgaben beantwortet.${done < n ? ' Offene Aufgaben geben 0 Punkte.' : ''}`, 'Abgeben', 'Zurück', 'dark'],
    timeup: ['Die Zeit ist um', 'Gib jetzt ab, um deine Note zu sehen – oder schreib ohne Zeit weiter.', 'Abgeben', 'Weiterschreiben', 'dark'],
    solution: ['Lösung anzeigen?', 'Danach gibt diese Aufgabe 0 Punkte.', 'Lösung zeigen', 'Abbrechen', 'dark'],
  }[a.confirm];
  if (!D) return '';
  const busy = a.busy === 'grade';
  return `<div class="ex-dlg-w"><div class="ex-dlg" role="alertdialog" aria-modal="true" aria-labelledby="ex-dlg-t" aria-describedby="ex-dlg-p">
    <h3 id="ex-dlg-t">${D[0]}</h3><p id="ex-dlg-p">${D[1]}</p>
    <div class="ex-dlg-a"><button class="ex-btn ghost" data-a="studioConfirmNo" ${busy ? 'disabled' : ''}>${D[3]}</button><button class="ex-btn ${D[4]}" data-a="studioConfirmYes" ${busy ? 'disabled' : ''}>${busy ? `${spin} Bewerte…` : D[2]}</button></div>
  </div></div>`;
}

/* ---------------------------------- 7) Ergebnis ---------------------------------- */
// Antwort lesbar je Baustein
function ansText(q, v, x, photo) {
  const opt = j => rich(strip(v.options?.[j]));
  switch (kindOf(q)) {
    case 'single_choice': return Number.isInteger(x) ? opt(x) : '';
    case 'multi_select': return Array.isArray(x) && x.length ? x.map(opt).join('<br>') : '';
    case 'number_line': return Array.isArray(x) && x.some(t => Number.isFinite(+t)) ? `${esc(x.map(fmtN).join(' · '))}<div class="ex-nlwrap sm">${nlSvg(v, x, null, v.points || [])}</div>` : '';
    case 'code': return typeof x === 'string' && x.trim() && !codeSame(x, v) ? `<pre class="ex-codeout">${esc(x)}</pre>` : '';
    case 'image_hotspot': return Array.isArray(x) && x.length >= 2 ? (hotFig(q, v, x, true) ? `<div class="ex-hotwrap sm">${hotFig(q, v, x, true)}</div><small class="ex-tokleg"><i class="pin"></i> deine Stelle <i class="zone"></i> gesuchte Stelle</small>` : `Stelle (${esc(x[0])} | ${esc(x[1])})`) : '';
    case 'text_select': { const on = new Set(Array.isArray(x) ? x : []); return on.size ? `${tokView(v, (j, ok) => on.has(j) ? (ok ? 'ok' : 'bad') : ok ? 'miss' : '')}<small class="ex-tokleg"><i class="ok"></i> richtig <i class="bad"></i> falsch markiert <i class="miss"></i> übersehen</small>` : ''; }
    case 'true_false': return Array.isArray(x) ? (v.statements || []).map((s, j) => x[j] == null ? '' : `${rich(s?.text)} → <b>${tfName(x[j])}</b>`).filter(Boolean).join('<br>') : '';
    case 'fill_blanks': return Array.isArray(x) && x.some(filled) ? x.map((s, j) => `${j + 1}. ${esc(s || '–')}`).join(' · ') : '';
    case 'matching': return Array.isArray(x) ? (v.left || []).map((l, j) => Number.isInteger(x[j]) ? `${rich(l)} → ${rich(v.right?.[x[j]])}` : '').filter(Boolean).join('<br>') : '';
    case 'ordering': return Array.isArray(x) ? x.map((it, p) => `${p + 1}. ${rich(v.items?.[it])}`).join('<br>') : '';
    case 'numeric': return filled(x) ? esc(`${x.value ?? ''} ${x.unit ?? ''}`.trim()) : '';
    case 'math_calculation': return filled(x) ? `${x.work ? nl(x.work) + '<br>' : ''}${x.result ? `<b>= ${esc(x.result)}</b>` : ''}` : '';
    case 'table_fill': return filled(x) ? tableView(v, (r, c) => esc(x[`${r},${c}`] || '–')) : '';
    case 'label_image': return Array.isArray(x) && x.some(filled) ? x.map((s, n) => `${n + 1}. ${esc(s || '–')}`).join('<br>') : '';
    case 'graph_plot': return Array.isArray(x) && x.length ? `Punkte: ${ptList(x)}<div class="ex-plotwrap sm">${plotSvg(v, x)}</div>` : '';
    case 'categorize': return Array.isArray(x) && x.some(Number.isInteger) ? (v.items || []).map((it, j) => Number.isInteger(x[j]) ? `${rich(it)} → <b>${rich(v.groups?.[x[j]])}</b>` : '').filter(Boolean).join('<br>') : '';
    case 'sketch': return photo ? `<img class="ex-ansimg" src="${esc(photo)}" alt="Deine Skizze">` : '';
    default: return typeof x === 'string' && x.trim() ? nl(x) : '';
  }
}
const COUNTRIES = [['CH', 'Schweiz'], ['DE', 'Deutschland'], ['AT', 'Österreich']];
const fmtGrade = (c, g) => c === 'CH' ? Number(g).toFixed(1) : String(g);
function resultView(a, doc) {
  const att = studioData().attempts.find(t => t.id === a.results); if (!att) return homeView(a);
  const qs = orderedQs(doc, a.order), c = a.country || att.country || 'CH', hints = att.hints || a.hints || {};
  const g = G.gradeFor ? G.gradeFor(c, att.earned, att.max) : { grade: att.grade, label: '', pass: att.grade >= 4 };
  const rows = G.scaleRows ? G.scaleRows(c, att.max) : [];
  return `<section class="ex-wrap ex-result">
    <div class="ex-top"><button class="ex-ic" data-a="studioHome" aria-label="Zur Übersicht">${I.back}</button><span class="grow"></span></div>
    <header class="ex-doc center"><span class="ex-kicker">${esc(doc.subject || 'Prüfung')}</span><h2>${esc(doc.title)}</h2></header>
    <div class="ex-score">
      <div><span>Punkte</span><b>${pts(att.earned)}<small> / ${pts(att.max)}</small></b></div>
      <div class="${g.pass ? 'ok' : 'low'}"><span>Note</span><b>${esc(fmtGrade(c, g.grade))}</b>${c === 'CH' && g.half != null && +g.half !== +g.grade ? `<small>gerundet ${esc(Number(g.half).toFixed(1))}</small>` : g.label && g.label !== fmtGrade(c, g.grade) ? `<small>${esc(g.label)}</small>` : ''}</div>
    </div>
    <p class="ex-sub center">${att.minutes ? `${esc(att.minutes)} min` : ''}${att.leaves ? ` · App ${esc(att.leaves)}× verlassen` : ''}</p>
    <div class="ex-seg" role="radiogroup" aria-label="Notenskala">${COUNTRIES.map(([id, t]) => `<button class="${sel(c, id)}" role="radio" aria-checked="${c === id}" data-a="studioCountry" data-id="${id}">${t}</button>`).join('')}</div>
    ${rows.length ? `<table class="ex-scale"><thead><tr><th>Note</th><th>Bezeichnung</th><th>ab Punkte</th></tr></thead><tbody>${rows.map(r => `<tr class="${String(r.grade) === String(g.grade) || (c === 'CH' && Math.abs(+r.grade - Math.round(+g.grade * 2) / 2) < 0.01) ? 'on' : ''}"><td>${esc(fmtGrade(c, r.grade))}</td><td>${esc(r.text || (r.label !== String(r.grade) ? r.label : '') || '')}</td><td>${pts(r.minPoints)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p class="ex-note">${g.text ? `${esc(g.text)} · ` : ''}Richtwert – Schulen können abweichen</p>
    <h3 class="ex-sec">Aufgaben</h3>
    <div class="ex-list">${qs.map((q, i) => { const r0 = att.results?.[q.id] || {}, r = { ...r0, points: +r0.points || 0 }, v = V(q, att.variant) || {}, hl = hints[q.id] || 0;
      const shown = ansText(q, v, (att.ans || a.ans)[q.id], (att.photos || a.photos)[q.id]), max = +q.maxPoints || 0;
      return `<article class="ex-res ${r.points >= max ? 'full' : r.points > 0 ? 'part' : 'zero'}">
        <header><span class="ex-qn">${esc(q.questionNumber || i + 1)}</span><b class="grow">${esc(plain(v.text, 90))}</b><span class="ex-pts">${pts(r.points)} / ${pts(max)} P</span></header>
        ${hl ? `<p class="ex-cost-line">${hl >= 4 ? 'Lösung angesehen → 0 Punkte' : `Abzug durch Lernhinweise: −${Math.round(pen(hl) * 100)} %`}</p>` : ''}
        <div class="ex-your"><small>Deine Antwort</small><div>${shown || '<em>keine Antwort</em>'}</div></div>
        ${r.feedback ? `<p class="ex-fb">${esc(r.feedback)}</p>` : ''}
        ${matOf(doc, q) ? `<details><summary>Material ${esc(matOf(doc, q).label)}</summary>${matView(a, doc, q, 'ex-mat-res')}</details>` : ''}
        <details><summary>Lösung</summary><div class="ex-solution">${solText(q, v)}${v.stepByStepSolution ? `<div>${rich(v.stepByStepSolution)}</div>` : ''}${v.rubricCriteria?.length ? `<ul class="ex-rubric">${v.rubricCriteria.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div></details>
      </article>`; }).join('')}</div>
    <div class="ex-actions"><button class="ex-btn ghost grow" data-a="studioPdf" ${a.busy ? 'disabled' : ''}>${a.busy === 'pdf' ? `${spin} PDF…` : `${ICON.pdf} PDF`}</button><button class="ex-btn dark grow" data-a="studioRetry">Nochmals</button></div>
  </section>`;
}

/* ---------------------------------- A4-Prüfungsbogen ---------------------------------- */
const A4_LINES = { essay_open_text: 9, math_calculation: 6, short_answer: 2, numeric: 2, formula: 2, code: 8 };
function paperView(a, doc) {
  const qs = orderedQs(doc, a.order), max = total(qs), variant = a.variant, sol = a.paperSol, box = on => `<span class="a4-box">${sol && on ? '✕' : ''}</span>`;
  return `<div class="ex-top noprint"><button class="ex-ic" data-a="studioBack" aria-label="Zurück">${I.back}</button><span class="grow"></span>
      <button class="ex-switch ${sol ? 'on' : ''}" data-a="studioPaperSol" role="switch" aria-checked="${!!sol}"><span>Lösungsbogen</span><i></i></button></div>
    <div class="ex-papertools noprint"><button class="ex-btn ghost" data-a="studioPrint">Drucken</button><button class="ex-btn dark" data-a="studioPdf" ${a.busy ? 'disabled' : ''}>${a.busy === 'pdf' ? `${spin} PDF wird erstellt…` : `${ICON.pdf} PDF herunterladen`}</button></div>
    <div class="a4-wrap"><div class="a4-paper">
      <div class="a4-head"><div><div class="a4-kicker">${esc(doc.subject || 'Prüfung')}${variant === 'remix' ? ' · Neue Zahlen' : ''}${sol ? ' · Lösungsbogen' : ''}</div><h1>${esc(doc.title)}</h1><div class="a4-tools">Hilfsmittel: ${esc((doc.tools?.length ? doc.tools : ['Stift & Papier']).join(', '))}</div></div>
        <div class="a4-score"><div>Punkte<span>___ / ${pts(max)} P.</span></div><div>Note<span>___</span></div></div></div>
      <table class="a4-fields"><tr><td>Name</td><td>Klasse</td><td>Datum</td></tr></table>
      ${qs.map((q, i) => { const v = V(q, variant) || {}, k = kindOf(q), lines = A4_LINES[k] ?? (/choice|select|true_false|matching|ordering|fill_blanks|sketch|table_fill|label_image|graph_plot|categorize|hotspot|number_line/.test(k) ? 0 : 6);   // text_select passt auf «select»
        const body = k === 'single_choice' || k === 'multi_select' ? `<div class="a4-opts">${(v.options || []).map((o, j) => `<div>${box(k === 'single_choice' ? j === v.correctOption : v.correctOptions?.includes(j))}${rich(strip(o))}</div>`).join('')}</div>`
          : k === 'true_false' ? `<div class="a4-opts">${(v.statements || []).map(s => `<div>${box(s?.correct === true)}<b>R</b>${box(s?.correct === false)}<b>F</b>${v.notGiven ? `${box(s?.correct === 'ng')}<b>?</b>` : ''}<span>${rich(s?.text)}</span></div>`).join('')}${v.notGiven ? '<div class="a4-tools">? = steht nicht im Text</div>' : ''}</div>`
          : k === 'fill_blanks' && (v.blankOptions?.length || v.wordBank?.length) ? `<div class="a4-tools">${v.blankOptions?.length ? `Auswahl: ${v.blankOptions.map((o, n) => o.length ? `(${n + 1}) ${esc(o.join(' / '))}` : '').filter(Boolean).join(' · ')}` : `Wortliste: ${esc(v.wordBank.join(' · '))}`}</div>`
          : k === 'matching' ? `<div class="a4-opts">${(v.left || []).map((l, j) => `<div><span>${rich(l)}</span> → ___ </div>`).join('')}${(v.right || []).map((r, j) => `<div><b>${L(j)}</b> ${rich(r)}</div>`).join('')}</div>`
          : k === 'ordering' ? `<div class="a4-opts">${(v.items || []).map(t => `<div><span class="a4-box"></span>${rich(t)}</div>`).join('')}</div>`
          : k === 'text_select' ? `<div class="a4-sel">${tokView(v, (j, ok) => sol && ok ? 'ok' : '')}</div>`
          : k === 'number_line' ? `<div class="ex-nlwrap">${nlSvg(v, [], null, sol ? v.points || [] : null)}</div>`
          : k === 'code' ? (v.starter ? `<pre class="ex-codeout a4">${esc(v.starter)}</pre>` : '')
          : k === 'image_hotspot' ? `<div class="ex-hotwrap">${hotFig(q, v, null, sol)}</div><div class="a4-tools">Kreuze die gesuchte Stelle in der Abbildung an.</div>`
          : k === 'sketch' ? '<div class="a4-draw"></div>'
          : k === 'table_fill' ? tableView(v, (r, c) => sol ? `<b>${esc(v.solution?.[r]?.[c] ?? '')}</b>` : '')
          : k === 'label_image' ? `${markedFig(q, v)}${v.wordBank?.length ? `<div class="a4-tools">Wortliste: ${esc(v.wordBank.join(' · '))}</div>` : ''}<div class="a4-opts">${(v.markers || []).map((_, n) => `<div><b>${n + 1}</b><span class="a4-fill">${sol ? esc(v.labels?.[n] ?? '') : ''}</span></div>`).join('')}</div>`
          : k === 'graph_plot' ? `<div class="a4-plot">${plotSvg(v, sol ? v.points : [])}</div>`
          : k === 'categorize' ? `<div class="a4-opts"><div>Begriffe: ${(v.items || []).map(rich).join(' · ')}</div></div><table class="a4-cat"><tr>${(v.groups || []).map(g => `<th>${rich(g)}</th>`).join('')}</tr><tr>${(v.groups || []).map((_, gi) => `<td>${sol ? (v.items || []).filter((_, j) => v.itemGroup?.[j] === gi).map(rich).join('<br>') : ''}</td>`).join('')}</tr></table>` : '';
        return `${partFirst(doc, qs, i) ? partHead(partOf(doc, q), 'a4-part') : ''}${matFirst(qs, i) ? matView(a, doc, q, 'a4-mat') : ''}<section class="a4-task"><div class="a4-pts">${pts(q.maxPoints)} P.</div>
          <h3>Aufgabe ${esc(q.questionNumber || String(i + 1))}</h3>${k === 'label_image' || k === 'image_hotspot' ? '' : fig(q, 'a4-fig')}
          <div class="a4-text">${rich(v.text)}</div>${body}
          ${sol ? `<div class="a4-sol">${solText(q, v)}${v.stepByStepSolution ? `<div>${rich(v.stepByStepSolution)}</div>` : ''}${v.rubricCriteria?.length ? `<ul>${v.rubricCriteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>` : lines ? `<div class="a4-lines">${'<i></i>'.repeat(lines)}</div>` : ''}
        </section>`; }).join('')}
      <div class="a4-foot">Brained Exam Studio · nur zum persönlichen Üben</div>
    </div></div>`;
}

/* ---------------------------------- Ausschnitt anpassen ---------------------------------- */
function cropEditor(a, doc) {
  const c = a.crop, b = c.box, page = doc.pages[b.pageIndex] || doc.pages[0], src = page && imgSync(page.key);
  return `<div class="ex-modal" role="dialog" aria-modal="true" aria-label="Ausschnitt anpassen"><div class="ex-modal-card">
    <div class="ex-top"><button class="ex-ic" data-a="studioCropClose" aria-label="Schliessen">${I.x}</button><b class="grow center">Ausschnitt anpassen</b><span class="ex-ic-sp"></span></div>
    ${doc.pages.length > 1 ? `<div class="ex-seg">${doc.pages.map((_, i) => `<button class="${sel(b.pageIndex, i)}" data-a="studioCropPage" data-i="${i}">S. ${i + 1}</button>`).join('')}</div>` : ''}
    <div class="crop-stage">${src ? `<img src="${src}" alt="" draggable="false">` : '<div class="ex-sub">Seite nicht verfügbar</div>'}
      <div class="crop-box" style="top:${b.ymin / 10}%;left:${b.xmin / 10}%;height:${(b.ymax - b.ymin) / 10}%;width:${(b.xmax - b.xmin) / 10}%">${['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'].map(h => `<i data-crop-h="${h}" class="h-${h}"></i>`).join('')}</div></div>
    <button class="ex-switch ${c.ink ? 'on' : ''}" data-a="studioCropInk" role="switch" aria-checked="${!!c.ink}"><span>Farbige Notizen entfernen</span><i></i></button>
    <div class="ex-actions"><button class="ex-btn ghost grow" data-a="studioCropRemove">Keine Grafik</button><button class="ex-btn dark grow" data-a="studioCropSave">Speichern</button></div>
  </div></div>`;
}
