// Brained Clarity (Prüfungsgenerator) – Startseite (Upload + Auswahl), Generier-Screen, Paywall, Dokumentliste, Einwilligung.
// Ablauf: Generieren → lokal lesen (gratis) → ggf. Bezahl-Blatt (Spickzettel/Probeprüfung) → KI-Erzeugung → zurück zur Startseite mit «Deine Dokumente».
// Dateien und Texte bleiben im Gerät (IndexedDB). Alle Nutzer-/KI-Texte laufen über esc().
import { S, save, uid, can } from './store.js';
import { U } from './view-state.js';
import { esc } from './ui.js';
import { CONFIG } from './config.js';
import { isClean, CLEAN_MSG } from './moderation.js';
import { CLARITY_NAME, clarityData, docById, ui, saveDocs, loadPages, loadGoals, putSource, deleteDoc, friendlyErr, offline, sim } from './clarity.js';
import { creditBar } from './pro-v2.js';
import * as AI from './clarity-ai.js';
import * as G from './clarity-gen.js';

const MAX_MB = 60, MAX_TEXT = 1500000, MAX_DOCS = 60;
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
  sum: svg('<path d="M5 6h14M5 11h14M5 16h9"/>'),
  cheat: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  exam: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14l2 2 4-4"/>'),
};
export const TYPE_IC = { summary: IC.sum, cheat: IC.cheat, exam: IC.exam };
const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many}`;
const fmtN = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");   // Schweizer Format (4'590)
export const fmtDate = ts => new Date(ts).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

/* ---------------------------------- Entwurf ---------------------------------- */
// Titel, Land, Typ, Text bleiben nur lokal (localStorage) erhalten; hochgeladene Dateien nie.
const DRAFT_KEY = 'brained.clarity.draft2';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}; } catch { return {}; } };
const saveDraft = dr => { try { const { title, country, types, difficulty } = dr, text = dr.text ? String(dr.text).slice(0, MAX_TEXT) : ''; if (title || text) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, country, types, difficulty, text })); else localStorage.removeItem(DRAFT_KEY); } catch { } };
const profileCountry = () => G.COUNTRIES[S.user?.country] ? S.user.country : G.COUNTRIES[S.prefs?.gradeCountry] ? S.prefs.gradeCountry : 'CH';
export const draft = () => {
  const dr = (ui().draft ||= { files: [], goals: null, country: 'CH', types: ['exam'], difficulty: 'std', title: '', text: '' });
  if (!dr.init) {
    dr.init = true; dr.files ||= []; dr.text ||= ''; dr.types ||= ['exam']; dr.difficulty ||= 'std'; dr.country = profileCountry();
    const sv = loadSaved();
    if (sv.text && !dr.text) { dr.text = String(sv.text).slice(0, MAX_TEXT); dr.paste = true; }
    if (sv.title) dr.title ||= String(sv.title).slice(0, 80);
    if (G.COUNTRIES[sv.country]) dr.country = sv.country;
    if (Array.isArray(sv.types) && sv.types.length) dr.types = sv.types.filter(t => G.TYPE_NAME[t]);
    if (G.DIFFS.some(d => d[0] === sv.difficulty)) dr.difficulty = sv.difficulty;
    dr.restored = !!(sv.title || sv.text);
  }
  saveDraft(dr);
  return dr;
};
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.0', '') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const okType = f => /^(image\/|application\/pdf|text\/)/.test(f.type) || /\.(pdf|txt|md|jpe?g|png|heic|webp)$/i.test(f.name);

/* ---------------------------------- Laufzeit ---------------------------------- */
let JOB = null, CTX = null, running = false, askDel = null;
const noAI = () => !AI.aiOn({});   // Demo: weder Anmeldung noch Test-Aufruf vorhanden
export const jobRunning = () => running;
const gen = () => (ui().gen ||= { step: 0, frac: 0, label: '', err: '', paywall: false, pw: null });

/* ---------------------------------- Startseite ---------------------------------- */
export function uploadView() {
  const p = ui().phase;
  return p === 'processing' ? (gen().paywall ? paywallView() : processingView()) : welcomeView();
}
const seg = (items, cur, act, label, cls = '') => `<div class="clu-seg ${cls}" role="radiogroup" aria-label="${esc(label)}">${items.map(([id, html, aria]) => `<button type="button" role="radio" aria-checked="${cur === id}" class="${cur === id ? 'on' : ''}" data-a="${act}" data-id="${esc(id)}"${aria ? ` aria-label="${esc(aria)}"` : ''}>${html}</button>`).join('')}</div>`;
const fileRow = (name, size, act, i) => `<li class="clu-filerow"><span class="clu-fic">${IC.file}</span><span class="clu-fn"><b>${esc(name)}</b><small>${esc(size)}</small></span><button type="button" class="clu-x" data-a="${act}" data-i="${i}" aria-label="${esc('Entfernen: ' + name)}">${IC.x}</button></li>`;

function welcomeView() {
  const dr = draft(), docs = clarityData().docs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), u = ui();
  const hasExam = dr.types.includes('exam');
  return `<section class="clu-up clu-welcome">
    ${dr.restored ? `<div class="clu-resume clu-rise" role="status"><span><b>Entwurf wiederhergestellt</b><br>Titel und Text von deinem letzten Besuch. Dateien musst du neu auswählen.</span><button type="button" class="clu-btn" data-a="clarityDiscardDraft">Verwerfen</button></div>` : ''}
    <header class="clu-hero clu-rise">
      <span class="clu-eyebrow">${esc(CLARITY_NAME)}</span>
      <h1>Willkommen bei Brained Clarity</h1>
      <p class="clu-lead">Lade deinen Lernstoff hoch. Brained filtert das Unwichtige weg und erstellt dir Zusammenfassungen, Prüfungen und Spickzettel für das Schulsystem in der Schweiz, Deutschland oder Österreich.</p>
      ${noAI() ? `<p class="clu-demo-note" role="note"><b>Demo ohne KI.</b> Du siehst einfache Beispiel-Ergebnisse aus deinem Material, keine echte KI-Qualität.</p>` : ''}
    </header>
    ${u.done?.length ? `<div class="clu-done clu-rise" role="status"><b>Fertig!</b> <span>${u.done.length === 1 ? 'Dein Dokument ist' : 'Deine Dokumente sind'} unten in «Deine Dokumente».</span></div>` : ''}
    <div class="clu-rise" style="--d:.06s">
      <label class="clu-drop${dr.files.length ? ' has' : ''}" data-cl-drop="main">
        <input class="clu-file" type="file" multiple accept="application/pdf,image/*,.pdf,.txt,.md,text/plain,text/markdown" data-a-change="clarityFiles" aria-label="Lernstoff auswählen"/>
        <span class="clu-drop-ic">${IC.upload}</span>
        <b>${dr.files.length ? 'Weitere Dateien hinzufügen' : 'Dateien hier ablegen oder tippen'}</b>
        <small>PDF, Fotos, Textdateien (.txt, .md) · bis ${G.MAX_DOC_PAGES} Seiten · max. ${MAX_MB} MB je Datei</small>
      </label>
      ${dr.files.length ? `<ul class="clu-files" aria-label="Ausgewählte Dateien">${dr.files.map((f, i) => fileRow(f.name, fmtSize(f.size), 'clarityRemoveFile', i)).join('')}</ul>` : ''}
      ${dr.paste || dr.text ? `<div class="clu-field"><label for="clu-text">Text einfügen</label><textarea id="clu-text" class="clu-text" rows="6" maxlength="${MAX_TEXT}" placeholder="Notizen oder Skript hier einfügen …" data-bind="clarity.draft.text">${esc(dr.text || '')}</textarea></div>`
        : `<button type="button" class="clu-link" data-a="clarityTogglePaste">Oder Text einfügen</button>`}
    </div>
    <div class="clu-card-s clu-rise" style="--d:.1s">
      <div class="clu-card-h"><b>Lernziele oder Altklausur hinzufügen</b><span class="clu-opt">Optional</span></div>
      <p class="clu-hint">Wir filtern deinen Stoff anhand deiner Lernziele. Was wegfällt, siehst du in einer Streichliste.</p>
      ${dr.goals ? `<ul class="clu-files">${fileRow(dr.goals.name, fmtSize(dr.goals.size), 'clarityRemoveGoals', 0)}</ul>`
        : `<label class="clu-drop sm" data-cl-drop="goals"><input class="clu-file" type="file" accept="application/pdf,image/*,.pdf,.txt,.md,text/plain,text/markdown" data-a-change="clarityGoals" aria-label="Lernziele oder Altklausur auswählen"/><span class="clu-drop-ic">${IC.target}</span><b>Datei auswählen</b></label>`}
    </div>
    <div class="clu-field clu-rise" style="--d:.14s"><label for="clu-title">Dokumenttitel</label>
      <input id="clu-title" class="clu-input" type="text" maxlength="80" placeholder="z. B. Biologie, Prüfung 12. November" autocomplete="off" data-bind="clarity.draft.title" value="${esc(dr.title || '')}"/></div>
    <div class="clu-card-s clu-rise" style="--d:.18s">
      <div class="clu-card-h"><b>Land</b></div>
      ${seg(Object.entries(G.COUNTRIES).map(([id, c]) => [id, `<b class="clu-flag" aria-hidden="true">${id}</b><span>${esc(c.name)}</span>`, c.name]), dr.country, 'claritySetCountry', 'Land', 'stack')}
      <p class="clu-hint">Prüfungsstil, Notensystem und Rechtschreibung folgen dem Land${dr.country === 'CH' ? ' (Schweizer Rechtschreibung ohne ß)' : ''}.</p>
    </div>
    <div class="clu-card-s clu-rise" style="--d:.22s">
      <div class="clu-card-h"><b>Was soll Brained erstellen?</b><span class="clu-opt">Mehrfachauswahl</span></div>
      <div class="clu-types" role="group" aria-label="Typ">${G.TYPES.map(([id, name, sub]) => `<button type="button" role="checkbox" aria-checked="${dr.types.includes(id)}" class="clu-type${dr.types.includes(id) ? ' on' : ''}" data-a="clarityToggleType" data-id="${id}"><span class="clu-type-ic">${TYPE_IC[id]}</span><span class="clu-type-t"><b>${esc(name)}</b><small>${esc(sub)}</small></span><i class="clu-type-ck" aria-hidden="true">${dr.types.includes(id) ? IC.check : ''}</i></button>`).join('')}</div>
      ${hasExam ? `<div class="clu-sub"><div class="clu-sublabel">Schwierigkeit der Probeprüfung</div>${seg(G.DIFFS.map(([id, name, sub]) => [id, `<b>${esc(name)}</b><small>${esc(sub)}</small>`, name]), dr.difficulty, 'claritySetDiff', 'Schwierigkeit', 'diff')}</div>` : ''}
    </div>
    ${dr.err ? `<div class="clu-err" role="alert">${esc(dr.err)}</div>` : ''}
    <button type="button" class="clu-cta" data-a="clarityStart">Generieren</button>
    <p class="clu-privacy">${IC.lock} <span>Deine Unterlagen bleiben auf deinem Gerät, nur der Text geht zur KI.</span></p>
    ${CONFIG.PRO_ENABLED ? creditBar('cl-credit') : ''}
    ${docs.length ? `<h2 class="clu-sec">Deine Dokumente</h2><div class="clu-courses" data-test="doc-list">${docs.map(docRow).join('')}</div>` : ''}
  </section>`;
}

function docRow(c) {
  if (askDel === c.id) return `<div class="clu-course del" role="alertdialog" aria-label="Dokument löschen"><b>«${esc(c.title)}» löschen?</b><span>Das ${esc(G.TYPE_NAME[c.type] || 'Dokument')} wird von diesem Gerät entfernt.</span>
    <div class="clu-row2"><button type="button" class="clu-btn ghost" data-a="clarityCancelDelete">Abbrechen</button><button type="button" class="clu-btn dark" data-a="clarityDoDelete" data-id="${esc(c.id)}">Löschen</button></div></div>`;
  return `<div class="clu-course">
    <button type="button" class="clu-course-main" data-a="clarityOpenDoc" data-id="${esc(c.id)}">
      <span class="clu-dtype" aria-hidden="true">${TYPE_IC[c.type] || IC.file}</span>
      <span class="clu-course-t"><b>${esc(c.title)}</b><small>${esc(G.TYPE_NAME[c.type] || 'Dokument')} · ${esc(G.COUNTRIES[c.country]?.name || '')} · ${esc(fmtDate(c.createdAt))}${c.demo ? ' · Demo' : ''}</small></span>
      <span class="clu-chev">${IC.chev}</span>
    </button>
    <button type="button" class="clu-x" data-a="clarityAskDelete" data-id="${esc(c.id)}" aria-label="${esc('Dokument löschen: ' + c.title)}">${IC.trash}</button>
  </div>`;
}

/* ---------------------------------- Generier-Screen ---------------------------------- */
const stepTexts = () => {
  const j = JOB || {}, c = G.COUNTRIES[j.country]?.name || 'deines Landes', many = (j.types || []).length > 1;
  return [
    'Dein Dokument wird gelesen und bereinigt …',
    j.goalsText || j.goals ? 'Dein Stoff wird anhand deiner Lernziele gefiltert, Unwichtiges fällt weg …' : 'Unwichtiges wird weggefiltert, das Wesentliche bleibt …',
    `${many ? 'Deine Texte werden' : 'Dein Text wird'} im Prüfungsstil ${c} geschrieben …`,
    'Lösungsblatt, Bewertungsraster und Brain-Stempel werden angefügt …',
  ];
};
const USPS = ['Unwichtiges gefiltert', 'Prüfungsstil deines Landes', 'Lösungsblatt & Bewertungsraster', 'Brain-Stempel'];
function processingView() {
  const g = gen(), live = running, err = !live && g.err, step = clamp01(g.step, 3);
  const steps = stepTexts(), pct = Math.round(Math.max(0, Math.min(1, g.frac || 0)) * 100);
  const state = i => err && i === step ? 'err' : i < step ? 'done' : i === step ? (live ? 'active' : 'paused') : 'todo';
  const title = JOB?.title || 'Dokument';
  return `<section class="clu-up clu-proc" data-test="clarity-processing">
    <header class="clu-hero clu-rise">
      <span class="clu-eyebrow">${esc(title)}${JOB?.demo ? ' · Demo' : ''}</span>
      <h1>${err ? 'Das hat nicht geklappt' : 'Dein Dokument wird erstellt'}</h1>
      <p class="clu-lead">${err ? 'Nichts geht verloren: deine Eingaben sind noch da.' : 'Das dauert meist ein bis zwei Minuten. Du kannst die App offen lassen.'}</p>
    </header>
    <ol class="clu-steps" aria-live="polite" aria-label="Fortschritt">
      ${steps.map((t, i) => { const s = state(i); return `<li class="clu-step ${s}" ${s === 'active' ? 'aria-current="step"' : ''}>
        <span class="clu-mark" aria-hidden="true">${s === 'done' ? IC.check : s === 'err' ? '!' : s === 'active' ? '<i class="clu-pulse"></i>' : i + 1}</span>
        <span class="clu-step-t"><b>${esc(t)}</b>${s === 'active' && g.label && g.label !== t ? `<small>${esc(g.label)}</small>` : ''}${s === 'active' ? `<span class="clu-bar${pct ? '' : ' ind'}" role="progressbar" aria-valuemin="0" aria-valuemax="100" ${pct ? `aria-valuenow="${pct}"` : ''}><i style="width:${pct || 35}%"></i></span>` : ''}</span></li>`; }).join('')}
    </ol>
    <ul class="clu-usps" aria-label="Das macht Brained Clarity besonders">${USPS.map(x => `<li>${IC.check}<span>${esc(x)}</span></li>`).join('')}</ul>
    ${err ? `<div class="clu-err" role="alert">${esc(g.err)}</div>` : ''}
    <div class="clu-actions">
      ${err && ['limit_free_summary', 'credit_used_up'].includes(g.code) && CONFIG.PRO_ENABLED && !can('clarity') ? `<button type="button" class="clu-cta" data-a="openSheet" data-type="pro">Mit Brained Pro freischalten</button>` : ''}
      ${err && !['limit_free_summary', 'doc_too_long'].includes(g.code) ? `<button type="button" class="clu-cta" data-a="clarityRetry">Nochmals versuchen</button>` : ''}
      ${live ? `<button type="button" class="clu-btn ghost block" data-a="clarityCancel">Abbrechen</button>` : `<button type="button" class="clu-btn ghost block" data-a="clarityBack">Zurück</button>`}
    </div>
  </section>`;
}
const clamp01 = (x, max) => Math.max(0, Math.min(max, +x || 0));

// Bezahl-Blatt: erst bei «Generieren» von Spickzettel oder Probeprüfung. Lesen und Vorschau waren gratis.
function paywallView() {
  const p = gen().pw || {}, ok = can('clarity'), onlySum = (JOB?.types || []).includes('summary') && (JOB?.types || []).length > 1;
  const titles = (p.titles?.length ? p.titles : ['Einführung', 'Grundlagen', 'Vertiefung', 'Anwendung']).slice(0, 5);
  return `<section class="clu-up clu-proc pr2-pw" data-test="clarity-paywall">
    <header class="clu-hero clu-rise"><span class="clu-eyebrow">${esc(JOB?.title || '')}</span><h1>Dein Stoff ist bereit</h1>
      <p class="clu-lead">Dein Dokument: ${plural(p.pages || JOB?.pageCount || 0, 'Seite', 'Seiten')}, ${plural(p.chapters || 0, 'Kapitel', 'Kapitel')}.</p></header>
    <ol class="pr2-blur" aria-hidden="true">${titles.map((t, i) => `<li><span>${i + 1}</span><b>${esc(t)}</b></li>`).join('')}</ol>
    <p class="pr2-pw-t">Spickzettel und Probeprüfungen mit Lösungsblatt gibt es mit Brained Pro: CHF 14.90 im Monat oder CHF 129 im Jahr. Eine Zusammenfassung pro Woche ist gratis.</p>
    <div class="clu-actions">
      ${ok ? `<button type="button" class="clu-cta" data-a="clarityRetry">Generieren</button>` : `<button type="button" class="clu-cta" data-a="openSheet" data-type="pro">Mit Brained Pro freischalten</button><button type="button" class="clu-btn ghost block" data-a="clarityRetry">Ich habe Pro: nochmals versuchen</button>`}
      ${!ok && onlySum ? `<button type="button" class="clu-btn ghost block" data-a="clarityOnlySummary">Nur die Zusammenfassung generieren</button>` : ''}
      <button type="button" class="clu-btn ghost block" data-a="clarityBack">Zurück</button>
    </div></section>`;
}

/* ---------------------------------- Einwilligung ---------------------------------- */
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
    <p class="clu-c-lead">Damit Brainy Zusammenfassungen, Spickzettel und Probeprüfungen erstellen kann, senden wir Textauszüge (bei Fotos und Scans: Bilder der Seiten) über unseren Server an <b>Anthropic</b> (KI-Dienst, USA).</p>
    <ul class="clu-c-list">
      <li>Deine Unterlagen und Dokumente bleiben auf deinem Gerät. Wir speichern sie nicht.</li>
      <li>Anthropic löscht die Daten nach spätestens 30 Tagen und trainiert damit nicht.</li>
      <li>Lade nur Unterlagen hoch, die du fürs eigene Lernen nutzen darfst. Keine ganzen Lehrmittel, keine Namen oder Noten von anderen Personen.</li>
      <li>Du kannst deine Einwilligung jederzeit im Profil widerrufen.</li>
    </ul>
    ${S.user?.ageBand ? '' : `<div class="field"><label id="aiAge">Wie alt bist du?</label><div class="chips" role="radiogroup" aria-labelledby="aiAge">${bandBtn('13-15', '13–15')}${bandBtn('16+', '16 oder älter')}${bandBtn('u13', 'Jünger als 13')}</div></div>`}
    ${under ? '<p class="clu-c-under" role="alert">Brained ist erst ab 13. Frag in ein paar Jahren nochmals.</p>' : ''}
    <div class="consents">
      ${box('a', `Ich willige ein, dass meine Unterlagen zur Erstellung von Zusammenfassungen, Spickzetteln und Prüfungen an Anthropic (USA) gesendet werden. Details: ${link('datenschutz', 'Datenschutzerklärung')}`)}
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
    if (!dr.title && !dr.titleTouched) dr.title = f.name.replace(/\.[^.]+$/, '').slice(0, 80);   // Titel-Vorschlag aus dem Dateinamen
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
}

/* ---------------------------------- Auftrag: lesen → erzeugen → speichern ---------------------------------- */
const own = (msg, code) => Object.assign(new Error(msg), { own: true, ...(code ? { code } : {}) });
const errText = (e, what) => e?.own ? e.message : friendlyErr(e, what);
const needsPro = j => !!CONFIG.PRO_ENABLED && AI.clarityGated() && j.types.some(t => t !== 'summary');
const setG = (o, ctx) => { Object.assign(gen(), o); ctx?.render?.(); };

async function readStage(j, ctx) {
  if (sim().failRead) throw new Error(sim().failRead);
  const prog = (label, frac, read) => { if (JOB === j) setG({ step: 0, label: label || '', frac: Math.min(1, frac || 0) }, ctx); };
  let pages = [], notes = [];
  const cs = { id: j.gid, usage: { calls: 0, tin: 0, tout: 0, cost: 0, byStep: {} }, pages: 0, demo: j.demo };
  if (j.files.length) { const r = await AI.readFiles(j.files, (_s, frac, label, read) => prog(label, frac, read), cs, G.MAX_DOC_PAGES + 1); pages = (r.pages || []).slice(); notes = r.notes || []; }
  if (j.aborted) throw own('Abgebrochen.');
  const text = String(j.text || '').trim();
  if (text) {   // Eingefügten Text wie eine Textdatei in «Seiten» zu ca. 3000 Zeichen teilen
    let cur = ''; const flush = () => { if (cur.trim()) pages.push({ n: 0, text: cur.trim(), file: 'tx' }); cur = ''; };
    for (const para of text.split(/\n{2,}/)) { if (cur && cur.length + para.length > 3000) flush(); cur += (cur ? '\n\n' : '') + para; }
    flush();
  }
  pages = pages.filter(p => String(p.text || '').trim());
  if (!pages.some(p => String(p.text).trim().length > 20)) throw own('In den Unterlagen wurde kein lesbarer Text gefunden. Versuche schärfere Fotos, eine andere Datei oder füge den Text direkt ein.');
  if (pages.length > G.MAX_DOC_PAGES) throw own(`Dein Dokument hat mehr als ${G.MAX_DOC_PAGES} Seiten. Pro Generierung sind höchstens ${G.MAX_DOC_PAGES} Seiten möglich. Teile es in mehrere Teile auf.`, 'doc_too_long');
  j.pages = pages.map((p, i) => ({ n: i + 1, text: String(p.text) }));
  j.pageCount = j.pages.length;
  if (j.goals) {
    prog('Lernziele werden gelesen …', 0.9);
    try {
      const g = await AI.readGoals(j.goals, () => { }, cs), gp = (g?.pages || []).filter(p => String(p.text || '').trim());
      if (gp.length) { j.goalsPages = gp; j.goalsText = gp.map(p => p.text).join('\n\n').slice(0, 6000); }
    } catch { notes.push(`«${j.goals.name}» konnte nicht gelesen werden. Es geht ohne diese Datei weiter.`); }
  }
  if (j.aborted) throw own('Abgebrochen.');
  try { await putSource(j.gid, j.pages, j.goalsPages); } catch { }   // für «Neu generieren» ohne neuen Upload
  j.files = []; j.goals = null;
  if (notes.length) ctx.toast?.(esc(notes[0]));
}

function storeDocs(j, out) {
  const dd = clarityData(), now = Date.now(), made = [];
  for (const d of [...out.docs].reverse()) {   // neueste oben, Reihenfolge Zusammenfassung · Spickzettel · Prüfung
    const base = { type: d.type, title: j.title, country: j.country, createdAt: now, pages: out.pages, chapters: out.chapters, content: d.content, dropped: d.dropped || [], demo: !!out.demo, goals: !!j.goalsText, hint: j.hint || '' };
    if (d.type === 'exam') { base.difficulty = j.difficulty; base.passPct = j.passPct || G.defaultPass(j.country); }
    const old = j.replaceId && docById(j.replaceId);
    if (old) { Object.assign(old, base, { id: old.id, gid: old.gid, passPct: old.passPct || base.passPct }); delete old.result; made.push(old.id); }
    else { const doc = { id: uid(), gid: j.gid, ...base }; dd.docs.unshift(doc); made.push(doc.id); }
  }
  dd.docs = dd.docs.slice(0, MAX_DOCS); saveDocs();
  return made;
}

async function run(j, ctx) {
  if (running) return; running = true; j.aborted = false;
  const g = gen(); g.err = ''; g.code = ''; g.paywall = false;
  try {
    if (!j.pages) { setG({ step: 0, frac: 0, label: '' }, ctx); await readStage(j, ctx); }
    if (j.aborted) throw own('Abgebrochen.');
    if (needsPro(j)) { g.paywall = true; g.pw = AI.localPreview(j.pages); running = false; ctx.render(); return; }
    if (sim().slow) await new Promise(r => setTimeout(r, sim().slow));
    if (sim().failGenerate) throw new Error(sim().failGenerate);
    const out = await G.generate(j, p => { if (JOB === j) setG({ step: p.step, frac: p.frac, label: p.label }, ctx); });
    if (j.aborted) throw own('Abgebrochen.');
    const made = storeDocs(j, out);
    running = false; JOB = null;
    const u = ui();
    if (j.replaceId && docById(j.replaceId)) { u.phase = 'doc'; u.docId = j.replaceId; u.view = { tab: 'main' }; }
    else { u.phase = 'welcome'; u.docId = null; u.done = made; }
    u.gen = null;
    const d0 = draft(); if (!j.replaceId) { Object.assign(d0, { files: [], goals: null, text: '', title: '', paste: false, err: '', restored: false, titleTouched: false }); try { localStorage.removeItem(DRAFT_KEY); } catch { } }
    try { window.scrollTo?.(0, 0); } catch { }
    ctx.chime?.(); ctx.haptic?.(12); ctx.toast?.(j.replaceId ? 'Neu erstellt' : 'Fertig: dein Dokument ist in «Deine Dokumente»');
  } catch (e) {
    running = false;
    if (!j.aborted && (e?.code === 'pro_required_generator' || e?.code === 'pro_required_clarity')) { g.paywall = true; g.pw = AI.localPreview(j.pages || []); }
    else { g.err = j.aborted ? 'Abgebrochen. Du kannst jederzeit nochmals starten.' : errText(e, 'Die Erstellung'); g.code = e?.code || ''; }
  }
  ctx.render();
}

// «Neu generieren» / «Fehler melden» aus der Dokument-Ansicht: gleiche Quelle, nur dieser Typ, optional mit Hinweis
export async function regenerate(doc, hint = '', ctx = CTX) {
  if (running) { ctx.toast?.('Einen Moment, es läuft noch.'); return false; }
  const pages = await loadPages(doc.gid);
  if (!pages.length) { ctx.toast?.('Die Unterlagen sind nicht mehr auf diesem Gerät. Lade sie bitte neu hoch.'); return false; }
  const goalsPages = await loadGoals(doc.gid);
  const j = JOB = { gid: doc.gid, replaceId: doc.id, title: doc.title, country: doc.country, types: [doc.type], difficulty: doc.difficulty || 'std', passPct: doc.passPct, pages, pageCount: pages.length, goalsPages, goalsText: goalsPages ? goalsPages.map(p => p.text).join('\n\n').slice(0, 6000) : '', hint: String(hint || '').slice(0, 400), demo: noAI(), files: [], goals: null, text: '' };
  const u = ui(); u.phase = 'processing'; u.gen = { step: 1, frac: 0, label: '', err: '', paywall: false, pw: null };
  ctx.render(); run(j, ctx);
  return true;
}

/* ---------------------------------- Aktionen ---------------------------------- */
export function uploadActions(ctx) {
  CTX = ctx; wire();
  const { toast } = ctx;
  const acts = {
    clarityTogglePaste() { draft().paste = true; },
    clarityRemoveFile(d) { draft().files.splice(+d.i, 1); },
    clarityDiscardDraft() { const dr = draft(); Object.assign(dr, { files: [], goals: null, text: '', title: '', paste: false, err: '', restored: false, titleTouched: false }); try { localStorage.removeItem(DRAFT_KEY); } catch { } },
    clarityRemoveGoals() { draft().goals = null; },
    claritySetCountry(d) { const dr = draft(); if (!G.COUNTRIES[d.id]) return; dr.country = d.id; S.prefs = { ...(S.prefs || {}), gradeCountry: d.id }; saveDocs(); },
    claritySetDiff(d) { if (G.DIFFS.some(x => x[0] === d.id)) draft().difficulty = d.id; },
    clarityToggleType(d) { const dr = draft(); if (!G.TYPE_NAME[d.id]) return; dr.types = dr.types.includes(d.id) ? dr.types.filter(t => t !== d.id) : G.TYPES.map(t => t[0]).filter(t => t === d.id || dr.types.includes(t)); dr.err = ''; },
    clarityConsentToggle(d) { const ck = (U.sheet.ck ||= {}); ck[d.k] = !ck[d.k]; },
    clarityConsentBand(d) { const ck = (U.sheet.ck ||= {}); ck.band = d.v; if (d.v === 'u13') { ck.a = ck.b = ck.c = false; } },
    clarityConsentLegal(d) { U.sheetBack = { sheet: U.sheet, form: U.form }; U.sheet = { type: 'legal', id: d.id }; },
    clarityConsentGo() {
      const ck = U.sheet?.ck || {}, band = S.user.ageBand || ck.band;
      if (!band || band === 'u13' || !ck.a || !ck.b || (band === '13-15' && !ck.c)) return;
      S.user.ageBand = band; if (band === '13-15') { S.user.isPrivate = true; S.user.followRequests = true; import('./backend.js').then(B => B.enabled && B.updateProfile()).catch(() => { }); }
      S.user.aiConsent = { v: CONSENT_V, ts: Date.now() }; saveDocs();
      U.sheet = null; return acts.clarityStart();
    },
    async clarityStart() {
      const u = ui(); if (u.phase !== 'welcome' || running) return false;   // Doppelklick: der Auftrag startet nur einmal
      const dr = draft(); dr.err = '';
      const text = String(dr.text || '').trim(), title = String(dr.title || '').trim() || (dr.files[0]?.name.replace(/\.[^.]+$/, '') || '');
      if (!dr.files.length && text.length < 40) { dr.err = text ? 'Der Text ist noch zu kurz. Füge mehr Notizen ein oder lade eine Datei hoch.' : 'Lade eine Datei hoch oder füge Text ein, damit wir loslegen können.'; return; }
      if (text.length > MAX_TEXT) { dr.err = 'Der eingefügte Text ist zu lang. Lade ihn als Datei hoch oder kürze ihn.'; return; }
      if (!title) { dr.err = 'Gib deinem Dokument einen kurzen Titel.'; return; }
      if (!dr.types.length) { dr.err = 'Wähle aus, was Brained erstellen soll: Zusammenfassung, Spickzettel oder Probeprüfung.'; return; }
      if (!isClean(text, { learning: true }) || !isClean(title, { learning: true })) { dr.err = CLEAN_MSG; return; }
      if (!noAI() && !aiConsentOk()) { U.sheet = { type: 'aiConsent' }; return; }
      if (offline() && (sim().offline || !noAI())) { dr.err = 'Du bist offline. Die Erstellung braucht Internet. Deine Dateien und Eingaben bleiben stehen: versuche es nochmals, sobald du wieder verbunden bist.'; return; }
      dr.title = title;
      const j = JOB = { gid: uid(), title, country: dr.country, types: G.TYPES.map(t => t[0]).filter(t => dr.types.includes(t)), difficulty: dr.difficulty, passPct: G.defaultPass(dr.country), files: dr.files.slice(), goals: dr.goals || null, text, hint: '', demo: noAI(), pages: null };
      u.done = null; u.phase = 'processing'; u.gen = { step: 0, frac: 0, label: '', err: '', paywall: false, pw: null };
      try { window.scrollTo?.(0, 0); } catch { }
      ctx.render(); run(j, ctx);   // läuft im Hintergrund, Ansicht zeichnet laufend neu
      return false;
    },
    async clarityRetry() {
      const j = JOB; if (!j) return false;
      if (running) { toast?.('Einen Moment, es läuft noch.'); return false; }
      if (gen().paywall && CONFIG.PRO_ENABLED && !can('clarity')) { try { const B = await import('./backend.js'); if (B.enabled) await B.loadPlan(); } catch { } }   // frisch gekauft? Paket neu laden
      if (offline() && (sim().offline || !j.demo)) { gen().err = 'Du bist offline. Die Erstellung braucht Internet. Verbinde dich und versuche es nochmals.'; return; }
      if (gen().paywall && needsPro(j)) { toast?.('Brained Pro wurde noch nicht erkannt. Das kann einen Moment dauern.'); return false; }
      run(j, ctx); return false;
    },
    clarityOnlySummary() { const j = JOB; if (!j) return false; j.types = ['summary']; gen().paywall = false; run(j, ctx); return false; },
    clarityCancel() {
      const j = JOB; if (j) j.aborted = true; AI.abortBuild?.(j?.gid);
      running = false; const u = ui(); u.gen = null;
      u.phase = j?.replaceId ? 'doc' : 'welcome'; if (!j?.replaceId) u.docId = null;
      JOB = null;
    },
    clarityBack() {
      const u = ui(), j = JOB; running = false; JOB = null; u.gen = null;
      u.phase = j?.replaceId ? 'doc' : 'welcome'; if (!j?.replaceId) u.docId = null;
    },
    clarityOpenDoc(d) {
      const c = docById(d.id), u = ui(); if (!c) return;
      u.docId = c.id; u.phase = 'doc'; u.view = { tab: 'main', mode: 'tasks' }; u.done = null;
      try { window.scrollTo?.(0, 0); } catch { }
    },
    clarityAskDelete(d) { askDel = d.id; },
    clarityCancelDelete() { askDel = null; },
    clarityDoDelete(d) { askDel = null; const c = docById(d.id); if (!c) return; AI.abortBuild?.(c.gid); deleteDoc(c.id); const u = ui(); if (u.docId === c.id) { u.docId = null; u.phase = 'welcome'; } toast?.('Dokument gelöscht'); },
  };
  return acts;
}

export function uploadChange(ctx) {
  CTX = ctx; wire();
  return {
    clarityFiles(el) { const list = [...(el.files || [])]; try { el.value = ''; } catch { } addFiles(list, false); ctx.render(); },
    clarityGoals(el) { const list = [...(el.files || [])]; try { el.value = ''; } catch { } addFiles(list, true); ctx.render(); },
  };
}
// nur für Tests
export const __job = () => JOB;
