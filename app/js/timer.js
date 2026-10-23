// Timer-Engine: Sessions starten/pausieren, Check-ins ("Bist du noch da?"), Pomodoro, Ziel-Modus.
// Grundregel: Gezählt wird nur Zeit, in der Brained im Vordergrund ist ODER der Fokus-Modus
// (Bildschirm bleibt dank Wake Lock an) aktiv ist. App verlassen = Pause.
import { S, save, uid, live, subj, streakInfo } from './store.js';
import { dayPart } from './ui.js';
import { keepAwakeNative } from './native.js';

const CHECKIN_GRACE = 5 * 60000;   // 5 min Zeit, um "Bin noch da" zu tippen
const POMO_FOCUS = 25 * 60000;

export function elapsed() {
  const t = S.timer; if (!t) return 0;
  return t.acc + (t.segStart ? Date.now() - t.segStart : 0);
}
live.min = () => elapsed() / 60000;
live.subjectId = () => S.timer?.subjectId;

export const isRunning = () => !!S.timer?.segStart;

export function start(subjectId, mode = 'free', goalMin = 60) {
  const now = Date.now();
  S.timer = {
    id: uid(), subjectId, mode, goalMin, startedAt: now, acc: 0, segStart: now, segments: [],
    status: 'running', pauseReason: null, checkin: null, checkins: 0,
    nextCheckinAcc: (S.settings.checkinMin || 0) * 60000, lastBeat: now,
    pomo: { count: 0, focusStartAcc: 0, breakEnd: 0 }, goalHit: false,
  };
  save();
}

export function pause(reason = 'manual', at = Date.now()) {
  const t = S.timer; if (!t || !t.segStart) return;
  at = Math.max(at, t.segStart);
  t.acc += at - t.segStart;
  t.segments.push([t.segStart, at]);
  t.segStart = null;
  t.status = reason === 'break' ? 'break' : 'paused';
  t.pauseReason = reason;
  save();
}

export function resume() {
  const t = S.timer; if (!t || t.segStart) return;
  if (t.mode === 'pomo' && t.status === 'break') t.pomo.focusStartAcc = t.acc;
  t.segStart = Date.now(); t.status = 'running'; t.pauseReason = null;
  save();
}

// Zeit seit dem verpassten Check-in wird wieder abgezogen
function rollbackTo(accAt) {
  const t = S.timer;
  let over = t.acc - accAt;
  while (over > 0 && t.segments.length) {
    const seg = t.segments[t.segments.length - 1], len = seg[1] - seg[0];
    if (len <= over) { t.segments.pop(); over -= len; } else { seg[1] -= over; over = 0; }
  }
  t.acc = Math.min(t.acc, accAt);
}

// Wird jede Sekunde aufgerufen. Gibt Ereignisse zurück, auf die die UI reagiert.
export function tick() {
  const t = S.timer; if (!t) return [];
  const now = Date.now(), ev = [];
  t.lastBeat = now;
  if (t.segStart) {
    const el = elapsed();
    if (S.settings.checkinMin > 0 && !t.checkin && el >= t.nextCheckinAcc) { t.checkin = { since: now, accAt: el }; ev.push('checkin'); }
    if (t.mode === 'pomo' && el - t.pomo.focusStartAcc >= POMO_FOCUS) {
      pause('break');
      t.pomo.count++;
      t.pomo.breakEnd = now + (t.pomo.count % 4 === 0 ? 15 : 5) * 60000;
      ev.push('pomo-break');
    }
    if (t.mode === 'goal' && !t.goalHit && el >= t.goalMin * 60000) { t.goalHit = true; ev.push('goal'); }
  }
  if (t.checkin && now - t.checkin.since > CHECKIN_GRACE) {
    pause('away');
    rollbackTo(t.checkin.accAt);
    t.checkin = null;
    t.nextCheckinAcc = t.acc + S.settings.checkinMin * 60000;
    ev.push('checkin-timeout');
  }
  if (t.status === 'break' && now >= t.pomo.breakEnd) { resume(); ev.push('pomo-resume'); }
  if (ev.length || now % 5000 < 1000) save();
  return ev;
}

export function confirmCheckin() {
  const t = S.timer; if (!t) return;
  t.checkin = null; t.checkins++;
  t.nextCheckinAcc = elapsed() + S.settings.checkinMin * 60000;
  S.stats.checkins++;
  save();
}

// Wiederherstellung nach Reload / App-Kill: lief der Timer ohne Herzschlag weiter, wird
// beim letzten Herzschlag pausiert (keine Geister-Minuten im Hintergrund).
export function recover() {
  const t = S.timer; if (!t || !t.segStart) return false;
  if (Date.now() - t.lastBeat > 8000) { pause('left', t.lastBeat); return true; }
  return false;
}

export function finish() {
  const t = S.timer; if (!t) return null;
  if (t.segStart) pause('finish');
  const min = Math.round(t.acc / 60000);
  S.timer = null;
  if (min < 1) { save(); return null; }
  const s = subj(t.subjectId);
  const streakBefore = streakInfo().current;
  const session = {
    id: t.id, subjectId: t.subjectId, start: t.segments[0]?.[0] || t.startedAt, end: t.segments.at(-1)?.[1] || Date.now(),
    min, mode: t.mode, segments: t.segments, pomos: t.pomo.count, checkins: t.checkins,
    xp: min + t.pomo.count * 5 + t.checkins * 3 + (t.goalHit ? 15 : 0),
    title: `${dayPart(t.startedAt)}-Session ${s.name}`, note: '', goalHit: !!t.goalHit,
  };
  S.sessions.push(session);
  save();
  return { session, streakBefore };
}

export function discard() { S.timer = null; save(); }

// ---------- Fokus-Modus (Wake Lock) ----------
let lock = null;
export async function keepAwake(on) {
  const n = await keepAwakeNative(on); if (n !== null) return n;
  try {
    if (on && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); return true; }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { }
  return false;
}
export const wakeLockSupported = () => 'wakeLock' in navigator || !!window.Capacitor?.Plugins?.KeepAwake;
