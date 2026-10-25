// Lernräume – Backend-Wrapper (RPC aus supabase/schema-rooms.sql) und lokaler Demo-Raum (ohne Server / ?test).
// Alle Funktionen liefern normalisierte Daten: Raum { id, code, name, kind, max, owner } und
// Zustand { room, members: [{ id, name, avatar, subject, start (lokale ms oder null), seat, me }] }.
import * as St from './store.js';
import * as BK from './backend.js';
import { CONFIG } from './config.js';
import { COMMUNITY } from './data.js';

const S = St.S;
export const online = () => BK.enabled && !!S.user?.id;
export const myId = () => S.user?.id || 'me';

// ---------- Fehlertexte ----------
const ERR = {
  room_full: 'Dieser Raum ist voll.',
  room_not_found: 'Code nicht gefunden. Prüf die Schreibweise.',
  rate_limited: 'Zu viele Versuche. Warte kurz und probier es nochmals.',
  room_name_invalid: 'Der Raumname braucht 2 bis 40 Zeichen.',
  not_authenticated: 'Bitte melde dich an.',
  invalid_reaction: 'Das geht hier nicht.',
  limit_rooms: 'Du hast die Höchstzahl deines Plans erreicht.',
  limit_groups: 'Du hast die Höchstzahl deines Plans erreicht.',
  limit_members: 'Diese Gruppe ist voll.',
};
export function niceError(e) {
  const m = e?.message || String(e);
  // Der Server hängt die genaue Meldung nach «limit_rooms:» an: die nennt auch den passenden Hinweis (Pro, Gruppen-Paket oder Raum schliessen)
  const lim = /limit_(?:rooms|groups|members):\s*(.+)$/s.exec(m); if (lim) return `${ERR[m.match(/limit_\w+/)[0]]} ${lim[1].trim()}`;
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'Keine Internetverbindung.';
  return m;
}

// ---------- RPC über die bestehende Anmeldung ----------
// backend.js hält den Supabase-Client privat; wir rufen PostgREST direkt auf und nehmen das Token der laufenden Anmeldung
// (gleicher Speicher wie dort: sb-<ref>-auth-token). Abgelaufen → authUser() lässt den Client erneuern.
const REF = (CONFIG.SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1];
const readToken = () => { try { const j = JSON.parse(localStorage.getItem(`sb-${REF}-auth-token`)); return j?.access_token ? { t: j.access_token, exp: j.expires_at || 0 } : null; } catch { return null; } };
async function token() {
  let k = readToken();
  if (!k || k.exp * 1000 < Date.now() + 15000) { try { await BK.authUser(); } catch { } k = readToken(); }
  if (!k) throw new Error('not_authenticated');
  return k.t;
}
async function rpc(fn, args = {}) {
  const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { }
  if (!r.ok) throw new Error(j?.message || txt || `Fehler ${r.status}`);
  return j;
}

const normRoom = r => ({ id: r.id, code: r.code, name: r.name, kind: r.kind, max: r.max_seats, owner: r.owner || null });
function normState(j) {
  const skew = Date.now() - Date.parse(j.now || new Date().toISOString());   // Uhr des Servers → lokale Uhr
  return { room: normRoom(j.room), members: (j.members || []).map(m => ({
    id: m.id, name: m.name || 'Brainy', avatar: m.avatar || {}, subject: m.subject || '', seat: m.seat,
    start: m.session_start ? Date.parse(m.session_start) + skew : null, me: m.id === myId(),
  })) };
}

// ---------- Demo-Raum (lokal) ----------
const SUBJ = ['Mathe', 'Deutsch', 'Biologie', 'Französisch', 'Geschichte', 'Englisch', 'Physik', 'Chemie'];
const rnd = n => Math.floor(Math.random() * n);
const randCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 6 }, () => a[rnd(a.length)]).join(''); };
let fake = null;
function fakeRoom(kind, name, code) {
  const n = kind === 'private' ? 3 : (/[?&]showcase/.test(location.search) ? 11 : 7); // showcase (Store-Bilder): voller Raum
  const pool = COMMUNITY.slice().sort(() => Math.random() - .5).slice(0, n);
  const seats = [...Array(kind === 'private' ? 6 : 12).keys()].sort(() => Math.random() - .5).slice(0, n + 1);
  const me = seats.pop();
  fake = {
    room: { id: 'demo-' + Date.now(), code: code || randCode(), name: name || 'Lernraum', kind, max: kind === 'private' ? 6 : 12, owner: kind === 'private' ? myId() : null },
    members: pool.map((u, i) => ({ id: u.id, name: u.name.split(' ')[0], avatar: u.avatar, subject: SUBJ[rnd(SUBJ.length)], seat: seats[i], start: Date.now() - (4 + rnd(85)) * 60000, paused: i === 2 })),
    meSeat: me, rx: [], nextRx: Date.now() + 14000, seq: 0, subject: '', start: null,
  };
  return { ...fake.room };
}
function fakeState() {
  const f = fake; if (!f) throw new Error('not_member');
  f.members.forEach(m => { if (Math.random() < .03) m.paused = !m.paused; });
  if (Date.now() > f.nextRx && f.members.length) {   // ab und zu bekommt man eine Reaktion
    f.rx.push({ id: ++f.seq, from: f.members[rnd(f.members.length)].id, to: myId(), emoji: ['anfeuern', 'applaus', 'durchhalten'][rnd(3)], at: Date.now() });
    f.nextRx = Date.now() + 20000 + rnd(20000);
  }
  const mine = { id: myId(), name: S.user?.name || 'Ich', avatar: S.user?.avatar || {}, subject: f.subject, seat: f.meSeat, start: f.start, me: true };
  return { room: { ...f.room }, members: [...f.members.map(m => ({ ...m, start: m.paused ? null : m.start, me: false })), mine].sort((a, b) => a.seat - b.seat) };
}

// ---------- Öffentliche Funktionen ----------
export async function createRoom(name) {
  if (!online()) return fakeRoom('private', (name || '').trim() || 'Mein Lernraum');
  return normRoom(await rpc('room_create', { p_name: name || '' }));
}
export async function joinCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!online()) { if (!/^[A-HJ-NP-Z2-9]{6}$/.test(c)) throw new Error('room_not_found'); return fakeRoom('private', 'Lernraum ' + c, c); }
  const j = await rpc('room_join_code', { p_code: c });
  if (j?.error) throw new Error(j.error);
  return normRoom(j);
}
export async function joinRandom() {
  if (!online()) return fakeRoom('public', 'Lernraum');
  return normRoom(await rpc('room_join_random'));
}
export async function leaveRoom(id) {
  if (!online()) { fake = null; return; }
  await rpc('room_leave', { p_room: id });
}
export async function ping(id, subject, start) {
  if (!online()) { if (fake) { fake.subject = subject || ''; fake.start = start; } return; }
  await rpc('room_ping', { p_room: id, p_subject: subject || null, p_start: start ? new Date(start).toISOString() : null });
}
export async function state(id) {
  if (!online()) return fakeState();
  return normState(await rpc('room_state', { p_room: id }));
}
export async function react(id, to, kind) {
  if (!online()) return;
  await rpc('room_react', { p_room: id, p_to: to, p_emoji: kind });
}
// Neue Reaktionen seit `since` (ISO-Zeit des Servers; leer = seit kurzem). Liefert { list: [{id, from, to, kind, at}], since }
export async function reactionsSince(id, since) {
  if (!online()) {
    const f = fake; if (!f) return { list: [], since };
    const list = f.rx.filter(x => x.id > (since || 0)).map(x => ({ id: x.id, from: x.from, to: x.to, kind: x.emoji, at: x.at }));
    return { list, since: list.length ? list.at(-1).id : since };
  }
  const rows = await rpc('room_reactions_since', { p_room: id, p_ts: since || new Date(Date.now() - 20000).toISOString() });
  const list = (rows || []).map(x => ({ id: x.id, from: x.from_user, to: x.to_user, kind: x.emoji, at: Date.parse(x.created_at) }));
  return { list, since: rows?.length ? rows.at(-1).created_at : since };
}
