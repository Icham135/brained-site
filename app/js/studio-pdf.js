// Exam Studio → druckfrischer A4-Prüfungsbogen als PDF (jsPDF + Liberation Sans, erst bei Bedarf geladen).
// Kopfzeile mit Name/Klasse/Datum/Note, Punkte-Kästchen am Rand, ausgeschnittene Original-Grafiken,
// jeder Baustein mit eigenem Antwortfeld (Kästchen, Spalten, Lücken, Tabellen, Raster …), Notenskala CH/DE/AT.
// Mit { solutions: true } werden die Lösungen je Baustein grün eingetragen.
import { imgGet } from './idb.js';
import { t } from './i18n.js';

let jsPDFCtor, fonts;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('PDF-Modul konnte nicht geladen werden')); document.head.appendChild(s); });
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function lib() {
  if (!jsPDFCtor) { await loadScript(new URL('./vendor/jspdf.min.js', import.meta.url).href); jsPDFCtor = window.jspdf.jsPDF; }
  if (!fonts) {
    const get = f => fetch(new URL(`../assets/fonts/${f}`, import.meta.url)).then(r => { if (!r.ok) throw new Error('Schrift fehlt'); return r.arrayBuffer(); }).then(b64);
    fonts = { r: await get('LiberationSans-Regular.ttf'), b: await get('LiberationSans-Bold.ttf') };
  }
  return jsPDFCtor;
}
// LaTeX → gut lesbarer Klartext (PDF hat keinen Formelsatz)
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', n: 'ⁿ', '-': '⁻', '+': '⁺' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ' };
export function texPlain(s) {
  let x = String(s || '').replace(/([A-Za-zΔ])_\{?([A-Za-z0-9]{1,3})\}?/g, (m, b, i) => [...i.toLowerCase()].every(c => SUB[c]) ? b + [...i.toLowerCase()].map(c => SUB[c]).join('') : m);
  for (let k = 0; k < 4; k++) x = x.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  return x.replace(/\^\{?([0-9n+-]{1,3})\}?/g, (_, e) => [...e].map(c => SUP[c] || c).join('')).replace(/_\{([^{}]*)\}/g, '_$1')
    .replace(/\\cdot|\\times/g, '·').replace(/\\div/g, ':').replace(/\\pm/g, '±').replace(/\\le(q)?/g, '≤').replace(/\\ge(q)?/g, '≥').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈')
    .replace(/\\(alpha|beta|gamma|delta|pi|sigma|lambda|mu|omega|theta)/g, (_, g) => ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', pi: 'π', sigma: 'σ', lambda: 'λ', mu: 'μ', omega: 'ω', theta: 'θ' }[g]))
    .replace(/\\left|\\right|\\,|\\;|\\!/g, '').replace(/\\text\{([^{}]*)\}/g, '$1').replace(/[{}]/g, '').replace(/\\/g, '');
}
const clean = s => texPlain(String(s ?? '').replace(/\$([^$]+)\$/g, '$1')).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\r/g, '').replace(/\t/g, '  ');

const W = 210, ML = 18, MR = 24, CW = W - ML - MR, RX = ML + CW, TOP = 22, BOTTOM = 280;
const INK = [20, 20, 20], GREY = [110, 110, 110], SOL = [16, 120, 64], LINE = [190, 190, 190];
const V = (q, variant) => (variant === 'original' ? q.originalQuestion : q.remixedQuestion || q.originalQuestion) || {};
const arr = x => Array.isArray(x) ? x : [];
const txt = x => clean(x && typeof x === 'object' ? x.text ?? x.label ?? '' : x);
const nr = (x, d = 0) => Number.isFinite(+x) && x !== null && x !== '' ? +x : d;
const pts = n => String(Math.round(nr(n) * 2) / 2);
const ABC = i => String.fromCharCode(65 + (i % 26));
const firstAlt = s => String(s ?? '').split('|')[0].trim();
const isTrue = v => v === true || v === 1 || v === 'true' || v === '1', isFalse = v => v === false || v === 0 || v === 'false' || v === '0';
// Feste Mischung pro Aufgabe (gleiches PDF bei jedem Export), nie die richtige Reihenfolge
function mixed(n, seed) {
  let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
  if (n > 1 && o.every((v, i) => v === i)) o.push(o.shift());
  return o;
}
const FALLBACK_CH = sum => [6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map(g => ({ grade: g, label: g.toFixed(1), minPoints: Math.max(0, Math.ceil(((g - 1) / 5) * sum * 2 - 1e-9) / 2) }));
const SCALE_TITLE = { CH: s => `Notenskala Schweiz (Note = 1 + 5 × Punkte / ${s})`, DE: () => 'Notenskala Deutschland (1 = sehr gut, 6 = ungenügend)', AT: () => 'Notenskala Österreich (1 = Sehr gut, 5 = Nicht genügend)' };

export async function buildStudioPdf(docM, qs, variant, { solutions = false, country = 'CH' } = {}) {
  const J = await lib(), pdf = new J({ unit: 'mm', format: 'a4' });
  pdf.addFileToVFS('LS-R.ttf', fonts.r); pdf.addFont('LS-R.ttf', 'LS', 'normal');
  pdf.addFileToVFS('LS-B.ttf', fonts.b); pdf.addFont('LS-B.ttf', 'LS', 'bold');
  docM = docM || {}; qs = arr(qs).filter(q => q && typeof q === 'object');
  const v = variant === 'original' ? 'original' : 'remix', sum = qs.reduce((s, q) => s + nr(q.maxPoints), 0);
  let y = TOP, page = 1;
  const font = (st = 'normal', size = 11, c = INK) => { pdf.setFont('LS', st); pdf.setFontSize(size); pdf.setTextColor(...c); };
  const draw = (c = [40, 40, 40], w = 0.3) => { pdf.setDrawColor(...c); pdf.setLineWidth(w); };
  const footer = () => { font('normal', 8, [120, 120, 120]); pdf.text(`${clean(docM.title)} · Seite ${page}`, ML, 290); pdf.text('Brained Exam Studio', W - MR + 6, 290, { align: 'right' }); };
  const newPage = () => { footer(); pdf.addPage(); page++; y = TOP; };
  const need = h => { if (y + h > BOTTOM) newPage(); };
  const para = (text, size = 11, st = 'normal', color, indent = 0, width) => {
    const s = clean(text).trim(); if (!s) return;
    font(st, size, color); const lines = pdf.splitTextToSize(s, (width || CW - indent));
    for (const l of lines) { need(size * 0.45); pdf.text(l, ML + indent, y); y += size * 0.45; }
  };
  const hint = s => { para(s, 8.5, 'normal', GREY); y += 1.5; };
  const lines = (n, gap = 8, x0 = ML) => { draw(LINE, 0.25); for (let k = 0; k < n; k++) { need(gap); y += gap; pdf.line(x0, y, RX, y); } y += 2; };
  const box = (x, yy, w, h) => { draw(); pdf.rect(x, yy, w, h); };
  const cross = (x, yy, s) => { draw(SOL, 0.6); pdf.line(x + 0.8, yy + 0.8, x + s - 0.8, yy + s - 0.8); pdf.line(x + s - 0.8, yy + 0.8, x + 0.8, yy + s - 0.8); };
  const inBox = (s, x, yy, w, h, size = 10) => { const c = clean(s).trim(); if (!c) return; font('bold', size, SOL); const l = pdf.splitTextToSize(c, w - 2)[0] || ''; pdf.text(l, x + w / 2, yy + h / 2 + size * 0.17, { align: 'center' }); };
  const sol = (s, label = 'Lösung: ') => { const c = clean(s).trim(); if (c) { para(`${label}${c}`, 10.5, 'bold', SOL); y += 1; } };
  const loadImg = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });

  // ---------- Bausteine ----------
  function choice(vv, kind) {
    const opts = arr(vv.options), multi = kind === 'multi_select', idx = o => /^[A-H]$/i.test(String(o ?? '').trim()) ? String(o).trim().toUpperCase().charCodeAt(0) - 65 : nr(o, -1);
    const right = multi ? arr(vv.correctOptions).map(idx) : [idx(vv.correctOption)];
    if (!opts.length) return lines(4);
    if (multi) hint('Mehrere Antworten können richtig sein.');
    opts.forEach((o, k) => {
      need(7); font('normal', 11); const ls = pdf.splitTextToSize(`${ABC(k)}   ${txt(o).replace(/^[A-H][:.)]\s*/, '')}`, CW - 9);
      need(ls.length * 4.95 + 2); box(ML + 2, y - 3.6, 4, 4); if (solutions && right.includes(k)) cross(ML + 2, y - 3.6, 4);
      font('normal', 11); ls.forEach(l => { pdf.text(l, ML + 9, y); y += 4.95; }); y += 1.5;
    });
  }
  function trueFalse(vv) {
    const st = arr(vv.statements); if (!st.length) return lines(4);
    const ng = !!vv.notGiven, cx = ng ? [RX - 40, RX - 26, RX - 12] : [RX - 26, RX - 12], tw = CW - (ng ? 46 : 32);
    need(8); font('bold', 8, GREY); ['richtig', 'falsch', 'nicht im Text'].slice(0, cx.length).forEach((l, k) => pdf.text(k === 2 ? 'n. i. T.' : l, cx[k] + 2, y, { align: 'center' })); y += 5;
    st.forEach((s, k) => {
      font('normal', 10.5); const ls = pdf.splitTextToSize(`${k + 1}. ${txt(s)}`, tw), h = Math.max(1, ls.length) * 4.8 + 2.6;
      need(h); ls.forEach((l, i) => pdf.text(l, ML + 2, y + i * 4.8));
      cx.forEach(x => box(x, y - 3.6, 4, 4));
      if (solutions) { const c = s && typeof s === 'object' ? s.correct : undefined; if (isTrue(c)) cross(cx[0], y - 3.6, 4); else if (isFalse(c)) cross(cx[1], y - 3.6, 4); else if (ng && c === 'ng') cross(cx[2], y - 3.6, 4); }
      draw([225, 225, 225], 0.2); pdf.line(ML, y + h - 3.9, RX, y + h - 3.9); y += h;
    });
    y += 1;
    if (ng) hint('n. i. T. = steht nicht im Text');
  }
  function fillBlanks(vv) {
    const blanks = arr(vv.blanks), lh = 7.5, sp = () => pdf.getTextWidth(' '), bo = arr(vv.blankOptions), bank = arr(vv.wordBank).map(txt).filter(Boolean);
    if (bank.length) { font('normal', 9.5); const ls = pdf.splitTextToSize(`Wörter: ${bank.join('  ·  ')}`, CW - 6), h = ls.length * 4.3 + 4; need(h + 2);
      draw([170, 170, 170], 0.25); pdf.rect(ML, y - 3.5, CW, h); font('normal', 9.5, [60, 60, 60]); ls.forEach((l, i) => pdf.text(l, ML + 3, y + 0.5 + i * 4.3)); y += h + 3; }
    let n = 0, x = ML;
    const br = () => { y += lh; need(lh); x = ML; };
    need(lh); font('normal', 11);
    for (const p of clean(vv.text).split('\n')) {
      for (const tok of p.split(/(_{3,})/)) {
        if (/^_{3,}$/.test(tok)) {
          const a = solutions ? firstAlt(blanks[n]) : ''; font('bold', 10.5, SOL);
          const bw = Math.min(CW, Math.max(26, a ? pdf.getTextWidth(a) + 6 : 0)); if (x + bw > RX && x > ML) br();
          draw([60, 60, 60], 0.3); pdf.line(x, y + 1, x + bw, y + 1); if (a) pdf.text(a, x + 3, y - 0.2);
          font('normal', 11); x += bw + sp();
          const opt = arr(bo[n]).map(txt).filter(Boolean); if (opt.length) { font('normal', 8, GREY); const ot = `(${opt.join(' / ')})`, ow = pdf.getTextWidth(ot); if (x + ow > RX && x > ML) br(); pdf.text(ot, x, y); x += ow + sp(); font('normal', 11); }
          n++;
        } else for (const w of tok.split(/\s+/).filter(Boolean)) {
          const ww = pdf.getTextWidth(w); if (x + ww > RX && x > ML) br();
          pdf.text(w, x, y); x += ww + sp();
        }
      }
      br();
    }
    // Lösungen ohne passende Lücke im Text: als nummerierte Zeilen
    for (; n < blanks.length; n++) { need(9); font('normal', 10, GREY); pdf.text(`(${n + 1})`, ML, y); draw([60, 60, 60], 0.3); pdf.line(ML + 9, y + 1, ML + 80, y + 1); if (solutions) { font('bold', 10.5, SOL); pdf.text(firstAlt(blanks[n]), ML + 11, y - 0.2); } y += 9; }
    y += 1;
  }
  function matching(vv) {
    const L = arr(vv.left), R = arr(vv.right), P = arr(vv.pairs); if (!L.length && !R.length) return lines(4);
    hint('Trage den passenden Buchstaben ins Kästchen ein.');
    const colW = CW * 0.47, rx = ML + CW * 0.53, lh = 4.8;
    for (let i = 0; i < Math.max(L.length, R.length); i++) {
      font('normal', 10.5);
      const ll = i < L.length ? pdf.splitTextToSize(`${i + 1}. ${txt(L[i])}`, colW - 12) : [], rl = i < R.length ? pdf.splitTextToSize(`${ABC(i)}   ${txt(R[i])}`, RX - rx) : [];
      const h = Math.max(ll.length, rl.length, 1) * lh + 3.5; need(h);
      ll.forEach((l, k) => pdf.text(l, ML + 2, y + k * lh)); rl.forEach((l, k) => pdf.text(l, rx, y + k * lh));
      if (i < L.length) { box(ML + colW - 8, y - 4.2, 7, 6); const r = P[i]; if (solutions && r !== null && r !== '' && Number.isInteger(+r) && +r >= 0) inBox(ABC(+r), ML + colW - 8, y - 4.2, 7, 6); }
      y += h;
    }
    y += 1;
  }
  function ordering(vv, q) {
    const it = arr(vv.items); if (!it.length) return lines(4);
    hint('Nummeriere in der richtigen Reihenfolge (1 = zuerst).');
    for (const k of mixed(it.length, q.id || it.join())) {
      font('normal', 10.5); const ls = pdf.splitTextToSize(txt(it[k]), CW - 14), h = ls.length * 4.8 + 3.5; need(h);
      box(ML + 2, y - 4.2, 7, 6); if (solutions) inBox(String(k + 1), ML + 2, y - 4.2, 7, 6);
      font('normal', 10.5); ls.forEach((l, i) => pdf.text(l, ML + 13, y + i * 4.8)); y += h;
    }
    y += 1;
  }
  function resultRow(label, value, unit, withUnit) {
    need(14); y += 3; const uw = withUnit ? 24 : 0, vw = withUnit ? 44 : 60, x = RX - vw - uw - (withUnit ? 2 : 0);
    font('bold', 10); pdf.text(label, x - 3, y + 6, { align: 'right' });
    box(x, y, vw, 9); if (solutions) inBox(value, x, y, vw, 9, 10.5);
    if (withUnit) { box(RX - uw, y, uw, 9); font('normal', 6.5, GREY); pdf.text('Einheit', RX - uw + 1.2, y + 2.6); if (solutions) inBox(unit, RX - uw, y + 1, uw, 9, 10); }
    y += 13;
  }
  function work(vv, n) { if (solutions) { const s = clean(vv.stepByStepSolution).trim(); if (s) { para(`Lösungsweg: ${s}`, 10, 'normal', SOL); y += 1; return true; } } lines(n); return false; }
  function sketch(vv) {
    const ca = clean(vv.correctAnswer).trim(), a = solutions ? ca || clean(vv.stepByStepSolution).trim() : '';
    font('normal', 10); const ls = a ? pdf.splitTextToSize(a, CW - 8).slice(0, 50) : [], h = a ? Math.max(25, ls.length * 4.6 + 10) : 70;   // passt immer auf eine Seite
    need(h + 4); draw([150, 150, 150], 0.3); pdf.setLineDashPattern([1.2, 1], 0); pdf.rect(ML, y, CW, h); pdf.setLineDashPattern([], 0);
    font('normal', 7, GREY); pdf.text('Skizze', ML + 2, y + 3.5);
    if (a) { font('normal', 10, SOL); ls.forEach((l, i) => pdf.text(l, ML + 4, y + 9 + i * 4.6)); }
    y += h + 7; return !a ? '' : ca ? 'answer' : 'steps';
  }
  function table(vv) {
    const rows = arr(vv.rows).map(arr), cols = arr(vv.columns), S = arr(vv.solution).map(arr);
    const nc = Math.min(8, Math.max(cols.length, ...rows.map(r => r.length), 0)); if (!nc) return lines(4);
    const cw = CW / nc, cell = (r, c) => r[c] === null || r[c] === undefined || r[c] === '' ? null : txt(r[c]);
    const row = (vals, head) => {
      font(head ? 'bold' : 'normal', 9.5); const wr = vals.map(s => s === null ? [] : pdf.splitTextToSize(String(s), cw - 3));
      const h = Math.max(8, Math.max(1, ...wr.map(l => l.length)) * 4.3 + 3.5); need(h);
      if (head) { pdf.setFillColor(240, 239, 236); pdf.rect(ML, y, CW, h, 'F'); }
      for (let c = 0; c < nc; c++) { draw([90, 90, 90], 0.25); pdf.rect(ML + c * cw, y, cw, h); }
      vals.forEach((v2, c) => { if (v2 === null) return; font(head ? 'bold' : 'normal', 9.5, v2.sol ? SOL : INK); wr[c].forEach((l, i) => pdf.text(l, ML + c * cw + 1.5, y + 5 + i * 4.3)); });
      y += h;
    };
    if (cols.length) row(Array.from({ length: nc }, (_, c) => c < cols.length ? txt(cols[c]) : ''), true);
    rows.forEach((r, ri) => row(Array.from({ length: nc }, (_, c) => { const v2 = cell(r, c); if (v2 !== null) return v2;
      const s = solutions ? clean(S[ri]?.[c] ?? '').trim() : ''; if (!s) return null; const o = new String(s); o.sol = true; return o; })));
    y += 7;
  }
  function labelImage(vv, imgBox) {
    const M = arr(vv.markers), Lb = arr(vv.labels), bank = arr(vv.wordBank).map(txt).filter(Boolean), n = Math.max(M.length, Lb.length);
    if (imgBox && M.length) {   // nummerierte Marker auf die Abbildung setzen (auch wenn der Text schon auf der nächsten Seite ist)
      if (imgBox.page !== page) pdf.setPage(imgBox.page);
      M.forEach((m, i) => { const mx = imgBox.x + Math.min(1, Math.max(0, nr(m?.x) / 1000)) * imgBox.w, my = imgBox.y + Math.min(1, Math.max(0, nr(m?.y) / 1000)) * imgBox.h;
        pdf.setFillColor(255, 255, 255); draw([30, 30, 30], 0.35); pdf.circle(mx, my, 2.6, 'FD'); font('bold', 7.5); pdf.text(String(i + 1), mx, my + 1.1, { align: 'center' }); });
      if (imgBox.page !== page) pdf.setPage(page);
    } else if (!imgBox && M.length) hint('Abbildung siehe Originalprüfung.');
    if (bank.length) { font('normal', 9.5); const ls = pdf.splitTextToSize(`Wörter: ${bank.join('  ·  ')}`, CW - 6), h = ls.length * 4.3 + 4; need(h + 2);
      draw([170, 170, 170], 0.25); pdf.rect(ML, y - 3.5, CW, h); font('normal', 9.5, [60, 60, 60]); ls.forEach((l, i) => pdf.text(l, ML + 3, y + 0.5 + i * 4.3)); y += h + 2; }
    if (!n) return lines(3);
    const half = n > 3, colW = half ? CW / 2 : CW;
    for (let i = 0; i < n; i += half ? 2 : 1) {
      need(9); y += 6;
      for (let j = 0; j < (half ? 2 : 1) && i + j < n; j++) { const x = ML + j * colW; font('bold', 10); pdf.text(`${i + j + 1}`, x, y); draw([60, 60, 60], 0.3); pdf.line(x + 6, y + 1, x + colW - 6, y + 1);
        if (solutions) { const a = txt(Lb[i + j]); if (a) { font('bold', 10, SOL); pdf.text(pdf.splitTextToSize(a, colW - 14)[0] || '', x + 8, y - 0.3); } } }
      y += 3;
    }
    y += 5;
  }
  function graph(vv) {
    const ax = vv.axes && typeof vv.axes === 'object' ? vv.axes : {};
    let x0 = nr(ax.xmin, -5), x1 = nr(ax.xmax, 5), y0 = nr(ax.ymin, -5), y1 = nr(ax.ymax, 5), st = Math.abs(nr(ax.step, 1)) || 1;
    if (!(x1 > x0)) [x0, x1] = [-5, 5]; if (!(y1 > y0)) [y0, y1] = [-5, 5];
    // eigener Schritt je Achse (z. B. Weg-Zeit: x 0–10, y 0–500), «schöne» Werte 1-2-5, höchstens 20 Felder
    const stepFor = r => { if (r / st >= 1 && r / st <= 40) return st; const raw = r / 20, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map(k => k * p).find(s => r / s <= 20) || raw; };
    const sx = stepFor(x1 - x0), sy = stepFor(y1 - y0), nx = (x1 - x0) / sx, ny = (y1 - y0) / sy;
    let cx = Math.min(8, 110 / nx), cy = Math.min(8, 85 / ny); if (sx === sy) cx = cy = Math.min(cx, cy);
    const gw = nx * cx, gh = ny * cy;
    need(gh + 10); const gx = ML + (CW - gw) / 2, gy = y + 2, X = vx => gx + (vx - x0) / (x1 - x0) * gw, Y = vy => gy + gh - (vy - y0) / (y1 - y0) * gh;
    draw([215, 215, 215], 0.15); for (let i = 0; i <= nx + 1e-9; i++) pdf.line(gx + i * cx, gy, gx + i * cx, gy + gh); for (let i = 0; i <= ny + 1e-9; i++) pdf.line(gx, gy + gh - i * cy, gx + gw, gy + gh - i * cy);
    const ox = Math.min(x1, Math.max(x0, 0)), oy = Math.min(y1, Math.max(y0, 0)), lbl = Math.max(1, Math.ceil(nx / 12)), lblY = Math.max(1, Math.ceil(ny / 12));
    draw([30, 30, 30], 0.4); pdf.line(gx, Y(oy), gx + gw + 3, Y(oy)); pdf.line(X(ox), gy + gh, X(ox), gy - 3);
    pdf.setFillColor(30, 30, 30); pdf.triangle(gx + gw + 3, Y(oy), gx + gw + 0.8, Y(oy) - 1, gx + gw + 0.8, Y(oy) + 1, 'F'); pdf.triangle(X(ox), gy - 3, X(ox) - 1, gy - 0.8, X(ox) + 1, gy - 0.8, 'F');
    font('normal', 6.5, [80, 80, 80]); const f = n => String(Math.round(n * 1000) / 1000);
    for (let i = 0; i <= nx + 1e-9; i += lbl) { const vx = x0 + i * sx; if (Math.abs(vx - ox) > 1e-9) pdf.text(f(vx), X(vx), Y(oy) + 3, { align: 'center' }); }
    for (let i = 0; i <= ny + 1e-9; i += lblY) { const vy = y0 + i * sy; if (Math.abs(vy - oy) > 1e-9) pdf.text(f(vy), X(ox) - 1, Y(vy) + 0.9, { align: 'right' }); }
    font('bold', 8); pdf.text('x', gx + gw + 3, Y(oy) - 1.5); pdf.text('y', X(ox) + 1.5, gy - 2);
    if (solutions) {
      const L = vv.line && typeof vv.line === 'object' && vv.line.m !== null && vv.line.m !== '' && Number.isFinite(+vv.line.m) ?{ m: +vv.line.m, q: nr(vv.line.q) } : null;
      if (L) { // Gerade auf den sichtbaren Bereich zuschneiden
        const pts2 = [[x0, L.m * x0 + L.q], [x1, L.m * x1 + L.q]];
        if (L.m) [y0, y1].forEach(yy => { const xx = (yy - L.q) / L.m; if (xx >= x0 && xx <= x1) pts2.push([xx, yy]); });
        const inside = pts2.filter(([, yy]) => yy >= y0 - 1e-9 && yy <= y1 + 1e-9).sort((a, b) => a[0] - b[0]);
        if (inside.length >= 2) { draw(SOL, 0.6); pdf.line(X(inside[0][0]), Y(inside[0][1]), X(inside.at(-1)[0]), Y(inside.at(-1)[1])); }
      }
      pdf.setFillColor(...SOL); arr(vv.points).forEach(p => { const pp = Array.isArray(p) ? p : [p?.x, p?.y], px = nr(pp[0], NaN), py = nr(pp[1], NaN); if (!Number.isFinite(px) || !Number.isFinite(py) || px < x0 || px > x1 || py < y0 || py > y1) return;
        pdf.circle(X(px), Y(py), 1.1, 'F'); font('bold', 7, SOL); pdf.text(`(${f(px)}|${f(py)})`, X(px) + 1.6, Y(py) - 1.4); });
    }
    y = gy + gh + 8;
  }
  function categorize(vv) {
    const G = arr(vv.groups).map(txt), It = arr(vv.items).map(txt), IG = arr(vv.itemGroup); if (!G.length) return lines(4);
    if (It.length) { font('normal', 10); const ls = pdf.splitTextToSize(`Begriffe: ${It.join('  ·  ')}`, CW - 6), h = ls.length * 4.5 + 4; need(h + 2);
      draw([170, 170, 170], 0.25); pdf.rect(ML, y - 3.5, CW, h); font('normal', 10, [60, 60, 60]); ls.forEach((l, i) => pdf.text(l, ML + 3, y + 0.5 + i * 4.5)); y += h + 3; }
    const nc = Math.min(G.length, 5), cw = CW / nc, rowsN = Math.max(3, Math.ceil(It.length / nc) + 1);
    for (let g0 = 0; g0 < G.length; g0 += nc) {   // mehr als 5 Gruppen → weitere Zeile
      const grp = G.slice(g0, g0 + nc), per = grp.map((_, k) => It.filter((_, i) => solutions && nr(IG[i], -1) === g0 + k));
      const rN = Math.max(rowsN, ...per.map(p => p.length)), h = 9 + rN * 7.5; need(h + 4);
      grp.forEach((g, k) => { const x = ML + k * cw; draw([90, 90, 90], 0.25); pdf.setFillColor(240, 239, 236); pdf.rect(x, y, cw, 8, 'FD'); pdf.rect(x, y + 8, cw, rN * 7.5 + 1);
        font('bold', 9.5); pdf.text(pdf.splitTextToSize(g, cw - 3)[0] || '', x + cw / 2, y + 5.4, { align: 'center' });
        draw(LINE, 0.2); for (let r = 1; r <= rN; r++) pdf.line(x + 2, y + 8 + r * 7.5, x + cw - 2, y + 8 + r * 7.5);
        font('normal', 9.5, SOL); per[k].forEach((s, r) => pdf.text(pdf.splitTextToSize(s, cw - 5)[0] || '', x + 2.5, y + 8 + (r + 1) * 7.5 - 1.5)); });
      y += h + 7;
    }
  }

  // Im Text markieren: Text mit grossem Zeilenabstand; Lösung = markierte Wörter grün unterstrichen
  function textSelect(vv) {
    const ts = arr(vv.tokens).map(txt), C = new Set(arr(vv.correct).map(Number)); if (!ts.length) return lines(3);
    hint('Unterstreiche bzw. kreise ein, was verlangt ist.');
    const lh = 7.5, sp = () => pdf.getTextWidth(' '); let x = ML; need(lh); font('normal', 11.5);
    ts.forEach((t, i) => {
      const glueL = i && (/^[.,;:!?)\]}»“”%…]$/.test(t) || /^[(\[{«„]$/.test(ts[i - 1])), w = pdf.getTextWidth(t), gap = glueL ? 0 : sp();
      if (x + gap + w > RX && x > ML) { y += lh; need(lh); x = ML; } else if (x > ML) x += gap;
      const on = solutions && C.has(i); font(on ? 'bold' : 'normal', 11.5, on ? SOL : INK); pdf.text(t, x, y);
      if (on) { draw(SOL, 0.6); pdf.line(x, y + 1.2, x + w, y + 1.2); } x += w;
    });
    font('normal', 11.5); y += lh + 2;
  }
  // Stelle antippen: Abbildung (oben schon gedruckt) – Lösung als grüne Ellipse(n) auf dem Bild
  function hotspot(vv, imgBox) {
    if (!imgBox) { hint('Abbildung siehe Originalprüfung.'); return; }
    hint('Kreuze die gesuchte Stelle in der Abbildung an.');
    if (!solutions) return;
    if (imgBox.page !== page) pdf.setPage(imgBox.page);
    draw(SOL, 0.8); arr(vv.targets).forEach(t => { const tx = nr(t?.x, NaN), ty = nr(t?.y, NaN), tr = nr(t?.r, 50); if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      pdf.ellipse(imgBox.x + tx / 1000 * imgBox.w, imgBox.y + ty / 1000 * imgBox.h, Math.max(1.5, tr / 1000 * imgBox.w), Math.max(1.5, tr / 1000 * imgBox.h), 'S'); });
    if (imgBox.page !== page) pdf.setPage(page);
  }
  // Programmcode: Vorgabecode in Monospace, liniertes Feld mit Zeilennummern; Lösung grün in Monospace
  function code(vv) {
    const mono = (st = 'normal', size = 9.5, c = INK) => { pdf.setFont('courier', st); pdf.setFontSize(size); pdf.setTextColor(...c); };
    const block = (txt0, color) => { const ls = String(txt0 ?? '').replace(/\t/g, '  ').split('\n').slice(0, 80); mono('normal', 9.5, color);
      ls.forEach((l, n) => { need(4.6); font('normal', 6.5, GREY); pdf.text(String(n + 1), ML + 3, y, { align: 'right' }); mono('normal', 9.5, color);
        pdf.text(pdf.splitTextToSize(l.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?') || ' ', CW - 8)[0] || '', ML + 6, y); y += 4.6; }); y += 2; };
    if (vv.language) hint(`Sprache: ${String(vv.language).toUpperCase()}`);
    if (vv.starter) block(vv.starter, INK);
    if (solutions && clean(vv.correctAnswer).trim()) { font('bold', 9, SOL); need(6); pdf.text('Lösung:', ML, y); y += 4.6; block(vv.correctAnswer, SOL); return true; }
    if (!vv.starter || /___/.test(vv.starter)) { draw(LINE, 0.25); for (let k = 0; k < (vv.starter ? 4 : 10); k++) { need(7); y += 7; font('normal', 6.5, GREY); pdf.text(String(k + 1), ML + 3, y - 1, { align: 'right' }); draw(LINE, 0.25); pdf.line(ML + 6, y, RX, y); } y += 3; }
    return false;
  }
  // Zahlenstrahl: Pfeil, Striche, Beschriftung; Lösung als grüne Punkte mit Wert
  function numberLine(vv) {
    let lo = nr(vv.min, 0), hi = nr(vv.max, 10); if (!(hi > lo)) { lo = 0; hi = 10; }
    const st = nr(vv.step, 1) > 0 ? nr(vv.step, 1) : 1, n = Math.round((hi - lo) / st), x0 = ML + 6, x1 = RX - 8, X = t => x0 + (t - lo) / (hi - lo) * (x1 - x0), f = t => String(Math.round(t * 1e6) / 1e6).replace('-', '−');
    const r = (hi - lo) / 10, p10 = 10 ** Math.floor(Math.log10(r || 1)), maj = Math.max(st, [1, 2, 5, 10].map(m => m * p10).find(s0 => s0 >= r) || st);
    need(26); y += 10; draw(INK, 0.5); pdf.line(x0 - 3, y, x1 + 5, y); pdf.setFillColor(...INK); pdf.triangle(x1 + 7, y, x1 + 4.5, y - 1.3, x1 + 4.5, y + 1.3, 'F');
    if (n <= 120) { draw([120, 120, 120], 0.25); for (let i = 0; i <= n; i++) { const t = lo + i * st; pdf.line(X(t), y - 1.4, X(t), y + 1.4); } }
    draw(INK, 0.4); font('normal', 8, [60, 60, 60]); for (let t = Math.ceil(lo / maj - 1e-9) * maj; t <= hi + 1e-9; t += maj) { pdf.line(X(t), y - 2.6, X(t), y + 2.6); pdf.text(f(t), X(t), y + 6.5, { align: 'center' }); }
    if (solutions) { pdf.setFillColor(...SOL); arr(vv.points).map(Number).filter(t => Number.isFinite(t) && t >= lo && t <= hi).forEach(t => { pdf.circle(X(t), y, 1.3, 'F'); font('bold', 8, SOL); pdf.text(f(t), X(t), y - 3.2, { align: 'center' }); }); }
    y += 14;
  }
  // Gemeinsames Material (M1 …): Kasten mit Titel, Bild und Text, Zeilennummern alle 5 Zeilen (Quellzeilen)
  async function material(m) {
    need(18); font('bold', 11); pdf.text(`${clean(m.label)}${m.title ? ` · ${clean(m.title)}` : ''}${m.kind ? `  (${clean(m.kind)})` : ''}`, ML, y); y += 2;
    const top = y, bar = (a, b) => { draw([120, 120, 120], 0.5); pdf.line(ML + 1, a, ML + 1, b); };
    let crop = ''; try { crop = m.crop ? await imgGet(m.crop) : ''; } catch { crop = ''; }
    if (crop) { const img = await loadImg(crop); if (img?.naturalWidth) { const w = Math.min(CW - 8, img.naturalWidth / 5), h0 = w * img.naturalHeight / img.naturalWidth, hh = Math.min(h0, 110), ww = hh / h0 * w;
      need(hh + 6); try { pdf.addImage(crop, /^data:image\/png/i.test(crop) ? 'PNG' : 'JPEG', ML + 6, y + 2, ww, hh); } catch { } bar(y, y + hh + 4); y += hh + 6; } }
    y += 4; const src = clean(m.text).split('\n');
    src.forEach((line, n) => { font('normal', 10.5); const ls = pdf.splitTextToSize(line.trim() || ' ', CW - 10);
      ls.forEach((l, k) => { need(5); if (!k && (n + 1) % 5 === 0 && src.length >= 5) { font('normal', 7, GREY); pdf.text(String(n + 1), ML - 2, y, { align: 'right' }); font('normal', 10.5); }
        pdf.text(l, ML + 6, y); bar(y - 3.8, y + 1.2); y += 4.9; }); });
    if (y - top < 6) bar(top, y); y += 6;
  }

  // ---------- Kopf ----------
  const lim = nr(docM.timeLimitMin), est = Math.max(10, Math.round(qs.length * 4 + sum * 1.5));
  font('bold', 8, GREY); pdf.text(`${clean(docM.subject || 'PRÜFUNG').toUpperCase()} · ${v === 'original' ? 'ORIGINAL' : `BRAINY REMIX #${nr(docM.remixRound) || 1}`}${solutions ? ' · LÖSUNGEN' : ''}`, ML, y);
  font('bold', 18); y += 8; pdf.splitTextToSize(clean(docM.title) || 'Prüfung', CW).forEach(l => { pdf.text(l, ML, y); y += 7.5; });
  const tools = arr(docM.tools).map(clean).filter(Boolean); if (tools.length) { font('normal', 9, GREY); pdf.text(pdf.splitTextToSize(`Hilfsmittel: ${tools.join(', ')}`, CW)[0], ML, y - 1.5); y += 3; }
  y += 2; draw();
  let x = ML; const rowH = 11, fullW = W - ML * 2 + 2;
  [['Name', fullW * 0.42], ['Klasse', fullW * 0.18], ['Datum', fullW * 0.2], ['Note', fullW * 0.2]].forEach(([l, w]) => { draw(); pdf.rect(x, y, w, rowH); font('normal', 7, GREY); pdf.text(l, x + 2, y + 3.5); x += w; });
  y += rowH; x = ML;
  [[lim > 0 ? `Zeit: ${Math.round(lim)} min` : `Zeit: ca. ${est} min`, fullW * 0.42], [`${qs.length} Aufgaben`, fullW * 0.18], [`Total: ${pts(sum)} P`, fullW * 0.2], ['Erreicht:        P', fullW * 0.2]].forEach(([l, w]) => { draw(); pdf.rect(x, y, w, 8); font('normal', 9); pdf.text(l, x + 2, y + 5.3); x += w; });
  y += 15;

  // ---------- Aufgaben ----------
  const mats = arr(docM.materials).filter(m => m && typeof m === 'object');
  for (const [i, q] of qs.entries()) {
    const vv = V(q, v), kind = String(q.taskKind || '');
    const mat = q.materialId && qs[i - 1]?.materialId !== q.materialId ? mats.find(m => m.id === q.materialId) : null;
    const part = q.partId && qs[i - 1]?.partId !== q.partId ? arr(docM.parts).find(p => p?.id === q.partId) : null;
    if (part) {   // Prüfungsteil: Überschrift mit Zeit und Hilfsmitteln
      need(22); y += 2; font('bold', 13); pdf.text(pdf.splitTextToSize(clean(part.title), CW)[0] || 'Teil', ML, y); y += 5.5;
      const tl = Array.isArray(part.tools) ? (part.tools.length ? part.tools.map(clean).join(', ') : 'keine') : 'wie Prüfung';
      font('normal', 9, GREY); pdf.text(`${nr(part.timeLimitMin) > 0 ? `Zeit: ${Math.round(nr(part.timeLimitMin))} min · ` : ''}Hilfsmittel: ${tl}`, ML, y); y += 2.5; draw(INK, 0.6); pdf.line(ML, y, RX, y); y += 8;
    }
    if (mat) await material(mat);
    let crop = ''; try { crop = q.crop ? await imgGet(q.crop) : ''; } catch { crop = ''; }
    need(kind === 'graph_plot' ? 120 : kind === 'sketch' ? 95 : 28);   // Titel nicht vom grossen Antwortfeld trennen
    draw(); pdf.rect(W - MR + 6, y - 5, 12, 12); font('bold', 7, GREY); pdf.text(`${pts(q.maxPoints)} P`, W - MR + 12, y + 10, { align: 'center' });
    pdf.setLineDashPattern([0.6, 0.6], 0); pdf.line(W - MR + 6, y + 1, W - MR + 18, y + 1); pdf.setLineDashPattern([], 0);
    font('bold', 12); pdf.text(`Aufgabe ${clean(q.questionNumber || String(i + 1))}`, ML, y); y += 6;
    let imgBox = null;
    if (crop) {
      const img = await loadImg(crop);
      if (img?.naturalWidth) { const big = kind === 'label_image' || kind === 'image_hotspot', maxW = big ? CW : Math.min(CW, 120), w = Math.min(maxW, img.naturalWidth / (big ? 4 : 6)), h = w * img.naturalHeight / img.naturalWidth, hh = Math.min(h, big ? 120 : 90), ww = hh / h * w;
        need(hh + 4); try { const fmt = /^data:image\/png/i.test(crop) ? 'PNG' : 'JPEG'; pdf.addImage(crop, fmt, ML, y, ww, hh); imgBox = { x: ML, y, w: ww, h: hh, page }; } catch { } y += hh + 4; }
    }
    if (kind !== 'fill_blanks') para(vv.text, 11);
    if (vv.latexFormula) { y += 1; para(vv.latexFormula, 12, 'bold', [30, 30, 90], 6); }
    y += 2;
    let stepsShown = false, answerShown = true;
    switch (kind) {
      case 'single_choice': case 'multiple_choice': case 'multi_select': choice(vv, kind); break;
      case 'true_false': trueFalse(vv); break;
      case 'text_select': textSelect(vv); break;
      case 'image_hotspot': hotspot(vv, imgBox); answerShown = false; break;
      case 'code': code(vv); break;
      case 'number_line': numberLine(vv); break;
      case 'fill_blanks': fillBlanks(vv); break;
      case 'matching': matching(vv); break;
      case 'ordering': ordering(vv, q); break;
      case 'numeric': stepsShown = work(vv, 3); resultRow('Resultat', vv.correctAnswer, vv.unit, true); break;
      case 'math_calculation': stepsShown = work(vv, 7); resultRow('Resultat', [vv.correctAnswer, vv.unit].filter(s => s != null && s !== '').join(' '), '', false); break;
      case 'short_answer': { need(10); y += 7; draw([60, 60, 60], 0.3); pdf.line(ML, y, RX, y); if (solutions && clean(vv.correctAnswer).trim()) { font('bold', 10.5, SOL); pdf.text(pdf.splitTextToSize(clean(vv.correctAnswer), CW - 4)[0], ML + 2, y - 1.2); } else if (!solutions) lines(1); y += 4; break; }
      case 'formula': { need(14); y += 9; font('bold', 10); pdf.text('Formel:', ML, y); draw([60, 60, 60], 0.3); pdf.line(ML + 16, y + 0.8, RX, y + 0.8);
        if (solutions && clean(vv.correctAnswer).trim()) { font('bold', 11, SOL); pdf.text(pdf.splitTextToSize(clean(vv.correctAnswer), CW - 20)[0], ML + 18, y - 0.6); } y += 6; break; }
      case 'sketch': stepsShown = sketch(vv) === 'steps'; break;
      case 'table_fill': table(vv); break;
      case 'label_image': labelImage(vv, imgBox); break;
      case 'graph_plot': graph(vv); break;
      case 'categorize': categorize(vv); break;
      case 'essay_open_text': answerShown = false; stepsShown = work(vv, 10); break;
      default: answerShown = false; stepsShown = work(vv, 7);   // diagram_analysis und unbekannte Typen
    }
    if (solutions) {
      if (!answerShown) sol(vv.correctAnswer, kind === 'essay_open_text' ? 'Erwartet: ' : 'Lösung: ');
      if (!stepsShown && clean(vv.stepByStepSolution).trim()) para(`Lösungsweg: ${clean(vv.stepByStepSolution)}`, 10, 'normal', [40, 70, 50]);
      const rub = arr(vv.rubricCriteria).map(clean).filter(Boolean); if (rub.length) { y += 1; para('Teilpunkte:', 9, 'bold', [40, 70, 50]); rub.forEach(r => para(`• ${r}`, 9, 'normal', [40, 70, 50], 3)); }
    }
    y += 7;
  }

  // ---------- Notenskala (Land wählbar, Rückfall: Schweizer Formel) ----------
  let ctry = ['CH', 'DE', 'AT'].includes(country) ? country : 'CH', rows = null;
  try { const G = await import('./grades.js'); rows = sum > 0 && sum <= 2000 ? G.scaleRows?.(ctry, sum) : null; } catch { rows = null; }
  rows = arr(rows).filter(r => r && r.grade !== undefined);
  if (!rows.length) { ctry = 'CH'; rows = FALLBACK_CH(sum); }
  const cols = Math.min(6, rows.length), cw = CW / cols, rh = 10, rN = Math.ceil(rows.length / cols);
  need(14 + rN * rh); font('bold', 10); pdf.text(SCALE_TITLE[ctry](pts(sum)), ML, y); y += 6;
  rows.forEach((r, k) => { const cx = ML + (k % cols) * cw, cy = y + Math.floor(k / cols) * rh, g = nr(r.grade, NaN);
    const gs = Number.isFinite(g) ? (ctry === 'CH' ? g.toFixed(1) : String(Math.round(g * 10) / 10)) : clean(r.grade), lab = clean(r.label).trim();
    font('bold', 9); pdf.text(pdf.splitTextToSize(lab && lab !== gs ? `${gs} · ${lab}` : gs, cw - 2)[0], cx, cy);
    font('normal', 8.5, [70, 70, 70]); pdf.text(`ab ${pts(r.minPoints)} P`, cx, cy + 4.2); });
  y += rN * rh; font('normal', 7.5, GREY); pdf.text('Richtwert – Schulen können abweichen.', ML, y);
  footer();
  return pdf;
}
export async function examStudioPdf(docM, qs, variant, opts = {}) {
  const pdf = await buildStudioPdf(docM, qs, variant, opts);
  const name = `${clean(docM?.title) || 'Pruefung'}${opts.solutions ? ' Loesungen' : ''}.pdf`.replace(/[^\wäöüÄÖÜ .-]+/g, '_').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/\s+/g, '_');
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  if (P?.Filesystem && P?.Share) {
    const { uri } = await P.Filesystem.writeFile({ path: name, data: pdf.output('datauristring').split(',')[1], directory: 'CACHE' });
    await P.Share.share({ title: name, files: [uri], dialogTitle: t('Prüfung speichern oder teilen') }).catch(e => { if (!/cancel/i.test(e?.message || '')) throw e; });
    return name;
  }
  const blob = pdf.output('blob'), file = typeof File === 'function' ? new File([blob], name, { type: 'application/pdf' }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) { await navigator.share({ files: [file], title: name }).catch(() => { }); return name; }
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  return name;
}
