// Alle Screens als Template-Funktionen. Events laufen über data-a="aktion" (siehe app.js).
import * as St from './store.js';
import * as T from './timer.js';
import { hasKey, localInsights, swissGrade, examMinutes, PERSONAS, PLAN_KINDS } from './ai.js';
import { examTotal, taskPoints, gradeScale, figureSVG, gradeFor } from './examdoc.js';
import { CANTONS as CANTONS_DB, EXAM_KINDS, EXAMS as EXAMS_DB, examById, examsIn, cantonsWithData, SUBJECT_LABELS } from './examdb.js';
import { COUNTRIES, typesOf, examFor } from './examcatalog.js';
import { esc, fmtDur, fmtShort, fmtHours, fmtClock, fmtTime, fmtDate, timeAgo, I, brainSVG, avatar, normAvatar, ring, donut, focusLine, WD, MONTHS } from './ui.js';
import { PRO, SHOP_CONSUMABLES, RARITY, SHOP_ITEMS, SHOP_BUNDLES, SHOP_FRAMES, SLOTS, BRAIN_SKINS, BRAIN_MOODS, CANTONS, LEVELS, AVATAR_BGS, LEAGUES, LEAGUE_FAMILIES, TROPHIES, TROPHY_GROUPS, EXAM_TYPES, GLOBAL_CHALLENGES, ADS, SUBJECT_COLORS, SUBJECT_EMOJIS, PURPOSES, PURPOSES_BY_LEVEL } from './data.js';
import { U } from './view-state.js';
import { CONFIG, BACKEND, SHOWCASE } from './config.js';
import { LANGS, lang, curLang } from './i18n.js';
import { R } from './backend.js';
import * as GM from './games.js';
import { voiceSupported, listening } from './voice.js';

const S = St.S;
const sel = (a, b) => a === b ? 'on' : '';
const subjTag = s => `<span class="subj-tag" style="background:${s.color}22;color:${s.color}">${s.emoji} ${esc(s.name)}</span>`;
const levelLabel = id => LEVELS.find(l => l.id === id)?.label || '';

export function renderApp() {
  let h = '';
  if (!S.user) h += onboarding();
  else {
    h += shell();
    if (U.overlay === 'timer') h += `<div class="overlay">${timerView()}</div>`;
    if (U.overlay === 'summary') h += `<div class="overlay">${summaryView()}</div>`;
    if (U.overlay === 'profile') h += `<div class="overlay">${profileView()}</div>`;
    if (U.standby && S.timer) h += standbyView();
  }
  if (U.sheet) h += `<div class="scrim" data-a="closeSheet" data-self="1"><div class="sheet" data-keep="sheet"><div class="grab"></div>${sheetView()}</div></div>`;
  if (U.modal) h += `<div class="scrim center">${modalView()}</div>`;
  if (U.toast) h += `<div class="toast">${U.toast.html}${U.toast.action ? `<button data-a="${U.toast.action}">${esc(U.toast.label)}</button>` : ''}</div>`;
  return h;
}

/* =================================== ONBOARDING =================================== */
// iPhone/iPad in Safari (noch nicht installiert) → Anleitung «Zum Home-Bildschirm»
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
function installHint() {
  if (!isIOS() || isStandalone() || window.Capacitor?.isNativePlatform?.()) return '';
  return `<div class="install-hint"><span class="e">📲</span><div><b>Brained als App installieren</b><span>Tippe unten auf <b>Teilen</b> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="vertical-align:-2px"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> und dann auf <b>«Zum Home-Bildschirm»</b>.</span></div></div>`;
}
// Quiz-Fragen (Lilo-Stil): Brainy fragt, man tippt Karten an
export const QUIZ = {
  level: { q: 'Wo lernst du gerade?', opts: LEVELS.map(l => [l.id, l.emoji, l.label]) },
  purpose: { q: 'Wofür lernst du am meisten?', opts: Object.entries(PURPOSES).map(([id, [e, l]]) => [id, e, l]) },
  daily: { q: 'Wie viel willst du pro Tag lernen?', opts: [['0.5', '☕', '30 Minuten'], ['1', '📖', '1 Stunde'], ['2', '📚', '2 Stunden'], ['3', '💪', '3 Stunden'], ['4', '🔥', '4 Stunden'], ['5', '🚀', '5+ Stunden']] },
  struggles: { q: 'Was bremst dich beim Lernen?', sub: 'Mehrere möglich', multi: true, opts: [['phone', '📱', 'Ablenkung durchs Handy'], ['motivation', '😔', 'Fehlende Motivation'], ['focus', '🧠', 'Konzentration'], ['procrast', '⏰', 'Aufschieben'], ['anxiety', '😰', 'Prüfungsangst'], ['none', '💪', 'Ich habe keine Probleme']] },
};
const HELP = {
  phone: ['📵', 'Auto-Pause', 'Verlässt du die App, pausiert der Timer. Ehrliche Minuten zählen.'],
  motivation: ['🔥', 'Streaks & Freunde', 'Halte deine Serie und miss dich in der Rangliste.'],
  focus: ['🍅', 'Pomodoro-Timer', '25 Minuten Fokus, 5 Minuten Pause – automatisch.'],
  procrast: ['🗓️', 'Lernplan von Brainy', 'Brainy plant bis zur Prüfung – du startest nur noch.'],
  anxiety: ['📝', 'Probeprüfungen', 'Übe echte Prüfungen mit Note, bis du dich sicher fühlst.'],
  none: ['🏆', 'Trophäen & Ligen', 'Sammle über 30 Trophäen und steig in höhere Ligen auf.'],
};
export const ONB_STEPS = ['level', 'purpose', 'daily', 'struggles', 'plan', 'auth', 'profile', 'avatar', 'subjects'];
// Brainy reagiert auf jede Antwort
const REACT = {
  level: { sek: 'Sek? Da legen wir das Fundament!', gym: 'Kanti-Power!', lehre: 'Lehre + Lernen = Profi', bms: 'BMS – stark!', fh: 'FH/PH, nice!', uni: 'Uni-Level, respekt!', wb: 'Nie zu spät zum Lernen' },
  purpose: { bm: 'Berufsmatura – packen wir!', sem: 'Prüfungsphase, wir kommen!', thesis: 'Schritt für Schritt zur fertigen Arbeit', dipl: 'Weiterbildung lohnt sich', gymi: 'Gymi? Ich hab Probeprüfungen für dich!', bms: 'BMS-Aufnahme – packen wir!', qv: 'QV rocken wir zusammen', matura: 'Matura? Ich plane mit dir bis zum Tag X', uni: 'Prüfungsphase, wir kommen!', school: 'Jede Prüfung zählt', habit: 'Dranbleiben ist alles' },
  daily: { '0.5': 'Klein starten ist smart', '1': 'Eine Stunde – perfekt!', '2': 'Zwei Stunden, ambitioniert!', '3': 'Wow, Prüfungsmodus!', '4': 'Du meinst es ernst', '5': 'Legendär. Pausen nicht vergessen!' },
};
export const LOAD_ITEMS = [['🧠', 'Brainy lernt dich kennen…'], ['🎯', 'Ziele werden gesetzt…'], ['🔥', 'Streak wird gezündet…']];

function onbBar() {
  const i = ONB_STEPS.indexOf(U.onb.step);
  const pct = Math.round(((i + 1) / (ONB_STEPS.length + 1)) * 100);
  return `<div class="qbar"><button class="icon-btn plain" data-a="onbBack">${I.back}</button><div class="track"><div class="fill" style="width:${pct}%"></div><span class="rider" style="left:${pct}%">${brainSVG({ size: 30 })}</span></div><span class="qcount">${i + 1}/${ONB_STEPS.length}</span></div>`;
}
const mascotHead = (q, mood = 'happy') => `<div class="qhead"><div class="m">${brainSVG({ size: 58, mood })}</div><div class="bubble">${q}</div></div>`;

function onboarding() {
  const o = U.onb, d = o.d;
  if (o.step === 'intro') {
    return `<div class="onb onb2">
      <div class="lang-row">${LANGS.map(l => `<button class="${l.id === lang ? 'on' : ''}" data-a="setLang" data-id="${l.id}">${l.flag} ${l.id.toUpperCase()}</button>`).join('')}</div>
      <div class="onb-hero" style="gap:10px">
        <div class="welcome-title">Willkommen bei</div>
        <div class="welcome-logo">Brained</div>
        <div class="mascot-big" data-a="pokeBrainy" style="margin:18px 0 8px">${brainSVG({ size: 210, body: true, mood: o.poke ? ['wow', 'love', 'happy'][o.poke % 3] : 'happy' })}</div>
        <div class="tap-hint">${o.poke ? ['Hihi, das kitzelt!', 'Ich bin Brainy – dein Lern-Buddy! 🧠', 'Zusammen schaffen wir jede Prüfung 💪', 'Okay okay, lass uns loslegen! 🚀'][(o.poke - 1) % 4] : 'Tippe auf Brainy'}</div>
        <p style="margin-top:6px">Lernen ist jetzt ein Sport.<br>Tracke, sammle Streaks, miss dich mit Freunden.</p>
      </div>
      ${installHint()}
      <button class="btn3d" data-a="onbStart">Los geht's</button>
      <button class="linkbtn" data-a="onbLogin">Ich habe schon ein Konto</button>
    </div>`;
  }
  if (QUIZ[o.step]) {
    const Q = QUIZ[o.step], val = d.quiz[o.step];
    const isOn = id => Q.multi ? (val || []).includes(id) : val === id;
    const ok = Q.multi ? (val || []).length > 0 : val != null;
    const react = !Q.multi && val != null ? REACT[o.step]?.[val] : Q.multi && val?.length ? (val.includes('none') ? 'Stark! Dann holen wir das Maximum raus' : 'Kein Problem – dafür bin ich da!') : '';
    return `<div class="onb onb2">${onbBar()}
      <div class="qhero"><div class="qbrain ${react ? 'happy' : ''}">${brainSVG({ size: 92, mood: react ? (o.step === 'struggles' ? 'love' : 'grin') : 'think' })}</div>
        <h2 class="qtitle">${Q.q}</h2>${Q.sub ? `<div class="qsub">${Q.sub}</div>` : ''}
        <div class="qreact">${react || '&nbsp;'}</div></div>
      <div class="tiles">${(o.step === 'purpose' ? Q.opts.filter(([id]) => (PURPOSES_BY_LEVEL[d.quiz.level] || Object.keys(PURPOSES)).includes(id)) : Q.opts).map(([id, e, label], i) => `<button class="tile ${isOn(id) ? 'on' : ''}" style="animation-delay:${i * 45}ms" data-a="quizPick" data-id="${id}"><span class="e">${e}</span><span class="t">${label}</span></button>`).join('')}</div>
      <div style="flex:1;min-height:16px"></div>
      <button class="btn3d" data-a="quizNext" ${ok ? '' : 'disabled'}>Weiter</button></div>`;
  }
  if (o.step === 'plan') {
    const daily = +(d.quiz.daily || 1), weeks = [.4, .6, .8, 1].map(f => Math.round(daily * 60 * f / 5) * 5);
    const items = (d.quiz.struggles?.length ? d.quiz.struggles : ['none']).slice(0, 3).concat(d.quiz.struggles?.includes('motivation') ? [] : ['motivation']).slice(0, 3);
    return `<div class="onb onb2">${onbBar()}
      <div class="qhero"><div class="qbrain happy">${brainSVG({ size: 80, mood: 'wow' })}</div><h2 class="qtitle">Dein Plan steht!</h2></div>
      <div class="plan-chart"><div class="row" style="justify-content:space-between"><b style="color:var(--brand)">Dein Weg zum Tagesziel</b><span class="faint small bold">${fmtShort(daily * 60)} / Tag</span></div>
        <div class="bars">${weeks.map((m, i) => `<div><b>${fmtShort(m)}</b><i style="height:${Math.round(m / (daily * 60) * 100)}%;animation-delay:${i * .12}s"></i><small>Woche ${i + 1}</small></div>`).join('')}</div>
        <div class="faint small mt8" style="text-align:center">Wir steigern dich Schritt für Schritt – so bleibst du dran.</div></div>
      <div class="feat-list mt16">${items.map((k, i) => { const [e, t, x] = HELP[k]; return `<div class="feat" style="animation-delay:${.3 + i * .12}s"><span class="e">${e}</span><div><b>${t}</b><span>${x}</span></div></div>`; }).join('')}</div>
      <div style="flex:1;min-height:20px"></div>
      <button class="btn3d" data-a="quizNext">Weiter</button></div>`;
  }
  if (o.step === 'auth') {
    const ok = d.terms && d.age, login = o.mode === 'login';
    const check = (k, html) => `<button class="consent" data-a="onbConsent" data-k="${k}"><span class="cbox ${d[k] ? 'on' : ''}">${d[k] ? '✓' : ''}</span><span>${html}</span></button>`;
    const social = CONFIG.OAUTH.length ? `<div class="social-login">
        ${CONFIG.OAUTH.includes('apple') ? `<button class="btn apple block" data-a="appleLogin" ${o.busy ? 'disabled' : ''}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.88c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z"/></svg> Mit Apple ${login ? 'anmelden' : 'fortfahren'}</button>` : ''}
        ${CONFIG.OAUTH.includes('google') ? `<button class="btn google block" data-a="googleLogin" ${o.busy ? 'disabled' : ''}>${I.google} Mit Google ${login ? 'anmelden' : 'fortfahren'}</button>` : ''}</div>` : '';
    const emailForm = `<div class="field" style="margin-bottom:10px"><input class="input" type="email" placeholder="deine@email.ch" data-bind="onb.d.email" value="${esc(d.email)}" autocomplete="email" inputmode="email" autocapitalize="off"/></div>
        <div class="field" style="margin-bottom:12px"><input class="input" type="password" placeholder="${login ? 'Passwort' : 'Passwort (mind. 8 Zeichen)'}" data-bind="onb.d.password" value="${esc(d.password || '')}" autocomplete="${login ? 'current-password' : 'new-password'}"/></div>
        <button class="btn3d" data-a="emailLogin" ${o.busy ? 'disabled' : ''}>${o.busy ? '…' : login ? 'Anmelden' : 'Konto erstellen'}</button>
        ${login ? `<button class="linkbtn" style="display:block;margin:4px auto 0" data-a="forgotPw">Passwort vergessen?</button>` : ''}`;
    if (login) return `<div class="onb onb2">${!o.fromQuiz ? `<div class="qbar"><button class="icon-btn plain" data-a="onbBack">${I.back}</button></div>` : onbBar()}
      ${mascotHead('Schön, dass du wieder da bist!')}
      ${installHint()}
      ${social}
      ${CONFIG.OAUTH.length ? `<div class="divider">oder</div>` : ''}
      ${o.showEmail || !CONFIG.OAUTH.length ? emailForm : `<button class="btn ghost block" data-a="onbShowEmail">Mit E-Mail & Passwort anmelden</button>`}
      <p class="tiny faint center mt16">Mit der Anmeldung gelten die <a href="#" data-a="openLegal" data-id="agb">Nutzungsbedingungen</a> und die <a href="#" data-a="openLegal" data-id="datenschutz">Datenschutzerklärung</a>.</p>
      <button class="linkbtn" style="display:block;margin:6px auto 0" data-a="authMode" data-id="signup">Noch kein Konto? Jetzt erstellen</button>
    </div>`;
    return `<div class="onb onb2">${onbBar()}
      ${mascotHead('Speichere deinen Fortschritt')}
      ${installHint()}
      <div class="consents">
        ${check('terms', `Ich akzeptiere die <a href="#" data-a="openLegal" data-id="agb">Nutzungsbedingungen</a> und habe die <a href="#" data-a="openLegal" data-id="datenschutz">Datenschutzerklärung</a> gelesen.`)}
        ${check('age', 'Ich bin mindestens 13 Jahre alt. Unter 16 nutze ich Brained mit dem Einverständnis meiner Eltern.')}
      </div>
      <div class="${ok ? '' : 'dim'}">
        ${emailForm}
        ${social ? `<div class="divider">oder</div>${social}` : ''}
      </div>
      <button class="linkbtn" style="display:block;margin:10px auto 0" data-a="authMode" data-id="login">Ich habe schon ein Konto</button>
    </div>`;
  }
  if (o.step === 'code') return `<div class="onb">
      <div class="row mb16"><button class="icon-btn plain" data-a="onbBack">${I.back}</button></div>
      <div class="onb-head"><h2>Check dein Postfach</h2></div>
      <p class="onb-sub">Wir haben dir einen <b>6-stelligen Code</b> an <b>${esc(d.email)}</b> geschickt. Gib ihn hier ein. Nichts bekommen? Schau im Spam-Ordner nach.</p>
      <input class="input" style="text-align:center;font-size:30px;font-weight:800;letter-spacing:10px;height:68px" maxlength="6" inputmode="numeric" autocomplete="one-time-code" data-bind="onb.d.code" value="${esc(d.code || '')}" placeholder="••••••"/>
      <button class="btn primary block mt16" data-a="verifyCode" ${o.busy ? 'disabled' : ''}>${o.busy ? 'Prüfe…' : 'Bestätigen'}</button>
      <button class="btn ghost block mt8" data-a="emailLogin">Code nochmals senden</button>
    </div>`;
  if (o.step === 'profile') return `<div class="onb onb2">${onbBar()}
    ${U.onb.d.google ? `<div class="tip mb16">${I.check}<span>Mit Google verbunden – du kannst die Angaben anpassen.</span></div>` : ''}
    ${mascotHead('Wie heisst du?')}
    <div class="field"><label>Vorname & Name</label><input class="input" data-bind="onb.d.name" value="${esc(d.name)}" placeholder="z.B. Lea Meier" autocomplete="name"/></div>
    <div class="field"><label>Benutzername</label><input class="input" data-bind="onb.d.username" value="${esc(d.username)}" placeholder="leameier" autocapitalize="off"/></div>
    <div class="field"><label>Kanton</label><select class="select" data-bind="onb.d.canton">${CANTONS.map(c => `<option ${c === d.canton ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    ${!d.terms || !d.age ? `<div class="consents mt12">
      <button class="consent" data-a="onbConsent" data-k="terms"><span class="cbox ${d.terms ? 'on' : ''}">${d.terms ? '✓' : ''}</span><span>Ich akzeptiere die <a href="#" data-a="openLegal" data-id="agb">Nutzungsbedingungen</a> und habe die <a href="#" data-a="openLegal" data-id="datenschutz">Datenschutzerklärung</a> gelesen.</span></button>
      <button class="consent" data-a="onbConsent" data-k="age"><span class="cbox ${d.age ? 'on' : ''}">${d.age ? '✓' : ''}</span><span>Ich bin mindestens 13 Jahre alt. Unter 16 nutze ich Brained mit dem Einverständnis meiner Eltern.</span></button></div>` : ''}
    <div style="flex:1"></div>
    <button class="btn3d mt16" data-a="onbTo" data-step="avatar">Weiter</button></div>`;
  if (o.step === 'avatar') return `<div class="onb onb2">${onbBar()}
    ${mascotHead('Wähl deinen Avatar')}
    <div class="av-preview"><div class="av-ring">${avatar(d.avatar, 112)}</div>
      <button class="btn ghost sm" data-a="avShuffle">${I.refresh} Zufällig</button></div>
    ${avatarPicker(d.avatar)}
    <div class="faint small center mt8">Kronen, Grillz, Brillen & mehr gibt's später im Shop</div>
    <div style="flex:1"></div>
    <button class="btn3d mt16" data-a="onbTo" data-step="subjects">Sieht gut aus!</button></div>`;
  if (o.step === 'subjects') return `<div class="onb onb2">${onbBar()}
    ${mascotHead('Welche Fächer lernst du?')}
    <div class="chips">${St.subjectsForLevel(d.quiz?.level || d.level, d.subjects).map(s => `<button class="chip-btn ${d.subjects.includes(s.id) ? 'on' : ''}" data-a="onbSubj" data-id="${s.id}"><span class="dot" style="background:${s.color}"></span>${s.emoji} ${esc(s.name)}</button>`).join('')}</div>
    <div class="onb-own mt16"><b>${['fh', 'uni'].includes(d.level) ? 'Deine Module' : 'Eigenes Fach'}</b><span>${['fh', 'uni'].includes(d.level) ? 'Studium? Füg deine Module hinzu – z.B. Analysis I, Makroökonomie, Anatomie.' : 'Fehlt etwas? Füg es hinzu – z.B. Wirtschaft, Musik, Informatik.'}</span>
      <div class="row mt8" style="gap:8px"><input class="input grow" data-bind="onb.d.newSubj" value="${esc(d.newSubj || '')}" placeholder="${['fh', 'uni'].includes(d.level) ? 'z.B. Lineare Algebra' : 'z.B. Informatik'}" maxlength="30" enterkeyhint="done"/><button class="btn primary sm" data-a="onbAddSubj">＋</button></div></div>
    ${BACKEND ? '' : `<button class="card row mt16" style="width:100%;text-align:left" data-a="onbDemo"><div class="grow"><b>Mit Demo-Daten starten</b><div class="faint small" style="margin-top:3px">3 Wochen Beispiel-Sessions, Freunde & Gruppe</div></div><span class="switch ${d.demo ? 'on' : ''}"></span></button>`}
    <div style="flex:1"></div>
    <button class="btn3d mt24" data-a="onbLoad" ${d.subjects.length ? '' : 'disabled'}>Weiter (${d.subjects.length})</button></div>`;
  if (o.step === 'loading') {
    const p = o.load || 0, r = 74, c = 2 * Math.PI * r;
    return `<div class="onb onb2"><div class="loader">
      <h1>Wird vorbereitet…<br><span>Dein Lernprofil</span></h1>
      <div class="load-ring"><svg width="170" height="170"><circle cx="85" cy="85" r="${r}" stroke="var(--surface-3)" stroke-width="12" fill="none"/><circle data-live="loadArc" cx="85" cy="85" r="${r}" stroke="url(#lg)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" data-c="${c}"/>
        <defs><linearGradient id="lg"><stop offset="0" stop-color="#FF4F87"/><stop offset="1" stop-color="#6D5BFF"/></linearGradient></defs></svg>
        <div class="c">${brainSVG({ size: 54 })}<div class="pct" data-live="loadPct">${p}%</div></div></div>
      <div class="load-list">${LOAD_ITEMS.map(([e, t], i) => `<div class="load-item" data-live="loadItem" data-i="${i}"><span class="e">${e}</span><span class="t">${t}</span><span class="ck">✓</span></div>`).join('')}</div>
    </div></div>`;
  }
  return '';
}

export function avatarPicker(a) {
  a = normAvatar(a);
  const skins = BRAIN_SKINS.filter(k => !k.price || St.owns(k.id));
  return `<div class="av-lbl">Farbe</div><div class="av-edit-row">${skins.map(k => `<button class="${sel(a.skin, k.id)}" data-a="avSkin" data-id="${k.id}">${brainSVG({ size: 44, fill: k.fill, fold: k.fold, outline: k.outline })}</button>`).join('')}
      <button data-a="openShop" title="Shop">🛍️</button></div>
    <div class="av-lbl">Gesicht</div><div class="av-edit-row">${BRAIN_MOODS.map(([m]) => `<button class="${sel(a.mood || 'happy', m)}" data-a="avMood" data-id="${m}">${brainSVG({ size: 44, mood: m, fill: '#FFD3E2' })}</button>`).join('')}</div>
    <div class="av-lbl">Hintergrund</div><div class="color-row">${AVATAR_BGS.map(c => `<button class="${sel(a.bg, c)}" style="background:#${c}" data-a="avBg" data-id="${c}"></button>`).join('')}</div>`;
}

/* =================================== SHELL =================================== */
const TOOL_TITLES = { feynman: "Erklär's Brainy", exam: 'Prüfungsgenerator', plan: 'Lernplan', cards: 'Karteikarten', game: 'Spiele' };
function shell() {
  // Brain Jump läuft im Vollbild (ohne Kopfzeile & Tab-Leiste), damit nichts den Spielstand verdeckt
  const g = U.tab === 'ai' && U.ai.tool === 'game' && GM.state();
  if (g && g.id === 'jump' && !g.over) return `<main class="content game-full" data-keep="game-jump">${GM.gameView()}</main>`;
  const st = St.streakInfo();
  let left;
  if (U.tab === 'home') left = `<div class="brandmark"><img src="assets/icon.svg" alt=""/><span>Brained</span></div>`;
  else if (U.tab === 'ai' && U.ai.tool) left = `<button class="icon-btn" data-a="aiBack">${I.back}</button><h1 style="font-size:21px">${TOOL_TITLES[U.ai.tool]}</h1>`;
  else left = `<h1>${{ stats: 'Statistik', rank: 'Rangliste', ai: 'Brainy' }[U.tab]}</h1>`;
  const content = { home: homeView, stats: statsView, rank: rankView, ai: aiView }[U.tab]();
  return `<header class="topbar ${U.tab === 'ai' && U.ai.tool ? 'in-tool' : ''}">${left}
      <button class="streak-pill ${st.current ? (st.atRisk ? 'warn' : '') : 'dead'}" data-a="openSheet" data-type="streak">${I.flame}<span class="num">${st.current}</span></button>
      <button data-a="openProfile">${avatar(S.user.avatar, 40, S.user.name)}</button>
    </header>
    <main class="content" data-keep="tab-${U.tab}${U.ai.tool || ''}">${content}</main>
    ${tabbar()}`;
}
function tabbar() {
  const t = (id, icon, label) => `<button class="tab ${U.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}">${icon}<span>${label}</span></button>`;
  const live = S.timer;
  return `<nav class="tabbar">${t('home', I.home, 'Home')}${t('stats', I.stats, 'Statistik')}
    <div class="tab-start"><button class="${live ? 'live' : ''}" data-a="openTimer" aria-label="Lernsession">${live ? `<span class="live-time" data-live="tabclock">${fmtClock(T.elapsed())}</span>` : I.play}</button></div>
    ${t('rank', I.trophy, 'Rangliste')}${t('ai', `<span class="tab-brain">${brainSVG({ size: 27 })}</span>`, 'Brainy')}</nav>`;
}

/* =================================== HOME =================================== */
function greeting() { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 17 ? 'Hoi' : h < 22 ? 'Guten Abend' : 'Noch wach'; }
function homeView() {
  const st = St.streakInfo(), today = St.todayMin(), wk = St.weekMin(), goal = St.weekGoal();
  const first = S.user.name.split(' ')[0];
  let h = '';
  if (S.timer) {
    const s = St.subj(S.timer.subjectId);
    h += `<button class="card row" style="width:100%;text-align:left;border:2px solid var(--good)" data-a="openTimer">
      <div class="li ico" style="background:${s.color}22;padding:0;border:0;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px">${s.emoji}</div>
      <div class="grow"><b>${S.timer.segStart ? 'Session läuft' : 'Session pausiert'}</b><div class="faint small bold">${esc(s.name)}</div></div>
      <b class="num" style="font-size:22px" data-live="clock">${fmtClock(T.elapsed())}</b></button>`;
  }
  h += `<section class="hero">
    <div class="ring-wrap">${ring(wk / goal, { size: 70, stroke: 8, color: '#fff', track: 'rgba(255,255,255,.25)', inner: `<b style="font-size:15px">${Math.min(999, Math.round(wk / goal * 100))}%</b>` })}</div>
    <div class="greet">${greeting()}, ${esc(first)}</div>
    <h2>${st.todayDone ? 'Stark! Noch eine<br>Runde?' : 'Bereit für deine<br>nächste Session?'}</h2>
    <div class="stats">
      <div><b>${fmtShort(today)}</b><span>Heute</span></div>
      <div><b>${fmtHours(wk)}</b><span>von ${fmtHours(goal)} Woche</span></div>
      <div><b>${st.current} 🔥</b><span>Streak</span></div>
    </div>
    <button class="go" data-a="openTimer">${S.timer ? I.clock : I.play} ${S.timer ? 'Zur laufenden Session' : 'Lernsession starten'}</button>
  </section>`;
  if (st.atRisk) h += `<button class="card row tight" style="width:100%;text-align:left;background:var(--flame-soft)" data-a="openSheet" data-type="streak"><span style="font-size:24px">⏳</span><div class="grow"><b class="small">Deine ${st.current}-Tage-Streak läuft heute ab!</b><div class="tiny muted">Schon 5 Minuten lernen rettet sie.</div></div></button>`;

  // Wochenstreifen
  const ws = St.startOfWeek(Date.now()), dt = St.dayTotals();
  h += `<div class="card"><div class="card-h"><h3>Diese Woche</h3><button class="more" data-a="tab" data-id="stats">Statistik ${I.chev.replace('<svg', '<svg width="14" height="14"')}</button></div>
    <div class="weekstrip">${Array.from({ length: 7 }, (_, i) => {
      const d = St.addDays(ws, i), m = dt[St.dayKey(d)] || 0, isT = St.dayKey(d) === St.dayKey(Date.now());
      const pl = (S.planned || []).filter(p => !p.done && St.dayKey(p.ts) === St.dayKey(d) && p.ts + p.durMin * 60000 > Date.now());
      return `<div class="d ${m >= 5 ? 'done' : ''} ${isT ? 'today' : ''} ${pl.length && m < 5 ? 'plan' : ''}"><span>${WD[new Date(d).getDay()]}</span><div class="c">${m >= 5 ? '🔥' : pl.length ? '📌' : d > Date.now() ? '' : '·'}</div><span class="num">${m ? fmtShort(m).replace(/ 00m$/, '') : pl.length ? fmtShort(pl.reduce((a, p) => a + p.durMin, 0)) : ''}</span></div>`;
    }).join('')}</div>
    ${(() => {
      const up = (S.planned || []).filter(p => !p.done && p.ts + p.durMin * 60000 > Date.now() && p.ts < St.addDays(ws, 7)).sort((a, b) => a.ts - b.ts).slice(0, 3);
      return up.length ? `<div class="up-next"><div class="tiny faint bold mb8">GEPLANT</div>${up.map(p => { const sb = St.subj(p.subjectId), isT = St.dayKey(p.ts) === St.dayKey(Date.now());
        return `<button class="up-row" data-a="openCalDay" data-ts="${St.startOfDay(p.ts)}"><span class="dot" style="background:${sb.color}"></span><b>${isT ? 'Heute' : WD[new Date(p.ts).getDay()]} ${fmtTime(p.ts)}</b><span class="grow">${sb.emoji} ${esc(p.note || sb.name)}</span><span class="faint">${p.durMin} min</span></button>`; }).join('')}</div>` : '';
    })()}</div>`;

  // Challenges (nur aktive + 1 Entdecken-Karte)
  const ch = St.activeChallenges();
  const discover = GLOBAL_CHALLENGES.find(c => !S.joinedChallenges[c.id]);
  h += `<div class="section-t">Challenges <button data-a="statsGoals">Alle</button></div><div class="hscroll">`;
  h += ch.map(challengeCard).join('');
  if (discover) h += `<div class="ch-card" style="background:${discover.grad};opacity:.92"><button class="join" data-a="joinChallenge" data-id="${discover.id}">+ Mitmachen</button><div class="em">${discover.em}</div><h4>${discover.title}</h4><p>${discover.desc}</p><div class="meta"><span>${discover.participants.toLocaleString('de-CH')} machen mit</span></div></div>`;
  h += `<button class="ch-card" style="background:var(--surface);color:var(--ink);border:2px dashed var(--line);align-items:center;justify-content:center;text-align:center;width:150px" data-a="openSheet" data-type="challenge"><div class="em">➕</div><h4>Eigene</h4><p class="muted">Setz dir dein Ziel</p></button></div>`;

  // Freunde heute (kompakte Story-Leiste)
  const ft = St.friendsToday();
  h += `<div class="section-t">Freunde heute <span class="row" style="gap:14px">${ft.length ? '<button data-a="openFollowing">Alle</button>' : ''}<button data-a="openSheet" data-type="friend">+ Hinzufügen</button></span></div>
    ${R.requests?.length ? `<button class="card row tight req-card" style="width:100%;text-align:left" data-a="openRequests"><span style="font-size:24px">📩</span><div class="grow"><b class="small">${R.requests.length === 1 ? '1 Folgeanfrage' : `${R.requests.length} Folgeanfragen`}</b><div class="tiny muted">${esc(R.requests.slice(0, 2).map(r => r.name.split(' ')[0]).join(', '))}${R.requests.length > 2 ? ' …' : ''} möchte dir folgen</div></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>` : ''}
    ${ft.length ? '' : `<button class="card row tight" style="width:100%;text-align:left" data-a="openSheet" data-type="friend"><span style="font-size:24px">👯</span><div class="grow"><b class="small">Noch niemandem gefolgt</b><div class="tiny muted">Such Freunde per Name oder @benutzername</div></div></button>`}
    <div class="stories">${ft.map(u => `<button class="story" data-a="openUser" data-id="${u.id}"><div class="story-ring ${u.live ? 'live' : u.todayMin ? 'on' : ''}">${avatar(u.avatar, 52, u.name)}</div>${u.live ? '<span class="live-dot">LIVE</span>' : ''}<b>${esc(u.name.split(' ')[0])}</b><span>${u.live ? 'lernt gerade' : u.todayMin ? fmtShort(u.todayMin) : '–'}</span></button>`).join('')}</div>`;

  // Feed: kurz halten – 2 Einträge, Rest auf Wunsch
  const items = St.feed();
  const shown = U.feedOpen ? items.slice(0, 12) : items.slice(0, 2);
  h += `<div class="section-t">Aktivitäten</div>`;
  if (!items.length) h += `<div class="empty" style="padding:18px"><div class="e">👋</div><b>Noch keine Aktivitäten</b><div class="small">Folge Freunden oder starte deine erste Session.</div></div>`;
  shown.forEach((it, i) => { h += feedItem(it); if (i === 2 && !St.isPro() && CONFIG.ADS_ENABLED) h += adSlot(i); });
  if (items.length > 2) h += `<button class="btn ghost block sm" data-a="toggleFeed">${U.feedOpen ? 'Weniger anzeigen' : `Mehr anzeigen (${Math.min(12, items.length) - 2})`}</button>`;
  return h;
}

function challengeCard(c) {
  const p = St.challengeProgress(c), pct = Math.min(1, p.value / p.target);
  const val = p.unit === 'min' ? `${fmtHours(p.value)} / ${fmtHours(p.target)}` : `${p.value} / ${p.target}`;
  const grad = c.grad || `linear-gradient(140deg, ${St.subj(c.subjectId).color}, #16131F)`;
  const daysLeft = c.end ? Math.max(0, Math.ceil((c.end - Date.now()) / 86400000)) : 7 - ((new Date().getDay() + 6) % 7);
  return `<div class="ch-card" style="background:${grad}"><div class="em">${c.em || c.emoji || '🎯'}</div><h4>${esc(c.title)}</h4><p>${esc(c.desc || (c.subjectId ? St.subj(c.subjectId).name + ' · ' : '') + fmtHours(c.targetMin) + ' Ziel')}</p>
    <div class="progress"><i style="width:${pct * 100}%"></i></div><div class="meta"><span>${val}</span><span>${pct >= 1 ? 'Geschafft' : `noch ${daysLeft} T.`}</span></div></div>`;
}

function feedItem(it) {
  const s = St.subj(it.subjectId), mine = typeof S.boosts[it.id] === 'string' ? S.boosts[it.id] : S.boosts[it.id] ? '🔥' : null;
  const total = St.reactionTotal(it), top = St.topReactions(it);
  const start = it.ts - it.min * 60000 - 8 * 60000;
  const segs = it.session?.segments || (() => { const a = []; let t = start; const parts = Math.max(1, Math.round(it.min / 30)); const len = it.min * 60000 / parts; for (let k = 0; k < parts; k++) { a.push([t, t + len]); t += len + 4 * 60000; } return a; })();
  return `<article class="feed-item">
    <div class="feed-top"><button data-a="openUser" data-id="${it.user.id}">${avatar(it.user.avatar, 42, it.user.name)}</button>
      <div class="who"><b>${esc(it.own ? 'Du' : it.user.name)}</b><span>${timeAgo(it.ts)} · ${it.user.canton}${it.user.streak ? ` · 🔥 ${it.user.streak}` : ''}</span></div>${subjTag(s)}</div>
    <div class="feed-title">${esc(it.title || `${s.name} – ${['Fokus-Block', 'Deep Work', 'Repetition', 'Prüfungsvorbereitung'][it.min % 4]}`)}</div>
    <div class="feed-stats"><div><span>Dauer</span><b>${fmtShort(it.min)}</b></div><div><span>XP</span><b>+${it.min + (it.pomos || 0) * 5}</b></div>${it.pomos ? `<div><span>Pomodoros</span><b>🍅 ${it.pomos}</b></div>` : ''}</div>
    ${it.own ? focusLine(segs, segs[0][0], segs.at(-1)[1], s.color) : ''}
    ${it.note ? `<p class="feed-note${it.own ? ' mt12' : ''}">${esc(it.note)}</p>` : ''}
    <div class="feed-actions">
      <button class="react-sum" data-a="openSheet" data-type="reactors" data-id="${it.id}" ${total ? '' : 'disabled'}>${top.length ? `<span class="react-stack">${top.map(e => `<i>${e}</i>`).join('')}</span>` : ''}<span>${total ? `${total}` : 'Noch keine Reaktionen'}</span></button>
      <span class="grow"></span>
      ${it.own ? `<button data-a="shareSession" data-id="${it.session?.id}">${I.share} Teilen</button>`
        : `<button class="react-btn ${mine ? 'on' : ''}" data-a="reactOpen" data-id="${it.id}">${mine ? `<span style="font-size:17px">${mine}</span>` : I.heart} ${mine ? 'Reagiert' : 'Reagieren'}</button>`}
    </div>
    ${U.reactOpen === it.id ? `<div class="react-pick">${St.REACTIONS.map((e, i) => `<button class="${mine === e ? 'on' : ''}" style="animation-delay:${i * 30}ms" data-a="react" data-id="${it.id}" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
  </article>`;
}

function adSlot(i) {
  const ad = ADS[i % ADS.length];
  return `<div class="ad"><div class="ad-img" style="background:${ad.bg}">${ad.em}</div><div class="grow"><div class="lbl">Anzeige</div><b class="small">${esc(ad.title)}</b><div class="tiny faint">${esc(ad.sub)}</div></div><button class="btn outline xs" data-a="toast" data-msg="Werbeplatz – hier läuft später ein echtes Inserat">${ad.cta}</button></div>`;
}

/* =================================== TIMER =================================== */
export function timerLive() {
  const t = S.timer; if (!t) return null;
  const el = T.elapsed(), now = Date.now();
  let pct, sub;
  if (t.mode === 'pomo') {
    if (t.status === 'break') { const len = (t.pomo.count % 4 === 0 ? 15 : 5) * 60000; pct = 1 - (t.pomo.breakEnd - now) / len; sub = `☕ Pause · weiter in ${fmtClock(t.pomo.breakEnd - now)}`; }
    else { const f = el - t.pomo.focusStartAcc; pct = f / (25 * 60000); sub = `🍅 Pomodoro #${t.pomo.count + 1} · noch ${fmtClock(25 * 60000 - f)}`; }
  } else if (t.mode === 'goal') { pct = el / (t.goalMin * 60000); sub = t.goalHit ? `🎯 Ziel erreicht! Bonus-Zeit läuft` : `🎯 Ziel ${t.goalMin} min · noch ${fmtClock(t.goalMin * 60000 - el)}`; }
  else { pct = (el % 3600000) / 3600000; sub = `Heute gesamt ${fmtShort(St.todayMin())}`; }
  const nextCheck = S.settings.checkinMin > 0 ? Math.max(0, t.nextCheckinAcc - el) : null;
  return { pct: Math.max(0, Math.min(1, pct)), clock: fmtClock(el), sub, nextCheck };
}

function timerView() {
  if (!S.timer) return timerSetup();
  const t = S.timer, s = St.subj(t.subjectId), L = timerLive();
  const R = 135, C = 2 * Math.PI * R;
  const pill = t.status === 'running' ? `<span class="state-pill"><i></i>Fokus läuft</span>`
    : t.status === 'break' ? `<span class="state-pill break"><i></i>Pomodoro-Pause</span>`
    : `<span class="state-pill paused"><i></i>${{ left: 'Pausiert – App verlassen', away: 'Pausiert – kein Check-in', manual: 'Pausiert' }[t.pauseReason] || 'Pausiert'}</span>`;
  return `<div class="timer-screen">
    <div class="timer-top"><button class="icon-btn" data-a="closeOverlay">${I.down}</button>${subjTag(s)}<button class="icon-btn" data-a="standby" title="Mond-Modus">${I.moon}</button></div>
    <div class="timer-center">
      ${pill}
      <div class="big-ring">
        <svg width="290" height="290"><circle cx="145" cy="145" r="${R}" stroke="var(--surface-2)" stroke-width="14" fill="none"/>
          <circle data-live="ring" data-c="${C}" cx="145" cy="145" r="${R}" stroke="${t.status === 'break' ? 'var(--violet)' : s.color}" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - L.pct)}" style="transition:stroke-dashoffset 1s linear"/></svg>
        <div class="inner"><div style="font-size:30px;margin-bottom:6px">${s.emoji}</div><div class="clock" data-live="clock">${L.clock}</div><div class="clock-sub" data-live="sub">${L.sub}</div></div>
      </div>
      <div class="controls">
        <button class="ctrl stop" data-a="finishTimer" aria-label="Beenden">${I.stop}</button>
        ${t.segStart ? `<button class="ctrl main" data-a="pauseTimer" aria-label="Pause">${I.pause}</button>` : `<button class="ctrl main go" data-a="resumeTimer" aria-label="Weiter">${I.play}</button>`}
        <button class="ctrl" data-a="standby" aria-label="Mond-Modus">${I.moon}</button>
      </div>
    </div>
    <div class="tip mt16">${I.info}<span>${L.nextCheck !== null ? `Nächster «Bist du noch da?»-Check in <b data-live="nextcheck">${fmtShort(L.nextCheck / 60000)}</b>. ` : ''}Verlässt du Brained, pausiert der Timer. Handy weglegen? Tippe auf den Mond – der Bildschirm bleibt dunkel an und die Zeit läuft weiter.</span></div>
  </div>`;
}

function timerSetup() {
  const su = U.setup, subs = St.mySubjects();
  if (!su.subjectId) su.subjectId = subs[0]?.id;
  return `<div class="timer-screen">
    <div class="timer-top"><button class="icon-btn" data-a="closeOverlay">${I.x}</button><b style="font-size:17px">Neue Lernsession</b><div style="width:42px"></div></div>
    <div class="section-t" style="margin-top:14px">Fach</div>
    <div class="subj-grid">${subs.map(s => `<button class="subj-btn ${sel(su.subjectId, s.id)}" style="color:${s.color}" data-a="setupSubj" data-id="${s.id}"><span class="e">${s.emoji}</span><span style="color:var(--ink)">${esc(s.name)}</span></button>`).join('')}
      <button class="subj-btn add" data-a="openSheet" data-type="subjects"><span class="e">＋</span>Fächer</button></div>
    <div class="section-t">Modus</div>
    <div class="mode-cards">
      <button class="mode-card ${sel(su.mode, 'free')}" data-a="setupMode" data-id="free"><span class="e">⏱️</span><b>Stoppuhr</b><span>Frei lernen</span></button>
      <button class="mode-card ${sel(su.mode, 'pomo')}" data-a="setupMode" data-id="pomo"><span class="e">🍅</span><b>Pomodoro</b><span>25 / 5 min</span></button>
      <button class="mode-card ${sel(su.mode, 'goal')}" data-a="setupMode" data-id="goal"><span class="e">🎯</span><b>Zielzeit</b><span>${su.goalMin} min</span></button>
    </div>
    ${su.mode === 'goal' ? `<div class="chips mt12">${[25, 45, 60, 90, 120, 180].map(m => `<button class="chip-btn ${sel(su.goalMin, m)}" data-a="setupGoal" data-m="${m}">${m} min</button>`).join('')}</div>` : ''}
    <div class="tip mt16">${I.info}<span><b>Fair-Play-Regeln:</b> Verlässt du die App, pausiert der Timer automatisch. Alle ${S.settings.checkinMin || '–'} min fragt Brainy «Bist du noch da?». So bleibt die Rangliste ehrlich.</span></div>
    <div style="flex:1;min-height:20px"></div>
    <button class="btn primary block" style="height:62px;font-size:18px" data-a="startTimer">${I.play} Los geht's</button>
  </div>`;
}

function standbyView() {
  const L = timerLive(), s = St.subj(S.timer.subjectId), r = 118, c = 2 * Math.PI * r;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const tip = U.standbyTip ? `<div class="sb-tip" data-a="standbyTipClose" data-self="1"><div class="sb-tip-card">
      <div class="sb-moon-sm">${MOON_SVG}</div><b>Mond-Modus</b>
      <p>Schwarzer Bildschirm${U.dimmed ? ', Helligkeit auf Minimum' : ''}, keine Animationen. Der Timer zählt weiter – auch wenn das Display ausgeht.</p>
      <div class="sb-steps"><div class="sb-step-t">${ios ? 'Einmal einrichten: Fokus automatisch an' : 'Für maximale Ruhe'}</div>
      ${ios ? `<ol><li>App <b>Kurzbefehle</b> öffnen → <b>Automation</b> → <b>＋</b></li><li><b>App</b> wählen → <b>Brained</b> · «Wird geöffnet» → <b>Sofort ausführen</b></li><li>Aktion <b>Fokus festlegen</b> → <b>Nicht stören: Ein</b></li></ol><p class="sb-note">Ab dann ist «Nicht stören» automatisch an, sobald du Brained öffnest. Apple erlaubt Apps nicht, den Fokus selbst einzuschalten – das ist der offizielle Weg.</p>`
        : `<ol><li>Zweimal von oben nach unten wischen</li><li><b>Bitte nicht stören</b> antippen</li><li>Optional: <b>Energiesparmodus</b></li></ol><p class="sb-note">Tipp: Kachel «Bitte nicht stören» in die Schnelleinstellungen ziehen – dann ist es ein Tipp.</p>`}</div>
      <button class="btn3d" data-a="standbyTipClose">Los geht's</button></div></div>` : '';
  return `<div class="standby" data-a="standbyTap">
    <div class="sb-center" data-shift="1">
      <div class="sb-ring"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="${r}" class="trk"/><circle cx="130" cy="130" r="${r}" class="prg" data-live="sbArc" data-c="${c}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - L.pct)}"/></svg>
        <div class="sb-in"><div class="sb-moon">${MOON_SVG}</div><div class="clock" data-live="clock">${L.clock}</div><div class="sb-subj">${s.emoji} ${esc(s.name)}</div></div></div>
      <div class="sb-sub" data-live="sub">${L.sub}</div>
    </div>
    <div class="sb-chips"><span>${S.timer.segStart ? '● läuft' : '❚❚ pausiert'}</span>${U.dimmed ? '<span>☾ gedimmt</span>' : ''}<span>⏻ Display darf ausgehen</span></div>
    <div class="sb-exit"><span class="sb-hold"><i></i></span>Doppelt tippen oder gedrückt halten zum Verlassen</div>${tip}</div>`;
}
const MOON_SVG = '<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><radialGradient id="mg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF7D6"/><stop offset="1" stop-color="#E9D79A"/></radialGradient></defs><path d="M40 6a26 26 0 1 0 18 44A22 22 0 1 1 40 6z" fill="url(#mg)"/><circle cx="30" cy="40" r="3" fill="#D9C27A" opacity=".55"/><circle cx="22" cy="28" r="2" fill="#D9C27A" opacity=".45"/></svg>';

/* =================================== SUMMARY =================================== */
function summaryView() {
  const sm = U.summary, s = sm.session, sb = St.subj(s.subjectId), st = St.streakInfo();
  const streakUp = st.current > sm.streakBefore;
  return `<div class="summary" data-keep="summary">
    <div class="row mb16"><div class="grow"><div class="faint small bold">${fmtDate(s.end, { time: true })}</div><h2 style="font-size:26px;letter-spacing:-.6px;font-weight:800">Session gespeichert</h2></div><button class="icon-btn" data-a="summaryDone">${I.x}</button></div>
    <div class="card">
      <div class="feed-top">${avatar(S.user.avatar, 42, S.user.name)}<div class="who"><b>${esc(S.user.name)}</b><span>${S.user.canton} · ${levelLabel(S.user.level)}</span></div>${subjTag(sb)}</div>
      <input class="input mb12" style="font-weight:800;font-size:16px" data-bind="summary.session.title" value="${esc(s.title)}"/>
      <div class="row" style="gap:24px;margin-bottom:14px">
        <div><div class="faint tiny bold">DAUER</div><div class="big-stat" style="font-size:34px">${fmtShort(s.min)}</div></div>
        <div><div class="faint tiny bold">XP</div><div class="big-stat" style="font-size:34px;color:var(--violet)">+${s.xp}</div></div>
        ${s.pomos ? `<div><div class="faint tiny bold">POMOS</div><div class="big-stat" style="font-size:34px">${s.pomos}</div></div>` : ''}
      </div>
      ${focusLine(s.segments, s.start, s.end, sb.color)}
      <div class="row small bold muted mt12" style="gap:16px"><span>⏸️ ${Math.max(0, s.segments.length - 1)} Pausen</span><span>🙋 ${s.checkins} Check-ins</span><span>🔥 ${st.current} Tage${streakUp ? ' (+1)' : ''}</span></div>
    </div>
    ${streakUp ? `<div class="unlock" style="background:linear-gradient(140deg,#FFE3CC,#FFC59A)"><span class="em">🔥</span><div><b>Streak verlängert: ${st.current} Tage!</b><div class="small">Morgen wieder – sonst ist sie weg.</div></div></div>` : ''}
    ${sm.fresh.map(t => `<button class="unlock" style="width:100%;text-align:left" data-a="openSheet" data-type="trophy" data-id="${t.id}"><span class="em">${t.em}</span><div><b>${t.n > 1 ? `${t.name} – zum ${t.n}. Mal!` : `Trophäe freigeschaltet: ${t.name}`}</b><div class="small">${esc(t.how)}</div></div></button>`).join('')}
    <div class="card">
      <div class="card-h"><h3>Was hast du gelernt?</h3><span class="xp-pill">${I.spark.replace('<svg', '<svg width="15" height="15"')} Recap</span></div>
      <p class="small muted mb12">Schreib 2–3 Stichworte. Brainy macht daraus Karteikarten und fragt dich in den nächsten Tagen ab (Spaced Repetition).</p>
      <textarea class="textarea" data-bind="summary.session.note" placeholder="z.B. Die Ableitung beschreibt die Steigung einer Funktion. Kettenregel: äussere mal innere Ableitung.">${esc(s.note)}</textarea>
      ${sm.cards ? `<div class="mt12">${sm.cards.map(c => `<div class="li" style="padding:10px 0"><div class="t"><b style="white-space:normal">${esc(c.q)}</b><span>${esc(c.a)}</span></div></div>`).join('')}<div class="tip mt8">${I.check}<span>${sm.cards.length} Karten gespeichert – morgen fällig.</span></div></div>`
        : `<button class="btn ghost block mt12" data-a="recapCards" ${sm.loading ? 'disabled' : ''}>${sm.loading ? '<span class="typing"><i></i><i></i><i></i></span> Brainy denkt…' : `${I.spark} Karteikarten generieren`}</button>`}
    </div>
    <div class="row" style="gap:10px"><button class="btn outline grow" data-a="shareSession" data-id="${s.id}">${I.share} Teilen</button><button class="btn primary grow" data-a="summaryDone">Fertig</button></div>
  </div>`;
}

/* =================================== STATS =================================== */
function statsView() {
  const segs = [['overview', 'Übersicht'], ['calendar', 'Kalender'], ['goals', 'Ziele'], ['trophies', 'Trophäen']];
  let h = `<div class="seg mb16">${segs.map(([id, l]) => `<button class="${sel(U.statsSeg, id)}" data-a="statsSeg" data-id="${id}">${l}</button>`).join('')}</div>`;
  h += { overview: statsOverview, calendar: statsCalendar, goals: statsGoals, trophies: trophyShop }[U.statsSeg]();
  return h;
}

function trophyShop() {
  const sub = U.trophySub || 'trophies';
  return `<div class="seg sm mb12"><button class="${sel(sub, 'trophies')}" data-a="trophySub" data-id="trophies">Trophäen</button><button class="${sel(sub, 'shop')}" data-a="trophySub" data-id="shop">Shop · 🪙 ${St.coins()}</button></div>`
    + (sub === 'shop' ? shopView(() => '') : statsTrophies());
}

function statsOverview() {
  const now = Date.now(), week = U.statsRange === 'week';
  const from = week ? St.startOfWeek(now) : St.addDays(St.startOfDay(now), -29);
  const nDays = week ? 7 : 30;
  const days = Array.from({ length: nDays }, (_, i) => St.addDays(from, i));
  const subs = St.allSubjects();
  const range = S.sessions.filter(s => s.start >= from);
  const total = St.minutesIn(from), count = range.length + (S.timer ? 1 : 0);
  const activeDays = days.filter(d => d <= now).length || 1;
  const perDay = days.map(d => {
    const e = St.addDays(d, 1), bySub = {};
    S.sessions.filter(s => s.start >= d && s.start < e).forEach(s => bySub[s.subjectId] = (bySub[s.subjectId] || 0) + s.min);
    if (S.timer && now >= d && now < e) bySub[S.timer.subjectId] = (bySub[S.timer.subjectId] || 0) + T.elapsed() / 60000;
    return { d, bySub, sum: Object.values(bySub).reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(60, ...perDay.map(p => p.sum));
  const bySubject = {}; range.forEach(s => bySubject[s.subjectId] = (bySubject[s.subjectId] || 0) + s.min);
  const subjRows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
  const maxSub = subjRows[0]?.[1] || 1;

  const sg = St.suggestNext();
  let h = sg ? `<div class="suggest"><div class="suggest-ico" style="background:${sg.color}22">${sg.em}</div><div class="grow"><div class="suggest-k">Jetzt sinnvoll</div><b>${esc(sg.title)}</b><span>${esc(sg.sub)}</span></div><button class="btn primary xs" data-a="${sg.action}" data-id="${sg.id || ''}" data-mode="${sg.mode || ''}" data-goal="${sg.goal || ''}">${sg.cta}</button></div>` : '';
  h += `<div class="seg sm mb12" style="width:200px"><button class="${sel(U.statsRange, 'week')}" data-a="statsRange" data-id="week">Diese Woche</button><button class="${sel(U.statsRange, 'month')}" data-a="statsRange" data-id="month">30 Tage</button></div>`;
  h += `<div class="kpis">
    <div class="kpi"><div class="ico" style="background:var(--brand-soft)">⏱️</div><b>${fmtHours(total)}</b><span>Lernzeit</span></div>
    <div class="kpi"><div class="ico" style="background:var(--violet-soft)">📊</div><b>${fmtShort(total / activeDays)}</b><span>Ø pro Tag</span></div>
    <div class="kpi"><div class="ico" style="background:var(--good-soft)">✅</div><b>${count}</b><span>Sessions</span></div></div>`;
  h += `<div class="card"><div class="card-h"><h3>${week ? 'Lernzeit pro Tag' : 'Letzte 30 Tage'}</h3><span class="faint small bold">Ziel ${fmtShort(St.weekGoal() / 7)}/Tag</span></div>
    <div class="chart-bars" style="gap:${week ? 8 : 2}px">${perDay.map(p => `<div class="col ${St.dayKey(p.d) === St.dayKey(now) ? 'today' : ''}"><div class="stack" style="height:${(p.sum / max) * 100}%;${week ? '' : 'border-radius:3px'}">${Object.entries(p.bySub).map(([id, m]) => `<i style="height:${(m / p.sum) * 100}%;background:${St.subj(id).color}"></i>`).join('')}</div>${week ? `<span class="lbl">${WD[new Date(p.d).getDay()]}</span>` : ''}</div>`).join('')}</div>
    <div class="legend">${subjRows.slice(0, 6).map(([id]) => { const s = St.subj(id); return `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`; }).join('')}</div></div>`;

  // Brainy-Analyse
  const lastWeek = St.minutesIn(St.addDays(St.startOfWeek(now), -7), now - 7 * 864e5); // gleicher Zeitpunkt letzte Woche
  const ins = U.aiInsights || localInsights({ sessions: S.sessions, subjects: St.mySubjects(), weekMin: St.weekMin(), lastWeekMin: lastWeek, goal: St.weekGoal() });
  h += `<div class="insight"><h4>${brainSVG({ size: 26 })} Brainy-Analyse ${U.aiInsights ? '<span class="xp-pill" style="height:22px;font-size:11px">KI</span>' : ''}</h4>
    <ul>${ins.slice(0, 5).map(x => `<li><span class="e">${x.e}</span><span>${esc(x.t)}</span></li>`).join('')}</ul>
    <button class="btn sm mt12" style="background:var(--surface)" data-a="aiInsights" ${U.aiInsightsBusy ? 'disabled' : ''}>${U.aiInsightsBusy ? 'Analysiere…' : `${I.spark} Mit KI tiefer analysieren`}</button></div>`;

  // Fächer
  if (subjRows.length) {
    h += `<div class="card"><div class="card-h"><h3>Nach Fach</h3><button class="more" data-a="openSheet" data-type="subjects">Fächer ${I.edit.replace('<svg', '<svg width="14" height="14"')}</button></div>
      <div class="donut-wrap mb16">${donut(subjRows.map(([id, m]) => ({ value: m, color: St.subj(id).color })), { center: `<div><b style="font-size:20px">${fmtHours(total)}</b><div class="tiny faint bold">gesamt</div></div>` })}
      <div class="grow">${subjRows.slice(0, 4).map(([id, m]) => { const s = St.subj(id); return `<div class="small bold mb8"><span style="color:${s.color}">●</span> ${esc(s.name)} <span class="faint">${Math.round(m / total * 100)}%</span></div>`; }).join('')}</div></div>
      ${subjRows.map(([id, m]) => { const s = St.subj(id); return `<div class="subj-row"><span class="nm">${s.emoji} ${esc(s.name)}</span><div class="progress"><i style="width:${m / maxSub * 100}%;background:${s.color}"></i></div><span class="v">${fmtShort(m)}</span></div>`; }).join('')}</div>`;
  }

  // Heatmap 16 Wochen
  const dt = St.dayTotals(), hmStart = St.addDays(St.startOfWeek(now), -15 * 7);
  const cells = Array.from({ length: 16 * 7 }, (_, i) => { const d = St.addDays(hmStart, i), m = dt[St.dayKey(d)] || 0; const lvl = m === 0 ? 0 : m < 30 ? .25 : m < 60 ? .5 : m < 120 ? .75 : 1; return `<i title="${St.dayKey(d)}: ${Math.round(m)} min" style="${d > now ? 'opacity:.25;' : ''}${lvl ? `background:color-mix(in srgb, var(--brand) ${lvl * 100}%, var(--surface-2))` : ''}"></i>`; }).join('');
  const sti = St.streakInfo();
  h += `<div class="card"><div class="card-h"><h3>Konstanz</h3><span class="faint small bold">🔥 ${sti.current} aktuell · 🏅 ${sti.best} Rekord</span></div><div class="heat">${cells}</div></div>`;

  // Tageszeit
  const byHour = Array(24).fill(0); S.sessions.forEach(s => byHour[new Date(s.start).getHours()] += s.min);
  const mh = Math.max(1, ...byHour);
  h += `<div class="card"><div class="card-h"><h3>Wann du lernst</h3></div><div class="chart-bars" style="height:90px;gap:2px">${byHour.map((m, i) => `<div class="col"><div class="stack" style="height:${m / mh * 100}%;min-height:0;border-radius:3px;background:var(--violet)"></div><span class="lbl" style="font-size:9px">${i % 6 === 0 ? i : ''}</span></div>`).join('')}</div></div>`;

  // Letzte Sessions
  const recent = S.sessions.slice(-8).reverse();
  if (recent.length) h += `<div class="section-t">Letzte Sessions</div><div class="list">${recent.map(s => { const sb = St.subj(s.subjectId); return `<button class="li" data-a="openSheet" data-type="session" data-id="${s.id}"><div class="ico" style="background:${sb.color}22">${sb.emoji}</div><div class="t"><b>${esc(s.title || sb.name)}</b><span>${fmtDate(s.start, { time: true })}</span></div><div class="r">${fmtShort(s.min)}</div></button>`; }).join('')}</div>`;
  else h += `<div class="empty"><div class="e">📈</div><b>Noch keine Daten</b>Starte deine erste Session und hier entsteht deine Statistik.</div>`;
  return h;
}

function statsCalendar() {
  const m = new Date(U.calMonth), y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7, daysIn = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) { const d = new Date(y, mo, 1 - offset + i).getTime(); cells.push(d); if (i >= 34 && new Date(d).getMonth() !== mo && i % 7 === 6) break; }
  const sessByDay = {}, planByDay = {};
  S.sessions.forEach(s => (sessByDay[St.dayKey(s.start)] ||= []).push(s));
  S.planned.forEach(p => (planByDay[St.dayKey(p.ts)] ||= []).push(p));
  const today = St.dayKey(Date.now()), selK = St.dayKey(U.calSel);
  let h = `<div class="card"><div class="cal-head"><button class="icon-btn plain" data-a="calMove" data-d="-1">${I.back}</button><b>${MONTHS[mo]} ${y}</b><button class="icon-btn plain" data-a="calMove" data-d="1">${I.chev}</button></div>
    <div class="cal-grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<div class="wd">${d}</div>`).join('')}
    ${cells.map(d => { const k = St.dayKey(d), ss = sessByDay[k] || [], pp = planByDay[k] || []; const subjIds = [...new Set(ss.map(s => s.subjectId))].slice(0, 3);
      return `<button class="cal-day ${new Date(d).getMonth() !== mo ? 'out' : ''} ${k === today ? 'today' : ''} ${k === selK ? 'sel' : ''}" data-a="calSel" data-ts="${d}">${new Date(d).getDate()}<span class="dots">${subjIds.map(id => `<i style="background:${St.subj(id).color}"></i>`).join('')}${pp.length && subjIds.length < 3 ? '<i class="plan"></i>' : ''}</span></button>`; }).join('')}</div>
    <div class="legend"><span><i style="background:var(--brand)"></i>Gelernt (Fachfarbe)</span><span><i style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--ink-2)"></i>Geplant</span></div></div>`;
  const ss = sessByDay[selK] || [], pp = (planByDay[selK] || []).sort((a, b) => a.ts - b.ts);
  h += `<div class="section-t">${fmtDate(U.calSel)} <button data-a="openSheet" data-type="plan">+ Planen</button></div>`;
  if (!ss.length && !pp.length) h += `<div class="empty" style="padding:18px"><div class="e">🗓️</div><b>Nichts geplant</b><div class="small">Plane eine Session oder lass Brainy einen Lernplan erstellen.</div></div>`;
  else {
    h += `<div class="list agenda">`;
    h += pp.map(p => { const s = St.subj(p.subjectId), past = p.ts + p.durMin * 60000 < Date.now(); return `<div class="li"><span class="bar" style="background:repeating-linear-gradient(180deg,${s.color} 0 4px,transparent 4px 7px)"></span><div class="t"><b>${s.emoji} ${esc(s.name)} <span class="faint tiny">· geplant${p.source === 'ai' ? ' von Brainy' : ''}</span></b><span>${fmtTime(p.ts)} · ${p.durMin} min${p.note ? ' · ' + esc(p.note) : ''}</span></div>${past ? '' : `<button class="btn primary xs" data-a="startPlanned" data-id="${p.id}">Start</button>`}<button class="icon-btn plain" style="width:30px;height:30px" data-a="delPlanned" data-id="${p.id}">${I.trash.replace('<svg', '<svg width="17" height="17"')}</button></div>`; }).join('');
    h += ss.map(s => { const sb = St.subj(s.subjectId); return `<button class="li" data-a="openSheet" data-type="session" data-id="${s.id}"><span class="bar" style="background:${sb.color}"></span><div class="t"><b>${sb.emoji} ${esc(s.title || sb.name)}</b><span>${fmtTime(s.start)}–${fmtTime(s.end)} · gelernt</span></div><div class="r">${fmtShort(s.min)}</div></button>`; }).join('');
    h += `</div>`;
  }
  h += `<button class="card row" style="width:100%;text-align:left;background:linear-gradient(140deg,var(--violet-soft),var(--brand-soft))" data-a="aiTool" data-id="plan"><span style="font-size:28px">🗓️</span><div class="grow"><b>Prüfung bald?</b><div class="small muted">Brainy plant dir den Weg bis zum Prüfungstag.</div></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>`;
  return h;
}

function statsGoals() {
  const wk = St.weekMin(), goal = St.weekGoal();
  let h = `<div class="card row" style="gap:16px">${ring(wk / goal, { size: 92, stroke: 11, inner: `<b style="font-size:18px">${Math.round(wk / goal * 100)}%</b>` })}
    <div class="grow"><div class="faint small bold">WOCHENZIEL</div><b style="font-size:22px">${fmtHours(wk)} / ${fmtHours(goal)}</b><div class="small muted mt8" style="margin-top:2px">${wk >= goal ? 'Geschafft!' : `Noch ${fmtShort(goal - wk)} bis Sonntag`}</div>
    <button class="btn ghost xs mt8" data-a="openSheet" data-type="goal">${I.edit.replace('<svg', '<svg width="14" height="14"')} Anpassen</button></div></div>`;
  h += `<div class="section-t">Meine Challenges <button data-a="openSheet" data-type="challenge">+ Neu</button></div>`;
  if (!S.challenges.length) h += `<div class="empty" style="padding:16px"><div class="e">🎯</div><b>Noch keine eigene Challenge</b><div class="small">Z.B. «5 h Mathe bis zur Prüfung am Freitag».</div></div>`;
  else h += `<div class="list">${S.challenges.map(c => { const p = St.challengeProgress({ ...c, kind: 'custom' }), pct = Math.min(1, p.value / p.target); return `<div class="li"><div class="ico" style="background:var(--surface-2)">${c.emoji}</div><div class="t"><b>${esc(c.title)}</b><span>${fmtHours(p.value)} / ${fmtHours(p.target)} · ${c.subjectId ? esc(St.subj(c.subjectId).name) : 'Alle Fächer'}${c.end ? ' · bis ' + fmtDate(c.end) : ''}</span><div class="progress thin mt8 ${pct >= 1 ? 'good' : ''}"><i style="width:${pct * 100}%"></i></div></div><button class="icon-btn plain" style="width:30px" data-a="delChallenge" data-id="${c.id}">${I.trash.replace('<svg', '<svg width="17" height="17"')}</button></div>`; }).join('')}</div>`;
  h += `<div class="section-t">Brained-Challenges</div><div class="list">${GLOBAL_CHALLENGES.map(c => { const j = !!S.joinedChallenges[c.id]; const p = j ? St.challengeProgress(c) : null; return `<div class="li"><div class="ico" style="background:${c.grad};color:#fff">${c.em}</div><div class="t"><b>${c.title}</b><span>${j ? `${p.unit === 'min' ? fmtHours(p.value) + ' / ' + fmtHours(p.target) : p.value + ' / ' + p.target}` : c.participants.toLocaleString('de-CH') + ' Teilnehmende'}</span>${j ? `<div class="progress thin mt8"><i style="width:${Math.min(1, p.value / p.target) * 100}%"></i></div>` : ''}</div><button class="btn ${j ? 'ghost' : 'primary'} xs" data-a="joinChallenge" data-id="${c.id}">${j ? 'Verlassen' : 'Mitmachen'}</button></div>`; }).join('')}</div>`;
  h += `<div class="section-t">Fächer & Farben <button data-a="openSheet" data-type="subjects">Bearbeiten</button></div><div class="chips">${St.mySubjects().map(s => `<span class="chip-btn"><span class="dot" style="background:${s.color}"></span>${s.emoji} ${esc(s.name)}</span>`).join('')}</div>`;
  return h;
}

function statsTrophies() {
  const L = St.levelInfo();
  const earnedKinds = TROPHIES.filter(t => S.trophies[t.id]).length;
  let h = `<div class="level-card"><div class="row" style="gap:14px">${ring(L.pct, { size: 76, stroke: 9, color: '#fff', track: 'rgba(255,255,255,.25)', inner: `<b style="font-size:22px">${L.lvl}</b>` })}
    <div class="grow"><div class="small bold" style="opacity:.85">${L.rank.em} ${L.rank.name.toUpperCase()}</div><b style="font-size:22px">${L.xp.toLocaleString('de-CH')} XP</b>
    <div class="small" style="opacity:.85">Noch ${L.toNext.toLocaleString('de-CH')} XP bis Level ${L.lvl + 1}</div></div></div>
    ${L.nextRank ? `<div class="rank-next">Nächster Rang: <b>${L.nextRank.em} ${L.nextRank.name}</b> ab Level ${L.nextRank.from}</div>` : ''}</div>`;
  h += `<div class="kpis"><div class="kpi center"><b>${St.trophyCount()}</b><span>Trophäen total</span></div><div class="kpi center"><b>${earnedKinds}/${TROPHIES.length}</b><span>Verschiedene</span></div><div class="kpi center"><b>${Math.max(0, ...Object.values(St.trophyMap()), 0)}×</b><span>Rekord</span></div></div>`;
  for (const [g, label] of TROPHY_GROUPS) {
    const list = TROPHIES.filter(t => t.g === g);
    h += `<div class="section-t">${label} <span class="faint" style="text-transform:none;letter-spacing:0">${list.filter(t => S.trophies[t.id]).length}/${list.length}</span></div><div class="trophy-grid">`;
    h += list.map(t => {
      const have = S.trophies[t.id], n = have?.n || 0, d = St.trophyDetail(t.id);
      return `<button class="trophy ${n ? '' : 'locked'}" data-a="openSheet" data-type="trophy" data-id="${t.id}">
        ${n > 1 ? `<span class="t-count">×${n}</span>` : ''}${t.repeat ? '<span class="t-rep" title="Mehrfach holbar">↻</span>' : ''}
        <div class="em">${t.em}</div><b>${t.name}</b>
        ${n ? `<span>${t.repeat ? 'Mehrfach holbar' : 'Freigeschaltet'}</span>` : `<div class="progress thin mt8"><i style="width:${d.pct * 100}%"></i></div>`}</button>`;
    }).join('') + '</div>';
  }
  return h + `<p class="center faint small mt16">XP: 1 pro Lernminute · +5 pro Pomodoro · +3 pro Check-in · +15 Zielzeit · +2 pro Karteikarte · +25 pro Trophäe</p>`;
}

// Trophäen-Leiste für Profile (eigene und fremde)
function trophyStrip(map) {
  const list = TROPHIES.filter(t => map?.[t.id]).sort((a, b) => map[b.id] - map[a.id]);
  if (!list.length) return `<div class="card"><div class="faint tiny bold mb8">TROPHÄEN</div><p class="small muted">Noch keine Trophäen – das kommt!</p></div>`;
  return `<div class="card"><div class="row mb8"><div class="faint tiny bold grow">TROPHÄEN · ${list.reduce((a, t) => a + map[t.id], 0)}</div><span class="tiny faint bold">${list.length} verschiedene</span></div>
    <div class="t-strip">${list.map(t => `<div class="t-chip" title="${esc(t.name)}"><span class="e">${t.em}</span>${map[t.id] > 1 ? `<b>×${map[t.id]}</b>` : ''}<small>${esc(t.name)}</small></div>`).join('')}</div></div>`;
}

/* =================================== RANGLISTE =================================== */
function rankView() {
  const tot = St.totalMin(), L = St.leagueFor(tot), N = St.nextLeague(tot);
  let h = `<button class="league" style="background:${L.grad}" data-a="openSheet" data-type="leagues"><div class="medal">${L.emoji}</div><div class="grow"><b>${L.name}</b><span>${N ? `Noch ${fmtHours(N.min - tot)} Lernzeit bis ${N.name}` : 'Höchste Liga erreicht – Legende!'}</span>
    <div class="progress thin mt8" style="background:rgba(255,255,255,.25)"><i style="background:#fff;width:${N ? Math.min(100, (tot - L.min) / (N.min - L.min) * 100) : 100}%"></i></div></div>${I.chev.replace('<svg', '<svg class="chev" style="color:#fff;opacity:.8"')}</button>`;
  h += `<div class="seg mb12">${[['global', 'Schweiz'], ['friends', 'Freunde'], ['group', 'Gruppen']].map(([id, l]) => `<button class="${sel(U.rankScope, id)}" data-a="rankScope" data-id="${id}">${l}</button>`).join('')}</div>`;
  h += `<div class="row mb12"><div class="seg sm grow">${[['week', 'Woche'], ['month', 'Monat'], ['all', 'Allzeit']].map(([id, l]) => `<button class="${sel(U.rankPeriod, id)}" data-a="rankPeriod" data-id="${id}">${l}</button>`).join('')}</div>
    ${U.rankScope === 'global' ? `<select class="select" style="width:104px;height:38px;border-radius:12px;font-size:14px;font-weight:700" data-a-change="rankCanton"><option value="">Alle</option>${CANTONS.map(c => `<option ${c === U.rankCanton ? 'selected' : ''}>${c}</option>`).join('')}</select>` : ''}
    ${U.rankScope === 'friends' ? `<button class="btn primary sm" data-a="openSheet" data-type="friend">${I.userPlus.replace('<svg', '<svg width="17" height="17"')} Hinzufügen</button>` : ''}</div>`;

  let groupId = null;
  if (U.rankScope === 'group') {
    if (!S.groups.length) return h + `<div class="empty"><div class="e">🏫</div><b>Noch in keiner Gruppe</b><div class="small mb16">Erstell eine Gruppe für deine Klasse, Lerngruppe oder WG – oder tritt mit einem Code bei.</div>
      <div class="row" style="justify-content:center"><button class="btn primary sm" data-a="openSheet" data-type="groupCreate">Gruppe erstellen</button><button class="btn outline sm" data-a="openSheet" data-type="groupJoin">Code eingeben</button></div></div>`;
    groupId = U.rankGroup && S.groups.some(g => g.id === U.rankGroup) ? U.rankGroup : S.groups[0].id;
    const g = S.groups.find(g => g.id === groupId), gm = St.groupWeekMin(g);
    h += `<div class="hscroll" style="margin-bottom:6px">${S.groups.map(x => `<button class="chip-btn ${sel(x.id, groupId)}" data-a="rankGroup" data-id="${x.id}">${x.emoji} ${esc(x.name)}</button>`).join('')}<button class="chip-btn" data-a="openSheet" data-type="groupCreate">＋ Neu</button><button class="chip-btn" data-a="openSheet" data-type="groupJoin">Beitreten</button></div>
      <div class="card"><div class="group-card"><div class="group-em" style="background:${g.color}22">${g.emoji}</div><div class="grow"><b style="font-size:17px">${esc(g.name)}</b><div class="small faint bold">${g.members.length + 1} Mitglieder · Code ${g.code}</div></div><button class="btn primary sm" data-a="openSheet" data-type="invite" data-id="${g.id}">${I.share.replace('<svg', '<svg width="16" height="16"')} Einladen</button></div>
        <div class="row mt16 small bold"><span class="grow">Gruppen-Wochenziel</span><span class="num">${fmtHours(gm)} / ${g.weeklyGoalH} h</span></div><div class="progress mt8 good"><i style="width:${Math.min(100, gm / (g.weeklyGoalH * 60) * 100)}%"></i></div>
        <p class="tiny faint mt8">Gemeinsames Ziel: Alle Minuten der Gruppe zählen zusammen.</p></div>`;
  }
  const list = St.leaderboard({ scope: U.rankScope, period: U.rankPeriod, groupId, canton: U.rankCanton });
  if (U.rankScope === 'friends' && list.length <= 1) h += `<div class="empty"><div class="e">👯</div><b>Lad deine Freunde ein</b><div class="small">Zusammen lernen motiviert – und macht Ranglisten spannend.</div></div>`;
  const top = list.slice(0, 3);
  if (top.length >= 3) {
    const pod = (u, n) => `<button class="pod p${n}" data-a="openUser" data-id="${u.id}">${n === 1 ? '<span class="crown">👑</span>' : ''}<div class="${n === 1 ? 'av-ring' : ''}">${avatar(u.avatar, n === 1 ? 66 : 54, u.name)}</div><span class="name">${esc(u.isMe ? 'Du' : u.name.split(' ')[0])}</span><span class="val">${fmtShort(u.value)}</span><div class="block">${n}</div></button>`;
    h += `<div class="podium">${pod(top[1], 2)}${pod(top[0], 1)}${pod(top[2], 3)}</div>`;
  }
  const rest = top.length >= 3 ? list.slice(3) : list;
  const shown = rest.slice(0, 25), meRow = list.find(u => u.isMe);
  h += `<div class="list">${shown.map(rankRow).join('')}${meRow && !shown.includes(meRow) && !top.includes(meRow) ? `<div class="li faint center small" style="justify-content:center">· · ·</div>${rankRow(meRow)}` : ''}</div>`;
  h += `<p class="center faint tiny mt8">Rangliste zählt nur verifizierte Zeit (Auto-Pause + Check-ins). Max. 14 h/Tag.</p>`;
  return h;
}
function leagueTag(min) { const L = St.leagueFor(min || 0); return `<span class="lg-tag lg-${L.fam}">${L.emoji} ${L.name}</span>`; }
function rankRow(u) {
  return `<button class="li ${u.isMe ? 'me' : ''}" data-a="openUser" data-id="${u.id}"><span class="rank-n">${u.rank}</span>${avatar(u.avatar, 42, u.name)}
    <div class="t"><b>${esc(u.isMe ? `${u.name} (Du)` : u.name)}</b><div class="mini-stats">${leagueTag(u.allMin)}<span>🏆 ${u.trophies}</span><span>${u.canton}</span></div></div><div class="r">${fmtShort(u.value)}</div></button>`;
}

/* =================================== BRAINY (KI) =================================== */
function aiView() {
  const a = U.ai;
  const views = { feynman: feynmanView, exam: examView, plan: planView, cards: cardsView, game: () => GM.gameView() || cardsView() };
  if (views[a.tool]) return views[a.tool]();
  const due = St.dueCards().length;
  const plans = (S.studyPlans || []).filter(p => p.examTs >= St.startOfDay(Date.now()));
  const bestGame = Math.max(0, ...GM.GAMES.map(g => GM.best(g.id)));
  return `<section class="ai-hero compact"><div class="brainy">${brainSVG({ size: 58, fill: '#E3DEFF', fold: '#8C7BFF' })}</div>
      <div class="grow"><h2>Lernen statt abschreiben.</h2><p>Brainy gibt dir keine fertigen Lösungen – Brainy findet deine Lücken und trainiert genau die.</p>
      ${SHOWCASE || BACKEND ? '' : `<button class="xp-pill mt8" style="background:rgba(255,255,255,.2);color:#fff;height:26px;font-size:12px;white-space:nowrap" data-a="openSheet" data-type="apikey">${hasKey() ? '● Claude verbunden' : '○ Demo · Claude verbinden'}</button>`}</div></section>
  <button class="exam-feature" data-a="aiTool" data-id="exam">
    <div class="row"><span class="xp-pill" style="background:rgba(255,255,255,.22);color:#fff;height:24px;font-size:11px">PRÜFUNGSGENERATOR</span></div>
    <h3>Probeprüfung wie echt</h3><p>Für die Schweiz, Deutschland und Österreich – gleiche Dauer, gleiche Aufgabentypen, gleiche Punkte wie die echte Prüfung. Als PDF mit Deckblatt, Notenskala und Lösungsschlüssel.</p>
    <div class="row mt12" style="gap:6px;flex-wrap:wrap">${typesOf('CH').slice(0, 5).map(t => `<span class="exam-chip">${t.em} ${t.name.replace(/ \(.*\)$/, '')}</span>`).join('')}<span class="exam-chip">+ Deutschland & Österreich</span></div>
    <span class="btn xs mt12" style="background:#fff;color:#3F2FD1">Prüfung erstellen →</span>
    ${(S.exams || []).length ? `<div class="exam-last">Letzte Note: <b>${S.exams.at(-1).grade.toFixed(1)}</b> · ${S.exams.length} ${S.exams.length === 1 ? 'Probeprüfung' : 'Probeprüfungen'}</div>` : ''}
  </button>
  <div class="brainy-tools">
    <button class="btool" data-a="aiTool" data-id="feynman"><div class="e" style="background:var(--brand-soft)">🧑‍🏫</div><div class="grow"><b>Erklär's Brainy</b><span>Erklär ein Thema – auch per Sprachmemo. Brainy findet deine Lücken.</span></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>
    <button class="btool" data-a="aiTool" data-id="cards"><div class="e" style="background:var(--flame-soft)">🃏</div><div class="grow"><b>Karteikarten & Spiele</b><span>${due ? `<b class="due">${due} fällig</b> · ` : ''}${S.flashcards.length} Karten · 3 Spiele${bestGame ? ` · Rekord ${bestGame}` : ''}</span></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>
    <button class="btool" data-a="aiTool" data-id="plan"><div class="e" style="background:var(--good-soft)">🗓️</div><div class="grow"><b>Lernplan</b><span>${plans.length ? `${plans.length} aktiv · nächste Prüfung ${fmtDate(Math.min(...plans.map(p => p.examTs)))}` : 'Von heute bis zur Prüfung – direkt im Kalender'}</span></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>
  </div>
  <p class="center faint tiny mt8">Prüfen → Lücken als Karten → Spielen & Wiederholen → Erklären. Fehler werden automatisch zu neuen Karten.</p>`;
}

function subjChips(cur, action = 'aiSubj') {
  return `<div class="chips">${St.mySubjects().map(s => `<button class="chip-btn ${sel(cur, s.id)}" data-a="${action}" data-id="${s.id}"><span class="dot" style="background:${s.color}"></span>${s.emoji} ${esc(s.name)}</button>`).join('')}<button class="chip-btn add" data-a="moreSubjects">＋ Fächer</button></div>`;
}

const FEYN_TOPICS = ['Photosynthese', 'Satz des Pythagoras', 'Angebot & Nachfrage', 'Passé composé', 'Zellteilung', 'Kaufvertrag (OR)', 'Prozentrechnen', 'Französische Revolution'];
function feynMood(m) { return m >= 100 ? 'love' : m >= 70 ? 'wow' : m >= 35 ? 'grin' : 'think'; }
function feynmanView() {
  const a = U.ai, P = PERSONAS[a.persona || 'kid'];
  if (a.phase === 'setup') {
    const recent = (S.feynHistory || []).slice(-3).reverse();
    return `<div class="feyn-hero">${brainSVG({ size: 74, mood: 'think' })}<div><b>Erklär's Brainy</b><p>Wenn du es erklären kannst, hast du es verstanden. Brainy hört zu, bohrt nach – und zeigt live, wie viel schon ankommt.</p></div></div>
      <div class="field"><label>Was erklärst du?</label><input class="input big-input" data-bind="ai.topic" value="${esc(a.topic || '')}" placeholder="z.B. Photosynthese" enterkeyhint="go"/></div>
      <div class="chips mb12">${FEYN_TOPICS.filter(t => t !== a.topic).slice(0, 6).map(t => `<button class="chip-btn sm" data-a="feynTopic" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="field"><label>Wem erklärst du es?</label><div class="persona-cards">${Object.entries(PERSONAS).map(([id, p]) => `<button class="persona ${sel(a.persona || 'kid', id)}" data-a="feynPersona" data-id="${id}"><span class="e">${p.em}</span><b>${p.short}</b><span>${p.desc}</span></button>`).join('')}</div></div>
      <button class="btn primary block mt8" data-a="feynStart">Duell starten</button>
      <p class="center tiny faint mt8">Tippen oder per Sprachmemo erklären – Brainy fragt nach, bis jede Lücke sichtbar ist.</p>
      ${recent.length ? `<div class="section-t">Zuletzt erklärt</div><div class="list">${recent.map(r => `<button class="li" data-a="feynTopic" data-t="${esc(r.topic)}" style="width:100%;text-align:left"><div class="ico" style="background:var(--violet-soft)">${PERSONAS[r.persona]?.em || '🧒'}</div><div class="t"><b>${esc(r.topic)}</b><span>${fmtDate(r.ts)}</span></div><div class="grade-pill ${r.score >= 80 ? 'good' : r.score >= 55 ? 'mid' : 'bad'}">${r.score}</div></button>`).join('')}</div>` : ''}`;
  }
  if (a.phase === 'result') {
    const r = a.result;
    return `<div class="card center"><div style="display:flex;justify-content:center">${ring(r.score / 100, { size: 120, stroke: 12, color: r.score >= 80 ? 'var(--good)' : r.score >= 55 ? 'var(--gold)' : 'var(--brand)', inner: `<div><b style="font-size:32px">${r.score}</b><div class="tiny faint bold">/ 100</div></div>` })}</div>
      <h3 class="mt12" style="font-size:20px">${r.score >= 80 ? 'Mini-Prof! Du hast es drauf' : r.score >= 55 ? 'Solide – mit ein paar Lücken' : 'Da geht noch was!'}</h3><p class="small muted mt8">${esc(a.topic)} · erklärt für ${P.em} ${P.short}</p>
      ${(a.meterHist || []).length > 1 ? `<div class="meter-spark mt12">${a.meterHist.map(v => `<i style="height:${Math.max(6, v)}%"></i>`).join('')}</div><div class="tiny faint bold mt8">Verständnis-Verlauf</div>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Das sitzt</h3></div>${(r.good || []).map(x => `<p class="small mb8">• ${esc(x)}</p>`).join('')}</div>
      <div class="card"><div class="card-h"><h3>Deine Lücken</h3></div>${(r.gaps || []).map(x => `<p class="small mb8">• ${esc(x)}</p>`).join('')}</div>
      <div class="tip mb16">${I.spark}<span>${esc(r.tip)}</span></div>
      ${r.cards?.length ? `<button class="btn primary block mb12" data-a="feynCards" ${a.cardsSaved ? 'disabled' : ''}>${a.cardsSaved ? '✓ Gespeichert' : `${r.cards.length} ${r.cards.length === 1 ? 'Lücke' : 'Lücken'} als Karteikarten speichern`}</button>` : ''}
      <div class="row" style="gap:8px"><button class="btn outline grow" data-a="feynAgain">Nochmals – gleiche Person</button><button class="btn ghost grow" data-a="aiTool" data-id="feynman">Neues Thema</button></div>`;
  }
  const userTurns = a.msgs.filter(m => m.role === 'user').length, m = a.meter || 0;
  return `<div class="feyn-top"><div class="feyn-brain">${brainSVG({ size: 46, mood: feynMood(m) })}</div><div class="grow">
      <div class="row"><b class="grow small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.topic)}</b><span class="tiny faint bold">${P.em} ${P.short}</span></div>
      <div class="meter mt8"><i style="width:${m}%"></i></div><div class="row tiny bold mt8"><span class="grow faint">${m >= 100 ? 'Verstanden!' : m >= 70 ? 'Fast da …' : m >= 35 ? 'Es wird klarer' : 'Brainy ist noch verwirrt'}</span><span class="num">${m}%</span></div></div></div>
    <div class="chat">${a.msgs.map(x => `<div class="msg ${x.role === 'ai' ? 'ai' : 'me'}">${x.role === 'ai' ? `<div class="msg-who">${brainSVG({ size: 18 })} Brainy${x.delta ? ` <span class="delta ${x.delta > 0 ? 'up' : 'down'}">${x.delta > 0 ? '+' : ''}${x.delta}%</span>` : ''}</div>` : ''}${esc(x.text)}</div>`).join('')}
      ${a.busy ? `<div class="msg ai"><span class="typing"><i></i><i></i><i></i></span></div>` : ''}</div>
    ${a.error ? `<div class="tip mb8" style="color:#c0392b">${esc(a.error)}</div>` : ''}
    ${listening() ? `<div class="rec-hint"><span class="rec-dot"></span> Ich höre zu … sprich ganz normal. Tippe auf Stopp zum Beenden.</div>` : ''}
    <div class="composer"><textarea class="textarea" rows="1" data-bind="ai.draft" data-live="feynDraft" placeholder="Erklär es Brainy…" ${a.busy ? 'disabled' : ''}>${esc(a.draft || '')}</textarea>
      ${voiceSupported() ? `<button class="mic ${listening() ? 'on' : ''}" data-a="feynVoice" ${a.busy ? 'disabled' : ''} aria-label="Sprachmemo">${listening() ? '⏹' : '🎤'}</button>` : ''}
      <button class="send" data-a="feynSend" ${a.busy ? 'disabled' : ''}>${I.send}</button></div>
    <button class="btn ${m >= 70 || userTurns >= 4 ? 'primary' : 'ghost'} block mt8 sm" data-a="feynScore" ${a.busy || userTurns < 2 ? 'disabled' : ''}>${userTurns < 2 ? `Noch ${2 - userTurns} ${2 - userTurns === 1 ? 'Erklärung' : 'Erklärungen'} bis zur Bewertung` : 'Fertig – bewerten lassen'}</button>
    ${voiceSupported() ? `<p class="tiny faint mt8">Die Spracherkennung deines Handys (Apple/Google) wandelt dein Memo in Text um. Brained speichert keine Aufnahme – nur der Text geht beim Senden an Brainy.</p>` : ''}`;
}

// ---------- Prüfungsgenerator ----------
export function examTypeOf(id) { return EXAM_TYPES.find(t => t.id === id) || EXAM_TYPES.at(-1); }
function examSubjects(type) {
  const all = St.allSubjects();
  return type.subjects ? type.subjects.map(id => all.find(s => s.id === id)).filter(Boolean) : St.mySubjects();
}
// Selbstkorrektur: eingetragene Punkte pro Aufgabe → Schweizer Note
export function examScore(a) {
  const ex = a.exam, max = examTotal(ex);
  const earned = Math.round((a.pts || []).reduce((s, x) => s + (+x || 0), 0) * 2) / 2;
  const pct = max ? earned / max : 0, scale = ex.scale || 'ch';
  // grade = Schweizer Vergleichswert (Statistik/Trophäen), shown = Note in der Skala des Landes
  return { max, earned, pct, grade: swissGrade(pct), shown: scale === 'ch' ? swissGrade(pct).toFixed(1) : gradeFor(pct, scale), scale };
}
const txt = s => esc(s).replace(/\n/g, '<br>');
// Prüfungsblatt als Vorschau (gleicher Aufbau wie das PDF)
function examPaper(ex, sol) {
  const total = examTotal(ex);
  const cover = `<div class="pp-head"><div><b>${esc(ex.kicker)}</b><span>Probeprüfung</span></div><div class="r"><b>${esc(ex.title)}</b><span>${sol ? 'Lösungsschlüssel' : esc(ex.series)}</span></div></div>
    <div class="pp-title"><h2>${esc(ex.title)}</h2><b>${sol ? 'Lösungen' : esc(ex.series)}</b></div>
    ${sol ? '' : `<div class="pp-kv"><span>Prüfungsdauer:</span><b>${ex.minutes} Minuten</b><span>Hilfsmittel:</span><b>${esc(ex.aids)}</b><span>Punkte total:</span><b>${total}</b></div>
    <div class="pp-rules"><b>${ex.formal ? 'Beachten Sie:' : 'Beachte:'}</b><ol>${ex.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>
    <div class="pp-fill"><span>Name</span><i></i><span>Vorname</span><i></i><span>Kand.-Nr.</span><i></i></div>`}
    <table class="pp-tab"><tr><th>Aufgabe</th><th>Thema</th><th>Punkte</th>${sol ? '' : '<th>Erzielt</th>'}</tr>${ex.tasks.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.title)}</td><td>${taskPoints(t)}</td>${sol ? '' : '<td></td>'}</tr>`).join('')}<tr class="tot"><td></td><td>Total</td><td>${total}</td>${sol ? '' : '<td></td>'}</tr></table>
    <div class="pp-scale-t">Notenskala</div><div class="pp-scale">${gradeScale(total, ex.scale).map(g => `<div><span>${g.range}</span><b>${g.grade}</b></div>`).join('')}</div>`;
  const mat = sol ? '' : ex.material.map(m => `<div class="pp-mat"><b>${esc(m.title)}</b><p>${txt(m.text)}</p></div>`).join('');
  let part = '';
  const tasks = ex.tasks.map((t, i) => {
    const pt = t.part && t.part !== part ? (part = t.part, `<div class="pp-part">${esc(t.part)}</div>`) : '';
    return `${pt}<div class="pp-task"><div class="pp-th"><b>Aufgabe ${i + 1}</b><span class="grow">${esc(t.title)}</span><span>${taskPoints(t)} ${taskPoints(t) === 1 ? 'Punkt' : 'Punkte'}</span></div>
      ${t.intro ? `<p class="pp-intro">${txt(t.intro)}</p>` : ''}
      ${t.table ? `<table class="pp-tab pp-data">${t.table.head?.length ? `<tr>${t.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>` : ''}${t.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : ''}
      ${t.figure ? figureSVG(t.figure) : ''}
      ${t.items.map(it => `<div class="pp-item"><div class="pp-q">${it.label ? `<b>${esc(it.label)})</b>` : ''}<span class="grow">${txt(it.q)}</span><em>(${it.points} P.)</em></div>
        ${it.options ? `<div class="pp-opts">${it.options.map((o, k) => `<div class="${sol && it.correct?.includes(k) ? 'ok' : ''}"><i>${sol && it.correct?.includes(k) ? '✕' : ''}</i>${esc(o)}</div>`).join('')}</div>` : ''}
        ${sol ? `<div class="pp-sol">${txt(it.solution)}${it.rubric ? `<div class="pp-rub">${esc(it.rubric)}</div>` : ''}</div>` : it.options ? '' : `<div class="pp-space ${t.answer}" style="height:${Math.min(it.space, 10) * (t.answer === 'grid' ? 10 : 12)}px"></div>`}</div>`).join('')}</div>`;
  }).join('');
  return `<div class="paper">${cover}${mat}${tasks}<div class="pp-foot">Probeprüfung erstellt mit Brained – keine offizielle Prüfung.</div></div>`;
}
function examView() {
  const a = U.ai, type = examTypeOf(a.typeId);
  if (a.phase === 'setup') {
    const docs = (S.examDocs || []).slice().reverse();
    const step = (n, t) => `<div class="step-t"><span class="step-n">${n}</span>${t}</div>`;
    const co = a.country || 'CH', C = COUNTRIES[co], rg = C.regions[a.region] ? a.region : (C.regions.ALL ? 'ALL' : Object.keys(C.regions)[0]);
    const types = typesOf(co), school = a.etype === 'school', T = types.find(t => t.id === a.etype) || types[0];
    const ex = school ? null : examFor(co, rg, T.id);
    if (ex) { a.dbId = ex.id; a.region = rg; a.etype = T.id; } else a.dbId = 'school';
    const keys = ex ? Object.keys(ex.subjects) : [];
    if (ex && !keys.includes(a.subjKey)) a.subjKey = keys[0];
    const sj = ex?.subjects[a.subjKey];
    const mm = sj ? sj.minutes : 45;
    const lengths = [['short', 'Kurz', 'Ausschnitt', `${Math.max(15, Math.round(mm * .35 / 5) * 5)} min`], ['standard', 'Halbe Prüfung', 'die Hälfte', `${Math.max(15, Math.round(mm * .6 / 5) * 5)} min`], ['real', 'Wie echt', 'volle Prüfung', `${mm} min`]];
    const subjName = k => (sj && k === a.subjKey ? sj.title : ex.subjects[k].title);
    return `<div class="exam-hero"><div class="row"><span style="font-size:30px">📄</span><div class="grow"><b>Prüfungsgenerator</b><p>Probeprüfungen wie echt – mit gleicher Dauer, gleichen Aufgabentypen und gleichen Punkten wie die echte Prüfung. Mit Lösungsschlüssel, als PDF.</p></div></div></div>
      ${step(1, 'Land')}
      <div class="seg">${Object.entries(COUNTRIES).map(([k, c]) => `<button class="${sel(co, k)}" data-a="examCountry" data-id="${k}">${c.name}</button>`).join('')}</div>
      ${Object.keys(C.regions).length > 1 ? `${step(2, C.region)}
      <select class="select" data-a-change="examRegion">${Object.entries(C.regions).map(([k, n]) => `<option value="${k}" ${k === rg ? 'selected' : ''}>${n}</option>`).join('')}</select>` : `<p class="faint small mt8">In ${C.name} sind diese Prüfungen in allen Bundesländern gleich aufgebaut.</p>`}
      ${step(Object.keys(C.regions).length > 1 ? 3 : 2, 'Welche Prüfung?')}
      <div class="exam-types">${types.map(t => `<button class="exam-type ${sel(a.etype || types[0].id, t.id)}" data-a="examType2" data-id="${t.id}"><span class="e">${t.em}</span><b>${esc(t.name)}</b><span>${esc(t.stage)}</span></button>`).join('')}
        <button class="exam-type ${school ? 'on' : ''}" data-a="examType2" data-id="school"><span class="e">✏️</span><b>Klassenprüfung</b><span>Eigenes Thema, ohne offizielle Vorlage</span></button></div>
      ${ex ? `${step(4, 'Fach')}
      <div class="chips">${keys.map(k => `<button class="chip-btn ${sel(a.subjKey, k)}" data-a="examSubj" data-id="${k}">${esc(subjName(k))} · ${ex.subjects[k].minutes}′</button>`).join('')}</div>
      ${ex.official ? `<div class="facts mt12"><div class="facts-h">So ist die echte Prüfung aufgebaut <span class="ok-badge">✓ offizielle Daten</span></div>
        <div class="facts-grid"><div><span>Dauer</span><b>${sj.minutes} min</b></div><div><span>Aufgaben</span><b>${sj.structure?.tasks || '–'}</b></div><div><span>Punkte</span><b>${sj.structure?.total || '–'}</b></div><div><span>Anrede</span><b>${sj.form === 'Sie' ? 'Sie' : 'du'}</b></div></div>
        <p><b>Hilfsmittel:</b> ${esc(sj.aids)}</p>
        ${sj.material ? `<p><b>Material:</b> ${esc(sj.material.kind)}, ca. ${esc(sj.material.words)} Wörter</p>` : ''}
        <details class="facts-more"><summary>Typische Aufgaben (${sj.archetypes.length})</summary><ol>${sj.archetypes.map(x => `<li>${esc(x)}</li>`).join('')}</ol></details>
        <p class="faint"><b>Bewertung:</b> ${esc(ex.grading || '')} ${esc(ex.pass || '')}</p>
        <p class="faint">Quelle: ${esc(ex.owner)}${sj.years ? ` · ausgewertet ${esc(sj.years)}` : ''}</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">${ex.archive ? `<a class="btn outline xs" href="${ex.archive.url}" target="_blank" rel="noopener">Originale ansehen</a>` : ''}${ex.requirements ? `<a class="btn ghost xs" href="${ex.requirements.url}" target="_blank" rel="noopener">Prüfungsanforderungen</a>` : ''}</div></div>`
      : `<div class="facts mt12 facts-na"><div class="facts-h">${ex.note ? 'Übliches Format' : 'Offizielle Infos nicht verfügbar'} <span class="na-badge">${ex.note ? 'Richtwerte' : ex.region === 'ALL' ? 'Kanton' : esc(ex.canton)}</span></div>
        ${ex.note ? `<p>${esc(ex.note)}</p>` : `<p>${ex.region === 'ALL' ? 'Für diese Prüfung in deinem Kanton' : `Für diese Prüfung in ${esc(ex.canton)}`} liegen keine ausgewerteten offiziellen Unterlagen vor. Brainy erstellt sie im üblichen Format – oder du übst mit einer alten Prüfung.</p>`}
        ${ex.note ? `<div class="facts-grid"><div><span>Dauer</span><b>${sj.minutes} min</b></div><div><span>Aufgaben</span><b>${sj.structure?.tasks ? 'ca. ' + sj.structure.tasks : '–'}</b></div><div><span>Teile</span><b>${sj.sections?.length || 1}</b></div><div><span>Anrede</span><b>${sj.form === 'Sie' ? 'Sie' : 'du'}</b></div></div>` : ''}
        ${ex.links?.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${ex.links.map(l => `<a class="btn ghost xs" href="${l.url}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>` : ''}</div>`}`
      : `${step(4, 'Fach & Thema')}
      <div class="chips">${St.mySubjects().map(x => `<button class="chip-btn ${sel(a.subjectId, x.id)}" data-a="aiSubj" data-id="${x.id}"><span class="dot" style="background:${x.color}"></span>${x.emoji} ${esc(x.name)}</button>`).join('')}</div>
      <div class="tip mt12">${I.info}<span>Klassenprüfungen haben keine offizielle Vorlage – Brainy richtet sich nach dem Lehrplan und deinem Thema.</span></div>
      <div class="field mt12"><label>Thema</label><input class="input" data-bind="ai.topic" value="${esc(a.topic || '')}" placeholder="z.B. Bruchrechnen, Kaufvertrag, Passé composé"/></div>`}
      ${step(5, 'Grundlage')}
      <div class="src-cards">
        <button class="src ${!a.wantUpload ? 'on' : ''}" data-a="examSource" data-id="ai"><span class="e">✨</span><b>Mit KI erstellen</b><span>${ex?.official ? 'Neue Aufgaben nach den Fakten oben' : ex ? 'Neue Aufgaben im üblichen Format' : 'Neue Aufgaben zu deinem Thema'}</span></button>
        <button class="src ${a.wantUpload ? 'on' : ''}" data-a="examSource" data-id="upload"><span class="e">📄</span><b>Mit alter Prüfung üben</b><span>PDF/Foto hochladen → Zwillingsprüfung</span>${CONFIG.PRO_ENABLED && !St.isPro() ? '<i class="pro-tag">PRO</i>' : ''}</button>
      </div>
      ${a.wantUpload ? `<label class="upload ${a.upload ? 'has' : ''}"><input type="file" accept="image/*,application/pdf,.pdf" data-a-change="examFile" hidden/>
          ${a.upload ? `<span style="font-size:26px">${a.upload.type === 'application/pdf' ? '📄' : '🖼️'}</span><div class="grow"><b>${esc(a.upload.name)}</b><span>${Math.round(a.upload.size / 1024)} KB · nur für dein eigenes Lernen, wird nicht gespeichert</span></div><button class="icon-btn plain" data-a="examFileClear">${I.x}</button>`
            : `<span style="font-size:26px">📎</span><div class="grow"><b>PDF oder Foto auswählen</b><span>Max. 8 MB. Brainy übernimmt Aufbau & Niveau – neue Aufgaben, keine Kopie.</span></div>`}</label>` : ''}
      ${step(6, 'Umfang')}
      <div class="len-cards">${lengths.map(([id, l, q, m]) => `<button class="len ${sel(a.length, id)}" data-a="examLength" data-id="${id}"><b>${l}</b><span>${q}</span><span>${m}</span></button>`).join('')}</div>
      ${ex ? `<div class="field mt12"><label>Zusatzwunsch <span class="faint">(optional)</span></label><input class="input" data-bind="ai.extra" value="${esc(a.extra || '')}" placeholder="z.B. 2–3 Aufgaben extra zu Bruchrechnen"/></div>` : ''}
      ${!hasKey() ? `<div class="tip mb12">${I.info}<span>Demo-Modus: Beispielaufgaben aus der Brained-Fragenbank.</span></div>` : ''}
      <button class="btn primary block mt16" data-a="examStart" ${a.busy ? 'disabled' : ''}>${a.busy ? `<span class="typing"><i></i><i></i><i></i></span> ${a.busyStep === 'check' ? 'Kontrolle: Brainy rechnet alles nach…' : 'Brainy schreibt deine Prüfung…'}` : 'Prüfung erstellen'}</button>
      ${a.busy ? `<p class="center tiny faint mt8">${a.busyStep === 'check' ? 'Schritt 2 von 2 · Struktur, Punkte und jede Lösung werden geprüft' : 'Schritt 1 von 2 · ca. 30–60 Sekunden'}</p>` : ''}
      ${a.error ? `<div class="tip mt12" style="color:#c0392b">${esc(a.error)}</div>` : ''}
      ${docs.length ? `<div class="section-t">Deine Prüfungen</div><div class="list">${docs.map(d => { const sb = St.subj(d.subjectId), g = d.grade; return `<button class="li" data-a="examDocOpen" data-id="${d.id}" style="width:100%;text-align:left"><div class="ico" style="background:${sb.color}22">${d.exam.dbRef ? (EXAM_KINDS[examById(d.exam.dbRef.examId)?.exam]?.em || '📄') : examTypeOf(d.typeId).em}</div><div class="t"><b>${esc(d.exam.kicker || examTypeOf(d.typeId).name)}</b><span>${esc(d.exam.title)} · ${fmtDate(d.ts)} · ${examTotal(d.exam)} P.</span></div>${g ? `<div class="grade-pill ${g >= 5 ? 'good' : g >= 4 ? 'mid' : 'bad'}">${g.toFixed(1)}</div>` : I.chev.replace('<svg', '<svg class="chev"')}</button>`; }).join('')}</div>` : ''}`;
  }
  const ex = a.exam, total = examTotal(ex), sb = St.subj(a.subjectId);
  if (a.phase === 'score') {
    const sc = examScore(a);
    return `<div class="card center"><div class="faint small bold">${esc(ex.title)} · ${esc(ex.series)}</div><div class="big-stat mt8" style="font-size:64px;color:${sc.grade >= 5 ? 'var(--good)' : sc.grade >= 4 ? 'var(--gold)' : 'var(--brand)'}" data-live="examGrade">${sc.shown}</div>
        <p class="muted small"><span data-live="examEarned">${sc.earned}</span> von ${total} Punkten${sc.scale === 'ch' ? ` · Note = Punkte ÷ ${total} × 5 + 1` : sc.scale === 'abitur' ? ' · in Notenpunkten (0–15)' : ''}</p></div>
      <div class="tip mb12">${I.info}<span>Korrigiere mit dem Lösungsschlüssel und trag pro Aufgabe deine Punkte ein. Halbe Punkte sind möglich.</span></div>
      <div class="list">${ex.tasks.map((t, i) => { const mx = taskPoints(t), v = +(a.pts[i] || 0); return `<div class="li score-row"><div class="t"><b>Aufgabe ${i + 1}</b><span>${esc(t.title)}</span></div>
        <div class="stepper"><button data-a="examPts" data-k="${i}" data-d="-0.5" ${v <= 0 ? 'disabled' : ''}>−</button><b class="num">${v}<small>/${mx}</small></b><button data-a="examPts" data-k="${i}" data-d="0.5" ${v >= mx ? 'disabled' : ''}>+</button></div></div>`; }).join('')}</div>
      <button class="btn primary block mt16" data-a="examSave">Note speichern</button>
      <button class="btn ghost block mt8" data-a="examBack">Zurück zur Prüfung</button>`;
  }
  // phase 'doc': fertige Prüfung
  const doc = (S.examDocs || []).find(d => d.id === a.docId), graded = doc?.grade;
  const weak = graded ? ex.tasks.filter((t, i) => (+(doc.pts?.[i]) || 0) < taskPoints(t) * .6).length : 0;
  return `<div class="exam-ready"><div class="row"><span class="doc-ico">📄</span><div class="grow"><div class="tiny bold" style="opacity:.8">${esc(examTypeOf(a.typeId).name)}${ex.demo ? ' · Demo' : ''}</div><b>${esc(ex.title)} · ${esc(ex.series)}</b>
      <div class="exam-meta"><span>⏱ ${ex.minutes} min</span><span>📝 ${ex.tasks.length} Aufgaben</span><span>🎯 ${total} Punkte</span></div></div>${graded ? `<div class="grade-pill ${graded >= 5 ? 'good' : graded >= 4 ? 'mid' : 'bad'}">${graded.toFixed(1)}</div>` : ''}</div></div>
    <button class="btn primary block" data-a="examPdf" data-id="exam" ${a.pdfBusy ? 'disabled' : ''}>${a.pdfBusy === 'exam' ? 'PDF wird erstellt…' : 'Prüfung als PDF'}</button>
    <button class="btn outline block mt8" data-a="examPdf" data-id="sol" ${a.pdfBusy ? 'disabled' : ''}>${a.pdfBusy === 'sol' ? 'PDF wird erstellt…' : 'Lösungen als PDF'}</button>
    <div class="row mt8" style="gap:8px"><button class="btn ghost grow sm" data-a="examTimer">Timer ${ex.minutes} min</button><button class="btn ghost grow sm" data-a="examScoreOpen">${graded ? 'Punkte ändern' : 'Punkte eintragen'}</button></div>
    ${weak ? `<button class="btn outline block mt8" data-a="examCards" ${a.cardsSaved ? 'disabled' : ''}>${a.cardsSaved ? '✓ Als Karten gespeichert' : `${weak} schwache Aufgaben als Karteikarten`}</button>` : ''}
    <div class="seg mt16 mb12"><button class="${a.view !== 'sol' ? 'on' : ''}" data-a="examView" data-id="exam">Prüfung</button><button class="${a.view === 'sol' ? 'on' : ''}" data-a="examView" data-id="sol">Lösungsschlüssel</button></div>
    ${examPaper(ex, a.view === 'sol')}
    <div class="row mt16" style="gap:8px"><button class="btn outline grow" data-a="examAgain">Neue Serie</button><button class="btn ghost grow" data-a="aiTool" data-id="exam">Andere Prüfung</button></div>
    <p class="center tiny faint mt8">So lernst du am meisten: unter echten Bedingungen lösen (Timer, nur erlaubte Hilfsmittel), dann selbst korrigieren.</p>`;
}

function planView() {
  const a = U.ai;
  const plans = (S.studyPlans || []).slice().sort((x, y) => x.examTs - y.examTs);
  if (a.phase === 'view') {
    const p = plans.find(x => x.id === a.planId); if (!p) { a.phase = 'setup'; return planView(); }
    const done = p.days.filter(d => d.done).length, sb = St.subj(p.subjectId), today = St.startOfDay(Date.now());
    const left = Math.max(0, Math.round((St.startOfDay(p.examTs) - today) / 864e5));
    return `<div class="card plan-head" style="border-left:6px solid ${sb.color}"><div class="row"><span style="font-size:26px">${sb.emoji}</span><div class="grow"><b style="font-size:17px">${esc(p.exam)}</b><div class="small muted">${esc(sb.name)} · Prüfung ${fmtDate(p.examTs)} · ${left === 0 ? 'heute' : `noch ${left} ${left === 1 ? 'Tag' : 'Tage'}`}</div></div></div>
        <div class="progress mt12 ${done === p.days.length ? 'good' : ''}"><i style="width:${p.days.length ? done / p.days.length * 100 : 0}%"></i></div>
        <div class="tiny faint bold mt8">${done}/${p.days.length} Lerntage erledigt · ${fmtHours(p.days.reduce((s, d) => s + d.min, 0))} total</div></div>
      ${(() => { const ti = p.days.findIndex(d => d.ts === today && !d.done), td = p.days[ti]; const K = PLAN_KINDS[td?.kind] || PLAN_KINDS.rep;
        return td ? `<div class="plan-today"><div class="tiny bold" style="opacity:.8">HEUTE · ${K.em} ${K.name.toUpperCase()}</div><b>${esc(td.focus)}</b><div class="row mt12"><span class="grow small bold" style="opacity:.85">⏱ ${td.min} min</span><button class="btn xs" style="background:#fff;color:#3F2FD1" data-a="planGo" data-id="${p.id}" data-k="${ti}">${td.kind === 'cards' ? 'Karten lernen' : td.kind === 'exam' ? 'Prüfung erstellen' : 'Start'} →</button></div></div>` : ''; })()}
      ${p.days.some(d => !d.done && d.ts < today) ? `<button class="card row tight" style="width:100%;text-align:left;background:var(--flame-soft)" data-a="planReplan" data-id="${p.id}"><span style="font-size:22px">🔁</span><div class="grow"><b class="small">${p.days.filter(d => !d.done && d.ts < today).length} verpasste Einheiten</b><div class="tiny muted">Antippen: auf die restlichen Tage verteilen</div></div></button>` : ''}
      <div class="list">${p.days.map((d, i) => { const past = d.ts < today && !d.done, isToday = d.ts === today, K = PLAN_KINDS[d.kind] || PLAN_KINDS.rep;
        return `<div class="li plan-day ${d.done ? 'done' : ''} ${isToday ? 'today' : ''}"><button class="plan-check ${d.done ? 'on' : ''}" data-a="planDay" data-id="${p.id}" data-k="${i}" aria-label="Erledigt">${d.done ? (d.moved ? '↷' : '✓') : K.em}</button>
          <div class="t"><b style="white-space:normal;font-size:14px">${esc(d.focus)}</b><span>${isToday ? '<b style="color:var(--brand)">Heute</b>' : fmtDate(d.ts)} · ${d.min} min · ${K.name}${d.moved ? ' · verschoben' : past ? ' · verpasst' : ''}</span></div>
          ${!d.done && d.ts <= today ? `<button class="btn primary xs" data-a="planGo" data-id="${p.id}" data-k="${i}">Start</button>` : ''}</div>`; }).join('')}
        <div class="li" style="background:var(--brand-soft)"><div class="ico" style="background:var(--surface)">🎓</div><div class="t"><b>Prüfung: ${esc(p.exam)}</b><span>${fmtDate(p.examTs)} – du schaffst das!</span></div></div></div>
      <div class="row mt12" style="gap:8px">${p.inCalendar ? `<span class="btn ghost grow sm" style="pointer-events:none">✓ Im Kalender</span>` : `<button class="btn outline grow sm" data-a="planCal" data-id="${p.id}">In Kalender</button>`}<button class="btn outline grow sm" data-a="planExam" data-id="${p.id}">Probeprüfung</button></div>
      <button class="btn ghost block mt8 small" style="color:#E5484D" data-a="planDel" data-id="${p.id}">Lernplan löschen</button>`;
  }
  const list = plans.length ? `<div class="section-t">Deine Lernpläne</div><div class="list">${plans.map(p => { const sb = St.subj(p.subjectId), done = p.days.filter(d => d.done).length, over = p.examTs < St.startOfDay(Date.now());
    return `<button class="li" data-a="planOpen" data-id="${p.id}" style="width:100%;text-align:left${over ? ';opacity:.55' : ''}"><div class="ico" style="background:${sb.color}22">${sb.emoji}</div><div class="t"><b>${esc(p.exam)}</b><span>${over ? 'vorbei' : fmtDate(p.examTs)} · ${done}/${p.days.length} erledigt</span><div class="progress thin mt8"><i style="width:${p.days.length ? done / p.days.length * 100 : 0}%"></i></div></div>${I.chev.replace('<svg', '<svg class="chev"')}</button>`; }).join('')}</div>
    <div class="section-t">Neuer Lernplan</div>` : '';
  return `${list}<div class="field"><label>Prüfung</label><input class="input" data-bind="ai.exam" value="${esc(a.exam || '')}" placeholder="z.B. Mathe-Test Trigonometrie"/></div>
    <div class="field"><label>Fach</label>${subjChips(a.subjectId)}</div>
    <div class="field"><label>Prüfungsdatum</label><input class="input" type="date" data-bind="ai.date" value="${a.date || ''}" min="${St.dayKey(St.addDays(Date.now(), 2))}"/></div>
    <div class="field"><label>Zeit pro Tag</label><div class="chips">${[30, 45, 60, 90, 120].map(m => `<button class="chip-btn ${sel(+a.minPerDay, m)}" data-a="planMin" data-m="${m}">${m} min</button>`).join('')}</div></div>
    <div class="field"><label>Themen (eins pro Zeile)</label><textarea class="textarea" data-bind="ai.topics" data-a-change="planTopics" placeholder="Sinus & Kosinus\nEinheitskreis\nSinussatz\nKosinussatz">${esc(a.topics || '')}</textarea></div>
    ${(() => { const tl = (a.topics || '').split('\n').map(t => t.trim()).filter(Boolean); return tl.length ? `<div class="field"><label>Wie gut kannst du's schon? <span class="faint">(antippen)</span></label><div class="lvl-list">${tl.map(t => { const l = a.levels?.[t] ?? 1; return `<button class="lvl l${l}" data-a="planLvl" data-t="${esc(t)}"><span class="grow">${esc(t)}</span><b>${['🔴 unsicher', '🟡 geht so', '🟢 sitzt'][l]}</b></button>`; }).join('')}</div><p class="tiny faint mt8">Unsichere Themen bekommen mehr Zeit und öfter Repetition.</p></div>` : ''; })()}
    <div class="field"><label>Freie Tage</label><div class="chips">${[[6, 'Samstag'], [0, 'Sonntag']].map(([d, l]) => `<button class="chip-btn ${(a.rest || []).includes(d) ? 'on' : ''}" data-a="planRest" data-d="${d}">${l} frei</button>`).join('')}</div></div>
    <button class="btn primary block" data-a="planMake" ${a.busy ? 'disabled' : ''}>${a.busy ? '<span class="typing"><i></i><i></i><i></i></span> Brainy plant…' : `${I.spark} Lernplan erstellen`}</button>
    ${a.error ? `<div class="tip mt12" style="color:#c0392b">${esc(a.error)}</div>` : ''}`;
}

function cardsView() {
  const a = U.ai;
  const total = S.flashcards.length;
  if (!a.queue?.length || a.i >= a.queue.length) {
    const due = St.dueCards().length;
    return `<div class="card center">${a.queue?.length ? '<div style="font-size:54px">🎉</div><h3 style="font-size:20px" class="mt8">Alle fälligen Karten gelernt!</h3>' : `<div style="font-size:54px">🃏</div><h3 style="font-size:20px" class="mt8">${due ? `${due} Karten fällig` : 'Nichts fällig – stark!'}</h3>`}
      <p class="small muted mt8">${total} Karten insgesamt · Brainy fragt jede Karte in wachsenden Abständen ab (1 → 2 → 4 → 7 → 15 → 30 Tage).</p>
      ${due ? `<button class="btn primary block mt16" data-a="cardsStart">Jetzt lernen</button>` : ''}</div>
      <div class="row mt12" style="gap:8px"><button class="btn outline grow sm" data-a="openSheet" data-type="cardsNotes">Aus Dokument</button><button class="btn outline grow sm" data-a="openSheet" data-type="cardAdd">＋ Karte</button></div>
      <div class="section-t">Spiele mit deinen Karten</div>
      ${GM.deckFor().starter ? `<div class="tip mb8">${I.info}<span>Ab 4 eigenen Karten spielst du mit deinem Stoff – bis dahin mit dem Starter-Deck.</span></div>` : ''}
      <div class="game-tiles">${GM.GAMES.map(g => `<button class="game-tile" style="background:${g.color}" data-a="gameOpen" data-id="${g.id}"><span class="ge">${g.em}</span><div class="grow"><b>${g.name}</b><span>${g.desc}</span></div><div class="gbest">Rekord<br><b>${GM.best(g.id)}</b></div></button>`).join('')}</div>
      <div class="section-t">Alle Karten · ${total}</div>
      ${total ? `<div class="list">${S.flashcards.slice().reverse().slice(0, 40).map(c => { const s = St.subj(c.subjectId); return `<div class="li"><div class="ico" style="background:${s.color}22;font-size:16px">${s.emoji}</div><div class="t"><b>${esc(c.q)}</b><span>Box ${c.box} · ${c.due <= Date.now() ? 'fällig' : 'nächste: ' + fmtDate(c.due)}</span></div><button class="icon-btn plain" style="width:30px" data-a="delCard" data-id="${c.id}">${I.trash.replace('<svg', '<svg width="16" height="16"')}</button></div>`; }).join('')}</div>` : `<div class="empty"><div class="e">✍️</div><b>Noch keine Karten</b>Nach jeder Session kannst du einen Recap schreiben – Brainy macht Karten daraus.</div>`}`;
  }
  const c = S.flashcards.find(x => x.id === a.queue[a.i]);
  if (!c) { a.i++; return cardsView(); }
  const s = St.subj(c.subjectId);
  return `<div class="row mb12"><span class="small bold faint grow">${a.i + 1} / ${a.queue.length}</span>${subjTag(s)}</div>
    <div class="progress thin mb16 violet"><i style="width:${a.i / a.queue.length * 100}%"></i></div>
    <div class="flash ${a.flipped ? 'flipped' : ''}" data-a="cardFlip"><div class="flash-inner">
      <div class="flash-face"><span class="k">Frage</span>${esc(c.q)}<span class="tiny faint" style="position:absolute;bottom:16px">Tippen zum Umdrehen</span></div>
      <div class="flash-face back"><span class="k">Antwort</span>${esc(c.a)}</div></div></div>
    ${a.flipped ? `<div class="row"><button class="btn outline grow" data-a="cardRate" data-k="0">Nochmal</button><button class="btn primary grow" data-a="cardRate" data-k="1">Gewusst</button></div>` : `<button class="btn dark block" data-a="cardFlip">Antwort zeigen</button>`}`;
}

/* =================================== PROFIL =================================== */
function profileView() {
  const u = S.user, L = St.levelInfo(), st = St.streakInfo(), lg = St.leagueFor(St.totalMin());
  const row = (icon, label, right, a, extra = '') => `<button class="li" ${a ? `data-a="${a}"` : ''} ${extra}><div class="ico" style="background:var(--surface-2);font-size:18px">${icon}</div><div class="t"><b>${label}</b></div>${right}</button>`;
  return `<div class="timer-screen" data-keep="profile">
    <div class="timer-top"><button class="icon-btn" data-a="closeOverlay">${I.back}</button><b>Profil</b><button class="icon-btn" data-a="openSheet" data-type="editProfile">${I.edit}</button></div>
    <div class="profile-head"><div class="av-ring">${avatar(u.avatar, 104, u.name)}</div><h2>${esc(u.name)}</h2><div class="faint bold small">@${esc(u.username)} · ${u.canton} · ${levelLabel(u.level)}</div>
      <div class="row" style="gap:8px"><span class="lvl">${L.rank.em} Level ${L.lvl} · ${L.rank.name}</span><span class="lvl" style="background:var(--flame-soft);color:var(--flame)">🔥 ${st.current} Tage</span><span class="lvl" style="background:var(--surface-2);color:var(--ink)">${lg.emoji} ${lg.name}</span></div></div>
    <div class="kpis"><div class="kpi center"><b>${fmtHours(St.totalMin())}</b><span>Gesamt</span></div><div class="kpi center"><b>${st.best}</b><span>Rekord-Streak</span></div><div class="kpi center"><b>${St.trophyCount()}</b><span>Trophäen</span></div></div>
    <button style="width:100%;text-align:left" data-a="profileTrophies">${trophyStrip(St.trophyMap())}</button>
    <div class="section-t">Einstellungen</div>
    <div class="list">
      ${row('🙋', 'Präsenz-Check', `<select class="select" style="width:118px;height:38px;font-size:14px" data-a-change="setCheckin">${[[0, 'Aus'], [30, '30 min'], [45, '45 min'], [60, 'Stündlich'], [90, '90 min']].map(([v, l]) => `<option value="${v}" ${S.settings.checkinMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      ${row('⏸️', 'Auto-Pause', `<span class="switch ${S.settings.pauseOnLeave ? 'on' : ''}"></span>`, 'togglePause')}
      ${row('🎯', 'Wochenziel', `<span class="faint bold small">${fmtHours(St.weekGoal())}</span>`, 'openSheet', 'data-type="goal"')}
      ${row('🎨', 'Fächer & Farben', I.chev.replace('<svg', '<svg class="chev"'), 'openSheet', 'data-type="subjects"')}
      ${row('🔔', 'Streak-Erinnerung', `<span class="switch ${S.settings.push ? 'on' : ''}"></span>`, 'togglePush')}
      ${row('🛍️', 'Shop', `<span class="coin-chip" style="font-size:12px;padding:4px 9px">🪙 ${St.coins()}</span>`, 'openShop')}
      ${row('🌐', 'Sprache', `<span class="faint bold small">${curLang().flag} ${curLang().label}</span>`, 'openSheet', 'data-type="lang"')}
      ${row('🌗', 'Erscheinungsbild', `<span class="faint bold small">${{ auto: 'System', light: 'Hell', dark: 'Dunkel' }[S.settings.theme]}</span>`, 'cycleTheme')}
    </div>
    <div class="section-t">Freunde</div>
    <div class="list">
      ${row('👯', 'Folge ich', `<span class="faint bold small">${S.friends.length}</span>${I.chev.replace('<svg', '<svg class="chev"')}`, 'openFollowing')}
      ${row('🔎', 'Freunde finden', I.chev.replace('<svg', '<svg class="chev"'), 'openSheet', 'data-type="friend"')}
    </div>
    <div class="section-t">Privatsphäre</div>
    <div class="list">
      ${row('🔐', 'Folgen nur mit Anfrage', `<span class="switch ${S.user.followRequests !== false ? 'on' : ''}"></span>`, 'toggleFollowMode')}
      ${row('📩', 'Folgeanfragen', `${R.requests?.length ? `<span class="coin-chip" style="font-size:12px;padding:4px 9px;background:var(--brand);color:#fff">${R.requests.length}</span>` : ''}${I.chev.replace('<svg', '<svg class="chev"')}`, 'openRequests')}
      ${row('⛔', 'Blockierte Personen', I.chev.replace('<svg', '<svg class="chev"'), 'openBlocked')}
    </div>
    <p class="tiny faint" style="margin:-4px 4px 14px">${S.user.followRequests !== false ? 'Neue Follower brauchen deine Zustimmung, bevor sie deine Sessions sehen.' : 'Öffentlich: Alle können dir direkt folgen und deine Sessions sehen.'}</p>
    ${CONFIG.PRO_ENABLED ? `<button class="card row pro-card" style="width:100%;text-align:left" data-a="openSheet" data-type="pro"><span style="font-size:30px">💎</span><div class="grow"><b>Brained Pro ${St.isPro() ? '· aktiv' : ''}</b><div class="small" style="opacity:.8">${St.isPro() && S.plan?.until ? `Läuft bis ${fmtDate(S.plan.until)}` : 'Unbegrenzt Gruppen · viel mehr Brainy · Streak-Schutz'}</div></div><span class="btn xs" style="background:#fff;color:#16131F">${St.isPro() ? 'Verwalten' : `CHF ${PRO.monthly.toFixed(2)}`}</span></button>` : ''}
    <div class="list">
      ${row('🔒', 'Datenschutzerklärung', I.chev.replace('<svg', '<svg class="chev"'), 'openLegal', 'data-id="datenschutz"')}
      ${row('📄', 'Nutzungsbedingungen', I.chev.replace('<svg', '<svg class="chev"'), 'openLegal', 'data-id="agb"')}
      ${row('✉️', 'Support & Kontakt', `<span class="faint small">${esc(CONFIG.LEGAL_EMAIL)}</span>`, '')}
    </div>
    <div class="list">
      ${BACKEND ? '' : row('🧪', 'Demo-Daten neu laden', '', 'reseed')}
      ${row('🚪', BACKEND ? 'Abmelden' : 'Abmelden & alles löschen', '', 'logout')}
      ${row('🗑️', '<span style="color:#E5484D">Konto löschen</span>', '', 'deleteAccount')}
    </div>
    <p class="center faint tiny">Brained v1.0 · ${BACKEND ? 'Verbunden' : 'Demo-Modus'} · Made in Switzerland 🇨🇭</p>
  </div>`;
}

/* =================================== SHOP =================================== */
function shopView(head) {
  const me = normAvatar(S.user.avatar), coins = St.coins(), tab = U.shopTab || 'items';
  const rarTag = r => `<span class="rar-tag" style="background:${RARITY[r].color}22;color:${RARITY[r].color}">${RARITY[r].label}</span>`;
  const look = it => it.set ? { ...me, ...it.set } : it.slot ? { ...me, [it.slot]: it.id } : it.fill ? { ...me, skin: it.id } : { ...me, frame: it.id };
  const kind = it => it.set ? 'Komplett-Avatar' : it.slot ? SLOTS.find(x => x[0] === it.slot)[1] : it.fill ? 'Gehirn-Skin' : 'Avatar-Rahmen';
  const isOn = it => it.set ? Object.entries(it.set).every(([k, v]) => k === 'mood' || me[k] === v) : it.slot ? me[it.slot] === it.id : it.fill ? me.skin === it.id : me.frame === it.id;
  if (U.shopSel) {
    const it = St.shopItem(U.shopSel), active = isOn(it), miss = it.price - coins;
    if (SHOP_CONSUMABLES.some(c => c.id === it.id)) return head('Shop') + `<div class="shop-detail">
      <button class="btn ghost sm" style="align-self:flex-start" data-a="shopBack">${I.back} Zurück</button>
      <div style="font-size:84px;line-height:1.1">${it.emoji}</div><h2 style="font-size:24px">${esc(it.name)}</h2>
      <p class="muted" style="max-width:300px">Verpasst du einen Tag, wird automatisch ein Schutz eingesetzt und deine Streak bleibt. Du hast <b>${S.freeze?.stock || 0}</b>.</p>
      ${miss > 0 ? `<button class="btn3d mt12" disabled>🪙 ${it.price}</button><div class="faint small bold">Dir fehlen noch ${miss} Coins.</div>` : `<button class="btn3d mt12" data-a="shopBuy" data-id="${it.id}">Kaufen für 🪙 ${it.price}</button>`}</div>`;
    const own = St.owns(it.id);
    const parts = it.set ? Object.entries(it.set).filter(([k]) => k !== 'mood').map(([k, v]) => St.shopItem(v)).filter(Boolean) : [];
    const full = parts.reduce((x, p) => x + p.price, 0);
    return head('Shop') + `<div class="shop-detail">
      <button class="btn ghost sm" style="align-self:flex-start" data-a="shopBack">${I.back} Zurück</button>
      <div style="margin:8px 0">${avatar(look(it), 160)}</div>
      <div class="row" style="gap:6px;justify-content:center">${rarTag(it.rar)}${it.slot || it.fx || it.set || it.fill === 'rainbow' ? '<span class="anim-tag">✨ Animiert</span>' : ''}</div><h2 style="font-size:24px">${esc(it.name)}</h2>
      <div class="faint small">${kind(it)} · sichtbar in Ranglisten & auf deinem Profil</div>
      ${parts.length ? `<div class="faint small bold">Enthält: ${parts.map(p => esc(p.name)).join(' · ')}${full > it.price ? ` <span style="color:var(--good)">(spare ${full - it.price} 🪙)</span>` : ''}</div>` : ''}
      ${it.pro ? `<div class="faint small bold">💎 Pro-Item des Monats ${it.month ? `(${it.month})` : ''} – gratis für alle mit Brained Pro</div>` : ''}
      ${own ? `<button class="btn3d mt12" data-a="shopEquip" data-id="${it.id}">${active ? 'Ablegen' : 'Anziehen'}</button>`
        : it.pro ? (St.isPro() ? `<button class="btn3d mt12" data-a="shopBuy" data-id="${it.id}">Gratis holen</button>` : `<button class="btn3d mt12" data-a="openSheet" data-type="pro">Mit Pro freischalten</button>`)
        : miss > 0 ? `<button class="btn3d mt12" disabled>🪙 ${it.price}</button><div class="faint small bold">Dir fehlen noch ${miss} Coins – etwa ${fmtShort(miss)} lernen.</div>`
        : `<button class="btn3d mt12" data-a="shopBuy" data-id="${it.id}">Kaufen für 🪙 ${it.price}</button>`}
    </div>`;
  }
  const card = it => {
    const own = St.owns(it.id), active = isOn(it);
    return `<button class="shop-item ${active ? 'eq' : ''} ${!own && it.price > coins ? 'locked' : ''}" data-a="shopOpen" data-id="${it.id}">
      <span class="rar" style="background:${RARITY[it.rar].color}"></span>${avatar(look(it), 66)}
      <span class="n">${esc(it.name)}</span><span class="p ${own ? 'own' : ''}">${active ? '✓ An' : own ? 'Besitzt' : it.pro ? '💎 Pro' : '🪙 ' + it.price}</span>${it.pro ? '<span class="pro-badge">PRO</span>' : ''}</button>`;
  };
  const grid = list => `<div class="shop-grid">${list.map(card).join('')}</div>`;
  const extras = `<div class="shop-sub">Extras</div><div class="list">${SHOP_CONSUMABLES.map(c => `<button class="li" data-a="shopOpen" data-id="${c.id}"><div class="ico" style="background:var(--surface-2);font-size:20px">${c.emoji}</div><div class="t"><b>${esc(c.name)}</b><span class="faint small">Du hast ${S.freeze?.stock || 0} · rettet deine Streak an einem verpassten Tag</span></div><span class="coin-chip" style="font-size:12px;padding:4px 9px">🪙 ${c.price}</span></button>`).join('')}</div>`;
  const body = tab === 'items' ? extras + SLOTS.map(([k, l]) => `<div class="shop-sub">${l}</div>` + grid(SHOP_ITEMS.filter(i => i.slot === k && (CONFIG.PRO_ENABLED || !i.pro)))).join('')
    : tab === 'brains' ? `<div class="shop-sub">Komplett-Avatare</div>${grid(SHOP_BUNDLES)}<div class="shop-sub">Gehirn-Skins</div>${grid(BRAIN_SKINS.filter(k => k.price))}`
    : grid(SHOP_FRAMES);
  return head('Shop') + `<div class="shop-hero"><span style="font-size:34px">🪙</span><div class="grow"><div class="big num">${coins}</div><small>Brain-Coins · 1 XP = 1 Coin. Lernen = verdienen.</small></div></div>
    <div class="seg mb12"><button class="${sel(tab, 'items')}" data-a="shopTab" data-id="items">Accessoires</button><button class="${sel(tab, 'brains')}" data-a="shopTab" data-id="brains">Gehirne</button><button class="${sel(tab, 'frames')}" data-a="shopTab" data-id="frames">Rahmen</button></div>
    ${body}`;
}

/* =================================== PRO =================================== */
function proView(head, sh) {
  const pro = St.isPro(), plan = U.proPlan || 'yearly';
  const feats = [['👯', 'Unbegrenzt Gruppen', 'bis 300 Personen, mit Gruppen-Statistik'], ['🧠', 'Viel mehr Brainy', `${PRO.proLimits.brainyPerDay} Anfragen pro Tag statt ${PRO.freeLimits.brainyPerDay}`], ['📝', 'Probeprüfungen jeden Tag', `bis ${PRO.proLimits.examsPerDay} pro Tag + Zwillingsprüfung`], ['🧊', 'Streak-Schutz', `${PRO.freezesPerMonth} neue jeden Monat`], ['👑', 'Pro-Item des Monats', 'exklusive animierte Accessoires'], ['🚫', 'Keine Werbung', '']];
  if (pro) return head('Brained Pro') + `<div class="pro-hero"><div style="font-size:44px">💎</div><b>Du hast Brained Pro</b><span>${S.plan?.until ? `Läuft bis ${fmtDate(S.plan.until)}` : 'Danke für deine Unterstützung!'}</span></div>
      <div class="list mt12">${feats.map(([e, t, d]) => `<div class="li"><div class="ico" style="background:var(--surface-2);font-size:20px">${e}</div><div class="t"><b>${t}</b>${d ? `<span class="faint small">${d}</span>` : ''}</div>${I.check.replace('<svg', '<svg style="width:20px;color:var(--good)"')}</div>`).join('')}</div>
      ${BACKEND && S.plan?.source === 'stripe' ? `<button class="btn ghost block mt12" data-a="proPortal">Abo verwalten oder kündigen</button>` : ''}
      ${BACKEND && S.plan?.source === 'revenuecat' ? `<p class="faint small center mt12">Verwalten & kündigen in den Einstellungen deines App Stores.</p>` : ''}
      ${!BACKEND ? `<button class="btn ghost block mt12" data-a="togglePro">Demo: Pro beenden</button>` : ''}`;
  return head('Brained Pro') + `${sh.reason ? `<div class="tip mb12">${I.info}<span>${esc(sh.reason)}</span></div>` : ''}
    <div class="pro-hero"><div class="pro-brain">${brainSVG({ size: 86, fill: '#FFD95A', fold: '#C98A00', outline: '#5A3D00', fx: 'shine', hat: 'laurel', fit: 'avatar' })}</div><b>Lerne ohne Grenzen</b><span>${PRO.trialDays} Tage gratis testen, jederzeit kündbar</span></div>
    <div class="list mt12">${feats.map(([e, t, d]) => `<div class="li"><div class="ico" style="background:var(--surface-2);font-size:20px">${e}</div><div class="t"><b>${t}</b>${d ? `<span class="faint small">${d}</span>` : ''}</div></div>`).join('')}</div>
    <div class="plan-pick mt12">
      <button class="${sel(plan, 'yearly')}" data-a="proPlan" data-id="yearly"><span class="save">−34 %</span><b>Jährlich</b><span>CHF ${PRO.yearly}.– / Jahr</span><small>= CHF ${(PRO.yearly / 12).toFixed(2)} pro Monat</small></button>
      <button class="${sel(plan, 'monthly')}" data-a="proPlan" data-id="monthly"><b>Monatlich</b><span>CHF ${PRO.monthly.toFixed(2)} / Monat</span><small>monatlich kündbar</small></button>
    </div>
    <button class="btn3d mt12" data-a="proBuy" ${U.proBusy ? 'disabled' : ''}>${U.proBusy ? '…' : `${PRO.trialDays} Tage gratis testen`}</button>
    <p class="faint tiny center mt8">Danach ${plan === 'yearly' ? `CHF ${PRO.yearly}.– pro Jahr` : `CHF ${PRO.monthly.toFixed(2)} pro Monat`}. Kündigen jederzeit vor Ablauf der Testphase – dann kostet es nichts.</p>
    ${BACKEND ? `<button class="linkbtn" style="display:block;margin:0 auto" data-a="proRestore">Käufe wiederherstellen</button>` : ''}`;
}

/* =================================== SHEETS =================================== */
function sheetView() {
  const sh = U.sheet, f = U.form;
  const head = (t, extra = '') => `<div class="sheet-h"><h3>${t}</h3>${extra}<button class="icon-btn" data-a="closeSheet">${I.x}</button></div>`;
  switch (sh.type) {
    case 'lang': return head('Sprache') + `<div class="opts">${LANGS.map(l => `<button class="opt ${l.id === lang ? 'on' : ''}" data-a="setLang" data-id="${l.id}"><span class="e">${l.flag}</span><span class="t" data-noi18n>${l.label}</span><span class="ck">${l.id === lang ? '✓' : ''}</span></button>`).join('')}</div>
      <p class="faint small center mt12">Brainy antwortet dir auch in dieser Sprache.</p>`;
    case 'shop': return shopView(head);
    case 'pro': return proView(head, sh);
    case 'newPassword': return head('Neues Passwort') + `<p class="muted mb12">Wähle ein neues Passwort für dein Konto (mindestens 8 Zeichen).</p>
      <div class="field"><input class="input" type="password" autocomplete="new-password" placeholder="Neues Passwort" data-bind="form.newPw" value="${esc(f.newPw || '')}"/></div>
      <button class="btn3d" data-a="saveNewPw">Passwort speichern</button>`;
    case 'reactors': {
      const it = St.feed().find(x => x.id === sh.id); if (!it) return head('Reaktionen');
      const mine = S.boosts[it.id] === true ? '🔥' : S.boosts[it.id], list = [...(mine ? [{ id: S.user.id, name: 'Du', avatar: S.user.avatar, emoji: mine }] : []), ...(it.reactors || [])];
      return head('Reaktionen') + `<div class="row mb12" style="gap:6px;flex-wrap:wrap">${Object.entries({ ...(it.reactions || {}), ...(mine ? { [mine]: (it.reactions?.[mine] || 0) + 1 } : {}) }).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="react-chip">${e} ${n}</span>`).join('')}</div>
        <div class="list">${list.map(r => `<button class="li" data-a="openUser" data-id="${r.id}">${avatar(r.avatar, 40)}<div class="t"><b>${esc(r.name)}</b></div><span style="font-size:24px">${r.emoji}</span></button>`).join('') || '<div class="empty small">Noch niemand</div>'}</div>
        ${St.reactionTotal(it) > list.length ? `<p class="faint small center mt12">+ ${St.reactionTotal(it) - list.length} weitere</p>` : ''}`;
    }
    case 'streak': {
      const st = St.streakInfo();
      return head('Deine Streak') + `<div class="card center"><div style="font-size:64px">${st.current ? '🔥' : '🧊'}</div><div class="big-stat">${st.current} ${st.current === 1 ? 'Tag' : 'Tage'}</div><p class="muted mt8">${st.todayDone ? 'Heute erledigt – komm morgen wieder!' : st.current ? 'Lerne heute mindestens 5 Minuten, sonst verlierst du deine Streak.' : 'Lerne heute 5 Minuten und starte eine neue Streak.'}</p></div>
        <div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi center"><b>${st.best}</b><span>Rekord</span></div><div class="kpi center"><b>${Object.keys(St.dayTotals()).length}</b><span>Lerntage total</span></div></div>
        <div class="card row" style="gap:12px"><span style="font-size:30px">🧊</span><div class="grow"><b>Streak-Schutz: ${st.freezes}</b><div class="faint small">Verpasst du einen Tag, wird automatisch einer eingesetzt.${St.isPro() ? ' Mit Pro: 2 neue pro Monat.' : ''}</div></div><button class="btn xs primary" data-a="shopOpenId" data-id="freeze">🪙 ${SHOP_CONSUMABLES[0].price}</button></div>
        <div class="tip">${I.info}<span>Ein Tag zählt ab 5 Minuten Lernzeit. Meilensteine bei 3, 7 und 30 Tagen schalten Trophäen frei.</span></div>
        ${st.todayDone ? '' : `<button class="btn primary block mt16" data-a="openTimer">5 Minuten lernen</button>`}`;
    }
    case 'plan': return head('Session planen') + `<div class="field"><label>Fach</label>${subjChips(f.subjectId, 'formSubj')}</div>
      <div class="row"><div class="field grow"><label>Datum</label><input class="input" type="date" data-bind="form.date" value="${f.date}"/></div><div class="field" style="width:130px"><label>Zeit</label><input class="input" type="time" data-bind="form.time" value="${f.time}"/></div></div>
      <div class="field"><label>Dauer</label><div class="chips">${[25, 45, 60, 90, 120].map(m => `<button class="chip-btn ${sel(+f.dur, m)}" data-a="formSet" data-k="dur" data-v="${m}">${m} min</button>`).join('')}</div></div>
      <div class="field"><label>Notiz (optional)</label><input class="input" data-bind="form.note" value="${esc(f.note || '')}" placeholder="z.B. Kapitel 5 repetieren"/></div>
      <button class="btn primary block" data-a="savePlan">Im Kalender speichern</button>`;
    case 'challenge': return head('Eigene Challenge') + `<div class="field"><label>Titel</label><input class="input" data-bind="form.title" value="${esc(f.title || '')}" placeholder="z.B. Franz-Voci-Woche"/></div>
      <div class="field"><label>Emoji</label><div class="chips">${['🎯', '🔥', '🏔️', '⚡', '📚', '🧠', '🏆', '🚀'].map(e => `<button class="chip-btn ${sel(f.emoji, e)}" data-a="formSet" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Fach</label><div class="chips"><button class="chip-btn ${f.subjectId ? '' : 'on'}" data-a="formSubj" data-id="">Alle Fächer</button></div><div class="mt8">${subjChips(f.subjectId, 'formSubj')}</div></div>
      <div class="field"><label>Ziel: <b data-live="chH">${f.hours} h</b></label><input type="range" min="1" max="40" value="${f.hours}" data-bind="form.hours" data-a-input="chRange" style="accent-color:var(--brand)"/></div>
      <div class="field"><label>Zeitraum</label><div class="chips">${[[3, '3 Tage'], [7, '1 Woche'], [14, '2 Wochen'], [30, '1 Monat']].map(([d, l]) => `<button class="chip-btn ${sel(+f.days, d)}" data-a="formSet" data-k="days" data-v="${d}">${l}</button>`).join('')}</div></div>
      <button class="btn primary block" data-a="saveChallenge">Challenge starten</button>`;
    case 'goal': return head('Wochenziel') + `<div class="card center"><div class="big-stat" data-live="goalH">${f.goalH} h</div><div class="faint small bold mt8" data-live="goalPerDay">≈ ${Math.round(f.goalH * 60 / 7)} min pro Tag</div>
      <input type="range" min="1" max="50" value="${f.goalH}" data-bind="form.goalH" data-a-input="goalRange" style="width:100%;margin-top:18px;accent-color:var(--brand)"/></div><button class="btn primary block" data-a="saveGoal">Speichern</button>`;
    case 'subjects': return head('Fächer & Farben') + `<p class="small muted mb12">Tippe ein Fach an, um es (ab)zuwählen. Farbpunkt antippen = Farbe ändern.</p>
      <div class="list">${St.subjectsForLevel(S.user?.level).map(s => { const on = S.subjects.includes(s.id); return `<div class="li"><button class="ico" style="background:${s.color};color:#fff" data-a="cycleColor" data-id="${s.id}">${s.emoji}</button><button class="t" style="text-align:left" data-a="toggleSubj" data-id="${s.id}"><b>${esc(s.name)}</b><span>${on ? 'Aktiv' : 'Ausgeblendet'}</span></button><button data-a="toggleSubj" data-id="${s.id}"><span class="switch ${on ? 'on' : ''}"></span></button></div>`; }).join('')}</div>
      <div class="card"><b>Eigenes Fach</b><div class="row mt12"><input class="input grow" data-bind="form.newSubj" placeholder="z.B. Psychologie" value="${esc(f.newSubj || '')}"/><button class="btn primary" data-a="addSubj">${I.plus}</button></div>
      <div class="chips mt12">${SUBJECT_EMOJIS.map(e => `<button class="chip-btn ${sel(f.newEmoji, e)}" style="padding:0 10px" data-a="formSet" data-k="newEmoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      ${U.sheetBack ? `<button class="btn primary block mt12" data-a="closeSheet">Fertig – zurück</button>` : ''}`;
    case 'session': {
      const s = S.sessions.find(x => x.id === sh.id); if (!s) return head('Session');
      const sb = St.subj(s.subjectId);
      return head(esc(s.title || sb.name)) + `<div class="card">${subjTag(sb)}<div class="row mt12" style="gap:22px"><div><div class="faint tiny bold">DAUER</div><b style="font-size:24px">${fmtShort(s.min)}</b></div><div><div class="faint tiny bold">XP</div><b style="font-size:24px">+${s.xp}</b></div><div><div class="faint tiny bold">CHECK-INS</div><b style="font-size:24px">${s.checkins || 0}</b></div></div>
        <div class="mt12">${focusLine(s.segments, s.start, s.end, sb.color)}</div><p class="small muted mt12">${fmtDate(s.start, { time: true })} – ${fmtTime(s.end)} · ${{ free: 'Stoppuhr', pomo: 'Pomodoro', goal: 'Zielzeit' }[s.mode]}</p>${s.note ? `<p class="mt12">${esc(s.note)}</p>` : ''}</div>
        <div class="row"><button class="btn outline grow" data-a="shareSession" data-id="${s.id}">${I.share} Teilen</button><button class="btn ghost grow" style="color:#E5484D" data-a="delSession" data-id="${s.id}">${I.trash} Löschen</button></div>`;
    }
    case 'user': {
      const u = St.person(sh.id); if (!u) return head('Profil') + `<div class="empty"><span class="typing"><i></i><i></i><i></i></span></div>`;
      const isFriend = S.friends.includes(u.id), isReq = R.requested.includes(u.id), lg = St.leagueFor(u.allMin);
      const fav = u.favSubject ? St.subj(u.favSubject) : null;
      return `<div class="profile-head"><div class="av-ring">${avatar(u.avatar, 92, u.name)}</div><h2>${esc(u.name)}</h2><div class="faint bold small">@${esc(u.username)} · ${u.canton} · ${levelLabel(u.level)}</div>${u.bio ? `<p class="small muted">${esc(u.bio)}</p>` : ''}
        <div class="row" style="gap:8px"><span class="lvl" style="background:var(--flame-soft);color:var(--flame)">🔥 ${u.streak} Tage</span><span class="lvl" style="background:var(--surface-2);color:var(--ink)">${lg.emoji} ${lg.name}</span></div></div>
        <div class="kpis"><div class="kpi center"><b>${fmtHours(u.weekMin)}</b><span>Diese Woche</span></div><div class="kpi center"><b>${fmtHours(u.allMin)}</b><span>Gesamt</span></div><div class="kpi center"><b>🏆 ${u.trophies}</b><span>Trophäen</span></div></div>
        ${fav ? `<div class="card row"><span style="font-size:26px">${fav.emoji}</span><div class="grow"><div class="faint tiny bold">LIEBLINGSFACH</div><b>${esc(fav.name)}</b></div></div>` : ''}
        ${trophyStrip(u.trophyMap)}
        ${u.isMe ? '' : `<div class="row"><button class="btn ${isFriend || isReq ? 'ghost' : 'primary'} grow" data-a="toggleFriend" data-id="${u.id}">${isFriend ? '✓ Folgst du' : isReq ? 'Angefragt · zurückziehen' : `${I.userPlus} Folgen`}</button></div>
          <div class="row mt12" style="justify-content:center;gap:18px"><button class="faint small bold" data-a="reportUser" data-id="${u.id}">Melden</button><button class="faint small bold" data-a="blockUser" data-id="${u.id}">Blockieren</button></div>`}`;
    }
    case 'leagues': {
      const tot = St.totalMin(), cur = St.leagueFor(tot), N = St.nextLeague(tot);
      const fams = LEAGUE_FAMILIES.map(f => LEAGUES.filter(l => l.fam === f));
      return head('Ligen') + `<p class="small muted mb12">Deine Liga steigt mit deiner gesamten verifizierten Lernzeit – sie sinkt nie. Je höher, desto länger der Weg: Legende ist etwas für die Ausdauerndsten.</p>
        <div class="lg-now" style="background:${cur.grad}"><span class="e">${cur.emoji}</span><div class="grow"><b>${cur.name}</b><span>${fmtHours(tot)} gelernt${N ? ` · nächste: ${N.name} bei ${fmtHours(N.min)}` : ''}</span></div></div>
        <div class="lg-ladder">${fams.slice().reverse().map(tiers => { const f = tiers[0], reached = tot >= f.min, here = tiers.includes(cur);
          return `<div class="lg-fam ${reached ? 'on' : ''} ${here ? 'here' : ''}"><div class="lg-badge" style="background:${f.grad}">${f.emoji}</div><div class="grow"><b>${tiers.length > 1 ? f.name.replace(/ I$/, '') : f.name}</b>
            <div class="lg-steps">${tiers.map(t => `<span class="${tot >= t.min ? 'ok' : ''} ${t === cur ? 'cur' : ''}">${tiers.length > 1 ? t.name.split(' ').pop() : '★'} · ${t.min ? fmtHours(t.min) : 'Start'}</span>`).join('')}</div></div>${here ? '<span class="lg-you">DU</span>' : reached ? '<span class="lg-ok">✓</span>' : ''}</div>`; }).join('')}</div>
        <p class="tiny faint center mt12">Gezählt wird nur verifizierte Zeit (Auto-Pause & Check-ins). Bei ca. 1 h pro Tag: Gold nach rund 1 Monat, Diamant nach 4–5 Monaten, Legende nach gut einem Jahr.</p>`;
    }
    case 'following': {
      const fl = R.following;
      if (!fl) return head('Folge ich') + `<div class="empty"><span class="typing"><i></i><i></i><i></i></span></div>`;
      return head(`Folge ich · ${fl.length}`) + (fl.length ? `<div class="list">${fl.map(u => `<div class="li"><button data-a="openUser" data-id="${u.id}">${avatar(u.avatar, 42, u.name)}</button><button class="t" style="text-align:left" data-a="openUser" data-id="${u.id}"><b>${esc(u.name)}</b><span>@${esc(u.username)}${u.canton ? ' · ' + u.canton : ''}${u.live ? ' · <b style="color:var(--good)">lernt gerade</b>' : u.todayMin ? ' · heute ' + fmtShort(u.todayMin) : ''}</span></button><button class="btn ghost xs" data-a="toggleFriend" data-id="${u.id}">${S.friends.includes(u.id) ? 'Entfolgen' : 'Folgen'}</button></div>`).join('')}</div>`
        : `<div class="empty"><div class="e">👯</div><b>Du folgst noch niemandem</b><div class="small">Such Freunde per Name oder @benutzername.</div></div>`)
        + (R.requested?.length ? `<p class="tiny faint mt12 center">📩 ${R.requested.length} ${R.requested.length === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf Bestätigung</p>` : '')
        + `<button class="btn primary block mt16" data-a="openSheet" data-type="friend">Freunde finden</button>`;
    }
    case 'requests': {
      const rq = R.requests;
      if (!rq) return head('Folgeanfragen') + `<div class="empty"><span class="typing"><i></i><i></i><i></i></span></div>`;
      return head('Folgeanfragen') + (rq.length ? `<div class="list">${rq.map(r => `<div class="li"><button data-a="openUser" data-id="${r.id}">${avatar(r.avatar, 40, r.name)}</button><div class="t"><b>${esc(r.name)}</b><span>@${esc(r.username)} · ${r.canton || ''}</span></div><div class="row" style="gap:6px"><button class="btn ghost xs" data-a="answerRequest" data-id="${r.id}" data-k="0">Ablehnen</button><button class="btn primary xs" data-a="answerRequest" data-id="${r.id}" data-k="1">Annehmen</button></div></div>`).join('')}</div>`
        : `<div class="empty"><div class="e">📭</div><b>Keine offenen Anfragen</b><div class="small">${S.user.followRequests !== false ? 'Wenn dir jemand folgen möchte, erscheint das hier.' : 'Dein Profil ist öffentlich – alle können dir direkt folgen.'}</div></div>`);
    }
    case 'blocked': {
      const bl = R.blocked;
      if (!bl) return head('Blockierte Personen') + `<div class="empty"><span class="typing"><i></i><i></i><i></i></span></div>`;
      return head('Blockierte Personen') + (bl.length ? `<div class="list">${bl.map(r => `<div class="li">${avatar(r.avatar, 40, r.name)}<div class="t"><b>${esc(r.name)}</b><span>@${esc(r.username)}</span></div><button class="btn ghost xs" data-a="unblockUser" data-id="${r.id}">Entblocken</button></div>`).join('')}</div>`
        : `<div class="empty"><div class="e">🕊️</div><b>Niemand blockiert</b><div class="small">Blockierte Personen sehen dein Profil und deine Sessions nicht.</div></div>`)
        + `<div class="tip">${I.info}<span>Entblocken ist still – die Person erfährt nichts davon. Folgen müsst ihr euch danach neu.</span></div>`;
    }
    case 'friend': {
      const q = (f.q || '').toLowerCase();
      const res = St.leaderboard({ scope: 'global', period: 'week' }).filter(u => !u.isMe && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q))).slice(0, 12);
      return head('Freunde finden') + `<div class="field"><input class="input" data-bind="form.q" data-a-input="friendSearch" value="${esc(f.q || '')}" placeholder="Name oder @benutzername suchen"/></div>
        <div class="list" data-live="friendList">${friendRows(res)}</div>
        <button class="btn outline block" data-a="inviteApp">${I.share} Freunde zu Brained einladen</button>`;
    }
    case 'groupCreate': return head('Gruppe erstellen') + `<div class="field"><label>Name</label><input class="input" data-bind="form.name" value="${esc(f.name || '')}" placeholder="z.B. Klasse 3a – Kanti Wettingen"/></div>
      <div class="field"><label>Emoji</label><div class="chips">${['🏫', '📚', '🧪', '🛠️', '🎓', '⚽', '🦁', '🚀', '🍕', '🏔️'].map(e => `<button class="chip-btn ${sel(f.emoji, e)}" data-a="formSet" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Farbe</label><div class="color-row">${SUBJECT_COLORS.slice(0, 8).map(c => `<button class="${sel(f.color, c)}" style="background:${c}" data-a="formSet" data-k="color" data-v="${c}"></button>`).join('')}</div></div>
      <button class="btn primary block" data-a="saveGroup">Erstellen & Einladungscode holen</button>`;
    case 'groupJoin': return head('Gruppe beitreten') + `<p class="muted mb16">Gib den 6-stelligen Code ein, den du von deiner Gruppe bekommen hast.</p>
      <div class="field"><input class="input" style="text-align:center;font-size:26px;font-weight:800;letter-spacing:6px;height:64px;text-transform:uppercase" maxlength="6" data-bind="form.code" value="${esc(f.code || '')}" placeholder="KANTI4"/></div>
      ${f.err ? `<div class="tip mb12" style="color:#c0392b" data-test="join-error">${esc(f.err)}</div>` : ''}<button class="btn primary block" data-a="joinGroup">Beitreten</button>`;
    case 'invite': {
      const g = S.groups.find(g => g.id === sh.id); if (!g) return head('Gruppe');
      const members = g.members.map(id => St.person(id)).filter(Boolean);
      return head('Freunde einladen') + `<div class="card center"><div class="group-em" style="margin:0 auto 10px;background:${g.color}22">${g.emoji}</div><b style="font-size:18px">${esc(g.name)}</b><p class="small muted mt8 mb16">Teile Code oder Link – wer beitritt, landet direkt in eurer Gruppen-Rangliste.</p>
        <div class="code-box" data-test="group-code">${g.code}</div><p class="tiny faint mt8" style="word-break:break-all">${esc(St.inviteLink(g.code))}</p></div>
        <div class="row"><button class="btn outline grow" data-a="copyCode" data-id="${g.code}">${I.copy} Code</button><button class="btn outline grow" data-a="copyLink" data-id="${g.code}">${I.copy} Link</button><button class="btn primary grow" data-a="shareGroup" data-id="${g.id}">${I.share}</button></div>
        <div class="section-t">Mitglieder · ${members.length + 1}</div>
        <div class="list">${rankRow({ ...St.me(), value: St.weekMin(), rank: '👤' })}${members.map(u => rankRow({ ...u, value: u.weekMin, rank: '·' })).join('')}</div>
        ${members.length ? '' : '<p class="small faint center mb12">Noch niemand da – teil den Code mit deiner Klasse!</p>'}
        <button class="btn ghost block" style="color:#E5484D" data-a="leaveGroup" data-id="${g.id}">${g.owner ? 'Gruppe löschen' : 'Gruppe verlassen'}</button>`;
    }
    case 'legal': return head(sh.id === 'agb' ? 'Nutzungsbedingungen' : 'Datenschutz') + `<iframe class="legal-frame" src="legal/${sh.id === 'agb' ? 'agb' : 'datenschutz'}.html"></iframe>`;
    case 'trophy': {
      const d = St.trophyDetail(sh.id); if (!d) return head('Trophäe');
      const n = d.have?.n || 0;
      const grp = TROPHY_GROUPS.find(g => g[0] === d.g)?.[1];
      return `<div class="trophy-hero ${n ? '' : 'locked'}"><div class="em">${d.em}</div>${n > 1 ? `<span class="t-count big">×${n}</span>` : ''}</div>
        <h3 class="center" style="font-size:22px;font-weight:800">${esc(d.name)}</h3>
        <p class="center faint small bold mt8">${grp} · ${d.repeat ? '↻ Mehrfach holbar' : 'Einmalig'}</p>
        <div class="card mt16"><div class="faint tiny bold mb8">SO HOLST DU SIE</div><p style="line-height:1.5">${esc(d.how)}</p>
          ${!n || d.repeat ? `<div class="row mt16 small bold"><span class="grow">${n && d.repeat ? 'Fortschritt zur nächsten' : 'Dein Fortschritt'}</span><span class="num">${d.value.toLocaleString('de-CH')} / ${d.target.toLocaleString('de-CH')}</span></div><div class="progress mt8"><i style="width:${d.pct * 100}%"></i></div>` : ''}</div>
        ${n ? `<div class="kpis" style="grid-template-columns:1fr 1fr 1fr"><div class="kpi center"><b>${n}×</b><span>Geholt</span></div><div class="kpi center"><b style="font-size:15px">${new Date(d.have.first).toLocaleDateString('de-CH')}</b><span>Erstmals</span></div><div class="kpi center"><b style="font-size:15px">${new Date(d.have.last).toLocaleDateString('de-CH')}</b><span>Zuletzt</span></div></div>` : `<p class="center small muted">Noch nicht freigeschaltet – du schaffst das!</p>`}
        <button class="btn primary block mt12" data-a="closeSheet">${n ? 'Stark!' : 'Los geht\'s'}</button>`;
    }
    case 'cardsNotes': return head('Karten aus Dokument') + `<p class="small muted mb12">Lade ein Dokument hoch (PDF oder Foto vom Heft/Buch) oder füg Text ein. Brainy macht daraus Karteikarten.</p>
      <div class="field"><label>Fach</label>${subjChips(f.subjectId, 'formSubj')}</div>
      <label class="upload ${f.upload ? 'has' : ''}"><input type="file" accept="image/*,application/pdf,.pdf" data-a-change="notesFile" hidden/>
        ${f.upload ? `<span style="font-size:26px">${f.upload.type === 'application/pdf' ? '📄' : '🖼️'}</span><div class="grow"><b>${esc(f.upload.name)}</b><span>${Math.round(f.upload.size / 1024)} KB · bereit</span></div><button class="icon-btn plain" data-a="notesFileClear">${I.x}</button>`
          : `<span style="font-size:26px">📎</span><div class="grow"><b>Dokument hochladen</b><span>PDF oder Foto · max. 8 MB</span></div>`}</label>
      <div class="divider">oder Text einfügen</div>
      <div class="field"><textarea class="textarea" style="min-height:120px" data-bind="form.notes" placeholder="Die Mitochondrien sind die Kraftwerke der Zelle. Die Photosynthese findet in den Chloroplasten statt…">${esc(f.notes || '')}</textarea></div>
      ${f.preview ? `<div class="list">${f.preview.map(c => `<div class="li"><div class="t"><b style="white-space:normal">${esc(c.q)}</b><span>${esc(c.a)}</span></div></div>`).join('')}</div>` : ''}
      ${f.preview ? `<button class="btn primary block" data-a="notesSave">${f.preview.length} Karten speichern</button>` : `<button class="btn primary block" data-a="notesMake" ${f.busy ? 'disabled' : ''}>${f.busy ? 'Brainy liest…' : 'Karten erstellen'}</button>`}`;
    case 'apikey': if (BACKEND) return head('Brainy') + `<div class="card center">${brainSVG({ size: 70 })}<p class="small muted mt8">Brainy läuft sicher über den Brained-Server mit Claude von Anthropic. Du musst nichts einrichten.</p></div><div class="tip">${I.lock}<span>Deine Fragen werden nur zur Beantwortung an Anthropic übermittelt und nicht zum Training verwendet. Details in der Datenschutzerklärung.</span></div>`;
      return head('Brainy mit Claude verbinden') + `<div class="card center">${brainSVG({ size: 70 })}<p class="small muted mt8">Brainy läuft mit Claude von Anthropic. Ohne Key bist du im Demo-Modus (lokale Heuristiken).</p></div>
      <div class="field"><label>Anthropic API-Key</label><input class="input" type="password" data-bind="form.key" value="${esc(f.key || '')}" placeholder="sk-ant-…" autocomplete="off"/></div>
      <div class="field"><label>Modell</label><select class="select" data-bind="form.model">${['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'].map(m => `<option ${m === (f.model || S.settings.model) ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="tip mb16">${I.lock}<span>Prototyp: Der Key bleibt nur in diesem Browser. In der Live-Version läuft das über einen sicheren Server – Nutzer:innen brauchen dann keinen Key.</span></div>
      <button class="btn primary block" data-a="saveKey">Speichern</button>${hasKey() ? `<button class="btn ghost block mt8" data-a="removeKey">Key entfernen</button>` : ''}`;
    case 'editProfile': return head('Profil bearbeiten') + `<div class="av-preview"><div class="av-ring">${avatar(f.avatar, 96)}</div></div>${avatarPicker(f.avatar)}
      <div class="field mt16"><label>Name</label><input class="input" data-bind="form.name" value="${esc(f.name)}"/></div>
      <div class="field"><label>Bio</label><input class="input" data-bind="form.bio" value="${esc(f.bio || '')}" placeholder="z.B. Matur 2027" maxlength="60"/></div>
      <div class="field"><label>Kanton</label><select class="select" data-bind="form.canton">${CANTONS.map(c => `<option ${c === f.canton ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <button class="btn primary block" data-a="saveProfile">Speichern</button>`;
    case 'cardAdd': return head('Neue Karteikarte') + `<button class="doc-hint" data-a="openSheet" data-type="cardsNotes"><span>📄</span><div class="grow"><b>Aus Dokument oder Notizen</b><span>PDF, Foto vom Heft oder Text – Brainy macht die Karten</span></div>${I.chev}</button>
      <div class="field"><label>Fach</label>${subjChips(f.subjectId, 'formSubj')}</div>
      <div class="field"><label>Frage</label><textarea class="textarea" data-bind="form.q">${esc(f.q || '')}</textarea></div>
      <div class="field"><label>Antwort</label><textarea class="textarea" data-bind="form.a">${esc(f.a || '')}</textarea></div>
      <button class="btn primary block" data-a="saveCard">Speichern</button>`;
  }
  return '';
}
export function friendRows(res) {
  return res.map(u => `<div class="li">${avatar(u.avatar, 40, u.name)}<div class="t"><b>${esc(u.name)}</b><span>@${esc(u.username)} · ${u.canton} · ${fmtShort(u.weekMin)} diese Woche</span></div><button class="btn ${S.friends.includes(u.id) || R.requested.includes(u.id) ? 'ghost' : 'primary'} xs" data-a="toggleFriend" data-id="${u.id}">${S.friends.includes(u.id) ? '✓' : R.requested.includes(u.id) ? 'Angefragt' : 'Folgen'}</button></div>`).join('') || '<div class="empty small">Niemand gefunden</div>';
}

/* =================================== MODALS =================================== */
function modalView() {
  const m = U.modal;
  if (m.type === 'checkin') {
    const left = S.timer?.checkin ? Math.max(0, 5 * 60000 - (Date.now() - S.timer.checkin.since)) : 0;
    return `<div class="modal"><div class="emoji">${brainSVG({ size: 90, mood: 'wow' })}</div><h3>Bist du noch da?</h3><p>${T.elapsed() < 60000 ? 'Kurzer Fair-Play-Check' : `Du lernst seit ${fmtShort(T.elapsed() / 60000)}`}. Kurz bestätigen, damit deine Zeit zählt.</p>
      <div class="countdown" data-live="checkinLeft">${fmtClock(left)}</div>
      <button class="btn primary block" data-a="checkinYes">Bin noch da!</button><button class="btn ghost block mt8" data-a="checkinPause">Pause machen</button></div>`;
  }
  if (m.type === 'confirmPlanDel') return `<div class="modal"><div class="emoji">🗑️</div><h3>Lernplan löschen?</h3><p>Der Plan und seine Sessions im Kalender werden entfernt. Deine bisherigen Lernsessions bleiben.</p>
    <button class="btn primary block" style="background:#E5484D" data-a="planDelConfirm" data-id="${m.id}">Löschen</button><button class="btn ghost block mt8" data-a="closeModal">Abbrechen</button></div>`;
  if (m.type === 'confirmFinish') return `<div class="modal"><div class="emoji">🏁</div><h3>Session beenden?</h3><p>${fmtShort(T.elapsed() / 60000)} ${St.subj(S.timer.subjectId).name}. ${T.elapsed() < 60000 ? 'Unter 1 Minute wird nicht gespeichert.' : 'Stark gemacht!'}</p>
    <button class="btn primary block" data-a="finishConfirm">Beenden & speichern</button><button class="btn ghost block mt8" data-a="closeModal">Weiterlernen</button>
    <button class="btn block mt8 small faint" style="height:36px" data-a="discardTimer">Verwerfen</button></div>`;
  if (m.type === 'report') return `<div class="modal"><div class="emoji">🚩</div><h3>Person melden</h3><p>Was ist das Problem? Wir prüfen jede Meldung innert 24 Stunden.</p>
    <textarea class="textarea mb12" data-bind="form.reason" placeholder="z.B. beleidigender Name, Spam, unangemessene Notiz"></textarea>
    <button class="btn primary block" data-a="reportSend" data-id="${m.id}">Meldung senden</button><button class="btn ghost block mt8" data-a="closeModal">Abbrechen</button></div>`;
  if (m.type === 'info') return `<div class="modal"><div class="emoji">${m.emoji}</div><h3>${m.title}</h3><p>${m.text}</p><button class="btn primary block" data-a="${m.action || 'closeModal'}">${m.cta || 'OK'}</button>${m.secondary ? `<button class="btn ghost block mt8" data-a="${m.secondaryAction}">${m.secondary}</button>` : ''}</div>`;
  return '';
}
