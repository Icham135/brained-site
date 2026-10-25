// Lernraum-Atmosphäre: funkelnde Sterne, pulsierende Nervenknoten, flackernde Lampen, feiner Staub.
// Reines Markup in Weltkoordinaten (Bildpunkte 1254 x 1254, gleiche Ebene wie die Szene), animiert nur per CSS (transform/opacity), siehe css/room-ambient.css.
// Dichte nach perfTier() (js/room-perf.js): low ca. 1/3; Pause über rm-paused (perf) und visibilitychange.
// Einhängung: ambientHTML() als erstes Kind in .rm-world; initAmbient() einmal aufrufen (pausiert im Hintergrund-Tab).
const LAMPS = [[448, 486], [610, 428], [545, 546], [812, 490], [318, 548], [722, 578], [965, 590], [428, 688], [640, 700], [835, 690], [540, 820], [770, 838]];
const WIN_LAMPS = [[518, 285], [618, 282], [860, 352], [1030, 408]];
const NODES = [[517, 172], [758, 166], [832, 193], [877, 240], [1040, 310], [1087, 350], [1155, 420], [1135, 483], [1190, 575], [1185, 710], [1120, 740], [1170, 830], [900, 1045], [705, 1055], [612, 1052], [262, 942], [345, 1020], [130, 760], [55, 660], [52, 575], [70, 460], [92, 415], [240, 260], [97, 1213], [190, 1160]];
const GLOWS = [[320, 330, 520], [940, 330, 520], [160, 800, 440], [1100, 800, 440], [620, 1060, 560], [620, 150, 520]];   // weiche Lichtflecken auf dem Gehirn: x, y, Durchmesser
const SKY = { x0: -350, x1: 1604, y0: -750, y1: 2000 };   // Sternenfeld: deckt auch den erweiterten Himmel ober- und unterhalb des Bildes ab
import { perfTier } from './room-perf.js';
let cache = '', cacheTier = '';

const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const inBrain = (x, y) => ((x - 627) / 640) ** 2 + ((y - 640) / 590) ** 2 < 1;   // Gehirn-Fläche hat schon eigene Lichter

function build(low) {
  const r = rng(7), p = n => Math.round(n);
  // Sterne in 6 Gruppen mit je eigener Phase (eine Animation pro Gruppe statt pro Stern: wenige Ebenen, schont den Akku)
  const G = 6, groups = Array.from({ length: G }, () => []);
  for (let n = 0, i = 0; n < (low ? 24 : 72) && i < 2000; i++) {
    const x = SKY.x0 + r() * (SKY.x1 - SKY.x0), y = SKY.y0 + r() * (SKY.y1 - SKY.y0);
    if (inBrain(x, y)) continue;
    const s = r() < .2 ? 3 : 2, c = r() < .35 ? ' v' : '';
    groups[n % G].push(`<i class="${'st' + c}" style="left:${p(x)}px;top:${p(y)}px;width:${s}px;height:${s}px"></i>`); n++;
  }
  const stars = groups.map((g, k) => `<div class="tw tw${k}">${g.join('')}</div>`).join('');
  const glows = GLOWS.map(([x, y, d], k) => `<i class="gl" style="left:${x - d / 2}px;top:${y - d / 2}px;width:${d}px;height:${d}px;animation-delay:${-k * 1.7}s"></i>`).join('');
  const NG = 3, ng = Array.from({ length: NG }, () => []);
  NODES.forEach(([x, y], k) => ng[k % NG].push(`<i class="nd" style="left:${x - 14}px;top:${y - 14}px"></i>`));
  const nodes = ng.map((g, k) => `<div class="pu pu${k}">${g.join('')}</div>`).join('');
  const lamp = ([x, y], k, c) => `<i class="${c}" style="left:${x - 22}px;top:${y - 22}px;animation-delay:${-((k * 1.37) % 5).toFixed(2)}s;animation-duration:${(3.2 + (k * .61) % 2.4).toFixed(2)}s"></i>`;
  const lamps = LAMPS.map((l, k) => lamp(l, k, 'lm')).join('') + WIN_LAMPS.map((l, k) => lamp(l, k + 3, 'lm wl')).join('');
  const dust = Array.from({ length: low ? 4 : 10 }, (_, k) => `<i class="du rm-amb-dust" style="left:${p(190 + r() * 800)}px;top:${p(330 + r() * 640)}px;--dx:${p(r() * 50 - 25)}px;animation-duration:${(14 + r() * 12).toFixed(1)}s;animation-delay:${-(r() * 20).toFixed(1)}s"></i>`).join('');
  return `<div class="rm-amb" aria-hidden="true"><div class="amb-sky">${stars}</div><div class="amb-brain">${glows}${nodes}</div><div class="amb-room">${lamps}${dust}</div></div>`;
}
export const ambientHTML = () => { const t = perfTier(); if (cacheTier !== t) { cacheTier = t; cache = build(t !== 'high'); } return cache; };

let on = false;
// Im Hintergrund-Tab pausieren (CSS: html.rm-amb-pause)
export function initAmbient() {
  if (on) return; on = true;
  const f = () => document.documentElement.classList.toggle('rm-amb-pause', document.hidden);
  document.addEventListener('visibilitychange', f); f();
}

// Einhängung durch js/rooms.js: füllt den Host (<div class="rm-ambient" data-live>) und gibt stop() zurück. Lädt das Stylesheet selbst, falls es fehlt.
export function mountAmbient(host) {
  if (!host) return () => {};
  if (!document.querySelector('link[href*="room-ambient.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/room-ambient.css'; document.head.appendChild(l); }
  host.innerHTML = ambientHTML(); initAmbient();
  return () => { host.innerHTML = ''; };
}
