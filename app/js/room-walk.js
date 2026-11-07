// Lernraum: Brainys laufen von der Tür zum Pult, setzen sich, stehen auf und laufen hinaus (Agent «walk»).
// Eine einzige rAF-Schleife, nur transform/opacity. Die Läufer liegen in einem Shadow-DOM (.rm-walk), damit der morphdom-Abgleich
// (jedes render()) sie nicht anfasst. Koordinaten = Bildpunkte wie js/room-scene.js (Kopfmitte = Platz).
// Einhängung in js/rooms.js: walkHostHTML() in die Welt, walkTrack() in roomOverlayView, isWalking() in unitHTML, walkStop() in closeRoom.
import { SEATS, DESK_CLIP } from './room-scene.js';

import { SEATS as LS, DOOR, findPath, depthScale } from './room-layout.js';   // Tür, Plätze, Wege um die Pulte (Agent «core»)

const seatsOf = () => LS.map(s => [s.x, s.y]);
const BR = 96, HEAD_UP = 44, SPEED = 175, STRIDE = 44, STAGGER = 520, SIT_MS = 420, STAND_MS = 340;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const CSS = new URL('../css/room-walk.css', import.meta.url).href;
const DESK = `polygon(${DESK_CLIP.map(([x, y]) => `${x + BR / 2}px ${y + BR * .56}px`).join(',')})`;
const stand = i => LS[i].stand;                       // Bodenpunkt neben dem Stuhl
const route = (a, b) => findPath(a, b);

// ---------- Läufer ----------
const now = () => performance.now();
const hash = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const at = (w, d) => { let i = 0; while (i < w.len.length - 1 && w.len[i] < d) i++; const a = w.pts[i], b = w.pts[i + 1] || a, s0 = i ? w.len[i - 1] : 0, t = Math.min(1, Math.max(0, (d - s0) / Math.max(1, w.len[i] - s0))); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, b[0] - a[0]]; };

// Vertrag mit js/rooms.js (Agent «flow»): createWalk(host, { brain }) → { walkIn, walkOut, move, setPause, destroy }.
// brain(m) liefert das SVG des Brainys; done() wird gerufen, sobald das Brainy sitzt (walkIn/move) bzw. draussen ist (walkOut).
export function createWalk(host0, { brain }) {
  const walkers = new Map(), pending = new Set();
  let host = null, root = null, raf = 0, stagger = 0, lastLaunch = 0, dead = false;
  const mkLink = () => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; return l; };
  function ensureHost() {
    const h = host0.isConnected ? host0 : document.querySelector('.rm-walk'); if (!h) return false;
    if (!document.head.querySelector('link[data-rm-walk]')) { const l = mkLink(); l.dataset.rmWalk = '1'; document.head.append(l); }
    if (h !== host) {
      host = h; root = h.shadowRoot || h.attachShadow({ mode: 'open' }); if (!root.querySelector('link')) root.prepend(mkLink());
      for (const w of walkers.values()) w.el = null;   // Host wurde neu gebaut: Elemente neu anlegen
    }
    return true;
  }
  function mkEl(w) {
    const el = document.createElement('div'); el.className = 'w'; el.style.visibility = 'hidden';
    el.innerHTML = `<i class="ws"></i><div class="wc"><div class="wf">${w.fig}</div></div>`;
    root.append(el); w.el = el; w.f = el.querySelector('.wf'); w.s = el.querySelector('.ws'); w.c = el.querySelector('.wc');
  }
  // kind: in (Tür → Platz), out (Platz → Tür), move (Platz → Platz). Bei mehreren gleichzeitig wird gestaffelt gestartet.
  function launch(m, kind, seat, from, done, fromSeat) {
    const t = now(); stagger = t - lastLaunch > 1500 ? 0 : stagger + STAGGER; lastLaunch = t;
    const S = seatsOf(), end = kind === 'out' ? DOOR.in : stand(seat), start = kind === 'in' ? DOOR.in : from;
    const pts = route(start, end).map(p => [...p]), len = []; if (pts[0] !== start) pts.unshift(start); if (pts.at(-1) !== end) pts.push(end); if (kind === 'in') pts.unshift([...DOOR.out]); if (kind === 'out') pts.push([...DOOR.out]); let L0 = 0;
    for (let i = 1; i < pts.length; i++) { L0 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(L0); }
    walkers.get(m.id)?.el?.remove();
    const w = { id: m.id, kind, seat, fromSeat: fromSeat ?? seat, fig: brain(m), pts, len, total: L0, done, t0: t + 60 + stagger, ph: kind === 'in' ? 'wait' : 'stand', x: pts[0][0], y: pts[0][1], vx: 0, spd: 1 + ((hash(m.id) % 17) - 8) / 100, off: ((hash(m.id) >> 5) % 37) - 18, el: null, ts: t + 60 + stagger };
    walkers.set(m.id, w);
    if (!raf && !dead) raf = requestAnimationFrame(loop);
  }
  const finish = w => { walkers.delete(w.id); w.el?.remove(); try { w.done?.(); } catch { } };
  function loop(t) {
    raf = 0; if (dead) return;
    if (!ensureHost()) { raf = requestAnimationFrame(loop); return; }
    const skip = document.hidden && !window.__walkForce, S = seatsOf(), fin = [];
    for (const w of walkers.values()) {
      if (!w.el) mkEl(w);
      if (t < w.t0) continue;
      if (skip) { fin.push(w); continue; }   // App im Hintergrund: sofort fertig
      w.el.style.visibility = '';
      const [sx, sy] = S[w.ph === 'stand' && w.kind === 'move' ? w.fromSeat : w.seat];
      if (w.ph === 'wait') { w.ph = 'walk'; w.tw = w.t0; }   // Startzeit = geplante Zeit, damit ein verspäteter Frame sie nicht zusammenschiebt
      if (w.ph === 'stand') {   // aufstehen: aus dem Stuhl hoch, dann loslaufen
        const p = Math.min(1, (t - w.ts) / STAND_MS), e = ease(p), [fx, fy] = stand(w.kind === 'move' ? w.fromSeat : w.seat);
        place(w, sx + (fx - sx) * e, sy + (fy - HEAD_UP - sy) * e, 1 + .03 * Math.sin(p * Math.PI), 0, p < .55 ? DESK : '', .5 + .5 * e, 0, sx, sy);
        if (p >= 1) { w.ph = 'walk'; w.tw = w.ts + STAND_MS; }
        continue;
      }
      if (w.ph === 'walk') {
        const el = (t - w.tw) / 1000, d = Math.min(w.total, SPEED * w.spd * (el - .18 * (1 - Math.exp(-el / .18))));   // sanftes Anlaufen
        const [x0, y, dx] = at(w, Math.max(0, d)), s = Math.sin((d / STRIDE) * Math.PI), bob = Math.abs(s);
        const dir = Math.abs(dx) > .5 ? Math.sign(dx) : 0; w.vx += (dir - w.vx) * .12;
        const lat = w.off * Math.min(1, d / 70, (w.total - d) / 70, 1);   // seitlicher Versatz, an Anfang und Ende 0
        const x = x0 + lat;
        w.x = x; w.y = y;
        const depth = depthScale(y);   // Isometrie: weiter vorn = grösser
        place(w, x, y - HEAD_UP * depth, depth, s * 4 + w.vx * 3, '', 1, bob);
        if (d >= w.total) { if (w.kind === 'out') fin.push(w); else { w.ph = 'sit'; w.ts = t; } }
        continue;
      }
      if (w.ph === 'sit') {
        const [sx2, sy2] = S[w.seat], p = Math.min(1, (t - w.ts) / SIT_MS), e = ease(p), [fx, fy] = stand(w.seat);
        place(w, fx + (sx2 - fx) * e, fy - HEAD_UP + (sy2 - (fy - HEAD_UP)) * e, 1 - .04 * Math.sin(p * Math.PI), 0, p > .3 ? DESK : '', 1 - .4 * e, 0, sx2, sy2);
        if (p >= 1) fin.push(w);
      }
    }
    fin.forEach(finish);
    if (walkers.size) raf = requestAnimationFrame(loop);
  }
  const api = {
    walkIn: (m, seat, done) => launch(m, 'in', seat, DOOR.in, done),
    walkOut: (m, seat, done) => launch(m, 'out', seat, stand(seat), done),
    move: (m, from, to, done) => launch(m, 'move', to, stand(from), done, from),
    setPause: (id, paused) => { if (!reduced() && !walkers.has(id)) gesture(id, paused ? 'pause' : 'run'); },
    busy: () => walkers.size > 0,
    debug: () => [...walkers.values()].map(w => ({ id: w.id, kind: w.kind, ph: w.ph, x: Math.round(w.x), y: Math.round(w.y), total: Math.round(w.total) })),
    destroy() { dead = true; cancelAnimationFrame(raf); walkers.clear(); try { root?.replaceChildren(mkLink()); } catch { } },
  };
  window.__walkDebug = () => api.debug();   // Prüfhilfe: aktive Läufer und Positionen
  return api;
}

// Pause: Schultern sinken; Weiter: kleiner Hüpfer
function gesture(id, st) {
  const f = document.querySelector(`.rm-brain[data-id="${CSS_ESC(id)}"] .rm-fig`); if (!f?.animate) return;
  const pause = st === 'pause';
  f.animate(pause
    ? [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(4px) scale(1.02,.93)', offset: .45 }, { transform: 'translateY(3px) scale(1.01,.95)' }]
    : [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-7px) scale(.97,1.05)', offset: .4 }, { transform: 'translateY(0) scale(1.02,.96)', offset: .7 }, { transform: 'translateY(0) scale(1)' }],
    { duration: pause ? 900 : 620, easing: 'ease-in-out', fill: 'none' });
}
const CSS_ESC = s => (window.CSS?.escape ? window.CSS.escape(s) : String(s).replace(/"/g, '\\"'));

const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
// Kopfmitte (x,y) in Bildpunkten, Skalierung, Neigung, Clip (nur beim Hinsetzen), Schattenstärke, Wippen
function place(w, x, y, k, rot, clip, shade = 1, bob = 0, sx = 0, sy = 0) {
  const ax = clip ? sx : x, ay = clip ? sy : y, ox = x - ax, oy = y - ay;   // mit Clip bleibt der Rahmen am Platz, nur die Figur bewegt sich darin
  w.el.style.transform = `translate3d(${ax.toFixed(1)}px,${ay.toFixed(1)}px,0)`;
  w.c.style.clipPath = clip || 'none';
  w.f.style.transform = `translate3d(${ox.toFixed(1)}px,${(oy - bob * 5).toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg) scale(${(k * (1 + .025 * bob)).toFixed(3)},${(k * (1 - .03 * bob)).toFixed(3)})`;
  w.s.style.transform = `translate3d(${ox.toFixed(1)}px,${(oy + HEAD_UP * k).toFixed(1)}px,0) scale(${(k * (1 - .15 * bob)).toFixed(3)},${(k * .9).toFixed(3)})`;
  w.s.style.opacity = (shade * (1 - .25 * bob)).toFixed(2);
}
