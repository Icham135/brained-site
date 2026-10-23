// Brained Clarity – Etappen-Player (Screen 5): Fokus-Modus, verkettete Bausteine, Abschluss. Bauplan: docs/CLARITY-BAUPLAN.md §1, Formen: docs/CLARITY-BLOECKE.md
// Zustand: ui().player (nur Oberfläche, flüchtig) · persistent: concept.blocks / concept.progress / concept.score / concept.status
import { esc } from './ui.js';
import { ui, curCourse, saveCourse, friendlyErr } from './clarity.js';
import * as ENG from './clarity-engine.js';
import * as AI from './clarity-ai.js';
import { voiceSupported, startVoice, stopVoice } from './voice.js';
import { isClean, CLEAN_MSG } from './moderation.js';

let CTX = null;
const rr = () => window.dispatchEvent(new Event('brained:rerender'));
const P = () => ui().player;
const pause = ms => new Promise(r => setTimeout(r, ms));
const clamp01 = x => Math.max(0, Math.min(1, +x || 0));

/* ---------------------------------- Formeln (KaTeX lokal, bei Bedarf geladen) ---------------------------------- */
let katexState = 0;
function loadKatex() {
  if (katexState) return; katexState = 1;
  try {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./vendor/katex/katex.min.css', import.meta.url).href; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = new URL('./vendor/katex/katex.min.js', import.meta.url).href;
    s.onload = () => { katexState = 2; rr(); }; s.onerror = () => { katexState = 3; };
    document.head.appendChild(s);
  } catch { katexState = 3; }
}
// Nur $…$-Segmente gehen durch KaTeX (trust:false); alles andere wird escaped. Bis KaTeX da ist: Klartext in <code>.
function tex(src) {
  loadKatex();
  if (katexState === 2 && window.katex) { try { return window.katex.renderToString(src, { throwOnError: false, trust: false, output: 'html' }); } catch { } }
  return `<code class="clp-tex">${esc(src)}</code>`;
}
export function rich(s) {
  const t = String(s ?? '');
  return t.split(/(\$[^$\n]+\$)/g).map(p => p.length > 2 && p[0] === '$' && p.endsWith('$') ? tex(p.slice(1, -1)) : esc(p).replace(/\n/g, '<br>')).join('');
}
const formula = f => { const t = String(f ?? '').trim(); return /^\$[\s\S]*\$$/.test(t) ? rich(t) : tex(t); };
const L = i => String.fromCharCode(65 + i);

/* ---------------------------------- Engine-Adapter (Namespace-Import: fehlt eine Funktion, greift ein lokaler Rückfall) ---------------------------------- */
const TYPES = ['ESSENCE_AND_TRAP', 'MULTIPLE_CHOICE', 'CLOZE_TEXT', 'MATCHING_AND_ORDER', 'OPEN_QUESTION_VOICE', 'STEP_CALCULATION'];
const NAME = { ESSENCE_AND_TRAP: 'Basistext', MULTIPLE_CHOICE: 'Multiple Choice', CLOZE_TEXT: 'Lückentext', MATCHING_AND_ORDER: 'Zuordnen', OPEN_QUESTION_VOICE: 'Offene Frage', STEP_CALCULATION: 'Rechnen' };
function localChain(c) {
  const t = ['MULTIPLE_CHOICE']; if (c.needsCalc) t.push('STEP_CALCULATION'); t.push('CLOZE_TEXT', 'MATCHING_AND_ORDER', 'OPEN_QUESTION_VOICE');
  return c.triage === 'check' ? t : ['ESSENCE_AND_TRAP', ...t];
}
// → Indizes in concept.blocks in Reihenfolge der Kette
export function chainIdx(c) {
  const blocks = c.blocks || []; let types;
  try { types = ENG.chainFor ? ENG.chainFor(c) : null; } catch { types = null; }
  if (!Array.isArray(types)) types = localChain(c);
  types = types.map(x => typeof x === 'string' ? x : x?.type).filter(t => TYPES.includes(t));
  const used = new Set(), out = [];
  for (const t of types) { const i = blocks.findIndex((b, k) => b?.type === t && !used.has(k)); if (i >= 0) { used.add(i); out.push(i); } }
  return out;
}
const numOf = x => typeof x === 'number' ? x : (x && typeof x === 'object' ? (x.now ?? x.current ?? x.grade ?? x.value ?? x.note) : NaN);
function localWP(course) {
  const cs = course.concepts || [], tot = cs.reduce((a, c) => a + (+c.weightPercent || 0), 0) || 1;
  return cs.reduce((a, c) => a + (+c.weightPercent || 0) * (c.score != null ? c.score : c.triage === 'known' ? .9 : c.triage === 'check' ? .5 : 0), 0) / tot;
}
// Gesamtfortschritt in Prozent (0–100) und geschätzte Note
function snapshot(course) {
  let pct, grade;
  try { pct = ENG.weightedProgress ? +ENG.weightedProgress(course) : localWP(course) * 100; } catch { pct = localWP(course) * 100; }
  try { grade = numOf(ENG.gradePrognosis ? ENG.gradePrognosis(course) : NaN); } catch { grade = NaN; }
  if (!Number.isFinite(grade)) grade = Math.round((1 + 5 * pct / 100) * 10) / 10;
  return { pct, grade };
}
const fmtGrade = (course, g) => { try { const s = ENG.formatGrade?.(course?.grading?.country, course?.grading?.scale, g); if (s != null) return String(s); } catch { } return (Math.round(g * 10) / 10).toFixed(1); };

/* ---------------------------------- Auswertung der Bausteine (lokal, Teilpunkte 0..1) ---------------------------------- */
const blank = (a, s) => ENG.blankOk ? ENG.blankOk(a, s) : String(a || '').trim().toLowerCase() === String(s).split('|')[0].trim().toLowerCase();
const numeq = (a, s, t) => ENG.numEq ? ENG.numEq(a, s, t) : Math.abs(parseFloat(String(a).replace(',', '.')) - s) <= Math.abs(s) * (t ?? .01);
const shuffle = (n, seed) => ENG.seedShuffle ? ENG.seedShuffle(n, seed) : Array.from({ length: n }, (_, i) => (i + 1) % n);
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const blanksOf = text => String(text || '').split('___');
export function gradeClozeP(c, fill, chips) {
  const ans = c.answers || []; return ans.length ? ans.filter((s, k) => fill[k] != null && blank(chips[fill[k]], s)).length / ans.length : 1;
}
export const pairsOrder = c => shuffle((c.pairs || []).length, hash((c.pairs || []).map(p => p.l).join('|')));   // rechte Spalte: Position → Paar-Index
export const gradePairsP = (c, map) => { const n = (c.pairs || []).length; return n ? Object.entries(map).filter(([l, r]) => +l === +r).length / n : 1; };
export const orderStart = c => shuffle((c.items || []).length, hash((c.items || []).join('|')));   // Start-Anordnung: Position → Schritt-Index
export const gradeOrderP = (c, list) => { const n = (c.items || []).length; return n ? list.filter((x, i) => x === i).length / n : 1; };
const chipsOf = c => Array.isArray(c.chips) && c.chips.length ? c.chips : shuffle((c.answers || []).length, 3).map(i => String((c.answers || [])[i] || '').split('|')[0]);

// Punkte eines Bausteins 0..1 (Engine: blockScore; lokaler Rückfall mit denselben Regeln)
export function scoreOf(b, s) {
  const c = b.content || {}; let ans, loc;
  switch (b.type) {
    case 'MULTIPLE_CHOICE': ans = s.sel || []; loc = (c.items || []).length ? (c.items || []).filter((q, k) => ans[k] === q.correct).length / c.items.length : 0; break;
    case 'CLOZE_TEXT': { const ch = chipsOf(c); ans = (s.fill || []).map(f => f == null ? '' : ch[f]); loc = gradeClozeP(c, s.fill || [], ch); break; }
    case 'MATCHING_AND_ORDER': ans = c.mode === 'order' ? (s.list || []) : (s.map || {}); loc = c.mode === 'order' ? gradeOrderP(c, ans) : gradePairsP(c, ans); break;
    case 'STEP_CALCULATION': { const n = (c.givens || []).length; ans = { formula: s.formula, givens: Object.keys(s.use || {}).filter(k => s.use[k]).map(Number), result: s.num };
      loc = ((s.ok?.[0] ? .3 : 0) + (s.ok?.[1] ? .3 : 0) + (s.ok?.[2] ? .4 : 0)); void n; break; }
    case 'OPEN_QUESTION_VOICE': ans = { points: s.ev?.points }; loc = clamp01(s.ev?.points); break;
    default: return null;
  }
  try { const v = ENG.blockScore?.(b, ans); if (typeof v === 'number' && isFinite(v)) return clamp01(v); } catch { }
  return loc;
}

/* ---------------------------------- Laden der Etappe ---------------------------------- */
function stateFor(cid) { return { cid, status: 'init', err: '', chain: [], pos: 0, st: {}, leave: false, before: null, after: null, score: null }; }
function firstOpen(c, chain) { const pr = c.progress || {}; const i = chain.findIndex(k => !pr[k]?.done); return i < 0 ? 0 : i; }
function begin(p, c, course) {
  p.chain = chainIdx(c); if (!p.chain.length) { p.status = 'err'; p.err = 'Zu dieser Etappe gibt es noch keine Aufgaben. Versuche es nochmals.'; return; }
  c.progress ||= {}; if (p.chain.every(k => c.progress[k]?.done)) c.progress = {};   // abgeschlossene Etappe wiederholen
  p.pos = firstOpen(c, p.chain); p.st = {}; p.before = snapshot(course); p.status = 'play';
  if (c.status === 'open') c.status = 'inprogress'; saveCourse();
  try { AI.prefetchNext?.(course)?.catch?.(() => { }); } catch { }
}
async function load(p) {
  const course = curCourse(), c = course?.concepts?.find(x => x.id === p.cid);
  if (!c) { p.status = 'err'; p.err = 'Diese Etappe wurde nicht gefunden.'; rr(); return; }
  p.status = 'loading'; p.err = '';
  try {
    const simu = globalThis.__claritySim || {};   // Test-/Konsolen-Hooks: genError (Text) · genBlocks (Funktion) · evalOpen (Funktion)
    if (!Array.isArray(c.blocks) || !c.blocks.length) {
      if (simu.genError) throw new Error(simu.genError);
      if (typeof simu.genBlocks === 'function') { c.blocks = await simu.genBlocks(course, c.id); saveCourse(); }
      else if (!AI.generateBlocks) throw new Error('Die Etappen-Erzeugung ist noch nicht verfügbar.');
      else {
        const bl = await AI.generateBlocks(course, c.id, { first: true });   // lange Etappen: Durchgang 1 sofort, weitere laufen im Hintergrund weiter
        if (P() !== p) return;   // inzwischen verlassen
        if (!Array.isArray(bl) || !bl.length) throw new Error('bad');
        if (!Array.isArray(c.blocks) || !c.blocks.length) c.blocks = bl;
        saveCourse();
      }
    }
    begin(p, c, course);
  } catch (e) { if (P() !== p) return; p.status = 'err'; p.err = friendlyErr(e, 'Die Etappe'); }
  rr();
}
// Aufruf aus der Ansicht: legt den Zustand an und startet das Laden, sobald ein Konzept gewählt ist
function ensure() {
  const u = ui(), cid = u.conceptId;
  if (!u.player || u.player.cid !== cid) { u.player = stateFor(cid); }
  const p = u.player; if (p.status === 'init') { p.status = 'loading'; setTimeout(() => load(p), 0); }
  return p;
}

/* ---------------------------------- Bausteine: Ansichten ---------------------------------- */
const btn = (a, label, { cls = '', dis = false, d = {} } = {}) => `<button type="button" class="clp-btn ${cls}" data-a="${a}"${Object.entries(d).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${dis ? ' disabled' : ''}>${label}</button>`;
const fb = (ok, title, text = '') => `<div class="clp-fb ${ok ? 'good' : 'bad'}" role="status"><b>${ok ? '✓' : '✗'} ${esc(title)}</b>${text ? `<span>${rich(text)}</span>` : ''}</div>`;
const pct = x => Math.round(clamp01(x) * 100);

function vEssence(b) {
  const c = b.content || {}, pts = c.points || [], fs = c.formulas || [], tr = c.trap || {};
  return `<h2 class="clp-h">Das Wichtigste in Kürze</h2>
  <ul class="clp-points">${pts.map(x => `<li>${x.h ? `<b>${rich(x.h)}</b> ` : ''}${rich(x.t ?? x)}</li>`).join('')}</ul>
  ${fs.length ? `<div class="clp-formulas" aria-label="Formeln">${fs.map(f => `<div class="clp-formula">${formula(f)}</div>`).join('')}</div>` : ''}
  <div class="clp-trap" role="note"><b><svg class="clp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/></svg>Typische Prüfungsfalle: ${tr.title ? esc(tr.title) : ''}</b><p>${rich(tr.text ?? '')}</p></div>`;
}
function vMc(b, p) {
  const items = b.content?.items || [], s = p.st; s.i ||= 0; s.sel ||= []; const q = items[s.i]; if (!q) return '';
  const sel = s.sel[s.i], done = sel != null;
  return `<h2 class="clp-h">Frage ${s.i + 1} von ${items.length}</h2><p class="clp-q">${rich(q.q)}</p>
  <div class="clp-opts" role="group">${(q.options || []).map((o, k) => {
    const right = k === q.correct, mine = sel === k, st = !done ? '' : right ? 'good' : mine ? 'bad' : 'dim';
    return `<div class="clp-opt-w"><button type="button" class="clp-opt ${st}" data-a="clarityPlayMcPick" data-o="${k}"${done ? ' disabled' : ''}><i>${L(k)}</i><span>${rich(o)}</span>${done && (right || mine) ? `<em>${right ? '✓ richtig' : '✗ falsch'}</em>` : ''}</button>
    ${done && q.why?.[k] ? `<p class="clp-why ${right ? 'good' : mine ? 'bad' : ''}">${rich(q.why[k])}</p>` : ''}</div>`;
  }).join('')}</div>
  ${done ? fb(sel === q.correct, sel === q.correct ? 'Richtig!' : 'Nicht ganz.', sel === q.correct ? '' : `Richtig ist ${L(q.correct)}.`) : ''}`;
}
function vCloze(b, p) {
  const c = b.content || {}, s = p.st, parts = blanksOf(c.text), chips = chipsOf(c), n = parts.length - 1; s.fill ||= Array(n).fill(null);
  if (s.act == null) s.act = Math.max(0, s.fill.findIndex(x => x == null));
  const used = new Set(s.fill.filter(x => x != null));
  const bl = k => { const f = s.fill[k], ok = s.checked ? blank(chips[f], c.answers?.[k] ?? '') : null;
    return `<button type="button" class="clp-blank ${f == null ? 'empty' : ''} ${k === s.act && !s.checked ? 'act' : ''} ${ok === true ? 'good' : ok === false ? 'bad' : ''}" data-a="clarityPlayBlank" data-k="${k}"${s.checked ? ' disabled' : ''} aria-label="Lücke ${k + 1}">${f == null ? `<span>${k + 1}</span>` : rich(chips[f])}${ok === true ? ' ✓' : ok === false ? ' ✗' : ''}</button>`; };
  const wrong = s.checked ? s.fill.map((f, k) => blank(chips[f], c.answers?.[k] ?? '') ? '' : `<li>Lücke ${k + 1}: ${rich(String(c.answers?.[k] ?? '').split('|')[0])}</li>`).join('') : '';
  return `<h2 class="clp-h">Setze die fehlenden Begriffe ein</h2>
  <p class="clp-cloze">${parts.map((t, k) => rich(t) + (k < n ? bl(k) : '')).join('')}</p>
  <div class="clp-chips" role="group" aria-label="Wörter zum Einsetzen">${chips.map((t, i) => `<button type="button" class="clp-chip ${used.has(i) ? 'used' : ''}" data-a="clarityPlayChip" data-i="${i}"${used.has(i) || s.checked ? ' disabled' : ''}>${rich(t)}</button>`).join('')}</div>
  ${!s.checked ? `<p class="clp-hint">Tippe eine Lücke an und dann ein Wort. Eine gefüllte Lücke leerst du mit Antippen.</p>` : ''}
  ${s.checked ? fb(s.score === 1, s.score === 1 ? 'Alles richtig!' : `${s.fill.filter((f, k) => blank(chips[f], c.answers?.[k] ?? '')).length} von ${n} richtig`, wrong ? '' : '') + (wrong ? `<div class="clp-sol"><b>Richtig wäre:</b><ul>${wrong}</ul></div>` : '') + (c.explain ? `<p class="clp-expl">${rich(c.explain)}</p>` : '') : ''}`;
}
function vMatch(b, p) {
  const c = b.content || {}, s = p.st;
  if (c.mode === 'order') {
    const items = c.items || []; s.list ||= orderStart(c);
    return `<h2 class="clp-h">Bringe die Schritte in die richtige Reihenfolge</h2>${c.prompt ? `<p class="clp-q">${rich(c.prompt)}</p>` : ''}
    <ol class="clp-order">${s.list.map((it, i) => { const ok = s.checked ? it === i : null;
      return `<li class="clp-ord ${ok === true ? 'good' : ok === false ? 'bad' : ''}" data-row="${i}"><span class="clp-grip" data-drag="${i}" aria-hidden="true">⋮⋮</span><span class="clp-n">${i + 1}</span><span class="clp-ot">${rich(items[it])}</span>${s.checked ? `<em>${ok ? '✓' : '✗'}</em>` : `<span class="clp-mv"><button type="button" aria-label="Nach oben" data-a="clarityPlayMove" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>▲</button><button type="button" aria-label="Nach unten" data-a="clarityPlayMove" data-i="${i}" data-d="1"${i === s.list.length - 1 ? ' disabled' : ''}>▼</button></span>`}</li>`; }).join('')}</ol>
    ${!s.checked ? '<p class="clp-hint">Ziehe an den Punkten oder nutze die Pfeile.</p>' : fb(s.score === 1, s.score === 1 ? 'Richtige Reihenfolge!' : `${Math.round(s.score * items.length)} von ${items.length} am richtigen Platz`) + (s.score < 1 ? `<div class="clp-sol"><b>Richtig wäre:</b><ol>${items.map(t => `<li>${rich(t)}</li>`).join('')}</ol></div>` : '')}`;
  }
  const pairs = c.pairs || []; s.map ||= {}; const R = pairsOrder(c), linkOfR = r => { const l = Object.keys(s.map).find(k => s.map[k] === r); return l == null ? null : +l; };
  return `<h2 class="clp-h">Ordne die Paare zu</h2>${c.prompt ? `<p class="clp-q">${rich(c.prompt)}</p>` : ''}
  <div class="clp-pairs"><div class="clp-col">${pairs.map((x, l) => { const r = s.map[l], ok = s.checked ? r === l : null;
    return `<button type="button" class="clp-pi ${s.selL === l ? 'sel' : ''} ${r != null ? 'linked' : ''} ${ok === true ? 'good' : ok === false ? 'bad' : ''}" data-a="clarityPlayMatchL" data-i="${l}"${s.checked ? ' disabled' : ''}><b>${r != null ? l + 1 : ''}</b><span>${rich(x.l)}</span>${s.checked ? `<em>${ok ? '✓' : '✗'}</em>` : ''}</button>`; }).join('')}</div>
  <div class="clp-col">${R.map((r, j) => { const l = linkOfR(r);
    return `<button type="button" class="clp-pi ${l != null ? 'linked' : ''}" data-a="clarityPlayMatchR" data-j="${j}"${s.checked ? ' disabled' : ''}><b>${l != null ? l + 1 : ''}</b><span>${rich(pairs[r].r)}</span></button>`; }).join('')}</div></div>
  ${!s.checked ? '<p class="clp-hint">Tippe links einen Begriff an, dann rechts die passende Seite. Zahlen zeigen, was zusammengehört. Verbundenes antippen löst es wieder.</p>'
    : fb(s.score === 1, s.score === 1 ? 'Alle Paare stimmen!' : `${Math.round(s.score * pairs.length)} von ${pairs.length} Paaren richtig`) + (s.score < 1 ? `<div class="clp-sol"><b>Richtig wäre:</b><ul>${pairs.map(x => `<li>${rich(x.l)} → ${rich(x.r)}</li>`).join('')}</ul></div>` : '')}`;
}
function vOpen(b, p) {
  const c = b.content || {}, s = p.st, sup = voiceSupported(); s.text ??= '';
  const ev = s.ev;
  return `<h2 class="clp-h">Offene Prüfungsfrage</h2><p class="clp-q">${rich(c.q)}</p>
  ${ev ? '' : sup ? `<button type="button" class="clp-mic ${s.rec ? 'rec' : ''}" data-a="clarityPlayMic" aria-pressed="${s.rec ? 'true' : 'false'}"${s.busy ? ' disabled' : ''}><span class="clp-mic-i" aria-hidden="true">${s.rec ? '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'}</span><span>${s.rec ? 'Aufnahme läuft – tippen zum Beenden' : 'Antwort einsprechen'}</span></button>
    <p class="clp-priv">Es wird keine Audiodatei gespeichert oder an Brained geschickt. Die Spracherkennung läuft über dein Gerät (Apple bzw. Google); nur der erkannte Text landet im Feld.</p>`
    : '<p class="clp-hint">Spracheingabe ist hier nicht verfügbar. Tippe deine Antwort einfach ein.</p>'}
  ${s.voiceErr ? `<p class="clp-err" role="alert">${esc(s.voiceErr)}</p>` : ''}
  <label class="clp-lab" for="clp-ans">Deine Antwort${s.rec ? ' <i class="clp-live" aria-hidden="true"></i>' : ''}</label>
  <textarea id="clp-ans" class="clp-ta ${s.rec ? 'rec' : ''}" rows="6" data-bind="clarity.player.st.text" placeholder="Schreibe oder sprich deine Antwort in eigenen Worten …"${ev || s.busy ? ' readonly' : ''}>${esc(s.text)}</textarea>
  ${s.busy ? '<p class="clp-hint" role="status"><i class="clp-spin" aria-hidden="true"></i> Brainy wertet deine Antwort aus …</p>' : ''}
  ${s.err ? `<div class="clp-fb bad" role="alert"><b>${s.short ? '✗ Noch zu kurz' : '✗ Auswertung nicht möglich'}</b><span>${esc(s.err)}${s.short ? '' : ' Deine Antwort bleibt erhalten.'}</span></div>` : ''}
  ${ev ? `<div class="clp-cps"><h3>Key-Checkpoints</h3><ul>${ev.checkpoints.map(k => `<li class="${k.hit ? 'hit' : 'miss'}"><i aria-hidden="true">${k.hit ? '✓' : '＋'}</i><span><b>${k.hit ? 'Genannt' : 'Sanft ergänzt'}:</b> ${rich(k.text)}</span></li>`).join('')}</ul></div>
    ${ev.feedback ? `<p class="clp-expl">${rich(ev.feedback)}</p>` : ''}
    <details class="clp-sample"><summary>Musterantwort anzeigen</summary><p>${rich(c.sample ?? '')}</p></details>` : ''}`;
}
function vCalc(b, p) {
  const c = b.content || {}, s = p.st; s.stage ||= 0; s.chk ||= {}; s.ok ||= {}; s.use ||= {}; s.num ??= '';
  const gv = c.givens || [], ex = c.extraGivens || [], all = [...gv.map((g, i) => ({ ...g, need: true, k: i })), ...ex.map((g, i) => ({ ...g, need: false, k: gv.length + i }))];
  const order = shuffle(all.length, hash(c.task || 'calc')), row = (g, st) => `${g.symbol ? `<b>${rich(g.symbol.includes('$') ? g.symbol : '$' + g.symbol + '$')}</b> ` : ''}${rich(g.label)} = <b>${esc(g.value)}${g.unit ? ' ' + rich(g.unit) : ''}</b>`;
  const steps = ['Formel wählen', 'Grössen zuordnen', 'Ergebnis berechnen'];
  const head = `<h2 class="clp-h">Musteraufgabe</h2><p class="clp-q">${rich(c.task)}</p><ol class="clp-steps">${steps.map((t, i) => `<li class="${i === s.stage ? 'cur' : i < s.stage ? 'done' : ''}"${i === s.stage ? ' aria-current="step"' : ''}>${i + 1}. ${t}</li>`).join('')}</ol>`;
  let body = '';
  if (s.stage === 0) {
    body = `<p class="clp-hint">Welche Formel passt zu dieser Aufgabe?</p><div class="clp-opts">${(c.formulaOptions || []).map((f, k) => { const right = k === c.correctFormula, mine = s.formula === k, st = !s.chk[0] ? (mine ? 'sel' : '') : right ? 'good' : mine ? 'bad' : 'dim';
      return `<button type="button" class="clp-opt ${st}" data-a="clarityPlayFormula" data-o="${k}"${s.chk[0] ? ' disabled' : ''}><i>${L(k)}</i><span>${formula(f)}</span>${s.chk[0] && (right || mine) ? `<em>${right ? '✓ richtig' : '✗ falsch'}</em>` : ''}</button>`; }).join('')}</div>`
      + (s.chk[0] ? fb(s.ok[0], s.ok[0] ? 'Richtige Formel!' : 'Diese Formel passt nicht.', s.ok[0] ? '' : `Richtig ist ${L(c.correctFormula)}.`) : '');
  } else if (s.stage === 1) {
    body = `<p class="clp-hint">Tippe an, was du für die Rechnung brauchst. Nicht alles ist nötig.</p><div class="clp-giv">${order.map(i => { const g = all[i], on = !!s.use[g.k], st = !s.chk[1] ? (on ? 'sel' : '') : g.need ? (on ? 'good' : 'bad') : (on ? 'bad' : 'dim');
      return `<button type="button" class="clp-opt clp-gv ${st}" data-a="clarityPlayGiven" data-k="${g.k}" aria-pressed="${on}"${s.chk[1] ? ' disabled' : ''}><i>${on ? '✓' : ''}</i><span>${row(g)}</span>${s.chk[1] ? `<em>${g.need ? (on ? '✓ nötig' : '✗ fehlt') : (on ? '✗ unnötig' : 'nicht nötig')}</em>` : ''}</button>`; }).join('')}</div>`
      + (s.chk[1] ? fb(s.ok[1], s.ok[1] ? 'Genau die richtigen Grössen!' : 'Nicht ganz.', s.ok[1] ? '' : 'Nötige Werte fehlten oder unnötige waren dabei – siehe Markierung.') : '');
  } else {
    const r = c.result || {};
    body = `<p class="clp-hint">Rechne mit den gewählten Grössen und gib das Ergebnis ein${r.unit ? ' (Einheit rechts)' : ''}.</p>
    <div class="clp-numrow"><input class="clp-num" type="text" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Ergebnis" data-bind="clarity.player.st.num" value="${esc(s.num)}" placeholder="Ergebnis"${s.chk[2] ? ' readonly' : ''}>${r.unit ? `<span class="clp-unit">${rich(r.unit)}</span>` : ''}</div>
    ${s.chk[2] ? '' : `<div class="clp-mathbar" role="group" aria-label="Zeichen">${['−', ',', '²', '³', '√', 'π', '·', '÷', '(', ')', '^', '/'].map(ch => `<button type="button" data-a="clarityPlayIns" data-ch="${esc(ch)}">${esc(ch)}</button>`).join('')}</div>`}
    ${s.hint && !s.chk[2] ? '<p class="clp-err" role="alert">Gib zuerst dein Ergebnis ein.</p>' : ''}
    ${s.chk[2] ? fb(s.ok[2], s.ok[2] ? 'Richtig gerechnet!' : 'Nicht ganz.', s.ok[2] ? '' : `Das Ergebnis ist ${r.value} ${r.unit || ''}`.trim()) : ''}`;
  }
  const sol = s.chk[2] ? `<div class="clp-sol"><b>So kommst du zur Lösung:</b><ol>${(c.solution || []).map(t => `<li>${rich(t)}</li>`).join('')}</ol></div>` : '';
  return head + body + sol;
}

// BASISTEXT (Helfer B) ----------------------------------------------------------------------------------------------------------
// Lernprinzip: erst den Basistext lesen, danach genau das Gelesene üben. Daten: concept.basis (clarity-ai.js: ensureBasis) bzw. Inhalt des Bausteins
// ESSENCE_AND_TRAP (sections, points, formulas, trap). Schnittstelle: basisTextView(etappe) · basisRefNote(etappe, baustein, player) · basisButton(etappe) ·
// basisSheet(player, etappe) · Aktionen basisOpen(sec)/basisClose (als clarityBasisOpen/clarityBasisClose in basisActions). Eigene Stile (clb-*) werden hier eingefügt.
let basisCssDone = false;
function basisCss() {
  if (basisCssDone || typeof document === 'undefined') return; basisCssDone = true;
  const st = document.createElement('style'); st.id = 'clb-css';
  st.textContent = `.clb-meta{margin:0 0 var(--cl-s4);font-size:var(--cl-t-small);color:var(--cl-ink-3)}
.clb-sec{margin:0 0 var(--cl-s5);padding:2px 0}
.clb-sec h3{display:flex;align-items:baseline;gap:10px;margin:0 0 var(--cl-s2);font-size:18px;line-height:1.3;font-weight:800;letter-spacing:-.01em}
.clb-sec h3 span{flex:none;min-width:24px;height:24px;display:inline-grid;place-items:center;border-radius:12px;background:var(--cl-surface-2);color:var(--cl-ink-2);font-size:12px;font-weight:800}
.clb-sec p{margin:0 0 var(--cl-s3);font-size:16px;line-height:1.65;overflow-wrap:anywhere}
.clb-sec.hi{margin-inline:calc(var(--cl-s3) * -1);padding:var(--cl-s3);border-radius:var(--cl-r-m);background:var(--cl-surface);box-shadow:0 0 0 2px var(--cl-accent)}
.clb-sum,.clb-trap{margin:0 0 var(--cl-s4);padding:var(--cl-s4);border:1px solid var(--cl-line);border-radius:var(--cl-r-m);background:var(--cl-surface)}
.clb-sum h3,.clb-trap b{display:block;margin:0 0 var(--cl-s2);font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--cl-ink-3)}
.clb-sum ul{margin:0;padding-left:20px;display:grid;gap:var(--cl-s2)}.clb-sum li{line-height:1.5;overflow-wrap:anywhere}
.clb-trap p{margin:0;line-height:1.55;overflow-wrap:anywhere}.clb-trap strong{display:block;margin-bottom:4px}
.clb-fm{margin:0 0 var(--cl-s4);display:grid;gap:var(--cl-s2);justify-items:center;text-align:center;overflow-x:auto}
.clb-ref{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--cl-s3) 0 0;padding:var(--cl-s2) var(--cl-s3);border-radius:var(--cl-r-m);background:var(--cl-surface-2);font-size:var(--cl-t-small);color:var(--cl-ink-2)}
.clb-ref button{margin-left:auto;min-height:36px;padding:0 4px;border:0;background:transparent;color:var(--cl-accent);font:inherit;font-weight:700;cursor:pointer}
.clb-sheet{position:absolute;inset:0;z-index:6;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,13,19,.5)}
.clb-panel{width:100%;max-width:680px;max-height:90%;display:flex;flex-direction:column;background:var(--cl-bg);color:var(--cl-ink);border-radius:var(--cl-r-l) var(--cl-r-l) 0 0;box-shadow:var(--cl-shadow-2)}
.clb-panel header{display:flex;align-items:center;justify-content:space-between;gap:var(--cl-s3);padding:var(--cl-s3) var(--cl-s4);border-bottom:1px solid var(--cl-line)}
.clb-panel header h3{margin:0;font-size:17px;font-weight:800}
.clb-panel header button{min-height:40px;padding:0 var(--cl-s3);border:1px solid var(--cl-line-2);border-radius:var(--cl-r-m);background:var(--cl-surface-2);color:var(--cl-ink);font:inherit;font-weight:700;cursor:pointer}
.clb-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:var(--cl-s4) var(--cl-s4) calc(env(safe-area-inset-bottom,0px) + var(--cl-s5))}
@media (prefers-reduced-motion:no-preference){.clb-panel{animation:clbUp .22s var(--cl-ease)}}@keyframes clbUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}`;
  document.head.appendChild(st);
}
// Basistext der Etappe: concept.basis, sonst der Inhalt des Bausteins ESSENCE_AND_TRAP (nur wenn er Abschnitte hat; ältere Etappen haben keinen)
export const basisOf = c => c?.basis?.sections?.length ? c.basis : (c?.blocks || []).find(b => b?.type === 'ESSENCE_AND_TRAP' && b.content?.sections?.length)?.content || null;
const bParas = t => String(t || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
function basisContent(b, hi = null) {
  const pts = b.points || [], fs = b.formulas || [], tr = b.trap || {};
  return `${(b.sections || []).map((s, i) => `<section class="clb-sec${hi === i + 1 ? ' hi' : ''}" data-sec="${i + 1}"><h3><span aria-hidden="true">${i + 1}</span>${rich(s.h)}</h3>${bParas(s.t).map(x => `<p>${rich(x)}</p>`).join('')}</section>`).join('')}
  ${pts.length ? `<section class="clb-sum"><h3>Kernaussagen</h3><ul>${pts.map(x => `<li>${x.h ? `<b>${rich(x.h)}</b> ` : ''}${rich(x.t ?? x)}</li>`).join('')}</ul></section>` : ''}
  ${fs.length ? `<div class="clb-fm" aria-label="Formeln">${fs.map(f => `<div>${formula(f)}</div>`).join('')}</div>` : ''}
  ${tr.text ? `<div class="clb-trap" role="note"><b>Typische Prüfungsfalle</b>${tr.title && tr.title !== 'Typische Prüfungsfalle' ? `<strong>${rich(tr.title)}</strong>` : ''}<p>${rich(tr.text)}</p></div>` : ''}`;
}
// Lesesicht: der Basistext der Etappe, Abschnitt für Abschnitt (zentrierte Lesespalte), am Ende Kernaussagen und typische Prüfungsfalle
export function basisTextView(etappe) {
  basisCss(); const b = basisOf(etappe); if (!b) return '';
  const n = (b.sections || []).length, words = b.words || (b.sections || []).reduce((a, s) => a + String(s.t || '').split(/\s+/).length, 0), min = Math.max(1, Math.round(words / (AI.BASIS?.readWpm || 180)));
  return `<h2 class="clp-h">Basistext: das musst du wissen</h2><p class="clb-meta">${n} ${n === 1 ? 'Abschnitt' : 'Abschnitte'} · ca. ${min} Min. Lesezeit · danach setzt du genau das Gelesene in Aufgaben um</p>${basisContent(b)}`;
}
// Bezug der aktuellen Aufgabe (MC: je Frage, sonst je Baustein)
function taskRef(p, c) {
  const b = c?.blocks?.[p?.chain?.[p?.pos]]; if (!b) return null; const ct = b.content || {};
  return (b.type === 'MULTIPLE_CHOICE' ? ct.items?.[p.st?.i || 0]?.ref : ct.ref) || null;
}
// Nach der Antwort: «Siehe Basistext: Abschnitt 2 «Titel» …» mit Knopf, der die Stelle im Basistext öffnet
export function basisRefNote(c, b, p) {
  const s = p?.st || {}, basis = basisOf(c); if (!basis || !b) return '';
  const answered = b.type === 'MULTIPLE_CHOICE' ? s.sel?.[s.i || 0] != null : b.type === 'CLOZE_TEXT' || b.type === 'MATCHING_AND_ORDER' ? !!s.checked : b.type === 'OPEN_QUESTION_VOICE' ? !!s.ev : b.type === 'STEP_CALCULATION' ? !!s.chk?.[s.stage || 0] : false;
  const ref = taskRef(p, c), label = answered && ref ? AI.refLabel?.(basis, ref) : ''; if (!label) return '';
  return `<p class="clb-ref" role="note"><span>${esc(label)}</span><button type="button" data-a="clarityBasisOpen" data-sec="${esc(ref.sec)}">Stelle ansehen</button></p>`;
}
// Knopf «Basistext ansehen» (während der Aufgaben jederzeit)
export function basisButton(c) { return basisOf(c) ? btn('clarityBasisOpen', 'Basistext ansehen', { cls: 'link' }) : ''; }
// Sheet mit dem ganzen Basistext; die Stelle der aktuellen Aufgabe ist hervorgehoben
export function basisSheet(p, c) {
  if (!p?.basis?.open) return ''; basisCss(); const b = basisOf(c); if (!b) return '';
  return `<div class="clb-sheet" role="dialog" aria-modal="true" aria-label="Basistext"><div class="clb-panel"><header><h3>Basistext</h3><button type="button" data-a="clarityBasisClose">Schliessen</button></header><div class="clb-scroll">${basisContent(b, p.basis.sec)}</div></div></div>`;
}
export function basisOpen(sec = null) {
  const p = P(); if (!p) return; const c = curCourse()?.concepts?.find(x => x.id === p.cid), n = +sec || +taskRef(p, c)?.sec || null;
  p.basis = { open: true, sec: n }; if (n) setTimeout(() => document.querySelector(`.clb-sheet [data-sec="${n}"]`)?.scrollIntoView?.({ block: 'start' }), 80);
}
export function basisClose() { const p = P(); if (p) p.basis = { open: false, sec: null }; }
export const basisActions = { clarityBasisOpen(d) { basisOpen(d?.sec); }, clarityBasisClose() { basisClose(); } };
// ENDE BASISTEXT (Helfer B) -----------------------------------------------------------------------------------------------------

/* ---------------------------------- Ansicht ---------------------------------- */
const closeBtn = '<button type="button" class="clp-x" data-a="clarityPlayLeaveAsk" aria-label="Etappe verlassen">×</button>';
const shell = (inner, { title = '', bar = '' } = {}) => `<section class="clp" aria-label="Etappe"><header class="clp-top">${closeBtn}<div class="clp-prog">${bar}</div></header><div class="clp-body">${title}${inner}</div></section>`;
const leaveSheet = `<div class="clp-sheet" role="alertdialog" aria-modal="true" aria-label="Etappe verlassen"><div class="clp-card"><h3>Etappe verlassen?</h3><p>Dein Stand bleibt gespeichert. Du machst später genau hier weiter.</p>
  ${btn('clarityPlayLeaveCancel', 'Weiterlernen')}${btn('clarityPlayLeave', 'Verlassen', { cls: 'ghost' })}</div></div>`;

// Geplante Bausteine der Etappe (Zeitplanung der Engine), mindestens die schon vorhandene Kette
const totalOf = (p, c) => Math.max(p.chain.length, chainPlannedLen(c));
function chainPlannedLen(c) { try { return ENG.chainFor ? ENG.chainFor(c).length : 0; } catch { return 0; } }
// Spätere Durchgänge werden im Hintergrund erzeugt: neue Bausteine hängen sich hinten an die Kette (Indizes der bisherigen bleiben)
function syncChain(p, c) {
  if (p.status !== 'play' && p.status !== 'wait') return;
  const ch = chainIdx(c);
  if (ch.length > p.chain.length && p.chain.every((k, i) => ch[i] === k)) p.chain = ch;
}
function waitView(p, c) {
  const n = totalOf(p, c);
  return `<section class="clp" aria-label="Etappe"><header class="clp-top">${closeBtn}<div class="clp-prog"><div class="clp-bar${n > 14 ? ' many' : ''}" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${p.pos}" aria-label="Fortschritt">${Array.from({ length: n }, (_, i) => `<i class="${i < p.pos ? 'done' : ''}"></i>`).join('')}</div><span class="clp-cnt">${p.pos} von ${n} Bausteinen geschafft</span></div></header>
  <div class="clp-body"><div class="clp-center" role="status" aria-live="polite"><i class="clp-spin big" aria-hidden="true"></i><h2 class="clp-h">Weitere Aufgaben werden vorbereitet …</h2><p class="clp-hint">${esc(c.title)} · gleich geht es weiter.</p></div></div>${p.leave ? leaveSheet : ''}</section>`;
}
export function playerView() {
  const p = ensure(), course = curCourse(), c = course?.concepts?.find(x => x.id === p.cid);
  if (!c) return shell(`<div class="clp-center"><h2 class="clp-h">Etappe nicht gefunden</h2>${btn('clarityPlayLeave', 'Zum Dashboard')}</div>`);
  const ttl = `<p class="clp-kicker">${esc(c.title)}</p>`;
  if (p.status === 'init' || p.status === 'loading') return shell(`<div class="clp-center" role="status" aria-live="polite"><i class="clp-spin big" aria-hidden="true"></i><h2 class="clp-h">Etappe wird vorbereitet …</h2><p class="clp-hint">${esc(c.title)} · ca. ${esc(ENG.formatDuration(ENG.stageMinutes(c)))} · das dauert nur einen Moment.</p></div>`) + (p.leave ? leaveSheet : '');
  if (p.status === 'err') return shell(`<div class="clp-center"><h2 class="clp-h">Das hat nicht geklappt</h2><p class="clp-fb bad" role="alert">${esc(p.err)}</p>${btn('clarityPlayRetry', 'Nochmals versuchen')}${btn('clarityPlayLeave', 'Zum Dashboard', { cls: 'ghost' })}</div>`, { title: ttl }) + (p.leave ? leaveSheet : '');
  if (p.status === 'done') return doneView(p, c, course);
  syncChain(p, c);
  if (p.status === 'wait') return waitView(p, c);
  const idx = p.chain[p.pos], b = c.blocks[idx], n = totalOf(p, c);
  const bar = `<div class="clp-bar${n > 14 ? ' many' : ''}" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${p.pos + 1}" aria-label="Fortschritt">${Array.from({ length: n }, (_, i) => `<i class="${i < p.pos ? 'done' : i === p.pos ? 'cur' : ''}"></i>`).join('')}</div><span class="clp-cnt">Baustein ${p.pos + 1} von ${n} · ${esc(NAME[b?.type] || '')}</span>`;
  let inner = '', act = '', s = p.st, need = '';
  try {
    switch (b.type) {
      case 'ESSENCE_AND_TRAP': if (b.content?.sections?.length) { inner = basisTextView(c); act = btn('clarityPlayPrimary', 'Weiter zu den Aufgaben'); } else { inner = vEssence(b); act = btn('clarityPlayPrimary', 'Verstanden – Weiter zum Check') + btn('clarityPlaySkip', 'Überspringen', { cls: 'link' }); } break;
      case 'MULTIPLE_CHOICE': inner = vMc(b, p); { const it = b.content.items || []; const last = (s.i || 0) >= it.length - 1; act = btn('clarityPlayPrimary', last ? 'Weiter' : 'Nächste Frage', { dis: s.sel?.[s.i || 0] == null }); if (s.sel?.[s.i || 0] == null) need = 'Tippe zuerst eine Antwort an.'; } break;
      case 'CLOZE_TEXT': inner = vCloze(b, p); act = btn('clarityPlayPrimary', s.checked ? 'Weiter' : 'Prüfen', { dis: !s.checked && (s.fill || []).some(x => x == null) }); if (!s.checked && (s.fill || []).some(x => x == null)) need = 'Setze zuerst in alle Lücken ein Wort ein.'; break;
      case 'MATCHING_AND_ORDER': inner = vMatch(b, p); act = btn('clarityPlayPrimary', s.checked ? 'Weiter' : 'Prüfen', { dis: !s.checked && b.content.mode !== 'order' && Object.keys(s.map || {}).length < (b.content.pairs || []).length }); if (!s.checked && b.content.mode !== 'order' && Object.keys(s.map || {}).length < (b.content.pairs || []).length) need = 'Ordne zuerst alle Paare zu.'; break;
      case 'OPEN_QUESTION_VOICE': inner = vOpen(b, p); act = btn('clarityPlayPrimary', s.ev ? 'Weiter' : s.err ? 'Nochmals auswerten' : 'Auswerten', { dis: !s.ev && (s.busy || s.rec) }); break;
      case 'STEP_CALCULATION': inner = vCalc(b, p); act = btn('clarityPlayPrimary', s.chk?.[s.stage || 0] ? ((s.stage || 0) < 2 ? 'Weiter zum nächsten Schritt' : 'Weiter') : 'Prüfen', { dis: !s.chk?.[s.stage || 0] && (s.stage || 0) === 0 && s.formula == null }); if (!s.chk?.[0] && (s.stage || 0) === 0 && s.formula == null) need = 'Wähle zuerst eine Formel.'; break;
      default: inner = '<p>Diesen Baustein können wir nicht anzeigen.</p>'; act = btn('clarityPlaySkip', 'Überspringen');
    }
  } catch (e) { inner = '<p class="clp-fb bad">Dieser Baustein ist unvollständig und wird übersprungen.</p>'; act = btn('clarityPlaySkip', 'Überspringen'); }
  return `<section class="clp" aria-label="Etappe"><header class="clp-top">${closeBtn}<div class="clp-prog">${bar}</div></header>
  <div class="clp-body" data-keep="1"><div class="clp-pane" data-type="${esc(b?.type)}" data-pos="${p.pos}">${ttl}${inner}${basisRefNote(c, b, p)}</div></div>
  <footer class="clp-act">${need ? `<p class="clp-need" role="status">${need}</p>` : ''}${act}${b?.type !== 'ESSENCE_AND_TRAP' ? basisButton(c) : ''}</footer>${basisSheet(p, c)}${p.leave ? leaveSheet : ''}</section>`;
}
function doneView(p, c, course) {
  const d = Math.round(p.after.pct - p.before.pct), up = p.after.grade > p.before.grade + 0.04, good = p.score >= .5;
  const lines = good
    ? `<p class="clp-big">Gesamtfortschritt ${d > 0 ? '+' + d + ' %' : Math.round(p.after.pct) + ' %'}${d > 0 ? ` <span>(neu ${Math.round(p.after.pct)} %)</span>` : ''}</p><p class="clp-big">${up ? 'Geschätzte Note steigt auf' : 'Geschätzte Note'} ${esc(fmtGrade(course, p.after.grade))}</p>`
    : `<p class="clp-big">Noch nicht ganz sicher</p><p class="clp-hint">Mit ${pct(p.score)} % ist die Etappe noch nicht gemeistert. Nochmals versuchen lohnt sich – du kennst jetzt die Stolpersteine.</p>`;
  const nxt = nextOf(course, c);
  return `<section class="clp" aria-label="Etappe abgeschlossen"><header class="clp-top">${closeBtn}<div class="clp-prog"><div class="clp-bar full">${p.chain.map(() => '<i class="done"></i>').join('')}</div></div></header>
  <div class="clp-body"><div class="clp-center clp-done"><div class="clp-medal ${good ? 'good' : 'warn'}" aria-hidden="true">${good ? '✓' : '↻'}</div>
  <h2 class="clp-h big">${good ? 'Etappe gemeistert!' : 'Etappe abgeschlossen'}</h2><p class="clp-kicker">${esc(c.title)} · ${pct(p.score)} % richtig</p>${lines}
  <p class="clp-fine">Die Note ist eine Schätzung auf Basis deiner Ergebnisse.</p></div></div>
  <footer class="clp-act">${!good ? btn('clarityPlayAgain', 'Nochmals versuchen') : nxt ? btn('clarityPlayNext', 'Nächste Etappe') : ''}${btn('clarityPlayDash', 'Zum Dashboard', { cls: good && nxt || !good ? 'ghost' : '' })}</footer>${p.leave ? leaveSheet : ''}</section>`;
}
function nextOf(course, cur) {
  try { const r = ENG.nextConcept?.(course); const x = typeof r === 'string' ? course.concepts.find(k => k.id === r) : r; if (x && x.id !== cur.id) return x; if (x) return null; } catch { }
  return ENG.nextConcept ? null : course.concepts.find(k => k.id !== cur.id && k.status !== 'done' && k.triage !== 'known') || null;
}

/* ---------------------------------- Ablauf ---------------------------------- */
function scrollTop() { requestAnimationFrame(() => { const e = document.querySelector('.clp-body'); if (e) e.scrollTop = 0; }); }
function finishBlock(score) {
  const p = P(), c = curCourse().concepts.find(x => x.id === p.cid), k = p.chain[p.pos];
  (c.progress ||= {})[k] = { score: score == null ? null : clamp01(score), done: true };
  p.pos++; p.st = {}; scrollTop();
  if (p.pos < p.chain.length) { saveCourse(); return; }
  syncChain(p, c);
  if (p.pos < p.chain.length) { saveCourse(); return; }
  const more = (globalThis.__claritySim?.more ? globalThis.__claritySim.more(curCourse(), c) : AI.moreOf?.(curCourse(), c.id));   // Hintergrund-Durchgang noch unterwegs → kurz warten statt abschliessen (sim.more: Test-Hook)
  if (more) { p.status = 'wait'; saveCourse(); more.then(() => { if (P() !== p) return; p.status = 'play'; syncChain(p, c); if (p.pos >= p.chain.length) finishStage(p, c); rr(); }); return; }
  finishStage(p, c);
}
function finishStage(p, c) {
  const course = curCourse(), sc = p.chain.map(k => c.progress[k]?.score).filter(x => typeof x === 'number');
  const score = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 1;
  c.score = Math.max(+c.score || 0, score); c.tries = (c.tries || 0) + 1;
  if (score >= .5) c.status = 'done'; else if (c.status !== 'done') c.status = 'inprogress';
  c.progress = {}; p.score = score; p.after = snapshot(course); p.status = 'done'; saveCourse();
  try { if (score >= .5) { CTX?.chime?.(); CTX?.confetti?.(CTX.app); } CTX?.haptic?.(14); } catch { }
}
const cur = () => { const p = P(), c = curCourse()?.concepts.find(x => x.id === p?.cid); return { p, c, b: c?.blocks?.[p?.chain?.[p?.pos]] }; };

async function evaluate(p, c, b) {
  const s = p.st; s.busy = true; s.err = ''; rr();
  try {
    if (!isClean(s.text, { learning: true })) throw new Error(CLEAN_MSG);
    const sm = globalThis.__claritySim?.evalOpen;
    const r = sm ? await sm(b.content, s.text) : AI.evaluateOpenAnswer ? await AI.evaluateOpenAnswer(curCourse(), c.id, b, s.text) : localEval(b.content, s.text);
    if (P() !== p || p.st !== s) return;
    const kp = b.content.keyPoints || [];
    const cps = Array.isArray(r?.checkpoints) && r.checkpoints.length ? r.checkpoints.map(k => ({ text: String(k.text ?? ''), hit: !!k.hit })) : kp.map(t => ({ text: t, hit: false }));
    s.ev = { points: clamp01(r?.points ?? cps.filter(k => k.hit).length / (cps.length || 1)), checkpoints: cps, feedback: String(r?.feedback || '') };
  } catch (e) { if (P() === p && p.st === s) s.err = /nicht erlaubt/.test(String(e.message)) ? CLEAN_MSG : friendlyErr(e, 'Die Auswertung'); }
  if (P() === p && p.st === s) s.busy = false; rr();
}
// Rückfall ohne KI-Funktion: Schlüsselwörter der Checkpoints im Text suchen (nur solange evaluateOpenAnswer fehlt)
function localEval(c, text) {
  const norm = ENG.norm || (x => String(x).toLowerCase()), t = ' ' + norm(text) + ' ';
  const cps = (c.keyPoints || []).map(k => { const w = norm(k).split(' ').filter(x => x.length > 4); return { text: k, hit: w.length ? w.filter(x => t.includes(x.slice(0, Math.max(5, x.length - 2)))).length / w.length >= .4 : false }; });
  return { points: cps.length ? cps.filter(k => k.hit).length / cps.length : 0, checkpoints: cps, feedback: '', missing: cps.filter(k => !k.hit).map(k => k.text) };
}

function insertAt(el, ch) { const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s; el.value = el.value.slice(0, s) + ch + el.value.slice(e); el.selectionStart = el.selectionEnd = s + ch.length; }

export function playerActions(ctx) {
  CTX = ctx;
  const leave = () => { const u = ui(); try { stopVoice(); } catch { } u.player = null; u.phase = 'dashboard'; try { window.scrollTo?.(0, 0); } catch { } };
  return {
    ...basisActions,
    clarityPlayLeaveAsk() { const p = P(); if (p) p.leave = true; ctx.haptic?.(6); },
    clarityPlayLeaveCancel() { const p = P(); if (p) p.leave = false; },
    clarityPlayLeave() { leave(); },
    clarityPlayDash() { leave(); },
    clarityPlayRetry() { const p = P(); if (!p) return; p.status = 'loading'; p.err = ''; load(p); },
    clarityPlayAgain() { const u = ui(), id = u.conceptId; u.player = null; u.conceptId = id; scrollTop(); },
    clarityPlayNext() {
      const course = curCourse(), { c } = cur(), nx = c && nextOf(course, c); if (!nx) return leave();
      const u = ui(); try { stopVoice(); } catch { } u.conceptId = nx.id; u.player = null; scrollTop();
    },
    clarityPlaySkip() { const { p } = cur(); if (p?.status === 'play') finishBlock(null); },
    clarityPlayPrimary() {
      const { p, c, b } = cur(); if (!p || p.status !== 'play' || !b) return false;
      const s = p.st, ct = b.content || {};
      switch (b.type) {
        case 'ESSENCE_AND_TRAP': return finishBlock(null);
        case 'MULTIPLE_CHOICE': {
          const items = ct.items || [], i = s.i || 0; if (s.sel?.[i] == null) return false;
          if (i < items.length - 1) { s.i = i + 1; scrollTop(); return; }
          return finishBlock(scoreOf(b, s));
        }
        case 'CLOZE_TEXT': if (s.checked) return finishBlock(s.score); s.score = scoreOf(b, s); s.checked = true; { ctx.haptic?.(10); return; }
        case 'MATCHING_AND_ORDER':
          if (s.checked) return finishBlock(s.score);
          if (ct.mode === 'order') s.list ||= orderStart(ct); s.score = scoreOf(b, s); s.checked = true; { ctx.haptic?.(10); return; }
        case 'OPEN_QUESTION_VOICE':
          if (s.ev) return finishBlock(scoreOf(b, s));
          if (String(s.text || '').trim().length < 8) { s.err = 'Schreibe oder sprich zuerst eine etwas längere Antwort.'; s.short = true; return; }
          s.short = false; if (!s.busy) evaluate(p, c, b); return;
        case 'STEP_CALCULATION': {
          const st = s.stage || 0;
          if (s.chk[st]) { if (st < 2) { s.stage = st + 1; scrollTop(); return; } return finishBlock(scoreOf(b, s)); }
          if (st === 2 && !String(s.num || '').trim()) { s.hint = true; return; }
          s.hint = false; s.chk[st] = true; s.ok[st] = st === 0 ? s.formula === ct.correctFormula
            : st === 1 ? [...(ct.givens || []), ...(ct.extraGivens || [])].every((g, k) => !!s.use[k] === (k < (ct.givens || []).length))
              : numeq(s.num, ct.result?.value, ct.result?.tol); { ctx.haptic?.(10); return; }
        }
      }
    },
    // Multiple Choice
    clarityPlayMcPick(d) { const { p } = cur(); if (!p) return; const s = p.st, i = s.i || 0; s.sel ||= []; if (s.sel[i] != null) return false; s.sel[i] = +d.o; ctx.haptic?.(8); },
    // Lückentext: Chip setzt in aktive Lücke, Lücke antippen leert sie
    clarityPlayChip(d) {
      const { p, b } = cur(); if (!p) return; const s = p.st; if (s.checked) return false;
      let k = s.act != null && s.fill[s.act] == null ? s.act : s.fill.findIndex(x => x == null); if (k < 0) return false;
      s.fill[k] = +d.i; const nx = s.fill.findIndex(x => x == null); s.act = nx < 0 ? k : nx; ctx.haptic?.(6);
    },
    clarityPlayBlank(d) { const { p } = cur(); if (!p) return; const s = p.st; if (s.checked) return false; const k = +d.k; if (s.fill[k] != null) s.fill[k] = null; s.act = k; },
    // Zuordnen
    clarityPlayMatchL(d) { const { p } = cur(); if (!p) return; const s = p.st, l = +d.i; s.map ||= {}; if (s.map[l] != null) { delete s.map[l]; s.selL = l; return; } s.selL = s.selL === l ? null : l; },
    clarityPlayMatchR(d) {
      const { p, b } = cur(); if (!p) return; const s = p.st; s.map ||= {}; const r = pairsOrder(b.content)[+d.j];
      const owner = Object.keys(s.map).find(k => s.map[k] === r);
      if (s.selL != null) { if (owner != null) delete s.map[owner]; s.map[s.selL] = r; s.selL = null; ctx.haptic?.(6); }
      else if (owner != null) { delete s.map[owner]; }
    },
    // Reihenfolge
    clarityPlayMove(d) { const { p, b } = cur(); if (!p) return; const s = p.st, i = +d.i, j = i + +d.d; s.list ||= orderStart(b.content); if (j < 0 || j >= s.list.length) return false; [s.list[i], s.list[j]] = [s.list[j], s.list[i]]; },
    // Offene Frage: Mikrofon
    async clarityPlayMic() {
      const { p } = cur(); if (!p) return; const s = p.st; s.voiceErr = '';
      if (s.rec) { await stopVoice(() => { s.rec = false; rr(); }); s.rec = false; return; }
      if (!voiceSupported()) { s.voiceErr = 'Spracheingabe ist hier nicht verfügbar. Tippe deine Antwort ein.'; return; }
      const base = String(s.text || '').trim(); s.rec = true; rr();
      try {
        await startVoice(t => { if (P() === p && p.st === s) { s.text = (base ? base + ' ' : '') + t; rr(); } }, () => { s.rec = false; rr(); });
      } catch (e) { s.rec = false; s.voiceErr = String(e?.message || 'Die Aufnahme konnte nicht starten.'); }
    },
    // Rechnen
    clarityPlayFormula(d) { const { p } = cur(); if (!p || p.st.chk?.[0]) return false; p.st.formula = +d.o; },
    clarityPlayGiven(d) { const { p } = cur(); if (!p || p.st.chk?.[1]) return false; (p.st.use ||= {})[+d.k] = !p.st.use[+d.k]; },
    clarityPlayIns(d) { const { p } = cur(); if (!p) return; const el = document.querySelector('.clp-num'); if (el) { insertAt(el, d.ch); p.st.num = el.value; } else p.st.num = (p.st.num || '') + d.ch; },
  };
}

/* ---------------------------------- Pointer-Drag für die Reihenfolge ---------------------------------- */
let drag = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => {
    const h = e.target?.closest?.('[data-drag]'); if (!h || P()?.status !== 'play') return;
    const row = h.closest('.clp-ord'), list = row?.parentElement; if (!list) return;
    drag = { h, row, from: +h.dataset.drag, id: e.pointerId, y0: e.clientY, rects: [...list.children].map(r => r.getBoundingClientRect()), to: +h.dataset.drag };
    try { h.setPointerCapture(e.pointerId); } catch { } row.classList.add('drag'); e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0, r0 = drag.rects[drag.from], mid = r0.top + r0.height / 2 + dy;
    drag.row.style.transform = `translateY(${dy}px)`;
    // Ziel: Position, deren Mitte dem Zeiger am nächsten liegt
    let best = drag.from, bd = Infinity; drag.rects.forEach((r, i) => { const d = Math.abs(mid - (r.top + r.height / 2)); if (d < bd) { bd = d; best = i; } }); drag.to = best;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { row, from, to } = drag; drag = null; row.style.transform = ''; row.classList.remove('drag');
    const s = P()?.st; if (e.type === 'pointerup' && s?.list && to !== from) { const [x] = s.list.splice(from, 1); s.list.splice(to, 0, x); }
    rr();
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
}
