// Brained Clarity (Prüfungsgenerator) – Blätter (A4-Look): Zusammenfassung, Spickzettel (A6-Raster), Probeprüfung mit Lösungsblatt,
// Foto-Korrektur (Pro, zählt zum Guthaben), Drucken. Alles Lokale bleibt lokal; Fotos nur im Speicher und nach der Korrektur verworfen.
import { esc } from './ui.js';
import { can } from './store.js';
import { U } from './view-state.js';
import { ui, docById, saveDocs, friendlyErr, isDemo, CLARITY_NAME } from './clarity.js';
import { fmtDate } from './clarity-upload.js';
import * as AI from './clarity-ai.js';
import * as G from './clarity-gen.js';

const MAX_PHOTOS = 12, MAX_MB = 15;
let PHOTOS = [];   // [{ id, src }] nur im Speicher (Datenschutz)
let CTX = null, seq = 0;
const T = () => (ui().view ||= { tab: 'main' });
const fmtN = n => { const v = Math.round((Number(n) || 0) * 10) / 10; return String(v); };
const arr = x => Array.isArray(x) ? x : [];

// ---------- Formeln (KaTeX lokal, bei Bedarf geladen) ----------
let katexState = 0, katexWait = [];
function loadKatex() {
  if (katexState) return; katexState = 1;
  try {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./vendor/katex/katex.min.css', import.meta.url).href; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = new URL('./vendor/katex/katex.min.js', import.meta.url).href;
    s.onload = () => { katexState = 2; katexWait.forEach(f => f()); katexWait = []; window.dispatchEvent(new Event('brained:rerender')); };
    s.onerror = () => { katexState = 3; katexWait.forEach(f => f()); katexWait = []; };
    document.head.appendChild(s);
  } catch { katexState = 3; }
}
const katexReady = () => new Promise(res => { loadKatex(); if (katexState >= 2) return res(); katexWait.push(res); setTimeout(res, 3500); });
function prettyMath(h) {   // Rückfall ohne KaTeX: Klartext hübsch (x^2 → x²)
  let x = h.replace(/([A-Za-zΔ])_([A-Za-z0-9]{1,3})\b/g, '$1<sub>$2</sub>').replace(/\^\{([^{}]{1,12})\}/g, '<sup>$1</sup>').replace(/\^(-?[0-9a-z]{1,3})/gi, '<sup>$1</sup>').replace(/_\{([^{}]{1,10})\}/g, '<sub>$1</sub>');
  return x.replace(/\\cdot|\\times/g, '·').replace(/\\pm/g, '±').replace(/\\(le|leq)\b/g, '≤').replace(/\\(ge|geq)\b/g, '≥');
}
const tex = (l, display = false) => {
  loadKatex();
  if (katexState === 2 && window.katex) { try { return window.katex.renderToString(String(l), { throwOnError: false, displayMode: display, trust: false }); } catch { } }
  return `<code class="cl-tex">${esc(l)}</code>`;
};
// Text mit $…$-Formeln: alles ausser Formeln wird mit esc() ausgegeben
export const rich = s => String(s ?? '').split(/(\$[^$]+\$)/g).map(p => p.length > 2 && p.startsWith('$') && p.endsWith('$') ? tex(p.slice(1, -1)) : prettyMath(esc(p))).join('');
const formula = f => { const t = String(f ?? '').trim(); return /\$/.test(t) ? rich(t) : tex(t.replace(/^\\\[|\\\]$/g, '')); };

// ---------- SVG der KI streng bereinigen ----------
const SVG_TAGS = new Set(['svg', 'g', 'line', 'rect', 'circle', 'ellipse', 'path', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker']);
const SVG_ATTR = new Set(['viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'transform', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'opacity', 'fill-opacity', 'stroke-opacity', 'marker-end', 'marker-start', 'id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'dx', 'dy', 'preserveAspectRatio']);
const svgCache = new Map();
export function cleanSvg(src) {
  const s = String(src || '').trim();
  if (!s || s.length > 14000) return '';
  if (svgCache.has(s)) return svgCache.get(s);
  let out = '';
  try {
    const doc = new DOMParser().parseFromString(/xmlns/i.test(s.slice(0, 200)) ? s : s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"'), 'image/svg+xml');
    const root = doc.documentElement; let n = 0;
    if (root && root.localName === 'svg' && !doc.querySelector('parsererror')) {
      const walk = (el, top) => {
        const tag = el.localName;
        if (!SVG_TAGS.has(tag) || ++n > 400) return '';
        let a = '';
        for (const at of el.attributes) {
          const k = at.name, v = at.value;
          if (!SVG_ATTR.has(k) || /javascript|expression|data:|@import|[<>]/i.test(v)) continue;
          if (/url\s*\(/i.test(v) && !/^url\(#[\w-]+\)$/.test(v.trim())) continue;
          a += ` ${k}="${esc(v)}"`;
        }
        if (top) {
          if (!/ viewBox=/.test(a)) { const w = parseFloat(el.getAttribute('width')), h = parseFloat(el.getAttribute('height')); a += ` viewBox="0 0 ${w > 0 ? w : 300} ${h > 0 ? h : 200}"`; }
          a = a.replace(/ (width|height)="[^"]*"/g, '') + ' class="cl-svg" role="img" aria-label="Abbildung zur Aufgabe"';
        }
        let inner = '';
        for (const ch of el.childNodes) { if (ch.nodeType === 3) inner += esc(ch.nodeValue); else if (ch.nodeType === 1) inner += walk(ch, false); }
        return `<${tag}${a}>${inner}</${tag}>`;
      };
      out = walk(root, true);
    }
  } catch { out = ''; }
  if (svgCache.size > 60) svgCache.clear();
  svgCache.set(s, out); return out;
}

const ptxt = p => typeof p === 'string' ? rich(p) : (p?.h ? `<b>${rich(p.h)}</b> ` : '') + rich(p?.t ?? '');
const box = '<i class="cl-box" aria-hidden="true"></i>';
const lines = n => `<div class="cl-lines" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;
const gridSvg = h => `<svg class="cl-calcgrid" style="height:${h}mm" aria-hidden="true"><defs><pattern id="clgrid" width="18.9" height="18.9" patternUnits="userSpaceOnUse"><path d="M18.9 0H0V18.9" fill="none" stroke="#6e6e7a" stroke-width=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#clgrid)" stroke="#8c8c96" stroke-width=".4"/></svg>`;
const L = i => String.fromCharCode(65 + i);

function solutionOf(q) {
  const parts = [];
  if (q.type === 'mc' && Number.isInteger(q.correct)) parts.push(`<p>Richtig: <b>${L(q.correct)}</b>${arr(q.options)[q.correct] != null ? ' – ' + rich(q.options[q.correct]) : ''}</p>`);
  if (q.type === 'multi' && Array.isArray(q.correct)) parts.push(`<p>Richtig: <b>${q.correct.map(L).join(', ')}</b></p>`);
  if (q.type === 'tf') parts.push(`<ul class="cl-sol-tf">${arr(q.statements).map(s => `<li>${s.correct ? '✓ Richtig' : '✗ Falsch'}: ${rich(s.text)}</li>`).join('')}</ul>`);
  if (q.type === 'cloze' && arr(q.blanks).length) parts.push(`<p>Lücken: ${arr(q.blanks).map(b => `<b>${rich(Array.isArray(b) ? b[0] : b)}</b>`).join(' · ')}</p>`);
  const a = q.answer;
  if (Array.isArray(a)) parts.push(`<ol>${a.map(x => `<li>${rich(x)}</li>`).join('')}</ol>`);
  else if (a != null && a !== '') parts.push(`<p class="cl-sol-a">${rich(a)}</p>`);
  if (arr(q.rubric).length) parts.push(`<div class="cl-rubric"><b>Bewertung</b><ul>${arr(q.rubric).map(r => `<li>${rich(r)}</li>`).join('')}</ul></div>`);
  return `<div class="cl-sol"><div class="cl-sol-k">Musterlösung</div>${parts.join('') || '<p>Keine Musterlösung vorhanden.</p>'}</div>`;
}
function answerArea(q) {
  const p = Number(q.points) || 1;
  switch (q.type) {
    case 'mc': case 'multi': return `<ul class="cl-opts">${arr(q.options).map((o, i) => `<li>${box}<b>${L(i)}</b><span>${rich(o)}</span></li>`).join('')}</ul>`;
    case 'tf': return `<ul class="cl-tfs">${arr(q.statements).map(s => `<li><span>${rich(s.text)}</span><em>${box} richtig ${box} falsch</em></li>`).join('')}</ul>`;
    case 'cloze': return '';
    case 'calc': return `${gridSvg(Math.max(30, Math.min(110, 18 + p * 9)))}<p class="cl-res">Resultat: <span class="cl-blank"></span></p>`;
    case 'essay': return lines(Math.min(14, Math.max(8, p * 2)));
    case 'table': return '';
    default: return lines(Math.min(8, Math.max(2, Math.ceil(p * 1.2))));
  }
}
function questionHtml(q, solved) {
  const body = q.type === 'cloze' ? `<p class="cl-qt cl-cloze">${String(q.q ?? '').split(/_{3,}/).map(rich).join('<span class="cl-blank"></span>')}</p>` : `<p class="cl-qt">${rich(q.q)}</p>`;
  const tbl = q.table && arr(q.table.cols).length ? `<table class="cl-qtable"><thead><tr>${q.table.cols.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${arr(q.table.rows).map(r => `<tr>${arr(r).map(x => `<td>${rich(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const svg = q.svg ? cleanSvg(q.svg) : '';
  return `<div class="cl-q" data-n="${esc(q.n)}"><div class="cl-q-h"><span class="cl-q-n">${esc(q.n)}</span><span class="cl-pts">${esc(ptsLabel(q.points))}</span></div>
    ${body}${q.latex ? `<div class="cl-qf">${formula(q.latex)}</div>` : ''}${svg ? `<div class="cl-qsvg">${svg}</div>` : ''}${tbl}
    ${solved ? '' : answerArea(q)}${solved ? solutionOf(q) : ''}</div>`;
}

// ---------- Blätter ----------
const ptxtList = ptxt;
const ptsLabel = p => `[ / ${fmtN(p)} Pkt.]`;
const sumPts = qs => qs.reduce((n, q) => n + (Number(q.points) || 0), 0);
const countryName = d => G.COUNTRIES[d.country]?.name || '';
// Kopfzeile: Titel links, Brain-Stempel (Logo, Land, Datum) rechts
function paperHead(doc, kicker) {
  return `<header class="cl-ph gn-ph"><div class="gn-ph-t"><div class="cl-ph-k">${esc(kicker)}</div><h1>${esc(doc.title)}</h1><div class="gn-ph-m">${esc(countryName(doc))} · ${esc(fmtDate(doc.createdAt))}</div></div>
    <div class="gn-stamp" aria-label="Brain-Stempel: ${esc(doc.country)}, ${esc(fmtDate(doc.createdAt))}"><img src="assets/icon.svg" alt="" width="30" height="30"><b>${esc(doc.country)}</b><small>${esc(fmtDate(doc.createdAt))}</small></div></header>`;
}
const foot = doc => `<footer class="gn-foot"><img src="assets/icon.svg" alt="" width="14" height="14"><span>Erstellt mit ${esc(CLARITY_NAME)} · ${esc(doc.country)} · ${esc(fmtDate(doc.createdAt))}</span></footer>`;
const droppedBox = doc => {
  const dr = doc.dropped || []; if (!dr.length) return '';
  return `<aside class="gn-dropped" data-test="dropped"><h3>${doc.goals ? 'Weggelassen anhand deiner Lernziele' : 'Weggelassen (nicht prüfungsrelevant)'}</h3><ul>${dr.map(d => `<li><b>${esc(d.t)}</b>${d.why ? ` – ${esc(d.why)}` : ''}</li>`).join('')}</ul></aside>`;
};

function summaryPaper(doc) {
  const c = doc.content;
  return `<article class="cl-paper gn-sum" data-paper="summary">${paperHead(doc, 'Zusammenfassung')}
    ${(c.sections || []).map(s => `<section class="gn-sec"><h2>${rich(s.h)}</h2>${s.p ? `<p>${rich(s.p)}</p>` : ''}${(s.points || []).length ? `<ul>${s.points.map(p => `<li>${rich(p)}</li>`).join('')}</ul>` : ''}${(s.formulas || []).map(f => `<div class="cl-sh-f">${formula(f)}</div>`).join('')}${s.trap ? `<p class="cl-sh-trap"><b>Typischer Fehler:</b> ${rich(s.trap)}</p>` : ''}</section>`).join('')}
    ${droppedBox(doc)}${foot(doc)}</article>`;
}
function cheatPaper(doc) {
  const c = doc.content, st = `<span class="gn-card-st">${esc(doc.title)} · ${esc(doc.country)} · ${esc(fmtDate(doc.createdAt))}</span>`;
  return `<article class="cl-paper gn-cheat" data-paper="cheat">${paperHead(doc, 'Spickzettel · Lernblatt')}
    <div class="gn-cards">${(c.cards || []).map(k => `<div class="gn-card"><h3>${rich(k.h)}</h3>${(k.points || []).length ? `<ul>${k.points.map(p => `<li>${rich(p)}</li>`).join('')}</ul>` : ''}${(k.formulas || []).map(f => `<div class="cl-sh-f">${formula(f)}</div>`).join('')}<div class="gn-card-f"><img src="assets/icon.svg" alt="" width="12" height="12">${st}</div></div>`).join('')}</div>
    ${droppedBox(doc)}</article>`;
}
function examPaper(doc, solved) {
  const ex = doc.content, qs = ex.questions || [], total = ex.totalPoints || sumPts(qs), t = G.passOf(doc);
  const hasCalc = qs.some(q => q.type === 'calc'), aids = ex.aids || (hasCalc ? 'Taschenrechner (nicht programmierbar), Schreibzeug' : 'Schreibzeug');
  const parts = (ex.parts || []).length ? ex.parts : [{ id: 'A', title: '' }];
  const rows = G.gradeRows(doc.country, total, t);
  const head = paperHead(doc, solved ? 'Lösungsblatt · Probeprüfung' : 'Probeprüfung');
  const meta = `<dl class="cl-meta"><div><dt>Zeit</dt><dd>${esc(ex.minutes || '')} Minuten</dd></div><div><dt>Hilfsmittel</dt><dd>${esc(aids)}</dd></div><div><dt>Punkte</dt><dd>${esc(fmtN(total))}</dd></div><div><dt>Land</dt><dd>${esc(countryName(doc))}</dd></div></dl>`;
  const partsHtml = parts.map(p => { const pq = qs.filter(q => (q.part || 'A') === p.id); return pq.length ? `<section class="cl-part"><h2><span>Teil ${esc(p.id)}</span>${p.title ? ' · ' + esc(p.title.replace(/^Teil [A-C] – /, '')) : ''}<em>${esc(fmtN(sumPts(pq)))} Pkt.</em></h2>${pq.map(q => questionHtml(q, solved)).join('')}</section>` : ''; }).join('');
  if (!solved) return `<article class="cl-paper cl-exam" data-paper="exam">${head}
    <div class="cl-fields"><div><span>Name</span><i></i></div><div><span>Datum</span><i></i></div><div class="cl-f-note"><span>Note</span><i></i></div></div>${meta}${partsHtml}${foot(doc)}</article>`;
  const raster = `<section class="gn-raster"><h2>Bewertungsraster</h2><table><thead><tr><th>Teil</th><th>Aufgaben</th><th>Punkte</th></tr></thead><tbody>${parts.map(p => { const pq = qs.filter(q => (q.part || 'A') === p.id); return pq.length ? `<tr><td>${esc(p.id)}</td><td>${esc(pq[0].n)}${pq.length > 1 ? '–' + esc(pq.at(-1).n) : ''}</td><td>${esc(fmtN(sumPts(pq)))}</td></tr>` : ''; }).join('')}<tr class="tot"><td colspan="2">Total</td><td>${esc(fmtN(total))}</td></tr></tbody></table></section>`;
  const key = `<section class="cl-scale gn-key"><h2>Notenschlüssel ${esc(doc.country)} <em>Vorschlag</em></h2><p class="gn-key-n">Vorschlag: «genügend» ab ${esc(String(Math.round(t * 100)))} % der Punkte. Die Schwelle ist einstellbar; Schulen und Lehrpersonen können abweichen.</p><table><thead><tr><th>Note</th><th>ab Punkten</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmtN(r.minPoints))} / ${esc(fmtN(total))}</td><td>${esc(r.text || '')}</td></tr>`).join('')}</tbody></table></section>`;
  return `<article class="cl-paper cl-exam cl-solved" data-paper="exam-solutions">${head}${meta}${raster}${partsHtml}${key}${foot(doc)}</article>`;
}
export const paperOf = (doc, solved = false) => doc.type === 'summary' ? summaryPaper(doc) : doc.type === 'cheat' ? cheatPaper(doc) : examPaper(doc, solved);

// ---------- Foto-Korrektur (Pro) ----------
const spinner = (msg, sub) => `<div class="cl-ex-busy" role="status" aria-live="polite"><div class="cl-ex-bar"><i></i></div><p><b>${esc(msg)}</b></p><p class="cl-ex-sub">${esc(sub || '')}</p></div>`;
export function gradePanel(doc) {
  const t = T();
  if (t.busy === 'grade') return spinner('Brainy korrigiert deine Prüfung …', 'Das dauert bis zu einer Minute. Bitte bleib auf dieser Seite.');
  if (!can('clarity')) return `<div class="cl-ex-card"><h3>Foto-Korrektur mit Brained Pro</h3><p>Löse die Probeprüfung auf Papier, fotografiere deine Antworten und Brainy korrigiert sie nach dem Bewertungsraster.</p><button class="cl-ex-btn pri" data-a="openSheet" data-type="pro">Mit Brained Pro freischalten</button></div>`;
  const res = doc.result;
  const pick = `<div class="cl-ex-card"><h3>Lösung abgeben</h3><p>Für «${esc(doc.title)}». Fotografiere jede Seite einzeln, gut ausgeleuchtet, oder lade ein PDF hoch (bis ${MAX_PHOTOS} Seiten). Die Korrektur zählt zu deinem Generator-Guthaben.</p>
    <div class="cl-ex-pick"><label class="cl-ex-btn pri"><input type="file" class="cl-vh" accept="image/*,application/pdf,.pdf" multiple data-a-change="clarityExamPhotos"/>Fotos oder PDF wählen</label>
    <label class="cl-ex-btn"><input type="file" class="cl-vh" accept="image/*" capture="environment" data-a-change="clarityExamPhotos"/>Foto aufnehmen</label></div>
    ${PHOTOS.length ? `<ol class="cl-ex-pages">${PHOTOS.map((p, i) => `<li><img src="${esc(p.src)}" alt="Seite ${i + 1}"><span>Seite ${i + 1}</span>
      <button data-a="clarityExamPhotoMove" data-id="${esc(p.id)}" data-dir="-1" aria-label="Seite ${i + 1} nach vorne" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-a="clarityExamPhotoMove" data-id="${esc(p.id)}" data-dir="1" aria-label="Seite ${i + 1} nach hinten" ${i === PHOTOS.length - 1 ? 'disabled' : ''}>↓</button>
      <button data-a="clarityExamPhotoDel" data-id="${esc(p.id)}" aria-label="Seite ${i + 1} entfernen">✕</button></li>`).join('')}</ol>` : ''}
    ${t.err && t.errFor === 'grade' ? `<div class="cl-ex-err" role="alert"><p>${esc(t.err)}</p></div>` : ''}
    <button class="cl-ex-btn pri" data-a="clarityExamGrade" ${PHOTOS.length ? '' : 'disabled'}>${t.err && t.errFor === 'grade' ? 'Nochmals versuchen' : 'Prüfung korrigieren'}</button>
    <p class="cl-ex-priv">Datenschutz: Deine Fotos bleiben nur im Arbeitsspeicher und werden nach der Korrektur nicht gespeichert.</p></div>`;
  if (!res) return pick;
  const gr = G.gradeOf(doc.country, res.earned, res.max, G.passOf(doc));
  return `<div class="cl-ex-res"><div class="cl-ex-score"><div><span>Punkte</span><b>${esc(fmtN(res.earned))} / ${esc(fmtN(res.max))}</b></div><div><span>Note (Vorschlag)</span><b>${esc(gr.label)}</b></div><div class="${gr.pass ? 'ok' : 'no'}"><span>Ergebnis</span><b>${gr.pass ? 'Bestanden' : 'Noch nicht'}</b></div></div>
    ${res.note ? `<p class="cl-ex-note">${esc(res.note)}</p>` : ''}
    ${res.demo || doc.demo || isDemo() ? `<p class="cl-ex-demo">Demo-Modus: Die Korrektur ist ein einfaches Beispiel und liest keine echte Handschrift. Mit aktiver KI siehst du das richtige Ergebnis.</p>` : ''}
    <h3 class="cl-ex-h3">Pro Aufgabe</h3><ul class="cl-ex-list">${(res.results || []).map(r => `<li><div><b>Aufgabe ${esc(r.n)}</b><span class="cl-ex-p">${esc(fmtN(r.points))} / ${esc(fmtN(r.max))} Pkt.</span>${r.uncertain ? '<span class="cl-ex-unc">Bitte prüfen</span>' : ''}</div><p>${esc(r.feedback || '')}</p></li>`).join('')}</ul>
    <button class="cl-ex-btn" data-a="clarityExamRedo">Andere Seiten abgeben</button></div>`;
}
// Demo ohne KI: Beispiel-Korrektur (liest keine Handschrift). Jede Aufgabe gibt rund 70 % der Punkte, alles als «Bitte prüfen»
function demoCorrection(exam) {
  const results = (exam?.questions || []).map(q => { const max = Number(q.points) || 1; return { n: q.n, points: Math.round(max * 0.7 * 2) / 2, max, uncertain: true, feedback: 'Beispiel: Ohne KI wird deine Handschrift nicht gelesen.' }; });
  return { results, demo: true, note: 'Das ist nur ein Beispiel-Ergebnis, damit du den Ablauf siehst. Mit aktiver KI wird deine Lösung wirklich korrigiert.' };
}

// ---------- Drucken / Teilen ----------
export async function printPaper(kind) {
  await katexReady();
  const b = document.body, cls = ['cl-printing', kind === 'cheat' ? 'cl-p-cheat' : 'cl-p-exam'];
  let done = false;
  const end = () => { if (done) return; done = true; b.classList.remove(...cls); document.documentElement.style.removeProperty('--cl-print-title'); removeEventListener('afterprint', end); CTX?.render?.(); };
  const d = docById(ui().docId); b.classList.add(...cls); document.documentElement.style.setProperty('--cl-print-title', JSON.stringify(String(d?.title || '').slice(0, 60))); addEventListener('afterprint', end);
  await new Promise(r => setTimeout(r, 60));
  try { window.print(); } catch { }
  setTimeout(end, 1500);   // Plattformen ohne afterprint (iOS/Android-WebView)
}
const plain = p => typeof p === 'string' ? p : [p?.h, p?.t].filter(Boolean).join(': ');
export function plainText(doc, solved = false) {
  const c = doc.content, head = [doc.title, `${countryName(doc)} · ${fmtDate(doc.createdAt)}`, ''];
  if (doc.type === 'summary') return [...head, ...c.sections.flatMap(s => [s.h.toUpperCase(), s.p, ...(s.points || []).map(p => '• ' + plain(p)), ...(s.formulas || []).map(f => 'Formel: ' + f), ...(s.trap ? ['Typischer Fehler: ' + s.trap] : []), ''])].filter(x => x !== undefined).join('\n');
  if (doc.type === 'cheat') return [...head, ...c.cards.flatMap(k => [k.h.toUpperCase(), ...(k.points || []).map(p => '• ' + plain(p)), ...(k.formulas || []).map(f => 'Formel: ' + f), ''])].join('\n');
  return [...head, `${c.minutes || ''} Minuten · ${fmtN(c.totalPoints)} Punkte`, '', ...(c.questions || []).flatMap(q => [`${q.n}. ${q.q} ${ptsLabel(q.points)}`, ...(q.options || []).map((o, i) => `   ${L(i)}) ${o}`), ...(solved ? [`   Lösung: ${plain(q.answer ?? '')}`, ...(q.rubric || []).map(r => '   ' + r)] : []), ''])].join('\n');
}

// ---------- Aktionen ----------
export function examActions(ctx) {
  CTX = ctx; const { render, toast } = ctx;
  const fail = (what, e, key) => { const t = T(); t.busy = null; t.err = friendlyErr(e, what); t.errFor = key; render(); };
  return {
    clarityDocTab(d) { const t = T(); t.tab = d.id || 'main'; t.err = ''; render(); },
    clarityDocMode(d) { T().mode = d.id === 'solutions' ? 'solutions' : 'tasks'; render(); },
    clarityPass(d) {   // Schwelle für «genügend» in 5-%-Schritten
      const doc = docById(ui().docId); if (!doc) return; const cur = Math.round(G.passOf(doc) * 100);
      doc.passPct = Math.max(30, Math.min(90, cur + (+d.d || 0))); saveDocs();
    },
    clarityPrint() { const doc = docById(ui().docId); if (doc) printPaper(doc.type === 'cheat' ? 'cheat' : 'exam'); },
    async clarityShare() {
      const doc = docById(ui().docId); if (!doc) return;
      try { await navigator.share({ title: doc.title, text: plainText(doc, T().mode === 'solutions') }); } catch (e) { if (e?.name !== 'AbortError') toast?.('Teilen hat nicht geklappt.'); }
    },
    clarityExamPhotoMove(d) { const i = PHOTOS.findIndex(p => p.id === d.id), j = i + (+d.dir || 0); if (i < 0 || j < 0 || j >= PHOTOS.length) return; [PHOTOS[i], PHOTOS[j]] = [PHOTOS[j], PHOTOS[i]]; render(); },
    clarityExamPhotoDel(d) { PHOTOS = PHOTOS.filter(p => p.id !== d.id); render(); },
    clarityExamRedo() { const doc = docById(ui().docId); if (doc) { delete doc.result; saveDocs(); } PHOTOS = []; T().err = ''; render(); },
    async clarityExamGrade() {
      const doc = docById(ui().docId), t = T(); if (!doc || doc.type !== 'exam' || t.busy || !PHOTOS.length) return;
      t.busy = 'grade'; t.err = ''; render();
      try {
        const cs = { id: doc.gid, title: doc.title, pages: doc.pages || 0, demo: doc.demo || isDemo(), grading: { country: doc.country, scale: doc.content.scale || '1-6' }, usage: { calls: 0, tin: 0, tout: 0, cost: 0, byStep: {} } };
        AI.keepSharpS(doc.country !== 'CH');
        let r; try { r = await AI.gradeHandwrittenExam(cs, doc.content, PHOTOS.map(p => p.src)); } catch (e) { if ((doc.demo || isDemo()) && /KI-Verbindung/.test(String(e?.message))) r = demoCorrection(doc.content); else throw e; } finally { AI.keepSharpS(false); }
        const results = (r?.results || []).map(x => ({ n: x.n, points: Number(x.points) || 0, max: Number(x.max) || 0, feedback: String(x.feedback || ''), uncertain: !!x.uncertain }));
        if (!results.length) throw new Error('Unvollständig');
        const earned = r.earned ?? results.reduce((n, x) => n + x.points, 0), max = r.max ?? results.reduce((n, x) => n + x.max, 0);
        doc.result = { results, earned, max, note: String(r.note || ''), demo: !!r.demo, ts: Date.now() };
        PHOTOS = []; saveDocs(); t.busy = null; render();
      } catch (e) { fail('Die Korrektur', e, 'grade'); }
    },
  };
}

export function examChange(ctx) {
  const { render, toast } = ctx;
  return {
    async clarityExamPhotos(el) {
      const list = [...(el.files || [])]; el.value = '';
      for (const f of list) {
        if (PHOTOS.length >= MAX_PHOTOS) { toast?.(`Maximal ${MAX_PHOTOS} Seiten.`); break; }
        if (f.size > MAX_MB * 1048576) { toast?.(`${f.name}: zu gross (max. ${MAX_MB} MB)`); continue; }
        try {
          if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { for (const x of (await pdfImages(f)) || []) { const s = srcOf(x); if (s && PHOTOS.length < MAX_PHOTOS) PHOTOS.push({ id: 'p' + (++seq), src: s }); } }
          else { const s = srcOf(await AI.photoToImage(f).catch(() => imgFromFile(f))); if (s) PHOTOS.push({ id: 'p' + (++seq), src: s }); else throw new Error('leer'); }
        } catch { toast?.(`${f.name}: konnte nicht gelesen werden. Versuche ein anderes Foto.`); }
      }
      T().err = ''; render();
    },
  };
}
// nur für Tests
export const __exam = { photos: () => PHOTOS, setPhotos: p => { PHOTOS = p; }, cleanSvg, printPaper, paperOf, plainText };
try { if (typeof location !== 'undefined' && /[?&]test\b/.test(location.search)) globalThis.__clExamApi = __exam; } catch { }

const imgFromFile = f => new Promise((res, rej) => {   // Rückfall: verkleinertes JPEG als Data-URL
  const u = URL.createObjectURL(f), im = new Image();
  im.onload = () => { const s = Math.min(1, 1800 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); res(cv.toDataURL('image/jpeg', 0.8)); };
  im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Bild nicht lesbar')); }; im.src = u;
});
async function pdfImages(f) {
  const { pdfPages } = await import('./pdf.js');
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const out = await pdfPages(b64, 1, MAX_PHOTOS, 1600);
  return (out?.pages || []).map(x => x.url);
}
const srcOf = x => typeof x === 'string' ? x : x?.src || x?.dataUrl || '';
