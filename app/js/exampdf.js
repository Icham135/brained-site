// Prüfungsgenerator → echtes PDF (A4) im Stil offizieller Schweizer Prüfungen:
// Deckblatt (Dauer, Hilfsmittel, Hinweise, Name/Kand.-Nr., Punkteübersicht, Notenskala),
// Aufgaben mit Punkten und Karo-/Linienfeld, separater Lösungsschlüssel mit Punkteverteilung.
// jsPDF + Liberation Sans (Arial-kompatibel, OFL) werden erst bei Bedarf geladen.
import { gradeScale, examTotal, figureLayout, bestGrade } from './examdoc.js';
import { t } from './i18n.js';
const tn = (tpl, n) => t(tpl).replace('#', n);

let jsPDFCtor, fonts;
const loadScript = src => new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('PDF-Modul konnte nicht geladen werden'));
  document.head.appendChild(s);
});
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function lib() {
  if (!jsPDFCtor) { await loadScript(new URL('./vendor/jspdf.min.js', import.meta.url).href); jsPDFCtor = window.jspdf.jsPDF; }
  if (!fonts) {
    const get = f => fetch(new URL(`../assets/fonts/${f}`, import.meta.url)).then(r => { if (!r.ok) throw new Error('Schrift fehlt'); return r.arrayBuffer(); }).then(b64);
    fonts = { r: await get('LiberationSans-Regular.ttf'), b: await get('LiberationSans-Bold.ttf') };
  }
  return jsPDFCtor;
}

// Zeichen, die die Schrift nicht hat → lesbare Alternativen; Emojis raus
const MAP = { '⇒': '→', '⇔': '↔', '∈': ' є ', 'ℝ': 'R', 'ℕ': 'N', 'ℤ': 'Z', 'ℚ': 'Q', '∠': '∡', '⊥': ' senkrecht ', '∥': ' || ', '☐': '', '✓': '', '✔': '', '\t': '  ' };
const clean = s => String(s ?? '').replace(/[⇒⇔∈ℝℕℤℚ∠⊥∥☐✓✔\t]/g, c => MAP[c]).replace(/∡/g, 'Winkel ')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\r/g, '');

const W = 210, H = 297, ML = 20, MR = 20, CW = W - ML - MR, TOP = 26, BOTTOM = 280;
const INK = [20, 20, 20], MUTE = [95, 95, 95], LINE = [170, 170, 170], GRID = [205, 205, 205], RED = [196, 30, 58], GREEN = [16, 130, 70];

export async function buildExamPdf(ex, { solutions = false } = {}) {
  const J = await lib();
  const doc = new J({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('LS-R.ttf', fonts.r); doc.addFont('LS-R.ttf', 'LS', 'normal');
  doc.addFileToVFS('LS-B.ttf', fonts.b); doc.addFont('LS-B.ttf', 'LS', 'bold');
  const total = examTotal(ex);
  let y = TOP;
  const font = (size, bold = false, color = INK) => { doc.setFont('LS', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  const lh = size => size * 0.3528 * 1.38; // Zeilenhöhe in mm
  const head = () => {
    font(8.5, true); doc.text(clean(t(ex.kicker)), ML, 13); doc.text(clean(ex.title), W - MR, 13, { align: 'right' });
    font(8.5); doc.text(clean(t('Probeprüfung')), ML, 17); doc.text(clean(solutions ? t('Lösungsschlüssel') : ex.series), W - MR, 17, { align: 'right' });
    doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.line(ML, 19.5, W - MR, 19.5);
  };
  const newPage = () => { doc.addPage(); head(); y = TOP; };
  const need = h => { if (y + h > BOTTOM) newPage(); };
  // Fliesstext mit Umbruch über Seiten
  const para = (text, { size = 10.5, bold = false, color = INK, x = ML, w = CW, gap = 1.6 } = {}) => {
    font(size, bold, color);
    for (const raw of clean(text).split('\n')) {
      const lines = raw.trim() ? doc.splitTextToSize(raw, w) : [''];
      for (const l of lines) { need(lh(size)); doc.text(l, x, y + lh(size) * .72); y += lh(size); }
    }
    y += gap;
  };
  const grid = rows => { // Karofeld (5 mm) wie in echten Mathe-Prüfungen
    const h = rows * 5; need(Math.min(h, 60));
    let left = h;
    while (left > 0) {
      const avail = Math.floor((BOTTOM - y) / 5) * 5; if (avail < 15) { newPage(); continue; }
      const hh = Math.min(left, avail);
      doc.setDrawColor(...GRID); doc.setLineWidth(.15);
      for (let gy = 0; gy <= hh + .01; gy += 5) doc.line(ML, y + gy, ML + CW, y + gy);
      for (let gx = 0; gx <= CW + .01; gx += 5) doc.line(ML + gx, y, ML + gx, y + hh);
      y += hh + 3; left -= hh;
    }
  };
  const lines = n => { doc.setDrawColor(...LINE); doc.setLineWidth(.2); for (let i = 0; i < n; i++) { need(9); y += 8.5; doc.line(ML, y, ML + CW, y); } y += 4; };
  const box = (x, yy) => { doc.setDrawColor(...INK); doc.setLineWidth(.3); doc.rect(x, yy - 3.2, 3.6, 3.6); };

  // ------------------------------ Deckblatt ------------------------------
  head();
  font(26, true); doc.text(clean(ex.title), ML, 42); font(15, true); doc.text(clean(solutions ? t('Lösungsschlüssel') : ex.series), W - MR, 42, { align: 'right' });
  y = 52;
  if (solutions) {
    font(10.5, true); doc.text(t('Hinweise zur Korrektur'), ML, y + 4); y += 9;
    const tips = [t('Die maximale Punktzahl steht bei jeder Teilaufgabe, z. B. (3 P.).'), t('Teilpunkte gemäss Bewertungshinweis. Folgefehler ergeben keinen weiteren Abzug, sofern die Aufgabe dadurch nicht einfacher wird.'),
      t('Richtige Endresultate ohne nachvollziehbaren Lösungsweg geben keine volle Punktzahl.'), (ex.scale && ex.scale !== 'ch' ? t('Note gemäss Notenskala auf dem Deckblatt.') : tn('Note = erreichte Punkte ÷ # × 5 + 1 (Notenskala auf dem Deckblatt).', total))];
    tips.forEach((t, i) => para(`${i + 1}.  ${t}`, { size: 10 }));
  } else {
    const kv = (k, v) => { font(10.5); doc.text(k, ML, y + 4); const l = doc.splitTextToSize(clean(v), CW - 45); doc.text(l, ML + 45, y + 4); y += Math.max(1, l.length) * lh(10.5) + 1; };
    kv(t('Prüfungsdauer:'), tn('# Minuten', ex.minutes)); kv(t('Hilfsmittel:'), t(ex.aids || 'keine')); kv(t('Punkte total:'), `${total}`);
    y += 4; font(10.5, true); doc.text(t(ex.formal ? 'Beachten Sie:' : 'Beachte:'), ML, y + 4); y += 8;
    (ex.rules || []).slice(0, 6).forEach((r, i) => { font(10.5); const l = doc.splitTextToSize(clean(t(r)), CW - 8); doc.text(`${i + 1}.`, ML, y + 4); doc.text(l, ML + 7, y + 4); y += l.length * lh(10.5) + .8; });
    y += 6; font(10.5);
    const dots = (x1, x2, yy) => { doc.setLineDashPattern([.4, .8], 0); doc.setDrawColor(...MUTE); doc.line(x1, yy, x2, yy); doc.setLineDashPattern([], 0); };
    doc.text(t('Name'), ML + 2, y + 4); dots(ML + 38, W - MR, y + 5); y += 8;
    doc.text(t('Vorname'), ML + 2, y + 4); dots(ML + 38, W - MR, y + 5); y += 8;
    doc.text(t('Kand.-Nummer'), ML + 2, y + 4); dots(ML + 38, ML + 95, y + 5); doc.text(t('Klasse'), ML + 102, y + 4); dots(ML + 120, W - MR, y + 5); y += 11;
  }
  // Übersicht
  font(10.5); doc.text(t('Übersicht'), ML, y + 3); y += 5;
  const cols = [ML, ML + 22, ML + 102, ML + 136, W - MR];
  const row = (cells, { bold = false, h = 6.2, fill = null } = {}) => {
    if (fill) { doc.setFillColor(...fill); doc.rect(cols[0], y, CW, h, 'F'); }
    doc.setDrawColor(...INK); doc.setLineWidth(.25); doc.rect(cols[0], y, CW, h);
    for (let i = 1; i < cols.length - 1; i++) doc.line(cols[i], y, cols[i], y + h);
    font(9.5, bold); cells.forEach((c, i) => { const cx = i >= 2 ? (cols[i] + cols[i + 1]) / 2 : cols[i] + 2; doc.text(clean(c), cx, y + h * .68, i >= 2 ? { align: 'center' } : {}); });
    y += h;
  };
  row([t('Aufgabe'), t('Thema'), t('Mögliche Punkte'), t('Erzielte Punkte')], { bold: true, fill: [238, 238, 238] });
  const tasks = ex.tasks || [];
  const trim = (s, w) => { font(9.5); let t = clean(s); while (doc.getTextWidth(t) > w && t.length > 4) t = t.slice(0, -2); return t === clean(s) ? t : t.trim() + '…'; };
  tasks.forEach((tk, i) => { if (y > BOTTOM - 20) newPage(); row([`${t('Aufgabe')} ${i + 1}`, trim(tk.title || '', cols[2] - cols[1] - 4), String(taskPts(tk)), solutions ? String(taskPts(tk)) : '']); });
  row(['', t('Total'), String(total), solutions ? String(total) : ''], { bold: true });
  row(['', '', t('Note'), solutions ? bestGrade(ex.scale) : ''], { bold: true });
  y += 6;
  // Notenskala
  const sc = gradeScale(total, ex.scale);
  if (y + 18 > BOTTOM) newPage();
  font(10.5); doc.text(t('Notenskala'), ML, y + 3); y += 5;
  const cw = CW / (sc.length + 1);
  [[t('Punkte'), ...sc.map(s => s.range)], [t('Note'), ...sc.map(s => s.grade)]].forEach((r, ri) => {
    r.forEach((c, i) => { doc.setDrawColor(...INK); doc.setLineWidth(.25); doc.rect(ML + i * cw, y, cw, 6.2); font(i === 0 ? 8.5 : 7.6, i === 0 || ri === 1); doc.text(String(c), ML + i * cw + cw / 2, y + 4.2, { align: 'center' }); });
    y += 6.2;
  });

  // ------------------------------ Material ------------------------------
  if ((ex.material || []).length) {
    newPage();
    for (const m of ex.material) { para(m.title || t('Material'), { size: 12, bold: true, gap: 2 }); para(m.text, { size: 10.5, gap: 5 }); }
  }

  // ------------------------------ Aufgaben ------------------------------
  let part = null;
  tasks.forEach((tk, ti) => {
    if (!solutions || ti === 0) newPage(); else { y += 6; need(40); }
    if (tk.part && tk.part !== part) { part = tk.part; font(9, true, MUTE); doc.text(clean(part).toUpperCase(), ML, y + 3); y += 6; }
    font(14, true); doc.text(`${t('Aufgabe')} ${ti + 1}`, ML, y + 5); font(10.5); doc.text(`${fmtP(taskPts(tk))} ${t(taskPts(tk) === 1 ? 'Punkt' : 'Punkte')}`, W - MR, y + 5, { align: 'right' });
    if (tk.title) { font(10.5, true, MUTE); doc.text(clean(tk.title), ML + 32, y + 5); }
    y += 10;
    if (tk.intro) para(tk.intro, { size: 10.5, gap: 3 });
    if (tk.table) {                                                    // Datentabelle
      const cols = Math.max(tk.table.head?.length || 0, ...tk.table.rows.map(r => r.length)), cw = Math.min(42, CW / cols);
      const tr = (cells, bold) => { need(7); cells.forEach((c, i) => { doc.setDrawColor(...INK); doc.setLineWidth(.2); if (bold) { doc.setFillColor(238, 238, 238); doc.rect(ML + i * cw, y, cw, 6.5, 'FD'); } else doc.rect(ML + i * cw, y, cw, 6.5); font(9, bold); doc.text(doc.splitTextToSize(clean(c), cw - 2)[0] || '', ML + i * cw + 1.5, y + 4.4); }); y += 6.5; };
      if (tk.table.head?.length) tr(tk.table.head, true);
      tk.table.rows.forEach(r => tr(Array.from({ length: cols }, (_, i) => r[i] ?? ''), false)); y += 4;
    }
    if (tk.figure) {                                                   // einfache Figur (Koordinatensystem / Vieleck)
      const fw = Math.min(CW, 120), fh = 70; need(fh + 4);
      const { P, x0, x1, y0, y1 } = figureLayout(tk.figure, fw, fh, 6), X = v => ML + v, Y = v => y + v;
      doc.setLineWidth(.15); doc.setDrawColor(...GRID);
      if (tk.figure.type === 'coords' || tk.figure.grid) {
        for (let gx = Math.ceil(x0); gx <= x1; gx++) { const a = P([gx, 0])[0]; doc.line(X(a), Y(P([0, y0])[1]), X(a), Y(P([0, y1])[1])); }
        for (let gy = Math.ceil(y0); gy <= y1; gy++) { const b = P([0, gy])[1]; doc.line(X(P([x0, 0])[0]), Y(b), X(P([x1, 0])[0]), Y(b)); }
        if (tk.figure.type === 'coords') { doc.setDrawColor(...INK); doc.setLineWidth(.3); const [ax, ay] = P([0, 0]); doc.line(X(P([x0, 0])[0]), Y(ay), X(P([x1, 0])[0]), Y(ay)); doc.line(X(ax), Y(P([0, y0])[1]), X(ax), Y(P([0, y1])[1])); }
      }
      doc.setDrawColor(...INK); doc.setLineWidth(.4);
      const seg = (a, b) => { const A = tk.figure.points[a], B = tk.figure.points[b]; if (A && B) { const [p, q] = [P(A), P(B)]; doc.line(X(p[0]), Y(p[1]), X(q[0]), Y(q[1])); } };
      tk.figure.polygons.forEach(pl => pl.forEach((k, i) => seg(k, pl[(i + 1) % pl.length])));
      tk.figure.segments.forEach(([a, b]) => seg(a, b));
      font(8.5, false, MUTE);
      Object.entries(tk.figure.labels || {}).forEach(([k, v]) => { const m = k.match(/^([A-Z]\w?)([A-Z]\w?)$/); const A = m && tk.figure.points[m[1]], B = m && tk.figure.points[m[2]]; if (A && B) { const [p, q] = [P(A), P(B)]; doc.text(clean(v), X((p[0] + q[0]) / 2) + 1, Y((p[1] + q[1]) / 2) - 1); } });
      font(9.5, true); Object.entries(tk.figure.points).forEach(([k, v]) => { const [a, b] = P(v); doc.setFillColor(...INK); doc.circle(X(a), Y(b), .6, 'F'); doc.text(clean(k), X(a) + 1.4, Y(b) - 1.2); });
      y += fh + 4;
    }
    const items = tk.items || [];
    items.forEach(it => {
      const lab = it.label ? `${it.label})` : '';
      const ptsTxt = `(${fmtP(it.points)} ${t('P.')})`;
      font(10.5); const ql = doc.splitTextToSize(clean(it.q), CW - 10 - 18);
      need(ql.length * lh(10.5) + 4);
      if (lab) { font(10.5, true); doc.text(lab, ML, y + lh(10.5) * .72); }
      font(10.5); ql.forEach((l, k) => doc.text(l, ML + (lab ? 8 : 0), y + lh(10.5) * (k + .72)));
      font(9, false, MUTE); doc.text(ptsTxt, W - MR, y + lh(10.5) * .72, { align: 'right' });
      y += ql.length * lh(10.5) + 2;
      if (it.options?.length) {
        it.options.forEach((o, k) => {
          font(10.5); const ol = doc.splitTextToSize(clean(o), CW - 22); need(ol.length * lh(10.5) + 1.5);
          box(ML + 8, y + 4); if (solutions && (it.correct || []).includes(k)) { doc.setDrawColor(...RED); doc.setLineWidth(.6); doc.line(ML + 8.5, y + 1.2, ML + 11.2, y + 3.9); doc.line(ML + 11.2, y + 1.2, ML + 8.5, y + 3.9); }
          font(10.5, solutions && (it.correct || []).includes(k), solutions && (it.correct || []).includes(k) ? RED : INK);
          ol.forEach((l, j) => doc.text(l, ML + 14, y + 4 + j * lh(10.5))); y += ol.length * lh(10.5) + 1.6;
        });
        y += 2;
      }
      if (solutions) {
        if (it.solution) para(it.solution, { size: 10, color: RED, x: ML + 8, w: CW - 8, gap: .8 });
        if (it.rubric) para(it.rubric, { size: 9, bold: true, color: GREEN, x: ML + 8, w: CW - 8, gap: 3 });
        else y += 2;
      } else if (!it.options?.length) {
        const space = Math.max(2, Math.min(24, +it.space || 4));
        tk.answer === 'lines' ? lines(Math.ceil(space * .8)) : tk.answer === 'none' ? (y += 4) : grid(space * 2);
      }
    });
  });
  // Fusszeile & Seitenzahlen
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); font(7.5, false, MUTE);
    doc.text(t('Probeprüfung erstellt mit Brained – keine offizielle Prüfung. Aufbau nach öffentlich zugänglichen Vorgaben.'), ML, 289);
    doc.text(`${t('Seite')} ${p}/${n}`, W - MR, 289, { align: 'right' });
  }
  return doc;
}
const taskPts = t => (t.items || []).reduce((s, i) => s + (+i.points || 0), 0);
const fmtP = p => String(Math.round(p * 2) / 2);

// Speichern/Teilen: iPhone/Android → Teilen-Menü (Dateien, Drucken, Mail, WhatsApp …); Browser → Download
export async function shareExamPdf(ex, { solutions = false } = {}) {
  const doc = await buildExamPdf(ex, { solutions });
  const name = `${(ex.title + ' ' + (solutions ? 'Loesungen' : ex.series)).replace(/[^\wäöüÄÖÜ-]+/g, '_')}.pdf`.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue');
  const P = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
  if (P?.Filesystem && P?.Share) {
    const data = doc.output('datauristring').split(',')[1];
    const { uri } = await P.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
    await P.Share.share({ title: name, files: [uri], dialogTitle: t('Prüfung speichern oder teilen') }).catch(e => { if (!/cancel/i.test(e?.message || '')) throw e; });
    return name;
  }
  const blob = doc.output('blob');
  const file = typeof File === 'function' ? new File([blob], name, { type: 'application/pdf' }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    await navigator.share({ files: [file], title: name }).catch(() => { });
    return name;
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return name;
}
