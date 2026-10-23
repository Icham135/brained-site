// UI-Helfer: Escaping, Formatierung, Icons, Logo, Avatare, Mini-Charts.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');

export function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${pad(m)} min` : `${h} h`;
}
export function fmtShort(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  return `${h}h ${pad(m)}m`;
}
export function fmtHours(min) { return (min / 60).toFixed(min >= 600 ? 0 : 1).replace('.', ',') + ' h'; }
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
export function fmtTime(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export function fmtDate(ts, opts = {}) {
  const d = new Date(ts);
  const s = `${WD[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  return opts.time ? `${s} · ${fmtTime(ts)}` : s;
}
export function timeAgo(ts) {
  const diff = (Date.now() - ts) / 60000;
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${Math.round(diff)} min`;
  if (diff < 60 * 24) return `vor ${Math.round(diff / 60)} h`;
  const d = Math.round(diff / 1440);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}
export function dayPart(ts) {
  const h = new Date(ts).getHours();
  if (h < 5) return 'Nacht';
  if (h < 11) return 'Morgen';
  if (h < 14) return 'Mittags';
  if (h < 18) return 'Nachmittags';
  if (h < 22) return 'Abend';
  return 'Nacht';
}

const svg = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const I = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1.5" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1.5" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" stroke="none"/>'),
  flame: svg('<path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4S9 11 11 11c0-4 1-9 1-9z" fill="currentColor" stroke="none"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  chev: svg('<path d="M9 18l6-6-6-6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
  userPlus: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>'),
  cal: svg('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  bell: svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>'),
  share: svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  bolt: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9z" fill="currentColor" stroke="none"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  send: svg('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
  refresh: svg('<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>'),
  edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  boost: svg('<path d="M12 2c3 3 4.5 6.5 4.5 10.5L12 22l-4.5-9.5C7.5 8.5 9 5 12 2z"/><circle cx="12" cy="10" r="2"/><path d="M7.5 15 4 17l1.5-5M16.5 15 20 17l-1.5-5"/>'),
  comment: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  globe: svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>'),
  lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  mail: svg('<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 6-10 7L2 6"/>'),
  google: `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`,
};

// Cartoon-Gehirn "Brainy" (Logo, Maskottchen & alle Avatare)
// body: Ärmchen + Beinchen (Onboarding) · hat/eyes/mouth/extra: Accessoires aus dem Shop · fx: 'shine' | 'stars'
import { ART } from './shop-art.js';
import { auraHTML, bgfxHTML, BG_IDS, celebrate, getEffect } from './shop-fx.js';
const HIDE_EYES = ['shades', 'hearts', 'vr'];
let gid = 0;
import { ANIM } from './skin-anim.js';
export function brainSVG({ size = 120, mood = 'happy', fill = '#FFD3E2', outline = '#1A1424', fold = '#E2648E', body = false, hat = '', eyes = '', mouth = '', extra = '', fx = '', fit = '', anim = '' } = {}) {
  const C = [[38, 46, 17], [60, 38, 19], [82, 46, 17], [29, 64, 15], [91, 64, 15], [45, 78, 15], [75, 78, 15], [60, 68, 21]];
  const id = 'g' + (++gid);
  let defs = '';
  if (fill === 'rainbow') { defs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FB1"/><stop offset=".25" stop-color="#FFD66B"/><stop offset=".5" stop-color="#8CF0B0"/><stop offset=".75" stop-color="#8CCBFF"/><stop offset="1" stop-color="#C6A8FF"/></linearGradient>`; fill = `url(#${id})`; }
  const outer = C.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4}"/>`).join('');
  const inner = C.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  // Animierte Skins (js/skin-anim.js): nur ab Grösse 48 und ohne «reduzierte Bewegung», sonst bleibt die ruhige Grundfarbe
  let adefs = '', under = '', over = '';
  if (anim && ANIM[anim] && size >= 48 && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    const K = ANIM[anim](id); adefs = K.defs + `<clipPath id="${id}c">${inner}</clipPath>`; fill = K.fill;
    under = K.under ? `<g clip-path="url(#${id}c)">${K.under}</g>` : ''; over = `<g clip-path="url(#${id}c)">${K.over}</g>`;
  }
  const O = outline, A = ART(O);
  const grin = `<path d="M50 74 h20 q-1 10 -10 10 q-9 0 -10 -10z" fill="${O}"/>`;
  const mouths = {
    happy: `<path d="M54 75 q6 6 12 0" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`,
    wow: `<ellipse cx="60" cy="78" rx="4" ry="5" fill="${O}"/>`,
    think: `<path d="M54 78 h12" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`,
    love: `<path d="M53 74 q7 9 14 0 z" fill="${O}"/>`,
    grin: `${grin}<path d="M53 75 h14 v2.5 h-14z" fill="#fff"/>`,
    wink: `<path d="M54 75 q6 6 12 0" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`,
  };
  const teeth = (c, edge) => `${grin}<rect x="51" y="74" width="18" height="4.5" rx="1" fill="${c}" stroke="${edge}" stroke-width=".8"/><path d="M55.5 74v4.5M60 74v4.5M64.5 74v4.5" stroke="${edge}" stroke-width=".8"/>`;
  const M = {
    goldgrill: teeth('#FFC93C', '#B07A00') + `<path class="b-glint2" d="M52 74.5 l3 0 l-2 4 h-3z" fill="#FFF8D6"/><path class="b-star" d="M71 71 l.8 -2.2 l.8 2.2 l2.2 .8 l-2.2 .8 l-.8 2.2 l-.8 -2.2 l-2.2 -.8z" fill="#FFF3B0"/>`,
    diamondgrill: teeth('#CFF6FF', '#5FB8D6') + `<path class="b-star" d="M70 70 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1z" fill="#fff" stroke="#5FB8D6" stroke-width=".6"/><path class="b-star" d="M48 79 l.7 -2 l.7 2 l2 .7 l-2 .7 l-.7 2 l-.7 -2 l-2 -.7z" fill="#fff" stroke="#5FB8D6" stroke-width=".5" style="animation-delay:.7s"/>`,
    mustache: mouths.happy + `<path class="b-wiggle" d="M60 72 q-6 -5 -13 0 q5 4 13 0 q8 4 13 0 q-7 -5 -13 0z" fill="#5B3A1E" stroke="${O}" stroke-width="1.2"/>`,
    gum: mouths.wow + `<circle class="b-gum" cx="66" cy="80" r="7" fill="#FF8FC7" stroke="${O}" stroke-width="1.8"/><circle cx="63.5" cy="77.5" r="1.8" fill="#fff" opacity=".8"/>`,
  };
  const eyeOpen = `<circle cx="51" cy="66" r="4.6" fill="${O}"/><circle cx="69" cy="66" r="4.6" fill="${O}"/><circle cx="52.6" cy="64.4" r="1.5" fill="#fff"/><circle cx="70.6" cy="64.4" r="1.5" fill="#fff"/>`;
  const baseEyes = mood === 'love' ? `<g fill="#FF3D7F"><path d="M51 70 l-5-5 a3 3 0 0 1 5-3 a3 3 0 0 1 5 3z"/><path d="M69 70 l-5-5 a3 3 0 0 1 5-3 a3 3 0 0 1 5 3z"/></g>`
    : mood === 'wink' ? `<circle cx="51" cy="66" r="4.6" fill="${O}"/><circle cx="52.6" cy="64.4" r="1.5" fill="#fff"/><path d="M64 67 q5 -4 10 0" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : eyeOpen;
  const E = {
    nerd: `<g fill="rgba(255,255,255,.3)" stroke="${O}" stroke-width="2.6"><circle cx="51" cy="66" r="8"/><circle cx="69" cy="66" r="8"/></g><path d="M59 65 q1 -2 2 0" stroke="${O}" stroke-width="2.4" fill="none"/>`,
    shades: `<g fill="#1A1424"><rect x="40" y="60" width="18" height="11" rx="4"/><rect x="62" y="60" width="18" height="11" rx="4"/><rect x="56" y="62" width="8" height="3"/></g><path d="M43 63 h5M65 63 h5" stroke="#7FD6FF" stroke-width="2" stroke-linecap="round"/><path class="b-glint" d="M44 70 l5 -9 h3 l-5 9z" fill="#fff" opacity=".8"/>`,
    hearts: `<g class="b-pulse" fill="#FF3D7F" stroke="${O}" stroke-width="1.8" stroke-linejoin="round"><path d="M51 74 l-9 -8 a5 5 0 0 1 9 -5 a5 5 0 0 1 9 5z"/><path d="M69 74 l-9 -8 a5 5 0 0 1 9 -5 a5 5 0 0 1 9 5z"/></g><path d="M60 64 h0" stroke="${O}" stroke-width="2"/>`,
    monocle: `<circle cx="69" cy="66" r="8" fill="rgba(255,255,255,.25)" stroke="#E8A317" stroke-width="2.6"/><path d="M76 70 q6 12 2 24" stroke="#E8A317" stroke-width="1.5" fill="none" stroke-dasharray="2 1.5"/><path class="b-star" d="M73 61 l.8 -2.2 l.8 2.2 l2.2 .8 l-2.2 .8 l-.8 2.2 l-.8 -2.2 l-2.2 -.8z" fill="#fff"/>`,
  };
  const H = {
    grad: `<path d="M30 30 L60 18 L90 30 L60 42z" fill="#1A1424"/><path d="M44 35 v9 q16 8 32 0 v-9" fill="#2A2238"/><g class="b-swing" style="transform-origin:88px 31px"><path d="M88 31 v14" stroke="#F5B70A" stroke-width="2.5"/><circle cx="88" cy="47" r="3" fill="#F5B70A"/></g>`,
    party: `<path d="M60 0 L46 30 L74 30z" fill="#FF4F87" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="55" cy="22" r="2.5" fill="#fff"/><circle cx="64" cy="14" r="2.5" fill="#F5B70A"/><circle cx="60" cy="0" r="4.5" fill="#F5B70A" stroke="${O}" stroke-width="2"/><g class="b-confetti"><rect x="30" y="8" width="4" height="4" fill="#2BB0ED"/><rect x="86" y="4" width="4" height="4" fill="#16B377" style="animation-delay:.4s"/><rect x="40" y="-4" width="3" height="3" fill="#FF7A59" style="animation-delay:.8s"/><rect x="78" y="-6" width="3" height="3" fill="#8C5BFF" style="animation-delay:1.1s"/></g>`,
    cap: `<path d="M28 36 Q30 10 60 10 Q90 10 92 36z" fill="#2B6CFF" stroke="${O}" stroke-width="2.5"/><path d="M28 34 q-14 0 -20 6 q10 3 22 0z" fill="#1E4FC2" stroke="${O}" stroke-width="2.2"/><path d="M60 10 v-7" stroke="${O}" stroke-width="2.5"/><g class="b-prop"><ellipse cx="60" cy="2" rx="16" ry="3.5" fill="#FF4F87" stroke="${O}" stroke-width="2"/><ellipse cx="60" cy="2" rx="6" ry="3.5" fill="#F5B70A"/></g><circle cx="60" cy="3" r="2.5" fill="${O}"/><text x="66" y="30" font-size="12" font-weight="900" fill="#fff" font-family="Arial">B</text>`,
    ninja: `<path d="M18 52 Q60 40 102 52 L102 60 Q60 48 18 60z" fill="#E5333B" stroke="${O}" stroke-width="2.5"/><g class="b-flutter"><path d="M102 55 q10 2 14 10 M102 57 q8 8 8 16" stroke="#E5333B" stroke-width="4" fill="none" stroke-linecap="round"/></g>`,
    swiss: `<path d="M32 30 Q60 4 88 30z" fill="#7A5230" stroke="${O}" stroke-width="2.5"/><rect x="24" y="28" width="72" height="7" rx="3.5" fill="#5B3A1E" stroke="${O}" stroke-width="2"/><path d="M38 28 Q60 22 82 28" stroke="#E5333B" stroke-width="3" fill="none"/><g class="b-swing" style="transform-origin:78px 16px"><path d="M78 16 l8 -12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`,
    headphones: `<path d="M16 62 Q16 10 60 10 Q104 10 104 62" stroke="${O}" stroke-width="6" fill="none"/><path d="M16 62 Q16 10 60 10 Q104 10 104 62" stroke="#3A3550" stroke-width="3" fill="none"/><rect x="6" y="50" width="14" height="24" rx="6" fill="#FF4F87" stroke="${O}" stroke-width="2.5"/><rect x="100" y="50" width="14" height="24" rx="6" fill="#FF4F87" stroke="${O}" stroke-width="2.5"/><g class="b-notes" font-size="14" font-weight="900" fill="#8C5BFF"><text x="104" y="44">♪</text><text x="2" y="44" style="animation-delay:.9s">♫</text></g>`,
    wizard: `<path d="M60 -6 L36 32 L84 32z" fill="#5B3FD9" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="60" cy="32" rx="30" ry="5" fill="#4A2FC0" stroke="${O}" stroke-width="2"/><path class="b-star" d="M58 12 l2 -5 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3z" fill="#F5D90A"/>`,
    halo: `<ellipse class="b-halo" cx="60" cy="8" rx="22" ry="6" fill="none" stroke="#FFE27A" stroke-width="4"/>`,
    laurel: `<g class="b-star" style="animation-duration:3.2s">${(() => { let g = ''; for (const side of [-1, 1]) for (let i = 0; i < 7; i++) { const ang = (200 + i * 11) * Math.PI / 180, x = 60 + side * Math.cos(ang) * -48, y = 62 + Math.sin(ang) * 48, rot = side * (i * 11 - 60); g += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7" ry="3.4" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? '#F5C542' : '#FFD95A'}" stroke="#9A6A00" stroke-width="1.2"/>`; } return g; })()}</g><circle cx="60" cy="13" r="3.5" fill="#FF4F87" stroke="#9A6A00" stroke-width="1.2"/>`,
    crown: `<path d="M36 34 L36 12 L48 23 L60 6 L72 23 L84 12 L84 34z" fill="#F5B70A" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/><path d="M38 30 h44" stroke="#C98A00" stroke-width="2"/><circle cx="60" cy="24" r="3.5" fill="#FF4F87"/><circle cx="47" cy="28" r="2.5" fill="#2BB0ED"/><circle cx="73" cy="28" r="2.5" fill="#16B377"/><path class="b-star" d="M78 8 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1z" fill="#fff"/>`,
  };
  const X = {
    bowtie: `<g class="b-wiggle"><path d="M60 101 l-12 -7 v14z M60 101 l12 -7 v14z" fill="#E5333B" stroke="${O}" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="101" r="3.5" fill="#B5222A" stroke="${O}" stroke-width="1.5"/></g>`,
    chain: `<g class="b-swing" style="transform-origin:60px 90px"><path d="M38 90 Q60 110 82 90" stroke="#E8A317" stroke-width="3.5" fill="none" stroke-dasharray="3.5 1.5"/><circle cx="60" cy="103" r="6" fill="#FFC93C" stroke="#9A6A00" stroke-width="1.6"/><text x="60" y="106.5" font-size="8" font-weight="900" text-anchor="middle" fill="#9A6A00" font-family="Arial">B</text><path class="b-star" d="M66 98 l.8 -2.2 l.8 2.2 l2.2 .8 l-2.2 .8 l-.8 2.2 l-.8 -2.2 l-2.2 -.8z" fill="#fff"/></g>`,
    astro: `<circle cx="60" cy="62" r="55" fill="rgba(160,220,255,.16)" stroke="#BFE6FF" stroke-width="3"/><path class="b-glare" d="M28 30 q8 -14 22 -18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><g class="b-star" fill="#fff"><circle cx="16" cy="20" r="1.5"/><circle cx="106" cy="100" r="1.5"/></g>`,
  };
  const limbs = body ? `<g stroke="${O}" stroke-width="4.5" stroke-linecap="round" fill="none">
      <path d="M48 96 l-3 15"/><path d="M72 96 l3 15"/>
      <path d="M17 66 q-9 4 -11 13"/><g class="b-wave"><path d="M103 66 q10 -4 12 -15"/></g></g>
      <ellipse cx="41" cy="113" rx="8" ry="4.5" fill="#FF7A59" stroke="${O}" stroke-width="2.5"/>
      <ellipse cx="79" cy="113" rx="8" ry="4.5" fill="#FF7A59" stroke="${O}" stroke-width="2.5"/>
      <circle cx="6" cy="80" r="4.5" fill="#fff" stroke="${O}" stroke-width="2.5"/>
      <g class="b-wave"><circle cx="115" cy="50" r="4.5" fill="#fff" stroke="${O}" stroke-width="2.5"/></g>` : '';
  const sparkle = fx === 'stars' ? `<g class="b-star" fill="#fff"><circle cx="40" cy="44" r="1.6"/><circle cx="80" cy="40" r="1.3"/><circle cx="30" cy="70" r="1.2"/><circle cx="90" cy="72" r="1.6"/><circle cx="62" cy="30" r="1.1"/></g>`
    : fx === 'shine' ? `<path class="b-star" d="M34 40 l1.5 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5z" fill="#fff"/><path d="M48 30 q8 -6 18 -4" stroke="#FFF6CC" stroke-width="3" fill="none" stroke-linecap="round"/>` : '';
  const fxMore = fx === 'glow' ? `<g class="b-glow" fill="none" stroke="#FFD34D" stroke-width="3.4" stroke-linecap="round"><path d="M60 22 C55 32 65 40 60 50"/><path d="M32 44 q7 -7 14 0"/><path d="M74 44 q7 -7 14 0"/></g>`
    : fx === 'robot' ? `<path d="M60 19 v-12" stroke="${O}" stroke-width="3"/><circle class="b-led" cx="60" cy="5" r="4.5" fill="#00E0FF" stroke="${O}" stroke-width="2"/><g fill="#8A96A8"><circle cx="30" cy="52" r="1.6"/><circle cx="90" cy="52" r="1.6"/><circle cx="40" cy="88" r="1.6"/><circle cx="80" cy="88" r="1.6"/></g>`
    : fx === 'snow' ? `<g class="b-snow" fill="#fff" stroke="#9BDDF2" stroke-width=".6"><circle cx="20" cy="20" r="2"/><circle cx="96" cy="14" r="1.6" style="animation-delay:.8s"/><circle cx="108" cy="40" r="1.8" style="animation-delay:1.6s"/><circle cx="10" cy="44" r="1.4" style="animation-delay:2.2s"/></g>`
    : fx === 'drip' ? `<path d="M30 80 q2 6 0 10 q-2 -4 0 -10z" fill="#8FC261" stroke="${O}" stroke-width="1"/><ellipse class="b-drip" cx="30" cy="92" rx="2" ry="2.6" fill="#8FC261"/><path d="M70 30 l6 4 M72 28 l-1 7 M76 30 l-1 6" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/>`
    : '';
  if (defs) defs = defs.replace('</linearGradient>', '<animateTransform attributeName="gradientTransform" type="rotate" from="0 .5 .5" to="360 .5 .5" dur="6s" repeatCount="indefinite"/></linearGradient>');
  const vb = body ? '-6 -8 132 128' : fit === 'avatar' || hat || extra || fx === 'robot' ? '0 -8 120 120' : '8 12 104 96';
  return `<svg width="${size}" height="${size}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${defs || adefs ? `<defs>${defs}${adefs}</defs>` : ''}
    ${limbs}<g fill="${O}">${outer}</g><g fill="${fill}">${inner}</g>${under}
    <g fill="none" stroke="${fold}" stroke-width="3.4" stroke-linecap="round">
      <path d="M60 22 C55 32 65 40 60 50"/><path d="M32 44 q7 -7 14 0"/><path d="M74 44 q7 -7 14 0"/>
      <path d="M22 64 q5 4 10 0"/><path d="M88 64 q5 4 10 0"/></g>
    ${over}${sparkle}${fxMore}${H[hat] || A.hat[hat] || ''}
    <g class="b-eyes">${HIDE_EYES.includes(eyes) ? '' : baseEyes}</g>
    ${eyes === 'hearts' ? '' : `<ellipse cx="43" cy="74" rx="4.5" ry="2.6" fill="#FF7FA6"/><ellipse cx="77" cy="74" rx="4.5" ry="2.6" fill="#FF7FA6"/>`}
    ${M[mouth] || A.mouth[mouth] || mouths[mood] || mouths.happy}${E[eyes] || A.eyes[eyes] || ''}${X[extra] || A.extra[extra] || ''}</svg>`;
}

// ---------- Avatare (immer ein Gehirn) ----------
import { BRAIN_SKINS, SHOP_FRAMES, avatarFromSeed } from './data.js';
export function normAvatar(a) {
  if (!a) return avatarFromSeed('Brained');
  if (!a.skin) return { ...a, ...avatarFromSeed(a.seed || a.name || 'x') }; // alte DiceBear-Avatare → Gehirn
  if (a.title || /^em-/.test(a.mood || '')) { const { title, ...b } = a; return { ...b, mood: /^em-/.test(b.mood || '') ? 'happy' : b.mood }; } // entfernte Emotes/Titel
  return a;
}
// Skins sind nur die Farbe des Gehirns: Hut, Brille und Mund-Accessoires gehen mit JEDEM Skin (früher sperrten bezahlte Skins sie)
export const FIGURE_LOCKS = ['hat', 'eyes', 'mouth'];
export const figureSkin = () => false;
export const SKIN_HINT = 'Skins ersetzen Hut und Brille';
export function brainAvatarSVG(a, size) {
  a = normAvatar(a);
  const sk = BRAIN_SKINS.find(s => s.id === a.skin) || BRAIN_SKINS[0];
  return brainSVG({ size, fit: 'avatar', mood: a.mood || 'happy', fill: sk.fill, fold: sk.fold, outline: sk.outline, fx: sk.fx, anim: sk.anim, hat: a.hat, eyes: a.eyes, mouth: a.mouth, extra: a.extra });
}
export function avatar(a, size = 40) {
  a = normAvatar(a);
  const fr = a.frame && SHOP_FRAMES.some(f => f.id === a.frame) ? a.frame : '';
  const inner = fr ? Math.round(size * (size < 40 ? .84 : .88)) : size;
  const bgx = a.bgfx && BG_IDS.includes(a.bgfx) ? bgfxHTML(a.bgfx, inner) : '';
  const av = `<div class="av brain" style="width:${inner}px;height:${inner}px;background:#${/^[0-9a-f]{3,8}$/i.test(a.bg) ? a.bg : 'ffd5dc'}">${bgx}${brainAvatarSVG(a, Math.round(inner * .96))}</div>`;
  const body = fr ? `<div class="av-fr fr-${fr.slice(2)}" style="width:${size}px;height:${size}px">${av}</div>` : av;
  const aura = a.aura ? auraHTML(a.aura, size) : ''; // Aura (animiert) läuft hinter dem Avatar rund herum
  return aura ? `<div class="av-x" style="width:${size}px;height:${size}px">${aura}${body}</div>` : body;
}

// ---------- Charts ----------
export function ring(pct, { size = 64, stroke = 8, color = 'var(--brand)', track = 'var(--surface-2)', inner = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${track}" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" style="transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)"/>
    </svg><div style="position:absolute;inset:0;display:grid;place-items:center">${inner}</div></div>`;
}

export function donut(segments, { size = 132, stroke = 20, center = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = segments.map(s => {
    const len = (s.value / total) * c;
    const gap = segments.length > 1 ? Math.min(3, len / 3) : 0;
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-off}"/>`;
    off += len; return el;
  }).join('');
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>${arcs}</svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">${center}</div></div>`;
}

// Fokus-Linie: zeigt Fokus-Segmente vs. Pausen einer Session (unser "Strava-Map"-Ersatz)
export function focusLine(segments, start, end, color) {
  const span = Math.max(1, end - start);
  const bars = (segments && segments.length ? segments : [[start, end]]).map(([s, e]) =>
    `<i style="left:${((s - start) / span) * 100}%;width:${Math.max(.8, ((e - s) / span) * 100)}%;background:${color}"></i>`).join('');
  return `<div class="focusline">${bars}</div><div class="focusline-legend"><span>${fmtTime(start)}</span><span>Fokus-Verlauf</span><span>${fmtTime(end)}</span></div>`;
}

export function confetti(container, plain) {
  if (!plain && getEffect() !== 'e-confetti' && celebrate(getEffect(), container)) return; // ausgerüsteter Feier-Effekt (Shop), sonst Konfetti
  const colors = ['#FF4F87', '#FF7A59', '#F5B70A', '#16B377', '#6D5BFF', '#2BB0ED'];
  const wrap = document.createElement('div'); wrap.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    p.style.animationDelay = Math.random() * .5 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(p);
  }
  container.appendChild(wrap);
  setTimeout(() => wrap.remove(), 4200);
}

import { hapticNative } from './native.js';
export function haptic(ms = 12) { if (hapticNative(Array.isArray(ms) ? 60 : ms)) return; try { navigator.vibrate?.(ms); } catch { } }

// Andere Medien (Podcast, Musik, Bild-in-Bild-Video) pausieren, sobald eine Lernsession startet:
// ein kurzes stilles Audio übernimmt die Audio-Wiedergabe des Geräts (iOS: Audio-Session, Android: Audio-Fokus)
let silent;
export function pauseOtherMedia() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (!silent) {
      const n = 4000, b = new DataView(new ArrayBuffer(44 + n)), w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); b.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
      b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); w(36, 'data'); b.setUint32(40, n, true);
      for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
      silent = new Audio(URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' })));
      silent.setAttribute('playsinline', '');
    }
    silent.currentTime = 0; silent.play()?.catch?.(() => { });
  } catch { }
}

let audioCtx;
export function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * .12); g.gain.linearRampToValueAtTime(.18, t + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.001, t + i * .12 + .6);
      o.connect(g).connect(audioCtx.destination); o.start(t + i * .12); o.stop(t + i * .12 + .7);
    });
  } catch { }
}

/* ---- Emojis → Vektor-Icons ----
   Beim Rendern werden alle Emojis im sichtbaren Text durch Icons ersetzt (iconize). Ausnahmen: Fächer-Icons
   (KEEP_SEL) und Flaggen. Emojis ohne Icon fallen weg (im Fliesstext) oder werden zum neutralen Punkt (allein im Element). */
export const KEEP_SEL = '[data-keep-icon]';   // Fächer zeigen keine Emojis mehr (siehe subjIcon)
globalThis.__KEEP_SEL = KEEP_SEL;
const G = (p, c, fill) => ({ p, c, fill });
const GL = {
  flame: G('<path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4S9 11 11 11c0-4 1-9 1-9z"/>', '#FF8A3D', 1),
  heart: G('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>', '#A58BF6', 1),
  bolt: G('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', '#FFB020', 1),
  brain: G('<circle cx="8.5" cy="9" r="4"/><circle cx="15.5" cy="9" r="4"/><circle cx="7" cy="14.5" r="3.5"/><circle cx="17" cy="14.5" r="3.5"/><circle cx="12" cy="16" r="3.5"/>', '#A58BF6', 1),
  star: G('<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>', '#FFB020', 1),
  spark: G('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>', '#FFB020', 1),
  trophy: G('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>', '#E0A100'),
  medal: G('<circle cx="12" cy="14" r="6.5"/><path d="M8.5 8.5 6.5 2.5h4l1.5 4M15.5 8.5l2-6h-4L12 6.5"/>', '#E0A100'),
  crown: G('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', '#F5B70A', 1),
  gem: G('<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6"/>', '#3CC8F0'),
  gemo: G('<path d="M12 2l9 10-9 10L3 12z"/>', '#6FA8FF'),
  orb: G('<circle cx="12" cy="11" r="8"/><path d="M8 20h8M9 8a4 4 0 0 1 3-2"/>', '#A06BFF'),
  clock: G('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cal: G('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  book: G('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5V4.5M8 7h8"/>'),
  books: G('<path d="M4 3h4v18H4zM10 3h4v18h-4zM16.5 4.5l3.8-1 3.7 17-3.8 1z"/>'),
  doc: G('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>'),
  school: G('<path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6M12 4V2"/>'),
  cap: G('<path d="M22 9 12 4 2 9l10 5zM6 11.2V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8"/>'),
  flask: G('<path d="M9 2h6M10 2v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2M7.5 15h9"/>'),
  bag: G('<path d="M6 7h12l1 14H5zM9 7V6a3 3 0 0 1 6 0v1"/>'),
  gear: G('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  users: G('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
  globe: G('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>'),
  snow: G('<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>', '#4FB6F5'),
  coin: G('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>', '#E0A100'),
  flag: G('<path d="M5 21V3M5 4h13l-2.5 4L18 12H5"/>'),
  warn: G('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>', '#E8A100'),
  door: G('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  clip: G('<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>'),
  target: G('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
  phone: G('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
  ban: G('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  rocket: G('<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M12 15l-3-3a22 22 0 0 1 2-4 12 12 0 0 1 11-6c0 3-1 8-6 11a22 22 0 0 1-4 2zM9 12H4s.5-3 2-4c1.6-.9 5 0 5 0M12 15v5s3-.5 4-2c.9-1.6 0-5 0-5"/>'),
  thumb: G('<path d="M7 22V11l5-9a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7zM7 11H3v11h4"/>', '#FFB020'),
  face: G('<circle cx="12" cy="12" r="9"/><path d="M8 16s1.5-2 4-2 4 2 4 2M9 9.5h.01M15 9.5h.01"/>'),
  hearto: G('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>', '#B9B4C6'),
  mountain: G('<path d="M2 20 9 6l4 7 3-4 6 11z"/>'),
  mail: G('<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 6-10 7L2 6"/>'),
  pause: G('<path d="M8 5v14M16 5v14"/>'),
  leaf: G('<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15zM5 19l8-8"/>'),
  cup: G('<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M7 2v2M11 2v2M15 2v2"/>'),
  phones: G('<path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z"/>'),
  dot: G('<circle cx="12" cy="12" r="4"/>'),
  chart: G('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  pin: G('<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
};
const medalC = c => ({ ...GL.medal, c, fill: 1 });
const EM = {
  '🔥': 'flame', '❤': 'heart', '💕': 'heart', '💪': 'bolt', '⚡': 'bolt', '🧠': 'brain', '🤯': 'spark', '✨': 'spark', '⭐': 'star', '🌟': 'star', '🏅': 'star', '🌈': 'star',
  '👏': 'thumb', '👍': 'thumb', '🙌': 'thumb', '🏆': 'trophy', '👑': 'crown', '💎': 'gem', '💠': 'gemo', '🔮': 'orb',
  '🍅': 'clock', '⏱': 'clock', '⏰': 'clock', '⏳': 'clock', '📅': 'cal', '🗓': 'cal',
  '📖': 'book', '📚': 'books', '📝': 'doc', '📄': 'doc', '🎒': 'book', '🏫': 'school', '🎓': 'cap', '🔬': 'flask', '🧪': 'flask', '⚗': 'flask', '💼': 'bag', '🛍': 'bag',
  '🛠': 'gear', '⚙': 'gear', '👯': 'users', '🤝': 'users', '🌐': 'globe', '🌍': 'globe', '🧊': 'snow', '🪙': 'coin', '💰': 'coin',
  '🏁': 'flag', '🚩': 'flag', '⚠': 'warn', '🚪': 'door', '📎': 'clip', '🎯': 'target', '📱': 'phone', '🚫': 'ban', '🚀': 'rocket',
  '😔': 'face', '😰': 'face', '😊': 'face', '🤿': 'target', '🦉': 'star', '🎨': 'spark', '🏖': 'spark', '📊': 'chart', '📈': 'chart',
  '🥇': medalC('#E8B923'), '🥈': medalC('#A9B2BD'), '🥉': medalC('#C47A3F'),
  '🍕': 'dot', '🦁': 'dot', '⚽': 'dot', '🏔': 'mountain', '🗻': 'mountain', '🗺': 'pin',
  '🤍': 'hearto', '🦘': 'bolt', '🌋': 'flame', '💯': 'star', '🐦': 'star', '🛬': 'rocket', '🚆': 'rocket', '🙋': 'thumb', '🧑': 'cap', '🃏': 'doc', '🕹': 'target', '🏃': 'bolt', '🦸': 'bolt', '🌅': 'spark', '🎧': 'phones',
  '📩': 'mail', '📭': 'mail', '🕊': 'star', '🖼': 'doc', '📲': 'phone', '📵': 'phone', '⏸': 'pause', '💖': 'heart', '💡': 'spark', '📘': 'book', '📗': 'book', '📙': 'book', '📕': 'book', '🎉': 'spark',
  '☕': 'cup', '🌱': 'leaf', '🌊': 'spark', '🌌': 'star', '🌸': 'star', '🎆': 'spark', '❄': 'snow',
};
export function emojiIcon(ch) {
  const k = ch.replace(/️/g, ''); const g = typeof EM[k] === 'string' ? GL[EM[k]] : EM[k]; if (!g) return null;
  const st = g.fill ? `fill="currentColor" stroke="none"` : `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  return `<span class="ei" aria-hidden="true"${g.c ? ` style="color:${g.c}"` : ''}><svg viewBox="0 0 24 24" ${st}>${g.p}</svg></span>`;
}
const EMOJI_RE = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*|️/gu;
const isEmo = ch => /\p{Emoji_Presentation}|️|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ch) && !/^[✓✔✕✖★☆•·→←↑↓−–—©®™ℹ]️?$/u.test(ch);
export function iconize(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => !n.nodeValue || !/[©-㊙\u{1F000}-\u{1FFFF}]/u.test(n.nodeValue) || n.parentElement?.closest('script,style,textarea,svg,[data-emoji-ok]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    if (n.parentElement?.closest(KEEP_SEL)) continue;
    const s = n.nodeValue, parts = []; let last = 0, hit = false;
    for (const m of s.matchAll(EMOJI_RE)) {
      const ch = m[0]; if (/^\p{Regional_Indicator}{2}$/u.test(ch) || !isEmo(ch)) continue;
      hit = true; parts.push(s.slice(last, m.index)); last = m.index + ch.length;
      const ic = emojiIcon(ch); const alone = !s.replace(EMOJI_RE, '').trim();
      parts.push(ic ? { ic } : alone ? { ic: emojiIcon('🍕') } : '');
    }
    if (!hit) continue; parts.push(s.slice(last));
    const frag = document.createDocumentFragment();
    parts.forEach((p, i) => {
      if (typeof p === 'string') { let t = p; if (parts[i + 1] === '' || (i && parts[i - 1] === '' && !t.trim())) t = t.replace(/^ /, ''); if (t) frag.append(t.replace(/[  ]{2,}/g, ' ')); }
      else { const d = document.createElement('div'); d.innerHTML = p.ic; frag.append(d.firstChild); }
    });
    n.replaceWith(frag);
  }
}

// Fach-Symbol ohne Emoji: kleiner Farbpunkt (size 0) oder Initialen-Kachel in der Fachfarbe
export const subjInit = s => { const w = String(s.name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).replace(/^./, c => c.toUpperCase()); };
export const subjIcon = (s, size = 0) => size
  ? `<span class="stile" style="--c:${s.color};width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px">${esc(subjInit(s))}</span>`
  : `<i class="sdot" style="background:${s.color}"></i>`;
