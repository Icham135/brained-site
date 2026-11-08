// Brained Clarity (Prüfungsgenerator) – Dokument-Ansicht: A4-Blatt mit Brain-Stempel, Herunterladen (Druck/PDF), Neu generieren, Fehler melden, Löschen.
// Probeprüfung: Aufgaben, getrenntes Lösungsblatt (mit Bewertungsraster und Notenschlüssel-Vorschlag) und Foto-Korrektur (Pro).
import { S, save } from './store.js';
import { esc } from './ui.js';
import { ui, docById, CLARITY_NAME } from './clarity.js';
import { paperOf, gradePanel } from './clarity-exam.js';
import { regenerate, fmtDate } from './clarity-upload.js';
import * as G from './clarity-gen.js';

const view = () => (ui().view ||= { tab: 'main' });
const BACK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const canShare = () => typeof navigator !== 'undefined' && !!navigator.share;

export function docView() {
  const doc = docById(ui().docId), t = view();
  if (!doc) return `<section class="cl cl-ex"><div class="cl-ex-empty"><h3>Dokument nicht gefunden</h3><button class="cl-ex-btn pri" data-a="clarityGo" data-to="welcome">Zu Clarity</button></div></section>`;
  const exam = doc.type === 'exam', solved = exam && t.mode === 'solutions', grade = exam && t.tab === 'grade';
  const pass = Math.round(G.passOf(doc) * 100);
  const tabs = exam ? `<nav class="cl-ex-tabs" role="tablist" aria-label="Ansicht">${[['tasks', 'Aufgaben'], ['solutions', 'Lösungsblatt'], ['grade', 'Korrektur']].map(([id, l]) => {
    const on = id === 'grade' ? grade : !grade && (t.mode || 'tasks') === id;
    return `<button role="tab" aria-selected="${on}" class="${on ? 'on' : ''}" data-a="${id === 'grade' ? 'clarityDocTab' : 'clarityDocMode'}" data-id="${id === 'grade' ? 'grade' : id}">${l}</button>`;
  }).join('')}</nav>` : '';
  const what = exam ? (solved ? 'Lösungsblatt' : 'Aufgaben') : '';
  const body = grade ? gradePanel(doc) : `${toolbar(doc, what)}
    ${solved ? `<div class="gn-pass" data-test="pass"><span>«Genügend» ab</span><button class="cl-ex-btn" data-a="clarityPass" data-d="-5" aria-label="Schwelle senken">−</button><b>${pass} %</b><button class="cl-ex-btn" data-a="clarityPass" data-d="5" aria-label="Schwelle erhöhen">+</button><small>Notenschlüssel-Vorschlag, einstellbar</small></div>` : ''}
    ${doc.demo ? `<p class="cl-ex-demo">Demo-Modus: einfaches Beispiel aus deinem Material, ohne KI-Qualität.</p>` : ''}
    <div class="cl-paper-wrap">${paperOf(doc, solved)}</div>`;
  return `<section class="cl cl-ex gn-doc" data-test="doc-view">
    <header class="cl-ex-top"><button class="cl-ex-back" data-a="clarityGo" data-to="welcome" aria-label="Zurück zu deinen Dokumenten">${BACK}<span>Deine Dokumente</span></button>
      <div class="cl-ex-ttl"><div class="cl-ex-k">${esc(CLARITY_NAME.toUpperCase())} · ${esc(G.TYPE_NAME[doc.type].toUpperCase())}</div><h2>${esc(doc.title)}</h2><p>${esc(G.COUNTRIES[doc.country]?.name || '')} · ${esc(fmtDate(doc.createdAt))} · ${doc.pages || 0} ${doc.pages === 1 ? 'Seite' : 'Seiten'} Unterlagen</p></div></header>
    ${tabs}<div class="cl-ex-body">${body}${actions(doc)}</div></section>`;
}

const toolbar = (doc, what) => `<div class="cl-ex-bar-tools">
  <button class="cl-ex-btn pri" data-a="clarityPrint">${what ? `${what} als PDF herunterladen` : 'Als PDF herunterladen'}</button>
  ${canShare() ? `<button class="cl-ex-btn" data-a="clarityShare">Teilen</button>` : ''}</div>
  <p class="cl-ex-hint">${doc.type === 'cheat' ? 'Druckt auf A4 als 4 Karten im A6-Format zum Ausschneiden. ' : ''}${globalThis.Capacitor?.isNativePlatform?.() ? 'In der App öffnet sich der Druckdialog je nach Handy nicht. Tippe dann auf «Teilen» und sende das Blatt als Text an Mail, Notizen oder einen Drucker (AirPrint).' : 'Im Druckdialog wählst du «Als PDF speichern». Öffnet sich kein Dialog (manche Handys), nutze «Teilen».'}</p>`;

function actions(doc) {
  const t = view();
  return `<div class="gn-actions">
    <button class="cl-ex-btn" data-a="clarityDocRegen">Neu generieren</button>
    <button class="cl-ex-btn" data-a="clarityDocReport">Fehler melden</button>
    <button class="cl-ex-btn gn-del" data-a="clarityDocAskDelete" aria-label="Dokument löschen">Löschen</button></div>
  ${t.report ? `<div class="cl-ex-card gn-report" data-test="report"><h3>Fehler melden</h3><p>Was stimmt nicht? Brained speichert deinen Hinweis und erstellt das Dokument damit neu. Schreibe keine Teile deiner Unterlagen oder Namen hinein.</p>
    <textarea class="clu-text" rows="3" maxlength="300" placeholder="z. B. Aufgabe 3 ist falsch gelöst" data-bind="clarity.view.note" aria-label="Hinweis">${esc(t.note || '')}</textarea>
    <button class="cl-ex-btn pri" data-a="clarityDocReportSend">Melden und neu erzeugen</button><button class="cl-ex-btn" data-a="clarityDocReport">Abbrechen</button></div>` : ''}
  ${t.del ? `<div class="cl-ex-card gn-delbox" role="alertdialog" aria-label="Dokument löschen"><h3>«${esc(doc.title)}» löschen?</h3><p>Das ${esc(G.TYPE_NAME[doc.type])} wird von diesem Gerät entfernt.</p><button class="cl-ex-btn" data-a="clarityDocAskDelete">Abbrechen</button><button class="cl-ex-btn pri" data-a="clarityDoDelete" data-id="${esc(doc.id)}">Löschen</button></div>` : ''}`;
}

export function docActions(ctx) {
  return {
    clarityDocRegen() { const d = docById(ui().docId); if (d) regenerate(d, d.hint || '', ctx); return false; },
    clarityDocReport() { const t = view(); t.report = !t.report; t.note = ''; t.del = false; },
    clarityDocAskDelete() { const t = view(); t.del = !t.del; t.report = false; },
    async clarityDocReportSend() {
      const d = docById(ui().docId), t = view(); if (!d) return false;
      const note = String(t.note || document.querySelector('[data-bind="clarity.view.note"]')?.value || '').trim().slice(0, 300);
      (S.aiReports ||= []).unshift({ kind: d.type, ref: `${d.gid}/${d.id}`.slice(0, 80), reason: 'Fehler', note, ts: Date.now() });   // nur Art, Nummer und Hinweis, nie Unterlagen
      S.aiReports.length = Math.min(S.aiReports.length, 100);
      d.hint = note || 'Die letzte Version enthielt Fehler. Prüfe Inhalt, Zahlen und Musterlösungen besonders genau.'; save();
      t.report = false; t.note = '';
      try { const B = await import('./backend.js'); if (B.enabled && S.user?.id) B.report(null, `KI-Meldung: Fehler${note ? ' – ' + note : ''}`.slice(0, 500), `ai:${d.type}:${d.gid}`.slice(0, 100)).catch(() => { }); } catch { }
      ctx.toast?.('Danke, wir erstellen es neu.');
      regenerate(d, d.hint, ctx); return false;
    },
  };
}
export function docChange() { return {}; }
