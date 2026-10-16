// Exam Studio – Scanner-Animation (Phase 'scan') und Meldung «Prüfung bereinigt».
// Ein Blatt-Stapel: auf der obersten Seite fährt ein leuchtender Balken nach unten, oberhalb ist die
// bereinigte Seite sichtbar (Radier-Effekt mit Krümeln), danach liest der Balken weiter, solange die KI arbeitet.
// morphdom-sicher: feste Elemente in fester Reihenfolge; Animationen hängen nur an Klassen (on/cl/done),
// der Fortschritt kommt als CSS-Variable (--p) – ein render() startet nichts neu.
import { aiStatus } from './studio.js';
import { t } from './i18n.js';

const STEPS = [
  ['Handschrift entfernen', 'Notizen, Korrekturen und Lösungen werden ausradiert'],
  ['Aufgaben erkennen', 'Aufgaben, Punkte und Grafiken werden erfasst'],
  ['Lösungen & Varianten', 'Musterlösungen und neue Zahlen werden berechnet'],
];
const WIN = 2;                 // nur Seiten nahe der aktiven bekommen ein Bild (Speicher schonen)
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => Number.isFinite(+v) ? +v : 0;
const safeUrl = u => typeof u === 'string' && /^(data:image\/|blob:|https?:|\.{0,2}\/|assets\/)/.test(u) ? u.replace(/"/g, '%22') : '';

// Radier-Krümel: feste Pseudo-Zufallswerte (gleiches HTML bei jedem render → keine Änderung im DOM)
const DUST = Array.from({ length: 16 }, (_, i) => {
  const r = k => ((Math.sin((i + 1) * 12.9898 * k) * 43758.5453) % 1 + 1) % 1;
  return `<i style="--x:${(4 + r(1) * 92).toFixed(1)}%;--dx:${((r(2) - 0.5) * 34).toFixed(1)}px;--dy:${(-10 - r(3) * 26).toFixed(1)}px;--s:${(0.6 + r(4) * 0.9).toFixed(2)};--t:${(0.7 + r(5) * 0.7).toFixed(2)}s;--w:${(-r(6) * 1.4).toFixed(2)}s"${i % 3 ? '' : ' class="pk"'}></i>`;
}).join('');

// Fortschritt aus a.scan lesen. studio.js meldet: step 0–1 = Seiten lesen (prog = Anteil der Wellen),
// 2 = Bereinigen/Ausschneiden, 3 = Lösen/Remix (prog 0.5–1), 4 = fertig
export function scanState(sc) {
  const step = clamp(Math.floor(num(sc?.step)), 0, 4), prog = clamp(num(sc?.prog), 0, 1), n = Array.isArray(sc?.pages) ? sc.pages.length : 0;
  const ui = step >= 4 ? 3 : step <= 1 ? 0 : step - 1;
  const part = step >= 4 ? 1 : ui === 0 ? prog : ui === 1 ? 0.5 : clamp((prog - 0.5) * 2, 0, 1);
  const total = step >= 4 ? 1 : !n ? 0.02 : ui === 0 ? 0.04 + 0.5 * prog : ui === 1 ? 0.58 : 0.64 + 0.34 * part;
  const cur = !n ? 0 : ui === 0 ? (prog <= 0.05 ? 0 : Math.min(n - 1, Math.floor(prog * n))) : n - 1;   // 0.05 = Startmeldung
  return { step, ui, part, total, cur, n, pct: step >= 4 ? 100 : Math.min(99, Math.round(total * 100)) };
}

function sheet(sc, k, s) {
  const d = k - s.cur, st = d < 0 ? 'done' : d === 0 ? 'on' : 'next', near = d >= -1 && d <= WIN;
  const raw = near ? safeUrl(sc.pages[k]) : '', cl = near ? safeUrl(sc.cleaned?.[k]) : '';
  return `<div class="exs-sheet ${st}${cl ? ' cl' : ''}" style="--d:${clamp(d, -1, 4)}" aria-hidden="true">
    ${raw ? `<img class="exs-raw" src="${raw}" alt="" decoding="async" draggable="false">` : '<span class="exs-raw exs-ph"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>'}
    <span class="exs-clean">${cl ? `<img src="${cl}" alt="" decoding="async" draggable="false">` : ''}</span>
    <span class="exs-beam"><i class="exs-glow"></i><i class="exs-line"></i><span class="exs-dust">${DUST}</span></span>
  </div>`;
}

export function scanView(a) {
  const sc = a?.scan && typeof a.scan === 'object' ? a.scan : { step: 0, prog: 0, pages: [], cleaned: [] };
  const pages = Array.isArray(sc.pages) ? sc.pages : [], s = scanState({ ...sc, pages });
  const wait = num(aiStatus?.wait) > Date.now();
  const sheets = pages.length ? pages.map((_, k) => sheet({ pages, cleaned: Array.isArray(sc.cleaned) ? sc.cleaned : [] }, k, s)).join('') : sheet({ pages: [], cleaned: [] }, 0, s);
  return `<section class="exs" style="--p:${s.total.toFixed(3)}" aria-busy="${s.step < 4}">
    <header class="exs-head"><span class="exs-kicker">BRAINY EXAM STUDIO</span><h2>Deine Prüfung wird bereinigt</h2></header>
    <div class="exs-stage"><div class="exs-stack">${sheets}</div></div>
    <p class="exs-count">${s.n > 1 ? `Seite ${Math.min(s.cur + 1, s.n)} von ${s.n}` : s.n ? '1 Seite' : 'Seiten werden vorbereitet'}</p>
    <ol class="exs-steps">${STEPS.map(([h, sub], k) => { const st = k < s.ui ? 'done' : k === s.ui ? 'now' : '';
      return `<li class="${st}"><span class="exs-dot">${CHECK}</span><div><b>${h}</b><small>${sub}</small><i class="exs-sbar" style="--sp:${k < s.ui ? 1 : k === s.ui ? s.part.toFixed(3) : 0}"></i></div></li>`; }).join('')}</ol>
    <div class="exs-total"><i class="exs-bar"></i><b>${s.pct} %</b></div>
    <p class="exs-wait${wait ? ' on' : ''}" role="status">${wait ? 'Brainy ist gerade stark ausgelastet – es geht gleich automatisch weiter.' : ''}</p>
  </section>`;
}

/* ---------------------------------- «Prüfung bereinigt» ---------------------------------- */
const LN = () => window.Capacitor?.Plugins?.LocalNotifications || null;
const granted = p => p?.display === 'granted';
// Im Vordergrund aufrufen (z. B. beim Scan-Start): fragt die Berechtigung höchstens einmal an
export async function prepareNotify() {
  try { const n = LN(); if (!n || document.hidden) return false; let p = await n.checkPermissions();
    if (/^prompt/.test(p?.display || '')) p = await n.requestPermissions(); return granted(p); } catch { return false; }
}
// Lokale Push-Meldung, wenn die App im Hintergrund ist; sonst nichts (Banner zeigt die Ansicht).
// Mit { sound: true } im Vordergrund ein sehr leiser, kurzer Erfolgston.
export async function notifyCleaned(doc, { sound = false } = {}) {
  try {
    if (!document.hidden) { if (sound) softChime(); return false; }
    const n = LN(); if (!n?.schedule) return false;
    const p = await n.checkPermissions?.().catch(() => null); if (p && !granted(p)) return false;   // im Hintergrund nicht nachfragen
    const k = Array.isArray(doc?.questions) ? doc.questions.length : 0, title = String(doc?.title || '').slice(0, 60);
    await n.schedule({ notifications: [{ id: 1 + (Date.now() % 2000000000), title: t('Prüfung bereinigt'),
      body: k ? t(`${k} Aufgaben erkannt – tippe, um weiterzumachen.`) : t('Tippe, um weiterzumachen.'), ...(title ? { summaryText: title } : {}), extra: { docId: doc?.id || null } }] });
    return true;
  } catch { return false; }
}
let ctx;
function softChime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.()?.catch?.(() => { }); const t0 = ctx.currentTime + 0.01;
    [880, 1318.5].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + i * 0.09;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.04, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, s + 0.32);
      o.connect(g).connect(ctx.destination); o.start(s); o.stop(s + 0.35); });
  } catch { }
}
