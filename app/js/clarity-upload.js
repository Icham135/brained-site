// Brained Clarity – Screen 1 (Willkommen & Smart-Upload) und Screen 2 (Verarbeitung). Bauplan: docs/CLARITY-BAUPLAN.md §1, §6
// Dateien und Seitentexte bleiben im Gerät (IndexedDB). Alle Nutzer-/KI-Texte laufen über esc().
import { S, save, uid } from './store.js';
import { U } from './view-state.js';
import { esc } from './ui.js';
import { isClean, CLEAN_MSG } from './moderation.js';
import { imgPut, imgGet, imgDel } from './idb.js';
import { CLARITY_NAME, clarityData, courseById, curCourse, saveCourse, isDemo, ui, loadPages, putPages, deleteCourse, friendlyErr, offline, sim } from './clarity.js';
import { SAMPLE_TEXT } from './clarity-demo.js';
// Namespace-Importe: Funktionen der anderen Helfer sind optional, bis sie existieren gelten lokale Rückfälle
import * as AI from './clarity-ai.js';
import * as ENG from './clarity-engine.js';
import * as DEMO from './clarity-demo.js';

const MAX_MB = 60, MAX_PAGES_UI = 600, MAX_TEXT = 1500000;
const SAMPLE_MATH = DEMO.SAMPLE_MATH || `1. Quadratische Funktionen
Eine quadratische Funktion hat die Form f(x) = ax² + bx + c mit a ≠ 0. Ihr Graph ist eine Parabel. Ist a positiv, öffnet sie sich nach oben, ist a negativ, nach unten. Der Scheitelpunkt ist der tiefste oder höchste Punkt der Parabel.

2. Nullstellen und Mitternachtsformel
Die Nullstellen sind die x-Werte, bei denen f(x) = 0 gilt. Man berechnet sie mit der Mitternachtsformel x = (−b ± √(b² − 4ac)) / (2a). Der Ausdruck D = b² − 4ac heisst Diskriminante. Ist D positiv, gibt es zwei Nullstellen, bei D = 0 genau eine, bei D negativ keine.
Beispiel: f(x) = x² − 5x + 6 hat D = 25 − 24 = 1 und damit die Nullstellen x = 2 und x = 3.

3. Scheitelform
Mit quadratischer Ergänzung wird f(x) = a(x − d)² + e. Der Scheitelpunkt liegt bei S(d | e). Die Scheitelform zeigt sofort, wie die Parabel verschoben ist. Typischer Fehler: das Vorzeichen von d, denn (x − 3)² verschiebt nach rechts, nicht nach links.

4. Lineare Gleichungssysteme
Zwei Gleichungen mit zwei Unbekannten löst man mit dem Einsetzungs-, Gleichsetzungs- oder Additionsverfahren. Das Ergebnis ist ein Zahlenpaar (x | y), der Schnittpunkt der beiden Geraden. Sind die Geraden parallel, gibt es keine Lösung.`;

/* ---------------------------------- Symbole ---------------------------------- */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
  file: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>'),
};

/* ---------------------------------- Notensysteme ---------------------------------- */
const COUNTRIES = { CH: { name: 'Schweiz' }, DE: { name: 'Deutschland' }, AT: { name: 'Österreich' } };
const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many}`;
// Zahlen im Schweizer Format (4'590)
const fmtN = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const defScale = c => c === 'AT' ? '1-5' : '1-6';
// Wählbare Zielnoten, geordnet von «bestehen» (links) bis «Bestnote» (rechts)
export function targetList(country, scale) {
  if (country === 'DE' && scale === '0-15') return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  if (country === 'DE') return [4, 3.5, 3, 2.5, 2, 1.5, 1];
  if (country === 'AT') return [4, 3, 2, 1];
  return [4, 4.5, 5, 5.5, 6];
}
const FALLBACK_TARGET = (c, s) => c === 'DE' ? (s === '0-15' ? 11 : 2) : c === 'AT' ? 2 : 5;
export function defaultTarget(country, scale) {
  let v; try { v = ENG.defaultTarget?.(country, scale); } catch { }
  const list = targetList(country, scale);
  if (typeof v === 'object' && v) v = v.target ?? v.value;
  v = Number(v); if (!Number.isFinite(v)) v = FALLBACK_TARGET(country, scale);
  return list.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, list[0]);
}
export function fmtGrade(country, scale, v) {
  if (scale === '0-15') return `${v} Punkte`;
  return country === 'AT' ? String(v) : Number(v).toFixed(1);
}
const gradeWord = (country, scale, v) => {
  if (country === 'CH') return v >= 5.75 ? 'ausgezeichnet' : v >= 5.25 ? 'sehr gut' : v >= 4.75 ? 'gut' : v >= 4.25 ? 'befriedigend' : 'genügend';
  if (scale === '0-15') return v >= 13 ? 'sehr gut' : v >= 10 ? 'gut' : v >= 7 ? 'befriedigend' : 'ausreichend';
  return v <= 1.25 ? 'sehr gut' : v <= 2.25 ? 'gut' : v <= 3.25 ? 'befriedigend' : 'genügend';
};

/* ---------------------------------- Entwurf (flüchtig, U.clarity.draft) ---------------------------------- */
// Titel, Land, Notensystem, Ziel und eingefügter Text bleiben nur lokal (localStorage) erhalten; hochgeladene Dateien/Unterlagen nie.
const DRAFT_KEY = 'brained.clarity.draft';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}; } catch { return {}; } };
const saveDraft = dr => { try { const { title, country, scale, target, touched } = dr, text = dr.text && ![SAMPLE_TEXT, SAMPLE_MATH].includes(dr.text) ? String(dr.text).slice(0, MAX_TEXT) : ''; if (title || touched || text) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, country, scale, target, touched, text })); else localStorage.removeItem(DRAFT_KEY); } catch { } };
const draft = () => {
  const dr = (ui().draft ||= { files: [], goals: null, country: 'CH', scale: '1-6', target: 5, title: '' });
  if (!dr.init) {
    dr.init = true; dr.files ||= []; dr.text ||= '';
    const pc = S.prefs?.gradeCountry; if (COUNTRIES[pc]) { dr.country = pc; dr.scale = defScale(pc); }
    const sv = loadSaved();
    if (sv.text && !dr.text) { dr.text = String(sv.text).slice(0, MAX_TEXT); dr.paste = true; }
    dr.restored = !!(sv.title || sv.text);
    if (sv.title || sv.touched) { dr.title ||= String(sv.title || '').slice(0, 80); if (COUNTRIES[sv.country]) { dr.country = sv.country; dr.scale = sv.scale === '0-15' && sv.country === 'DE' ? '0-15' : defScale(sv.country); } if (sv.touched && +sv.target > 0) { dr.target = +sv.target; dr.touched = true; } }
    if (!dr.touched) dr.target = defaultTarget(dr.country, dr.scale);
  }
  saveDraft(dr);
  return dr;
};
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.0', '') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const okType = f => /^(image\/|application\/pdf|text\/)/.test(f.type) || /\.(pdf|txt|md|jpe?g|png|heic|webp)$/i.test(f.name);

/* ---------------------------------- Laufzeit-Zustand (nur in diesem Modul) ---------------------------------- */
const running = new Set(), aborted = new Set(), srcMap = new Map(), pagesMem = new Map();
let askDel = null, CTX = null;
const here = c => ui().courseId === c.id;
const emptyUsage = () => ENG.emptyUsage?.() || { calls: 0, tin: 0, tout: 0, cost: 0, byStep: {} };
const goalsKey = c => `clarity:${c.id}:goals`;
const progressOf = c => {
  try { const v = ENG.weightedProgress?.(c); if (Number.isFinite(v)) return Math.max(0, Math.min(1, v > 1 ? v / 100 : v)); } catch { }
  const ks = c.concepts || [], sum = ks.reduce((n, k) => n + (k.weightPercent || 0), 0) || 1;
  return ks.filter(k => k.status === 'done').reduce((n, k) => n + (k.weightPercent || 0), 0) / sum;
};

/* ---------------------------------- Ansicht ---------------------------------- */
export function uploadView() {
  return ui().phase === 'processing' ? processingView() : welcomeView();
}

function welcomeView() {
  const dr = draft(), courses = clarityData().courses.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const list = targetList(dr.country, dr.scale), idx = Math.max(0, list.indexOf(dr.target));
  const tShow = fmtGrade(dr.country, dr.scale, dr.target);
  const seg = (items, cur, act, label, cls = '') => `<div class="clu-seg ${cls}" role="radiogroup" aria-label="${esc(label)}">${items.map(([id, html, aria]) => `<button type="button" role="radio" aria-checked="${cur === id}" class="${cur === id ? 'on' : ''}" data-a="${act}" data-id="${esc(id)}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${html}</button>`).join('')}</div>`;
  return `<section class="clu-up clu-welcome">
    ${dr.restored ? `<div class="clu-resume clu-rise" role="status"><span><b>Entwurf wiederhergestellt</b><br>Titel, Ziel und Text von deinem letzten Besuch. Dateien musst du neu auswählen.</span><button type="button" class="clu-btn" data-a="clarityDiscardDraft">Verwerfen</button></div>` : ''}
    <header class="clu-hero clu-rise">
      <span class="clu-eyebrow">${esc(CLARITY_NAME)}</span>
      <h1>Willkommen bei Brained Clarity</h1>
      <p class="clu-lead">Lade deinen Lernstoff hoch. Wir filtern das Unwichtige weg, prüfen dein Vorwissen und führen dich Etappe für Etappe bis zur Zielnote.</p>
      ${isDemo() ? `<p class="clu-demo-note" role="note"><b>Demo ohne KI.</b> Du siehst Beispielinhalt, keinen echten Kurs aus deinen Unterlagen.</p>` : ''}
    </header>
    ${resumeBanners(courses)}
    <div class="clu-rise" style="--d:.06s">
      <label class="clu-drop${dr.files.length ? ' has' : ''}" data-cl-drop="main">
        <input class="clu-file" type="file" multiple accept="application/pdf,image/*,.pdf,.txt,.md,text/plain,text/markdown" data-a-change="clarityFiles" aria-label="Lernstoff auswählen"/>
        <span class="clu-drop-ic">${IC.upload}</span>
        <b>${dr.files.length ? 'Weitere Dateien hinzufügen' : 'Dateien hier ablegen oder tippen'}</b>
        <small>PDF, Fotos, Textdateien (.txt, .md) · bis ca. ${fmtN(MAX_PAGES_UI)} Seiten · max. ${MAX_MB} MB je Datei</small>
      </label>
      ${dr.files.length ? `<ul class="clu-files" aria-label="Ausgewählte Dateien">${dr.files.map((f, i) => fileRow(f.name, fmtSize(f.size), 'clarityRemoveFile', i)).join('')}</ul>` : ''}
      ${dr.paste || dr.text ? `<div class="clu-field"><label for="clu-text">Text einfügen</label><textarea id="clu-text" class="clu-text" rows="6" maxlength="${MAX_TEXT}" placeholder="Notizen oder Skript hier einfügen …" data-bind="clarity.draft.text">${esc(dr.text || '')}</textarea></div>`
        : `<button type="button" class="clu-link" data-a="clarityTogglePaste">Oder Text einfügen</button>`}
      <div class="clu-samples">
        <button type="button" class="clu-chip" data-a="claritySample">Beispiel ausprobieren</button>
        <button type="button" class="clu-chip" data-a="claritySampleMath">Mathe-Beispiel</button>
      </div>
    </div>
    <div class="clu-card-s clu-rise" style="--d:.1s">
      <div class="clu-card-h"><b>Lernziele oder Altklausur hinzufügen</b><span class="clu-opt">Optional</span></div>
      <p class="clu-hint">Kalibriert den Prüfungsfokus: Wir gewichten den Stoff so, wie er bei dir geprüft wird.</p>
      ${dr.goals ? `<ul class="clu-files">${fileRow(dr.goals.name, fmtSize(dr.goals.size), 'clarityRemoveGoals', 0)}</ul>`
        : `<label class="clu-drop sm" data-cl-drop="goals"><input class="clu-file" type="file" accept="application/pdf,image/*,.pdf,.txt,.md,text/plain,text/markdown" data-a-change="clarityGoals" aria-label="Lernziele oder Altklausur auswählen"/><span class="clu-drop-ic">${IC.target}</span><b>Datei auswählen</b></label>`}
    </div>
    <div class="clu-card-s clu-rise" style="--d:.14s">
      <div class="clu-card-h"><b>Notensystem</b></div>
      ${seg(Object.entries(COUNTRIES).map(([id, c]) => [id, `<b class="clu-flag" aria-hidden="true">${id}</b><span>${esc(c.name)}</span>`, c.name]), dr.country, 'claritySetCountry', 'Notensystem', 'stack')}
      ${dr.country === 'DE' ? `<div class="clu-sub">${seg([['1-6', 'Noten 1–6'], ['0-15', 'Punkte 0–15']], dr.scale, 'claritySetScale', 'Skala')}</div>` : ''}
      <div class="clu-target">
        <label for="clu-target" class="clu-target-q">Welche Note ist dein Ziel?</label>
        <div class="clu-target-val" aria-live="polite"><span data-cl-tval>${esc(tShow)}</span><small data-cl-tword>${esc(gradeWord(dr.country, dr.scale, dr.target))}</small></div>
        <input id="clu-target" class="clu-range" type="range" min="0" max="${list.length - 1}" step="1" value="${idx}" data-cl-slider data-a-change="clarityTarget" aria-valuetext="${esc(tShow)}"/>
        <div class="clu-range-ends"><span>Bestehen</span><span>Bestnote</span></div>
        <p class="clu-hint">${dr.country === 'CH' ? 'In der Schweiz ist 6 die beste Note, genügend ab 4.0.' : dr.scale === '0-15' ? '15 Punkte sind die beste Note, bestanden ab 5 Punkten.' : 'Hier ist 1 die beste Note: eine kleinere Zahl ist besser. Rechts auf dem Regler heisst ehrgeiziger.'}</p>
      </div>
    </div>
    <div class="clu-field clu-rise" style="--d:.18s"><label for="clu-title">Kurstitel <span class="clu-opt">Optional</span></label>
      <input id="clu-title" class="clu-input" type="text" maxlength="80" placeholder="z. B. Biologie, Prüfung 12. November" autocomplete="off" data-bind="clarity.draft.title" value="${esc(dr.title || '')}"/></div>
    ${dr.err ? `<div class="clu-err" role="alert">${esc(dr.err)}</div>` : ''}
    <button type="button" class="clu-cta" data-a="clarityStart">Analyse starten</button>
    <p class="clu-privacy">${IC.lock} <span>Deine Dateien bleiben auf deinem Gerät.</span></p>
    ${courses.length ? `<h2 class="clu-sec">Deine Kurse</h2><div class="clu-courses">${courses.map(courseRow).join('')}</div>` : ''}
  </section>`;
}
const fileRow = (name, size, act, i) => `<li class="clu-filerow"><span class="clu-fic">${IC.file}</span><span class="clu-fn"><b>${esc(name)}</b><small>${esc(size)}</small></span><button type="button" class="clu-x" data-a="${act}" data-i="${i}" aria-label="${esc('Entfernen: ' + name)}">${IC.x}</button></li>`;

function resumeBanners(courses) {
  const half = courses.find(c => c.status === 'analyzing' && !running.has(c.id));
  return half ? `<div class="clu-resume clu-rise" role="status"><span><b>«${esc(half.title)}» ist noch nicht fertig analysiert</b><br>Die Analyse wurde unterbrochen. Sie macht dort weiter, wo sie aufgehört hat.</span><button type="button" class="clu-btn" data-a="clarityOpen" data-id="${esc(half.id)}">Fortsetzen</button></div>` : '';
}

function courseRow(c) {
  if (askDel === c.id) return `<div class="clu-course del" role="alertdialog" aria-label="Kurs löschen"><b>«${esc(c.title)}» löschen?</b><span>Der Kurs und dein Fortschritt gehen verloren. Die Seitentexte auf deinem Gerät werden auch entfernt.</span>
    <div class="clu-row2"><button type="button" class="clu-btn ghost" data-a="clarityCancelDelete">Abbrechen</button><button type="button" class="clu-btn dark" data-a="clarityDoDelete" data-id="${esc(c.id)}">Löschen</button></div></div>`;
  const ready = c.status === 'ready', pct = Math.round(progressOf(c) * 100), live = running.has(c.id);
  const meta = ready ? `${plural((c.modules || []).length, 'Modul', 'Module')} · ${plural((c.concepts || []).length, 'Konzept', 'Konzepte')}` : c.status === 'error' ? 'Analyse unterbrochen' : live ? 'Wird analysiert …' : 'Analyse unterbrochen';
  return `<div class="clu-course">
    <button type="button" class="clu-course-main" data-a="clarityOpen" data-id="${esc(c.id)}">
      <span class="clu-pct" style="--p:${pct}" aria-hidden="true"><i>${ready ? pct + '%' : live ? '…' : '!'}</i></span>
      <span class="clu-course-t"><b>${esc(c.title)}</b><small>${esc(meta)}${c.demo ? ' · Demo' : ''}</small>${ready ? `<small>Ziel: ${esc(fmtGrade(c.grading?.country, c.grading?.scale, c.grading?.target))} · ${pct}% gelernt</small>` : ''}</span>
      <span class="clu-chev">${IC.chev}</span>
    </button>
    <button type="button" class="clu-x" data-a="clarityAskDelete" data-id="${esc(c.id)}" aria-label="${esc('Kurs löschen: ' + c.title)}">${IC.trash}</button>
  </div>`;
}

/* ---------------------------------- Verarbeitung (Screen 2) ---------------------------------- */
const STEPS = [
  'Dokumente werden gelesen & bereinigt (Fülltext wird entfernt) …',
  'Stoff wird in logische Themen-Module & Kernkonzepte strukturiert …',
  'Komplexität, Prüfungsgewichtung (%) & geschätzter Lernaufwand werden berechnet …',
];
function processingView() {
  const c = curCourse(), b = ui().build || {};
  if (!c) return welcomeView();
  const live = running.has(c.id), err = !live && (c.status === 'error' ? c.err || 'Die Analyse hat nicht geklappt.' : ''), paused = !live && !err && c.status === 'analyzing';
  const step = c.stage === 'read' ? 0 : (b.step ?? 1);
  const detail = i => {
    if (i === 0) {
      if (step > 0) return `${fmtN(c.pages || b.pages || 0)} Seiten gelesen`;
      return b.pages ? `Seite ${fmtN(b.pages)}${b.total ? ' von ' + fmtN(b.total) : ''}` : (b.label || '');
    }
    if (i === step && live && b.label) return b.label;
    return '';
  };
  const state = i => err && i === step ? 'err' : i < step || (!live && !err && !paused && c.status === 'ready') ? 'done' : i === step ? (live ? 'active' : paused ? 'paused' : 'active') : 'todo';
  const pct = Math.round(Math.max(0, Math.min(1, b.frac || 0)) * 100);
  return `<section class="clu-up clu-proc">
    <header class="clu-hero clu-rise">
      <span class="clu-eyebrow">${esc(c.title)}${c.demo ? ' · Demo' : ''}</span>
      <h1>${err ? 'Das hat nicht geklappt' : paused ? 'Analyse unterbrochen' : 'Dein Stoff wird vorbereitet'}</h1>
      <p class="clu-lead">${err ? 'Nichts geht verloren: deine Eingaben sind noch da.' : paused ? 'Die Analyse läuft nicht mehr. Du kannst sie genau dort fortsetzen, wo sie aufgehört hat.' : 'Das dauert meist ein bis zwei Minuten. Du kannst die App offen lassen.'}</p>
    </header>
    <ol class="clu-steps" aria-live="polite" aria-label="Fortschritt">
      ${STEPS.map((t, i) => { const s = state(i), d = detail(i); return `<li class="clu-step ${s}" ${s === 'active' ? 'aria-current="step"' : ''}>
        <span class="clu-mark" aria-hidden="true">${s === 'done' ? IC.check : s === 'err' ? '!' : s === 'active' ? '<i class="clu-pulse"></i>' : i + 1}</span>
        <span class="clu-step-t"><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}${s === 'active' ? `<span class="clu-bar${pct ? '' : ' ind'}" role="progressbar" aria-valuemin="0" aria-valuemax="100" ${pct ? `aria-valuenow="${pct}"` : ''}><i style="width:${pct || 35}%"></i></span>` : ''}</span></li>`; }).join('')}
    </ol>
    ${err ? `<div class="clu-err" role="alert">${esc(err)}</div>` : ''}
    <div class="clu-actions">
      ${err || paused ? `<button type="button" class="clu-cta" data-a="clarityRetry">${err ? 'Nochmals versuchen' : 'Analyse fortsetzen'}</button>` : ''}
      ${live ? `<button type="button" class="clu-btn ghost block" data-a="clarityCancel">Abbrechen</button>` : `<button type="button" class="clu-btn ghost block" data-a="clarityBack">${c.stage === 'read' && err ? 'Abbrechen' : 'Zurück'}</button>`}
    </div>
  </section>`;
}

/* ---------------------------------- Einwilligung (Kopie aus path-home.js, Aktionen clarityConsent*) ---------------------------------- */
// Bei Textänderung CONSENT_V erhöhen → Dialog erscheint neu. Gleiche Version wie bisher, damit bestehende Zustimmungen gelten.
export const CONSENT_V = 1;
export const aiConsentOk = () => S.user?.aiConsent?.v === CONSENT_V;
export function aiConsentSheet(sh, head) {
  const ck = sh.ck || (sh.ck = {}), band = S.user?.ageBand || ck.band || '', young = band === '13-15', under = band === 'u13';
  const box = (k, html) => `<button type="button" class="consent" role="checkbox" aria-checked="${!!ck[k]}" data-a="clarityConsentToggle" data-k="${k}"><span class="cbox ${ck[k] ? 'on' : ''}">${ck[k] ? '✓' : ''}</span><span>${html}</span></button>`;
  const link = (id, t) => `<a href="#" data-a="clarityConsentLegal" data-id="${id}">${t}</a>`;
  const ok = !under && band && ck.a && ck.b && (!young || ck.c);
  const bandBtn = (v, t) => `<button type="button" class="chip-btn ${band === v ? 'on' : ''}" role="radio" aria-checked="${band === v}" data-a="clarityConsentBand" data-v="${v}">${t}</button>`;
  return `<div class="clu-consent">` + head('Dürfen wir deine Unterlagen an die KI senden?') + `
    <p class="clu-c-lead">Damit Brainy deinen Stoff analysieren und Etappen erstellen kann, senden wir Textauszüge (bei Fotos und Scans: Bilder der Seiten) über unseren Server an <b>Anthropic</b> (KI-Dienst, USA).</p>
    <ul class="clu-c-list">
      <li>Deine Dateien und Kurse bleiben auf deinem Gerät. Wir speichern sie nicht.</li>
      <li>Anthropic löscht die Daten nach spätestens 30 Tagen und trainiert damit nicht.</li>
      <li>Lade nur Unterlagen hoch, die du fürs eigene Lernen nutzen darfst. Keine ganzen Lehrmittel, keine Namen oder Noten von anderen Personen.</li>
      <li>Du kannst deine Einwilligung jederzeit im Profil widerrufen.</li>
    </ul>
    ${S.user?.ageBand ? '' : `<div class="field"><label id="aiAge">Wie alt bist du?</label><div class="chips" role="radiogroup" aria-labelledby="aiAge">${bandBtn('13-15', '13–15')}${bandBtn('16+', '16 oder älter')}${bandBtn('u13', 'Jünger als 13')}</div></div>`}
    ${under ? '<p class="clu-c-under" role="alert">Brained ist erst ab 13. Frag in ein paar Jahren nochmals.</p>' : ''}
    <div class="consents">
      ${box('a', `Ich willige ein, dass meine Unterlagen zur Analyse und zur Erstellung von Etappen und Prüfungen an Anthropic (USA) gesendet werden. Details: ${link('datenschutz', 'Datenschutzerklärung')}`)}
      ${box('b', 'Ich darf diese Unterlagen für mein eigenes Lernen nutzen und habe Namen anderer Personen entfernt.')}
      ${young ? box('c', 'Meine Eltern bzw. Erziehungsberechtigten sind einverstanden.') : ''}
    </div>
    <p class="clu-c-links">${link('agb', 'Nutzungsbedingungen')}</p>
    <button type="button" class="btn primary block" data-a="clarityConsentGo" ${ok ? '' : 'disabled'}>Einverstanden und weiter</button>
    <button type="button" class="btn ghost block mt8" data-a="closeSheet">Nicht jetzt</button></div>`;
}

/* ---------------------------------- Dateien aufnehmen ---------------------------------- */
function addFiles(list, toGoals) {
  const dr = draft(), toast = CTX?.toast;
  for (const f of [...list]) {
    if (!okType(f)) { toast?.(`${esc(f.name)}: Dateityp nicht unterstützt`); continue; }
    if (f.size > MAX_MB * 1048576) { toast?.(`${esc(f.name)}: zu gross (max. ${MAX_MB} MB)`); continue; }
    if (!f.size) { toast?.(`${esc(f.name)}: Die Datei ist leer`); continue; }
    if (!isClean(f.name, { learning: true })) { toast?.(CLEAN_MSG); continue; }
    if (toGoals) { dr.goals = f; break; }
    if (!dr.files.some(x => x.name === f.name && x.size === f.size)) dr.files.push(f);
  }
  dr.err = '';
}
let wired = false;
function wire() {   // Drag-and-Drop (Desktop): einmal global, wirkt nur auf Ablagezonen
  if (wired || typeof document === 'undefined') return; wired = true;
  const zone = e => e.target?.closest?.('[data-cl-drop]');
  document.addEventListener('dragover', e => { const z = zone(e); if (!z) return; e.preventDefault(); z.classList.add('is-over'); });
  document.addEventListener('dragleave', e => { const z = zone(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-over'); });
  document.addEventListener('drop', e => {
    const z = zone(e); if (!z) return; e.preventDefault(); z.classList.remove('is-over');
    if (e.dataTransfer?.files?.length) { addFiles(e.dataTransfer.files, z.dataset.clDrop === 'goals'); CTX?.render?.(); }
  });
  // Regler: Anzeige live mitführen, ohne die ganze Ansicht neu zu zeichnen
  document.addEventListener('input', e => {
    const el = e.target; if (!el?.matches?.('[data-cl-slider]')) return;
    const dr = draft(), v = targetList(dr.country, dr.scale)[+el.value]; if (v === undefined) return;
    dr.target = v; dr.touched = true;
    const root = el.closest('.clu-target'), t = fmtGrade(dr.country, dr.scale, v);
    root.querySelector('[data-cl-tval]').textContent = t; root.querySelector('[data-cl-tword]').textContent = gradeWord(dr.country, dr.scale, v); el.setAttribute('aria-valuetext', t);
  });
}

/* ---------------------------------- Kurs anlegen und Analyse ---------------------------------- */
const own = msg => Object.assign(new Error(msg), { own: true });
const errText = (e, what) => e?.own ? e.message : friendlyErr(e, what);
const build = c => (ui().build = (ui().build?.courseId === c.id ? ui().build : { courseId: c.id, step: 0, label: '', frac: 0, pages: 0 }));

async function readStage(c, ctx) {
  const src = srcMap.get(c.id);
  if (!src) throw own('Die Unterlagen sind nicht mehr im Speicher, weil die App zwischendurch geschlossen wurde. Lösche diesen Kurs und lade die Unterlagen nochmals hoch.');
  if (sim().failRead) throw new Error(sim().failRead);
  const b = build(c);
  const prog = (label, frac, read) => { if (!here(c)) return; Object.assign(b, { label: label || '', frac: Math.min(1, frac || 0) }, read ? { pages: read } : {}); ctx.render(); };
  let sources = [], pages = [], notes = [];
  if (src.files.length) {
    const r = await AI.readFiles(src.files, (_step, frac, label, read) => prog(label, frac, read), c);
    sources = r.files || []; pages = (r.pages || []).slice(); notes = r.notes || [];
  }
  if (aborted.has(c.id)) throw own('Abgebrochen. Du kannst jederzeit fortsetzen.');
  const text = String(src.text || '').trim();
  if (text) {   // Eingefügten Text wie eine Textdatei in «Seiten» zu ca. 3000 Zeichen teilen
    let cur = '', k = 0; const flush = () => { if (cur.trim()) { pages.push({ n: 0, text: cur.trim(), file: 'tx' }); k++; } cur = ''; };
    for (const para of text.split(/\n{2,}/)) { if (cur && cur.length + para.length > 3000) flush(); cur += (cur ? '\n\n' : '') + para; }
    flush(); sources.push({ id: 'tx', name: 'Notizen', kind: 'text', pages: k, chars: text.length });
  }
  pages = pages.filter(p => String(p.text || '').trim());
  if (!pages.some(p => String(p.text).trim().length > 20)) throw own('In den Unterlagen wurde kein lesbarer Text gefunden. Versuche schärfere Fotos, eine andere Datei oder füge den Text direkt ein.');
  if (pages.length > MAX_PAGES_UI) { notes.push(`Es werden die ersten ${MAX_PAGES_UI} Seiten verwendet.`); pages = pages.slice(0, MAX_PAGES_UI); }
  const all = pages.map((p, i) => ({ n: i + 1, text: String(p.text), file: p.file || p.src || '' }));   // Seitennummern fortlaufend über alle Dateien
  // Lernziele / Altklausur (optional)
  let goalsText = '';
  if (src.goals) {
    prog('Lernziele werden gelesen …', 0.9);
    try {
      const g = await AI.readGoals(src.goals, () => { }, c), gp = (g?.pages || []).filter(p => String(p.text || '').trim());
      if (gp.length) { goalsText = JSON.stringify(gp); c.goalsDoc = { name: src.goals.name, pages: gp.length }; }
    } catch { notes.push(`«${src.goals.name}» konnte nicht gelesen werden. Die Analyse läuft ohne diese Datei.`); }
  }
  if (aborted.has(c.id)) throw own('Abgebrochen. Du kannst jederzeit fortsetzen.');
  await putPages(c, all); pagesMem.set(c.id, all);
  if (goalsText) { try { await imgPut(goalsKey(c), goalsText); } catch { } }
  c.files = sources.filter(s => s.id !== 'tx' || s.pages).map(s => ({ id: s.id, name: s.name, pages: s.pages || 0, kind: s.kind || 'text' }));
  c.pages = all.length; c.stage = 'ingest';
  c.usage ||= emptyUsage();
  save(); srcMap.delete(c.id);
  if (here(c)) { const d = draft(); d.files = []; d.goals = null; d.text = ''; d.title = ''; d.paste = false; d.err = ''; d.touched = false; d.restored = false; try { localStorage.removeItem(DRAFT_KEY); } catch { } }
  if (notes.length) ctx.toast?.(esc(notes[0]));
}

async function analyzeStage(c, ctx) {
  const b = build(c); b.step = 0; b.frac = 0; b.label = ''; b.total = c.pages;
  let pages = pagesMem.get(c.id); if (!pages) { pages = await loadPages(c); pagesMem.set(c.id, pages); }
  if (!pages.length) throw own('Die Seitentexte dieses Kurses fehlen auf diesem Gerät. Lösche den Kurs und lade die Unterlagen nochmals hoch.');
  let goals = null; try { goals = JSON.parse(await imgGet(goalsKey(c)) || 'null'); } catch { }
  if (sim().slow) await new Promise(r => setTimeout(r, sim().slow));   // Test-Hilfe: Verarbeitung künstlich verlangsamen
  if (sim().failAnalyze) throw new Error(sim().failAnalyze);
  const onProg = (label, frac, extra) => {   // Rückfall-Analyse: step 1/2 = Schritt 2/3
    if (!here(c)) return;
    b.label = label || ''; b.frac = Math.max(0, Math.min(1, frac || 0)); b.step = Number.isInteger(extra?.step) ? extra.step : 1; ctx.render();
  };
  const onAI = (step, frac, label, read) => {   // KI-Modul: step 1..3
    if (!here(c)) return;
    b.step = Math.max(0, Math.min(2, (step || 1) - 1)); b.frac = Math.max(0, Math.min(1, frac || 0)); b.label = label || ''; if (read) b.pages = read; ctx.render();
  };
  const out = AI.analyzeMaterial ? await AI.analyzeMaterial(c, pages, goals, onAI) : await localAnalyze(c, pages, onProg);
  if (aborted.has(c.id)) throw own('Abgebrochen. Du kannst jederzeit fortsetzen.');
  if (out && (out.concepts || out.modules)) { if (out.modules) c.modules = out.modules; if (out.concepts) c.concepts = out.concepts; if (out.lang) c.lang = out.lang; if (out.title && !c.titleSet) c.title = out.title; }
  finishCourse(c);
}
// Konzepte vereinheitlichen: Standardfelder, Gewichte auf Summe 100
function finishCourse(c) {
  const ks = c.concepts || [];
  if (!ks.length || !(c.modules || []).length) throw new Error('bad');
  for (const k of ks) {
    k.triage ??= null; k.status ||= 'open'; k.blocks ??= null; k.progress ||= {}; k.score ??= null; k.tries ||= 0; k.preview ||= []; k.pageRanges ||= [];
    k.weightPercent = Math.max(0.1, +k.weightPercent || 0); k.estimatedMinutes = +k.estimatedMinutes > 0 ? Math.round(+k.estimatedMinutes) : ENG.estimateStudyMinutes({ pages: (k.pageRanges || []).reduce((n, [a, b]) => n + (b - a + 1), 0), complexity: k.complexity, needsCalc: k.needsCalc });
  }
  const sum = ks.reduce((n, k) => n + k.weightPercent, 0);
  if (Math.abs(sum - 100) > 0.5) ks.forEach(k => { k.weightPercent = Math.round(k.weightPercent / sum * 1000) / 10; });
  c.usage ||= emptyUsage();
}

// Rückfall ohne KI-Modul: Gliederung aus Überschriften («1. Titel») oder Seiten, Gewicht nach Textmenge
async function localAnalyze(c, pages, onProg) {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  onProg('Themen werden gesucht …', 0.15, { step: 1 }); await nap(120);
  const secs = []; let cur = null;
  pages.forEach(p => {
    for (const line of String(p.text).split('\n')) {
      const h = /^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Z]\))\s+(\S.{2,70})$/.exec(line);
      if (h && !/[.:;]$/.test(h[1])) { cur = { title: h[1].trim(), from: p.n, to: p.n, text: '' }; secs.push(cur); }
      else if (cur) { cur.text += line + '\n'; cur.to = p.n; }
    }
  });
  if (secs.length < 2) { secs.length = 0; for (let i = 0; i < pages.length; i += 2) secs.push({ title: `Abschnitt ${secs.length + 1}`, from: pages[i].n, to: pages[Math.min(i + 1, pages.length - 1)].n, text: pages.slice(i, i + 2).map(p => p.text).join('\n') }); }
  onProg('Kernkonzepte werden strukturiert …', 0.45, { step: 1 }); await nap(120);
  const total = secs.reduce((n, s) => n + s.text.length, 0) || 1;
  const concepts = secs.slice(0, 40).map((s, i) => {
    const sents = (s.text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]/g) || []).map(t => t.trim()).filter(t => t.length > 20);
    const len = s.text.length;
    return { id: 'k' + (i + 1), moduleId: 'm' + (Math.floor(i / 5) + 1), title: s.title, preview: sents.slice(0, 3).map(t => t.slice(0, 200)), pageRanges: [[s.from, s.to]],
      complexity: len > total / secs.length * 1.3 ? 'komplex' : len > total / secs.length * 0.7 ? 'mittel' : 'basis', weightPercent: len / total * 100, estimatedMinutes: ENG.estimateStudyMinutes({ words: s.text.split(/\s+/).filter(Boolean).length, complexity: len > total / secs.length * 1.3 ? 'komplex' : len > total / secs.length * 0.7 ? 'mittel' : 'basis' }), needsCalc: /[=√∑∫]|\bFormel\b/.test(s.text) };
  });
  onProg('Gewichtung und Lernaufwand werden berechnet …', 0.8, { step: 2 }); await nap(120);
  const modules = []; concepts.forEach(k => { let m = modules.find(x => x.id === k.moduleId); if (!m) modules.push(m = { id: k.moduleId, title: modules.length ? `Teil ${modules.length + 1}` : 'Grundlagen', order: modules.length, conceptIds: [], pageRange: [k.pageRanges[0][0], k.pageRanges[0][1]] }); m.conceptIds.push(k.id); m.pageRange[1] = k.pageRanges[0][1]; });
  if (modules.length === 1) modules[0].title = c.title;
  onProg('Fertig', 1, { step: 2 });
  return { modules, concepts };
}

async function runCourse(c, ctx) {
  if (running.has(c.id)) return; running.add(c.id); aborted.delete(c.id); AI.clearAbort?.(c.id);
  c.status = 'analyzing'; c.err = ''; save(); const b = build(c); b.step = 0; ctx.render();
  try {
    if (c.stage === 'read') await readStage(c, ctx);
    await analyzeStage(c, ctx);
    c.status = 'ready'; delete c.stage; delete c.err; save(); running.delete(c.id);
    if (here(c) && !aborted.has(c.id)) { const u = ui(); u.phase = 'swipe'; u.build = null; u.swipe = { i: 0 }; try { window.scrollTo?.(0, 0); } catch { } }
    ctx.chime?.(); ctx.haptic?.(12);
  } catch (e) {
    running.delete(c.id);
    if (aborted.has(c.id) && c.stage === 'read') { deleteCourse(c.id); }
    else { c.status = 'error'; c.err = aborted.has(c.id) ? 'Abgebrochen. Du kannst jederzeit fortsetzen.' : errText(e, 'Die Analyse'); save(); }
  } finally { running.delete(c.id); }
  ctx.render();
}

/* ---------------------------------- Aktionen ---------------------------------- */
export function uploadActions(ctx) {
  CTX = ctx; wire();
  const { toast } = ctx;
  const acts = {
    clarityTogglePaste() { const dr = draft(); dr.paste = true; },
    clarityRemoveFile(d) { draft().files.splice(+d.i, 1); },
    clarityDiscardDraft() { const dr = draft(); Object.assign(dr, { files: [], goals: null, text: '', title: '', paste: false, err: '', touched: false, restored: false, target: defaultTarget(dr.country, dr.scale) }); try { localStorage.removeItem(DRAFT_KEY); } catch { } },
    clarityRemoveGoals() { draft().goals = null; },
    claritySetCountry(d) {
      const dr = draft(); if (!COUNTRIES[d.id]) return;
      dr.country = d.id; dr.scale = defScale(d.id); dr.target = defaultTarget(dr.country, dr.scale); dr.touched = false;
      S.prefs = { ...(S.prefs || {}), gradeCountry: d.id }; saveCourse();
    },
    claritySetScale(d) { const dr = draft(); if (dr.country !== 'DE') return; dr.scale = d.id === '0-15' ? '0-15' : '1-6'; dr.target = defaultTarget('DE', dr.scale); dr.touched = false; },
    claritySample() { const dr = draft(); dr.files = []; dr.text = SAMPLE_TEXT; dr.paste = true; dr.title = 'Zellatmung (Beispiel)'; dr.err = ''; return acts.clarityStart(); },
    claritySampleMath() { const dr = draft(); dr.files = []; dr.text = SAMPLE_MATH; dr.paste = true; dr.title = 'Quadratische Funktionen (Beispiel)'; dr.err = ''; return acts.clarityStart(); },
    clarityConsentToggle(d) { const ck = (U.sheet.ck ||= {}); ck[d.k] = !ck[d.k]; },
    clarityConsentBand(d) { const ck = (U.sheet.ck ||= {}); ck.band = d.v; if (d.v === 'u13') { ck.a = ck.b = ck.c = false; } },
    clarityConsentLegal(d) { U.sheetBack = { sheet: U.sheet, form: U.form }; U.sheet = { type: 'legal', id: d.id }; },
    clarityConsentGo() {
      const ck = U.sheet?.ck || {}, band = S.user.ageBand || ck.band;
      if (!band || band === 'u13' || !ck.a || !ck.b || (band === '13-15' && !ck.c)) return;
      S.user.ageBand = band; if (band === '13-15') { S.user.isPrivate = true; S.user.followRequests = true; import('./backend.js').then(B => B.enabled && B.updateProfile()).catch(() => { }); }
      S.user.aiConsent = { v: CONSENT_V, ts: Date.now() }; saveCourse();
      U.sheet = null; return acts.clarityStart();
    },
    async clarityStart() {
      const u = ui(); if (u.phase !== 'welcome') return false;   // Doppelklick: der Kurs wird nur einmal angelegt
      const dr = draft(); dr.err = '';
      const text = String(dr.text || '').trim(), title = String(dr.title || '').trim();
      const onlySample = !dr.files.length && !dr.goals && (text === SAMPLE_TEXT.trim() || text === SAMPLE_MATH.trim());   // eigene Beispieltexte: ohne Dialog
      if (!dr.files.length && text.length < 40) { dr.err = text ? 'Der Text ist noch zu kurz. Füge mehr Notizen ein oder lade eine Datei hoch.' : 'Lade eine Datei hoch oder füge Notizen ein, damit wir loslegen können.'; return; }
      if (text.length > MAX_TEXT) { dr.err = 'Der eingefügte Text ist zu lang (höchstens ca. 600 Seiten). Lade ihn als Datei hoch oder kürze ihn.'; return; }
      if (!isClean(text, { learning: true }) || !isClean(title, { learning: true })) { dr.err = CLEAN_MSG; return; }
      if (!isDemo() && !onlySample && !aiConsentOk()) { U.sheet = { type: 'aiConsent' }; return; }
      if (offline() && (sim().offline || !isDemo())) { dr.err = 'Du bist offline. Die Analyse braucht Internet. Deine Dateien und Eingaben bleiben stehen: versuche es nochmals, sobald du wieder verbunden bist.'; return; }
      if (!dr.files.length && text.length < 300) toast?.('Das ist wenig Material. Der Kurs wird entsprechend kurz.');
      const g = { country: dr.country, scale: dr.scale, target: dr.target };
      const c = { id: uid(), title: title || dr.files[0]?.name.replace(/\.[^.]+$/, '') || 'Neuer Kurs', titleSet: !!title, createdAt: Date.now(), status: 'analyzing', stage: 'read', demo: !!isDemo(), lang: 'de',
        grading: g, files: [], goalsDoc: null, pages: 0, modules: [], concepts: [], usage: emptyUsage() };
      clarityData().courses.unshift(c); srcMap.set(c.id, { files: dr.files.slice(), goals: dr.goals || null, text });
      u.courseId = c.id; u.phase = 'processing'; u.build = { courseId: c.id, step: 0, label: '', frac: 0, pages: 0 };
      save(); try { window.scrollTo?.(0, 0); } catch { }
      ctx.render(); runCourse(c, ctx);   // läuft im Hintergrund, Ansicht zeichnet laufend neu
      return false;
    },
    clarityRetry() {
      const c = curCourse(); if (!c) return false;
      if (running.has(c.id)) { toast?.('Einen Moment, es läuft noch.'); return; }
      if (offline() && (sim().offline || !c.demo)) { c.status = 'error'; c.err = 'Du bist offline. Die Analyse braucht Internet. Verbinde dich und versuche es nochmals.'; return; }
      ui().build = null; runCourse(c, ctx); return false;
    },
    clarityCancel() {
      const c = curCourse(); if (!c) return;
      aborted.add(c.id); AI.abortBuild?.(c.id);
      ui().build = null; ui().phase = 'welcome'; ui().courseId = null;
      if (c.stage === 'read') { deleteCourse(c.id); srcMap.delete(c.id); }   // Eingaben bleiben im Entwurf stehen
      else { c.status = 'error'; c.err = 'Abgebrochen. Du kannst jederzeit fortsetzen.'; save(); }
    },
    clarityBack() {
      const c = curCourse();
      if (c && c.stage === 'read' && c.status !== 'ready' && !running.has(c.id)) { deleteCourse(c.id); srcMap.delete(c.id); }   // Lesen ohne Quelle: Rest entfernen, Entwurf bleibt
      ui().build = null; ui().phase = 'welcome'; ui().courseId = null;
    },
    clarityOpen(d) {
      const c = courseById(d.id), u = ui(); if (!c) return;
      u.courseId = c.id; u.conceptId = null; u.build = null;
      if (c.status === 'ready') { const i = (c.concepts || []).findIndex(k => !k.triage); u.phase = i >= 0 ? 'swipe' : 'dashboard'; u.swipe = { i: Math.max(0, i) }; }
      else u.phase = 'processing';
      try { window.scrollTo?.(0, 0); } catch { }
    },
    clarityAskDelete(d) { askDel = d.id; },
    clarityCancelDelete() { askDel = null; },
    clarityDoDelete(d) {
      const c = courseById(d.id); askDel = null; if (!c) return;
      aborted.add(c.id); AI.abortBuild?.(c.id); srcMap.delete(c.id); pagesMem.delete(c.id); try { imgDel(goalsKey(c)); } catch { }
      deleteCourse(c.id); toast?.('Kurs gelöscht');
    },
  };
  return acts;
}

export function uploadChange(ctx) {
  CTX = ctx; wire();
  return {
    clarityFiles(el) { const list = [...(el.files || [])]; try { el.value = ''; } catch { } addFiles(list, false); ctx.render(); },
    clarityGoals(el) { const list = [...(el.files || [])]; try { el.value = ''; } catch { } addFiles(list, true); ctx.render(); },
    clarityTarget(el) {
      const dr = draft(), v = targetList(dr.country, dr.scale)[+el.value]; if (v === undefined) return;
      dr.target = v; dr.touched = true; ctx.render();
    },
  };
}
