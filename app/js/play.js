// Play-Sheet «Wie lernst du jetzt?»: schnelle Fachwahl (5 Chips), vollständige Fächerliste mit Suche, Solo-Start, Lernraum-Karte.
// Solo-Start, Raumbeitritt und Raum-Erstellung laufen weiter über js/rooms.js (Aktionen playSolo, playRandom, playCreate, playJoin).
import * as St from './store.js';
import { U } from './view-state.js';
import { esc, I } from './ui.js';
import { badMsg } from './moderation.js';
import { SUBJECT_COLORS } from './data.js';
import { CONFIG } from './config.js';

const S = St.S;
const QUICK = ['mathe', 'deutsch', 'franz', 'englisch', 'allg'];   // schnelle Zeile, «Allgemein» zuletzt
// Gruppen der vollständigen Liste (Fach-IDs bleiben, alles Weitere landet unter «Weitere»)
const GROUPS = [
  ['Sprachen', ['deutsch', 'franz', 'englisch', 'ital', 'span', 'latein']],
  ['Mathe und Naturwissenschaften', ['mathe', 'analysis', 'linalg', 'stat', 'physik', 'chemie', 'bio', 'nt', 'info']],
  ['Gesellschaft und Wirtschaft', ['geschichte', 'geo', 'rzg', 'politik', 'sozio', 'psych', 'philo', 'reli', 'paed', 'wr', 'bwl', 'vwl', 'rw', 'recht']],
  ['Kreativ und Sport', ['musik', 'kunst', 'sport']],
  ['Technik und Medizin', ['maschbau', 'etechnik', 'med']],
  ['Beruf und Schule', ['abu', 'bk', 'praxis', 'allgbild', 'allg', 'sonst']],
];
const P = () => (U.play ||= { subjectId: null, mode: 'free', goalMin: 60, view: 'main', name: '', code: '', busy: '', err: '' });
const cmp = (a, b) => a.name.localeCompare(b.name, 'de');
const initials = n => { const w = String(n).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase(); };
const lastIds = () => {
  const ids = []; if (S.playLast) ids.push(S.playLast);
  for (const s of S.sessions.slice().sort((a, b) => b.start - a.start)) { if (!ids.includes(s.subjectId)) ids.push(s.subjectId); if (ids.length >= 8) break; }
  const all = St.allSubjects(); return ids.filter(id => all.some(s => s.id === id));
};
const selId = () => P().subjectId || lastIds()[0] || 'mathe';
const tile = s => `<span class="pl-tile" style="--c:${esc(s.color)}" aria-hidden="true">${esc(initials(s.name))}</span>`;
const dot = s => `<span class="pl-dot" style="--c:${esc(s.color)}" aria-hidden="true"></span>`;
// Fach wählen: wird in die eigenen Fächer aufgenommen (sonst kennt das Raum-/Timer-System es nicht), zuletzt gewähltes Fach merken
function pick(id) {
  if (!St.allSubjects().some(s => s.id === id)) return;
  if (!S.subjects.includes(id)) S.subjects.push(id);
  P().subjectId = id; S.playLast = id; St.save();
}

function listView(p) {
  const all = St.allSubjects(), sel = selId(), q = (p.q || '').trim().toLowerCase();
  const row = s => `<button class="pl-row ${s.id === sel ? 'on' : ''}" data-a="playPick" data-id="${esc(s.id)}">${tile(s)}<span class="pl-nm">${esc(s.name)}</span>${s.id === sel ? `<span class="pl-ck">${I.check}</span>` : ''}</button>`;
  let body = '';
  if (q) {
    const hits = all.filter(s => s.name.toLowerCase().includes(q)).sort(cmp);
    body = hits.length ? `<div class="pl-rows">${hits.map(row).join('')}</div>`
      : `<p class="pl-none">Kein Fach gefunden.</p>${(p.q || '').trim().length > 1 ? `<button class="rm-btn line pl-addq" data-a="playAddQ">«${esc((p.q || '').trim().slice(0, 30))}» als eigenes Fach</button>` : ''}`;
  } else {
    const rec = lastIds().slice(0, 5).map(id => all.find(s => s.id === id)).filter(Boolean), used = new Set();
    if (rec.length) body += `<h5 class="pl-gh">Zuletzt benutzt</h5><div class="pl-rows">${rec.map(row).join('')}</div>`;
    for (const [title, ids] of GROUPS) { const l = ids.map(id => all.find(s => s.id === id)).filter(Boolean); l.forEach(s => used.add(s.id)); if (l.length) body += `<h5 class="pl-gh">${title}</h5><div class="pl-rows">${l.sort(cmp).map(row).join('')}</div>`; }
    const rest = all.filter(s => !used.has(s.id) && !s.id.startsWith('c-')).sort(cmp), own = all.filter(s => s.id.startsWith('c-')).sort(cmp);
    if (rest.length) body += `<h5 class="pl-gh">Weitere</h5><div class="pl-rows">${rest.map(row).join('')}</div>`;
    if (own.length) body += `<h5 class="pl-gh">Eigene Fächer</h5><div class="pl-rows">${own.map(row).join('')}</div>`;
  }
  return `<div class="rm-play pl-all">
    <div class="rm-play-h"><button class="icon-btn plain" data-a="playBackSubj" aria-label="Zurück">${I.back || '‹'}</button><h3>Fach wählen</h3><button class="icon-btn plain" data-a="closeSheet" aria-label="Schliessen">${I.x}</button></div>
    <input class="pl-search" type="search" data-bind="play.q" data-a-input="playQ" value="${esc(p.q || '')}" maxlength="30" placeholder="Fach suchen" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Fach suchen">
    <div class="pl-list">${body}</div>
    <div class="pl-own"><h5 class="pl-gh">Eigenes Fach hinzufügen</h5>
      <div class="pl-own-r"><input class="pl-search" data-bind="play.own" value="${esc(p.own || '')}" maxlength="30" placeholder="Name des Fachs" autocomplete="off" aria-label="Name des eigenen Fachs"><button class="pl-add" data-a="playAddOwn">Hinzufügen</button></div>
      ${p.ownErr ? `<p class="rm-err pl-err" role="alert">${esc(p.ownErr)}</p>` : ''}</div>
  </div>`;
}

export function playView() {
  const p = P(); if (p.pick) return listView(p);
  const all = St.allSubjects(), sel = selId(), busy = !!p.busy, cur = all.find(s => s.id === sel);
  const quick = QUICK.map(id => all.find(s => s.id === id)).filter(Boolean);
  const chips = quick.map(s => `<button class="pl-chip ${s.id === sel ? 'on' : ''}" data-a="playSubj" data-id="${esc(s.id)}">${dot(s)}<span>${esc(s.name)}</span></button>`).join('')
    + `<button class="pl-chip more" data-a="playAll">Alle anzeigen</button>`;
  const solo = `<section class="rm-card rm-solo pl-solo">
      <div class="seg rm-seg" role="group" aria-label="Modus">${[['free', 'Stoppuhr'], ['pomo', 'Pomodoro'], ['goal', 'Zielzeit']].map(([id, l]) => `<button class="${p.mode === id ? 'on' : ''}" data-a="playMode" data-id="${id}">${l}</button>`).join('')}</div>
      ${p.mode === 'goal' ? `<div class="rm-goals">${[30, 45, 60, 90, 120].map(m => `<button class="pl-goal ${p.goalMin === m ? 'on' : ''}" data-a="playGoal" data-m="${m}">${m} min</button>`).join('')}</div>` : ''}
      <button class="rm-btn red" data-a="playSolo">${I.play} Solo starten</button>
      <p class="pl-hint">${{ free: 'Die Zeit läuft, bis du fertig bist.', pomo: '25 Minuten Fokus, dann eine kurze Pause.', goal: 'Du lernst auf eine Zielzeit hin.' }[p.mode]}</p>
    </section>`;
  const room = `<section class="rm-card rm-room pl-room">
      <h4>Lernraum</h4>
      <p class="rm-sub">Lerne zusammen mit anderen. Ihr seht gegenseitig eure Lernzeit.</p>
      ${p.view === 'create' ? `
        <input class="rm-input" data-bind="play.name" value="${esc(p.name || '')}" maxlength="40" placeholder="Raumname, z. B. Mathe-Crew" autocomplete="off" aria-label="Raumname">
        <button class="rm-btn gold" data-a="playCreate" ${busy ? 'disabled' : ''}>${busy ? 'Raum wird erstellt…' : 'Raum erstellen'}</button>
        <button class="rm-btn line" data-a="playBack">Zurück</button>`
      : p.view === 'code' ? `
        <input class="rm-input rm-code" data-bind="play.code" value="${esc(p.code || '')}" maxlength="10" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABC123" aria-label="Code mit 6 Zeichen">
        <button class="rm-btn gold" data-a="playJoin" ${busy ? 'disabled' : ''}>${busy ? 'Einen Moment…' : 'Beitreten'}</button>
        <button class="rm-btn line" data-a="playBack">Zurück</button>`
      : `
        <button class="rm-btn gold" data-a="playRandom" ${busy ? 'disabled' : ''}>${busy ? 'Raum wird gesucht…' : 'Zufälligen Raum beitreten'}</button>
        <div class="pl-two"><button class="rm-btn line" ${CONFIG.PRO_ENABLED && !St.can('rooms') ? 'data-a="proNeed" data-reason="Eigene Lernräume erstellen gibt es mit Brained Pro oder dem Gruppen-Paket. Beitreten ist immer gratis."' : 'data-a="playCreateOpen"'}>Privaten Raum erstellen</button><button class="rm-btn line" data-a="playCodeOpen">Mit Code beitreten</button></div>`}
      ${p.err ? `<p class="rm-err" role="alert">${esc(p.err)}</p>` : ''}
    </section>`;
  return `<div class="rm-play pl">
    <div class="rm-play-h"><span></span><h3>Wie lernst du jetzt?</h3><button class="icon-btn plain" data-a="closeSheet" aria-label="Schliessen">${I.x}</button></div>
    <div class="pl-chips" role="group" aria-label="Fach">${chips}</div>
    ${cur && !QUICK.includes(sel) ? `<p class="pl-cur">Gewählt: ${dot(cur)}<b>${esc(cur.name)}</b></p>` : ''}
    ${solo}${room}
  </div>`;
}

export function playActions() {
  return {
    // Sheet öffnen: zuletzt benutztes Fach ist vorgewählt
    playOpen() { U.play = null; const p = P(), id = lastIds()[0] || 'mathe'; U.sheet = { type: 'play' }; if (!S.subjects.includes(id) && St.allSubjects().some(s => s.id === id)) S.subjects.push(id); p.subjectId = id; },
    playSubj(d) { pick(d.id); },
    playPick(d) { pick(d.id); const p = P(); p.pick = false; p.q = ''; },
    playAll() { const p = P(); p.pick = true; p.q = ''; p.own = ''; p.ownErr = ''; },
    playBackSubj() { const p = P(); p.pick = false; p.q = ''; },
    playAddQ() { const p = P(); addOwn(p, p.q); },
    playAddOwn() { const p = P(); addOwn(p, p.own); },
  };
}
export function playInput(ctx) { return { playQ(el) { P().q = el.value; ctx.render(); } }; }
export function playChange() { return {}; }

function addOwn(p, raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  p.ownErr = '';
  if (name.length < 2) { p.ownErr = 'Der Name braucht mindestens 2 Zeichen.'; return; }
  const bm = badMsg([name], { links: true }); if (bm) { p.ownErr = bm; return; }
  const ex = St.allSubjects().find(x => x.name.toLowerCase() === name.toLowerCase());
  if (ex) { pick(ex.id); } else {
    const id = 'c-' + St.uid(); S.customSubjects.push({ id, name, emoji: '📘', color: SUBJECT_COLORS[S.customSubjects.length % SUBJECT_COLORS.length] }); pick(id);
  }
  p.pick = false; p.q = ''; p.own = '';
}
