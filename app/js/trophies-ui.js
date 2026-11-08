// Trophäen-Liste und -Leiste (aus der Statistik ausgelagert; das Profil bindet sie ein). Zeilen brauchen einen .ovs-Container für die Stile (css/ov-stats.css).
import * as St from './store.js';
import { esc, ring } from './ui.js';
import { TROPHIES, TROPHY_GROUPS } from './data.js';

const S = St.S;

export function statsTrophies() {
  const L = St.levelInfo();
  const earnedKinds = TROPHIES.filter(t => S.trophies[t.id]).length;
  let h = `<div class="level-card"><div class="row" style="gap:14px">${ring(L.pct, { size: 76, stroke: 9, color: '#fff', track: 'rgba(255,255,255,.25)', inner: `<b style="font-size:22px">${L.lvl}</b>` })}
    <div class="grow"><div class="small bold" style="opacity:.85">${L.rank.em} ${L.rank.name.toUpperCase()}</div><b style="font-size:22px">${L.xp.toLocaleString('de-CH')} XP</b>
    <div class="small" style="opacity:.85">Noch ${L.toNext.toLocaleString('de-CH')} XP bis Level ${L.lvl + 1}</div></div></div>
    ${L.nextRank ? `<div class="rank-next">Nächster Rang: <b>${L.nextRank.em} ${L.nextRank.name}</b> ab Level ${L.nextRank.from}</div>` : ''}</div>`;
  h += `<div class="kpis"><div class="kpi center"><b>${St.trophyCount()}</b><span>Trophäen total</span></div><div class="kpi center"><b>${earnedKinds}/${TROPHIES.length}</b><span>Verschiedene</span></div><div class="kpi center"><b>${Math.max(0, ...Object.values(St.trophyMap()), 0)}×</b><span>Rekord</span></div></div>`;
  for (const [g, label] of TROPHY_GROUPS) {
    const list = TROPHIES.filter(t => t.g === g);
    h += `<div class="section-t">${label} <span class="faint" style="text-transform:none;letter-spacing:0">${list.filter(t => S.trophies[t.id]).length}/${list.length}</span></div><div class="trophy-grid">`;
    h += list.map(t => {
      const have = S.trophies[t.id], n = have?.n || 0, d = St.trophyDetail(t.id);
      return `<button class="trophy ${n ? '' : 'locked'}" data-a="openSheet" data-type="trophy" data-id="${t.id}">
        ${n > 1 ? `<span class="t-count">×${n}</span>` : ''}${t.repeat ? '<span class="t-rep" title="Mehrfach holbar">↻</span>' : ''}
        <div class="em">${t.em}</div><b>${t.name}</b>
        ${n ? `<span>${t.repeat ? 'Mehrfach holbar' : 'Freigeschaltet'}</span>` : `<div class="progress thin mt8"><i style="width:${d.pct * 100}%"></i></div>`}</button>`;
    }).join('') + '</div>';
  }
  return h + `<p class="center faint small mt16">XP: 1 pro Lernminute · +5 pro Pomodoro · +3 pro Check-in · +15 Zielzeit · +2 pro Karteikarte · +25 pro Trophäe</p>`;
}

// Trophäen-Leiste für Profile (eigene und fremde)
export function trophyStrip(map) {
  const list = TROPHIES.filter(t => map?.[t.id]).sort((a, b) => map[b.id] - map[a.id]);
  if (!list.length) return `<div class="card"><div class="faint tiny bold mb8">TROPHÄEN</div><p class="small muted">Noch keine Trophäen – das kommt!</p></div>`;
  return `<div class="card"><div class="row mb8"><div class="faint tiny bold grow">TROPHÄEN · ${list.reduce((a, t) => a + map[t.id], 0)}</div><span class="tiny faint bold">${list.length} verschiedene</span></div>
    <div class="t-strip">${list.map(t => `<div class="t-chip" title="${esc(t.name)}"><span class="e">${t.em}</span>${map[t.id] > 1 ? `<b>×${map[t.id]}</b>` : ''}<small>${esc(t.name)}</small></div>`).join('')}</div></div>`;
}
