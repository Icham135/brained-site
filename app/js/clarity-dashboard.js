// Brained Clarity – Screen 4: Clarity-Dashboard (Bento). Bauplan: docs/CLARITY-BAUPLAN.md §1.4
// Jede Etappe ist frei anklickbar (auch «Sitzt sicher» und Erledigtes); Triage lässt sich nachträglich ändern.
import { esc } from './ui.js';
import { isClean, CLEAN_MSG } from './moderation.js';
import * as E from './clarity-engine.js';
import { ui, curCourse, saveCourse } from './clarity.js';
import { modulesOf, orderedConcepts, coverage, saved, progress, remaining, nextOf, prognosis, dur, gradeText, sysLabel, pctLabel, TRIAGE } from './clarity-swipe.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dd = () => { const u = ui(); return u.dash || (u.dash = { open: null, menu: null, edit: false }); };
const STATUS = { open: 'Offen', inprogress: 'Läuft', done: 'Erledigt' };
const stOf = c => c.triage === 'known' && c.status !== 'done' && c.status !== 'inprogress' ? { k: 'known', t: 'Sitzt sicher' } : { k: c.status || 'open', t: STATUS[c.status] || 'Offen' };
const gr = course => E.gradingOf(course.grading?.country, course.grading?.scale);
const better = (course, a, b) => E.isBetterOrEqual(gr(course).country, gr(course).scale, a, b);

function empty(msg, btn, to) {
  return `<section class="cl cl-db"><div class="cl-db-empty"><h2>Noch kein Kurs</h2><p>${esc(msg)}</p>${btn ? `<button class="cl-btn cl-btn-primary" data-a="clarityGo" data-to="${to}">${esc(btn)}</button>` : ''}</div></section>`;
}

function progn(course) {
  const p = prognosis(course), g = course.grading || { country: 'CH', scale: '1-6', target: 5 }, t = +g.target;
  const ok = !isNaN(t) && better(course, p.finish, t);
  const rel = isNaN(t) ? '' : ok ? `Ziel ${esc(gradeText(course, t))} ist erreichbar, wenn du alle Etappen abschliesst.` : `Ziel ${esc(gradeText(course, t))}: noch nicht in Reichweite. Ein sicheres Vorwissen und alle Etappen helfen.`;
  return `<div class="cl-bx cl-bx-wide cl-bx-prog">
    <p class="cl-bx-k">Noten-Prognose <em>geschätzt</em></p>
    <div class="cl-prog-line"><div class="cl-prog-c"><small>Aktuelle Prognose:</small><b>~${esc(gradeText(course, p.now))}</b></div><span class="cl-prog-ar" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span><span class="cl-sr"> bis </span><div class="cl-prog-c"><small>Bei Abschluss aller Etappen:</small><b class="${ok ? 'good' : ''}">~${esc(gradeText(course, p.finish))}</b><small class="cl-prog-sys">(${esc(sysLabel(course))})</small></div></div>
    ${rel ? `<p class="cl-bx-s cl-prog-rel ${ok ? 'good' : 'warn'}">${rel}</p>` : ''}
    <p class="cl-bx-hint">Eine Schätzung aus deinem Vorwissen und deinen Etappen. Die echte Note hängt von der Prüfung ab.</p></div>`;
}

// grosse Etappen: Längenbalken relativ zur längsten Etappe, ab 30 Min. zusätzlich «Lang»
const LONG_MIN = 30;
function row(course, c, maxMin) {
  const st = stOf(c), d = dd(), menu = d.menu === c.id, min = E.stageMinutes(c), long = min >= LONG_MIN;
  const score = c.score != null && c.status !== 'open' ? `<span class="cl-et-sc">${Math.round(c.score * 100)} %</span>` : '';
  return `<li class="cl-et ${st.k}">
    <div class="cl-et-r"><button class="cl-et-go" data-a="clarityStartConcept" data-id="${esc(c.id)}" aria-label="${esc(`${c.title}, ${st.t}. Etappe öffnen`)}">
      <span class="cl-dot ${st.k}" aria-hidden="true"></span>
      <span class="cl-et-t"><b>${esc(c.title)}</b><small>~${esc(pctLabel(c.weightPercent))} | ca. ${esc(dur(min))}${c.triage === 'check' && st.k === 'open' ? ' | Kurz-Check' : ''}</small><span class="cl-et-len ${long ? 'long' : ''}" aria-hidden="true"><i style="width:${clamp(Math.round(100 * min / (maxMin || 1)), 8, 100)}%"></i></span></span>
      <span class="cl-et-st">${score}${long && st.k === 'open' ? '<span class="cl-chip long">Lang</span>' : ''}<span class="cl-chip ${st.k}">${esc(st.t)}</span></span></button>
      <button class="cl-et-m" data-a="clarityTriageMenu" data-id="${esc(c.id)}" aria-expanded="${menu}" aria-label="${esc(`Vorwissen für «${c.title}» ändern`)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button></div>
    ${menu ? `<div class="cl-tm" role="group" aria-label="Vorwissen"><span>Vorwissen:</span>${['learn', 'check', 'known'].map(v => `<button class="${c.triage === v ? 'on' : ''}" data-a="clarityTriageSet" data-id="${esc(c.id)}" data-v="${v}" aria-pressed="${c.triage === v}">${esc(TRIAGE[v].label)}</button>`).join('')}</div>` : ''}</li>`;
}

function modules(course, nxt) {
  const d = dd(), mods = modulesOf(course), maxMin = Math.max(1, ...orderedConcepts(course).map(c => E.stageMinutes(c)));
  const open = d.open ?? mods.find(m => m.concepts.some(c => c.id === nxt?.id))?.id ?? mods[0]?.id;
  return `<div class="cl-mods">${mods.map((m, i) => {
    const done = m.concepts.filter(c => c.status === 'done').length, sure = m.concepts.filter(c => c.triage === 'known' && c.status !== 'done').length, isOpen = open === m.id;
    return `<section class="cl-mod ${isOpen ? 'open' : ''}"><button class="cl-mod-h" data-a="clarityModToggle" data-id="${esc(m.id)}" aria-expanded="${isOpen}">
      <span class="cl-mod-t"><b>${esc(`Modul ${i + 1}: ${m.title}`)}</b><small>${done} von ${m.concepts.length} erledigt${sure ? ` · ${sure} sicher` : ''}${m.minutes ? ` · noch ca. ${esc(dur(m.minutes))}` : ''}</small></span>
      <svg class="cl-mod-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg></button>
      ${isOpen ? `<ul class="cl-mod-l">${m.concepts.map(c => row(course, c, maxMin)).join('')}</ul>` : ''}</section>`;
  }).join('')}</div>`;
}

// wählbare Zielnoten, von schlechtester bis bester
const optsOf = course => { const g = gr(course), o = [...g.options].sort((a, b) => g.best > g.worst ? a - b : b - a); return { list: o, worst: o[0], best: o.at(-1) }; };
function editor(course) {
  const g = gr(course), tgt = +course.grading?.target;
  const pill = (a, attrs, on, label) => `<button class="${on ? 'on' : ''}" data-a="${a}" ${attrs} aria-pressed="${on}">${esc(label)}</button>`;
  return `<div class="cl-bx cl-bx-wide cl-ed"><p class="cl-bx-k">Kurs anpassen</p>
    <label class="cl-ed-l" for="cl-ed-t">Titel</label>
    <div class="cl-ed-t"><input id="cl-ed-t" class="cl-in" data-bind="clarity.dashTitle" value="${esc(ui().dashTitle ?? course.title ?? '')}" maxlength="80" autocomplete="off" /><button class="cl-btn" data-a="clarityTitleSave">Speichern</button></div>
    <span class="cl-ed-l">Notensystem</span>
    <div class="cl-seg" role="group" aria-label="Notensystem">${[['CH', '1-6', 'Schweiz'], ['DE', '1-6', 'Deutschland'], ['DE', '0-15', 'DE Punkte'], ['AT', '1-5', 'Österreich']].map(([c, s, l]) => pill('claritySystem', `data-c="${c}" data-s="${s}"`, g.country === c && g.scale === s, l)).join('')}</div>
    <span class="cl-ed-l">Zielnote</span>
    <div class="cl-step"><button data-a="clarityTarget" data-d="-1" aria-label="Zielnote verschlechtern" ${tgt === optsOf(course).worst ? 'disabled' : ''}>−</button><b aria-live="polite">${esc(gradeText(course, tgt))}</b><button data-a="clarityTarget" data-d="1" aria-label="Zielnote verbessern" ${tgt === optsOf(course).best ? 'disabled' : ''}>+</button></div>
    <p class="cl-bx-hint">Die Prognose wird sofort neu berechnet.</p></div>`;
}

export function dashView() {
  const course = curCourse(), U = ui();
  if (!course) return empty('Lade zuerst deinen Lernstoff hoch.', 'Zum Start', 'welcome');
  if (course.status === 'analyzing') return empty('Dein Stoff wird noch analysiert.', '', '');
  const all = orderedConcepts(course);
  if (!all.length) return empty('In diesem Kurs wurden keine Konzepte gefunden.', 'Neuer Kurs', 'welcome');
  const nxt = nextOf(course), d = dd(), prog = progress(course), rem = remaining(course), sv = saved(course);
  const finished = !nxt;
  return `<section class="cl cl-db">
    <div class="cl-db-top"><p class="cl-bx-k">Brained Clarity</p><h2>${esc(course.title || 'Mein Kurs')}</h2>
      <button class="cl-sw-undo" data-a="clarityDashEdit" aria-expanded="${d.edit}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg><span>Anpassen</span></button></div>
    ${finished ? `<div class="cl-cta-card done"><b>Alle Etappen sind durch.</b><small>Mach jetzt die Probeprüfung oder wiederhole eine Etappe.</small></div>`
      : `<div class="cl-cta-card"><p class="cl-bx-k">Nächste Etappe</p><h3>${esc(nxt.title)}</h3><p class="cl-cta-m">ca. ${esc(dur(E.stageMinutes(nxt)))}${nxt.triage === 'check' ? ' | startet mit Fragen' : ''}</p>
        <button class="cl-cta" data-a="clarityStartConcept" data-id="${esc(nxt.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span>Nächste Etappe starten<span class="cl-sr">: ${esc(nxt.title)}</span></span></button></div>`}
    ${d.edit ? editor(course) : ''}
    <div class="cl-bento">
      ${progn(course)}
      <div class="cl-bx"><p class="cl-bx-k">Gesamt-Fortschritt</p><p class="cl-bx-n"><span class="nb">${prog} %</span></p>
        <div class="cl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog}" aria-label="Gesamt-Fortschritt"><i style="width:${prog}%"></i></div>
        <p class="cl-bx-s">Vorwissen deckt <span class="nb">${coverage(course)} %</span> ab</p></div>
      <div class="cl-bx"><p class="cl-bx-k">Noch offen</p><p class="cl-bx-n">ca. ${esc(dur(rem))}</p>
        <p class="cl-bx-s">Geschätzte Ersparnis durch Vorwissen: ~${esc(dur(sv))}</p>
        <p class="cl-bx-s">Gesamter Stoff: ca. ${esc(dur(E.totalMinutes(course)))}</p></div>
    </div>
    <div class="cl-db-acts">
      <button class="cl-btn" data-a="clarityGo" data-to="tools"><b>Prüfung &amp; Zusammenfassung</b><small>Spickzettel und Probeprüfung</small></button>
      <button class="cl-btn" data-a="clarityRedoTriage"><b>Triage nochmals durchgehen</b><small>Vorwissen neu einschätzen</small></button>
    </div>
    <h3 class="cl-db-h">Etappen</h3>
    ${modules(course, nxt)}
  </section>`;
}

export function dashActions(ctx) {
  const find = id => curCourse()?.concepts?.find(c => c.id === id);
  return {
    clarityStartConcept(d) { const c = find(d.id); if (!c) return false; const u = ui(); u.conceptId = c.id; u.phase = 'player'; try { window.scrollTo?.(0, 0); } catch { } },
    clarityModToggle(d) { const s = dd(); s.open = s.open === d.id ? '' : d.id; s.menu = null; },
    clarityTriageMenu(d) { const s = dd(); s.menu = s.menu === d.id ? null : d.id; },
    clarityTriageSet(d) { const c = find(d.id); if (!c || !TRIAGE[d.v]) return false; c.triage = d.v; dd().menu = null; saveCourse(); ctx.haptic?.(8); },
    clarityRedoTriage() { const u = ui(); u.swipe = { i: 0, hist: [] }; u.phase = 'swipe'; try { window.scrollTo?.(0, 0); } catch { } },
    clarityDashEdit() { const s = dd(); s.edit = !s.edit; const c = curCourse(); if (s.edit && c) ui().dashTitle = c.title || ''; },
    clarityTitleSave() {
      const c = curCourse(); if (!c) return false; const t = String(ui().dashTitle ?? '').trim().slice(0, 80);
      if (!t) { ctx.toast?.('Bitte gib einen Titel ein.'); return false; }
      if (!isClean(t, { learning: true })) { ctx.toast?.(CLEAN_MSG); return false; }
      c.title = t; saveCourse(); ctx.toast?.('Titel gespeichert');
    },
    claritySystem(d) {
      const c = curCourse(); if (!c || !E.GRADING[d.c]?.scales[d.s]) return false;
      c.grading = { ...(c.grading || {}), country: d.c, scale: d.s, target: E.defaultTarget(d.c, d.s) }; saveCourse();
    },
    clarityTarget(d) {
      const c = curCourse(); if (!c) return false; const o = optsOf(c).list, cur = +c.grading?.target;
      let i = o.indexOf(cur); if (i < 0) i = o.findIndex(x => x >= cur); if (i < 0) i = o.length - 1;
      c.grading = { ...(c.grading || {}) }; c.grading.target = o[clamp(i + (+d.d), 0, o.length - 1)]; saveCourse();   // «+» = bessere Note (Liste von schlecht nach gut)
    },
  };
}
