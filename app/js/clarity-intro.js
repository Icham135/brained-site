// Brained Clarity · Ladescreen beim Öffnen: gläsernes Brain, Nebel löst sich auf (Klarheit). Geht nach ca. 1.8 s weiter, Tippen überspringt.
import { ui } from './clarity.js';

export const INTRO_MS = 1800;
let CTX = null;

// Im Test-Modus (?test, window.__brained) kein Intro, ausser erzwungen (?clarityintro oder globalThis.__clarityIntro)
export function introWanted() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('clarityintro') || globalThis.__clarityIntro === true) return true;
    if (q.has('test') || q.has('livetest') || globalThis.__brained) return false;
  } catch { }
  return true;
}

const CIRCLES = [[38, 46, 17], [60, 38, 19], [82, 46, 17], [29, 64, 15], [91, 64, 15], [45, 78, 15], [75, 78, 15], [60, 68, 21]];
const circles = (d = 0, extra = '') => CIRCLES.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + d}"${extra}/>`).join('');

// Gläsernes Ringe-Logo (ineinandergehende Ringe, ohne Gesicht): Verlaufs-Kontur, transparente Füllung, inneres Leuchten, Farbsaum, Glanzlichter; Frost liegt anfangs darüber
function glassBrain() {
  const folds = 'M60 22C55 32 65 40 60 50M32 44q7-7 14 0M74 44q7-7 14 0M22 64q5 4 10 0M88 64q5 4 10 0';
  return `<svg class="ci-brain" viewBox="8 12 104 96" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="ci-st" gradientUnits="userSpaceOnUse" x1="14" y1="16" x2="106" y2="100"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#9FE0FF"/><stop offset="1" stop-color="#4FD6E6"/></linearGradient>
    <linearGradient id="ci-fl" gradientUnits="userSpaceOnUse" x1="20" y1="16" x2="100" y2="100"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#7CC8FF" stop-opacity=".6"/><stop offset="1" stop-color="#3FD6D0" stop-opacity=".75"/></linearGradient>
    <radialGradient id="ci-core" gradientUnits="userSpaceOnUse" cx="60" cy="62" r="42"><stop offset="0" stop-color="#8FE4FF" stop-opacity=".8"/><stop offset="1" stop-color="#8FE4FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="ci-sw" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="ci-clip">${circles(1)}</clipPath>
    <mask id="ci-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="110"><rect width="120" height="110" fill="#fff"/><g fill="#000">${circles(1)}</g></mask>
    <mask id="ci-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="110"><rect width="120" height="110" fill="#fff"/><g fill="#000" filter="url(#ci-blur)">${circles(-3)}</g></mask>
    <filter id="ci-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="ci-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".5"/></filter>
  </defs>
  <g fill="url(#ci-fl)" opacity=".5">${circles(1)}</g>
  <g clip-path="url(#ci-clip)">
    <ellipse cx="60" cy="62" rx="44" ry="40" fill="url(#ci-core)"/>
    <rect width="120" height="110" fill="#fff" opacity=".7" mask="url(#ci-edge)"/>
    <path d="M18 98C40 110 80 110 102 98" fill="none" stroke="#3FE0D0" stroke-width="7" opacity=".7" filter="url(#ci-blur)"/>
    <g fill="none" stroke="#4A90E0" stroke-width="3" stroke-linecap="round" opacity=".5" transform="translate(.6 1)"><path d="${folds}"/></g>
    <g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".75"><path d="${folds}"/></g>
    <rect class="ci-sweep" x="-30" y="0" width="24" height="120" fill="url(#ci-sw)"/>
    <g class="ci-frost" fill="#fff">${circles(1)}</g>
  </g>
  <g fill="none" stroke-width="2.4" mask="url(#ci-mask)">
    <g stroke="#3FE8F0" opacity=".6" style="mix-blend-mode:screen" transform="translate(-1 -.6)">${circles(1.6)}</g>
    <g stroke="#B39BFF" opacity=".5" style="mix-blend-mode:screen" transform="translate(1 .7)">${circles(1.6)}</g>
    <g stroke="url(#ci-st)" stroke-width="2.6">${circles(1.6)}</g>
  </g>
  <g fill="none" stroke="#fff" stroke-linecap="round" filter="url(#ci-soft)">
    <path d="M30 40a14 14 0 0 1 9-9" stroke-width="3" opacity=".95"/><path d="M50 28a14 14 0 0 1 11-6" stroke-width="2.6" opacity=".9"/>
    <path d="M74 27a12 12 0 0 1 8 2" stroke-width="2" opacity=".6"/><path d="M24 60v4" stroke-width="2" opacity=".6"/>
  </g>
</svg>`;
}

const BOKEH = [[-14, 6, 160, 0], [60, 0, 120, 1.5], [68, 50, 180, .8], [-18, 62, 150, 2.2], [28, 82, 120, 1.1]];
const DOTS = [[10, 58, 4, 0.1], [20, 26, 3, 0.6], [32, 76, 4, 0.9], [78, 22, 4, 0.4], [86, 66, 3, 1.2], [66, 82, 4, 0.2], [90, 40, 3, 1.0], [12, 84, 3, 1.4]];

export function introView() {
  const u = ui();
  if (!u.introT) { u.introT = 1; setTimeout(() => { if (ui() === u && u.phase === 'intro') finish(); }, INTRO_MS); }
  const pt = DOTS.map(([l, t, z, d]) => `<u style="left:${l}%;top:${t}%;--s:${z}px;--d:${d}s"></u>`).join('');
  const bk = BOKEH.map(([l, t, z, d]) => `<i style="left:${l}%;top:${t}%;--z:${z}px;--d:${d}s"></i>`).join('');
  return `<div class="ci" data-a="clarityIntroDone" role="button" tabindex="0" aria-label="Brained Clarity, tippen zum Überspringen">
    <div class="ci-bokeh" aria-hidden="true">${bk}</div>
    <div class="ci-bokeh ci-pt" aria-hidden="true">${pt}</div>
    <div class="ci-inner">
      <div class="ci-stage">
        <div class="ci-shadow"></div>
        <div class="ci-float">${glassBrain()}</div>
        <div class="ci-fog" aria-hidden="true"><b class="f1"></b><b class="f2"></b></div>
      </div>
      <div class="ci-word">Brained</div>
      <div class="ci-sub">Clarity</div>
      <div class="ci-tag">Dein Stoff. Klar gefiltert.</div>
      <div class="ci-load" aria-hidden="true"><span class="ci-dots"><i></i><i></i><i></i></span><span class="ci-bar"><b></b></span></div>
    </div>
  </div>`;
}

function finish() {
  const u = ui();
  if (u.phase !== 'intro') return;
  u.phase = 'welcome';
  try { window.scrollTo?.(0, 0); } catch { }
  CTX?.render?.();
}

export function introActions(ctx) {
  CTX = ctx;
  return { clarityIntroDone() { finish(); } };
}
