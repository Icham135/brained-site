// Animierte Shop-Effekte: Auren rund ums Brain, animierte Hintergründe in der Avatar-Scheibe, Feier-Effekte (Session/Etappe/Streak).
// Alles reine CSS-Animationen (transform/opacity, Stile in css/shop.css), deterministische Partikel, keine Dauer-Repaints.
// Grösse steuert den Aufwand: ≥ 90 px alle Partikel, 52–89 px etwa die Hälfte, darunter nur ein ruhiger Schein bzw. Verlauf.
const r = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const f = (n, d = 2) => +n.toFixed(d);
const mode = size => size >= 72 ? 'full' : size >= 52 ? 'mid' : 'sm';
// n Partikel erzeugen (im Modus «mid» deutlich weniger, in «sm» keine)
const P = (n, m, fn) => { if (m === 'sm') return ''; const c = m === 'full' ? n : Math.max(4, Math.round(n * .55)); return Array.from({ length: c }, (_, i) => fn(i, c)).join(''); };
const sv = o => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');
const el = (cls, o = {}, inner = '', tag = 'i') => `<${tag} class="${cls}" style="${sv(o)}">${inner}</${tag}>`;
const ring = (i, n, rad, cx = 50, cy = 50, jit = 0) => { const a = (i / n) * Math.PI * 2 + r(i, 9) * jit; return [f(cx + rad * Math.cos(a)), f(cy + rad * Math.sin(a))]; };

/* ---------------------------------- Auren ---------------------------------- */
const AURA = {
  'a-fire': m => el('glow') + P(16, m, (i, n) => { const [x, y] = ring(i, n, 37, 50, 56, .4); return el('fl', { x: x + '%', y: y + '%', s: f(.2 + r(i, 1) * .18) + 'em', t: f(1.2 + r(i, 2) * .9) + 's', d: '-' + f(r(i, 3) * 2) + 's', rise: f(.38 + r(i, 4) * .36) + 'em' }); })
    + P(9, m, i => el('em', { x: f(18 + r(i, 5) * 64) + '%', y: f(35 + r(i, 6) * 40) + '%', t: f(1.6 + r(i, 7) * 1.4) + 's', d: '-' + f(r(i, 8) * 3) + 's', dx: f((r(i, 10) - .5) * .2) + 'em' })),
  'a-water': m => el('glow') + el('blob b1') + el('blob b2')
    + P(9, m, (i, n) => { const [x, y] = ring(i, n, 34, 50, 56, .6); return el('bb', { x: x + '%', y: y + '%', s: f(.05 + r(i, 1) * .06) + 'em', t: f(2.4 + r(i, 2) * 2) + 's', d: '-' + f(r(i, 3) * 4) + 's', dx: f((r(i, 4) - .5) * .12) + 'em' }); })
    + P(5, m, i => el('dr', { x: f(24 + r(i, 5) * 52) + '%', t: f(1.8 + r(i, 6) * 1.2) + 's', d: '-' + f(r(i, 7) * 3) + 's' })),
  'a-lightning': m => el('glow') + [[10, 22, -28], [86, 26, 24], [8, 66, -62], [90, 70, 58], [48, 4, 4], [52, 92, 180]].slice(0, m === 'full' ? 6 : m === 'mid' ? 4 : 0).map(([x, y, rot], i) =>
    `<svg class="bolt" viewBox="0 0 20 40" style="${sv({ x: x + '%', y: y + '%', rot: rot + 'deg', d: f(i * .55 + r(i, 2) * .4) + 's', t: f(2.4 + r(i, 3)) + 's' })}"><path d="M12 0 L3 22 H10 L5 40 L18 15 H11z" fill="#fff" stroke="#9BE4FF" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/></svg>`).join(''),
  'a-aurora': m => el('glow') + el('ab a1') + el('ab a2') + el('ab a3'),
  'a-snow': m => el('glow') + P(16, m, i => el('fk', { x: f(6 + r(i, 1) * 88) + '%', s: f(.03 + r(i, 2) * .045) + 'em', t: f(3 + r(i, 3) * 3) + 's', d: '-' + f(r(i, 4) * 6) + 's', dx: f((r(i, 5) - .5) * .2) + 'em' })),
  'a-sakura': m => el('glow') + P(11, m, i => el('pt', { x: f(8 + r(i, 1) * 84) + '%', s: f(.06 + r(i, 2) * .05) + 'em', t: f(3.4 + r(i, 3) * 3) + 's', d: '-' + f(r(i, 4) * 6) + 's', dx: f((r(i, 5) - .3) * .3) + 'em', rot: f(r(i, 6) * 360) + 'deg' })),
  'a-stardust': m => el('glow') + `<i class="orb">${P(10, m, (i, n) => { const [x, y] = ring(i, n, 43, 50, 50, .15); return el('st', { x: x + '%', y: y + '%', s: f(.06 + r(i, 1) * .07) + 'em', t: f(1.4 + r(i, 2) * 1.6) + 's', d: '-' + f(r(i, 3) * 3) + 's' }); })}</i>`
    + P(5, m, i => el('st fl2', { x: f(14 + r(i, 4) * 72) + '%', y: f(14 + r(i, 5) * 72) + '%', s: f(.04 + r(i, 6) * .04) + 'em', t: f(1.8 + r(i, 7) * 1.4) + 's', d: '-' + f(r(i, 8) * 3) + 's' })),
  'a-rainbow': m => el('glow') + el('rb rb1') + (m === 'sm' ? '' : el('rb rb2')),
  'a-ghost': m => el('glow') + P(6, m, (i, n) => { const [x] = ring(i, n, 34, 50, 50, 0); return el('wp', { x: f(16 + r(i, 1) * 68) + '%', y: f(52 + r(i, 2) * 30) + '%', s: f(.16 + r(i, 3) * .14) + 'em', t: f(3.2 + r(i, 4) * 2.4) + 's', d: '-' + f(r(i, 5) * 5) + 's', dx: f((r(i, 6) - .5) * .22) + 'em' }); }),
  'a-glitch': m => el('glow') + (m === 'sm' ? '' : el('gl g1') + el('gl g2')) + P(14, m, (i, n) => { const [x, y] = ring(i, n, 39, 50, 50, .6); return el('px p' + (i % 3), { x: x + '%', y: y + '%', s: f(.035 + r(i, 1) * .05) + 'em', t: f(.9 + r(i, 2) * 1.2) + 's', d: '-' + f(r(i, 3) * 2) + 's' }); }),
  'a-gold': m => el('glow') + el('rb gd') + P(9, m, (i, n) => { const [x, y] = ring(i, n, 40, 50, 50, .5); return el('st gs', { x: x + '%', y: y + '%', s: f(.06 + r(i, 1) * .07) + 'em', t: f(1.3 + r(i, 2) * 1.5) + 's', d: '-' + f(r(i, 3) * 3) + 's' }); }),
};
export const AURA_IDS = Object.keys(AURA);
export function auraHTML(id, size) {
  if (!AURA[id]) return '';
  const m = mode(size);
  return `<div class="fxa fxa-${id.slice(2)} ${m === 'sm' ? 'sm' : ''}" style="font-size:${size}px" aria-hidden="true">${AURA[id](m)}</div>`;
}

/* ------------------------------- Hintergründe ------------------------------- */
const BG = {
  'bg-stars': m => P(16, m, i => el('s', { x: f(r(i, 1) * 96) + '%', y: f(r(i, 2) * 90) + '%', s: f(.02 + r(i, 3) * .035) + 'em', t: f(1.4 + r(i, 4) * 2) + 's', d: '-' + f(r(i, 5) * 3) + 's' })) + (m === 'sm' ? '' : el('shoot')),
  'bg-rain': m => P(14, m, i => el('rn', { x: f(r(i, 1) * 100) + '%', h: f(.1 + r(i, 2) * .14) + 'em', t: f(.7 + r(i, 3) * .6) + 's', d: '-' + f(r(i, 4) * 1.4) + 's' })),
  'bg-snow': m => P(16, m, i => el('fk', { x: f(r(i, 1) * 100) + '%', s: f(.025 + r(i, 2) * .035) + 'em', t: f(3 + r(i, 3) * 3) + 's', d: '-' + f(r(i, 4) * 6) + 's', dx: f((r(i, 5) - .5) * .15) + 'em' })),
  'bg-sakura': m => P(9, m, i => el('pt', { x: f(r(i, 1) * 100) + '%', s: f(.05 + r(i, 2) * .04) + 'em', t: f(3.4 + r(i, 3) * 2.6) + 's', d: '-' + f(r(i, 4) * 6) + 's', dx: f((r(i, 5) - .3) * .3) + 'em', rot: f(r(i, 6) * 360) + 'deg' })),
  'bg-bubbles': m => P(9, m, i => el('bb', { x: f(r(i, 1) * 96) + '%', s: f(.05 + r(i, 2) * .09) + 'em', t: f(3 + r(i, 3) * 3) + 's', d: '-' + f(r(i, 4) * 6) + 's', dx: f((r(i, 5) - .5) * .12) + 'em' })),
  'bg-matrix': m => P(14, m, i => el('mx', { x: f(r(i, 1) * 96) + '%', h: f(.12 + r(i, 2) * .18) + 'em', t: f(1 + r(i, 3) * 1.4) + 's', d: '-' + f(r(i, 4) * 2) + 's' })),
  'bg-aurora': m => (m === 'sm' ? '' : el('ab a1') + el('ab a2') + el('ab a3')) + P(7, m, i => el('s', { x: f(r(i, 1) * 96) + '%', y: f(r(i, 2) * 50) + '%', s: f(.02 + r(i, 3) * .025) + 'em', t: f(1.6 + r(i, 4) * 2) + 's', d: '-' + f(r(i, 5) * 3) + 's' })),
  'bg-sunset': m => (m === 'sm' ? '' : el('sun')),
  'bg-dawn': () => '', 'bg-lagoon': () => '', 'bg-peach': () => '', 'bg-lilac': () => '',
  'bg-mintfog': m => (m === 'sm' ? '' : el('fog')),
};
export const BG_IDS = Object.keys(BG);
export const ANIM_BG = new Set(['bg-stars', 'bg-rain', 'bg-snow', 'bg-sakura', 'bg-bubbles', 'bg-matrix', 'bg-aurora', 'bg-sunset']);
export function bgfxHTML(id, size) {
  if (!BG[id]) return '';
  return `<div class="fxb fxb-${id.slice(3)}" style="font-size:${size}px" aria-hidden="true">${BG[id](mode(size))}</div>`;
}

/* ---------------------------- Feier-Effekte (Overlay) ---------------------------- */
let current = 'e-confetti';
export const setEffect = id => { current = EFFECTS[id] ? id : 'e-confetti'; };
export const getEffect = () => current;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const R = (a, b) => a + Math.random() * (b - a);
const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
const burst = (x, y, d, hue) => many(18, i => { const a = (i / 18) * Math.PI * 2 + R(-.1, .1), v = R(60, 120); return el('sp', { dx: f(Math.cos(a) * v) + 'px', dy: f(Math.sin(a) * v + 26) + 'px', d: f(d + .55) + 's', h: hue + R(-14, 14) }); });
const EFFECTS = {
  'e-fire': { ms: 3400, html: () => el('fgl') + many(30, i => el('fl', { x: f(2 + i * 3.3 + R(-1.5, 1.5)) + '%', s: f(R(36, 72)) + 'px', h: f(R(28, 66)) + 'vh', t: f(R(1.3, 2.1)) + 's', d: f(R(0, .9)) + 's' })) + many(26, () => el('em', { x: f(R(4, 96)) + '%', h: f(R(40, 85)) + 'vh', dx: f(R(-40, 40)) + 'px', t: f(R(1.6, 2.6)) + 's', d: f(R(0, 1.1)) + 's' })) },
  'e-wave': { ms: 4200, html: () => el('wv w2') + el('wv w1') + many(20, () => el('bb', { x: f(R(2, 98)) + '%', s: f(R(8, 22)) + 'px', h: f(R(40, 90)) + 'vh', t: f(R(1.6, 2.8)) + 's', d: f(R(.2, 1.4)) + 's', dx: f(R(-24, 24)) + 'px' })) },
  'e-fireworks': { ms: 4600, html: () => many(6, k => { const x = R(12, 88), y = R(14, 46), d = k * .55 + R(0, .25), hue = R(0, 360);
      return el('rk', { x: f(x) + '%', y: f(y) + 'vh', d: f(d) + 's' }) + el('bs', { x: f(x) + '%', y: f(y) + 'vh' }, burst(x, y, d, hue)); }) },
  'e-aurora': { ms: 4600, html: () => many(5, i => el('cu c' + (i % 3), { x: f(-6 + i * 24) + '%', w: f(R(34, 46)) + '%', t: f(R(3.6, 4.4)) + 's', d: f(i * .18) + 's' })) + many(18, () => el('s', { x: f(R(2, 98)) + '%', y: f(R(2, 45)) + '%', s: f(R(2, 4)) + 'px', t: f(R(1.2, 2.4)) + 's', d: f(R(0, 2)) + 's' })) },
  'e-gold': { ms: 4200, html: () => many(46, () => `<i class="cw" style="${sv({ x: f(R(2, 98)) + '%', s: f(R(16, 30)) + 'px', t: f(R(1.8, 3.2)) + 's', d: f(R(0, 1.2)) + 's' })}"><b style="${sv({ st: f(R(.5, 1.2)) + 's' })}"></b></i>`) },
  'e-snow': { ms: 4600, html: () => many(54, () => el('fk', { x: f(R(0, 100)) + '%', s: f(R(5, 11)) + 'px', t: f(R(2.6, 4.2)) + 's', d: f(R(0, 1.6)) + 's', dx: f(R(-40, 40)) + 'px' })) },
  'e-sakura': { ms: 4600, html: () => many(38, () => el('pt', { x: f(R(0, 100)) + '%', s: f(R(10, 18)) + 'px', t: f(R(2.8, 4.4)) + 's', d: f(R(0, 1.6)) + 's', dx: f(R(-30, 80)) + 'px', rot: f(R(0, 360)) + 'deg' })) },
};
export const EFFECT_IDS = ['e-confetti', ...Object.keys(EFFECTS)];
// Spielt einen Effekt ab. true = Overlay gestartet, false = Konfetti (Standard) bzw. reduzierte Bewegung → Aufrufer entscheidet
export function celebrate(id, host) {
  const e = EFFECTS[id]; if (!e || reduced()) return false;
  document.querySelectorAll('.fxc').forEach(n => n.remove()); // nie mehrere Effekte gleichzeitig
  const wrap = document.createElement('div'); wrap.className = 'fxc fxc-' + id.slice(2); wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = e.html();
  (document.body || host).appendChild(wrap);
  setTimeout(() => wrap.remove(), e.ms);
  return true;
}

// Animiert? (für das Etikett «✨ Animiert» im Shop)
export const isAnimated = it => !!it && (it.slot === 'aura' || it.slot === 'effect' || (it.slot === 'bgfx' && ANIM_BG.has(it.id))
  || !!it.fx || it.fill === 'rainbow' || (!it.slot && !it.fill && /^f-/.test(it.id || '') && it.id !== 'f-mint' && it.id !== 'f-sunset' && it.id !== 'f-gold' && it.id !== 'f-swiss')
  || ['wings', 'laser', 'vr', 'unicorn', 'flowers', 'starglass', 'medal', 'cape', 'scarf', 'beanie', 'bunny', 'tongue', 'g3d'].includes(it.id));
