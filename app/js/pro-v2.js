// Brained – Pro: der einzige Bezahlplan (CHF 14.90/Monat, CHF 129/Jahr), Lern-Guthaben, Hinweis «Konto erstellen» für Gäste.
// Alles hier erscheint erst, wenn CONFIG.PRO_ENABLED an ist. Stile: css/pro-v2.css (Präfix pr2-).
// Server: my_plan (supabase/schema-tarif.sql). Kauf: RevenueCat (js/native.js) bzw. Stripe im Web (js/backend.js).
import * as St from './store.js';
import * as BK from './backend.js';
import { CONFIG } from './config.js';
import { U } from './view-state.js';
import { esc, I, brainSVG } from './ui.js';
import { PRO } from './data.js';
import { isNative, nativeBillingReady, nativeOfferings } from './native.js';

const S = St.S;
const fmtDate = ts => new Date(ts).toLocaleDateString('de-CH');   // 12.11.2026

export const TIER_NAME = { free: 'Gratis', pro: 'Brained Pro' };
// Eigene Gruppen und Räume je Paket (Server: tier_limit). Beitreten ist immer gratis.
export const LIMITS = { free: { groups: 2, members: 3, rooms: 0 }, pro: { groups: 3, members: 20, rooms: 2, roomMembers: 12 } };
export const limitsOf = () => LIMITS[St.tier()] || LIMITS.free;

/* ---------- Texte ---------- */
export const PRO_LIST = ['Clarity-Generator: Zusammenfassung, Spickzettel, Probeprüfung (CH/DE/AT) und Foto-Korrektur, mit Monats-Guthaben', 'KI-Analyse deiner Statistik', 'Gruppen mit mehr als 3 Personen (je bis 20, bis zu 3 eigene)', 'Eigene Lernräume erstellen (2 gleichzeitig, bis 12 Personen pro Raum)', 'Karteikarten aus Fotos und PDFs ohne Wochenlimit', 'Pro-Skins'];
const ul = list => `<ul>${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
const chf = n => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/* ---------- Generator-Guthaben (Balken) ---------- */
export function creditBar(cls = '') {
  const c = St.credit(); if (!c || !(c.limit > 0)) return '';
  const left = c.leftPct;
  return `<div class="pr2-credit ${cls} ${left <= 10 ? 'low' : ''}" data-test="credit-bar"><div class="pr2-credit-h"><b>Generator-Guthaben</b><span>${left} % übrig</span></div>
    <div class="pr2-bar" role="progressbar" aria-label="Generator-Guthaben" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left}"><i style="width:${left}%"></i></div>
    ${c.reset ? `<small>Erneuert sich am ${esc(fmtDate(c.reset))}</small>` : ''}</div>`;
}

/* ---------- Preise (Store-Preis, falls geladen; sonst CHF-Richtpreis) ---------- */
export async function loadStorePrices() {
  if (!nativeBillingReady() || !S.user?.id || U.proPrices) return;
  try { const o = await nativeOfferings(S.user.id); U.proPrices = { monthly: o.monthly?.price || '', yearly: o.yearly?.price || '' }; } catch { U.proPrices = { monthly: '', yearly: '' }; }
}
const priceOf = plan => {
  const sp = U.proPrices || {}, m = (PRO.yearly / 12).toFixed(2);
  return plan === 'yearly'
    ? { big: sp.yearly || `CHF ${chf(PRO.yearly)}`, per: 'Jahr', alt: `CHF ${m} pro Monat · oder CHF ${PRO.monthly.toFixed(2)} monatlich` }
    : { big: sp.monthly || `CHF ${PRO.monthly.toFixed(2)}`, per: 'Monat', alt: `oder CHF ${chf(PRO.yearly)} im Jahr (CHF ${m} pro Monat)` };
};

/* ---------- Pro-Bildschirm ---------- */
const legalLinks = () => `<p class="pr2-legal-links"><a href="#" data-a="openLegal" data-id="agb">Nutzungsbedingungen</a> · <a href="#" data-a="openLegal" data-id="datenschutz">Datenschutzerklärung</a></p>`;
// Pflichtangaben für Abos (Apple 3.1.2 / Google Play): Preis, Laufzeit, automatische Verlängerung, Kündigung
const fineprint = () => isNative()
  ? `Brained Pro kostet CHF ${PRO.monthly.toFixed(2)} pro Monat oder CHF ${chf(PRO.yearly)} pro Jahr. Das Abo läuft einen Monat bzw. ein Jahr und verlängert sich automatisch um dieselbe Dauer, wenn du es nicht mindestens 24 Stunden vor Ablauf kündigst. Die Zahlung läuft über dein Apple-ID- bzw. Google-Play-Konto. Verwalten und kündigen kannst du jederzeit in den Einstellungen deines App Stores. Kein Probeabo.`
  : `Brained Pro kostet CHF ${PRO.monthly.toFixed(2)} pro Monat oder CHF ${chf(PRO.yearly)} pro Jahr. Das Abo läuft einen Monat bzw. ein Jahr und verlängert sich automatisch um dieselbe Dauer, wenn du es nicht vor Ablauf kündigst. Die Zahlung läuft sicher über unseren Zahlungspartner Stripe. Du kannst jederzeit kündigen. Kein Probeabo.`;
export function proScreen(head, sh) {
  const paid = St.isPro(), plan = U.proPlan || 'yearly', busy = U.proBusy, guest = St.isGuest();
  const tip = sh.reason ? `<div class="tip mb12">${I.info}<span>${esc(sh.reason)}</span></div>` : '';
  const restore = BK.enabled && !guest ? `<button class="linkbtn" style="display:block;margin:8px auto 0" data-a="proRestore">Käufe wiederherstellen</button>` : '';
  if (paid) {
    const until = S.plan?.until ? `Läuft bis ${fmtDate(S.plan.until)}` : 'Danke für deine Unterstützung!';
    return head('Brained Pro') + `${tip}<div class="pro-hero"><div style="font-size:44px">💎</div><b>Du hast Brained Pro</b><span>${until}</span></div>
      ${creditBar('in-sheet')}
      <div class="pr2-card mt12">${ul(PRO_LIST)}</div>
      ${BK.enabled ? `<button class="btn ghost block mt12" data-a="proManage">Abo verwalten oder kündigen</button>` : `<button class="btn ghost block mt12" data-a="togglePro">Demo: Pro beenden</button>`}
      ${restore}${legalLinks()}`;
  }
  const toggle = `<div class="pr2-toggle" role="group" aria-label="Abrechnung">${[['monthly', 'Monatlich'], ['yearly', 'Jährlich']].map(([id, l]) => `<button class="${plan === id ? 'on' : ''}" data-a="proPlan" data-id="${id}" aria-pressed="${plan === id}">${l}</button>`).join('')}</div>`;
  const p = priceOf(plan);
  return head('Brained Pro') + `${tip}
    <div class="pro-hero"><div class="pro-brain">${brainSVG({ size: 86, fill: '#FFD95A', fold: '#C98A00', outline: '#5A3D00', fx: 'shine', hat: 'laurel', fit: 'avatar' })}</div><b>Ein Plan. Alles drin.</b><span>Kein Probeabo, jederzeit kündbar</span></div>
    <p class="pr2-free">Gratis bleiben: Timer, Streaks, Ranglisten, Ligen, Freunde, Shop, Karteikarten von Hand, Spiele, Lernräume beitreten, Gruppen bis 3 Personen. In Clarity kannst du Unterlagen hochladen, ansehen und eine Zusammenfassung pro Woche erstellen.</p>
    ${toggle}
    <article class="pr2-card main" data-tier="pro"><span class="pr2-badge">Alles drin</span><h4>Pro <small>für dich</small></h4>
      <div class="pr2-amount">${esc(p.big)} <small>/ ${p.per}</small></div><p class="pr2-alt">${esc(p.alt)}</p>${ul(PRO_LIST)}
      ${guest ? `<button class="btn3d pr2-buy" data-a="guestUpgrade">Konto erstellen und Pro holen</button>` : `<button class="btn3d pr2-buy" data-a="proBuy" ${busy ? 'disabled' : ''}>${busy ? '…' : plan === 'yearly' ? 'Pro für ein Jahr holen' : 'Pro für einen Monat holen'}</button>`}
    </article>
    <p class="pr2-fine">${esc(fineprint())}</p>
    ${legalLinks()}${restore}`;
}

/* ---------- Sheets ---------- */
export function proSheet(sh, head) {
  switch (sh.type) {
    case 'account': return head('Konto erstellen') + `<div class="pro-hero"><div class="pro-brain">${brainSVG({ size: 80, mood: 'happy' })}</div></div>
      <p class="muted mb12 center">${esc(sh.reason || 'Dafür brauchst du ein Konto.')} Mit einem kostenlosen Konto sicherst du auch deine Daten, falls du das Handy wechselst.</p>
      <button class="btn primary block" data-a="guestUpgrade">Konto erstellen</button>
      <button class="btn ghost block mt8" data-a="closeSheet">Später</button>`;
  }
  return '';
}

/* ---------- Aktionen ---------- */
export function proActions({ toast } = {}) {
  return {
    // Hinweis statt Fehler: Funktion gibt es erst mit Brained Pro (z. B. eigene Lernräume)
    proNeed(d) { if (St.isGuest()) { U.sheet = { type: 'account', reason: 'Zum Erstellen und für Brained Pro brauchst du ein Konto.' }; return; } U.sheet = { type: 'pro', reason: d.reason || 'Das gibt es mit Brained Pro.' }; U.form = {}; },
    // Gast: freundlicher Hinweis «Konto erstellen» für alles, was ein Konto braucht
    accountNeed(d) { U.sheet = { type: 'account', reason: d?.reason || 'Dafür brauchst du ein Konto.' }; },
  };
}
