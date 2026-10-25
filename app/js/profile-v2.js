// Profil-Overlay (Brained 2.0): Kopf, Mein Look, Shop, Trophäen. Einstellungen als Sheet hinter dem Zahnrad. Vertrag: docs/UMBAU-2.md
// Der Look liegt in S.user.avatar (Quelle für Lernräume und Ranglisten): jede Änderung → St.save() und nach 600 ms Sync nach profiles.avatar.
import * as St from './store.js';
import * as BK from './backend.js';
import { RARITY, SHOP_CONSUMABLES, BRAIN_SKINS, BRAIN_MOODS, AVATAR_BGS, CANTONS, TROPHIES } from './data.js';
import { esc, I, emojiIcon, avatar, normAvatar, fmtHours, fmtShort, figureSkin, FIGURE_LOCKS, SKIN_HINT } from './ui.js';
import { U } from './view-state.js';
import { CONFIG, BACKEND } from './config.js';
import { curLang } from './i18n.js';
import { badMsg } from './moderation.js';
import { setEffect } from './shop-fx.js';
import { TIER_NAME, creditBar } from './pro-v2.js';
import { CATS, catOf, collectibles, isCons, isOn, applyItem, preview, kindLabel, noteOf, icoCoin, icoShield, daily, reqInfo } from './shop-ui.js';

const S = St.S;
const num = n => Number(n).toLocaleString('de-CH');
const P = () => (U.pv ||= { cat: 'skin', try: null, sheet: null, f: {}, allTroph: false });

/* ---------- Länder / Regionen (für «Profil bearbeiten», H-rank darf sie mitbenutzen) ---------- */
export const COUNTRIES = [['CH', 'Schweiz'], ['DE', 'Deutschland'], ['AT', 'Österreich'], ['OTHER', 'Andere']];
export const REGIONS = {
  DE: [['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'], ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'], ['NI', 'Niedersachsen'], ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'], ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']],
  AT: [['BU', 'Burgenland'], ['KT', 'Kärnten'], ['NÖ', 'Niederösterreich'], ['OÖ', 'Oberösterreich'], ['SB', 'Salzburg'], ['SM', 'Steiermark'], ['TI', 'Tirol'], ['VO', 'Vorarlberg'], ['WI', 'Wien']],
};
const countryOf = u => u.country || 'CH';
const regionOf = u => countryOf(u) === 'CH' ? u.canton : u.region;
const regionName = u => { const c = countryOf(u), r = regionOf(u); if (c === 'CH') return r ? `Kanton ${r}` : 'Schweiz'; if (c === 'OTHER') return 'Andere'; return REGIONS[c]?.find(x => x[0] === r)?.[1] || COUNTRIES.find(x => x[0] === c)[1]; };

/* ---------- Look: Zustand schreiben und synchronisieren ---------- */
let syncT;
function syncAvatar() { clearTimeout(syncT); syncT = setTimeout(() => { if (BK.enabled && S.user?.id) BK.updateProfile().catch(() => { }); }, 600); }
export function flushAvatarSync() { clearTimeout(syncT); if (BK.enabled && S.user?.id) BK.updateProfile().catch(() => { }); }
const MOOD_NAMES = { happy: 'Freundlich', grin: 'Strahlend', wow: 'Staunend', love: 'Verliebt', wink: 'Zwinkernd', think: 'Nachdenklich' };

// Eintrag ausrüsten bzw. ablegen. Gibt false zurück, wenn der Skin das Teil sperrt.
function wear(kind, id, toast) {
  if (kind === 'item') {
    const it = St.shopItem(id); if (!it || !St.owns(id)) return false;
    if (it.slot === 'effect') { if ((S.user.effect || 'e-confetti') === id) delete S.user.effect; else S.user.effect = id; setEffect(S.user.effect); St.save(); return true; }
    const a = { ...normAvatar(S.user.avatar) };
    if (it.slot) {
      if (FIGURE_LOCKS.includes(it.slot) && figureSkin(a.skin)) { toast?.(SKIN_HINT); return false; }
      if (a[it.slot] === id) delete a[it.slot]; else a[it.slot] = id;
    } else if (it.fill) {
      if (a.skin === id && it.price) a.skin = 'pink'; else a.skin = id;
      if (figureSkin(a.skin)) { for (const k of FIGURE_LOCKS) delete a[k]; if (a.skin === id) toast?.(SKIN_HINT); }
    } else if (a.frame === id) delete a.frame; else a.frame = id;
    S.user.avatar = a;
  } else {
    const a = { ...normAvatar(S.user.avatar) };
    if (kind === 'mood') a.mood = id; else if (kind === 'bg') a.bg = id;
    S.user.avatar = a;
  }
  St.save(); syncAvatar(); return true;
}

/* ---------- Einträge: «Mein Look» ist zugleich der Shop (Besitz zuerst, dann Kaufbares nach Preis) ---------- */
const proOk = it => CONFIG.PRO_ENABLED || !it.pro;
const itemEnt = it => { const own = St.owns(it.id), rq = reqInfo(it); return { k: 'item', id: it.id, name: it.name, rar: it.rar || 'common', price: it.price, pro: !!it.pro, own, on: isOn(it), it, req: !own && !rq.ok ? rq.text : '' }; };
const consEnt = it => ({ k: 'item', id: it.id, name: it.name, rar: 'common', price: it.price, own: false, on: false, it, cons: true });
const byRank = (a, b) => (b.own - a.own) || (a.price - b.price);
function lookList(cat) {
  const a = normAvatar(S.user.avatar), items = slots => collectibles().filter(it => slots.includes(catOf(it)) && proOk(it)).map(itemEnt);
  const moods = BRAIN_MOODS.map(([m]) => ({ k: 'mood', id: m, name: MOOD_NAMES[m] || m, own: true, on: (a.mood || 'happy') === m, price: 0 }));
  const bgs = AVATAR_BGS.map(c => ({ k: 'bg', id: c, name: 'Farbe', own: true, on: a.bg === c, price: 0 }));
  return {
    kopf: [[null, items(['hat'])]],
    gesicht: [['Ausdruck', moods], ['Brillen', items(['eyes'])], ['Münder', items(['mouth'])]],
    skin: [[null, [...BRAIN_SKINS.filter(k => !k.price && !k.rar).map(itemEnt), ...items(['skin'])]]],
    aura: [[null, items(['aura'])]],
    rahmen: [[null, items(['frame'])]],
    hintergrund: [['Farben', bgs], ['Effekte', items(['bgfx'])]],
    effekt: [[null, items(['effect'])]],
    extras: [['Accessoires', items(['extra'])], ['Streak-Schutz', SHOP_CONSUMABLES.map(consEnt)]],
  }[cat].map(([t, l]) => [t, l.sort(byRank)]);
}
const LOOK_TABS = [['kopf', 'Kopf'], ['gesicht', 'Gesicht'], ['skin', 'Skin'], ['aura', 'Aura'], ['rahmen', 'Rahmen'], ['hintergrund', 'Hintergrund'], ['effekt', 'Effekt'], ['extras', 'Extras']];
const lockedBySkin = (e, a) => e.k === 'item' && !e.cons && FIGURE_LOCKS.includes(e.it.slot) && figureSkin(a.skin);

function tile(e, a0) {
  const a = { skin: a0.skin, mood: a0.mood, bg: a0.bg }, dim = lockedBySkin(e, a0) ? 'dim' : '';  // Vorschau ohne weitere Teile: ruhig und vergleichbar
  const prev = e.k === 'mood' ? avatar({ ...a, mood: e.id }, 56) : e.k === 'bg' ? avatar({ ...a, bg: e.id }, 56) : preview(e.it, 56, a);
  const state = e.on ? `<span class="pv-st on">${I.check}Aktiv</span>`
    : e.own ? '<span class="pv-st own">&nbsp;</span>'
      : e.pro ? '<span class="pv-st pro">Pro</span>'
        : e.req ? `<span class="pv-st req">${esc(e.req)}</span>`
          : `<span class="pv-st price">${icoCoin}${num(e.price)}</span>`;
  const rl = e.k === 'item' && !e.cons ? `<span class="pv-rl" style="--c:${RARITY[e.rar].color}">${RARITY[e.rar].label}</span>` : '<span class="pv-rl">&nbsp;</span>';
  const lock = !e.own && !e.pro ? `<span class="pv-lock" aria-hidden="true">${I.lock}</span>` : '';
  const sel = P().try === e.id ? 'try' : '';
  return `<button class="pv-tile r-${e.rar || 'common'} ${e.on ? 'on' : ''} ${sel} ${e.own ? '' : 'locked'} ${dim}" data-a="pvTile" data-k="${e.k}" data-id="${esc(e.id)}" aria-pressed="${e.on}">
    ${lock}<span class="pv-prev">${prev}</span><span class="pv-nm">${esc(e.name)}</span>${rl}${state}</button>`;
}

/* ---------- Ansicht ---------- */
const ic = (svg, cls = '') => svg.replace('<svg', `<svg class="${cls}"`);
// Kleidungsstück in der Vorschau: das gerade angetippte, noch nicht gekaufte Teil sitzt schon am Avatar
const shownLook = () => { const a = normAvatar(S.user.avatar), it = P().try && St.shopItem(P().try); return it ? applyItem(a, it) : a; };
function head(u) {
  const L = St.levelInfo(), st = St.streakInfo(), lg = St.leagueFor(St.totalMin());
  const stat = (v, l) => `<div class="pv-stat"><b>${v}</b><span>${l}</span></div>`;
  return `<section class="pv-card pv-head">
    <div class="pv-av">${avatar(shownLook(), 136)}</div>
    <h2 class="pv-name">${esc(u.name)}</h2>
    ${u.username ? `<div class="pv-sub">@${esc(u.username)}</div>` : ''}
    <div class="pv-loc">${esc(regionName(u))}</div>
    <div class="pv-stats">${stat(`Level ${L.lvl}`, esc(L.rank.name))}${stat(`${st.current} ${st.current === 1 ? 'Tag' : 'Tage'}`, 'Streak')}${stat(esc(lg.name), 'Liga')}${stat(fmtHours(St.totalMin()), 'Gesamt')}</div>
    ${tryPanel()}
  </section>`;
}

// Vorschau/Kauf-Leiste: Teil ist am Avatar oben schon «anprobiert»
function tryPanel() {
  const it = P().try && St.shopItem(P().try); if (!it) return '';
  const cons = isCons(it), own = St.owns(it.id) && !cons, coins = St.coins(), miss = it.price - coins, rq = reqInfo(it), rar = RARITY[it.rar || 'common'];
  const a = normAvatar(S.user.avatar), locked = FIGURE_LOCKS.includes(it.slot) && figureSkin(a.skin);
  let btn, info = '';
  if (own) btn = locked ? `<button class="pv-btn" disabled>${ic(I.lock)}Gesperrt</button>`
    : `<button class="pv-btn red" data-a="pvWear" data-id="${it.id}">${isOn(it) ? 'Ablegen' : it.slot === 'effect' ? 'Als Feier-Effekt nutzen' : 'Anziehen'}</button>`;
  else if (it.pro && !St.isPro()) btn = `<button class="pv-btn red" data-a="openSheet" data-type="pro">Mit Pro freischalten</button>`;
  else if (!rq.ok) { btn = `<button class="pv-btn" disabled>${ic(I.lock)}Gesperrt</button>`; info = `${esc(rq.text)} nötig, um dieses legendäre Teil zu kaufen.`; }
  else if (miss > 0) { btn = `<button class="pv-btn" disabled>${icoCoin}${num(it.price)}</button>`; info = `Noch ${num(miss)} Münzen, das sind etwa ${fmtShort(miss)} Lernzeit.`; }
  else btn = `<button class="pv-btn ${cons ? 'white' : 'red'}" data-a="pvBuy" data-id="${it.id}">${it.pro ? 'Gratis holen' : `Kaufen für ${icoCoin}${num(it.price)}`}</button>`;
  return `<div class="pv-try"><b>${esc(it.name)}</b>
    ${cons ? '' : `<span class="pv-rar" style="--c:${rar.color}">${rar.label}</span>`}
    <p class="pv-note">${cons ? `Verpasst du einen Tag, rettet er deine Streak. Du hast ${S.freeze?.stock || 0}.` : `${kindLabel(it)}. ${noteOf(it)}${locked ? ` ${SKIN_HINT}.` : ''}`}</p>
    ${info ? `<p class="pv-hint pv-miss"><b>Das fehlt noch</b>${info}</p>` : ''}${btn}
    ${it.slot === 'effect' ? `<button class="pv-btn ghost" data-a="fxPlay" data-id="${it.id}">Vorschau abspielen</button>` : ''}
    <button class="pv-btn ghost" data-a="pvClose">Abbrechen</button></div>`;
}

function lookCard() {
  const p = P(), a = normAvatar(S.user.avatar), groups = lookList(p.cat), locked = figureSkin(a.skin) && ['kopf', 'gesicht'].includes(p.cat);
  const have = collectibles().filter(it => St.owns(it.id)).length, all = collectibles().length;
  return `<section class="pv-card" data-pv="look"><h3 class="pv-h">Mein Look</h3>
    <div class="pv-coins">${icoCoin}<b>${num(St.coins())}</b><span>Münzen</span></div>
    <p class="pv-note">${have} von ${all} gesammelt. 1 Lernminute = 1 Münze.</p>
    <div class="pv-tabs wrap" role="tablist">${LOOK_TABS.map(([k, l]) => `<button role="tab" aria-selected="${p.cat === k}" class="${p.cat === k ? 'on' : ''}" data-a="pvCat" data-id="${k}">${l}</button>`).join('')}</div>
    ${locked ? `<p class="pv-hint">${ic(I.lock)}${SKIN_HINT}</p>` : ''}
    ${groups.map(([t, list]) => list.length ? `${t ? `<div class="pv-gt">${t}</div>` : ''}<div class="pv-grid">${list.map(e => tile(e, a)).join('')}</div>` : '').join('')}
  </section>`;
}

const dailyCard = () => `<section class="pv-card pv-daily" data-pv="daily">${daily()}</section>`;

function trophyCard() {
  const p = P(), have = TROPHIES.filter(t => S.trophies[t.id]).length;
  const rows = TROPHIES.map(t => ({ t, n: S.trophies[t.id]?.n || (S.trophies[t.id] ? 1 : 0), d: St.trophyDetail(t.id) }))
    .sort((x, y) => (!!y.n - !!x.n) || (y.d.pct - x.d.pct));
  const shown = p.allTroph ? rows : rows.slice(0, 6);
  return `<section class="pv-card" data-pv="trophies"><h3 class="pv-h">Trophäen</h3>
    <p class="pv-note">${have} von ${TROPHIES.length} freigeschaltet · ${St.trophyCount()} insgesamt</p>
    <div class="pv-troph">${shown.map(({ t, n, d }) => `<button class="pv-tr ${n ? 'on' : ''}" data-a="openSheet" data-type="trophy" data-id="${t.id}">
      <span class="pv-tri">${n ? (emojiIcon(t.em) || ic(I.trophy)) : ic(I.lock)}</span><span class="pv-trn">${esc(t.name)}${n > 1 ? ` ×${n}` : ''}</span>
      ${n ? '<span class="pv-trs">Freigeschaltet</span>' : `<span class="pv-bar"><i style="width:${Math.round(d.pct * 100)}%"></i></span>`}</button>`).join('')}</div>
    ${rows.length > 6 ? `<button class="pv-btn ghost" data-a="pvAllTroph">${p.allTroph ? 'Weniger anzeigen' : `Alle anzeigen (${rows.length})`}</button>` : ''}
  </section>`;
}

/* ---------- Sheets innerhalb des Profils ---------- */
const sheetWrap = (title, body) => `<div class="scrim pv-scrim" data-a="pvClose" data-self="1"><div class="sheet pv-sheet" data-keep="pvsheet"><div class="grab"></div>
  <div class="pv-sh"><h3>${title}</h3><button class="pv-ib" data-a="pvClose" aria-label="Schliessen">${I.x}</button></div>${body}</div></div>`;

const row = (label, right = '', a = '', extra = '') => `<button class="pv-row" ${a ? `data-a="${a}"` : ''} ${extra}><span class="l">${label}</span><span class="r">${right}</span></button>`;
const chev = ic(I.chev, 'chev');
const sw = on => `<span class="switch ${on ? 'on' : ''}"></span>`;
function settingsSheet() {
  const u = S.user, st = S.settings;
  const nReq = BK.R?.requests?.length || 0;
  const g = (t, body) => `<div class="pv-gt">${t}</div><div class="pv-list">${body}</div>`;
  return sheetWrap('Einstellungen', `
    ${g('Profil', row('Profil bearbeiten', chev, 'pvEdit'))}
    ${g('Lernen',
    row('Präsenz-Check', `<select class="select pv-sel" data-a-change="setCheckin" aria-label="Präsenz-Check">${[[0, 'Aus'], [30, '30 min'], [45, '45 min'], [60, 'Stündlich'], [90, '90 min']].map(([v, l]) => `<option value="${v}" ${st.checkinMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)
    + row('Auto-Pause', sw(st.pauseOnLeave), 'togglePause')
    + row('Wochenziel', fmtHours(St.weekGoal()), 'openSheet', 'data-type="goal"')
    + row('Fächer & Farben', chev, 'openSheet', 'data-type="subjects"')
    + row('Streak-Erinnerung', sw(st.push), 'togglePush'))}
    ${g('App', row('Sprache', curLang().label, 'openSheet', 'data-type="lang"') + row('Erscheinungsbild', document.documentElement.dataset.theme === 'dark' ? 'Dunkel' : 'Hell', 'toggleDark'))}
    ${g('Freunde', row('Folge ich', `${S.friends.length}${chev}`, 'openFollowing') + row('Freunde finden', chev, 'openSheet', 'data-type="friend"'))}
    ${g('Privatsphäre', row('Folgen nur mit Anfrage', sw(u.followRequests !== false), 'toggleFollowMode')
      + row('Folgeanfragen', `${nReq ? `<span class="pv-badge">${nReq}</span>` : ''}${chev}`, 'openRequests') + row('Blockierte Personen', chev, 'openBlocked'))}
    <p class="pv-note">${u.ageBand === '13-15' ? 'Unter 16 ist dein Profil privat: nicht in der Rangliste für alle, Folgen nur mit deiner Zustimmung.' : u.followRequests !== false ? 'Neue Follower brauchen deine Zustimmung, bevor sie deine Sessions sehen.' : 'Öffentlich: Alle können dir direkt folgen und deine Sessions sehen.'}</p>
    ${CONFIG.PRO_ENABLED ? g('Brained Pro', row(St.isPro() ? `${TIER_NAME[St.tier()] || 'Brained Pro'} aktiv` : 'Brained Pro', chev, 'openSheet', 'data-type="pro"') + row('Code einlösen', chev, 'openSheet', 'data-type="redeem"') + (St.can('clarity') ? creditBar() : '')) : ''}
    ${g('Rechtliches',
      row('Datenschutzerklärung', chev, 'openLegal', 'data-id="datenschutz"') + row('Nutzungsbedingungen', chev, 'openLegal', 'data-id="agb"')
      + row('Impressum', chev, 'openLegal', 'data-id="impressum"') + row('Lizenzen & Quellen', chev, 'openLegal', 'data-id="lizenzen"')
      + (u.aiConsent ? row('KI-Einwilligung widerrufen', '', 'pathConsentRevoke') : '') + row('Support & Kontakt', esc(CONFIG.LEGAL_EMAIL)))}
    ${g('Konto', (BACKEND ? '' : row('Demo-Daten neu laden', '', 'reseed')) + row(BACKEND ? 'Abmelden' : 'Abmelden & alles löschen', '', 'logout') + row('<span class="pv-danger">Konto löschen</span>', '', 'deleteAccount'))}
    <p class="pv-note">Brained · ${BACKEND ? 'Verbunden' : 'Demo-Modus'} · Made in Switzerland</p>`);
}

function editSheet() {
  const f = P().f, c = f.country, regs = c === 'CH' ? CANTONS.map(x => [x, x]) : REGIONS[c] || [];
  return sheetWrap('Profil bearbeiten', `
    <div class="pv-form">
    <label class="pv-fl">Name<input class="input" data-bind="pv.f.name" maxlength="40" value="${esc(f.name)}" autocomplete="name"/></label>
    <label class="pv-fl">Nutzername<input class="input" data-bind="pv.f.username" maxlength="24" value="${esc(f.username)}" autocapitalize="off" autocomplete="off"/></label>
    <label class="pv-fl">Land<select class="select" data-bind="pv.f.country" data-a-change="pvCountry">${COUNTRIES.map(([k, l]) => `<option value="${k}" ${k === c ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${regs.length ? `<label class="pv-fl">${c === 'CH' ? 'Kanton' : 'Bundesland'}<select class="select" data-bind="pv.f.region">${regs.map(([k, l]) => `<option value="${esc(k)}" ${k === f.region ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
    <button class="pv-btn red" data-a="pvSaveEdit">Speichern</button></div>`);
}

export function profileV2View() {
  const u = S.user, p = P(); if (!u) return '';
  const sheet = { settings: settingsSheet, edit: editSheet }[p.sheet]?.() || '';
  return `<div class="pv-root" data-keep="profile">
    <div class="pv-top"><button class="pv-ib" data-a="closeOverlay" aria-label="Zurück">${I.back}</button><b>Profil</b><button class="pv-ib soft" data-a="pvSettings" aria-label="Einstellungen">${I.gear}</button></div>
    ${head(u)}${dailyCard()}${lookCard()}${trophyCard()}
  </div>${sheet}`;
}

/* ---------- Aktionen ---------- */
export function profileActions({ toast, haptic, chime, confetti, app }) {
  return {
    openProfile() { U.pv = null; U.overlay = 'profile'; },   // ersetzt die Version in app.js: Profil startet immer ohne offenes Sheet
    pvCat(d) { const p = P(); p.cat = d.id; p.try = null; },
    pvAllTroph() { P().allTroph = !P().allTroph; },
    pvSettings() { P().sheet = 'settings'; },
    pvClose() { const p = P(); p.sheet = null; p.try = null; },
    pvEdit() {
      const u = S.user, c = countryOf(u);
      P().f = { name: u.name, username: u.username, country: c, region: regionOf(u) || (c === 'CH' ? u.canton : REGIONS[c]?.[0][0]) || '' };
      P().sheet = 'edit';
    },
    // Auswahl im Look: gekauft → sofort anziehen, sonst am Avatar oben anprobieren und kaufen
    pvTile(d) {
      if (d.k === 'item' && (!St.owns(d.id) || isCons(St.shopItem(d.id)))) { const p = P(); p.try = p.try === d.id ? null : d.id; if (p.try) setTimeout(() => document.querySelector('.pv-root')?.scrollTo({ top: 0, behavior: 'smooth' }), 30); return; }
      P().try = null; if (wear(d.k, d.id, toast)) haptic(8);
    },
    pvOpen(d) { const p = P(), it = St.shopItem(d.id); if (!it) return; p.try = d.id; p.cat = { hat: 'kopf', eyes: 'gesicht', mouth: 'gesicht', aura: 'aura', bgfx: 'hintergrund', effect: 'effekt', extra: 'extras' }[it.slot] || (isCons(it) ? 'extras' : it.fill ? 'skin' : 'rahmen'); },
    pvWear(d) { if (wear('item', d.id, toast)) haptic(8); },
    async pvBuy(d) {
      const it = St.shopItem(d.id); if (!it) return;
      const cons = isCons(it);
      { const rq = reqInfo(it); if (!rq.ok && !St.owns(d.id)) return toast(`${rq.text} nötig`); }
      if (BK.enabled) {
        try { await BK.buyItem(d.id); } catch (e) { return toast('⚠️ ' + esc(e.message)); }
        if (cons) { S.freeze.stock = (S.freeze.stock || 0) + (it.qty || 1); St.save(); }
      } else if (!St.buy(d.id)) return toast(it.pro ? 'Nur mit Brained Pro' : 'Nicht genug Münzen');
      haptic([20, 40, 20]); chime();
      P().try = null; if (!cons) wear('item', d.id, toast);
      setTimeout(() => confetti(app), 30);
      toast(cons ? `Streak-Schutz gekauft, du hast jetzt ${S.freeze.stock}` : `${esc(it.name)} gehört dir`);
    },
    async pvSaveEdit() {
      const f = P().f, u = S.user, name = (f.name || '').trim(), un = (f.username || '').trim().replace(/^@/, '').toLowerCase();
      if (name.length < 2) return toast('Name zu kurz');
      if (!/^[a-z0-9._]{3,24}$/.test(un)) return toast('Nutzername: 3–24 Zeichen, nur a–z, 0–9, Punkt und _');
      { const bm = badMsg([name, un], { links: true }); if (bm) return toast(bm); }
      if (BK.enabled && un !== u.username) { try { if (!(await BK.usernameAvailable(un))) return toast(`@${esc(un)} ist schon vergeben`); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
      Object.assign(u, { name, username: un, country: f.country });
      if (f.country === 'CH') { u.canton = f.region || u.canton; delete u.region; } else if (f.country === 'OTHER') delete u.region; else u.region = f.region;
      St.save();
      if (BK.enabled) BK.updateProfile().catch(e => toast('⚠️ ' + esc(e.message)));
      P().sheet = null; toast('Profil gespeichert');
    },
  };
}
export function profileChange({ render }) {
  return {
    pvCountry(el) { const f = P().f; f.country = el.value; f.region = el.value === 'CH' ? (S.user.canton || 'ZH') : REGIONS[el.value]?.[0][0] || ''; render(); },
  };
}
