// Lernräume: Play-Sheet, Raum-Overlay (Eintritt, Raumbild mit Verschieben/Zoomen, Brainys an Pulten, Reaktionen),
// Aktionen, Polling. Vertrag: docs/UMBAU-2.md. Server: supabase/schema-rooms.sql, Wrapper: js/rooms-backend.js.
import { perfTier, perfPaused, perfSafe, perfLive, perfCrashCheck, perfClearCrash } from './room-perf.js';
import * as St from './store.js';
import * as T from './timer.js';
import * as BK from './backend.js';
import * as RB from './rooms-backend.js';
import { U } from './view-state.js';
import { esc, I, brainSVG, brainAvatarSVG, normAvatar, fmtClock, pauseOtherMedia, avatar } from './ui.js';
import { IMG, SKY, EX, EY, WW, WH, SEATS, ROOM_VIEW, DESK_CLIP, sceneBack } from './room-scene.js';
import { auraHTML } from './shop-fx.js';
import { badMsg } from './moderation.js';
import { CONFIG } from './config.js';

const S = St.S;
let CTX = null;

const NEAR = 1.5;                                  // ab diesem Zoom (relativ zur Übersicht) erscheint der Name im Schild
const REACTS = [['anfeuern', 'Anfeuern', 'flame'], ['applaus', 'Applaus', 'spark'], ['durchhalten', 'Durchhalten', 'bolt']];
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// ---------- Hilfen ----------
const P = () => (U.play ||= { subjectId: null, mode: 'free', goalMin: 60, view: 'main', name: '', code: '', busy: '', err: '' });
const curSubj = () => { const subs = St.mySubjects(), p = P(); return subs.some(s => s.id === p.subjectId) ? p.subjectId : subs.some(s => s.id === U.setup?.subjectId) ? U.setup.subjectId : subs[0].id; };
const goLive = id => { if (BK.enabled && S.user?.id) BK.setLive(id).catch(() => { }); };
const render = () => CTX?.render();
const firstName = n => String(n || 'Brainy').trim().split(/\s+/)[0].slice(0, 12);
const startVirtual = () => (S.timer?.segStart ? Date.now() - T.elapsed() : null);

// ---------- Play-Sheet: Ansicht und Fachwahl in js/play.js ----------
export { playView } from './play.js';

// ---------- Kamera (Verschieben / Zoomen) ----------
// Übersicht = ganzes Bild passt in den Viewport (zentriert). Zoom bis 3x der Übersicht. Bewegt wird nur per transform (kein Neu-Rendern).
let vp = { w: Math.min(440, window.innerWidth || 390), h: Math.max(300, (window.innerHeight || 800) - 250) };
// Weiteste Ansicht = Zoom-Minimum: die erweiterte Szene (WW x WH) deckt den Viewport vollständig (Breite immer gedeckt), hochkant füllt der hohe Himmel bis zum Timer-Balken.
const HEAD = 56, BRAIN_H = 1080;   // Kopfleiste über dem Viewport; Höhe des Gehirns in Bildpunkten
const minScale = () => Math.max(Math.min(vp.w / WW * (vp.h >= vp.w ? 1.08 : 1), Math.max(vp.h - HEAD, 100) / BRAIN_H), vp.w / SKY.w, vp.h / SKY.h);   // ganzes Gehirn sichtbar (Hochformat: Breite, Querformat: Höhe), nie über den Himmel hinaus
const homeScale = () => minScale();
// Höchstens 2x der Übersicht, auf Handys (Stufe low) 1.7x, nach einem Absturz 1.55x; zusätzlich Rasterfaktor (Zoom x Bildschirmdichte) höchstens ca. 2.2 – weniger Bildspeicher und Rasterarbeit (Handy-Abstürze)
const maxScale = () => { const h = homeScale(), k = perfSafe() ? 1.55 : perfTier() === 'high' ? 2 : 1.7; return Math.min(h * k, Math.max(h * 1.55, 2.2 / Math.min(3, window.devicePixelRatio || 1))); };
const homeCam = () => { const s = homeScale(); return { cx: IMG / 2, cy: IMG / 2 - HEAD / 2 / s, s }; };   // Gehirn (Bildmitte) mittig zwischen Kopfleiste und Timer-Balken
export function clampCam(c) {
  c.s = Math.min(maxScale(), Math.max(minScale(), c.s));
  const lim = (v, half, lo, hi) => (2 * half >= hi - lo ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, v)));   // Szene (0..IMG) füllt den Viewport oder wird zentriert: nie aus dem Bild schiebbar; der Himmel reicht dank minScale immer
  const off = HEAD / 2 / c.s;   // Kopfleiste: Bildmitte liegt mittig zwischen Kopfleiste und Timer
  c.cx = lim(c.cx, vp.w / 2 / c.s, 0, IMG); c.cy = lim(c.cy + off, vp.h / 2 / c.s, 0, IMG) - off;
  return c;
}
const isHome = c => { const h = clampCam(homeCam()); return Math.abs(c.s - h.s) < .004 && Math.abs(c.cx - h.cx) < 3 && Math.abs(c.cy - h.cy) < 3; };
// Start: weiteste Ansicht (Referenzbild), ohne Reinzoomen; Einflug entfällt
export function flyIn() { const R = U.room; if (!R?.cam) return; R.cam = clampCam(homeCam()); applyCam(); }
const isNear = c => c.s >= homeScale() * NEAR;
const worldTf = c => `translate(${(vp.w / 2 - c.cx * c.s).toFixed(1)}px,${(vp.h / 2 - c.cy * c.s).toFixed(1)}px) scale(${c.s.toFixed(4)})`;
const worldStyle = c => `transform:${worldTf(c)}`;
function measure() {
  const v = document.querySelector('.rm-vp');
  if (!v || !v.clientWidth) return false;
  const ch = v.clientWidth !== vp.w || v.clientHeight !== vp.h;
  vp = { w: v.clientWidth, h: v.clientHeight };
  return ch;
}
let inertia = 0;
const stopInertia = () => { cancelAnimationFrame(inertia); inertia = 0; };
// Weicher Übergang per Skript statt CSS-Transition: eine CSS-Transition auf .rm-world macht die ganze Welt (Himmel 2454x2854 px) zu einer animierten Ebene,
// die WebKit für die Dauer vollflächig und in der grössten Zoomstufe rastert (hunderte MB, bei jedem Zoomen neu) → auf dem iPhone Absturz nach 2–3 Zoom-Vorgängen.
// Hier setzt jedes Bild nur den transform-Wert (wie beim Pinch): keine Animations-Ebene, keine Zusatzspeicher.
// Während einer Geste/eines Übergangs (und kurz danach) liegt die Welt auf einer eigenen Ebene (will-change, CSS .rm-gesture): Bewegung = nur Ebene verschieben, Neuzeichnen einmal am Ende.
// Die Animationen im Raum stehen in dieser Zeit still, damit nichts parallel zeichnet.
let gestT = 0;
function holdGesture(ms = 220) {
  const R = U.room, w = document.querySelector('.rm-world'); if (!R || !w) return;
  R.gest = true; w.classList.add('rm-gesture'); clearTimeout(gestT);
  gestT = setTimeout(() => { R.gest = false; document.querySelector('.rm-world')?.classList.remove('rm-gesture'); }, ms);
}
let tween = 0, tweenT = 0;
const stopTween = () => { cancelAnimationFrame(tween); tween = 0; };
function paintCam(c, final) {
  const w = document.querySelector('.rm-world'); if (!w) return;
  w.style.transform = worldTf(c); if (U.room) U.room.painted = { cx: c.cx, cy: c.cy, s: c.s };
  if (!final) return;
  const near = isNear(c) ? '1' : '0'; if (w.dataset.near !== near) w.dataset.near = near;
  document.querySelector('.rm-home')?.classList.toggle('hide', isHome(c));
}
function applyCam(smooth) {
  const R = U.room, w = document.querySelector('.rm-world'); if (!R?.cam || !w) return;
  clampCam(R.cam); stopTween(); holdGesture(smooth ? Math.min(smooth === true ? 380 : smooth, 600) + 260 : 220);
  const to = { ...R.cam }, from = R.painted || R.shown;
  R.shown = to; if (!smooth || !from || reduced()) { w.classList.remove('anim'); paintCam(to, true); return; }
  const ms = Math.min(smooth === true ? 380 : smooth, perfTier() === 'high' ? 600 : 260), t0 = performance.now(), gap = perfTier() === 'high' ? 0 : 40;
  w.dataset.near = isNear(to) ? '1' : '0';   // Zielzustand der Anzeige (Namen, Pausen) gleich zu Beginn
  document.querySelector('.rm-home')?.classList.toggle('hide', isHome(to));
  const step = now => {
    if (U.room !== R || R.shown !== to) return;
    if (now - tweenT < gap && now - t0 < ms) { tween = requestAnimationFrame(step); return; }
    tweenT = now; const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    paintCam({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, s: from.s * Math.pow(to.s / from.s, e) }, false);
    if (p < 1) tween = requestAnimationFrame(step); else { tween = 0; paintCam(to, true); }
  };
  tween = requestAnimationFrame(step);
}
function zoomAt(f, px, py, smooth) {
  const R = U.room; if (!R?.cam) return;
  R.touched = true; stopInertia();
  const c = R.cam, dx = px - vp.w / 2, dy = py - vp.h / 2, wx = c.cx + dx / c.s, wy = c.cy + dy / c.s;
  c.s *= f; clampCam(c);
  c.cx = wx - dx / c.s; c.cy = wy - dy / c.s;
  applyCam(smooth);
}
// Doppeltipp: Übersicht → 2x an der Tipp-Stelle, sonst zurück zur Übersicht
function doubleTap(px, py) {
  const R = U.room; if (!R?.cam) return;
  if (isNear(R.cam)) { R.cam = clampCam(homeCam()); R.touched = false; applyCam(520); }
  else zoomAt(2 / (R.cam.s / homeScale()), px, py, 420);
}

// Zeiger-Gesten: ein Finger/Maus = verschieben (mit Trägheit), zwei Finger = Pinch-Zoom, Doppeltipp, Mausrad. Klicks nach einer Geste werden unterdrückt.
const ptrs = new Map(); let gest = null, moved = false, quiet = 0, wired = false, lastTap = { t: 0, x: 0, y: 0 }, trail = [];
const mid = () => { const a = [...ptrs.values()]; return { x: a.reduce((s, p) => s + p.x, 0) / a.length, y: a.reduce((s, p) => s + p.y, 0) / a.length, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 }; };
function startGesture() { const R = U.room; if (!R?.cam || !ptrs.size) { gest = null; return; } const m = mid(); gest = { ...R.cam, mx: m.x, my: m.y, d: m.d }; trail = []; }
function glide() {
  const R = U.room; if (!R?.cam || trail.length < 2) return;
  const a = trail[0], b = trail.at(-1), dt = b.t - a.t; if (dt < 8 || performance.now() - b.t > 90) return;
  let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, last = performance.now();   // px pro ms
  if (Math.hypot(vx, vy) < .12) return;
  const step = now => {
    const R2 = U.room; if (!R2?.cam || ptrs.size) { inertia = 0; return; }
    const d = now - last; last = now;
    R2.cam.cx -= vx * d / R2.cam.s; R2.cam.cy -= vy * d / R2.cam.s;
    const k = Math.exp(-d / 240); vx *= k; vy *= k;
    applyCam();
    inertia = Math.hypot(vx, vy) > .02 ? requestAnimationFrame(step) : 0;
  };
  inertia = requestAnimationFrame(step);
}
function ensureListeners() {
  if (wired) return; wired = true;
  document.addEventListener('pointerdown', e => {
    const v = e.target.closest?.('.rm-vp'); if (!v || !U.room || U.room.phase !== 'inside' || e.target.closest('.rm-zoom, .rm-home, .rm-leave')) return;
    stopInertia(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) moved = false; startGesture();
  });
  // pointermove: nur die letzte Position je Bild verarbeiten (vorher bis zu 100 Updates/s → Dauer-Neuzeichnen)
  let moveRaf = 0;
  const applyMove = () => {
    moveRaf = 0;
    if (!gest || !U.room?.cam || !ptrs.size) return;
    const m = mid(), c = U.room.cam, r = document.querySelector('.rm-vp')?.getBoundingClientRect(); if (!r) return;
    if (Math.hypot(m.x - gest.mx, m.y - gest.my) > 6 || ptrs.size > 1) moved = true;
    if (!moved) return;
    U.room.touched = true;
    c.s = gest.s * (ptrs.size > 1 && gest.d ? m.d / gest.d : 1); clampCam(c);
    const ox = gest.mx - r.left - vp.w / 2, oy = gest.my - r.top - vp.h / 2, nx = m.x - r.left - vp.w / 2, ny = m.y - r.top - vp.h / 2;
    c.cx = gest.cx + ox / gest.s - nx / c.s; c.cy = gest.cy + oy / gest.s - ny / c.s;   // Punkt unter den Fingern bleibt darunter
    if (ptrs.size === 1) { trail.push({ x: m.x, y: m.y, t: performance.now() }); if (trail.length > 6) trail.shift(); }
    applyCam();
  };
  window.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !gest || !U.room?.cam) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!moveRaf) moveRaf = requestAnimationFrame(applyMove);
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    if (moveRaf) { cancelAnimationFrame(moveRaf); applyMove(); }
    const single = ptrs.size === 1, x = e.clientX, y = e.clientY; ptrs.delete(e.pointerId);
    if (!ptrs.size && moved) { quiet = Date.now() + 350; if (single && e.type === 'pointerup') glide(); }
    else if (!ptrs.size && single && e.type === 'pointerup' && U.room?.phase === 'inside') {
      const now = Date.now(), r = document.querySelector('.rm-vp')?.getBoundingClientRect();
      if (r && now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 32) { quiet = now + 350; lastTap.t = 0; doubleTap(x - r.left, y - r.top); }
      else lastTap = { t: now, x, y };
    }
    startGesture();
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  document.addEventListener('wheel', e => {
    const v = e.target.closest?.('.rm-vp'); if (!v || !U.room || U.room.phase !== 'inside') return;
    e.preventDefault(); const r = v.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  window.addEventListener('resize', () => { if (U.room && measure()) { if (!U.room.touched) U.room.cam = homeCam(); applyCam(); } });
}

// ---------- Raum-Ansicht ----------
// Szene = Vektorgrafik (js/room-scene.js): hinten Raum und Stühle, darauf die Brainys, davor Schreibtische, ganz vorn die Schilder.
// Im Raum zählt nur der Teil des Looks, der am Pult sichtbar ist: Kopf (Hut), Gesicht (Augen, Mund), Skin, Extras (Rahmen, Aura, Effekt, Hintergrund nur im Profil).
export const BRAIN_PX = 96;
export const roomLook = a => { const x = normAvatar(a); return { skin: x.skin, mood: x.mood, hat: x.hat, eyes: x.eyes, mouth: x.mouth, extra: x.extra, aura: x.aura }; };
const DESK_POLY = `polygon(${DESK_CLIP.map(([x, y]) => `${x + BRAIN_PX / 2}px ${y + BRAIN_PX * .56}px`).join(',')})`;   // Tisch und Laptop verdecken die Unterkante
// Animierte Skins (SMIL) im Raum nur beim eigenen Brainy und – auf starken Geräten – bei höchstens zwei weiteren; alle anderen zeigen die ruhige Grundfarbe (weniger Neuzeichnen)
const animOk = m => m.me || (perfTier() === 'high' && !!U.room && U.room.members.filter(x => !x.me).map(x => x.id).sort().slice(0, 2).includes(m.id));
export const brainSvg = m => brainAvatarSVG(roomLook(m.me ? (S.user?.avatar || m.avatar) : m.avatar), BRAIN_PX, !animOk(m));   // eigener Look immer live
const auraSvg = m => { const a = roomLook(m.me ? (S.user?.avatar || m.avatar) : m.avatar).aura; return a ? `<span class="rm-aura" style="clip-path:${DESK_POLY}">${auraHTML(a, 46)}</span>` : ''; };
// Stoppuhr-Anzeige: 00:24:18 bzw. 1:08:05 (Geisterziffern 8 dahinter wie bei einer LCD-Anzeige)
export const lcdText = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), p = n => String(n).padStart(2, '0'); return `${h ? h : '00'}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}`; };
const lcdHTML = t => (/\d/.test(t) ? `<u>${t.replace(/\d/g, '8')}</u>` : '') + `<b>${t}</b>`;
const memberState = m => m.me ? (S.timer ? (S.timer.segStart ? 'run' : 'pause') : 'idle') : (m.start ? 'run' : 'pause');
const memberLcd = m => memberState(m) === 'run' ? lcdText(m.me ? T.elapsed() : Date.now() - m.start) : memberState(m) === 'pause' ? 'PAUSE' : '00:00:00';
const memberSubject = m => (m.me ? (S.timer ? St.subj(S.timer.subjectId).name : '') : m.subject) || '';
const seatKey = code => 'brained.seat.' + code;
const savedSeat = (code, max) => { try { const v = +localStorage.getItem(seatKey(code)); return Number.isInteger(v) && v >= 0 && v < max && localStorage.getItem(seatKey(code)) !== null ? v : null; } catch { return null; } };
// Wer sitzt wo: eigener Platz = gewählter Platz; die anderen auf ihrem Server-Platz, bei Überschneidung auf dem nächsten freien
export function layoutSeats(R) {
  const out = Array(SEATS.length).fill(null), max = Math.min(R.room.max, SEATS.length);
  const me = R.members.find(m => m.me);
  if (me && R.mySeat != null) out[R.mySeat] = me;
  for (const m of R.members.filter(m => !m.me).sort((a, b) => a.seat - b.seat)) {
    let i = m.seat; if (!(i >= 0 && i < SEATS.length) || out[i]) i = out.findIndex((x, k) => !x && k < Math.max(max, SEATS.length));
    if (i >= 0) out[i] = m;
  }
  return out;
}
// Pro Platz eine Einheit (Stuhl, Brainy, Schreibtisch), von hinten nach vorn nach Tiefe sortiert, damit sich Nachbarn richtig überdecken.
// Die Schilder liegen darüber in einer eigenen Ebene, damit nie ein Nachbar-Tisch eine Anzeige verdeckt.
const seatPos = i => `left:${SEATS[i][0] + EX}px;top:${SEATS[i][1] + EY}px`;
function unitHTML(i, m, R) {
  if (!m) return '';
  return `<div class="rm-unit ${m.me ? 'me' : ''} ${R.sel === m.id ? 'sel' : ''} ${R.walking?.has(m.id) ? 'walking' : ''}" style="${seatPos(i)};--d:${(i * 0.7) % 4}s">${auraSvg(m)}
    <span class="rm-brain" data-a="roomPick" data-id="${esc(m.id)}" aria-label="${esc(m.name)}${m.me ? ' (du)' : ''}" style="clip-path:${DESK_POLY}"><span class="rm-fig">${brainSvg(m)}</span></span></div>`;
}
function signHTML(i, m, R) {
  if (!m) return i < Math.min(R.room.max, SEATS.length) ? `<div class="rm-seat free" style="${seatPos(i)}"><button class="rm-take" data-a="roomSit" data-i="${i}" aria-label="Platz nehmen">Frei</button></div>` : '';
  const st = memberState(m), t = memberLcd(m);
  const fx = R.fx.filter(f => f.to === m.id).map(f => `<span class="rm-fx k-${f.k}" data-fx="${f.id}"><i class="rm-burst"></i><b>${esc(RB_LABEL[f.k] || '')}</b></span>`).join('');
  return `<div class="rm-seat ${m.me ? 'me' : ''} ${R.sel === m.id ? 'sel' : ''} ${R.walking?.has(m.id) ? 'walking' : ''} st-${st}" style="${seatPos(i)}" data-id="${esc(m.id)}">
    <span class="rm-sign" data-a="roomPick" data-id="${esc(m.id)}"><span class="rm-lcd" data-rt="${esc(m.id)}" data-t="${t}">${lcdHTML(t)}</span><span class="rm-sj" data-rs="${esc(m.id)}">${esc(memberSubject(m))}</span><span class="rm-nm">${esc(firstName(m.name))}</span></span>${fx}</div>`;
}
const RB_LABEL = Object.fromEntries(REACTS.map(([k, l]) => [k, l]));

// Profilkarte eines fremden Brainys (Tipp im Raum): Daten wie in der Rangliste (St.person), Aktionen openUser / toggleFriend / roomReact
function cardHTML(m, R) {
  const u = St.person(m.id), look = u?.avatar || m.avatar;
  const isFriend = S.friends.includes(m.id), isReq = BK.R.requested.includes(m.id);
  const st = memberState(m), what = st === 'run' ? `${esc(memberSubject(m))}${memberSubject(m) ? ' · ' : ''}${memberLcd(m)}` : st === 'pause' ? 'Pause' : 'Nicht am Lernen';
  return `<div class="rm-pcard" role="dialog" aria-label="Profil ${esc(m.name)}" data-keep="rmcard">
    <button class="rm-card-x" data-a="roomCardClose" aria-label="Schliessen">${I.x || '×'}</button>
    <div class="rm-card-top"><div class="rm-card-av">${avatar(look, 46, m.name)}</div>
      <div class="rm-card-id"><b>${esc(u?.name || m.name)}</b><span>${what}</span></div></div>
    <div class="rm-card-act">${isFriend ? '' : `<button class="rm-btn line" data-a="toggleFriend" data-id="${esc(m.id)}">${isReq ? 'Angefragt' : 'Anfrage senden'}</button>`}
      <button class="rm-btn line" data-a="openUser" data-id="${esc(m.id)}">Profil ansehen</button></div>
    <div class="rm-rx">${REACTS.map(([k, l, ic]) => `<button data-a="roomReact" data-k="${k}">${I[ic]}<span>${l}</span></button>`).join('')}</div>
    <button class="rm-link" data-a="reportUser" data-id="${esc(m.id)}">Melden</button>
  </div>`;
}

function panelHTML(R) {
  const me = RB.myId(), sel = R.sel && R.sel !== me ? R.members.find(m => m.id === R.sel) : null;
  const running = !!S.timer?.segStart;
  const selRow = sel ? '' : `<p class="rm-hint">${R.mySeat == null ? 'Tippe auf einen freien Stuhl, um Platz zu nehmen.' : 'Tippe auf ein Brainy, um sein Profil zu sehen.'}</p>`;
  return `<div class="rm-panel">${sel && R.card === sel.id ? cardHTML(sel, R) : ''}
    <div class="rm-clock" data-live="rmclock">${S.timer ? fmtClock(T.elapsed()) : '00:00'}</div>
    <div class="rm-clock-sub">${esc(St.subj(S.timer?.subjectId || curSubj()).name)}${S.timer && !running ? ' · pausiert' : ''}</div>
    <div class="rm-ctrl">
      <button class="rm-btn ${running ? 'line' : 'gold'}" data-a="roomPause">${running ? `${I.pause} Pause` : `${I.play} ${S.timer ? 'Weiter' : 'Starten'}`}</button>
      ${R.room.kind === 'private' ? `<button class="rm-btn line" data-a="roomInvite">${I.userPlus} Einladen</button>` : ''}
    </div>
    ${(() => { const l = (R.log || []).filter(l => Date.now() - l.at < 300000).slice(0, 2); return l.length ? `<div class="rm-log">${l.map(l => `${esc(firstName(l.from))} · ${esc(RB_LABEL[l.k] || '')}`).join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>` : ''; })()}
    ${selRow}
  </div>`;
}

function inviteHTML(R) {
  const code = R.room.code || '';
  return `<div class="rm-inv" data-a="roomInviteClose" data-self="1"><div class="rm-inv-card" role="dialog" aria-label="Freunde einladen">
    <div class="grab"></div>
    <h3>Freunde einladen</h3>
    <p class="rm-sub">${esc(R.room.name)}</p>
    <div class="rm-codeboxes" aria-label="Code ${esc(code.split('').join(' '))}">${code.split('').map(c => `<span>${esc(c)}</span>`).join('')}</div>
    <button class="rm-btn gold" data-a="roomShare">${I.share} Link teilen</button>
    <button class="rm-btn line" data-a="roomCopy">${I.copy} Code kopieren</button>
    <button class="rm-link" data-a="roomInviteClose">Fertig</button>
  </div></div>`;
}

export function roomOverlayView() {
  const R = U.room; if (!R) return '';
  const lay = R.loaded ? layoutSeats(R) : [], max = Math.min(R.room.max, SEATS.length);
  const order = SEATS.map((_, i) => i).sort((a, b) => SEATS[a][1] - SEATS[b][1]);
  const units = R.loaded ? order.map(i => unitHTML(i, lay[i], R)).join('') : '', signs = R.loaded ? order.map(i => signHTML(i, lay[i], R)).join('') : '';
  const n = R.members.length;
  return `<div class="rm ${R.leaving ? 'leaving' : ''} ${perfPaused() ? 'rm-paused' : ''}" data-perf="${perfTier()}">
    <div class="rm-vp">
      <div class="rm-stage"><div class="rm-world ${R.gest ? 'rm-gesture' : ''}" data-near="${isNear(R.cam) ? 1 : 0}" style="width:${WW}px;height:${WH}px;${worldStyle(R.cam)}">
        ${sceneBack()}<div class="rm-ambient" data-live aria-hidden="true" style="position:absolute;inset:0;pointer-events:none"></div><div class="rm-layer">${units}</div><div class="rm-walk" data-live style="position:absolute;inset:0;pointer-events:none"></div><div class="rm-layer">${signs}</div>
      </div></div>
      <div class="rm-head">
        <button class="rm-leave" data-a="roomLeave">${I.back} Verlassen</button>
        <div class="rm-title"><span>${R.room.kind === 'private' ? `${esc(R.room.name)} · <span>Privater Raum</span>` : '<span>Öffentlicher Raum</span>'} ${Math.max(1, n)}/${R.room.max}</span></div>
      </div>
      ${R.err ? `<div class="rm-banner" role="status">${esc(R.err)}</div>` : ''}
      <button class="rm-home ${isHome(R.cam) ? 'hide' : ''}" data-a="roomHome">Zurück zur Übersicht</button>
      <div class="rm-zoom"><button data-a="roomZoom" data-d="in" aria-label="Hineinzoomen">${I.plus}</button><button data-a="roomZoom" data-d="out" aria-label="Herauszoomen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg></button></div>
    </div>
    ${panelHTML(R)}${R.invite ? inviteHTML(R) : ''}
  </div>`;
}

// ---------- Raum betreten, Polling, Verlassen ----------
function addFx(to, k) {
  const R = U.room; if (!R) return;
  R.fx.push({ id: ++R.fxId, to, k, at: Date.now() });
}
function openRoom(room) {
  ensureListeners();
  U.sheet = null; U.overlay = 'room';
  const R = U.room = { phase: 'inside', room, members: [], loaded: false, cam: clampCam(homeCam()), sel: null, fx: [], fxId: 0, since: null, lastPoll: 0, lastBeat: 0, sig: '', err: '', invite: false, lastRx: 0, walking: new Map(), prev: null, mySeat: savedSeat(room.code, Math.min(room.max, SEATS.length)) };
  R.t0 = Date.now(); perfLive({ id: room.id, code: room.code });   // Merker: Raum offen (Absturz-Erkennung beim nächsten Start)
  poll(); beat();
  setTimeout(() => { if (U.room === R && measure()) flyIn(); }, 30);   // harter Einstieg: direkt in der Raumansicht, ohne Übergang
}
async function rejoin(R) {
  try { R.room = await RB.joinCode(R.room.code); R.err = ''; }
  catch (e) {
    if (U.room === R && R.room.kind === 'public' && /room_not_found|room_full/.test(e.message)) {   // Zufallsraum aufgelöst: still in einen neuen setzen
      try { R.room = await RB.joinRandom(); R.members = []; R.loaded = false; R.prev = null; R.mySeat = null; R.err = ''; R.polling = false; poll(); return; } catch (e2) { e = e2; }
    }
    if (U.room === R) { closeRoom(false); CTX?.toast(esc(/room_not_found|room_full/.test(e.message) ? 'Der Raum ist nicht mehr verfügbar.' : RB.niceError(e))); render(); } }
}
async function beat() {
  const R = U.room; if (!R || R.beating) return; R.beating = true; R.lastBeat = Date.now();
  R.sig = `${S.timer?.segStart ? 1 : 0}|${S.timer?.subjectId || ''}`;
  try { await RB.ping(R.room.id, S.timer ? St.subj(S.timer.subjectId).name : '', startVirtual()); }
  catch (e) { if (/not_member/.test(e.message)) await rejoin(R); }
  R.beating = false;
}
async function poll() {
  const R = U.room; if (!R || R.polling || R.leaving) return; R.polling = true; R.lastPoll = Date.now();
  try {
    const st = await RB.state(R.room.id); if (U.room !== R) return;
    R.room = st.room; R.members = st.members; R.err = ''; perfLive({ id: R.room.id, code: R.room.code });
    if (R.sel && !R.members.some(m => m.id === R.sel)) R.sel = null;
    const rx = await RB.reactionsSince(R.room.id, R.since); if (U.room !== R) return;
    R.quiet = !rx.list.length;   // keine Reaktionen: bei laufendem Timer seltener abfragen
    R.since = rx.since; rx.list.forEach(x => { if (x.from !== RB.myId()) { addFx(x.to, x.kind); if (x.to === RB.myId()) (R.log ||= []).unshift({ from: R.members.find(m => m.id === x.from)?.name || 'Brainy', k: x.kind, at: Date.now() }); } });
    if (R.log) R.log.length = Math.min(R.log.length, 3);
    R.loaded = true;
    const go = planWalk(R); render(); go();
  } catch (e) {
    if (/not_member/.test(e.message)) await rejoin(R); else if (U.room === R) { R.err = RB.niceError(e); render(); }
  }
  R.polling = false;
}
// ---------- Ablauf: Mitglieder-Ereignisse aus dem Polling → Laufanimation (js/room-walk.js) und Atmosphäre (js/room-ambient.js) ----------
// Beide Module laden lazy; fehlt eines, sitzen alle sofort bzw. gibt es keine Atmosphäre. Beim ersten Laden sitzen alle Anwesenden schon, nur Neue laufen.
const INTRO_WALK = true, INTRO_GAP = 200;   // Erstladen: auch die Anwesenden laufen gestaffelt zu ihren Pulten (false = alle sitzen sofort)
let mods = null, walkTok = 0;
const lazy = () => (mods ||= { walk: import('./room-walk.js').catch(() => null), amb: import('./room-ambient.js').catch(() => null), perf: import('./room-perf.js').catch(() => null) });
// Ebenen im Overlay einhängen (einmal pro Raum); das Versprechen wird auch ohne Module erfüllt
function hookLayers(R) {
  return R.ready ||= (async () => {
    const m = lazy(), [W, A, P] = await Promise.all([m.walk, m.amb, m.perf]);
    if (U.room !== R) return;
    const wh = document.querySelector('.rm-walk'), ah = document.querySelector('.rm-ambient');
    try { P?.perfStart?.(document.querySelector('.rm')); R.perf = P; } catch { }
    try { if (W?.createWalk && wh) R.walk = W.createWalk(wh, { brain: brainSvg }); } catch { }
    try { if (A?.mountAmbient && ah) R.ambStop = A.mountAmbient(ah); } catch { }
  })();
}
function teardown(R) { try { R.perf?.perfStop?.(); } catch { } try { R.ambStop?.(); } catch { } try { R.walk?.destroy?.(); } catch { } R.ambStop = R.walk = null; }
// Mitglied läuft: das statische Brainy am Platz bleibt ausgeblendet, bis die Animation fertig ist (oder nach 9 s aus Sicherheit)
function act(R, m, fn, delay = 0) {
  const tok = ++walkTok; R.walking.set(m.id, tok);
  const done = () => { if (R.walking.get(m.id) === tok) { R.walking.delete(m.id); if (U.room === R) render(); } };
  hookLayers(R).then(() => { if (U.room !== R) return; if (!R.walk || reduced()) return done(); setTimeout(() => { if (U.room !== R) return; try { fn(R.walk, done); } catch { done(); } }, delay); });
  setTimeout(done, 9000 + delay);
}
// Vergleicht die aktuelle Sitzordnung mit der letzten: neu → walkIn, weg → walkOut, anderer Platz → move, Pause/Weiter → setPause.
// Markiert Läufer sofort (vor dem Rendern) und gibt die Auslöser als Funktion zurück, die nach dem Rendern aufzurufen ist.
function planWalk(R, pauseOnly) {
  if (!R.loaded || R.phase !== 'inside' || R.leaving) return () => { };
  const cur = new Map(); layoutSeats(R).forEach((m, i) => { if (m) cur.set(m.id, { m, seat: i, pause: memberState(m) === 'pause' }); });
  const first = !R.prev, prev0 = first ? new Map(INTRO_WALK && !reduced() ? [] : [...cur].filter(([, v]) => !v.m.me)) : R.prev;   // Erstladen: Anwesende laufen gestaffelt ein (oder sitzen sofort)
  if (first) R.prev = prev0;
  const prev = R.prev, jobs = [];
  if (pauseOnly) {   // Sekundentakt: nur Pause-Wechsel nachführen, Beitritte/Austritte macht das Polling
    for (const [id, c] of cur) { const p = prev.get(id); if (p && p.pause !== c.pause) { p.pause = c.pause; jobs.push(() => R.walk?.setPause?.(id, c.pause)); } }
    return () => jobs.forEach(j => j());
  }
  R.prev = cur; let n = 0;
  for (const [id, c] of [...cur].sort((a, b) => (b[1].m.me ? 1 : 0) - (a[1].m.me ? 1 : 0) || SEATS[b[1].seat][1] - SEATS[a[1].seat][1])) {
    const p = prev.get(id);
    if (!p) act(R, c.m, (w, d) => w.walkIn(c.m, c.seat, d), first ? (n++) * INTRO_GAP : 0);
    else if (p.seat !== c.seat) act(R, c.m, (w, d) => w.move(c.m, p.seat, c.seat, d));
    if (p && p.pause !== c.pause) jobs.push(() => R.walk?.setPause?.(id, c.pause));
  }
  for (const [id, p] of prev) if (!cur.has(id)) jobs.push(() => hookLayers(R).then(() => { if (U.room === R && R.walk && !reduced()) try { R.walk.walkOut(p.m, p.seat); } catch { } }));
  return () => { hookLayers(R); jobs.forEach(j => j()); };
}
// Eigenes Verlassen: Brainy steht auf und läuft hinaus, danach schliesst der Raum (Austritt am Server sofort)
function leaveAnimated() {
  const R = U.room; if (!R || R.leaving) return;
  const me = R.members.find(m => m.me);
  if (!R.walk || !me || R.mySeat == null || R.phase !== 'inside' || reduced()) return closeRoom(true);
  R.leaving = true; pendingLeave = RB.leaveRoom(R.room.id).catch(() => { });
  R.walking.set(me.id, ++walkTok);
  let fin = false; const end = () => { if (fin) return; fin = true; if (U.room === R) { closeRoom(false); render(); } };
  try { R.walk.walkOut(me, R.mySeat, end); } catch { return end(); }
  setTimeout(end, 5000);
}
let pendingLeave = null;
function closeRoom(leave = true) {
  const R = U.room; U.room = null; ptrs.clear(); perfLive(null); if (R) { if (Date.now() - (R.t0 || 0) > 240000) perfClearCrash(); teardown(R); }
  if (R && leave) pendingLeave = RB.leaveRoom(R.room.id).catch(() => { });   // Beitritt wartet darauf, sonst löscht das späte «Verlassen» den neuen Platz
  if (U.overlay === 'room') U.overlay = S.timer ? 'timer' : null;   // laufende Session geht normal weiter
}

// Raum-Sync: ein gemeinsamer Takt (11 s, bei laufendem eigenem Timer ohne Reaktionen 20 s); der Herzschlag nur, wenn der letzte schon ~30 s her ist
// (Server wertet nach 45 s als weg) oder sich der Timer geändert hat. Später lässt sich hier ein einzelner Server-Aufruf (room_sync) einhängen.
const SYNC_FAST = 11000, SYNC_SLOW = 20000, BEAT_MAX = 38000;   // Herzschlag-Abstand inkl. nächstem Takt bleibt unter 45 s
function roomSync(R, now) {
  const sig = `${S.timer?.segStart ? 1 : 0}|${S.timer?.subjectId || ''}`, changed = sig !== R.sig;
  const gap = S.timer?.segStart && R.quiet ? SYNC_SLOW : SYNC_FAST;
  if (!changed && now - R.lastPoll <= gap) return;
  if (changed || now - R.lastBeat + gap >= BEAT_MAX) beat();
  poll();
}
// Sekundentakt (vom App-Tick aufgerufen): Uhren und Sync – nur solange Raum offen und App sichtbar
export function roomTick() {
  if (U.play && U.sheet?.type !== 'play' && !U.play.busy) U.play = null;   // Play-Sheet startet beim nächsten Öffnen frisch
  const R = U.room; if (!R) return;
  if (U.overlay !== 'room') { U.room = null; perfLive(null); teardown(R); RB.leaveRoom(R.room.id).catch(() => { }); return; }   // Overlay anders geschlossen (z. B. Zurück-Taste)
  const app = document.getElementById('app');
  if (app) {
    const c = app.querySelector('[data-live="rmclock"]'); if (c) c.textContent = S.timer ? fmtClock(T.elapsed()) : '00:00';
    app.querySelectorAll('[data-rt]').forEach(el => {
      const m = R.members.find(x => x.id === el.dataset.rt); if (!m) return;
      const t = memberLcd(m); if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = lcdHTML(t); }
      const seat = el.closest('.rm-seat'), st = memberState(m); if (seat && !seat.classList.contains('st-' + st)) { seat.classList.remove('st-run', 'st-pause', 'st-idle'); seat.classList.add('st-' + st); }
    });
    if (R.phase === 'inside' && measure()) { if (!R.touched) R.cam = homeCam(); applyCam(); }
  }
  const now = Date.now(); planWalk(R, true)();
  if (R.fx.length && R.fx.some(f => now - f.at > 1900)) { R.fx = R.fx.filter(f => now - f.at <= 1900); render(); }
  if (document.hidden) return;
  roomSync(R, now);
}
export function roomInit() {
  ensureListeners();
  // Seite wurde mitten in einer Raumsitzung neu geladen (iOS hat die Ansicht beendet): Raum nicht wieder öffnen, Lernzeit läuft weiter
  const v = perfCrashCheck(); if (!v) return;
  if (v.id && BK.enabled && S.user?.id) RB.leaveRoom(v.id).catch(() => { });
  if (S.timer) setTimeout(() => CTX?.toast(S.timer.segStart ? 'Der Raum wurde beendet, deine Lernzeit läuft weiter' : 'Der Raum wurde beendet'), 1200);
}

// ---------- Aktionen ----------
async function enter(fn) {
  const p = P(); if (p.busy) return false;
  p.busy = '1'; p.err = ''; render();
  try {
    await pendingLeave; pendingLeave = null;
    const room = await fn();
    if (!S.timer) { T.start(curSubj(), 'free', 60); pauseOtherMedia(); goLive(S.timer.subjectId); }   // im Raum immer Stoppuhr, Check-in wie bei Solo
    CTX.haptic?.(30); CTX.chime?.();
    p.view = 'main'; p.name = ''; p.code = '';
    openRoom(room);
  } catch (e) { p.err = RB.niceError(e); }
  p.busy = '';
}

// Auswahl + Profilkarte (eigenes Brainy: nichts; zweiter Tipp aufs selbe: zu)
function pick(R, id) {
  R.sel = id === RB.myId() || R.sel === id ? null : id; R.card = R.sel;
  if (R.sel && BK.enabled && !St.person(R.sel)) BK.loadPerson(R.sel).then(() => U.room === R && render()).catch(() => { });
}
// Laufende Brainys liegen in der Läufer-Ebene (Shadow-DOM, nicht tippbar): Tipp-Position gegen ihre Figuren prüfen
function walkerAt(R, x, y) {
  const root = document.querySelector('.rm-walk')?.shadowRoot; if (!root || !R.walking?.size) return null;
  const hit = [...root.querySelectorAll('.w')].filter(el => el.style.visibility !== 'hidden').map(el => ({ el, r: el.querySelector('.wf').getBoundingClientRect() }))
    .filter(({ r }) => x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6).sort((a, b) => b.r.bottom - a.r.bottom)[0];
  if (!hit) return null;
  const html = hit.el.querySelector('.wf').innerHTML, cand = R.members.filter(m => !m.me && R.walking.has(m.id));
  const norm = h => { const d = document.createElement('div'); d.innerHTML = h; return d.innerHTML; };   // gleiche DOM-Schreibweise wie die Läufer-Figur
  return (cand.find(m => norm(brainSvg(m)) === html) || (cand.length === 1 ? cand[0] : null))?.id || null;
}
// Karte schliessen: Tipp neben die Karte (aufs Leere im Raum) oder Wischen nach unten
let cardWired = false;
function wireCard() {
  if (cardWired) return; cardWired = true;
  const close = () => { const R = U.room; if (R?.card) { R.card = R.sel = null; render(); } };
  document.addEventListener('click', e => {
    const R = U.room;
    if (R && R.phase === 'inside' && Date.now() >= quiet && e.target.closest?.('.rm-vp') && !e.target.closest('.rm-pcard, .rm-panel, .rm-zoom, .rm-head, .rm-home')) {
      const id = walkerAt(R, e.clientX, e.clientY); if (id) { e.stopPropagation(); e.preventDefault(); pick(R, id); render(); return; }
    }
    if (!R?.card || Date.now() < quiet || !e.target.closest?.('.rm') || e.target.closest('.rm-pcard, [data-a], .rm-panel')) return; close();
  }, true);
  let y0 = null;
  window.addEventListener('pointerdown', e => { y0 = e.target.closest?.('.rm-pcard') ? e.clientY : null; });
  window.addEventListener('pointerup', e => { if (y0 != null && e.clientY - y0 > 50) close(); y0 = null; });
}
export function roomActions(ctx) {
  CTX = ctx; wireCard();
  return {
    playOpen() { U.play = null; P(); U.sheet = { type: 'play' }; },
    playSubj(d) { P().subjectId = d.id; },
    playMode(d) { P().mode = d.id; },
    playGoal(d) { P().goalMin = +d.m; },
    playSolo() {
      U.sheet = null; U.overlay = 'timer';
      if (S.timer) return;
      const p = P(); T.start(curSubj(), p.mode, p.goalMin); pauseOtherMedia(); ctx.haptic(30); ctx.chime(); goLive(S.timer.subjectId);
    },
    playBack() { const p = P(); p.view = 'main'; p.err = ''; },
    playCreateOpen() { const p = P(); p.view = 'create'; p.err = ''; },
    playCodeOpen() { const p = P(); p.view = 'code'; p.err = ''; },
    playRandom() { return enter(() => RB.joinRandom()); },
    playCreate() {
      const p = P(), name = (p.name || '').trim().replace(/\s+/g, ' ');
      if (name && name.length < 2) { p.err = 'Der Raumname braucht mindestens 2 Zeichen.'; return; }
      const bm = badMsg([name], { links: true }); if (bm) { p.err = bm; return; }
      return enter(() => RB.createRoom(name));
    },
    playJoin() {
      const p = P(), code = (p.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 6) { p.err = 'Der Code hat 6 Zeichen.'; return; }
      return enter(() => RB.joinCode(code));
    },
    roomSit(d) {   // freien Stuhl wählen (nur lokal gespeichert, siehe Bericht)
      const R = U.room; if (!R) return false; const i = +d.i;
      if (R.leaving || !(i >= 0 && i < Math.min(R.room.max, SEATS.length)) || layoutSeats(R)[i]) return false;
      R.mySeat = i; try { localStorage.setItem(seatKey(R.room.code), String(i)); } catch { }
      ctx.haptic(15); setTimeout(planWalk(R), 0);   // eigenes Brainy läuft zum gewählten Stuhl
    },
    roomPick(d) {
      if (Date.now() < quiet) return false;                // Ziehen ist kein Antippen
      const R = U.room; if (!R) return false;
      pick(R, d.id);
    },
    roomCardClose() { const R = U.room; if (R) R.card = R.sel = null; },
    roomReact(d) {
      const R = U.room; if (!R?.sel || Date.now() - R.lastRx < 700) return false;
      R.lastRx = Date.now(); addFx(R.sel, d.k); ctx.haptic(12);
      RB.react(R.room.id, R.sel, d.k).catch(e => ctx.toast(esc(RB.niceError(e))));
    },
    roomPause() {
      if (!S.timer) { T.start(curSubj(), 'free', 60); pauseOtherMedia(); goLive(S.timer.subjectId); }
      else if (S.timer.segStart) { T.pause('manual'); goLive(null); }
      else { T.resume(); pauseOtherMedia(); goLive(S.timer.subjectId); }
      ctx.haptic(); beat();
    },
    roomInvite() { if (U.room) U.room.invite = true; },
    roomInviteClose() { if (U.room) U.room.invite = false; },
    async roomShare() {
      const R = U.room; if (!R) return false;
      const url = `${CONFIG.WEB_URL || location.origin + location.pathname}?room=${R.room.code}`, text = `Lerne mit mir im Brained-Lernraum «${R.room.name}». Code: ${R.room.code}`;
      try { if (navigator.share) { await navigator.share({ title: 'Brained Lernraum', text, url }); return false; } } catch { return false; }
      try { await navigator.clipboard.writeText(`${text}\n${url}`); ctx.toast('Link kopiert'); } catch { ctx.toast('Teilen nicht möglich'); }
    },
    async roomCopy() {
      const R = U.room; if (!R) return false;
      try { await navigator.clipboard.writeText(R.room.code); ctx.toast('Code kopiert'); } catch { ctx.toast('Kopieren nicht möglich'); }
    },
    roomZoom(d) { const R = U.room; if (R) { zoomAt(d.d === 'in' ? 1.45 : 1 / 1.45, vp.w / 2, vp.h / 2, true); } return false; },
    roomHome() { const R = U.room; if (R) { stopInertia(); R.cam = clampCam(homeCam()); R.touched = false; applyCam(560); } return false; },
    roomLeave() { leaveAnimated(); ctx.haptic(); },
  };
}
export function roomChange() { return {}; }
