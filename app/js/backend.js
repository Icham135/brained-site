// Brained – Backend (Supabase). Aktiv, sobald js/config.js ausgefüllt ist; sonst Demo-Modus.
// Prinzip «local-first»: Die App arbeitet mit dem lokalen Zustand (schnell, offline-fähig) und
// synchronisiert im Hintergrund. Soziale Daten (Rangliste, Feed, Gruppen) kommen vom Server und
// werden in R zwischengespeichert; die Views lesen sie über store.js.
import { CONFIG, BACKEND } from './config.js';
import * as St from './store.js';

const S = St.S;
export const hooks = { onPaywall: null };
export const enabled = BACKEND;
export const R = { lb: {}, feed: null, friendsToday: null, people: {}, search: [], requested: [], requests: null, blocked: null, following: null };
let sb = null;

// ---------- Fehler verständlich machen ----------
const ERR = {
  not_found: 'Code nicht gefunden. Prüf die Schreibweise.',
  already_member: 'Du bist schon in dieser Gruppe.',
  group_full: 'Diese Klasse ist voll.',
  limit_groups: 'Du hast die Höchstzahl deines Plans erreicht.',
  limit_members: 'Diese Gruppe ist voll.',
  limit_rooms: 'Du hast die Höchstzahl deines Plans erreicht.',
  class_inactive: 'Diese Klassengruppe ist nicht mehr aktiv.',
  teacher_required: 'Klassengruppen kann nur eine Lehrperson mit Brained Max erstellen.',
  rate_limited: 'Zu viele Versuche. Warte eine Stunde und versuche es nochmals.',
  too_many_groups: 'Du hast schon 20 Gruppen erstellt.',
  not_authenticated: 'Bitte melde dich an.',
};
function nice(e) {
  const m = e?.message || String(e);
  // Der Server hängt die deutsche Meldung nach «code:» an (limit_groups: Du hast …): die ist genauer als der Standardtext
  const detail = k => { const i = m.indexOf(k + ':'); return i >= 0 ? m.slice(i + k.length + 1).trim() : ''; };
  if (m.includes('limit_groups') && !['group', 'max_teacher'].includes(St.tier())) hooks.onPaywall?.(detail('limit_groups') || ERR.limit_groups);
  for (const k of Object.keys(ERR)) if (m.includes(k)) return new Error((k.startsWith('limit_') || k === 'group_full') && detail(k) || ERR[k]);
  if (/provider is not enabled|Unsupported provider/i.test(m)) return new Error('Diese Anmeldung wird gerade eingerichtet – nutze vorerst die E-Mail.');
  if (/duplicate key.*username/i.test(m)) return new Error('Dieser Benutzername ist schon vergeben.');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return new Error('Keine Internetverbindung.');
  return new Error(m);
}
const must = ({ data, error }) => { if (error) throw nice(error); return data; };

// ---------- Start & Login ----------
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const redirectUrl = () => (isNative() ? `${CONFIG.APP_SCHEME}://auth` : location.origin + location.pathname);

export async function init(onAuth) {
  if (!enabled) return null;
  const { createClient } = await import('./vendor/supabase.js'); // lokal gebündelt (npm run vendor)
  sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: !isNative(), persistSession: true, autoRefreshToken: true },
  });
  St.remote.on = true; St.remote.R = R;
  if (isNative()) {
    // Rückkehr aus dem Login-Browser: ch.brained.app://auth?code=…
    window.Capacitor.Plugins.App.addListener('appUrlOpen', async ({ url }) => {
      if (!url?.startsWith(CONFIG.APP_SCHEME)) return;
      const code = new URL(url.replace(`${CONFIG.APP_SCHEME}://`, 'https://app/')).searchParams.get('code');
      try { await window.Capacitor.Plugins.Browser.close(); } catch { }
      if (code) { const { error } = await sb.auth.exchangeCodeForSession(code); if (error) console.warn(error); }
    });
  }
  sb.auth.onAuthStateChange((event, session) => { if (['SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(event)) setTimeout(() => onAuth?.(event, session), 0); });
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export async function signInOAuth(provider) { // 'google' | 'apple'
  if (provider === 'apple' && window.Capacitor?.getPlatform?.() === 'ios') return signInAppleNative();
  const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl(), skipBrowserRedirect: isNative() } });
  if (error) throw nice(error);
  if (isNative()) await window.Capacitor.Plugins.Browser.open({ url: data.url, presentationStyle: 'popover' });
}
// iPhone: «Mit Apple anmelden» direkt im Apple-Fenster – keine Webseite, kein Umweg über den Browser
async function signInAppleNative() {
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
  let res;
  try { res = (await window.Capacitor.Plugins.SignInWithApple.authorize({ clientId: CONFIG.APP_SCHEME, redirectURI: redirectUrl(), scopes: 'email name', nonce: hash })).response; }
  catch (e) { if (/cancel|1001/i.test(e?.message || e?.code || '')) return; throw nice(e); }
  // Apple liefert den Namen nur beim allerersten Login – fürs Profil merken (vor dem Login-Ereignis setzen)
  appleName = [res.givenName, res.familyName].filter(Boolean).join(' ');
  must(await sb.auth.signInWithIdToken({ provider: 'apple', token: res.identityToken, nonce: raw }));
}
export let appleName = '';
// Schickt Login-Link (und Code, sobald eigener E-Mail-Versand mit Code-Vorlage eingerichtet ist)
export async function sendEmailCode(email) { must(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectUrl() } })); }
export async function verifyEmailCode(email, token) { must(await sb.auth.verifyOtp({ email, token, type: 'email' })); }
// E-Mail + Passwort: sofort drin, keine Bestätigungs-E-Mail nötig (Supabase: mailer_autoconfirm)
export async function signUpPassword(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw /already registered|already exists/i.test(error.message) ? new Error('Diese E-Mail hat schon ein Konto – wechsle zu «Anmelden».') : nice(error);
  if (!data.session) throw new Error('Konto erstellt – bitte melde dich jetzt an.');
}
export async function signInPassword(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw /invalid login|invalid credentials/i.test(error.message) ? new Error('E-Mail oder Passwort stimmt nicht.') : nice(error);
}
export const _testSignIn = signInPassword; // Live-UI-Test
export async function signOut() { try { await sb?.auth.signOut(); } catch { } }
export async function authUser() { return (await sb.auth.getUser()).data.user; }
export async function deleteAccount() { must(await sb.functions.invoke('delete-account', { body: {} })); await signOut(); }

// ---------- Profil ----------
export const usernameAvailable = async u => must(await sb.rpc('username_available', { u }));
export const fetchProfile = async id => must(await sb.from('profiles').select('*').eq('id', id).maybeSingle());

function profileRow(u) {
  return { name: u.name, username: u.username, canton: u.canton, country: u.country || null, region: (u.country === 'CH' ? u.canton : u.region) || null, level: u.level, avatar: u.avatar, bio: u.bio || '', weekly_goal_min: u.weeklyGoalMin, follow_requests: u.followRequests !== false || u.ageBand === '13-15', is_private: !!u.isPrivate || u.ageBand === '13-15' };
}
export async function createProfile(uid, u) {
  must(await sb.from('profiles').insert({ id: uid, ...profileRow(u), terms_accepted_at: new Date().toISOString() }));
}
export async function updateProfile() { if (!S.user?.id) return; must(await sb.from('profiles').update(profileRow(S.user)).eq('id', S.user.id)); }
export function profileToUser(p, email) {
  return { id: p.id, name: p.name, username: p.username, email, canton: p.canton || 'ZH', country: p.country || (p.canton ? 'CH' : ''), region: p.region || '', level: p.level || 'gym', avatar: p.avatar || {}, bio: p.bio || '', weeklyGoalMin: p.weekly_goal_min, followRequests: p.follow_requests !== false, isPrivate: !!p.is_private, created: Date.parse(p.created_at) };
}
// Kennzahlen, die andere sehen (Streak, Trophäen, Lieblingsfach)
export async function pushProfileStats() {
  if (!S.user?.id) return;
  const fav = Object.entries(S.sessions.reduce((m, s) => (m[s.subjectId] = (m[s.subjectId] || 0) + s.min, m), {})).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const st = St.streakInfo();
  await sb.from('profiles').update({ platform: window.Capacitor?.getPlatform?.() || 'web', last_seen_at: new Date().toISOString(), streak: st.current, best_streak: st.best, trophies: St.trophyMap(), trophy_count: St.trophyCount(), fav_subject: fav }).eq('id', S.user.id);
}
export async function setLive(subjectId) {
  if (!S.user?.id) return;
  await sb.from('profiles').update({ live_since: subjectId ? new Date().toISOString() : null, live_subject: subjectId || null }).eq('id', S.user.id);
}

// ---------- Sessions & privater Zustand ----------
const toRow = s => ({ id: s.id, user_id: S.user.id, subject_id: s.subjectId, started_at: new Date(s.start).toISOString(), ended_at: new Date(s.end).toISOString(),
  minutes: s.min, mode: s.mode, segments: s.segments, pomos: s.pomos || 0, checkins: s.checkins || 0, xp: s.xp || 0, title: (s.title || '').slice(0, 80), note: (s.note || '').slice(0, 2000), goal_hit: !!s.goalHit });
const fromRow = r => ({ id: r.id, subjectId: r.subject_id, start: Date.parse(r.started_at), end: Date.parse(r.ended_at), min: r.minutes, mode: r.mode, segments: r.segments || [],
  pomos: r.pomos, checkins: r.checkins, xp: r.xp, title: r.title, note: r.note, goalHit: r.goal_hit });
export async function pushSession(s) { if (S.user?.id) must(await sb.from('sessions').upsert(toRow(s))); }
export async function deleteSession(id) { if (S.user?.id) must(await sb.from('sessions').delete().eq('id', id)); }

const PRIVATE_KEYS = ['subjects', 'customSubjects', 'subjectColors', 'planned', 'challenges', 'joinedChallenges', 'flashcards', 'trophies', 'boosts', 'exams', 'studyPlans', 'games', 'stats', 'quiz', 'shop', 'freeze'];
// Upload nur, wenn sich der Inhalt wirklich geändert hat (Timer-Ticks ändern den Upload-Block nicht)
// und mit Mindestpause zwischen zwei Uploads – spart Datenbank-Schreibvorgänge.
let lastPushHash = '', lastPushAt = 0, pushing = false;
const PUSH_MIN_GAP = 20000;
export async function pushState() {
  if (!S.user?.id) return;
  const data = Object.fromEntries(PRIVATE_KEYS.map(k => [k, S[k]]));
  data.flashcards = (S.flashcards || []).filter(c => c.source !== 'path');   // Karten aus Lessons stammen aus den Unterlagen: bleiben auf dem Gerät
  data.settings = { ...S.settings, apiKey: '' }; // API-Key nie hochladen
  const hash = S.user.id + JSON.stringify(data);
  if (hash === lastPushHash) return;   // nichts Neues
  if (pushing) { schedulePush(); return; }
  pushing = true;
  try {
    const r = await sb.from('user_state').upsert({ user_id: S.user.id, data, updated_at: new Date().toISOString() });
    if (r?.error) throw r.error;
    lastPushHash = hash; lastPushAt = Date.now();
  } finally { pushing = false; }
}
let pushTimer;
export function schedulePush() {
  if (!enabled || !S.user?.id) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushState().catch(console.warn), Math.max(2500, lastPushAt + PUSH_MIN_GAP - Date.now()));
}
// Sofort hochladen (App geht in den Hintergrund / Session-Ende); die Hash-Prüfung verhindert unnötige Uploads
export function flushPush() { if (!enabled || !S.user?.id) return; clearTimeout(pushTimer); pushState().catch(console.warn); }

// Alles vom Server holen (Login auf neuem Gerät)
export async function pullAll(uid) {
  const [sessions, state, follows] = await Promise.all([
    sb.from('sessions').select('*').eq('user_id', uid).order('started_at').limit(10000).then(must),
    sb.from('user_state').select('data').eq('user_id', uid).maybeSingle().then(must),
    sb.from('follows').select('followee, accepted').eq('follower', uid).then(must),
  ]);
  const d = state?.data || {};
  const keepPath = (S.flashcards || []).filter(c => c.source === 'path');
  for (const k of PRIVATE_KEYS) if (d[k] !== undefined) S[k] = d[k];
  if (keepPath.length) S.flashcards = [...(S.flashcards || []), ...keepPath.filter(c => !(S.flashcards || []).some(x => x.id === c.id))];
  if (d.settings) S.settings = { ...S.settings, ...d.settings, apiKey: S.settings.apiKey };
  S.sessions = sessions.map(fromRow);
  S.friends = follows.filter(f => f.accepted).map(f => f.followee);
  R.requested = follows.filter(f => !f.accepted).map(f => f.followee);
  await loadGroups();
  await Promise.all([loadPlan(), loadShop()]).catch(() => { });
}

// ---------- Soziales ----------
const toPerson = r => ({
  id: r.id, name: r.name, username: r.username, canton: r.canton, level: r.level, avatar: r.avatar || {}, bio: r.bio || '',
  streak: r.streak || 0, trophies: r.trophy_count || 0, trophyMap: r.trophies || {}, favSubject: r.fav_subject, live: !!r.live,
  weekMin: Number(r.week_minutes ?? 0), monthMin: Number(r.month_minutes ?? 0), allMin: Number(r.all_minutes ?? 0),
});
export const lbKey = o => [o.scope, o.period, o.groupId || '', o.canton || ''].join('|');
export async function loadLeaderboard(o) {
  const rows = must(await sb.rpc('leaderboard', { p_period: o.period, p_scope: o.scope, p_group: o.groupId || null, p_canton: o.canton || null }));
  const key = o.period === 'week' ? 'weekMin' : o.period === 'month' ? 'monthMin' : 'allMin';
  R.lb[lbKey(o)] = rows.map((r, i) => { const p = { ...toPerson(r), [key]: Number(r.minutes), allMin: Number(r.all_minutes ?? r.minutes), value: Number(r.minutes), rank: i + 1 }; R.people[p.id] = { ...R.people[p.id], ...p }; return p; });
}
// Rangliste 2.0 (Land/Region). Alter Server ohne leaderboard_v2: Rückfall auf die Kanton-Abfrage (nur Schweiz).
export const lb2Key = o => [o.scope, o.period, o.groupId || '', o.country || '', o.region || ''].join('|');
export async function loadRankV2(o) {
  const key = o.period === 'week' ? 'weekMin' : o.period === 'month' ? 'monthMin' : 'allMin';
  let rows, legacy = false;
  const { data, error } = await sb.rpc('leaderboard_v2', { p_period: o.period, p_scope: o.scope, p_group: o.groupId || null, p_country: o.country || null, p_region: o.region || null });
  if (error) {
    if (!/leaderboard_v2|schema cache|does not exist|not find the function/i.test(error.message || '')) throw nice(error);
    legacy = true;
    rows = o.scope === 'global' && o.country && o.country !== 'CH' ? [] : must(await sb.rpc('leaderboard', { p_period: o.period, p_scope: o.scope, p_group: o.groupId || null, p_canton: o.scope === 'global' ? (o.region || null) : null }));
  } else rows = data;
  (R.lb2 ||= {})[lb2Key(o)] = {
    ts: Date.now(), legacy,
    rows: rows.map((r, i) => { const p = { ...toPerson(r), country: r.country || (r.canton ? 'CH' : ''), region: r.region || (r.country && r.country !== 'CH' ? '' : r.canton || ''), [key]: Number(r.minutes), allMin: Number(r.all_minutes ?? r.minutes), value: Number(r.minutes), place: Number(r.place || i + 1), rank: i + 1 }; R.people[p.id] = { ...R.people[p.id], ...p }; return p; }),
  };
}
export async function loadFeed() {
  const rows = must(await sb.rpc('feed', { p_limit: 30 }));
  R.ownReactions = {};
  for (const r of rows.filter(r => r.user_id === S.user.id)) R.ownReactions['f-' + r.session_id] = { reactions: r.reactions || {}, reactors: r.reactors || [] };
  R.feed = rows.filter(r => r.user_id !== S.user.id).map(r => {
    const id = 'f-' + r.session_id, mine = r.my_reaction, reactions = { ...(r.reactions || {}) };
    if (mine) { S.boosts[id] = mine; reactions[mine] = Math.max(0, (reactions[mine] || 1) - 1); } else delete S.boosts[id]; // eigene Reaktion wird lokal dazugezählt
    return { id, sessionId: r.session_id, user: { id: r.user_id, name: r.name, username: r.username, canton: r.canton, avatar: r.avatar, streak: r.streak },
      ts: Date.parse(r.ended_at), min: r.minutes, subjectId: r.subject_id, note: r.note, title: r.title, pomos: r.pomos, reactions, reactors: (r.reactors || []).filter(x => x.id !== S.user.id) };
  });
}
export async function loadFriendsToday() {
  const rows = must(await sb.rpc('friends_today'));
  R.friendsToday = rows.map(r => ({ id: r.id, name: r.name, username: r.username, canton: r.canton, avatar: r.avatar, streak: r.streak, live: r.live, todayMin: Number(r.today_minutes) }));
}
export async function loadPerson(id) {
  const [r] = must(await sb.rpc('profile_card', { p_user: id }));
  if (r) { R.people[id] = toPerson(r); if (r.following && !S.friends.includes(id)) S.friends.push(id); markRequested(id, r.requested); }
  return R.people[id];
}
export async function search(q) {
  const rows = must(await sb.rpc('search_profiles', { q }));
  R.search = rows.map(r => { const p = { ...toPerson(r), weekMin: Number(r.week_minutes) }; R.people[p.id] = { ...R.people[p.id], ...p }; return p; });
  for (const r of rows) { if (r.following && !S.friends.includes(r.id)) S.friends.push(r.id); markRequested(r.id, r.requested); }
  return R.search;
}
const markRequested = (id, on) => { R.requested = R.requested.filter(x => x !== id); if (on) R.requested.push(id); };
// Folgen: bei öffentlichen Profilen sofort, sonst als Anfrage (entscheidet der Server). Gibt 'following' | 'requested' | 'none' zurück.
export async function follow(id, on) {
  if (!on) {
    must(await sb.from('follows').delete().eq('follower', S.user.id).eq('followee', id));
    S.friends = S.friends.filter(x => x !== id); markRequested(id, false); return 'none';
  }
  const row = must(await sb.from('follows').insert({ follower: S.user.id, followee: id }).select('accepted').single());
  if (row.accepted) { S.friends = [...new Set([...S.friends, id])]; markRequested(id, false); return 'following'; }
  markRequested(id, true); return 'requested';
}
export async function loadRequests() {
  const rows = must(await sb.rpc('follow_requests'));
  R.requests = rows.map(r => ({ id: r.id, name: r.name, username: r.username, canton: r.canton, level: r.level, avatar: r.avatar || {}, streak: r.streak || 0, ts: Date.parse(r.created_at) }));
}
export async function respondRequest(id, accept) {
  if (accept) must(await sb.from('follows').update({ accepted: true }).eq('follower', id).eq('followee', S.user.id));
  else must(await sb.from('follows').delete().eq('follower', id).eq('followee', S.user.id));
  R.requests = (R.requests || []).filter(r => r.id !== id);
}
export async function loadBlocks() {
  R.blocked = must(await sb.rpc('my_blocks')).map(r => ({ id: r.id, name: r.name, username: r.username, avatar: r.avatar || {} }));
}
export async function unblock(id) {
  must(await sb.from('blocks').delete().eq('blocker', S.user.id).eq('blocked', id));
  R.blocked = (R.blocked || []).filter(r => r.id !== id);
}
export async function react(sessionId, emoji) {
  if (emoji) must(await sb.from('boosts').upsert({ session_id: sessionId, user_id: S.user.id, emoji }, { onConflict: 'session_id,user_id' }));
  else must(await sb.from('boosts').delete().eq('session_id', sessionId).eq('user_id', S.user.id));
}
export async function report(userId, reason, sessionId = null) { must(await sb.from('reports').insert({ reporter: S.user.id, reported: userId, reason, session_id: sessionId })); }
export async function block(userId) {
  must(await sb.from('blocks').insert({ blocker: S.user.id, blocked: userId }));
  await follow(userId, false).catch(() => { });
  await sb.from('follows').delete().eq('follower', userId).eq('followee', S.user.id); // auch als Follower entfernen
  R.requests = (R.requests || []).filter(r => r.id !== userId);
}

// ---------- Gruppen ----------
export async function loadGroups() {
  const rows = must(await sb.rpc('my_groups'));
  S.groups = rows.map(g => ({ id: g.id, name: g.name, emoji: g.emoji, color: g.color, code: g.code, weeklyGoalH: g.weekly_goal_h,
    owner: g.owner === S.user?.id, members: (g.members || []).filter(m => m !== S.user?.id), weekMin: Number(g.week_minutes), kind: g.kind || 'normal' }));
  // Ältere Server: my_groups() liefert «kind» noch nicht mit (Migration schema-tarif.sql fehlt) → Klassengruppen separat nachfragen (Fehler ignorieren, dann gilt normal)
  if (S.groups.length && !(rows[0] && 'kind' in rows[0])) { try { const { data } = await sb.from('groups').select('id,kind').in('id', S.groups.map(g => g.id)); (data || []).forEach(r => { const g = S.groups.find(x => x.id === r.id); if (g && r.kind) g.kind = r.kind; }); } catch { } }
}
// Klassengruppe (nur Max-Lehrperson), Wochenbericht (nur Ersteller mit Gruppe/Max), Lizenzcode einlösen
export async function createClassGroup(name, emoji, color) { const g = must(await sb.rpc('create_class_group', { p_name: name, p_emoji: emoji, p_color: color })); await loadGroups(); return S.groups.find(x => x.id === g.id); }
// Vorschau per Code ohne Beitritt: { name, emoji, kind, owner_name, members, is_member } oder { error: 'group_not_found' }; wirft, wenn die Funktion noch fehlt (dann Fallback in der App)
export async function groupPreview(code) { return must(await sb.rpc('group_preview', { p_code: code })); }
export async function weekReport(groupId) { return must(await sb.rpc('week_report', { p_group: groupId })) || []; }
export async function redeemLicense(code) {
  const r = must(await sb.rpc('redeem_license', { p_code: code }));
  if (r?.ok) await loadPlan().catch(() => { });
  return r;
}
export async function createGroup(name, emoji, color) { const g = must(await sb.rpc('create_group', { p_name: name, p_emoji: emoji, p_color: color })); await loadGroups(); return S.groups.find(x => x.id === g.id); }
export async function updateGroup(id, p) { must(await sb.from('groups').update({ name: p.name, emoji: p.emoji, color: p.color, weekly_goal_h: p.weeklyGoalH }).eq('id', id)); await loadGroups(); return S.groups.find(x => x.id === id); }
export async function joinGroup(code) { const g = must(await sb.rpc('join_group', { p_code: code })); await loadGroups(); return S.groups.find(x => x.id === g.id); }
export async function leaveGroup(g) {
  if (g.owner) must(await sb.from('groups').delete().eq('id', g.id));
  else must(await sb.from('group_members').delete().eq('group_id', g.id).eq('user_id', S.user.id));
  await loadGroups();
}

// ---------- Brainy über den Server (Key bleibt geheim) ----------
export async function brainy(params) {
  const { onUsage, ...body } = params;
  const { data, error } = await sb.functions.invoke('brainy', { body });
  if (error) {
    let msg = error.message, code = '';
    try { const j = await error.context.json(); msg = j.error || msg; code = j.code || ''; } catch { }
    if (code === 'pro_required' || code === 'pro_required_clarity') hooks.onPaywall?.(msg);
    throw Object.assign(new Error(msg), { code });
  }
  if (data.credit) St.setCredit(data.credit);   // Rest-Guthaben aus jeder Claude-Antwort (Balken)
  onUsage?.({ usage: data.usage, model: data.model });
  return data.text;
}

/* ---------- Brained Pro, Shop, Push, Passwort ---------- */
export async function loadPlan() {
  const [row] = must(await sb.rpc('my_plan')) || [];
  S.plan = { pro: !!row?.pro, until: row?.pro_until ? Date.parse(row.pro_until) : null, source: row?.source || null, tier: row?.tier || (row?.pro ? 'pro' : 'free') };
  St.setCredit(row && { limit_usd: row.credit_limit_usd, used_usd: row.credit_used_usd, left_pct: row.credit_left_pct, reset_at: row.credit_reset });
  return S.plan;
}
export async function loadShop() {
  const [row] = must(await sb.rpc('my_shop')) || [];
  R.shop = { balance: row?.balance ?? 0, owned: row?.owned || [], consumed: row?.consumed || {} };
  return R.shop;
}
// Tagesgeschenk auf dem Server verbuchen (Regeln: einmal pro Tag, Skin max. einmal pro Woche, siehe claim_daily_gift in schema.sql)
export async function claimDaily(g) {
  const { error } = await sb.rpc('claim_daily_gift', { p_kind: g.kind, p_amount: g.amount || 0, p_item: g.item || null });
  if (error) throw new Error(/already_claimed/.test(error.message) ? 'Heute schon geholt' : /skin_week/.test(error.message) ? 'Diese Woche gab es schon einen Skin' : error.message);
  await loadShop();
}
export async function buyItem(id) {
  const { data, error } = await sb.rpc('buy_item', { p_item: id });
  if (error) {
    const m = error.message || '';
    if (/pro_required/.test(m)) { hooks.onPaywall?.('Dieses Item gibt es nur mit Brained Pro.'); throw new Error('Nur mit Brained Pro'); }
    throw new Error(/not_enough/.test(m) ? 'Nicht genug Brain-Coins 🪙' : /already_owned/.test(m) ? 'Gehört dir schon' : /req_(streak|league)/.test(m) ? 'Dafür fehlt dir noch Streak oder Liga' : m);
  }
  await loadShop();
  return data;
}
async function billing(body) {
  const { data, error } = await sb.functions.invoke('billing', { body });
  if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch { } throw new Error(msg); }
  return data.url;
}
export const checkout = (plan, tier = 'pro') => billing({ action: 'checkout', plan, tier });
export const billingPortal = () => billing({ action: 'portal' });
export async function savePushSub(sub, lang) {
  const j = sub.toJSON();
  must(await sb.from('push_subs').upsert({ endpoint: j.endpoint, user_id: S.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth, lang }));
}
export async function deletePushSub(endpoint) { must(await sb.from('push_subs').delete().eq('endpoint', endpoint)); }
export async function sendPasswordReset(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: CONFIG.WEB_URL || location.origin + location.pathname });
  if (error) throw nice(error);
}
export async function updatePassword(pw) {
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) throw nice(error);
}
