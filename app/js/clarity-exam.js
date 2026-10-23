// Brained Clarity – Screen 6: Spickzettel, A4-Probeprüfung, Foto-Korrektur (Bauplan docs/CLARITY-BAUPLAN.md §1 Screen 6)
// Alles Lokale bleibt lokal: Prüfungen im Kurs (course.exams), Fotos nur im Speicher und nach der Korrektur verworfen.
import { esc } from './ui.js';
import { ui, curCourse, saveCourse, friendlyErr, isDemo, CLARITY_NAME } from './clarity.js';
import * as AI from './clarity-ai.js';
import * as EN from './clarity-engine.js';
import { scaleRows, gradeFor } from './grades.js';

// Funktionen der anderen Helfer: erst deren Version, in Tests per globalThis.__clExam überschreibbar
const hook = n => globalThis.__clExam?.[n] || AI[n] || EN[n];
const MAX_PHOTOS = 12, MAX_MB = 15, KEEP_EXAMS = 6;
const SIZES = { 8: ['Kurz', 'ca. 30 Min.'], 12: ['Standard', 'ca. 45 Min.'], 16: ['Lang', 'ca. 60 Min.'] };
let PHOTOS = [];   // [{ id, src }] nur im Speicher (Datenschutz)
let CTX = null, seq = 0;

const T = () => (ui().tools ||= { tab: 'sheet', mode: 'tasks', busy: null, err: '', progress: '', size: 12, examId: null, variant: 0 });
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

// ---------- Noten (Rückfall, falls cl-engine die Funktion anders liefert) ----------
function gradingOf(c) { const g = c?.grading || {}; return { country: g.country || 'CH', scale: g.scale || (g.country === 'AT' ? '1-5' : '1-6'), target: g.target ?? (g.country === 'AT' ? 2 : g.country === 'DE' ? 2 : 5) }; }
function de15(p) {
  if (p >= 0.95) return 15; if (p >= 0.5) return Math.min(14, 5 + Math.floor((p - 0.5) / 0.45 * 10 + 1e-9));
  const th = [0.4, 0.33, 0.27, 0.2]; const i = th.findIndex(t => p >= t - 1e-9); return i < 0 ? 0 : 4 - i;
}
export function gradeOf(c, earned, max) {
  const g = gradingOf(c), p = max > 0 ? Math.max(0, Math.min(1, earned / max)) : 0, unit = g.scale === '0-15' ? 'Punkte' : 'Note';
  try {
    const r = hook('gradeExam')?.(earned, max, g.country, g.scale);   // Engine: gradeExam(earned, max, country, scale)
    if (r && typeof r === 'object' && r.label != null) return { label: String(r.label), pass: !!r.pass, text: r.text || '', unit };
  } catch { }
  if (g.scale === '0-15') { const pt = de15(p); return { label: String(pt), pass: pt >= 5, text: '', unit }; }
  return { ...gradeFor2(g.country, earned, max), unit };
}
function gradeFor2(country, e, m) { const r = gradeFor(country, e, m); return { label: r.label, pass: r.pass, text: r.text || '' }; }
const targetLabel = g => g.scale === '0-15' ? `${fmtN(g.target)} Punkte` : (g.country === 'CH' ? Number(g.target).toFixed(1) : String(g.target));
function scaleList(c, total) {   // Tabelle «ab wie vielen Punkten welche Note», aus derselben Engine wie die Korrektur
  const g = gradingOf(c), E = hook('gradeExam'), better = hook('isBetterOrEqual');
  if (E && better && total > 0) {
    const grades = g.scale === '0-15' ? Array.from({ length: 16 }, (_, i) => 15 - i) : g.country === 'CH' ? [6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1] : g.country === 'AT' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
    try {
      const rows = grades.map(v => { let pt = 0; while (pt < total && !better(g.country, g.scale, E(pt, total, g.country, g.scale).grade, v)) pt += 0.5; return { v, label: hook('formatGrade')(g.country, g.scale, v), minPoints: Math.min(pt, total), text: hook('gradeLabel')?.(g.country, g.scale, v) || '', ok: better(g.country, g.scale, E(Math.min(pt, total), total, g.country, g.scale).grade, v) }; }).filter(r => r.ok);
      if (rows.length >= 3) return rows;
    } catch { }
  }
  if (g.scale === '0-15') return Array.from({ length: 16 }, (_, i) => 15 - i).map(pt => ({ label: String(pt), minPoints: Math.min(total, Math.ceil((pt === 0 ? 0 : pt >= 5 ? 0.5 + (pt - 5) * 0.045 : [0.2, 0.27, 0.33, 0.4][pt - 1]) * total * 2 - 1e-9) / 2), text: pt >= 5 ? '' : 'nicht bestanden' }));
  return scaleRows(g.country, total);
}
const ptsLabel = p => { try { const r = hook('pointsLabel')?.(p); if (typeof r === 'string' && r) return r; } catch { } return `[ / ${fmtN(p)} Pkt.]`; };
const sysName = g => g.country === 'CH' ? 'Schweiz (1–6, ab 4.0 genügend)' : g.country === 'AT' ? 'Österreich (1–5)' : g.scale === '0-15' ? 'Deutschland (0–15 Punkte)' : 'Deutschland (1–6)';

// ---------- Spickzettel / Prüfung: Daten ----------
function localSheet(c) {
  return { title: c.title || 'Spickzettel', sections: arr(c.modules).map(m => ({ moduleTitle: m.title, concepts: arr(m.conceptIds).map(id => arr(c.concepts).find(k => k.id === id)).filter(Boolean).map(k => {
    const ess = arr(k.blocks).find(b => b.type === 'ESSENCE_AND_TRAP')?.content || {};
    return { title: k.title, points: arr(ess.points).length ? ess.points : arr(k.preview), formulas: arr(ess.formulas), trap: ess.trap?.text || '' };
  }) })).filter(s => s.concepts.length) };
}
function localExam(c, opts) {
  const ks = arr(c.concepts).filter(k => k.triage !== 'known').slice(0, opts.questionCount || 8), g = gradingOf(c);
  const qs = ks.map((k, i) => ({ n: i + 1, part: i < ks.length / 2 ? 'A' : 'B', type: 'short', points: 4, q: `Erkläre in eigenen Worten: ${k.title}`, answer: arr(k.preview).join(' '), rubric: arr(k.preview).slice(0, 4).map(p => `1 P: ${p}`), concept: k.id }));
  return { title: `Probeprüfung ${c.title || ''}`.trim(), minutes: Math.max(15, qs.length * 5), country: g.country, totalPoints: qs.length * 4, parts: [{ id: 'A', title: 'Wissen und Verstehen' }, { id: 'B', title: 'Anwenden' }], questions: qs, demo: true };
}
const sumPts = qs => qs.reduce((n, q) => n + (Number(q.points) || 0), 0);
// Demo ohne KI: Beispiel-Korrektur (liest keine Handschrift). Jede Aufgabe gibt rund 70 % der Punkte, alles als «Bitte prüfen» und als Demo markiert
function demoCorrection(exam) {
  const results = arr(exam?.questions).map(q => { const max = Number(q.points) || 1; return { n: q.n, points: Math.round(max * 0.7 * 2) / 2, max, uncertain: true, feedback: 'Beispiel: Ohne KI wird deine Handschrift nicht gelesen.' }; });
  return { results, demo: true, note: 'Das ist nur ein Beispiel-Ergebnis, damit du den Ablauf siehst. Mit aktiver KI wird deine Lösung wirklich korrigiert.' };
}
function examOf(rec) { return rec?.exam || null; }
const curRec = c => arr(c?.exams).find(r => r.id === T().examId) || arr(c?.exams)[0] || null;

// ---------- Ansicht ----------
const head = c => `<header class="cl-ex-top">
  <button class="cl-ex-back" data-a="clarityGo" data-to="dashboard" aria-label="Zurück zum Dashboard"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span>Dashboard</span></button>
  <div class="cl-ex-ttl"><div class="cl-ex-k">${esc(CLARITY_NAME.toUpperCase())}</div><h2>Prüfung &amp; Zusammenfassung</h2><p>${esc(c.title || '')}</p></div></header>`;
const tabs = t => `<nav class="cl-ex-tabs" role="tablist" aria-label="Werkzeuge">${[['sheet', 'Spickzettel'], ['exam', 'Probeprüfung'], ['grade', 'Korrektur']].map(([id, l]) =>
  `<button role="tab" aria-selected="${t.tab === id}" class="${t.tab === id ? 'on' : ''}" data-a="clarityExamTab" data-id="${id}">${l}</button>`).join('')}</nav>`;
const spinner = (msg, sub) => `<div class="cl-ex-busy" role="status" aria-live="polite"><div class="cl-ex-bar"><i></i></div><p><b>${esc(msg)}</b></p><p class="cl-ex-sub">${esc(sub || '')}</p></div>`;
const errBox = (msg, a, label = 'Nochmals versuchen') => `<div class="cl-ex-err" role="alert"><p>${esc(msg)}</p><button class="cl-ex-btn" data-a="${a}">${label}</button></div>`;
const demoNote = c => (c.demo || isDemo()) ? `<p class="cl-ex-demo">Demo-Modus: Ohne KI-Verbindung entstehen nur einfache Beispiele aus deinem Material. Die echte Qualität siehst du mit aktiver KI.</p>` : '';

const runHead = () => '';   // Kopf-/Fusszeile und Seitenzahl kommen beim Druck aus @page (css/clarity-exam.css)
const ptxt = p => typeof p === 'string' ? rich(p) : (p?.h ? `<b>${rich(p.h)}</b> ` : '') + rich(p?.t ?? '');

function sheetPaper(c, sh) {
  const sections = arr(sh.sections);
  return `<article class="cl-paper cl-sheet" data-paper="sheet">${runHead()}
    <header class="cl-ph"><img class="cl-logo" src="assets/icon.svg" alt="" width="34" height="34"><div><div class="cl-ph-k">Kompakt-Spickzettel</div><h1>${esc(sh.title || c.title || 'Spickzettel')}</h1></div></header>
    ${sections.map(s => `<section class="cl-sh-mod"><h2>${esc(s.moduleTitle)}</h2><div class="cl-sh-cols">${arr(s.concepts).map(k => `<div class="cl-sh-c"><h3>${esc(k.title)}</h3>
      ${arr(k.points).length ? `<ul>${arr(k.points).map(p => `<li>${ptxt(p)}</li>`).join('')}</ul>` : ''}
      ${arr(k.formulas).map(f => `<div class="cl-sh-f">${formula(f)}</div>`).join('')}
      ${k.trap ? `<p class="cl-sh-trap"><b>Prüfungsfalle:</b> ${rich(typeof k.trap === 'object' ? k.trap.text : k.trap)}</p>` : ''}</div>`).join('')}</div></section>`).join('')}
  </article>`;
}

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
function examPaper(c, rec, solved) {
  const ex = rec.exam, qs = arr(ex.questions), total = ex.totalPoints || sumPts(qs), g = rec.grading || gradingOf(c);
  const hasCalc = qs.some(q => q.type === 'calc');
  const aids = ex.aids || (Array.isArray(ex.tools) ? ex.tools.join(', ') : '') || (hasCalc ? 'Taschenrechner (nicht programmierbar), Schreibzeug' : 'Schreibzeug');
  const parts = arr(ex.parts).length ? ex.parts : [{ id: 'A', title: '' }];
  return `<article class="cl-paper cl-exam${solved ? ' cl-solved' : ''}" data-paper="exam">${runHead()}
    <header class="cl-ph"><img class="cl-logo" src="assets/icon.svg" alt="" width="34" height="34"><div><div class="cl-ph-k">${solved ? 'Musterlösung · ' : ''}Probeprüfung</div><h1>${esc(ex.title || c.title)}</h1></div></header>
    <div class="cl-fields"><div><span>Name</span><i></i></div><div><span>Datum</span><i></i></div><div class="cl-f-note"><span>Note</span><i></i></div></div>
    <dl class="cl-meta"><div><dt>Zeit</dt><dd>${esc(ex.minutes || '')} Minuten</dd></div><div><dt>Hilfsmittel</dt><dd>${esc(aids)}</dd></div><div><dt>Punkte</dt><dd>${esc(fmtN(total))}</dd></div><div><dt>Notensystem</dt><dd>${esc(g.country)}${g.scale === '0-15' ? ' (0–15)' : ''} · Ziel ${esc(targetLabel(g))}</dd></div></dl>
    ${parts.map(p => { const pq = qs.filter(q => (q.part || 'A') === p.id); return pq.length ? `<section class="cl-part"><h2><span>Teil ${esc(p.id)}</span>${p.title ? ' · ' + esc(p.title) : ''}<em>${esc(fmtN(sumPts(pq)))} Pkt.</em></h2>${pq.map(q => questionHtml(q, solved)).join('')}</section>` : ''; }).join('')}
    <section class="cl-scale"><h2>Notenskala ${esc(g.country)}</h2><table><thead><tr><th>${g.scale === '0-15' ? 'Punkte' : 'Note'}</th><th>ab Punkten</th><th></th></tr></thead><tbody>${scaleList(c, total).map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmtN(r.minPoints))} / ${esc(fmtN(total))}</td><td>${esc(r.text || '')}</td></tr>`).join('')}</tbody></table></section>
  </article>`;
}

const toolbar = (kind, extra = '') => `<div class="cl-ex-bar-tools">
  <button class="cl-ex-btn pri" data-a="clarityExamPrint" data-id="${kind}">Drucken / Als PDF speichern</button>
  ${typeof navigator !== 'undefined' && navigator.share ? `<button class="cl-ex-btn" data-a="clarityExamShare" data-id="${kind}">Teilen</button>` : ''}${extra}</div>
  <p class="cl-ex-hint">${globalThis.Capacitor?.isNativePlatform?.() ? 'In der App öffnet sich der Druckdialog je nach Handy nicht. Tippe dann auf «Teilen» und sende das Blatt als Text an Mail, Notizen oder einen Drucker (AirPrint).' : 'Falls sich kein Druckdialog öffnet (manche Handys), nutze «Teilen» und sende das Blatt als Text an Mail, Notizen oder einen Drucker.'}</p>`;

function sheetTab(c, t) {
  if (t.busy === 'sheet') return spinner('Brainy fasst deinen Stoff zusammen …', t.progress || 'Das dauert meist 10 bis 30 Sekunden.');
  if (t.err && t.errFor === 'sheet') return errBox(t.err, 'clarityExamSheet');
  if (!c.sheet) return `<div class="cl-ex-empty"><h3>Dein Spickzettel auf einer A4-Seite</h3><p>Alle Kernkonzepte pro Modul, Formeln und die typischen Prüfungsfallen. Druckfertig in Schwarz-Weiss.</p><button class="cl-ex-btn pri" data-a="clarityExamSheet">Spickzettel erstellen</button>${demoNote(c)}</div>`;
  return `${toolbar('sheet', '<button class="cl-ex-btn" data-a="clarityExamSheet">Neu erstellen</button>')}${demoNote(c)}<div class="cl-paper-wrap">${sheetPaper(c, c.sheet)}</div>`;
}
function examTab(c, t) {
  const g = gradingOf(c), rec = curRec(c);
  if (t.busy === 'exam') return spinner('Brainy stellt deine Probeprüfung zusammen …', t.progress || 'Das kann bis zu einer Minute dauern. Du musst nichts tun.');
  const setup = `<div class="cl-ex-setup"><div class="cl-ex-g"><span>Notensystem</span><b>${esc(sysName(g))}</b><span>Ziel-Note</span><b>${esc(targetLabel(g))}</b></div>
    <div class="cl-ex-sizes" role="radiogroup" aria-label="Umfang">${Object.entries(SIZES).map(([n, [l, s]]) => `<button role="radio" aria-checked="${+n === +t.size}" class="${+n === +t.size ? 'on' : ''}" data-a="clarityExamSize" data-id="${n}"><b>${l}</b><span>${s}</span></button>`).join('')}</div></div>`;
  if (t.err && t.errFor === 'exam') return errBox(t.err, 'clarityExamNew');
  if (!rec) return `<div class="cl-ex-empty"><h3>Eine echte Probeprüfung im A4-Format</h3><p>Mit Teil A, B und C, Punkten pro Aufgabe und der Notenskala deines Landes. Zum Ausdrucken und Lösen auf Papier.</p>${setup}<button class="cl-ex-btn pri" data-a="clarityExamNew">Prüfung erzeugen</button>${demoNote(c)}</div>`;
  const solved = t.mode === 'solutions', many = arr(c.exams).length > 1;
  return `<div class="cl-ex-seg" role="tablist" aria-label="Ansicht"><button role="tab" aria-selected="${!solved}" class="${solved ? '' : 'on'}" data-a="clarityExamMode" data-id="tasks">Aufgaben</button><button role="tab" aria-selected="${solved}" class="${solved ? 'on' : ''}" data-a="clarityExamMode" data-id="solutions">Lösungen</button></div>
    ${toolbar('exam', '<button class="cl-ex-btn" data-a="clarityExamNew">Neue Prüfung erzeugen</button>')}
    ${many ? `<div class="cl-ex-saved"><span>Gespeichert:</span>${arr(c.exams).map((r, i) => `<button class="${r.id === rec.id ? 'on' : ''}" data-a="clarityExamPick" data-id="${esc(r.id)}">${i + 1}${r.result ? ' · korrigiert' : ''}</button>`).join('')}</div>` : ''}
    ${(rec.exam.demo || c.demo || isDemo()) ? `<p class="cl-ex-demo">Demo-Modus: einfache Beispielprüfung aus deinem Material, ohne KI-Qualität.</p>` : ''}
    <div class="cl-paper-wrap">${examPaper(c, rec, solved)}</div>
    <div class="cl-ex-next"><button class="cl-ex-btn" data-a="clarityExamTab" data-id="grade">Gelöst? Foto abgeben und korrigieren lassen</button></div>`;
}

function weakOf(c, rec) {
  const res = rec?.result; if (!res) return [];
  const qs = arr(rec.exam.questions), by = {};
  for (const r of arr(res.results)) { const q = qs.find(x => x.n === r.n); const k = q && resolveConcept(c, q.concept); if (!k) continue; (by[k.id] ||= { k, e: 0, m: 0 }); by[k.id].e += Number(r.points) || 0; by[k.id].m += Number(r.max) || Number(q.points) || 0; }
  return Object.values(by).filter(x => x.m > 0 && x.e / x.m < 0.6).sort((a, b) => a.e / a.m - b.e / b.m);
}
const resolveConcept = (c, ref) => arr(c.concepts).find(k => k.id === ref) || arr(c.concepts).find(k => k.title && ref && k.title.trim().toLowerCase() === String(ref).trim().toLowerCase()) || null;

function gradeTab(c, t) {
  const rec = curRec(c);
  if (!rec) return `<div class="cl-ex-empty"><h3>Zuerst eine Probeprüfung</h3><p>Erzeuge eine Prüfung, löse sie auf Papier und fotografiere deine Antworten.</p><button class="cl-ex-btn pri" data-a="clarityExamTab" data-id="exam">Zur Probeprüfung</button></div>`;
  if (t.busy === 'grade') return spinner('Brainy korrigiert deine Prüfung …', 'Das dauert bis zu einer Minute. Bitte bleib auf dieser Seite.');
  const res = rec.result;
  const pick = `<div class="cl-ex-card"><h3>Lösung abgeben</h3><p>Für «${esc(rec.exam.title || c.title)}». Fotografiere jede Seite einzeln, gut ausgeleuchtet, oder lade ein PDF hoch (bis ${MAX_PHOTOS} Seiten).</p>
    <div class="cl-ex-pick"><label class="cl-ex-btn pri"><input type="file" class="cl-vh" accept="image/*,application/pdf,.pdf" multiple data-a-change="clarityExamPhotos"/>Fotos oder PDF wählen</label>
    <label class="cl-ex-btn"><input type="file" class="cl-vh" accept="image/*" capture="environment" data-a-change="clarityExamPhotos"/>Foto aufnehmen</label></div>
    ${PHOTOS.length ? `<ol class="cl-ex-pages">${PHOTOS.map((p, i) => `<li><img src="${esc(p.src)}" alt="Seite ${i + 1}"><span>Seite ${i + 1}</span>
      <button data-a="clarityExamPhotoMove" data-id="${esc(p.id)}" data-dir="-1" aria-label="Seite ${i + 1} nach vorne" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-a="clarityExamPhotoMove" data-id="${esc(p.id)}" data-dir="1" aria-label="Seite ${i + 1} nach hinten" ${i === PHOTOS.length - 1 ? 'disabled' : ''}>↓</button>
      <button data-a="clarityExamPhotoDel" data-id="${esc(p.id)}" aria-label="Seite ${i + 1} entfernen">✕</button></li>`).join('')}</ol>` : ''}
    ${t.err && t.errFor === 'grade' ? `<div class="cl-ex-err" role="alert"><p>${esc(t.err)}</p></div>` : ''}
    <button class="cl-ex-btn pri" data-a="clarityExamGrade" ${PHOTOS.length ? '' : 'disabled'}>${t.err && t.errFor === 'grade' ? 'Nochmals versuchen' : 'Prüfung korrigieren'}</button>
    <p class="cl-ex-priv">Datenschutz: Deine Fotos bleiben nur im Arbeitsspeicher und werden nach der Korrektur nicht gespeichert.</p></div>`;
  if (!res) return `${pick}${demoNote(c)}`;
  const gr = gradeOf(c, res.earned, res.max), g = rec.grading || gradingOf(c), weak = weakOf(c, rec);
  const shownGrade = res.grade != null && res.gradeLabel == null ? String(res.grade) : (res.gradeLabel || gr.label);
  return `<div class="cl-ex-res"><div class="cl-ex-score"><div><span>Punkte</span><b>${esc(fmtN(res.earned))} / ${esc(fmtN(res.max))}</b></div><div><span>${esc(gr.unit)}</span><b>${esc(String(shownGrade))}</b></div><div class="${gr.pass ? 'ok' : 'no'}"><span>Ziel ${esc(targetLabel(g))}</span><b>${gr.pass ? 'Bestanden' : 'Noch nicht'}</b></div></div>
    ${res.note ? `<p class="cl-ex-note">${esc(res.note)}</p>` : ''}
    ${(res.demo || c.demo || isDemo()) ? `<p class="cl-ex-demo">Demo-Modus: Die Korrektur ist ein einfaches Beispiel und liest keine echte Handschrift. Mit aktiver KI siehst du das richtige Ergebnis.</p>` : ''}
    ${weak.length ? `<div class="cl-ex-card cl-ex-weak"><h3>Schwach bei</h3><p>Diese Themen fliessen als Hinweis in deine Prognose ein.</p>${weak.map(w => `<button class="cl-ex-weakb" data-a="clarityExamWeak" data-id="${esc(w.k.id)}"><span>${esc(w.k.title)}</span><em>${esc(fmtN(w.e))} / ${esc(fmtN(w.m))} Pkt.</em></button>`).join('')}</div>` : ''}
    <h3 class="cl-ex-h3">Pro Aufgabe</h3><ul class="cl-ex-list">${arr(res.results).map(r => `<li><div><b>Aufgabe ${esc(r.n)}</b><span class="cl-ex-p">${esc(fmtN(r.points))} / ${esc(fmtN(r.max))} Pkt.</span>${r.uncertain ? '<span class="cl-ex-unc">Bitte prüfen</span>' : ''}</div><p>${esc(r.feedback || '')}</p></li>`).join('')}</ul>
    <button class="cl-ex-btn" data-a="clarityExamRedo">Andere Seiten abgeben</button></div>`;
}

export function examView() {
  const c = curCourse(), t = T();
  if (!c) return `<section class="cl cl-ex"><div class="cl-ex-empty"><h3>Kein Kurs gewählt</h3><button class="cl-ex-btn pri" data-a="clarityGo" data-to="welcome">Zum Start</button></div></section>`;
  const body = t.tab === 'exam' ? examTab(c, t) : t.tab === 'grade' ? gradeTab(c, t) : sheetTab(c, t);
  return `<section class="cl cl-ex">${head(c)}${tabs(t)}<div class="cl-ex-body">${body}</div></section>`;
}

// ---------- Drucken / Teilen ----------
export async function printPaper(kind) {
  await katexReady();
  const b = document.body, cls = ['cl-printing', kind === 'sheet' ? 'cl-p-sheet' : 'cl-p-exam'];
  let done = false;
  const end = () => { if (done) return; done = true; b.classList.remove(...cls); document.documentElement.style.removeProperty('--cl-print-title'); removeEventListener('afterprint', end); CTX?.render?.(); };
  const c = curCourse(); b.classList.add(...cls); document.documentElement.style.setProperty('--cl-print-title', JSON.stringify(String(c?.title || '').slice(0, 60))); addEventListener('afterprint', end);
  await new Promise(r => setTimeout(r, 60));
  try { window.print(); } catch { }
  setTimeout(end, 1500);   // Plattformen ohne afterprint (iOS/Android-WebView)
}
function plainSheet(sh) {
  return [sh.title, ...arr(sh.sections).flatMap(s => ['', String(s.moduleTitle).toUpperCase(), ...arr(s.concepts).flatMap(k => ['', k.title, ...arr(k.points).map(p => '• ' + (typeof p === 'string' ? p : [p.h, p.t].filter(Boolean).join(': '))), ...arr(k.formulas).map(f => 'Formel: ' + f), ...(k.trap ? ['Prüfungsfalle: ' + (k.trap.text || k.trap)] : [])])])].join('\n');
}
function plainExam(rec) {
  const ex = rec.exam; return [ex.title, `${ex.minutes || ''} Minuten · ${fmtN(ex.totalPoints || sumPts(arr(ex.questions)))} Punkte`, '', ...arr(ex.questions).flatMap(q => [`${q.n}. ${q.q} ${ptsLabel(q.points)}`, ...arr(q.options).map((o, i) => `   ${L(i)}) ${o}`), ''])].join('\n');
}

// ---------- Aktionen ----------
const imgFromFile = f => new Promise((res, rej) => {   // Rückfall: verkleinertes JPEG als Data-URL
  const u = URL.createObjectURL(f), im = new Image();
  im.onload = () => { const s = Math.min(1, 1800 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); res(cv.toDataURL('image/jpeg', 0.8)); };
  im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Bild nicht lesbar')); }; im.src = u;
});
async function pdfImages(f) {
  const fn = hook('pdfToImages'); if (fn) return fn(f);
  const { pdfPages } = await import('./pdf.js');
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  const out = await pdfPages(b64, 1, MAX_PHOTOS, 1600);
  return arr(out?.pages).map(x => x.url);
}
const srcOf = x => typeof x === 'string' ? x : x?.src || x?.dataUrl || '';

export function examActions(ctx) {
  CTX = ctx; const { render, toast } = ctx;
  const fail = (what, e, key) => { const t = T(); t.busy = null; t.err = friendlyErr(e, what); t.errFor = key; render(); };
  const prog = m => { T().progress = m; CTX?.render?.(); };
  return {
    clarityExamTab(d) { const t = T(); t.tab = d.id || 'sheet'; t.err = ''; render(); },
    clarityExamMode(d) { T().mode = d.id === 'solutions' ? 'solutions' : 'tasks'; render(); },
    clarityExamSize(d) { T().size = +d.id || 12; render(); },
    clarityExamPick(d) { T().examId = d.id; T().mode = 'tasks'; render(); },
    async clarityExamSheet() {
      const c = curCourse(), t = T(); if (!c || t.busy) return;
      t.busy = 'sheet'; t.err = ''; t.progress = ''; render();
      try {
        const fn = hook('summarySheet'), sh = fn ? await fn(c, { onProgress: prog }) : localSheet(c);
        if (!arr(sh?.sections).length) throw new Error('Unvollständig');
        c.sheet = { ...sh, ts: Date.now() }; saveCourse(); t.busy = null; render();
      } catch (e) { fail('Der Spickzettel', e, 'sheet'); }
    },
    async clarityExamNew() {
      const c = curCourse(), t = T(); if (!c || t.busy) return;
      t.busy = 'exam'; t.err = ''; t.progress = ''; t.variant++; render();
      try {
        const opts = { questionCount: t.size, variant: t.variant, onProgress: prog }, fn = hook('generateExam');
        const exam = fn ? await fn(c, opts) : localExam(c, opts);
        if (!arr(exam?.questions).length) throw new Error('Unvollständig');
        const rec = { id: 'ex' + Date.now().toString(36) + (++seq), ts: Date.now(), exam, grading: gradingOf(c) };
        c.exams = [rec, ...arr(c.exams)].slice(0, KEEP_EXAMS); t.examId = rec.id; t.mode = 'tasks'; PHOTOS = [];
        saveCourse(); t.busy = null; render();
      } catch (e) { fail('Die Prüfung', e, 'exam'); }
    },
    clarityExamPrint(d) { printPaper(d.id === 'sheet' ? 'sheet' : 'exam'); },
    async clarityExamShare(d) {
      const c = curCourse(); if (!c) return;
      const text = d.id === 'sheet' ? (c.sheet ? plainSheet(c.sheet) : '') : (curRec(c) ? plainExam(curRec(c)) : '');
      try { await navigator.share({ title: d.id === 'sheet' ? 'Spickzettel' : 'Probeprüfung', text }); } catch (e) { if (e?.name !== 'AbortError') toast?.('Teilen hat nicht geklappt.'); }
    },
    clarityExamPhotoMove(d) { const i = PHOTOS.findIndex(p => p.id === d.id), j = i + (+d.dir || 0); if (i < 0 || j < 0 || j >= PHOTOS.length) return; [PHOTOS[i], PHOTOS[j]] = [PHOTOS[j], PHOTOS[i]]; render(); },
    clarityExamPhotoDel(d) { PHOTOS = PHOTOS.filter(p => p.id !== d.id); render(); },
    clarityExamRedo() { const rec = curRec(curCourse()); if (rec) { delete rec.result; saveCourse(); } PHOTOS = []; T().err = ''; render(); },
    clarityExamWeak(d) { const u = ui(); u.conceptId = d.id; u.phase = 'dashboard'; render(); try { window.scrollTo?.(0, 0); } catch { } },
    async clarityExamGrade() {
      const c = curCourse(), t = T(), rec = curRec(c); if (!c || !rec || t.busy || !PHOTOS.length) return;
      t.busy = 'grade'; t.err = ''; render();
      try {
        const fn = hook('gradeHandwrittenExam'); if (!fn) throw new Error('Die Korrektur ist gerade nicht verfügbar. Versuche es später nochmals.');
        let r; try { r = await fn(c, rec.exam, PHOTOS.map(p => p.src)); } catch (e) { if ((c.demo || isDemo()) && /KI-Verbindung/.test(String(e?.message))) r = demoCorrection(rec.exam); else throw e; }
        const results = arr(r?.results).map(x => ({ n: x.n, points: Number(x.points) || 0, max: Number(x.max) || 0, feedback: String(x.feedback || ''), uncertain: !!x.uncertain }));
        if (!results.length) throw new Error('Unvollständig');
        const earned = r.earned ?? results.reduce((n, x) => n + x.points, 0), max = r.max ?? results.reduce((n, x) => n + x.max, 0);
        rec.result = { results, earned, max, grade: r.grade ?? null, pass: r.pass, note: String(r.note || ''), demo: !!r.demo, ts: Date.now() };
        // Punkte je Konzept als Hinweis für die Prognose (nur Zahlen, keine Fotos)
        const per = {}; for (const x of results) { const q = arr(rec.exam.questions).find(y => y.n === x.n), k = q && resolveConcept(c, q.concept); if (k) { (per[k.id] ||= { e: 0, m: 0 }); per[k.id].e += x.points; per[k.id].m += x.max; } }
        for (const [id, v] of Object.entries(per)) { const k = arr(c.concepts).find(y => y.id === id); if (k && v.m > 0) k.examScore = Math.round(v.e / v.m * 100) / 100; }
        PHOTOS = []; saveCourse(); t.busy = null; render();
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
          if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) { for (const x of arr(await pdfImages(f))) { const s = srcOf(x); if (s && PHOTOS.length < MAX_PHOTOS) PHOTOS.push({ id: 'p' + (++seq), src: s }); } }
          else { const s = srcOf(await (hook('photoToImage') ? hook('photoToImage')(f) : imgFromFile(f))); if (s) PHOTOS.push({ id: 'p' + (++seq), src: s }); else throw new Error('leer'); }
        } catch { toast?.(`${f.name}: konnte nicht gelesen werden. Versuche ein anderes Foto.`); }
      }
      T().err = ''; render();
    },
  };
}
// nur für Tests
export const __exam = { photos: () => PHOTOS, setPhotos: p => { PHOTOS = p; }, cleanSvg, gradeOf, printPaper };
try { if (typeof location !== 'undefined' && /[?&]test\b/.test(location.search)) globalThis.__clExamApi = __exam; } catch { }
