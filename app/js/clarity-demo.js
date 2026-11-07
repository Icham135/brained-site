// Brained Clarity – Demo ohne KI-Schlüssel: baut aus echten Sätzen des Materials Module/Konzepte, alle 6 Bausteine, eine Prüfung und
// einfache Bewertungen (gleiche Datenformen wie die KI). Ehrlich eine Demo: nichts wird erfunden, jede Frage, Lücke und Antwort stammt
// aus einem Satz des Materials (Rechenaufgaben: Zahlen des Beispiels im Material, neu gerechnet). Reines Modul, ohne DOM und Netzwerk.
import { evalFormula, formulaParts, symKey, sig } from './clarity-math.js';

const norm = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hashStr = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const seedShuffle = (n, seed = 1) => {
  const a = Array.from({ length: n }, (_, i) => i); let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a.every((x, i) => x === i)) a.push(a.shift());
  return a;
};
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const arr = x => Array.isArray(x) ? x : [];

/* ---------------------------------- Sätze und Wörter ---------------------------------- */
const ABBR = /(?:^|\s)(?:z\.\s?b|d\.\s?h|u\.\s?a|ca|bzw|usw|vgl|ggf|evtl|nr|abb|fig|dr|prof|etc|sog|bspw|inkl|kap|resp)\.$/i;
export function sentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/(\d)\.(\d)/g, '$1\u0001$2').trim();
  const pieces = t.match(/[^.!?]+[.!?]+["»“)]*\s*|[^.!?]+$/g) || [];
  const out = [];
  for (const p0 of pieces) {
    const p = p0.trim(); if (!p) continue;
    const prev = out[out.length - 1];
    if (prev && (ABBR.test(prev) || /^[a-zäöü0-9]/.test(p))) out[out.length - 1] = prev + ' ' + p; else out.push(p);
  }
  return out.map(s => s.replace(/\u0001/g, '.'));
}
const TOK = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;
const wordsOf = s => [...s.matchAll(TOK)].map(m => ({ w: m[0], i: m.index, e: m.index + m[0].length, n: norm(m[0]).replace(/ /g, '') }));
const STOP = new Set(('waehrend dieser dieses diesem diesen dadurch dabei damit dagegen dazu daher sowie jedoch wieder werden wurde wurden wird koennen muessen sehr mehr nicht ueber unter zwischen innerhalb ausserhalb ' +
  'dieselbe welche welcher welches sodass somit deshalb ebenfalls insgesamt bereits gleich jeweils mehrere viele einige andere anderen anderer zunaechst danach anschliessend schliesslich spaeter genau etwa ' +
  'ungefaehr dient nennt heisst beispiel beispielsweise wichtig wichtige wichtigsten gibt geben lassen besteht bestehen entsteht entstehen erklaere erklaeren schritt bedeutet grundsaetzlich seine seiner ihre ihrer ' +
  'ihrem ihren einer einem einen eines solche solchen allen aller alles immer noch schon oder aber auch weil wenn denn sonst statt diese gemaess welchen dieselben waere wuerde zudem jedes jeder jeden einmal ' +
  'because between which these those their there where while about after before during other another through however therefore entre aussi alors comme dans pour avec cette ainsi donc').split(' '));
const isCand = (x, min) => x.w.length >= min && /^\p{L}[\p{L}-]*\p{L}$/u.test(x.w) && !STOP.has(x.n);
const isUp = w => /^\p{Lu}/u.test(w);
const cut = (s, n) => { s = String(s).trim(); if (s.length <= n) return s; const c = s.slice(0, n), i = c.lastIndexOf(' '); return c.slice(0, i > n * 0.5 ? i : n).replace(/[\s,;:.\-–]+$/, '') + '…'; };
const cleanH = h => String(h || '').replace(/^#+\s*/, '').replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').trim();
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

function stemMatch(a, b) {
  if (a === b) return true;
  const m = Math.min(a.length, b.length); if (m < 4 || /\d/.test(a + b)) return false;
  let cp = 0; while (cp < m && a[cp] === b[cp]) cp++;
  if (cp < Math.max(4, Math.min(6, m - 1))) return false;
  return cp === m || Math.abs(a.length - b.length) <= 4;
}
// Prosa ohne Formel-/Beispielzeilen (die gehören zu den Rechenaufgaben)
const prose = t => String(t || '').replace(/\[S\. \d+\]/g, '').split('\n').filter(l => !/^\s*(?:Formel|Beispiel)\s*:/i.test(l) && !/^\s*\d+[.)]\s+[^.!?]{2,80}$/.test(l)).join('\n');

// texts: Textabschnitte → Sätze mit Schlüsselwort, Wertung und Distraktoren-Pool
function analyze(texts, extPool = []) {
  const seen = new Set(), sents = [];
  texts.forEach((t, ci) => sentences(t).forEach(s => { const k = norm(s); if (k && !seen.has(k)) { seen.add(k); sents.push({ t: s, ci, i: sents.length, ws: wordsOf(s) }); } }));
  const freq = new Map(); sents.forEach(s => s.ws.forEach(x => freq.set(x.n, (freq.get(x.n) || 0) + 1)));
  const pool = new Map();
  for (const s of sents) {
    const cnt = new Map(); s.ws.forEach(x => cnt.set(x.n, (cnt.get(x.n) || 0) + 1));
    s.cands = s.ws.map((x, k) => isCand(x, 5) ? { ...x, k, sc: Math.min(x.w.length, 16) + 2.5 * Math.min(freq.get(x.n), 5) + (k > 0 && isUp(x.w) ? 4 : 0) } : null).filter(Boolean);
    s.cands.forEach(x => { if (x.w.length >= 6 && !pool.has(x.n)) pool.set(x.n, { w: x.w, n: x.n }); });
    const keys = s.cands.filter(x => x.k > 0 && x.w.length >= 6 && cnt.get(x.n) === 1);
    s.key = keys.sort((a, b) => b.sc - a.sc)[0] || null;
    s.score = s.cands.map(x => x.sc).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    s.ok = !!s.key && s.t.length >= 45 && s.t.length <= 230 && s.ws.length >= 6 && !/[?:]$/.test(s.t) && isUp(s.t);
  }
  for (const w of extPool) for (const x of wordsOf(String(w))) if (isCand(x, 6) && !pool.has(x.n)) pool.set(x.n, { w: x.w, n: x.n });
  const best = new Map();
  sents.forEach(s => s.cands.forEach(x => { if (x.w.length >= 6 && (!best.has(x.n) || best.get(x.n).sc < x.sc)) best.set(x.n, x); }));
  const terms = [...best.values()].sort((a, b) => b.sc - a.sc);
  return { sents, pool: [...pool.values()], terms, usable: sents.filter(s => s.ok).sort((a, b) => b.score - a.score || a.i - b.i) };
}
function distract(pool, sent, key, k, salt = '') {
  const inS = new Set(sent.ws.map(x => x.n)), up = isUp(key.w);
  const ok = p => p.n !== key.n && !inS.has(p.n) && !stemMatch(p.n, key.n);
  const rank = p => Math.abs(p.w.length - key.w.length) + hashStr(p.n + salt) % 5;
  const a = pool.filter(p => ok(p) && isUp(p.w) === up).sort((x, y) => rank(x) - rank(y));
  const b = pool.filter(p => ok(p) && isUp(p.w) !== up).sort((x, y) => rank(x) - rank(y));
  return [...a, ...b].slice(0, k);
}
const gapText = (s, key) => s.t.slice(0, key.i) + '___' + s.t.slice(key.e);
const swapText = (s, key, w) => s.t.slice(0, key.i) + w + s.t.slice(key.e);
function mix4(opts, why, seedStr, prev) {
  let seed = hashStr(seedStr) % 1000003, perm = seedShuffle(opts.length, seed);
  for (let t = 0; t < 8 && perm.indexOf(0) === prev; t++) perm = seedShuffle(opts.length, ++seed);
  return { options: perm.map(i => opts[i]), why: perm.map(i => why[i]), correct: perm.indexOf(0) };
}
const calcSignals = t => (String(t).match(/\d\s*[·*×\/^]\s*\d|[=≈]\s*[-−]?\d|\b(?:berechne|rechne|ausrechnen|gegeben|gesucht)\b|\\frac|\$[^$]{3,}\$/gi) || []).length;

/* ---------------------------------- Struktur (Ersatz für den Struktur-Aufruf) ---------------------------------- */
const pagesFromBatch = batch => {
  const parts = String(batch.text).split(/\[S\. (\d+)\]\n/); const out = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ n: +parts[i], text: parts[i + 1] });
  return out;
};
const firstHeading = text => { const l = String(text).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 3).find(x => x.length > 2 && x.length < 80 && !/[.!?;,]$/.test(x)); return l ? cleanH(l) : ''; };
// Beste Sätze eines Textes als kurze Vorschau-Punkte
export function previewFrom(text, n = 3) {
  const A = analyze([prose(text)]), pick = [...A.usable].slice(0, n).sort((a, b) => a.i - b.i);
  const alt = A.sents.filter(s => s.t.length >= 25).slice(0, n);
  return (pick.length >= n ? pick : [...pick, ...alt.filter(a => !pick.some(p => p.i === a.i))].slice(0, n)).map(s => cut(s.t, 110));
}
/* batch: { from, to, text mit [S. n] } → rohe KI-Antwort-Form { module, concepts:[{t,p,s,e,w,c,m,r}] } */
export function demoStructure(batch, k0, mm) {
  const ps = pagesFromBatch(batch).filter(p => p.text.trim()); if (!ps.length) return { module: '', concepts: [] };
  const k = clamp(Math.min(ps.length, Math.max(k0[0], Math.round(ps.reduce((n, p) => n + p.text.length, 0) / 2200))), 1, k0[1]);
  const groups = Array.from({ length: k }, () => []); ps.forEach((p, i) => groups[Math.min(k - 1, Math.floor(i * k / ps.length))].push(p));
  const concepts = groups.filter(g => g.length).map(g => {
    const txt = g.map(p => p.text).join('\n'), A = analyze([prose(txt)]);
    const title = firstHeading(g[0].text) || (A.terms[0] ? cap1(A.terms[0].w) : 'Abschnitt'), defs = A.sents.filter(s => /\b(ist|sind|bezeichnet|nennt|heisst|dient|bildet)\b/i.test(s.t)).length;
    const len = A.sents.reduce((n, s) => n + s.t.length, 0) / Math.max(1, A.sents.length), calc = calcSignals(txt);
    return { t: cut(title, 70), p: previewFrom(txt, 3), s: g[0].n, e: g.at(-1).n, w: clamp(4 + defs, 1, 10), c: calc >= 4 || len > 150 ? 'komplex' : len > 105 ? 'mittel' : 'basis', m: clamp(Math.round(txt.length / 700) + 2, mm[0], mm[1]), r: calc >= 2 };
  });
  return { module: firstHeading(ps[0].text) ? '' : '', concepts };
}

/* ---------------------------------- Rechenaufgabe aus dem Material ---------------------------------- */
const subst = (f, gs) => { let r = f.replace(/\$/g, '').split('=').slice(1).join('=').trim(); for (const g of gs) r = r.replace(new RegExp('(?<![\\\\\\w])' + g.symbol.replace(/[.*+?^()|[\]\\{}$]/g, '\\$&') + '(?!\\w)', 'g'), fmtNum(g.value)); return r; };
const NUMRE = '-?\\d+(?:[.,]\\d+)?';
const fmtNum = x => String(sig(x, 4)).replace('.', ',');
const toNum = s => parseFloat(String(s).replace(',', '.').replace('−', '-'));
// Formel-Zeilen («Formel: $v = \frac{s}{t}$ (…)») und Beispiele («Beispiel: Gegeben s = 150 m … Gesucht ist v. Rechnung: v = 150 / 30 = 5 m/s.»)
export function demoCalc(text) {
  const formulas = [...String(text).matchAll(/^\s*Formel:\s*(\$[^$]+\$|[^(\n]+)/gim)].map(m => m[1].trim());
  const examples = [...String(text).matchAll(/^\s*Beispiel:\s*(.+)$/gim)].map(m => m[1]);
  for (const ex of examples) {
    const seg = ex.split(/Gesucht/i)[0], want = /Gesucht\s+ist\s+([A-Za-zρΔ]\w*)/i.exec(ex)?.[1]; if (!want) continue;
    const givens = [...seg.matchAll(new RegExp(`([A-Za-zρΔ]\\w*)\\s*=\\s*(${NUMRE})\\s*([^\\s,.;]*)`, 'g'))].map(m => ({ symbol: m[1], value: toNum(m[2]), unit: m[3] }));
    const res = new RegExp(`=\\s*(${NUMRE})\\s*([^\\s.;,]*)\\.?\\s*$`).exec(ex); if (givens.length < 2 || !res) continue;
    const f = formulas.find(x => { const p = formulaParts(x); return p.lhs === symKey(want) && p.vars.length >= 2 && p.vars.every(v => givens.some(g => symKey(g.symbol) === v)); }); if (!f) continue;
    const p = formulaParts(f), use = givens.filter(g => p.vars.includes(symKey(g.symbol)));
    const g2 = use.map((g, i) => i === 0 ? { ...g, value: sig(g.value * 2, 4) } : g);   // erste Grösse verdoppeln: neue Zahl, gleiche Formel
    const vars = {}; g2.forEach(g => { vars[symKey(g.symbol)] = g.value; });
    const val = evalFormula(f, vars); if (!Number.isFinite(val)) continue;
    const others = formulas.filter(x => x !== f), unit = res[2];
    let opts = [f, ...others.filter(o => formulaParts(o).lhs !== p.lhs || true).slice(0, 2)];
    const lhs = f.replace(/\$/g, '').split('=')[0].trim(), v = p.vars.map(k => use.find(g => symKey(g.symbol) === k).symbol);
    for (const alt of [`$${lhs} = ${v.join(' \\cdot ')}$`, `$${lhs} = ${v.slice().reverse().join(' / ')}$`, `$${lhs} = ${v.join(' + ')}$`]) { if (opts.length >= 4) break; if (!opts.some(o => norm(o) === norm(alt))) opts.push(alt); }
    const perm = seedShuffle(opts.length, hashStr(f + seg) % 100003), shuffled = perm.map(i => opts[i]);
    const extra = givens.filter(g => !p.vars.includes(symKey(g.symbol))).slice(0, 2).map(g => ({ label: g.symbol, value: g.value, unit: g.unit }));
    const lab = g => `${g.symbol} = ${fmtNum(g.value)} ${g.unit}`.trim();
    return { type: 'STEP_CALCULATION', content: {
      task: `Gegeben: ${g2.map(lab).join(', ')}. Berechne ${want}.`,
      formulaOptions: shuffled, correctFormula: perm.indexOf(0),
      givens: g2.map(g => ({ symbol: g.symbol, label: g.symbol, value: g.value, unit: g.unit })), extraGivens: extra,
      result: { value: sig(val, 4), unit, tol: 0.01 },
      solution: [`Gegeben: ${g2.map(lab).join(', ')}`, `Formel: ${f}`, `Einsetzen: ${want} = ${subst(f, g2)}`, `Ergebnis: ${want} = ${fmtNum(val)} ${unit}`.trim()],
    }, _formula: f };
  }
  return null;
}

/* ---------------------------------- Basistext und Bausteine einer Etappe ---------------------------------- */
const FORMEX = /^\s*(?:Formel|Beispiel)\s*:/i, nWords = t => (String(t || '').match(/\S+/g) || []).length;
const isHead = u => u.length <= 80 && !/\n/.test(u) && !/[.!?:;,]$/.test(u) && nWords(u) <= 9 && !FORMEX.test(u);
const quoteOf = t => { const x = String(t).replace(/\s+/g, ' ').trim(); return x.length <= 100 ? x : x.slice(0, 100).replace(/\s+\S*$/, ''); };
// Basistext aus dem Material (ohne KI): echte Absätze des Materials in Abschnitten mit Überschrift, Umfang ungefähr `words` Wörter (ganze Absätze; Formel- und Beispielzeilen bleiben dran).
// → { sections:[{ h, t }], points, formulas?, trap, words, parts:1 } – Kernaussagen und Falle sind echte Sätze daraus.
export function demoBasis(concept, text, words = 400) {
  const units = String(text || '').replace(/\[S\. \d+\]/g, '').split(/\n{2,}/).map(u => u.trim()).filter(Boolean), secs = []; let cur = null, total = 0, stop = false;
  const push = () => { if (cur && cur.paras.length) secs.push({ h: cur.h, t: cur.paras.join('\n\n') }); cur = null; };
  for (const u of units) {
    if (stop) break;
    if (isHead(u)) { push(); cur = { h: cleanH(u), paras: [] }; continue; }
    if (!FORMEX.test(u) && total >= words) { stop = true; break; }
    cur ||= { h: '', paras: [] }; cur.paras.push(u); total += nWords(u);
    if (!FORMEX.test(u) && nWords(cur.paras.join(' ')) > 200) push();
  }
  push();
  const A0 = analyze(secs.map(x => prose(x.t)));
  secs.forEach((x, i) => { if (!x.h) { const top = A0.sents.filter(z => z.ci === i).flatMap(z => z.cands).sort((p, q) => q.sc - p.sc)[0]; x.h = top ? cap1(top.w) : `Abschnitt ${i + 1}`; } });
  const A = analyze(secs.map(x => prose(x.t))), usable = A.usable;
  const pts = [...usable].sort((a, b) => b.score - a.score).slice(0, 6).sort((a, b) => a.i - b.i);
  const fill = A.sents.filter(x => x.t.length >= 25 && !pts.some(q => q.i === x.i)).slice(0, Math.max(0, 4 - pts.length));
  const points = [...pts, ...fill].sort((a, b) => a.i - b.i).slice(0, 6).map(x => ({ h: x.key ? cap1(x.key.w) : '', t: cut(x.t, 220) })).map(q => q.h ? q : { t: q.t });
  const CONTRAST = /\b(nicht|kein|keine|nur|aber|jedoch|dagegen|im gegensatz|statt|ohne)\b/i;
  const trapS = A.sents.find(x => CONTRAST.test(x.t) && x.t.length >= 30 && x.t.length <= 240) || A.sents.find(x => /\d/.test(x.t) && x.t.length >= 30) || [...usable].sort((a, b) => b.t.length - a.t.length)[0];
  const formulas = [...secs.map(x => x.t).join('\n').matchAll(/^\s*Formel:\s*(\$[^$]+\$|[^(\n]+)/gim)].map(m => m[1].trim()).slice(0, 3);
  return { sections: secs, points, ...(formulas.length ? { formulas } : {}), trap: { title: 'Typische Prüfungsfalle', text: trapS ? `Achte besonders auf diese Aussage: ${cut(trapS.t, 220)}` : '' }, words: secs.reduce((n, x) => n + nWords(x.t), 0), parts: 1 };
}
// concept: Konzept, text: Seitentext des Konzepts, allText: ganzer Kurs (für Ablenker), basis: { sections } des Durchgangs (global nummeriert, n) → passende Block-Typen
// Alle Aufgaben stammen aus Sätzen des Basistexts und tragen ref (Abschnitt + Ausschnitt). Ohne basis wird zuerst ein Basistext gebaut und der Baustein ESSENCE_AND_TRAP mitgeliefert.
export function demoBlocks(concept, text, allText = '', basis = null) {
  const out = [], b0 = basis?.sections?.length ? null : demoBasis(concept, text, 100000);
  const secs = (basis?.sections?.length ? basis.sections : b0.sections).map((x, i) => ({ h: x.h, t: x.t, n: x.n ?? i + 1 }));
  if (b0 && b0.points.length >= 3 && b0.trap.text) out.push({ type: 'ESSENCE_AND_TRAP', skippable: false, content: { sections: b0.sections, points: b0.points, ...(b0.formulas ? { formulas: b0.formulas } : {}), trap: b0.trap, words: b0.words } });
  const A = analyze(secs.map(x => prose(x.t)), [prose(allText)]), usable = A.usable;
  const byOrder = [...usable].sort((a, b) => a.i - b.i), secOf = x => secs[x.ci]?.n ?? 1, refOf = x => ({ sec: secOf(x), quote: quoteOf(x.t) });
  const name = cleanH(concept?.title) || 'Abschnitt';
  // 2) Multiple Choice (2–3 Fragen)
  const rk = usable; const items = []; let prev = -1;
  for (const s of rk) {
    if (items.length >= 3) break;
    const ds = distract(A.pool, s, s.key, 3, 'mc'); if (ds.length < 3) continue;
    const typeB = items.length % 2 === 0 && s.t.length <= 190; let q, opts, why;
    if (typeB) { q = `Welche Aussage zu «${name}» steht so im Basistext?`; opts = [s.t, ...ds.map(d => swapText(s, s.key, d.w))]; why = ['Richtig – so steht es im Basistext.', ...ds.map(d => `Falsch: Im Basistext steht «${s.key.w}», nicht «${d.w}».`)]; }
    else { q = `Welches Wort passt in die Lücke? «${gapText(s, s.key)}»`; opts = [s.key.w, ...ds.map(d => d.w)]; why = [`Richtig: «${s.key.w}» – so steht es im Basistext.`, ...ds.map(d => `«${d.w}» passt hier nicht; im Basistext steht «${s.key.w}».`)]; }
    const m = mix4(opts, why, s.t + items.length, prev); prev = m.correct; items.push({ q, options: m.options, correct: m.correct, why: m.why, ref: refOf(s) });
  }
  if (items.length >= 2) out.push({ type: 'MULTIPLE_CHOICE', content: { items } });
  // 3) Rechnen
  const calcSec = secs.find(x => /^\s*Formel:/im.test(x.t)), calc = concept?.needsCalc ? demoCalc(secs.map(x => x.t).join('\n\n')) : null;
  if (calc) { const { _formula, ...b } = calc; out.push({ ...b, content: { ...b.content, ref: { sec: calcSec?.n ?? secs[0].n, quote: quoteOf((calcSec?.t.match(/^\s*Formel:.*$/im) || [''])[0].replace(/^\s*Formel:\s*/i, '')) } } }); }
  // 4) Lückentext: Sätze mit je 1–2 Lücken, zusammen 3–5 verschiedene Antworten
  {
    const seenK = new Set(), parts = [], answers = [], usedS = [];
    for (const s of [...rk].sort((x, y) => x.i - y.i)) {
      if (answers.length >= 3) break;
      const ks = [s.key, ...s.cands.filter(x => x.k > 0 && x.w.length >= 6 && x.n !== s.key.n)].filter(x => !seenK.has(x.n)).slice(0, answers.length >= 2 ? 1 : 2).sort((p, q) => p.i - q.i);
      if (!ks.length) continue; let t = s.t;
      for (const k of [...ks].sort((p, q) => q.i - p.i)) t = t.slice(0, k.i) + '___' + t.slice(k.e);
      ks.forEach(k => { seenK.add(k.n); answers.push(k.w); }); parts.push(t); usedS.push(s);
    }
    const ds = rk.length ? distract(A.pool, rk[0], rk[0].key, 8, 'cp').filter(x => !seenK.has(x.n)).slice(0, 2) : [];
    if (answers.length >= 3 && answers.length <= 5 && ds.length >= 2) {
      const chips = [...answers, ...ds.map(x => x.w)], perm = seedShuffle(chips.length, hashStr(answers.join()) % 100003);
      out.push({ type: 'CLOZE_TEXT', content: { text: parts.join(' '), answers, chips: perm.map(i => chips[i]), ref: refOf(usedS[0]) } });
    }
  }
  // 5) Zuordnen / Reihenfolge
  const used = new Set(), pairs = [], pairSrc = [], DEF = /\b(ist|sind|bezeichnet|nennt|heisst|besteht|dient|bildet|versteht|wird|werden)\b/i;
  for (const tm of A.terms) {
    if (pairs.length >= 5) break;
    const def = A.sents.filter(s => s.ws.some(x => x.n === tm.n) && s.t.length <= 200 && !used.has(s.i)).sort((a, b) => (DEF.test(b.t) - DEF.test(a.t)) || a.t.length - b.t.length)[0]; if (!def) continue;
    const r = def.t.replace(new RegExp(tm.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '…');
    if (r.includes('…') && r.replace(/…/g, '').trim().length > 20) { used.add(def.i); pairs.push({ l: tm.w, r: cut(r, 160) }); pairSrc.push(def); }
  }
  const STEP = /\b(zuerst|zunächst|zunaechst|dann|danach|anschliessend|schliesslich|im ersten|im zweiten|im dritten|als letztes|am ende|zum schluss)\b/i;
  const steps = A.sents.filter(s => s.t.length >= 25 && s.t.length <= 170 && STEP.test(s.t)).slice(0, 5);
  if (steps.length >= 4) out.push({ type: 'MATCHING_AND_ORDER', content: { mode: 'order', prompt: 'Bringe die Schritte in die richtige Reihenfolge, wie sie im Basistext beschrieben sind.', items: steps.map(s => s.t), ref: refOf(steps[0]) } });
  else if (pairs.length >= 4) out.push({ type: 'MATCHING_AND_ORDER', content: { mode: 'pairs', prompt: 'Ordne jedem Begriff die passende Aussage aus dem Basistext zu (der Begriff ist durch «…» ersetzt).', pairs, ref: refOf(pairSrc[0]) } });
  else { const seen = new Set(), seq = A.sents.filter(s => s.t.length >= 20 && !seen.has(norm(cut(s.t, 170))) && seen.add(norm(cut(s.t, 170)))).slice(0, 5); if (seq.length >= 4) out.push({ type: 'MATCHING_AND_ORDER', content: { mode: 'order', prompt: 'Bringe diese Aussagen in die Reihenfolge, in der sie im Basistext vorkommen.', items: seq.map(s => cut(s.t, 170)), ref: refOf(seq[0]) } }); }
  // 6) Offene Frage mit 3 Checkpoints
  const kp = [...usable].sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i);
  if (kp.length === 3) out.push({ type: 'OPEN_QUESTION_VOICE', content: { q: `Erkläre in eigenen Worten: ${name}.`, keyPoints: kp.map(s => cut(s.t, 160)), sample: cut(kp.map(s => s.t).join(' '), 600), ref: refOf(kp[0]) } });
  return out;
}

/* ---------------------------------- Offene Antwort (Schlüsselwörter) ---------------------------------- */
export function demoGradeOpen(content, answer) {
  const kp = arr(content?.keyPoints), A = new Set(wordsOf(String(answer)).map(x => x.n)), P = [...A];
  const hit = k => { const ws = wordsOf(k).filter(x => isCand(x, 5)); if (!ws.length) return false; return ws.filter(x => A.has(x.n) || P.some(p => stemMatch(p, x.n))).length / ws.length >= 0.5; };
  const hits = kp.map(hit), n = hits.filter(Boolean).length;
  return { points: kp.length ? n / kp.length : 0, checkpoints: kp.map((t, i) => ({ text: t, hit: hits[i] })), missing: kp.filter((_, i) => !hits[i]),
    feedback: (n === kp.length ? 'Alle Kernpunkte sind drin.' : n ? `${n} von ${kp.length} Kernpunkten gefunden.` : 'Noch kein Kernpunkt gefunden.') + ' (Demo-Bewertung über Schlüsselwörter, ohne KI.)' };
}

/* ---------------------------------- Prüfung ---------------------------------- */
// plan: [{slot, concept, type, points}] → rohe Fragen { type, q, …, conceptId }
export function demoExam(course, cs, plan, textMap) {
  const texts = new Map(cs.map(k => [k.id, textMap.get(k.id) || '']));
  const allText = [...texts.values()].map(prose).join(' '), An = new Map(cs.map(k => [k.id, analyze([prose(texts.get(k.id))], [allText])]));
  const used = new Set(), out = [];
  const take = (A, ok = () => true) => A.usable.find(s => !used.has(s.t) && ok(s)) || A.usable.find(s => ok(s));
  for (let sl of plan) {
    const k = sl.concept, A = An.get(k.id); if (!A) continue; const base = { conceptId: k.id }; let q = null;
    if (sl.type === 'calc') { const c = demoCalc(texts.get(k.id)); if (c) { const C = c.content, f = c._formula; q = { type: 'calc', q: `${C.task}`, latex: f.replace(/\$/g, ''), answer: C.solution.join(' → '), rubric: ['1 P: richtige Formel wählen', '1 P: Werte einsetzen', '2 P: Ergebnis mit Einheit'] }; } else sl = { ...sl, type: 'short' }; }
    if (!q && sl.type === 'mc') { const s = take(A, x => distract(A.pool, x, x.key, 3).length >= 3); if (s) { used.add(s.t); const ds = distract(A.pool, s, s.key, 3, 'x'), m = mix4([s.key.w, ...ds.map(d => d.w)], ['', '', '', ''], s.t, -1); q = { type: 'mc', q: `Welches Wort passt in die Lücke? «${gapText(s, s.key)}»`, options: m.options, correct: m.correct }; } }
    if (!q && sl.type === 'multi') { const t = [take(A), A.usable.find(s => !used.has(s.t))].filter(Boolean), f = A.usable.filter(s => distract(A.pool, s, s.key, 1).length).slice(0, 2); if (t.length === 2 && f.length === 2) { const opts = [t[0].t, t[1].t, ...f.map(s => swapText(s, s.key, distract(A.pool, s, s.key, 1, 'm')[0].w))], perm = seedShuffle(4, hashStr(opts[0]) % 100003); t.forEach(s => used.add(s.t)); q = { type: 'multi', q: 'Welche Aussagen stimmen gemäss dem Material? (mehrere möglich)', options: perm.map(i => opts[i]), correct: [0, 1].map(i => perm.indexOf(i)).sort((a, b) => a - b) }; } }
    if (!q && sl.type === 'tf') { const ss = A.usable.filter(s => distract(A.pool, s, s.key, 1).length).slice(0, 3); if (ss.length === 3) { const fi = hashStr(k.id) % 3; q = { type: 'tf', q: 'Entscheide für jede Aussage, ob sie gemäss Material stimmt.', statements: ss.map((s, i) => i === fi ? { text: swapText(s, s.key, distract(A.pool, s, s.key, 1, 'f')[0].w), correct: false } : { text: s.t, correct: true }) }; } }
    if (!q && sl.type === 'cloze') { const s = take(A); if (s) { used.add(s.t); const k2 = s.cands.filter(x => x.k > 0 && x.w.length >= 6 && x.n !== s.key.n)[0]; let t = gapText(s, s.key), b = [s.key.w]; if (k2) { const w = wordsOf(t).find(x => x.n === k2.n); if (w) { t = t.slice(0, w.i) + '___' + t.slice(w.e); b = s.key.i < k2.i ? [s.key.w, k2.w] : [k2.w, s.key.w]; } } q = { type: 'cloze', q: t, blanks: b }; } }
    if (!q && sl.type === 'essay') { const ss = [...A.usable].sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.i - b.i); if (ss.length >= 3) q = { type: 'essay', q: `Erkläre ausführlich und mit den wichtigsten Begriffen: «${cleanH(k.title)}».`, answer: ss.map(s => s.t).join(' '), rubric: ss.map(s => `1.5 P: nennt «${s.key.w}» im richtigen Zusammenhang`) }; }
    if (!q && sl.type === 'diagram') { const st = [...A.usable].sort((a, b) => a.i - b.i).slice(0, 4); if (st.length >= 3) q = { type: 'diagram', q: `Die Grafik zeigt die Stichworte zu «${cleanH(k.title)}» in der Reihenfolge des Materials. Beschreibe jeden Schritt in einem Satz.`, svg: flowSvg(st.map(s => s.key.w)), answer: st.map(s => s.t).join(' '), rubric: st.map(s => `0.75 P: beschreibt «${s.key.w}» richtig`) }; }
    if (!q && sl.type === 'table') { const tm = A.terms.slice(0, 4).map(t => { const s = A.sents.find(x => x.ws.some(w => w.n === t.n) && x.t.length <= 200); return s ? [t.w, cut(s.t, 70)] : null; }).filter(Boolean); if (tm.length >= 3) q = { type: 'table', q: 'Wähle zwei Begriffe aus der Tabelle und erkläre, wie sie zusammenhängen.', table: { cols: ['Begriff', 'Aussage im Material'], rows: tm }, answer: tm.map(r => r[1]).join(' '), rubric: ['1.5 P: wählt zwei passende Begriffe', '1.5 P: erklärt den Zusammenhang richtig'] }; }
    if (!q) { const ss = [...A.usable].sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i), tm = A.terms[0]; if (ss.length && tm) q = { type: 'short', q: `Was sagt das Material über «${tm.w}»? Antworte in eigenen Worten.`, answer: ss.map(s => s.t).join(' '), rubric: ss.map(s => `1.5 P: nennt «${s.key.w}» im richtigen Zusammenhang`) }; }
    if (q) out.push({ ...q, ...base });
  }
  return out;
}
// Einfaches Ablaufdiagramm als SVG (Kästchen mit Pfeilen)
function flowSvg(labels) {
  const n = labels.length, w = 300, bw = Math.floor((w - 20 - (n - 1) * 16) / n), esc = s => String(s).replace(/[<>&"]/g, '');
  const boxes = labels.map((t, i) => { const x = 10 + i * (bw + 16); return `<rect x="${x}" y="70" width="${bw}" height="44" rx="6" fill="none" stroke="#444"/><text x="${x + bw / 2}" y="97" font-size="${bw < 60 ? 8 : 10}" text-anchor="middle">${esc(cut(t, 12))}</text>${i ? `<line x1="${x - 16}" y1="92" x2="${x}" y2="92" stroke="#444" stroke-width="1.5"/>` : ''}`; }).join('');
  return `<svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">${boxes}</svg>`;
}
export const SAMPLE_TEXT = `1. Warum Zellen Energie brauchen

Jede lebende Zelle muss ständig arbeiten. Sie baut Eiweisse auf, transportiert Stoffe durch ihre Membran, teilt sich und hält ihre Struktur aufrecht. Für alle diese Vorgänge benötigt sie Energie in einer Form, die sofort verfügbar ist. Diese Form ist das Molekül ATP, die Abkürzung für Adenosintriphosphat. ATP wirkt wie eine kleine, aufladbare Batterie der Zelle. Wenn eine Phosphatgruppe von ATP abgespalten wird, entsteht ADP, und dabei wird Energie frei, die die Zelle für ihre Arbeit nutzen kann.

Die Zelle kann ATP nicht in grossen Mengen lagern. Deshalb muss sie ATP laufend neu herstellen, indem sie energiereiche Nährstoffe abbaut. Der wichtigste Brennstoff vieler Zellen ist die Glucose, also der Traubenzucker. Den schrittweisen Abbau der Glucose unter Verwendung von Sauerstoff nennt man Zellatmung. Sie liefert den grössten Teil des ATP in tierischen und pflanzlichen Zellen.

2. Die Gesamtgleichung der Zellatmung

Man kann die Zellatmung in einer einzigen Gleichung zusammenfassen. Ein Molekül Glucose reagiert mit sechs Molekülen Sauerstoff zu sechs Molekülen Kohlenstoffdioxid und sechs Molekülen Wasser. Dabei wird Energie freigesetzt, und ein Teil davon wird in ATP gespeichert. Der Rest geht als Wärme verloren, was erklärt, warum unser Körper warm bleibt.

In Wirklichkeit läuft die Zellatmung nicht in einem Schritt ab. Würde die Glucose auf einmal verbrennen, entstünde ein Wärmeblitz, den die Zelle nicht nutzen könnte. Stattdessen zerlegt die Zelle den Zucker in vier aufeinanderfolgenden Abschnitten: die Glykolyse, die oxidative Decarboxylierung, der Citratzyklus und die Atmungskette. So wird die Energie in kleinen Portionen frei und kann gezielt in ATP umgewandelt werden.

3. Glykolyse im Zellplasma

Die Glykolyse findet im Zellplasma statt, also ausserhalb der Mitochondrien. Dabei wird ein Molekül Glucose mit sechs Kohlenstoffatomen in zwei Moleküle Pyruvat mit je drei Kohlenstoffatomen gespalten. Zuerst muss die Zelle selbst zwei ATP einsetzen, um die Glucose zu aktivieren. Im weiteren Verlauf entstehen vier ATP, sodass der Nettogewinn zwei ATP pro Glucose beträgt.

Zusätzlich werden bei der Glykolyse Wasserstoffatome auf den Überträger NAD übertragen. Es entsteht NADH, das diese Wasserstoffatome später an die Atmungskette weitergibt. Die Glykolyse braucht keinen Sauerstoff. Sie ist deshalb ein sehr alter Stoffwechselweg, den fast alle Lebewesen besitzen.

4. Oxidative Decarboxylierung

Das Pyruvat gelangt nun aus dem Zellplasma in die Mitochondrien, die man oft als Kraftwerke der Zelle bezeichnet. In der Matrix, dem inneren Raum des Mitochondriums, wird vom Pyruvat ein Kohlenstoffdioxid abgespalten. Der übrig bleibende Rest mit zwei Kohlenstoffatomen verbindet sich mit dem Coenzym A zum Acetyl-CoA. Gleichzeitig wird erneut NADH gebildet.

Dieser Schritt heisst oxidative Decarboxylierung. Das erste Wort steht dafür, dass dem Pyruvat Wasserstoff entzogen wird, das zweite dafür, dass eine Carboxylgruppe als Kohlenstoffdioxid abgespalten wird. Das Acetyl-CoA ist die Eintrittsstelle für den nächsten Abschnitt.

5. Der Citratzyklus in der Matrix

Der Citratzyklus läuft ebenfalls in der Matrix der Mitochondrien ab. Zuerst verbindet sich das Acetyl-CoA mit dem Molekül Oxalacetat zu Citrat, das Citrat hat sechs Kohlenstoffatome. Danach wird das Citrat in mehreren Reaktionen schrittweise umgebaut. Dabei werden zwei Moleküle Kohlenstoffdioxid abgespalten, und am Ende des Kreislaufs steht wieder Oxalacetat bereit, sodass der Zyklus von vorn beginnen kann.

Bei jedem Umlauf entstehen drei Moleküle NADH, ein Molekül FADH2 und ein Molekül ATP oder das ähnliche GTP. Weil aus einer Glucose zwei Acetyl-CoA entstehen, läuft der Zyklus pro Glucose zweimal. Das Kohlenstoffdioxid, das wir ausatmen, stammt also aus der oxidativen Decarboxylierung und aus dem Citratzyklus. Sauerstoff wird in diesem Abschnitt noch nicht verbraucht, doch der Zyklus steht still, wenn die Atmungskette keinen Sauerstoff erhält.

6. Die Atmungskette an der inneren Membran

Die Atmungskette sitzt in der inneren Membran der Mitochondrien. Diese Membran ist stark gefaltet, die Falten heissen Cristae. Durch die Faltung wird die Oberfläche gross, und es haben viele Enzymkomplexe Platz. Die Atmungskette besteht aus mehreren Proteinkomplexen, durch die Elektronen wie über Treppenstufen weitergereicht werden.

NADH und FADH2 geben ihre Wasserstoffatome an diese Komplexe ab. Die frei werdende Energie wird genutzt, um Protonen aus der Matrix in den Intermembranraum zu pumpen. So entsteht ein Protonengefälle, vergleichbar mit Wasser, das hinter einem Staudamm aufgestaut wird. Die Protonen fliessen durch das Enzym ATP-Synthase zurück in die Matrix. Dieser Rückfluss treibt die ATP-Synthase an, ähnlich wie eine Turbine, und das Enzym stellt dabei ATP aus ADP und Phosphat her.

Am Ende der Kette nimmt Sauerstoff die Elektronen und Protonen auf und bildet damit Wasser. Sauerstoff ist also der letzte Elektronenakzeptor. Fehlt der Sauerstoff, staut sich die Kette zurück, und die Zelle kann kaum noch ATP auf diesem Weg herstellen.

7. Bilanz und Gärung

Zählt man alles zusammen, ergibt sich pro Glucose eine Ausbeute von etwa 30 bis 32 ATP. Der grösste Teil davon stammt aus der Atmungskette. Die Glykolyse und der Citratzyklus liefern direkt nur wenige ATP, ihre wichtige Leistung ist die Bereitstellung von NADH und FADH2.

Wenn kein Sauerstoff vorhanden ist, kann die Zelle die Atmungskette nicht betreiben. Dann bleibt ihr die Gärung. Dabei läuft nur die Glykolyse, und das gebildete NADH wird auf das Pyruvat übertragen, damit der Überträger NAD wieder zur Verfügung steht. In unseren Muskelzellen entsteht auf diese Weise Milchsäure, in Hefezellen entstehen Ethanol und Kohlenstoffdioxid. Die Gärung liefert nur zwei ATP pro Glucose und ist damit deutlich weniger ergiebig als die Zellatmung.

Auch Fette und Eiweisse können zur Energiegewinnung abgebaut werden. Fettsäuren werden in Stücke mit je zwei Kohlenstoffatomen zerlegt, die als Acetyl-CoA direkt in den Citratzyklus eintreten. Weil Fette viele Wasserstoffatome enthalten, liefern sie pro Gramm mehr ATP als Zucker. Bei Aminosäuren wird zuerst die Aminogruppe abgespalten, der Rest tritt an verschiedenen Stellen in den Citratzyklus ein.`;

/* ---------------------------------- Beispiele für «Beispiel ausprobieren» ---------------------------------- */
// Text in Seiten teilen: jede nummerierte Überschrift beginnt eine neue Seite
const toPages = t => t.split(/\n(?=\d+\. )/).map((x, i) => ({ n: i + 1, text: x.trim(), file: 'f1' }));
export const SAMPLE_PAGES = toPages(SAMPLE_TEXT);

export const SAMPLE_MATH = `1. Geschwindigkeit

Die Geschwindigkeit sagt, wie schnell sich ein Körper bewegt. Sie ergibt sich, wenn man die zurückgelegte Strecke durch die dafür benötigte Zeit teilt. Wer in einer Stunde hundert Kilometer fährt, ist schneller als jemand, der in derselben Zeit nur fünfzig Kilometer schafft. Im Alltag gibt man sie meistens in Kilometern pro Stunde an, in der Physik rechnet man häufig mit Metern pro Sekunde.

Formel: $v = \\frac{s}{t}$ (v: Geschwindigkeit, s: Strecke, t: Zeit)

Beispiel: Gegeben s = 150 m und t = 30 s. Gesucht ist v. Rechnung: v = 150 / 30 = 5 m/s.

2. Dichte

Die Dichte beschreibt, wie viel Masse in einem bestimmten Volumen steckt. Ein Stück Blei ist viel schwerer als ein gleich grosses Stück Holz, weil Blei eine höhere Dichte besitzt. Die Dichte eines Stoffes bleibt gleich, egal wie gross das Stück ist. Man erhält sie, indem man die Masse durch das Volumen teilt.

Formel: $\\rho = \\frac{m}{V}$ (ρ: Dichte, m: Masse, V: Volumen)

Beispiel: Gegeben m = 800 g und V = 2 cm³. Gesucht ist ρ. Rechnung: ρ = 800 / 2 = 400 g/cm³.

3. Kraft

Eine Kraft kann einen Körper beschleunigen, abbremsen oder verformen. Je grösser die Masse eines Körpers ist, desto mehr Kraft braucht man, um seine Geschwindigkeit zu ändern. Die Einheit der Kraft ist das Newton. Ein Newton beschleunigt eine Masse von einem Kilogramm in jeder Sekunde um einen Meter pro Sekunde.

Formel: $F = m \\cdot a$ (F: Kraft, m: Masse, a: Beschleunigung)

Beispiel: Gegeben m = 4 kg und a = 3 m/s². Gesucht ist F. Rechnung: F = 4 * 3 = 12 N.

4. Druck

Der Druck gibt an, wie stark eine Kraft auf eine bestimmte Fläche wirkt. Dieselbe Kraft erzeugt auf einer kleinen Fläche einen grossen Druck und auf einer grossen Fläche einen kleinen Druck. Deshalb sinkt man mit Schuhen im Schnee tiefer ein als mit breiten Skiern. Der Druck ist der Quotient aus Kraft und Fläche.

Formel: $p = \\frac{F}{A}$ (p: Druck, F: Kraft, A: Fläche)

Beispiel: Gegeben F = 600 N und A = 3 m². Gesucht ist p. Rechnung: p = 600 / 3 = 200 N/m².

5. Arbeit

In der Physik wird Arbeit verrichtet, wenn eine Kraft einen Körper über eine Strecke bewegt. Wer eine Kiste nur festhält, ohne sie zu bewegen, verrichtet im physikalischen Sinn keine Arbeit. Die Arbeit ist umso grösser, je grösser die Kraft und je länger der Weg ist. Gemessen wird sie in Joule.

Formel: $W = F \\cdot s$ (W: Arbeit, F: Kraft, s: Weg)

Beispiel: Gegeben F = 50 N und s = 4 m. Gesucht ist W. Rechnung: W = 50 * 4 = 200 J.`;
export const SAMPLE_MATH_PAGES = toPages(SAMPLE_MATH);
