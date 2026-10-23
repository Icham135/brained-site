// Brained Clarity – Screen 3: Konzept-Swipe (Vorwissens-Triage). Bauplan: docs/CLARITY-BAUPLAN.md §1.3
// Pointer-Events-Geste mit Rückfederung; JEDE Aktion hat zusätzlich einen Button (Tastatur, Screenreader). Entscheidungen werden sofort gespeichert.
import { esc } from './ui.js';
import { ui, curCourse, saveCourse } from './clarity.js';
import * as E from './clarity-engine.js';

/* ---------------------------------- Kennzahlen (alles aus der Engine) ---------------------------------- */
const CPX = { basis: 'Basis', mittel: 'Mittel', komplex: 'Komplex' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const modulesOf = E.modulesOf, orderedConcepts = E.orderedConcepts, nextOf = E.nextConcept, dur = E.formatDuration;
export const coverage = course => Math.round(clamp(E.coverageOf(course), 0, 100));
export const saved = course => E.savedMinutes(course);
export const progress = course => Math.round(clamp(E.weightedProgress(course), 0, 100));
export const remaining = course => E.remainingMinutes(course);
// → { now, finish } als Noten im gewählten System
export function prognosis(course) { const p = E.gradePrognosis(course); return { now: p.now, finish: p.atFinish }; }
export const gradeText = (course, g) => E.formatGrade(course.grading?.country, course.grading?.scale, g);
export const sysLabel = course => { const g = E.gradingOf(course.grading?.country, course.grading?.scale); return g.country === 'DE' && g.scale === '0-15' ? 'DE, Punkte' : g.country; };
export const pctLabel = w => { w = +w || 0; return w > 0 && w < 1 ? '< 1 %' : `${Math.round(w)} %`; };
export const triageCount = (course, v) => (course.concepts || []).filter(c => c.triage === v).length;

/* ---------------------------------- Zustand ---------------------------------- */
const sw = () => { const u = ui(); const s = u.swipe || (u.swipe = { i: 0 }); s.hist ||= []; return s; };
const TR = {
  learn: { label: 'Muss ich lernen', short: 'Lernen', hint: '0 % Ersparnis' },
  check: { label: 'Unsicher (Kurz-Check)', short: 'Unsicher', hint: '~40 % Ersparnis' },
  known: { label: 'Sitzt sicher', short: 'Sicher', hint: '' },
};
export const TRIAGE = TR;
const ICON = { learn: '<path d="M9 6l6 6-6 6"/>', check: '<path d="M12 4v9m0 4v.5"/><circle cx="12" cy="12" r="9"/>', known: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' };
const ARR = { l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>', r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>', u: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>' };
// Einmal-Anleitung: nur bis zur ersten Entscheidung (pro Gerät)
const FIRST_KEY = 'brained.clSwipeSeen';
const seenFirst = () => { try { return localStorage.getItem(FIRST_KEY) === '1'; } catch { return false; } };
const markFirst = () => { try { localStorage.setItem(FIRST_KEY, '1'); } catch { } };
const ico = v => `<svg class="cl-sw-ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[v]}</svg>`;

/* ---------------------------------- Ansicht ---------------------------------- */
function empty(msg, btn) {
  return `<section class="cl cl-sw"><div class="cl-sw-empty"><h2>Noch nichts zum Prüfen</h2><p>${esc(msg)}</p>${btn ? `<button class="cl-btn" data-a="clarityGo" data-to="welcome">${esc(btn)}</button>` : ''}</div></section>`;
}
function head(course) {
  const cov = coverage(course), sv = saved(course);
  return `<div class="cl-sw-live">
    <div class="cl-sw-cov"><div class="cl-sw-row"><span>Abgedeckter Prüfungsstoff</span><b>${cov} %</b></div>
      <div class="cl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cov}" aria-label="Abgedeckter Prüfungsstoff"><i style="width:${cov}%"></i></div></div>
    <div class="cl-sw-save" title="Schätzung"><span>Geschätzte Lernersparnis</span><b>~${esc(dur(sv))}</b></div></div>`;
}
// Segmentleiste: ein Abschnitt je Modul, gefüllt nach Entscheidungen (auch bei 100+ Konzepten lesbar)
function strip(mods, cur) {
  const total = mods.reduce((t, m) => t + m.concepts.length, 0) || 1;
  return `<div class="cl-sw-strip" aria-hidden="true">${mods.map(m => {
    const done = m.concepts.filter(c => c.triage).length, here = m.concepts.some(c => c.id === cur?.id);
    return `<span class="${here ? 'on' : ''}" style="flex:${m.concepts.length / total * 100}"><i style="width:${done / m.concepts.length * 100}%"></i></span>`;
  }).join('')}</div>`;
}
export function swipeView() {
  const course = curCourse();
  if (!course) return empty('Lade zuerst deinen Lernstoff hoch.', 'Zum Start');
  if (course.status === 'analyzing') return empty('Dein Stoff wird noch analysiert. Das dauert einen Moment.');
  const mods = modulesOf(course), list = mods.flatMap(m => m.concepts);
  if (!list.length) return empty('In diesem Kurs wurden keine Konzepte gefunden. Versuche es mit mehr oder deutlicherem Lernstoff.', 'Neuer Kurs');
  const s = sw(); s.i = clamp(s.i | 0, 0, list.length);
  if (s.i >= list.length) return summary(course, list);
  const c = list[s.i], mod = mods.find(m => m.concepts.includes(c)), mi = mods.indexOf(mod), within = mod.concepts.indexOf(c);
  const nxt = list[s.i + 1];
  const pts = (c.preview || []).slice(0, 3);
  const flip = s.i % 2 ? 'b' : 'a', firstTime = !seenFirst();
  return `<section class="cl cl-sw" data-cl-sw>
    <div class="cl-sw-top"><div><h2>Vorwissen prüfen</h2><p class="cl-sw-sub">Karte ${s.i + 1} von ${list.length} · ${esc(course.title || '')}</p></div>
      <button class="cl-sw-undo" data-a="claritySwipeUndo" ${s.i || s.hist.length ? '' : 'disabled'} aria-label="Letzte Entscheidung rückgängig"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/></svg><span>Zurück</span></button></div>
    ${head(course)}
    ${strip(mods, c)}
    <div class="cl-sw-meta"><span>Modul ${mi + 1} von ${mods.length} · ${within + 1}/${mod.concepts.length}</span></div>
    <div class="cl-sw-stack">
      <span class="cl-sw-zone l" aria-hidden="true">${ico('known')}<b>Sitzt sicher</b></span><span class="cl-sw-zone r" aria-hidden="true">${ico('learn')}<b>Muss ich lernen</b></span><span class="cl-sw-zone u" aria-hidden="true">${ico('check')}<b>Unsicher</b></span>
      ${nxt ? '<div class="cl-sw-card cl-sw-ghost" aria-hidden="true"></div>' : ''}
      <article class="cl-sw-card in-${flip}" data-cl-card tabindex="0" role="group" aria-label="${esc(`Karte ${s.i + 1} von ${list.length}: ${c.title}`)}" aria-describedby="cl-sw-help">
        <span class="cl-sw-tint l" aria-hidden="true">Sitzt sicher</span><span class="cl-sw-tint r" aria-hidden="true">Muss ich lernen</span><span class="cl-sw-tint u" aria-hidden="true">Unsicher</span>
        <div class="cl-sw-tags"><span class="cl-tag">${esc(`Modul ${mi + 1}: ${mod.title}`)}</span><span class="cl-cx ${esc(c.complexity || 'mittel')}">${esc(CPX[c.complexity] || 'Mittel')}</span></div>
        <h3>${esc(c.title)}</h3>
        <p class="cl-sw-w">~${esc(pctLabel(c.weightPercent))} des Stoffs | ca. ${esc(dur(E.minutesFor(c)))}</p>
        ${pts.length ? `<div class="cl-sw-pv"><b>Darum geht's:</b><ul>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
        ${c.triage ? `<p class="cl-sw-was">Bisher: ${esc(TR[c.triage].label)}</p>` : ''}
      </article>
      ${firstTime && !s.hist.length && s.i === 0 ? '<div class="cl-sw-first" aria-hidden="true"><span>Wische oder tippe</span></div>' : ''}
    </div>
    <div class="cl-sw-dock">
    <div class="cl-sw-hintbar" aria-hidden="true"><span>${ARR.l}Sitzt sicher</span><span>${ARR.u}Unsicher</span><span>Muss ich lernen${ARR.r}</span></div>
    <div class="cl-sw-btns" role="group" aria-label="Wie gut kennst du dieses Konzept?">
      ${['known', 'check', 'learn'].map(v => `<button class="cl-sw-b ${v}" data-a="claritySwipe" data-v="${v}" aria-keyshortcuts="${v === 'known' ? 'ArrowLeft' : v === 'check' ? 'ArrowUp' : 'ArrowRight'}">${ico(v)}<b>${esc(TR[v].label)}</b>${TR[v].hint ? `<small>${esc(TR[v].hint)}</small>` : '<small>Spart die ganze Zeit</small>'}</button>`).join('')}
    </div>
    </div>
    <p id="cl-sw-help" class="cl-sw-help">Ziehe die Karte nach links (sitzt sicher), nach oben (unsicher) oder nach rechts (muss ich lernen), oder tippe auf die Knöpfe. Tastatur: Pfeil links, hoch, rechts.</p>
    <div class="cl-sw-foot"><button class="cl-link" data-a="claritySwipeAll">Alles lernen</button><button class="cl-link" data-a="claritySwipeRest">Rest später ansehen</button></div>
    <div class="cl-sr" aria-live="polite">${esc(`Karte ${s.i + 1} von ${list.length}: ${c.title}`)}</div>
  </section>`;
}
function summary(course, list) {
  const L = triageCount(course, 'learn'), C = triageCount(course, 'check'), K = triageCount(course, 'known'), open = list.length - L - C - K;
  const cov = coverage(course), sv = saved(course);
  return `<section class="cl cl-sw cl-sw-sum">
    <div class="cl-sw-top"><div><h2>Geschafft</h2><p class="cl-sw-sub">${list.length} Konzepte durchgesehen</p></div>
      <button class="cl-sw-undo" data-a="claritySwipeUndo" aria-label="Letzte Entscheidung rückgängig"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/></svg><span>Zurück</span></button></div>
    <div class="cl-sw-sumcard"><p class="cl-sw-big">${L} lernen, ${C} Kurz-Check, ${K} sicher</p>
      <p>Du sparst geschätzt ~${esc(dur(sv))}${open ? ` ${open} ${open === 1 ? 'Konzept ist' : 'Konzepte sind'} noch offen und ${open === 1 ? 'zählt' : 'zählen'} als «lernen».` : ''}</p></div>
    ${head(course)}
    <div class="cl-sw-chips"><span class="learn">${L} lernen</span><span class="check">${C} Kurz-Check</span><span class="known">${K} sicher</span></div>
    <button class="cl-btn cl-btn-primary" data-a="clarityGo" data-to="dashboard">Weiter zum Dashboard</button>
    <button class="cl-btn" data-a="claritySwipeRestart">Nochmals durchgehen</button>
    <p class="cl-sw-note">Die Schätzung ist unverbindlich. Beim Lernen siehst du, ob dein Vorwissen wirklich sitzt, und kannst jede Entscheidung später ändern.</p>
  </section>`;
}

/* ---------------------------------- Aktionen ---------------------------------- */
export function swipeActions(ctx) {
  const cur = () => { const course = curCourse(); if (!course) return {}; const list = orderedConcepts(course); return { course, list, c: list[sw().i] }; };
  return {
    claritySwipe(d) {
      const { course, c } = cur(); const v = d.v; if (!c || !TR[v]) return false;
      const s = sw(); s.hist.push({ id: c.id, prev: c.triage ?? null, i: s.i }); if (s.hist.length > 300) s.hist.shift();
      c.triage = v; s.i++; saveCourse(); ctx.haptic?.(8); markFirst();
    },
    claritySwipeUndo() {
      const { course, list } = cur(); if (!course) return false;
      const s = sw(), h = s.hist.pop();
      if (h) { const c = list.find(x => x.id === h.id); if (c) c.triage = h.prev; s.i = h.i; saveCourse(); }
      else if (s.i > 0) s.i--;
      else return false;
    },
    claritySwipeAll() {   // alles Offene ab hier = lernen
      const { course, list } = cur(); if (!course) return false; const s = sw();
      list.slice(s.i).forEach(c => { if (!c.triage) c.triage = 'learn'; }); s.i = list.length; s.hist = []; saveCourse();
    },
    claritySwipeRest() { const { list } = cur(); if (!list) return false; sw().i = list.length; },   // Rest bleibt offen (zählt als lernen)
    claritySwipeRestart() { const s = sw(); s.i = 0; s.hist = []; },
  };
}

/* ---------------------------------- Geste (einmal global; zieht nur am Element, kein Neuzeichnen während des Ziehens) ---------------------------------- */
const TH = 90, THU = 80;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const press = v => document.querySelector(`[data-cl-sw] [data-a="claritySwipe"][data-v="${v}"]`)?.click();
if (typeof document !== 'undefined' && !globalThis.__clSwipeBound) {
  globalThis.__clSwipeBound = true;
  let g = null;
  const apply = (card, dx, dy, instant) => {
    card.style.transition = instant ? 'none' : '';
    card.style.transform = `translate(${dx}px, ${dy * 0.5}px) rotate(${clamp(dx / 18, -14, 14)}deg)`;
    const l = clamp(-dx / TH, 0, 1), r = clamp(dx / TH, 0, 1), u = clamp(-dy / THU, 0, 1) * (Math.abs(dy) > Math.abs(dx) ? 1 : 0);
    const q = k => card.querySelector('.cl-sw-tint.' + k), z = k => card.parentElement.querySelector('.cl-sw-zone.' + k);
    q('l').style.opacity = l; q('r').style.opacity = r; q('u').style.opacity = u;
    if (z('l')) for (const [k, v] of [['l', l], ['r', r], ['u', u]]) { const e = z(k); e.style.opacity = v > 0.05 ? Math.max(v, 0.55) : ''; e.classList.toggle('on', v > 0.05); if (k === 'u') e.style.opacity = v; }
    card.style.boxShadow = r > 0.05 ? `0 0 0 2px var(--cl-accent), var(--cl-shadow-2)` : l > 0.05 ? `0 0 0 2px var(--cl-good), var(--cl-shadow-2)` : u > 0.05 ? `0 0 0 2px var(--cl-warn), var(--cl-shadow-2)` : '';
  };
  document.addEventListener('pointerdown', e => {
    const card = e.target.closest?.('[data-cl-card]'); if (!card || (e.pointerType === 'mouse' && e.button)) return;
    g = { card, x: e.clientX, y: e.clientY, id: e.pointerId, dx: 0, dy: 0 };
    try { card.setPointerCapture(e.pointerId); } catch { }
    card.classList.add('drag');
  });
  document.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x; g.dy = e.clientY - g.y; apply(g.card, g.dx, Math.min(g.dy, 30), true);
  });
  const end = e => {
    if (!g || e.pointerId !== g.id) return;
    const { card, dx, dy } = g; g = null; card.classList.remove('drag');
    const v = e.type === 'pointercancel' ? null : dx > TH ? 'learn' : dx < -TH ? 'known' : (dy < -THU && Math.abs(dy) > Math.abs(dx)) ? 'check' : null;
    if (!v) { apply(card, 0, 0, false); card.style.transform = ''; return; }   // Rückfederung per CSS-Transition
    if (reduced()) { press(v); return; }
    const W = window.innerWidth || 400;
    card.style.transition = 'transform .22s var(--cl-ease), opacity .22s';
    card.style.transform = v === 'check' ? 'translate(0,-120%) scale(.96)' : `translate(${v === 'learn' ? W : -W}px, 20px) rotate(${v === 'learn' ? 18 : -18}deg)`;
    card.style.opacity = '0'; setTimeout(() => press(v), 200);
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('keydown', e => {
    if (!document.querySelector('[data-cl-sw] [data-cl-card]') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, v = k === 'ArrowLeft' ? 'known' : k === 'ArrowRight' ? 'learn' : k === 'ArrowUp' ? 'check' : null;
    if (v) { e.preventDefault(); press(v); }
    else if (k === 'Backspace' || k === 'z') { document.querySelector('[data-cl-sw] [data-a="claritySwipeUndo"]:not([disabled])')?.click(); }
  });
}
