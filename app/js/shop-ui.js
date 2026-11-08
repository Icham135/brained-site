// Shop-Oberfläche: Hauptansicht (Tabs, Filter, Sortierung, Anprobe, Sammlung), «Neu im Shop»-Leiste (Home/Profil) und «Mein Look» (Profil).
// Wird von js/views.js eingebunden (shopView, myLook); Aktionen stehen in js/app.js.
import * as St from './store.js';
import { RARITY, SHOP_ITEMS, SHOP_FRAMES, BRAIN_SKINS, SHOP_CONSUMABLES, LEAGUES } from './data.js';
import { SLOT_LABELS } from './shop-items.js';
import { isAnimated } from './shop-fx.js';
import { esc, avatar, normAvatar, I, fmtShort, figureSkin, FIGURE_LOCKS, SKIN_HINT } from './ui.js';
import { U } from './view-state.js';
import { CONFIG } from './config.js';

const S = St.S;
const sel = (a, b) => a === b ? 'on' : '';
export const CATS = [['all', 'Alle'], ['skin', 'Skins'], ['hat', 'Hüte'], ['eyes', 'Brillen'], ['mouth', 'Münder'], ['extra', 'Extras'],
  ['frame', 'Rahmen'], ['bgfx', 'Hintergründe'], ['aura', 'Auren'], ['effect', 'Effekte'], ['cons', 'Verbrauch']];
const SORTS = [['rec', 'Empfohlen'], ['pa', 'Preis ↑'], ['pd', 'Preis ↓'], ['rar', 'Seltenheit']];
const RAR_ORDER = ['common', 'rare', 'epic', 'legend'];
export const isCons = it => SHOP_CONSUMABLES.some(c => c.id === it.id);
export const catOf = it => isCons(it) ? 'cons' : it.fill ? 'skin' : it.slot || 'frame';
// Vektor-Symbole statt Emojis (Münze, Schutzschild, Funken)
export const icoCoin = '<svg class="ico-coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.6"/></svg>';
export const icoShield = '<svg class="ico-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const icoSpark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
export const kindLabel = it => isCons(it) ? 'Verbrauchsgut' : it.fill ? 'Gehirn-Skin' : it.slot ? ({ hat: 'Kopf', eyes: 'Brille', mouth: 'Mund', extra: 'Extra', aura: 'Aura', bgfx: 'Hintergrund', effect: 'Feier-Effekt' })[it.slot] : 'Avatar-Rahmen';
const proOk = it => CONFIG.PRO_ENABLED || !it.pro;
// Alle Dinge, die man besitzen kann (ohne Verbrauchsgüter): Grundlage für «12 von 74»
export const collectibles = () => [...BRAIN_SKINS.filter(k => k.price || k.rar), ...SHOP_ITEMS, ...SHOP_FRAMES].filter(proOk);
const entries = () => [...collectibles(), ...SHOP_CONSUMABLES];
// Bedingung für legendäre Teile (Streak-Rekord oder Liga): ok + Hinweistext
export function reqInfo(it) {
  const r = it?.req; if (!r) return { ok: true, text: '' };
  if (r.streak) return { ok: St.streakInfo().best >= r.streak, text: `Streak ${r.streak}` };
  const need = LEAGUES.findIndex(l => l.name === r.league), cur = LEAGUES.indexOf(St.leagueFor(St.totalMin()));
  return { ok: cur >= need, text: `Ab ${r.league}` };
}
const myAvatar = () => normAvatar(S.user.avatar);

// Item am Avatar anwenden (für Vorschau/Anprobe). Effekte und Verbrauchsgüter ändern den Avatar nicht.
export function applyItem(a, it) {
  if (!it || isCons(it) || it.slot === 'effect') return a;
  if (it.fill) return figureSkin(it.id) ? { ...a, skin: it.id, hat: '', eyes: '', mouth: '' } : { ...a, skin: it.id };
  if (it.slot) return FIGURE_LOCKS.includes(it.slot) && figureSkin(a.skin) ? a : { ...a, [it.slot]: it.id };
  return { ...a, frame: it.id };
}
export const tryLook = () => (U.tryOn || []).reduce((a, id) => applyItem(a, St.shopItem(id)), myAvatar());
export const isOn = it => {
  const me = myAvatar();
  if (isCons(it)) return false;
  if (it.slot === 'effect') return (S.user.effect || 'e-confetti') === it.id;
  if (it.fill) return me.skin === it.id;
  if (it.slot) return me[it.slot] === it.id && !(FIGURE_LOCKS.includes(it.slot) && figureSkin(me.skin));
  return me.frame === it.id;
};
export const noteOf = it => ({ aura: 'Läuft animiert rund um dein Gehirn und ist für alle sichtbar.', bgfx: 'Hintergrund in deiner Avatar-Scheibe, für alle sichtbar.', effect: 'Spielt bei Session-Ende, Etappen-Abschluss und Streak-Meilenstein.', mood: 'Neuer Gesichtsausdruck für dein Gehirn.' }[it.slot] || 'Sichtbar in Ranglisten, Lernräumen und auf deinem Profil.');
const rarTag = r => `<span class="rar-tag" style="background:${RARITY[r].color}22;color:${RARITY[r].color}">${RARITY[r].label}</span>`;

// Vorschau-Kachel: Avatar mit dem Item (Effekt/Titel/Verbrauch: eigene Symbole)
export function preview(it, size, base = myAvatar()) {
  if (isCons(it)) return `<div class="fx-tile" style="width:${size}px;height:${size}px"><span class="fx-ic" style="width:${Math.round(size * .5)}px">${icoShield}</span></div>`;
  if (it.slot === 'effect') return `<div class="fx-tile r-${it.rar}" style="width:${size}px;height:${size}px"><span class="fx-ic" style="width:${Math.round(size * .5)}px">${icoSpark}</span></div>`;
  return avatar(applyItem(base, it), size);
}

function filtered() {
  const cat = U.shopCat || 'all', rar = U.shopRar || 'all', only = U.shopOnly || '', sort = U.shopSort || 'rec', all = entries();
  let list = cat === 'all' ? all : all.filter(it => catOf(it) === cat);
  if (rar !== 'all') list = list.filter(it => it.rar === rar);
  if (only === 'missing') list = list.filter(it => !St.owns(it.id));
  const price = it => it.pro ? 99999 : it.price, catRank = it => CATS.findIndex(c => c[0] === catOf(it));
  const ord = { rec: (a, b) => (St.owns(a.id) - St.owns(b.id)) || (catRank(a) - catRank(b)) || price(a) - price(b), new: (a, b) => all.indexOf(b) - all.indexOf(a), pa: (a, b) => price(a) - price(b), pd: (a, b) => price(b) - price(a), rar: (a, b) => RAR_ORDER.indexOf(b.rar) - RAR_ORDER.indexOf(a.rar) || price(a) - price(b) }[sort];
  return [...list].sort(ord);
}

function card(it, coins) {
  const own = St.owns(it.id), on = isOn(it), cons = isCons(it);
  return `<button class="shop-item r-${it.rar || 'common'} ${on ? 'eq' : ''} ${!own && !it.pro && it.price > coins ? 'locked' : ''}" data-a="shopOpen" data-id="${it.id}">
    <span class="rar" style="background:${RARITY[it.rar || 'common'].color}"></span>${preview(it, 66)}
    <span class="n">${esc(it.name)}</span><span class="p ${own ? 'own' : ''}">${cons ? icoCoin + it.price : on ? 'Aktiv' : own ? 'Besitzt' : it.pro ? 'Pro' : icoCoin + it.price}</span>
    ${it.pro ? '<span class="pro-badge">PRO</span>' : ''}</button>`;
}

function hero(coins) {
  const items = collectibles(), have = items.filter(it => St.owns(it.id)).length, total = items.length, tryOn = U.tryOn || [];
  const look = tryLook(), a = look;
  const cost = tryOn.map(id => St.shopItem(id)).filter(it => it && !St.owns(it.id) && !it.pro).reduce((x, it) => x + it.price, 0);
  return `<div class="shop-hero2"><div class="shop-live">${avatar(a, 92)}</div>
    <div class="grow"><div class="coins num">${icoCoin}${coins}</div>
      <div class="coll"><b>${have} von ${total}</b> gesammelt<div class="bar"><i style="width:${Math.round(have / Math.max(1, total) * 100)}%"></i></div></div>
      <small>1 Lernminute = 1 Coin · +25 pro Trophäe</small></div></div>
    ${tryOn.length ? `<div class="try-bar"><b>Anprobe</b>${tryOn.map(id => { const it = St.shopItem(id); return it ? `<button class="try-chip" data-a="shopTry" data-id="${id}" title="Entfernen">${esc(it.name)}</button>` : ''; }).join('')}
      <div class="try-act"><button class="btn ghost sm" data-a="shopTryClear">Leeren</button>${cost ? `<span class="faint small bold">Nicht besessen: ${icoCoin}${cost}</span>` : '<button class="btn sm" data-a="shopTryWear">Anziehen</button>'}</div></div>` : ''}`;
}

export function daily() {
  const g = St.dailyGift();
  if (g.claimed) return `<div class="daily done"><span class="e">${icoSpark}</span><div class="grow"><b>Heute abgeholt</b><div class="faint small">Morgen wartet ein neues Geschenk.</div></div></div>`;
  const sk = g.kind === 'skin' ? St.shopItem(g.item) : null;
  return `<div class="daily"><div class="pv">${sk ? preview(sk, 52) : `<span class="e">${icoSpark}</span>`}</div><div class="grow"><b>${esc(g.text)}</b><div class="faint small">${g.kind === 'skin' ? 'Nur einmal pro Woche · ' : ''}Tagesgeschenk, einmal pro Tag</div></div><button class="pv-btn red sm" data-a="shopDaily">Holen</button></div>`;
}

export function shopView(head) {
  const coins = St.coins();
  if (U.shopSel) return head('Shop') + detail(coins);
  const list = filtered(), cat = U.shopCat || 'all', rar = U.shopRar || 'all';
  return head('Shop') + hero(coins) + daily() + `
    <div class="shop-cats">${CATS.map(([k, l]) => `<button class="${sel(cat, k)}" data-a="shopCat" data-id="${k}">${l}</button>`).join('')}</div>
    <div class="shop-filter"><div class="rar-chips">${['all', ...RAR_ORDER].map(r => `<button class="${sel(rar, r)}" data-a="shopRar" data-id="${r}" ${r === 'all' ? '' : `style="--c:${RARITY[r].color}"`}>${r === 'all' ? 'Alle' : `<i></i>${RARITY[r].label}`}</button>`).join('')}</div>
      <div class="row" style="gap:8px;align-items:center"><select class="select sort" data-a-change="shopSort" aria-label="Sortierung">${SORTS.map(([k, l]) => `<option value="${k}" ${(U.shopSort || 'rec') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="chip-toggle ${U.shopOnly === 'missing' ? 'on' : ''}" data-a="shopOnly">Nur Fehlendes</button><span class="faint small bold grow" style="text-align:right">${list.length} Items</span></div></div>
    ${list.length ? `<div class="shop-grid">${list.map(it => card(it, coins)).join('')}</div>` : '<div class="center faint" style="padding:30px 0">Hier ist nichts – ändere den Filter.</div>'}`;
}

function detail(coins) {
  const it = St.shopItem(U.shopSel); if (!it) { U.shopSel = null; return ''; }
  const cons = isCons(it), own = St.owns(it.id), active = isOn(it), miss = it.price - coins, trying = (U.tryOn || []).includes(it.id);
  const back = `<button class="btn ghost sm" style="align-self:flex-start" data-a="shopBack">${I.back} Zurück</button>`;
  const base = tryLook();
  const catItems = collectibles().filter(x => catOf(x) === catOf(it)), haveCat = catItems.filter(x => St.owns(x.id)).length;
  const locked = FIGURE_LOCKS.includes(it.slot) && figureSkin(base.skin);
  let buy;
  if (own && locked) buy = `<button class="btn3d mt12" disabled>Gesperrt</button><div class="faint small bold">${SKIN_HINT} – mit dem aktuellen Skin nicht sichtbar.</div>`;
  else if (own) buy = `<button class="btn3d mt12" data-a="shopEquip" data-id="${it.id}">${cons ? '' : active ? (it.slot === 'effect' ? 'Standard-Konfetti nutzen' : 'Ablegen') : it.slot === 'effect' ? 'Als Feier-Effekt nutzen' : 'Anziehen'}</button>`;
  else if (it.pro) buy = St.isPro() ? `<button class="btn3d mt12" data-a="shopBuy" data-id="${it.id}">Gratis holen</button>` : `<button class="btn3d mt12" data-a="openSheet" data-type="pro">Mit Pro freischalten</button>`;
  else if (miss > 0) buy = `<button class="btn3d mt12" disabled>${icoCoin}${it.price}</button><div class="faint small bold">Dir fehlen noch ${miss} Coins – etwa ${fmtShort(miss)} lernen.</div>`;
  else buy = `<button class="btn3d mt12" data-a="shopBuy" data-id="${it.id}">Kaufen für ${icoCoin}${it.price}</button>`;
  if (cons) {
    buy = miss > 0 ? `<button class="btn3d mt12" disabled>${icoCoin}${it.price}</button><div class="faint small bold">Dir fehlen noch ${miss} Coins.</div>` : `<button class="btn3d white mt12" data-a="shopBuy" data-id="${it.id}">Kaufen für ${icoCoin}${it.price}</button>`;
    return `<div class="shop-detail">${back}<div class="fx-ic big">${icoShield}</div><h2 style="font-size:24px">${esc(it.name)}</h2>
      <p class="muted" style="max-width:300px">Verpasst du einen Tag, wird automatisch ein Schutz eingesetzt und deine Streak bleibt.${it.qty > 1 ? ` Dieses Paket enthält ${it.qty} Schutz-Tage.` : ''} Du hast <b>${S.freeze?.stock || 0}</b>.</p>${buy}</div>`;
  }
  const big = it.slot === 'effect' ? `<div class="fx-tile big r-${it.rar}">${it.icon}</div>` : `<div class="shop-live">${avatar(applyItem(base, it), 170)}</div>`;
  const note = { aura: 'Läuft animiert rund um dein Gehirn – sichtbar für alle.', bgfx: 'Hintergrund in deiner Avatar-Scheibe – sichtbar für alle.', effect: 'Spielt bei Session-Ende, Etappen-Abschluss und Streak-Meilenstein.', title: 'Erscheint unter deinem Namen im Profil.', mood: 'Neuer Gesichtsausdruck für dein Gehirn.' }[it.slot] || 'Sichtbar in Ranglisten & auf deinem Profil.';
  return `<div class="shop-detail">${back}<div style="margin:6px 0" class="det-prev">${big}</div>
    <div class="row" style="gap:6px;justify-content:center">${rarTag(it.rar || 'common')}${isAnimated(it) ? '<span class="anim-tag">Animiert</span>' : ''}</div>
    <h2 style="font-size:24px">${esc(it.name)}</h2><div class="faint small">${kindLabel(it)} · ${note}</div>
    ${catItems.length > 1 ? `<div class="faint small">${haveCat} von ${catItems.length} in «${CATS.find(c => c[0] === catOf(it))?.[1] || ''}»</div>` : ''}
    ${it.pro ? `<div class="faint small bold">Pro-Item des Monats ${it.month ? `(${it.month})` : ''} – gratis für alle mit Brained Pro</div>` : ''}
    <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap">
      ${it.slot === 'effect' ? `<button class="btn ghost" data-a="fxPlay" data-id="${it.id}">Vorschau abspielen</button>` : `<button class="btn ghost ${trying ? 'on' : ''}" data-a="shopTry" data-id="${it.id}">${trying ? 'In Anprobe' : 'Anprobieren'}</button>`}</div>
    ${buy}</div>`;
}

/* ---------- «Mein Look» im Profil: Live-Vorschau + gekaufte Teile direkt an- und ablegen ---------- */
export function myLook() {
  const a = myAvatar(), cat = U.lookCat || 'aura';
  const tabs = CATS.filter(([k]) => !['all', 'cons'].includes(k));
  const owned = collectibles().filter(it => catOf(it) === cat && St.owns(it.id));
  const eq = it => isOn(it);
  const lockedCat = FIGURE_LOCKS.includes(cat) && figureSkin(a.skin);
  const btn = it => `<button class="lk ${eq(it) ? 'on' : ''} ${lockedCat ? 'locked' : ''}" ${lockedCat ? 'disabled' : ''} data-a="shopEquip" data-id="${it.id}" title="${esc(it.name)}">${preview(it, 46, a)}<span>${esc(it.name)}</span></button>`;
  return `<div class="my-look"><div class="ml-top"><div class="shop-live">${avatar(a, 104)}</div><div class="grow"><b>Mein Look</b>
      <div class="faint small">Tippe auf ein Teil, um es anzuziehen oder abzulegen.</div><button class="btn ghost sm" style="margin-top:6px" data-a="openShop">Zum Shop</button></div></div>
    <div class="seg sm" style="overflow-x:auto;scrollbar-width:none">${tabs.map(([k, l]) => `<button style="flex:none;padding:0 11px" class="${sel(cat, k)} ${FIGURE_LOCKS.includes(k) && figureSkin(a.skin) ? 'dim' : ''}" data-a="lookCat" data-id="${k}">${l}</button>`).join('')}</div>
    ${lockedCat ? `<div class="faint small bold lk-hint">${SKIN_HINT}</div>` : ''}
    <div class="av-edit-row lk-row">${owned.length ? owned.map(btn).join('') : '<span class="faint small" style="padding:10px 4px">Noch nichts in dieser Kategorie.</span>'}</div></div>`;
}
