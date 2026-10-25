// Brained Clarity (Prüfungsgenerator) – Zustand, Router und Verdrahtung. Brief: docs/GENERATOR-BRIEF.md
// Dokumente bleiben lokal: S.clarity.docs (klein, localStorage), Quelltexte in IndexedDB. Nie auf den Server.
import { S, save, hooks, SAVED_KEY } from './store.js';
import { U } from './view-state.js';
import { esc } from './ui.js';
import { aiOn } from './clarity-ai.js';
import { imgPut, imgGet, imgDel } from './idb.js';
import { uploadView, uploadActions, uploadChange } from './clarity-upload.js';
import { docView, docActions, docChange } from './clarity-doc.js';
import { examActions, examChange } from './clarity-exam.js';
import { introView, introActions, introWanted } from './clarity-intro.js';

export const CLARITY_NAME = 'Brained Clarity';   // sichtbarer Name an genau einer Stelle

export function clarityData() {
  const d = (S.clarity ||= { docs: [] });
  d.docs ||= [];
  if (d.courses && !d.courses.length) delete d.courses;   // alter Lernweg (nur im Git-Archiv): leere Reste weg
  return d;
}
export const docById = id => clarityData().docs.find(c => c.id === id) || null;
export const ui = () => (U.clarity ||= clarityInit());
export const curDoc = () => docById(ui().docId);
export const saveDocs = () => save();
export const isDemo = () => !aiOn({});   // Demo: keine Anmeldung (und kein Test-Haken)

// Ausfälle simulieren (Konsole/Tests): window.__claritySim = { offline: true }
export const sim = () => globalThis.__claritySim || {};
export const offline = () => !!sim().offline || (typeof navigator !== 'undefined' && navigator.onLine === false);
// Verständliche Fehlertexte statt Technik. what = «Die Erstellung», «Die Korrektur» …
export function friendlyErr(e, what = 'Das') {
  const m = String(e?.message || e || '');
  // Server-Codes (brainy): Guthaben, Wochenlimit und Seitenlimit sagen genau, was los ist
  const c = e?.code;
  if (c === 'pro_required_generator' || c === 'pro_required_clarity') return 'Spickzettel und Probeprüfungen gibt es mit Brained Pro. Eine Zusammenfassung pro Woche ist gratis.';
  if (c === 'limit_free_summary') return 'Deine gratis Zusammenfassung für diese Woche ist schon gebraucht. Mit Brained Pro erstellst du so viele, wie du für deine Prüfungen brauchst.';
  if (c === 'credit_used_up') return 'Dein Generator-Guthaben ist für diesen Monat aufgebraucht. Es füllt sich zum nächsten Monatswechsel wieder.';
  if (c === 'doc_too_long') return m && /Seiten/.test(m) ? m : 'Dein Dokument ist zu lang. Pro Generierung sind höchstens 150 Seiten möglich. Teile es in mehrere Teile auf.';
  if (c === 'limit' && m) return m;
  if (offline() || /^offline$|Verbindung|network|fetch|Failed to send|timeout|Load failed/i.test(m)) return `Keine Internetverbindung. Prüfe dein WLAN oder deine Daten und versuche es nochmals. ${what} geht danach weiter.`;
  if (/^limit$|Zu viele|429|Limit|Kontingent|quota|überlastet/i.test(m)) return 'Brainy ist gerade stark ausgelastet oder hat sein Tageslimit erreicht. Warte ein paar Minuten und versuche es nochmals.';
  if (/^bad$|unbrauchbar|Struktur|Kein JSON|abgeschnitten/i.test(m)) return 'Brainy hat eine unvollständige Antwort geliefert. Nochmals versuchen hilft meistens.';
  if (/Abgebrochen/.test(m)) return 'Abgebrochen. Du kannst jederzeit nochmals starten.';
  if (/NO_KEY/.test(m)) return 'Die KI-Verbindung ist gerade nicht aktiv. Melde dich an oder versuche es später nochmals.';
  if (/[äöüÄÖÜ]|\b(Bitte|Material|Unterlagen|Prüfung|Datei|Text|Dokument)\b/.test(m) && m.length < 220 && !/Error|undefined|\bat \w+\.|JSON|HTTP|\d{3}\b/.test(m)) return m;
  return `${what} hat gerade nicht geklappt. Versuche es nochmals; deine Eingaben sind noch da.`;
}

export function clarityInit(enter = false) {
  return { tool: 'clarity', phase: enter && introWanted() ? 'intro' : 'welcome', docId: null, draft: null, gen: null, view: { tab: 'main' } };
}

// Quelltexte (Seiten, Lernziele) liegen nur im Gerät (IndexedDB), je Generierung (gid). Seiten: [{ n, text }]
const pkey = (gid, k) => `clarity:gen:${gid}:${k}`;
export async function loadPages(gid) { try { return JSON.parse(await imgGet(pkey(gid, 'pages')) || '[]'); } catch { return []; } }
export async function loadGoals(gid) { try { return JSON.parse(await imgGet(pkey(gid, 'goals')) || 'null'); } catch { return null; } }
export const putSource = (gid, pages, goals) => Promise.all([imgPut(pkey(gid, 'pages'), JSON.stringify(pages)), goals ? imgPut(pkey(gid, 'goals'), JSON.stringify(goals)) : Promise.resolve()]);
export function deleteDoc(id) {
  const d = docById(id); if (!d) return;
  const dd = clarityData(); dd.docs = dd.docs.filter(x => x.id !== id);
  if (!dd.docs.some(x => x.gid === d.gid)) { try { imgDel(pkey(d.gid, 'pages')); imgDel(pkey(d.gid, 'goals')); } catch { } }   // Quelle weg, wenn kein Dokument sie mehr braucht
  save();
}

// Speicher voll (localStorage ca. 5 MB): Dokumente zusätzlich in IndexedDB sichern; beim Start neuere Sicherung zurückholen
const BK_KEY = 'clarity-backup:' + SAVED_KEY;
let CTX = null, warned = false;
const prevQuota = hooks.onQuota;
hooks.onQuota = () => {
  try { prevQuota?.(); } catch { }
  try { imgPut(BK_KEY, JSON.stringify({ ts: Date.now(), clarity: S.clarity })); } catch { }
  if (!warned) { warned = true; CTX?.toast?.('Speicher fast voll: deine Dokumente sind zusätzlich gesichert. Lösche Dokumente, die du nicht mehr brauchst.'); }
};
(async () => {
  try {
    const b = JSON.parse(await imgGet(BK_KEY) || 'null'), ts = +localStorage.getItem(SAVED_KEY) || 0;
    if (b?.ts > ts && Array.isArray(b.clarity?.docs)) { S.clarity = b.clarity; save(); CTX?.render?.(); }
  } catch { }
})();

// Router: Phase → Ansicht
function routeView() {
  const p = ui().phase;
  if (p === 'intro') return introView();
  if (p === 'doc') return docView();
  return uploadView();   // welcome · processing · paywall
}
export function clarityView() {
  const html = routeView();
  const needsNet = sim().offline || !isDemo();
  return offline() && needsNet ? `<div class="cl-offline" role="status">Du bist offline. Gespeicherte Dokumente kannst du ansehen und drucken. Neue Dokumente brauchen Internet.</div>${html}` : html;
}
try { addEventListener('online', () => CTX?.render?.()); addEventListener('offline', () => CTX?.render?.()); } catch { }

const DECO = `<svg class="deco" viewBox="0 0 120 110" aria-hidden="true"><g fill="rgba(191,233,255,.12)" stroke="#BFE9FF" stroke-width="2.6"><circle cx="38" cy="46" r="17"/><circle cx="60" cy="38" r="19"/><circle cx="82" cy="46" r="17"/><circle cx="29" cy="64" r="15"/><circle cx="91" cy="64" r="15"/><circle cx="45" cy="78" r="15"/><circle cx="75" cy="78" r="15"/></g></svg>`;

// Home: Karte mit Aufruf «Probeprüfung generieren» (Weiter führt in den Generator)
export function clarityHomeCard() {
  return `<button class="v2-cl" data-a="aiTool" data-id="clarity">${DECO}<span class="k">${esc(CLARITY_NAME.toUpperCase())}</span><b class="t">Probeprüfung generieren</b><span class="m">Aus deinen Unterlagen: Zusammenfassung, Spickzettel und Probeprüfung mit Lösungsblatt.</span><span class="cta">Weiter</span></button>`;
}

// Clarity-Tab: grosse Karte (füllt den Tab)
export function clarityHub() {
  return `<section class="v2-clh">${DECO}
    <div class="top"><div class="k">${esc(CLARITY_NAME.toUpperCase())}</div>
    <h2>Dein Stoff. Klar gefiltert. Deine Prüfung.</h2>
    <p>Lade deinen Lernstoff hoch. Brained filtert das Unwichtige weg und erstellt dir Zusammenfassungen, Prüfungen und Spickzettel für das Schulsystem in der Schweiz, Deutschland oder Österreich.</p>
    <button class="cta" data-a="aiTool" data-id="clarity">Clarity starten →</button></div></section>`;
}

export function clarityActions(ctx) {
  CTX = ctx;
  return {
    ...uploadActions(ctx), ...docActions(ctx), ...examActions(ctx), ...introActions(ctx),
    clarityGo(d) { const u = ui(); u.phase = d.to || 'welcome'; if (d.to === 'welcome') { u.docId = null; u.view = { tab: 'main' }; } try { window.scrollTo?.(0, 0); } catch { } },
  };
}
export function clarityChange(ctx) { return { ...uploadChange(ctx), ...examChange(ctx), ...docChange(ctx) }; }
