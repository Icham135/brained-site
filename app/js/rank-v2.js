// Brained 2.0 – Rangliste: Alle | Freunde | Gruppen, bei «Alle» Länder- und Regionsfilter. Vertrag: docs/UMBAU-2.md
import * as St from './store.js';
import * as BK from './backend.js';
import { U } from './view-state.js';
import { esc, fmtShort, fmtHours, I, avatar } from './ui.js';
import { COMMUNITY, avatarFromSeed } from './data.js';

const S = St.S;
const sel = (a, b) => a === b ? 'on' : '';
const icon = (svg, n) => svg.replace('<svg', `<svg width="${n}" height="${n}"`);

/* ---------- Länder und Regionen (auch für Profil bearbeiten: js/profile-v2.js) ---------- */
export const COUNTRIES = [['', 'Alle'], ['CH', 'Schweiz'], ['DE', 'Deutschland'], ['AT', 'Österreich'], ['OTHER', 'Andere Länder']];
export const REGIONS = {
  CH: {
    label: 'Kanton', all: 'Alle Kantone', list: [['AG', 'Aargau'], ['AI', 'Appenzell Innerrhoden'], ['AR', 'Appenzell Ausserrhoden'], ['BE', 'Bern'], ['BL', 'Basel-Landschaft'], ['BS', 'Basel-Stadt'],
      ['FR', 'Freiburg'], ['GE', 'Genf'], ['GL', 'Glarus'], ['GR', 'Graubünden'], ['JU', 'Jura'], ['LU', 'Luzern'], ['NE', 'Neuenburg'], ['NW', 'Nidwalden'], ['OW', 'Obwalden'],
      ['SG', 'St. Gallen'], ['SH', 'Schaffhausen'], ['SO', 'Solothurn'], ['SZ', 'Schwyz'], ['TG', 'Thurgau'], ['TI', 'Tessin'], ['UR', 'Uri'], ['VD', 'Waadt'], ['VS', 'Wallis'], ['ZG', 'Zug'], ['ZH', 'Zürich']],
  },
  DE: {
    label: 'Bundesland', all: 'Alle Bundesländer', list: [['BW', 'Baden-Württemberg'], ['BY', 'Bayern'], ['BE', 'Berlin'], ['BB', 'Brandenburg'], ['HB', 'Bremen'], ['HH', 'Hamburg'], ['HE', 'Hessen'], ['MV', 'Mecklenburg-Vorpommern'],
      ['NI', 'Niedersachsen'], ['NW', 'Nordrhein-Westfalen'], ['RP', 'Rheinland-Pfalz'], ['SL', 'Saarland'], ['SN', 'Sachsen'], ['ST', 'Sachsen-Anhalt'], ['SH', 'Schleswig-Holstein'], ['TH', 'Thüringen']],
  },
  AT: {
    label: 'Bundesland', all: 'Alle Bundesländer', list: [['BG', 'Burgenland'], ['KT', 'Kärnten'], ['NO', 'Niederösterreich'], ['OO', 'Oberösterreich'], ['SB', 'Salzburg'], ['ST', 'Steiermark'], ['TI', 'Tirol'], ['VB', 'Vorarlberg'], ['WI', 'Wien']],
  },
};
const COUNTRY_NAME = Object.fromEntries(COUNTRIES.filter(c => c[0]));
export const regionName = (country, code) => REGIONS[country]?.list.find(r => r[0] === code)?.[1] || code || '';

/* ---------- Demo-Daten (ohne Backend): Schweiz aus COMMUNITY, dazu DE, AT, Andere, ohne Angabe ---------- */
const EXTRA = [
  ['Jana Hoffmann', 'janah', 'DE', 'BY'], ['Felix Wagner', 'felixw', 'DE', 'BW'], ['Mara Becker', 'marab', 'DE', 'NW'], ['Paul Schulz', 'pauls', 'DE', 'BE'], ['Lena Koch', 'lenak', 'DE', 'BY'], ['Ben Richter', 'benr', 'DE', 'HH'],
  ['Hannah Gruber', 'hannahg', 'AT', 'WI'], ['Lukas Mayer', 'lukasm', 'AT', 'ST'], ['Emilia Huber', 'emiliah', 'AT', 'TI'], ['Jakob Bauer', 'jakobb', 'AT', 'OO'], ['Valentina Rossi', 'valer', 'AT', 'WI'],
  ['Marco Esposito', 'marcoe', 'OTHER', ''], ['Ana Ferreira', 'anaf', 'OTHER', ''], ['Dario Petrovic', 'darip', 'OTHER', ''],
  ['Kim Walker', 'kimw', '', ''], ['Sam Lehmann', 'saml', '', ''],
];
let demoCache = null;
function demoPeople() {
  if (demoCache) return demoCache;
  const frac = (kind) => { const n = new Date(), d = new Date(n); d.setHours(0, 0, 0, 0); if (kind === 'w') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Math.max(.06, (n - d) / (7 * 864e5)); } d.setDate(1); return Math.max(.05, (n - d) / (new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() * 864e5)); };
  const extra = EXTRA.map(([name, username, country, region], i) => {
    const w = 120 + ((i * 197 + 61) % 900), m = Math.round(w * (3.4 + (i % 5) * .3)), a = Math.round(m * (3 + (i % 6)));
    return {
      id: 'x' + i, name, username, canton: country === 'CH' ? region : '', country, region, level: 'gym', avatar: avatarFromSeed(username, i + 40), streak: (i * 7) % 40, trophies: (i * 3) % 14,
      get weekMin() { return Math.round(w * frac('w')); }, get monthMin() { return Math.round(m * frac('m')); }, allMin: a,
    };
  });
  const ch = COMMUNITY.map(u => ({ ...Object.getOwnPropertyDescriptors(u) })).map(d => Object.defineProperties({}, d));
  ch.forEach(u => { u.country = 'CH'; u.region = u.canton; });
  return demoCache = [...ch, ...extra];
}

const myPlace = () => {
  const u = S.user || {}, country = u.country || (u.canton ? 'CH' : ''), region = u.region || (country === 'CH' ? u.canton || '' : '');
  return { country, region };
};
const matches = (u, country, region) => {
  if (!country) return true;
  const c = u.country || '';
  if (country === 'OTHER') { if (c && c !== 'OTHER') return false; } else if (c !== country) return false;
  return !region || u.region === region;
};

// Eine Rangliste (Liste von Personen mit value, rank, isMe) für die aktuelle Auswahl
function buildList({ scope, period, groupId, country, region }) {
  const key = period === 'week' ? 'weekMin' : period === 'month' ? 'monthMin' : 'allMin';
  if (St.remote.on) {
    const raw = (BK.R.lb2 || {})[BK.lb2Key({ scope, period, groupId, country, region })]?.rows;
    if (!raw) return null;
    const mine = St.me(), at = myPlace();
    let list = raw.map(u => u.id === S.user?.id ? { ...u, ...mine, ...at, value: u.value, place: u.place, isMe: true } : u);
    if (!list.some(u => u.isMe) && (scope !== 'global' || matches({ ...mine, ...at }, country, region))) {
      list.push({ ...mine, ...at, value: mine[key], place: list.filter(u => u.value > mine[key]).length + 1 });
      list.sort((a, b) => b.value - a.value);
    }
    return list.map((u, i) => ({ ...u, rank: u.place && u.isMe && i >= 200 ? u.place : i + 1 }));
  }
  let list;
  const mine = { ...St.me(), ...myPlace() };
  if (scope === 'global') list = demoPeople().filter(u => matches(u, country, region)).concat(matches(mine, country, region) ? [mine] : []);
  else list = St.leaderboard({ scope, period, groupId }).map(u => u.isMe ? { ...u, ...myPlace() } : { ...u, country: 'CH', region: u.canton });
  return list.map(u => ({ ...u, value: u[key] })).sort((a, b) => b.value - a.value).map((u, i) => ({ ...u, rank: i + 1 }));
}

/* ---------- Laden (Backend) ---------- */
let renderFn = () => { }, toastFn = () => { };
const loading = new Set(), tried = {};
const curGroup = () => U.rankScope === 'group' ? (S.groups.some(g => g.id === U.rankGroup) ? U.rankGroup : S.groups[0]?.id || null) : null;
const query = () => ({ scope: U.rankScope || 'global', period: U.rankPeriod || 'week', groupId: curGroup(), country: U.rankScope === 'global' ? (U.rankCountry || '') : '', region: U.rankScope === 'global' ? (U.rankRegion || '') : '' });
async function load(q, force) {
  if (!BK.enabled || !S.user?.id) return;
  if (q.scope === 'group' && !q.groupId) return;
  const k = BK.lb2Key(q), c = BK.R.lb2?.[k];
  if (loading.has(k) || (!force && c && Date.now() - c.ts < 60e3) || (!c && tried[k] && Date.now() - tried[k] < 15e3)) return;
  loading.add(k); tried[k] = Date.now();
  try { await BK.loadRankV2(q); delete tried[k]; } catch (e) { if (!c) toastFn(esc(e.message)); } finally { loading.delete(k); renderFn(); }
}
const ensure = () => { const q = query(); const k = BK.lb2Key(q); const c = BK.R.lb2?.[k]; if (BK.enabled && S.user?.id && (!c || Date.now() - c.ts >= 60e3) && !loading.has(k)) setTimeout(async () => { if (q.scope === 'group' && !S.groups.length) await BK.loadGroups().catch(() => { }); load({ ...q, groupId: curGroup() }); }, 0); return loading.size > 0 || !c; };

/* ---------- Ansicht ---------- */
const crown = '<svg class="rk-crown" width="26" height="22" viewBox="0 0 26 22" aria-hidden="true"><path d="M2 7l6 5 5-9 5 9 6-5-2 13H4z" fill="#FFC93C" stroke="#B87A00" stroke-width="1.4" stroke-linejoin="round"/></svg>';
const rkIcon = (p) => `<svg class="rk-ico" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICO_FRIENDS = rkIcon('<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><circle cx="17.5" cy="9" r="2.4"/><path d="M17 14.2a4 4 0 0 1 4 3.8V19"/>');
const ICO_GROUP = rkIcon('<path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-6h6v6"/>');
const ICO_EMPTY = rkIcon('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>');

// Liga-Medaillen als Vektor (statt Emoji): Farbe je Liga-Familie
const FAM = { bronze: ['#E3A072', '#9C5530'], silber: ['#C9CFDA', '#6B7385'], gold: ['#FFD25A', '#D98A00'], platin: ['#5FE0D6', '#1F8A9E'], diamant: ['#5CC6F5', '#3F5BD9'], meister: ['#B28CFF', '#5B2FD6'], grossmeister: ['#FF9A5C', '#D6246E'], legende: ['#FF8FB5', '#6D5BFF'] };
const medal = (fam, n = 40) => { const [a, b] = FAM[fam] || FAM.bronze, id = 'mg' + fam;
  return `<svg class="rk-medal" width="${n}" height="${n}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><circle cx="20" cy="20" r="17" fill="url(#${id})" stroke="rgba(255,255,255,.85)" stroke-width="2.5"/><path d="M20 10.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z" fill="#fff" fill-opacity=".92"/></svg>`; };
function leagueCard() {
  const tot = St.totalMin(), L = St.leagueFor(tot), N = St.nextLeague(tot);
  return `<button class="league" style="background:${L.grad}" data-a="openSheet" data-type="leagues"><div class="medal">${medal(L.fam, 40)}</div><div class="grow"><b>${L.name}</b><span>${N ? `Noch ${fmtHours(N.min - tot)} Lernzeit bis ${N.name}` : 'Höchste Liga erreicht – Legende!'}</span>
    <div class="progress thin mt8" style="background:rgba(255,255,255,.25)"><i style="background:#fff;width:${N ? Math.min(100, (tot - L.min) / (N.min - L.min) * 100) : 100}%"></i></div></div>${I.chev.replace('<svg', '<svg class="chev" style="color:#fff;opacity:.8"')}</button>`;
}
const FLAG = { CH: '🇨🇭', DE: '🇩🇪', AT: '🇦🇹' };
// Klares System: 1) Land (4 gleich breite Felder), 2) Kanton/Bundesland als Chips (eigene Region zuerst), 3) Zeile «Zeigt: …» mit Zurücksetzen
function filters() {
  const country = U.rankCountry || '', region = U.rankRegion || '', R = REGIONS[country], mine = myPlace(), isMine = c => mine.country === country && mine.region === c;
  let h = `<div class="rk-where"><div class="seg rk-seg rk-ctry" role="group" aria-label="Land">${[['', 'Alle'], ['CH', 'Schweiz'], ['DE', 'Deutschland'], ['AT', 'Österreich']].map(([id, l]) => `<button class="${sel(country, id)}" data-a="rankCountry" data-id="${id}">${FLAG[id] ? `<i>${FLAG[id]}</i>` : ''}<span>${l}</span></button>`).join('')}</div>`;
  if (R) {
    const list = R.list.slice().sort((x, y) => isMine(y[0]) - isMine(x[0]));
    h += `<div class="rk-regs" role="group" aria-label="${R.label}"><button class="rk-reg ${sel(region, '')}" data-a="rankRegionPick" data-id="">${R.all}</button>${list.map(([c, n]) => `<button class="rk-reg ${sel(region, c)}" data-a="rankRegionPick" data-id="${c}"><b>${c}</b><span>${esc(n)}</span>${isMine(c) ? '<em>Mein Ort</em>' : ''}</button>`).join('')}</div>`;
  }
  const where = region ? `${COUNTRY_NAME[country]} · ${esc(regionName(country, region))}` : country ? COUNTRY_NAME[country] : 'Alle Länder';
  return h + `<div class="rk-status"><span>Zeigt: <b>${where}</b></span><span class="rk-st-b"><button class="rk-oth ${sel(country, 'OTHER')}" data-a="rankCountry" data-id="OTHER">Andere Länder</button>${country ? '<button data-a="rankCountry" data-id="">Zurücksetzen</button>' : ''}</span></div></div>`;
}
function whereTag(u) {
  const r = u.region || (u.country === 'CH' ? u.canton : '');
  if (r && (!u.country || u.country === 'CH')) return esc(r);
  if (r) return `${esc(r)} · ${esc(u.country)}`;
  return u.country && u.country !== 'OTHER' ? esc(u.country) : '';
}
function leagueTag(min) { const L = St.leagueFor(min || 0); return `<span class="lg-tag lg-${L.fam}">${medal(L.fam, 13)} ${L.name}</span>`; }
function rankRow(u) {
  const w = whereTag(u);
  return `<button class="li ${u.isMe ? 'me' : ''}" data-a="openUser" data-id="${u.id}"><span class="rank-n">${u.rank}</span>${avatar(u.avatar, 42, u.name)}
    <div class="t"><b>${esc(u.isMe ? `${u.name} (Du)` : u.name)}</b><div class="mini-stats">${leagueTag(u.allMin)}<span>${icon(I.trophy, 12)} ${u.trophies || 0}</span>${w ? `<span>${w}</span>` : ''}</div></div><div class="r">${fmtShort(u.value)}</div></button>`;
}
const empty = (ico, title, text, btns = '') => `<div class="empty rk-empty">${ico}<b>${title}</b><div class="small">${text}</div>${btns ? `<div class="rk-btns">${btns}</div>` : ''}</div>`;

// «Dein Platz» erscheint erst, wenn beim Runterscrollen Platz 4 (erste Zeile der Liste) den Play-Button erreicht
let meOn = false;
function checkMe() {
  const bar = document.querySelector('.rk-me'); if (!bar) return;
  const first = document.querySelector('[data-keep="tab-rank"] .list .li'), btn = document.querySelector('.tab-start button') || document.querySelector('.tabbar');
  meOn = !first || !btn || first.getBoundingClientRect().top <= btn.getBoundingClientRect().top;
  bar.classList.toggle('show', meOn);
}
let meBound = false;
export function rankV2View() {
  const q = query(), scope = q.scope;
  let h = leagueCard();
  h += `<div class="seg rk-seg mb12">${[['global', 'Alle'], ['friends', 'Freunde'], ['group', 'Gruppen']].map(([id, l]) => `<button class="${sel(scope, id)}" data-a="rankScope" data-id="${id}">${l}</button>`).join('')}</div>`;
  if (scope === 'global') h += filters();
  if (scope !== 'group') h += `<div class="seg sm rk-period mb12">${[['week', 'Woche'], ['month', 'Monat'], ['all', 'Allzeit']].map(([id, l]) => `<button class="${sel(q.period, id)}" data-a="rankPeriod" data-id="${id}">${l}</button>`).join('')}</div>`;
  if (scope === 'friends') h += `<div class="rk-btns mb12"><button class="btn primary sm rk-red" data-a="openSheet" data-type="friend">${icon(I.userPlus, 17)} Hinzufügen</button></div>`;

  if (scope === 'group') {
    if (!S.groups.length) return h + empty(ICO_GROUP, 'Noch in keiner Gruppe', 'Erstell eine Gruppe für deine Klasse, Lerngruppe oder WG – oder tritt mit einem Code bei.',
      `<button class="btn primary sm rk-red" data-a="openSheet" data-type="groupCreate">Gruppe erstellen</button><button class="btn outline sm" data-a="openSheet" data-type="groupJoin">Code eingeben</button>`);
    const g = S.groups.find(g => g.id === q.groupId), gm = St.groupWeekMin(g);
    h += `<div class="rk-grp"><label class="rk-grp-l" for="rkGrpSel">Meine Gruppen</label>
      <select class="select rk-grp-sel" id="rkGrpSel" aria-label="Meine Gruppen" data-a-change="rankGroupSel">${S.groups.map(x => `<option value="${esc(x.id)}" ${x.id === q.groupId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <div class="rk-grp-btns"><button class="btn primary sm rk-red" data-a="openSheet" data-type="groupCreate">Gruppe erstellen</button><button class="btn outline sm" data-a="openSheet" data-type="groupJoin">Beitreten</button></div></div>
      <div class="card"><div class="group-card"><div class="group-em rk-gi" style="background:${safeCol(g.color)}">${esc([...g.name][0] || '')}</div><div class="grow"><b style="font-size:17px">${esc(g.name)}</b><div class="small faint bold">${g.members.length + 1} ${g.members.length ? 'Mitglieder' : 'Mitglied'} · Code ${esc(g.code)}</div></div><button class="btn primary sm rk-red" data-a="openSheet" data-type="invite" data-id="${g.id}">${icon(I.share, 16)} Einladen</button></div>
        ${g.owner ? `<div class="rk-btns mt8"><button class="btn outline sm" data-a="openSheet" data-type="groupEdit" data-id="${g.id}">Gruppe bearbeiten (Admin)</button></div>` : ''}
        <div class="row mt16 small bold"><span class="grow">Gruppen-Wochenziel</span><span class="num">${fmtHours(gm)} / ${g.weeklyGoalH} h</span></div><div class="progress mt8 good"><i style="width:${Math.min(100, gm / (g.weeklyGoalH * 60) * 100)}%"></i></div>
        <p class="tiny faint mt8">Gemeinsames Ziel: Alle Minuten der Gruppe zählen zusammen.</p></div>`;
  }

  const waiting = ensure();
  const list = buildList(q);
  if (!list) return h + `<div class="rk-wait small faint bold">${waiting ? 'Rangliste lädt …' : 'Rangliste nicht verfügbar'}</div>${waiting ? '' : `<div class="rk-btns"><button class="btn primary sm rk-red" data-a="rankReload">Nochmals versuchen</button></div>`}`;
  if (scope === 'friends' && list.length <= 1) h += empty(ICO_FRIENDS, 'Lad deine Freunde ein', 'Zusammen lernen motiviert – und macht Ranglisten spannend.');
  if (scope === 'global' && list.filter(u => !u.isMe).length === 0) h += empty(ICO_EMPTY, 'Noch niemand hier', 'In dieser Auswahl hat noch niemand Lernzeit. Du kannst die Erste oder der Erste sein.');

  const top = list.slice(0, 3);
  if (top.length >= 3) {
    const pod = (u, n) => `<button class="pod p${n}" data-a="openUser" data-id="${u.id}">${n === 1 ? `<span class="crown">${crown}</span>` : ''}<div class="pod-av ${n === 1 ? 'av-ring' : ''}">${avatar(u.avatar, n === 1 ? 66 : 54, u.name)}</div><span class="name">${esc(u.isMe ? 'Du' : u.name.split(' ')[0])}</span><span class="val">${fmtShort(u.value)}</span><div class="block">${n}</div></button>`;
    h += `<div class="podium ovr-podium rk-podium">${pod(top[1], 2)}${pod(top[0], 1)}${pod(top[2], 3)}</div>`;
  }
  const rest = top.length >= 3 ? list.slice(3) : list;
  if (rest.length) h += `<div class="list">${rest.slice(0, 25).map(rankRow).join('')}</div>`;
  const me = list.find(u => u.isMe);
  if (me) setTimeout(checkMe, 0);
  if (me) h += `<div class="rk-me ${meOn ? 'show' : ''}" aria-label="Dein Platz"><span class="rk-me-n">${me.rank}</span>${avatar(me.avatar, 36, me.name)}<div class="grow"><b>Dein Platz</b><span>${esc(q.scope === 'global' ? scopeLabel(q) : scope === 'friends' ? 'Freunde' : 'Gruppe')}</span></div><div class="rk-me-v">${fmtShort(me.value)}</div></div>`;
  return h + `<p class="center faint tiny mt8">Rangliste zählt nur verifizierte Zeit (Auto-Pause + Check-ins). Max. 14 h/Tag.</p>`;
}
const safeCol = c => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#5B6CFF';
function scopeLabel(q) { return q.region ? regionName(q.country, q.region) : q.country ? COUNTRY_NAME[q.country] : 'Alle'; }

/* ---------- Aktionen ---------- */
export function rankActions(ctx = {}) {
  renderFn = ctx.render || renderFn; toastFn = ctx.toast || toastFn;
  if (!meBound && typeof document !== 'undefined') { meBound = true; document.addEventListener('scroll', e => { if (e.target?.classList?.contains('content')) checkMe(); }, true); }
  const go = () => { renderFn(); setTimeout(() => load(query()), 0); };
  return {
    rankScope(d) { U.rankScope = d.id; go(); },
    rankPeriod(d) { U.rankPeriod = d.id; go(); },
    rankGroup(d) { U.rankGroup = d.id; go(); },
    rankRegionPick(d) { U.rankRegion = d.id || ''; U.rankCanton = U.rankCountry === 'CH' ? U.rankRegion : ''; renderFn(); setTimeout(() => load(query()), 0); },
    rankCountry(d) { U.rankCountry = d.id; U.rankRegion = ''; U.rankCanton = ''; go(); },
    rankReload() { load(query(), true); renderFn(); },
  };
}
export function rankChange(ctx = {}) {
  renderFn = ctx.render || renderFn; toastFn = ctx.toast || toastFn;
  return {
    rankGroupSel(el) { U.rankGroup = el.value; renderFn(); setTimeout(() => load(query()), 0); },
    rankRegion(el) { U.rankRegion = el.value; U.rankCanton = U.rankCountry === 'CH' ? el.value : ''; renderFn(); setTimeout(() => load(query()), 0); },
  };
}
