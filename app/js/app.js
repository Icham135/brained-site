// Brained – App-Controller: Rendering, Aktionen, Live-Loop.
import * as St from './store.js';
import * as T from './timer.js';
import * as AI from './ai.js';
import * as GM from './games.js';
import { startVoice, stopVoice, listening } from './voice.js';
import { renderApp, timerLive, friendRows, examTypeOf, examScore, QUIZ, ONB_STEPS, LOAD_ITEMS } from './views.js';
import { setLang, translateDOM, t, lang } from './i18n.js';
import { U } from './view-state.js';
import { brainSVG, confetti, haptic, chime, fmtShort, fmtClock, normAvatar } from './ui.js';
import { SHOP_CONSUMABLES, BRAIN_SKINS, BRAIN_MOODS, AVATAR_BGS, SUBJECT_COLORS, GLOBAL_CHALLENGES } from './data.js';
import * as BK from './backend.js';
import { initNative, setStatusBar, dimNative, platform, isNative, nativeBillingReady, nativePurchase, nativeRestore } from './native.js';
import { CONFIG } from './config.js';
import morphdom from './vendor/morphdom.js';
import { normalizeExam, SAMPLE_EXAM } from './examdoc.js';
import { examById, examsIn, cantonsWithData } from './examdb.js';
import { examByKey } from './examcatalog.js';
import { isClean, CLEAN_MSG } from './moderation.js';
import { SHOWCASE as CONFIG_SHOWCASE } from './config.js';

const S = St.S;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');

/* ---------------- Rendering ---------------- */
function getPath(path) { return path.split('.').reduce((o, k) => o?.[k], U); }
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
  const nt = $$('.tiles .tile', tmp);
  $$('.tiles .tile', app).forEach((t, i) => { t.classList.toggle('on', !!nt[i]?.classList.contains('on')); t.style.animation = 'none'; });
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
  const main = JSON.stringify([U.tab, U.overlay?.type ?? U.overlay ?? null, U.onb?.step ?? null, !!U.standby, S.user ? 1 : 0,
    U.tab === 'ai' ? [U.ai?.tool ?? null, U.ai?.phase ?? null, U.ai?.i ?? null, U.ai?.planId ?? null] : null, U.tab === 'stats' ? U.statsSeg : null]);
  const sheet = JSON.stringify([U.sheet?.type ?? null, U.sheet?.id ?? null, U.modal?.type ?? null]);
  const same = main === lastMain && sheet === lastSheet;
  const tpl = document.createElement('div');
  tpl.innerHTML = renderApp();
  translateDOM(tpl);
  const active = document.activeElement;
  morphdom(app, tpl, {
    childrenOnly: true,
    onBeforeElUpdated(from, to) {
      if (from.tagName === 'CANVAS') return false;                      // Spiele zeichnen selbst
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
function applyTheme() {
  const t = S.settings.theme;
  setStatusBar(t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches));
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
let toastTimer;
function toast(html, action, label, ms) {
  U.toast = { html, action, label };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { U.toast = null; const el = $('.toast', app); if (el) el.remove(); }, ms || (action ? 6000 : 3200));
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
const bg = fn => { if (!BK.enabled || !S.user?.id) return; Promise.resolve().then(fn).catch(e => toast('⚠️ ' + e.message)); };
St.hooks.onSave = () => BK.schedulePush();
BK.hooks.onPaywall = reason => { if (!CONFIG.PRO_ENABLED) return; U.sheet = { type: 'pro', reason }; render(); };
// Nach einem Kauf meldet der Zahlungsanbieter den Status per Webhook – kurz nachfragen, bis er da ist
async function waitForPro() {
  for (let i = 0; i < 10; i++) { await BK.loadPlan().catch(() => { }); if (St.isPro()) break; await new Promise(r => setTimeout(r, 1500)); }
  if (St.isPro()) { St.applyFreeze(); U.sheet = { type: 'pro' }; setTimeout(() => confetti(app), 50); toast('Willkommen bei Brained Pro!'); } else toast('Zahlung erhalten – Pro wird in wenigen Minuten aktiv.');
  render();
}
function freezeCheck() { if (St.applyFreeze()) setTimeout(() => toast('Streak-Schutz eingesetzt – deine Streak lebt weiter!', null, null, 6000), 2000); }
// Soziale Daten nachladen und danach neu zeichnen
async function refreshSocial(what) {
  if (!BK.enabled || !S.user?.id) return;
  try {
    const jobs = [];
    if (what === 'home') jobs.push(BK.loadFeed(), BK.loadFriendsToday(), BK.loadRequests());
    if (what === 'rank') {
      jobs.push(BK.loadGroups().then(() => {
        const groupId = U.rankScope === 'group' ? (S.groups.some(g => g.id === U.rankGroup) ? U.rankGroup : S.groups[0]?.id) : null;
        if (U.rankScope === 'group' && !groupId) return;
        return BK.loadLeaderboard({ scope: U.rankScope, period: U.rankPeriod, groupId, canton: U.rankCanton });
      }));
    }
    await Promise.all(jobs);
    render();
  } catch (e) { toast('⚠️ ' + e.message); }
}
// Nach erfolgreichem Login (Google, Apple, E-Mail-Code)
async function afterLogin(user) {
  if (!user) return;
  try {
    const profile = await BK.fetchProfile(user.id);
    if (profile) {
      S.user = BK.profileToUser(profile, user.email);
      await BK.pullAll(user.id);
      if (S.settings.lang && S.settings.lang !== lang) await setLang(S.settings.lang);
      St.save(); St.checkTrophies(); freezeCheck();
      U.tab = 'home'; U.sheet = null; render(); refreshSocial('home');
      if (U.proReturn === 'success') { U.proReturn = null; waitForPro(); }
      if (U.pendingJoin) { A.openSheet({ type: 'groupJoin', code: U.pendingJoin }); U.pendingJoin = null; render(); }
    } else {
      // Neues Konto → Profil im Onboarding anlegen
      U.authUser = { id: user.id, email: user.email };
      const md = user.user_metadata || {};
      U.onb.d.email = user.email || '';
      if (!U.onb.d.name) U.onb.d.name = md.full_name || md.name || '';
      U.onb.step = 'profile'; render();
    }
  } catch (e) { toast('⚠️ ' + e.message); }
}

/* ---------------- Aktionen ---------------- */
const ONB_ORDER = ['intro', ...ONB_STEPS];
const consentOk = () => {
  if (U.onb.mode === 'login') return true; // bestehendes Konto: Zustimmung liegt vor (neue Konten holen sie im Profil-Schritt nach)
  if (!U.onb.d.terms) { toast('Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung'); return false; }
  if (!U.onb.d.age) { toast('Bitte bestätige dein Alter'); return false; }
  return true;
};
const avTarget = () => U.sheet?.type === 'editProfile' ? U.form.avatar : U.onb.d.avatar;

const A = {
  // Onboarding
  onbStart() { U.onb.step = 'level'; U.onb.mode = 'signup'; U.onb.fromQuiz = true; },
  onbLogin() { U.onb.step = 'auth'; U.onb.mode = 'login'; U.onb.fromQuiz = false; },
  onbSkip() { U.onb.step = 'auth'; U.onb.fromQuiz = false; },
  async setLang(d) { await setLang(d.id); S.settings.lang = d.id; if (S.user) St.save(); },
  pokeBrainy() {
    U.onb.poke = (U.onb.poke || 0) + 1; haptic(15); render();
    const m = $('.mascot-big', app); if (!m) return false;
    m.classList.add('jump');
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span'); s.className = 'pop';
      s.textContent = ['💖', '✨', '🧠', '⭐', '💡'][(U.onb.poke + i) % 5];
      s.style.setProperty('--dx', (i - 1) * 50 + 'px'); s.style.animationDelay = i * .08 + 's';
      m.appendChild(s);
    }
    return false;
  },
  quizPick(d) {
    const Q = QUIZ[U.onb.step], q = U.onb.d.quiz; if (!Q) return;
    haptic(8);
    if (!Q.multi) { if (U.onb.step === 'level' && q.level !== d.id) delete q.purpose; q[U.onb.step] = d.id; return patchQuiz(); }
    let v = q[U.onb.step] || [];
    if (d.id === 'none') v = v.includes('none') ? [] : ['none'];
    else { v = v.filter(x => x !== 'none'); v = v.includes(d.id) ? v.filter(x => x !== d.id) : [...v, d.id]; }
    q[U.onb.step] = v;
    return patchQuiz();
  },
  quizNext() {
    const i = ONB_STEPS.indexOf(U.onb.step), q = U.onb.d.quiz;
    if (U.onb.step === 'level' && q.level) U.onb.d.level = q.level;
    if (U.onb.step === 'daily' && q.daily) U.onb.d.goalH = Math.max(2, Math.round(+q.daily * 7));
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
  async googleLogin() { return A.oauth({ p: 'google' }); },
  async appleLogin() { return A.oauth({ p: 'apple' }); },
  async oauth(d) {
    if (!consentOk()) return;
    if (!BK.enabled) { U.onb.d.google = true; U.onb.step = 'profile'; return toast(`Demo-Modus: ${d.p === 'apple' ? 'Apple' : 'Google'}-Login ist simuliert`); }
    try { U.onb.busy = true; render(); await BK.signInOAuth(d.p); } catch (e) { toast('⚠️ ' + e.message); }
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
    } catch (e) { toast('⚠️ ' + e.message); if (/Anmelden/.test(e.message)) U.onb.mode = 'login'; }
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
      if (o.name.trim().length < 2) return toast('Wie heisst du?');
      if (!o.username.trim()) o.username = o.name.trim().toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[^a-z0-9._]/g, '');
      o.username = o.username.replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9._]{3,24}$/.test(o.username)) return toast('Benutzername: 3–24 Zeichen, nur a–z, 0–9, Punkt und _');
      if (!isClean(o.name) || !isClean(o.username)) return toast(CLEAN_MSG);
      if (!o.terms || !o.age) { U.onb.mode = 'signup'; if (!consentOk()) return; }
    }
    U.onb.step = d.step;
  },
  avShuffle() { const a = avTarget(), free = BRAIN_SKINS.filter(k => !k.price); a.skin = free[Math.floor(Math.random() * free.length)].id; a.mood = BRAIN_MOODS[Math.floor(Math.random() * BRAIN_MOODS.length)][0]; a.bg = AVATAR_BGS[Math.floor(Math.random() * AVATAR_BGS.length)]; },
  avSkin(d) { Object.assign(avTarget(), { skin: d.id }); },
  avMood(d) { avTarget().mood = d.id; },
  avBg(d) { avTarget().bg = d.id; },
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
    const user = { name: o.name.trim(), username: o.username.toLowerCase(), email: o.email, canton: o.canton, level: o.level, avatar: { ...o.avatar }, weeklyGoalMin: +o.goalH * 60, created: Date.now(), bio: '' };
    if (BK.enabled) {
      if (!U.authUser) { U.onb.step = 'auth'; return toast('Bitte zuerst anmelden'); }
      try {
        U.onb.busy = true; render();
        if (!(await BK.usernameAvailable(user.username))) { U.onb.busy = false; U.onb.step = 'profile'; return toast(`@${user.username} ist schon vergeben – wähl einen anderen`); }
        await BK.createProfile(U.authUser.id, user);
        user.id = U.authUser.id;
      } catch (e) { U.onb.busy = false; return toast('⚠️ ' + e.message); }
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
    toast(`Willkommen bei Brained, ${S.user.name.split(' ')[0]}!`);
    bg(() => Promise.all([BK.pushState(), BK.pushProfileStats()]));
    if (U.pendingJoin) { A.openSheet({ type: 'groupJoin', code: U.pendingJoin }); U.pendingJoin = null; }
  },

  // Shop
  openShop() { U.overlay = null; U.sheet = null; U.shopSel = null; U.tab = 'stats'; U.statsSeg = 'trophies'; U.trophySub = 'shop'; },
  trophySub(d) { U.trophySub = d.id; U.shopSel = null; },
  shopTab(d) { U.shopTab = d.id; },
  shopOpen(d) { U.shopSel = d.id; setTimeout(() => { const c = $('.content', app); if (c) c.scrollTop = 0; }); },
  shopBack() { U.shopSel = null; },
  async shopBuy(d) {
    const it = St.shopItem(d.id), consumable = SHOP_CONSUMABLES.some(c => c.id === d.id);
    if (BK.enabled) {
      try { await BK.buyItem(d.id); } catch (e) { return toast('⚠️ ' + e.message); }
      if (consumable) { S.freeze.stock = (S.freeze.stock || 0) + 1; St.save(); }
    } else if (!St.buy(d.id)) return toast(it.pro ? 'Nur mit Brained Pro' : 'Nicht genug Brain-Coins');
    haptic([20, 40, 20]); chime(); setTimeout(() => confetti(app), 30);
    toast(consumable ? `Streak-Schutz gekauft – du hast jetzt ${S.freeze.stock}` : `${it.name} gehört dir!`);
    if (!consumable) A.shopEquip(d);
  },
  shopOpenId(d) { A.openShop(); U.shopTab = 'items'; U.shopSel = d.id; },
  // Brained Pro
  proPlan(d) { U.proPlan = d.id; },
  async proBuy() {
    const plan = U.proPlan || 'yearly';
    if (!BK.enabled) { S.user.pro = true; St.applyFreeze(); St.save(); U.sheet = { type: 'pro' }; return toast('Demo: Pro aktiv'); }
    U.proBusy = true; render();
    try {
      if (nativeBillingReady()) { await nativePurchase(plan, S.user.id); await waitForPro(); }
      else if (isNative() && platform() === 'ios') toast('Das Abo kommt bald im App Store');
      else { const url = await BK.checkout(plan); location.href = url; return; }
    } catch (e) { if (!/cancel/i.test(e.message)) toast('⚠️ ' + e.message); }
    U.proBusy = false;
  },
  async proPortal() { try { location.href = await BK.billingPortal(); } catch (e) { toast('⚠️ ' + e.message); } },
  async proRestore() {
    try { if (nativeBillingReady()) await nativeRestore(S.user.id); await BK.loadPlan(); toast(St.isPro() ? 'Pro ist aktiv' : 'Kein aktives Abo gefunden'); } catch (e) { toast('⚠️ ' + e.message); }
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
    } catch (e) { toast('⚠️ ' + e.message); }
  },
  // Passwort vergessen
  async forgotPw() {
    const email = (U.onb.d.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Gib zuerst oben deine E-Mail ein');
    if (!BK.enabled) return toast('Demo: Link wäre jetzt unterwegs');
    try { await BK.sendPasswordReset(email); toast('Wir haben dir einen Link geschickt. Schau auch im Spam-Ordner.', null, null, 7000); } catch (e) { toast('⚠️ ' + e.message); }
  },
  async saveNewPw() {
    const pw = U.form.newPw || '';
    if (pw.length < 8) return toast('Mindestens 8 Zeichen');
    try { await BK.updatePassword(pw); U.sheet = null; U.form.newPw = ''; toast('Neues Passwort gespeichert'); } catch (e) { toast('⚠️ ' + e.message); }
  },
  shopEquip(d) {
    const it = St.shopItem(d.id); if (!it || !St.owns(d.id)) return;
    const a = { ...normAvatar(S.user.avatar) };
    if (it.set) { const on = Object.entries(it.set).every(([k, v]) => k === 'mood' || a[k] === v); if (on) { for (const k of Object.keys(it.set)) if (k !== 'skin' && k !== 'mood') delete a[k]; a.skin = 'pink'; } else Object.assign(a, it.set); }
    else if (it.slot) { if (a[it.slot] === d.id) delete a[it.slot]; else a[it.slot] = d.id; }
    else if (it.fill) a.skin = a.skin === d.id ? 'pink' : d.id;
    else { if (a.frame === d.id) delete a.frame; else a.frame = d.id; }
    S.user.avatar = a; St.save(); bg(() => BK.updateProfile());
  },

  // Navigation
  tab(d) { if (U.ai?.tool === 'game' && d.id !== 'ai') { GM.quit(); U.ai = { tool: null }; } if (d.id === 'ai' && U.tab === 'ai') { GM.quit(); U.ai = { tool: null }; } U.tab = d.id; U.overlay = null; U.sheet = null; refreshSocial(d.id); },
  openProfile() { U.overlay = 'profile'; },
  profileTrophies() { U.overlay = null; U.tab = 'stats'; U.statsSeg = 'trophies'; },
  closeOverlay() { U.overlay = null; },
  openTimer() { U.sheet = null; U.overlay = 'timer'; },
  statsGoals() { U.tab = 'stats'; U.statsSeg = 'goals'; },
  openUser(d) { U.sheet = { type: 'user', id: d.id }; if (BK.enabled && d.id !== S.user?.id) BK.loadPerson(d.id).then(render).catch(() => { }); },
  closeSheet() { if (U.sheetBack) { ({ sheet: U.sheet, form: U.form } = U.sheetBack); U.sheetBack = null; } else U.sheet = null; },
  // «＋ Fächer» in Fach-Auswahlen: Fächer verwalten und danach zum offenen Formular zurück
  moreSubjects() { U.sheetBack = U.sheet ? { sheet: U.sheet, form: U.form } : null; A.openSheet({ type: 'subjects' }); },
  openTrophy() { U.toast = null; A.openSheet({ type: 'trophy', id: U.lastTrophy }); },
  closeModal() { U.modal = null; },
  toast(d) { toast(d.msg); return false; },
  openSheet(d) {
    // Gratis: 1 eigene Gruppe (beitreten ist immer gratis)
    if (d.type === 'groupCreate' && CONFIG.PRO_ENABLED && !St.isPro() && S.groups.filter(g => g.owner === true || (S.user?.id && g.owner === S.user.id)).length >= 3) {
      U.sheet = { type: 'pro', reason: 'Gratis kannst du 3 eigene Gruppen erstellen. Mit Brained Pro unbegrenzt – beitreten ist immer gratis.' }; return;
    }
    if (d.type !== 'subjects') U.sheetBack = null;
    const sub0 = St.mySubjects()[0]?.id;
    const f = {
      plan: () => ({ subjectId: sub0, date: St.dayKey(Math.max(U.calSel, St.startOfDay(Date.now()))), time: '17:00', dur: 45, note: '' }),
      challenge: () => ({ title: '', emoji: '🎯', subjectId: '', hours: 5, days: 7 }),
      goal: () => ({ goalH: Math.round(St.weekGoal() / 60) }),
      subjects: () => ({ newSubj: '', newEmoji: '🧠' }),
      friend: () => ({ q: '' }),
      groupCreate: () => ({ name: '', emoji: '🏫', color: SUBJECT_COLORS[0] }),
      apikey: () => ({ key: S.settings.apiKey, model: S.settings.model }),
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
    haptic(30); chime(); bg(() => BK.setLive(S.timer.subjectId));
  },
  startPlanned(d) {
    const p = S.planned.find(x => x.id === d.id); if (!p) return;
    if (S.timer) { U.overlay = 'timer'; return toast('Es läuft schon eine Session'); }
    p.done = true;
    T.start(p.subjectId, 'goal', p.durMin);
    U.sheet = null; U.overlay = 'timer'; haptic(30); chime(); bg(() => BK.setLive(p.subjectId));
  },
  pauseTimer() { T.pause('manual'); haptic(); bg(() => BK.setLive(null)); },
  resumeTimer() { T.resume(); haptic(); U.toast = null; bg(() => BK.setLive(S.timer?.subjectId)); },
  finishTimer() { U.modal = { type: 'confirmFinish' }; },
  discardTimer() { T.discard(); bg(() => BK.setLive(null)); U.modal = null; U.overlay = null; U.standby = false; T.keepAwake(false); toast('Session verworfen'); },
  finishConfirm() {
    U.modal = null; U.standby = false; T.keepAwake(false);
    const res = T.finish();
    if (!res) { U.overlay = null; return toast('Unter 1 Minute – nicht gespeichert'); }
    const fresh = St.checkTrophies();
    U.summary = { session: res.session, fresh, streakBefore: res.streakBefore, cards: null };
    if (U.planRef) { const p = (S.studyPlans || []).find(x => x.id === U.planRef.id); if (p?.days[U.planRef.k]) { p.days[U.planRef.k].done = true; St.save(); } U.planRef = null; }
    bg(async () => { await BK.setLive(null); await BK.pushSession(res.session); await BK.pushProfileStats(); });
    U.overlay = 'summary';
    setTimeout(() => confetti(app), 80); chime(); haptic(40);
  },
  async standby() {
    U.standby = true; U.sheet = null;
    await T.keepAwake(true);
    U.dimmed = await dimNative(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { }
    render();
    if (!S.settings.focusTipSeen) { S.settings.focusTipSeen = true; St.save(); U.standbyTip = true; render(); }
  },
  standbyTipClose() { U.standbyTip = false; },
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
  summaryDone() { const s = U.summary.session; if (!isClean(s.title) || !isClean(s.note)) return toast(CLEAN_MSG); St.save(); bg(() => BK.pushSession(s)); U.overlay = null; U.summary = null; U.tab = 'home'; refreshSocial('home'); },
  async recapCards() {
    const sm = U.summary, note = (sm.session.note || '').trim();
    if (note.length < 10) return toast('Schreib zuerst 2–3 Stichworte');
    St.save();
    sm.loading = true; render();
    try {
      const cards = await AI.recapCards(note, St.subj(sm.session.subjectId).name);
      St.addCards(cards, sm.session.subjectId, 'recap');
      sm.cards = cards;
    } catch (e) { toast('Brainy-Fehler: ' + e.message); }
    sm.loading = false; render();
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
  statsSeg(d) { U.statsSeg = d.id; },
  statsRange(d) { U.statsRange = d.id; },
  calMove(d) { const m = new Date(U.calMonth); U.calMonth = new Date(m.getFullYear(), m.getMonth() + +d.d, 1).getTime(); },
  openCalDay(d) { U.tab = 'stats'; U.statsSeg = 'calendar'; A.calSel(d); },
  calSel(d) { U.calSel = +d.ts; const m = new Date(+d.ts); U.calMonth = new Date(m.getFullYear(), m.getMonth(), 1).getTime(); },
  delPlanned(d) { S.planned = S.planned.filter(p => p.id !== d.id); St.save(); },
  delChallenge(d) { S.challenges = S.challenges.filter(c => c.id !== d.id); St.save(); },
  joinChallenge(d) {
    if (S.joinedChallenges[d.id]) delete S.joinedChallenges[d.id];
    else { S.joinedChallenges[d.id] = St.startOfWeek(Date.now()); toast(`Du machst mit bei «${GLOBAL_CHALLENGES.find(c => c.id === d.id).title}»`); }
    St.save();
  },
  async aiInsights() {
    if (!AI.hasKey()) { A.openSheet({ type: 'apikey' }); return toast('Verbinde Claude für die KI-Analyse – oder nutze die lokale Analyse'); }
    U.aiInsightsBusy = true; render();
    const now = Date.now(), bySubject = {};
    S.sessions.filter(s => s.start > now - 28 * 864e5).forEach(s => { const n = St.subj(s.subjectId).name; bySubject[n] = (bySubject[n] || 0) + s.min; });
    try {
      U.aiInsights = await AI.aiInsights({
        heute: new Date().toISOString(), wochenzielMin: St.weekGoal(), dieseWocheMin: Math.round(St.weekMin()), streak: St.streakInfo(), minutenProFach28Tage: bySubject,
        sessions14Tage: S.sessions.filter(s => s.start > now - 14 * 864e5).map(s => ({ fach: St.subj(s.subjectId).name, start: new Date(s.start).toISOString(), min: s.min, modus: s.mode })),
      });
    } catch (e) { toast('Brainy-Fehler: ' + e.message); }
    U.aiInsightsBusy = false;
  },

  // Formulare / Sheets
  formSubj(d) { U.form.subjectId = d.id; },
  formSet(d) { U.form[d.k] = d.v; },
  savePlan() {
    const f = U.form, [y, m, dd] = f.date.split('-').map(Number), [h, mi] = f.time.split(':').map(Number);
    S.planned.push({ id: St.uid(), subjectId: f.subjectId, ts: new Date(y, m - 1, dd, h, mi).getTime(), durMin: +f.dur, note: f.note, source: 'manual' });
    St.save(); U.sheet = null; U.calSel = new Date(y, m - 1, dd).getTime();
    trophyToast() .length || toast('Session geplant');
  },
  saveChallenge() {
    const f = U.form;
    if (!f.title.trim()) return toast('Gib deiner Challenge einen Namen'); if (!isClean(f.title)) return toast(CLEAN_MSG);
    const start = St.startOfDay(Date.now());
    S.challenges.push({ id: St.uid(), title: f.title.trim(), emoji: f.emoji, subjectId: f.subjectId || null, targetMin: +f.hours * 60, start, end: St.addDays(start, +f.days) });
    St.save(); U.sheet = null; toast('Challenge gestartet!');
  },
  saveGoal() { S.user.weeklyGoalMin = +U.form.goalH * 60; St.save(); bg(() => BK.updateProfile()); U.sheet = null; trophyToast(); },
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
    S.subjects.push(id); U.form.newSubj = ''; St.save(); toast(`«${name}» hinzugefügt`);
  },
  delSession(d) { S.sessions = S.sessions.filter(s => s.id !== d.id); St.save(); bg(async () => { await BK.deleteSession(d.id); await BK.pushProfileStats(); }); U.sheet = null; toast('Session gelöscht'); },
  async toggleFriend(d) {
    const on = !S.friends.includes(d.id) && !BK.R.requested.includes(d.id); // Folgen – oder Folgen/Anfrage zurückziehen
    if (BK.enabled) {
      try { const r = await BK.follow(d.id, on); if (r === 'requested') toast('Anfrage gesendet – sobald sie angenommen wird, folgst du.'); }
      catch (e) { return toast('⚠️ ' + e.message); }
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
    if (BK.enabled) { try { await BK.report(d.id, reason); } catch (e) { return toast('⚠️ ' + e.message); } }
    toast('Danke! Wir prüfen die Meldung innert 24 Stunden.');
  },
  openFollowing() {
    U.sheet = { type: 'following' };
    if (BK.enabled) BK.loadFriendsToday().then(() => { BK.R.following = BK.R.friendsToday; render(); }).catch(e => toast('⚠️ ' + e.message));
    else BK.R.following = St.friendsToday();
  },
  openRequests() { U.sheet = { type: 'requests' }; if (BK.enabled) BK.loadRequests().then(render).catch(e => toast('⚠️ ' + e.message)); else BK.R.requests = BK.R.requests || []; },
  async answerRequest(d) {
    const accept = d.k === '1';
    if (BK.enabled) { try { await BK.respondRequest(d.id, accept); } catch (e) { return toast('⚠️ ' + e.message); } }
    else BK.R.requests = (BK.R.requests || []).filter(r => r.id !== d.id);
    if (accept) haptic();
    toast(accept ? 'Angenommen – diese Person sieht jetzt deine Sessions.' : 'Anfrage abgelehnt');
  },
  toggleFollowMode() {
    S.user.followRequests = S.user.followRequests === false;
    St.save(); bg(() => BK.updateProfile());
    toast(S.user.followRequests ? 'Neue Follower brauchen jetzt deine Zustimmung' : 'Öffentlich – alle können dir direkt folgen');
  },
  openBlocked() { U.sheet = { type: 'blocked' }; if (BK.enabled) BK.loadBlocks().then(render).catch(e => toast('⚠️ ' + e.message)); else BK.R.blocked = (S.blockedDemo || []).map(id => St.person(id)).filter(Boolean); },
  async unblockUser(d) {
    if (BK.enabled) { try { await BK.unblock(d.id); } catch (e) { return toast('⚠️ ' + e.message); } }
    else { S.blockedDemo = (S.blockedDemo || []).filter(x => x !== d.id); BK.R.blocked = (BK.R.blocked || []).filter(r => r.id !== d.id); St.save(); }
    toast('Blockierung aufgehoben');
  },
  async blockUser(d) {
    if (BK.enabled) { try { await BK.block(d.id); } catch (e) { return toast('⚠️ ' + e.message); } }
    else { S.friends = S.friends.filter(x => x !== d.id); S.blockedDemo = [...new Set([...(S.blockedDemo || []), d.id])]; }
    U.sheet = null; St.save(); toast('Person blockiert – rückgängig machen unter Profil → Blockierte Personen.'); refreshSocial(U.tab);
  },
  inviteApp() { share(`Lern mit mir auf Brained 🧠🔥 Such mich in der App: @${S.user.username}`); return false; },
  async saveGroup() {
    const f = U.form; if (!f.name.trim()) return toast('Name der Gruppe fehlt'); if (!isClean(f.name)) return toast(CLEAN_MSG);
    let g;
    if (BK.enabled) { try { g = await BK.createGroup(f.name.trim(), f.emoji, f.color); } catch (e) { return toast('⚠️ ' + e.message); } }
    else g = St.createGroup(f.name.trim(), f.emoji, f.color);
    U.rankScope = 'group'; U.rankGroup = g.id; U.tab = 'rank';
    U.sheet = { type: 'invite', id: g.id };
    trophyToast();
  },
  async joinGroup() {
    let r;
    if (BK.enabled) { try { r = { group: await BK.joinGroup(U.form.code || '') }; } catch (e) { r = { error: e.message }; } }
    else r = St.joinGroup(U.form.code || '');
    if (r.error) { U.form.err = r.error; return; }
    U.sheet = null; U.rankScope = 'group'; U.rankGroup = r.group.id; U.tab = 'rank';
    toast(`${r.group.emoji} Willkommen in «${r.group.name}»!`); trophyToast(); refreshSocial('rank');
  },
  async leaveGroup(d) {
    const g = S.groups.find(x => x.id === d.id);
    if (BK.enabled) { try { await BK.leaveGroup(g); } catch (e) { return toast('⚠️ ' + e.message); } }
    else St.leaveGroup(d.id);
    U.sheet = null; U.rankGroup = null; refreshSocial('rank');
    toast(g?.owner ? `Gruppe «${g.name}» gelöscht` : `Du hast «${g?.name}» verlassen`);
  },
  async copyLink(d) { const l = St.inviteLink(d.id); try { await navigator.clipboard.writeText(l); toast('Einladungslink kopiert'); } catch { toast(l); } return false; },
  async copyCode(d) { try { await navigator.clipboard.writeText(d.id); toast('Code kopiert'); } catch { toast('Code: ' + d.id); } return false; },
  shareGroup(d) { const g = S.groups.find(g => g.id === d.id); share(`Komm in meine Lerngruppe «${g.name}» auf Brained 🧠 Code: ${g.code} – ${St.inviteLink(g.code)}`); return false; },
  saveKey() { S.settings.apiKey = (U.form.key || '').trim(); S.settings.model = U.form.model; St.save(); U.sheet = null; toast(S.settings.apiKey ? 'Brainy ist jetzt mit Claude verbunden' : 'Demo-Modus aktiv'); },
  removeKey() { S.settings.apiKey = ''; St.save(); U.sheet = null; toast('Key entfernt – Demo-Modus'); },
  saveProfile() {
    const f = U.form; if (f.name.trim().length < 2) return toast('Name zu kurz'); if (!isClean(f.name) || !isClean(f.bio)) return toast(CLEAN_MSG);
    Object.assign(S.user, { name: f.name.trim(), bio: (f.bio || '').slice(0, 80), canton: f.canton, avatar: { ...f.avatar } }); St.save(); U.sheet = null; toast('Profil gespeichert');
    bg(() => BK.updateProfile());
  },
  saveCard() {
    const f = U.form; if (!f.q.trim() || !f.a.trim()) return toast('Frage und Antwort ausfüllen');
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
      feynman: { tool: 'feynman', phase: 'setup', subjectId: sub0, topic: '', persona: 'kid', meter: 0 },
      exam: (() => {
        const etype = { gym: 'matura', sek: 'gymi', lehre: 'abu', bms: 'bmp' }[S.user?.level] || 'gymi';
        return { tool: 'exam', phase: 'setup', typeId: 'school', country: 'CH', region: S.user?.canton || 'ALL', etype, dbId: null, subjKey: null, subjectId: sub0, topic: '', extra: '', length: 'standard', upload: null, wantUpload: false };
      })(),
      plan: { tool: 'plan', phase: 'setup', subjectId: sub0, exam: '', date: St.dayKey(St.addDays(Date.now(), 10)), minPerDay: 60, topics: '', rest: [0] },
      cards: { tool: 'cards', queue: null },
    }[d.id] || { tool: null };
  },
  aiBack() { if (U.ai.tool === 'game') { GM.quit(); U.ai = { tool: 'cards', queue: null }; return; } if (U.ai.tool === 'feynman' && listening()) stopVoice(); U.ai = { tool: null }; },
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
    } catch (e) { toast('Brainy-Fehler: ' + e.message); }
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
  feynPersona(d) { U.ai.persona = d.id; },
  feynAgain() { const a = U.ai; Object.assign(a, { phase: 'setup', result: null, cardsSaved: false }); return A.feynStart(); },
  feynTopic(d) { U.ai.topic = d.t; },
  feynStart() {
    const a = U.ai; if (!(a.topic || '').trim()) return toast('Welches Thema erklärst du?');
    const P = AI.PERSONAS[a.persona || 'kid'];
    a.topic = a.topic.trim(); a.phase = 'chat'; a.draft = ''; a.meter = 0; a.meterHist = [0];
    a.msgs = [{ role: 'ai', text: { kid: `Hoi! Ich bin Brainy 🧠 und hab null Ahnung von «${a.topic}». Erklär's mir so, dass ich's checke – ich bin 12!`,
      peer: `Hey! Ich hab morgen Prüfung über «${a.topic}» und check's nur halb 😅 Erklärst du's mir?`,
      prof: `Guten Tag. Ihr Thema: «${a.topic}». Bitte erklären Sie die zentralen Begriffe und Zusammenhänge – präzise.` }[a.persona || 'kid'] }];
    haptic(15);
  },
  async feynSend() {
    const a = U.ai, text = (a.draft || '').trim(); if (!text || a.busy) return;
    if (listening()) await stopVoice();
    a.msgs.push({ role: 'user', text }); a.draft = ''; a.busy = true; a.error = null; render(); scrollContentBottom();
    try {
      const r = await AI.feynmanReply(a.topic, a.persona, a.msgs, a.meter || 0);
      const before = a.meter || 0; a.meter = r.meter; (a.meterHist ||= []).push(r.meter);
      a.msgs.push({ role: 'ai', text: r.text, delta: r.meter - before });
      if (r.meter >= 100 && before < 100) { confetti(app); haptic([30, 60, 30]); }
      else haptic(r.meter > before ? 12 : 40);
    } catch (e) { a.error = 'Brainy-Fehler: ' + e.message; }
    a.busy = false; render(); scrollContentBottom();
  },
  async feynScore() {
    const a = U.ai; a.busy = true; render();
    try {
      a.result = await AI.feynmanScore(a.topic, a.persona, a.msgs, St.mySubjects().map(x => ({ id: x.id, name: x.name })));
      if (a.result.subject && St.mySubjects().some(x => x.id === a.result.subject)) a.subjectId = a.result.subject;
      a.phase = 'result';
      S.stats.feynmanBest = Math.max(S.stats.feynmanBest, a.result.score || 0);
      if ((a.result.score || 0) >= 80) S.stats.feyn80 = (S.stats.feyn80 || 0) + 1;
      S.feynHistory = [...(S.feynHistory || []), { ts: Date.now(), topic: a.topic, persona: a.persona, score: a.result.score || 0 }].slice(-20);
      St.save();
      trophyToast();
    } catch (e) { a.error = 'Brainy-Fehler: ' + e.message; }
    a.busy = false;
  },
  async feynVoice() {
    const a = U.ai;
    if (listening()) { await stopVoice(() => render()); return; }
    const base = (a.draft || '').trim();
    try {
      await startVoice(text => {
        a.draft = (base ? base + ' ' : '') + text;
        const el = $('[data-live="feynDraft"]', app); if (el) { el.value = a.draft; el.scrollTop = el.scrollHeight; }
      }, () => render());
      haptic(15);
    } catch (e) { toast('' + e.message); }
  },
  feynCards() { St.addCards(U.ai.result.cards, U.ai.subjectId || St.mySubjects()[0]?.id, 'feynman'); U.ai.cardsSaved = true; toast('🃏 Karten gespeichert'); },
  // Prüfungsgenerator
  examType(d) { U.ai.typeId = d.id; },
  examCanton(d) { const a = U.ai; a.canton = d.id; const ex = examsIn(d.id)[0]; a.dbId = ex?.id || 'school'; a.subjKey = null; },
  examDb(d) { U.ai.dbId = d.id; U.ai.subjKey = null; },
  examCountry(d) { const a = U.ai; if (a.country === d.id) return; a.country = d.id; a.region = null; a.etype = null; a.subjKey = null; },
  examType2(d) { U.ai.etype = d.id; U.ai.subjKey = null; },
  examSubj(d) { U.ai.subjKey = d.id; },
  examSource(d) {
    // Zwillingsprüfung aus eigener Prüfung = Pro-Funktion (Server prüft das ebenfalls)
    if (d.id === 'upload' && BK.enabled && CONFIG.PRO_ENABLED && !St.isPro()) { U.sheet = { type: 'pro', reason: 'Alte Prüfungen hochladen (PDF/Foto) und daraus Zwillingsprüfungen erstellen ist eine Pro-Funktion.' }; return; }
    U.ai.wantUpload = d.id === 'upload'; if (!U.ai.wantUpload) U.ai.upload = null;
  },
  examFileClear(d, el, e) { e.preventDefault(); U.ai.upload = null; },
  examLength(d) { U.ai.length = d.id; },
  async examStart() {
    const a = U.ai;
    if (a.wantUpload && !a.upload) return toast('Lade zuerst eine alte Prüfung hoch (Foto oder PDF)');
    a.busy = true; a.busyStep = 'write'; a.error = null; render();
    try {
      const db = a.dbId && a.dbId !== 'school' ? (examByKey(a.dbId) || examById(a.dbId)) : null;
      const ex = db ? await AI.examGenerateDb({ examId: db.id, subjKey: a.subjKey || Object.keys(db.subjects)[0], length: a.length, extra: a.extra, upload: a.wantUpload ? a.upload : null, subjectId: (a.subjKey || '').split(':').pop().startsWith('mathe') ? 'mathe' : 'deutsch', onStep: st => { a.busyStep = st; render(); } })
        : await AI.examGenerate({ type: examTypeOf('school'), subjectId: a.subjectId, subjectName: St.subj(a.subjectId).name, topic: (a.topic || '').trim(), length: a.length, upload: a.wantUpload ? a.upload : null });
      if (db) a.subjectId = (a.subjKey || '').split(':').pop().startsWith('mathe') ? (St.mySubjects().find(x => x.id === 'mathe')?.id || a.subjectId) : (St.mySubjects().find(x => x.id === 'deutsch')?.id || a.subjectId);
      if (!ex.tasks?.length) throw new Error('Keine Aufgaben erhalten');
      const id = St.uid();
      S.examDocs = [...(S.examDocs || []), { id, ts: Date.now(), typeId: a.typeId, subjectId: a.subjectId, exam: ex }].slice(-12);
      St.save();
      Object.assign(a, { phase: 'doc', exam: ex, docId: id, view: 'exam', pts: ex.tasks.map(() => 0), cardsSaved: false });
      haptic(20);
    } catch (e) { a.error = e.message.startsWith('Für ') ? e.message : 'Brainy-Fehler: ' + e.message; }
    a.busy = false;
  },
  examAgain() { const a = U.ai; a.phase = 'setup'; return A.examStart(); },
  examDocOpen(d) {
    const doc = (S.examDocs || []).find(x => x.id === d.id); if (!doc) return;
    Object.assign(U.ai, { phase: 'doc', exam: doc.exam, docId: doc.id, typeId: doc.typeId, subjectId: doc.subjectId, view: 'exam', pts: doc.pts || doc.exam.tasks.map(() => 0), cardsSaved: false });
  },
  examView(d) { U.ai.view = d.id; },
  async examPdf(d) {
    const a = U.ai; if (a.pdfBusy) return;
    a.pdfBusy = d.id; render();
    try { const { shareExamPdf } = await import('./exampdf.js'); await shareExamPdf(a.exam, { solutions: d.id === 'sol' }); }
    catch (e) { toast('PDF-Fehler: ' + e.message); }
    a.pdfBusy = null;
  },
  examTimer() {
    const a = U.ai;
    if (S.timer) { U.overlay = 'timer'; return; }
    T.start(a.subjectId, 'goal', a.exam.minutes || 60); U.overlay = 'timer'; haptic(20);
  },
  examScoreOpen() { const a = U.ai; const doc = (S.examDocs || []).find(x => x.id === a.docId); a.pts = [...(doc?.pts || a.exam.tasks.map(() => 0))]; a.phase = 'score'; },
  examBack() { U.ai.phase = 'doc'; },
  examPts(d) {
    const a = U.ai, t = a.exam.tasks[+d.k]; if (!t) return;
    const mx = t.items.reduce((s, i) => s + (+i.points || 0), 0);
    a.pts[+d.k] = Math.max(0, Math.min(mx, (+a.pts[+d.k] || 0) + +d.d));
  },
  examSave() {
    const a = U.ai, sc = examScore(a);
    const doc = (S.examDocs || []).find(x => x.id === a.docId);
    const first = !doc?.grade;
    if (doc) Object.assign(doc, { pts: [...a.pts], grade: sc.grade });
    const rec = { id: a.docId, ts: Date.now(), typeId: a.typeId, subjectId: a.subjectId, title: a.exam.title, grade: sc.grade, pct: sc.pct, earned: sc.earned, max: sc.max };
    S.exams = [...(S.exams || []).filter(e => e.id !== a.docId), rec];
    if (first) {
      S.stats.examBest = Math.max(S.stats.examBest || 0, sc.grade);
      if (sc.grade >= 5.5) S.stats.exam55 = (S.stats.exam55 || 0) + 1;
      if (sc.grade >= 6) S.stats.exam6 = (S.stats.exam6 || 0) + 1;
    }
    St.save(); a.phase = 'doc'; a.cardsSaved = false;
    if (sc.grade >= 4) confetti(app);
    toast(`Note ${sc.grade.toFixed(1)} gespeichert`); trophyToast();
  },
  examCards() {
    const a = U.ai, doc = (S.examDocs || []).find(x => x.id === a.docId), pts = doc?.pts || [];
    const cards = a.exam.tasks.filter((t, i) => (+pts[i] || 0) < t.items.reduce((s, x) => s + x.points, 0) * .6)
      .flatMap(t => t.items.map(it => ({ q: `${t.title ? t.title + ': ' : ''}${it.q}`.slice(0, 400), a: (it.options ? `${(it.correct || []).map(k => it.options[k]).join(', ')}${it.solution ? ' – ' + it.solution : ''}` : it.solution).slice(0, 500) })))
      .filter(c => c.a);
    St.addCards(cards, a.subjectId, 'exam'); a.cardsSaved = true; toast(`🃏 ${cards.length} Karten gespeichert`);
  },
  planMin(d) { U.ai.minPerDay = +d.m; },
  planRest(d) { const r = U.ai.rest, v = +d.d, i = r.indexOf(v); i >= 0 ? r.splice(i, 1) : r.push(v); },
  async planMake() {
    const a = U.ai;
    if (!(a.exam || '').trim()) return toast('Wie heisst die Prüfung?');
    if (!a.date) return toast('Prüfungsdatum fehlt');
    const [y, m, d] = a.date.split('-').map(Number); a.examTs = new Date(y, m - 1, d).getTime();
    if (a.examTs <= St.addDays(St.startOfDay(Date.now()), 1)) return toast('Datum muss mind. 2 Tage in der Zukunft liegen');
    a.busy = true; a.error = null; render();
    try {
      const topics = (a.topics || '').split('\n').map(t => t.trim()).filter(Boolean).map(t => ({ t, lvl: a.levels?.[t] ?? 1 }));
      const days = await AI.makePlan({ exam: a.exam, subjectId: a.subjectId, examDate: a.examTs, minPerDay: a.minPerDay, topics, restDays: a.rest });
      if (!days.length) a.error = 'Keine freien Tage bis zur Prüfung.';
      else {
        // Lernplan wird gespeichert (auch auf dem Server) – mehrere Pläne parallel möglich
        const plan = { id: St.uid(), exam: a.exam.trim(), subjectId: a.subjectId, examTs: a.examTs, minPerDay: a.minPerDay, created: Date.now(), inCalendar: false,
          days: days.map(p => ({ ts: St.startOfDay(p.ts), min: p.min, focus: p.focus, kind: p.kind || 'rep', done: false })) };
        S.studyPlans = [...(S.studyPlans || []), plan]; S.stats.plans = (S.stats.plans || 0) + 1; St.save();
        Object.assign(a, { phase: 'view', planId: plan.id, exam: '', topics: '', levels: {} });
        trophyToast().length || toast(`Lernplan gespeichert – ${plan.days.length} Lerntage`);
      }
    } catch (e) { a.error = 'Brainy-Fehler: ' + e.message; }
    a.busy = false;
  },
  planOpen(d) { Object.assign(U.ai, { phase: 'view', planId: d.id }); },
  planDay(d) { const p = (S.studyPlans || []).find(x => x.id === d.id); if (!p) return; const day = p.days[+d.k]; day.done = !day.done; if (day.done) haptic(10); St.save(); if (p.days.every(x => x.done)) { confetti(app); toast('Lernplan komplett – du bist bereit!'); } },
  planLvl(d) { const a = U.ai; a.levels = a.levels || {}; a.levels[d.t] = ((a.levels[d.t] ?? 1) + 2) % 3; haptic(5); },
  // Verpasste Tage auf die restlichen Lerntage verteilen (nicht auf den letzten Tag)
  planReplan(d) {
    const p = (S.studyPlans || []).find(x => x.id === d.id); if (!p) return;
    const today = St.startOfDay(Date.now()), missed = p.days.filter(x => !x.done && x.ts < today);
    const future = p.days.filter(x => x.ts >= today && x.kind !== 'light' && x.kind !== 'exam');
    if (!missed.length) return toast('Nichts verpasst – stark!');
    if (!future.length) return toast('Keine freien Tage mehr bis zur Prüfung');
    const cap = Math.round((p.minPerDay || 60) * 1.5);
    for (const m of missed) {
      const t = future.slice().sort((a, b) => a.min - b.min)[0];
      t.min = Math.min(cap, t.min + Math.round(m.min * .6)); t.focus = `${t.focus} · Nachholen: ${m.focus.replace(/^(Neu|Repetition): /, '')}`.slice(0, 120);
      m.moved = true; m.done = true;
    }
    St.save(); haptic(15); toast(`${missed.length} verpasste ${missed.length === 1 ? 'Einheit' : 'Einheiten'} neu verteilt`);
  },
  planGo(d) {
    const p = (S.studyPlans || []).find(x => x.id === d.id); if (!p) return;
    const day = p.days[+d.k];
    if (day?.kind === 'cards') { U.planRef = { id: p.id, k: +d.k }; A.aiTool({ id: 'cards' }); return; }
    if (day?.kind === 'exam') { U.planRef = { id: p.id, k: +d.k }; return A.planExam({ id: p.id }); }
    if (S.timer) { U.overlay = 'timer'; return; }
    U.planRef = { id: p.id, k: +d.k };
    T.start(p.subjectId, 'goal', p.days[+d.k].min); U.overlay = 'timer'; haptic(30); chime();
    toast(`${p.days[+d.k].focus}`);
  },
  planCal(d) {
    const p = (S.studyPlans || []).find(x => x.id === d.id); if (!p || p.inCalendar) return;
    p.days.forEach(x => S.planned.push({ id: St.uid(), subjectId: p.subjectId, ts: x.ts + 17 * 3600000, durMin: x.min, note: x.focus, source: 'ai', planId: p.id }));
    S.challenges.push({ id: St.uid(), title: `Bereit für: ${p.exam}`, emoji: '🎓', subjectId: p.subjectId, targetMin: p.days.reduce((s, x) => s + x.min, 0), start: St.startOfDay(Date.now()), end: p.examTs, planId: p.id });
    p.inCalendar = true; St.save(); toast(`${p.days.length} Sessions im Kalender (17:00) + Challenge erstellt`);
  },
  planExam(d) { const p = (S.studyPlans || []).find(x => x.id === d.id); A.aiTool({ id: 'exam' }); if (p) { U.ai.subjectId = p.subjectId; U.ai.topic = p.exam; } },
  planDel(d) { U.modal = { type: 'confirmPlanDel', id: d.id }; },
  planDelConfirm(d) {
    S.studyPlans = (S.studyPlans || []).filter(x => x.id !== d.id);
    S.planned = S.planned.filter(x => x.planId !== d.id); S.challenges = S.challenges.filter(x => x.planId !== d.id);
    St.save(); U.modal = null; Object.assign(U.ai, { phase: 'setup', planId: null }); toast('Lernplan gelöscht');
  },
  cardsStart() { const ids = St.dueCards().map(c => c.id).sort(() => Math.random() - .5); U.ai = { tool: 'cards', queue: ids, i: 0, flipped: false }; },
  cardFlip() { U.ai.flipped = !U.ai.flipped; haptic(8); },
  cardRate(d) { const a = U.ai; St.reviewCard(a.queue[a.i], d.k === '1'); a.i++; a.flipped = false; if (a.i >= a.queue.length) { confetti(app); trophyToast(); } },
  delCard(d) { S.flashcards = S.flashcards.filter(c => c.id !== d.id); St.save(); },

  // Profil
  togglePause() { S.settings.pauseOnLeave = !S.settings.pauseOnLeave; St.save(); if (!S.settings.pauseOnLeave) toast('⚠️ Ohne Auto-Pause zählt deine Zeit nicht für die Rangliste'); },
  cycleTheme() { const o = ['auto', 'light', 'dark']; S.settings.theme = o[(o.indexOf(S.settings.theme) + 1) % 3]; St.save(); },
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
    if (BK.enabled) { try { toast('Konto wird gelöscht…'); await BK.deleteAccount(); } catch (e) { return toast('⚠️ ' + e.message); } }
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
  examFile(el) {
    const f = el.files?.[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('Datei zu gross (max. 8 MB)');
    if (!/^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(f.type)) return toast('Bitte ein Foto (JPG/PNG) oder PDF wählen');
    const r = new FileReader();
    r.onload = () => { U.ai.upload = { name: f.name, type: f.type, size: f.size, data: String(r.result).split(',')[1] }; render(); };
    r.readAsDataURL(f);
  },
  notesFile(el) {
    const f = el.files?.[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('Datei zu gross (max. 8 MB)');
    if (!/^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(f.type)) return toast('Bitte ein Foto (JPG/PNG) oder PDF wählen');
    const r = new FileReader();
    r.onload = () => { U.form.upload = { name: f.name, type: f.type, size: f.size, data: String(r.result).split(',')[1] }; U.form.preview = null; render(); };
    r.readAsDataURL(f);
  },
  planTopics() { syncBinds(); render(); },
  examCantonSel(el) { if (el.value) { A.examCanton({ id: el.value }); render(); } },
  examRegion(el) { U.ai.region = el.value; U.ai.subjKey = null; render(); },
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
  goalRange(el) { const h = +el.value; const a = $('[data-live="goalH"]'), b = $('[data-live="goalPerDay"]'); if (a) a.textContent = h + ' h'; if (b) b.textContent = t(`≈ ${Math.round(h * 60 / 7)} min pro Tag`); syncBinds(); },
  chRange(el) { const a = $('[data-live="chH"]'); if (a) a.textContent = el.value + ' h'; syncBinds(); },
  friendSearch(el) {
    if (BK.enabled) {
      clearTimeout(searchTimer); syncBinds();
      const q = el.value.trim();
      searchTimer = setTimeout(async () => {
        const box = $('[data-live="friendList"]', app); if (!box) return;
        if (q.length < 2) { box.innerHTML = '<div class="empty small">Gib mind. 2 Zeichen ein (Name oder @benutzername)</div>'; return; }
        try { box.innerHTML = friendRows(await BK.search(q)); } catch (e) { box.innerHTML = `<div class="empty small">${e.message}</div>`; }
      }, 300);
      return;
    }
    const q = el.value.toLowerCase();
    const res = St.leaderboard({ scope: 'global', period: 'week' }).filter(u => !u.isMe && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q))).slice(0, 12);
    $('[data-live="friendList"]').innerHTML = friendRows(res); syncBinds();
  },
};

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
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.dataset?.bind === 'ai.draft') { e.preventDefault(); syncBinds(); A.feynSend(); }
});

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
    St.save();
  } else {
    if (U.leftWhileRunning) { U.leftWhileRunning = false; U.standby = false; toast('Timer pausiert – du hast Brained verlassen.', 'resumeTimer', 'Weiter', 8000); }
    else render();
    if (U.standby) T.keepAwake(true);
  }
});
window.addEventListener('pagehide', () => St.save());

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
  const map = { game: ['ai'], home: ['home'], stats: ['stats', 'overview'], trophies: ['stats', 'trophies'], calendar: ['stats', 'calendar'], rank: ['rank'], ai: ['ai'], exam: ['ai'], profile: ['home'] };
  const [tab, seg] = map[screen] || ['home'];
  U.tab = tab; if (seg) U.statsSeg = seg;
  if (screen === 'exam') {
    A.aiTool({ id: 'exam' }); U.ai.typeId = 'bmp'; U.ai.subjectId = 'mathe';
    const ex = normalizeExam(SAMPLE_EXAM, { type: examTypeOf('bmp'), subjectName: 'Mathematik', minutes: 120, subjectId: 'mathe' });
    S.examDocs = [{ id: 'sample', ts: Date.now(), typeId: 'bmp', subjectId: 'mathe', exam: ex }];
    A.examDocOpen({ id: 'sample' });
  }
  if (screen === 'game') { S.flashcards = []; A.gameOpen({ id: 'jump' }); setTimeout(() => { const T = GM.state()?.engine?.test; if (T) { T.start(); setTimeout(() => T.toCard(), 500); } }, 300); }
  if (screen === 'profile') U.overlay = 'profile';
  if (screen === 'timer') { if (!S.timer) { T.start('mathe', 'pomo'); } S.timer.acc = 17 * 60e3 + 42e3; S.timer.pomo.focusStartAcc = 0; S.settings.checkinMin = 60; S.timer.nextCheckinAcc = 60 * 60e3; U.overlay = 'timer'; }
  if (screen === 'rank') { U.rankScope = 'global'; }
  if (screen === 'shop') { U.tab = 'stats'; U.statsSeg = 'trophies'; U.trophySub = 'shop'; U.shopTab = 'brains'; S.shop = { owned: ['crown', 'diamondgrill', 'f-gold'], spent: 0 }; }
  if (screen === 'feed') { U.feedOpen = true; const f = St.feed().find(x => !x.own); if (f) U.reactOpen = f.id; }
  if (screen === 'welcome' || screen === 'quiz') { S.user = null; U.onb.step = screen === 'welcome' ? 'intro' : 'purpose'; if (screen === 'quiz') U.onb.d.quiz = { level: 'gym', purpose: 'matura' }; }
}
function boot() {
  applyTheme();
  if (CONFIG_SHOWCASE) { showcase(CONFIG_SHOWCASE); render(); return; }
  initNative({ onBack: goBack, dark: matchMedia('(prefers-color-scheme: dark)').matches });
  if (S.user) { St.checkTrophies(); freezeCheck(); } // migriert & aktualisiert Trophäen-Zähler
  // Rückkehr von Stripe Checkout (?pro=success|cancel)
  const proRet = new URLSearchParams(location.search).get('pro');
  if (proRet) { U.proReturn = proRet; history.replaceState(null, '', location.pathname); if (proRet === 'cancel') setTimeout(() => toast('Kauf abgebrochen – kein Problem.'), 1900); }
  const recovered = T.recover();
  render();
  const splash = document.createElement('div');
  splash.className = 'splash';
  splash.innerHTML = `<div class="splash-inner"><div class="logo-mark">${brainSVG({ size: 116 })}</div><div class="wordmark">Brained</div><div class="tag">Deine Lern-App</div><div class="dots"><i></i><i></i><i></i></div></div>`;
  $('#phone').appendChild(splash);
  setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 600); }, 1700);
  if (recovered) setTimeout(() => toast('Deine Session wurde pausiert, als Brained geschlossen war.', 'openTimer', 'Öffnen', 8000), 1900);
  if (S.timer?.checkin) U.modal = { type: 'checkin' };
  // Einladungslink ?join=CODE → Beitritts-Sheet (nach dem Onboarding, falls nötig)
  const join = St.normCode(new URLSearchParams(location.search).get('join'));
  if (join) {
    history.replaceState(null, '', location.pathname + (location.search.includes('test') ? '?test' : ''));
    if (S.user) { A.openSheet({ type: 'groupJoin', code: join }); render(); } else U.pendingJoin = join;
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
          Promise.all([BK.loadPlan(), BK.loadShop()]).then(() => { freezeCheck(); render(); if (U.proReturn === 'success') { U.proReturn = null; waitForPro(); } }).catch(() => { });
        }
      })
      .catch(e => toast('⚠️ Server nicht erreichbar: ' + e.message, null, null, 8000));
  }
}
boot();
window.__booted = true;

// Test-Hook (nur mit ?test im URL): gibt der Test-Suite Zugriff auf Zustand & Aktionen.
if (['test', 'livetest'].some(k => new URLSearchParams(location.search).has(k))) window.__brained = { S, U, St, T, AI, A, BK, GM, CONFIG, render };
