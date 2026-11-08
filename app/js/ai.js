// Brainy – KI-Workflows. Alle KI-Aufrufe laufen über den Server (Edge Function «brainy», Key geheim).
// Ohne Konto/Backend läuft ein Demo-Modus mit lokalen Heuristiken, damit jede Funktion trotzdem erlebbar ist.
import { S } from './store.js';
import { lang, aiLanguage } from './i18n.js';
import { isClean, CLEAN_MSG } from './moderation.js';

import * as BK from './backend.js';
// Mit Backend läuft Brainy über den Server (Key geheim); sonst Demo-Modus. (apiKey nur noch als Test-Haken: UI dafür gibt es nicht mehr)
export const hasKey = () => (BK.enabled && !!S.user?.id) || !!S.settings.apiKey;

const BRAINY = `Du bist «Brainy», das freundliche Cartoon-Gehirn der Schweizer Lern-App «Brained».
Du sprichst Schweizer Hochdeutsch (kein ß, sondern ss), duzt, bist motivierend, kurz und konkret. Max. 1 Emoji pro Antwort.`;

// effort: 'low' für schnelle Chat-Antworten, 'medium' für strukturierte Aufgaben (Prüfungen, Pläne)
// meta: zusätzliche Felder für den Server (Path: course, tier, subject, pages); onUsage({ usage, model }) meldet den Verbrauch zurück
export async function claude({ system, messages, maxTokens = 4000, effort = 'medium', kind = 'chat', keepLang = false, meta = null, onUsage = null }) {
  const userText = (messages || []).filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : (m.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ')).join(' ');
  if (!String(kind).startsWith('path_') && !isClean(userText.slice(-4000), { learning: true })) throw new Error(CLEAN_MSG);   // Path prüft nur Titel/Notizen beim Start: der Squash-Filter trifft sonst Material («eine Gerade», «who read»)
  if (lang !== 'de' && !keepLang) system = `${system}\n\nWICHTIG: Antworte (alle Texte, auch in JSON-Feldern) auf ${aiLanguage()}.`;
  if (!hasKey()) throw new Error('NO_KEY');
  if (BK.enabled && S.user?.id) return BK.brainy({ system, messages, max_tokens: maxTokens, effort, kind, ...(meta || {}), onUsage });
  throw new Error('NO_KEY');   // kein direkter Aufruf mit eigenem Key mehr (Kosten/Sicherheit): nur über den Server
}

export function parseJSONLoose(text) {
  let t = String(text || ''); const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1];
  const i = Math.min(...['{', '['].map(c => t.indexOf(c)).filter(i => i >= 0)); if (!isFinite(i)) throw new Error('Kein JSON');
  t = t.slice(i);
  try { return JSON.parse(t.slice(0, t.lastIndexOf(t[0] === '{' ? '}' : ']') + 1)); } catch { }
  // Zeichenweise reparieren: Steuerzeichen in Strings escapen, fehlende Kommas einsetzen, offene Klammern schliessen
  let out = '', inStr = false, esc = false; const stack = [];
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') {
        // Anführungszeichen mitten im Text (nicht vor , : } ]) → escapen
        const nx = t.slice(k + 1).match(/^\s*(.)/)?.[1];
        if (nx && !',:}]'.includes(nx)) { out += '\\"'; continue; }
        inStr = false; out += ch; continue;
      }
      if (ch === '\n') { out += '\\n'; continue; } if (ch === '\r' || ch === '\t') { out += ' '; continue; }
      out += ch; continue;
    }
    if (ch === '/' && t[k + 1] === '/') { while (k < t.length && t[k] !== '\n') k++; continue; }   // //-Kommentare
    if (ch === '/' && t[k + 1] === '*') { k = t.indexOf('*/', k + 2); if (k < 0) break; k++; continue; }
    if (ch === '"') {
      const prev = out.replace(/\s+$/, '').slice(-1);
      if (prev && '"}]0123456789el'.includes(prev)) out += ',';   // fehlendes Komma vor neuem Wert/Schlüssel
      inStr = true; out += ch; continue;
    }
    if (ch === '{' || ch === '[') { const prev = out.replace(/\s+$/, '').slice(-1); if (prev && '"}]'.includes(prev)) out += ','; stack.push(ch); out += ch; continue; }
    if (ch === '}' || ch === ']') { out = out.replace(/,\s*$/, ''); stack.pop(); out += ch; if (!stack.length) break; continue; }
    out += ch;
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, '');
  while (stack.length) out += stack.pop() === '{' ? '}' : ']';
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
export function parseJSON(text) { return parseJSONLoose(text); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// ======================= 4) Session-Recap → Karteikarten =======================
export async function recapCards(note, subjectName, images = []) {
  if (!hasKey()) {
    if (images.length && !note) throw new Error('Für Fotos braucht Brainy die Claude-Verbindung.');
    await wait(800);
    const sents = note.split(/(?<=[.!?\n])\s*/).map(s => s.trim()).filter(s => s.length > 12).slice(0, 6);
    return sents.map(s => {
      const m = s.match(/^(.{3,60}?)\s+(ist|sind|bedeutet|heisst|beschreibt)\s+(.+)$/i);
      if (m) return { q: `Was ${m[2].toLowerCase() === 'sind' ? 'sind' : 'ist'} ${m[1].replace(/^(der|die|das)\s/i, '')}?`, a: m[3].replace(/[.!]$/, '') };
      const words = s.split(' '), long = words.reduce((a, w) => w.replace(/\W/g, '').length > a.replace(/\W/g, '').length ? w : a, '');
      return { q: 'Lückentext: ' + s.replace(long, '_____'), a: long.replace(/[.,!?]/g, '') };
    });
  }
  const long = note.length > 1500 || images.length;
  const content = [...images.slice(0, 4).map(img => ({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } })), { type: 'text', text: note ? note.slice(0, 20000) : 'Erstelle Karten aus den Bildern (Heft-/Buchseiten).' }];
  // Klarstellung nötig: Ohne sie ignorierte die KI Texte, die nicht zum gewählten Fach passten (Mega-Test 25.10.)
  const out = await claude({
    system: `Mach aus dem Lernstoff, den der User schickt, ${long ? '6-15' : '3-6'} präzise Karteikarten für Spaced Repetition. Nutze ausschliesslich diesen Lernstoff (Fach laut User: ${subjectName}; gehört der Text zu einem anderen Fach, gilt der Text).
Regeln: nur prüfungsrelevante Kernaussagen, eine Idee pro Karte, Frage aktiv formuliert (kein Ja/Nein), Antwort max. 25 Wörter, ergänze Fehlendes korrekt.
Antworte NUR mit JSON-Array: [{"q":"…","a":"…"}]`,
    messages: [{ role: 'user', content }], maxTokens: 2500, kind: 'cards',
  });
  return parseJSON(out).filter(c => c?.q && c?.a).map(c => ({ q: String(c.q).replace(/ß/g, 'ss'), a: String(c.a).replace(/ß/g, 'ss') }));
}

// ======================= 5) Brainy-Analyse (Statistik) =======================
export function localInsights({ sessions, subjects, weekMin, lastWeekMin, goal }) {
  const out = [];
  if (!sessions.length) return [{ e: '👋', t: 'Starte deine erste Session – danach analysiere ich dein Lernverhalten.' }];
  const byHour = Array(24).fill(0); sessions.forEach(s => byHour[new Date(s.start).getHours()] += s.min);
  const best = byHour.indexOf(Math.max(...byHour));
  out.push({ e: '⏰', t: `Deine produktivste Zeit ist um ${best}:00 Uhr. Leg schwierige Fächer in dieses Zeitfenster.` });
  if (lastWeekMin > 0) {
    const d = Math.round((weekMin - lastWeekMin) / lastWeekMin * 100);
    out.push(d >= 0 ? { e: '📈', t: `Du bist ${d} % über dem Stand der Vorwoche (gleicher Zeitpunkt). Weiter so!` } : { e: '📉', t: `Du liegst ${-d} % unter dem Stand der Vorwoche – eine 25-min-Session heute holt dich zurück.` });
  }
  const now = Date.now();
  const stale = subjects.map(s => ({ s, last: Math.max(0, ...sessions.filter(x => x.subjectId === s.id).map(x => x.start)) }))
    .filter(x => now - x.last > 6 * 86400000).sort((a, b) => a.last - b.last)[0];
  if (stale) out.push({ e: '🕸️', t: stale.last ? `${stale.s.name} hast du seit ${Math.round((now - stale.last) / 86400000)} Tagen nicht mehr gelernt. Vergessenskurve lässt grüssen!` : `${stale.s.name} hast du noch nie gelernt – plan eine kurze Session ein.` });
  const avg = sessions.reduce((a, s) => a + s.min, 0) / sessions.length;
  if (avg > 75) out.push({ e: '🍅', t: `Deine Sessions sind im Schnitt ${Math.round(avg)} min lang. Probier Pomodoro – kurze Pausen steigern die Konzentration.` });
  const left = goal - weekMin;
  if (left > 0) { const dl = 7 - ((new Date().getDay() + 6) % 7); out.push({ e: '🎯', t: `Für dein Wochenziel fehlen noch ${Math.ceil(left)} min – das sind ca. ${Math.ceil(left / dl)} min pro Tag.` }); }
  else out.push({ e: '🏆', t: 'Wochenziel geknackt! Zeit, das Ziel etwas höher zu setzen?' });
  return out;
}
export async function aiInsights(summary) {
  const out = await claude({
    system: 'Analysiere die Lernstatistik und gib 4 sehr konkrete, persönliche Tipps (je 1 Satz, mit Zahlen aus den Daten). Antworte NUR mit JSON-Array: [{"e":"emoji","t":"Tipp"}]',
    messages: [{ role: 'user', content: JSON.stringify(summary) }], maxTokens: 3000, kind: 'stats',
  });
  return parseJSON(out);
}
