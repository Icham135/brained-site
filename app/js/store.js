// Zentraler Zustand + abgeleitete Kennzahlen. Persistiert in localStorage.
// Später 1:1 durch Supabase-Tabellen ersetzbar (siehe README).
import { CONFIG } from './config.js';
import { SUBJECTS, TROPHIES, RANKS, COMMUNITY, SEED_GROUPS, GLOBAL_CHALLENGES, LEAGUES, SHOP_ITEMS, SHOP_BUNDLES, BRAIN_SKINS, SHOP_FRAMES, SHOP_CONSUMABLES, COIN_BONUS, PRO } from './data.js';

// ?test im URL → isolierter Speicher (für die automatische Test-Suite unter /tests/)
const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
const SHOW = typeof location !== 'undefined' && new URLSearchParams(location.search).has('showcase');
const KEY = SHOW ? 'brained.showcase' : TEST ? 'brained.test' : 'brained.v1';
const REG_KEY = TEST ? 'brained.test.registry' : 'brained.registry';
const LANG = ['deutsch', 'franz', 'englisch', 'ital'];

function defaults() {
  return {
    user: null,
    subjects: [], customSubjects: [], subjectColors: {},
    sessions: [], planned: [], challenges: [], joinedChallenges: {},
    groups: [], friends: [], flashcards: [], trophies: {}, boosts: {}, exams: [], examDocs: [], studyPlans: [], games: {}, quiz: {}, shop: { owned: [], spent: 0 }, plan: { pro: false }, freeze: { stock: 0, days: [], month: '' },
    timer: null,
    settings: { apiKey: '', model: 'claude-opus-5', checkinMin: 60, pauseOnLeave: true, theme: 'auto', lang: '' },
    stats: { checkins: 0, reviews: 0, feynmanBest: 0, feyn80: 0, exam55: 0, exam6: 0, examBest: 0, solved: 0, plans: 0, boosts: 0, reviewDays: {} },
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = defaults(), p = JSON.parse(raw); return { ...d, ...p, settings: { ...d.settings, ...p.settings }, stats: { ...d.stats, ...p.stats } }; }
  } catch { }
  return defaults();
}
export const S = load();
let resetting = false; // verhindert, dass pagehide die gelöschten Daten zurückschreibt
// remote: wird von backend.js gesetzt (echte Community statt Demo) · hooks.onSave: Sync anstossen
export const remote = { on: false, R: null };
export const hooks = { onSave: null };
export function save() { if (resetting) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } hooks.onSave?.(); }
export function resetAll() { resetting = true; try { localStorage.removeItem(KEY); } catch { } location.reload(); }
export const uid = () => Math.random().toString(36).slice(2, 10);

// Live-Minuten der laufenden Session (wird von timer.js gesetzt)
export const live = { min: () => 0, subjectId: () => null };

// ---------- Datum ----------
const p2 = n => String(n).padStart(2, '0');
export const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
export const startOfWeek = ts => { const d = startOfDay(ts); return addDays(d, -((new Date(d).getDay() + 6) % 7)); };
export const startOfMonth = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

// ---------- Fächer ----------
export function allSubjects() {
  return [...SUBJECTS, ...S.customSubjects].map(s => S.subjectColors[s.id] ? { ...s, color: S.subjectColors[s.id] } : s);
}
// Vorschläge passend zur Schulstufe + eigene + bereits gewählte Fächer
export function subjectsForLevel(level, keep = S.subjects) {
  return allSubjects().filter(s => !s.lv || !level || s.lv.includes(level) || keep.includes(s.id));
}
export function mySubjects() {
  const all = allSubjects();
  const list = S.subjects.map(id => all.find(s => s.id === id)).filter(Boolean);
  return list.length ? list : all.slice(0, 6);
}
export function subj(id) { return allSubjects().find(s => s.id === id) || { id, name: 'Allgemein', emoji: '📚', color: '#9893A8' }; }

// ---------- Kennzahlen ----------
export function minutesIn(from, to = Infinity, filter) {
  let m = S.sessions.filter(s => s.start >= from && s.start < to && (!filter || filter(s))).reduce((a, s) => a + s.min, 0);
  if (S.timer && Date.now() >= from && Date.now() < to && (!filter || filter({ subjectId: S.timer.subjectId, start: Date.now(), min: live.min() }))) m += live.min();
  return m;
}
export const todayMin = () => minutesIn(startOfDay(Date.now()));
export const weekMin = () => minutesIn(startOfWeek(Date.now()));
export const monthMin = () => minutesIn(startOfMonth(Date.now()));
export const totalMin = () => minutesIn(0);
export const weekGoal = () => S.user?.weeklyGoalMin || 600;

export function dayTotals() {
  const m = {};
  for (const s of S.sessions) { const k = dayKey(s.start); m[k] = (m[k] || 0) + s.min; }
  if (S.timer) { const k = dayKey(Date.now()); m[k] = (m[k] || 0) + live.min(); }
  return m;
}

const STREAK_MIN = 5; // ab 5 Minuten zählt ein Tag
export function streakInfo() {
  const m = dayTotals();
  const today = startOfDay(Date.now());
  const todayDone = (m[dayKey(today)] || 0) >= STREAK_MIN;
  const frozen = new Set(S.freeze?.days || []); // Streak-Schutz: dieser Tag zählt, ohne gelernt zu haben
  const ok = k => (m[k] || 0) >= STREAK_MIN || frozen.has(k);
  let d = todayDone ? today : addDays(today, -1), current = 0;
  while (ok(dayKey(d))) { current++; d = addDays(d, -1); }
  const days = [...new Set([...Object.keys(m).filter(k => m[k] >= STREAK_MIN), ...frozen])].sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const [y, mo, da] = k.split('-').map(Number), t = new Date(y, mo - 1, da).getTime();
    run = prev !== null && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { current, todayDone, atRisk: !todayDone && current > 0, best: Math.max(best, current), freezes: S.freeze?.stock || 0 };
}
// Streak-Schutz automatisch einsetzen: gestern verpasst, Streak davor lief → 1 Schutz verbrauchen.
// Pro bekommt jeden Monat 2 neue (max. 4 auf Vorrat). Gibt true zurück, wenn heute ein Schutz eingesetzt wurde.
export function applyFreeze() {
  if (!S.user) return false;
  S.freeze = S.freeze || { stock: 0, days: [], month: '' };
  const month = dayKey(Date.now()).slice(0, 7);
  if (isPro() && S.freeze.month !== month) { S.freeze.stock = Math.min(4, (S.freeze.stock || 0) + PRO.freezesPerMonth); S.freeze.month = month; }
  const m = dayTotals(), today = startOfDay(Date.now()), y = dayKey(addDays(today, -1)), yy = dayKey(addDays(today, -2));
  const done = k => (m[k] || 0) >= STREAK_MIN || S.freeze.days.includes(k);
  if (!done(y) && done(yy) && S.freeze.stock > 0) { S.freeze.days = [...S.freeze.days.slice(-60), y]; S.freeze.stock--; save(); return true; }
  return false;
}
export const isPro = () => (remote.on ? !!S.plan?.pro : !!S.user?.pro);

export function xpTotal() { return S.sessions.reduce((a, s) => a + (s.xp || 0), 0) + S.stats.reviews * 2 + S.stats.checkins * 3 + trophyCount() * 25; }
// Level n braucht 60·(n−1)^1.8 XP kumuliert → am Anfang schnell, später echte Arbeit
const xpFor = n => Math.round(60 * Math.pow(n - 1, 1.8));
export function levelInfo() {
  const xp = xpTotal();
  let lvl = 1; while (xpFor(lvl + 1) <= xp) lvl++;
  const cur = xpFor(lvl), next = xpFor(lvl + 1);
  const rank = [...RANKS].reverse().find(r => lvl >= r.from), nextRank = RANKS.find(r => r.from > lvl);
  return { xp, lvl, pct: (xp - cur) / (next - cur), toNext: next - xp, rank, nextRank };
}
export function leagueFor(min) { let L = LEAGUES[0]; for (const l of LEAGUES) if (min >= l.min) L = l; return L; }
export function nextLeague(min) { return LEAGUES.find(l => l.min > min) || null; }

// ---------- Trophäen ----------
function weekKey(ts) { return dayKey(startOfWeek(ts)); }
export function trophyContext() {
  const ss = S.sessions, st = streakInfo(), now = Date.now();
  const days = {}; ss.forEach(s => { const k = dayKey(s.start); days[k] = (days[k] || 0) + s.min; });
  const dayKeys = Object.keys(days).filter(k => days[k] >= 5).sort();
  // Wochen-Auswertung
  const weeks = {};
  for (const s of ss) {
    const w = weekKey(s.start); const W = weeks[w] ||= { min: 0, days: new Set(), subs: new Set() };
    W.min += s.min; if (days[dayKey(s.start)] >= 5) W.days.add(dayKey(s.start)); W.subs.add(s.subjectId);
  }
  const thisWeek = weeks[weekKey(now)] || { min: 0, days: new Set(), subs: new Set() };
  const goal = weekGoal();
  // Wochenenden: Sa + folgender So
  let weekends = 0;
  for (const k of dayKeys) { const [y, m, d] = k.split('-').map(Number), t = new Date(y, m - 1, d); if (t.getDay() === 6 && days[dayKey(addDays(t.getTime(), 1))] >= 5) weekends++; }
  const sat = addDays(startOfWeek(now), 5);
  const weekendDaysNow = [sat, addDays(sat, 1)].filter(t => (days[dayKey(t)] || 0) >= 5).length;
  // Comebacks: Lücke ≥ 3 Tage zwischen zwei Lerntagen
  let comebacks = 0;
  for (let i = 1; i < dayKeys.length; i++) { const a = new Date(dayKeys[i - 1]), b = new Date(dayKeys[i]); if ((b - a) / 864e5 >= 4) comebacks++; }
  const allCh = [...S.challenges.map(c => ({ ...c, kind: 'custom' })), ...GLOBAL_CHALLENGES.filter(c => S.joinedChallenges[c.id])];
  return {
    sessions: ss.length, totalMin: totalMin(), bestStreak: st.best, longest: Math.max(0, ...ss.map(s => s.min)),
    goalWeeks: Object.values(weeks).filter(w => w.min >= goal).length, weekMin: thisWeek.min, weekGoal: goal,
    perfectWeeks: Object.values(weeks).filter(w => w.days.size >= 7).length, daysThisWeek: thisWeek.days.size,
    weekends, weekendDaysNow,
    early: ss.filter(s => new Date(s.start).getHours() < 7).length,
    night: ss.filter(s => new Date(s.start).getHours() >= 22).length,
    allroundWeeks: Object.values(weeks).filter(w => w.subs.size >= 5).length, subjectsThisWeek: thisWeek.subs.size,
    comebacks,
    deep: ss.filter(s => s.min >= 90).length, marathon: ss.filter(s => s.min >= 180).length,
    pomo4: ss.filter(s => (s.pomos || 0) >= 4).length, maxPomos: Math.max(0, ...ss.map(s => s.pomos || 0)),
    goalHits: ss.filter(s => s.goalHit).length, checkins: S.stats.checkins,
    feyn80: S.stats.feyn80 || 0, feynBest: S.stats.feynmanBest || 0,
    exam55: S.stats.exam55 || 0, exam6: S.stats.exam6 || 0, examBest: S.stats.examBest || 0,
    cardDays: Object.values(S.stats.reviewDays || {}).filter(n => n >= 25).length, cardsToday: (S.stats.reviewDays || {})[dayKey(now)] || 0,
    solved: S.stats.solved || 0, gameRecords: S.stats.gameRecords || 0, plans: S.stats.plans || 0,
    groups: S.groups.length, friends: S.friends.length, boosts: S.stats.boosts || 0,
    challengesDone: allCh.filter(c => { const p = challengeProgress(c); return p.value >= p.target; }).length,
  };
}
// Alte Speicherform {id: timestamp} → {id: {n, first, last}}
function migrateTrophies() {
  for (const [k, v] of Object.entries(S.trophies)) if (typeof v === 'number') S.trophies[k] = { n: 1, first: v, last: v };
  for (const k of Object.keys(S.trophies)) if (!TROPHIES.some(t => t.id === k)) delete S.trophies[k];
}
export function checkTrophies() {
  migrateTrophies();
  const ctx = trophyContext(), fresh = [];
  for (const t of TROPHIES) {
    const n = t.count(ctx), have = S.trophies[t.id]?.n || 0;
    if (n > have) { S.trophies[t.id] = { n, first: S.trophies[t.id]?.first || Date.now(), last: Date.now() }; fresh.push({ ...t, n }); }
  }
  if (fresh.length) save();
  return fresh;
}
export function trophyDetail(id) {
  const t = TROPHIES.find(x => x.id === id); if (!t) return null;
  const [v, target] = t.prog(trophyContext());
  return { ...t, have: S.trophies[id] || null, value: Math.round(Math.min(v, target) * 10) / 10, target, pct: Math.max(0, Math.min(1, v / target)) };
}
// ---------- Shop (Brain-Coins) ----------
export const shopItem = id => SHOP_ITEMS.find(x => x.id === id) || BRAIN_SKINS.find(x => x.id === id) || SHOP_FRAMES.find(x => x.id === id) || SHOP_BUNDLES.find(x => x.id === id) || SHOP_CONSUMABLES.find(x => x.id === id);
// Mit Backend kommen Kontostand & Besitz vom Server (fälschungssicher), sonst lokal (Demo)
export const coins = () => remote.on && remote.R.shop ? remote.R.shop.balance : Math.max(0, xpTotal() + COIN_BONUS - (S.shop?.spent || 0));
const ownedList = () => remote.on && remote.R.shop ? remote.R.shop.owned : (S.shop?.owned || []);
const bundleParts = b => Object.entries(b.set).filter(([k]) => k !== 'mood').map(([, v]) => v);
export const owns = id => {
  const it = shopItem(id); if (!it) return false;
  if (it.set) return bundleParts(it).every(owns);
  if (it.pro) return ownedList().includes(id) || (!remote.on && isPro());
  return it.price === 0 || ownedList().includes(id);
};
export function buy(id) {
  const it = shopItem(id); if (!it || (!it.consumable && owns(id))) return false;
  if (it.pro && !isPro()) return false;
  if (SHOP_CONSUMABLES.some(c => c.id === id)) { if (coins() < it.price) return false; S.shop = { ...S.shop, spent: (S.shop?.spent || 0) + it.price }; S.freeze.stock = (S.freeze.stock || 0) + 1; save(); return true; }
  if (coins() < it.price) return false;
  const add = it.set ? bundleParts(it) : [id];
  S.shop = { owned: [...new Set([...(S.shop?.owned || []), ...add])], spent: (S.shop?.spent || 0) + it.price };
  save(); return true;
}
export const trophyCount = () => Object.values(S.trophies).reduce((a, v) => a + (typeof v === 'number' ? 1 : v.n || 0), 0);
export const trophyMap = () => Object.fromEntries(Object.entries(S.trophies).map(([k, v]) => [k, typeof v === 'number' ? 1 : v.n]));

// ---------- Community / Rangliste ----------
export function me() {
  const u = S.user;
  return { id: u.id || 'me', isMe: true, name: u.name, username: u.username, canton: u.canton, level: u.level, avatar: u.avatar,
    weekMin: weekMin(), monthMin: monthMin(), allMin: totalMin(), streak: streakInfo().current, trophies: trophyCount(), trophyMap: trophyMap(), bio: u.bio || '' };
}
export const person = id => (id === 'me' || id === S.user?.id) ? me() : remote.on ? remote.R.people[id] : COMMUNITY.find(u => u.id === id);
export function leaderboard({ scope = 'global', period = 'week', groupId, canton }) {
  if (remote.on) {
    const key = [scope, period, groupId || '', canton || ''].join('|');
    const list = (remote.R.lb[key] || []).map(u => u.id === S.user?.id ? { ...u, ...me(), value: u.value, rank: u.rank, isMe: true } : u);
    if (!list.some(u => u.isMe) && (scope !== 'global' || !canton || canton === S.user?.canton)) {
      const k = period === 'week' ? 'weekMin' : period === 'month' ? 'monthMin' : 'allMin', mine = me();
      list.push({ ...mine, value: mine[k], rank: list.filter(u => u.value > mine[k]).length + 1 });
      list.sort((a, b) => b.value - a.value);
    }
    return list;
  }
  let list = COMMUNITY;
  if (scope === 'friends') list = COMMUNITY.filter(u => S.friends.includes(u.id));
  if (scope === 'group') { const g = S.groups.find(g => g.id === groupId); list = g ? COMMUNITY.filter(u => g.members.includes(u.id)) : []; }
  if (scope === 'global' && canton) list = list.filter(u => u.canton === canton);
  const key = period === 'week' ? 'weekMin' : period === 'month' ? 'monthMin' : 'allMin';
  const mine = me();
  const all = [...list, ...(scope !== 'global' || !canton || canton === mine.canton ? [mine] : [])];
  return all.map(u => ({ ...u, value: u[key] })).sort((a, b) => b.value - a.value).map((u, i) => ({ ...u, rank: i + 1 }));
}
export function groupWeekMin(g) { if (remote.on) return g.weekMin || 0; return COMMUNITY.filter(u => g.members.includes(u.id)).reduce((a, u) => a + u.weekMin, 0) + weekMin(); }

// Gruppen-Registry: simuliert den Server (eigener Speicher, überlebt Abmelden). Später → Supabase-Tabelle `groups`.
function registry() { try { return JSON.parse(localStorage.getItem(REG_KEY)) || []; } catch { return []; } }
function saveRegistry(r) { try { localStorage.setItem(REG_KEY, JSON.stringify(r)); } catch { } }
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I – verwechslungssicher
export const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export function findGroupByCode(code) {
  code = normCode(code);
  return SEED_GROUPS.find(g => g.code === code) || registry().find(g => g.code === code) || null;
}
export function createGroup(name, emoji, color) {
  let code;
  do code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  while (findGroupByCode(code));
  const g = { id: 'g-' + uid(), name, emoji, color, code, members: [], weeklyGoalH: 20, owner: true, created: Date.now(), createdBy: S.user?.username };
  S.groups.push(g);
  saveRegistry([...registry(), { ...g, owner: false, members: [] }]);
  save(); return g;
}
export function joinGroup(code) {
  code = normCode(code);
  if (code.length !== 6) return { error: 'Der Code hat 6 Zeichen.' };
  if (S.groups.some(g => g.code === code)) return { error: 'Du bist schon in dieser Gruppe.' };
  const g = findGroupByCode(code);
  if (!g) return { error: 'Code nicht gefunden. Prüf die Schreibweise – Demo-Codes: KANTI4, BASIS1, LAP026.' };
  const copy = { ...structuredClone(g), owner: false, joined: Date.now() };
  S.groups.push(copy); save(); return { group: copy };
}
export function leaveGroup(id) {
  const g = S.groups.find(x => x.id === id); if (!g) return;
  S.groups = S.groups.filter(x => x.id !== id);
  if (g.owner) saveRegistry(registry().filter(x => x.code !== g.code)); // Besitzer:in löscht die Gruppe
  save();
}
// Öffentliche Web-Adresse für Einladungslinks (CONFIG.WEB_URL), sonst aktuelle Seite
export function inviteLink(code) { return `${CONFIG.WEB_URL || location.origin + location.pathname}?join=${code}`; }

// ---------- Challenges ----------
export function challengeProgress(c) {
  const since = c.start || S.joinedChallenges[c.id] || startOfWeek(Date.now());
  const to = c.end || Infinity;
  const inRange = S.sessions.filter(s => s.start >= since && s.start < to);
  switch (c.kind) {
    case 'minutes': return { value: minutesIn(since, to), target: c.targetMin, unit: 'min' };
    case 'lang': return { value: minutesIn(since, to, s => LANG.includes(s.subjectId)), target: c.targetMin, unit: 'min' };
    case 'early': return { value: inRange.filter(s => new Date(s.start).getHours() < 8).length, target: c.target, unit: 'x' };
    case 'deep': return { value: inRange.filter(s => s.min >= 60).length, target: c.target, unit: 'x' };
    case 'custom': return { value: minutesIn(since, to, s => !c.subjectId || s.subjectId === c.subjectId), target: c.targetMin, unit: 'min' };
  }
  return { value: 0, target: 1 };
}
export function activeChallenges() {
  const glob = GLOBAL_CHALLENGES.filter(c => S.joinedChallenges[c.id]).map(c => ({ ...c, global: true }));
  const mine = S.challenges.filter(c => !c.end || c.end > Date.now() - 86400000).map(c => ({ ...c, kind: 'custom' }));
  return [...mine, ...glob];
}

// ---------- Karteikarten (Leitner) ----------
const BOX_DAYS = [0, 1, 2, 4, 7, 15, 30];
export function addCards(cards, subjectId, source = 'manual') {
  // Recap-Karten erst morgen fällig (Spaced Repetition), alles andere sofort
  const due = source === 'recap' ? addDays(startOfDay(Date.now()), 1) : startOfDay(Date.now());
  for (const c of cards) S.flashcards.push({ id: uid(), q: c.q, a: c.a, subjectId, box: 1, due, created: Date.now(), source });
  save();
}
export const dueCards = () => S.flashcards.filter(c => c.due <= Date.now());
export function reviewCard(id, knew) {
  const c = S.flashcards.find(c => c.id === id); if (!c) return;
  c.box = knew ? Math.min(c.box + 1, 6) : 1;
  c.due = addDays(startOfDay(Date.now()), knew ? BOX_DAYS[c.box] : 0) + (knew ? 0 : 10 * 60000);
  S.stats.reviews++;
  const k = dayKey(Date.now()); S.stats.reviewDays = { ...(S.stats.reviewDays || {}), [k]: ((S.stats.reviewDays || {})[k] || 0) + 1 };
  save();
}

// ---------- Feed ----------
const NOTES = ['Endlich Integrale verstanden 🙌', 'Voci für Franz-Test morgen', 'Zusammenfassung Kap. 4 fertig', 'Probeprüfung gelöst – 5.0!', 'Lerngruppe in der Bibliothek', '', '', 'Pomodoro-Marathon ☕☕☕', 'LAP-Fallstudie durchgearbeitet'];
export const REACTIONS = ['🔥', '👏', '💪', '🧠', '❤️', '🤯'];
function demoReactions(seed) {
  const r = {}; const n = 1 + seed % 4;
  for (let k = 0; k < n; k++) { const e = REACTIONS[(seed + k * 2) % REACTIONS.length]; r[e] = (r[e] || 0) + 1 + (seed * (k + 3)) % 7; }
  return r;
}
function demoReactors(seed, not) {
  return COMMUNITY.filter(u => u.id !== not).slice(seed % 5, seed % 5 + 3 + seed % 4).map((u, k) => ({ id: u.id, name: u.name, avatar: u.avatar, emoji: REACTIONS[(seed + k) % REACTIONS.length] }));
}
export const reactionTotal = it => Object.values(it.reactions || {}).reduce((a, n) => a + n, 0) + (S.boosts[it.id] ? 1 : 0);
export function topReactions(it) {
  const r = { ...(it.reactions || {}) }; const mine = S.boosts[it.id] === true ? '🔥' : S.boosts[it.id]; if (mine) r[mine] = (r[mine] || 0) + 1;
  return Object.entries(r).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 3);
}
export function feed() {
  if (remote.on) {
    const mine = S.sessions.filter(s => s.start > Date.now() - 3 * 86400000).map(s => ({ id: 'f-' + s.id, user: me(), ts: s.end, min: s.min, subjectId: s.subjectId, note: s.note, title: s.title, own: true, session: s, ...(remote.R.ownReactions?.['f-' + s.id] || { reactions: {}, reactors: [] }) }));
    return [...mine, ...(remote.R.feed || [])].sort((a, b) => b.ts - a.ts);
  }
  const pool = S.friends.length ? COMMUNITY.filter(u => S.friends.includes(u.id)) : COMMUNITY.slice(0, 8);
  const hour = Math.floor(Date.now() / 3600000);
  const items = [];
  for (let i = 0; i < 9; i++) {
    const u = pool[(i * 3 + hour) % pool.length];
    const seed = (hour * 31 + i * 17) % 997;
    const ts = (hour - Math.round(i * 5.3 + 1)) * 3600000 - (seed % 50) * 60000;
    const min = 25 + (seed * 7) % 140;
    const subjectId = u.subjects[seed % u.subjects.length];
    const id = `f-${u.id}-${Math.floor(ts / 60000)}`;
    items.push({ id, user: u, ts, min, subjectId, note: NOTES[seed % NOTES.length], reactions: demoReactions(seed), reactors: demoReactors(seed, u.id), pomos: seed % 3 === 0 ? Math.floor(min / 25) : 0 });
  }
  const mine = S.sessions.filter(s => s.start > Date.now() - 3 * 86400000).map((s, i) => ({ id: 'f-' + s.id, user: me(), ts: s.end, min: s.min, subjectId: s.subjectId, note: s.note, title: s.title, own: true, session: s, reactions: demoReactions(i * 13 + 5), reactors: demoReactors(i * 13 + 5) }));
  return [...mine, ...items].sort((a, b) => b.ts - a.ts);
}

// ---------- Demo-Daten ----------
const DEMO_CARDS = {
  mathe: [['Ableitung von x²?', '2x'], ['Was sagt der Satz des Pythagoras?', 'a² + b² = c² (im rechtwinkligen Dreieck)']],
  franz: [['le lendemain', 'der nächste Tag'], ['Passé composé von «aller» (je)?', 'je suis allé(e)']],
  bio: [['Funktion der Mitochondrien?', 'Zellatmung → Produktion von ATP («Kraftwerk der Zelle»)']],
  chemie: [['Avogadro-Konstante?', '6,022 · 10²³ mol⁻¹']],
  geschichte: [['Gründung des Schweizer Bundesstaats?', '1848 (erste Bundesverfassung)']],
  englisch: [['to procrastinate', 'aufschieben, prokrastinieren']],
  deutsch: [['Was ist ein Oxymoron?', 'Verbindung zweier widersprüchlicher Begriffe, z. B. «bittersüss»']],
  physik: [['Formel für kinetische Energie?', 'E = ½ · m · v²']],
  wr: [['Was regelt das OR?', 'Obligationenrecht: Verträge, Gesellschaften, Arbeitsrecht u. a.']],
};
export function seedDemo() {
  let s = 4242; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const subs = mySubjects().map(x => x.id);
  const today = startOfDay(Date.now());
  const HOURS = [6.5, 8, 9, 10, 13, 14, 15.5, 17, 18, 19, 20, 21, 22.5];
  for (let d = 26; d >= 1; d--) {
    if (d > 9 && r() < .22) continue;
    const n = 1 + Math.floor(r() * 2.4);
    for (let k = 0; k < n; k++) {
      const h = HOURS[Math.floor(r() * HOURS.length)];
      const start = addDays(today, -d) + h * 3600000 + Math.floor(r() * 40) * 60000;
      const min = 18 + Math.floor(r() * 95);
      const mode = r() < .35 ? 'pomo' : r() < .5 ? 'goal' : 'free';
      const segs = []; let t = start, left = min;
      while (left > 0) { const len = Math.min(left, 15 + Math.floor(r() * 40)); segs.push([t, t + len * 60000]); t += len * 60000 + (3 + Math.floor(r() * 8)) * 60000; left -= len; }
      const subjectId = subs[Math.floor(r() * subs.length)];
      S.sessions.push({ id: uid(), subjectId, start, end: segs.at(-1)[1], min, mode, segments: segs, pomos: mode === 'pomo' ? Math.floor(min / 25) : 0,
        checkins: Math.floor(min / 60), xp: min + (mode === 'pomo' ? Math.floor(min / 25) * 5 : 0), title: '', note: r() < .3 ? NOTES[Math.floor(r() * 5)] : '', demo: true });
    }
  }
  S.sessions.sort((a, b) => a.start - b.start);
  [[0, 16, 45], [1, 10, 60], [2, 18, 30], [4, 14, 90], [6, 9, 60]].forEach(([d, h, dur], i) =>
    S.planned.push({ id: uid(), subjectId: subs[i % subs.length], ts: addDays(today, d) + h * 3600000, durMin: dur, note: i === 3 ? 'Prüfungsvorbereitung' : '', source: 'manual' }));
  for (const id of subs) for (const [q, a] of (DEMO_CARDS[id] || [])) S.flashcards.push({ id: uid(), q, a, subjectId: id, box: 1, due: today, created: Date.now(), source: 'demo' });
  S.friends = ['u0', 'u2', 'u3', 'u6', 'u8', 'u9', 'u11'];
  S.groups = [structuredClone(SEED_GROUPS[0])];
  S.joinedChallenges = { 'gc-sprint': startOfWeek(Date.now()), 'gc-lang': startOfWeek(Date.now()) };
  S.challenges = [{ id: uid(), title: `${subj(subs[0]).name}-Prüfung rocken`, emoji: '🎯', subjectId: subs[0], targetMin: 300, start: addDays(today, -4), end: addDays(today, 5) }];
  S.stats.checkins = 6;
  save(); checkTrophies();
}

// ---------- Brainy-Vorschlag: «Was soll ich jetzt lernen?» ----------
const hhmm = ts => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function suggestNext() {
  const now = Date.now(), subs = mySubjects();
  if (S.timer) return null;
  const plan = S.planned.filter(p => !p.done && dayKey(p.ts) === dayKey(now) && p.ts + p.durMin * 60000 > now).sort((a, b) => a.ts - b.ts)[0];
  if (plan && plan.ts - now < 3 * 3600000) {
    const s = subj(plan.subjectId);
    return { em: s.emoji, color: s.color, title: `${s.name} ist geplant`, sub: `${plan.ts > now ? 'Um ' + hhmm(plan.ts) : 'Jetzt'} · ${plan.durMin} min${plan.note ? ' · ' + plan.note : ''}`, cta: 'Starten', action: 'startPlanned', id: plan.id };
  }
  const due = dueCards().length;
  if (due >= 5) return { em: '🃏', color: '#6D5BFF', title: `${due} Karteikarten fällig`, sub: 'Ca. 3 Minuten – ideal zum Aufwärmen', cta: 'Los', action: 'aiTool', id: 'cards' };
  const last = id => Math.max(0, ...S.sessions.filter(x => x.subjectId === id).map(x => x.start));
  const stale = subs.map(s => ({ s, d: (now - last(s.id)) / 864e5 })).filter(x => x.d >= 5).sort((a, b) => b.d - a.d)[0];
  if (stale) return { em: stale.s.emoji, color: stale.s.color, title: `${stale.s.name} wartet ${stale.d > 60 ? 'schon lange' : 'seit ' + Math.floor(stale.d) + ' Tagen'}`, sub: '25-min-Pomodoro gegen die Vergessenskurve', cta: 'Starten', action: 'quickStart', id: stale.s.id, mode: 'pomo' };
  const left = weekGoal() - weekMin();
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
  if (left > 0) {
    const wk = startOfWeek(now), least = subs.map(s => ({ s, m: minutesIn(wk, Infinity, x => x.subjectId === s.id) })).sort((a, b) => a.m - b.m)[0].s;
    const min = Math.min(120, Math.max(25, Math.ceil(left / daysLeft / 5) * 5));
    return { em: least.emoji, color: least.color, title: `${min} min ${least.name}`, sub: `Damit bleibst du auf Kurs fürs Wochenziel`, cta: 'Starten', action: 'quickStart', id: least.id, mode: 'goal', goal: min };
  }
  return { em: '🏆', color: '#F5B70A', title: 'Wochenziel geknackt!', sub: 'Bonus-Session für die Rangliste?', cta: 'Timer', action: 'openTimer' };
}

// ---------- Freunde heute (Story-Leiste auf Home) ----------
export function friendsToday() {
  if (remote.on) return remote.R.friendsToday || [];
  const pool = S.friends.length ? COMMUNITY.filter(u => S.friends.includes(u.id)) : COMMUNITY.slice(0, 6);
  const h = new Date().getHours(), day = Math.floor(Date.now() / 864e5);
  return pool.map((u, i) => {
    const seed = (day * 13 + i * 7 + u.id.length) % 17;
    const todayMin = h < 7 ? 0 : Math.round((seed / 17) * Math.min(1, (h - 6) / 14) * 180);
    return { ...u, todayMin, live: (seed + h) % 6 === 0 };
  }).sort((a, b) => (b.live - a.live) || (b.todayMin - a.todayMin));
}
