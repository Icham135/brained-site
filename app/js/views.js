// Alle Screens als Template-Funktionen. Events laufen über data-a="aktion" (siehe app.js).
import * as St from './store.js';
import * as T from './timer.js';
import { hasKey, localInsights } from './ai.js';
import { clarityView, clarityHub, clarityHomeCard, CLARITY_NAME } from './clarity.js';
import { trophyStrip } from './trophies-ui.js';
import { playView, roomOverlayView } from './rooms.js';
import { profileV2View } from './profile-v2.js';
import { rankV2View, REGIONS } from './rank-v2.js';
import { aiConsentSheet } from './clarity-upload.js';
import { reportSheet } from './clarity-report.js';
import { esc, subjIcon, subjInit, fmtShort, fmtHours, fmtClock, fmtTime, fmtDate, timeAgo, I, brainSVG, avatar, normAvatar, ring, focusLine, WD } from './ui.js';
import { PRO, SHOP_CONSUMABLES, SHOP_ITEMS, SHOP_FRAMES, BRAIN_SKINS, BRAIN_MOODS, CANTONS, LEVELS, AVATAR_BGS, LEAGUES, LEAGUE_FAMILIES, TROPHY_GROUPS, ADS, SUBJECT_COLORS, SUBJECT_EMOJIS, PURPOSES } from './data.js';
import { U } from './view-state.js';
import { shopView as shopViewNew } from './shop-ui.js';
import { CONFIG, BACKEND, SHOWCASE } from './config.js';
import { LANGS, lang, curLang } from './i18n.js';
import { R } from './backend.js';
import * as GM from './games.js';

const S = St.S;
const sel = (a, b) => a === b ? 'on' : '';
const safeColor = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#5B6CFF';
const subjTag = s => `<span class="subj-tag" style="background:${s.color}22;color:${s.color}">${subjIcon(s)}${esc(s.name)}</span>`;
const levelLabel = (id, txt) => id === 'other' ? (txt || 'Anderes') : LEVELS.find(l => l.id === id)?.label || '';

export function renderApp() {
  let h = '';
  if (!S.user) h += onboarding();
  else {
    h += shell();
    if (U.overlay === 'timer') h += `<div class="overlay">${timerView()}</div>`;
    if (U.overlay === 'summary') h += `<div class="overlay">${summaryView()}</div>`;
    if (U.overlay === 'profile') h += `<div class="overlay">${profileV2View()}</div>`;
    if (U.overlay === 'room') h += `<div class="overlay">${roomOverlayView()}</div>`;
    if (U.standby && S.timer) h += standbyView();
  }
  if (U.sheet) h += `<div class="scrim" data-a="closeSheet" data-self="1"><div class="sheet" data-keep="sheet"><div class="grab"></div>${sheetView()}</div></div>`;
  if (U.modal) h += `<div class="scrim center">${modalView()}</div>`;
  if (U.toast) h += `<div class="toast"><span class="toast-t ${U.toast.action ? '' : 'c'}">${U.toast.html}</span>${U.toast.action ? `<button data-a="${U.toast.action}">${esc(U.toast.label)}</button>` : ''}</div>`;
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
  level: { q: 'Welche Schule besuchst du gerade?', sub: 'Schweiz, Deutschland und Österreich', opts: LEVELS.map(l => [l.id, l.label, l.hint, l.g]) },
  weekly: { q: 'Wie viel willst du pro Woche lernen?', sub: 'Du musst nicht jeden Tag lernen – zählt wird die Woche.', opts: [['3', '3 Stunden'], ['5', '5 Stunden'], ['7', '7 Stunden'], ['10', '10 Stunden'], ['15', '15 Stunden'], ['20', '20+ Stunden']] },
  struggles: { q: 'Was bremst dich beim Lernen?', sub: 'Mehrere möglich', multi: true, opts: [['phone', 'Ablenkung durchs Handy'], ['motivation', 'Fehlende Motivation'], ['focus', 'Konzentration'], ['procrast', 'Aufschieben'], ['anxiety', 'Prüfungsangst'], ['none', 'Ich habe keine Probleme']] },
};
const HELP = {
  phone: ['📵', 'Auto-Pause', 'Verlässt du die App, pausiert der Timer. Ehrliche Minuten zählen.'],
  motivation: ['🔥', 'Streaks & Freunde', 'Halte deine Serie und miss dich in der Rangliste.'],
  focus: ['🍅', 'Pomodoro-Timer', '25 Minuten Fokus, 5 Minuten Pause – automatisch.'],
  procrast: ['🗓️', 'Lernplan von Brainy', 'Brainy plant bis zur Prüfung – du startest nur noch.'],
  anxiety: ['📝', 'Probeprüfungen', 'Übe echte Prüfungen mit Note, bis du dich sicher fühlst.'],
  none: ['🏆', 'Trophäen & Ligen', 'Sammle über 30 Trophäen und steig in höhere Ligen auf.'],
};
export const ONB_STEPS = ['level', 'weekly', 'struggles', 'plan', 'auth', 'profile', 'avatar', 'subjects'];
// Brainy reagiert auf jede Antwort
const REACT = {
  level: { sek: 'Sek? Da legen wir das Fundament!', gym: 'Kanti-Power!', lehre: 'Lehre + Lernen = Profi', bms: 'BMS – stark!', fh: 'FH/PH, nice!', uni: 'Uni-Level, respekt!', wb: 'Nie zu spät zum Lernen', other: 'Auch das passt – Brainy lernt mit dir' },
  weekly: { '3': 'Klein starten ist smart', '5': 'Solide – das schaffst du!', '7': 'Eine Stunde am Tag – perfekt!', '10': 'Ambitioniert!', '15': 'Wow, Prüfungsmodus!', '20': 'Legendär. Pausen nicht vergessen!' },
};
export const LOAD_ITEMS = [['🧠', 'Brainy lernt dich kennen…'], ['🎯', 'Ziele werden gesetzt…'], ['🔥', 'Streak wird gezündet…']];

function onbBar() {
  const i = ONB_STEPS.indexOf(U.onb.step);
  const pct = Math.round(((i + 1) / (ONB_STEPS.length + 1)) * 100);
  return `<div class="qbar"><button class="icon-btn plain" data-a="onbBack">${I.back}</button><div class="track"><div class="fill" style="width:${pct}%"></div><span class="rider" style="left:${pct}%">${brainSVG({ size: 30 })}</span></div><span class="qcount">${i + 1}/${ONB_STEPS.length}</span></div>`;
}
const mascotHead = (q, mood = 'happy') => `<div class="qhead"><div class="m">${brainSVG({ size: 58, mood })}</div><div class="bubble">${q}</div></div>`;

// Jeder Schritt bekommt eine eigene id → morphdom ersetzt den Container, der Schritt gleitet sanft ein
const ONB_COUNTRIES = [['CH', 'Schweiz'], ['AT', 'Österreich'], ['DE', 'Deutschland'], ['OTHER', 'Andere']];
function onboarding() {
  const html = onboardingStep();
  return html.replace(/^(\s*)<div class="onb/, `$1<div id="onb-${U.onb.step}" class="onb`);
}
function onboardingStep() {
  const o = U.onb, d = o.d;
  if (o.step === 'intro') {
    return `<div class="onb onb2">
      <div class="lang-row">${LANGS.map(l => `<button class="${l.id === lang ? 'on' : ''}" data-a="setLang" data-id="${l.id}">${l.id.toUpperCase()}</button>`).join('')}</div>
      <div class="onb-hero" style="gap:10px">
        <div class="welcome-title">Willkommen bei</div>
        <div class="welcome-logo">Brained</div>
        <div class="ov-stage"><div class="mascot-big" data-a="pokeBrainy" style="margin:18px 0 8px">${brainSVG({ size: 210, body: true, mood: o.poke ? ['wow', 'love', 'happy'][o.poke % 3] : 'happy' })}</div></div>
        <div class="tap-hint">${o.poke ? ['Hihi, das kitzelt!', 'Ich bin Brainy – dein Lern-Buddy! 🧠', 'Zusammen schaffen wir jede Prüfung 💪', 'Okay okay, lass uns loslegen! 🚀'][(o.poke - 1) % 4] : 'Tippe auf Brainy'}</div>
        <p style="margin-top:6px">Mach dein Lernen sichtbar.<br>Tracke deine Zeit, halte Streaks, lern mit Freunden.</p>
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
    const opt = ([id, label, hint]) => `<button class="ob-opt ${isOn(id) ? 'on' : ''}" role="${Q.multi ? 'checkbox' : 'radio'}" aria-checked="${isOn(id)}" data-a="quizPick" data-id="${id}"><span class="t">${label}</span>${hint ? `<span class="h">${hint}</span>` : ''}</button>`;
    let list;
    if (o.step === 'level') {
      const groups = [...new Set(Q.opts.map(x => x[3]))];
      list = groups.map(g => `<div class="ob-g">${g}</div><div class="ob-list">${Q.opts.filter(x => x[3] === g).map(opt).join('')}</div>`).join('')
        + `<div class="ob-g">Anderes</div><div class="ob-list">${opt(['other', 'Anderes', 'Eigene Eingabe'])}</div>`
        + (val === 'other' ? `<input class="input ob-own" data-bind="onb.d.levelText" value="${esc(d.levelText || '')}" placeholder="z. B. Handelsschule, Abendgymnasium" maxlength="40" enterkeyhint="done"/>` : '');
    } else list = `<div class="ob-list ${o.step === 'weekly' ? 'two' : ''}">${Q.opts.map(opt).join('')}</div>`;
    return `<div class="onb onb2">${onbBar()}
      <div class="qhero"><div class="qbrain ${react ? 'happy' : ''}">${brainSVG({ size: 92, mood: react ? (o.step === 'struggles' ? 'love' : 'grin') : 'think' })}</div>
        <h2 class="qtitle">${Q.q}</h2>${Q.sub ? `<div class="qsub">${Q.sub}</div>` : ''}
        <div class="qreact">${react || '&nbsp;'}</div></div>
      <div class="ob-wrap" role="${Q.multi ? 'group' : 'radiogroup'}">${list}</div>
      <div style="flex:1;min-height:16px"></div>
      <button class="btn3d" data-a="quizNext" ${ok ? '' : 'disabled'}>Weiter</button></div>`;
  }
  if (o.step === 'plan') {
    const goal = +(d.quiz.weekly || 7) * 60, weeks = [.4, .6, .8, 1].map(f => Math.round(goal * f / 30) * 30);
    const items = (d.quiz.struggles?.length ? d.quiz.struggles : ['none']).slice(0, 3).concat(d.quiz.struggles?.includes('motivation') ? [] : ['motivation']).slice(0, 3);
    return `<div class="onb onb2">${onbBar()}
      <div class="qhero"><div class="qbrain happy">${brainSVG({ size: 80, mood: 'wow' })}</div><h2 class="qtitle">Dein Plan steht!</h2></div>
      <div class="plan-chart"><div class="row" style="justify-content:space-between"><b style="color:var(--brand)">Dein Weg zum Wochenziel</b><span class="faint small bold">${fmtShort(goal)} / Woche</span></div>
        <div class="bars">${weeks.map((m, i) => `<div><b>${fmtShort(m)}</b><i style="height:${Math.round(m / goal * 100)}%;animation-delay:${i * .12}s"></i><small>Woche ${i + 1}</small></div>`).join('')}</div>
        <div class="faint small mt8" style="text-align:center">Vorschlag: in 4 Wochen von 40 % auf 100 % steigern. Neue Gewohnheiten halten besser, wenn man klein startet und regelmässig etwas mehr macht – wer gleich mit dem vollen Pensum beginnt, gibt schneller auf. Dein Ziel kannst du jederzeit in der Statistik ändern.</div></div>
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
        ${check('age', 'Ich bin mindestens 13 Jahre alt. Bin ich unter 16, haben meine Eltern oder Erziehungsberechtigten zugestimmt.')}
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
    <div class="field"><label>Benutzername</label><input class="input" data-bind="onb.d.username" maxlength="24" value="${esc(d.username)}" placeholder="leameier" autocapitalize="off" autocomplete="username"/></div>
    <div class="field"><label id="onbCountry">Land</label><div class="chips" role="radiogroup" aria-labelledby="onbCountry">${ONB_COUNTRIES.map(([k, l]) => `<button class="chip-btn ${d.country === k ? 'on' : ''}" role="radio" aria-checked="${d.country === k}" data-a="onbCountry" data-v="${k}">${l}</button>`).join('')}</div></div>
    ${REGIONS[d.country] ? `<div class="field"><label>${REGIONS[d.country].label}</label><select class="select" data-bind="onb.d.region"><option value="">${REGIONS[d.country].label} wählen</option>${REGIONS[d.country].list.map(([k, l]) => `<option value="${esc(k)}" ${k === d.region ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label id="onbAge">Wie alt bist du?</label><div class="chips" role="radiogroup" aria-labelledby="onbAge"><button class="chip-btn ${d.band === '13-15' ? 'on' : ''}" role="radio" aria-checked="${d.band === '13-15'}" data-a="onbBand" data-v="13-15">13–15</button><button class="chip-btn ${d.band === '16+' ? 'on' : ''}" role="radio" aria-checked="${d.band === '16+'}" data-a="onbBand" data-v="16+">16 oder älter</button><button class="chip-btn ${d.band === 'u13' ? 'on' : ''}" role="radio" aria-checked="${d.band === 'u13'}" data-a="onbBand" data-v="u13">Jünger als 13</button></div></div>
    ${d.band === 'u13' ? '<p class="small bold" role="alert" style="color:#E5484D">Brained ist erst ab 13. Frag in ein paar Jahren nochmals.</p>' : ''}
    ${!d.terms || !d.age ? `<div class="consents mt12">
      <button class="consent" data-a="onbConsent" data-k="terms"><span class="cbox ${d.terms ? 'on' : ''}">${d.terms ? '✓' : ''}</span><span>Ich akzeptiere die <a href="#" data-a="openLegal" data-id="agb">Nutzungsbedingungen</a> und habe die <a href="#" data-a="openLegal" data-id="datenschutz">Datenschutzerklärung</a> gelesen.</span></button>
      <button class="consent" data-a="onbConsent" data-k="age"><span class="cbox ${d.age ? 'on' : ''}">${d.age ? '✓' : ''}</span><span>Ich bin mindestens 13 Jahre alt. Bin ich unter 16, haben meine Eltern oder Erziehungsberechtigten zugestimmt.</span></button></div>` : ''}
    <div style="flex:1"></div>
    <button class="btn3d mt16" data-a="onbTo" data-step="avatar">Weiter</button></div>`;
  if (o.step === 'avatar') return `<div class="onb onb2">${onbBar()}
    ${mascotHead('Wähl deinen Avatar')}
    <div class="av-preview"><div class="av-ring">${avatar(d.avatar, 112)}</div>
      <button class="btn ghost sm" data-a="avShuffle">${I.refresh} Zufällig</button></div>
    ${avatarPicker(d.avatar, true)}
    <div class="faint small center mt8">Hüte, Brillen & mehr schaltest du später frei</div>
    <div style="flex:1"></div>
    <button class="btn3d mt16" data-a="onbTo" data-step="subjects">Sieht gut aus!</button></div>`;
  if (o.step === 'subjects') {
    const study = ['fh', 'uni'].includes(d.quiz?.level || d.level);
    const chips = `<div class="chips">${St.subjectsForLevel(d.quiz?.level || d.level, d.subjects).map(s => `<button class="chip-btn ${d.subjects.includes(s.id) ? 'on' : ''}" data-a="onbSubj" data-id="${s.id}"><span class="dot" style="background:${s.color}"></span>${esc(s.name)}</button>`).join('')}</div>`;
    const own = `<div class="onb-own ${study ? '' : 'mt16'}"><b>${study ? 'Deine Module' : 'Eigenes Fach'}</b><span>${study ? 'Trag die Module ein, die du dieses Semester hast – z.B. Analysis I, Makroökonomie, Anatomie. Lernzeit, Karteikarten und Probeprüfungen laufen dann pro Modul.' : 'Fehlt etwas? Füg es hinzu – z.B. Wirtschaft, Musik, Informatik.'}</span>
      <div class="row mt8" style="gap:8px"><input class="input grow" data-bind="onb.d.newSubj" value="${esc(d.newSubj || '')}" placeholder="${study ? 'z.B. Lineare Algebra' : 'z.B. Informatik'}" maxlength="30" enterkeyhint="done"/><button class="btn primary sm" data-a="onbAddSubj">＋</button></div></div>`;
    return `<div class="onb onb2">${onbBar()}
    ${mascotHead(study ? 'Welche Module hast du?' : 'Welche Fächer lernst du?')}
    ${study ? `${own}<div class="tiny faint bold mt16 mb8">ODER FACHBEREICH WÄHLEN</div>${chips}` : chips + own}
    ${BACKEND ? '' : `<button class="card row mt16" style="width:100%;text-align:left" data-a="onbDemo"><div class="grow"><b>Mit Demo-Daten starten</b><div class="faint small" style="margin-top:3px">3 Wochen Beispiel-Sessions, Freunde & Gruppe</div></div><span class="switch ${d.demo ? 'on' : ''}"></span></button>`}
    <div style="flex:1"></div>
    <button class="btn3d mt24" data-a="onbLoad" ${d.subjects.length ? '' : 'disabled'}>Weiter (${d.subjects.length})</button></div>`;
  }
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

export function avatarPicker(a, onb) {
  a = normAvatar(a);
  const skins = BRAIN_SKINS.filter(k => onb ? !k.price : !k.price || St.owns(k.id));
  return `<div class="av-lbl">Farbe</div><div class="av-edit-row">${skins.map(k => `<button class="${sel(a.skin, k.id)}" data-a="avSkin" data-id="${k.id}">${brainSVG({ size: 44, fill: k.fill, fold: k.fold, outline: k.outline })}</button>`).join('')}
      ${onb ? '' : '<button data-a="openShop" title="Shop">🛍️</button>'}</div>
    <div class="av-lbl">Gesicht</div><div class="av-edit-row">${BRAIN_MOODS.map(([m]) => `<button class="${sel(a.mood || 'happy', m)}" data-a="avMood" data-id="${m}">${brainSVG({ size: 44, mood: m, fill: '#FFD3E2' })}</button>`).join('')}</div>
    <div class="av-lbl">Hintergrund</div><div class="color-row">${AVATAR_BGS.map(c => `<button class="${sel(a.bg, c)}" style="background:#${c}" data-a="avBg" data-id="${c}"></button>`).join('')}</div>${ownedAccessories(a)}`;
}
// Gekaufte Accessoires & Rahmen direkt im Gehirn-Editor an- und ablegen
function ownedAccessories(a) {
  const items = SHOP_ITEMS.filter(it => it.slot !== 'effect' && St.owns(it.id)), frames = SHOP_FRAMES.filter(f => St.owns(f.id));
  if (!items.length && !frames.length) return '';
  const btn = (id, prev, on, ic) => `<button class="${on ? 'on' : ''}" data-a="avItem" data-id="${id}">${ic || avatar(prev, 44)}</button>`;
  return `<div class="av-lbl">Accessoires</div><div class="av-edit-row">${items.map(it => btn(it.id, { ...a, [it.slot]: it.id }, a[it.slot] === it.id)).join('')}${frames.map(f => btn(f.id, { ...a, frame: f.id }, a.frame === f.id)).join('')}</div>`;
}

/* =================================== SHELL =================================== */
const isDarkNow = () => document.documentElement.dataset.theme === 'dark';
const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
const SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const TOOL_TITLES = { clarity: CLARITY_NAME, cards: 'Karteikarten', game: 'Spiele' };
const COIN = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#F5B70A"/><circle cx="8" cy="8" r="4.3" fill="none" stroke="#FFE08A" stroke-width="1.6"/></svg>`;
const FLAME = `<svg viewBox="0 0 14 16" aria-hidden="true"><path class="fl" d="M7 1 C9 5 13 6 12 11 C11 14 9 15 7 15 C4 15 2 13 2 10 C2 7 5 6 5 3 C6 4 7 5 7 1 Z" fill="#FF7A1A"/></svg>`;
function shell() {
  // Brain Jump läuft im Vollbild (ohne Kopfzeile & Tab-Leiste), damit nichts den Spielstand verdeckt
  const g = U.tab === 'ai' && U.ai.tool === 'game' && GM.state();
  if (g && g.id === 'jump' && !g.over) return `<main class="content game-full" data-keep="game-jump">${GM.gameView()}</main>`;
  const st = St.streakInfo(), tool = U.tab === 'ai' && U.ai.tool, env = tool === 'clarity' ? ' cl-env' : '';   // Clarity-Umgebung: blauer Look
  const av = `<button class="v2-av" data-a="openProfile" aria-label="Profil">${avatar(S.user.avatar, 40, S.user.name)}</button>`;
  let left;
  if (tool === 'clarity') left = `<button class="cl-exit" data-a="aiBack" aria-label="Brained Clarity beenden">${I.back}<span>Beenden</span></button>`;   // in Clarity keine Tableiste: Ausgang nur hier
  else if (tool) left = `<button class="icon-btn" data-a="aiBack">${I.back}</button><h1 style="font-size:21px">${TOOL_TITLES[tool]}</h1>`;
  else if (U.tab === 'home') left = `${av}<div class="v2-greet"><small>${greeting()}</small><b>${esc(S.user.name.split(' ')[0])}</b></div>`;
  else left = `${av}<h1>${{ stats: 'Statistik', rank: 'Rangliste', ai: 'Clarity' }[U.tab]}</h1>`;
  const content = { home: homeView, stats: statsView, rank: rankV2View, ai: aiView }[U.tab]();
  return `<header class="topbar ${tool ? 'in-tool' : ''}${env}">${left}
      <button class="v2-pill" data-a="openProfile" aria-label="Münzen">${COIN}<span class="num">${St.coins().toLocaleString('de-CH')}</span></button>
      <button class="v2-pill ${st.current ? (st.atRisk ? 'warn' : '') : 'dead'}" data-a="openSheet" data-type="streak" aria-label="Streak">${FLAME}<span class="num">${st.current}</span></button>
      <button class="v2-pill th" data-a="toggleDark" aria-label="${isDarkNow() ? 'Hellmodus' : 'Darkmode'}">${isDarkNow() ? SUN : MOON}</button>
    </header>
    <main class="content${env}" data-keep="tab-${U.tab}${U.ai.tool || ''}">${content}</main>
    ${env ? '' : tabbar()}`;
}
const TAB_ICO = {
  home: '<path d="M4 10.5 L12 4 L20 10.5 V19 a1 1 0 0 1 -1 1 H15 V14 H9 V20 H5 a1 1 0 0 1 -1 -1 Z"/>',
  ai: '<path class="fl" d="M7 7.5 a3 3 0 0 1 5 -2 a3 3 0 0 1 5 2 a3 3 0 0 1 2 5 a3 3 0 0 1 -2.5 5 a3 3 0 0 1 -4.5 1.5 a3 3 0 0 1 -4.5 -1.5 A3 3 0 0 1 5 12.5 a3 3 0 0 1 2 -5 Z"/><path d="M12 6 V18" stroke-width="1.5"/>',
  rank: '<path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z M7 6 H4 a3 3 0 0 0 3 4 M17 6 H20 a3 3 0 0 1 -3 4 M12 14 V18 M8 20 H16"/>',
  stats: '<path d="M4 20 H20 M7 20 V13 M12 20 V6 M17 20 V10" stroke-width="2.2"/>',
};
function tabbar() {
  const t = (id, label) => `<button class="tab t-${id} ${U.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICO[id]}</svg><span>${label}</span></button>`;
  const live = S.timer;
  return `<nav class="tabbar">${t('home', 'Home')}${t('ai', 'Clarity')}
    <div class="tab-start"><button class="${live ? 'live' : ''}" data-a="openPlay" aria-label="Lernen starten">${live ? `<span class="live-time" data-live="tabclock">${fmtClock(T.elapsed())}</span>` : '<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M3 1.5 L14.5 9 L3 16.5 Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'}</button></div>
    ${t('rank', 'Rangliste')}${t('stats', 'Statistik')}</nav>`;
}

/* =================================== HOME =================================== */
function greeting() { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 17 ? 'Hoi' : h < 22 ? 'Guten Abend' : 'Noch wach'; }
const BRAIN_DECO = `<svg class="deco" viewBox="0 0 120 110" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="3"><circle cx="38" cy="46" r="17"/><circle cx="60" cy="38" r="19"/><circle cx="82" cy="46" r="17"/><circle cx="29" cy="64" r="15"/><circle cx="91" cy="64" r="15"/><circle cx="45" cy="78" r="15"/><circle cx="75" cy="78" r="15"/></g></svg>`;
function homeView() {
  const st = St.streakInfo(), today = St.todayMin(), wk = St.weekMin();
  let h = '<div class="v2-home">';
  if (S.timer) {
    const s = St.subj(S.timer.subjectId);
    h += `<button class="card row ov-live v2-live ${S.timer.segStart ? '' : 'paused'}" data-a="openTimer">
      <div class="li ico" style="background:${s.color}22;padding:0;border:0;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:16px;font-weight:800;color:${s.color}">${esc(subjInit(s))}</div>
      <div class="grow"><b>${S.timer.segStart ? 'Session läuft' : 'Session pausiert'}</b><div class="faint small bold">${esc(s.name)}</div></div>
      <b class="num" style="font-size:22px" data-live="clock">${fmtClock(T.elapsed())}</b></button>`;
  }
  // Heute gelernt: nur Zeit heute und Woche, Fach-Chips (kein Ziel, kein Knopf)
  const t0 = St.startOfDay(Date.now()), by = {};
  S.sessions.filter(s => s.start >= t0).forEach(s => by[s.subjectId] = (by[s.subjectId] || 0) + s.min);
  const chips = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
  h += `<section class="v2-today">${BRAIN_DECO}<div class="k">HEUTE GELERNT</div><div class="big" data-count>${today ? fmtShort(today) : '0m'}</div><div class="wk">Diese Woche ${fmtShort(wk)}</div>
    ${chips.length ? `<div class="chips">${chips.map(([id, m]) => `<span>${esc(St.subj(id).name)} · ${fmtShort(m)}</span>`).join('')}</div>` : `<div class="none">Noch nichts gelernt heute</div>`}<button class="v2-sharebtn" data-a="openSheet" data-type="statsCard">${I.share} Meine Stats teilen</button></section>`;
  if (st.atRisk) h += `<button class="v2-warn" data-a="openSheet" data-type="streak">Deine <b>${st.current}-Tage-Streak</b> läuft heute ab. Schon 5 Minuten retten sie.</button>`;
  h += clarityHomeCard();

  // Freunde heute
  const ft = St.friendsToday(), liveN = ft.filter(u => u.live).length;
  if (R.requests?.length) h += `<button class="v2-req" data-a="openRequests"><div class="grow"><b>${R.requests.length === 1 ? '1 Folgeanfrage' : `${R.requests.length} Folgeanfragen`}</b><div class="tiny">${esc(R.requests.slice(0, 2).map(r => r.name.split(' ')[0]).join(', '))}${R.requests.length > 2 ? ' …' : ''} möchte dir folgen</div></div>${I.chev.replace('<svg', '<svg class="chev" width="18" height="18"')}</button>`;
  h += `<section class="v2-fr"><div class="h"><b>Freunde heute</b>${liveN ? `<span class="lv"><i></i>${liveN} live</span>` : ''}</div>
    ${ft.length ? `<div class="row5">${ft.slice(0, 5).map(u => `<button class="fv ${u.live ? 'live' : u.todayMin ? 'on' : ''}" data-a="openUser" data-id="${u.id}"><div class="rg">${avatar(u.avatar, 44, u.name)}</div><span>${esc(u.name.split(' ')[0])}</span><small>${u.live ? 'live' : u.todayMin ? fmtShort(u.todayMin) : '–'}</small></button>`).join('')}</div>`
      : `<div class="empty-t">Noch niemandem gefolgt.<br>Such Freunde per Name oder @benutzername.</div>`}
    <div class="btns"><button data-a="openFollowing" ${ft.length ? '' : 'disabled'}>Alle anzeigen</button><button class="main" data-a="openSheet" data-type="friend">Hinzufügen</button></div></section>`;

  // Feed: kurz halten – 2 Einträge, Rest auf Wunsch
  const items = St.feed();
  const shown = U.feedOpen ? items.slice(0, 12) : items.slice(0, 2);
  h += `<div class="v2-sec">Aktivitäten</div>`;
  if (!items.length) h += `<div class="empty" style="padding:18px"><b>Noch keine Aktivitäten</b><div class="small">Folge Freunden oder starte deine erste Session.</div></div>`;
  shown.forEach((it, i) => { h += feedItem(it); if (i === 2 && !St.isPro() && CONFIG.ADS_ENABLED) h += adSlot(i); });
  if (items.length > 2) h += `<button class="btn ghost block sm" data-a="toggleFeed">${U.feedOpen ? 'Weniger anzeigen' : `Mehr anzeigen (${Math.min(12, items.length) - 2})`}</button>`;
  return h + '</div>';
}

function feedItem(it) {
  const s = St.subj(it.subjectId), mine = typeof S.boosts[it.id] === 'string' ? S.boosts[it.id] : S.boosts[it.id] ? '🔥' : null;
  const total = St.reactionTotal(it), top = St.topReactions(it);
  const start = it.ts - it.min * 60000 - 8 * 60000;
  const segs = it.session?.segments || (() => { const a = []; let t = start; const parts = Math.max(1, Math.round(it.min / 30)); const len = it.min * 60000 / parts; for (let k = 0; k < parts; k++) { a.push([t, t + len]); t += len + 4 * 60000; } return a; })();
  return `<article class="feed-item">
    <div class="feed-top"><button data-a="openUser" data-id="${it.user.id}">${avatar(it.user.avatar, 42, it.user.name)}</button>
      <div class="who"><b>${esc(it.own ? 'Du' : it.user.name)}</b><span>${timeAgo(it.ts)} · ${esc(it.user.canton)}${it.user.streak ? ` · 🔥 ${it.user.streak}` : ''}</span></div>${subjTag(s)}</div>
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
    else { const f = el - t.pomo.focusStartAcc; pct = f / (25 * 60000); sub = `Pomodoro #${t.pomo.count + 1} · noch ${fmtClock(25 * 60000 - f)}`; }
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
  const mood = t.status === 'break' ? 'ov-break' : t.status === 'running' ? 'ov-run' : 'ov-pause';
  return `<div class="ov-aura ${mood}" style="--ov-accent:${t.status === 'break' ? 'var(--violet)' : safeColor(s.color)}"><i></i><i></i></div><div class="timer-screen ${mood}" style="--ov-accent:${t.status === 'break' ? 'var(--violet)' : safeColor(s.color)}">
    <div class="timer-top"><button class="icon-btn" data-a="closeOverlay">${I.down}</button>${subjTag(s)}<button class="icon-btn" data-a="standby" title="Mond-Modus">${I.moon}</button></div>
    <div class="timer-center">
      ${pill}
      <div class="big-ring">
        <svg width="290" height="290"><circle cx="145" cy="145" r="${R}" stroke="var(--surface-2)" stroke-width="14" fill="none"/>
          <circle class="ov-arc" data-live="ring" data-c="${C}" cx="145" cy="145" r="${R}" stroke="${t.status === 'break' ? 'var(--violet)' : s.color}" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - L.pct)}" style="transition:stroke-dashoffset 1s linear"/></svg>
        <div class="inner"><div class="timer-ico">${subjIcon(s, 40)}</div><div class="clock" data-live="clock">${L.clock}</div><div class="clock-sub" data-live="sub">${L.sub}</div></div>
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
    <div class="subj-grid">${subs.map(s => `<button class="subj-btn ${sel(su.subjectId, s.id)}" style="color:${s.color}" data-a="setupSubj" data-id="${s.id}"><span class="e">${subjIcon(s, 30)}</span><span style="color:var(--ink)">${esc(s.name)}</span></button>`).join('')}
      <button class="subj-btn ${sel(su.subjectId, 'general')}" style="color:#9893A8" data-a="setupSubj" data-id="general"><span class="e">📚</span><span style="color:var(--ink)">Allgemein</span></button>
      <button class="subj-btn add" data-a="openSheet" data-type="subjects"><span class="e">＋</span>Fächer</button></div>
    <p class="tiny faint mt8">Kein bestimmtes Fach oder mehrere gleichzeitig? Wähl «Allgemein». Das Fach kannst du am Schluss noch ändern.</p>
    <div class="section-t">Modus</div>
    <div class="mode-cards">
      <button class="mode-card ${sel(su.mode, 'free')}" data-a="setupMode" data-id="free"><span class="e">⏱️</span><b>Stoppuhr</b><span>Frei lernen</span></button>
      <button class="mode-card ${sel(su.mode, 'pomo')}" data-a="setupMode" data-id="pomo"><span class="e">🍅</span><b>Pomodoro</b><span>25 / 5 min</span></button>
      <button class="mode-card ${sel(su.mode, 'goal')}" data-a="setupMode" data-id="goal"><span class="e">🎯</span><b>Zielzeit</b><span>${su.goalMin} min</span></button>
    </div>
    <p class="small muted mt8">${{ free: '<b>Stoppuhr:</b> Du lernst, so lange du willst, und beendest die Session selbst.', pomo: '<b>Pomodoro:</b> 25 Minuten konzentriert lernen, dann 5 Minuten Pause. Der Timer wechselt automatisch, nach 4 Runden gibt es 15 Minuten Pause. Kurze, feste Blöcke helfen gegen Aufschieben und Ablenkung.', goal: '<b>Zielzeit:</b> Du legst fest, wie lange du lernst. Erreichst du das Ziel, gibt es +15 XP.' }[su.mode] || ''}</p>
    ${su.mode === 'goal' ? `<div class="chips mt12">${[25, 45, 60, 90, 120, 180].map(m => `<button class="chip-btn ${sel(su.goalMin, m)}" data-a="setupGoal" data-m="${m}">${m} min</button>`).join('')}</div>` : ''}
    <div class="tip mt16">${I.info}<span><b>Fair-Play-Regeln:</b> Verlässt du die App, pausiert der Timer automatisch. ${S.settings.checkinMin ? `<b>Check-in:</b> Alle ${S.settings.checkinMin} min fragt Brainy «Bist du noch da?». Tippst du innert 5 Minuten auf «Bin noch da», zählt die Zeit weiter (+3 XP). Sonst wird die Zeit seit der Frage nicht gezählt.` : 'Den Check-in («Bist du noch da?») kannst du in den Einstellungen einschalten.'} So bleibt die Rangliste ehrlich.</span></div>
    <div style="flex:1;min-height:20px"></div>
    <button class="btn primary block" style="height:62px;font-size:18px" data-a="startTimer">${I.play} Los geht's</button>
  </div>`;
}

function standbyView() {
  const L = timerLive(), s = St.subj(S.timer.subjectId), r = 118, c = 2 * Math.PI * r;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const tip = U.standbyTip ? `<div class="sb-tip" data-a="standbyTipClose" data-self="1"><div class="sb-tip-card">
      <div class="sb-moon-sm">${MOON_SVG}</div><b>Mond-Modus</b>
      <p>Schwarzer Bildschirm, Helligkeit auf Minimum, keine Animationen. Der Timer zählt weiter – auch wenn das Display ausgeht.</p>
      <p><b>Verlassen:</b> doppelt tippen oder den Finger kurz gedrückt halten.</p>
      <div class="sb-steps"><div class="sb-step-t">${ios ? 'Einmal einrichten: Fokus automatisch an' : 'Für maximale Ruhe'}</div>
      ${ios ? `<ol><li>App <b>Kurzbefehle</b> öffnen → <b>Automation</b> → <b>＋</b></li><li><b>App</b> wählen → <b>Brained</b> · «Wird geöffnet» → <b>Sofort ausführen</b></li><li>Aktion <b>Fokus festlegen</b> → <b>Nicht stören: Ein</b></li></ol><p class="sb-note">Ab dann ist «Nicht stören» automatisch an, sobald du Brained öffnest. Apple erlaubt Apps nicht, den Fokus selbst einzuschalten – das ist der offizielle Weg.</p>`
        : `<ol><li>Zweimal von oben nach unten wischen</li><li><b>Bitte nicht stören</b> antippen</li><li>Optional: <b>Energiesparmodus</b></li></ol><p class="sb-note">Tipp: Kachel «Bitte nicht stören» in die Schnelleinstellungen ziehen – dann ist es ein Tipp.</p>`}</div>
      <button class="btn3d" data-a="standbyTipClose">Los geht's</button></div></div>` : '';
  return `<div class="standby" data-a="standbyTap">
    <div class="sb-center" data-shift="1">
      <div class="sb-ring"><svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="${r}" class="trk"/><circle cx="130" cy="130" r="${r}" class="prg" data-live="sbArc" data-c="${c}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - L.pct)}"/></svg>
        <div class="sb-in"><div class="sb-moon">${MOON_SVG}</div><div class="clock" data-live="clock">${L.clock}</div><div class="sb-subj">${subjIcon(s)}${esc(s.name)}</div></div></div>
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
      <div class="feed-top">${avatar(S.user.avatar, 42, S.user.name)}<div class="who"><b>${esc(S.user.name)}</b><span>${esc(S.user.canton)} · ${levelLabel(S.user.level, S.user.levelText)}</span></div>${subjTag(sb)}</div>
      <div class="row sum-stats">
        <div><div class="faint tiny bold">DAUER</div><div class="big-stat" style="font-size:34px">${fmtShort(s.min)}</div></div>
        <div><div class="faint tiny bold">XP</div><div class="big-stat" style="font-size:34px;color:var(--violet)">+${s.xp}</div></div>
        ${s.pomos ? `<div><div class="faint tiny bold">POMOS</div><div class="big-stat" style="font-size:34px">${s.pomos}</div></div>` : ''}
      </div>
      ${focusLine(s.segments, s.start, s.end, sb.color)}
      <div class="row small bold muted mt12 sum-meta"><span>${Math.max(0, s.segments.length - 1)} ${s.segments.length === 2 ? 'Pause' : 'Pausen'}</span><span>${s.checkins} Check-ins</span><span>${st.current} Tage Streak${streakUp ? ' (+1)' : ''}</span></div>
    </div>
    ${streakUp ? `<div class="unlock" style="background:linear-gradient(140deg,#FFE3CC,#FFC59A)"><span class="em">🔥</span><div><b>Streak verlängert: ${st.current} Tage!</b><div class="small">Morgen wieder – sonst ist sie weg.</div></div></div>` : ''}
    ${sm.fresh.map(t => `<button class="unlock" style="width:100%;text-align:left" data-a="openSheet" data-type="trophy" data-id="${t.id}"><span class="em">${t.em}</span><div><b>${t.n > 1 ? `${t.name} – zum ${t.n}. Mal!` : `Trophäe freigeschaltet: ${t.name}`}</b><div class="small">${esc(t.how)}</div></div></button>`).join('')}
    <div class="sum-btns"><button class="btn outline" data-a="shareSession" data-id="${s.id}">${I.share} Teilen</button><button class="btn primary" data-a="summaryDone">Fertig</button></div>
  </div>`;
}

/* =================================== STATS =================================== */
function statsView() {
  const now = Date.now(), ws = St.startOfWeek(now), total = St.minutesIn(ws);
  const lastWeek = St.minutesIn(St.addDays(ws, -7), now - 7 * 864e5); // gleicher Zeitpunkt letzte Woche
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = St.addDays(ws, i), e = St.addDays(d, 1), by = {};
    S.sessions.filter(s => s.start >= d && s.start < e).forEach(s => by[s.subjectId] = (by[s.subjectId] || 0) + s.min);
    if (S.timer && now >= d && now < e) by[S.timer.subjectId] = (by[S.timer.subjectId] || 0) + T.elapsed() / 60000;
    return { d, by, sum: Object.values(by).reduce((a, b) => a + b, 0) };
  });
  const max = Math.max(60, ...perDay.map(p => p.sum));
  const range = S.sessions.filter(s => s.start >= ws), count = range.length + (S.timer ? 1 : 0);
  const bySubject = {}; perDay.forEach(p => Object.entries(p.by).forEach(([id, m]) => bySubject[id] = (bySubject[id] || 0) + m));
  const subjRows = Object.entries(bySubject).sort((a, b) => b[1] - a[1]), maxSub = subjRows[0]?.[1] || 1;
  const diff = total - lastWeek, sti = St.streakInfo();
  let h = `<div class="v2-stats"><section class="c"><div class="wkh"><small>Diese Woche</small><b>${fmtShort(total)}</b>
      ${lastWeek || total ? `<span class="df ${diff < 0 ? 'neg' : ''}">${diff >= 0 ? '+' : '–'}${fmtShort(Math.abs(diff))} zur Vorwoche</span>` : ''}</div>
    <div class="bars">${perDay.map(p => `<div class="d ${St.dayKey(p.d) === St.dayKey(now) ? 'today' : ''}" title="${fmtShort(p.sum)}"><div class="st" style="height:${Math.max(4, p.sum / max * 100)}%">${Object.entries(p.by).map(([id, m]) => `<i style="height:${m / p.sum * 100}%;background:${safeColor(St.subj(id).color)}"></i>`).join('')}</div><span>${WD[new Date(p.d).getDay()]}</span></div>`).join('')}</div></section>`;
  if (subjRows.length) h += `<section class="c"><h3>Nach Fach</h3>${subjRows.map(([id, m]) => { const s = St.subj(id); return `<div class="subj"><span class="nm">${esc(s.name)}</span><div class="progress"><i style="width:${m / maxSub * 100}%;background:${safeColor(s.color)}"></i></div><span class="v">${fmtShort(m)}</span></div>`; }).join('')}</section>`;
  h += `<div class="two"><section class="c"><small>Streak</small><b>${sti.current} ${sti.current === 1 ? 'Tag' : 'Tage'}</b><em>Rekord ${sti.best}</em></section>
    <section class="c"><small>Sessions</small><b>${count}</b><em>${count ? `Ø ${fmtShort(total / count)}` : 'diese Woche'}</em></section></div>`;
  const byHour = Array(24).fill(0); S.sessions.forEach(s => byHour[new Date(s.start).getHours()] += s.min);
  const mh = Math.max(1, ...byHour);
  h += `<section class="c"><h3>Wann du lernst</h3><div class="hrs">${byHour.map((m, i) => `<i class="${m / mh > .55 ? 'hi' : ''}" style="height:${Math.max(5, m / mh * 100)}%" title="${i}:00 · ${fmtShort(m)}"></i>`).join('')}</div>
    <div class="hrl"><span>0 Uhr</span><span>6</span><span>12</span><span>18</span><span>24</span></div></section>`;
  // Brainy-Analyse: gesperrt bis 10 Sessions
  const n = S.sessions.length;
  if (n < 10) h += `<section class="c lock"><div class="ic">${I.spark}</div><div class="tx"><b>Brainy-Analyse</b><div>Wird nach 10 Sessions freigeschaltet</div><div class="bar"><i style="width:${n / 10 * 100}%"></i></div></div><span class="n">${n} / 10</span></section>`;
  else {
    const ins = U.aiInsights || localInsights({ sessions: S.sessions, subjects: St.mySubjects(), weekMin: St.weekMin(), lastWeekMin: lastWeek, goal: St.weekGoal() });
    h += `<section class="insight"><h4>${brainSVG({ size: 26 })} Brainy-Analyse</h4><ul>${ins.slice(0, 5).map(x => `<li><span>${esc(x.t)}</span></li>`).join('')}</ul>
      <button class="btn sm mt12" style="background:var(--surface)" data-a="aiInsights" ${U.aiInsightsBusy ? 'disabled' : ''}>${U.aiInsightsBusy ? 'Analysiere…' : `${I.spark} Mit KI tiefer analysieren`}</button></section>`;
  }
  if (!n && !S.timer) h += `<div class="empty"><b>Noch keine Daten</b>Starte deine erste Session und hier entsteht deine Statistik.</div>`;
  return h + '</div>';
}

function leagueTag(min) { const L = St.leagueFor(min || 0); return `<span class="lg-tag lg-${L.fam}">${L.emoji} ${L.name}</span>`; }
function rankRow(u) {
  return `<button class="li ${u.isMe ? 'me' : ''}" data-a="openUser" data-id="${u.id}"><span class="rank-n">${u.rank}</span>${avatar(u.avatar, 42, u.name)}
    <div class="t"><b>${esc(u.isMe ? `${u.name} (Du)` : u.name)}</b><div class="mini-stats">${leagueTag(u.allMin)}<span>🏆 ${u.trophies}</span><span>${esc(u.canton)}</span></div></div><div class="r">${fmtShort(u.value)}</div></button>`;
}

/* =================================== BRAINY (KI) =================================== */
function aiView() {
  const a = U.ai;
  const views = { clarity: clarityView, cards: cardsView, game: () => GM.gameView() || cardsView() };
  if (views[a.tool]) return views[a.tool]();
  const due = St.dueCards().length, bestGame = Math.max(0, ...GM.GAMES.map(g => GM.best(g.id)));
  return `<div class="v2-clarity">${clarityHub()}
    <div class="v2-sec">Üben</div>
    <button class="v2-practice" data-a="aiTool" data-id="cards"><span class="ic"><svg viewBox="0 0 26 26" aria-hidden="true"><rect x="3" y="6" width="15" height="17" rx="3" fill="#fff" stroke="#C2560A" stroke-width="2"/><rect x="8" y="3" width="15" height="17" rx="3" fill="#FFD3B0" stroke="#C2560A" stroke-width="2"/></svg></span>
      <span class="tx"><b>Karteikarten &amp; Spiele</b><span>${due ? `<span class="due">${due} fällig</span> · ` : ''}${S.flashcards.length} Karten · ${GM.GAMES.length} Spiele${bestGame ? ` · Rekord ${bestGame}` : ''}</span></span>${I.chev}</button>
    ${SHOWCASE || BACKEND ? '' : `<button class="xp-pill" style="align-self:center;height:28px;font-size:12px" data-a="openSheet" data-type="apikey">${hasKey() ? '● Claude verbunden' : '○ Demo · Claude verbinden'}</button>`}</div>`;
}

function subjChips(cur, action = 'aiSubj') {
  return `<div class="chips">${St.mySubjects().map(s => `<button class="chip-btn ${sel(cur, s.id)}" data-a="${action}" data-id="${s.id}"><span class="dot" style="background:${s.color}"></span>${s.emoji} ${esc(s.name)}</button>`).join('')}<button class="chip-btn add" data-a="moreSubjects">＋ Fächer</button></div>`;
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
      ${total ? `<div class="list">${S.flashcards.slice().reverse().slice(0, 40).map(c => { const s = St.subj(c.subjectId); return `<div class="li"><div class="ico" style="background:${s.color}22;font-size:13px;font-weight:800;color:${s.color}">${esc(subjInit(s))}</div><div class="t"><b>${esc(c.q)}</b><span>Box ${c.box} · ${c.due <= Date.now() ? 'fällig' : 'nächste: ' + fmtDate(c.due)}</span></div><button class="icon-btn plain" style="width:30px" data-a="delCard" data-id="${c.id}">${I.trash.replace('<svg', '<svg width="16" height="16"')}</button></div>`; }).join('')}</div>` : `<div class="empty"><div class="e">✍️</div><b>Noch keine Karten</b>Nach jeder Session kannst du einen Recap schreiben – Brainy macht Karten daraus.</div>`}`;
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

/* =================================== SHOP =================================== */
function shopView(head) { return shopViewNew(head); } // Oberfläche in js/shop-ui.js

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
    case 'lang': return head('Sprache') + `<div class="opts">${LANGS.map(l => `<button class="opt ${l.id === lang ? 'on' : ''}" data-a="setLang" data-id="${l.id}"><span class="e" style="font-size:14px;font-weight:800">${l.id.toUpperCase()}</span><span class="t" data-noi18n>${l.label}</span><span class="ck">${l.id === lang ? '✓' : ''}</span></button>`).join('')}</div>
      <p class="faint small center mt12">Brainy antwortet dir auch in dieser Sprache.</p>`;
    case 'goal': { const cur = Math.round(St.weekGoal() / 60); return head('Wochenziel') + `<p class="muted mb12">Wie viele Stunden willst du pro Woche lernen? Daran messen sich Fortschritt und Brainy-Tipps.</p><div class="chips">${[3, 5, 7, 10, 12, 15, 20, 25, 30].map(h => `<button class="chip-btn ${cur === h ? 'on' : ''}" data-a="setWeekGoal" data-h="${h}">${h} h</button>`).join('')}</div>`; }
    case 'play': return S.timer ? '' : playView();
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
    case 'subjects': return head('Fächer & Farben') + `<p class="small muted mb12">Tippe ein Fach an, um es (ab)zuwählen. Farbpunkt antippen = Farbe ändern.</p>
      <div class="list">${St.subjectsForLevel(S.user?.level).map(s => { const on = S.subjects.includes(s.id); return `<div class="li"><button class="ico" style="background:${s.color};color:#fff" data-a="cycleColor" data-id="${s.id}">${esc(subjInit(s))}</button><button class="t" style="text-align:left" data-a="toggleSubj" data-id="${s.id}"><b>${esc(s.name)}</b><span>${on ? 'Aktiv' : 'Ausgeblendet'}</span></button><button data-a="toggleSubj" data-id="${s.id}"><span class="switch ${on ? 'on' : ''}"></span></button></div>`; }).join('')}</div>
      <div class="card"><b>Eigenes Fach</b><div class="row mt12"><input class="input grow" data-bind="form.newSubj" maxlength="30" placeholder="z.B. Psychologie" value="${esc(f.newSubj || '')}"/><button class="btn primary" data-a="addSubj">${I.plus}</button></div></div>
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
      return `<div class="profile-head"><div class="av-ring">${avatar(u.avatar, 92, u.name)}</div><h2>${esc(u.name)}</h2><div class="faint bold small">@${esc(u.username)} · ${esc(u.canton)} · ${levelLabel(u.level, u.levelText)}</div>${u.bio ? `<p class="small muted">${esc(u.bio)}</p>` : ''}
        <div class="row" style="gap:8px"><span class="lvl" style="background:var(--flame-soft);color:var(--flame)">🔥 ${u.streak} Tage</span><span class="lvl" style="background:var(--surface-2);color:var(--ink)">${lg.emoji} ${lg.name}</span></div></div>
        <div class="kpis"><div class="kpi center"><b>${fmtHours(u.weekMin)}</b><span>Diese Woche</span></div><div class="kpi center"><b>${fmtHours(u.allMin)}</b><span>Gesamt</span></div><div class="kpi center"><b>🏆 ${u.trophies}</b><span>Trophäen</span></div></div>
        ${fav ? `<div class="card row">${subjIcon(fav, 40)}<div class="grow"><div class="faint tiny bold">LIEBLINGSFACH</div><b>${esc(fav.name)}</b></div></div>` : ''}
        ${trophyStrip(u.trophyMap)}
        ${u.isMe ? '' : `<div class="row"><button class="btn ${isFriend || isReq ? 'ghost' : 'primary'} grow" data-a="toggleFriend" data-id="${u.id}">${isFriend ? '✓ Folgst du' : isReq ? 'Angefragt · zurückziehen' : `${I.userPlus} Folgen`}</button></div>
          <div class="row mt12" style="justify-content:center;gap:18px"><button class="faint small bold" data-a="reportUser" data-id="${u.id}">Melden</button><button class="faint small bold" data-a="blockUser" data-id="${u.id}">Blockieren</button></div>`}`;
    }
    case 'statsCard': {
      const ss = S.sessions, tot = St.totalMin(), mx = Math.max(0, ...ss.map(x => x.min)), avg = ss.length ? Math.round(ss.reduce((q, x) => q + x.min, 0) / ss.length) : 0;
      const tile = (ic, v, l) => `<div class="sc-t"><span class="sc-i">${ic}</span><div><b>${v}</b><span>${l}</span></div></div>`;
      return head('Meine Stats') + `<div class="sc-card" data-keep="statscard">
        <div class="sc-top"><b>Study Stats</b><span class="sc-logo"><i></i>Brained</span></div>
        <div class="sc-hero">${avatar(S.user.avatar, 78, S.user.name)}<div><div class="sc-big">${fmtShort(tot)}</div><div class="sc-k">LERNZEIT INSGESAMT</div></div></div>
        <div class="sc-grid">${tile('🔥', St.streakInfo().current, 'Tage Streak')}${tile('📖', ss.length, 'Sessions')}${tile('⏱', fmtShort(St.todayMin()), 'Heute')}${tile('🏆', fmtShort(mx), 'Längste Session')}${tile('⏳', fmtShort(avg), 'Ø Session')}${tile('⚡', St.xpTotal(), 'XP')}</div>
        <div class="sc-foot">@brained.study</div></div>
      <p class="small faint center mt12">Mach einen Screenshot und teile ihn auf Instagram. Markiere @brained.study.</p>
      <button class="btn primary block mt12" data-a="shareStats">${I.share} Teilen</button>`;
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
      const q = (f.q || '').toLowerCase().replace(/^@/, '');
      const res = St.leaderboard({ scope: 'global', period: 'week' }).filter(u => !u.isMe && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q))).slice(0, 12);
      return head('Freunde finden') + `<div class="field"><input class="input" data-bind="form.q" data-a-input="friendSearch" value="${esc(f.q || '')}" placeholder="Name oder @benutzername suchen"/></div>
        <div class="list" data-live="friendList">${friendRows(res)}</div>
        <button class="btn outline block" data-a="inviteApp">${I.share} Freunde zu Brained einladen</button>`;
    }
    case 'groupCreate': return head('Gruppe erstellen') + `<div class="field"><label>Name</label><input class="input" data-bind="form.name" maxlength="40" value="${esc(f.name || '')}" placeholder="z.B. Klasse 3a – Kanti Wettingen"/></div>
      <div class="field"><label>Emoji</label><div class="chips">${['🏫', '📚', '🧪', '🛠️', '🎓', '🚀', '🔥', '🎯', '⭐', '🌍'].map(e => `<button class="chip-btn ${sel(f.emoji, e)}" data-a="formSet" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Farbe</label><div class="color-row">${SUBJECT_COLORS.slice(0, 8).map(c => `<button class="${sel(f.color, c)}" style="background:${c}" data-a="formSet" data-k="color" data-v="${c}"></button>`).join('')}</div></div>
      <div class="field"><label>Wochenziel der Gruppe (Stunden)</label><input class="input" type="number" inputmode="numeric" min="1" max="1000" data-bind="form.goalH" value="${esc(String(f.goalH ?? 20))}" placeholder="z.B. 20"/></div>
      <button class="btn primary block" data-a="saveGroup">Erstellen & Einladungscode holen</button>`;
    case 'groupEdit': {
      const g = S.groups.find(g => g.id === sh.id); if (!g || !g.owner) return head('Gruppe');
      return head('Gruppe bearbeiten') + `<div class="field"><label>Name</label><input class="input" data-bind="form.name" maxlength="40" value="${esc(f.name || '')}"/></div>
      <div class="field"><label>Emoji</label><div class="chips">${['🏫', '📚', '🧪', '🛠️', '🎓', '🚀', '🔥', '🎯', '⭐', '🌍'].map(e => `<button class="chip-btn ${sel(f.emoji, e)}" data-a="formSet" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Farbe</label><div class="color-row">${SUBJECT_COLORS.slice(0, 8).map(c => `<button class="${sel(f.color, c)}" style="background:${c}" data-a="formSet" data-k="color" data-v="${c}"></button>`).join('')}</div></div>
      <div class="field"><label>Wochenziel der Gruppe (Stunden)</label><input class="input" type="number" inputmode="numeric" min="1" max="1000" data-bind="form.goalH" value="${esc(String(f.goalH ?? 20))}" placeholder="z.B. 20"/></div>
      <button class="btn primary block" data-a="saveGroupEdit" data-id="${g.id}">Speichern</button>
      <button class="btn outline block mt8" data-a="openSheet" data-type="invite" data-id="${g.id}">Einladungscode und Mitglieder</button>`;
    }
    case 'groupJoin': return head('Gruppe beitreten') + `<p class="muted mb16">Gib den 6-stelligen Code ein, den du von deiner Gruppe bekommen hast.</p>
      <div class="field"><input class="input" style="text-align:center;font-size:26px;font-weight:800;letter-spacing:6px;height:64px;text-transform:uppercase" maxlength="6" data-bind="form.code" value="${esc(f.code || '')}" placeholder="KANTI4"/></div>
      ${f.err ? `<div class="tip mb12" style="color:#c0392b" data-test="join-error">${esc(f.err)}</div>` : ''}<button class="btn primary block" data-a="joinGroup">Beitreten</button>`;
    case 'invite': {
      const g = S.groups.find(g => g.id === sh.id); if (!g) return head('Gruppe');
      const members = g.members.map(id => St.person(id)).filter(Boolean);
      return head('Freunde einladen') + `<div class="card center"><div class="group-em" style="margin:0 auto 10px;background:${safeColor(g.color)}22">${esc(g.emoji)}</div><b style="font-size:18px">${esc(g.name)}</b><p class="small muted mt8 mb16">Teile Code oder Link – wer beitritt, landet direkt in eurer Gruppen-Rangliste.</p>
        <div class="code-box" data-test="group-code">${g.code}</div><p class="tiny faint mt8" style="word-break:break-all">${esc(St.inviteLink(g.code))}</p></div>
        <div class="row"><button class="btn outline grow" data-a="copyCode" data-id="${g.code}">${I.copy} Code</button><button class="btn outline grow" data-a="copyLink" data-id="${g.code}">${I.copy} Link</button><button class="btn primary grow" data-a="shareGroup" data-id="${g.id}">${I.share}</button></div>
        <div class="section-t">Mitglieder · ${members.length + 1}</div>
        <div class="list">${rankRow({ ...St.me(), value: St.weekMin(), rank: '' })}${members.map(u => rankRow({ ...u, value: u.weekMin, rank: '' })).join('')}</div>
        ${members.length ? '' : '<p class="small faint center mb12">Noch niemand da – teil den Code mit deiner Klasse!</p>'}
        <button class="btn ghost block" style="color:#E5484D" data-a="leaveGroup" data-id="${g.id}">${g.owner ? 'Gruppe löschen' : 'Gruppe verlassen'}</button>`;
    }
    case 'aiConsent': return aiConsentSheet(sh, head);
    case 'aiReport': return reportSheet(sh, head);
    case 'legal': return head({ agb: 'Nutzungsbedingungen', impressum: 'Impressum', lizenzen: 'Lizenzen' }[sh.id] || 'Datenschutz') + `<iframe class="legal-frame" src="legal/${['agb', 'impressum', 'lizenzen'].includes(sh.id) ? sh.id : 'datenschutz'}.html"></iframe>`;
    case 'trophy': {
      const d = St.trophyDetail(sh.id); if (!d) return head('Trophäe');
      const n = d.have?.n || 0;
      const grp = TROPHY_GROUPS.find(g => g[0] === d.g)?.[1];
      return `<div class="trophy-hero ${n ? '' : 'locked'}"><div class="em">${n ? d.em : I.lock}</div>${n > 1 ? `<span class="t-count big">×${n}</span>` : ''}</div>
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
    case 'apikey': if (BACKEND) return head('Brainy') + `<div class="card center">${brainSVG({ size: 70 })}<p class="small muted mt8">Brainy läuft über den Brained-Server mit KI-Diensten (Anthropic, teils Groq). Du musst nichts einrichten.</p></div><div class="tip">${I.lock}<span>Deine Fragen werden nur zur Beantwortung gesendet und nicht zum Training verwendet. Details in der Datenschutzerklärung.</span></div>`;
      return head('Brainy mit Claude verbinden') + `<div class="card center">${brainSVG({ size: 70 })}<p class="small muted mt8">Brainy läuft mit Claude von Anthropic. Ohne Key bist du im Demo-Modus (lokale Heuristiken).</p></div>
      <div class="field"><label>Anthropic API-Key</label><input class="input" type="password" data-bind="form.key" value="${esc(f.key || '')}" placeholder="sk-ant-…" autocomplete="off"/></div>
      <div class="field"><label>Modell</label><select class="select" data-bind="form.model">${['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'].map(m => `<option ${m === (f.model || S.settings.model) ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="tip mb16">${I.lock}<span>Prototyp: Der Key bleibt nur in diesem Browser. In der Live-Version läuft das über einen sicheren Server – Nutzer:innen brauchen dann keinen Key.</span></div>
      <button class="btn primary block" data-a="saveKey">Speichern</button>${hasKey() ? `<button class="btn ghost block mt8" data-a="removeKey">Key entfernen</button>` : ''}`;
    case 'editProfile': return head('Profil bearbeiten') + `<div class="av-preview"><div class="av-ring">${avatar(f.avatar, 96)}</div></div>${avatarPicker(f.avatar)}
      <div class="field mt16"><label>Name</label><input class="input" data-bind="form.name" maxlength="40" value="${esc(f.name)}"/></div>
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
  return res.map(u => `<div class="li">${avatar(u.avatar, 40, u.name)}<div class="t"><b>${esc(u.name)}</b><span>@${esc(u.username)} · ${esc(u.canton)} · ${fmtShort(u.weekMin)} diese Woche</span></div><button class="btn ${S.friends.includes(u.id) || R.requested.includes(u.id) ? 'ghost' : 'primary'} xs" data-a="toggleFriend" data-id="${u.id}">${S.friends.includes(u.id) ? '✓' : R.requested.includes(u.id) ? 'Angefragt' : 'Folgen'}</button></div>`).join('') || '<div class="empty small">Niemand gefunden</div>';
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
  if (m.type === 'confirmFinish') return `<div class="modal"><div class="emoji">🏁</div><h3>Session beenden?</h3><p>${fmtShort(T.elapsed() / 60000)} ${St.subj(S.timer.subjectId).name}. ${T.elapsed() < 60000 ? 'Unter 1 Minute wird nicht gespeichert.' : 'Stark gemacht!'}</p>
    <button class="btn primary block" data-a="finishConfirm">Beenden & speichern</button><button class="btn ghost block mt8" data-a="closeModal">Weiterlernen</button>
    <button class="btn block mt8 small faint" style="height:36px" data-a="discardTimer">Verwerfen</button></div>`;
  if (m.type === 'report') return `<div class="modal"><div class="emoji">🚩</div><h3>Person melden</h3><p>Was ist das Problem? Wir prüfen jede Meldung innert 24 Stunden.</p>
    <textarea class="textarea mb12" data-bind="form.reason" placeholder="z.B. beleidigender Name, Spam, unangemessene Notiz"></textarea>
    <button class="btn primary block" data-a="reportSend" data-id="${m.id}">Meldung senden</button><button class="btn ghost block mt8" data-a="closeModal">Abbrechen</button></div>`;
  if (m.type === 'info') return `<div class="modal"><div class="emoji">${m.emoji}</div><h3>${m.title}</h3><p>${m.text}</p><button class="btn primary block" data-a="${m.action || 'closeModal'}">${m.cta || 'OK'}</button>${m.secondary ? `<button class="btn ghost block mt8" data-a="${m.secondaryAction}">${m.secondary}</button>` : ''}</div>`;
  return '';
}
