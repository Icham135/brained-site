// Brained – App-Controller: Rendering, Aktionen, Live-Loop.
import * as St from './store.js';
import * as T from './timer.js';
import * as AI from './ai.js';
import * as GM from './games.js';
import { renderApp, timerLive, friendRows, QUIZ, ONB_STEPS, LOAD_ITEMS } from './views.js';
import { setLang, translateDOM, t, lang } from './i18n.js';
import { U } from './view-state.js';
import { esc, iconize, emojiIcon, brainSVG, confetti, haptic, chime, pauseOtherMedia, fmtShort, fmtClock, normAvatar, figureSkin, FIGURE_LOCKS, SKIN_HINT } from './ui.js';
import { SHOP_CONSUMABLES, BRAIN_SKINS, BRAIN_MOODS, AVATAR_BGS, SUBJECT_COLORS } from './data.js';
import * as BK from './backend.js';
import { setEffect, celebrate } from './shop-fx.js';
import { isOn } from './shop-ui.js';
import { initNative, setStatusBar, dimNative, platform, isNative, nativeBillingReady, nativePurchase, nativeRestore } from './native.js';
import { CONFIG, DEV } from './config.js';
import morphdom from './vendor/morphdom.js';
import { clarityInit, clarityActions, clarityChange } from './clarity.js';
import { roomActions, roomChange, roomInit, roomTick } from './rooms.js';
import { playActions, playChange, playInput } from './play.js';
import { profileActions, profileChange } from './profile-v2.js';
import { rankActions, rankChange, REGIONS } from './rank-v2.js';
import * as PV from './pro-v2.js';
import * as RB from './rooms-backend.js';
import { isClean, CLEAN_MSG, badMsg } from './moderation.js';
import { SHOWCASE as CONFIG_SHOWCASE } from './config.js';

const S = St.S;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');

/* ---------------- Rendering ---------------- */
function setPath(path, val) {
  const keys = path.split('.'), last = keys.pop();
  const obj = keys.reduce((o, k) => o?.[k], U);
  if (obj) obj[last] = val;
}
function syncBinds() {
  $$('[data-bind]', app).forEach(el => setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value));
}
// Quiz-Auswahl: nur geänderte Teile austauschen statt den ganzen Bildschirm neu zu zeichnen (kein Flackern)
function patchQuiz() {
  const tmp = document.createElement('div'); tmp.innerHTML = renderApp(); translateDOM(tmp);
  const nt = $$('.ob-opt', tmp);
  $$('.ob-opt', app).forEach((t, i) => { t.classList.toggle('on', !!nt[i]?.classList.contains('on')); t.setAttribute('aria-checked', t.classList.contains('on')); });
  const r = $('.qreact', app), nr = $('.qreact', tmp);
  if (r && nr && r.innerHTML !== nr.innerHTML) { r.innerHTML = nr.innerHTML; r.classList.remove('pop'); void r.offsetWidth; r.classList.add('pop'); }
  const b = $('.qbrain', app), nb = $('.qbrain', tmp);
  if (b && nb && b.outerHTML !== nb.outerHTML) b.replaceWith(nb);
  const n = $('[data-a="quizNext"]', app), nn = $('[data-a="quizNext"]', tmp);
  if (n && nn) n.disabled = nn.disabled;
  return false;
}
let lastKey = '', lastMain = '', lastSheet = '';
// Neu zeichnen per DOM-Abgleich (morphdom): nur Geändertes wird angefasst → kein Flackern, kein Springen,
// Scroll-Positionen, Fokus und laufende Animationen bleiben erhalten. Viel schneller als innerHTML.
function render() {
  setEffect(S.user?.effect); // ausgerüsteter Feier-Effekt (Shop) gilt für confetti()
  const main = JSON.stringify([U.tab, U.overlay?.type ?? U.overlay ?? null, U.onb?.step ?? null, !!U.standby, S.user ? 1 : 0,
    U.tab === 'ai' ? [U.ai?.tool ?? null, U.ai?.phase ?? null, U.ai?.i ?? null] : null]);
  const sheet = JSON.stringify([U.sheet?.type ?? null, U.sheet?.id ?? null, U.modal?.type ?? null]);
  const same = main === lastMain && sheet === lastSheet;
  const tpl = document.createElement('div');
  tpl.innerHTML = renderApp();
  translateDOM(tpl);
  iconize(tpl);
  const active = document.activeElement;
  morphdom(app, tpl, {
    childrenOnly: true,
    onBeforeElUpdated(from, to) {
      if (from.tagName === 'CANVAS') return false;                      // Spiele zeichnen selbst
      if (from.dataset?.live !== undefined && from.dataset.live === '') return false;   // Ebenen mit eigener Animation (Lernraum: Laufen, Atmosphäre)
      if (from.tagName === 'DETAILS') to.open = from.open;              // aufgeklappte Details bleiben offen
      // Feld, in dem gerade getippt wird: Wert & Cursor nicht anfassen
      if (from === active && (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') && from.dataset.bind && from.dataset.bind === to.dataset.bind && !to.hasAttribute('disabled')) return false;
      return !from.isEqualNode(to);
    },
  });
  app.classList.toggle('still', same);
  app.classList.toggle('sb', !!U.standby);
  // Neuer Bildschirm → oben anfangen; neues Sheet → Sheet oben
  if (main !== lastMain) $$('.content, .overlay, .onb, .timer-screen, .summary', app).forEach(el => { if (!el.dataset.keep) el.scrollTop = 0; });
  if (sheet !== lastSheet) $$('.sheet', app).forEach(el => el.scrollTop = 0);
  lastMain = main; lastSheet = sheet; lastKey = main + sheet;
  applyTheme();
}
const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
function applyTheme() {   // 'auto' folgt dem System; data-theme ist immer gesetzt (hell oder dunkel)
  const lq = new URLSearchParams(location.search).get('look'), t = lq ? 'light' : S.settings.theme, dark = t === 'dark' || (t !== 'light' && sysDark());   // ?look=a–e zeigt einen Farb-Look (nur hell)
  setStatusBar(dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const pq = new URLSearchParams(location.search).get('play'), pv = pq || S.settings.play || '3'; if (pv) document.documentElement.dataset.play = pv; else delete document.documentElement.dataset.play;
  // Standard im hellen Modus: Look «Silber & Flieder» (i) und Play-Button «Pille» (3)
  const lk = lq || S.settings.look || 'i'; if (lk && lk !== '-') document.documentElement.dataset.look = lk; else delete document.documentElement.dataset.look;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (S.settings.theme === 'auto') applyTheme(); });
let toastTimer;
function toast(html, action, label, ms) {
  U.toast = { html, action, label };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { U.toast = null; const el = $('.toast', app); if (el) el.remove(); }, ms || (action ? 6000 : 2600));
  render();
}
function scrollContentBottom() { const c = $('.content', app); if (c) c.scrollTop = c.scrollHeight; }
async function share(text, title = 'Brained') {
  try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); } catch { toast('Teilen nicht möglich'); }
}
function trophyToast() {
  const fresh = St.checkTrophies();
  if (fresh.length) bg(() => BK.pushProfileStats()); // Trophäen sofort für andere sichtbar
  if (fresh.length) { const t = fresh[0]; toast(`${t.em} ${t.n > 1 ? `<b>${t.name}</b> zum ${t.n}. Mal geholt!` : `Trophäe freigeschaltet: <b>${t.name}</b>`}`, 'openTrophy', 'Ansehen'); U.lastTrophy = t.id; confetti(app); }
  return fresh;
}

/* ---------------- Backend-Helfer ---------------- */
// bg(): Server-Aufruf im Hintergrund; Fehler als Toast statt Absturz. Im Demo-Modus no-op.
const bg = fn => { if (!BK.enabled || !S.user?.id) return; Promise.resolve().then(fn).catch(e => toast('⚠️ ' + esc(e.message))); };
St.hooks.onSave = () => BK.schedulePush();
BK.hooks.onPaywall = reason => { if (!CONFIG.PRO_ENABLED) return; U.sheet = { type: 'pro', reason }; render(); };
// Nach einem Kauf meldet der Zahlungsanbieter den Status per Webhook – kurz nachfragen, bis er da ist
async function waitForPro() {
  for (let i = 0; i < 10; i++) { await BK.loadPlan().catch(() => { }); if (St.isPro()) break; await new Promise(r => setTimeout(r, 1500)); }
  if (St.isPro()) { St.applyFreeze(); U.sheet = { type: 'pro' }; setTimeout(() => confetti(app), 50); toast('Willkommen bei Brained Pro!'); } else toast('Zahlung erhalten – Pro wird in wenigen Minuten aktiv.');
  render();
}
function proLookCheck() { if (St.dropProLook()) { setEffect(S.user.effect); toast('Pro ist abgelaufen – deine Pro-Teile wurden abgelegt', null, null, 4500); BK.enabled && bg(() => BK.updateProfile()); } }
function freezeCheck() { if (St.applyFreeze()) setTimeout(() => toast('Streak-Schutz eingesetzt – deine Streak lebt weiter!', null, null, 6000), 2000); }
// Soziale Daten nachladen und danach neu zeichnen
const rankSeen = {};   // Rangliste: pro Filter 60 s im Gerät zwischenspeichern
async function refreshSocial(what, force) {
  if (!BK.enabled || !S.user?.id) return;
  try {
    const jobs = [];
    if (what === 'home') jobs.push(BK.loadFeed(), BK.loadFriendsToday(), BK.loadRequests());
    if (what === 'rank') {
      const rk = [U.rankScope, U.rankPeriod, U.rankGroup, U.rankCanton].join('|');
      if (!force && Date.now() - (rankSeen[rk] || 0) < 60e3) return render();
      rankSeen[rk] = Date.now();
      jobs.push(BK.loadGroups().then(() => {
        const groupId = U.rankScope === 'group' ? (S.groups.some(g => g.id === U.rankGroup) ? U.rankGroup : S.groups[0]?.id) : null;
        if (U.rankScope === 'group' && !groupId) return;
        return BK.loadLeaderboard({ scope: U.rankScope, period: U.rankPeriod, groupId, canton: U.rankCanton });
      }));
    }
    await Promise.all(jobs);
    render();
  } catch (e) { toast('⚠️ ' + esc(e.message)); }
}
// Nach erfolgreichem Login (Google, Apple, E-Mail-Code)
async function afterLogin(user) {
  if (!user) return;
  try {
    const profile = await BK.fetchProfile(user.id);
    if (profile) {
      const prev = S.user;
      S.user = BK.profileToUser(profile, user.email);
      if (prev?.id === S.user.id) { if (prev.ageBand) S.user.ageBand = prev.ageBand; if (prev.aiConsent) S.user.aiConsent = prev.aiConsent; }   // lokale Angaben (Altersgruppe, KI-Einwilligung) nicht verlieren
      await BK.pullAll(user.id);
      if (S.settings.lang && S.settings.lang !== lang) await setLang(S.settings.lang);
      St.save(); St.checkTrophies(); freezeCheck();
      U.tab = 'home'; U.sheet = null; render(); refreshSocial('home');
      if (U.proReturn === 'success') { U.proReturn = null; waitForPro(); }
      if (U.pendingJoin) { A.openSheet({ type: 'groupJoin', code: U.pendingJoin }); U.pendingJoin = null; render(); }
      if (U.pendingRoom) { openRoomLink(U.pendingRoom); U.pendingRoom = null; render(); }
    } else {
      // Neues Konto → Profil im Onboarding anlegen
      U.authUser = { id: user.id, email: user.email };
      const md = user.user_metadata || {};
      U.onb.d.email = user.email || '';
      if (!U.onb.d.username) U.onb.d.username = String(md.full_name || md.name || BK.appleName || '').toLowerCase().normalize('NFD').replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 24);
      U.onb.step = 'profile'; render();
    }
  } catch (e) { toast('⚠️ ' + esc(e.message)); }
}

/* ---------------- Aktionen ---------------- */
const ONB_ORDER = ['intro', ...ONB_STEPS];
const consentOk = () => {
  if (U.onb.mode === 'login') return true; // bestehendes Konto: Zustimmung liegt vor (neue Konten holen sie im Profil-Schritt nach)
  if (!U.onb.d.terms) { toast('Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung'); return false; }
  if (!U.onb.d.age) { toast('Bitte bestätige, dass du mindestens 13 bist und – falls unter 16 – deine Eltern einverstanden sind.'); return false; }
  return true;
};
const avTarget = () => U.sheet?.type === 'editProfile' ? U.form.avatar : U.onb.d.avatar;

const A = {
  // Onboarding
  onbStart() { U.onb.step = 'level'; U.onb.mode = 'signup'; U.onb.fromQuiz = true; },
  onbLogin() { U.onb.step = 'auth'; U.onb.mode = 'login'; U.onb.fromQuiz = false; },
  onbSkip() { U.onb.step = 'auth'; U.onb.fromQuiz = false; },
  setWeekGoal(d) { const h = +d.h; if (!(h >= 1 && h <= 60)) return; S.user.weeklyGoalMin = h * 60; St.save(); bg(() => BK.updateProfile()); U.sheet = null; toast(`Wochenziel: ${h} Stunden`); },
  async setLang(d) { await setLang(d.id); S.settings.lang = d.id; if (S.user) St.save(); },
  pokeBrainy() {
    U.onb.poke = (U.onb.poke || 0) + 1; haptic(15); render();
    const m = $('.mascot-big', app); if (!m) return false;
    m.classList.add('jump');
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span'); s.className = 'pop';
      s.innerHTML = emojiIcon(['💖', '✨', '🧠', '⭐', '💡'][(U.onb.poke + i) % 5]);
      s.style.setProperty('--dx', (i - 1) * 50 + 'px'); s.style.animationDelay = i * .08 + 's';
      m.appendChild(s);
    }
    return false;
  },
  quizPick(d) {
    const Q = QUIZ[U.onb.step], q = U.onb.d.quiz; if (!Q) return;
    haptic(8);
    if (!Q.multi) { q[U.onb.step] = d.id; return U.onb.step === 'level' ? render() : patchQuiz(); }
    let v = q[U.onb.step] || [];
    if (d.id === 'none') v = v.includes('none') ? [] : ['none'];
    else { v = v.filter(x => x !== 'none'); v = v.includes(d.id) ? v.filter(x => x !== d.id) : [...v, d.id]; }
    q[U.onb.step] = v;
    return patchQuiz();
  },
  quizNext() {
    const i = ONB_STEPS.indexOf(U.onb.step), q = U.onb.d.quiz;
    if (U.onb.step === 'level' && q.level) U.onb.d.level = q.level;
    if (U.onb.step === 'weekly' && q.weekly) U.onb.d.goalH = +q.weekly;
    U.onb.step = ONB_STEPS[i + 1];
    if (U.onb.step === 'auth') { U.onb.mode = 'signup'; U.onb.fromQuiz = true; }
  },
  async onbLoad() {
    if (!U.onb.d.subjects.length) return;
    U.onb.step = 'loading'; U.onb.load = 0; render();
    const t0 = Date.now(), DUR = 2600;
    await new Promise(res => {
      const tick = () => {
        const p = Math.min(100, Math.round(((Date.now() - t0) / DUR) ** .8 * 100)); U.onb.load = p;
        const pc = $('[data-live="loadPct"]', app), arc = $('[data-live="loadArc"]', app);
        if (!pc) return res();
        pc.textContent = p + '%'; arc.setAttribute('stroke-dashoffset', arc.dataset.c * (1 - p / 100));
        const n = LOAD_ITEMS.length, cur = Math.min(n - 1, Math.floor(p / (100 / n)));
        $$('[data-live="loadItem"]', app).forEach(el => { const i = +el.dataset.i; el.className = 'load-item' + (i < cur || p >= 100 ? ' done' : i === cur ? ' act' : ''); });
        if (p >= 100) setTimeout(res, 350); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await A.onbFinish();
    if (!S.user && U.onb.step === 'loading') U.onb.step = 'subjects';
  },
  onbConsent(d) { U.onb.d[d.k] = !U.onb.d[d.k]; },
  onbBand(d) { U.onb.d.band = d.v; },
  onbCountry(d) { const o = U.onb.d; if (o.country !== d.v) { o.country = d.v; o.region = ''; } },
  async googleLogin() { return A.oauth({ p: 'google' }); },
  async appleLogin() { return A.oauth({ p: 'apple' }); },
  async oauth(d) {
    if (!consentOk()) return;
    if (!BK.enabled) { U.onb.d.google = true; U.onb.step = 'profile'; return toast(`Demo-Modus: ${d.p === 'apple' ? 'Apple' : 'Google'}-Login ist simuliert`); }
    try { U.onb.busy = true; render(); await BK.signInOAuth(d.p); } catch (e) { toast('⚠️ ' + esc(e.message)); }
    U.onb.busy = false;
  },
  authMode(d) { U.onb.mode = d.id; U.onb.showEmail = false; },
  onbShowEmail() { U.onb.showEmail = true; },
  async emailLogin() {
    if (!consentOk()) return;
    const email = (U.onb.d.email || '').trim(), pw = U.onb.d.password || '';
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Bitte gültige E-Mail eingeben');
    if (!BK.enabled) { U.onb.step = 'profile'; return; }
    if (pw.length < 8) return toast('Passwort: mindestens 8 Zeichen');
    try {
      U.onb.busy = true; render();
      if (U.onb.mode === 'login') await BK.signInPassword(email, pw); else await BK.signUpPassword(email, pw);
      U.onb.d.password = ''; // → onAuth → afterLogin
    } catch (e) { toast('⚠️ ' + esc(e.message)); if (/Anmelden/.test(e.message)) U.onb.mode = 'login'; }
    U.onb.busy = false;
  },
  async verifyCode() {
    const code = (U.onb.d.code || '').replace(/\D/g, '');
    if (code.length < 6) return toast('Gib den Code aus der E-Mail ein');
    try { U.onb.busy = true; render(); await BK.verifyEmailCode(U.onb.d.email.trim(), code); } // → onAuth → afterLogin
    catch (e) { toast('⚠️ Code ungültig oder abgelaufen'); }
    U.onb.busy = false;
  },
  onbBack() {
    if (U.onb.step === 'code') { U.onb.step = 'auth'; return; }
    if (U.onb.step === 'auth' && !U.onb.fromQuiz) { U.onb.step = 'intro'; return; }
    if (BK.enabled && U.onb.step === 'profile') { BK.signOut(); U.authUser = null; }
    const i = ONB_ORDER.indexOf(U.onb.step); U.onb.step = i > 0 ? ONB_ORDER[i - 1] : 'intro';
  },
  onbLevel(d) { U.onb.d.level = d.id; },
  onbTo(d) {
    const o = U.onb.d;
    if (U.onb.step === 'profile') {
      o.username = o.username.trim().replace(/^@/, '').toLowerCase();
      if (!o.username) return toast('Wie heisst du?');
      if (!/^[a-z0-9._]{3,24}$/.test(o.username)) return toast('Benutzername: 3–24 Zeichen, nur a–z, 0–9, Punkt und _');
      { const bm = badMsg([o.username], { links: true }); if (bm) return toast(bm); }
      if (!o.country) return toast('Aus welchem Land kommst du?');
      if (REGIONS[o.country] && !o.region) return toast(o.country === 'CH' ? 'Aus welchem Kanton kommst du?' : 'Aus welchem Bundesland kommst du?');
      o.name = o.username;   // Anzeigename = Benutzername
      if (!o.band) return toast('Wie alt bist du?');
      if (o.band === 'u13') return toast('Brained ist erst ab 13. Frag in ein paar Jahren nochmals.');
      if (!o.terms || !o.age) { U.onb.mode = 'signup'; if (!consentOk()) return; }
    }
    U.onb.step = d.step;
  },
  avShuffle() { const a = avTarget(), free = BRAIN_SKINS.filter(k => !k.price); a.skin = free[Math.floor(Math.random() * free.length)].id; a.mood = BRAIN_MOODS[Math.floor(Math.random() * BRAIN_MOODS.length)][0]; a.bg = AVATAR_BGS[Math.floor(Math.random() * AVATAR_BGS.length)]; },
  avSkin(d) { const a = avTarget(); a.skin = d.id; if (figureSkin(d.id)) { for (const k of FIGURE_LOCKS) delete a[k]; toast(SKIN_HINT); } },
  avMood(d) { avTarget().mood = d.id; },
  avBg(d) { avTarget().bg = d.id; },
  avItem(d) { const a = avTarget(), it = St.shopItem(d.id); if (!it || !St.owns(d.id)) return; const k = it.slot || 'frame'; if (FIGURE_LOCKS.includes(k) && figureSkin(a.skin)) return toast(SKIN_HINT); if (a[k] === d.id) delete a[k]; else a[k] = d.id; },
  onbSubj(d) { const s = U.onb.d.subjects, i = s.indexOf(d.id); i >= 0 ? s.splice(i, 1) : s.push(d.id); },
  onbAddSubj() {
    const o = U.onb.d, name = (o.newSubj || '').trim(); if (!name) return toast('Name fürs Fach fehlt'); if (!isClean(name)) return toast(CLEAN_MSG);
    const ex = St.allSubjects().find(x => x.name.toLowerCase() === name.toLowerCase());
    if (ex) { if (!o.subjects.includes(ex.id)) o.subjects.push(ex.id); o.newSubj = ''; return; }
    const id = 'c-' + St.uid(), emoji = ['📘', '📗', '📙', '📕', '🧪', '💡', '🧠', '📐'][S.customSubjects.length % 8];
    S.customSubjects.push({ id, name: name.slice(0, 30), emoji, color: SUBJECT_COLORS[S.customSubjects.length % SUBJECT_COLORS.length] });
    o.subjects.push(id); o.newSubj = ''; St.save(); haptic(10);
  },
  onbGoal(d) { U.onb.d.goalH = +d.h; },
  onbDemo() { U.onb.d.demo = !U.onb.d.demo; },
  async onbFinish() {
    const o = U.onb.d;
    const user = { name: o.username.trim(), username: o.username.toLowerCase(), email: o.email, canton: o.country === 'CH' && o.region ? o.region : o.canton, ...(o.country ? { country: o.country } : {}), ...(o.country && o.country !== 'CH' && o.region ? { region: o.region } : {}), level: o.level, levelText: o.level === 'other' ? (o.levelText || '').trim().slice(0, 40) : '', avatar: { ...o.avatar }, weeklyGoalMin: +o.goalH * 60, created: Date.now(), bio: '', ageBand: o.band, isPrivate: o.band === '13-15' };   // unter 16: Profil von Anfang an privat (Privacy by Default)
    if (BK.enabled) {
      if (!U.authUser) { U.onb.step = 'auth'; return toast('Bitte zuerst anmelden'); }
      try {
        U.onb.busy = true; render();
        if (!(await BK.usernameAvailable(user.username))) { U.onb.busy = false; U.onb.step = 'profile'; return toast(`@${esc(user.username)} ist schon vergeben – wähl einen anderen`); }
        await BK.createProfile(U.authUser.id, user);
        user.id = U.authUser.id;
      } catch (e) { U.onb.busy = false; return toast('⚠️ ' + esc(e.message)); }
      U.onb.busy = false; o.demo = false;
    }
    S.user = user;
    S.subjects = [...o.subjects];
    S.settings.checkinMin = +o.checkinMin;
    S.quiz = { ...o.quiz };
    St.save();
    if (o.demo) St.seedDemo();
    St.checkTrophies();
    U.tab = 'home';
    setTimeout(() => confetti(app), 50);
    toast(`Willkommen bei Brained, ${esc(S.user.name.split(' ')[0])}!`);
    bg(() => Promise.all([BK.pushState(), BK.pushProfileStats()]));
    if (U.pendingJoin) { A.openSheet({ type: 'groupJoin', code: U.pendingJoin }); U.pendingJoin = null; }
    if (U.pendingRoom) { openRoomLink(U.pendingRoom); U.pendingRoom = null; }
  },

  // Shop
  openShop() { U.sheet = null; U.shopSel = null; U.profileJump = 'shop'; U.overlay = 'profile'; },   // Shop liegt im Profil
  shopTab(d) { U.shopTab = d.id; },
  shopOpen(d) { U.shopSel = d.id; setTimeout(() => { const c = $('.content', app); if (c) c.scrollTop = 0; }); },
  shopBack() { U.shopSel = null; },
  async shopBuy(d) {
    const it = St.shopItem(d.id), consumable = SHOP_CONSUMABLES.some(c => c.id === d.id);
    if (BK.enabled) {
      try { await BK.buyItem(d.id); } catch (e) { return toast('⚠️ ' + esc(e.message)); }
      if (consumable) { S.freeze.stock = (S.freeze.stock || 0) + (it.qty || 1); St.save(); }
    } else if (!St.buy(d.id)) return toast(it.pro ? 'Nur mit Brained Pro' : 'Nicht genug Brain-Coins');
    haptic([20, 40, 20]); chime();
    if (!consumable) A.shopEquip(d); // zuerst anziehen: ein gekaufter Effekt spielt gleich selbst ab
    setTimeout(() => confetti(app), 30);
    toast(consumable ? `Streak-Schutz gekauft – du hast jetzt ${S.freeze.stock}` : `${it.name} gehört dir!`);
  },
  shopOpenId(d) { A.openShop(); U.shopTab = 'items'; U.shopSel = d.id; },
  shopCat(d) { U.shopCat = d.id; U.shopSel = null; },
  shopRar(d) { U.shopRar = d.id; },
  shopOnly() { U.shopOnly = U.shopOnly === 'missing' ? '' : 'missing'; },
  // Anprobe: Items am eigenen Brain ausprobieren, auch ungekaufte (ein Item pro Slot)
  shopTry(d) {
    const it = St.shopItem(d.id); if (!it) return; const t = U.tryOn || [];
    if (t.includes(d.id)) { U.tryOn = t.filter(x => x !== d.id); return; }
    const same = x => { const o = St.shopItem(x); return o && ((o.slot && o.slot === it.slot) || (!o.slot && !it.slot && !o.fill === !it.fill)); };
    U.tryOn = [...t.filter(x => !same(x)), d.id];
  },
  shopTryClear() { U.tryOn = []; },
  shopTryWear() { for (const id of U.tryOn || []) if (St.owns(id) && !isOn(St.shopItem(id))) A.shopEquip({ id }); U.tryOn = []; },
  fxPlay(d) { if (!celebrate(d.id, app)) confetti(app, true); },
  lookCat(d) { U.lookCat = d.id; },
  // Tagesgeschenk: XP, Streak-Schutz oder (max. einmal pro Woche) ein günstiger Skin; einmal pro Tag (Schweizer Zeit)
  async shopDaily() {
    const g = St.dailyGift(); if (g.claimed) return toast('Das Tagesgeschenk ist schon geholt');
    if (BK.enabled) { try { await BK.claimDaily(g); } catch (e) { if (!/claim_daily_gift|PGRST202|schema cache/i.test(e.message)) return toast('⚠️ ' + esc(e.message)); } } // Server noch ohne Funktion → lokal verbuchen
    St.applyGift(g); haptic([20, 40, 20]); chime(); setTimeout(() => confetti(app), 30);
    toast(g.kind === 'skin' ? `${g.name} gehört dir – bis morgen!` : g.kind === 'freeze' ? `Streak-Schutz erhalten – du hast jetzt ${S.freeze.stock}` : `+${g.amount} XP – bis morgen!`);
  },
  // Brained Pro
  proPlan(d) { U.proPlan = d.id; },
  async proBuy(d) {
    const plan = U.proPlan || 'yearly', tier = d?.tier === 'group' ? 'group' : 'pro';
    if (!BK.enabled) { S.user.pro = true; St.applyFreeze(); St.save(); U.sheet = { type: 'pro' }; return toast('Demo: Pro aktiv'); }
    U.proBusy = true; render();
    try {
      if (tier === 'group' && (nativeBillingReady() || isNative())) toast('Das Gruppen-Paket buchst du auf der Webseite von Brained.');
      else if (nativeBillingReady()) { await nativePurchase(plan, S.user.id); await waitForPro(); }
      else if (isNative() && platform() === 'ios') toast('Das Abo kommt bald im App Store');
      else { const url = await BK.checkout(plan, tier); if (!/^https:\/\//.test(url)) throw new Error('Ungültige Zahlungsadresse'); location.href = url; return; }
    } catch (e) { if (!/cancel/i.test(e.message)) toast('⚠️ ' + esc(e.message)); }
    U.proBusy = false;
  },
  async proPortal() { try { const u = await BK.billingPortal(); if (!/^https:\/\//.test(u)) throw new Error('Ungültige Adresse'); location.href = u; } catch (e) { toast('⚠️ ' + esc(e.message)); } },
  async proRestore() {
    try { if (nativeBillingReady()) await nativeRestore(S.user.id); await BK.loadPlan(); toast(St.isPro() ? 'Pro ist aktiv' : 'Kein aktives Abo gefunden'); } catch (e) { toast('⚠️ ' + esc(e.message)); }
  },
  // Push-Erinnerungen (Web-Push; auf dem iPhone nur, wenn Brained auf dem Home-Bildschirm ist)
  async togglePush() {
    if (S.settings.push) {
      try { const reg = await navigator.serviceWorker?.getRegistration(); const sub = await reg?.pushManager.getSubscription(); if (sub) { await sub.unsubscribe(); bg(() => BK.deletePushSub(sub.endpoint)); } } catch { }
      S.settings.push = false; St.save(); return toast('Erinnerungen aus');
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return toast(/iPhone|iPad/.test(navigator.userAgent) ? 'Leg Brained zuerst auf den Home-Bildschirm (Teilen → Zum Home-Bildschirm), dann klappt’s.' : 'Dein Browser unterstützt keine Erinnerungen.', null, null, 7000);
    }
    if (!BK.enabled) { S.settings.push = true; St.save(); return toast('Demo: Erinnerungen an'); }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return toast('Mitteilungen sind blockiert – erlaube sie in den Einstellungen.');
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(CONFIG.VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await BK.savePushSub(sub, lang === 'collect' ? 'de' : lang);
      S.settings.push = true; St.save(); toast('Ich erinnere dich am Abend, falls deine Streak in Gefahr ist.');
    } catch (e) { toast('⚠️ ' + esc(e.message)); }
  },
  // Passwort vergessen
  async forgotPw() {
    const email = (U.onb.d.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Gib zuerst oben deine E-Mail ein');
    if (!BK.enabled) return toast('Demo: Link wäre jetzt unterwegs');
    try { await BK.sendPasswordReset(email); toast('Wir haben dir einen Link geschickt. Schau auch im Spam-Ordner.', null, null, 7000); } catch (e) { toast('⚠️ ' + esc(e.message)); }
  },
  async saveNewPw() {
    const pw = U.form.newPw || '';
    if (pw.length < 8) return toast('Mindestens 8 Zeichen');
    try { await BK.updatePassword(pw); U.sheet = null; U.form.newPw = ''; toast('Neues Passwort gespeichert'); } catch (e) { toast('⚠️ ' + esc(e.message)); }
  },
  shopEquip(d) {
    const it = St.shopItem(d.id); if (!it || !St.owns(d.id)) return;
    if (it.slot === 'effect') { if ((S.user.effect || 'e-confetti') === d.id) delete S.user.effect; else S.user.effect = d.id; setEffect(S.user.effect); St.save(); return; }
    const a = { ...normAvatar(S.user.avatar) };
    if (it.slot) { if (FIGURE_LOCKS.includes(it.slot) && figureSkin(a.skin)) return toast(SKIN_HINT); if (a[it.slot] === d.id) delete a[it.slot]; else a[it.slot] = d.id; }
    else if (it.fill) { a.skin = a.skin === d.id ? 'pink' : d.id; if (figureSkin(a.skin)) { for (const k of FIGURE_LOCKS) delete a[k]; toast(SKIN_HINT); } }
    else { if (a.frame === d.id) delete a.frame; else a.frame = d.id; }
    S.user.avatar = a; St.save(); bg(() => BK.updateProfile());
  },

  // Navigation
  tab(d) { if (U.ai?.tool === 'game' && d.id !== 'ai') { GM.quit(); U.ai = { tool: null }; } if (d.id === 'ai' && U.tab === 'ai') { GM.quit(); U.ai = { tool: null }; } U.tab = d.id; U.overlay = null; U.sheet = null; refreshSocial(d.id); },
  openProfile() { U.overlay = 'profile'; },
  profileTrophies() { U.profileJump = 'trophies'; U.overlay = 'profile'; },
  closeOverlay() { U.overlay = null; },
  openPlay() { if (S.timer) { U.sheet = null; U.overlay = 'timer'; } else U.sheet = { type: 'play' }; },
  openTimer() { U.sheet = null; U.overlay = 'timer'; },
  openUser(d) { U.sheet = { type: 'user', id: d.id }; if (BK.enabled && d.id !== S.user?.id) BK.loadPerson(d.id).then(render).catch(() => { }); },
  closeSheet() { if (U.sheetBack) { ({ sheet: U.sheet, form: U.form } = U.sheetBack); U.sheetBack = null; } else U.sheet = null; },
  // «＋ Fächer» in Fach-Auswahlen: Fächer verwalten und danach zum offenen Formular zurück
  moreSubjects() { U.sheetBack = U.sheet ? { sheet: U.sheet, form: U.form } : null; A.openSheet({ type: 'subjects' }); },
  openTrophy() { U.toast = null; A.openSheet({ type: 'trophy', id: U.lastTrophy }); },
  closeModal() { U.modal = null; },
  toast(d) { toast(d.msg); return false; },
  openSheet(d) {
    // Eigene Gruppen je Paket begrenzt (Gratis 2, Pro 3, Gruppe/Max 5); beitreten ist immer gratis
    if (d.type === 'groupCreate' && CONFIG.PRO_ENABLED && S.groups.filter(g => g.owner && g.kind !== 'class').length >= PV.limitsOf().groups) {
      const n = PV.limitsOf().groups, t = St.tier();
      if (t === 'group' || t === 'max_teacher') return toast(`Du hast die Höchstzahl deines Plans erreicht (${n} Gruppen).`);
      U.sheet = { type: 'pro', reason: `Du hast die Höchstzahl deines Plans erreicht (${n} eigene Gruppen). ${t === 'pro' ? 'Mit dem Gruppen-Paket sind es 5 Gruppen mit je bis 50 Personen.' : 'Mit Brained Pro sind es 3 Gruppen, mit dem Gruppen-Paket 5.'} Beitreten ist immer gratis.` }; return;
    }
    if (d.type !== 'subjects') U.sheetBack = null;
    const sub0 = St.mySubjects()[0]?.id;
    const f = {
      subjects: () => ({ newSubj: '', newEmoji: '🧠' }),
      friend: () => ({ q: '' }),
      groupCreate: () => ({ name: '', emoji: '🏫', color: SUBJECT_COLORS[0], goalH: 20 }),
      groupEdit: () => { const g = S.groups.find(x => x.id === d.id); return g ? { name: g.name, emoji: g.emoji, color: g.color, goalH: g.weeklyGoalH || 20 } : {}; },
      editProfile: () => ({ name: S.user.name, bio: S.user.bio || '', canton: S.user.canton, avatar: { ...normAvatar(S.user.avatar) } }),
      cardAdd: () => ({ subjectId: sub0, q: '', a: '' }),
      cardsNotes: () => ({ subjectId: sub0, notes: '', preview: null }),
      groupJoin: () => ({ code: d.code || '' }),
    }[d.type];
    U.form = f ? f() : {};
    U.sheet = { type: d.type, id: d.id, reason: d.reason };
  },

  // Timer
  setupSubj(d) { U.setup.subjectId = d.id; },
  setupMode(d) { U.setup.mode = d.id; },
  setupGoal(d) { U.setup.goalMin = +d.m; },
  startTimer() {
    if (S.timer) return;
    T.start(U.setup.subjectId || St.mySubjects()[0].id, U.setup.mode, U.setup.goalMin);
    pauseOtherMedia(); haptic(30); chime(); bg(() => BK.setLive(S.timer.subjectId));
  },
  pauseTimer() { T.pause('manual'); haptic(); bg(() => BK.setLive(null)); },
  resumeTimer() { T.resume(); pauseOtherMedia(); haptic(); U.toast = null; bg(() => BK.setLive(S.timer?.subjectId)); },
  finishTimer() { U.modal = { type: 'confirmFinish' }; },
  discardTimer() { T.discard(); bg(() => BK.setLive(null)); U.modal = null; U.overlay = null; U.standby = false; T.keepAwake(false); toast('Session verworfen'); },
  finishConfirm() {
    U.modal = null; U.standby = false; T.keepAwake(false);
    const res = T.finish();
    if (!res) { U.overlay = null; return toast('Unter 1 Minute – nicht gespeichert'); }
    const fresh = St.checkTrophies();
    U.summary = { session: res.session, fresh, streakBefore: res.streakBefore, cards: null };
    bg(async () => { await BK.setLive(null); await BK.pushSession(res.session); await BK.pushProfileStats(); BK.flushPush(); });
    U.overlay = 'summary';
    setTimeout(() => confetti(app), 80); chime(); haptic(40);
    const sn = St.streakInfo().current; // Streak-Meilenstein: noch ein Feier-Effekt obendrauf
    if (sn > (res.streakBefore || 0) && [3, 7, 14, 30, 50, 100, 200, 365].includes(sn)) { setTimeout(() => confetti(app), 2200); toast(`🔥 ${sn} Tage Streak!`); }
  },
  // Beim ersten Mal zuerst erklären (normale Helligkeit), erst danach abdunkeln
  async standby() {
    U.standby = true; U.sheet = null;
    await T.keepAwake(true);
    if (!S.settings.focusTipSeen) { S.settings.focusTipSeen = true; St.save(); U.standbyTip = true; render(); return; }
    await A.standbyDim();
  },
  async standbyDim() {
    U.dimmed = await dimNative(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { }
    render();
  },
  standbyTipClose() { U.standbyTip = false; A.standbyDim(); },
  standbyTap() {
    // Doppeltipp (innert 400 ms) beendet den Mond-Modus, ein einzelner Tipp zeigt nur den Hinweis
    const now = Date.now();
    if (now - (U.sbLastTap || 0) < 400) { U.sbLastTap = 0; A.exitStandby(); return; }
    U.sbLastTap = now;
    const h = $('.standby .sb-exit', app); if (h) { h.classList.remove('nudge'); void h.offsetWidth; h.classList.add('nudge'); } return false;
  },
  exitStandby() { U.standby = false; U.standbyTip = false; T.keepAwake(false); dimNative(false); try { if (document.fullscreenElement) document.exitFullscreen(); } catch { } },
  checkinYes() { T.confirmCheckin(); U.modal = null; haptic(); trophyToast(); },
  checkinPause() { T.confirmCheckin(); T.pause('manual'); U.modal = null; },

  // Summary
  summaryDone() { const s = U.summary.session; St.save(); bg(() => BK.pushSession(s)); U.overlay = null; U.summary = null; U.tab = 'home'; refreshSocial('home'); },
  shareStats() {
    const ss = S.sessions, tot = St.totalMin();
    share(`🧠 Meine Stats auf Brained: ${fmtShort(tot)} gelernt · 🔥 ${St.streakInfo().current} Tage Streak · ${ss.length} Sessions · ⚡ ${St.xpTotal()} XP – @brained.study`);
    return false;
  },
  shareSession(d) {
    const s = S.sessions.find(x => x.id === d.id); if (!s) return;
    share(`🧠 ${s.title || 'Lernsession'}: ${fmtShort(s.min)} ${St.subj(s.subjectId).name} gelernt auf Brained! 🔥 ${St.streakInfo().current}-Tage-Streak`);
    return false;
  },
  reactOpen(d) { U.reactOpen = U.reactOpen === d.id ? null : d.id; haptic(8); },
  react(d) {
    const prev = S.boosts[d.id], next = prev === d.e ? null : d.e;
    if (next) S.boosts[d.id] = next; else delete S.boosts[d.id];
    if (next && !prev) S.stats.boosts = (S.stats.boosts || 0) + 1;
    U.reactOpen = null; St.save(); haptic(next ? [10, 30, 10] : 8);
    bg(() => BK.react(d.id.replace(/^f-/, ''), next));
    trophyToast();
    if (next) setTimeout(() => { const b = $(`.react-btn[data-id="${CSS.escape(d.id)}"]`, app); if (b) { const p = document.createElement('span'); p.className = 'react-pop'; p.textContent = next; b.appendChild(p); setTimeout(() => p.remove(), 900); } });
  },

  // Statistik
  async aiInsights() {
    if (!AI.hasKey()) return toast('Die KI-Analyse braucht ein Konto – nutze die lokale Analyse');
    U.aiInsightsBusy = true; render();
    const now = Date.now(), bySubject = {};
    S.sessions.filter(s => s.start > now - 28 * 864e5).forEach(s => { const n = St.subj(s.subjectId).name; bySubject[n] = (bySubject[n] || 0) + s.min; });
    try {
      U.aiInsights = await AI.aiInsights({
        heute: new Date().toISOString(), wochenzielMin: St.weekGoal(), dieseWocheMin: Math.round(St.weekMin()), streak: St.streakInfo(), minutenProFach28Tage: bySubject,
        sessions14Tage: S.sessions.filter(s => s.start > now - 14 * 864e5).map(s => ({ fach: St.subj(s.subjectId).name, start: new Date(s.start).toISOString(), min: s.min, modus: s.mode })),
      });
    } catch (e) { if (e.code === 'pro_required') toast(CONFIG.PRO_ENABLED ? 'Diese Woche hast du die Gratis-Analyse schon genutzt. Die lokale Analyse bleibt für dich da.' : esc(e.message)); else toast('Brainy-Fehler: ' + esc(e.message)); }   // pro_required: freundlicher Hinweis, das Pro-Angebot öffnet der Hook in backend.js
    U.aiInsightsBusy = false;
  },

  // Formulare / Sheets
  formSubj(d) { U.form.subjectId = d.id; },
  formSet(d) { U.form[d.k] = d.v; },
  toggleSubj(d) {
    const i = S.subjects.indexOf(d.id);
    if (i >= 0) { if (S.subjects.length > 1) S.subjects.splice(i, 1); } else S.subjects.push(d.id);
    St.save();
  },
  cycleColor(d) {
    const cur = St.subj(d.id).color, i = SUBJECT_COLORS.indexOf(cur);
    S.subjectColors[d.id] = SUBJECT_COLORS[(i + 1) % SUBJECT_COLORS.length]; St.save();
  },
  addSubj() {
    const name = (U.form.newSubj || '').trim(); if (!name) return toast('Name fürs Fach fehlt'); if (!isClean(name)) return toast(CLEAN_MSG);
    const id = 'c-' + St.uid();
    S.customSubjects.push({ id, name, emoji: U.form.newEmoji || '🧠', color: SUBJECT_COLORS[S.customSubjects.length % SUBJECT_COLORS.length] });
    S.subjects.push(id); U.form.newSubj = ''; St.save(); toast(`«${esc(name)}» hinzugefügt`);
  },
  delSession(d) { S.sessions = S.sessions.filter(s => s.id !== d.id); St.save(); bg(async () => { await BK.deleteSession(d.id); await BK.pushProfileStats(); }); U.sheet = null; toast('Session gelöscht'); },
  async toggleFriend(d) {
    const on = !S.friends.includes(d.id) && !BK.R.requested.includes(d.id); // Folgen – oder Folgen/Anfrage zurückziehen
    if (BK.enabled) {
      try { const r = await BK.follow(d.id, on); if (r === 'requested') toast('Anfrage gesendet – sobald sie angenommen wird, folgst du.'); }
      catch (e) { return toast('⚠️ ' + esc(e.message)); }
    }
    else if (on) S.friends.push(d.id); else S.friends.splice(S.friends.indexOf(d.id), 1);
    if (on) haptic();
    St.save(); trophyToast();
    // Home & «Folge ich» sofort aktualisieren
    if (BK.enabled) BK.loadFriendsToday().then(() => { if (U.sheet?.type === 'following') BK.R.following = BK.R.friendsToday.concat((BK.R.following || []).filter(u => !BK.R.friendsToday.some(x => x.id === u.id))); render(); }).catch(() => { });
    else if (U.sheet?.type === 'following') render();
    const list = $('[data-live="friendList"]', app); if (list) INPUT.friendSearch($('[data-bind="form.q"]', app));
  },
  reportUser(d) { U.modal = { type: 'report', id: d.id }; },
  async reportSend(d) {
    const reason = ($('[data-bind="form.reason"]', app)?.value || '').trim() || 'Ohne Angabe';
    U.modal = null;
    if (BK.enabled) { try { await BK.report(d.id, reason); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    toast('Danke! Wir prüfen die Meldung innert 24 Stunden.');
  },
  openFollowing() {
    U.sheet = { type: 'following' };
    if (BK.enabled) BK.loadFriendsToday().then(() => { BK.R.following = BK.R.friendsToday; render(); }).catch(e => toast('⚠️ ' + esc(e.message)));
    else BK.R.following = St.friendsToday();
  },
  openRequests() { U.sheet = { type: 'requests' }; if (BK.enabled) BK.loadRequests().then(render).catch(e => toast('⚠️ ' + esc(e.message))); else BK.R.requests = BK.R.requests || []; },
  async answerRequest(d) {
    const accept = d.k === '1';
    if (BK.enabled) { try { await BK.respondRequest(d.id, accept); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    else BK.R.requests = (BK.R.requests || []).filter(r => r.id !== d.id);
    if (accept) haptic();
    toast(accept ? 'Angenommen – diese Person sieht jetzt deine Sessions.' : 'Anfrage abgelehnt');
  },
  toggleFollowMode() {
    if (S.user.ageBand === '13-15') return toast('Unter 16 bleibt dein Profil privat. Folgen geht nur mit deiner Zustimmung.');
    S.user.followRequests = S.user.followRequests === false;
    St.save(); bg(() => BK.updateProfile());
    toast(S.user.followRequests ? 'Neue Follower brauchen jetzt deine Zustimmung' : 'Öffentlich – alle können dir direkt folgen');
  },
  openBlocked() { U.sheet = { type: 'blocked' }; if (BK.enabled) BK.loadBlocks().then(render).catch(e => toast('⚠️ ' + esc(e.message))); else BK.R.blocked = (S.blockedDemo || []).map(id => St.person(id)).filter(Boolean); },
  async unblockUser(d) {
    if (BK.enabled) { try { await BK.unblock(d.id); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    else { S.blockedDemo = (S.blockedDemo || []).filter(x => x !== d.id); BK.R.blocked = (BK.R.blocked || []).filter(r => r.id !== d.id); St.save(); }
    toast('Blockierung aufgehoben');
  },
  async blockUser(d) {
    if (BK.enabled) { try { await BK.block(d.id); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    else { S.friends = S.friends.filter(x => x !== d.id); S.blockedDemo = [...new Set([...(S.blockedDemo || []), d.id])]; }
    U.sheet = null; St.save(); toast('Person blockiert – rückgängig machen unter Profil → Blockierte Personen.'); refreshSocial(U.tab);
  },
  inviteApp() { share(`Lern mit mir auf Brained 🧠🔥 Such mich in der App: @${S.user.username}`); return false; },
  async saveGroup() {
    const f = U.form; if (!f.name.trim()) return toast('Name der Gruppe fehlt'); { const bm = badMsg(f.name, { links: true }); if (bm) return toast(bm); }
    let g;
    if (BK.enabled) { try { g = await BK.createGroup(f.name.trim(), f.emoji, f.color); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    else g = St.createGroup(f.name.trim(), f.emoji, f.color);
    const gh = Math.min(1000, Math.max(1, Math.round(+f.goalH) || 20));
    if (g && gh !== (g.weeklyGoalH || 20)) { try { if (BK.enabled) await BK.updateGroup(g.id, { name: g.name, emoji: g.emoji, color: g.color, weeklyGoalH: gh }); else St.updateGroup(g.id, { weeklyGoalH: gh }); g = S.groups.find(x => x.id === g.id) || g; } catch { } }
    U.rankScope = 'group'; U.rankGroup = g.id; U.tab = 'rank';
    U.sheet = { type: 'invite', id: g.id };
    trophyToast();
  },
  async saveGroupEdit(d) {
    const f = U.form, g = S.groups.find(x => x.id === d.id); if (!g?.owner) return;
    if (!f.name.trim()) return toast('Name der Gruppe fehlt'); { const bm = badMsg(f.name, { links: true }); if (bm) return toast(bm); }
    const patch = { name: f.name.trim(), emoji: f.emoji, color: f.color, weeklyGoalH: Math.min(1000, Math.max(1, Math.round(+f.goalH) || 20)) };
    try { if (BK.enabled) await BK.updateGroup(g.id, patch); else St.updateGroup(g.id, patch); } catch (e) { return toast('⚠️ ' + esc(e.message)); }
    U.sheet = null; toast('Gruppe gespeichert'); refreshSocial?.('rank');
  },
  async joinGroup(d) {
    let r;
    // Klassengruppe: Sichtbarkeits-Hinweis VOR dem Beitritt (Vorschau per Code). Schlägt die Vorschau fehl (z. B. Server noch ohne group_preview), gilt das alte Verhalten (Hinweis nach dem Beitritt).
    const pvHook = U.groupPreviewHook || (BK.enabled && BK.groupPreview);
    if (CONFIG.PRO_ENABLED && pvHook && !d?.confirmed) {
      let pv = null; try { pv = await pvHook(U.form.code || ''); } catch { }
      if (pv && !pv.error && pv.kind === 'class' && !pv.is_member) { U.sheet = { type: 'classConfirm', code: U.form.code || '', name: pv.name, emoji: pv.emoji, owner: pv.owner_name }; return; }
    }
    if (d?.confirmed && d.code) U.form = { ...U.form, code: d.code };
    if (BK.enabled) { try { r = { group: await BK.joinGroup(U.form.code || '') }; } catch (e) { r = { error: e.message }; } }
    else r = St.joinGroup(U.form.code || '');
    if (r.error) { if (d?.confirmed) { U.sheet = { type: 'groupJoin' }; U.form = { code: d.code || '', err: r.error }; } else U.form.err = r.error; return; }
    U.sheet = CONFIG.PRO_ENABLED && r.group.kind === 'class' ? { type: 'classNotice', id: r.group.id } : null; U.rankScope = 'group'; U.rankGroup = r.group.id; U.tab = 'rank';   // Klassengruppe: Hinweis «Lernzeit für die Lehrperson sichtbar» mit Austritt
    toast(`${esc(r.group.emoji)} Willkommen in «${esc(r.group.name)}»!`); trophyToast(); refreshSocial('rank', true);
  },
  async leaveGroup(d) {
    const g = S.groups.find(x => x.id === d.id);
    if (BK.enabled) { try { await BK.leaveGroup(g); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    else St.leaveGroup(d.id);
    U.sheet = null; U.rankGroup = null; refreshSocial('rank', true);
    toast(g?.owner ? `Gruppe «${esc(g.name)}» gelöscht` : `Du hast «${esc(g?.name)}» verlassen`);
  },
  async copyLink(d) { const l = St.inviteLink(d.id); try { await navigator.clipboard.writeText(l); toast('Einladungslink kopiert'); } catch { toast(l); } return false; },
  async copyCode(d) { try { await navigator.clipboard.writeText(d.id); toast('Code kopiert'); } catch { toast('Code: ' + d.id); } return false; },
  shareGroup(d) { const g = S.groups.find(g => g.id === d.id); share(`Komm in meine Lerngruppe «${g.name}» auf Brained 🧠 Code: ${g.code} – ${St.inviteLink(g.code)}`); return false; },
  saveProfile() {
    const f = U.form; if (f.name.trim().length < 2) return toast('Name zu kurz'); { const bm = badMsg([f.name, f.bio], { links: true }); if (bm) return toast(bm); }
    Object.assign(S.user, { name: f.name.trim(), bio: (f.bio || '').slice(0, 80), canton: f.canton, avatar: { ...f.avatar } }); St.save(); U.sheet = null; toast('Profil gespeichert');
    bg(() => BK.updateProfile());
  },
  saveCard() {
    const f = U.form; if (!f.q.trim() || !f.a.trim()) return toast('Frage und Antwort ausfüllen');
    { const bm = badMsg([f.q, f.a], { learning: true }); if (bm) return toast(bm); }
    St.addCards([{ q: f.q.trim(), a: f.a.trim() }], f.subjectId); U.sheet = null; toast('🃏 Karte gespeichert');
  },

  // Rangliste
  rankScope(d) { U.rankScope = d.id; refreshSocial('rank'); },
  rankPeriod(d) { U.rankPeriod = d.id; refreshSocial('rank'); },
  rankGroup(d) { U.rankGroup = d.id; refreshSocial('rank'); },

  // Brainy
  aiTool(d) {
    const sub0 = St.mySubjects()[0]?.id;
    U.tab = 'ai'; U.overlay = null;
    U.ai = {
      clarity: (U.clarity = clarityInit(true)),   // frischer Lessons-Zustand beim Betreten
      cards: { tool: 'cards', queue: null },
    }[d.id] || { tool: null };
  },
  aiBack() { if (U.ai.tool === 'game') { GM.quit(); U.ai = { tool: 'cards', queue: null }; return; } U.ai = { tool: null }; },
  // Karten aus Notizen
  async notesMake() {
    const f = U.form;
    if (!f.upload && (f.notes || '').trim().length < 20) return toast('Lade ein Dokument hoch oder füg etwas Text ein');
    f.busy = true; render();
    try {
      let text = (f.notes || '').trim(), images = [];
      if (f.upload?.type === 'application/pdf') {
        const { readPdf } = await import('./pdf.js'); const pdf = await readPdf(f.upload.data);
        text = [text, pdf.text.replace(/--- Seite \d+ ---/g, '').trim()].filter(Boolean).join('\n\n'); images = pdf.images;
        if (!text && !images.length) throw new Error('Im PDF wurde kein lesbarer Inhalt gefunden');
      } else if (f.upload) images = [{ type: f.upload.type, data: f.upload.data }];
      f.preview = await AI.recapCards(text, St.subj(f.subjectId).name, images);
      if (!f.preview.length) toast('Keine Karten gefunden – versuch ein anderes Dokument');
    } catch (e) { if (e.code === 'pro_required' && CONFIG.PRO_ENABLED) toast('Deine 5 KI-Anfragen für diese Woche sind aufgebraucht. Karten kannst du weiter von Hand erstellen.'); else toast('Brainy-Fehler: ' + esc(e.message)); }
    f.busy = false;
  },
  notesFileClear(d, el, e) { e.preventDefault(); U.form.upload = null; },
  notesSave() { const f = U.form; St.addCards(f.preview, f.subjectId, 'notes'); U.sheet = null; toast(`🃏 ${f.preview.length} Karten gespeichert`); trophyToast(); },
  // Feed & Schnellstart
  toggleFeed() { U.feedOpen = !U.feedOpen; },
  quickStart(d) {
    if (S.timer) { U.overlay = 'timer'; return; }
    T.start(d.id, d.mode || 'free', +d.goal || 25);
    U.overlay = 'timer'; haptic(30); chime();
  },
  aiSubj(d) { U.ai.subjectId = d.id; },
  cardsStart() { const ids = St.dueCards().map(c => c.id).sort(() => Math.random() - .5); U.ai = { tool: 'cards', queue: ids, i: 0, flipped: false }; },
  cardFlip() { U.ai.flipped = !U.ai.flipped; haptic(8); },
  cardRate(d) { const a = U.ai; St.reviewCard(a.queue[a.i], d.k === '1'); a.i++; a.flipped = false; if (a.i >= a.queue.length) { confetti(app); trophyToast(); } },
  delCard(d) { S.flashcards = S.flashcards.filter(c => c.id !== d.id); St.save(); },

  // Profil
  toggleDark() { const dark = document.documentElement.dataset.theme === 'dark'; S.settings.theme = dark ? 'light' : 'dark'; St.save(); applyTheme(); },
  togglePause() { S.settings.pauseOnLeave = !S.settings.pauseOnLeave; St.save(); if (!S.settings.pauseOnLeave) toast('⚠️ Ohne Auto-Pause zählt deine Zeit nicht für die Rangliste'); },
  togglePro() { S.user.pro = !S.user.pro; St.save(); toast(S.user.pro ? 'Demo: Pro aktiv – keine Werbung mehr' : 'Pro deaktiviert'); },
  reseed() {
    Object.assign(S, { sessions: [], planned: [], flashcards: [], challenges: [], trophies: {}, joinedChallenges: {} });
    St.seedDemo(); U.overlay = null; U.tab = 'home'; toast('Demo-Daten geladen');
  },
  logout() { U.modal = { type: 'info', emoji: '🚪', title: 'Abmelden?', text: BK.enabled ? 'Deine Daten bleiben in deinem Konto gespeichert. Auf diesem Gerät werden sie entfernt.' : 'Im Demo-Modus werden dabei alle lokalen Daten gelöscht.', cta: 'Abmelden', action: 'logoutConfirm', secondary: 'Abbrechen', secondaryAction: 'closeModal' }; },
  async logoutConfirm() { if (BK.enabled) { await BK.pushState().catch(() => { }); await BK.signOut(); } St.resetAll(); },
  deleteAccount() { U.modal = { type: 'info', emoji: '⚠️', title: 'Konto endgültig löschen?', text: 'Alle deine Sessions, Trophäen, Gruppen (als Besitzer:in) und Daten werden unwiderruflich gelöscht. Das kann nicht rückgängig gemacht werden.', cta: 'Ja, Konto löschen', action: 'deleteAccountConfirm', secondary: 'Abbrechen', secondaryAction: 'closeModal' }; },
  async deleteAccountConfirm() {
    U.modal = null;
    if (BK.enabled) { try { toast('Konto wird gelöscht…'); await BK.deleteAccount(); } catch (e) { return toast('⚠️ ' + esc(e.message)); } }
    St.resetAll();
  },
  openLegal(d) { U.sheet = { type: 'legal', id: d.id }; },
};

// Karteikarten-Spiele (Logik in games.js)
GM.init({ render: () => render(), haptic, confetti: () => confetti(app), toast, trophyToast });
Object.assign(A, {
  gameOpen(d) { GM.start(d.id); U.ai = { tool: 'game' }; U.sheet = null; },
  gameAgain() { GM.actions.gameAgain(); },
  gameQuit() { GM.quit(); U.ai = { tool: 'cards', queue: null }; },
  gameJump: GM.actions.gameJump, gameMatch: GM.actions.gameMatch, gameSprint: GM.actions.gameSprint,
});

// change/input-Handler (ohne Neu-Rendern, damit Fokus bleibt)
const CHANGE = {
  shopSort(el) { U.shopSort = el.value; render(); },
  notesFile(el) {
    const f = el.files?.[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('Datei zu gross (max. 8 MB)');
    if (!/^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(f.type)) return toast('Bitte ein Foto (JPG/PNG) oder PDF wählen');
    const r = new FileReader();
    r.onload = () => { U.form.upload = { name: f.name, type: f.type, size: f.size, data: String(r.result).split(',')[1] }; U.form.preview = null; render(); };
    r.readAsDataURL(f);
  },
  rankCanton(el) { U.rankCanton = el.value; render(); refreshSocial('rank'); },
  setCheckin(el) {
    S.settings.checkinMin = +el.value;
    if (S.timer) S.timer.nextCheckinAcc = T.elapsed() + S.settings.checkinMin * 60000;
    St.save();
  },
};
// Mond-Modus: 0.9 s gedrückt halten zum Verlassen (verhindert versehentliches Beenden)
let holdT = null;
const holdEnd = () => { clearTimeout(holdT); holdT = null; $('.standby', app)?.classList.remove('holding'); };
app.addEventListener('pointerdown', e => {
  if (!U.standby || U.standbyTip || !e.target.closest('.standby')) return;
  $('.standby', app)?.classList.add('holding');
  holdT = setTimeout(() => { holdEnd(); haptic(20); A.exitStandby(); render(); }, 900);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => app.addEventListener(ev, () => { if (holdT) holdEnd(); }));
let searchTimer;
const INPUT = {
  friendSearch(el) {
    if (BK.enabled) {
      clearTimeout(searchTimer); syncBinds();
      const q = el.value.trim();
      searchTimer = setTimeout(async () => {
        const box = $('[data-live="friendList"]', app); if (!box) return;
        if (q.length < 2) { box.innerHTML = '<div class="empty small">Gib mind. 2 Zeichen ein (Name oder @benutzername)</div>'; return; }
        try { box.innerHTML = friendRows(await BK.search(q)); } catch (e) { box.innerHTML = `<div class="empty small">${esc(e.message)}</div>`; }
      }, 300);
      return;
    }
    const q = el.value.toLowerCase().replace(/^@/, '');
    const res = St.leaderboard({ scope: 'global', period: 'week' }).filter(u => !u.isMe && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q))).slice(0, 12);
    $('[data-live="friendList"]').innerHTML = friendRows(res); syncBinds();
  },
};

// Brained Clarity
Object.assign(A, clarityActions({ render, toast, haptic, chime, confetti, app }));
Object.assign(CHANGE, clarityChange({ render, toast, haptic, chime, confetti, app }));
const hooks = { render, toast, haptic, chime, confetti, app };
Object.assign(A, roomActions(hooks), playActions(hooks), profileActions(hooks), rankActions(hooks), PV.proActions(hooks));
Object.assign(CHANGE, roomChange(hooks), playChange(hooks), profileChange(hooks), rankChange(hooks));
Object.assign(INPUT, playInput(hooks));
window.addEventListener('brained:rerender', () => render());

app.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.dataset.self && e.target !== el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  syncBinds();
  const r = fn(el.dataset, el, e);
  if (r === false) return;
  render();
  if (r instanceof Promise) { await r; render(); }
});
app.addEventListener('change', e => { const el = e.target.closest('[data-a-change]'); if (el) CHANGE[el.dataset.aChange]?.(el); else if (e.target.dataset.bind) syncBinds(); });
app.addEventListener('input', e => { const el = e.target.closest('[data-a-input]'); if (el) INPUT[el.dataset.aInput]?.(el); });

/* ---------------- Live-Loop ---------------- */
let lastShift = 0;
function liveUpdate() {
  const L = timerLive(); if (!L) return;
  $$('[data-live="clock"]', app).forEach(el => el.textContent = L.clock);
  $$('[data-live="tabclock"]', app).forEach(el => el.textContent = L.clock);
  $$('[data-live="sub"]', app).forEach(el => el.textContent = L.sub);
  const ringEl = $('[data-live="ring"]', app); if (ringEl) ringEl.setAttribute('stroke-dashoffset', ringEl.dataset.c * (1 - L.pct));
  const nc = $('[data-live="nextcheck"]', app); if (nc && L.nextCheck !== null) nc.textContent = fmtShort(L.nextCheck / 60000);
  const cl = $('[data-live="checkinLeft"]', app); if (cl && S.timer?.checkin) cl.textContent = fmtClock(Math.max(0, 5 * 60000 - (Date.now() - S.timer.checkin.since)));
  const sa = $('[data-live="sbArc"]', app); if (sa) sa.setAttribute('stroke-dashoffset', sa.dataset.c * (1 - L.pct));
  // Einbrennschutz: Inhalt wandert jede Minute ein wenig
  if (U.standby && Date.now() - lastShift > 60000) { lastShift = Date.now(); const c = $('.standby .sb-center', app); if (c) c.style.transform = `translate(${Math.random() * 30 - 15}px, ${Math.random() * 50 - 25}px)`; }
}
setInterval(() => {
  if (!S.user) return;
  roomTick();
  if (!S.timer) return;
  const ev = T.tick();
  if (ev.length) {
    if (ev.includes('checkin')) { U.modal = { type: 'checkin' }; chime(); haptic([60, 80, 60]); }
    if (ev.includes('checkin-timeout')) { U.modal = null; toast('Pausiert: kein Check-in. Die Zeit seit der Frage wurde nicht gezählt.', 'resumeTimer', 'Weiter', 8000); }
    if (ev.includes('pomo-break')) { chime(); haptic(80); toast(`Pomodoro geschafft! ${S.timer.pomo.count % 4 === 0 ? 15 : 5} min Pause.`, 'resumeTimer', 'Überspringen'); }
    if (ev.includes('pomo-resume')) { chime(); toast('Pause vorbei – weiter geht\'s!'); }
    if (ev.includes('goal')) { chime(); confetti(app); toast('Zielzeit erreicht! Du kannst weitermachen oder beenden.'); }
    render();
  }
  liveUpdate();
}, 1000);

// App verlassen = Pause (Fair-Play). Im Fokus-Modus bleibt der Bildschirm an, also kein "hidden".
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (S.timer?.segStart && S.settings.pauseOnLeave) { T.pause('left'); U.leftWhileRunning = true; }
    St.save(); BK.flushPush();
  } else {
    if (U.leftWhileRunning) { U.leftWhileRunning = false; U.standby = false; toast('Timer pausiert – du hast Brained verlassen.', 'resumeTimer', 'Weiter', 8000); }
    else render();
    if (U.standby) T.keepAwake(true);
  }
});
window.addEventListener('pagehide', () => { St.save(); BK.flushPush(); });

/* ---------------- Start ---------------- */
// Android-Zurück-Taste: schliesst das Oberste; false = nichts mehr offen → App minimieren
function goBack() {
  if (U.modal) { U.modal = null; }
  else if (U.sheet) { U.sheet = null; }
  else if (U.standby) { A.exitStandby(); }
  else if (U.overlay) { U.overlay = null; }
  else if (U.tab === 'ai' && U.ai.tool) { U.ai = { tool: null }; }
  else if (S.user && U.tab !== 'home') { U.tab = 'home'; }
  else return false;
  render(); return true;
}
// Showcase: fertiger Demo-Account auf einem bestimmten Screen (für Website & Store-Screenshots)
function showcase(screen) {
  if (!S.user || S.user.username !== 'leameier') {
    localStorage.removeItem('brained.showcase');
    Object.assign(S, { sessions: [], planned: [], flashcards: [], challenges: [], trophies: {}, joinedChallenges: {}, groups: [], friends: [], exams: [] });
    S.user = { name: 'Lea Meier', username: 'leameier', canton: 'ZH', level: 'gym', avatar: { skin: 'pink', mood: 'grin', bg: 'ffd5dc', hat: 'crown', mouth: 'diamondgrill', frame: 'f-gold' }, weeklyGoalMin: 600, created: Date.now(), bio: 'Matur 2027 🎓' };
    S.subjects = ['mathe', 'deutsch', 'franz', 'englisch', 'bio', 'chemie'];
    St.seedDemo();
    S.exams = [{ id: 'x1', ts: Date.now() - 864e5, typeId: 'matura', subjectId: 'mathe', title: 'Matura Mathematik', grade: 5.4, pct: .88, earned: 22, max: 25 }];
    // heute schon gelernt (sieht im Showcase lebendiger aus)
    const t0 = St.startOfDay(Date.now());
    [[8.2, 52, 'mathe', 'Morgen-Session Mathematik', 'Endlich Integrale verstanden 🙌'], [10.5, 35, 'franz', 'Voci-Sprint Französisch', '']].forEach(([h, min, subjectId, title, note], i) => {
      const start = t0 + h * 3600e3;
      S.sessions.push({ id: 'today' + i, subjectId, start, end: start + min * 60e3, min, mode: 'pomo', segments: [[start, start + 25 * 60e3], [start + 30 * 60e3, start + (min + 5) * 60e3]], pomos: 2, checkins: 1, xp: min + 10, title, note });
    });
    S.stats.examBest = 5.4; St.checkTrophies();
  }
  if (screen !== 'timer') S.timer = null;
  U.toast = null;
  const map = { game: ['ai'], home: ['home'], stats: ['stats'], trophies: ['home'], calendar: ['stats'], rank: ['rank'], ai: ['ai'], clarity: ['ai'], profile: ['home'] };
  const [tab] = map[screen] || ['home'];
  U.tab = tab;
  if (screen === 'clarity') A.aiTool({ id: 'clarity' });
  if (screen === 'game') { S.flashcards = []; A.gameOpen({ id: 'jump' }); setTimeout(() => { const T = GM.state()?.engine?.test; if (T) { T.start(); setTimeout(() => T.toCard(), 500); } }, 300); }
  if (screen === 'profile') U.overlay = 'profile';
  if (screen === 'trophies') { U.overlay = 'profile'; U.profileJump = 'trophies'; }
  if (screen === 'timer') { if (!S.timer) { T.start('mathe', 'pomo'); } S.timer.acc = 17 * 60e3 + 42e3; S.timer.pomo.focusStartAcc = 0; S.settings.checkinMin = 60; S.timer.nextCheckinAcc = 60 * 60e3; U.overlay = 'timer'; }
  if (screen === 'rank') { U.rankScope = 'global'; }
  if (screen === 'shop') { U.overlay = 'profile'; U.profileJump = 'shop'; U.shopTab = 'brains'; S.shop = { owned: ['crown', 'diamondgrill', 'f-gold'], spent: 0 }; }
  if (screen === 'feed') { U.feedOpen = true; const f = St.feed().find(x => !x.own); if (f) U.reactOpen = f.id; }
  if (screen === 'welcome' || screen === 'quiz') { S.user = null; U.onb.step = screen === 'welcome' ? 'intro' : 'level'; if (screen === 'quiz') U.onb.d.quiz = { level: 'gym' }; }
}
const openRoomLink = code => { A.playOpen(); Object.assign(U.play, { view: 'code', code }); };
function boot() {
  applyTheme();
  if (CONFIG_SHOWCASE) { showcase(CONFIG_SHOWCASE); render(); return; }
  initNative({ onBack: goBack, dark: matchMedia('(prefers-color-scheme: dark)').matches });
  if (S.user) { St.checkTrophies(); freezeCheck(); if (!BK.enabled) proLookCheck(); } // migriert & aktualisiert Trophäen-Zähler
  // Rückkehr von Stripe Checkout (?pro=success|cancel)
  const proRet = new URLSearchParams(location.search).get('pro');
  if (proRet) { U.proReturn = proRet; history.replaceState(null, '', location.pathname); if (proRet === 'cancel') setTimeout(() => toast('Kauf abgebrochen – kein Problem.'), 400); }
  const recovered = T.recover();
  roomInit(hooks);
  render();
  const splash = document.createElement('div');   // Intro beim Öffnen: Logo auf dem App-Hintergrund (im Testmodus ohne)
  splash.className = 'splash';
  splash.innerHTML = `<div class="splash-inner"><div class="logo-mark">${brainSVG({ size: 222 })}</div><div class="splash-txt"><div class="wordmark">Brained</div><div class="tag">Deine Lern-App</div><div class="dots"><i></i><i></i><i></i></div></div></div>`;
  if (!location.search.includes('test')) { $('#phone').appendChild(splash); setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 600); }, 1700); }
  if (recovered) setTimeout(() => toast('Deine Session wurde pausiert, als Brained geschlossen war.', 'openTimer', 'Öffnen', 8000), 1900);
  if (S.timer?.checkin) U.modal = { type: 'checkin' };
  // Einladungslink ?join=CODE → Beitritts-Sheet (nach dem Onboarding, falls nötig)
  const join = St.normCode(new URLSearchParams(location.search).get('join'));
  if (join) {
    history.replaceState(null, '', location.pathname + (location.search.includes('test') ? '?test' : ''));
    if (S.user) { A.openSheet({ type: 'groupJoin', code: join }); render(); } else U.pendingJoin = join;
  }
  // Raum-Link ?room=CODE → Play-Menü mit eingetragenem Code (nach dem Onboarding, falls nötig)
  const roomCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (roomCode) {
    history.replaceState(null, '', location.pathname + (location.search.includes('test') ? '?test' : ''));
    if (S.user) { openRoomLink(roomCode); render(); } else U.pendingRoom = roomCode;
  }
  // Echtes Backend: Sitzung wiederherstellen bzw. auf Login warten
  if (BK.enabled) {
    if (S.user && !S.user.id) { S.user = null; render(); } // lokale Demo-Daten gehören zu keinem Konto
    BK.init(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { U.sheet = { type: 'newPassword' }; U.form = { newPw: '' }; render(); return; }
      if (event === 'SIGNED_IN' && !S.user) await afterLogin(session.user);
    })
      .then(async session => {
        if (session && !S.user) return afterLogin(session.user);
        if (S.user && !session) { S.user = null; U.onb.step = 'auth'; return render(); } // abgemeldet/abgelaufen
        if (S.user) {
          refreshSocial(U.tab); bg(() => BK.pushProfileStats());
          Promise.all([BK.loadPlan(), BK.loadShop()]).then(() => { freezeCheck(); proLookCheck(); render(); if (U.proReturn === 'success') { U.proReturn = null; waitForPro(); } }).catch(() => { });
        }
      })
      .catch(e => toast('⚠️ Server nicht erreichbar: ' + esc(e.message), null, null, 8000));
  }
}
boot();
window.__booted = true;

// Test-Hook (nur mit ?test im URL UND nur lokal/DEV, nie in Produktion): gibt der Test-Suite Zugriff auf Zustand & Aktionen.
if (DEV && ['test', 'livetest'].some(k => new URLSearchParams(location.search).has(k))) window.__brained = { S, U, St, T, AI, A, BK, GM, CONFIG, render, PV, RB };
