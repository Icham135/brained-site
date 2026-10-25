// Brained – Pakete: Pro-Bildschirm, Code einlösen, Lern-Guthaben, Klassengruppe, Wochenbericht.
// Alles hier erscheint erst, wenn CONFIG.PRO_ENABLED an ist. Preise und Texte wie website/index.html (#preise). Stile: css/pro-v2.css (Präfix pr2-).
// Server: my_plan, redeem_license, create_class_group, week_report (supabase/schema-tarif.sql).
import * as St from './store.js';
import * as BK from './backend.js';
import { CONFIG } from './config.js';
import { U } from './view-state.js';
import { esc, I, brainSVG } from './ui.js';
import { PRO, SUBJECT_COLORS } from './data.js';

const S = St.S;
const fmtDate = ts => new Date(ts).toLocaleDateString('de-CH');   // 12.11.2026
const MAIL = (subject) => `mailto:${CONFIG.LEGAL_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const TIER_NAME = { free: 'Gratis', pro: 'Brained Pro', group: 'Brained Gruppe', max_teacher: 'Brained Max (Lehrperson)', max_student: 'Brained Max (Schüler)' };
// Eigene Gruppen und Räume je Paket (Server: tier_limit). Beitreten ist immer gratis.
export const LIMITS = { free: { groups: 2, members: 3, rooms: 0 }, pro: { groups: 3, members: 20, rooms: 2 }, group: { groups: 5, members: 50, rooms: 3 }, max_teacher: { groups: 5, members: 50, rooms: 3 } };
export const limitsOf = () => LIMITS[St.tier()] || LIMITS.free;

/* ---------- Texte (wie die Landingpage) ---------- */
const PRO_LIST = ['Generator für Zusammenfassungen, Spickzettel und Probeprüfungen (CH/DE/AT), so viel du für deine Prüfungen brauchst', 'Gruppen mit mehr als 3 Personen (je bis 20)', 'Eigene Lernräume erstellen (2 gleichzeitig)', 'Pro-Skins', 'Karteikarten aus Fotos und PDFs ohne Wochenlimit'];
const GROUP_LIST = ['Bis zu 5 eigene Gruppen (je bis 50 Personen) und 3 eigene Lernräume gleichzeitig', 'Wochenbericht auf Knopfdruck', 'Schüler treten gratis per Code bei'];
const MAX_LIST = ['Lehrperson gratis dabei: erstellt bis zu 5 Klassengruppen und 3 eigene Lernräume gleichzeitig', '10 Schüler mit Pro-Generator (jede Person mit eigenem Monatsguthaben) und Karteikarten aus Fotos und PDFs', 'Wochenbericht auf Knopfdruck'];
const OWN_LIST = { pro: PRO_LIST, group: GROUP_LIST, 
  max_teacher: ['Bis zu 5 Klassengruppen (zusammen 10 Schüler) und 3 eigene Lernräume gleichzeitig', 'Wochenbericht auf Knopfdruck', 'Die Schüler haben den Pro-Generator mit ihrem Code.'], max_student: ['Pro-Generator: Zusammenfassungen, Spickzettel, Probeprüfungen mit Lösungsblatt und Foto-Korrektur', 'Karteikarten aus Fotos und PDFs'] };
const ul = list => `<ul>${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;

/* ---------- Generator-Guthaben (Balken) ---------- */
export function creditBar(cls = '') {
  const c = St.credit(); if (!c || !(c.limit > 0)) return '';
  const left = c.leftPct;
  return `<div class="pr2-credit ${cls} ${left <= 10 ? 'low' : ''}" data-test="credit-bar"><div class="pr2-credit-h"><b>Generator-Guthaben</b><span>${left} % übrig</span></div>
    <div class="pr2-bar" role="progressbar" aria-label="Generator-Guthaben" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left}"><i style="width:${left}%"></i></div>
    ${c.reset ? `<small>Erneuert sich am ${esc(fmtDate(c.reset))}</small>` : ''}</div>`;
}

/* ---------- Code einlösen ---------- */
const LIC_ERR = { license_not_found: 'Diesen Code gibt es nicht. Prüfe die Schreibweise.', license_expired: 'Dieser Code ist abgelaufen.', license_full: 'Alle Plätze dieses Codes sind schon vergeben.', license_teacher_first: 'Die Lehrperson muss den Code zuerst einlösen. Frag bei ihr nach.' };
// Ergebnis von redeem_license → { ok, text }
export function redeemMessage(r) {
  if (!r) return { ok: false, text: 'Das hat nicht geklappt. Versuche es nochmals.' };
  if (r.error) return { ok: false, text: LIC_ERR[r.error] || 'Dieser Code funktioniert nicht.' };
  const until = r.pro_until ? fmtDate(Date.parse(r.pro_until)) : '';
  const name = TIER_NAME[r.tier] || 'Brained Pro', bis = until ? ` bis ${until}` : '';
  let t = `${name}${bis}`;
  if (r.role === 'teacher') t += r.tier === 'max_teacher' ? '. Du kannst Klassengruppen, Lernräume und den Wochenbericht nutzen. Gib die Codes an deine Schüler weiter.' : '. Gib die Codes an deine Schüler weiter.';
  else if (r.role === 'student') t += '. Der Pro-Generator und Karteikarten aus Fotos und PDFs sind für dich freigeschaltet.';
  else t += '. Viel Erfolg beim Lernen!';
  return { ok: true, text: (r.already ? 'Dieser Code ist schon eingelöst: ' : '') + t };
}
export function redeemBox() {
  const R = U.redeem || {};
  return `<div class="pr2-redeem"><label class="pr2-lab" for="pr2Code">Hast du einen Code?</label>
    <div class="pr2-redeem-row"><input id="pr2Code" class="input pr2-code" data-bind="form.licCode" value="${esc(U.form?.licCode || '')}" maxlength="20" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="Code eingeben" aria-label="Lizenzcode"/>
    <button class="btn primary sm pr2-btn" data-a="redeemCode" ${R.busy ? 'disabled' : ''}>${R.busy ? '…' : 'Einlösen'}</button></div>
    ${R.msg ? `<p class="pr2-msg ${R.ok ? 'ok' : 'err'}" role="${R.ok ? 'status' : 'alert'}" data-test="redeem-msg">${esc(R.msg)}</p>` : ''}</div>`;
}

/* ---------- Pro-Bildschirm ---------- */
const priceOf = (tier, plan) => { const p = tier === 'group' ? PRO.group : PRO, m = (p.yearly / 12).toFixed(2); return plan === 'yearly' ? { big: `CHF ${p.yearly}`, per: 'Jahr', alt: `${m} pro Monat · oder CHF ${p.monthly.toFixed(2)} monatlich` } : { big: `CHF ${p.monthly.toFixed(2)}`, per: 'Monat', alt: `oder CHF ${p.yearly} im Jahr (${m} pro Monat)` }; };
export function proScreen(head, sh) {
  const tier = St.tier(), paid = St.isPro(), plan = U.proPlan || 'yearly', busy = U.proBusy;
  const tip = sh.reason ? `<div class="tip mb12">${I.info}<span>${esc(sh.reason)}</span></div>` : '';
  if (paid) {
    const until = S.plan?.until ? `Läuft bis ${fmtDate(S.plan.until)}` : 'Danke für deine Unterstützung!';
    return head(TIER_NAME[tier] || 'Brained Pro') + `${tip}<div class="pro-hero"><div style="font-size:44px">💎</div><b>Du hast ${esc(TIER_NAME[tier] || 'Brained Pro')}</b><span>${until}</span></div>
      ${creditBar('in-sheet')}
      <div class="pr2-card mt12">${ul(OWN_LIST[tier] || PRO_LIST)}</div>
      ${BACKEND_ON() && S.plan?.source === 'stripe' ? `<button class="btn ghost block mt12" data-a="proPortal">Abo verwalten oder kündigen</button>` : ''}
      ${BACKEND_ON() && S.plan?.source === 'revenuecat' ? `<p class="faint small center mt12">Verwalten & kündigen in den Einstellungen deines App Stores.</p>` : ''}
      ${!BACKEND_ON() ? `<button class="btn ghost block mt12" data-a="togglePro">Demo: Pro beenden</button>` : ''}
      ${redeemBox()}`;
  }
  const toggle = `<div class="pr2-toggle" role="group" aria-label="Abrechnung">${[['monthly', 'Monatlich'], ['yearly', 'Jährlich']].map(([id, l]) => `<button class="${plan === id ? 'on' : ''}" data-a="proPlan" data-id="${id}" aria-pressed="${plan === id}">${l}</button>`).join('')}</div>`;
  const card = (t, title, who, list, badge) => { const p = priceOf(t, plan); return `<article class="pr2-card ${t === 'pro' ? 'main' : ''}" data-tier="${t}">${badge ? `<span class="pr2-badge">${badge}</span>` : ''}<h4>${title} <small>${who}</small></h4>
    <div class="pr2-amount">${p.big} <small>/ ${p.per}</small></div><p class="pr2-alt">${p.alt}</p>${ul(list)}
    <button class="btn3d pr2-buy" data-a="proBuy" data-tier="${t}" ${busy ? 'disabled' : ''}>${busy ? '…' : t === 'pro' ? 'Pro wählen' : 'Gruppe wählen'}</button></article>`; };
  const ask = (title, who, amount, alt, list, subject, label = 'Anfragen') => `<article class="pr2-card"><h4>${title} <small>${who}</small></h4><div class="pr2-amount">${amount}</div><p class="pr2-alt">${alt}</p>${ul(list)}<a class="btn ghost block pr2-ask" href="${MAIL(subject)}">${label}</a></article>`;
  return head('Brained Pro') + `${tip}
    <div class="pro-hero"><div class="pro-brain">${brainSVG({ size: 86, fill: '#FFD95A', fold: '#C98A00', outline: '#5A3D00', fx: 'shine', hat: 'laurel', fit: 'avatar' })}</div><b>Einfach. Für dich oder für deine Gruppe.</b><span>Kein Probeabo, jederzeit kündbar</span></div>
    <p class="pr2-free">Gratis: Timer, Streaks, Ranglisten, Ligen, Lernräume beitreten, Gruppen bis 3 Personen, Karteikarten und Spiele, 5 KI-Anfragen pro Woche. Clarity: Dokumente hochladen und ansehen, eine Zusammenfassung pro Woche.</p>
    ${toggle}
    <h5 class="pr2-row">Für dich</h5>
    ${card('pro', 'Pro', 'für Einzelpersonen', PRO_LIST, 'Alles drin')}
    <h5 class="pr2-row">Für Lehrpersonen &amp; Nachhilfe</h5>
    ${card('group', 'Gruppe', 'nur Gruppen &amp; Räume erstellen', GROUP_LIST)}
    ${ask('Max', 'bis 10 Schüler', 'CHF 139 <small>/ Monat</small>', "oder CHF 1'390 im Jahr (2 Monate geschenkt) · CHF 13.90 pro Schüler", MAX_LIST, 'Brained für unsere Nachhilfeschule', 'Max anfragen')}
    ${ask('Enterprise', 'ab 11 Schülern', 'Auf Anfrage', 'Wir machen Ihnen ein passendes Angebot.', ['Für grössere Nachhilfeschulen und Institute'], 'Brained für unsere Nachhilfeschule')}
    <p class="faint tiny center mt8">Alle Preise in CHF, Schulen ohne MwSt. Max und Enterprise bezahlst du per Rechnung.</p>
    ${redeemBox()}
    ${BACKEND_ON() ? `<button class="linkbtn" style="display:block;margin:8px auto 0" data-a="proRestore">Käufe wiederherstellen</button>` : ''}`;
}
const BACKEND_ON = () => BK.enabled;

/* ---------- Wochenbericht ---------- */
const mins = m => { m = Math.round(+m || 0); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
const daysAgo = ts => ts ? Math.floor((Date.now() - Date.parse(ts)) / 864e5) : null;
const lastText = ts => { const d = daysAgo(ts); return d == null ? 'noch nie' : d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`; };
export const reportQuiet = r => { const d = daysAgo(r.last_active); return d == null || d >= 3; };   // seit 3+ Tagen nicht gelernt
export function reportSums(rows) { return { total: rows.reduce((n, r) => n + (+r.minutes_week || 0), 0), active: rows.filter(r => +r.minutes_week > 0).length, n: rows.length, quiet: rows.filter(reportQuiet).length }; }
export function reportText(g, rows) {
  const s = reportSums(rows);
  return [`Wochenbericht «${g?.name || 'Gruppe'}» (Brained)`, `Gesamt diese Woche: ${mins(s.total)} · ${s.active} von ${s.n} haben gelernt`,
    ...rows.map(r => `${r.name || r.username}: ${mins(r.minutes_week)}, ${r.study_days} Lerntage, Streak ${r.streak}`)].join('\n');
}
function reportView(head, sh) {
  const g = S.groups.find(x => x.id === sh.id), W = U.wr || {}, rows = W.rows || [];
  let body;
  if (W.busy) body = '<p class="faint center mt16">Wochenbericht lädt …</p>';
  else if (W.err) body = `<div class="tip mb12" role="alert">${esc(W.err)}</div>`;
  else if (!rows.length) body = '<p class="faint center mt16">Noch keine Daten für diese Woche.</p>';
  else {
    const s = reportSums(rows);
    body = `<div class="pr2-sum" data-test="wr-sum"><div><b>${esc(mins(s.total))}</b><span>Gesamt diese Woche</span></div><div><b>${s.active} / ${s.n}</b><span>haben gelernt</span></div></div>
      <div class="pr2-wr-wrap"><table class="pr2-wr" data-test="wr-table"><thead><tr><th>Name</th><th>Woche</th><th>Tage</th><th>Streak</th><th>Zuletzt</th><th>Top-Fach</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${reportQuiet(r) ? 'quiet' : ''}"><td><b>${esc(r.name || r.username)}</b>${reportQuiet(r) ? '<em>seit 3+ Tagen nicht gelernt</em>' : ''}</td><td>${esc(mins(r.minutes_week))}</td><td>${r.study_days}</td><td>${r.streak}</td><td>${esc(lastText(r.last_active))}</td><td>${r.top_subject ? esc(St.subj(r.top_subject).name) : '–'}</td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn primary block mt12" data-a="weekReportShare">Teilen</button>
      <p class="faint tiny center mt8">Nur Summen: Lernzeit, Lerntage und Streak. Keine Titel, keine Notizen.</p>`;
  }
  return head(`Wochenbericht${g ? ' · ' + esc(g.name) : ''}`) + body;
}

/* ---------- Sheets ---------- */
const CHOOSE_EMOJI = ['🏫', '📚', '🧪', '🛠️', '🎓', '🚀', '🔥', '🎯', '⭐', '🌍'];
export function proSheet(sh, head) {
  const f = U.form || {};
  switch (sh.type) {
    case 'redeem': return head('Code einlösen') + `<p class="muted mb12">Hast du von deiner Lehrperson, Schule oder von uns einen Code bekommen? Gib ihn hier ein.</p>${redeemBox()}`;
    case 'weekReport': return reportView(head, sh);
    case 'classNotice': {
      const g = S.groups.find(x => x.id === sh.id);
      return head('Klassengruppe') + `<p class="muted mb12">Willkommen in «${esc(g?.name || 'der Klasse')}». Deine Lernzeit ist für die Lehrperson sichtbar: Minuten, Lerntage und Streak. Titel und Notizen bleiben privat.</p>
        <button class="btn primary block" data-a="closeSheet">Alles klar</button>
        <button class="btn outline block mt8" data-a="leaveGroup" data-id="${esc(sh.id)}">Gruppe wieder verlassen</button>`;
    }
    case 'classConfirm': return head('Klassengruppe') + `<p class="muted mb12">Klassengruppe${sh.owner ? ' von ' + esc(sh.owner) : ''}${sh.name ? ' («' + esc(sh.name) + '»)' : ''}: Die Lehrperson sieht deine Lernzeit, deinen Streak und deine Lerntage – nie deine Titel, Notizen oder Unterlagen. Du kannst jederzeit austreten.</p>
        <button class="btn primary block" data-a="joinGroup" data-confirmed="1" data-code="${esc(sh.code || '')}" data-test="class-confirm-join">Beitreten</button>
        <button class="btn outline block mt8" data-a="closeSheet">Abbrechen</button>`;
    case 'classCreate': return head('Klassengruppe erstellen') + `<p class="muted mb12">Schüler treten mit dem Code bei. Du siehst ihre Lernzeit im Wochenbericht. Bis zu 5 Klassengruppen, zusammen 10 Schüler.</p>
      <div class="field"><label>Name</label><input class="input" data-bind="form.name" maxlength="40" value="${esc(f.name || '')}" placeholder="z.B. Mathe 3b"/></div>
      <div class="field"><label>Emoji</label><div class="chips">${CHOOSE_EMOJI.map(e => `<button class="chip-btn ${f.emoji === e ? 'on' : ''}" data-a="formSet" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Farbe</label><div class="color-row">${SUBJECT_COLORS.slice(0, 8).map(c => `<button class="${f.color === c ? 'on' : ''}" style="background:${c}" data-a="formSet" data-k="color" data-v="${c}"></button>`).join('')}</div></div>
      <button class="btn primary block" data-a="saveClassGroup">Klassengruppe erstellen</button>`;
  }
  return '';
}

/* ---------- Aktionen ---------- */
async function share(text, toast) {
  try { if (navigator.share) { await navigator.share({ title: 'Brained Wochenbericht', text }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); } catch { toast('Teilen nicht möglich'); }
}
export function proActions({ toast } = {}) {
  return {
    async redeemCode() {
      const R = (U.redeem ||= {}), code = String(U.form?.licCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (!code) { Object.assign(R, { ok: false, msg: 'Gib deinen Code ein.' }); return; }
      if (!BK.enabled) { Object.assign(R, { ok: false, msg: 'Zum Einlösen brauchst du ein Konto. Melde dich an.' }); return; }
      Object.assign(R, { busy: true, msg: '' });
      try { const r = await BK.redeemLicense(code); const m = redeemMessage(r); Object.assign(R, { ok: m.ok, msg: m.text }); if (m.ok) U.form.licCode = ''; }
      catch (e) { Object.assign(R, { ok: false, msg: e.message }); }
      R.busy = false;
    },
    // Hinweis statt Fehler: Funktion gibt es erst mit einem Paket (z. B. eigene Lernräume)
    proNeed(d) { U.sheet = { type: 'pro', reason: d.reason || 'Das gibt es mit Brained Pro oder dem Gruppen-Paket.' }; U.form = {}; },
    classCreateOpen() { U.form = { name: '', emoji: '🏫', color: SUBJECT_COLORS[0] }; U.sheet = { type: 'classCreate' }; },
    async saveClassGroup() {
      const f = U.form; if (!String(f.name || '').trim()) return toast('Name der Gruppe fehlt');
      let g; try { g = await BK.createClassGroup(f.name.trim(), f.emoji, f.color); } catch (e) { return toast('⚠️ ' + esc(e.message)); }
      U.rankScope = 'group'; U.rankGroup = g?.id; U.tab = 'rank'; U.sheet = g ? { type: 'invite', id: g.id } : null;
    },
    async weekReportOpen(d) {
      U.sheet = { type: 'weekReport', id: d.id }; const W = (U.wr = { busy: true, rows: [] });
      try { W.rows = BK.enabled ? await BK.weekReport(d.id) : (globalThis.__weekReportSim || []); } catch (e) { W.err = e.message; }
      W.busy = false;
    },
    weekReportShare() { const g = S.groups.find(x => x.id === U.sheet?.id); share(reportText(g, U.wr?.rows || []), toast); return false; },
  };
}
