// Statische Daten & Demo-Community für Brained.
// Hinweis: Schweizer Rechtschreibung (kein ß).
import { NEW_ITEMS, NEW_SKINS, NEW_FRAMES, NEW_CONSUMABLES } from './shop-items.js';

// lv = Schulstufen, für die das Fach vorgeschlagen wird (siehe LEVELS). Eigene Fächer gehen immer.
export const SUBJECTS = [
  { id: 'mathe', name: 'Mathematik', emoji: '📐', color: '#5B6CFF', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'deutsch', name: 'Deutsch', emoji: '📖', color: '#FF4F87', lv: ['sek', 'gym', 'bms', 'wb'] },
  { id: 'franz', name: 'Französisch', emoji: '💬', color: '#2BB0ED', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'englisch', name: 'Englisch', emoji: '🗣️', color: '#F25F5C', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'nt', name: 'Natur & Technik', emoji: '🔬', color: '#16B377', lv: ['sek'] },
  { id: 'rzg', name: 'Räume, Zeiten, Gesellschaften', emoji: '🗺️', color: '#22A699', lv: ['sek'] },
  { id: 'bio', name: 'Biologie', emoji: '🧬', color: '#16B377', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'chemie', name: 'Chemie', emoji: '⚗️', color: '#A35CFF', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'physik', name: 'Physik', emoji: '⚛️', color: '#FF9F1C', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'geschichte', name: 'Geschichte', emoji: '🏛️', color: '#B5835A', lv: ['gym', 'bms'] },
  { id: 'geo', name: 'Geografie', emoji: '🌍', color: '#22A699', lv: ['gym'] },
  { id: 'wr', name: 'Wirtschaft & Recht', emoji: '⚖️', color: '#E0A100', lv: ['gym', 'lehre', 'bms', 'wb'] },
  { id: 'info', name: 'Informatik', emoji: '💻', color: '#3D5A80', lv: ['gym', 'bms', 'uni', 'fh', 'wb'] },
  { id: 'ital', name: 'Italienisch', emoji: '📝', color: '#E4572E', lv: ['sek', 'gym'] },
  { id: 'rw', name: 'Rechnungswesen', emoji: '🧾', color: '#7D8597', lv: ['lehre', 'bms', 'wb', 'fh'] },
  { id: 'abu', name: 'ABU', emoji: '🗳️', color: '#EF476F', lv: ['lehre'] },
  { id: 'bk', name: 'Berufskunde', emoji: '🛠️', color: '#B5835A', lv: ['lehre'] },
  { id: 'analysis', name: 'Analysis', emoji: '∫', color: '#5B6CFF', lv: ['uni', 'fh'] },
  { id: 'linalg', name: 'Lineare Algebra', emoji: '🧮', color: '#2BB0ED', lv: ['uni', 'fh'] },
  { id: 'stat', name: 'Statistik', emoji: '📊', color: '#FF9F1C', lv: ['uni', 'fh', 'wb'] },
  { id: 'bwl', name: 'BWL', emoji: '💼', color: '#E0A100', lv: ['uni', 'fh', 'wb'] },
  { id: 'vwl', name: 'VWL', emoji: '📈', color: '#22A699', lv: ['uni', 'fh'] },
  { id: 'recht', name: 'Recht', emoji: '⚖️', color: '#7D8597', lv: ['uni', 'fh', 'wb'] },
  { id: 'psych', name: 'Psychologie', emoji: '🧠', color: '#A35CFF', lv: ['uni', 'fh'] },
  { id: 'med', name: 'Medizin', emoji: '🩺', color: '#EF476F', lv: ['uni'] },
  { id: 'allg', name: 'Allgemein', emoji: '📚', color: '#9893A8', lv: [] },
  { id: 'philo', name: 'Philosophie', emoji: '💭', color: '#7D8597', lv: [] },
  { id: 'musik', name: 'Musik', emoji: '🎵', color: '#EF476F', lv: [] },
  { id: 'kunst', name: 'Kunst', emoji: '🎨', color: '#FF4F87', lv: [] },
  { id: 'sport', name: 'Sport', emoji: '🏃', color: '#16B377', lv: [] },
  { id: 'reli', name: 'Religion/Ethik', emoji: '🕊️', color: '#B5835A', lv: [] },
  { id: 'latein', name: 'Latein', emoji: '🏺', color: '#E4572E', lv: [] },
  { id: 'span', name: 'Spanisch', emoji: '💃', color: '#F25F5C', lv: [] },
  { id: 'maschbau', name: 'Maschinenbau', emoji: '⚙️', color: '#3D5A80', lv: [] },
  { id: 'etechnik', name: 'Elektrotechnik', emoji: '🔌', color: '#FF9F1C', lv: [] },
  { id: 'paed', name: 'Pädagogik', emoji: '🍎', color: '#22A699', lv: [] },
  { id: 'politik', name: 'Politik', emoji: '🏛️', color: '#5B6CFF', lv: [] },
  { id: 'sozio', name: 'Soziologie', emoji: '👥', color: '#A35CFF', lv: [] },
  { id: 'allgbild', name: 'Allgemeinbildung', emoji: '🧭', color: '#2BB0ED', lv: [] },
  { id: 'praxis', name: 'Lehre/Praxis', emoji: '🛠️', color: '#B5835A', lv: [] },
  { id: 'sonst', name: 'Sonstiges', emoji: '✨', color: '#7D8597', lv: [] },
];

export const SUBJECT_COLORS = ['#5B6CFF', '#FF4F87', '#2BB0ED', '#16B377', '#A35CFF', '#FF9F1C', '#E0A100', '#22A699', '#E4572E', '#3D5A80', '#B5835A', '#7D8597'];
export const SUBJECT_EMOJIS = ['📐', '📖', '🧪', '🧠', '🎨', '🎵', '🏃', '🌱', '📊', '🔬', '✍️', '🗺️', '💡', '🧮', '🩺', '🛠️'];

export const CANTONS = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH'];

// Ziele (Onboarding «Wofür lernst du?») je Schulstufe
export const PURPOSES = {
  gymi: ['🎒', 'Gymi-Prüfung'], bms: ['🧭', 'BMS-Aufnahme'], qv: ['🛠️', 'LAP / QV'], bm: ['📚', 'Berufsmatura'], matura: ['🎓', 'Matura'],
  sem: ['🏛️', 'Semesterprüfungen'], thesis: ['✍️', 'Abschlussarbeit'], dipl: ['💼', 'Diplom / Zertifikat'],
  school: ['📝', 'Prüfungen in der Schule'], habit: ['💪', 'Einfach dranbleiben'],
};
export const PURPOSES_BY_LEVEL = {
  sek: ['gymi', 'bms', 'school', 'habit'], gym: ['matura', 'school', 'habit'], lehre: ['qv', 'bm', 'school', 'habit'],
  bms: ['bm', 'school', 'habit'], fh: ['sem', 'thesis', 'habit'], uni: ['sem', 'thesis', 'habit'], wb: ['dipl', 'habit'],
};

// g = Gruppe im Onboarding (Schule / Ausbildung / Studium / Weiterbildung), hint = Erklärung auf der Kachel
export const LEVELS = [
  { id: 'sek', label: 'Sek / Realschule / Mittelschule', g: 'Schule', hint: 'Oberstufe, Sek, Bez, Real, Hauptschule' },
  { id: 'gym', label: 'Gymnasium / Kanti', g: 'Schule', hint: 'auf dem Weg zur Matura oder zum Abitur' },
  { id: 'bms', label: 'BMS / FMS', g: 'Schule', hint: 'Berufs- oder Fachmittelschule, Fachoberschule' },
  { id: 'lehre', label: 'Berufslehre / Duale Ausbildung', g: 'Ausbildung', hint: 'EFZ, EBA, Lehre mit BM, Berufsschule' },
  { id: 'fh', label: 'Fachhochschule / PH', g: 'Hochschule', hint: 'FH, Pädagogische Hochschule, HF' },
  { id: 'uni', label: 'Universität / ETH', g: 'Hochschule', hint: 'Bachelor, Master, EPFL' },
  { id: 'wb', label: 'Weiterbildung', g: 'Weiterbildung', hint: 'Kurse, Diplome, Zertifikate' },
];

// Avatare: nur Gehirne (Brainy). Farbe + Gesicht + Hintergrund gratis, Skins & Accessoires im Shop.
export const BRAIN_SKINS = [
  { id: 'pink', name: 'Rosa', fill: '#FFD3E2', fold: '#E2648E', price: 0 },
  { id: 'mint', name: 'Minze', fill: '#CFF5E3', fold: '#16B377', price: 0 },
  { id: 'sky', name: 'Himmel', fill: '#CDEBFF', fold: '#2B8FE0', price: 0 },
  { id: 'lemon', name: 'Zitrone', fill: '#FFF0B3', fold: '#E0A800', price: 0 },
  { id: 'lavender', name: 'Lavendel', fill: '#E3DEFF', fold: '#8C7BFF', price: 0 },
  { id: 'peach', name: 'Pfirsich', fill: '#FFE1D1', fold: '#FF7A59', price: 0 },
  { id: 'ice', name: 'Eis-Gehirn', fill: '#E6FBFF', fold: '#5FD3F3', outline: '#1B4B66', rar: 'rare', price: 650, fx: 'snow' },
  { id: 'zombie', name: 'Zombie-Gehirn', fill: '#B9D99A', fold: '#5E7F3A', outline: '#22301A', rar: 'rare', price: 750, fx: 'drip' },
  { id: 'lava', name: 'Lava-Gehirn', fill: '#6B1A12', fold: '#FF8A1A', outline: '#1A0806', rar: 'epic', price: 2600, fx: 'glow' },
  { id: 'robot', name: 'Robo-Gehirn', fill: '#C9D1DC', fold: '#00C2FF', outline: '#2A3340', rar: 'epic', price: 3000, fx: 'robot' },
  { id: 'gold', name: 'Gold-Gehirn', fill: '#FFD95A', fold: '#C98A00', outline: '#5A3D00', rar: 'legend', price: 9000, req: { streak: 14 }, anim: 'gold' },
  { id: 'galaxy', name: 'Galaxie-Gehirn', fill: '#3B2C7A', fold: '#B9A8FF', outline: '#120B2E', rar: 'legend', price: 12500, req: { league: 'Gold III' }, anim: 'galaxy' },
  { id: 'rainbow', name: 'Regenbogen-Gehirn', fill: 'rainbow', fold: '#FFFFFF', rar: 'legend', price: 15000, req: { league: 'Platin I' }, anim: 'rainbow' },
  ...NEW_SKINS,
];
export const BRAIN_MOODS = [['happy', '🙂'], ['grin', '😁'], ['wow', '😮'], ['love', '😍'], ['wink', '😉'], ['think', '😐']];
export const AVATAR_BGS = ['ffd5dc', 'ffdfbf', 'fff1b3', 'c0f2d8', 'b6e3f4', 'd1d4f9', 'e9d5ff', 'f1f0ec'];
export const avatarFromSeed = (seed, i = 0) => { let h = i; for (const c of String(seed || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { skin: BRAIN_SKINS[h % 6].id, mood: BRAIN_MOODS[(h >>> 3) % BRAIN_MOODS.length][0], bg: AVATAR_BGS[(h >>> 6) % AVATAR_BGS.length] }; };

// Ligen nach verifizierter Gesamt-Lernzeit – zum Grinden über Monate:
// ~1 h/Tag → Gold nach ~1 Monat, Diamant nach ~4–5 Monaten, Legende nach gut einem Jahr.
const LG = {
  bronze: ['🥉', 'linear-gradient(140deg,#C8794A,#9C5530)'], silber: ['🥈', 'linear-gradient(140deg,#A3ABBA,#6B7385)'],
  gold: ['🥇', 'linear-gradient(140deg,#F5B70A,#E08A00)'], platin: ['💠', 'linear-gradient(140deg,#3CC9C0,#1F8A9E)'],
  diamant: ['💎', 'linear-gradient(140deg,#2BB0ED,#3F5BD9)'], meister: ['🔮', 'linear-gradient(140deg,#8E5CFF,#5B2FD6)'],
  grossmeister: ['🔥', 'linear-gradient(140deg,#FF6B3D,#D6246E)'], legende: ['👑', 'linear-gradient(140deg,#1B1530,#6D5BFF 55%,#FF4F87)'],
};
const tier = (fam, name, h, n = '') => ({ id: fam + (n ? '-' + n : ''), fam, name: name + (n ? ' ' + n : ''), emoji: LG[fam][0], grad: LG[fam][1], min: h * 60 });
export const LEAGUES = [
  tier('bronze', 'Bronze', 0, 'I'), tier('bronze', 'Bronze', 3, 'II'), tier('bronze', 'Bronze', 7, 'III'),
  tier('silber', 'Silber', 12, 'I'), tier('silber', 'Silber', 18, 'II'), tier('silber', 'Silber', 25, 'III'),
  tier('gold', 'Gold', 35, 'I'), tier('gold', 'Gold', 47, 'II'), tier('gold', 'Gold', 60, 'III'),
  tier('platin', 'Platin', 75, 'I'), tier('platin', 'Platin', 92, 'II'), tier('platin', 'Platin', 110, 'III'),
  tier('diamant', 'Diamant', 135, 'I'), tier('diamant', 'Diamant', 160, 'II'), tier('diamant', 'Diamant', 190, 'III'),
  tier('meister', 'Meister', 230), tier('grossmeister', 'Grossmeister', 300), tier('legende', 'Legende', 400),
];
export const LEAGUE_FAMILIES = Object.keys(LG);

// ---------- Trophäen ----------
// once = einmalig · repeat = jedes Mal neu holbar (Zähler ×N).
// count(c) → wie oft verdient · prog(c) → [aktuell, Ziel] für den Fortschrittsbalken.
// c = Kennzahlen aus store.trophyContext()
export const TROPHY_GROUPS = [['milestones', 'Meilensteine'], ['habits', 'Gewohnheiten'], ['focus', 'Fokus'], ['brainy', 'Brainy'], ['social', 'Gemeinsam']];
const once = (v, t) => (v >= t ? 1 : 0);
const H = c => c.totalMin / 60;
export const TROPHIES = [
  { id: 'first', g: 'milestones', em: '🚀', name: 'Abgehoben', how: 'Schliess deine allererste Lernsession ab (mind. 1 Minute).', count: c => once(c.sessions, 1), prog: c => [c.sessions, 1] },
  { id: 'h10', g: 'milestones', em: '⏱️', name: '10 Stunden', how: 'Lerne insgesamt 10 Stunden.', count: c => once(H(c), 10), prog: c => [H(c), 10] },
  { id: 'h25', g: 'milestones', em: '📚', name: '25 Stunden', how: 'Lerne insgesamt 25 Stunden.', count: c => once(H(c), 25), prog: c => [H(c), 25] },
  { id: 'h50', g: 'milestones', em: '🔥', name: '50 Stunden', how: 'Lerne insgesamt 50 Stunden.', count: c => once(H(c), 50), prog: c => [H(c), 50] },
  { id: 'h100', g: 'milestones', em: '🏔️', name: 'Matterhorn', how: 'Lerne insgesamt 100 Stunden – der Gipfel ruft.', count: c => once(H(c), 100), prog: c => [H(c), 100] },
  { id: 'h250', g: 'milestones', em: '🗻', name: 'Dufourspitze', how: 'Lerne insgesamt 250 Stunden. Höher geht\'s in der Schweiz nicht.', count: c => once(H(c), 250), prog: c => [H(c), 250] },
  { id: 'h500', g: 'milestones', em: '👑', name: 'Legende', how: 'Lerne insgesamt 500 Stunden.', count: c => once(H(c), 500), prog: c => [H(c), 500] },
  { id: 's3', g: 'milestones', em: '✨', name: 'Warmgelaufen', how: 'Lerne 3 Tage in Folge (je mind. 5 min).', count: c => once(c.bestStreak, 3), prog: c => [c.bestStreak, 3] },
  { id: 's7', g: 'milestones', em: '📅', name: 'Wochenheld', how: 'Halte eine 7-Tage-Streak.', count: c => once(c.bestStreak, 7), prog: c => [c.bestStreak, 7] },
  { id: 's30', g: 'milestones', em: '🌋', name: 'Unaufhaltsam', how: 'Halte eine 30-Tage-Streak.', count: c => once(c.bestStreak, 30), prog: c => [c.bestStreak, 30] },
  { id: 's100', g: 'milestones', em: '💯', name: 'Hundert', how: 'Halte eine 100-Tage-Streak. Respekt.', count: c => once(c.bestStreak, 100), prog: c => [c.bestStreak, 100] },

  { id: 'weekgoal', g: 'habits', em: '🎯', name: 'Volltreffer', repeat: true, how: 'Erreiche dein Wochenziel. Jede Woche neu holbar.', count: c => c.goalWeeks, prog: c => [c.weekMin, c.weekGoal] },
  { id: 'perfect', g: 'habits', em: '🌈', name: 'Perfekte Woche', repeat: true, how: 'Lerne an allen 7 Tagen einer Woche (Mo–So).', count: c => c.perfectWeeks, prog: c => [c.daysThisWeek, 7] },
  { id: 'weekend', g: 'habits', em: '🏖️', name: 'Wochenend-Krieger', repeat: true, how: 'Lerne am Samstag UND am Sonntag desselben Wochenendes.', count: c => c.weekends, prog: c => [c.weekendDaysNow, 2] },
  { id: 'bird', g: 'habits', em: '🐦', name: 'Frühaufsteher', repeat: true, how: 'Starte eine Session vor 7 Uhr morgens.', count: c => c.early, prog: c => [Math.min(c.early, 1), 1] },
  { id: 'owl', g: 'habits', em: '🦉', name: 'Nachteule', repeat: true, how: 'Starte eine Session nach 22 Uhr.', count: c => c.night, prog: c => [Math.min(c.night, 1), 1] },
  { id: 'allround', g: 'habits', em: '🎨', name: 'Allrounder', repeat: true, how: 'Lerne 5 verschiedene Fächer in derselben Woche.', count: c => c.allroundWeeks, prog: c => [c.subjectsThisWeek, 5] },
  { id: 'comeback', g: 'habits', em: '🦸', name: 'Comeback', repeat: true, how: 'Lerne wieder, nachdem du 3 oder mehr Tage Pause hattest.', count: c => c.comebacks, prog: c => [Math.min(c.comebacks, 1), 1] },

  { id: 'deep', g: 'focus', em: '🤿', name: 'Deep Work', repeat: true, how: 'Lerne 90 Minuten in einer einzigen Session.', count: c => c.deep, prog: c => [c.longest, 90] },
  { id: 'marathon', g: 'focus', em: '🏃', name: 'Marathon', repeat: true, how: 'Lerne 3 Stunden in einer einzigen Session.', count: c => c.marathon, prog: c => [c.longest, 180] },
  { id: 'pomo4', g: 'focus', em: '🍅', name: 'Tomaten-Ernte', repeat: true, how: 'Schaffe 4 Pomodoros in einer Session.', count: c => c.pomo4, prog: c => [c.maxPomos, 4] },
  { id: 'landing', g: 'focus', em: '🛬', name: 'Punktlandung', repeat: true, how: 'Zieh eine Zielzeit-Session bis zum Ende durch.', count: c => c.goalHits, prog: c => [Math.min(c.goalHits, 1), 1] },
  { id: 'honest', g: 'focus', em: '🙋', name: 'Ehrlich währt', repeat: true, how: 'Bestätige 10× «Bin noch da!». Alle 10 Check-ins gibt\'s eine neue.', count: c => Math.floor(c.checkins / 10), prog: c => [c.checkins % 10, 10] },

  { id: 'cards', g: 'brainy', em: '🃏', name: 'Kartenhai', repeat: true, how: 'Wiederhole 25 Karteikarten an einem Tag.', count: c => c.cardDays, prog: c => [c.cardsToday, 25] },
  { id: 'gamer', g: 'brainy', em: '🕹️', name: 'Neuer Rekord', repeat: true, how: 'Knacke deinen Highscore in einem Karteikarten-Spiel.', count: c => c.gameRecords, prog: c => [Math.min(c.gameRecords, 1), 1] },

  { id: 'team', g: 'social', em: '🤝', name: 'Teamplayer', how: 'Erstelle eine Lerngruppe oder tritt einer bei.', count: c => once(c.groups, 1), prog: c => [c.groups, 1] },
  { id: 'net', g: 'social', em: '🌐', name: 'Netzwerker', how: 'Folge 5 Personen.', count: c => once(c.friends, 5), prog: c => [c.friends, 5] },
  { id: 'motivator', g: 'social', em: '⚡', name: 'Motivator', repeat: true, how: 'Verteile 10 Boosts an andere. Alle 10 Boosts gibt\'s eine neue.', count: c => Math.floor(c.boosts / 10), prog: c => [c.boosts % 10, 10] },
];

// Level-Ränge (XP-Kurve wird mit jedem Level steiler)
export const RANKS = [
  { from: 1, name: 'Neuling', em: '🌱' }, { from: 5, name: 'Fokus-Starter', em: '📘' }, { from: 10, name: 'Lern-Profi', em: '🎓' },
  { from: 20, name: 'Brain-Athlet', em: '🧠' }, { from: 30, name: 'Wissens-Ass', em: '💎' }, { from: 45, name: 'Elite', em: '🏆' }, { from: 60, name: 'Legende', em: '👑' },
];

// Offizielle Brained-Challenges (wechseln wöchentlich – im Prototyp fix).
export const GLOBAL_CHALLENGES = [
  { id: 'gc-sprint', em: '⚡', title: 'Herbst-Sprint', desc: '10 h in 7 Tagen – egal welches Fach.', targetMin: 600, kind: 'minutes', days: 7, grad: 'linear-gradient(140deg,#FF4F87,#FF7A59)', participants: 4812 },
  { id: 'gc-early', em: '🌅', title: 'Früher Vogel', desc: '3 Sessions vor 8 Uhr diese Woche.', target: 3, kind: 'early', days: 7, grad: 'linear-gradient(140deg,#F5B70A,#FF7A1A)', participants: 1290 },
  { id: 'gc-lang', em: '🗣️', title: 'Sprachen-Woche', desc: '3 h Deutsch, Franz, Englisch oder Italienisch.', targetMin: 180, kind: 'lang', days: 7, grad: 'linear-gradient(140deg,#2BB0ED,#3F5BD9)', participants: 2207 },
  { id: 'gc-deep', em: '🤿', title: 'Deep-Work-Duo', desc: '2 Sessions mit je 60+ min.', target: 2, kind: 'deep', days: 7, grad: 'linear-gradient(140deg,#6D5BFF,#A35CFF)', participants: 3021 },
];

// ---------- Demo-Community (bis das Backend steht) ----------
function periodFrac(kind) {
  const now = new Date(), d = new Date(now); d.setHours(0, 0, 0, 0);
  if (kind === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Math.max(.06, (now - d) / (7 * 864e5)); }
  d.setDate(1); const len = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(.05, (now - d) / (len * 864e5));
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const PEOPLE = [
  ['Lea Meier', 'leameier', 'ZH', 'gym'], ['Noah Keller', 'noahk', 'BE', 'lehre'], ['Mia Brunner', 'mia.b', 'LU', 'gym'],
  ['Luca Rossi', 'lucarossi', 'TI', 'uni'], ['Elin Huber', 'elinh', 'AG', 'bms'], ['Liam Graf', 'liamgraf', 'SG', 'sek'],
  ['Sofia Müller', 'sofiam', 'ZH', 'uni'], ['Gian Caduff', 'gianc', 'GR', 'fh'], ['Lina Schmid', 'linaschmid', 'BS', 'gym'],
  ['Nico Weber', 'nicow', 'ZG', 'lehre'], ['Alina Frei', 'alinafrei', 'TG', 'sek'], ['Elias Baumann', 'eliasb', 'SO', 'gym'],
  ['Emma Zürcher', 'emmaz', 'BE', 'fh'], ['Leon Steiner', 'leonst', 'AG', 'lehre'], ['Chiara Bernasconi', 'chiarab', 'TI', 'gym'],
  ['Jonas Fischer', 'jonasf', 'LU', 'uni'], ['Nora Gerber', 'norag', 'FR', 'bms'], ['Aaron Wyss', 'aaronw', 'BL', 'sek'],
  ['Laura Moser', 'lauram', 'SZ', 'gym'], ['Samuel Vogel', 'samvogel', 'ZH', 'uni'], ['Zoé Favre', 'zoefavre', 'VD', 'gym'],
  ['Matteo Bianchi', 'matteob', 'TI', 'lehre'], ['Anja Kälin', 'anjak', 'SZ', 'fh'], ['Tim Bühler', 'timb', 'BE', 'gym'],
  ['Sara Ammann', 'saraa', 'ZH', 'bms'], ['Yanis Rochat', 'yanisr', 'GE', 'uni'], ['Julia Hofer', 'juliah', 'SG', 'gym'],
];

const DEMO_GEAR = [{ hat: 'crown', mouth: 'diamondgrill', frame: 'f-gold', skin: 'gold' }, {}, { eyes: 'shades' }, { hat: 'cap' }, {}, { mouth: 'goldgrill', eyes: 'nerd' }, { hat: 'headphones' }, {}, { hat: 'grad', extra: 'bowtie' }, { frame: 'f-rainbow' }, {}, { eyes: 'hearts' }];
export const COMMUNITY = PEOPLE.map(([name, username, canton, level], i) => {
  const r = rng(1000 + i * 77);
  const weekMin = Math.round(90 + r() * 1100);
  const monthMin = Math.round(weekMin * (3.2 + r() * 1.4));
  const allMin = Math.round(monthMin * (2 + r() * 6));
  const subjects = SUBJECTS.filter(s => s.lv?.length).sort(() => r() - .5).slice(0, 4).map(s => s.id);
  return {
    id: 'u' + i, name, username, canton, level,
    avatar: { ...avatarFromSeed(username, i), ...DEMO_GEAR[i % DEMO_GEAR.length] },
    // Demo-Werte wachsen mit dem Fortschritt der Woche/des Monats (realistische Ranglisten)
    get weekMin() { return Math.round(weekMin * periodFrac('week')); },
    get monthMin() { return Math.round(monthMin * periodFrac('month')); },
    allMin,
    streak: Math.round(r() * 60),
    trophyMap: Object.fromEntries(['first', 's3', 's7', 'h10', 'h25', 'weekgoal', 'deep', 'bird', 'owl', 'pomo4', 'exam55', 'team', 'perfect', 'marathon', 'champ'].filter(() => r() < .6).map(id => [id, ['first', 's3', 's7', 'h10', 'h25', 'team'].includes(id) ? 1 : 1 + Math.floor(r() * 9)])),
    get trophies() { return Object.values(this.trophyMap).reduce((a, b) => a + b, 0); },
    favSubject: subjects[0], subjects,
    bio: ['Matur 2027 🎓', 'LAP-Vorbereitung 💪', 'Basisprüfung incoming', 'Gymi-Prüfig 🙏', 'Kaffi + Lernen ☕', 'Road to ETH', ''][i % 7],
  };
});

export const SEED_GROUPS = [
  { id: 'g-4b', name: 'Klasse 4b – Kanti', emoji: '🏫', color: '#5B6CFF', code: 'KANTI4', members: ['u0', 'u2', 'u8', 'u11', 'u18', 'u23', 'u26'], weeklyGoalH: 50 },
  { id: 'g-eth', name: 'ETH Basisprüfung', emoji: '🧪', color: '#16B377', code: 'BASIS1', members: ['u3', 'u6', 'u15', 'u19', 'u25'], weeklyGoalH: 80 },
  { id: 'g-lap', name: 'LAP Crew 2026', emoji: '🛠️', color: '#FF9F1C', code: 'LAP026', members: ['u1', 'u9', 'u13', 'u21'], weeklyGoalH: 30 },
];

// Werbe-Platzhalter (Native Ads, deutschsprachig, CH-Bezug)
export const ADS = [
  { em: '📚', bg: '#FFE7A3', title: 'Buchhandlung (Beispiel): 20 % auf Lernhilfen', sub: 'Platzhalter-Inserat – Code BRAINED20', cta: 'Ansehen' },
  { em: '🚆', bg: '#C0F2D8', title: 'ÖV-Abo für Lernende (Beispiel)', sub: 'Platzhalter-Inserat – Pendeln & lernen', cta: 'Mehr' },
  { em: '🎧', bg: '#D1D4F9', title: 'Lo-Fi Streaming (Beispiel)', sub: 'Platzhalter-Inserat – 3 Monate gratis', cta: 'Holen' },
];

// ---------- Prüfungsgenerator: Schweizer Prüfungsformate ----------
// Blueprints steuern Brainy (Dauer, Aufbau, Stil). Archive = offizielle Quellen zum Üben mit Originalen.
// Prüfungsarten mit offiziellem Aufbau («Blueprint»). Quellen: kantonale Prüfungsreglemente/-infos
// (ZAP ZH, BM-Aufnahmeprüfungen z. B. GIBZ Zug / BMS Zürich, ABU-Schlussprüfung SO, BMP-Rahmenlehrplan 2012).
// Brainy erstellt damit NEUE Aufgaben im echten Format – Originale werden nur verlinkt (Urheberrecht der Kantone).
/* ---------------- Shop ----------------
   Währung: Brain-Coins 🪙 – man verdient 1 Coin pro XP (+100 Startbonus). Ausgeben senkt XP/Level NICHT. */
export const RARITY = {
  common: { label: 'Gewöhnlich', color: '#57A6FF' },
  rare: { label: 'Selten', color: '#16B377' },
  epic: { label: 'Episch', color: '#8C5BFF' },
  legend: { label: 'Legendär', color: '#F5A30A' },
};
export const COIN_BONUS = 100;
export const SLOTS = [['hat', 'Kopf'], ['eyes', 'Augen'], ['mouth', 'Mund'], ['extra', 'Extras']];
export const SHOP_ITEMS = [
  { id: 'grad', slot: 'hat', name: 'Maturhut', rar: 'common', price: 90 },
  { id: 'party', slot: 'hat', name: 'Partyhut', rar: 'common', price: 130 },
  { id: 'cap', slot: 'hat', name: 'Propeller-Cap', rar: 'common', price: 190 },
  { id: 'ninja', slot: 'hat', name: 'Ninja-Band', rar: 'rare', price: 550 },
  { id: 'swiss', slot: 'hat', name: 'Sennenhut', rar: 'rare', price: 700 },
  { id: 'headphones', slot: 'hat', name: 'Kopfhörer', rar: 'rare', price: 900 },
  { id: 'wizard', slot: 'hat', name: 'Zauberhut', rar: 'epic', price: 2400 },
  { id: 'halo', slot: 'hat', name: 'Heiligenschein', rar: 'epic', price: 3700 },
  { id: 'crown', slot: 'hat', name: 'Krone', rar: 'legend', price: 10000, req: { streak: 14 } },
  { id: 'laurel', slot: 'hat', name: 'Gold-Lorbeer', rar: 'legend', price: 0, pro: true, month: 'Oktober' }, // Pro-Item des Monats
  { id: 'nerd', slot: 'eyes', name: 'Streberbrille', rar: 'common', price: 140 },
  { id: 'shades', slot: 'eyes', name: 'Sonnenbrille', rar: 'rare', price: 450 },
  { id: 'hearts', slot: 'eyes', name: 'Herzbrille', rar: 'rare', price: 800 },
  { id: 'monocle', slot: 'eyes', name: 'Monokel', rar: 'epic', price: 2100 },
  { id: 'mustache', slot: 'mouth', name: 'Schnauz', rar: 'common', price: 200 },
  { id: 'gum', slot: 'mouth', name: 'Kaugummi', rar: 'rare', price: 500 },
  { id: 'goldgrill', slot: 'mouth', name: 'Gold-Grillz', rar: 'epic', price: 2700 },
  { id: 'diamondgrill', slot: 'mouth', name: 'Diamant-Grillz', rar: 'legend', price: 13000, req: { league: 'Gold III' } },
  { id: 'bowtie', slot: 'extra', name: 'Fliege', rar: 'common', price: 170 },
  { id: 'chain', slot: 'extra', name: 'Goldkette', rar: 'epic', price: 3400 },
  { id: 'astro', slot: 'extra', name: 'Astro-Helm', rar: 'epic', price: 3500 },
  ...NEW_ITEMS,
];
// Verbrauchsartikel (mehrfach kaufbar)
export const SHOP_CONSUMABLES = [{ id: 'freeze', name: 'Streak-Schutz', emoji: '🧊', price: 250 }, ...NEW_CONSUMABLES];
// Abo
export const PRO = { monthly: 14.9, yearly: 129, group: { monthly: 24.9, yearly: 249 }, freezesPerMonth: 2 };
// Komplett-Avatare: Skin + Accessoires im Paket (günstiger als einzeln)
export const SHOP_BUNDLES = []; // Sets gibt es nicht mehr (jedes Teil ist ein eigenes Item); Export bleibt für scripts/migrate.mjs
export const SHOP_FRAMES = [
  { id: 'f-mint', name: 'Minze', rar: 'common', price: 70 },
  { id: 'f-sunset', name: 'Sonnenuntergang', rar: 'common', price: 100 },
  { id: 'f-gold', name: 'Gold', rar: 'rare', price: 500 },
  { id: 'f-swiss', name: 'Schweiz', rar: 'rare', price: 600 },
  { id: 'f-neon', name: 'Neon', rar: 'epic', price: 2200 },
  { id: 'f-rainbow', name: 'Regenbogen', rar: 'epic', price: 2800 },
  { id: 'f-fire', name: 'Feuer', rar: 'legend', price: 8000, req: { streak: 14 } },
  { id: 'f-galaxy', name: 'Galaxie', rar: 'legend', price: 10500, req: { streak: 30 } },
  ...NEW_FRAMES,
];
