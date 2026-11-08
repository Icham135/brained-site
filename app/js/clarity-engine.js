// Clarity – Engine (reine Funktionen, ohne DOM und ohne KI): Textaufteilung, Notensysteme, Konzept-Rechnung (Gewicht, Prognose, Ersparnis),
// Baustein-Auswertung, Etappenkette, Vorprüfung/Reparatur von Bausteinen, Kapitel-Erkennung, Prüfungshilfen, Kosten.
// Datenmodell: docs/CLARITY-BAUPLAN.md §6/§7 und docs/CLARITY-BLOECKE.md. Prozentwerte sind überall 0..100, Beherrschung m ist 0..1.
import { SCALES } from './grades.js';

const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isNum = x => typeof x === 'number' && isFinite(x);
const str = x => typeof x === 'string' ? x.trim() : '';
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

/* ---------------------------------- Textaufteilung (Chunking) ---------------------------------- */
export const CHUNK_CHARS = 2800;   // ≈ 700 Token
const OVERLAP = 0.1;
const isHeading = l => { const t = l.trim(); return t.length > 2 && t.length < 80 && !/[.!?;,]$/.test(t) && (/^(\d+(\.\d+)*[.)]?\s+\S|[A-ZÄÖÜ][A-ZÄÖÜ0-9\s\-:]{3,}$|kapitel|abschnitt|lektion)/i.test(t) || /^#{1,4}\s/.test(t)); };
const tail = (txt, n) => { if (txt.length <= n) return txt; const s = txt.slice(-n); const i = s.search(/[.!?]\s+\S/); return (i >= 0 ? s.slice(i + 2) : s).trim(); };

// pages: [{ n, text }] → [{ id, src, page, pageTo, heading, text }]
export function chunkPages(pages, src = 's1') {
  const units = [];   // { page, heading, text }
  let heading = '';
  for (const p of pages || []) {
    const paras = String(p.text || '').replace(/\r/g, '').split(/\n{2,}|\n(?=\s*(?:\d+(?:\.\d+)*[.)]?\s+\S|#{1,4}\s))/);
    for (const raw of paras) {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      if (lines.length && isHeading(lines[0])) { heading = lines[0].replace(/^#+\s*/, ''); lines.shift(); }
      const text = lines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) units.push({ page: p.n, heading, text });
    }
  }
  const out = []; let cur = null;
  const flush = () => { if (cur && cur.text.trim().length > 20) out.push(cur); cur = null; };
  for (const u of units) {
    // lange Absätze satzweise teilen
    const parts = u.text.length > CHUNK_CHARS ? (u.text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [u.text]) : [u.text];
    for (const part of parts) {
      if (cur && (cur.text.length + part.length > CHUNK_CHARS || (u.heading !== cur.heading && cur.text.length > CHUNK_CHARS * 0.5))) {
        const carry = tail(cur.text, Math.round(CHUNK_CHARS * OVERLAP)); flush();
        cur = { src, page: u.page, heading: u.heading, text: carry };
      }
      if (!cur) cur = { src, page: u.page, heading: u.heading, text: '' };
      cur.text += (cur.text ? ' ' : '') + part.trim();
      cur.pageTo = u.page;
    }
  }
  flush();
  return out.map((c, i) => ({ id: `c${i + 1}`, src: c.src, page: c.page, pageTo: c.pageTo ?? c.page, heading: c.heading, text: c.text }));
}

// Grosse Dokumente: Seiten (ganze Seiten, in Reihenfolge) zu Batches bis maxChars. Eine zu lange Seite wird an Satzgrenzen geteilt.
// breaks (optional): Seitenzahlen, bei denen ein neuer Batch beginnen muss (z. B. Kapitelanfänge aus detectChapters).
// → [{ id, from, to, pages:[{n,text}], chars }]
export function splitIntoBatches(pages, maxChars = 12000, breaks = []) {
  const max = Math.max(500, Number(maxChars) || 12000), brk = new Set((breaks || []).map(Number));
  const out = []; let cur = null;
  const flush = () => { if (cur && cur.pages.length) out.push(cur); cur = null; };
  const add = (n, text) => {
    if (!cur) cur = { pages: [], chars: 0, from: n, to: n };
    cur.pages.push({ n, text }); cur.chars += text.length; cur.to = n;
  };
  for (const p of [...(pages || [])].sort((a, b) => a.n - b.n)) {
    const text = String(p.text || '');
    if (cur && brk.has(p.n)) flush();
    if (text.length > max) {   // Riesenseite: in Stücke an Satzgrenzen
      flush();
      for (const piece of (text.match(/[\s\S]{1,}?(?:[.!?]\s+|$)/g) || [text]).reduce((acc, s) => { const l = acc[acc.length - 1]; if (l !== undefined && l.length + s.length <= max) acc[acc.length - 1] += s; else acc.push(s.length > max ? s.slice(0, max) : s); return acc; }, [])) { add(p.n, piece); flush(); }
      continue;
    }
    if (cur && cur.chars + text.length > max) flush();
    add(p.n, text);
  }
  flush();
  return out.map((b, i) => ({ id: `b${i + 1}`, ...b }));
}

// Kapitel lokal erkennen (Überschriften wie «Kapitel 3», «2 Titel», «# Titel»); sonst gleichmässig nach Seiten.
// → [{ id, title, from, to, pages }] lückenlos von der ersten bis zur letzten Seite
const CHAPTER_RE = /^(?:kapitel|chapter|chapitre|capitolo|teil|lektion|modul|unit|abschnitt)\s+(?:\d+|[ivxlc]+)\b[\s.:–-]*(.*)$/i;
const NUMBERED_RE = /^(\d{1,2})[.)]?\s+([A-ZÄÖÜ][^\n]{2,70})$/;
const MD_RE = /^#{1,2}\s+(.{2,70})$/;
const MAX_CHAPTER_PAGES = 40;
export function detectChapters(pages) {
  const ps = [...(pages || [])].sort((a, b) => a.n - b.n);
  if (!ps.length) return [];
  const found = [];   // { n, title }
  for (const p of ps) {
    const lines = String(p.text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    const hits = [];
    for (const l of lines) {
      if (l.length > 80 || /\.{3,}|…/.test(l) || /\s\d{1,4}$/.test(l) && /^(kapitel|chapter|\d)/i.test(l) && l.length > 25) continue;   // Inhaltsverzeichnis-Zeilen
      let t = null, m;
      if ((m = l.match(CHAPTER_RE))) { if (!/\s\d{1,4}$/.test(m[1])) t = l; }
      else if ((m = l.match(MD_RE))) t = m[1];
      else if ((m = l.match(NUMBERED_RE)) && !/[.!?;,:]$/.test(m[2]) && !/\s\d{1,4}$/.test(m[2]) && !/^\d+\s+\d/.test(l)) t = l;
      if (t) hits.push(t.replace(/\s+/g, ' ').trim());
    }
    if (hits.length > 6) continue;   // sieht nach Inhaltsverzeichnis aus
    if (hits.length) found.push({ n: p.n, title: hits[0] });
  }
  const first = ps[0].n, last = ps.at(-1).n;
  let starts = found.filter((f, i) => i === 0 || f.title !== found[i - 1].title);
  if (starts.length && starts[0].n !== first) starts.unshift({ n: first, title: 'Einleitung' });
  // zu kleine Kapitel (< 2 Seiten) dem vorherigen zuschlagen
  starts = starts.filter((s, i) => i === 0 || (starts[i + 1] ? starts[i + 1].n : last + 1) - s.n >= 2 || s.n === last);
  const total = ps.length;
  if (!starts.length) {   // keine brauchbare Gliederung: gleichmässig teilen (kleine Dokumente = 1 Kapitel)
    const per = total <= 30 ? total : Math.ceil(total / Math.ceil(total / 30));
    starts = [];
    for (let i = 0; i < total; i += per) starts.push({ n: ps[i].n, title: total <= 30 ? 'Gesamtes Dokument' : `Seiten ${ps[i].n}–${ps[Math.min(i + per, total) - 1].n}` });
  }
  // Bereiche bilden; sehr lange Kapitel in Teile von höchstens 40 Seiten
  const out = [];
  starts.forEach((s, i) => {
    const to = i + 1 < starts.length ? starts[i + 1].n - 1 : last;
    const inRange = ps.filter(p => p.n >= s.n && p.n <= to);
    if (!inRange.length) return;
    const k = Math.ceil(inRange.length / MAX_CHAPTER_PAGES), per = Math.ceil(inRange.length / k);
    for (let j = 0; j < k; j++) {
      const sl = inRange.slice(j * per, (j + 1) * per);
      out.push({ title: k > 1 ? `${s.title} (Teil ${j + 1})` : s.title, from: sl[0].n, to: j === k - 1 ? to : sl.at(-1).n, pages: sl.length });
    }
  });
  if (out.length) out[0].from = first;
  return out.map((c, i) => ({ id: `ch${i + 1}`, ...c }));
}

/* ---------------------------------- Aufgaben auswerten (Grundbausteine) ---------------------------------- */
export const norm = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Lücke: Alternativen mit | ; kleine Tippfehler erlaubt (Distanz ≤ 1 ab 5 Zeichen)
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
export function blankOk(given, sol) {
  const g = norm(given); if (!g) return false;
  return String(sol).split('|').some(alt => { const s = norm(alt); return !!s && (g === s || (s.length >= 5 && lev(g, s) <= 1)); });
}
// Zahl mit Einheit/Komma vergleichen (relative Toleranz, Standard 1 %); Text-Antworten über blankOk
export const parseNum = x => { const m = String(x ?? '').replace(/[’'\s]/g, '').replace(',', '.').replace('−', '-').match(/-?\d+(\.\d+)?(e-?\d+)?/i); return m ? parseFloat(m[0]) : NaN; };
export function numEq(given, sol, tol = 0.01) {
  const g = parseNum(given), s = parseNum(sol);
  if (isNaN(s)) return blankOk(given, sol);
  if (isNaN(g)) return false;
  return Math.abs(g - s) <= Math.max(Math.abs(s) * (tol ?? 0.01), s === 0 ? 1e-9 : 0);
}
export const blanksIn = t => (String(t || '').match(/___/g) || []).length;
// Mischt 0..n-1 deterministisch aus einem Seed (stabil über Neuzeichnen)
export function seedShuffle(n, seed = 1) {
  const a = Array.from({ length: n }, (_, i) => i); let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a.every((x, i) => x === i)) a.push(a.shift());
  return a;
}
export const hashStr = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/* ---------------------------------- Notensysteme ---------------------------------- */
// GRADING[land].scales[skala]: best/worst (Richtung), passGrade (schlechteste noch bestandene Note), step, target (Standard-Zielnote), options (wählbare Zielnoten, beste zuletzt/zuerst nach Richtung)
const CH_TEXT = g => g >= 6 ? 'ausgezeichnet' : g >= 5.5 ? 'sehr gut' : g >= 5 ? 'gut' : g >= 4.5 ? 'befriedigend' : g >= 4 ? 'genügend' : g >= 3.5 ? 'knapp ungenügend' : g >= 3 ? 'ungenügend' : g >= 2 ? 'schwach' : 'sehr schwach';
const range = (a, b, st) => { const o = []; for (let g = a; st > 0 ? g <= b + 1e-9 : g >= b - 1e-9; g = r1(g + st)) o.push(g); return o; };
// Untergrenzen in Prozent je Punktzahl 0–15 (15 = ab 95 %, ab 5 Punkten = 45 % bestanden)
const P15 = [0, 20, 27, 33, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const DE_BANDS = SCALES.DE.bands.map(([min, g, text]) => [min * 100, g, text]);
const AT_BANDS = SCALES.AT.bands.map(([min, g, text]) => [min * 100, g, text]);
export const GRADING = {
  CH: { name: 'Schweiz', flag: '🇨🇭', defaultScale: '1-6', scales: { '1-6': { label: '1–6 (ab 4.0 genügend)', best: 6, worst: 1, passGrade: 4, step: 0.1, target: 5, decimals: 1, options: range(4, 6, 0.5) } } },
  DE: { name: 'Deutschland', flag: '🇩🇪', defaultScale: '1-6', scales: {
    '1-6': { label: '1–6 (1 beste)', best: 1, worst: 6, passGrade: 4, step: 1, target: 2, decimals: 0, options: [1, 2, 3, 4] },
    '0-15': { label: '0–15 Punkte (15 beste)', best: 15, worst: 0, passGrade: 5, step: 1, target: 11, decimals: 0, options: range(5, 15, 1) } } },
  AT: { name: 'Österreich', flag: '🇦🇹', defaultScale: '1-5', scales: { '1-5': { label: '1–5 (1 beste, ab 4 genügend)', best: 1, worst: 5, passGrade: 4, step: 1, target: 2, decimals: 0, options: [1, 2, 3, 4] } } },
};
// Land/Skala säubern (unbekanntes → CH bzw. Standard-Skala des Landes)
export function gradingOf(country, scale) {
  const c = GRADING[country] ? country : 'CH', g = GRADING[c];
  const s = g.scales[scale] ? scale : g.defaultScale;
  return { country: c, scale: s, ...g.scales[s], name: g.name, flag: g.flag };
}
export const higherIsBetter = (country, scale) => { const g = gradingOf(country, scale); return g.best > g.worst; };
// Ist Note a besser als (oder gleich) Note b?
export const isBetterOrEqual = (country, scale, a, b) => higherIsBetter(country, scale) ? a >= b - 1e-9 : a <= b + 1e-9;

// Prozent (0..100) → Note im gewählten System
export function percentToGrade(country, scale, pct) {
  const g = gradingOf(country, scale), p = clamp(Number(pct) || 0, 0, 100);
  if (g.country === 'CH') return clamp(r1(1 + 5 * p / 100), 1, 6);
  if (g.country === 'AT') return AT_BANDS.find(([min]) => p >= min - 1e-9)[1];
  if (g.scale === '0-15') { let pt = 0; P15.forEach((min, i) => { if (p >= min - 1e-9) pt = i; }); return pt; }
  return DE_BANDS.find(([min]) => p >= min - 1e-9)[1];
}
// Umkehr: Note → benötigter Prozentwert (0..100); bei Stufensystemen die Untergrenze der Stufe
export function gradeToPercent(country, scale, grade) {
  const g = gradingOf(country, scale), v = Number(grade);
  if (!isFinite(v)) return 0;
  if (g.country === 'CH') return clamp(r1((v - 1) / 5 * 100), 0, 100);
  if (g.country === 'AT') return (AT_BANDS.find(([, gr]) => gr === Math.round(clamp(v, 1, 5))) || AT_BANDS.at(-1))[0];
  if (g.scale === '0-15') return P15[clamp(Math.round(v), 0, 15)];
  return (DE_BANDS.find(([, gr]) => gr === Math.round(clamp(v, 1, 6))) || DE_BANDS.at(-1))[0];
}
export function passes(country, scale, grade) {
  const g = gradingOf(country, scale), v = Number(grade);
  if (!isFinite(v)) return false;
  return g.best > g.worst ? v >= g.passGrade - 1e-9 : v <= g.passGrade + 1e-9;
}
export const defaultTarget = (country, scale) => gradingOf(country, scale).target;
export function formatGrade(country, scale, grade) {
  const g = gradingOf(country, scale), v = Number(grade);
  if (!isFinite(v)) return '–';
  return g.decimals ? v.toFixed(g.decimals) : String(Math.round(v));
}
export function gradeLabel(country, scale, grade) {
  const g = gradingOf(country, scale), v = Number(grade);
  if (!isFinite(v)) return '';
  if (g.country === 'CH') return CH_TEXT(passes('CH', '1-6', v) ? Math.round(v * 2) / 2 : Math.min(Math.round(v * 2) / 2, 3.5));   // unter 4.0 nie «genügend»
  if (g.country === 'AT') return (AT_BANDS.find(([, gr]) => gr === Math.round(clamp(v, 1, 5))) || AT_BANDS.at(-1))[2];
  if (g.scale === '0-15') { const x = Math.round(clamp(v, 0, 15)); return x >= 13 ? 'sehr gut' : x >= 10 ? 'gut' : x >= 7 ? 'befriedigend' : x >= 4 ? 'ausreichend' : x >= 1 ? 'mangelhaft' : 'ungenügend'; }
  return (DE_BANDS.find(([, gr]) => gr === Math.round(clamp(v, 1, 6))) || DE_BANDS.at(-1))[2];
}
export const swissGrade = (earned, max) => max ? Math.max(1, Math.min(6, Math.round((1 + 5 * (earned / max)) * 10) / 10)) : 1;

/* ---------------------------------- Konzepte: Gewicht, Beherrschung, Fortschritt, Prognose ---------------------------------- */
// Gewichte auf ganze Zahlen mit Summe genau 100 bringen (jedes ≥ 1; bei mehr als 100 Konzepten bekommen nur die ersten 100 je 1).
// Ändert die Konzepte direkt (weightPercent) und gibt dieselbe Liste zurück.
export function normalizeWeights(concepts) {
  const cs = concepts || [], n = cs.length;
  if (!n) return cs;
  if (n > 100) {   // sehr viele Konzepte (grosser Stoff): Anteile mit einer Nachkommastelle, Summe genau 100.0 (grösster Rest)
    const raw = cs.map(c => Math.max(0, Number(c.weightPercent) || 0)), sum = raw.reduce((a, b) => a + b, 0) || 0, q = raw.map(x => (sum > 0 ? x / sum : 1 / n) * 1000);
    const fl = q.map(Math.floor); let rest = 1000 - fl.reduce((a, b) => a + b, 0);
    q.map((x, i) => ({ i, r: x - fl[i] })).sort((a, b) => b.r - a.r || a.i - b.i).forEach(({ i }) => { if (rest-- > 0) fl[i]++; });
    cs.forEach((c, i) => { c.weightPercent = fl[i] / 10; }); return cs;
  }
  let raw = cs.map(c => Math.max(0, Number(c.weightPercent) || 0));
  let sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) { raw = raw.map(() => 1); sum = n; }
  const exact = raw.map(w => w / sum * 100), w = exact.map(x => Math.max(1, Math.floor(x)));
  let diff = 100 - w.reduce((a, b) => a + b, 0);
  const byRem = () => exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[1]);
  for (let guard = 0; diff > 0 && guard < 1000; guard++) { for (const i of byRem()) { if (diff <= 0) break; w[i]++; diff--; } }
  for (let guard = 0; diff < 0 && guard < 1000; guard++) {   // zu viel: vom grössten Gewicht (über 1) abziehen
    let k = -1; w.forEach((x, i) => { if (x > 1 && (k < 0 || x > w[k])) k = i; });
    if (k < 0) break; w[k]--; diff++;
  }
  cs.forEach((c, i) => { c.weightPercent = w[i]; });
  return cs;
}

/* ---------------------------------- Lernzeit: eine Formel für alle Anzeigen ---------------------------------- */
// Die Lernzeit folgt der Stoffmenge. Ein Konzept (= eine Etappe) bekommt aus seinem Text eine Ziel-Lernzeit; daraus baut stagePlan() die Kette der
// Bausteine, und die tatsächliche Dauer ist die Summe der Baustein-Zeiten. Dashboard («Noch offen»), «Geschätzte Ersparnis», Etappenliste, Home-Karte,
// Swipe-Karte und Prognose-Rechnung lesen alle dieselben Funktionen (minutesFor / stageMinutes). Zahlen nur hier ändern.
// Stärkeres Modell (Claude statt Gratis-KI): ohne Code-Änderung tiefer lernen = wordsPerMin senken (mehr Zeit je Seite → mehr Bausteine), maxRounds und
// stageMax erhöhen; die Aufgaben je Baustein (Fragen, Lücken, Paare) begrenzen validateBlock/PART_DEF in clarity-ai.js, mehr Tiefe kommt über mehr Bausteine.
export const STUDY = {
  wordsPerMin: 110,      // Wörter Quelltext pro Lernminute (Lesen + Üben); 350 Wörter/Seite → ca. 3.2 Min. je Seite
  pageWords: 350,        // Wörter je Seite, wenn nur die Seitenzahl bekannt ist
  complexity: { basis: 0.85, mittel: 1, komplex: 1.3 },   // Faktor Komplexität
  weightSpread: 0.2,     // Gewicht relativ zum Durchschnitt (0.5–2) verschiebt die Zeit um höchstens ±20 %
  calcFactor: 1.15,      // Rechenstoff braucht länger
  minConcept: 5,         // kürzeste Etappe (Minuten)
  stageMax: 30,          // längste einzelne Etappe; Konzepte mit mehr Zeit werden in Teile geteilt
  stageTarget: 22,       // Zielgrösse der Teile beim Teilen
  checkShare: 0.6,       // Kurz-Check («Unsicher») braucht 60 % der Zeit
  maxRounds: 4,          // höchstens so viele Durchgänge (Wiederholungen der Bausteine) je Etappe
};
// Minuten je Baustein (Lesen, Antworten, Erklärung lesen): Essenz 4–6 Punkte, MC 3 Fragen, Lücken 3–5, Paare 4–6, offene Frage, Rechenaufgabe
export const BLOCK_MIN = { ESSENCE_AND_TRAP: 2, MULTIPLE_CHOICE: 3, CLOZE_TEXT: 2, MATCHING_AND_ORDER: 2, OPEN_QUESTION_VOICE: 3, STEP_CALCULATION: 3 };
const DEFAULT_MIN = { basis: 5, mittel: 7, komplex: 12 };   // ohne Angabe: nach Komplexität
const CANON = ['ESSENCE_AND_TRAP', 'MULTIPLE_CHOICE', 'STEP_CALCULATION', 'CLOZE_TEXT', 'MATCHING_AND_ORDER', 'OPEN_QUESTION_VOICE'];   // Reihenfolge innerhalb eines Durchgangs
const REPEAT_SEQ = ['MULTIPLE_CHOICE', 'STEP_CALCULATION', 'CLOZE_TEXT', 'OPEN_QUESTION_VOICE', 'MATCHING_AND_ORDER'];   // Priorität: was zuerst in die Kette kommt

// Wörter eines Konzepts (oder Seiten × pageWords) → Etappen-Lernminuten. Immer ≥ minConcept; wächst monoton mit der Textmenge.
export function estimateStudyMinutes(o) {
  const { words, pages, complexity, weightRel = 1, needsCalc = false } = o || {};
  const w = isNum(words) && words > 0 ? words : (isNum(pages) && pages > 0 ? pages : 0) * STUDY.pageWords;
  const cx = STUDY.complexity[complexity] ?? 1, wf = 1 + STUDY.weightSpread * (clamp(isNum(weightRel) ? weightRel : 1, 0.5, 2) - 1);
  const raw = w / STUDY.wordsPerMin * cx * wf * (needsCalc ? STUDY.calcFactor : 1);
  const p = planItems(raw, needsCalc, false).minutes;
  return raw > p + 1.5 ? Math.round(raw) : p;   // über der längsten Kette (maxRounds) bleibt die Rohzahl: der Aufrufer teilt das Konzept (splitByWords)
}
// Kette (Liste von { type, round }) für eine Ziel-Lernzeit: Präfix einer festen Prioritätsfolge, solange die Zeit (auf halbe Baustein-Länge gerundet) passt.
// Durchgang 0 beginnt mit der Essenz (ausser Kurz-Check); weitere Durchgänge wiederholen die Übungsbausteine mit anderem Stoffabschnitt.
function planItems(target, needsCalc, check) {
  const first = [...(check ? [] : ['ESSENCE_AND_TRAP']), ...REPEAT_SEQ], seq = [];
  for (let r = 0; r < STUDY.maxRounds; r++) for (const t of (r ? REPEAT_SEQ : first)) if (needsCalc || t !== 'STEP_CALCULATION') seq.push({ type: t, round: r });
  let acc = 0; const got = [];
  for (const it of seq) {
    const m = BLOCK_MIN[it.type];
    if (got.length >= (check ? 1 : 2) && acc + m / 2 > target) break;   // mindestens 2 Bausteine (Kurz-Check: 1)
    got.push(it); acc += m;
  }
  got.sort((a, b) => a.round - b.round || CANON.indexOf(a.type) - CANON.indexOf(b.type));
  return { items: got, minutes: Math.round(acc) };
}
// Ziel-Lernzeit des Konzepts bei vollem Lernen (estimatedMinutes, sonst nach Komplexität)
const targetOf = c => { const m = Number(c?.estimatedMinutes); return m > 0 ? m : (DEFAULT_MIN[c?.complexity] || DEFAULT_MIN.mittel); };
// → { items:[{type,round}], types:[…], rounds, minutes }; triage 'check' = Kurz-Check (ohne Essenz, 60 % der Zeit), sonst volle Etappe
export function stagePlan(concept, triage = concept?.triage) {
  const check = triage === 'check', p = planItems(targetOf(concept) * (check ? STUDY.checkShare : 1), !!concept?.needsCalc, check);
  return { ...p, types: p.items.map(i => i.type), rounds: p.items.reduce((n, i) => Math.max(n, i.round + 1), 0) };
}
// Volle Etappe in Minuten (Grundlage für Ersparnis und Gesamtstoff)
export const minutesFor = c => stagePlan(c, 'learn').minutes;
// Dauer der Etappe, wie sie jetzt gespielt wird (Kurz-Check ist kürzer)
export const stageMinutes = c => stagePlan(c).minutes;
// Gesamter Stoff ohne Vorwissen (alles lernen)
export const totalMinutes = course => (course?.concepts || []).reduce((s, c) => s + minutesFor(c), 0);
// Grosses Konzept (Minuten > stageMax) in k Teile nach Wörtern teilen. ps = [{ n, words }] der Seiten des Konzepts → [{ from, to, words }] (ein Teil, wenn nicht teilbar)
export function splitByWords(ps, minutes) {
  const list = [...(ps || [])].sort((a, b) => a.n - b.n), total = list.reduce((s, p) => s + (p.words || 0), 0);
  const k = clamp(Math.ceil((Number(minutes) || 0) / STUDY.stageTarget), 1, list.length || 1);
  if (!list.length || minutes <= STUDY.stageMax || k < 2) return list.length ? [{ from: list[0].n, to: list.at(-1).n, words: total }] : [];
  const out = []; let cur = null, acc = 0;
  for (const p of list) {
    if (!cur) cur = { from: p.n, to: p.n, words: 0 };
    cur.to = p.n; cur.words += p.words || 0; acc += p.words || 0;
    if (out.length < k - 1 && acc >= total / k * (out.length + 1)) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}

// Beherrschung m ∈ [0,1] (§7): known 0.9, check 0.5, learn/offen 0 – sobald es einen echten Stand gibt (score oder Baustein-Punkte), zählt dieser.
const BASE_M = { known: 0.9, check: 0.5, learn: 0 };
export function actualScore(c) {
  if (isNum(c?.score)) return clamp(c.score, 0, 1);
  const sc = Object.values(c?.progress || {}).map(p => p?.score).filter(isNum);
  return sc.length ? clamp(mean(sc), 0, 1) : null;
}
export function masteryOf(c) {
  const real = actualScore(c);
  if (real !== null) return real;
  const base = BASE_M[c?.triage] ?? 0;
  return c?.status === 'done' ? Math.max(base, 0.85) : base;   // erledigt ohne Wertung (z. B. nur gelesen) zählt wie «sitzt»
}
// Anteil erledigter Etappe eines Konzepts 0..1 (known und done = 1)
export function conceptProgress(c) {
  if (!c) return 0;
  if (c.status === 'done' || c.triage === 'known') return 1;
  const total = chainFor(c).length, done = Object.values(c.progress || {}).filter(p => p?.done).length;
  return total ? clamp(done / total, 0, 0.99) : 0;
}
const concepts = course => course?.concepts || [];
// Gewichte als Anteile (Summe 1); sind alle 0, zählt jedes gleich
function shares(course) {
  const cs = concepts(course), w = cs.map(c => Math.max(0, Number(c.weightPercent) || 0)), sum = w.reduce((a, b) => a + b, 0);
  return cs.map((c, i) => [c, sum > 0 ? w[i] / sum : 1 / cs.length]);
}
const sumBy = (course, f) => shares(course).reduce((s, [c, w]) => s + w * f(c), 0);
export const weightedProgress = course => r1(100 * sumBy(course, conceptProgress));
export const coverageOf = course => r1(100 * sumBy(course, c => c.triage === 'known' || c.status === 'done' ? 1 : 0));
export const savedMinutes = course => Math.round(concepts(course).reduce((s, c) => s + (c.triage === 'known' ? minutesFor(c) : c.triage === 'check' ? minutesFor(c) - stageMinutes(c) : 0), 0));
export function remainingMinutes(course) {
  return Math.round(concepts(course).reduce((s, c) => c.status === 'done' || c.triage === 'known' ? s : s + stageMinutes(c) * (1 - conceptProgress(c)), 0));
}
export function formatDuration(min) {
  const m = Math.max(0, Math.round(Number(min) || 0)), h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h} Std. ${r} Min.` : h ? `${h} Std.` : `${r} Min.`;
}
// Noten-Prognose (§7): jetzt = Σ Gewicht × m, bei Abschluss = Σ Gewicht × max(m, 0.85)
export function gradePrognosis(course) {
  const { country, scale } = gradingOf(course?.grading?.country, course?.grading?.scale);
  const pctNow = r1(100 * sumBy(course, masteryOf)), pctFinish = r1(100 * sumBy(course, c => Math.max(masteryOf(c), 0.85)));
  const now = percentToGrade(country, scale, pctNow), atFinish = percentToGrade(country, scale, pctFinish);
  const tag = country === 'DE' && scale === '0-15' ? 'DE 0–15' : country;
  return { now, atFinish, pctNow, pctFinish, label: `Aktuell ~${formatGrade(country, scale, now)} ➔ bei Abschluss ~${formatGrade(country, scale, atFinish)} (${tag})` };
}
// Konzepte in Modul-Reihenfolge (Module nach order, darin conceptIds; Konzepte ohne Modul am Ende)
export function orderedConcepts(course) {
  const by = new Map(concepts(course).map(c => [c.id, c])), seen = new Set(), out = [];
  for (const m of [...(course?.modules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) for (const id of m.conceptIds || []) { const c = by.get(id); if (c && !seen.has(id)) { seen.add(id); out.push(c); } }
  for (const c of concepts(course)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
  return out;
}
// Nächstes Konzept: angefangene zuerst, dann «Muss ich lernen» (und noch nicht eingestufte), zuletzt «Kurz-Check»; known/done nie
export function nextConcept(course) {
  const open = orderedConcepts(course).filter(c => c.triage !== 'known' && c.status !== 'done');
  return open.find(c => c.status === 'inprogress') || open.find(c => c.triage !== 'check') || open[0] || null;
}
// → [{ id, title, order, concepts:[…], total, done, progress (0..100, gewichtet im Modul), weightPercent, minutes (Rest), status:'open'|'inprogress'|'done' }]
export function modulesOf(course) {
  const all = orderedConcepts(course), by = new Map(all.map(c => [c.id, c])), used = new Set();
  const mk = (m, cs) => {
    const w = cs.reduce((s, c) => s + (Number(c.weightPercent) || 0), 0), eq = !w;
    const prog = cs.length ? cs.reduce((s, c) => s + (eq ? 1 : Number(c.weightPercent) || 0) * conceptProgress(c), 0) / (eq ? cs.length : w) : 0;
    const done = cs.filter(c => c.status === 'done' || c.triage === 'known').length;
    return { id: m.id, title: m.title, order: m.order ?? 0, concepts: cs, total: cs.length, done, progress: r1(prog * 100), weightPercent: w, minutes: remainingMinutes({ concepts: cs }),
      status: cs.length && done === cs.length ? 'done' : cs.some(c => c.status === 'inprogress' || conceptProgress(c) > 0 && c.triage !== 'known') ? 'inprogress' : 'open' };
  };
  const mods = [...(course?.modules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(m => {
    const cs = []; for (const id of m.conceptIds || []) { const c = by.get(id); if (c && !used.has(id)) { used.add(id); cs.push(c); } } return mk(m, cs);
  });
  const rest = all.filter(c => !used.has(c.id));
  if (rest.length) mods.push(mk({ id: '_rest', title: 'Weitere Konzepte', order: 999 }, rest));
  return mods;
}

/* ---------------------------------- Bausteine auswerten (je 0..1, mit Teilpunkten) ---------------------------------- */
const at = (a, i) => Array.isArray(a) ? a[i] : a && typeof a === 'object' ? a[i] : undefined;
export function gradeMC(items, answers) {
  const it = items || [];
  return it.length ? it.filter((q, i) => Number(at(answers, i)) === q.correct && at(answers, i) !== null && at(answers, i) !== '').length / it.length : 0;
}
export function gradeCloze(content, answers) {
  const sol = content?.answers || [];
  return sol.length ? sol.filter((s, k) => blankOk(at(answers, k), s)).length / sol.length : 0;
}
// Paare: answers[i] = gewählte rechte Seite zu links i (richtig, wenn == i). mode 'order' geht an gradeOrder.
export function gradeMatching(content, answers) {
  if (content?.mode === 'order') return gradeOrder(content, answers);
  const n = (content?.pairs || []).length;
  return n ? content.pairs.filter((_, i) => { const a = at(answers, i); return a !== null && a !== undefined && a !== '' && Number(a) === i; }).length / n : 0;
}
// answerList = Indizes der Items in der Reihenfolge des Lernenden (richtig, wenn Stelle i das Item i enthält)
export function gradeOrder(content, answerList) {
  const n = (content?.items || []).length, a = Array.isArray(answerList) ? answerList : Array.isArray(answerList?.list) ? answerList.list : [];
  return n ? Array.from({ length: n }, (_, i) => Number(a[i]) === i && a[i] !== null && a[i] !== '' ? 1 : 0).reduce((s, x) => s + x, 0) / n : 0;
}
// answers = { formula:Index, givens:[Indizes aus givens+extraGivens, die benutzt werden], result:'12,5', unit?:'m/s' }; fehlende Teile zählen nicht mit
const CALC_W = { formula: 0.3, givens: 0.3, result: 0.4 };
export function gradeCalc(content, answers) {
  const c = content || {}, A = answers || {}, parts = [];
  if (A.formula !== undefined && A.formula !== null && A.formula !== '') parts.push([CALC_W.formula, Number(A.formula) === c.correctFormula ? 1 : 0]);
  if (Array.isArray(A.givens)) {
    const need = (c.givens || []).length, picked = new Set(A.givens.map(Number)), right = [...picked].filter(i => i >= 0 && i < need).length, wrong = picked.size - right;
    parts.push([CALC_W.givens, need ? clamp((right - wrong) / need, 0, 1) : (picked.size ? 0 : 1)]);
  }
  if (A.result !== undefined && A.result !== null && String(A.result).trim() !== '') {
    const r = c.result || {}, ok = isNum(r.value) && numEq(A.result, r.value, isNum(r.tol) && r.tol > 0 ? r.tol : 0.01);
    const typed = A.unit ?? String(A.result).replace(/^[\s\d.,'’−+-]*(?:e-?\d+)?/i, ''), unitOk = !r.unit || !norm(typed) || norm(typed).replace(/ /g, '') === norm(r.unit).replace(/ /g, '');
    parts.push([CALC_W.result, ok ? (unitOk ? 1 : 0.5) : 0]);
  }
  if (!parts.length) return 0;
  const w = parts.reduce((s, p) => s + p[0], 0);
  return parts.reduce((s, p) => s + p[0] * p[1], 0) / w;
}
// Punkte eines Bausteins 0..1; null = nicht automatisch bewertet (Essenz, offene Frage ohne KI-Wertung)
export function blockScore(block, answers) {
  const c = block?.content || {};
  switch (block?.type) {
    case 'MULTIPLE_CHOICE': return gradeMC(c.items, answers);
    case 'CLOZE_TEXT': return gradeCloze(c, answers);
    case 'MATCHING_AND_ORDER': return c.mode === 'order' ? gradeOrder(c, answers) : gradeMatching(c, answers);
    case 'STEP_CALCULATION': return gradeCalc(c, answers);
    case 'OPEN_QUESTION_VOICE': return isNum(answers?.points) ? clamp(answers.points, 0, 1) : null;
    default: return null;
  }
}

/* ---------------------------------- Etappe: Kette, Vorprüfung, Reparatur ---------------------------------- */
export const BLOCK_TYPES = ['ESSENCE_AND_TRAP', 'MULTIPLE_CHOICE', 'CLOZE_TEXT', 'MATCHING_AND_ORDER', 'OPEN_QUESTION_VOICE', 'STEP_CALCULATION'];
// Reihenfolge der Bausteine aus der Zeitplanung (stagePlan): kurze Etappen haben 2–5 Bausteine, lange mehrere Durchgänge. check lässt ESSENCE weg,
// needsCalc fügt STEP_CALCULATION nach MC ein. Typen können mehrfach vorkommen (ein Eintrag je Durchgang).
export const chainFor = concept => stagePlan(concept).types;
// Wie chainFor, aber mit Durchgang: [{ type, round }]
export const chainPlan = concept => stagePlan(concept).items;
// Formel-Text sauber? (Anführungszeichen $ paarig, Klammern ausgeglichen, kein HTML)
export function formulaProblem(f) {
  const s = String(f ?? '');
  if (!s.trim()) return 'leer';
  if (/<\/?[a-z][^>]*>/i.test(s)) return 'HTML';
  if ((s.replace(/\\\$/g, '').match(/\$/g) || []).length % 2) return '$ nicht paarig';
  let d = 0; for (const ch of s.replace(/\\[{}]/g, '')) { if (ch === '{') d++; else if (ch === '}') d--; if (d < 0) break; }
  if (d !== 0) return 'Klammern { } nicht ausgeglichen';
  if (/\\(?:left|right)/.test(s) && (s.match(/\\left/g) || []).length !== (s.match(/\\right/g) || []).length) return '\\left/\\right nicht paarig';
  return '';
}
const strs = (a, n) => Array.isArray(a) && (n == null || a.length === n) && a.every(x => typeof x === 'string');
const uniq = a => new Set(a.map(norm)).size === a.length;
export function validateBlock(block) {
  const p = [], add = m => p.push(m);
  if (!block || typeof block !== 'object') return { ok: false, problems: ['kein Baustein'] };
  const c = block.content;
  if (!BLOCK_TYPES.includes(block.type)) return { ok: false, problems: ['unbekannter Typ'] };
  if (!c || typeof c !== 'object') return { ok: false, problems: ['Inhalt fehlt'] };
  switch (block.type) {
    case 'ESSENCE_AND_TRAP': {
      const pts = c.points;
      if (!Array.isArray(pts) || pts.length < 4 || pts.length > 6) add('4–6 Punkte nötig');
      else pts.forEach((x, i) => { if (!str(x?.t)) add(`Punkt ${i + 1} ohne Text`); });
      if (!str(c.trap?.text)) add('Prüfungsfalle fehlt');
      if (c.formulas !== undefined) { if (!Array.isArray(c.formulas)) add('formulas keine Liste'); else c.formulas.forEach((f, i) => { const q = formulaProblem(f); if (q) add(`Formel ${i + 1}: ${q}`); }); }
      break;
    }
    case 'MULTIPLE_CHOICE': {
      const it = c.items;
      if (!Array.isArray(it) || it.length < 2 || it.length > 3) add('2–3 Fragen nötig');
      else it.forEach((q, i) => {
        const k = `Frage ${i + 1}`;
        if (!str(q?.q)) add(`${k} ohne Text`);
        if (!strs(q?.options, 4) || q.options.some(o => !o.trim())) add(`${k}: genau 4 Optionen nötig`);
        else if (!uniq(q.options)) add(`${k}: doppelte Optionen`);
        if (!Number.isInteger(q?.correct) || q.correct < 0 || q.correct > 3) add(`${k}: richtige Option ungültig`);
        if (!strs(q?.why, 4)) add(`${k}: 4 Erklärungen nötig`);
        else if (Number.isInteger(q.correct) && !q.why[q.correct]?.trim()) add(`${k}: Erklärung zur richtigen Option fehlt`);
      });
      break;
    }
    case 'CLOZE_TEXT': {
      const n = blanksIn(c.text), a = c.answers;
      if (!str(c.text)) add('Text fehlt');
      if (n < 3 || n > 5) add('3–5 Lücken nötig');
      if (!Array.isArray(a) || !a.length) add('Antworten fehlen');
      else {
        if (a.length !== n) add(`Lückenzahl (${n}) ≠ Antwortzahl (${a.length})`);
        if (!a.every(x => typeof x === 'string' && x.trim())) add('leere Antwort');
        if (!strs(c.chips) || c.chips.some(x => !x.trim())) add('Chips fehlen');
        else {
          if (!uniq(c.chips)) add('doppelte Chips');
          a.forEach((s, i) => { if (typeof s === 'string' && !c.chips.some(ch => String(s).split('|').some(alt => norm(alt) && norm(alt) === norm(ch)))) add(`Chip für Lücke ${i + 1} fehlt`); });
          if (c.chips.length < a.length) add('weniger Chips als Antworten');
        }
      }
      break;
    }
    case 'MATCHING_AND_ORDER': {
      if (!str(c.prompt)) add('Aufgabentext fehlt');
      if (c.mode === 'pairs') {
        const pr = c.pairs;
        if (!Array.isArray(pr) || pr.length < 4 || pr.length > 6) add('4–6 Paare nötig');
        else {
          if (pr.some(x => !str(x?.l) || !str(x?.r))) add('Paar mit leerer Seite');
          else { if (!uniq(pr.map(x => x.l))) add('doppelte Begriffe'); if (!uniq(pr.map(x => x.r))) add('doppelte Zuordnungen'); }
        }
      } else if (c.mode === 'order') {
        const it = c.items;
        if (!strs(it) || it.length < 4 || it.length > 8) add('mindestens 4 Schritte nötig');
        else { if (it.some(x => !x.trim())) add('leerer Schritt'); else if (!uniq(it)) add('doppelte Schritte'); }
      } else add('Modus muss pairs oder order sein');
      break;
    }
    case 'OPEN_QUESTION_VOICE': {
      if (!str(c.q)) add('Frage fehlt');
      if (!strs(c.keyPoints, 3) || c.keyPoints.some(x => !x.trim())) add('genau 3 Checkpoints nötig');
      if (!str(c.sample)) add('Musterantwort fehlt');
      break;
    }
    case 'STEP_CALCULATION': {
      if (!str(c.task)) add('Aufgabe fehlt');
      const fo = c.formulaOptions;
      if (!strs(fo) || fo.length < 3 || fo.length > 4 || fo.some(x => !x.trim())) add('3–4 Formeln nötig');
      else { fo.forEach((f, i) => { const q = formulaProblem(f); if (q) add(`Formel ${i + 1}: ${q}`); }); if (!uniq(fo)) add('doppelte Formeln'); }
      if (!Number.isInteger(c.correctFormula) || c.correctFormula < 0 || c.correctFormula >= (fo?.length || 0)) add('richtige Formel ungültig');
      if (!Array.isArray(c.givens) || !c.givens.length) add('Grössen fehlen');
      else c.givens.forEach((g, i) => { if (!str(g?.label) || !isNum(g?.value)) add(`Grösse ${i + 1} unvollständig`); });
      if (c.extraGivens !== undefined && (!Array.isArray(c.extraGivens) || c.extraGivens.some(g => !str(g?.label) || !isNum(g?.value)))) add('Ablenker-Grösse unvollständig');
      if (!isNum(c.result?.value)) add('Resultat fehlt');
      else if (c.result.tol !== undefined && !(isNum(c.result.tol) && c.result.tol > 0 && c.result.tol < 1)) add('Toleranz ungültig');
      if (!Array.isArray(c.solution) || !c.solution.length || c.solution.some(x => typeof x !== 'string' || !x.trim())) add('Lösungsweg fehlt');
      break;
    }
  }
  return { ok: !p.length, problems: p };
}

// Versucht, einen fast gültigen Baustein zu retten (Typen, Zahlenstrings, Überlängen, fehlende Chips). Gültig → Kopie; sonst null.
export function repairBlock(block) {
  if (!block || typeof block !== 'object' || !BLOCK_TYPES.includes(block.type) || !block.content || typeof block.content !== 'object') return null;
  let b; try { b = JSON.parse(JSON.stringify(block)); } catch { return null; }
  const c = b.content, T = x => typeof x === 'string' ? x.trim() : isNum(x) ? String(x) : '';
  const list = x => Array.isArray(x) ? x : [];
  const idx = x => { const n = typeof x === 'number' ? x : parseInt(String(x ?? '').replace(/\D/g, ''), 10); return Number.isInteger(n) ? n : NaN; };
  const num = x => isNum(x) ? x : parseNum(x);
  switch (b.type) {
    case 'ESSENCE_AND_TRAP': {
      c.points = list(c.points).map(x => typeof x === 'string' ? { t: T(x) } : { ...(T(x?.h) ? { h: T(x.h) } : {}), t: T(x?.t ?? x?.text) }).filter(x => x.t).slice(0, 6);
      if (typeof c.trap === 'string') c.trap = { text: T(c.trap) }; else if (c.trap) c.trap = { ...(T(c.trap.title) ? { title: T(c.trap.title) } : {}), text: T(c.trap.text) };
      if (c.formulas !== undefined) c.formulas = list(c.formulas).map(T).filter(f => f && !formulaProblem(f));
      if (!c.formulas?.length) delete c.formulas;
      b.skippable = b.skippable ?? true; break;
    }
    case 'MULTIPLE_CHOICE': {
      c.items = list(c.items).map(q => {
        const opts = list(q?.options).map(T), correct = idx(q?.correct), why = list(q?.why).map(T);
        if (opts.length < 4 || opts.length > 8 || opts.some(o => !o) || !(correct >= 0 && correct < opts.length)) return null;
        let o = opts, cc = correct, w = why;
        if (o.length > 4) { const drop = o.map((_, i) => i).filter(i => i !== cc).slice(0, o.length - 4); o = o.filter((_, i) => !drop.includes(i)); w = w.filter((_, i) => !drop.includes(i)); cc -= drop.filter(i => i < cc).length; }
        while (w.length < 4) w.push(''); w = w.slice(0, 4);
        return { q: T(q?.q), options: o, correct: cc, why: w };
      }).filter(Boolean).slice(0, 3);
      break;
    }
    case 'CLOZE_TEXT': {
      c.text = T(c.text).replace(/_{2,}|\[\s*\.{2,}\s*\]|\.{4,}/g, '___');
      c.answers = list(c.answers).map(T);
      const n = blanksIn(c.text);
      if (c.answers.length > n && n >= 3) c.answers = c.answers.slice(0, n);
      const chips = []; for (const x of [...list(c.chips).map(T), ...c.answers.map(a => a.split('|')[0].trim())]) if (x && !chips.some(y => norm(y) === norm(x))) chips.push(x);
      c.chips = chips; if (c.explain !== undefined) c.explain = T(c.explain);
      break;
    }
    case 'MATCHING_AND_ORDER': {
      c.prompt = T(c.prompt) || (c.mode === 'order' ? 'Bringe die Schritte in die richtige Reihenfolge.' : 'Ordne zu, was zusammengehört.');
      if (!c.mode) c.mode = Array.isArray(c.pairs) ? 'pairs' : 'order';
      if (c.mode === 'pairs') { const seen = new Set(); c.pairs = list(c.pairs).map(x => ({ l: T(x?.l), r: T(x?.r) })).filter(x => x.l && x.r && !seen.has(norm(x.l)) && seen.add(norm(x.l))).slice(0, 6); }
      else c.items = list(c.items).map(T).filter(Boolean).slice(0, 8);
      break;
    }
    case 'OPEN_QUESTION_VOICE': {
      c.q = T(c.q); c.keyPoints = list(c.keyPoints).map(T).filter(Boolean).slice(0, 3); c.sample = T(c.sample); break;
    }
    case 'STEP_CALCULATION': {
      c.task = T(c.task); c.formulaOptions = list(c.formulaOptions).map(T).filter(Boolean).slice(0, 4);
      c.correctFormula = idx(c.correctFormula);
      const g = x => ({ ...(T(x?.symbol) ? { symbol: T(x.symbol) } : {}), label: T(x?.label), value: num(x?.value), unit: T(x?.unit) });
      c.givens = list(c.givens).map(g).filter(x => x.label && isNum(x.value));
      if (c.extraGivens !== undefined) c.extraGivens = list(c.extraGivens).map(g).filter(x => x.label && isNum(x.value));
      c.result = { value: num(c.result?.value), unit: T(c.result?.unit), tol: isNum(c.result?.tol) && c.result.tol > 0 && c.result.tol < 1 ? c.result.tol : 0.01 };
      c.solution = list(c.solution).map(T).filter(Boolean);
      break;
    }
  }
  return validateBlock(b).ok ? b : null;
}

/* ---------------------------------- Prüfungshilfen ---------------------------------- */
export const pointsLabel = n => `[ / ${Number.isInteger(Number(n)) ? Number(n) : r1(Number(n) || 0)} Pkt.]`;
// Ergebnis → Note im gewählten System: { earned, max, pct, grade, label, text, pass }
export function gradeExam(earned, max, country = 'CH', scale) {
  const g = gradingOf(country, scale), m = Number(max) || 0, e = clamp(Number(earned) || 0, 0, m || 0);
  const pct = m > 0 ? r1(e / m * 100) : 0, grade = percentToGrade(g.country, g.scale, pct);
  return { earned: e, max: m, pct, grade, label: formatGrade(g.country, g.scale, grade), text: gradeLabel(g.country, g.scale, grade), pass: passes(g.country, g.scale, grade) };
}
// Prüfungsdauer: ca. 1.3 Min pro Punkt-Einheit gewichtet nach Typ
export const EXAM_MIN = { mc: 0.7, multi: 1, tf: 0.8, cloze: 1.2, match: 1.5, order: 1.2, short: 2.5, calc: 4, essay: 8, diagram: 4, table: 3 };
export const examMinutes = qs => Math.min(180, Math.max(15, Math.round((qs || []).reduce((t, q) => t + (EXAM_MIN[q.type] || 2), 0) / 5) * 5));

/* ---------------------------------- Kosten ---------------------------------- */
// Preise USD pro Million Token [Input, Output] – Stand 06.10.2026 (Skill claude-api). Vor Abrechnung neu abgleichen.
export const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25], 'claude-sonnet-5-5': [2, 10], 'claude-sonnet-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-haiku-4-5': [1, 5] };
export const costUSD = (model, tin, tout) => { const p = PRICES[model]; return p ? (tin * p[0] + tout * p[1]) / 1e6 : 0; };
// Verbrauch in Kurs-Statistik eintragen (ohne Textinhalte)
export function addUsage(usage, { step, model, tin = 0, tout = 0 }) {
  const u = usage || { calls: 0, tin: 0, tout: 0, cost: 0, byStep: {} };
  const c = costUSD(model, tin, tout);
  u.calls++; u.tin += tin; u.tout += tout; u.cost += c;
  const s = u.byStep[step] || (u.byStep[step] = { calls: 0, tin: 0, tout: 0, cost: 0 });
  s.calls++; s.tin += tin; s.tout += tout; s.cost += c;
  return u;
}
export const emptyUsage = () => ({ calls: 0, tin: 0, tout: 0, cost: 0, byStep: {} });
export const fmtUSD = n => n < 0.01 ? '< 0.01 $' : n.toFixed(2) + ' $';
