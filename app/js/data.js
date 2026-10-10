// Statische Daten & Demo-Community für Brained.
// Hinweis: Schweizer Rechtschreibung (kein ß).

// lv = Schulstufen, für die das Fach vorgeschlagen wird (siehe LEVELS). Eigene Fächer gehen immer.
export const SUBJECTS = [
  { id: 'mathe', name: 'Mathematik', emoji: '📐', color: '#5B6CFF', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'deutsch', name: 'Deutsch', emoji: '📖', color: '#FF4F87', lv: ['sek', 'gym', 'bms', 'wb'] },
  { id: 'franz', name: 'Französisch', emoji: '🥐', color: '#2BB0ED', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'englisch', name: 'Englisch', emoji: '💂', color: '#F25F5C', lv: ['sek', 'gym', 'lehre', 'bms', 'wb'] },
  { id: 'nt', name: 'Natur & Technik', emoji: '🔬', color: '#16B377', lv: ['sek'] },
  { id: 'rzg', name: 'Räume, Zeiten, Gesellschaften', emoji: '🗺️', color: '#22A699', lv: ['sek'] },
  { id: 'bio', name: 'Biologie', emoji: '🧬', color: '#16B377', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'chemie', name: 'Chemie', emoji: '⚗️', color: '#A35CFF', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'physik', name: 'Physik', emoji: '⚛️', color: '#FF9F1C', lv: ['gym', 'bms', 'uni', 'fh'] },
  { id: 'geschichte', name: 'Geschichte', emoji: '🏛️', color: '#B5835A', lv: ['gym', 'bms'] },
  { id: 'geo', name: 'Geografie', emoji: '🌍', color: '#22A699', lv: ['gym'] },
  { id: 'wr', name: 'Wirtschaft & Recht', emoji: '⚖️', color: '#E0A100', lv: ['gym', 'lehre', 'bms', 'wb'] },
  { id: 'info', name: 'Informatik', emoji: '💻', color: '#3D5A80', lv: ['gym', 'bms', 'uni', 'fh', 'wb'] },
  { id: 'ital', name: 'Italienisch', emoji: '🍕', color: '#E4572E', lv: ['sek', 'gym'] },
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

export const LEVELS = [
  { id: 'sek', label: 'Sek / Bez', emoji: '🎒' },
  { id: 'gym', label: 'Gymnasium / Kanti', emoji: '🏫' },
  { id: 'lehre', label: 'Berufslehre (EFZ/EBA)', emoji: '🛠️' },
  { id: 'bms', label: 'BMS / FMS', emoji: '📚' },
  { id: 'fh', label: 'FH / PH', emoji: '🎓' },
  { id: 'uni', label: 'Uni / ETH / EPFL', emoji: '🔬' },
  { id: 'wb', label: 'Weiterbildung', emoji: '💼' },
];

// Avatare: nur Gehirne (Brainy). Farbe + Gesicht + Hintergrund gratis, Skins & Accessoires im Shop.
export const BRAIN_SKINS = [
  { id: 'pink', name: 'Rosa', fill: '#FFD3E2', fold: '#E2648E', price: 0 },
  { id: 'mint', name: 'Minze', fill: '#CFF5E3', fold: '#16B377', price: 0 },
  { id: 'sky', name: 'Himmel', fill: '#CDEBFF', fold: '#2B8FE0', price: 0 },
  { id: 'lemon', name: 'Zitrone', fill: '#FFF0B3', fold: '#E0A800', price: 0 },
  { id: 'lavender', name: 'Lavendel', fill: '#E3DEFF', fold: '#8C7BFF', price: 0 },
  { id: 'peach', name: 'Pfirsich', fill: '#FFE1D1', fold: '#FF7A59', price: 0 },
  { id: 'ice', name: 'Eis-Gehirn', fill: '#E6FBFF', fold: '#5FD3F3', outline: '#1B4B66', rar: 'rare', price: 500, fx: 'snow' },
  { id: 'zombie', name: 'Zombie-Gehirn', fill: '#B9D99A', fold: '#5E7F3A', outline: '#22301A', rar: 'rare', price: 600, fx: 'drip' },
  { id: 'lava', name: 'Lava-Gehirn', fill: '#6B1A12', fold: '#FF8A1A', outline: '#1A0806', rar: 'epic', price: 1200, fx: 'glow' },
  { id: 'robot', name: 'Robo-Gehirn', fill: '#C9D1DC', fold: '#00C2FF', outline: '#2A3340', rar: 'epic', price: 1400, fx: 'robot' },
  { id: 'gold', name: 'Gold-Gehirn', fill: '#FFD95A', fold: '#C98A00', outline: '#5A3D00', rar: 'legend', price: 2500, fx: 'shine' },
  { id: 'galaxy', name: 'Galaxie-Gehirn', fill: '#3B2C7A', fold: '#B9A8FF', outline: '#120B2E', rar: 'legend', price: 3000, fx: 'stars' },
  { id: 'rainbow', name: 'Regenbogen-Gehirn', fill: 'rainbow', fold: '#FFFFFF', rar: 'legend', price: 3500 },
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

  { id: 'feyn', g: 'brainy', em: '🧑‍🏫', name: 'Mini-Prof', repeat: true, how: 'Erreiche im Feynman-Duell einen Score von 80 oder mehr.', count: c => c.feyn80, prog: c => [c.feynBest, 80] },
  { id: 'exam55', g: 'brainy', em: '📝', name: 'Prüfungsprofi', repeat: true, how: 'Schreib eine Probeprüfung mit Note 5.5 oder besser.', count: c => c.exam55, prog: c => [c.examBest, 5.5] },
  { id: 'exam6', g: 'brainy', em: '🥇', name: 'Glatte Sechs', repeat: true, how: 'Schreib eine Probeprüfung mit der Note 6.', count: c => c.exam6, prog: c => [c.examBest, 6] },
  { id: 'cards', g: 'brainy', em: '🃏', name: 'Kartenhai', repeat: true, how: 'Wiederhole 25 Karteikarten an einem Tag.', count: c => c.cardDays, prog: c => [c.cardsToday, 25] },
  { id: 'gamer', g: 'brainy', em: '🕹️', name: 'Neuer Rekord', repeat: true, how: 'Knacke deinen Highscore in einem Karteikarten-Spiel.', count: c => c.gameRecords, prog: c => [Math.min(c.gameRecords, 1), 1] },
  { id: 'planer', g: 'brainy', em: '🗓️', name: 'Masterplan', repeat: true, how: 'Übernimm einen Brainy-Lernplan in deinen Kalender.', count: c => c.plans, prog: c => [Math.min(c.plans, 1), 1] },

  { id: 'team', g: 'social', em: '🤝', name: 'Teamplayer', how: 'Erstelle eine Lerngruppe oder tritt einer bei.', count: c => once(c.groups, 1), prog: c => [c.groups, 1] },
  { id: 'net', g: 'social', em: '🌐', name: 'Netzwerker', how: 'Folge 5 Personen.', count: c => once(c.friends, 5), prog: c => [c.friends, 5] },
  { id: 'champ', g: 'social', em: '🏅', name: 'Challenge-Champion', repeat: true, how: 'Schliesse eine Challenge erfolgreich ab.', count: c => c.challengesDone, prog: c => [Math.min(c.challengesDone, 1), 1] },
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
  const subjects = SUBJECTS.slice().sort(() => r() - .5).slice(0, 4).map(s => s.id);
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
export const EXAM_TYPES = [
  { id: 'zap', name: 'Gymi-Prüfung (ZAP)', em: '🏫', stage: '6. Klasse / Sek', minutes: 90, subjects: ['mathe', 'deutsch'],
    format: 'Zentrale Aufnahmeprüfung (ZAP) Kanton Zürich fürs Lang-/Kurzgymnasium. Schriftlich, ohne Taschenrechner.',
    blueprint: {
      mathe: 'Mathematik (90 min, ohne Taschenrechner): Grundoperationen und Kopfrechnen, Brüche/Dezimalzahlen, Masseinheiten umrechnen, Proportionalität und Dreisatz, Geometrie (Flächen, Umfang, Winkel, Körper, Konstruktion beschreiben), Knobel- und Textaufgaben aus dem Alltag. Lösungsweg gibt Teilpunkte. Viele mehrteilige Aufgaben mit steigender Schwierigkeit.',
      deutsch: 'Deutsch: Textverständnis zu einem Sachtext oder einer Erzählung (Fragen zum Inhalt, zur Absicht, zu Wortbedeutungen), Sprachbetrachtung (Wortarten, Satzglieder, Zeitformen, Rechtschreibung, Zeichensetzung) und ein kurzer Aufsatz/Schreibauftrag.' },
    archives: [{ label: 'Offizielle ZAP-Prüfungen mit Lösungen (Kanton Zürich)', url: 'https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/pruefung-fuer-das-langgymnasium.html' }] },
  { id: 'bmsauf', name: 'BMS-Aufnahmeprüfung', em: '🎒', stage: 'Sek / Lehre', minutes: 90, subjects: ['mathe', 'deutsch', 'englisch', 'franz'],
    format: 'Aufnahmeprüfung Berufsmaturitätsschule. Stoff bis und mit 1. Semester 3. Sek. Bestanden mit Schnitt ≥ 4.0, Mathe zählt oft doppelt.',
    blueprint: {
      mathe: 'Mathematik in zwei Teilen: Teil 1 «Fertigkeiten» ohne Taschenrechner (Termumformungen, Binome, Bruchterme, lineare Gleichungen und Gleichungssysteme, Potenzen/Wurzeln, Prozent- und Zinsrechnen) und Teil 2 «Konzeptaufgaben» mit Taschenrechner (Geometrie: Pythagoras, Flächen/Volumen, Ähnlichkeit; lineare Funktionen; mehrteilige Textaufgaben, Lösungsweg zählt).',
      deutsch: 'Deutsch (Duden erlaubt): Textverständnis eines Sachtexts, Grammatik und Sprachbetrachtung (Satzglieder, Konjunktiv, indirekte Rede, Kommaregeln) und ein Aufsatz/argumentativer Text.',
      englisch: 'Englisch (Niveau A2–B1): Reading comprehension, Grammar (tenses, conditionals, passive, reported speech), Vocabulary in context, kurzer Schreibauftrag.',
      franz: 'Französisch (Niveau A2–B1): Compréhension écrite, Grammaire (passé composé/imparfait, pronoms, accord), Vocabulaire, kurze Production écrite.' },
    archives: [{ label: 'BMS Zürich: Aufnahmeprüfung & Musterprüfungen', url: 'https://www.bms-zuerich.ch/aufnahme/aufnahmebedingungen/aufnahmepruefung' }] },
  { id: 'qv', name: 'LAP / QV', em: '🛠️', stage: 'Berufslehre EFZ/EBA', minutes: 70, subjects: ['abu', 'wr', 'rw', 'deutsch', 'englisch', 'franz', 'info'],
    format: 'Qualifikationsverfahren. ABU-Schlussprüfung: 70 min «Gesellschaft» + 70 min «Sprache & Kommunikation». Hilfsmittel: Duden, Gesetzestexte (ZGB/OR/BV), Taschenrechner.',
    blueprint: {
      abu: 'ABU Lernbereich Gesellschaft: ca. 40 % Wissensfragen zu allen Themen (Recht, Verträge: Kauf-/Miet-/Arbeitsvertrag, Konsum und Geld, Budget, Steuern, Versicherungen, Staat und Politik, Abstimmungen, Globale Herausforderungen, Berufliche Zukunft planen) und ca. 60 % Anwendungs-/Problemlösungsaufgaben an Fallbeispielen mit Gesetzesartikeln (ZGB/OR/BV, Artikel nennen). Sprache & Kommunikation: Text- und Grafikverständnis, Textproduktion (Zusammenfassung, Kommentar, Geschäftsbrief), Rechtschreibung/Grammatik.',
      wr: 'Wirtschaft & Recht (QV): Fallbeispiele zu Verträgen (OR), Unternehmensformen, Marketing, Finanzierung, Konjunktur, Geld und Preise. Mit Begründung und Gesetzesartikel.',
      rw: 'Rechnungswesen (QV Kaufleute): Buchungssätze, Bilanz/Erfolgsrechnung, Abschluss, MWST, Abschreibungen, Kalkulation, Zinsen, Lohnabrechnung. Lösungsweg zählt.' },
    archives: [{ label: 'ABU-Wissensfragen mit Lösungen (BBZ Olten)', url: 'https://bbzolten.so.ch/fileadmin/bbz-olten/GIBS/ABU/QV/2025/Wissensfragen_Loesungen_2025.pdf' },
      { label: 'QV-Übungsserien Kaufleute (KFMV)', url: 'https://www.kfmv.ch/angebot/dienstleistungen/qv-uebungsserien' }] },
  { id: 'bmp', name: 'BMS-Abschluss (BMP)', em: '📚', stage: 'Berufsmaturität', minutes: 120, subjects: ['mathe', 'deutsch', 'englisch', 'franz', 'wr', 'geschichte', 'physik', 'chemie'],
    format: 'Berufsmaturitätsprüfung nach Rahmenlehrplan BM 2012. Typisch 120 min, ca. 10 Aufgaben mit total 100 Punkten, nicht programmierbarer Taschenrechner + Formelsammlung.',
    blueprint: {
      mathe: 'Mathematik BMP (z. B. Richtung Wirtschaft/Technik): Gleichungen und Gleichungssysteme, Funktionen (linear, quadratisch, exponentiell, Logarithmus), Folgen und Reihen, Finanzmathematik (Zins, Rente), Trigonometrie, Vektorgeometrie (TAL), Wahrscheinlichkeit/Statistik. Ca. 10 mehrteilige Aufgaben, total 100 Punkte, Lösungsweg zählt.',
      deutsch: 'Deutsch BMP: Erörterung/Interpretation zu einem literarischen oder pragmatischen Text, Textanalyse, Sprachreflexion.',
      englisch: 'Englisch BMP (B2): Reading, Use of English, Writing (essay/formal letter), Literature/Culture.',
      franz: 'Französisch BMP (B1–B2): Compréhension, Grammaire en contexte, Production écrite.',
      wr: 'Wirtschaft & Recht BMP: Volkswirtschaft (Konjunktur, Geldpolitik SNB, Aussenhandel), Betriebswirtschaft (Unternehmensmodell, Marketing, Finanzen), Recht (OR, ZGB) mit Fallbeispielen.' },
    archives: [{ label: 'Beispiel: BMP Mathematik 2024 (KV Zürich, PDF)', url: 'https://www.kvz-schule.ch/fileadmin/data/dokumente/bildungsangebot/qv/alte_abschlusspruefungen/2024.mathematik.bmp.wdw_seriea_aufgaben.pdf' }] },
  { id: 'matura', name: 'Matura', em: '🎓', stage: 'Gymnasium', minutes: 180, subjects: ['mathe', 'deutsch', 'englisch', 'franz', 'bio', 'chemie', 'physik', 'geschichte', 'geo', 'ital', 'wr'],
    format: 'Schriftliche Maturitätsprüfung (MAR/MAV), 3–4 Stunden. Offene Aufgaben mit Begründung, Analyse und Transfer auf Gymnasialniveau.',
    blueprint: {
      mathe: 'Mathematik Matura: Analysis (Ableitung, Kurvendiskussion, Integral, Extremalprobleme), Vektorgeometrie, Wahrscheinlichkeit/Kombinatorik, Folgen. Mehrteilige Aufgaben, vollständiger Lösungsweg.',
      deutsch: 'Deutsch Matura: Aufsatz (Erörterung, Interpretation eines Gedichts/Prosatexts, Essay) – Aufgaben mit Textbezug und Begründung.' } },
  { id: 'school', name: 'Schulprüfung', em: '✏️', stage: 'Alle Stufen', minutes: 45, subjects: null,
    format: 'Normale Klassenprüfung zum angegebenen Thema, Schwierigkeit passend zur Schulstufe.' },
];

// Offline-Fragenbank (Demo-Modus ohne Claude). Mit Claude werden echte Prüfungen generiert.

// Deckblatt & Layout wie bei den echten Prüfungen (öffentliche Vorlagen: ZAP ZH, BMS-Aufnahme BS/ZG, BMP KV Zürich 2024/25, ABU-SP Solothurn)
const PAPER = {
  zap: { kicker: 'Zentrale Aufnahmeprüfung (Format ZAP)', org: 'Gymnasium · Langgymnasium/Kurzgymnasium', answer: 'grid', points: 'total ca. 30–40 Punkte, ganze und halbe Punkte, 8–12 Aufgaben mit Teilaufgaben',
    aids: 'Geodreieck, Zirkel, Lineal, Bleistift für Konstruktionen. Kein Taschenrechner.',
    rules: ['Löse alle Aufgaben direkt auf diesen Blättern.', 'Der Lösungsweg muss ersichtlich sein – nur so gibt es Teilpunkte.', 'Resultate ohne Lösungsweg geben höchstens einen Punkt.', 'Schreibe sauber mit Füller oder Kugelschreiber.'] },
  bmsauf: { kicker: 'Aufnahmeprüfung Berufsmaturität', org: 'Berufsmaturitätsschule (BMS)', answer: 'grid', formal: true, points: 'total ca. 60–70 Punkte, nur ganze Punkte',
    aids: 'Teil 1: keine Hilfsmittel. Teil 2: Taschenrechner (nicht programmierbar), Geodreieck.',
    rules: ['Lösen Sie die Aufgaben auf den Aufgabenblättern.', 'Der Lösungsweg muss klar ersichtlich sein. Resultate ohne Lösungsweg geben keine Punkte.', 'Es werden nur ganze Punkte vergeben.', 'Folgefehler ergeben keinen weiteren Abzug.'] },
  qv: { kicker: 'Qualifikationsverfahren (QV) · Schlussprüfung', org: 'Berufsfachschule · EFZ/EBA', answer: 'lines', formal: true, points: 'total ca. 60 Punkte',
    aids: 'Duden, Gesetzestexte (ZGB, OR, BV), Taschenrechner. Keine eigenen Notizen.',
    rules: ['Beantworten Sie die Fragen direkt auf den Prüfungsblättern.', 'Nennen Sie bei Rechtsfragen den massgebenden Gesetzesartikel.', 'Begründen Sie Ihre Antworten in ganzen Sätzen, wo verlangt.', 'Unleserliche Antworten werden nicht bewertet.'] },
  bmp: { kicker: 'Berufsmaturität · Abschlussprüfung', org: 'Berufsmaturitätsprüfung (BMP)', answer: 'grid', formal: true, points: 'total genau 100 Punkte, 8–10 mehrteilige Aufgaben (5–18 Punkte je Aufgabe)',
    aids: 'Taschenrechner ohne CAS/Solver, nicht programmierbar. Beigelegte Formelsammlung.',
    rules: ['Unbelegte Resultate (fehlender Lösungsweg) werden nicht berücksichtigt.', 'Lösungsschritte werden bewertet.', 'Resultate müssen eindeutig und aussagekräftig dargestellt sein.', 'Als Schreibmaterial sind Bleistift und Rotstift nicht gestattet (ausgenommen grafische Darstellungen).'] },
  matura: { kicker: 'Maturitätsprüfung', org: 'Gymnasium · schriftliche Maturität', answer: 'grid', formal: true, points: 'total ca. 60–80 Punkte, 4–6 grosse mehrteilige Aufgaben',
    aids: 'Taschenrechner gemäss Liste der Schule, Formelsammlung (z. B. «Formeln, Tabellen, Begriffe»).',
    rules: ['Jede Aufgabe auf einem neuen Blatt beginnen.', 'Der Lösungsweg muss vollständig und nachvollziehbar sein.', 'Skizzen und Grafiken sauber beschriften.', 'Die Punktzahl jeder Teilaufgabe ist angegeben.'] },
  school: { kicker: 'Klassenprüfung', org: 'Schule', answer: 'lines', points: 'total ca. 25–40 Punkte',
    aids: 'Keine (ausser von der Lehrperson erlaubt).',
    rules: ['Lies jede Aufgabe genau durch.', 'Der Lösungsweg muss ersichtlich sein.', 'Schreibe sauber und leserlich.'] },
};
EXAM_TYPES.forEach(t => { t.paper = PAPER[t.id]; });

export const DEMO_QUESTIONS = {
  mathe: [
    { type: 'mc', topic: 'Algebra', points: 2, q: 'Löse: 3x − 7 = 2x + 5', options: ['x = 12', 'x = −2', 'x = 2', 'x = 5'], correct: 0, explain: '3x − 2x = 5 + 7 → x = 12.' },
    { type: 'mc', topic: 'Prozent', points: 2, q: 'Ein Velo kostet CHF 640. Im Ausverkauf gibt es 15 % Rabatt. Neuer Preis?', options: ['CHF 544', 'CHF 625', 'CHF 96', 'CHF 554'], correct: 0, explain: '640 · 0.85 = 544.' },
    { type: 'mc', topic: 'Geometrie', points: 2, q: 'Ein Rechteck ist 8 cm lang und hat den Umfang 26 cm. Wie breit ist es?', options: ['5 cm', '9 cm', '10 cm', '3.25 cm'], correct: 0, explain: '2·(8 + b) = 26 → b = 5.' },
    { type: 'mc', topic: 'Analysis', points: 3, q: 'Was ist die Ableitung von f(x) = 3x² + 2x?', options: ['6x + 2', '3x + 2', '6x²', 'x³ + x²'], correct: 0, explain: 'Potenzregel: (3x²)\' = 6x, (2x)\' = 2.' },
    { type: 'open', topic: 'Textaufgabe', points: 4, q: 'Ein Zug fährt um 8:00 mit 80 km/h ab. Um 8:30 folgt ein zweiter mit 120 km/h auf derselben Strecke. Wann holt er den ersten ein? Zeig den Lösungsweg.', model: 'Vorsprung nach 30 min: 40 km. Differenzgeschwindigkeit 40 km/h → 1 Stunde. Einholen um 9:30 Uhr, 120 km nach dem Start.' },
    { type: 'mc', topic: 'Gleichungen', points: 3, q: 'Welche Lösungen hat x² − 5x + 6 = 0?', options: ['x = 2 und x = 3', 'x = −2 und x = −3', 'x = 1 und x = 6', 'keine'], correct: 0, explain: '(x − 2)(x − 3) = 0.' },
  ],
  deutsch: [
    { type: 'mc', topic: 'Grammatik', points: 2, q: 'In welchem Fall steht «des Hauses»?', options: ['Genitiv', 'Dativ', 'Akkusativ', 'Nominativ'], correct: 0, explain: 'Wessen? → Genitiv.' },
    { type: 'mc', topic: 'Rechtschreibung', points: 2, q: 'Welche Schreibweise ist in der Schweiz korrekt?', options: ['Strasse', 'Straße', 'Strase', 'Straasse'], correct: 0, explain: 'In der Schweiz wird kein ß verwendet.' },
    { type: 'mc', topic: 'Stilmittel', points: 2, q: '«Der Himmel weint.» – welches Stilmittel?', options: ['Personifikation', 'Alliteration', 'Hyperbel', 'Oxymoron'], correct: 0, explain: 'Dem Himmel wird eine menschliche Eigenschaft zugeschrieben.' },
    { type: 'open', topic: 'Sprachbetrachtung', points: 3, q: 'Erkläre den Unterschied zwischen «das» und «dass» mit je einem Beispielsatz.', model: '«das» ist Artikel oder Relativ-/Demonstrativpronomen (ersetzbar durch dieses/welches): Das Buch, das ich lese. «dass» ist eine Konjunktion: Ich hoffe, dass es klappt.' },
    { type: 'mc', topic: 'Wortarten', points: 2, q: 'Welche Wortart ist «schnell» in «Sie rennt schnell»?', options: ['Adjektiv (adverbial gebraucht)', 'Verb', 'Nomen', 'Präposition'], correct: 0, explain: 'Adjektive können adverbial verwendet werden.' },
  ],
  englisch: [
    { type: 'mc', topic: 'Grammar', points: 2, q: 'She ___ to school every day.', options: ['goes', 'go', 'is go', 'going'], correct: 0, explain: 'Simple present, 3rd person singular: -s.' },
    { type: 'mc', topic: 'Tenses', points: 2, q: 'I ___ my homework when you called.', options: ['was doing', 'did', 'have done', 'am doing'], correct: 0, explain: 'Past progressive for an ongoing past action.' },
    { type: 'mc', topic: 'Vocabulary', points: 2, q: '«to procrastinate» means…', options: ['aufschieben', 'vorbereiten', 'übertreiben', 'verbessern'], correct: 0, explain: 'to procrastinate = etwas hinauszögern.' },
    { type: 'open', topic: 'Writing', points: 3, q: 'Write two sentences about your weekend using the simple past.', model: 'Example: Last Saturday I visited my grandparents. On Sunday we went hiking in the mountains.' },
  ],
  franz: [
    { type: 'mc', topic: 'Grammaire', points: 2, q: 'Hier, je ___ au cinéma.', options: ['suis allé(e)', 'ai allé', 'vais', 'allais allé'], correct: 0, explain: '«aller» bildet das passé composé mit «être».' },
    { type: 'mc', topic: 'Vocabulaire', points: 2, q: '«le lendemain» bedeutet…', options: ['der nächste Tag', 'der Abend', 'die Woche', 'gestern'], correct: 0, explain: 'lendemain = der folgende Tag.' },
    { type: 'mc', topic: 'Grammaire', points: 2, q: 'Ils ___ beaucoup de devoirs.', options: ['ont', 'sont', 'a', 'est'], correct: 0, explain: 'avoir, 3. Person Plural: ils ont.' },
    { type: 'open', topic: 'Expression', points: 3, q: 'Écris deux phrases sur ta ville au présent.', model: 'Exemple: J\'habite à Lucerne. C\'est une ville avec un grand lac et beaucoup de touristes.' },
  ],
  general: [
    { type: 'mc', topic: 'Lernstrategie', points: 2, q: 'Welche Methode stärkt das Langzeitgedächtnis am meisten?', options: ['Aktives Abrufen (sich selbst testen)', 'Mehrmals durchlesen', 'Markieren', 'Alles am Vorabend lernen'], correct: 0, explain: 'Retrieval Practice ist nachweislich am wirksamsten.' },
    { type: 'mc', topic: 'Staatskunde', points: 2, q: 'Wie viele Kantone hat die Schweiz?', options: ['26', '23', '24', '28'], correct: 0, explain: '26 Kantone (davon 6 ehemalige Halbkantone).' },
    { type: 'mc', topic: 'Geschichte', points: 2, q: 'Wann wurde der Schweizer Bundesstaat gegründet?', options: ['1848', '1291', '1515', '1971'], correct: 0, explain: 'Erste Bundesverfassung 1848.' },
    { type: 'open', topic: 'Lernen', points: 3, q: 'Erkläre in 2–3 Sätzen, was «Spaced Repetition» ist und warum es funktioniert.', model: 'Wiederholen in wachsenden Abständen, kurz bevor man vergisst. Jeder erfolgreiche Abruf stärkt die Erinnerung (Vergessenskurve nach Ebbinghaus).' },
    { type: 'mc', topic: 'Staatskunde', points: 2, q: 'Wie viele Unterschriften braucht eine Volksinitiative?', options: ['100 000', '50 000', '10 000', '1 Million'], correct: 0, explain: '100 000 Unterschriften innert 18 Monaten.' },
  ],
};

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
  { id: 'grad', slot: 'hat', name: 'Maturhut', rar: 'common', price: 150 },
  { id: 'party', slot: 'hat', name: 'Partyhut', rar: 'common', price: 200 },
  { id: 'cap', slot: 'hat', name: 'Propeller-Cap', rar: 'common', price: 300 },
  { id: 'ninja', slot: 'hat', name: 'Ninja-Band', rar: 'rare', price: 450 },
  { id: 'swiss', slot: 'hat', name: 'Sennenhut', rar: 'rare', price: 500 },
  { id: 'headphones', slot: 'hat', name: 'Kopfhörer', rar: 'rare', price: 700 },
  { id: 'wizard', slot: 'hat', name: 'Zauberhut', rar: 'epic', price: 1100 },
  { id: 'halo', slot: 'hat', name: 'Heiligenschein', rar: 'epic', price: 1800 },
  { id: 'crown', slot: 'hat', name: 'Krone', rar: 'legend', price: 2500 },
  { id: 'laurel', slot: 'hat', name: 'Gold-Lorbeer', rar: 'legend', price: 0, pro: true, month: 'Oktober' }, // Pro-Item des Monats
  { id: 'nerd', slot: 'eyes', name: 'Streberbrille', rar: 'common', price: 200 },
  { id: 'shades', slot: 'eyes', name: 'Sonnenbrille', rar: 'rare', price: 400 },
  { id: 'hearts', slot: 'eyes', name: 'Herzbrille', rar: 'rare', price: 600 },
  { id: 'monocle', slot: 'eyes', name: 'Monokel', rar: 'epic', price: 900 },
  { id: 'mustache', slot: 'mouth', name: 'Schnauz', rar: 'common', price: 350 },
  { id: 'gum', slot: 'mouth', name: 'Kaugummi', rar: 'rare', price: 400 },
  { id: 'goldgrill', slot: 'mouth', name: 'Gold-Grillz', rar: 'epic', price: 1200 },
  { id: 'diamondgrill', slot: 'mouth', name: 'Diamant-Grillz', rar: 'legend', price: 3000 },
  { id: 'bowtie', slot: 'extra', name: 'Fliege', rar: 'common', price: 250 },
  { id: 'chain', slot: 'extra', name: 'Goldkette', rar: 'epic', price: 1500 },
  { id: 'astro', slot: 'extra', name: 'Astro-Helm', rar: 'epic', price: 1600 },
];
// Verbrauchsartikel (mehrfach kaufbar)
export const SHOP_CONSUMABLES = [{ id: 'freeze', name: 'Streak-Schutz', emoji: '🧊', price: 250 }];
// Abo
export const PRO = { monthly: 4.9, yearly: 39, trialDays: 7, freeLimits: { brainyPerDay: 15, examsPerWeek: 1, ownGroups: 1, groupSize: 6 }, proLimits: { brainyPerDay: 150, examsPerDay: 5 }, freezesPerMonth: 2 };
// Komplett-Avatare: Skin + Accessoires im Paket (günstiger als einzeln)
export const SHOP_BUNDLES = [
  { id: 'set-king', name: 'König', set: { skin: 'gold', hat: 'crown', mouth: 'diamondgrill', extra: 'chain' }, rar: 'legend', price: 7000 },
  { id: 'set-space', name: 'Astronaut', set: { skin: 'galaxy', extra: 'astro', mood: 'wow' }, rar: 'legend', price: 4000 },
  { id: 'set-rapper', name: 'Rapper', set: { skin: 'lava', hat: 'cap', eyes: 'shades', mouth: 'goldgrill', extra: 'chain' }, rar: 'epic', price: 4200 },
  { id: 'set-prof', name: 'Professor', set: { skin: 'lavender', hat: 'grad', eyes: 'monocle', mouth: 'mustache', extra: 'bowtie' }, rar: 'epic', price: 1500 },
  { id: 'set-zombie', name: 'Zombie-Ninja', set: { skin: 'zombie', hat: 'ninja', mood: 'grin' }, rar: 'rare', price: 900 },
];
export const SHOP_FRAMES = [
  { id: 'f-mint', name: 'Minze', rar: 'common', price: 100 },
  { id: 'f-sunset', name: 'Sonnenuntergang', rar: 'common', price: 150 },
  { id: 'f-gold', name: 'Gold', rar: 'rare', price: 400 },
  { id: 'f-swiss', name: 'Schweiz', rar: 'rare', price: 450 },
  { id: 'f-neon', name: 'Neon', rar: 'epic', price: 900 },
  { id: 'f-rainbow', name: 'Regenbogen', rar: 'epic', price: 1200 },
  { id: 'f-fire', name: 'Feuer', rar: 'legend', price: 2000 },
  { id: 'f-galaxy', name: 'Galaxie', rar: 'legend', price: 2500 },
];
