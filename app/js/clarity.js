// Brained Clarity – Zustand, Router und Verdrahtung. Bauplan: docs/CLARITY-BAUPLAN.md
// Kursdaten bleiben lokal: S.clarity (klein, localStorage), Seitentexte in IndexedDB. Nie auf den Server.
import { S, save, hooks, SAVED_KEY } from './store.js';
import { U } from './view-state.js';
import { esc } from './ui.js';
import { hasKey } from './ai.js';
import { imgPut, imgGet, imgDel } from './idb.js';
import { uploadView, uploadActions, uploadChange } from './clarity-upload.js';
import { swipeView, swipeActions } from './clarity-swipe.js';
import { dashView, dashActions } from './clarity-dashboard.js';
import { playerView, playerActions } from './clarity-player.js';
import { examView, examActions, examChange } from './clarity-exam.js';
import { reportActions } from './clarity-report.js';
import { introView, introActions, introWanted } from './clarity-intro.js';
import * as E from './clarity-engine.js';

export const CLARITY_NAME = 'Brained Clarity';   // sichtbarer Name an genau einer Stelle

export function clarityData() { if (!S.clarity) S.clarity = { courses: [] }; return S.clarity; }
export const courseById = id => clarityData().courses.find(c => c.id === id) || null;
export const ui = () => (U.clarity ||= clarityInit());
export const curCourse = () => courseById(ui().courseId);
export const saveCourse = () => save();
export const isDemo = () => !hasKey();

// Ausfälle simulieren (Konsole/Tests): window.__claritySim = { offline: true }
export const sim = () => globalThis.__claritySim || {};
export const offline = () => !!sim().offline || (typeof navigator !== 'undefined' && navigator.onLine === false);
// Verständliche Fehlertexte statt Technik. what = «Die Analyse», «Die Etappe» …
export function friendlyErr(e, what = 'Das') {
  const m = String(e?.message || e || '');
  if (offline() || /^offline$|Verbindung|network|fetch|Failed to send|timeout|Load failed/i.test(m)) return `Keine Internetverbindung. Prüfe dein WLAN oder deine Daten und versuche es nochmals. ${what} geht danach weiter.`;
  if (/^limit$|Zu viele|429|Limit|Kontingent|quota|überlastet/i.test(m)) return 'Brainy ist gerade stark ausgelastet oder hat sein Tageslimit erreicht. Warte ein paar Minuten und versuche es nochmals.';
  if (/^bad$|unbrauchbar|Struktur|Kein JSON|abgeschnitten/i.test(m)) return 'Brainy hat eine unvollständige Antwort geliefert. Nochmals versuchen hilft meistens.';
  if (/Abgebrochen/.test(m)) return 'Abgebrochen. Du kannst jederzeit fortsetzen.';
  if (/NO_KEY/.test(m)) return 'Die KI-Verbindung ist gerade nicht aktiv. Melde dich an oder versuche es später nochmals.';
  if (/[äöüÄÖÜ]|\b(Bitte|Kurs|Etappe|Material|Unterlagen|Prüfung|Datei|Text)\b/.test(m) && m.length < 220 && !/Error|undefined|\bat \w+\.|JSON|HTTP|\d{3}\b/.test(m)) return m;
  return `${what} hat gerade nicht geklappt. Versuche es nochmals; deine Eingaben sind noch da.`;
}

export function clarityInit(enter = false) {
  return { tool: 'clarity', phase: enter && introWanted() ? 'intro' : 'welcome', courseId: null, conceptId: null,
    draft: { files: [], goals: null, country: 'CH', scale: '1-6', target: 5, title: '' }, build: null, swipe: { i: 0 }, player: null, tools: null };
}

// Seitentexte und Originale liegen nur im Gerät (IndexedDB). Seiten: [{ n, text, file }]
const pkey = (c, k) => `clarity:${c.id}:${k}`;
export async function loadPages(course) { try { return JSON.parse(await imgGet(pkey(course, 'pages')) || '[]'); } catch { return []; } }
export const putPages = (course, pages) => imgPut(pkey(course, 'pages'), JSON.stringify(pages));
export function deleteCourse(id) {
  const c = courseById(id); if (!c) return;
  imgDel(pkey(c, 'pages'));
  clarityData().courses = clarityData().courses.filter(x => x.id !== id); save();
}

// Speicher voll (localStorage ca. 5 MB): Kurse zusätzlich in IndexedDB sichern; beim Start neuere Sicherung zurückholen
const BK_KEY = 'clarity-backup:' + SAVED_KEY;
let CTX = null, warned = false;
const prevQuota = hooks.onQuota;   // Path-Handler bleibt, bis Path entfernt ist
hooks.onQuota = () => {
  try { prevQuota?.(); } catch { }
  try { imgPut(BK_KEY, JSON.stringify({ ts: Date.now(), clarity: S.clarity })); } catch { }
  if (!warned) { warned = true; CTX?.toast?.('Speicher fast voll: deine Kurse sind zusätzlich gesichert. Lösche Kurse, die du nicht mehr brauchst.'); }
};
(async () => {
  try {
    const b = JSON.parse(await imgGet(BK_KEY) || 'null'), ts = +localStorage.getItem(SAVED_KEY) || 0;
    if (b?.ts > ts && Array.isArray(b.clarity?.courses)) { S.clarity = b.clarity; save(); CTX?.render?.(); }
  } catch { }
})();

// Router: Phase → Ansicht
function routeView() {
  const p = ui().phase;
  if (p === 'intro') return introView();
  if (p === 'swipe') return swipeView();
  if (p === 'dashboard') return dashView();
  if (p === 'player') return playerView();
  if (p === 'tools') return examView();
  return uploadView();   // welcome · processing
}
export function clarityView() {
  const html = routeView(), c = curCourse();
  const needsNet = sim().offline || !c?.demo && !isDemo();
  return offline() && needsNet ? `<div class="cl-offline" role="status">Du bist offline. Gelernte Etappen und Übungen ohne KI gehen weiter. Analyse und neue Etappen brauchen Internet.</div>${html}` : html;
}
try { addEventListener('online', () => CTX?.render?.()); addEventListener('offline', () => CTX?.render?.()); } catch { }

const DECO = `<svg class="deco" viewBox="0 0 120 110" aria-hidden="true"><g fill="rgba(191,233,255,.12)" stroke="#BFE9FF" stroke-width="2.6"><circle cx="38" cy="46" r="17"/><circle cx="60" cy="38" r="19"/><circle cx="82" cy="46" r="17"/><circle cx="29" cy="64" r="15"/><circle cx="91" cy="64" r="15"/><circle cx="45" cy="78" r="15"/><circle cx="75" cy="78" r="15"/></g></svg>`;
const byNewest = () => clarityData().courses.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const fmtG = (c, g) => E.formatGrade(c.grading?.country, c.grading?.scale, g);

// Home: grosse Karte mit der nächsten Etappe (ohne Kurs: Einstieg «Clarity starten»)
export function clarityHomeCard() {
  const list = byNewest(), c = list.find(x => x.status === 'ready' && E.nextConcept(x)) || list[0];
  if (!c) return `<button class="v2-cl" data-a="aiTool" data-id="clarity">${DECO}<span class="k">${esc(CLARITY_NAME.toUpperCase())}</span><b class="t">Dein Stoff. Klar gefiltert.</b><span class="m">Lade deinen Lernstoff hoch und lerne Etappe für Etappe zur Zielnote.</span><span class="cta">Clarity starten</span></button>`;
  const ready = c.status === 'ready', nx = ready ? E.nextConcept(c) : null;
  const days = c.examDate ? Math.ceil((c.examDate - Date.now()) / 864e5) : null;
  const k = `${esc(c.title.toUpperCase())}${days != null && days >= 0 ? ` · PRÜFUNG ${days === 0 ? 'HEUTE' : `IN ${days} ${days === 1 ? 'TAG' : 'TAGEN'}`}` : ''}`;
  let meta = '';
  if (ready) {
    const all = E.orderedConcepts(c), i = nx ? all.findIndex(x => x.id === nx.id) + 1 : all.length, g = E.gradePrognosis(c);
    meta = `${nx ? `Etappe ${i} von ${all.length} · ca. ${E.formatDuration(E.stageMinutes(nx))} · ` : ''}Prognose ~${esc(fmtG(c, g.now))} → ~${esc(fmtG(c, g.atFinish))}`;
  } else meta = 'Analyse noch nicht fertig';
  return `<button class="v2-cl" data-a="${ready ? 'clarityResume' : 'clarityOpen'}" data-id="${esc(c.id)}">${DECO}<span class="k">${k}</span>
    <b class="t">${nx ? `Weiter: ${esc(nx.title)}` : ready ? 'Alle Etappen geschafft' : 'Kurs wird vorbereitet'}</b><span class="m">${meta}</span>
    <span class="cta">${ready ? (nx ? 'Weiter' : 'Öffnen') : 'Fortsetzen'}</span></button>`;
}

// Laufende Kurse: Fortschrittsring, nächste Etappe, Noten-Prognose, «Weiter»
function courseRows(list) {
  const R = 19, C = 2 * Math.PI * R;
  return list.map(c => {
    const ready = c.status === 'ready', pct = ready ? Math.round(Math.max(0, Math.min(100, E.weightedProgress(c)))) : 0;
    const nx = ready ? E.nextConcept(c) : null;
    const prog = ready ? `<span class="hub-grade" title="Geschätzte Note bei Abschluss">~${esc(fmtG(c, E.gradePrognosis(c).atFinish))}</span>` : '';
    const sub = !ready ? 'Analyse noch nicht fertig' : nx ? `Nächste Etappe: ${nx.title}` : 'Alle Etappen geschafft';
    return `<div class="hub-course">
      <span class="hub-ring"><svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="${R}" class="bg"/><circle cx="23" cy="23" r="${R}" class="fg" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${pct}%</b></span>
      <span class="hub-course-t"><b>${esc(c.title)}</b><small>${esc(sub)}</small></span>
      ${prog}
      <button type="button" class="hub-go" data-a="${ready ? 'clarityResume' : 'clarityOpen'}" data-id="${esc(c.id)}">${ready ? (nx ? 'Weiter' : 'Öffnen') : 'Fortsetzen'}</button>
    </div>`;
  }).join('');
}

// Clarity-Tab: grosse Karte (füllt den Tab). Oben «Clarity starten», unten der begonnene Kurs mit «Weiter»
export function clarityHub() {
  return `<section class="v2-clh">${DECO}
    <div class="top"><div class="k">${esc(CLARITY_NAME.toUpperCase())}</div>
    <h2>Dein Stoff. Klar gefiltert. Dein Weg zur Zielnote.</h2>
    <p>Lade deinen Lernstoff hoch. Brainy filtert das Unwichtige weg, prüft dein Vorwissen und führt dich Etappe für Etappe zur Zielnote.</p>
    <button class="cta" data-a="aiTool" data-id="clarity">Clarity starten →</button></div></section>`;
}

export function clarityActions(ctx) {
  CTX = ctx;
  return {
    ...uploadActions(ctx), ...swipeActions(ctx), ...dashActions(ctx), ...playerActions(ctx), ...examActions(ctx), ...reportActions(ctx), ...introActions(ctx),
    clarityResume(d) {   // Hub: direkt zur nächsten Etappe (oder zur Einstufung, falls noch offen)
      const c = courseById(d.id); if (!c) return false;
      U.tab = 'ai'; const u = (U.clarity = clarityInit()); U.ai = { tool: 'clarity' };
      u.courseId = c.id; const i = (c.concepts || []).findIndex(k => !k.triage), n = E.nextConcept(c);
      if (i >= 0) { u.phase = 'swipe'; u.swipe = { i }; } else if (n) { u.conceptId = n.id; u.phase = 'player'; } else u.phase = 'dashboard';
      try { window.scrollTo?.(0, 0); } catch { }
    },
    clarityGo(d) { const u = ui(); u.phase = d.to || 'welcome'; if (d.to === 'welcome') u.courseId = null; try { window.scrollTo?.(0, 0); } catch { } },
  };
}
export function clarityChange(ctx) { return { ...uploadChange(ctx), ...examChange(ctx) }; }
