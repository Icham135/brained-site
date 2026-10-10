// Prüfungsgenerator: Datenmodell einer Probeprüfung (Deckblatt, Aufgaben, Lösungsschlüssel) + Hilfsfunktionen.
// exam = { title, series, kicker, org, minutes, aids, rules[], material[{title,text}],
//          tasks[{ title, part, intro, answer:'grid'|'lines'|'none', items[{ label, q, points, space, options?, correct?[], solution, rubric }] }] }

export const examTotal = ex => Math.round((ex.tasks || []).reduce((s, t) => s + (t.items || []).reduce((a, i) => a + (+i.points || 0), 0), 0) * 2) / 2;
export const taskPoints = t => Math.round((t.items || []).reduce((a, i) => a + (+i.points || 0), 0) * 2) / 2;

// Notenskala je Land. CH: Note = Punkte ÷ Maximum × 5 + 1, auf halbe Noten (6 = beste). DE: 1–6 (1 = beste), Abitur in
// Notenpunkten 15–0. AT: 1–5 (1 = beste). Grenzen für DE/AT nach üblichen Prozentschlüsseln.
const BANDS = {
  de: [['1', .92], ['2', .81], ['3', .67], ['4', .5], ['5', .3], ['6', 0]],
  abitur: [['15', .95], ['14', .9], ['13', .85], ['12', .8], ['11', .75], ['10', .7], ['9', .65], ['8', .6], ['7', .55], ['6', .5], ['5', .45], ['4', .4], ['3', .33], ['2', .27], ['1', .2], ['0', 0]],
  at: [['1', .875], ['2', .75], ['3', .625], ['4', .5], ['5', 0]],
};
export function gradeScale(max, scale = 'ch') {
  const out = [];
  if (BANDS[scale]) {
    let hi = max;
    for (const [g, p] of BANDS[scale]) { const lo = Math.ceil(p * max - 1e-9); out.push({ grade: g, range: hi < lo ? '–' : lo === hi ? String(lo) : `${lo}–${hi}` }); hi = lo - 1; }
    return out;
  }
  for (let g = 1; g <= 6; g += .5) {
    const lo = g === 1 ? 0 : Math.ceil(((g - .25 - 1) / 5) * max - 1e-9);
    const hi = g === 6 ? max : Math.ceil(((g + .25 - 1) / 5) * max - 1e-9) - 1;
    out.push({ grade: g % 1 ? g.toFixed(1) : String(g), range: hi < lo ? '–' : lo === hi ? String(lo) : `${lo}–${hi}` });
  }
  return out;
}
export const scaleOf = ex => ex?.scale === 'de' && ex?.type === 'abitur' ? 'abitur' : ex?.scale || 'ch';
export const bestGrade = sc => ({ de: '1', abitur: '15', at: '1' }[sc] || '6');
// Note aus Anteil 0..1 je Skala
export function gradeFor(pct, sc = 'ch') {
  if (!BANDS[sc]) return Math.max(1, Math.min(6, Math.round((pct * 5 + 1) * 10) / 10));
  return BANDS[sc].find(([, p]) => pct >= p - 1e-9)[0];
}

// KI-Formeln aufräumen: LaTeX-Reste → Unicode (x^{2} → x², log_{10} → log₁₀, \cdot → ·), Spezial-Bindestriche → normale Zeichen
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', x: 'ˣ' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', n: 'ₙ', k: 'ₖ', i: 'ᵢ' };
const conv = (s, map) => [...s].every(c => map[c]) ? [...s].map(c => map[c]).join('') : null;
export function fixMath(v) {
  return String(v ?? '')
    .replace(/\\(?:cdot|times)/g, m => m.includes('cdot') ? '·' : '×').replace(/\\(?:le|leq)\b/g, '≤').replace(/\\(?:ge|geq)\b/g, '≥').replace(/\\pi\b/g, 'π').replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)').replace(/\\(?:left|right)/g, '').replace(/\\[,;! ]/g, ' ').replace(/\$+/g, '')
    .replace(/\^\{([^}]*)\}/g, (m, a) => conv(a, SUP) ?? `^(${a})`).replace(/\^([0-9n])(?![0-9])/g, (m, a) => SUP[a])
    .replace(/_\{([^}]*)\}/g, (m, a) => conv(a, SUB) ?? `_(${a})`).replace(/([A-Za-z])_([0-9n])(?![0-9])/g, (m, l, a) => l + SUB[a])
    .replace(/[‐‑‒]/g, '-').replace(/−/g, '−').replace(/ | /g, ' ');
}
const deepFix = o => typeof o === 'string' ? fixMath(o) : Array.isArray(o) ? o.map(deepFix) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deepFix(v)])) : o;

// KI-Antwort robust in das Modell bringen (fehlende Felder, falsche Typen, alte Quiz-Struktur)
const MATHY = new Set(['mathe', 'physik', 'chemie', 'rw', 'info']);
export function normalizeExam(raw, { type, subjectName, minutes, subjectId }) {
  const ex = deepFix(JSON.parse(JSON.stringify(raw || {}).replace(/ß/g, 'ss'))), defAnswer = MATHY.has(subjectId) ? 'grid' : 'lines';
  if (!Array.isArray(ex.tasks) && Array.isArray(ex.questions)) ex.tasks = ex.questions.map(q => ({ title: q.topic, items: [{ q: q.q, points: q.points, options: q.options, correct: q.type === 'mc' ? [q.correct] : null, solution: q.type === 'mc' ? `${q.options?.[q.correct]}${q.explain ? ' – ' + q.explain : ''}` : q.model, space: 6 }] }));
  ex.title = subjectName;
  ex.series = ex.series || 'Serie A';
  ex.kicker = type.paper?.kicker || type.name;
  ex.formal = !!type.paper?.formal;
  ex.minutes = +ex.minutes || minutes;
  ex.aids = String(ex.aids || type.paper?.aids || 'keine');
  ex.rules = (Array.isArray(ex.rules) && ex.rules.length ? ex.rules : type.paper?.rules || ['Der Lösungsweg muss ersichtlich sein.']).map(String).slice(0, 6);
  ex.material = (Array.isArray(ex.material) ? ex.material : []).filter(m => m && m.text).map(m => ({ title: String(m.title || 'Material'), text: String(m.text) }));
  ex.tasks = (ex.tasks || []).filter(t => t && (t.items?.length || t.q)).map(t => {
    const items = (t.items?.length ? t.items : [{ q: t.q, points: t.points, solution: t.solution, options: t.options, correct: t.correct }])
      .filter(i => i && i.q).map((i, k, arr) => {
        let correct = i.correct; if (correct != null && !Array.isArray(correct)) correct = [correct];
        const options = Array.isArray(i.options) && i.options.length >= 2 ? i.options.map(String) : null;
        return { label: arr.length > 1 ? String(i.label || 'abcdefghij'[k]).replace(/\)$/, '') : '', q: String(i.q), points: Math.max(.5, Math.round((+i.points || 1) * 2) / 2),
          space: Math.max(2, Math.min(24, +i.space || 5)), options, correct: options ? (correct || []).map(Number).filter(n => n >= 0 && n < options.length) : null,
          solution: String(i.solution ?? i.model ?? ''), rubric: i.rubric ? String(i.rubric) : '' };
      });
    const table = t.table && Array.isArray(t.table.rows) ? { head: (t.table.head || []).map(String).slice(0, 8), rows: t.table.rows.slice(0, 14).map(r => (Array.isArray(r) ? r : [r]).map(c => String(c ?? '')).slice(0, 8)) } : null;
    const fg = t.figure && t.figure.points && typeof t.figure.points === 'object' ? { type: t.figure.type === 'coords' ? 'coords' : 'shape', grid: !!t.figure.grid,
      points: Object.fromEntries(Object.entries(t.figure.points).filter(([, v]) => Array.isArray(v) && v.length === 2 && v.every(n => isFinite(+n))).slice(0, 16).map(([k, v]) => [String(k).slice(0, 4), [+v[0], +v[1]]])),
      polygons: (t.figure.polygons || []).filter(Array.isArray).slice(0, 6), segments: (t.figure.segments || []).filter(Array.isArray).slice(0, 12), labels: t.figure.labels && typeof t.figure.labels === 'object' ? t.figure.labels : {} } : null;
    return { table, figure: fg && Object.keys(fg.points).length >= 2 ? fg : null, title: String(t.title || t.topic || ''), part: t.part ? String(t.part) : '', intro: t.intro ? String(t.intro) : '', answer: ['grid', 'lines', 'none'].includes(t.answer) ? t.answer : defAnswer, items };
  }).filter(t => t.items.length);
  return ex;
}

// Demo-Modus (ohne KI): Prüfung aus der Brained-Fragenbank
export function demoExam({ type, subjectId, subjectName, bank, n, minutes }) {
  const qs = bank.slice(0, n);
  const tasks = qs.map(q => ({ title: q.topic,
    items: [{ q: q.q, points: q.points || 2, space: q.type === 'open' ? 8 : 4, options: q.type === 'mc' ? q.options : null, correct: q.type === 'mc' ? [q.correct] : null,
      solution: q.type === 'mc' ? `${q.options[q.correct]}${q.explain ? ' – ' + q.explain : ''}` : q.model, rubric: q.type === 'mc' ? `${q.points || 2} P. für die richtige Antwort` : 'Punkte je nach Vollständigkeit des Lösungswegs' }] }));
  return { ...normalizeExam({ title: subjectName, tasks, minutes }, { type, subjectName, minutes, subjectId }), demo: true };
}

// System-Prompt für die KI (rein, damit er auch im Live-Test verwendet werden kann)
export const examPrompt = ({ type, subjectName, minutes, size, bp, P }) => `Du bist erfahrene Prüfungsautorin an einer Schweizer Schule und erstellst eine Probeprüfung zum Ausdrucken, die von einer echten kaum zu unterscheiden ist.
Prüfung: ${type.name} (${type.stage}). ${type.format}
${bp ? `Offizieller Aufbau dieses Fachs (Themen, Aufgabentypen, Hilfsmittel strikt einhalten): ${bp}\n` : ''}Fach: ${subjectName}. Dauer: ${minutes} Minuten. Umfang: ${size}.
So sehen echte Prüfungen aus – genau so schreiben:
- Nummerierte Aufgaben mit kurzem Thema, oft mit Teilaufgaben a), b), c); Punkte pro Teilaufgabe (ganze oder halbe Punkte); steigende Schwierigkeit; Mischung aus Routine-, Anwendungs- und Transferaufgaben.
- Präzise Operatoren wie im Original (berechnen, bestimmen, begründen, ankreuzen, Gesetzesartikel nennen). Schwierigkeit exakt auf dem Niveau der echten Prüfung – keine Primarschul-Aufgaben in einer BMP oder Matura. ${P.formal ? 'Durchgehend Sie-Form («Berechnen Sie», «Bestimmen Sie»).' : 'Durchgehend Du-Form («Berechne», «Bestimme»).'}
- Alle nötigen Angaben in der Aufgabe (Zahlen, Masse, Fallbeispiel). Realistischer Schweizer Kontext (CHF, Orte, Firmen erfunden). Schweizer Rechtschreibung, kein ß.
- Sprachfächer/ABU/Wirtschaft: zuerst ein Material (Lesetext 250–450 Wörter, Fallbeispiel oder Tabelle) unter "material", Aufgaben beziehen sich darauf. Mathematik/Naturwissenschaften: Angaben direkt in die Aufgabe ("intro"), "material" leer lassen.
- Multiple Choice nur, wenn es im Original vorkommt ("options" + "correct" als Index-Liste, z. B. «Kreuze die richtigen Aussagen an»).
- Mathe/Formeln als Klartext mit Unicode: x², √(2x+1), 3/4, π, ≤, ·, ×. KEIN LaTeX, kein Markdown.
- "space": Platzbedarf für die Antwort in Zeilen (2–16). "answer": "grid" für Rechnen/Konstruieren, "lines" für Text.
- Lösungsschlüssel: vollständige Musterlösung mit Lösungsweg (jede Zahl nachrechnen!) und Bewertungshinweis wie im Original («1 P. für korrekten Ansatz, 1 P. für Resultat»).
Antworte NUR mit JSON (keine Erklärungen davor/danach):
{"title":"${subjectName}","series":"Serie A","minutes":${minutes},"aids":"${P.aids || ''}","rules":["…"],"material":[{"title":"Text 1: …","text":"…"}],
"tasks":[{"title":"Thema der Aufgabe","part":"Teil 1 – ohne Taschenrechner (nur falls die Prüfung Teile hat)","intro":"gemeinsame Angaben","answer":"grid","items":[{"label":"a","q":"…","points":2,"space":6,"solution":"…","rubric":"…"},{"label":"b","q":"Kreuze die richtige Aussage an.","points":1,"options":["…","…","…","…"],"correct":[2],"solution":"…","rubric":"…"}]}]}`;

// Beispiel für Store-Screenshots (Showcase): Auszug einer BMP-Probeprüfung Mathematik
export const SAMPLE_EXAM = {
  title: 'Mathematik', series: 'Serie A', minutes: 120, kicker: 'Berufsmaturität · Abschlussprüfung', formal: true,
  aids: 'Taschenrechner ohne CAS/Solver, nicht programmierbar. Beigelegte Formelsammlung.',
  rules: ['Unbelegte Resultate (fehlender Lösungsweg) werden nicht berücksichtigt.', 'Lösungsschritte werden bewertet.', 'Resultate müssen eindeutig und aussagekräftig dargestellt sein.'],
  material: [],
  tasks: [
    { title: 'Gleichungssystem', answer: 'grid', intro: 'Ermitteln Sie die Lösungsmenge des Gleichungssystems.', items: [{ label: '', q: '(1)  3x − 2y = 4\n(2)  5x + 4y = 36', points: 7, space: 12, solution: '(1)·2 + (2): 11x = 44 → x = 4; in (1): 12 − 2y = 4 → y = 4. L = {(4 | 4)}', rubric: '2 P. Verfahren, 2 P. x, 2 P. y, 1 P. Lösungsmenge' }] },
    { title: 'Exponentialfunktion', answer: 'grid', intro: 'Eine Wohnung in Winterthur kostete 2015 CHF 640 000. Ihr Wert steigt jährlich um 3.2 %.', items: [
      { label: 'a', q: 'Bestimmen Sie den Wert im Jahr 2030.', points: 4, space: 8, solution: '640 000 · 1.032¹⁵ ≈ CHF 1 025 000', rubric: '2 P. Ansatz, 2 P. Resultat' },
      { label: 'b', q: 'Nach wie vielen Jahren hat sich der Wert verdoppelt?', points: 5, space: 8, solution: '1.032ⁿ = 2 → n = ln 2 / ln 1.032 ≈ 22 Jahre', rubric: '2 P. Gleichung, 2 P. Logarithmus, 1 P. Resultat' }] },
    { title: 'Finanzmathematik', answer: 'grid', items: [{ label: '', q: 'Lea zahlt 8 Jahre lang jeweils Ende Jahr CHF 3 000 auf ein Sparkonto (Zins 1.5 %). Wie gross ist ihr Guthaben am Ende?', points: 6, space: 10, solution: 'R·(qⁿ − 1)/(q − 1) = 3000·(1.015⁸ − 1)/0.015 ≈ CHF 25 291', rubric: '3 P. Formel, 2 P. Einsetzen, 1 P. Resultat' }] },
    { title: 'Trigonometrie', answer: 'grid', items: [{ label: '', q: 'Vom Ufer aus sieht man die Spitze des Grossmünster-Turms (64 m) unter einem Höhenwinkel von 18°. Wie weit ist der Turm entfernt?', points: 5, space: 10, solution: 'tan 18° = 64/d → d = 64 / tan 18° ≈ 197 m', rubric: '2 P. Skizze/Ansatz, 3 P. Resultat' }] },
  ],
};

// Prompt aus einem Datenbank-Profil (js/examdb.js): Struktur, Punkte, Aufgabentypen und Regeln exakt wie in der echten Prüfung
export function examPromptProfile({ ex, subj, key, length = 'real', extra = '' }) {
  const L = { short: { f: .35, name: 'Kurzversion' }, standard: { f: .6, name: 'halbe Prüfung' }, real: { f: 1, name: 'vollständige Prüfung' } }[length] || { f: 1 };
  const st = subj.structure || {}, nTasks = st.tasks ? Math.max(2, Math.round(st.tasks * L.f)) : null;
  const total = st.total ? Math.round(st.total * L.f) : null, minutes = Math.max(15, Math.round(subj.minutes * L.f / 5) * 5);
  const isAufsatz = key.includes('aufsatz');
  return { minutes, nTasks, total, f: L.f, system: `Du bist Mitglied der Prüfungskommission und erstellst eine NEUE Probeprüfung, die von der echten Prüfung nicht zu unterscheiden ist.
Prüfung: ${ex.name} (${ex.stage}), ${ex.regionLabel || 'Kanton'} ${ex.canton}${ex.country && ex.country !== 'CH' ? `, ${{ DE: 'Deutschland', AT: 'Österreich' }[ex.country]}` : ''}. Teil/Fach: ${subj.title}.${ex.note ? `\nHINWEIS: ${ex.note}` : ''}${(subj.lang || ex.lang) && (subj.lang || ex.lang) !== 'de' ? `\nSPRACHE: Die gesamte Prüfung (Deckblatt, Aufgaben, Lösungen) auf ${{ fr: 'Französisch', it: 'Italienisch' }[subj.lang || ex.lang]} schreiben – wie das Original.` : ''}
${ex.official === false ? 'ÜBLICHES FORMAT DIESER PRÜFUNG (Richtwerte – für diese Region liegen keine ausgewerteten Originale vor; halte dich an das übliche Format und den offiziellen Lehrplan):' : `FAKTEN DER ECHTEN PRÜFUNG (aus offiziellen Vorgaben und veröffentlichten Prüfungen ${subj.years || ''} – exakt einhalten):`}
- Dauer: ${subj.minutes} Minuten${L.f < 1 ? ` (diese ${L.name}: ${minutes} Minuten)` : ''}. Anrede: ${subj.form === 'Sie' ? 'durchgehend Sie-Form' : 'durchgehend Du-Form'}.
- Hilfsmittel: ${subj.aids}
- Aufbau: ${st.tasks ? `${nTasks} Aufgaben` : ''}${total ? `, total genau ${total} Punkte` : ''}${st.points ? ` (${st.points})` : ''}. ${st.note || ''}
${subj.sections?.length ? `- Teile: ${subj.sections.join(' · ')} (als "part" setzen)\n` : ''}${subj.material ? `- Material: ${subj.material.kind}, ${subj.material.words} Wörter, neu geschrieben, mit Zeilennummern-Bezug in den Aufgaben ("Zeilen 12–15"). Schreibe den Text vollständig in "material".\n` : ''}- Typische Aufgabentypen (in dieser Reihenfolge/Mischung wie im Original; ${L.f < 1 ? 'wähle die wichtigsten' : 'alle abdecken'}):
${subj.archetypes.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}
${subj.topics?.length ? `- Prüfungsstoff (offizielle Anforderungen) – NUR diesen Stoff verwenden, nichts aus höheren Stufen: ${subj.topics.join(' | ')}` : '- Prüfungsstoff: offizieller Lehrplan dieser Stufe und Region, nichts aus höheren Stufen.'}
${subj.level ? `- Niveau-Anker (so schwer müssen die Aufgaben sein – eigene, neue Aufgaben in dieser Art): ${subj.level.join(' / ')}
` : ''}
- Hinweise auf dem Deckblatt (sinngemäss übernehmen): ${(subj.rules || []).join(' / ')}
${extra ? `ZUSATZWUNSCH der lernenden Person (zusätzlich einbauen, ohne den Aufbau zu sprengen): ${extra}\n` : ''}QUALITÄT:
- Schwierigkeit und Sprache exakt auf dem Niveau der echten Prüfung (${ex.stage}); nicht leichter, nicht schwerer. Echte Prüfungsaufgaben sind mehrschrittig, haben Einschränkungen oder Fallen und verlangen Transfer – reine Einsetz- oder Einschritt-Aufgaben sind zu leicht.
- Exakt ${nTasks ? nTasks + ' Aufgaben' : 'die verlangte Anzahl Aufgaben'}${total ? ` mit genau ${total} Punkten total` : ''}. Zähle vor der Ausgabe nach.
- Verweise NIE auf eine Abbildung, die nicht als "figure" oder "table" mitgeliefert wird. Aufgaben, die ein Bild bräuchten (Würfelnetz, Karte), entweder mit figure liefern oder textlich so beschreiben, dass sie ohne Bild lösbar sind.
- Lösungen als Fliesstext mit Rechenweg (keine Markdown-Tabellen).
- Neue Zahlen, neue Kontexte (${ex.ctx || 'Schweiz: CHF, Schweizer Orte. Schweizer Rechtschreibung (ss statt ß).'}), keine Kopie bekannter Aufgaben.
- Jede Rechnung nachrechnen; Lösungen mit vollständigem Lösungsweg und Punkteverteilung («rubric»).
- Mathe/Formeln als Klartext mit Unicode (x², √, ·, ÷, ≤). Kein LaTeX, kein Markdown.
- Tabellen als "table": {"head":["…"],"rows":[["…"]]}. Einfache Figuren als "figure": {"type":"coords"|"shape","points":{"A":[x,y]},"polygons":[["A","B","C"]],"segments":[["A","B"]],"labels":{"AB":"8 cm"},"grid":true}.
${isAufsatz ? '- Aufsatz: "tasks" = die Themen (je title + intro mit Aufgabenstellung und Vorgaben wie Zeitform/Titel), items je ein Eintrag mit q = Kurzauftrag, points = 0, solution = Bewertungshinweise.\n' : ''}Antworte NUR mit JSON:
{"title":"${subj.title}","series":"Serie A","minutes":${minutes},"aids":"…","rules":["…"],"material":[{"title":"Textblatt","text":"…"}],
"tasks":[{"title":"Kurzthema","part":"…","intro":"Angaben","answer":"${subj.answer || 'lines'}","table":null,"figure":null,"items":[{"label":"a","q":"…","points":2,"space":6,"options":null,"correct":null,"solution":"…","rubric":"…"}]}]}` };
}

// Figuren: Punkte/Strecken/Vielecke in ein Rechteck einpassen (gemeinsam für Vorschau-SVG und PDF)
export function figureLayout(fig, W, H, pad = 18) {
  const pts = Object.values(fig.points); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (fig.type === 'coords') { x0 = Math.min(0, x0); y0 = Math.min(0, y0); x1 = Math.ceil(x1 + 1); y1 = Math.ceil(y1 + 1); }
  const sx = (W - 2 * pad) / Math.max(1, x1 - x0), sy = (H - 2 * pad) / Math.max(1, y1 - y0), sc = Math.min(sx, sy);
  const ox = pad + ((W - 2 * pad) - (x1 - x0) * sc) / 2, oy = pad + ((H - 2 * pad) - (y1 - y0) * sc) / 2;
  const P = ([x, y]) => [ox + (x - x0) * sc, oy + (y1 - y) * sc];
  return { P, x0, x1, y0, y1, sc, ox, oy };
}
const escX = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function figureSVG(fig, W = 320, H = 200) {
  const { P, x0, x1, y0, y1 } = figureLayout(fig, W, H); let g = '';
  if (fig.type === 'coords' || fig.grid) {
    for (let x = Math.ceil(x0); x <= x1; x++) { const [a] = P([x, 0]); g += `<line x1="${a}" y1="${P([0, y0])[1]}" x2="${a}" y2="${P([0, y1])[1]}" stroke="#e3e3e3"/>`; }
    for (let y = Math.ceil(y0); y <= y1; y++) { const [, b] = P([0, y]); g += `<line x1="${P([x0, 0])[0]}" y1="${b}" x2="${P([x1, 0])[0]}" y2="${b}" stroke="#e3e3e3"/>`; }
    if (fig.type === 'coords') { const [ax, ay] = P([0, 0]); g += `<line x1="${P([x0, 0])[0]}" y1="${ay}" x2="${P([x1, 0])[0]}" y2="${ay}" stroke="#333"/><line x1="${ax}" y1="${P([0, y0])[1]}" x2="${ax}" y2="${P([0, y1])[1]}" stroke="#333"/>`; }
  }
  for (const poly of fig.polygons) { const pp = poly.map(k => fig.points[k]).filter(Boolean).map(P); if (pp.length > 1) g += `<polygon points="${pp.map(p => p.join(',')).join(' ')}" fill="rgba(0,0,0,.06)" stroke="#222" stroke-width="1.4"/>`; }
  for (const [a, b] of fig.segments) { const A = fig.points[a], B = fig.points[b]; if (A && B) { const [p, q] = [P(A), P(B)]; g += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#222" stroke-width="1.4"/>`; } }
  for (const [k, v] of Object.entries(fig.labels || {})) { const ks = k.match(/^([A-Z]\w?)([A-Z]\w?)$/); const A = ks && fig.points[ks[1]], B = ks && fig.points[ks[2]]; if (A && B) { const [p, q] = [P(A), P(B)]; g += `<text x="${(p[0] + q[0]) / 2 + 4}" y="${(p[1] + q[1]) / 2 - 4}" font-size="11" fill="#555">${escX(v)}</text>`; } }
  for (const [k, v] of Object.entries(fig.points)) { const [x, y] = P(v); g += `<circle cx="${x}" cy="${y}" r="2.2" fill="#111"/><text x="${x + 5}" y="${y - 5}" font-size="12" font-weight="700" fill="#111">${escX(k)}</text>`; }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:6px 0">${g}</svg>`;
}

// ---------- Qualitätskontrolle: prüft eine generierte Prüfung gegen das Profil ----------
// Liefert eine Liste konkreter Mängel (leer = alles gut). Wird in App und Abgleich-Test verwendet.
export function examIssues(gen, subj, pr) {
  const out = [], st = subj.structure || {}, txt = JSON.stringify(gen);
  const n = gen.tasks.length, tot = examTotal(gen);
  if (pr.nTasks && Math.abs(n - pr.nTasks) >= 1) out.push(`Es müssen genau ${pr.nTasks} Aufgaben sein (jetzt ${n}).`);
  if (pr.total && Math.abs(tot - pr.total) > .01) out.push(`Das Punktetotal muss genau ${pr.total} sein (jetzt ${tot}). Passe die Teilpunkte an.`);
  if (/jede Aufgabe genau (\d+) Punkte/.test(st.points || '')) { const k = +RegExp.$1; gen.tasks.forEach((t, i) => { if (taskPoints(t) !== k) out.push(`Aufgabe ${i + 1} muss genau ${k} Punkte haben (jetzt ${taskPoints(t)}).`); }); }
  const du = (txt.match(/\b(du|dein|deine|dich|dir)\b/g) || []).length, sie = (txt.match(/\b(Sie|Ihre|Ihren|Ihnen|Ihr)\b/g) || []).length;
  if (subj.form === 'du' && sie > 2) out.push('Durchgehend Du-Form verwenden (keine Sie-Form).');
  if (subj.form === 'Sie' && du > 2) out.push('Durchgehend Sie-Form verwenden (keine Du-Form).');
  if (subj.material) {
    const w = gen.material.reduce((a, m) => a + m.text.split(/\s+/).length, 0), [lo] = String(subj.material.words).match(/\d+/g).map(Number);
    if (w < lo * .85 * (pr.f || 1)) out.push(`Der Lesetext ist zu kurz (${w} Wörter, verlangt ${subj.material.words}). Schreibe ihn vollständig aus, mit Zeilenbezug in den Aufgaben.`);
  }
  gen.tasks.forEach((t, i) => {
    const s = `${t.intro} ${t.items.map(x => x.q).join(' ')}`;
    if (!t.figure && !t.table && /(abgebildet|Abbildung|gezeigt|Skizze|Netz unten|im Bild|siehe Figur|Grafik unten|Diagramm unten)/i.test(s)) out.push(`Aufgabe ${i + 1} verweist auf eine Abbildung, die fehlt: entweder als "figure"/"table" mitliefern oder so umformulieren, dass sie ohne Bild lösbar ist.`);
    t.items.forEach((x, k) => { if (!x.solution || x.solution.length < 4) out.push(`Aufgabe ${i + 1}${x.label || ''}: Lösung fehlt.`); if (/\|\s*-{3,}/.test(x.solution)) out.push(`Aufgabe ${i + 1}${x.label || ''}: keine Markdown-Tabellen in der Lösung.`); });
  });
  if (/\\frac|\$\$|\\\(/.test(txt)) out.push('Kein LaTeX verwenden (Unicode-Klartext).');
  return [...new Set(out)].slice(0, 25);
}
export function examRepairPrompt(gen, issues, subj, pr) {
  return `Du bist Mitglied der Prüfungskommission und machst die Schlusskontrolle einer Probeprüfung («${subj.title}», ${pr.minutes} Minuten${pr.total ? `, total ${pr.total} Punkte` : ''}${pr.nTasks ? `, ${pr.nTasks} Aufgaben` : ''}).
1. Behebe ALLE gefundenen Mängel:
${issues.length ? issues.map(x => '- ' + x).join('\n') : '- (keine formalen Mängel)'}
2. Rechne JEDE Lösung Schritt für Schritt nach und korrigiere falsche Lösungen oder unlösbare Aufgaben.
3. Prüfe das Niveau: Aufgaben müssen so anspruchsvoll sein wie in der echten Prüfung (mehrschrittig, mit Einschränkungen, Transfer). Ersetze zu leichte Routineaufgaben durch gleichwertig schwierige.
4. Behalte Aufbau, Aufgabentypen und Stil bei. Antworte NUR mit dem vollständigen, korrigierten JSON im selben Schema.

PRÜFUNG (JSON):
${JSON.stringify({ title: gen.title, minutes: gen.minutes, aids: gen.aids, rules: gen.rules, material: gen.material, tasks: gen.tasks })}`;
}

// Toleranter JSON-Parser für KI-Antworten: Codeblock, fehlende/zusätzliche Kommas, Zeilenumbrüche in Strings, abgeschnittenes Ende
export function parseJSONLoose(text) {
  let t = String(text || ''); const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1];
  const i = Math.min(...['{', '['].map(c => t.indexOf(c)).filter(i => i >= 0)); if (!isFinite(i)) throw new Error('Kein JSON');
  t = t.slice(i);
  try { return JSON.parse(t.slice(0, t.lastIndexOf(t[0] === '{' ? '}' : ']') + 1)); } catch { }
  // Zeichenweise reparieren: Steuerzeichen in Strings escapen, fehlende Kommas einsetzen, offene Klammern schliessen
  let out = '', inStr = false, esc = false; const stack = [];
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') {
        // Anführungszeichen mitten im Text (nicht vor , : } ]) → escapen
        const nx = t.slice(k + 1).match(/^\s*(.)/)?.[1];
        if (nx && !',:}]'.includes(nx)) { out += '\\"'; continue; }
        inStr = false; out += ch; continue;
      }
      if (ch === '\n') { out += '\\n'; continue; } if (ch === '\r' || ch === '\t') { out += ' '; continue; }
      out += ch; continue;
    }
    if (ch === '/' && t[k + 1] === '/') { while (k < t.length && t[k] !== '\n') k++; continue; }   // //-Kommentare
    if (ch === '/' && t[k + 1] === '*') { k = t.indexOf('*/', k + 2); if (k < 0) break; k++; continue; }
    if (ch === '"') {
      const prev = out.replace(/\s+$/, '').slice(-1);
      if (prev && '"}]0123456789el'.includes(prev)) out += ',';   // fehlendes Komma vor neuem Wert/Schlüssel
      inStr = true; out += ch; continue;
    }
    if (ch === '{' || ch === '[') { const prev = out.replace(/\s+$/, '').slice(-1); if (prev && '"}]'.includes(prev)) out += ','; stack.push(ch); out += ch; continue; }
    if (ch === '}' || ch === ']') { out = out.replace(/,\s*$/, ''); stack.pop(); out += ch; if (!stack.length) break; continue; }
    out += ch;
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, '');
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
