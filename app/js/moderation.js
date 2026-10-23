// Schutzfilter für alles, was Nutzer selbst eingeben (Namen, Bio, Gruppen, Titel, KI-Eingaben).
// Blockiert sexuelle Begriffe, Beleidigungen und Hassbegriffe (DE/CH-Dialekt/FR/IT/EN/RM), auch verschleiert
// (4rsch, a.r.s.c.h, s c h w a n z, schwaaaanz, kyrillische Lookalikes, Zero-Width-Zeichen).
// Gleiche Liste und gleiche Normalisierung wie auf dem Server (supabase/schema.sql: public.is_clean).
// SQL wird mit `node scripts/gen-is-clean.mjs` aus dieser Datei erzeugt – Listen nur hier pflegen.
//
// Ablauf: normalize() → Wörter (Tokens). STEMS = Teilstring in einem Wort (nur lange, eindeutige Stämme),
// WHOLE = nur ganzes Wort (+ Plural-s), damit «Klasse», «Scunthorpe», «Monique» nicht treffen.
// EXCEPT = harmlose Wörter, die ein Stamm enthält (werden vor der Prüfung entfernt).
// Modus `learning` (Lernmaterial, KI-Fragen): Fachbegriffe (LEARNING_OK) erlaubt, Beleidigungen bleiben gesperrt,
// STRICT_ONLY (Aufrufe zu Gewalt, milde Kraftausdrücke, Spam) gilt nur in öffentlichen Feldern.

// ---- Wortlisten (bereits normalisiert: klein, ohne Akzente/Umlaute, ß=ss, ohne Leetspeak) ----
export const STEMS = [
  // Sexuelles DE/CH
  'porno', 'ficken', 'ficker', 'fickt', 'fickte', 'fickst', 'fuck', 'phuck', 'fotze', 'fozze', 'muschi', 'pussy', 'vagina', 'penis', 'pimmel', 'pimmu', 'schwanz', 'schnabi', 'schnaebi', 'schnabbi',
  'blowjob', 'wichs', 'wichser', 'wixer', 'wixxer', 'wixx', 'orgasm', 'sperma', 'cumshot', 'cumslut', 'bumse', 'bumsa',
  'masturb', 'ejakul', 'dildo', 'sextoy', 'sexshop', 'sexcam', 'sexchat', 'sexvideo', 'sexfilm', 'sexting', 'pornhub', 'nuttensohn', 'schwanzlutscher',
  'hurensohn', 'hurenkind', 'hurenbock', 'hurenhund', 'hueresohn', 'huresohn', 'huerensohn', 'huerenhund', 'schlampe', 'onlyfans', 'viagra',
  // Beleidigungen DE/CH
  'arschloch', 'arschgeig', 'arschgesicht', 'arschkriech', 'arschfick', 'arschlecker', 'arschkrampe', 'arschbacke', 'arschli', 'missgeburt', 'mongoloid',
  'gschissen', 'gschiss', 'drecksau', 'dreckssau', 'drecksack', 'dreckskerl', 'dreckschwein', 'miststuck', 'vollidiot', 'vollpfosten', 'schwachkopf',
  'kackbratze', 'sauchaib', 'saucheib', 'sauhund', 'spasti', 'schwuchtel', 'schwuchtl',
  // Sexuelles/Beleidigungen EN
  'motherfucker', 'asshole', 'dickhead', 'dickpic', 'bitch', 'whore', 'slutty', 'jerkoff', 'cocksucker', 'bullshit', 'dumbass', 'jackass', 'fatass', 'shithead', 'shitty',
  'blowie', 'handjob', 'creampie', 'gangbang', 'deepthroat',
  // FR
  'couille', 'couillon', 'salope', 'salopard', 'putain', 'encule', 'enfoire', 'connard', 'connasse', 'merdique', 'niquer', 'niquetamere', 'baiseur',
  // IT
  'cazzo', 'minchia', 'stronz', 'vaffanculo', 'puttan', 'coglion', 'pompino', 'rompicoglioni', 'sborra', 'vaffa',
  // RM (Grundformen)
  'chaschun', 'cagliun', 'gidiot', 'merdas',
  // Hass / Extremismus
  'nigger', 'niggar', 'nigga', 'neger', 'kanake', 'faggot', 'tranny', 'shemale', 'untermensch', 'judensau', 'judenschwein', 'hakenkreuz', 'neonazi', 'hitler', 'heilhitler',
  'siegheil', 'whitepower', 'zigeunerschwein', 'kanakensau', 'negerschwein',
];
export const WHOLE = [
  // Sexuelles
  'sex', 'sexy', 'porn', 'fotz', 'fotza', 'fozza', 'foz', 'fotzen', 'tits', 'boobs', 'nude', 'nudes', 'nackt', 'bj', 'cum', 'cock', 'dick', 'horny', 'milf', 'anal', 'anus', 'hoden', 'erotik',
  'hure', 'huren', 'pimpern', 'titte', 'titten', 'wanker', 'wankers', 'nutte', 'nutten', 'fick', 'fagot', 'slut', 'sluts', 'whore', 'whores', 'blasen', 'fuk', 'fck', 'fuq', 'fcuk', 'pimmel', 'penisse', 'wichsen',
  'ass', 'arse', 'arsch', 'aersche', 'arschs', 'poarsch', 'vulva',
  'bite', 'pute', 'putes', 'nique', 'ntm', 'fdp', 'culo', 'figa', 'fica', 'troia', 'zoccola', 'merda', 'baise', 'baiser', 'cul',
  // Beleidigungen
  'wichser', 'spast', 'spasten', 'behindert', 'behindi', 'mongo', 'mongos', 'opfer', 'idiot', 'idioten', 'cunt', 'cunty', 'retard', 'retarded', 'bastard', 'bastarde',
  'merde', 'merdeux', 'batard', 'bordel', 'stronzo', 'stronza', 'bastardo', 'luder', 'kacke', 'depp', 'cheib', 'chaib', 'cheibe', 'chaibe', 'cheiba', 'cheibä', 'siech',
  
  // Hass
  'nazi', 'nazis', 'jude', 'juden', 'kanak', 'kanaken', 'tschingg', 'tschinggen', 'tschingge', 'tschinggä', 'tschinga', 'tschinge', 'jugo', 'jugos', 'tunte', 'fag', 'fags', 'dyke', 'zigeuner', 'frocio', 'terrone', 'negro', 'negros', 'coon', 'chink', 'gook', 'spic', 'kike', 'wetback', 'paki',
  // Gewalt / Selbstverletzung (nur öffentliche Felder, siehe STRICT_ONLY)
  'kys', 'stirb', 'verreck', 'verrecke', 'verrecken',
];
// Mehrwort-Ausdrücke (Wörter durch ein Leerzeichen getrennt, normalisiert)
export const PHRASES = [
  'sieg heil', 'heil hitler', 'white power', 'fils de pute', 'ta gueule', 'ferme ta gueule', 'ferme la gueule', 'nique ta mere', 'va te faire', 'ta mere la pute', 'va fan culo', 'figlio di puttana', 'figlio di troia',
  'fick dich', 'halt die fresse', 'halt dein maul', 'halt s maul', 'hure sohn', 'huere sohn', 'du huere', 'du hure', 'di huere', 'de huere', 'huere siech', 'huere fotze', 'huere arsch', 'huere schlampe', 'huere wichser',
  'auslander raus', 'bring dich um', 'bring di um', 'bring dich selber um', 'geh sterben', 'ich tote dich', 'ich toete dich', 'ich erschiess dich', 'erschiess dich', 'erhang dich', 'hang dich auf', 'hang di uf', 'kill yourself', 'kill your self', 'go die', 'i will kill you', 'ich stech dich', 'schlitz dich auf', 'schneid dir die pulsadern',
  'cheib sau', 'sau cheib', 'saucheib', 'tschingg sau', 'dreckiger auslander',
];
// Nur in öffentlichen Feldern gesperrt (nicht in Lernmaterial/KI-Fragen): Aufrufe zu Gewalt/Suizid, milde Kraftausdrücke, Spam
export const STRICT_ONLY = new Set([
  'kys', 'stirb', 'verreck', 'verrecke', 'verrecken', 'bring dich um', 'bring di um', 'bring dich selber um', 'geh sterben', 'ich tote dich', 'ich toete dich', 'ich erschiess dich', 'erschiess dich', 'erhang dich', 'hang dich auf', 'hang di uf',
  'kill yourself', 'kill your self', 'go die', 'i will kill you', 'ich stech dich', 'schlitz dich auf', 'schneid dir die pulsadern', 'auslander raus', 'dreckiger auslander',
  'sexy', 'shitty', 'shithead', 'kacke', 'depp', 'cheib', 'chaib', 'cheibe', 'chaibe', 'cheiba', 'cheibä', 'siech', 'cheib sau', 'sau cheib', 'saucheib', 'sauchaib', 'saucheib', 'sauhund', 'luder', 'dumbass', 'jackass', 'fatass',
  'zigeuner', 'negro', 'negros', 'jugo', 'jugos', 'tunte', 'dyke', 'frocio', 'terrone', 'tschingg sau', 'bordel', 'viagra', 'erotik', 'blasen', 'hoden', 'vollpfosten', 'vollidiot', 'schwachkopf', 'kackbratze',
  'coon', 'chink', 'gook', 'spic', 'kike', 'wetback', 'paki', 'bite', 'cul', 'fag', 'fags', 'merdique', 'bastarde',
]);
// In Lern-Eingaben an Brainy erlaubt (Biologie, Geschichte, ABU, Fremdsprachen) – nur in öffentlichen Feldern gesperrt
export const LEARNING_OK = new Set([
  'penis', 'vagina', 'vulva', 'sperma', 'orgasm', 'masturb', 'ejakul', 'anus', 'hoden', 'anal', 'nackt', 'nude', 'sex', 'porno', 'porn', 'schwanz',
  'behindert', 'opfer', 'spasti', 'spast', 'nazi', 'nazis', 'neonazi', 'hitler', 'heilhitler', 'siegheil', 'sieg heil', 'heil hitler', 'hakenkreuz', 'untermensch', 'jude', 'juden',
  'troia', 'geil', 'idiot', 'idioten', 'cum', 'cock', 'dick', 'ass', 'arse', 'baise', 'baiser', 'bastard', 'bastarde', 'bastardo', 'mongo', 'mongos', 'bordel', 'cul', 'culo', 'bite', 'blasen',
  'neger', 'negro', 'negros', 'zigeuner',
]);
// Harmlose Wörter, die einen Stamm enthalten (werden vor der Stamm-Prüfung gelöscht)
export const EXCEPT = [
  'fotzel', 'sandwich', 'shitake', 'schwanzmeise', 'schwanzlurch', 'schwanzflosse', 'schwanzfeder', 'hinterfotzig', 'scunthorpe', 'snigger', 'niggard', 'reneger', 'pussycat', 'pussyfoot', 'pussywillow', 'penistone', 'bumsa', // 'bumsa' nur als Rest von «Kabumsa»-Namen unnötig → siehe unten
].filter(w => w !== 'bumsa');

// ---- Normalisierung ----
// Zeichen-Zuordnung (identisch in SQL per translate): Akzente, Umlaute, Homoglyphen (kyrillisch/griechisch)
const FOLD_PAIRS = [['àáâãäåāăąæ', 'a'], ['çćč', 'c'], ['ď', 'd'], ['èéêëēėęě', 'e'], ['ğ', 'g'], ['ìíîïīį', 'i'], ['ł', 'l'], ['ñńň', 'n'], ['òóôõöøōőœ', 'o'], ['ř', 'r'], ['śšş', 's'], ['ť', 't'],
  ['ùúûüūůű', 'u'], ['ýÿ', 'y'], ['žźż', 'z'], ['аα', 'a'], ['вβ', 'b'], ['еε', 'e'], ['іјιⅰ', 'i'], ['к', 'k'], ['мμ', 'm'], ['нη', 'h'], ['оο', 'o'], ['рρ', 'p'], ['с', 'c'], ['ѕ', 's'], ['тτ', 't'], ['у', 'y'], ['υ', 'u'], ['х', 'x'], ['χ', 'x'], ['ν', 'v'], ['ԁ', 'd'], ['ɡ', 'g']];
export const FOLD_FROM = FOLD_PAIRS.map(([f]) => f).join('');
export const FOLD_TO = FOLD_PAIRS.map(([f, t]) => t.repeat([...f].length)).join('');
// Zero-Width / unsichtbare Zeichen werden entfernt
export const INVISIBLE_RE = '[\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\ufeff\\u00ad\\u034f]';
const INVISIBLE = new RegExp(INVISIBLE_RE, 'g');
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '€': 'e', '¡': 'i' };
const FOLD = (() => { const m = {}; const f = [...FOLD_FROM], t = [...FOLD_TO]; f.forEach((c, i) => { m[c] = t[i]; }); return m; })();
export function normalize(text) {
  let n = String(text || '').toLowerCase().replace(INVISIBLE, '').replace(/ß/g, 'ss').replace(/./gu, c => FOLD[c] ?? c);
  n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');                         // übrige Akzente
  n = n.replace(/([a-z0-9])!(?=[a-z0-9])/g, '$1i').replace(/(^|[^a-z0-9])!(?=[a-z])/g, '$1i');   // «f!ck», «!diot» – aber nicht «Super!»
  n = n.replace(/[0134578@$€¡]/g, c => LEET[c]);
  return n.replace(/(.)\1{2,}/g, '$1');                                  // schwaaaanz → schwanz
}

const stemsActive = (learning) => STEMS.filter(w => !(learning && (LEARNING_OK.has(w) || STRICT_ONLY.has(w))));
const wholeActive = (learning) => new Set(WHOLE.filter(w => !(learning && (LEARNING_OK.has(w) || STRICT_ONLY.has(w)))));
const phrasesActive = (learning) => PHRASES.filter(w => !(learning && (LEARNING_OK.has(w) || STRICT_ONLY.has(w))));
const stemHit = (s, list) => list.some(w => s.includes(w));
const _cache = {};
function lists(learning) {
  const k = learning ? 'l' : 's';
  return _cache[k] ||= { stems: stemsActive(learning), whole: wholeActive(learning), phrases: phrasesActive(learning), exc: new RegExp(EXCEPT.join('|'), 'g') };
}
// true = Text ist in Ordnung. learning: Lernmaterial/KI-Frage (mildere Regeln). links: auch Links/Telefonnummern/Kontaktdaten sperren (öffentliche Felder).
export function isClean(text, { learning = false, links = false } = {}) {
  const raw = String(text || '');
  if (!raw.trim()) return true;
  if (links && !noContactData(raw)) return false;
  if (!learning && /(^|[^a-z])(k{3,}|x{3,})($|[^a-z])|(^|[^0-9])1488($|[^0-9])/i.test(raw)) return false;
  const L = lists(learning);
  const n = normalize(raw);
  // 1) Wörter getrennt durch alles ausser Buchstaben
  const words = n.split(/[^a-z]+/).filter(Boolean);
  // 2) Trennzeichen mitten im Wort entfernen («f.u.c.k», «a_r_s_c_h», «sch-wanz»), Rest trennt Wörter
  const joined = n.replace(/([a-z])[._\-*+~|'`^]+(?=[a-z])/g, '$1').split(/[^a-z]+/).filter(Boolean);
  const toks = [...new Set([...words, ...joined])];
  for (const t of toks) {
    const r = t.replace(L.exc, '');
    if (L.whole.has(r) || (r.endsWith('s') && L.whole.has(r.slice(0, -1)))) return false;
    if (stemHit(r, L.stems)) return false;
  }
  // 3) Wortfolgen aus kurzen Teilen («s c h w a n z», «fu ck», «sch wanz»): bis 12 Teile, höchstens ein Teil länger als 3 Buchstaben;
  //    ganze Wörter nur aus lauter 1–2-Buchstaben-Teilen mit mind. 3 Teilen (sonst träfe «Ana L» → «anal»)
  for (let i = 0; i < words.length; i++) {
    let acc = '', big = 0, mx = 0;
    for (let j = i; j < words.length && j < i + 12; j++) {
      if (words[j].length > 3 && ++big > 1) break;
      acc += words[j]; mx = Math.max(mx, words[j].length);
      if (j > i && (stemHit(acc.replace(L.exc, ''), L.stems) || (j - i >= 2 && mx <= 2 && L.whole.has(acc)))) return false;
    }
  }
  // 4) Ausdrücke
  const sentence = ' ' + words.join(' ') + ' ';
  if (L.phrases.some(p => sentence.includes(' ' + p + ' '))) return false;
  return true;
}
// true = keine Links, E-Mail-Adressen, Telefonnummern oder Messenger-Kontakte (für öffentliche Felder)
export function noContactData(text) {
  const t = String(text || '').toLowerCase().replace(INVISIBLE, '');
  if (/https?:\/\/|www\.|[a-z0-9]\.(com|ch|de|at|fr|it|net|org|io|app|me|ly|gg|tv|xyz|link|co|info|shop|store|online|site|to|cc|ru|cn)($|[^a-z])/.test(t)) return false;
  if (/@[a-z0-9-]+\.[a-z]{2,}/.test(t)) return false;
  if (/(\+?[0-9][ ().\-\/]*){9,}/.test(t)) return false;
  if (/(^|[^a-z])(whatsapp|telegram|snapchat|wa\.me|t\.me)($|[^a-z])/.test(t)) return false;
  return true;
}
export const CLEAN_MSG = 'Dieser Text enthält ein Wort, das bei Brained nicht erlaubt ist. Bitte formuliere es anders.';
export const CONTACT_MSG = 'Bitte gib hier keine Links, Telefonnummern oder Kontaktdaten an.';
// Prüft mehrere Texte auf einmal: '' = alles in Ordnung, sonst die freundliche Meldung (Wort bzw. Kontaktdaten)
export function badMsg(texts, opts = {}) {
  for (const t of [].concat(texts)) { if (opts.links && !noContactData(t)) return CONTACT_MSG; if (!isClean(t, opts)) return CLEAN_MSG; }
  return '';
}
