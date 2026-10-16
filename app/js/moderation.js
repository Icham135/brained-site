// Schutzfilter für alles, was Nutzer selbst eingeben (Namen, Bio, Gruppen, Titel, KI-Eingaben).
// Blockiert sexuelle Begriffe, Beleidigungen und Hassbegriffe (DE/FR/IT/EN), auch verschleiert (4rsch, a.r.s.c.h, aaarsch).
// Gleiche Liste wie auf dem Server (supabase/schema.sql: public.is_clean, Edge Function brainy).

// Wortstämme (normalisiert: Kleinbuchstaben, ohne Akzente, Leetspeak aufgelöst, Wiederholungen gekürzt)
export const BLOCKED = [
  // Sexuelles
  'sex', 'porn', 'porno', 'fick', 'fuck', 'fotze', 'muschi', 'pussy', 'vagina', 'penis', 'pimmel', 'schwanz', 'dick', 'cock', 'titte', 'titten', 'tits', 'boobs', 'nackt', 'nude', 'nudes',
  'blowjob', 'bj', 'wichs', 'wanker', 'jerk', 'orgasm', 'sperma', 'cum', 'horny', 'geil', 'milf', 'anal', 'arsch', 'ass', 'arse', 'hure', 'nutte', 'slut', 'whore', 'bitch', 'onlyfans', 'xxx',
  'bite', 'baise', 'salope', 'cazzo', 'figa', 'troia', 'puttana', 'pompino',
  // Beleidigungen
  'hurensohn', 'wichser', 'missgeburt', 'spast', 'spasti', 'behindert', 'mongo', 'opfer', 'schlampe', 'idiot', 'arschloch', 'motherfucker', 'asshole', 'cunt', 'retard',
  'connard', 'putain', 'merde', 'encule', 'stronzo', 'vaffanculo', 'coglione',
  // Hass / Extremismus
  'nazi', 'hitler', 'kkk', 'nigger', 'nigga', 'neger', 'kanake', 'schwuchtel', 'faggot', 'tranny', 'jude',
];
// Diese kurzen/mehrdeutigen Stämme nur als ganzes Wort (sonst trifft «ass» Wörter wie «Klasse», «sex» «Sextant»)
const WHOLE = new Set(['cock', 'ass', 'arse', 'arsch', 'dick', 'cum', 'sex', 'bj', 'bite', 'figa', 'jude', 'opfer', 'idiot', 'geil', 'anal', 'nackt', 'jerk', 'merde', 'mongo', 'nude', 'xxx', 'porn', 'troia', 'spast']);
// In Lern-Eingaben an Brainy erlaubt (Biologie, Geschichte, ABU) – nur in Namen/Profilen gesperrt
const LEARNING_OK = new Set(['penis', 'vagina', 'sperma', 'orgasm', 'nackt', 'anal', 'behindert', 'opfer', 'nazi', 'hitler', 'jude', 'troia', 'geil', 'sex', 'nude', 'schwanz', 'idiot']);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '€': 'e' };
export function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .replace(/[0134578@$!€]/g, c => LEET[c] ?? c).replace(/(.)\1{2,}/g, '$1');
}
// true = Text ist in Ordnung
export function isClean(text, { learning = false } = {}) {
  const n = normalize(text);
  if (!n.trim()) return true;
  const words = n.split(/[^a-z]+/).filter(Boolean);
  const squashed = n.replace(/[^a-z]/g, '');           // «a.r.s.c.h» → «arsch»
  // Einzelbuchstaben-Folgen zusammenziehen («a r s c h» → «arsch»)
  n.replace(/(?:\b[a-z]\b[^a-z]*){3,}/g, m => { words.push(m.replace(/[^a-z]/g, '')); return m; });
  return !BLOCKED.some(w => !(learning && LEARNING_OK.has(w)) && (WHOLE.has(w) ? words.includes(w) || words.some(x => x === w + 's') : squashed.includes(w)));
}
export const CLEAN_MSG = 'Dieser Text enthält ein Wort, das bei Brained nicht erlaubt ist. Bitte formuliere es anders.';
