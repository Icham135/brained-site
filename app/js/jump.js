// Brain Jump – Plattform-Spiel auf <canvas> (Doodle-Jump-Prinzip) mit Karten-Checkpoints.
// Ablauf: Brainy springt automatisch von Plattform zu Plattform. Steuerung: linke/rechte Bildschirmhälfte gedrückt halten
// (oder Pfeiltasten). Goldene Karten-Plattform erreicht → Spiel pausiert, «Karte n» wird eingeblendet, eigene Auswahl-Ebene:
// Frage oben, drei Antwort-Plattformen. Antippen = Brainy springt hin. Richtig → Raketen-Boost, falsch → Plattform bricht (−1 ❤️).
import { brainSVG } from './ui.js';
import { t } from './i18n.js';

const GRAV = 2250, JUMP = -980, SPRING = -1500, ROCKET = -1650;
const PW = 70, PH = 15, BW = 46, BH = 42;           // Plattform / Brainy
const CHECK_EVERY = 1700;                            // Höhe zwischen Karten-Plattformen (px ≈ 170 m)
const PICK_TIME = 12;                                // Sekunden pro Karte
const FONT = () => (getComputedStyle(document.documentElement).getPropertyValue('--font') || 'system-ui, sans-serif').trim();

// Stages nach Höhe (Meter): eigener Himmel, eigene Plattformen, Deko. Ab dem Mond fliegen Asteroiden.
const STAGES = [
  { m: 0, name: 'Wiese', top: [150, 205, 255], bot: [228, 243, 255], plat: ['#8CE99A', '#51CF66', '#2F9E44'], deco: 'hills' },
  { m: 150, name: 'Wolkenmeer', top: [255, 178, 150], bot: [255, 228, 196], plat: ['#FFFFFF', '#E7ECF5', '#B9C3D6'], deco: 'clouds' },
  { m: 400, name: 'Stratosphäre', top: [36, 52, 130], bot: [110, 120, 210], plat: ['#A5D8FF', '#74C0FC', '#339AF0'], deco: 'aurora' },
  { m: 750, name: 'Erdorbit', top: [8, 10, 30], bot: [20, 40, 90], plat: ['#DEE2E6', '#ADB5BD', '#6C757D'], deco: 'earth' },
  { m: 1150, name: 'Mond', top: [12, 12, 24], bot: [40, 40, 58], plat: ['#CED4DA', '#A0A7B0', '#6F757D'], deco: 'moon', rocks: .1 },
  { m: 1650, name: 'Mars', top: [40, 12, 10], bot: [130, 48, 26], plat: ['#FFA07A', '#E8590C', '#A23E0A'], deco: 'mars', rocks: .14 },
  { m: 2300, name: 'Saturn', top: [22, 16, 40], bot: [92, 70, 40], plat: ['#FFE8A3', '#F2C14E', '#B9862D'], deco: 'saturn', rocks: .17 },
  { m: 3100, name: 'Nebel', top: [30, 6, 50], bot: [90, 20, 110], plat: ['#E599F7', '#BE4BDB', '#862E9C'], deco: 'nebula', rocks: .2 },
  { m: 4200, name: 'Schwarzes Loch', top: [0, 0, 0], bot: [18, 6, 30], plat: ['#B197FC', '#7048E8', '#4B2BB5'], deco: 'hole', rocks: .24 },
];
const stageAt = m => { let i = 0; for (let k = 0; k < STAGES.length; k++) if (m >= STAGES[k].m) i = k; return i; };

const sprites = {};
function sprite(mood) {
  if (sprites[mood]) return sprites[mood];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(brainSVG({ size: 96, mood }));
  return (sprites[mood] = img);
}
const ease = x => 1 - Math.pow(1 - x, 3);
let safeT = null;
const safeTop = () => { if (safeT === null) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top);visibility:hidden'; document.body.appendChild(d); safeT = parseFloat(getComputedStyle(d).paddingTop) || 0; d.remove(); } return safeT; };

export function createJump({ canvas, pickQuestion, onEvent }) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const font = FONT();
  let W = 360, H = 560;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(280, r.width); H = Math.max(420, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  ['jump', 'grin', 'love', 'wow', 'think'].forEach(sprite);

  const S = {
    mode: 'ready', modeT: 0,
    p: { x: W / 2 - BW / 2, y: H - 60 - BH, vx: 0, vy: JUMP, face: 1, mood: 'grin', moodT: 0, rocket: 0, safe: 0 },
    cam: 0, plats: [], stars: [], parts: [], floats: [], trail: [], rocks: [], stage: 0, banner: null,
    score: 0, height: 0, lives: 3, combo: 0, correct: 0, wrong: 0, cardNo: 0,
    quiz: null, pick: null, pickLeft: PICK_TIME, fade: 0, checkpoint: null,
    dir: 0, keys: { l: false, r: false }, shake: 0, t: 0, over: false, paused: false,
  };
  // ---------- Welt erzeugen ----------
  let genY = H - 60, nextCheck = H - 60 - CHECK_EVERY;
  S.plats.push({ x: 0, y: H - 60, w: W, type: 'ground' });
  function genUntil(limit) {
    while (genY > limit) {
      const h = (H - 60) - genY, diff = Math.min(1, h / 36000), st = stageAt(h / 10);
      if (genY - 200 <= nextCheck) {                               // Karten-Plattform
        genY = nextCheck;
        S.plats.push({ x: W / 2 - 75, y: genY, w: 150, type: 'card' });
        nextCheck -= CHECK_EVERY;
        genY -= 90; S.plats.push({ x: Math.random() * (W - PW), y: genY, w: PW, type: 'n', st });
        continue;
      }
      genY -= 64 + Math.random() * (60 + 76 * diff);               // Lücken wachsen bis ~200 px (Sprunghöhe ~213 px)
      const roll = Math.random(), w = Math.max(52, PW - diff * 18);
      const type = h > 1100 && roll < .14 + diff * .4 ? 'm' : 'n';
      const pl = { x: Math.random() * (W - w), y: genY, w, type, st, vx: type === 'm' ? (Math.random() < .5 ? -1 : 1) * (50 + diff * 150) : 0 };
      if (type === 'n' && h > 400 && Math.random() < .07 - diff * .04) pl.spring = true;
      S.plats.push(pl);
      if (h > 700 && Math.random() < .2 + diff * .3) S.plats.push({ x: Math.random() * (W - PW), y: genY - 28 - Math.random() * 22, w: PW, type: 'b', st });
      if (Math.random() < .14) S.stars.push({ x: 20 + Math.random() * (W - 40), y: genY - 40 - Math.random() * 30 });
      const rk = STAGES[st].rocks || 0;
      if (rk && Math.random() < rk * .5) S.rocks.push({ x: Math.random() < .5 ? -30 : W + 30, y: genY - 60, vx: (Math.random() < .5 ? 1 : -1) * (60 + diff * 120 + Math.random() * 40), r: 13 + Math.random() * 9, rot: Math.random() * 6 });
    }
  }
  genUntil(-H * 2);

  // ---------- Eingabe: linke/rechte Hälfte halten · Antworten antippen ----------
  const pointers = new Map();
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const updDir = () => { const last = [...pointers.values()].at(-1); S.dir = last ? (last.x < W / 2 ? -1 : 1) : 0; };
  const down = e => {
    e.preventDefault?.();
    const pt = local(e);
    if (S.mode === 'ready') { setMode('climb'); onEvent?.('start'); }
    if (S.mode === 'pick') { tapAnswer(pt); return; }
    if (S.mode === 'climb') { pointers.set(e.pointerId, pt); updDir(); }
  };
  const move = e => { if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, local(e)); updDir(); } };
  const up = e => { pointers.delete(e.pointerId); updDir(); };
  const key = (e, v) => {
    if (e.key === 'ArrowLeft') S.keys.l = v; if (e.key === 'ArrowRight') S.keys.r = v;
    if (v && S.mode === 'ready' && /Arrow|Space| /.test(e.key)) setMode('climb');
    if (v && S.mode === 'pick' && /^[1-3abcABC]$/.test(e.key)) choose(S.quiz.opts['1aA2bB3cC'.indexOf(e.key) / 3 | 0]);
  };
  const kd = e => key(e, true), ku = e => key(e, false);
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize);

  // ---------- Effekte ----------
  function burst(x, y, colors, n = 14, speed = 260) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (.4 + Math.random() * .8); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: .7 + Math.random() * .4, c: colors[i % colors.length], r: 2 + Math.random() * 3 }); }
  }
  const float = (x, y, text, c = '#16131F', big = false) => S.floats.push({ x, y, text, c, life: 1.2, big });
  const mood = (m, tt = .6) => { S.p.mood = m; S.p.moodT = tt; };
  function setMode(m) { S.mode = m; S.modeT = 0; pointers.clear(); S.dir = 0; }

  // ---------- Karten-Checkpoint ----------
  function startCard(pl) {
    S.checkpoint = pl; pl.used = true; S.cardNo++;
    const q = pickQuestion();
    // Antwort-Plattformen der Auswahl-Ebene (gestaffelt, gut antippbar)
    const top = Math.max(232 + safeTop(), H * .38), gap = Math.min(84, (H - 136 - top) / 3), ph = Math.max(42, Math.min(54, gap - 8));
    q.opts = q.opts.map((label, i) => ({ label, ok: label === q.answer, x: 24 + (i % 2 ? 20 : 0), y: top + i * gap, w: W - 68, h: ph, state: '' }));
    S.quiz = q; S.pickLeft = PICK_TIME; S.pick = null;
    S.p.vx = 0; S.p.vy = 0; S.p.y = pl.y - BH;
    setMode('intro'); mood('think', 9); onEvent?.('card', { q, n: S.cardNo });
  }
  function tapAnswer(pt) {
    const o = S.quiz?.opts.find(o => pt.x >= o.x - 6 && pt.x <= o.x + o.w + 6 && pt.y >= o.y - 8 && pt.y <= o.y + o.h + 8);
    if (o) choose(o);
  }
  function choose(o) {
    if (S.mode !== 'pick' || !o) return;
    S.pick = { o, x0: S.qp.x, y0: S.qp.y, x1: o.x + o.w / 2 - BW / 2, y1: o.y - BH };
    o.state = 'sel'; setMode('jumpTo'); mood('jump', 2); onEvent?.('choose');
  }
  function resolveCard() {
    const q = S.quiz, o = S.pick?.o;
    if (o?.ok) {
      o.state = 'ok'; S.combo++; S.correct++;
      const bonus = 150 + Math.min(450, (S.combo - 1) * 75);
      S.score += bonus; float(o.x + o.w / 2, o.y - 26, `${t('Richtig!')} +${bonus}`, '#12B886', true);
      burst(o.x + o.w / 2, o.y, ['#20C997', '#FFD43B', '#FF4F87', '#7C6CFF', '#fff'], 46, 420);
      mood('love', 2); setMode('resultOk'); onEvent?.('correct', { q });
    } else {
      if (o) o.state = 'no';
      q.opts.find(x => x.ok).state = 'show';
      S.combo = 0; S.wrong++; S.lives--; S.shake = .4;
      if (o) burst(o.x + o.w / 2, o.y, ['#E5484D', '#FFB3B3', '#8A5A2B'], 22, 280);
      S.qp.vy = 80; mood('wow', 3); setMode('resultNo'); onEvent?.('wrong', { q, timeout: !o });
    }
  }
  function backToClimb(ok) {
    const p = S.p, cp = S.checkpoint;
    p.x = cp.x + cp.w / 2 - BW / 2; p.y = cp.y - BH; p.vx = 0;
    if (ok) { p.rocket = 1.25; p.vy = ROCKET; p.safe = 1.6; float(p.x + BW / 2, p.y - 10, t('Boost!'), '#FF8A3D', true); }
    else { p.vy = JUMP; p.safe = 1; }
    S.quiz = null; S.pick = null; S.fade = 1; setMode('climb'); mood(ok ? 'love' : 'grin', 1);
  }

  // ---------- Update ----------
  function update(dt) {
    S.t += dt; S.modeT += dt;
    if (S.fade > 0) S.fade = Math.max(0, S.fade - dt * 2.4);
    const p = S.p;
    if (S.mode === 'ready') {                                       // vor dem Start: Brainy hüpft auf dem Boden
      p.vy += GRAV * dt; p.y += p.vy * dt;
      if (p.y + BH >= H - 60) { p.y = H - 60 - BH; p.vy = -620; }
    } else if (S.mode === 'climb') climb(dt);
    else if (S.mode === 'intro') { if (S.modeT > 1.25) { setMode('pick'); S.qp = { x: W / 2 - BW / 2, y: H - 64 - BH, vy: 0 }; } }
    else if (S.mode === 'pick') {
      S.pickLeft -= dt;
      S.qp.y = H - 64 - BH - Math.abs(Math.sin(S.t * 5)) * 10;     // wippt ungeduldig
      if (S.pickLeft <= 0) { S.pickLeft = 0; S.pick = null; float(W / 2, H - 140, t('Zeit um!'), '#E5484D', true); resolveCard(); }
    } else if (S.mode === 'jumpTo') {
      const k = Math.min(1, S.modeT / .55), pk = S.pick;
      S.qp.x = pk.x0 + (pk.x1 - pk.x0) * ease(k);
      S.qp.y = pk.y0 + (pk.y1 - pk.y0) * k - Math.sin(k * Math.PI) * 120;
      if (k >= 1) { S.qp.y = pk.y1; resolveCard(); }
    } else if (S.mode === 'resultOk') { S.qp.y = S.pick.y1 - Math.sin(Math.min(1, S.modeT * 3) * Math.PI) * 18; if (S.modeT > 1.05) backToClimb(true); }
    else if (S.mode === 'resultNo') {
      S.qp.vy += GRAV * .7 * dt; S.qp.y += S.qp.vy * dt;
      if (S.modeT > 1.7) { if (S.lives <= 0) return end(); backToClimb(false); }
    }
    for (const q of S.parts) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    S.parts = S.parts.filter(q => q.life > 0);
    for (const f of S.floats) { f.y -= 46 * dt; f.life -= dt * .85; }
    S.floats = S.floats.filter(f => f.life > 0);
    for (const tr of S.trail) tr.life -= dt * 2.2;
    S.trail = S.trail.filter(tr => tr.life > 0);
    if (p.moodT > 0) { p.moodT -= dt; if (p.moodT <= 0) p.mood = 'grin'; }
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
  }
  function climb(dt) {
    const p = S.p;
    let ax = S.dir; if (S.keys.l) ax = -1; if (S.keys.r) ax = 1;
    p.vx += (ax * 420 - p.vx) * Math.min(1, dt * (ax ? 8 : 5));
    if (Math.abs(p.vx) > 30) p.face = p.vx > 0 ? 1 : -1;
    p.x += p.vx * dt;
    if (p.x > W - BW / 2) p.x = -BW / 2; if (p.x < -BW / 2) p.x = W - BW / 2;   // durch den Rand auf die andere Seite
    const prevBottom = p.y + BH;
    if (p.rocket > 0) { p.rocket -= dt; p.vy = ROCKET; S.trail.push({ x: p.x + BW / 2 + (Math.random() - .5) * 12, y: p.y + BH, life: 1 }); }
    else p.vy += GRAV * dt;
    p.y += p.vy * dt;
    if (p.safe > 0) p.safe -= dt;
    for (const pl of S.plats) if (pl.type === 'm') { pl.x += pl.vx * dt; if (pl.x < 0 || pl.x + pl.w > W) { pl.vx *= -1; pl.x = Math.max(0, Math.min(W - pl.w, pl.x)); } }
    // Landung (nur beim Fallen)
    if (p.vy > 0 && p.rocket <= 0) {
      for (const pl of S.plats) {
        if (pl.gone) continue;
        const top = pl.y;
        if (prevBottom <= top + 3 && p.y + BH >= top && p.x + BW - 9 > pl.x && p.x + 9 < pl.x + pl.w) {
          if (pl.type === 'b') { pl.gone = true; pl.fall = 0; burst(pl.x + pl.w / 2, top, ['#B98552', '#8A5A2B'], 10); onEvent?.('crack'); continue; }
          p.y = top - BH;
          if (pl.type === 'card' && !pl.used) { burst(pl.x + pl.w / 2, top, ['#FFD43B', '#FFF3BF', '#fff'], 24, 260); startCard(pl); return; }
          p.vy = pl.spring ? SPRING : JUMP;
          if (pl.spring) { pl.sprung = .25; mood('wow', .5); float(p.x + BW / 2, p.y, t('Boing!'), '#FF8A3D'); onEvent?.('spring'); }
          else onEvent?.('bounce');
          pl.squish = .18;
          burst(p.x + BW / 2, top, ['#ffffff', '#E9FBEF'], 5, 110);
          break;
        }
      }
    }
    // Sterne
    for (const s of S.stars) if (!s.got && Math.abs(s.x - (p.x + BW / 2)) < 28 && Math.abs(s.y - (p.y + BH / 2)) < 32) { s.got = true; S.score += 25; float(s.x, s.y, '+25', '#E0A100'); burst(s.x, s.y, ['#FFD43B', '#FFF3BF'], 10, 180); onEvent?.('star'); }
    // Asteroiden: kosten ein Leben (ausser im Boost / kurz nach einem Treffer)
    for (const r of S.rocks) {
      r.x += r.vx * dt; r.rot += dt * 2;
      if (r.x < -60) r.x = W + 50; if (r.x > W + 60) r.x = -50;
      if (!r.hit && p.safe <= 0 && p.rocket <= 0 && Math.hypot(r.x - (p.x + BW / 2), r.y - (p.y + BH / 2)) < r.r + 18) {
        r.hit = true; S.lives--; S.combo = 0; S.shake = .45; p.safe = 1.5; p.vy = Math.max(p.vy, 200);
        burst(r.x, r.y, ['#868E96', '#FFD43B', '#FF6B6B'], 20, 260); float(p.x + BW / 2, p.y - 10, t('Autsch! −1 ❤️'), '#E5484D', true); mood('wow', 1); onEvent?.('hit');
        if (S.lives <= 0) return end();
      }
    }
    S.rocks = S.rocks.filter(r => !r.hit && r.y < S.cam + H + 100);
    const stNow = stageAt(S.height);
    if (stNow > S.stage) { S.stage = stNow; S.banner = { text: `${t('Stage')} ${stNow + 1} · ${t(STAGES[stNow].name)}`, life: 2.4 }; S.score += 250 * stNow; onEvent?.('stage', { n: stNow }); }
    if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }
    // Kamera folgt nach oben (weich)
    const camTarget = p.y - H * .42;
    if (camTarget < S.cam) S.cam += (camTarget - S.cam) * Math.min(1, dt * (p.rocket > 0 ? 14 : 10));
    const h = Math.max(0, Math.round((H - 60 - BH - p.y) / 10));
    if (h > S.height) { S.score += h - S.height; S.height = h; }
    genUntil(S.cam - H);
    S.plats = S.plats.filter(pl => pl.y < S.cam + H + 160);
    S.stars = S.stars.filter(s => s.y < S.cam + H + 60 && !s.got);
    for (const pl of S.plats) { if (pl.gone) { pl.fall += dt; pl.y += 420 * dt * pl.fall * 3; } if (pl.sprung) pl.sprung = Math.max(0, pl.sprung - dt); if (pl.squish) pl.squish = Math.max(0, pl.squish - dt); }
    // runtergefallen → Leben weg, Rettungs-Sprung
    if (p.y > S.cam + H + 30) {
      S.lives--; S.combo = 0; S.shake = .4; onEvent?.('fall');
      if (S.lives <= 0) return end();
      p.y = S.cam + H - BH - 10; p.vy = SPRING * 1.05; p.safe = 1.2; mood('wow', 1);
      float(W / 2, S.cam + H * .6, t('Gerettet! −1 ❤️'), '#E5484D', true);
    }
  }

  // ---------- Zeichnen ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrapText(text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    for (const w of words) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
    const y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  }
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  function sky() {
    const m = S.height, i = stageAt(m), a = STAGES[i], b = STAGES[i + 1];
    const k = b ? Math.max(0, Math.min(1, (m - (b.m - 70)) / 70)) : 0;  // weicher Übergang in den letzten 70 m
    return [b ? mix(a.top, b.top, k) : a.top, b ? mix(a.bot, b.bot, k) : a.bot, i >= 2 ? Math.min(1, (i - 1) * .5) : 0, i, k];
  }
  function drawDeco(i) {
    const d = STAGES[i].deco, rel = (S.height - STAGES[i].m) * 10;        // px seit Stage-Beginn
    const py = (base, f = .12) => base + rel * f;                          // langsamer Parallax
    ctx.save();
    if (d === 'aurora') { for (let j = 0; j < 3; j++) { const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(99,230,190,0)'); g.addColorStop(.5, `rgba(${j ? '151,117,250' : '99,230,190'},.22)`); g.addColorStop(1, 'rgba(99,230,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H * .3 + j * 40); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * .3 + j * 40 + Math.sin(x / 60 + S.t + j) * 18); ctx.lineTo(W, H * .3 + j * 40 + 60); ctx.lineTo(0, H * .3 + j * 40 + 60); ctx.fill(); } }
    if (d === 'earth') { const y = py(H + 120, .05); const g = ctx.createRadialGradient(W / 2, y + 380, 300, W / 2, y + 380, 470); g.addColorStop(0, '#1C7ED6'); g.addColorStop(.9, '#4DABF7'); g.addColorStop(1, 'rgba(165,216,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, y + 380, 470, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(81,207,102,.5)'; ctx.beginPath(); ctx.ellipse(W * .3, y - 40, 60, 22, -.2, 0, Math.PI * 2); ctx.fill(); }
    if (d === 'moon') { const y = py(H * .28); ctx.fillStyle = '#E9ECEF'; ctx.beginPath(); ctx.arc(W * .74, y, 70, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(134,142,150,.45)'; [[-20, -14, 14], [18, 12, 10], [-6, 28, 8], [26, -24, 7]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(W * .74 + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }); }
    if (d === 'mars') { const y = py(H * .3); const g = ctx.createRadialGradient(W * .25 - 20, y - 20, 10, W * .25, y, 80); g.addColorStop(0, '#FF8A5B'); g.addColorStop(1, '#A23E0A'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .25, y, 80, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(W * .25, y + 10, 58, .3, 2.4); ctx.stroke(); }
    if (d === 'saturn') { const x = W * .7, y = py(H * .32); ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.arc(x, y, 58, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,232,163,.85)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(x, y, 112, 26, -.35, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = 'rgba(185,134,45,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 96, 21, -.35, 0, Math.PI * 2); ctx.stroke(); }
    if (d === 'nebula') { [[.25, .3, '230,73,128'], [.75, .55, '132,94,247'], [.45, .8, '51,154,240']].forEach(([fx, fy, c], j) => { const g = ctx.createRadialGradient(W * fx, py(H * fy, .06), 0, W * fx, py(H * fy, .06), 170); g.addColorStop(0, `rgba(${c},.35)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }); }
    if (d === 'hole') { const x = W / 2, y = py(H * .35, .04); ctx.translate(x, y); ctx.rotate(S.t * .4); for (let j = 0; j < 4; j++) { ctx.strokeStyle = `rgba(${j % 2 ? '255,146,43' : '255,212,59'},${.5 - j * .1})`; ctx.lineWidth = 9 - j * 2; ctx.beginPath(); ctx.ellipse(0, 0, 120 + j * 14, 34 + j * 5, 0, 0, Math.PI * 2); ctx.stroke(); } ctx.rotate(-S.t * .4); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  function drawBrainy(x, y, face, vy, alpha = 1) {
    const p = S.p, img = sprite(p.mood);
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x + BW / 2, y + BH / 2);
    const st = vy < -700 ? 1.1 : vy > 650 ? .93 : 1;
    ctx.rotate(Math.max(-.18, Math.min(.18, p.vx / 2400)));
    ctx.scale(face * (2 - st), st);
    if (img.complete) ctx.drawImage(img, -BW / 2 - 7, -BH / 2 - 9, BW + 14, BH + 16);
    ctx.restore();
  }
  function drawPlatform(pl) {
    ctx.save();
    if (pl.gone) { ctx.globalAlpha = Math.max(0, 1 - (pl.fall || 0) * 1.6); ctx.translate(pl.x + pl.w / 2, pl.y); ctx.rotate((pl.fall || 0) * 1.2); ctx.translate(-pl.x - pl.w / 2, -pl.y); }
    const sq = pl.squish ? Math.sin(pl.squish / .18 * Math.PI) * 3 : 0;
    if (pl.type === 'ground') {
      ctx.fillStyle = '#51CF66'; rr(-10, pl.y, W + 20, 40, 14); ctx.fill();
      ctx.fillStyle = '#2F9E44'; ctx.fillRect(-10, pl.y + 12, W + 20, 400);
    } else if (pl.type === 'card') {
      const glow = pl.used ? 0 : .5 + Math.sin(S.t * 4) * .5;
      ctx.shadowColor = `rgba(255,190,0,${.35 + glow * .4})`; ctx.shadowBlur = 18 + glow * 10;
      const g = ctx.createLinearGradient(0, pl.y, 0, pl.y + 20); g.addColorStop(0, pl.used ? '#E9ECEF' : '#FFE066'); g.addColorStop(1, pl.used ? '#ADB5BD' : '#FAB005');
      ctx.fillStyle = g; rr(pl.x, pl.y + sq, pl.w, 20, 10); ctx.fill(); ctx.shadowColor = 'transparent';
      if (!pl.used) {                                                    // Schild «Karte n»
        const sy = pl.y - 46 + Math.sin(S.t * 3) * 3;
        ctx.fillStyle = '#16131F'; rr(pl.x + pl.w / 2 - 58, sy, 116, 30, 15); ctx.fill();
        ctx.fillStyle = '#FFD43B'; ctx.font = `800 13px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`🃏 ${t('Karte')} ${S.cardNo + 1}`, pl.x + pl.w / 2, sy + 15.5);
      }
    } else {
      const col = pl.type === 'm' ? ['#74C0FC', '#339AF0', '#1C7ED6'] : pl.type === 'b' ? ['#D8A878', '#B07D4F', '#8A5A2B'] : STAGES[pl.st || 0].plat;
      ctx.fillStyle = 'rgba(30,20,60,.12)'; rr(pl.x + 3, pl.y + 7 + sq, pl.w - 2, PH, 8); ctx.fill();
      ctx.fillStyle = col[2]; rr(pl.x, pl.y + 3 + sq, pl.w, PH, 8); ctx.fill();
      const g = ctx.createLinearGradient(0, pl.y + sq, 0, pl.y + PH + sq); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; rr(pl.x, pl.y + sq, pl.w, PH - 2, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(pl.x + 6, pl.y + 2 + sq, pl.w - 12, 3, 2); ctx.fill();
      if (pl.type === 'b') { ctx.strokeStyle = '#6B4420'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pl.x + pl.w * .38, pl.y + 1); ctx.lineTo(pl.x + pl.w * .48, pl.y + 7); ctx.lineTo(pl.x + pl.w * .42, pl.y + 13); ctx.stroke(); }
      if (pl.type === 'm') { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `800 9px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('◂ ▸', pl.x + pl.w / 2, pl.y + 8 + sq); }
      if (pl.spring) { const sh = pl.sprung ? 15 : 8; ctx.fillStyle = '#ADB5BD'; for (let i = 0; i < 3; i++) ctx.fillRect(pl.x + pl.w / 2 - 7, pl.y - sh + i * sh / 3, 14, 2); ctx.fillStyle = '#FF6B6B'; rr(pl.x + pl.w / 2 - 11, pl.y - sh - 4, 22, 5, 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function drawWorld() {
    const [c1, c2, night, si, sk] = sky();
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${c1})`); g.addColorStop(1, `rgb(${c2})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (si >= 2) { ctx.globalAlpha = 1 - sk; drawDeco(si); ctx.globalAlpha = 1; }
    if (night > 0) { for (let i = 0; i < 46; i++) { const sx = (i * 97) % W, sy = ((i * 53 - S.cam * .15) % H + H) % H; ctx.globalAlpha = night * (.5 + .5 * Math.sin(S.t * 2 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, 2, 2); } ctx.globalAlpha = 1; }
    // Hügel (Parallax, nur am Anfang sichtbar)
    const hy = H - 40 - S.cam * .25;
    if (hy < H + 200) {
      ctx.fillStyle = 'rgba(105,219,124,.45)'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hy - 60 - Math.sin(x / 70) * 26); ctx.lineTo(W, H); ctx.fill();
    }
    ctx.fillStyle = `rgba(255,255,255,${.6 * Math.max(0, 1 - night * 2)})`;
    if (si < 3) for (let i = 0; i < 6; i++) { const cx = ((i * 131 + S.t * 9) % (W + 140)) - 70, cy = ((i * 170 - S.cam * .3) % (H + 100) + H + 100) % (H + 100) - 50; ctx.beginPath(); ctx.ellipse(cx, cy, 40, 14, 0, 0, Math.PI * 2); ctx.ellipse(cx + 22, cy - 8, 25, 13, 0, 0, Math.PI * 2); ctx.ellipse(cx - 20, cy - 4, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - .5) * 12 * S.shake, (Math.random() - .5) * 12 * S.shake);
    ctx.translate(0, -S.cam);
    for (const pl of S.plats) if (pl.y > S.cam - 80 && pl.y < S.cam + H + 80) drawPlatform(pl);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of S.stars) { const b = Math.sin(S.t * 4 + s.x) * 3; ctx.font = `20px ${font}`; ctx.fillText('⭐', s.x, s.y + b); }
    for (const r of S.rocks) { if (r.y < S.cam - 60 || r.y > S.cam + H + 60) continue; ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot); ctx.fillStyle = '#5C5F66'; ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2, rr2 = r.r * (j % 2 ? .82 : 1); ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#868E96'; ctx.beginPath(); ctx.arc(-r.r * .3, -r.r * .25, r.r * .28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,146,43,.35)'; ctx.beginPath(); ctx.ellipse(r.x - Math.sign(r.vx) * (r.r + 10), r.y, 14, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const tr of S.trail) { ctx.globalAlpha = Math.max(0, tr.life); ctx.fillStyle = tr.life > .6 ? '#FFD43B' : '#FF8A3D'; ctx.beginPath(); ctx.arc(tr.x, tr.y + (1 - tr.life) * 40, 4 + tr.life * 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const p = S.p;
    if (S.mode !== 'pick' && S.mode !== 'jumpTo' && S.mode !== 'resultOk' && S.mode !== 'resultNo') drawBrainy(p.x, p.y, p.face, p.vy, p.safe > 0 && Math.sin(S.t * 30) > 0 && S.mode === 'climb' && p.rocket <= 0 ? .5 : 1);
    drawFx();
    ctx.restore();
    if (S.banner) {
      const a = Math.min(1, S.banner.life * 2, (2.4 - S.banner.life) * 4);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(22,15,60,.7)'; rr(W / 2 - 130, H * .26 - 24, 260, 48, 24); ctx.fill();
      ctx.fillStyle = '#FFD43B'; ctx.font = `900 18px ${font}`; ctx.fillText(S.banner.text, W / 2, H * .26 + 1); ctx.restore();
    }
    // Steuer-Hinweise unten links/rechts
    if (S.mode === 'climb' || S.mode === 'ready') {
      for (const [side, x] of [[-1, 34], [1, W - 34]]) {
        const on = S.dir === side || (side < 0 ? S.keys.l : S.keys.r);
        ctx.globalAlpha = on ? .9 : .32; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, H - 34, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4D3DF0'; ctx.font = `900 16px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(side < 0 ? '◀' : '▶', x, H - 33);
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawFx() {
    for (const q of S.parts) { ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, q.r, q.r); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of S.floats) { ctx.globalAlpha = Math.max(0, Math.min(1, f.life)); ctx.font = `900 ${f.big ? 22 : 16}px ${font}`; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
  }
  // Auswahl-Ebene (eigenes Level): Frage oben (DOM), drei Antwort-Plattformen, Brainy unten
  function drawQuizLevel() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2B1F7A'); g.addColorStop(1, '#5B3FD9');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = .25 + .35 * Math.sin(S.t * 1.6 + i * 1.3) ** 2; ctx.fillStyle = '#fff'; ctx.fillRect((i * 89) % W, (i * 137) % H, 2, 2); }
    ctx.globalAlpha = 1;
    ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * 12 * S.shake, (Math.random() - .5) * 12 * S.shake);
    // Startplattform
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(W / 2 - 60, H - 64, 120, 16, 8); ctx.fill();
    const q = S.quiz;
    q.opts.forEach((o, i) => {
      const fallK = o.state === 'no' ? Math.min(1, S.modeT * 1.3) : 0;
      ctx.save(); ctx.globalAlpha = 1 - fallK * .9;
      ctx.translate(o.x + o.w / 2, o.y + fallK * 160); ctx.rotate(fallK * .5); ctx.translate(-o.x - o.w / 2, -o.y);
      const pulse = S.mode === 'pick' ? Math.sin(S.t * 3 + i) * 1.5 : 0;
      const fill = o.state === 'ok' || o.state === 'show' ? '#D3F9D8' : o.state === 'no' ? '#FFE3E3' : '#FFFFFF';
      const edge = o.state === 'ok' || o.state === 'show' ? '#2B8A3E' : o.state === 'no' ? '#C92A2A' : o.state === 'sel' ? '#FFD43B' : '#B197FC';
      ctx.fillStyle = 'rgba(0,0,0,.22)'; rr(o.x + 2, o.y + 7 + pulse, o.w, o.h, 16); ctx.fill();
      ctx.fillStyle = edge; rr(o.x, o.y + 4 + pulse, o.w, o.h, 16); ctx.fill();
      ctx.fillStyle = fill; rr(o.x, o.y + pulse, o.w, o.h - 4, 16); ctx.fill();
      ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(o.x + 24, o.y + o.h / 2 - 2 + pulse, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `900 13px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.state === 'ok' || o.state === 'show' ? '✓' : o.state === 'no' ? '✗' : 'ABC'[i], o.x + 24, o.y + o.h / 2 - 1 + pulse);
      ctx.fillStyle = '#16131F'; ctx.font = `800 14.5px ${font}`; ctx.textAlign = 'left';
      ctx.save(); ctx.translate(o.x + 48, 0); ctx.textAlign = 'left';
      const words = String(o.label); ctx.textAlign = 'left';
      wrapLeft(words, 0, o.y + o.h / 2 - 2 + pulse, o.w - 60, 17, 2);
      ctx.restore();
      ctx.restore();
    });
    // Brainy
    const qp = S.qp; if (qp) drawBrainy(qp.x, qp.y, 1, S.mode === 'jumpTo' ? -800 : qp.vy || 0, 1);
    drawFx();
    ctx.restore();
  }
  function wrapLeft(text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    for (const w of words) { const tt = line ? line + ' ' + w : w; if (ctx.measureText(tt).width > maxW && line) { lines.push(line); line = w; } else line = tt; }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
    const y0 = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  }
  function drawIntro() {
    const k = Math.min(1, S.modeT / .35), out = Math.max(0, (S.modeT - .95) / .3);
    ctx.fillStyle = `rgba(22,15,60,${.62 * k + out * .38})`; ctx.fillRect(0, 0, W, H);
    const sc = .6 + ease(k) * .4;
    ctx.save(); ctx.translate(W / 2, H * .42); ctx.scale(sc, sc); ctx.globalAlpha = 1 - out;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD43B'; ctx.font = `900 15px ${font}`; ctx.fillText(t('PAUSE – WISSENS-CHECK'), 0, -52);
    ctx.fillStyle = '#fff'; ctx.font = `900 46px ${font}`; ctx.fillText(`${t('Karte')} ${S.cardNo}`, 0, 0);
    ctx.font = `700 15px ${font}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(t('Spring auf die richtige Antwort'), 0, 44);
    ctx.restore();
  }
  function drawReady() {
    ctx.fillStyle = 'rgba(22,15,60,.35)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = H * .36;
    ctx.fillStyle = '#fff'; ctx.font = `900 30px ${font}`; ctx.fillText('Brain Jump', W / 2, y);
    ctx.font = `700 14.5px ${font}`; ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillText(t('Halte links oder rechts gedrückt zum Steuern.'), W / 2, y + 40);
    ctx.fillText(t('Goldene Plattform = Karte. Richtig = Boost!'), W / 2, y + 62);
    const b = .5 + .5 * Math.sin(S.t * 4);
    ctx.fillStyle = `rgba(255,255,255,${.75 + b * .25})`; rr(W / 2 - 92, y + 92, 184, 46, 23); ctx.fill();
    ctx.fillStyle = '#4D3DF0'; ctx.font = `900 16px ${font}`; ctx.fillText(t('Tippen zum Starten'), W / 2, y + 115);
  }
  function draw() {
    const quizLevel = S.mode === 'pick' || S.mode === 'jumpTo' || S.mode === 'resultOk' || S.mode === 'resultNo';
    if (quizLevel) drawQuizLevel(); else drawWorld();
    if (S.mode === 'intro') drawIntro();
    if (S.mode === 'ready') drawReady();
    if (S.mode === 'pick' && S.modeT < .3) { ctx.fillStyle = `rgba(22,15,60,${1 - S.modeT / .3})`; ctx.fillRect(0, 0, W, H); }
    if (S.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${S.fade * .8})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- Schleife ----------
  let raf = 0, last = 0, stopped = false;
  function frame(ts) {
    if (stopped) return;
    if (!canvas.isConnected) { stop(); return; }
    const dt = Math.min(0.033, last ? (ts - last) / 1000 : 0.016); last = ts;
    if (!S.paused && !S.over) { update(dt); onEvent?.('tick', S); }
    draw();
    raf = requestAnimationFrame(frame);
  }
  function end() { if (S.over) return; S.over = true; mood('wow', 99); onEvent?.('over', S); }
  function stop() {
    stopped = true; cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize);
  }
  raf = requestAnimationFrame(frame);
  // Test-Hilfen
  const test = { choose: i => choose(S.quiz?.opts[i]), correctIndex: () => S.quiz?.opts.findIndex(o => o.ok), start: () => S.mode === 'ready' && setMode('climb'), toCard: () => { const pl = { x: S.p.x - 50, y: S.p.y + BH, w: 150, type: 'card' }; S.plats.push(pl); startCard(pl); } };
  return { state: S, stop, pause: v => { S.paused = v; last = 0; }, test };
}
