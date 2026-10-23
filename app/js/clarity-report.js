// KI-Inhalte melden (Google-Play-Pflicht «KI-generierte Inhalte»). Erfasst nur Art, Kurs-/Etappen-/Fragen-ID und Grund – nie Text der Unterlagen.
// Lokal als Liste in S.aiReports; mit Backend zusätzlich in die Tabelle `reports` (reported = null, session_id = «ai:Art:ID»).
import { S, save } from './store.js';
import { U } from './view-state.js';
import { esc } from './ui.js';
import { ui } from './clarity.js';

const KINDS = { concept: 'Etappen-Inhalt', question: 'Frage', open: 'Auswertung der offenen Frage', grading: 'Korrektur', exam: 'Prüfung', summary: 'Spickzettel' };
const REASONS = ['Falsch', 'Unpassend', 'Anderes'];

// Kleiner Knopf; id optional (sonst aus dem aktuellen Kurs/Etappe)
export const reportBtn = (kind, id = '') => `<button class="cl-report" data-a="clarityReport" data-kind="${kind}" data-id="${esc(id)}">${'⚑'} Problem melden</button>`;

export function reportSheet(sh, head) {
  const chip = r => `<button class="chip-btn ${sh.reason === r ? 'on' : ''}" role="radio" aria-checked="${sh.reason === r}" data-a="clarityReportReason" data-v="${r}">${r}</button>`;
  return head('Problem melden') + `
    <p class="small muted" style="line-height:1.5">${esc(KINDS[sh.kind] || 'KI-Inhalt')} von Brainy (KI). Was ist das Problem?</p>
    <div class="chips mt8" role="radiogroup" aria-label="Grund">${REASONS.map(chip).join('')}</div>
    <div class="field mt12"><textarea class="textarea" data-bind="form.aiNote" maxlength="300" placeholder="Optional: kurz beschreiben"></textarea></div>
    <p class="tiny faint" style="margin:-4px 2px 12px">Wir senden nur die Art, die Nummer der Stelle und deinen Grund. Schreibe keine Teile deiner Unterlagen oder Namen hinein.</p>
    <button class="btn primary block" data-a="clarityReportSend" ${sh.reason ? '' : 'disabled'}>Senden</button>
    <button class="btn ghost block mt8" data-a="closeSheet">Abbrechen</button>`;
}

export function reportActions(ctx) {
  return {
    clarityReport(d) {
      const u = ui(), id = d.id || [u.conceptId].filter(Boolean).join('/');
      U.form = U.form || {}; U.form.aiNote = '';
      U.sheet = { type: 'aiReport', kind: d.kind, ref: `${u.courseId || '-'}/${id}`.slice(0, 80), reason: '' };
    },
    clarityReportReason(d) { if (U.sheet?.type === 'aiReport') U.sheet.reason = d.v; },
    async clarityReportSend() {
      const sh = U.sheet; if (sh?.type !== 'aiReport' || !sh.reason) return;
      const note = String(document.querySelector('[data-bind="form.aiNote"]')?.value || '').trim().slice(0, 300);
      (S.aiReports ||= []).unshift({ kind: sh.kind, ref: sh.ref, reason: sh.reason, note, ts: Date.now() });
      S.aiReports.length = Math.min(S.aiReports.length, 100);
      save(); U.sheet = null;
      ctx.toast?.('Danke, wir schauen es an.');
      try {   // ohne Backend/Anmeldung bleibt es bei der lokalen Liste
        const B = await import('./backend.js');
        if (B.enabled && S.user?.id) await B.report(null, `KI-Meldung: ${sh.reason}${note ? ' – ' + note : ''}`.slice(0, 500), `ai:${sh.kind}:${sh.ref}`.slice(0, 100));
      } catch { /* bleibt lokal gespeichert */ }
    },
  };
}
