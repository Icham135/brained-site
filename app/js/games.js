// Karteikarten-Spiele: Brain Jump, Blitz-Paare, Richtig oder Falsch.
// Spielen mit den eigenen Karten (oder einem Starter-Deck), persönlicher Highscore – keine Rangliste.
// Der Spielzustand liegt hier im Modul (G); gameView() zeichnet immer aus diesem Zustand,
// darum übersteht das Spiel auch ein normales Neuzeichnen der App.
import * as St from './store.js';
import { esc, brainSVG } from './ui.js';
import { translateDOM, t } from './i18n.js';
import { createJump } from './jump.js';

const S = St.S;

export const GAMES = [
  { id: 'jump', em: '🦘', name: 'Brain Jump', desc: 'Spring so hoch du kannst. Auf jeder goldenen Plattform wartet eine Karte – richtig gibt einen Raketen-Boost.', color: 'linear-gradient(140deg,#7C6CFF,#4D3DF0)' },
  { id: 'match', em: '⚡', name: 'Blitz-Paare', desc: 'Finde Frage und Antwort – so viele Paare wie möglich in 60 Sekunden.', color: 'linear-gradient(140deg,#FF8A3D,#FF4F87)' },
  { id: 'sprint', em: '🎯', name: 'Richtig oder Falsch', desc: 'Passt die Antwort? Schnell entscheiden, Combo aufbauen.', color: 'linear-gradient(140deg,#20C997,#0E9F6E)' },
];

// Starter-Deck, falls noch zu wenige eigene Karten da sind
export const STARTER = [
  ['der Hund', 'le chien'], ['das Haus', 'la maison'], ['der Apfel', "la pomme"], ['die Schule', "l'école"], ['schnell', 'rapide'], ['der Freund', "l'ami"],
  ['das Buch', 'le livre'], ['die Stadt', 'la ville'], ['gestern', 'hier'], ['morgen', 'demain'], ['das Wasser', "l'eau"], ['die Zeit', 'le temps'],
  ['7 · 8', '56'], ['√81', '9'], ['12²', '144'], ['Hauptstadt der Schweiz', 'Bern'], ['H₂O', 'Wasser'], ['Längster Fluss der Schweiz', 'Rhein'],
].map(([q, a], i) => ({ id: 'st' + i, q, a }));

const MIN_CARDS = 4;
export function deckFor(subjectId) {
  const own = S.flashcards.filter(c => (!subjectId || c.subjectId === subjectId) && c.q && c.a);
  return own.length >= MIN_CARDS ? { cards: own, starter: false } : { cards: STARTER, starter: true };
}
export const best = id => S.games?.[id]?.best || 0;

const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const short = (t, n = 46) => { t = String(t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
// 3 verschiedene Antworten: die richtige + 2 andere (keine Duplikate)
function options(card, cards, k = 3) {
  const others = shuffle(cards.filter(c => c.id !== card.id && c.a.trim() !== card.a.trim()));
  const picked = [], seen = new Set([card.a.trim()]);
  for (const c of others) { if (picked.length >= k - 1) break; if (!seen.has(c.a.trim())) { seen.add(c.a.trim()); picked.push(c.a); } }
  return shuffle([card.a, ...picked]);
}

let G = null;          // aktueller Spielzustand
let tick = null;       // Intervall
let ctx = null;        // { render, haptic, confetti, toast, trophyToast }

export function init(c) { ctx = c; }
const $ = s => document.querySelector(s);
function stop() { clearInterval(tick); tick = null; }

export function start(id, subjectId) {
  stop();
  let { cards, starter } = deckFor(subjectId);
  // Brain Jump & Blitz-Paare: kurze Karten passen besser auf Plattformen/Kacheln (falls genug vorhanden)
  if (id !== 'sprint') { const shortOnes = cards.filter(c => c.a.length <= 42 && c.q.length <= 90); if (shortOnes.length >= 6) cards = shortOnes; }
  G = { id, subjectId, starter, cards, score: 0, combo: 0, lives: 3, over: false, record: false, started: Date.now(), queue: shuffle(cards), qi: 0 };
  if (id === 'jump') { G.height = 0; G.correct = 0; G.engine = null; G.quizText = ''; setTimeout(mountJump, 0); }
  if (id === 'match') { G.timeLeft = 60000; G.round = 0; newBoard(); }
  if (id === 'sprint') { G.timeLeft = 45000; G.mult = 1; nextSprint(); }
  G.last = Date.now();
  if (id !== 'jump') tick = setInterval(loop, 100);
}
export function quit() { stop(); G?.engine?.stop(); G = null; }

// Brain Jump: Canvas-Engine starten, sobald das <canvas> im DOM ist
function pickQuestion() {
  const card = nextCard();
  return { q: card.q, answer: card.a, opts: options(card, G.cards) };
}
function mountJump() {
  if (!G || G.id !== 'jump' || G.engine) return;
  const canvas = document.getElementById('jump-canvas'); if (!canvas) return setTimeout(mountJump, 50);
  G.engine = createJump({ canvas, pickQuestion, onEvent(type, d) {
    if (!G) return;
    const st = G.engine?.state || d;
    if (type === 'tick') {
      G.score = st.score; G.lives = st.lives; G.height = st.height; G.correct = st.correct; G.combo = st.combo; G.mode = st.mode; G.stage = st.stage;
      const sc = $('#g-score'); if (sc && sc.textContent !== String(st.score)) sc.textContent = st.score;
      const lv = $('#g-lives'); const hs = hearts(st.lives); if (lv && lv.textContent !== hs) lv.textContent = hs;
      const hh = $('#g-height'); const ht = st.height + ' m'; if (hh && hh.textContent !== ht) hh.textContent = ht;
      // Frage-Karte nur auf der Auswahl-Ebene
      const show = ['pick', 'jumpTo', 'resultOk', 'resultNo'].includes(st.mode) && st.quiz;
      const qt = show ? st.quiz.q : '';
      const qb = $('#g-quiz');
      if (qb) {
        if (qt !== G.quizText) { G.quizText = qt; qb.classList.toggle('show', !!qt); qb.querySelector('b').textContent = qt; qb.querySelector('.jq-n').textContent = `🃏 ${t('Karte')} ${st.cardNo}`; }
        const bar = qb.querySelector('i'); if (bar) bar.style.width = (st.mode === 'pick' ? st.pickLeft / 12 * 100 : st.mode === 'jumpTo' ? bar.style.width.replace('%', '') : 0) + '%';
        qb.classList.toggle('low', st.mode === 'pick' && st.pickLeft < 4);
      }
    }
    if (type === 'card') ctx.haptic([20, 40, 20]);
    if (type === 'correct') ctx.haptic(30);
    if (type === 'wrong' || type === 'fall') ctx.haptic(90);
    if (type === 'star' || type === 'bounce') ctx.haptic(type === 'star' ? 8 : 0);
    if (type === 'over') { G.score = st.score; setTimeout(finish, 900); }
  } });
}
const nextCard = () => { if (G.qi >= G.queue.length) { G.queue = shuffle(G.cards); G.qi = 0; } return G.queue[G.qi++]; };

function loop() {
  if (!G || G.over) return stop();
  if (!$('#game')) { G.last = Date.now(); return; }          // Bildschirm verlassen → pausieren
  const now = Date.now(), dt = now - G.last; G.last = now;
  {
    if (G.locked) return;
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) { G.timeLeft = 0; return finish(); }
    const t = $('#g-time'); if (t) t.textContent = Math.ceil(G.timeLeft / 1000) + 's';
    const bar = $('#g-bar'); if (bar) bar.style.width = Math.min(100, G.timeLeft / (G.id === 'match' ? 60000 : 45000) * 100) + '%';
  }
}

function finish() {
  if (!G || G.over) return;
  stop(); G.engine?.stop(); G.over = true;
  S.games = S.games || {};
  const prev = best(G.id);
  G.record = G.score > prev && G.score > 0;
  S.games[G.id] = { best: Math.max(prev, G.score), plays: (S.games[G.id]?.plays || 0) + 1, last: G.score };
  if (G.record) { S.stats.gameRecords = (S.stats.gameRecords || 0) + 1; }
  St.save();
  ctx.render();
  if (G.record) { ctx.confetti(); ctx.trophyToast(); }
}

/* ---------------- Blitz-Paare ---------------- */
function newBoard() {
  const uniq = [], seenQ = new Set(), seenA = new Set();
  for (const c of shuffle(G.cards)) { const q = c.q.trim(), a = c.a.trim(); if (seenQ.has(q) || seenA.has(a) || seenQ.has(a) || seenA.has(q)) continue; seenQ.add(q); seenA.add(a); uniq.push(c); if (uniq.length === 6) break; }
  G.pairs = uniq.length;
  G.tiles = shuffle(uniq.flatMap(c => [{ k: c.id, side: 'q', t: c.q }, { k: c.id, side: 'a', t: c.a }])).map((t, i) => ({ ...t, i, gone: false }));
  G.sel = null; G.wrong = null; G.found = 0; G.round++;
}
function matchPick(i) {
  if (!G || G.over || G.locked) return;
  const t = G.tiles[i]; if (!t || t.gone) return;
  if (G.sel === null) { G.sel = i; ctx.haptic(5); return paint(); }
  if (G.sel === i) { G.sel = null; return paint(); }
  const a = G.tiles[G.sel];
  if (a.k === t.k && a.side !== t.side) {
    a.gone = t.gone = true; G.sel = null; G.found++; G.combo++;
    const pts = 10 + Math.min(30, (G.combo - 1) * 5);
    G.score += pts; G.pop = { i, text: `+${pts}${G.combo > 1 ? ` · ${G.combo}er-Combo` : ''}`, k: Date.now() }; ctx.haptic(12);
    if (G.found >= G.pairs) { G.timeLeft += 8000; G.locked = true; paint(); setTimeout(() => { if (!G || G.over) return; G.locked = false; newBoard(); paint(); }, 450); return; }
  } else {
    G.wrong = [G.sel, i]; G.sel = null; G.combo = 0; G.timeLeft = Math.max(0, G.timeLeft - 2000); ctx.haptic(50);
    setTimeout(() => { if (G) { G.wrong = null; paint(); } }, 450);
  }
  paint();
}

/* ---------------- Richtig oder Falsch ---------------- */
function nextSprint() {
  const card = nextCard();
  const fake = Math.random() < 0.5;
  let shown = card.a;
  if (fake) { const alt = shuffle(G.cards.filter(c => c.a.trim() !== card.a.trim()))[0]; if (alt) shown = alt.a; }
  G.card = card; G.shown = shown; G.truth = shown === card.a; G.flash = null;
}
function sprintPick(said) {
  if (!G || G.over || G.locked) return;
  const ok = said === G.truth;
  if (ok) { G.combo++; G.mult = Math.min(4, 1 + Math.floor(G.combo / 5)); G.score += 5 * G.mult; G.pop = { text: `+${5 * G.mult}`, k: Date.now() }; ctx.haptic(10); }
  else { G.combo = 0; G.mult = 1; G.timeLeft = Math.max(0, G.timeLeft - 3000); ctx.haptic(60); }
  G.flash = ok ? 'ok' : 'no'; G.locked = true; paint();
  setTimeout(() => { if (!G || G.over) return; G.locked = false; nextSprint(); paint(); }, ok ? 260 : 700);
}

/* ---------------- Aktionen (für app.js) ---------------- */
export const actions = {
  gameOpen(d) { const sub = d.sub || null; start(d.id, sub); },
  gameAgain() { if (G) start(G.id, G.subjectId); },
  gameQuit() { quit(); },
  gameMatch(d) { matchPick(+d.k); return false; },
  gameSprint(d) { sprintPick(d.k === '1'); return false; },
};

/* ---------------- Ansicht ---------------- */
function paint() { const el = $('#game'); if (!el || !G) return; el.outerHTML = gameView(); const n = $('#game'); if (n) translateDOM(n); }

const hearts = n => '❤️'.repeat(Math.max(0, n)) + '🤍'.repeat(Math.max(0, 3 - n));

export const active = () => !!G;
export const state = () => G; // für Tests
export function gameView() {
  if (!G) return '';
  const meta = GAMES.find(g => g.id === G.id);
  if (G.over) {
    return `<div id="game" class="game over"><div class="game-over-card">
      <div style="font-size:54px">${G.record ? '🏆' : meta.em}</div>
      <h2>${G.record ? 'Neuer Rekord!' : 'Spiel vorbei'}</h2>
      <div class="go-score">${G.score}</div><div class="faint small bold">Punkte · Rekord ${best(G.id)}</div>
      ${G.id === 'jump' ? `<div class="go-meta"><span>🚀 ${G.height || 0} m</span><span>🌌 Stage ${(G.stage || 0) + 1}/9</span><span>🃏 ${G.correct || 0} richtig</span></div>` : ''}
      ${G.starter ? `<p class="small muted mt12">Gespielt mit dem Starter-Deck. Erstelle mindestens 4 eigene Karten, dann spielst du mit deinem Stoff.</p>` : ''}
      <button class="btn primary block mt16" data-a="gameAgain">Nochmals spielen</button>
      <button class="btn ghost block mt8" data-a="gameQuit">Zurück zu den Karten</button></div></div>`;
  }
  if (G.id === 'jump') {
    return `<div id="game" class="game jump2">
      <div class="jump-stage">
        <canvas id="jump-canvas"></canvas>
        <div class="jhud">
          <button class="jbtn" data-a="gameQuit" aria-label="Beenden">✕</button>
          <div class="jstat"><span id="g-height">${G.height || 0} m</span><small>Höhe</small></div>
          <div class="jstat main"><span id="g-score">${G.score}</span><small>Punkte</small></div>
          <div class="jstat"><span id="g-lives">${hearts(G.lives)}</span><small>Leben</small></div>
        </div>
        <div id="g-quiz" class="jquiz ${G.quizText ? 'show' : ''}" data-noi18n><span class="jq-n">🃏</span><b>${esc(G.quizText || '')}</b><div class="jq-bar"><i></i></div></div>
      </div></div>`;
  }
  const head = `<div class="game-hud"><button class="icon-btn plain" data-a="gameQuit" aria-label="Beenden">✕</button><b class="grow">${meta.em} ${meta.name}</b>
    <span class="hud-time" id="g-time">${Math.ceil(G.timeLeft / 1000)}s</span>
    <span class="hud-score">${G.score}</span></div>
    <div class="game-bar"><i id="g-bar" style="width:${G.timeLeft / (G.id === 'match' ? 60000 : 45000) * 100}%"></i></div>
    ${G.pop && Date.now() - G.pop.k < 900 ? `<div class="score-pop" data-k="${G.pop.k}">${esc(G.pop.text)}</div>` : ''}`;
  if (G.id === 'match') {
    return `<div id="game" class="game match">${head}
      <div class="match-grid">${G.tiles.map(t => `<button class="mt ${t.side} ${t.gone ? 'gone' : ''} ${G.sel === t.i ? 'sel' : ''} ${G.wrong?.includes(t.i) ? 'wrong' : ''}" data-a="gameMatch" data-k="${t.i}" ${t.gone ? 'disabled' : ''}>${esc(short(t.t, 40))}</button>`).join('')}</div>
      <p class="center tiny faint mt8">Runde ${G.round} · Fehler kosten 2 Sekunden · Board fertig = +8 Sekunden</p></div>`;
  }
  return `<div id="game" class="game sprint">${head}
    <div class="sprint-card ${G.flash || ''}" id="sprint-card"><span class="tiny bold faint">${G.mult > 1 ? `×${G.mult} MULTIPLIKATOR` : 'PASST DAS?'}</span>
      <div class="sq">${esc(short(G.card.q, 90))}</div><div class="sarrow">↓</div><div class="sa">${esc(short(G.shown, 90))}</div></div>
    <div class="row sprint-btns"><button class="btn sbtn no" data-a="gameSprint" data-k="0">✗ Falsch</button><button class="btn sbtn yes" data-a="gameSprint" data-k="1">✓ Richtig</button></div>
    <p class="center tiny faint mt8">Wischen ← falsch · richtig → · Combo von 5 = höherer Multiplikator</p></div>`;
}

// Richtig/Falsch: Karte wischen (← falsch, → richtig)
let drag = null;
document.addEventListener('pointerdown', e => {
  const card = e.target.closest?.('#sprint-card'); if (!card || !G || G.id !== 'sprint' || G.locked || G.over) return;
  drag = { x: e.clientX, card }; card.style.transition = 'none';
});
document.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x;
  drag.card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  drag.card.classList.toggle('lean-yes', dx > 40); drag.card.classList.toggle('lean-no', dx < -40);
});
document.addEventListener('pointerup', e => {
  if (!drag) return; const dx = e.clientX - drag.x, card = drag.card; drag = null;
  card.style.transition = ''; card.style.transform = ''; card.classList.remove('lean-yes', 'lean-no');
  if (Math.abs(dx) > 80) sprintPick(dx > 0);
});
