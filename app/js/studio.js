// Brainy Exam Studio 2.
// Ablauf: Hochladen → Scan (Handschrift weg) → bereinigt → Modus (Original / Mischen / Neue Zahlen) → bereit (PDF oder online) → Prüfung → Ergebnis.
// KI immer über claude() → Server-Proxy «brainy» (Server wählt Claude oder Groq). Bilder bleiben auf dem Gerät (IndexedDB).
import { S, save, uid } from './store.js';
import * as St from './store.js';
import { claude, hasKey, parseJSON } from './ai.js';
import { U } from './view-state.js';
import { imgPut, imgGet, imgDel, imgWarm } from './idb.js';
import * as BK from './backend.js';
import { gradeFor, scaleRows, SCALES } from './grades.js';
export { gradeFor, scaleRows, SCALES };
import { scanPhoto, removeHandwritingUrl, handNet, detectDocumentQuad, warpPerspective, flattenIllumination, homography, applyH, eraseHandwriting, warmHandNet, segmentHandwriting, keepSmallNearPrint } from './scan-enhance.js';

// Bausteine (taskKind). auto = automatisch bewertbar (Rest KI). Alte Namen werden über ALIAS abgebildet.
export const KIND = {
  single_choice: { em: '◉', name: 'Eine Antwort', auto: true },
  multi_select: { em: '☑', name: 'Mehrfachauswahl', auto: true },
  true_false: { em: '✓', name: 'Richtig / Falsch', auto: true },
  fill_blanks: { em: '▁', name: 'Lückentext', auto: true },
  matching: { em: '⇄', name: 'Zuordnen', auto: true },
  ordering: { em: '↕', name: 'Reihenfolge', auto: true },
  categorize: { em: '▦', name: 'Gruppieren', auto: true },
  table_fill: { em: '▤', name: 'Tabelle', auto: true },
  label_image: { em: '⌖', name: 'Beschriften', auto: true },
  graph_plot: { em: '⌗', name: 'Koordinatensystem', auto: true },
  numeric: { em: '#', name: 'Zahl mit Einheit', auto: true },
  math_calculation: { em: '📐', name: 'Rechnen' },
  short_answer: { em: '✎', name: 'Kurze Antwort' },
  essay_open_text: { em: '✍️', name: 'Freitext' },
  formula: { em: 'ƒ', name: 'Formel' },
  sketch: { em: '✏', name: 'Skizze' },
  text_select: { em: '▔', name: 'Im Text markieren', auto: true },
  image_hotspot: { em: '◎', name: 'Stelle antippen', auto: true },
  code: { em: '⌨', name: 'Programmcode' },
  number_line: { em: '↔', name: 'Zahlenstrahl', auto: true },
  // alte Prüfungen (vor Exam Studio 2)
  multiple_choice: { em: '◉', name: 'Eine Antwort', alias: 'single_choice' },
  diagram_analysis: { em: '📊', name: 'Grafik', alias: 'short_answer' },
};
export const KINDS = Object.keys(KIND).filter(k => !KIND[k].alias);
const ALIAS = { multiple_choice: 'single_choice', diagram_analysis: 'short_answer', mc: 'single_choice', single: 'single_choice', multiple_select: 'multi_select', multi_choice: 'multi_select',
  truefalse: 'true_false', true_or_false: 'true_false', cloze: 'fill_blanks', gap_fill: 'fill_blanks', match: 'matching', order: 'ordering', sequence: 'ordering', number: 'numeric',
  calculation: 'math_calculation', essay: 'essay_open_text', open_text: 'essay_open_text', text: 'short_answer', drawing: 'sketch', chemistry: 'formula', table: 'table_fill', label: 'label_image', plot: 'graph_plot', graph: 'graph_plot', classify: 'categorize', groups: 'categorize',
  hottext: 'text_select', mark: 'text_select', markieren: 'text_select', select_text: 'text_select', highlight: 'text_select', error_text: 'text_select',
  hotspot: 'image_hotspot', imagemap: 'image_hotspot', image_click: 'image_hotspot', click_image: 'image_hotspot', map_click: 'image_hotspot',
  programming: 'code', programmieren: 'code', sql: 'code', pseudocode: 'code', coding: 'code', program: 'code',
  numberline: 'number_line', zahlenstrahl: 'number_line', zeitstrahl: 'number_line', timeline: 'number_line' };
export const kindOf = k => { const s = String(k || '').trim().toLowerCase(); return KIND[s] && !KIND[s].alias ? s : ALIAS[s] || null; };
export const MAX_PAGES = 20;
export const PAGE_BATCH = 2;            // Seiten pro paralleler KI-Welle
export const REMIX_BATCH = 4;           // Aufgaben pro «Neu würfeln»-Aufruf
export const SOLVE_BATCH = 5;           // Aufgaben pro Lösen+Remix-Aufruf (Rechen-Modell)
export const CROP_PAD = 35;             // Promille Sicherheitsrand pro Seite
export const CROP_BORDER = 16;          // px weisser Innenrand
export const HINT_PENALTY = [0, 0.25, 0.5, 0.75, 1];   // Anteil der Aufgabenpunkte pro Hinweis-Stufe (4 = Lösung)

export function studioData() {
  if (!S.studio) S.studio = { docs: [], attempts: [] };
  return S.studio;
}
export const docById = id => studioData().docs.find(d => d.id === id);
export const attemptsOf = docId => studioData().attempts.filter(a => a.docId === docId).sort((x, y) => x.ts - y.ts);
export const lastAttempt = docId => attemptsOf(docId).at(-1) || null;
// Kompatibilität (keine Akku-/Kalender-Funktionen mehr im UI)
export const upcoming = () => [];
export const batteryOf = () => 0;
export const weakIds = () => [];
export const hasCalc = doc => (doc?.tools || []).some(t => /rechner|calculat|calcolat/i.test(t));

export function studioInit() {
  const c = S.prefs?.gradeCountry;
  return {
    tool: 'exam', phase: 'home', title: '', files: [], pdf: null,
    docId: null, mode: 'original', variant: 'original', shuffle: false, order: [], qi: 0,
    ans: {}, photos: {}, hints: {}, results: null, scan: null, busy: null, err: null,
    run: null, touched: {}, timer: null, timerMenu: false, country: ['CH', 'DE', 'AT'].includes(c) ? c : 'CH', sideOpen: false, confirm: null, confirmQ: null,
    paperSol: false, crop: null, orig: null, calcOpen: false, calc: '', calcOut: '', matClosed: {},
  };
}

/* =========================================================================================
   1) KI-PROMPTS
   ========================================================================================= */
const RUBRIC_RULES = `"rubric": Teilpunkte-Schlüssel als Liste wie ["1 P: Formel/Ansatz", "1.5 P: Umformung/Begründung", "0.5 P: Resultat mit Einheit"]. Jeder Eintrag beginnt mit der Punktzahl, die SUMME ergibt EXAKT maxPoints. Halbe Punkte erlaubt.`;
const HINT_RULES = `"hints": GENAU 3 Lernhinweise, immer genauer: 1 = Denkanstoss (worauf achten, welches Konzept), 2 = Weg/Formel/Regel konkret, 3 = fast die Lösung (Zwischenschritt, eingesetzte Werte, ausgeschlossene Optionen) – aber NIE das Endergebnis.`;
const KIND_LIST = `Bausteine ("taskKind") – wähle pro Aufgabe den passenden:
- "single_choice": genau eine richtige Option → "options"
- "multi_select": mehrere richtige Optionen («Kreuze alle richtigen an») → "options"
- "true_false": Aussagen richtig/falsch → "statements": [{"text":""}]; ist «nicht im Text» / «not given» als dritte Möglichkeit gedruckt → "notGiven": true
- "fill_blanks": Lückentext → "text" mit ___ (drei Unterstriche) an jeder Lücke; Auswahl je Lücke gedruckt (z. B. «(has / have)») → "blankOptions": [["has","have"], …] in Lückenreihenfolge; Wortliste gedruckt → "wordBank": []
- "matching": Zuordnen (Begriff ↔ Definition, Jahr ↔ Ereignis) → "left": [], "right": [] (rechte Spalte wie gedruckt)
- "ordering": in die richtige Reihenfolge bringen → "items": [] (wie gedruckt)
- "categorize": Begriffe Gruppen zuordnen (Aktiven/Passiven, Säugetier/Reptil) → "groups": [], "items": []
- "table_fill": Tabelle ausfüllen (Wertetabelle, Buchungssatz Soll/Haben, T-Konto, Messreihe) → "columns": [Kopfzeile], "rows": [[Zellen]] mit null für JEDE zu füllende Zelle
- "label_image": Abbildung beschriften → "markers": [{"x":0,"y":0}] (0–1000 relativ zum Rahmen "graphic"), optional "wordBank": []
- "graph_plot": Punkte/Gerade/Funktion ins Koordinatensystem zeichnen → "axes": {"xmin":-5,"xmax":5,"ymin":-5,"ymax":5,"step":1}
- "numeric": eine Zahl als Resultat (mit Einheit) ohne verlangten Rechenweg → "unit"
- "math_calculation": Rechnung mit Rechenweg und Resultat → "unit" (falls nötig)
- "short_answer": kurze Antwort (Wort, Name, Satz)
- "essay_open_text": Freitext, Begründung, Erörterung, Aufsatz, Übersetzung
- "formula": Formel, Term oder chemische Reaktionsgleichung als Antwort
- "sketch": zeichnen, skizzieren, konstruieren, Schaltplan, Diagramm erstellen
Wertung ("scoring", nur bei single_choice/multi_select/true_false und nur wenn gedruckt): "all_or_nothing" (nur ganz richtig zählt), "minus" (falsche Kreuze geben Abzug, nie unter 0), "kprim" (4 Aussagen: 4 richtig = volle, 3 richtig = halbe Punkte); sonst weglassen.
- "text_select": im Text markieren/unterstreichen (Fehler finden, Wortarten/Satzglieder bestimmen, Stilmittel, Kommas: Wort markieren, NACH dem ein Komma fehlt) → "selectText": der Text wörtlich (ohne Markierungen)
- "image_hotspot": Stelle auf Bild/Karte antippen («Markiere auf der Karte …», «Zeige im Bild …») → "graphic" PFLICHT + "regions": [{"x":0,"y":0,"r":50,"label":"was dort zu sehen ist"}] = ALLE in Frage kommenden Stellen (Orte, Organe, Bauteile; x/y 0–1000 relativ zum Rahmen "graphic", r = Radius) – OHNE zu verraten, welche richtig ist
- "code": Programmcode, SQL oder Pseudocode schreiben bzw. Lücken in Code füllen → "language" ("python", "sql", "java", "javascript", "pseudo" …), optional "starter" (vorgegebener Code wörtlich, Lücken als ___)
- "number_line": Werte auf einem Zahlen- oder Zeitstrahl einzeichnen → "min", "max", "step" (feinster Abstand, auf den man setzen kann, z. B. 0.5 oder 1 Jahr)`;

const PAGE_EXTRACT_PROMPT = `Du bist eine präzise Prüfungs-Engine für Schweizer Prüfungen (Sek, Gymnasium, BMS, Berufsschule/KV, FH, Uni) in ALLEN Fächern (Mathe, Physik, Chemie, Biologie, Geografie, Geschichte, Sprachen, BWL/Rechnungswesen, Recht, Informatik …).
Du erhältst EINE Prüfungsseite (Foto, Scan oder Screenshot) – oft mit Handschrift, Kreuzen, Korrekturen und Noten.
1. Extrahiere NUR die original gedruckten Aufgaben. Ignoriere jede Handschrift, Kreuze, Punkte-Notizen, Korrekturen und bei Online-Übungen bereits eingetragene Antworten.
2. "handwriting": Liste ENGER Rahmen (0–1000) um JEDE handschriftliche Stelle auf der Seite (Antworten, Notizen, Rechnungen, Kreuze, Häkchen, Pfeile, Korrekturen, Noten, Leuchtstift) – nie um gedruckten Text; keine Handschrift → [].
   "answerFields": Liste ENGER Rahmen (0–1000) um bereits eingetragene/getippte Schülerantworten (z. B. Eingabefelder mit Antwort, ausgefüllte Lücken, angekreuzte Online-Optionen) – nie um Aufgabentext; sonst [].
Erkenne das Fach ("subject"), einen kurzen Titel ("title"), die erlaubten/benötigten Hilfsmittel ("tools", z. B. ["Taschenrechner", "Formelsammlung", "Geodreieck"]; nur was gedruckt steht oder klar nötig ist) und die gedruckte Prüfungszeit in Minuten ("timeLimitMin", z. B. «Zeit: 45 min» → 45; keine Angabe → null).
BAUSTEIN-WAHL: "formula" NUR für chemische Formeln/Reaktionsgleichungen und physikalische Formeln mit Indizes. Algebraische Ausdrücke oder Terme als Antwort (z. B. «Breite = ___», «x = ___») → "short_answer" (bzw. "numeric" bei reiner Zahl). Schreibe Indizes als F_A, Exponenten als x^2.
GEMEINSAMES MATERIAL: Lesetexte, Text-/Bildquellen, Fallsituationen, Karten, Diagramme, Tabellen oder M1–Mn, auf die sich MEHRERE Aufgaben beziehen (oder die lang sind), NIE in jede Aufgabe kopieren, sondern EINMAL unter "materials" anlegen: {"label":"M1","type":"Lesetext|Quelle|Fallsituation|Abbildung|Tabelle","title":"","text":"wörtlich mit Zeilenumbrüchen \\n","graphic":null} ("graphic" = Rahmen 0–1000 wie unten, nur bei Bild/Karte/Diagramm). Jede zugehörige Aufgabe nennt das Material in "material":"M1". Steht das Material schon auf einer früheren Seite, nur "label" angeben (ohne Text). Kein Material → [].
PRÜFUNGSTEILE: Steht z. B. «Teil A ohne Hilfsmittel, 20 min» / «Teil B mit Taschenrechner, 40 min», liste die Teile unter "parts": [{"title":"Teil A – ohne Hilfsmittel","timeLimitMin":20,"tools":[]}] ("tools" = Hilfsmittel NUR in diesem Teil, [] = keine, unbekannt → null) und gib bei jeder Aufgabe "part":"Teil A" an. Keine Teile → [].
3. Für JEDE Aufgabe (Teilaufgaben a, b … als eigene Einträge):
- "questionNumber": wie gedruckt ("1", "2a").
- "taskKind": siehe Bausteine unten. Besteht eine Aufgabe aus verschiedenen Teilen (z. B. Abbildung beschriften UND begründen), teile sie in Teilaufgaben mit eigenem Baustein auf ("3a" label_image, "3b" essay_open_text) und verteile die Punkte.
- "maxPoints": gedruckte Punktzahl, sonst realistisch 1–6.
- "text": Aufgabentext wörtlich, Formeln als gut lesbarer Klartext (x^2, sqrt(5), (3x)/(4y), H2O, CO2 → im Text mit Unicode H₂O erlaubt).
- "figureData": stehen Masse, Zahlen, Beschriftungen oder Werte in einer zugehörigen Abbildung/Tabelle, beschreibe sie vollständig in Worten; sonst "".
- die Baustein-Felder (siehe unten) – OHNE Lösungen und ohne Schüler-Kreuze.
${KIND_LIST}
WICHTIG: Du LÖST die Aufgaben NICHT – nur exakt auslesen und die Struktur liefern. Das Lösen übernimmt ein separates Rechen-Modell.
- "graphic": Gehört eine gedruckte Abbildung, Skizze, Tabelle oder ein Graph zu GENAU dieser Aufgabe, gib den Rahmen in Koordinaten 0–1000 (y relativ zur Bildhöhe, x zur Bildbreite) GROSSZÜGIG um die GESAMTE Abbildung inklusive aller Achsenbeschriftungen, Ecken-Buchstaben (A, B, C), Zahlen und Legenden an. Lieber mehr weissen Rand als etwas abschneiden: {"ymin":0,"xmin":0,"ymax":0,"xmax":0,"label":"kurze Beschreibung"} – sonst null.
- "questionBox": Rahmen (0–1000) um die GANZE gedruckte Aufgabe (Nummer, Text, Abbildung, Optionen, Antwortlinien) – damit man das Original ansehen kann: {"ymin":0,"xmin":0,"ymax":0,"xmax":0}.
Sprache: Schweizer Hochdeutsch (ss statt ß); Sprachfächer in ihrer Sprache.
Antworte AUSSCHLIESSLICH mit validem JSON:
{"subject":"","title":"","tools":[],"timeLimitMin":null,"materials":[],"parts":[],"handwriting":[{"ymin":0,"xmin":0,"ymax":0,"xmax":0}],"answerFields":[],"questions":[{"questionNumber":"","taskKind":"","material":"","part":"","maxPoints":2,"text":"","figureData":"","options":[],"statements":[],"left":[],"right":[],"items":[],"groups":[],"columns":[],"rows":[],"markers":[],"wordBank":[],"axes":null,"unit":"","graphic":null,"questionBox":null}]}
(Nicht benötigte Felder darfst du weglassen.)`;

const MAT_RULE = `Gehört eine Aufgabe zu einem Material ("material", Texte unter «Materialien»), nutze es zum Lösen. Im Remix bleibt das Material UNVERÄNDERT: stelle eine neue, gleich schwere Frage zum SELBEN Material (nichts verlangen, was nicht im Material steht).`;
const KEY_RULES = `Lösungsfelder je Baustein:
- single_choice: "correctOption" (0-basierter Index)
- multi_select: "correctOptions" (Liste der 0-basierten Indizes)
- true_false: "statements": [{"text":"","correct":true|false}] – bei "notGiven" auch "correct":"nicht im Text"
- fill_blanks: "blanks": Lösung je ___ in Reihenfolge; gleichwertige Alternativen mit | trennen ("Zellkern|Nukleus")
- matching: "pairs": für jedes linke Element der 0-basierte Index des passenden rechten
- ordering: "items" in der RICHTIGEN Reihenfolge (exakt dieselben Texte)
- categorize: "itemGroup": für jedes Item der 0-basierte Gruppen-Index
- table_fill: "solution": gleiche Form wie "rows", Lösung in jeder null-Zelle (sonst null); Alternativen mit |
- label_image: "labels": Beschriftung je Marker (Alternativen mit |)
- graph_plot: "points": [[x,y], …] auf dem Raster; bei einer Geraden zusätzlich "line": {"m":0,"q":0} (y = m·x + q)
- numeric: "correctAnswer" = nur die Zahl (Punkt als Dezimaltrennzeichen), "unit", optional "tolerance" (relativ, Standard 0.01)
- math_calculation, short_answer, formula: "correctAnswer" (Endergebnis mit Einheit bzw. Formel; chemische Gleichungen ausgeglichen mit →, Indizes als H₂O)
- essay_open_text, sketch: "correctAnswer" = Erwartungshorizont in 1–2 Sätzen
- text_select: "correct" = 0-basierte Indizes der zu markierenden Tokens (siehe "tokensNummeriert") ODER "markedText" = derselbe Text mit [[…]] um jedes zu markierende Token; im Remix ein neuer "selectText" mit [[…]] um jedes zu markierende Token
- image_hotspot: "correctRegions" = Indizes der richtigen Stellen aus "regions"; im Remix dieselben Regionen, nur neue Frage und neue "correctRegions"
- code: "correctAnswer" = vollständige, lauffähige Musterlösung (Code mit Zeilenumbrüchen); "rubric" nach Teilschritten (z. B. «1 P: SELECT mit richtigen Spalten», «1 P: WHERE-Bedingung», «1 P: Sortierung»)
- number_line: "points" = Liste der einzuzeichnenden Werte (Zahlen, Punkt als Dezimaltrennzeichen, innerhalb min–max, auf dem Raster "step")`;

// Lösen (Original) + Remix in einem Durchgang – immer das starke Text-/Rechen-Modell, reine Text-Übergabe ohne Bild
const SOLVE_AND_REMIX_PROMPT = `Du bist eine hochpräzise Lösungs- und Remix-Engine für Schweizer Prüfungen in allen Fächern (Mathe, Physik, Chemie mit Formeln und Reaktionsgleichungen, Biologie, Geografie, Geschichte, Sprachen, BWL/Rechnungswesen, Recht …). Du bekommst ausgelesene Original-Aufgaben mit ihrem Baustein ("typ") und dessen Struktur.
Für JEDE Aufgabe lieferst du:
1) "original": die Musterlösung der ORIGINALAUFGABE (Struktur NICHT verändern):
   - die Lösungsfelder des Bausteins (siehe unten)
   - "solution": kompakter, klarer Lösungsweg (2–6 Zeilen), letzte Zeile = Endergebnis. Rechne sorgfältig und mache die Probe.
   - "correctAnswer": nur das Endergebnis (mit Einheit) bzw. die Kernaussage.
   - ${HINT_RULES}
   - ${RUBRIC_RULES}
2) "remix": eine NEUE Zwillingsaufgabe mit DEMSELBEN Baustein und derselben Struktur-Art (gleich viele Optionen/Aussagen/Lücken/Paare/Elemente/Zellen), vollständig mit allen Struktur- UND Lösungsfeldern:
   - Mathe, Physik, Chemie, Rechnungswesen: BACKWARD-CONSTRUCTION – zuerst ein glattes Ergebnis wählen, daraus rückwärts die Angaben bestimmen, danach vorwärts nachrechnen und prüfen. Reaktionsgleichungen müssen ausgeglichen sein.
   - Abbildung mit festen Massen: im Text «Rechne neu mit … (statt der Masse in der Abbildung).» Bei label_image dieselbe Abbildung und dieselben Marker behalten.
   - BWL, VWL, Recht, KV, Biologie, NMG, Geografie: neuer, gleich schwerer Praxisfall mit demselben Konzept.
   - Aufsatz, Deutsch, Sprachen, Geschichte: neue Fragestellung auf derselben Stufe mit denselben Kriterien.
   - Auswahl-Bausteine: Frage umdrehen («richtig» ↔ «FALSCH») oder neue Aussagen; Optionen mischen; Lösungsindizes korrekt setzen. Bei matching die rechte Spalte mischen.
   - zusätzlich "change": was wurde verändert (1 Satz).
${MAT_RULE}
${KEY_RULES}
Gleiche Teilpunkte-Gewichtung wie das Original (Summe = maxPoints). Textfelder in lesbarem Klartext ohne LaTeX-Befehle, Schweizer Hochdeutsch (ss statt ß), Sprachfächer in ihrer Sprache.
Antworte NUR mit JSON: {"questions":[{"id":"","original":{"solution":"","correctAnswer":"","hints":["","",""],"rubric":[]},"remix":{"text":"","solution":"","correctAnswer":"","hints":["","",""],"rubric":[],"change":""}}]}`;

const REMIX_PROMPT = `Du erstellst für jede Aufgabe eine NEUE Zwillingsaufgabe mit EXAKT gleichem Konzept, gleichem Baustein ("typ"), gleicher Struktur-Art (gleich viele Optionen/Aussagen/Lücken/Paare/Elemente/Zellen), gleicher Schwierigkeit und gleicher Teilpunkte-Gewichtung – für alle Fächer.
FACHREGELN:
- Mathe, Physik, Chemie, Rechnungswesen: BACKWARD-CONSTRUCTION. Wähle ZUERST ein sauberes, glattes Ergebnis (wie im Original: ganze Zahl oder schöner Bruch) und rechne daraus RÜCKWÄRTS die neuen Angaben aus. Danach rechne die neue Aufgabe einmal VORWÄRTS durch und prüfe, dass genau dein Ergebnis herauskommt. Keine krummen Zufallszahlen. Reaktionsgleichungen ausgleichen.
- Gehört eine Abbildung mit festen Massen dazu, schreibe im Text ausdrücklich: «Rechne neu mit … (statt der Masse in der Abbildung).» Bei label_image dieselbe Abbildung und dieselben Marker behalten (nur Wortliste mischen bzw. Fragestellung leicht ändern).
- BWL, VWL, Recht, KV, Biologie, NMG, Geografie: neuer, gleich schwerer Praxisfall / neues Szenario mit demselben Prüfungskonzept.
- Aufsatz, Deutsch, Sprachen, Geschichte: neue Fragestellung bzw. neues Thema auf derselben Stufe mit denselben Bewertungskriterien.
- Auswahl-Bausteine: drehe die Frage um («Was ist richtig?» ↔ «Was ist FALSCH?») oder formuliere neue Aussagen zum selben Kernthema; mische die Optionen und setze die Lösungsindizes korrekt.
- Variationsschlüssel beachten: jedes Mal andere Zahlen/Fälle als in «bisher».
${MAT_RULE}
Pro Aufgabe: {"id":"","text":"", …Struktur-Felder des Bausteins…, …Lösungsfelder…, "solution":"kompakter Lösungsweg, letzte Zeile Endergebnis","correctAnswer":"","hints":["","",""],"rubric":[],"change":"was wurde verändert (1 Satz)"}
Struktur-Felder: options · statements · text mit ___ · left/right · items · groups/items · columns/rows (null = zu füllen) · markers/wordBank · axes · unit.
${KEY_RULES}
${HINT_RULES}
${RUBRIC_RULES}
Textfelder in lesbarem Klartext ohne LaTeX-Befehle. Schweizer Hochdeutsch (ss statt ß).
Antworte NUR mit JSON: {"questions":[…]}`;

const GRADE_PROMPT = `Du bewertest eine Schülerprüfung fair nach Teilpunkten wie eine Schweizer Lehrperson.
Nutze den Teilpunkte-Schlüssel ("rubric"): vergib pro Kriterium die Punkte, wenn es erfüllt ist. Halbe Punkte (0.5) erlaubt.
Richtiger Rechenweg mit kleinem Folgefehler gibt Teilpunkte. Teilweise richtige Freitext-/BWL-/Aufsatz-Antworten erhalten anteilige Punkte. Gleichwertige Formulierungen, Synonyme und kleine Tippfehler gelten als richtig. Leere Antwort = 0.
Programmcode ("typ":"code"): andere korrekte Lösungswege geben volle Punkte; kleine Syntaxfehler, die die Logik nicht ändern, höchstens kleiner Abzug.
Skizzen/Zeichnungen (Bild «Schülerlösung») bewertest du nach dem Erwartungshorizont: Sind alle verlangten Elemente vorhanden und richtig angeordnet/beschriftet?
"auto" nennt Punkte, die automatisch schon sicher erkannt wurden – gib nie weniger.
Pro Aufgabe: "id", "points" (0 bis maxPoints), "feedback" (GENAU 1 klarer Satz: warum diese Punkte).
Antworte NUR mit JSON: {"results":[{"id":"","points":0,"feedback":""}]}`;

/* =========================================================================================
   2) BILD-VERARBEITUNG & AUTO-CROP (grosszügig, schneidet nichts ab)
   ========================================================================================= */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild konnte nicht geladen werden')); i.src = src; });
const readAsDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

export async function normalizeImage(dataUrl, maxSide = 1600) {
  const img = await loadImg(dataUrl);
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height };
}

// Stiftfarben (blau, rot) entfernen, gedruckte Farben behalten, Papier weiss, Druck kräftig
export function cleanPixels(ctx, w, h, { removeInk = true } = {}) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  let sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { const v = Math.max(d[i], d[i + 1], d[i + 2]); if (v > 120) { sum += v; n++; } }
  const paper = n ? Math.max(175, sum / n) : 235, gain = 255 / paper;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (sat > 0.24 && mx > 45) {
      const dl = mx - mn || 1; let hue = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hue = (hue * 60 + 360) % 360;
      const pen = (hue >= 195 && hue <= 260 && sat > 0.3) || ((hue >= 340 || hue <= 12) && sat > 0.32);
      if (removeInk && pen) { d[i] = d[i + 1] = d[i + 2] = 255; continue; }
      d[i] = Math.min(255, r * gain); d[i + 1] = Math.min(255, g * gain); d[i + 2] = Math.min(255, b * gain); continue;
    }
    let v = (r * 0.3 + g * 0.59 + b * 0.11) * gain;
    v = v > 210 ? 255 : v < 105 ? v * 0.5 : (v - 105) * (255 / 105);
    v = Math.max(0, Math.min(255, v)); d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
}
export async function cleanPage(dataUrl, opts) {
  const img = await loadImg(dataUrl);
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); cleanPixels(x, c.width, c.height, opts);
  return c.toDataURL('image/jpeg', 0.88);
}
export function normBox(b) {
  const n = v => Math.max(0, Math.min(1000, Number(v) || 0));
  let ymin = n(b.ymin), xmin = n(b.xmin), ymax = n(b.ymax), xmax = n(b.xmax);
  if (ymax <= 1 && xmax <= 1) { ymin *= 1000; xmin *= 1000; ymax *= 1000; xmax *= 1000; }   // 0–1 statt 0–1000
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin];
  if (xmax < xmin) [xmin, xmax] = [xmax, xmin];
  if (ymax - ymin < 30) ymax = Math.min(1000, ymin + 30); if (ymax - ymin < 30) ymin = Math.max(0, ymax - 30);
  if (xmax - xmin < 30) xmax = Math.min(1000, xmin + 30); if (xmax - xmin < 30) xmin = Math.max(0, xmax - 30);
  return { ...b, ymin, xmin, ymax, xmax };
}
export async function cropDiagramFromSource(pageUrl, box, { removeInk = true, pad = CROP_PAD } = {}) {
  const img = await loadImg(pageUrl), W = img.naturalWidth, H = img.naturalHeight, b = normBox(box);
  const px = pad / 1000 * W, py = pad / 1000 * H;
  const x0 = Math.max(0, Math.floor(b.xmin / 1000 * W - px)), y0 = Math.max(0, Math.floor(b.ymin / 1000 * H - py));
  const x1 = Math.min(W, Math.ceil(b.xmax / 1000 * W + px)), y1 = Math.min(H, Math.ceil(b.ymax / 1000 * H + py));
  const cw = Math.max(24, x1 - x0), ch = Math.max(24, y1 - y0), scale = Math.min(2, 1600 / Math.max(cw, ch));
  const c = document.createElement('canvas'); c.width = Math.round(cw * scale) + CROP_BORDER * 2; c.height = Math.round(ch * scale) + CROP_BORDER * 2;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, x0, y0, cw, ch, CROP_BORDER, CROP_BORDER, c.width - CROP_BORDER * 2, c.height - CROP_BORDER * 2);
  cleanPixels(x, c.width, c.height, { removeInk });
  return c.toDataURL('image/jpeg', 0.92);
}
const b64 = url => url.split(',')[1];
export const aiStatus = { wait: 0, onWait: null };
async function ai(params, tries = 4) {
  for (let k = 0; ; k++) {
    try { aiStatus.wait = 0; return await claude(params); }
    catch (e) {
      const busy = /überlastet|429|rate/i.test(e.message || ''), net = /Failed to send|fetch|network|timeout|502|503|504/i.test(e.message || '');
      if (k >= tries - 1 || !(busy || net)) throw e;
      const sec = busy ? 10 + k * 10 : 3 + k * 3;
      aiStatus.wait = Date.now() + sec * 1000; aiStatus.onWait?.();
      await new Promise(r => setTimeout(r, sec * 1000));
    }
  }
}
const forAI = async url => b64((await normalizeImage(url, 1400)).url);
const clampPts = v => Math.max(0.5, Math.min(20, Math.round((Number(v) || 2) * 2) / 2));
const str = v => String(v ?? '').trim().replace(/ß/g, 'ss');   // Schweizer Rechtschreibung erzwingen
const strs = (a, n) => (Array.isArray(a) ? a : []).map(x => str(x && typeof x === 'object' ? x.text ?? x.label ?? x.value ?? '' : x)).filter(Boolean).slice(0, n || 20);   // auch {text:…}
export const batches = (arr, n) => arr.reduce((o, x, i) => (i % n ? o[o.length - 1].push(x) : o.push([x]), o), []);

/* =========================================================================================
   3a) BAUSTEINE: Normalisierung & Validierung der KI-Daten (kaputte Daten → Rückfall, nie Absturz)
   ========================================================================================= */
const obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const arr = x => Array.isArray(x) ? x : [];
const num = x => { if (x === null || x === undefined || x === '' || typeof x === 'boolean') return NaN; const n = Number(String(x).replace(',', '.').replace(/[−–]/g, '-')); return Number.isFinite(n) ? n : NaN; };
const idx = (x, n) => { if (x === null || x === undefined || x === '' || typeof x === 'boolean') return -1; const t = String(x).trim(), i = /^[A-Za-z]$/.test(t) ? t.toUpperCase().charCodeAt(0) - 65 : Number(t); return Number.isInteger(i) && i >= 0 && i < n ? i : -1; };
const asBool = x => { if (typeof x === 'boolean') return x; const t = String(x ?? '').trim().toLowerCase(); return /^(true|wahr|richtig|r|w|1|ja|yes|vrai|vero|correct)$/.test(t) ? true : /^(false|falsch|f|0|nein|no|faux|falso|wrong)$/.test(t) ? false : null; };
// Richtig/Falsch/«nicht im Text» ('ng')
export const tfVal = x => { const b = asBool(x); if (b !== null) return b; return /^(ng|nicht im text|nicht gegeben|steht nicht im text|not given|ni|non indique|non indicato|\?)$/.test(fold(x)) ? 'ng' : null; };
// Wertungsarten für Auswahl-Bausteine
export const SCORINGS = ['partial', 'all_or_nothing', 'minus', 'kprim'];
export const normScoring = x => { const f = fold(x).replace(/[\s_-]+/g, ''); return /^(all|allornothing|allesodernichts|nurganz|ganz)$/.test(f) ? 'all_or_nothing' : /^(minus|abzug|negative?|minuspunkte|penalty)$/.test(f) ? 'minus' : /^(kprim|k′|k')$/.test(f) ? 'kprim' : 'partial'; };
const alt = x => Array.isArray(x) ? x.map(str).filter(Boolean).join('|') : str(x);
const isGap = x => x === null || x === undefined || /^\s*(\?+|_+|…|\.{2,})?\s*$/.test(String(x));
const c1000 = v => Math.max(0, Math.min(1000, Math.round(v)));
const copyV = v => JSON.parse(JSON.stringify(v));
export const blankCount = t => (String(t || '').match(/___/g) || []).length;
// Vergleichs-Normalform: Gross/Klein, Umlaute, Anführungszeichen, Leerzeichen, Satzzeichen am Rand egal
export const fold = x => String(x ?? '').normalize('NFKC').toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/[’‘`´]/g, "'").replace(/[“”«»"]/g, '').replace(/\s+/g, ' ').replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, '');
// Zahl aus Text: 1'000.5 · 1 000,5 · −3 · 3/4 · «c = 10 cm» → { n, rest: Einheit }
export function parseNum(x) {
  let t = String(x ?? '').normalize('NFKC').replace(/[−–]/g, '-').trim();
  t = t.replace(/(\d)['’ ](?=\d{3}\b)/g, '$1');
  t = /\d,\d/.test(t) && !/\d\.\d/.test(t) ? t.replace(/(\d),(\d)/g, '$1.$2') : t.replace(/(\d),(?=\d{3}\b)/g, '$1');
  const m = t.match(/([-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/i);
  if (!m) return { n: NaN, rest: t, pre: t };
  let n = parseFloat(m[1]); if (m[2]) n /= parseFloat(m[2]);
  return { n: Number.isFinite(n) ? n : NaN, rest: t.slice(m.index + m[0].length).trim().replace(/^[=:]\s*/, ''), pre: t.slice(0, m.index).trim() };
}
const UNIT_SYN = [['stueck', 'stk', 'st', 'pieces', 'pcs', 'stueckzahl'], ['chf', 'fr', 'franken', 'sfr', 'fr.'], ['%', 'prozent', 'percent'], ['h', 'std', 'stunden', 'stunde'], ['min', 'minuten', 'minute'],
  ['s', 'sek', 'sekunden', 'sekunde'], ['l', 'liter'], ['kg', 'kilogramm'], ['g', 'gramm'], ['°', 'grad', 'deg'], ['°c', 'gradcelsius']];
const unitKey = u => { const f = fold(u).replace(/[\s^*]/g, ''); const g = UNIT_SYN.find(s => s.includes(f)); return g ? g[0] : f; };
export const unitEq = (a, b) => unitKey(a) === unitKey(b);
const isUnit = u => UNIT_SYN.some(g => g.includes(unitKey(u))) || /^(k|c|m|µ|n|d)?(m|g|l|s|n|j|w|v|a|pa|mol|hz)[23]?$|^(m\/s|km\/h|°c|kwh)$/i.test(fold(u).replace(/\s/g, ''));
// Zahl mit höchstens «x =» davor und einer Einheit dahinter
const numish = s => { const p = parseNum(s); if (!Number.isFinite(p.n) || !/^([a-z]\s*=)?$/i.test(p.pre.replace(/\s/g, '')) || (p.rest && !/^[a-zäöüµ°%²³\/.\s]{1,12}\d?$/i.test(p.rest))) return null; return p; };
// Texte/Zahlen tolerant vergleichen; Lösung darf Alternativen mit | enthalten
export function textEq(given, sol) {
  const g = fold(given); if (!g) return false;
  return String(sol ?? '').split('|').some(s0 => {
    const s = fold(s0); if (!s) return false;
    if (g === s || g.replace(/\s/g, '') === s.replace(/\s/g, '')) return true;
    const a = numish(given), b = numish(s0); if (!a || !b || (a.pre && b.pre && fold(a.pre) !== fold(b.pre))) return false;   // nur «reine» Zahlen (z. B. «x = 2.5 cm»), nie CO2 ↔ H2O
    const same = Number.isInteger(a.n) && Number.isInteger(b.n) ? a.n === b.n : Math.abs(a.n - b.n) <= Math.max(1e-9, Math.abs(b.n) * 0.005);
    return same && (a.rest ? (b.rest ? unitEq(a.rest, b.rest) : isUnit(a.rest)) : true);
  });
}
// Code: Leerzeichen/Zeilenumbrüche egal, SQL ohne Gross/Klein und ohne Schluss-Strichpunkt
export const normCode = (x, lang = '') => {
  const src = String(x ?? '').replace(/\r/g, '').replace(/\t/g, '    ');
  if (/sql/i.test(lang)) return src.replace(/\s+/g, ' ').replace(/\s*([(),;=<>+\-*/:])\s*/g, '$1').trim().toLowerCase().replace(/;+$/, '');
  return src.split('\n').map(l => ' '.repeat(l.match(/^ */)[0].length) + l.trim().replace(/\s*([(),;=<>+\-*/{}[\]:])\s*/g, '$1').replace(/\s+/g, ' ')).filter(l => l.trim()).join('\n');   // Einrückung zählt (Python)
};
export const codeEq = (a, b, lang) => !!normCode(a) && normCode(a, lang) === normCode(b, lang);
// Formeln/Reaktionsgleichungen: Leerzeichen, Pfeil-Schreibweise, Indizes (H₂O = H2O) egal; Summanden je Seite in beliebiger Reihenfolge
export const normFormula = x => String(x ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/⟶|⇒|=>|-->|->|→|⇌|<=>|<->|⟹/g, '>').replace(/[·×∙]/g, '*').replace(/[−–]/g, '-');
export function formulaEq(given, sol) {
  const g = normFormula(given); if (!g) return false;
  const sides = f => f.split('>').map(s => s.split(/\+(?![^(]*\))/).filter(Boolean).sort().join('+')).join('>');
  return String(sol ?? '').split('|').some(s0 => { const s = normFormula(s0); return !!s && (g === s || (s.includes('>') && sides(g) === sides(s))); });
}
const sameSet = (a, b) => a.length === b.length && a.map(fold).sort().join('\n') === b.map(fold).sort().join('\n');
const niceStep = range => { const r = range / 10, p = 10 ** Math.floor(Math.log10(r || 1)); return [1, 2, 5, 10].map(m => m * p).find(s => s >= r) || 1; };

// Vollständige Variante mit allen Feldern (Ansichten müssen nie auf undefined prüfen)
export function blankV() {
  return { text: '', latexFormula: '', options: [], correctOption: -1, correctOptions: [], statements: [], blanks: [], left: [], right: [], pairs: [], items: [], groups: [], itemGroup: [],
    columns: [], rows: [], solution: [], markers: [], labels: [], wordBank: [], axes: null, points: [], line: null, unit: '', tolerance: 0.01,
    correctAnswer: '', stepByStepSolution: '', hints: ['', '', ''], rubricCriteria: [], figureData: '', mutationExplanation: '', noKey: false,
    tokens: [], correct: [], regions: [], targets: [], language: '', starter: '', min: 0, max: 10, step: 1, scoring: 'partial', notGiven: false, blankOptions: [] };
}
function guessKind(s) {
  if (strs(s.options).length >= 2) return 'single_choice';
  if (arr(s.statements).length) return 'true_false';
  if (arr(s.left).length && arr(s.right).length) return 'matching';
  if (arr(s.groups).length && arr(s.items).length) return 'categorize';
  if (arr(s.items).length) return 'ordering';
  if (arr(s.rows).length) return 'table_fill';
  if (arr(s.markers).length) return 'label_image';
  if (s.axes && typeof s.axes === 'object') return 'graph_plot';
  if (arr(s.tokens).length || s.selectText) return 'text_select';
  if (/_{3,}/.test(String(s.text || ''))) return 'fill_blanks';
  return /\d/.test(String(s.text || '')) ? 'math_calculation' : 'short_answer';
}
export const tableGaps = v => arr(v.rows).flatMap((r, i) => arr(r).map((c, j) => c === null ? [i, j] : null)).filter(Boolean);
// Lösung als lesbarer Text (PDF-Lösungsbogen, KI-Bewertung, Rückfall für correctAnswer)
export function keyText(kind, v) {
  const k = kindOf(kind) || kind;
  if (k === 'single_choice') return v.options[v.correctOption] || v.correctAnswer;
  if (k === 'multi_select') return v.correctOptions.map(i => v.options[i]).filter(Boolean).join(' · ');
  if (k === 'true_false') return v.statements.map(s => `${s.text}: ${s.correct === true ? 'richtig' : s.correct === false ? 'falsch' : s.correct === 'ng' ? 'nicht im Text' : '?'}`).join(' · ');
  if (k === 'fill_blanks') return v.blanks.map(b => b.split('|')[0]).join(' · ');
  if (k === 'label_image') return v.labels.map((b, i) => `${i + 1}: ${b.split('|')[0]}`).join(' · ');
  if (k === 'matching') return v.left.map((l, i) => `${l} → ${v.right[v.pairs[i]] ?? '?'}`).join(' · ');
  if (k === 'ordering') return v.items.join(' → ');
  if (k === 'categorize') return v.groups.map((g, gi) => `${g}: ${v.items.filter((_, i) => v.itemGroup[i] === gi).join(', ')}`).join(' · ');
  if (k === 'table_fill') return tableGaps(v).map(([i, j]) => `${v.columns[j] || `Spalte ${j + 1}`}${v.rows.length > 1 ? ` (Zeile ${i + 1})` : ''}: ${String(v.solution[i]?.[j] || '?').split('|')[0]}`).join(' · ');
  if (k === 'graph_plot') return v.line ? `y = ${v.line.m}·x ${v.line.q < 0 ? '−' : '+'} ${Math.abs(v.line.q)}` : v.points.map(p => `(${p[0]} | ${p[1]})`).join(' ');
  if (k === 'numeric') return [v.correctAnswer, v.unit].filter(Boolean).join(' ');
  if (k === 'text_select') return arr(v.correct).map(i => v.tokens?.[i]).filter(Boolean).join(' · ');
  if (k === 'number_line') return arr(v.points).map(fmtNum).join(' · ');
  if (k === 'image_hotspot') return arr(v.targets).map(t => t.label || `Stelle bei (${t.x} | ${t.y})`).join(' · ');
  return v.correctAnswer;
}
export const fmtNum = n => String(Math.round((Number(n) || 0) * 1e6) / 1e6).replace('-', '−');
// Text in Wörter und Satzzeichen zerlegen (Satzzeichen eigene Tokens) · [[…]] markiert Lösungs-Tokens
export const tokenize = t => String(t ?? '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) || [];
export function markedTokens(t) {
  const tokens = [], idx2 = [];
  String(t ?? '').split(/(\[\[[\s\S]*?\]\])/).forEach(part => { const m = /^\[\[([\s\S]*)\]\]$/.exec(part), ts = tokenize(m ? m[1] : part); ts.forEach(x => { if (m) idx2.push(tokens.length); tokens.push(x); }); });
  return { tokens, idx: idx2 };
}
const PUNCT_END = /^[.,;:!?)\]}»“”%…]$/, PUNCT_START = /^[(\[{«„]$/;
export const joinTokens = ts => arr(ts).reduce((o, t, i) => o + (i && !PUNCT_END.test(t) && !PUNCT_START.test(ts[i - 1]) ? ' ' : '') + t, '');
const HINT2 = { single_choice: 'Schliesse zuerst die Optionen aus, die sicher falsch sind.', multi_select: 'Prüfe jede Option einzeln: Stimmt sie für sich allein?', true_false: 'Achte auf Signalwörter wie «immer», «nie», «nur» – sie machen Aussagen oft falsch.',
  fill_blanks: 'Lies den ganzen Satz: Welches Fachwort passt grammatikalisch und inhaltlich?', matching: 'Beginne mit dem Paar, bei dem du ganz sicher bist, und schliesse dann aus.', ordering: 'Überlege, was ganz am Anfang und was ganz am Schluss stehen muss.',
  categorize: 'Kläre zuerst, was jede Gruppe ausmacht, und prüfe dann jeden Begriff einzeln.', table_fill: 'Finde die Regel aus einer bekannten Zelle und wende sie auf jede leere Zelle an.', label_image: 'Beginne mit dem Teil, den du sicher erkennst; achte auf Form und Lage.',
  graph_plot: 'Bestimme zwei Punkte (z. B. für x = 0 und x = 2) und verbinde sie.', numeric: 'Schreibe die passende Formel auf und setze die gegebenen Werte mit Einheiten ein.', math_calculation: 'Schreibe die passende Formel auf und setze die gegebenen Werte ein.',
  formula: 'Zähle die Atome auf beiden Seiten – sie müssen gleich sein.', text_select: 'Lies Wort für Wort und prüfe jedes einzeln gegen die Regel.', number_line: 'Suche zuerst die Null und bestimme, wie viel ein Strich wert ist.', code: 'Zerlege das Problem: Was ist gegeben, was soll herauskommen, welche Befehle braucht es?', image_hotspot: 'Orientiere dich zuerst an Dingen, die du sicher erkennst, und suche von dort aus.', essay_open_text: 'Gliedere: These – Begründung mit Fachbegriffen – Beispiel – Fazit.', short_answer: 'Überlege, welches Fachwort genau gefragt ist.', sketch: 'Liste zuerst alle Elemente auf, die in der Zeichnung vorkommen müssen.' };
export function fixHints(list, kind, v = {}) {
  const h = (typeof list === 'string' ? [list] : arr(list)).map(x => str(typeof x === 'object' && x ? x.text : x)).filter(Boolean).slice(0, 3);
  const lines = String(v.stepByStepSolution || '').split('\n').map(s => s.trim()).filter(Boolean);
  const gen = ['Lies die Aufgabe genau: Was ist gegeben, was ist gesucht?', HINT2[kindOf(kind)] || 'Überlege, welches Konzept oder welche Regel hier gefragt ist.',
    lines.length >= 2 ? `Erster Schritt: ${lines[0]}` : 'Geh Schritt für Schritt vor und prüfe dein Resultat am Schluss.'];
  for (const g of gen) if (h.length < 3 && !h.includes(g)) h.push(g);
  while (h.length < 3) h.push(gen[h.length]);
  return h;
}
// Teilpunkte-Schlüssel: Punkte am Anfang lesen; Summe ≠ maxPoints → sauberer Standard-Schlüssel
export const rubricSum = r => (r || []).reduce((s, x) => s + (Number(String(x).replace(',', '.').match(/^\s*(\d+(?:\.\d+)?)/)?.[1]) || 0), 0);
export function fixRubric(rubric, max, kind) {
  const r = strs(rubric, 8), k = kindOf(kind) || kind;
  if (r.length && Math.abs(rubricSum(r) - max) < 1e-9) return r;
  if (k === 'single_choice') return [`${max} P: richtige Option`];
  if (KIND[k]?.auto) return [`${max} P: alles richtig (Teilpunkte anteilig)`];
  if (max <= 1) return [`${max} P: korrektes Resultat`];
  const half = v => Math.round(v * 2) / 2, a = half(max * 0.4), b = half(max * 0.4), c = half(max - a - b);
  const labels = k === 'essay_open_text' ? ['Kernaussage/These richtig', 'Begründung mit Fachbegriffen', 'Beispiel/Fazit'] : k === 'sketch' ? ['alle verlangten Elemente', 'richtige Anordnung/Symbole', 'saubere Beschriftung']
    : k === 'code' ? ['Grundstruktur/Syntax', 'Logik/Bedingung', 'vollständig und korrekt'] : k === 'short_answer' || k === 'formula' ? ['Ansatz/Teilaussage', 'Hauptteil richtig', 'vollständig und korrekt notiert'] : ['Ansatz/Formel', 'Rechenweg/Umformung', 'Resultat mit Einheit'];
  return [[a, labels[0]], [b, labels[1]], [c, labels[2]]].filter(([p]) => p > 0).map(([p, l]) => `${p} P: ${l}`);
}

// Rohdaten → sauberer Baustein. s = Struktur-Quelle, k = Lösungs-Quelle, mode: 'extract' (ohne Lösung) | 'solve' (Struktur aus s) | 'remix' (alles aus s)
// Rückgabe { kind, v } – ungültige Struktur → Rückfall auf math_calculation (Zahlen im Text) bzw. short_answer
export function normVariant(kind0, s0, k0, mode = 'solve', max = 2) {
  const s = obj(s0), k = mode === 'extract' ? {} : obj(k0 ?? s0), v = blankV();
  let kind = kindOf(kind0) || guessKind(s);
  v.text = str(s.text); v.figureData = str(s.figureData); v.unit = str(k.unit || s.unit).slice(0, 24);
  v.correctAnswer = typeof k.correctAnswer === 'object' ? '' : str(k.correctAnswer); v.stepByStepSolution = str(k.solution ?? k.stepByStepSolution); v.mutationExplanation = str(k.change ?? k.mutationExplanation);
  const fb = () => /\d/.test(v.text) ? 'math_calculation' : 'short_answer';
  if (['single_choice', 'multi_select', 'true_false'].includes(kind)) v.scoring = normScoring(s.scoring ?? k.scoring);
  switch (kind) {
    case 'single_choice': case 'multi_select': {
      v.options = strs(s.options, 10); if (v.options.length < 2) { kind = fb(); break; }
      const n = v.options.length, byText = t => { const f = fold(t); return f ? v.options.findIndex(o => fold(o) === f) : -1; };
      v.correctOption = idx(k.correctOption, n); if (v.correctOption < 0 && v.correctAnswer && kind === 'single_choice') v.correctOption = byText(v.correctAnswer);
      v.correctOptions = [...new Set(arr(k.correctOptions).map(x => idx(x, n) >= 0 ? idx(x, n) : byText(x)).filter(i => i >= 0))].sort((a, b) => a - b);
      if (kind === 'multi_select' && !v.correctOptions.length && v.correctOption >= 0) v.correctOptions = [v.correctOption];
      if (kind === 'single_choice' && v.correctOption < 0 && v.correctOptions.length === 1) v.correctOption = v.correctOptions[0];
      if (kind === 'multi_select') v.correctOption = -1;
      v.noKey = kind === 'single_choice' ? v.correctOption < 0 : !v.correctOptions.length; break;
    }
    case 'true_false': {
      let st = arr(s.statements).map(x => x && typeof x === 'object' ? str(x.text ?? x.statement ?? x.aussage) : str(x)).filter(Boolean);
      if (!st.length) st = strs(s.options, 12);
      if (!st.length) { kind = fb(); break; }
      const ks = arr(k.statements), kc = arr(k.correct ?? k.answers);
      v.statements = st.slice(0, 12).map((text, i) => ({ text, correct: tfVal(ks[i] && typeof ks[i] === 'object' ? ks[i].correct ?? ks[i].richtig : ks[i] ?? kc[i]) }));
      v.notGiven = asBool(s.notGiven ?? k.notGiven) === true || v.statements.some(x => x.correct === 'ng');
      v.noKey = v.statements.some(x => x.correct === null); break;
    }
    case 'fill_blanks': {
      v.text = v.text.replace(/_{3,}/g, '___').replace(/\[\s*(?:\.{3}|…)?\s*\]/g, '___'); const n = Math.min(30, blankCount(v.text));
      if (!n) { kind = fb(); break; }
      const b = arr(k.blanks).map(alt); v.blanks = Array.from({ length: n }, (_, i) => b[i] || '');
      const bo = arr(s.blankOptions ?? k.blankOptions); v.blankOptions = Array.from({ length: n }, (_, i) => { const o = [...new Set(strs(bo[i], 8))]; return o.length >= 2 ? o : []; });
      if (v.blankOptions.every(o => !o.length)) v.blankOptions = [];
      v.wordBank = strs(s.wordBank ?? k.wordBank, 24);
      v.noKey = v.blanks.some(x => !x); break;
    }
    case 'matching': {
      v.left = strs(s.left, 12); v.right = strs(s.right, 14); if (v.left.length < 2 || v.right.length < 2) { kind = fb(); break; }
      const p = arr(k.pairs), nL = v.left.length, nR = v.right.length, pm = new Map(p.filter(Array.isArray).map(([l, r]) => [idx(l, nL), idx(r, nR)]));
      v.pairs = v.left.map((_, i) => pm.size ? (pm.get(i) ?? -1) : idx(p[i], nR));
      if (mode === 'remix' && nL === nR && v.pairs.every((x, i) => x === i)) {   // rechte Spalte mischen, sonst wäre die Lösung sichtbar
        const perm = shuffleIdx(nR), right = perm.map(i => v.right[i]); v.pairs = v.pairs.map(x => perm.indexOf(x)); v.right = right;
      }
      v.noKey = v.pairs.some(x => x < 0); break;
    }
    case 'ordering': {
      const it = strs(s.items, 12); if (it.length < 2) { kind = fb(); break; }
      v.items = it;
      if (mode === 'solve') {
        const ki = strs(k.items, 12), ord = arr(k.order).map(x => idx(x, it.length));
        if (ki.length === it.length && sameSet(ki, it)) v.items = ki.map(t => it.find(x => fold(x) === fold(t)) ?? t);
        else if (ord.length === it.length && new Set(ord).size === it.length && ord.every(i => i >= 0)) v.items = ord.map(i => it[i]);
        else v.noKey = true;
      }
      break;
    }
    case 'categorize': {
      v.groups = strs(s.groups, 6); v.items = strs(s.items, 24); if (v.groups.length < 2 || v.items.length < 2) { kind = fb(); break; }
      const g = arr(k.itemGroup ?? k.itemGroups);
      v.itemGroup = v.items.map((_, i) => { const x = idx(g[i], v.groups.length); return x >= 0 ? x : (g[i] == null ? -1 : v.groups.findIndex(G => fold(G) === fold(g[i]))); });
      v.noKey = v.itemGroup.some(x => x < 0); break;
    }
    case 'table_fill': {
      const rows = arr(s.rows).filter(Array.isArray).slice(0, 30), w = Math.min(12, Math.max(arr(s.columns).length, ...rows.map(r => r.length), 0));
      v.columns = Array.from({ length: w }, (_, j) => str(arr(s.columns)[j]));
      v.rows = rows.map(r => Array.from({ length: w }, (_, c) => isGap(r[c]) ? null : str(r[c])));
      const gaps = tableGaps(v); if (!w || !gaps.length) { kind = fb(); break; }
      const so = arr(k.solution);
      v.solution = v.rows.map((r, i) => r.map((c, j) => c === null ? (alt(arr(so[i])[j]) || null) : null));
      v.noKey = gaps.some(([i, j]) => !v.solution[i][j]); break;
    }
    case 'label_image': {
      let m = arr(s.markers).map(x => Array.isArray(x) ? { x: num(x[0]), y: num(x[1]) } : { x: num(obj(x).x), y: num(obj(x).y) }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 12);
      if (m.length && m.every(p => p.x <= 1 && p.y <= 1)) m = m.map(p => ({ x: p.x * 1000, y: p.y * 1000 }));
      if (!m.length) { kind = fb(); break; }
      v.markers = m.map(p => ({ x: c1000(p.x), y: c1000(p.y) })); v.wordBank = strs(s.wordBank ?? k.wordBank, 16);
      const l = arr(k.labels); v.labels = v.markers.map((_, i) => alt(l[i]));
      v.noKey = v.labels.some(x => !x); break;
    }
    case 'graph_plot': {
      const ax = obj(s.axes ?? k.axes); let [x0, x1, y0, y1] = [ax.xmin, ax.xmax, ax.ymin, ax.ymax].map(num), st = num(ax.step);
      if (!(x1 > x0)) [x0, x1] = [-5, 5]; if (!(y1 > y0)) [y0, y1] = [-5, 5];
      if (!(st > 0) || (x1 - x0) / st > 60 || (y1 - y0) / st > 60) st = niceStep(Math.max(x1 - x0, y1 - y0));
      v.axes = { xmin: x0, xmax: x1, ymin: y0, ymax: y1, step: st };
      v.points = arr(k.points).map(p => Array.isArray(p) ? [num(p[0]), num(p[1])] : [num(obj(p).x), num(obj(p).y)]).filter(p => p.every(Number.isFinite)).slice(0, 20);
      const ln = obj(k.line); v.line = Number.isFinite(num(ln.m)) && Number.isFinite(num(ln.q)) ? { m: num(ln.m), q: num(ln.q) } : null;
      v.noKey = !v.points.length && !v.line; break;
    }
    case 'text_select': {
      const src = str(s.selectText ?? s.passage), mt = str(k.markedText) || (/\[\[/.test(src) ? src : '');
      const toks = arr(s.tokens).length >= 2 ? arr(s.tokens).map(t => str(t && typeof t === 'object' ? t.text ?? t.t : t)).filter(Boolean).slice(0, 400) : tokenize(src.replace(/\[\[|\]\]/g, '')).slice(0, 400);
      if (toks.length < 2) { kind = fb(); break; }
      v.tokens = toks; const n = toks.length, mk = mt ? markedTokens(mt) : null;
      if (mk && mk.idx.length && mk.tokens.length === n && mk.tokens.every((t, i) => fold(t) === fold(toks[i]) || t === toks[i])) v.correct = mk.idx;
      else {
        const used = new Set();
        v.correct = [...new Set(arr(k.correct ?? k.correctTokens).map(x => { if (typeof x === 'number' || /^\s*\d+\s*$/.test(String(x ?? ''))) return idx(x, n);
          const f = fold(x); if (!f) return -1; const i = toks.findIndex((t, j) => !used.has(j) && fold(t) === f); if (i >= 0) used.add(i); return i; }).filter(i => i >= 0))].sort((a, b) => a - b);
      }
      v.noKey = !v.correct.length; break;
    }
    case 'image_hotspot': {   // Stellen 0–1000 relativ zu q.crop; regions = alle möglichen Stellen (Struktur), targets = richtige (Lösung)
      const pt = x => { const o = Array.isArray(x) ? { x: x[0], y: x[1], r: x[2] } : obj(x); return { x: num(o.x), y: num(o.y), r: num(o.r ?? o.radius), label: str(o.label ?? o.name).slice(0, 60) }; };
      const fix = l => { let m = arr(l).map(pt).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).slice(0, 20);
        if (m.length && m.every(p => p.x <= 1 && p.y <= 1)) m = m.map(p => ({ ...p, x: p.x * 1000, y: p.y * 1000, r: p.r <= 1 ? p.r * 1000 : p.r }));
        return m.map(p => ({ x: c1000(p.x), y: c1000(p.y), r: Math.max(20, Math.min(300, p.r > 0 ? Math.round(p.r) : 60)), label: p.label })); };
      v.regions = fix(s.regions ?? s.markers);
      const t = fix(k.targets), cr = [...new Set(arr(k.correctRegions ?? (k.correctRegion !== undefined ? [k.correctRegion] : [])).map(i => idx(i, v.regions.length)).filter(i => i >= 0))];
      v.targets = t.length ? t : cr.map(i => ({ ...v.regions[i] }));
      if (!v.regions.length && !v.targets.length) { kind = fb(); break; }
      v.noKey = !v.targets.length; break;
    }
    case 'number_line': {
      const ax = obj(s.axis); let lo = num(s.min ?? ax.min), hi = num(s.max ?? ax.max), st = num(s.step ?? ax.step);
      if (!(hi > lo)) { lo = 0; hi = 10; }
      if (!(st > 0) || (hi - lo) / st > 2000) st = niceStep(hi - lo);
      v.min = lo; v.max = hi; v.step = st;
      v.points = [...new Set(arr(k.points ?? k.values).map(num).filter(n => Number.isFinite(n) && n >= lo - 1e-9 && n <= hi + 1e-9))].sort((a, b) => a - b).slice(0, 12);
      v.noKey = !v.points.length; break;
    }
    case 'code': {   // Einrückung erhalten (kein trim pro Zeile)
      v.language = str(s.language ?? s.lang ?? k.language).toLowerCase().slice(0, 20);
      v.starter = String(s.starter ?? s.code ?? '').replace(/\r/g, '').replace(/\s+$/, '').slice(0, 4000);
      if (typeof k.correctAnswer === 'string') v.correctAnswer = k.correctAnswer.replace(/\r/g, '').trim().slice(0, 6000);
      break;
    }
    case 'numeric': {
      const p = parseNum(v.correctAnswer); if (Number.isFinite(p.n)) { v.correctAnswer = String(p.n); if (!v.unit && p.rest) v.unit = p.rest.slice(0, 24); }
      const t = num(k.tolerance); v.tolerance = t > 0 && t <= 0.5 ? t : 0.01; v.noKey = !Number.isFinite(p.n); break;
    }
  }
  if (mode === 'extract') v.noKey = !!KIND[kind].auto;
  if (!v.correctAnswer && mode !== 'extract') v.correctAnswer = (KIND[kind].auto && !v.noKey ? keyText(kind, v) : '') || v.stepByStepSolution.split('\n').filter(Boolean).pop() || '';
  v.hints = fixHints(k.hints ?? k.tip ?? (Array.isArray(s.hints) ? s.hints : null), kind, v);
  v.rubricCriteria = fixRubric(k.rubric ?? k.rubricCriteria, max, kind);
  return { kind, v };
}
export function shuffleIdx(n, rnd = Math.random) {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  if (n > 1 && p.every((x, i) => x === i)) p.push(p.shift());   // nie schon gelöst
  return p;
}
// Alte Prüfungen (multiple_choice, diagram_analysis, 2 Tipps) auf Exam Studio 2 heben – idempotent
export function migrateDoc(doc) {
  if (!doc || doc.v2) return doc;
  doc.questions = arr(doc.questions).map(q => {
    const max = clampPts(q.maxPoints), o = normVariant(q.taskKind, q.originalQuestion, q.originalQuestion, 'solve', max);
    const x = q.remixedQuestion ? normVariant(o.kind, q.remixedQuestion, q.remixedQuestion, 'remix', max) : null;
    return { ...q, maxPoints: max, taskKind: o.kind, originalQuestion: { ...o.v, mutationExplanation: '' }, remixedQuestion: x && x.kind === o.kind && x.v.text ? x.v : copyV(o.v) };
  });
  if (doc.timeLimitMin === undefined) doc.timeLimitMin = null;
  doc.v2 = true; return doc;
}
// Gemeinsames Material (Lesetext, Quelle, Fallsituation, M1–Mn): Seiten zusammenführen, Aufgaben über die Bezeichnung verknüpfen
const refKey = s => fold(s).replace(/^(material|teil|part|section|abschnitt)\s*/, '').replace(/[\s.:–-]/g, '');
export function normMat(m, pageIdx = 0) {
  const o = obj(m), g = o.graphic && typeof o.graphic === 'object' && 'ymin' in o.graphic ? { ...normBox(o.graphic), pageIndex: pageIdx } : null;
  const text = str(o.text).replace(/\r/g, '').slice(0, 12000), label = str(o.label ?? o.id).slice(0, 16);
  if (!text && !g && !label) return null;
  return { label, kind: str(o.type ?? o.kind).slice(0, 30) || (g ? 'Abbildung' : 'Text'), title: str(o.title).slice(0, 140), text, box: g };
}
export function collectMaterials(list) {
  const out = [];
  for (const m0 of arr(list)) {
    const m = m0 && typeof m0 === 'object' && 'box' in m0 && 'kind' in m0 ? m0 : normMat(m0); if (!m) continue;
    const k = refKey(m.label), ex = k && out.find(x => refKey(x.label) === k);
    if (ex) { if (m.text && !ex.text.includes(m.text.slice(0, 60))) ex.text = `${ex.text}\n${m.text}`.trim().slice(0, 12000); if (!ex.box && m.box) ex.box = m.box; if (!ex.title) ex.title = m.title; continue; }
    if (out.length < 20) out.push({ ...m, id: 'm' + (out.length + 1), label: m.label || `M${out.length + 1}`, crop: null });
  }
  return out;
}
export const linkRef = (list, ref) => { const k = refKey(ref); return k ? arr(list).find(x => refKey(x.label ?? x.title) === k || (!!x.title && refKey(x.title) === k))?.id || null : null; };
export const matOf = (doc, q) => q?.materialId ? arr(doc?.materials).find(m => m?.id === q.materialId) || null : null;
const matPayload = (doc, qs) => { const ms = [...new Set(qs.map(q => q.materialId).filter(Boolean))].map(id => matOf(doc, { materialId: id })).filter(Boolean);
  return ms.length ? `\nMaterialien: ${JSON.stringify(ms.map(m => ({ material: m.label, typ: m.kind, titel: m.title || undefined, text: m.text.slice(0, 6000) || '(nur Abbildung)' })))}` : ''; };

// Struktur einer Variante für die KI (ohne Lösungen)
function structOf(kind, v) {
  const o = {};
  if (v.options.length) o.options = v.options;
  if (v.statements.length) o.statements = v.statements.map(s => ({ text: s.text }));
  if (v.notGiven) o.notGiven = true;
  if (v.scoring && v.scoring !== 'partial') o.scoring = v.scoring;
  if (kind === 'fill_blanks') { if (v.blankOptions?.length) o.blankOptions = v.blankOptions; if (v.wordBank?.length) o.wordBank = v.wordBank; }
  if (kind === 'matching') { o.left = v.left; o.right = v.right; }
  if (kind === 'ordering' || kind === 'categorize') o.items = v.items;
  if (kind === 'categorize') o.groups = v.groups;
  if (kind === 'table_fill') { o.columns = v.columns; o.rows = v.rows; }
  if (kind === 'label_image') { o.markers = v.markers; if (v.wordBank.length) o.wordBank = v.wordBank; }
  if (kind === 'graph_plot') o.axes = v.axes;
  if (kind === 'number_line') { o.min = v.min; o.max = v.max; o.step = v.step; }
  if (kind === 'code') { if (v.language) o.language = v.language; if (v.starter) o.starter = v.starter; }
  if (kind === 'image_hotspot') o.regions = v.regions.map((r, i) => ({ nr: i, label: r.label || `Stelle ${i + 1}` }));
  if (kind === 'text_select') o.tokensNummeriert = v.tokens.map((t, i) => `${i}:${t}`).join(' ');
  if (v.unit) o.unit = v.unit;
  return o;
}

/* =========================================================================================
   3b) KI-ANALYSE: bis 20 Seiten in 2er-Wellen, danach Lösen + Remix (Rechen-Modell, Backward-Construction)
   ========================================================================================= */
async function processSinglePage(page, pageIdx) {
  const out = await ai({ kind: pageIdx === 0 ? 'exam' : 'studio', effort: 'high', maxTokens: 9000, keepLang: true, system: PAGE_EXTRACT_PROMPT,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await forAI(page.url) } },
      { type: 'text', text: `Prüfungsseite ${pageIdx + 1}. Lies alle Aufgaben exakt aus (ohne sie zu lösen), wähle pro Aufgabe den passenden Baustein, inklusive grosszügiger Grafik-Koordinaten, als JSON.` },
    ] }] });
  const j = obj(parseJSON(out));
  const boxes = l => arr(l).filter(b => b && typeof b === 'object' && 'ymin' in b).slice(0, 60).map(normBox);
  const hw = boxes(j.handwriting), af = boxes(j.answerFields);
  const tl = num(j.timeLimitMin);
  return { subject: str(j.subject), title: str(j.title), tools: strs(j.tools, 6), timeLimitMin: tl >= 5 && tl <= 600 ? Math.round(tl) : null, hw, af, pageIdx,
    mats: arr(j.materials).slice(0, 12).map(m => normMat(m, pageIdx)).filter(Boolean), parts: arr(j.parts).slice(0, 8), questions: arr(j.questions).filter(q => q && typeof q === 'object').map(q => {
    const g = q.graphic && typeof q.graphic === 'object' && 'ymin' in q.graphic ? { ...normBox(q.graphic), pageIndex: pageIdx, label: str(q.graphic.label) || 'Abbildung' } : null;
    const max = clampPts(q.maxPoints), { kind, v } = normVariant(!g && ['label_image', 'image_hotspot'].includes(kindOf(q.taskKind)) ? 'short_answer' : q.taskKind, q, null, 'extract', max);   // ohne Abbildung kein Beschriften/Antippen; Lösung folgt im Rechen-Modell
    if (g && kind === 'label_image') v.markers = v.markers.map(m => markerToCrop(m, g));
    if (g && kind === 'image_hotspot') { const k0 = (g.xmax - g.xmin) / Math.max(1, Math.min(1000, g.xmax + CROP_PAD) - Math.max(0, g.xmin - CROP_PAD)); v.regions = v.regions.map(m => ({ ...m, ...markerToCrop(m, g), r: Math.max(20, Math.round(m.r * k0)) })); }
    const qb = q.questionBox && typeof q.questionBox === 'object' && 'ymin' in q.questionBox ? { ...normBox(q.questionBox), pageIndex: pageIdx } : null;
    return { questionNumber: str(q.questionNumber) || '?', taskKind: kind, maxPoints: max, originalQuestion: v, graphicBoundingBox: g, qBox: qb, matRef: str(q.material ?? q.materialId).slice(0, 40), partRef: str(q.part ?? q.section).slice(0, 80) };
  }).filter(q => q.originalQuestion.text.length > 2) };
}

// KI-Marker (0–1000 im Rahmen «graphic») → 0–1000 im ausgeschnittenen Bild (Rahmen + Sicherheitsrand CROP_PAD)
export function markerToCrop(m, g) {
  const x0 = Math.max(0, g.xmin - CROP_PAD), x1 = Math.min(1000, g.xmax + CROP_PAD), y0 = Math.max(0, g.ymin - CROP_PAD), y1 = Math.min(1000, g.ymax + CROP_PAD);
  return { x: c1000((g.xmin + m.x / 1000 * (g.xmax - g.xmin) - x0) / ((x1 - x0) || 1) * 1000), y: c1000((g.ymin + m.y / 1000 * (g.ymax - g.ymin) - y0) / ((y1 - y0) || 1) * 1000) };
}
// Remix-Rohdaten → Variante mit gleichem Baustein, sonst null (dann bleibt das Original)
function remixFrom(q, r) {
  if (!r || typeof r !== 'object' || !str(r.text)) return null;
  const rr = q.taskKind === 'label_image' ? { ...r, markers: q.originalQuestion.markers } : q.taskKind === 'image_hotspot' ? { ...r, regions: q.originalQuestion.regions } : r;   // gleiche Abbildung, gleiche Marker/Stellen
  const o0 = q.originalQuestion, r2 = { ...rr, scoring: rr.scoring ?? o0.scoring, notGiven: rr.notGiven ?? o0.notGiven };   // Wertung und «nicht im Text» bleiben wie im Original
  const { kind, v } = normVariant(q.taskKind, r2, r2, 'remix', q.maxPoints);
  if (kind !== q.taskKind) return null;
  v.figureData = v.figureData || q.originalQuestion.figureData; v.mutationExplanation = v.mutationExplanation || 'Neue Werte & veränderte Fragestellung';
  return v;
}
const qPayload = (q, v, doc) => ({ id: q.id, nummer: q.questionNumber, typ: q.taskKind, maxPoints: q.maxPoints, text: v.text, material: matOf(doc, q)?.label, abbildungsDaten: v.figureData || undefined, abbildung: q.graphicBoundingBox?.label || undefined, ...structOf(q.taskKind, v) });
export async function solveAndRemix(doc, onProg) {
  const list = batches(doc.questions, SOLVE_BATCH), key = Math.random().toString(36).slice(2, 7);
  for (const [k, b] of list.entries()) {
    try {
      const out = await ai({ kind: 'studio', effort: 'high', maxTokens: 16000, keepLang: true, system: SOLVE_AND_REMIX_PROMPT, messages: [{ role: 'user', content:
        `Fach: ${doc.subject || 'unbekannt'} · Variationsschlüssel: ${key}${matPayload(doc, b)}\n${JSON.stringify(b.map(q => qPayload(q, q.originalQuestion, doc)))}` }] });
      const res = arr(obj(parseJSON(out)).questions);
      b.forEach((q, i) => {
        const r = obj(res.find(x => x?.id === q.id) || (res.length === b.length && !res[i]?.id ? res[i] : null));   // nach Position nur ohne ids und bei gleicher Anzahl
        if (r.original && typeof r.original === 'object') {
          const o = normVariant(q.taskKind, q.originalQuestion, r.original, 'solve', q.maxPoints);
          if (o.kind === q.taskKind) q.originalQuestion = { ...o.v, text: q.originalQuestion.text, figureData: q.originalQuestion.figureData, mutationExplanation: '' };
        }
        q.remixedQuestion = remixFrom(q, r.remix) || { ...copyV(q.originalQuestion), mutationExplanation: '' };
      });
    } catch (e) { console.warn('Lösen übersprungen', e); b.forEach(q => { if (!q.remixedQuestion?.text) q.remixedQuestion = { ...copyV(q.originalQuestion), mutationExplanation: '' }; }); }
    onProg?.((k + 1) / list.length);
  }
  doc.remixRound = Math.max(1, doc.remixRound + 1); doc.remixFresh = true;
}

// Remix («Neue Zahlen»): text-basiert, Backward-Construction, ersetzt remixedQuestion
export async function remixQuestions(doc) {
  if (!hasKey() || doc.source === 'demo') { doc.remixRound++; demoRemix(doc); return; }
  const key = Math.random().toString(36).slice(2, 7);
  for (const b of batches(doc.questions, REMIX_BATCH)) {
    try {
      const out = await ai({ kind: 'studio', effort: 'high', maxTokens: 12000, keepLang: true, system: REMIX_PROMPT, messages: [{ role: 'user', content:
        `Fach: ${doc.subject || 'unbekannt'} · Variationsschlüssel: ${key}${matPayload(doc, b)}\n${JSON.stringify(b.map(q => ({ ...qPayload(q, q.originalQuestion, doc), originalLoesung: keyText(q.taskKind, q.originalQuestion), rubric: q.originalQuestion.rubricCriteria,
          bisher: q.remixedQuestion?.text !== q.originalQuestion.text ? q.remixedQuestion?.correctAnswer : undefined })))}` }] });
      const list = arr(obj(parseJSON(out)).questions);
      b.forEach((q, k) => { const rx = remixFrom(q, list.find(x => x?.id === q.id) || (list.length === b.length && !list[k]?.id ? list[k] : null)); if (rx) q.remixedQuestion = rx; });
    } catch (e) { console.warn('Remix übersprungen', e); }
  }
  doc.remixRound++;
}

// Prüfungsteile {id, title, timeLimitMin, tools[] | null (= wie Prüfung)}; gleiche Titel über Seiten zusammenführen
export function normParts(list) {
  const out = [];
  for (const p0 of arr(list)) {
    const p = obj(p0), title = str(p.title ?? p.name ?? p.label).slice(0, 80); if (!title) continue;
    const t = num(p.timeLimitMin ?? p.minutes), tl = t >= 1 && t <= 600 ? Math.round(t) : null, tools = Array.isArray(p.tools) ? strs(p.tools, 6) : null, ex = out.find(x => refKey(x.title) === refKey(title));
    if (ex) { if (!ex.timeLimitMin && tl) ex.timeLimitMin = tl; if (!ex.tools && tools) ex.tools = tools; continue; }
    if (out.length < 8) out.push({ id: 'p' + (out.length + 1), title, timeLimitMin: tl, tools });
  }
  return out;
}
// Material und Teile verknüpfen: nur Material mit Inhalt, das genutzt wird; Aufgaben ohne Teil-Angabe gehören zum vorherigen Teil
export function linkDoc(doc, rawMats = [], rawParts = []) {
  const mats = collectMaterials(rawMats).filter(m => m.text || m.box);
  let parts = normParts(rawParts), last = null;
  doc.questions.forEach(q => { q.materialId = linkRef(mats, q.matRef); q.partId = parts.length ? (last = linkRef(parts, q.partRef) || last || parts[0].id) : null; delete q.matRef; delete q.partRef; });
  const used = new Set(doc.questions.map(q => q.materialId).filter(Boolean)), usedP = new Set(doc.questions.map(q => q.partId).filter(Boolean));
  doc.materials = mats.filter(m => used.has(m.id));
  parts = parts.filter(p => usedP.has(p.id));
  if (parts.length < 2) { if (!doc.timeLimitMin && parts[0]?.timeLimitMin) doc.timeLimitMin = parts[0].timeLimitMin; parts = []; doc.questions.forEach(q => { q.partId = null; }); }
  doc.parts = parts;
  const sum = parts.reduce((t, p) => t + (p.timeLimitMin || 0), 0); if (!doc.timeLimitMin && sum) doc.timeLimitMin = sum;
  return doc;
}
export async function analyzeExam({ pages, title, onStep }) {
  const doc = { id: uid(), ts: Date.now(), title: str(title), subject: '', subjectId: null, tools: [], timeLimitMin: null, pages: [], questions: [], source: 'ki', remixRound: 0, v2: true };
  for (const [i, p] of pages.entries()) { const key = `page:${doc.id}:${i}`; await imgPut(key, p.url); doc.pages.push({ key, w: p.w, h: p.h }); }
  if (!hasKey() || pages.every(p => p.demo)) return demoAnalyze(doc, pages, onStep);   // Beispiel-Prüfung nie über die KI (Kontingent)
  onStep?.(0, 0.05);
  const found = [], tools = new Set(), hwBoxes = [], ansBoxes = [], rawMats = [], rawParts = [], waves = batches(pages.map((p, i) => [p, i]), PAGE_BATCH);
  for (const [w, wave] of waves.entries()) {
    const res = await Promise.allSettled(wave.map(([p, i]) => processSinglePage(p, i)));
    for (const r of res) if (r.status === 'fulfilled') {
      if (!doc.subject && r.value.subject) doc.subject = r.value.subject;
      if (!doc.title && r.value.title) doc.title = r.value.title;
      if (!doc.timeLimitMin && r.value.timeLimitMin) doc.timeLimitMin = r.value.timeLimitMin;
      r.value.tools.forEach(t => tools.add(t)); found.push(...r.value.questions); rawMats.push(...r.value.mats); rawParts.push(...r.value.parts); hwBoxes[r.value.pageIdx] = r.value.hw; ansBoxes[r.value.pageIdx] = r.value.af;
    } else console.warn('Seite übersprungen', r.reason);
    onStep?.(w ? 1 : 0, (w + 1) / waves.length);
  }
  if (!found.length) throw new Error('Es wurden keine Aufgaben erkannt. Bitte lade gut lesbare, gerade fotografierte Seiten hoch.');
  doc.tools = [...tools];
  doc.subjectId = guessSubjectId(doc.subject);
  doc.questions = found.slice(0, 120).map((q, i) => ({ id: 'q' + (i + 1), questionNumber: q.questionNumber === '?' ? String(i + 1) : q.questionNumber, taskKind: q.taskKind, maxPoints: q.maxPoints,
    originalQuestion: q.originalQuestion, remixedQuestion: { ...copyV(q.originalQuestion), mutationExplanation: '' }, graphicBoundingBox: q.graphicBoundingBox, qBox: q.qBox, crop: null, qcrop: null, cropInk: true, matRef: q.matRef, partRef: q.partRef }));
  linkDoc(doc, rawMats, rawParts);
  onStep?.(2, 0.3); await cleanPagesHW(doc, pages, hwBoxes, ansBoxes); await cropAll(doc);
  onStep?.(3, 0.5); await solveAndRemix(doc, p => onStep?.(3, 0.5 + p * 0.5));
  if (!doc.title) doc.title = doc.subject ? `${doc.subject} – Prüfung` : 'Prüfung';
  onStep?.(4, 1);
  return doc;
}
function guessSubjectId(name) {
  const n = String(name || '').toLowerCase(), subs = St.mySubjects();
  return subs.find(s => n && (n.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(n)))?.id || subs[0]?.id || null;
}
// Handschrift-Netz über alle Seiten (bereits gereinigte Seiten werden übernommen); Fehler → Seite bleibt wie sie ist
export async function hwClean(url, boxes = [], answers = []) { try { return (await removeHandwritingUrl(url, boxes, answers)).url; } catch { return null; } }
async function cleanPagesHW(doc, pages, hwBoxes = [], ansBoxes = []) {
  for (const [i, p] of pages.entries()) {   // mit KI-Rahmen (Handschrift ODER getippte Antworten) neu, sonst Vorschau-Ergebnis übernehmen
    const hb = hwBoxes[i] || [], ab = ansBoxes[i] || [];
    const c = hb.length || ab.length ? await hwClean(p.url, hb, ab) : p.clean !== undefined ? p.clean : await hwClean(p.url);
    if (c) { const key = `pageclean:${doc.id}:${i}`; await imgPut(key, c); doc.pages[i].cleanKey = key; }
  }
}
async function pageSrc(doc, i, clean = true) {
  const p = doc.pages[i] || doc.pages[0]; if (!p) return null;
  return (clean && p.cleanKey && await imgGet(p.cleanKey)) || imgGet(p.key);
}
// Zweiter Blick mit Zoom: Grafik-Rahmen der KI im vergrösserten Ausschnitt nachprüfen – unsicher → keine Grafik statt einer falschen
const REFINE_PROMPT = `Du siehst einen Ausschnitt einer Prüfungsseite. Gesucht ist die gedruckte Abbildung (Skizze, Grafik, Diagramm, Tabelle, Karte), Beschreibung: «{L}».
Gib den ENGEN Rahmen NUR dieser Abbildung inkl. ihrer Beschriftungen (Masse, Buchstaben, Achsen) in Koordinaten 0–1000 relativ zu DIESEM Ausschnitt an. Fliesstext, Aufgabentext, Lösungen und Handschrift gehören NICHT dazu.
Ist keine solche Abbildung zu sehen: {"found":false}. Sonst NUR JSON: {"found":true,"box":{"ymin":0,"xmin":0,"ymax":0,"xmax":0}}`;
async function refineBox(doc, b, label) {
  if (!b || !hasKey() || doc.source === 'demo') return b;
  try {
    const url = await pageSrc(doc, b.pageIndex, true); if (!url) return b;
    const m = 120, z = { ymin: Math.max(0, b.ymin - m), xmin: Math.max(0, b.xmin - m), ymax: Math.min(1000, b.ymax + m), xmax: Math.min(1000, b.xmax + m) };
    const crop = await cropDiagramFromSource(url, z, { removeInk: false, pad: 0 });
    const out = await ai({ kind: 'studio', effort: 'low', maxTokens: 600, keepLang: true, system: REFINE_PROMPT.replace('{L}', str(label) || 'Abbildung'),
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await forAI(crop) } }, { type: 'text', text: 'Rahmen der Abbildung als JSON.' }] }] }, 2);
    const j = parseJSON(out) || {};
    if (j.found === false) return null;
    if (!j.box || !('ymin' in j.box)) return b;
    const r = normBox(j.box), h = z.ymax - z.ymin, w = z.xmax - z.xmin;
    return { ...b, ymin: z.ymin + r.ymin / 1000 * h, xmin: z.xmin + r.xmin / 1000 * w, ymax: z.ymin + r.ymax / 1000 * h, xmax: z.xmin + r.xmax / 1000 * w };
  } catch { return b; }
}
export async function cropAll(doc) {
  for (const q of doc.questions) if (q.graphicBoundingBox && !q.refined) { q.graphicBoundingBox = await refineBox(doc, q.graphicBoundingBox, q.graphicBoundingBox.label); q.refined = true; }
  for (const m of arr(doc.materials)) if (m?.box && !m.refined) { m.box = await refineBox(doc, m.box, m.title || m.label); m.refined = true; }
  for (const q of doc.questions) await recrop(doc, q); for (const m of arr(doc.materials)) await cropMat(doc, m);
}
export async function cropMat(doc, m) {
  if (!m?.box) { if (m?.crop) await imgDel(m.crop); if (m) m.crop = null; return; }
  const url = await pageSrc(doc, m.box.pageIndex, true);
  if (url) { const key = `mat:${doc.id}:${m.id}`; await imgPut(key, await cropDiagramFromSource(url, m.box, { removeInk: !doc.pages[m.box.pageIndex]?.cleanKey, pad: CROP_PAD })); m.crop = key; }
}
export async function recrop(doc, q) {
  const b = q.graphicBoundingBox;
  if (!b) { if (q.crop) await imgDel(q.crop); q.crop = null; }
  else {
    const url = await pageSrc(doc, b.pageIndex, q.cropInk !== false);
    if (url) { const key = `crop:${doc.id}:${q.id}`; await imgPut(key, await cropDiagramFromSource(url, b, { removeInk: q.cropInk !== false && !doc.pages[b.pageIndex]?.cleanKey, pad: CROP_PAD })); q.crop = key; }
  }
}

/* =========================================================================================
   4) REIHENFOLGE & BEWERTUNG (automatisch je Baustein, sonst KI · Lernhinweis-Abzug · Noten)
   ========================================================================================= */
export const V = (q, variant) => variant === 'remix' ? (q.remixedQuestion || q.originalQuestion) : q.originalQuestion;
// Reihenfolge nur als ID-Liste – Antworten/Tipps/Fotos hängen an q.id und bleiben dadurch stabil
export function orderedQs(doc, order) {
  if (!doc) return [];
  if (!order?.length) return doc.questions;
  const map = new Map(doc.questions.map(q => [q.id, q])), out = order.map(id => map.get(id)).filter(Boolean);
  return out.length === doc.questions.length ? out : doc.questions;
}
// Mischen: Prüfungsteile bleiben in ihrer Reihenfolge, Aufgaben zum selben Material bleiben als Block zusammen
export function shuffledOrder(doc, rnd = Math.random) {
  const blocks = [];
  for (const q of doc.questions) { const last = blocks.at(-1); if (q.materialId && last?.mat === q.materialId && last.part === (q.partId || null)) last.ids.push(q.id); else blocks.push({ mat: q.materialId || null, part: q.partId || null, ids: [q.id] }); }
  const out = [];
  for (const p of [...new Set(blocks.map(b => b.part))]) {
    const bs = blocks.filter(b => b.part === p);
    for (let i = bs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bs[i], bs[j]] = [bs[j], bs[i]]; }
    bs.forEach(b => out.push(...b.ids));
  }
  return out;
}
export const swissGrade = (earned, max) => max ? Math.max(1, Math.min(6, Math.round((1 + 5 * (earned / max)) * 10) / 10)) : 1;
const halfPts = v => Math.round((Number(v) || 0) * 2) / 2;
const floorHalf = v => Math.floor((Number(v) || 0) * 2 + 1e-9) / 2;
// Anteil → Punkte: voll nur bei 100 %, sonst abgerundet auf halbe Punkte
const part = (frac, max) => frac >= 1 - 1e-9 ? max : Math.max(0, Math.min(max - 0.5, floorHalf(Math.max(0, frac) * max)));
export const hintPenalty = level => HINT_PENALTY[Math.max(0, Math.min(4, Math.round(Number(level) || 0)))];
export const applyHints = (points, maxPoints, level) => hintPenalty(level) >= 1 ? 0 : Math.max(0, Math.min(maxPoints, floorHalf((Number(points) || 0) * (1 - hintPenalty(level)))));

// Leere Antwort-Formen pro Baustein (Grundlage für data-bind, das keine Objekte anlegt)
export function emptyAnswer(kind, v, rnd = Math.random) {
  switch (kindOf(kind)) {
    case 'single_choice': case 'image_hotspot': return null;
    case 'multi_select': case 'graph_plot': case 'text_select': case 'number_line': return [];
    case 'true_false': return v.statements.map(() => null);
    case 'fill_blanks': return Array.from({ length: blankCount(v.text) }, () => '');
    case 'label_image': return v.markers.map(() => '');
    case 'matching': return v.left.map(() => null);
    case 'categorize': return v.items.map(() => null);
    case 'ordering': return shuffleIdx(v.items.length, rnd);
    case 'table_fill': return {};
    case 'numeric': return { value: '', unit: '' };
    case 'math_calculation': return { work: '', result: '' };
    default: return '';
  }
}
export const initAnswers = (qs, variant) => Object.fromEntries(qs.map(q => [q.id, emptyAnswer(q.taskKind, V(q, variant))]));
export function isEmptyAns(kind, a, photo) {
  if (photo) return false;
  if (kindOf(kind) === 'sketch' || a === undefined || a === null) return true;
  if (kindOf(kind) === 'number_line') return !arr(a).some(x => Number.isFinite(num(x)));   // −1 ist ein gültiger Wert
  if (Array.isArray(a)) return !a.some(x => Array.isArray(x) || (x !== null && x !== undefined && x !== '' && x !== -1));
  if (typeof a === 'object') return !Object.values(a).some(x => str(x));
  return str(a) === '';
}
export const answered = (q, v, a, photo) => !isEmptyAns(q.taskKind, a, photo);

// Musterantwort in Antwort-Form (Selbsttests, Lösung anzeigen)
export function solutionAnswer(kind, v) {
  switch (kindOf(kind)) {
    case 'single_choice': return v.correctOption;
    case 'multi_select': return [...v.correctOptions];
    case 'text_select': return [...v.correct];
    case 'image_hotspot': return v.targets[0] ? [v.targets[0].x, v.targets[0].y] : null;
    case 'number_line': return [...v.points];
    case 'true_false': return v.statements.map(s => s.correct);
    case 'fill_blanks': return v.blanks.map(b => b.split('|')[0]);
    case 'label_image': return v.labels.map(b => b.split('|')[0]);
    case 'matching': return [...v.pairs];
    case 'categorize': return [...v.itemGroup];
    case 'ordering': return v.items.map((_, i) => i);
    case 'table_fill': return Object.fromEntries(tableGaps(v).map(([i, j]) => [`${i},${j}`, String(v.solution[i][j]).split('|')[0]]));
    case 'graph_plot': return v.points.length ? v.points.map(p => [...p]) : v.line ? [[0, v.line.q], [2, v.line.m * 2 + v.line.q]] : [];
    case 'numeric': return { value: v.correctAnswer, unit: v.unit };
    case 'math_calculation': return { work: v.stepByStepSolution, result: v.correctAnswer };
    default: return v.correctAnswer;
  }
}
// Schülerantwort als Text für die KI
function ansText(kind, v, a) {
  const L = arr(a);
  switch (kindOf(kind)) {
    case 'single_choice': return v.options[idx(a, v.options.length)] ?? '';
    case 'multi_select': return L.map(i => v.options[i]).filter(Boolean).join(' | ');
    case 'number_line': return `Eingezeichnet: ${L.map(num).filter(Number.isFinite).map(fmtNum).join(', ') || 'nichts'}`;
    case 'image_hotspot': return L.length >= 2 ? `Angetippt bei (${num(L[0])} | ${num(L[1])}) von 1000${(r => r ? ` – nächste Stelle: ${r.label || '?'}` : '')(v.regions.slice().sort((p, q) => Math.hypot(p.x - L[0], p.y - L[1]) - Math.hypot(q.x - L[0], q.y - L[1]))[0])}` : '';
    case 'text_select': return `Markiert: ${L.map(i => `${v.tokens[i]} (#${i})`).filter(Boolean).join(', ') || 'nichts'}`;
    case 'true_false': return v.statements.map((s, i) => `${s.text}: ${(t => t === true ? 'richtig' : t === false ? 'falsch' : t === 'ng' ? 'nicht im Text' : 'offen')(tfVal(L[i]))}`).join('\n');
    case 'fill_blanks': return L.map((x, i) => `Lücke ${i + 1}: ${str(x)}`).join('\n');
    case 'label_image': return L.map((x, i) => `Marker ${i + 1}: ${str(x)}`).join('\n');
    case 'table_fill': return tableGaps(v).map(([i, j]) => `Zeile ${i + 1}, ${v.columns[j] || `Spalte ${j + 1}`}: ${str(obj(a)[`${i},${j}`])}`).join('\n');
    case 'matching': return v.left.map((l, i) => `${l} → ${v.right[L[i]] ?? 'offen'}`).join('\n');
    case 'categorize': return v.items.map((t, i) => `${t} → ${v.groups[L[i]] ?? 'offen'}`).join('\n');
    case 'ordering': return L.map(i => v.items[i]).join(' → ');
    case 'graph_plot': return L.map(p => `(${arr(p)[0]} | ${arr(p)[1]})`).join(' ');
    case 'numeric': return typeof a === 'object' ? `${str(obj(a).value)} ${str(obj(a).unit)}`.trim() : str(a);
    case 'code': return `Code${v.language ? ` (${v.language})` : ''}:\n${typeof a === 'string' ? a : ''}`;
    case 'math_calculation': return typeof a === 'object' ? `Rechenweg:\n${str(obj(a).work)}\nResultat: ${str(obj(a).result)}` : str(a);
    default: return str(a);
  }
}
function gapGrade(given, sols, max, what) {
  const n = sols.length, ok = sols.map((s, i) => !!str(given[i]) && textEq(given[i], s)), hit = ok.filter(Boolean).length;
  return { points: part(n ? hit / n : 0, max), feedback: hit === n ? `Alle ${what} richtig.` : `${hit} von ${n} ${what} richtig.`, open: ok.some((x, i) => !x && !!str(given[i])) };
}
// Kprim: alle richtig = voll, einer falsch = halb, sonst 0 · Hinweis zur Wertung im Feedback
const kprim = (right, n, max) => right >= n ? max : right === n - 1 ? floorHalf(max / 2) : 0;
const scoreNote = sc => sc === 'all_or_nothing' ? ' Wertung: nur ganz richtig zählt.' : sc === 'kprim' ? ' Wertung Kprim: 1 Fehler = halbe Punkte, mehr = 0.' : sc === 'minus' ? ' Wertung: falsche Antworten geben Abzug.' : '';
const lis = seq => { const t = []; for (const x of seq) { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m + 1; else hi = m; } t[lo] = x; } return t.length; };
// Automatische Bewertung → { points, feedback } · { …, open: true } (KI prüft Rest, nie weniger) · null (KI bewertet)
export function autoGrade(kind0, v, a, max) {
  const kind = kindOf(kind0) || kind0, L = arr(a), full = (fb = 'Richtig gelöst.') => ({ points: max, feedback: fb });
  if (isEmptyAns(kind, a)) return { points: 0, feedback: 'Nicht beantwortet.' };
  if (v.noKey && KIND[kind]?.auto) return null;
  switch (kind) {
    case 'single_choice': { const ok = idx(a, v.options.length) === v.correctOption; return ok ? full() : { points: 0, feedback: `Richtig wäre: ${v.options[v.correctOption]}` }; }
    case 'multi_select': {
      const ch = new Set(L.map(x => idx(x, v.options.length)).filter(i => i >= 0)), c = new Set(v.correctOptions); let hit = 0, wrong = 0; ch.forEach(i => c.has(i) ? hit++ : wrong++);
      const sc = v.scoring, n = v.options.length, judged = v.options.filter((_, i) => ch.has(i) === c.has(i)).length;
      const p = sc === 'all_or_nothing' ? (hit === c.size && !wrong ? max : 0) : sc === 'kprim' ? kprim(judged, n, max) : part((hit - wrong) / c.size, max);
      return { points: p, feedback: p === max ? 'Alle richtigen Optionen gewählt.' : `${hit} von ${c.size} richtigen Optionen${wrong ? `, ${wrong} falsch angekreuzt` : ''}.${scoreNote(sc)}` };
    }
    case 'number_line': {
      const pts = [...new Set(L.map(num).filter(Number.isFinite))], tol = v.step / 2 + 1e-9, used = new Set(); let hit = 0;
      if (!pts.length) return { points: 0, feedback: 'Keine Werte eingezeichnet.' };
      for (const p of v.points) { const j = pts.findIndex((q, i) => !used.has(i) && Math.abs(q - p) <= tol); if (j >= 0) { used.add(j); hit++; } }
      const extra = pts.length - used.size, pp = part((hit - 0.5 * extra) / v.points.length, max);
      return { points: pp, feedback: pp === max ? 'Alle Werte richtig eingezeichnet.' : `${hit} von ${v.points.length} Werten richtig${extra ? `, ${extra} zu viel` : ''}. Richtig: ${keyText('number_line', v)}` };
    }
    case 'image_hotspot': {
      const p = L.length >= 2 ? [num(L[0]), num(L[1])] : null; if (!p || !p.every(Number.isFinite)) return { points: 0, feedback: 'Keine Stelle angetippt.' };
      const hit = v.targets.some(t => Math.hypot(p[0] - t.x, p[1] - t.y) <= t.r * 1.15 + 10);
      return hit ? full('Richtige Stelle angetippt.') : { points: 0, feedback: `Nicht die gesuchte Stelle. Richtig wäre: ${keyText('image_hotspot', v)}` };
    }
    case 'text_select': {
      const n = v.tokens.length, ch = new Set(L.map(x => idx(x, n)).filter(i => i >= 0)), c = new Set(v.correct); let hit = 0, wrong = 0; ch.forEach(i => c.has(i) ? hit++ : wrong++);
      const p = part((hit - wrong) / c.size, max);
      return { points: p, feedback: p === max ? 'Alles richtig markiert.' : `${hit} von ${c.size} richtig markiert${wrong ? `, ${wrong} falsch markiert` : ''}.` };
    }
    case 'true_false': {
      const n = v.statements.length, hit = v.statements.filter((s, i) => tfVal(L[i]) === s.correct).length, wrong = v.statements.filter((s, i) => tfVal(L[i]) !== null && tfVal(L[i]) !== s.correct).length, sc = v.scoring;
      const p = sc === 'all_or_nothing' ? (hit === n ? max : 0) : sc === 'kprim' ? kprim(hit, n, max) : sc === 'minus' ? part((hit - wrong) / n, max) : part(hit / n, max);
      return { points: p, feedback: hit === n ? 'Alle Aussagen richtig beurteilt.' : `${hit} von ${n} Aussagen richtig beurteilt${sc === 'minus' && wrong ? `, ${wrong} falsch` : ''}.${scoreNote(sc)}` };
    }
    case 'fill_blanks': return gapGrade(L, v.blanks, max, 'Lücken');
    case 'label_image': return gapGrade(L, v.labels, max, 'Beschriftungen');
    case 'table_fill': { const g = tableGaps(v); return gapGrade(g.map(([i, j]) => obj(a)[`${i},${j}`]), g.map(([i, j]) => v.solution[i][j]), max, 'Zellen'); }
    case 'matching': { const n = v.left.length, hit = v.pairs.filter((p, i) => idx(L[i], v.right.length) === p).length; return { points: part(hit / n, max), feedback: hit === n ? 'Alle Paare richtig.' : `${hit} von ${n} Paaren richtig.` }; }
    case 'categorize': { const n = v.items.length, hit = v.itemGroup.filter((g, i) => idx(L[i], v.groups.length) === g).length; return { points: part(hit / n, max), feedback: hit === n ? 'Alles richtig zugeordnet.' : `${hit} von ${n} Begriffen richtig zugeordnet.` }; }
    case 'ordering': {
      const n = v.items.length, seq = L.map(Number);
      if (seq.length !== n || new Set(seq).size !== n || seq.some(i => !(i >= 0 && i < n))) return { points: 0, feedback: 'Reihenfolge unvollständig.' };
      const l = lis(seq), p = part(n > 1 ? (l - 1) / (n - 1) : 1, max);
      return { points: p, feedback: p === max ? 'Reihenfolge stimmt.' : `${l} von ${n} Elementen stehen in der richtigen Abfolge. Richtig: ${v.items.join(' → ')}` };
    }
    case 'numeric': {
      const o = typeof a === 'object' ? obj(a) : { value: a }, p = parseNum(o.value), c = Number(v.correctAnswer), u = str(o.unit) || p.rest;
      if (!Number.isFinite(p.n)) return { points: 0, feedback: 'Keine Zahl erkannt.' };
      const tol = Number.isInteger(c) && v.tolerance === 0.01 ? 1e-9 : Math.max(1e-6, Math.abs(c) * v.tolerance);   // ganze Zahlen (Jahre, Stück) exakt
      const ok = Math.abs(p.n - c) <= tol, uOk = !v.unit || unitEq(u, v.unit);
      if (ok && uOk) return full();
      if (ok) return { points: floorHalf(max / 2), feedback: `Zahl richtig, Einheit fehlt oder falsch (richtig: ${v.unit}).` };
      return { points: 0, feedback: `Richtig wäre: ${keyText('numeric', v)}` };
    }
    case 'graph_plot': {
      const pts = L.filter(Array.isArray).map(p => [num(p[0]), num(p[1])]).filter(p => p.every(Number.isFinite)), tol = (v.axes?.step || 1) * 0.26, n = pts.length;
      if (!n) return { points: 0, feedback: 'Keine Punkte gesetzt.' };
      if (v.line) {
        const on = pts.filter(([x, y]) => Math.abs(y - (v.line.m * x + v.line.q)) <= tol).length;
        if (on >= 2 && on === n) return full('Gerade richtig eingezeichnet.');
        return { points: part(Math.min(on, 2) / 2 * (on / n), max), feedback: `${on} von ${n} Punkten liegen auf der Geraden ${keyText('graph_plot', v)}.` };
      }
      const near = (p, q) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
      const hit = v.points.filter(p => pts.some(q => near(p, q))).length, extra = pts.filter(q => !v.points.some(p => near(p, q))).length;
      return { points: part((hit - 0.5 * extra) / v.points.length, max), feedback: hit === v.points.length && !extra ? 'Alle Punkte richtig.' : `${hit} von ${v.points.length} Punkten richtig${extra ? `, ${extra} zu viel` : ''}.` };
    }
    case 'short_answer': return v.correctAnswer && textEq(a, v.correctAnswer) ? full('Richtig.') : null;
    case 'formula': return v.correctAnswer && formulaEq(a, v.correctAnswer) ? full('Formel richtig.') : null;
    case 'code': return v.correctAnswer && typeof a === 'string' && codeEq(a, v.correctAnswer, v.language) ? full('Code stimmt mit der Musterlösung überein.') : null;
    default: return null;   // Rechnen, Freitext, Skizze → KI
  }
}

export async function gradeAnswers(doc, qs, variant, ans = {}, photos = {}, hints = {}) {
  const out = {}, open = [];
  for (const q of qs) {
    const v = V(q, variant), kind = kindOf(q.taskKind) || 'short_answer', ph = photos[q.id];
    const a = kind === 'code' && v.starter && normCode(ans[q.id]) === normCode(v.starter) ? '' : ans[q.id];   // unveränderter Vorgabecode = leer
    if (isEmptyAns(kind, a, ph)) { out[q.id] = { points: 0, feedback: 'Nicht beantwortet.', auto: true }; continue; }
    if (+hints[q.id] >= 4) { out[q.id] = { points: 0, feedback: 'Lösung vor dem Abgeben angesehen.', auto: true }; continue; }   // spart die KI
    const r = ph && !KIND[kind].auto ? null : autoGrade(kind, v, a, q.maxPoints);   // Foto einer Lösung → immer KI
    if (r && !r.open) out[q.id] = { points: r.points, feedback: r.feedback, auto: true }; else open.push({ q, v, kind, auto: r });
  }
  if (open.length) {
    if (!hasKey() || doc.source === 'demo') open.forEach(o => { out[o.q.id] = o.auto ? { points: o.auto.points, feedback: o.auto.feedback, auto: true } : demoGrade(o.q, o.v, ans[o.q.id], photos[o.q.id]); });
    else for (const b of batches(open, 6)) {
      const content = [];
      for (const { q } of b) if (photos[q.id]) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await forAI(photos[q.id]) } }, { type: 'text', text: `↑ Schülerlösung (Bild) zu Aufgabe ${q.id}` });
      content.push({ type: 'text', text: matPayload(doc, b.map(o => o.q)).trim() + '\n' + JSON.stringify(b.map(({ q, v, kind, auto }) => ({ id: q.id, typ: kind, maxPoints: q.maxPoints, aufgabe: v.text, material: matOf(doc, q)?.label, abbildungsDaten: v.figureData || undefined, ...structOf(kind, v),
        rubric: v.rubricCriteria, loesung: keyText(kind, v), musterloesung: v.stepByStepSolution || undefined, schuelerantwort: ansText(kind, v, ans[q.id]) || (photos[q.id] ? '(siehe Bild)' : ''), auto: auto ? auto.points : undefined }))) });
      const r = arr(obj(parseJSON(await ai({ kind: 'studio', effort: 'high', maxTokens: 4000, keepLang: true, system: GRADE_PROMPT, messages: [{ role: 'user', content }] }))).results);
      b.forEach(({ q, auto }, k) => {
        const x = obj(r.find(y => y?.id === q.id) || (r.length === b.length && !r[k]?.id ? r[k] : null)); let p = Math.max(0, Math.min(q.maxPoints, halfPts(num(x.points) || 0)));
        if (auto) p = Math.max(p, auto.points);
        out[q.id] = { points: p, feedback: str(x.feedback) || auto?.feedback || 'Bewertet.', auto: false };
      });
    }
  }
  for (const q of qs) {   // Lernhinweis-Abzug
    const r = out[q.id]; if (!r) continue;
    const lvl = Math.max(0, Math.min(4, +hints[q.id] || 0));
    r.raw = r.points; r.hint = lvl; r.points = applyHints(r.points, q.maxPoints, lvl);
    if (lvl) r.feedback = `${r.feedback} ${lvl >= 4 ? 'Lösung angesehen – 0 P.' : `Lernhinweis ${lvl} benutzt: −${Math.round(hintPenalty(lvl) * 100)} %.`}`;
  }
  return out;
}
export function recordAttempt({ doc, variant, mode, results, minutes, leaves, start, country = 'CH', hints = {}, ans = {}, photos = {} }) {
  const max = doc.questions.reduce((s, q) => s + q.maxPoints, 0), earned = halfPts(Object.values(results).reduce((s, r) => s + (Number(r.points) || 0), 0));
  const grade = swissGrade(earned, max), honest = leaves === 0, c = ['CH', 'DE', 'AT'].includes(country) ? country : 'CH';
  const att = { id: uid(), docId: doc.id, ts: Date.now(), variant, mode: mode || (variant === 'remix' ? 'remix' : 'original'), minutes, leaves, honest, earned, max, grade, country: c, gradeLocal: gradeFor(c, earned, max),
    hintsUsed: Object.values(hints).filter(x => +x > 0).length, results, ans: JSON.parse(JSON.stringify(ans || {})), hints: { ...hints },
    photos: Object.fromEntries(doc.questions.filter(q => kindOf(q.taskKind) === 'sketch' && photos[q.id]).map(q => [q.id, photos[q.id]])) };   // nur Skizzen (Speicherplatz)
  studioData().attempts.push(att); studioData().attempts = studioData().attempts.slice(-80);
  studioData().attempts.slice(0, -3).forEach(t => { if (t.photos && Object.keys(t.photos).length) t.photos = {}; });   // Skizzen nur in den letzten 3 Versuchen
  S.exams = [...(S.exams || []), { id: att.id, ts: att.ts, typeId: 'studio', subjectId: doc.subjectId, title: doc.title, grade, pct: max ? earned / max : 0, earned, max }].slice(-50);
  if (grade >= 5.5) S.stats.exam55 = (S.stats.exam55 || 0) + 1;
  if (grade >= 6) S.stats.exam6 = (S.stats.exam6 || 0) + 1;
  S.stats.examBest = Math.max(S.stats.examBest || 0, grade);
  let session = null;
  if (minutes >= 1 && doc.subjectId) {
    const end = Date.now(), s0 = start || end - minutes * 60000;
    session = { id: uid(), subjectId: doc.subjectId, start: s0, end, min: minutes, mode: 'exam', segments: [[s0, end]], pomos: 0, checkins: 0, xp: honest ? minutes * 2 : minutes, title: `Exam Studio: ${doc.title}`.slice(0, 80), note: `Note ${grade.toFixed(1)}`, goalHit: false };
    S.sessions.push(session);
  }
  save();
  return { att, session };
}

/* =========================================================================================
   5) PRÜFUNGSUMGEBUNG: Timer (Countdown/Stoppuhr), Verlassen zählen, sicherer Taschenrechner
   ========================================================================================= */
export function runStart(a) { a.run = { t0: Date.now(), acc: 0, paused: false, leaves: 0, start: Date.now() }; }
export const runElapsed = r => r ? r.acc + (r.paused ? 0 : Date.now() - r.t0) : 0;
export function runPause(r) { if (r && !r.paused) { r.acc += Date.now() - r.t0; r.paused = true; } }
export function runResume(r) { if (r && r.paused) { r.t0 = Date.now(); r.paused = false; } }
export const fmtRun = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
// Timer: min > 0 → Countdown, 0 → Stoppuhr
export function timerStart(a, min) { const m = Math.max(0, Number(min) || 0); a.timer = { mode: m > 0 ? 'down' : 'up', limitMs: m * 60000, t0: Date.now(), acc: 0, paused: false }; return a.timer; }
const timerElapsed = t => t ? t.acc + (t.paused ? 0 : Date.now() - t.t0) : 0;
export const timerLeft = t => !t ? 0 : t.mode === 'down' ? Math.max(0, t.limitMs - timerElapsed(t)) : timerElapsed(t);
export function timerPause(t) { if (t && !t.paused) { t.acc += Date.now() - t.t0; t.paused = true; } return t; }
export function timerResume(t) { if (t && t.paused) { t.t0 = Date.now(); t.paused = false; } return t; }
export const fmtClock = ms => { const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p = n => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`; };
export const clockText = t => !t ? '' : fmtClock(t.mode === 'down' ? Math.ceil(timerLeft(t) / 1000) * 1000 : timerLeft(t));
// Prüfungsteile: aktiver Teil = Teil der aktiven Aufgabe; Teilzeit läuft nur im aktiven Teil
export const partOfQ = (doc, q) => q?.partId ? arr(doc?.parts).find(p => p?.id === q.partId) || null : null;
export function curPart(doc, a) { if (!arr(doc?.parts).length) return null; return partOfQ(doc, orderedQs(doc, a?.order)[a?.qi || 0]); }
export const calcAllowed = (doc, a) => { const p = curPart(doc, a); return hasCalc(p && Array.isArray(p.tools) ? { tools: p.tools } : doc); };
export function partStart(a, pid) { a.partRun = { cur: pid || null, t0: Date.now(), spent: {}, warned: {}, paused: false }; return a.partRun; }
export function partSwitch(a, pid) { const r = a?.partRun; if (!r || r.cur === (pid || null)) return; if (r.cur && !r.paused) r.spent[r.cur] = (r.spent[r.cur] || 0) + Date.now() - r.t0; r.cur = pid || null; r.t0 = Date.now(); }
export function partPause(a) { const r = a?.partRun; if (r && !r.paused) { if (r.cur) r.spent[r.cur] = (r.spent[r.cur] || 0) + Date.now() - r.t0; r.paused = true; } }
export function partResume(a) { const r = a?.partRun; if (r?.paused) { r.t0 = Date.now(); r.paused = false; } }
export const partSpent = (a, pid) => { const r = a?.partRun; if (!r || !pid) return 0; return (r.spent[pid] || 0) + (r.cur === pid && !r.paused ? Date.now() - r.t0 : 0); };
export const partLeft = (a, p) => p?.timeLimitMin > 0 ? Math.max(0, p.timeLimitMin * 60000 - partSpent(a, p.id)) : null;
export const partClock = (a, p) => { const l = partLeft(a, p); return l === null ? '' : fmtClock(Math.ceil(l / 1000) * 1000); };
export const partShort = p => String(p?.title || '').split(/\s[–:-]\s|,|\(/)[0].trim().slice(0, 18) || 'Teil';
// Verlassen der App pausiert nicht, wird aber gezählt (einmal pro Verlassen)
let hooked = false, away = false;
export function hookAntiCheat(onLeave) {
  if (hooked) return; hooked = true;
  const leave = () => { const a = U.ai; if (away || a?.tool !== 'exam' || a.phase !== 'run' || !a.run) return; away = true; a.run.leaves++; onLeave?.(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else away = false; });
  window.addEventListener('blur', () => { if (!window.Capacitor?.isNativePlatform?.()) leave(); });
  window.addEventListener('focus', () => { away = false; });
}
// Kein eval: rekursiver Parser für + − × ÷ ^ ( ) √ π %
export function calcEval(expr) {
  const s = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, `(${Math.PI})`).replace(/,/g, '.').replace(/\s+/g, '');
  if (!s) throw new Error('Leer');
  let i = 0;
  const eat = c => { if (s[i] === c) { i++; return true; } return false; };
  const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw new Error('Ungültige Eingabe'); i += m[0].length; return parseFloat(m[0]); };
  const factor = () => {
    if (eat('-')) return -factor();
    if (eat('+')) return factor();
    if (eat('√')) return Math.sqrt(factor());
    let v;
    if (eat('(')) { v = sum(); if (!eat(')')) throw new Error('Klammer fehlt'); } else v = num();
    while (eat('%')) v /= 100;
    if (eat('^')) v = Math.pow(v, factor());
    return v;
  };
  const term = () => { let v = factor(); for (;;) { if (eat('*')) v *= factor(); else if (eat('/')) v /= factor(); else if (s[i] === '(' || s[i] === '√') v *= factor(); else return v; } };
  const sum = () => { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } };
  const v = sum(); if (i < s.length) throw new Error('Ungültige Eingabe');
  if (!Number.isFinite(v)) throw new Error('Nicht definiert');
  return Math.round(v * 1e10) / 1e10;
}

/* =========================================================================================
   6) DEMO-MODUS (ohne Server): 2 echte Testblätter mit allen 16 Bausteinen → Scan, Crop, Remix, Bewertung
   ========================================================================================= */
const DW = 1240, DH = 1754;
const FIG1 = { x0: 250, y0: 330, x1: 830, y1: 650 };   // Dreieck (Aufgabe 1, Seite 1)
const FIG2 = { x0: 280, y0: 330, x1: 900, y1: 610 };   // Pflanzenzelle (Aufgabe 9, Seite 2)
const CELL = { wall: [300, 470], nucleus: [520, 470], chloro: [735, 420] };
const figBox = (f, pageIndex, label) => ({ pageIndex, ymin: Math.round(f.y0 / DH * 1000), xmin: Math.round(f.x0 / DW * 1000), ymax: Math.round(f.y1 / DH * 1000), xmax: Math.round(f.x1 / DW * 1000), label });
// Marker relativ zum ausgeschnittenen Bild (Rahmen + Sicherheitsrand CROP_PAD)
const relCrop = ([x, y], f) => { const px = CROP_PAD / 1000 * DW, py = CROP_PAD / 1000 * DH; return { x: c1000((x - f.x0 + px) / (f.x1 - f.x0 + 2 * px) * 1000), y: c1000((y - f.y0 + py) / (f.y1 - f.y0 + 2 * py) * 1000) }; };
const DEMO_TASKS = [
  [['1', 4, ['Im rechtwinkligen Dreieck ABC gilt a = 6 cm und b = 8 cm.', 'Berechne die Hypotenuse c und den Flächeninhalt A.'], 'fig1'],
    ['2', 2, ['Welche binomische Umformung ist korrekt?', 'A (x + 3)² = x² + 9      B (x + 3)² = x² + 6x + 9', 'C (x + 3)² = x² + 3x + 9      D (x + 3)² = 2x + 6']],
    ['3', 3, ['Fixkosten 12 000 CHF, Preis 50 CHF, variable Kosten 30 CHF pro Stück.', 'Berechne die Gewinnschwelle (Break-even) in Stück.']],
    ['4', 3, ['Erkläre, warum Rabatte kurzfristig den Umsatz steigern können.']],
    ['5', 2, ['Was kommt nur in Pflanzenzellen vor? (mehrere richtig)', 'Zellwand · Chloroplasten · Mitochondrien · Zellkern · Zellmembran']],
    ['6', 2, ['Richtig oder falsch? a) Der Rhein mündet in die Nordsee.  b) Bern ist die grösste', 'Stadt der Schweiz.  c) Die Schweiz hat vier Landessprachen.  d) Der Genfersee', 'liegt vollständig auf Schweizer Gebiet.']],
    ['7', 3, ['Wasser besteht aus den Elementen ________ und ________.', 'Seine Summenformel lautet ________.']],
    ['8', 3, ['Ordne zu: 1291 · 1848 · 1971', 'Erste Bundesverfassung · Frauenstimmrecht (Bund) · Bundesbrief']]],
  [['9', 3, ['Beschrifte die Pflanzenzelle (1–3).', 'Wörter: Zellkern · Chloroplast · Zellwand · Mitochondrium'], 'fig2'],
    ['10', 2, ['Bringe die Phasen der Mitose in die richtige Reihenfolge:', 'Anaphase · Prophase · Telophase · Metaphase']],
    ['11', 1, ['English: Give the simple past of «to go».']],
    ['12', 2, ['Stelle die ausgeglichene Reaktionsgleichung für die Verbrennung', 'von Wasserstoff zu Wasser auf.']],
    ['13', 2, ['Zeichne einen Stromkreis mit Batterie, Schalter und Lampe (Schaltsymbole).']],
    ['14', 2, ['Fülle die Wertetabelle für y = 2x + 1 aus.', 'x:   −1   |   0   |   1   |   2          y:   ___ | ___ | ___ | ___']],
    ['15', 2, ['Zeichne die Gerade y = 0.5x + 1 ins Koordinatensystem (−5 bis 5).']],
    ['16', 3, ['Ordne den Aktiven oder Passiven zu: Kasse · Bankguthaben · Darlehensschuld ·', 'Eigenkapital · Mobiliar · Kreditoren']]],
];
export async function demoPage(n = 0) {
  const c = document.createElement('canvas'); c.width = DW; c.height = DH; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, DW, DH); x.fillStyle = '#111';
  if (n >= 2) { drawDemo2(x, n - 2); return { url: c.toDataURL('image/jpeg', 0.9), w: DW, h: DH, demo: true, demoPage: n }; }
  x.font = 'bold 40px Helvetica, Arial'; x.fillText(n ? 'Probeprüfung – Seite 2' : 'Gemischte Probeprüfung (Sek / BMS)', 90, 120);
  x.font = '26px Helvetica, Arial'; x.fillText(n ? 'Biologie · Englisch · Chemie · Physik · Mathematik · Rechnungswesen' : 'Hilfsmittel: Taschenrechner · Zeit: 45 min', 90, 168);
  let y = 250;
  for (const [no, pts, lines, fig] of DEMO_TASKS[n] || []) {
    x.fillStyle = '#111'; x.font = 'bold 28px Helvetica, Arial'; x.fillText(`${no}  (${pts} P)`, 90, y);
    x.font = '26px Helvetica, Arial'; lines.forEach((l, i) => x.fillText(l, 250, y + i * 38)); y += lines.length * 38;
    if (fig === 'fig1') {
      const f = FIG1; x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.moveTo(320, 600); x.lineTo(760, 600); x.lineTo(320, 370); x.closePath(); x.stroke(); x.strokeRect(320, 572, 28, 28);
      x.font = 'italic 28px Georgia'; x.fillText('a = 6 cm', f.x0 - 30, 500); x.fillText('b = 8 cm', 480, 640); x.fillText('c', 560, 470); x.fillText('C', 285, 630); x.fillText('A', 770, 620); x.fillText('B', 300, 360);   // rechter Winkel bei C
      y = f.y1 + 60;
    }
    if (fig === 'fig2') {
      x.strokeStyle = '#111'; x.lineWidth = 7; x.strokeRect(300, 360, 560, 220); x.lineWidth = 2; x.strokeRect(312, 372, 536, 196);
      x.beginPath(); x.arc(CELL.nucleus[0], CELL.nucleus[1], 52, 0, 7); x.stroke(); x.fillStyle = '#d9d9d9'; x.fill();
      x.fillStyle = '#2f8f46'; for (const [cx, cy] of [CELL.chloro, [770, 520], [660, 530]]) { x.beginPath(); x.ellipse(cx, cy, 34, 16, 0.3, 0, 7); x.fill(); }
      x.fillStyle = '#111'; x.font = 'bold 26px Helvetica, Arial';
      [[CELL.wall, [285, 470]], [CELL.nucleus, [520, 400]], [CELL.chloro, [735, 385]]].forEach(([, [tx, ty]], i) => x.fillText(String(i + 1), tx - 8, ty + 8));
      y = FIG2.y1 + 60;
    }
    y += 34;
  }
  x.fillStyle = '#1F4FD8'; x.font = 'italic 34px "Bradley Hand", cursive';
  if (n) { x.fillText('went', 900, 830); x.beginPath(); x.strokeStyle = '#1F4FD8'; x.lineWidth = 3; x.moveTo(900, 1000); x.lineTo(1080, 1060); x.stroke(); }
  else { x.fillText('c = 10 cm', 880, 420); x.fillText('600 Stk.', 960, 900); x.fillStyle = '#D92B2B'; x.font = 'bold 54px "Bradley Hand", cursive'; x.fillText('5.5', 1060, 130); }
  return { url: c.toDataURL('image/jpeg', 0.9), w: DW, h: DH, demo: true, demoPage: n };
}
export const demoMath = k => { const a = 3 * k, b = 4 * k, c = 5 * k; return { a, b, c, A: a * b / 2 }; };
export const demoBwl = k => { const F = 6000 * k, p = 40 + 10 * k, vc = 20 + 5 * k; return { F, p, vc, x: F / (p - vc) }; };
const ESSAYS = ['Erkläre, warum Rabatte kurzfristig den Umsatz steigern können.', 'Erkläre, warum ein Unternehmen trotz steigendem Umsatz Verlust machen kann.', 'Erkläre, warum eine Preiserhöhung den Gewinn steigern kann, obwohl weniger verkauft wird.', 'Erkläre, warum Werbung kurzfristig Kosten verursacht, langfristig aber Umsatz bringen kann.'];
export function demoQuestions(r) {
  const mR = demoMath(3 + (r % 4)), bR = demoBwl([2, 6, 8][r % 3]), flip = r % 2 === 1;
  const mk = (text, o) => ({ ...blankV(), text, ...o });
  const tm = 2 + (r % 3), tq = -(1 + (r % 2)), tx = [-1, 0, 1, 2], gq = 1 + (r % 3);
  const fmtN = v => String(v).replace('-', '−');
  return [
    { id: 'q1', questionNumber: '1', taskKind: 'math_calculation', maxPoints: 4, graphic: figBox(FIG1, 0, 'Rechtwinkliges Dreieck ABC'),
      o: mk('Im rechtwinkligen Dreieck ABC gilt a = 6 cm und b = 8 cm. Berechne die Hypotenuse c und den Flächeninhalt A.', { unit: 'cm', correctAnswer: 'c = 10 cm, A = 24 cm²', stepByStepSolution: 'c = √(6² + 8²) = √100 = 10 cm\nA = 6 · 8 / 2 = 24 cm²',
        hints: ['Welcher Satz verbindet die drei Seiten eines rechtwinkligen Dreiecks?', 'Satz des Pythagoras: c² = a² + b²; Fläche: A = a · b / 2.', 'c² = 36 + 64 – jetzt noch die Wurzel ziehen; A = 6 · 8 / 2.'], rubricCriteria: ['1 P: Pythagoras angesetzt', '1 P: c = 10 cm', '1 P: Flächenformel', '1 P: A = 24 cm² mit Einheit'] }),
      x: mk(`Rechne neu mit a = ${mR.a} cm und b = ${mR.b} cm (statt der Masse in der Abbildung). Berechne die Hypotenuse c und den Flächeninhalt A.`, { unit: 'cm', correctAnswer: `c = ${mR.c} cm, A = ${mR.A} cm²`, stepByStepSolution: `c = √(${mR.a}² + ${mR.b}²) = √${mR.c * mR.c} = ${mR.c} cm\nA = ${mR.a} · ${mR.b} / 2 = ${mR.A} cm²`,
        hints: ['Welcher Satz verbindet die drei Seiten eines rechtwinkligen Dreiecks?', 'Satz des Pythagoras: c² = a² + b²; A = a · b / 2.', `c² = ${mR.a * mR.a} + ${mR.b * mR.b} – jetzt noch die Wurzel ziehen; A = ${mR.a} · ${mR.b} / 2.`], rubricCriteria: ['1 P: Pythagoras angesetzt', `1 P: c = ${mR.c} cm`, '1 P: Flächenformel', `1 P: A = ${mR.A} cm² mit Einheit`], mutationExplanation: `Neue Katheten ${mR.a}/${mR.b} cm – rückwärts aus glattem c = ${mR.c} cm konstruiert.` }) },
    { id: 'q2', questionNumber: '2', taskKind: 'single_choice', maxPoints: 2, graphic: null,
      o: mk('Welche binomische Umformung ist korrekt?', { options: ['(x + 3)² = x² + 9', '(x + 3)² = x² + 6x + 9', '(x + 3)² = x² + 3x + 9', '(x + 3)² = 2x + 6'], correctOption: 1, correctAnswer: '(x + 3)² = x² + 6x + 9', stepByStepSolution: '(a + b)² = a² + 2ab + b²\n(x + 3)² = x² + 6x + 9',
        hints: ['Quadrieren heisst: (x + 3) · (x + 3) ausmultiplizieren.', 'Erste binomische Formel: (a + b)² = a² + 2ab + b².', 'Das Mittelglied ist 2 · x · 3 – welche Option hat genau dieses?'], rubricCriteria: ['2 P: richtige Option'] }),
      x: flip ? mk('Welche binomische Umformung ist korrekt?', { options: ['(x − 5)² = x² − 25', '(x − 5)² = x² − 10x + 25', '(x + 5)² = x² + 25', '(x − 5)² = x² + 10x − 25'], correctOption: 1, correctAnswer: '(x − 5)² = x² − 10x + 25', stepByStepSolution: '(a − b)² = a² − 2ab + b²\n(x − 5)² = x² − 10x + 25',
        hints: ['Achte auf das Vorzeichen des Mittelglieds.', 'Zweite binomische Formel: (a − b)² = a² − 2ab + b².', 'Das Mittelglied ist −2 · x · 5, das letzte Glied +25.'], rubricCriteria: ['2 P: richtige Option'], mutationExplanation: 'Neue Zahl, 2. binomische Formel, Optionen neu gemischt.' })
        : mk('Welche binomische Umformung ist FALSCH?', { options: ['(x − 4)² = x² − 8x + 16', '(x + 4)(x − 4) = x² − 16', '(x − 4)² = x² − 16', '(x + 4)² = x² + 8x + 16'], correctOption: 2, correctAnswer: '(x − 4)² = x² − 16', stepByStepSolution: '(x − 4)² = x² − 8x + 16\nBei «x² − 16» fehlt das Mittelglied −8x → falsch.',
          hints: ['Gesucht ist die FALSCHE Umformung.', 'Prüfe bei jeder Option, ob das Mittelglied 2·a·b vorkommt.', 'Nur bei (x + 4)(x − 4) fällt das Mittelglied weg – bei einem Quadrat nie.'], rubricCriteria: ['2 P: richtige Option'], mutationExplanation: 'Frage umgedreht («FALSCH»), neue Zahl, Optionen gemischt.' }) },
    { id: 'q3', questionNumber: '3', taskKind: 'numeric', maxPoints: 3, graphic: null,
      o: mk('Fixkosten 12 000 CHF, Verkaufspreis 50 CHF, variable Kosten 30 CHF pro Stück. Berechne die Gewinnschwelle (Break-even) in Stück.', { correctAnswer: '600', unit: 'Stück', stepByStepSolution: 'Deckungsbeitrag = 50 − 30 = 20 CHF\nBreak-even = 12 000 / 20 = 600 Stück',
        hints: ['Ab wann decken die Einnahmen alle Kosten?', 'Break-even-Menge = Fixkosten / Deckungsbeitrag pro Stück.', 'Der Deckungsbeitrag ist 50 − 30 = 20 CHF pro Stück.'], rubricCriteria: ['3 P: richtige Stückzahl mit Einheit'] }),
      x: mk(`Ein Velo-Shop hat Fixkosten von ${bR.F} CHF. Ein Velohelm kostet ${bR.p} CHF, die variablen Kosten betragen ${bR.vc} CHF pro Stück. Berechne die Gewinnschwelle in Stück.`, { correctAnswer: String(bR.x), unit: 'Stück', stepByStepSolution: `Deckungsbeitrag = ${bR.p} − ${bR.vc} = ${bR.p - bR.vc} CHF\nBreak-even = ${bR.F} / ${bR.p - bR.vc} = ${bR.x} Stück`,
        hints: ['Ab wann decken die Einnahmen alle Kosten?', 'Break-even-Menge = Fixkosten / Deckungsbeitrag pro Stück.', `Der Deckungsbeitrag ist ${bR.p} − ${bR.vc} = ${bR.p - bR.vc} CHF pro Stück.`], rubricCriteria: ['3 P: richtige Stückzahl mit Einheit'], mutationExplanation: 'Neuer Praxisfall mit glatter Gewinnschwelle (rückwärts konstruiert).' }) },
    { id: 'q4', questionNumber: '4', taskKind: 'essay_open_text', maxPoints: 3, graphic: null,
      o: mk(ESSAYS[0], { correctAnswer: 'Tiefere Preise erhöhen die Nachfrage (Preiselastizität); die Mehrmenge kann den Preisnachlass überkompensieren.', stepByStepSolution: 'These: Rabatt senkt den Preis → mehr Nachfrage.\nBegründung: Preiselastizität, neue Kundschaft, Lagerabbau.\nFazit: Umsatz steigt, wenn die Mehrmenge den Preisnachlass überwiegt.',
        hints: ['Denke an den Zusammenhang zwischen Preis und Nachfrage.', 'Umsatz = Preis × Menge: Was passiert mit der Menge, wenn der Preis sinkt?', 'Nenne den Fachbegriff Preiselastizität und die Bedingung, wann der Umsatz trotzdem steigt.'], rubricCriteria: ['1 P: These Preis ↓ → Nachfrage ↑', '1 P: Begründung mit Fachbegriff (Preiselastizität/Nachfrage)', '1 P: Bedingung/Fazit'] }),
      x: mk(ESSAYS[1 + (r % 3)], { correctAnswer: 'These, Begründung mit Fachbegriffen (Kosten, Umsatz, Gewinn, Nachfrage) und Fazit gemäss Teilpunkte-Schlüssel.', stepByStepSolution: 'These klar formulieren.\nMit Fachbegriffen (Kosten, Umsatz, Gewinn, Nachfrage) begründen.\nFazit mit Bedingung.',
        hints: ['Gewinn = Umsatz − Kosten: Welche Grösse verändert sich wie?', 'Gliedere: These – Begründung mit Fachbegriffen – Fazit.', 'Vergleiche die Veränderung des Umsatzes mit der Veränderung der Kosten.'], rubricCriteria: ['1 P: klare These', '1 P: Begründung mit Fachbegriffen', '1 P: Fazit/Bedingung'], mutationExplanation: 'Neue Fragestellung auf derselben Stufe mit denselben Kriterien.' }) },
    { id: 'q5', questionNumber: '5', taskKind: 'multi_select', maxPoints: 2, graphic: null,
      o: mk('Was kommt nur in Pflanzenzellen vor? (mehrere Antworten richtig)', { options: ['Zellwand', 'Chloroplasten', 'Mitochondrien', 'Zellkern', 'Zellmembran'], correctOptions: [0, 1], correctAnswer: 'Zellwand, Chloroplasten', stepByStepSolution: 'Tier- und Pflanzenzellen haben Zellkern, Mitochondrien und Zellmembran.\nNur Pflanzenzellen: Zellwand und Chloroplasten.',
        hints: ['Was braucht eine Pflanze, das ein Tier nicht braucht?', 'Denke an Fotosynthese und an die feste Form der Pflanzenzelle.', 'Zellkern, Mitochondrien und Zellmembran haben auch Tierzellen.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Welche Aussagen zur Fotosynthese treffen zu? (mehrere Antworten richtig)', { options: ['Sie setzt Sauerstoff frei.', 'Sie findet nur nachts statt.', 'Sie findet in den Chloroplasten statt.', 'Sie verbraucht Sauerstoff und setzt CO₂ frei.'], correctOptions: [0, 2], correctAnswer: 'Sie setzt Sauerstoff frei; sie findet in den Chloroplasten statt.', stepByStepSolution: 'Fotosynthese: CO₂ + Wasser + Licht → Traubenzucker + Sauerstoff.\nOrt: Chloroplasten, braucht Licht.',
        hints: ['Was braucht die Fotosynthese als Energiequelle?', 'Fotosynthese: CO₂ + Wasser + Licht → Traubenzucker + Sauerstoff.', 'Die Option mit «nachts» und die mit «verbraucht Sauerstoff» beschreiben etwas anderes.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neues Thema im selben Kapitel (Pflanzenzelle → Fotosynthese).' }) },
    { id: 'q6', questionNumber: '6', taskKind: 'true_false', maxPoints: 2, graphic: null,
      o: mk('Richtig oder falsch?', { statements: [{ text: 'Der Rhein mündet in die Nordsee.', correct: true }, { text: 'Bern ist die grösste Stadt der Schweiz.', correct: false }, { text: 'Die Schweiz hat vier Landessprachen.', correct: true }, { text: 'Der Genfersee liegt vollständig auf Schweizer Gebiet.', correct: false }],
        correctAnswer: 'richtig · falsch · richtig · falsch', stepByStepSolution: 'Rhein → Nordsee (Rotterdam): richtig.\nGrösste Stadt ist Zürich: falsch.\nDeutsch, Französisch, Italienisch, Rätoromanisch: richtig.\nDas Südufer des Genfersees gehört zu Frankreich: falsch.',
        hints: ['Denke an die Karte der Schweiz und ihrer Nachbarländer.', 'Bundesstadt ist nicht gleich grösste Stadt.', 'Das Südufer des Genfersees gehört zu Frankreich.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Richtig oder falsch?', { statements: [{ text: 'Der Gotthard-Basistunnel ist über 50 km lang.', correct: true }, { text: 'Zürich ist die Bundesstadt der Schweiz.', correct: false }, { text: 'Die Rhone fliesst ins Mittelmeer.', correct: true }, { text: 'Der höchste Berg der Schweiz ist das Matterhorn.', correct: false }],
        correctAnswer: 'richtig · falsch · richtig · falsch', stepByStepSolution: 'Gotthard-Basistunnel: 57 km – richtig.\nBundesstadt ist Bern – falsch.\nRhone → Mittelmeer – richtig.\nHöchster Berg: Dufourspitze (4634 m) – falsch.',
        hints: ['Denke an Verkehrswege, Flüsse und Berge der Schweiz.', 'Bundesstadt und grösste Stadt sind zwei verschiedene Städte.', 'Der höchste Gipfel liegt im Monte-Rosa-Massiv, nicht am Matterhorn.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Aussagen zur Geografie der Schweiz.' }) },
    { id: 'q7', questionNumber: '7', taskKind: 'fill_blanks', maxPoints: 3, graphic: null,
      o: mk('Wasser besteht aus den Elementen ___ und ___. Seine Summenformel lautet ___.', { blanks: ['Wasserstoff', 'Sauerstoff', 'H2O|H₂O'], correctAnswer: 'Wasserstoff · Sauerstoff · H₂O', stepByStepSolution: 'Ein Wassermolekül besteht aus 2 Wasserstoff-Atomen und 1 Sauerstoff-Atom.\nSummenformel: H₂O',
        hints: ['Ein Wassermolekül besteht aus zwei verschiedenen Elementen.', 'Ein Element ist ein Gas, das wir zum Atmen brauchen.', 'Das Molekül hat 2 H-Atome und 1 O-Atom.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Kochsalz besteht aus den Elementen ___ und ___. Seine Summenformel lautet ___.', { blanks: ['Natrium', 'Chlor', 'NaCl'], correctAnswer: 'Natrium · Chlor · NaCl', stepByStepSolution: 'Kochsalz ist Natriumchlorid.\nIonen Na⁺ und Cl⁻ im Verhältnis 1 : 1 → NaCl',
        hints: ['Der chemische Name von Kochsalz verrät beide Elemente.', 'Kochsalz heisst chemisch Natriumchlorid.', 'Ein Metall aus der 1. Hauptgruppe und ein Halogen im Verhältnis 1 : 1.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Anderer Stoff, gleiche Aufgabenart.' }) },
    { id: 'q8', questionNumber: '8', taskKind: 'matching', maxPoints: 3, graphic: null,
      o: mk('Ordne jedem Jahr das passende Ereignis der Schweizer Geschichte zu.', { left: ['1291', '1848', '1971'], right: ['Erste Bundesverfassung', 'Frauenstimmrecht auf Bundesebene', 'Bundesbrief'], pairs: [2, 0, 1], correctAnswer: '1291 → Bundesbrief · 1848 → Erste Bundesverfassung · 1971 → Frauenstimmrecht', stepByStepSolution: '1291: Bundesbrief (Gründungsmythos)\n1848: Bundesstaat mit erster Bundesverfassung\n1971: Frauenstimmrecht auf Bundesebene',
        hints: ['Ordne zuerst das älteste Ereignis zu.', 'Der Bundesstaat entstand nach dem Sonderbundskrieg (1847).', '1291 gehört zum Gründungsmythos der Eidgenossenschaft.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Ordne jedem Jahr das passende Ereignis der Schweizer Geschichte zu.', { left: ['1515', '1798', '2002'], right: ['Helvetische Republik', 'UNO-Beitritt der Schweiz', 'Schlacht bei Marignano'], pairs: [2, 0, 1], correctAnswer: '1515 → Marignano · 1798 → Helvetische Republik · 2002 → UNO-Beitritt', stepByStepSolution: '1515: Niederlage bei Marignano\n1798: Helvetische Republik (Napoleon)\n2002: UNO-Beitritt nach Volksabstimmung',
        hints: ['Ordne zuerst das jüngste Ereignis zu.', 'Napoleons Truppen gründeten Ende des 18. Jahrhunderts einen Einheitsstaat.', 'Marignano war eine Schlacht in Norditalien im 16. Jahrhundert.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Jahreszahlen, rechte Spalte neu gemischt.' }) },
    { id: 'q9', questionNumber: '9', taskKind: 'label_image', maxPoints: 3, graphic: figBox(FIG2, 1, 'Pflanzenzelle mit Markern 1–3'),
      o: mk('Beschrifte die Pflanzenzelle (Marker 1–3).', { markers: [relCrop(CELL.wall, FIG2), relCrop(CELL.nucleus, FIG2), relCrop(CELL.chloro, FIG2)], labels: ['Zellwand', 'Zellkern|Nukleus', 'Chloroplast|Chloroplasten'], wordBank: ['Zellkern', 'Chloroplast', 'Zellwand', 'Mitochondrium'], correctAnswer: '1: Zellwand · 2: Zellkern · 3: Chloroplast', stepByStepSolution: '1: dicke äussere Hülle = Zellwand\n2: grosser runder Körper = Zellkern\n3: grüne ovale Körperchen = Chloroplasten',
        hints: ['Beginne mit dem grössten runden Teil in der Mitte.', 'Grüne Körperchen haben etwas mit Fotosynthese zu tun.', 'Die dicke äussere Linie ist nicht die Membran, sondern die feste Hülle.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Beschrifte die Pflanzenzelle (Marker 1–3). Achtung: Die Wortliste enthält ein Wort zu viel.', { markers: [relCrop(CELL.wall, FIG2), relCrop(CELL.nucleus, FIG2), relCrop(CELL.chloro, FIG2)], labels: ['Zellwand', 'Zellkern|Nukleus', 'Chloroplast|Chloroplasten'], wordBank: ['Mitochondrium', 'Zellwand', 'Chloroplast', 'Zellkern'], correctAnswer: '1: Zellwand · 2: Zellkern · 3: Chloroplast', stepByStepSolution: '1: Zellwand\n2: Zellkern\n3: Chloroplast',
        hints: ['Beginne mit dem grössten runden Teil in der Mitte.', 'Grüne Körperchen haben etwas mit Fotosynthese zu tun.', 'Mitochondrium ist das überzählige Wort.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Gleiche Abbildung, Wortliste neu gemischt.' }) },
    { id: 'q10', questionNumber: '10', taskKind: 'ordering', maxPoints: 2, graphic: null,
      o: mk('Bringe die Phasen der Mitose in die richtige Reihenfolge.', { items: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'], correctAnswer: 'Prophase → Metaphase → Anaphase → Telophase', stepByStepSolution: 'Prophase: Chromosomen verdichten sich\nMetaphase: Anordnung in der Mitte\nAnaphase: Trennung der Chromatiden\nTelophase: zwei neue Kerne',
        hints: ['Die Namen verraten viel: «pro» = vor, «meta» = Mitte.', '«Ana» = auseinander, «Telo» = Ende.', 'Die Prophase steht am Anfang, die Telophase am Schluss.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Bringe die Stationen der Verdauung in die richtige Reihenfolge.', { items: ['Mund', 'Speiseröhre', 'Magen', 'Dünndarm', 'Dickdarm'], correctAnswer: 'Mund → Speiseröhre → Magen → Dünndarm → Dickdarm', stepByStepSolution: 'Mund (Zerkleinern) → Speiseröhre (Transport) → Magen (Säure) → Dünndarm (Aufnahme) → Dickdarm (Wasserentzug)',
        hints: ['Verfolge den Weg eines Bissens von oben nach unten.', 'Nach dem Mund kommt der Transport in den Magen.', 'Der Dünndarm kommt vor dem Dickdarm.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neuer Ablauf aus der Biologie.' }) },
    { id: 'q11', questionNumber: '11', taskKind: 'short_answer', maxPoints: 1, graphic: null,
      o: mk('English: Give the simple past of «to go».', { correctAnswer: 'went', stepByStepSolution: 'go – went – gone (irregular verb)\nwent', hints: ['«To go» is an irregular verb.', 'Think of the three forms: go – ? – gone.', 'It starts with «w» and has four letters.'], rubricCriteria: ['1 P: korrektes Resultat'] }),
      x: mk(`English: Give the simple past of «to ${flip ? 'buy' : 'take'}».`, { correctAnswer: flip ? 'bought' : 'took', stepByStepSolution: flip ? 'buy – bought – bought\nbought' : 'take – took – taken\ntook', hints: ['It is an irregular verb.', flip ? 'Think of: buy – ? – bought.' : 'Think of: take – ? – taken.', flip ? 'It rhymes with «thought».' : 'It rhymes with «book».'], rubricCriteria: ['1 P: korrektes Resultat'], mutationExplanation: 'Anderes unregelmässiges Verb.' }) },
    { id: 'q12', questionNumber: '12', taskKind: 'formula', maxPoints: 2, graphic: null,
      o: mk('Stelle die ausgeglichene Reaktionsgleichung für die Verbrennung von Wasserstoff zu Wasser auf.', { correctAnswer: '2 H₂ + O₂ → 2 H₂O', stepByStepSolution: 'H₂ + O₂ → H₂O (unausgeglichen)\nLinks 2 O, rechts 1 O → 2 H₂O\nDann 4 H rechts → 2 H₂\n2 H₂ + O₂ → 2 H₂O',
        hints: ['Wasserstoff und Sauerstoff kommen als zweiatomige Moleküle vor (H₂, O₂).', 'Zähle die O-Atome links und rechts und gleiche sie mit einem Faktor aus.', 'Rechts brauchst du 2 H₂O – wie viele H₂ braucht es dann links?'], rubricCriteria: ['1 P: richtige Formeln', '1 P: korrekt ausgeglichen'] }),
      x: mk('Stelle die ausgeglichene Reaktionsgleichung für die vollständige Verbrennung von Methan (CH₄) auf.', { correctAnswer: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O', stepByStepSolution: 'CH₄ + O₂ → CO₂ + H₂O\n4 H → 2 H₂O\nRechts 4 O → 2 O₂\nCH₄ + 2 O₂ → CO₂ + 2 H₂O',
        hints: ['Bei einer vollständigen Verbrennung entstehen CO₂ und H₂O.', 'Gleiche zuerst C, dann H, zuletzt O aus.', '4 H-Atome ergeben 2 H₂O; rechts sind dann 4 O-Atome.'], rubricCriteria: ['1 P: richtige Formeln', '1 P: korrekt ausgeglichen'], mutationExplanation: 'Anderer Brennstoff, gleiches Konzept.' }) },
    { id: 'q13', questionNumber: '13', taskKind: 'sketch', maxPoints: 2, graphic: null,
      o: mk('Zeichne einen geschlossenen Stromkreis mit Batterie, Schalter und Lampe (Schaltsymbole).', { correctAnswer: 'Geschlossener Kreis mit den Symbolen für Batterie, Schalter und Lampe in Serie.', stepByStepSolution: 'Batterie-Symbol (lange und kurze Linie)\nSchalter-Symbol in der Leitung\nLampe (Kreis mit Kreuz)\nalles zu einem geschlossenen Kreis verbinden',
        hints: ['Ein Stromkreis muss geschlossen sein.', 'Batterie: lange und kurze Linie; Lampe: Kreis mit Kreuz.', 'Zeichne ein Rechteck aus Leitungen und setze die drei Symbole hinein.'], rubricCriteria: ['1 P: alle drei Symbole korrekt', '1 P: geschlossener Kreis'] }),
      x: mk('Zeichne einen Stromkreis mit Batterie und zwei parallel geschalteten Lampen (Schaltsymbole).', { correctAnswer: 'Batterie, zwei Lampen in getrennten Zweigen (parallel), geschlossene Leitungen.', stepByStepSolution: 'Batterie-Symbol\nzwei Zweige, in jedem eine Lampe\nbeide Zweige an denselben Punkten verbunden',
        hints: ['Parallel heisst: jede Lampe hat einen eigenen Weg.', 'Zeichne zuerst einen Kreis mit Batterie, dann einen zweiten Zweig daneben.', 'Beide Lampen hängen direkt an denselben zwei Leitungen.'], rubricCriteria: ['1 P: Symbole korrekt', '1 P: Parallelschaltung richtig'], mutationExplanation: 'Parallel- statt Serienschaltung.' }) },
    { id: 'q14', questionNumber: '14', taskKind: 'table_fill', maxPoints: 2, graphic: null,
      o: mk('Fülle die Wertetabelle für y = 2x + 1 aus.', { columns: ['x', '−1', '0', '1', '2'], rows: [['y', null, null, null, null]], solution: [[null, '-1', '1', '3', '5']], correctAnswer: '−1 · 1 · 3 · 5', stepByStepSolution: 'x = −1: 2 · (−1) + 1 = −1\nx = 0: 1\nx = 1: 3\nx = 2: 5',
        hints: ['Setze jeden x-Wert in die Gleichung ein.', 'Rechne zuerst 2 · x, dann + 1.', 'Für x = 0 ergibt sich y = 1; jede Spalte nach rechts kommen 2 dazu.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk(`Fülle die Wertetabelle für y = ${tm}x − ${-tq} aus.`, { columns: ['x', ...tx.map(fmtN)], rows: [['y', null, null, null, null]], solution: [[null, ...tx.map(v => String(tm * v + tq))]], correctAnswer: tx.map(v => fmtN(tm * v + tq)).join(' · '), stepByStepSolution: tx.map(v => `x = ${fmtN(v)}: ${tm} · ${fmtN(v)} − ${-tq} = ${fmtN(tm * v + tq)}`).join('\n'),
        hints: ['Setze jeden x-Wert in die Gleichung ein.', `Rechne zuerst ${tm} · x, dann − ${-tq}.`, `Für x = 0 ergibt sich y = ${fmtN(tq)}; jede Spalte nach rechts kommen ${tm} dazu.`], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Steigung und neuer y-Achsenabschnitt.' }) },
    { id: 'q15', questionNumber: '15', taskKind: 'graph_plot', maxPoints: 2, graphic: null,
      o: mk('Zeichne die Gerade y = 0.5x + 1 ins Koordinatensystem (setze mindestens 2 Punkte).', { axes: { xmin: -5, xmax: 5, ymin: -5, ymax: 5, step: 1 }, points: [[0, 1], [2, 2]], line: { m: 0.5, q: 1 }, correctAnswer: 'Gerade durch (0 | 1) und (2 | 2)', stepByStepSolution: 'y-Achsenabschnitt: (0 | 1)\nSteigung 0.5: 2 nach rechts, 1 nach oben → (2 | 2)\nGerade durch beide Punkte',
        hints: ['Wo schneidet die Gerade die y-Achse?', 'Der y-Achsenabschnitt ist 1, die Steigung 0.5.', 'Ein Punkt ist (0 | 1); gehe 2 nach rechts und 1 nach oben.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk(`Zeichne die Gerade y = −x + ${gq} ins Koordinatensystem (setze mindestens 2 Punkte).`, { axes: { xmin: -5, xmax: 5, ymin: -5, ymax: 5, step: 1 }, points: [[0, gq], [gq, 0]], line: { m: -1, q: gq }, correctAnswer: `Gerade durch (0 | ${gq}) und (${gq} | 0)`, stepByStepSolution: `y-Achsenabschnitt: (0 | ${gq})\nSteigung −1: 1 nach rechts, 1 nach unten\nNullstelle (${gq} | 0)`,
        hints: ['Wo schneidet die Gerade die y-Achse?', `Der y-Achsenabschnitt ist ${gq}, die Steigung −1.`, `Ein Punkt ist (0 | ${gq}); gehe 1 nach rechts und 1 nach unten.`], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Gerade mit negativer Steigung.' }) },
    { id: 'q16', questionNumber: '16', taskKind: 'categorize', maxPoints: 3, graphic: null,
      o: mk('Ordne die Bilanzpositionen den Aktiven oder den Passiven zu.', { groups: ['Aktiven', 'Passiven'], items: ['Kasse', 'Bankguthaben', 'Darlehensschuld', 'Eigenkapital', 'Mobiliar', 'Kreditoren'], itemGroup: [0, 0, 1, 1, 0, 1], correctAnswer: 'Aktiven: Kasse, Bankguthaben, Mobiliar · Passiven: Darlehensschuld, Eigenkapital, Kreditoren', stepByStepSolution: 'Aktiven = Vermögen (Mittelverwendung): Kasse, Bankguthaben, Mobiliar\nPassiven = Kapital (Mittelherkunft): Darlehensschuld, Eigenkapital, Kreditoren',
        hints: ['Aktiven zeigen, was die Firma besitzt; Passiven, woher das Geld kommt.', 'Schulden und Eigenkapital stehen auf derselben Seite.', 'Kreditoren sind Schulden bei Lieferanten.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Ordne die Bilanzpositionen den Aktiven oder den Passiven zu.', { groups: ['Aktiven', 'Passiven'], items: ['Fahrzeuge', 'Hypothek', 'Debitoren', 'Aktienkapital', 'Vorräte', 'Bankschuld'], itemGroup: [0, 1, 0, 1, 0, 1], correctAnswer: 'Aktiven: Fahrzeuge, Debitoren, Vorräte · Passiven: Hypothek, Aktienkapital, Bankschuld', stepByStepSolution: 'Aktiven: Fahrzeuge, Debitoren (Forderungen), Vorräte\nPassiven: Hypothek, Aktienkapital, Bankschuld',
        hints: ['Aktiven zeigen, was die Firma besitzt; Passiven, woher das Geld kommt.', 'Debitoren sind Forderungen an Kunden – also Vermögen.', 'Hypothek und Bankschuld sind Fremdkapital.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Bilanzpositionen, gleiches Konzept.' }) },
  ];
}
// Beispiel 2 (Sprache & Informatik): gemeinsames Material, Prüfungsteile und die neuen Bausteine
export const DEMO2_MATS = [{ id: 'm1', label: 'M1', kind: 'Lesetext', title: 'Der Gotthard-Basistunnel', box: null, crop: null,
  text: 'Der Gotthard-Basistunnel wurde am 1. Juni 2016 eröffnet.\nMit 57 Kilometern ist er der längste Eisenbahntunnel der Welt.\nDie Bauarbeiten dauerten rund 17 Jahre.\nTäglich fahren viele Güterzüge und Personenzüge durch den Tunnel.\nWeil die Strecke fast flach ist, brauchen die Züge weniger Energie als auf der alten Bergstrecke.\nDie Reise von Zürich nach Lugano ist dadurch um etwa 30 Minuten kürzer geworden.' }];
const D2_ORDER = ['r1', 'r2', 'r10', 'r3', 'r4', 'r9', 'r6', 'r5', 'r8', 'r7'];   // Teil A (M1-Block zuerst), dann Teil B (Karte zuoberst auf Seite B)
export const demo2Questions = r => demo2Raw(r).sort((a, b) => D2_ORDER.indexOf(a.id) - D2_ORDER.indexOf(b.id));
function demo2Raw(r) {
  const mk = (text, o) => ({ ...blankV(), text, ...o }), flip = r % 2 === 1, selV = (t, o) => { const m = markedTokens(t); return { ...o, tokens: m.tokens, correct: m.idx, correctAnswer: m.idx.map(i => m.tokens[i]).join(' · ') }; }, sp = [{ min: 38, v: 90 }, { min: 57, v: 60 }, { min: 30, v: 114 }][r % 3];
  return [
    { id: 'r1', questionNumber: '1', taskKind: 'true_false', maxPoints: 3, mat: 'm1', part: 'p1',
      o: mk('Lies M1. Richtig, falsch oder steht es nicht im Text? (Falsche Antworten geben Abzug.)', { notGiven: true, scoring: 'minus', statements: [{ text: 'Der Tunnel wurde 2016 eröffnet.', correct: true }, { text: 'Durch den Tunnel fahren nur Personenzüge.', correct: false }, { text: 'Im Basistunnel brauchen die Züge weniger Energie als auf der Bergstrecke.', correct: true }, { text: 'Der Bau kostete über zehn Milliarden Franken.', correct: 'ng' }],
        correctAnswer: 'richtig · falsch · richtig · nicht im Text', stepByStepSolution: 'Zeile 1: eröffnet 2016 → richtig.\nZeile 4: Güter- UND Personenzüge → falsch.\nZeile 5: fast flach, weniger Energie → richtig.\nÜber die Kosten steht nichts in M1 → nicht im Text.',
        hints: ['Suche zu jeder Aussage die passende Zeile in M1.', 'Achte auf Wörter wie «nur» – steht das wirklich so im Text?', 'Zu einer Aussage findest du in M1 gar nichts.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig, Abzug bei Fehlern)'] }),
      x: mk('Lies M1. Richtig, falsch oder steht es nicht im Text? (Falsche Antworten geben Abzug.)', { notGiven: true, scoring: 'minus', statements: [{ text: 'Die Bauarbeiten dauerten rund 17 Jahre.', correct: true }, { text: 'Der Tunnel ist 75 Kilometer lang.', correct: false }, { text: 'Im Tunnel gibt es WLAN für die Reisenden.', correct: 'ng' }, { text: 'Die Reise nach Lugano dauert neu länger.', correct: false }],
        correctAnswer: 'richtig · falsch · nicht im Text · falsch', stepByStepSolution: 'Zeile 3: 17 Jahre → richtig.\nZeile 2: 57 km → falsch.\nÜber WLAN steht nichts → nicht im Text.\nZeile 6: 30 Minuten kürzer → falsch.',
        hints: ['Suche zu jeder Aussage die passende Zeile in M1.', 'Vergleiche Zahlen genau mit dem Text.', 'Zu einer Aussage findest du in M1 gar nichts.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig, Abzug bei Fehlern)'], mutationExplanation: 'Neue Aussagen zum selben Text.' }) },
    { id: 'r10', questionNumber: '3', taskKind: 'multi_select', maxPoints: 1, mat: 'm1', part: 'p1',
      o: mk('Kprim: Welche Aussagen stimmen laut M1? (4 richtig beurteilt = 1 P, 3 = ½ P)', { scoring: 'kprim', options: ['Der Tunnel ist 57 km lang.', 'Die Bauarbeiten dauerten 30 Jahre.', 'Die Strecke durch den Tunnel ist fast flach.', 'Der Tunnel wurde 2006 eröffnet.'], correctOptions: [0, 2], correctAnswer: 'Der Tunnel ist 57 km lang. · Die Strecke durch den Tunnel ist fast flach.',
        stepByStepSolution: 'Zeile 2: 57 km → stimmt.\nZeile 3: 17 Jahre, nicht 30 → falsch.\nZeile 5: fast flach → stimmt.\nZeile 1: 2016, nicht 2006 → falsch.', hints: ['Prüfe jede Aussage einzeln mit dem Text.', 'Vergleiche die Zahlen ganz genau.', 'Zwei der vier Aussagen haben eine falsche Zahl.'], rubricCriteria: ['1 P: Kprim (1 Fehler = ½ P)'] }),
      x: mk('Kprim: Welche Aussagen stimmen laut M1? (4 richtig beurteilt = 1 P, 3 = ½ P)', { scoring: 'kprim', options: ['Die Reise nach Lugano ist 30 Minuten kürzer.', 'Durch den Tunnel fahren nur Güterzüge.', 'Der Tunnel ist der längste Eisenbahntunnel der Welt.', 'Die alte Bergstrecke ist flacher.'], correctOptions: [0, 2], correctAnswer: 'Die Reise nach Lugano ist 30 Minuten kürzer. · Der Tunnel ist der längste Eisenbahntunnel der Welt.',
        stepByStepSolution: 'Zeile 6 → stimmt.\nZeile 4: Güter- und Personenzüge → falsch.\nZeile 2 → stimmt.\nZeile 5: der Tunnel ist flacher → falsch.', hints: ['Prüfe jede Aussage einzeln mit dem Text.', 'Achte auf Wörter wie «nur».', 'Zwei Aussagen verdrehen den Text.'], rubricCriteria: ['1 P: Kprim (1 Fehler = ½ P)'], mutationExplanation: 'Neue Aussagen zum selben Text.' }) },
    { id: 'r4', questionNumber: '5', taskKind: 'fill_blanks', maxPoints: 2, part: 'p1',
      o: mk('Wähle die richtige Verbform: Gestern ___ wir mit dem Zug nach Lugano. Die Fahrt ___ nur zwei Stunden.', { blankOptions: [['fahren', 'fuhren', 'gefahren'], ['dauert', 'dauerte', 'gedauert']], blanks: ['fuhren', 'dauerte'], correctAnswer: 'fuhren · dauerte',
        stepByStepSolution: '«Gestern» verlangt die Vergangenheit (Präteritum).\nwir fuhren · die Fahrt dauerte', hints: ['Welche Zeit verlangt «gestern»?', 'Gesucht ist das Präteritum (einfache Vergangenheit).', 'Das Partizip «gefahren» bräuchte ein Hilfsverb.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Wähle die richtige Verbform: Letztes Jahr ___ meine Klasse den Tunnel. Wir ___ viele Fotos.', { blankOptions: [['besucht', 'besuchte', 'besuchen'], ['machen', 'machten', 'gemacht']], blanks: ['besuchte', 'machten'], correctAnswer: 'besuchte · machten',
        stepByStepSolution: '«Letztes Jahr» verlangt das Präteritum.\nmeine Klasse besuchte · wir machten', hints: ['Welche Zeit verlangt «letztes Jahr»?', 'Gesucht ist das Präteritum.', 'Das Subjekt «meine Klasse» steht in der Einzahl.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Sätze, gleiche Zeitform.' }) },
    { id: 'r9', questionNumber: '6', taskKind: 'fill_blanks', maxPoints: 2, part: 'p1',
      o: mk('Setze die passenden Wörter aus der Wortliste ein (ein Wort ist zu viel): Der Tunnel verbindet den ___ der Schweiz mit dem Tessin. Er führt unter den ___ hindurch.', { wordBank: ['Alpen', 'Norden', 'Jura', 'Rhein'].sort(), blanks: ['Norden', 'Alpen'], correctAnswer: 'Norden · Alpen',
        stepByStepSolution: 'Das Tessin liegt im Süden → der Tunnel verbindet den Norden mit dem Tessin.\nEr führt unter den Alpen hindurch.', hints: ['Wo liegt das Tessin?', 'Der Gotthard ist ein Gebirge in den …', 'Jura und Rhein passen nicht.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk('Setze die passenden Wörter aus der Wortliste ein (ein Wort ist zu viel): Der Gotthard liegt in den ___. Südlich davon spricht man ___.', { wordBank: ['Alpen', 'Italienisch', 'Französisch', 'Voralpen'], blanks: ['Alpen', 'Italienisch'], correctAnswer: 'Alpen · Italienisch',
        stepByStepSolution: 'Der Gotthard ist ein Alpenpass.\nIm Tessin spricht man Italienisch.', hints: ['Welches Gebirge ist gemeint?', 'Welche Sprache spricht man im Tessin?', 'Französisch spricht man im Westen.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Sätze, neue Wortliste.' }) },
    { id: 'r2', questionNumber: '2', taskKind: 'single_choice', maxPoints: 1, mat: 'm1', part: 'p1',
      o: mk('Warum ist die Reise von Zürich nach Lugano kürzer geworden?', { options: ['Die Züge fahren durch den Tunnel statt über die Bergstrecke.', 'Die Züge halten nicht mehr in Zürich.', 'Lugano hat einen neuen Bahnhof.', 'Die Züge fahren nachts.'], correctOption: 0, correctAnswer: 'Die Züge fahren durch den Tunnel statt über die Bergstrecke.', stepByStepSolution: 'Zeilen 5–6: Die flache Tunnelstrecke ersetzt die Bergstrecke → 30 Minuten kürzer.',
        hints: ['Lies die letzten zwei Zeilen von M1.', 'Was hat sich an der Strecke geändert?', 'Die alte Strecke führte über den Berg.'], rubricCriteria: ['1 P: richtige Option'] }),
      x: mk(flip ? 'Wie lange dauerten die Bauarbeiten?' : 'Wie lang ist der Gotthard-Basistunnel?', flip ? { options: ['rund 30 Jahre', 'rund 17 Jahre', 'rund 57 Jahre', 'rund 6 Jahre'], correctOption: 1, correctAnswer: 'rund 17 Jahre', stepByStepSolution: 'Zeile 3: rund 17 Jahre.',
        hints: ['Suche im Text nach «Jahre».', 'Die Bauzeit steht in Zeile 3.', 'Die Zahl ist kleiner als 20.'], rubricCriteria: ['1 P: richtige Option'], mutationExplanation: 'Neue Frage zum selben Text.' }
        : { options: ['17 km', '30 km', '57 km', '260 km'], correctOption: 2, correctAnswer: '57 km', stepByStepSolution: 'Zeile 2: 57 Kilometer.',
          hints: ['Suche im Text nach «Kilometer».', 'Die Länge steht in Zeile 2.', 'Die Zahl liegt zwischen 50 und 60.'], rubricCriteria: ['1 P: richtige Option'], mutationExplanation: 'Neue Frage zum selben Text.' }) },
    { id: 'r3', questionNumber: '4', taskKind: 'text_select', maxPoints: 3, part: 'p1',
      o: mk('Markiere die drei Rechtschreibfehler.', selV('Am Wochenende fuhren wir mit dem Zug durch den Tunnel nach Lugano. Die Fahrt war sehr [[schnel]] und wir hatten viel [[spass]]. Am Abend assen wir eine Pizza und gingen [[dan]] ins Hotel.', {
        stepByStepSolution: 'schnel → schnell (Doppel-l)\nspass → Spass (Nomen gross)\ndan → dann (Doppel-n)', hints: ['Lies langsam Wort für Wort.', 'Achte auf doppelte Mitlaute und auf die Grossschreibung von Nomen.', 'Ein Fehler steckt im Wort, das «rasch» bedeutet.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'] })),
      x: mk('Markiere die drei Rechtschreibfehler.', selV('Letzten Sommer besuchten wir das Verkehrshaus in Luzern. Dort sahen wir alte [[Lokomotieven]] und ein grosses Modell vom Tunnel. Meine Schwester fand die [[Ausstelung]] toll, aber ich war am [[ende]] müde.', {
        stepByStepSolution: 'Lokomotieven → Lokomotiven\nAusstelung → Ausstellung\nende → Ende (Nomen gross)', hints: ['Lies langsam Wort für Wort.', 'Achte auf doppelte Mitlaute, «ie» und die Grossschreibung von Nomen.', 'Ein Nomen ist kleingeschrieben.'], rubricCriteria: ['3 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neuer Text mit drei anderen Fehlern.' })) },
    { id: 'r6', questionNumber: '7', taskKind: 'image_hotspot', maxPoints: 1, part: 'p2', page: 1, fig: 'map', ink: false, graphic: figBox(FIG3, 1, 'Karte der Schweiz mit Seen'),
      o: mk('Tippe auf der Karte auf den Genfersee.', { regions: LAKES.map(lakeRegion), targets: [lakeRegion(LAKES[0])], correctAnswer: 'Genfersee', stepByStepSolution: 'Der Genfersee liegt ganz im Südwesten der Schweiz an der Grenze zu Frankreich (Halbmond-Form).',
        hints: ['Der Genfersee liegt an der Grenze zu Frankreich.', 'Suche im Südwesten der Karte (unten links).', 'Er hat die Form eines Halbmonds.'], rubricCriteria: ['1 P: richtige Stelle'] }),
      x: mk(`Tippe auf der Karte auf den ${flip ? 'Bodensee' : 'Lago Maggiore'}.`, { regions: LAKES.map(lakeRegion), targets: [lakeRegion(LAKES[flip ? 3 : 4])], correctAnswer: flip ? 'Bodensee' : 'Lago Maggiore', stepByStepSolution: flip ? 'Der Bodensee liegt im Nordosten an der Grenze zu Deutschland und Österreich.' : 'Der Lago Maggiore liegt im Süden im Tessin und reicht nach Italien.',
        hints: [flip ? 'Der Bodensee grenzt an Deutschland und Österreich.' : 'Der Lago Maggiore liegt im Tessin.', flip ? 'Suche im Nordosten (oben rechts).' : 'Suche im Süden (unten, eher in der Mitte).', flip ? 'Er ist der grösste See ganz oben rechts.' : 'Er ist lang und schmal und zeigt nach Süden.'], rubricCriteria: ['1 P: richtige Stelle'], mutationExplanation: 'Gleiche Karte, anderer See.' }) },
    { id: 'r5', questionNumber: '8', taskKind: 'numeric', maxPoints: 2, part: 'p2', page: 1,
      o: mk('Ein Zug fährt die 57 km durch den Tunnel in 19 Minuten. Berechne seine Durchschnittsgeschwindigkeit in km/h.', { correctAnswer: '180', unit: 'km/h', stepByStepSolution: '19 min = 19/60 h\nv = 57 km : (19/60 h) = 180 km/h',
        hints: ['Geschwindigkeit = Weg durch Zeit.', 'Rechne die Minuten zuerst in Stunden um (÷ 60).', 'v = 57 : (19/60) – teile also 57 · 60 durch 19.'], rubricCriteria: ['2 P: richtige Geschwindigkeit mit Einheit'] }),
      x: mk(`Ein Güterzug fährt die 57 km durch den Tunnel in ${sp.min} Minuten. Berechne seine Durchschnittsgeschwindigkeit in km/h.`, { correctAnswer: String(sp.v), unit: 'km/h', stepByStepSolution: `${sp.min} min = ${sp.min}/60 h\nv = 57 km : (${sp.min}/60 h) = ${sp.v} km/h`,
        hints: ['Geschwindigkeit = Weg durch Zeit.', 'Rechne die Minuten zuerst in Stunden um (÷ 60).', `v = 57 : (${sp.min}/60) – teile also 57 · 60 durch ${sp.min}.`], rubricCriteria: ['2 P: richtige Geschwindigkeit mit Einheit'], mutationExplanation: 'Neue Fahrzeit, glatte Geschwindigkeit (rückwärts konstruiert).' }) },
    { id: 'r8', questionNumber: '9', taskKind: 'number_line', maxPoints: 2, part: 'p2', page: 1,
      o: mk('Zeichne auf dem Zahlenstrahl die Zahlen −1.5 und 2.5 ein.', { min: -3, max: 3, step: 0.5, points: [-1.5, 2.5], correctAnswer: '−1.5 · 2.5', stepByStepSolution: 'Ein Strich = 0.5.\n−1.5 liegt drei Striche links der Null, 2.5 fünf Striche rechts der Null.',
        hints: ['Suche zuerst die Null.', 'Jeder kleine Strich ist 0.5 wert.', 'Negative Zahlen liegen links der Null.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'] }),
      x: mk(`Zeichne auf dem Zahlenstrahl die Zahlen ${flip ? '0.5 und −1' : '−2.5 und 1'} ein.`, { min: -3, max: 3, step: 0.5, points: flip ? [-1, 0.5] : [-2.5, 1], correctAnswer: flip ? '−1 · 0.5' : '−2.5 · 1', stepByStepSolution: flip ? 'Ein Strich = 0.5.\n−1 liegt zwei Striche links, 0.5 einen Strich rechts der Null.' : 'Ein Strich = 0.5.\n−2.5 liegt fünf Striche links, 1 zwei Striche rechts der Null.',
        hints: ['Suche zuerst die Null.', 'Jeder kleine Strich ist 0.5 wert.', 'Negative Zahlen liegen links der Null.'], rubricCriteria: ['2 P: alles richtig (Teilpunkte anteilig)'], mutationExplanation: 'Neue Zahlen auf demselben Zahlenstrahl.' }) },
    { id: 'r7', questionNumber: '10', taskKind: 'code', maxPoints: 3, part: 'p2', page: 1,
      o: mk('SQL: Gib aus der Tabelle schueler (Spalten name, klasse, punkte) die Namen aller Schülerinnen und Schüler mit mehr als 15 Punkten aus, alphabetisch sortiert. Ergänze die Lücken.', { language: 'sql', starter: 'SELECT ___\nFROM schueler\nWHERE ___\nORDER BY ___;', correctAnswer: DEMO2_CODE.o,
        stepByStepSolution: 'SELECT wählt die Spalte name.\nWHERE filtert punkte > 15.\nORDER BY name sortiert alphabetisch (aufsteigend).', hints: ['Welche Spalte willst du sehen, welche Zeilen sollen übrig bleiben?', 'SELECT wählt Spalten, WHERE filtert Zeilen, ORDER BY sortiert.', 'Die Bedingung vergleicht die Spalte punkte mit 15.'], rubricCriteria: ['1 P: SELECT name FROM schueler', '1 P: WHERE punkte > 15', '1 P: ORDER BY name'] }),
      x: mk(flip ? 'SQL: Gib die Namen aller Schülerinnen und Schüler mit weniger als 10 Punkten aus, in umgekehrter alphabetischer Reihenfolge. Ergänze die Lücken.' : 'SQL: Gib Name und Punkte aller Schülerinnen und Schüler der Klasse 3a aus, nach Punkten absteigend sortiert. Ergänze die Lücken.', { language: 'sql', starter: 'SELECT ___\nFROM schueler\nWHERE ___\nORDER BY ___;', correctAnswer: DEMO2_CODE.x[flip ? 1 : 0],
        stepByStepSolution: flip ? 'SELECT name\nWHERE punkte < 10\nORDER BY name DESC (umgekehrt)' : 'SELECT name, punkte (zwei Spalten)\nWHERE klasse = \'3a\' (Text in Anführungszeichen)\nORDER BY punkte DESC (absteigend)', hints: ['Welche Spalten willst du sehen, welche Zeilen sollen übrig bleiben?', 'SELECT wählt Spalten, WHERE filtert Zeilen, ORDER BY sortiert; DESC heisst absteigend.', flip ? 'Die Bedingung vergleicht punkte mit 10.' : 'Texte stehen in SQL in einfachen Anführungszeichen.'], rubricCriteria: ['1 P: SELECT mit richtigen Spalten', '1 P: WHERE-Bedingung', '1 P: ORDER BY mit Richtung'], mutationExplanation: 'Neue Bedingung und Sortierung.' }) },
  ];
}
export const DEMO2_CODE = { o: "SELECT name\nFROM schueler\nWHERE punkte > 15\nORDER BY name;", x: ["SELECT name, punkte\nFROM schueler\nWHERE klasse = '3a'\nORDER BY punkte DESC;", "SELECT name\nFROM schueler\nWHERE punkte < 10\nORDER BY name DESC;"] };
export const DEMO2_PARTS = [{ id: 'p1', title: 'Teil A – Sprache (ohne Hilfsmittel)', timeLimitMin: 15, tools: [] }, { id: 'p2', title: 'Teil B – Mathematik & Informatik (mit Taschenrechner)', timeLimitMin: 20, tools: ['Taschenrechner'] }];
const D2 = { x0: 90, w: 1060 };
const FIG3 = { x0: 200, y0: 390, x1: 1040, y1: 830 };   // Karte (Aufgabe 5, Seite B)
const LAKES = [['Genfersee', 0.10, 0.80, 0.075, 0.035, 0.3], ['Neuenburgersee', 0.24, 0.47, 0.055, 0.016, -0.75], ['Vierwaldstättersee', 0.56, 0.45, 0.04, 0.022, 0.2], ['Bodensee', 0.87, 0.14, 0.065, 0.03, -0.25], ['Lago Maggiore', 0.60, 0.86, 0.016, 0.075, 0.1]];
const lakeAt = ([, rx, ry]) => [FIG3.x0 + rx * (FIG3.x1 - FIG3.x0), FIG3.y0 + ry * (FIG3.y1 - FIG3.y0)];
const lakeRegion = l => { const c = relCrop(lakeAt(l), FIG3), w = FIG3.x1 - FIG3.x0 + 2 * CROP_PAD / 1000 * DW; return { ...c, r: Math.max(45, Math.round(Math.max(l[3], l[4]) * (FIG3.x1 - FIG3.x0) * 1.3 / w * 1000)), label: l[0] }; };
function drawMap(x) {
  const f = FIG3, W = f.x1 - f.x0, H = f.y1 - f.y0, P = [[0.02, 0.62], [0.12, 0.45], [0.22, 0.3], [0.38, 0.18], [0.55, 0.1], [0.72, 0.08], [0.86, 0.06], [0.97, 0.26], [0.92, 0.48], [0.98, 0.62], [0.85, 0.7], [0.7, 0.66], [0.64, 0.97], [0.52, 0.8], [0.4, 0.86], [0.3, 0.8], [0.18, 0.95], [0.04, 0.88]];
  x.fillStyle = '#EEF2E6'; x.strokeStyle = '#222'; x.lineWidth = 4; x.beginPath(); P.forEach(([px, py], i) => (i ? x.lineTo : x.moveTo).call(x, f.x0 + px * W, f.y0 + py * H)); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#3F86D6'; LAKES.forEach(l => { const [cx, cy] = lakeAt(l); x.beginPath(); x.ellipse(cx, cy, l[3] * W, l[4] * W, l[5], 0, 7); x.fill(); });
  x.fillStyle = '#111';
}
const wrapText = (x, t, maxW) => String(t).split('\n').flatMap(p => { const out = []; let line = ''; for (const w of p.split(' ')) { const tt = line ? `${line} ${w}` : w; if (line && x.measureText(tt).width > maxW) { out.push(line); line = w; } else line = tt; } out.push(line); return out; });
function demo2Lines(q) {
  const v = q.o, k = q.taskKind;
  if (k === 'true_false') return [v.text, ...v.statements.map((s, i) => `${'abcdefgh'[i]}) ${s.text}   R / F${v.notGiven ? ' / ?' : ''}`)];
  if (k === 'fill_blanks') return [v.text.replace(/___/g, '________'), ...(v.blankOptions.length ? [`Auswahl: ${v.blankOptions.map(o => o.join(' / ')).join('  |  ')}`] : []), ...(v.wordBank.length ? [`Wörter: ${v.wordBank.join(' · ')}`] : [])];
  if (k === 'single_choice' || k === 'multi_select') return [v.text, ...v.options.map((o, i) => `${String.fromCharCode(65 + i)}  ${o}`)];
  if (k === 'text_select') return [v.text, joinTokens(v.tokens)];
  if (k === 'code') return [v.text, ...v.starter.split('\n')];
  if (k === 'number_line') return [v.text, `Zahlenstrahl von ${fmtNum(v.min)} bis ${fmtNum(v.max)}`];
  return [v.text];
}
function drawDemo2(x, n) {
  x.font = 'bold 40px Helvetica, Arial'; x.fillText(n ? 'Probeprüfung 2 – Seite 2' : 'Probeprüfung 2 (Sprache & Informatik)', D2.x0, 120);
  x.font = '26px Helvetica, Arial'; x.fillText(n ? 'Mathematik · Geografie · Informatik' : 'Zeit: 35 min', D2.x0, 168);
  let y = 240;
  const P = DEMO2_PARTS[n]; if (P) { x.font = 'bold 30px Helvetica, Arial'; x.fillText(P.title, D2.x0, y); x.font = '22px Helvetica, Arial'; x.fillText(`${P.timeLimitMin} min · Hilfsmittel: ${P.tools.join(', ') || 'keine'}`, D2.x0, y + 34); y += 80; }
  if (!n) {   // Material M1 als Kasten
    const m = DEMO2_MATS[0]; x.font = '22px Helvetica, Arial'; const ls = wrapText(x, m.text, D2.w - 60);
    x.strokeStyle = '#111'; x.lineWidth = 2; x.strokeRect(D2.x0, y, D2.w, 66 + ls.length * 30);
    x.font = 'bold 24px Helvetica, Arial'; x.fillText(`${m.label}  ${m.title}`, D2.x0 + 24, y + 38); x.font = '22px Helvetica, Arial';
    ls.forEach((l, i) => x.fillText(l, D2.x0 + 24, y + 76 + i * 30)); y += 100 + ls.length * 30;
  }
  for (const q of demo2Questions(0).filter(t => (t.page || 0) === n)) {
    x.font = 'bold 26px Helvetica, Arial'; x.fillText(`${q.questionNumber}  (${q.maxPoints} P)`, D2.x0, y);
    x.font = '22px Helvetica, Arial'; const ls = demo2Lines(q).flatMap(l => wrapText(x, l, D2.w - 170)); ls.forEach((l, i) => x.fillText(l, D2.x0 + 160, y + i * 30)); y += ls.length * 30 + 22;
    if (q.fig === 'map') { drawMap(x); y = FIG3.y1 + 120; }   // feste Lage (Aufgabe steht zuoberst auf Seite B)
  }
  x.fillStyle = '#1F4FD8'; x.font = 'italic 34px "Bradley Hand", cursive'; x.fillText(n ? '✓' : 'richtig', 980, n ? 300 : 200);   // etwas Handschrift für den Radierer
}
async function demoAnalyze(doc, pages, onStep) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (pages.some(p => p.demoPage >= 2)) return demo2Analyze(doc, pages, onStep, wait);
  doc.source = 'demo'; doc.title = doc.title || 'Gemischte Probeprüfung'; doc.subject = 'Mathematik'; doc.tools = ['Taschenrechner']; doc.timeLimitMin = 45; doc.v2 = true;
  doc.subjectId = guessSubjectId('Mathematik');
  for (let s = 0; s < 5; s++) { onStep?.(s, (s + 1) / 5); await wait(220); }
  const pageOk = i => !!pages[i]?.demo;
  doc.questions = demoQuestions(0).map(d => ({ id: d.id, questionNumber: d.questionNumber, taskKind: d.graphic && !pageOk(d.graphic.pageIndex) && d.taskKind === 'label_image' ? 'short_answer' : d.taskKind, maxPoints: d.maxPoints,
    originalQuestion: d.o, remixedQuestion: d.x, graphicBoundingBox: d.graphic && pageOk(d.graphic.pageIndex) ? d.graphic : null, crop: null, cropInk: true }));
  doc.remixRound = 1; doc.remixFresh = true;
  await cropAll(doc);
  return doc;
}
async function demo2Analyze(doc, pages, onStep, wait) {
  doc.source = 'demo'; doc.demoSet = 2; doc.title = doc.title || 'Probeprüfung 2 – Sprache & Informatik'; doc.subject = 'Deutsch & Informatik'; doc.tools = ['Taschenrechner']; doc.timeLimitMin = 35; doc.v2 = true;
  doc.subjectId = guessSubjectId('Deutsch');
  for (let s = 0; s < 5; s++) { onStep?.(s, (s + 1) / 5); await wait(220); }
  const pageOf = n => pages.findIndex(p => p.demoPage === 2 + n);
  doc.materials = copyV(DEMO2_MATS); doc.parts = copyV(DEMO2_PARTS);
  doc.questions = demo2Questions(0).map(d => { const pi = d.graphic ? pageOf(d.page || 0) : -1, g = pi >= 0 ? { ...d.graphic, pageIndex: pi } : null;
    return { id: d.id, questionNumber: d.questionNumber, taskKind: d.graphic && !g ? 'short_answer' : d.taskKind, maxPoints: d.maxPoints, materialId: d.mat || null, partId: d.part || null,
      originalQuestion: d.o, remixedQuestion: d.x, graphicBoundingBox: g, crop: null, cropInk: d.ink !== false }; });
  doc.remixRound = 1; doc.remixFresh = true;
  await cropAll(doc);
  return doc;
}
function demoRemix(doc) {
  const fresh = doc.demoSet === 2 ? demo2Questions(doc.remixRound) : demoQuestions(doc.remixRound);
  doc.questions.forEach(q => { const d = fresh.find(x => x.id === q.id); if (d && d.taskKind === q.taskKind) q.remixedQuestion = d.x; });
}
function demoGrade(q, v, answer, photo) {
  const kind = kindOf(q.taskKind), max = q.maxPoints;
  if (KIND[kind]?.auto) return { points: 0, feedback: 'Ohne Lösungsschlüssel nicht automatisch bewertbar.' };
  if (kind === 'sketch') return photo ? { points: floorHalf(max / 2), feedback: 'Skizze erhalten – im Demo-Modus gibt es die Hälfte der Punkte; angemeldet bewertet Brainy die Zeichnung.' } : { points: 0, feedback: 'Keine Skizze gezeichnet.' };
  const raw = typeof answer === 'object' && answer ? Object.values(answer).map(str).join('\n') : String(answer ?? ''), t = fold(raw).replace(/[’'\s]/g, '');
  if (kind === 'essay_open_text') {
    const words = raw.split(/\s+/).filter(Boolean).length, terms = [...new Set(fold(`${v.correctAnswer} ${v.stepByStepSolution}`).split(/[^a-z0-9]+/).filter(w => w.length >= 6).map(w => w.slice(0, 7)))];
    const pts = Math.min(max, floorHalf(terms.filter(w => t.includes(w)).length * 0.75 + (words >= 15 ? 1 : 0)));
    return { points: pts, feedback: pts >= max ? 'These, Begründung und Fazit vollständig.' : 'Begründe genauer mit Fachbegriffen und schliesse mit einem Fazit.' };
  }
  if (kind === 'code') {   // Demo: Anteil der Schlüsselwörter der Musterlösung
    const terms = [...new Set(fold(v.correctAnswer).split(/[^a-z0-9_]+/).filter(w => w.length >= 3))], got = fold(raw);
    const pts = terms.length ? part(terms.filter(w => got.includes(w)).length / terms.length, max) : 0;
    return { points: pts, feedback: pts === max ? 'Code vollständig.' : pts > 0 ? 'Teilpunkte: Vergleiche deinen Code mit der Musterlösung.' : 'Der Code passt noch nicht zur Aufgabe.' };
  }
  if (kind === 'math_calculation') {
    const nums = (v.correctAnswer.replace(/[’'\s]/g, '').replace(/[²³]/g, '').match(/\d+(?:[.,]\d+)?/g) || []);
    const hits = nums.filter(n => t.includes(n.replace(',', '.')) || t.includes(n));
    const pts = nums.length ? part(hits.length / nums.length, max) : 0;
    return { points: pts, feedback: pts === max ? 'Vollständig richtig gelöst.' : pts > 0 ? 'Teilpunkte für richtige Teilergebnisse.' : `Richtig wäre: ${v.correctAnswer}` };
  }
  return { points: 0, feedback: `Richtig wäre: ${v.correctAnswer}` };
}

/* =========================================================================================
   7) AKTIONEN
   ========================================================================================= */
let ACTS = null;   // für studioChange (nach Dateiauswahl automatisch scannen)
const wait = ms => new Promise(r => setTimeout(r, ms));
const BACK = { cleaned: 'home', build: 'cleaned', ready: 'cleaned', paper: 'ready', result: 'ready', choice: 'home', scan: 'home' };
// Meldung «Prüfung bereinigt» (Ton/Haptik/Push) kommt aus studio-scan.js – fehlt die Datei, läuft alles trotzdem
const scanMod = () => import('./studio-scan.js').catch(e => { console.warn('studio-scan.js fehlt', e); return {}; });
async function notifyDone(doc) { try { const m = await scanMod(); if (m.notifyCleaned) await m.notifyCleaned(doc, { sound: true }); else return false; } catch (e) { console.warn('notifyCleaned', e); return false; } return true; }
export const SCAN_MIN_MS = 4200;   // Radier-Animation mindestens so lange zeigen
export function studioActions({ render, toast, haptic, chime, confetti, app }) {
  const a = () => U.ai;
  const curDoc = () => migrateDoc(docById(a().docId));
  const qOf = id => curDoc()?.questions.find(q => q.id === id);
  const listAns = (q, fill) => { const x = a(); if (!Array.isArray(x.ans[q])) x.ans[q] = fill ? fill() : []; return x.ans[q]; };
  const warmDoc = d => imgWarm([...d.pages.map(p => p.key), ...d.questions.flatMap(q => [q.crop, q.qcrop]), ...arr(d.materials).map(m => m?.crop)].filter(Boolean)).then(render);
  hookAntiCheat(() => { haptic?.([40, 60, 40]); render(); });
  aiStatus.onWait = () => render();
  setInterval(() => {
    const x = a(); if (x?.tool !== 'exam' || x.phase !== 'run' || !x.run) return;
    const t = x.timer, el = app.querySelector('[data-live="studioClock"]');
    if (t && el) { el.textContent = clockText(t); el.classList.toggle('warn', t.mode === 'down' && timerLeft(t) < 5 * 60000); }
    if (t?.mode === 'down' && !t.over && timerLeft(t) <= 0) { t.over = true; x.confirm = 'timeup'; x.timerMenu = false; haptic?.([60, 80, 60]); chime?.(); render(); }
    paintSketches(app);
    const doc = curDoc(); if (!arr(doc?.parts).length) return;
    // Prüfungsteile: Teilzeit live, einmal melden wenn abgelaufen; aktiver Teil folgt dem Scrollen
    const p = curPart(doc, x), pe = app.querySelector('[data-live="studioPartClock"]');
    if (p && pe) { pe.textContent = `${partShort(p)} · ${partClock(x, p)}`; pe.classList.toggle('warn', partLeft(x, p) < 2 * 60000); }
    if (p && partLeft(x, p) === 0 && x.partRun && !x.partRun.warned[p.id]) { x.partRun.warned[p.id] = true; haptic?.([40, 60, 40]); toast(`Zeit für ${partShort(p)} ist um`); }
    const main = app.querySelector('.ex-main'); if (!main || Date.now() - (x.qiAt || 0) < 1500 || x.confirm || x.sideOpen) return;
    const top = main.getBoundingClientRect().top + 90, hit = [...main.querySelectorAll('.ex-task[data-qi]')].find(e => e.getBoundingClientRect().bottom > top), qi = hit ? +hit.dataset.qi : x.qi;
    if (Number.isInteger(qi) && qi !== x.qi) { x.qi = qi; partSwitch(x, orderedQs(doc, x.order)[qi]?.partId); render(); }
  }, 500);

  const acts = {
    studioHome() { Object.assign(a(), { phase: 'home', err: null, crop: null, results: null, run: null, timer: null, confirm: null, scan: null }); },
    studioNew() { Object.assign(a(), { phase: 'home', files: [], pdf: null, err: null }); },
    studioRemoveFile(d) { a().files.splice(+d.i, 1); },
    studioRemovePdf() { a().pdf = null; },
    async studioDemoPage(d) { const ps = d?.set === '2' ? [await demoPage(2), await demoPage(3)] : [await demoPage(0), await demoPage(1)]; a().files = ps.map((p, i) => ({ name: `Beispiel-Prüfung-${i + 1}.jpg`, demo: p, url: p.url })); return acts.studioScan(); },
    async studioScan() {
      const x = a();
      if (x.phase === 'scan') return;
      if (!x.files.length && !x.pdf) return toast(`Lade 1 bis ${MAX_PAGES} Seiten hoch (PDF, Fotos oder Screenshots)`);
      Object.assign(x, { err: null, phase: 'scan', scan: { step: 0, prog: 0, pages: [], cleaned: [], done: false } }); render();
      const t0 = Date.now(); scanMod().then(m => m.prepareNotify?.()).catch(() => { });
      try {
        const pages = [];
        for (const f of x.files) pages.push(f.demo || await scanPhoto(f.url).catch(() => normalizeImage(f.url)));   // gerade ziehen + Licht ausgleichen
        if (x.pdf && pages.length < MAX_PAGES) { const { pdfPages } = await import('./pdf.js'); const to = Math.min(x.pdf.count, +x.pdf.from + MAX_PAGES - 1 - pages.length, +x.pdf.to); pages.push(...(await pdfPages(x.pdf.data, +x.pdf.from, to)).pages); }
        const use = pages.slice(0, MAX_PAGES); if (!use.length) throw new Error('Keine Seiten gefunden.');
        x.scan.pages = use.map(p => p.url); for (const p of use.slice(0, 3)) if (!p.demo && hasKey()) p.clean = await hwClean(p.url);   // Vorschau zeigt schon das Netz-Ergebnis
        x.scan.cleaned = []; for (const p of use) x.scan.cleaned.push(await cleanPage(p.clean || p.url).catch(() => p.url)); render();   // Vorschau für jede Seite
        const doc = await analyzeExam({ pages: use, title: '', onStep: (step, prog) => { x.scan.step = step; x.scan.prog = prog; render(); } });
        studioData().docs.unshift(doc); studioData().docs = studioData().docs.slice(0, 30); save();
        x.scan.step = 4; x.scan.prog = 1; render();
        const rest = SCAN_MIN_MS - (Date.now() - t0); if (rest > 0) await wait(rest);
        Object.assign(x, { docId: doc.id, phase: 'cleaned', mode: 'original', variant: 'original', shuffle: false, order: [], files: [], pdf: null, results: null });
        x.scan.done = true; x.scan.prog = 1;
        haptic?.(30); notifyDone(doc).then(ok => { if (!ok) chime?.(); });
        await warmDoc(doc);
      } catch (e) { x.phase = 'home'; x.scan = null; x.err = e.message === 'NO_KEY' ? 'Melde dich an, damit Brainy deine Prüfung aufbereiten kann.' : (e.message || 'Fehler bei der Analyse.'); }
    },
    studioOpen(d) {
      Object.assign(a(), { docId: d.id, phase: 'cleaned', mode: 'original', variant: 'original', shuffle: false, order: [], results: null, run: null, timer: null, confirm: null, scan: null });
      const doc = curDoc(); if (doc) { save(); warmDoc(doc); } else a().phase = 'home';
    },
    // Modus wählen: Original · Aufgaben mischen · Neue Zahlen → kurz «build» → «ready»
    async studioMode(d) {
      const x = a(), doc = curDoc(); if (!doc || x.busy) return;
      const m = ['original', 'shuffle', 'remix'].includes(d.id) ? d.id : 'original';
      Object.assign(x, { mode: m, variant: m === 'remix' ? 'remix' : 'original', shuffle: m === 'shuffle', order: m === 'shuffle' ? shuffledOrder(doc) : [], qi: 0, phase: 'build', scan: null, results: null, busy: m === 'remix' ? 'remix' : null });
      render();
      try {
        if (m === 'remix') { if (doc.remixFresh) doc.remixFresh = false; else await remixQuestions(doc); save(); await warmDoc(doc); }
        await wait(m === 'remix' ? 600 : 350);
      } catch (e) { toast('⚠️ ' + e.message); }
      finally { x.busy = null; }
      if (a() === x && x.phase === 'build') { x.phase = 'ready'; haptic?.(20); }
    },
    studioVariant(d) { a().variant = d.id === 'remix' ? 'remix' : 'original'; },
    async studioRemix() {
      const x = a(), doc = curDoc(); if (!doc || x.busy) return;
      x.busy = 'remix'; render();
      try { await remixQuestions(doc); doc.remixFresh = false; save(); x.variant = 'remix'; x.mode = 'remix'; toast('🔄 Neue Variante gewürfelt'); haptic?.(20); }
      catch (e) { toast('⚠️ ' + e.message); } finally { x.busy = null; }
    },
    studioShuffle() { const x = a(), doc = curDoc(); if (!doc) return; x.shuffle = !x.shuffle; x.order = x.shuffle ? shuffledOrder(doc) : []; x.qi = 0; },
    studioStartInteractive() {
      const x = a(), doc = curDoc(); if (!doc) return;
      Object.assign(x, { phase: 'run', qi: 0, ans: initAnswers(orderedQs(doc, x.order), x.variant), touched: {}, photos: {}, hints: {}, results: null, confirm: null, confirmQ: null, sideOpen: false, timerMenu: false, calcOpen: false, calc: '', calcOut: '', matClosed: {} });
      runStart(x); partStart(x, orderedQs(doc, x.order)[0]?.partId); x.timer = doc.timeLimitMin > 0 ? timerStart(x, doc.timeLimitMin) : null; haptic?.(25);
    },
    studioRetry() { const x = a(), doc = curDoc(); if (!doc) return; if (x.mode === 'shuffle') x.order = shuffledOrder(doc); acts.studioStartInteractive(); },
    studioOpenPaper() { Object.assign(a(), { phase: 'paper', paperSol: false }); },
    studioBack() { const x = a(); if (x.phase === 'run') { x.confirm = 'leave'; return; } x.phase = x.docId ? BACK[x.phase] || 'cleaned' : 'home'; x.run = null; x.timer = null; },
    studioLeave() { a().confirm = 'leave'; a().timerMenu = false; },
    studioSubmitAsk() { a().confirm = 'submit'; a().timerMenu = false; },
    studioConfirmYes() {
      const x = a(), c = x.confirm; x.confirm = null;
      if (c === 'leave') { Object.assign(x, { phase: 'ready', run: null, timer: null, timerMenu: false, sideOpen: false }); return; }
      if (c === 'solution') { if (x.confirmQ) x.hints[x.confirmQ] = 4; x.confirmQ = null; haptic?.(15); return; }
      if (c === 'submit' || c === 'timeup') return acts.studioSubmit();
    },
    studioConfirmNo() { const x = a(); if (x.timer && x.confirm === 'timeup') x.timer.over = true; x.confirm = null; x.confirmQ = null; },
    studioQ(d) {
      const x = a(), qs = orderedQs(curDoc(), x.order), n = qs.length; if (!n) return;
      x.qi = Math.max(0, Math.min(n - 1, d.d ? x.qi + +d.d : +d.i || 0)); x.sideOpen = false; x.qiAt = Date.now();
      const id = qs[x.qi].id; partSwitch(x, qs[x.qi].partId);
      setTimeout(() => app.querySelector(`#ex-q-${x.qi}, [data-qid="${id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 40);
    },
    studioSide() { a().sideOpen = !a().sideOpen; },
    studioMat(d) { const x = a(); x.matClosed = { ...(x.matClosed || {}), [d.id]: !x.matClosed?.[d.id] }; },   // Material ein-/ausklappen (Handy)
    // Antworten
    studioPick(d) { a().ans[d.q] = +d.i; haptic?.(10); },
    studioTok(d) { return acts.studioToggle(d); },   // Wort im Text markieren / aufheben
    studioToggle(d) { const L = listAns(d.q), i = +d.i, k = L.indexOf(i); if (k >= 0) L.splice(k, 1); else L.push(i); L.sort((p, q) => p - q); haptic?.(10); },
    studioTF(d) { const L = listAns(d.q), i = +d.i, val = d.v === 'n' ? 'ng' : d.v === '1' || d.v === 'true'; L[i] = L[i] === val ? null : val; haptic?.(10); },
    // Wortbank: Wort in die erste leere Lücke setzen
    studioBank(d) {
      const q = qOf(d.q); if (!q || d.w === undefined) return; const v = V(q, a().variant), L = listAns(d.q, () => emptyAnswer('fill_blanks', v)), n = blankCount(v.text);
      const j = Array.from({ length: n }, (_, i) => i).find(i => !str(L[i])); if (j === undefined) return toast('Alle Lücken sind gefüllt – leere zuerst eine Lücke.');
      L[j] = d.w; haptic?.(10);
    },
    studioMatch(d) { const L = listAns(d.q), i = +d.i, r = +d.r; L[i] = L[i] === r ? null : r; haptic?.(10); },
    studioCat(d) { const L = listAns(d.q), i = +d.i, g = +d.g; L[i] = L[i] === g ? null : g; haptic?.(10); },
    studioOrderMove(d) {
      const q = qOf(d.q); if (!q) return;
      const v = V(q, a().variant), L = listAns(d.q, () => emptyAnswer('ordering', v)), i = +d.i, j = i + (+d.d || 0);
      if (i >= 0 && j >= 0 && i < L.length && j < L.length) { [L[i], L[j]] = [L[j], L[i]]; (a().touched ||= {})[d.q] = true; haptic?.(10); }
    },
    studioLabel(d) { if (d.v === undefined) return; const L = listAns(d.q); L[+d.i] = L[+d.i] === d.v ? '' : d.v; },   // Wortliste antippen
    studioCell(d) { if (d.v === undefined || !d.k) return; const x = a(); if (!x.ans[d.q] || typeof x.ans[d.q] !== 'object') x.ans[d.q] = {}; x.ans[d.q][d.k] = d.v; },
    studioPlot(d, el, e) {
      const q = qOf(d.q); if (!q) return; const ax = V(q, a().variant).axes || { xmin: -5, xmax: 5, ymin: -5, ymax: 5, step: 1 };
      let px = Number(d.x), py = Number(d.y);
      if (d.x === undefined || d.y === undefined) {   // Klick ins Raster: Element = Zeichenfläche
        const r = (el?.closest?.('svg') || el)?.getBoundingClientRect?.(); if (!r?.width || !e) return;
        px = ax.xmin + (e.clientX - r.left) / r.width * (ax.xmax - ax.xmin); py = ax.ymax - (e.clientY - r.top) / r.height * (ax.ymax - ax.ymin);
      }
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      const st = ax.step || 1, snap = (v, o) => Math.round((o + Math.round((v - o) / st) * st) * 1e6) / 1e6;
      px = Math.max(ax.xmin, Math.min(ax.xmax, snap(px, ax.xmin))); py = Math.max(ax.ymin, Math.min(ax.ymax, snap(py, ax.ymin)));
      const L = listAns(d.q), k = L.findIndex(p => Array.isArray(p) && Math.abs(p[0] - px) < st / 2 && Math.abs(p[1] - py) < st / 2);
      if (k >= 0) L.splice(k, 1); else if (L.length < 20) L.push([px, py]);
      haptic?.(10);
    },
    studioPlotClear(d) { a().ans[d.q] = []; },
    // Stelle im Bild antippen: Position relativ zum Bild (0–1000), erneutes Tippen verschiebt
    studioHot(d, el, e) {
      let px = Number(d.x), py = Number(d.y);
      if (d.x === undefined || d.y === undefined) { const r = (el?.querySelector?.('img') || el)?.getBoundingClientRect?.(); if (!r?.width || !r.height || !e) return; px = (e.clientX - r.left) / r.width * 1000; py = (e.clientY - r.top) / r.height * 1000; }
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      a().ans[d.q] = [c1000(px), c1000(py)]; haptic?.(10);
    },
    studioHotClear(d) { a().ans[d.q] = null; },
    // Zahlenstrahl: Wert setzen/entfernen (auf «step» gerundet), mit −/+ fein verschieben
    studioNL(d, el, e) {
      const q = qOf(d.q); if (!q) return; const v = V(q, a().variant), lo = +v.min, hi = +v.max, st = +v.step > 0 ? +v.step : 1; if (!(hi > lo)) return;
      let val = Number(d.v);
      if (d.v === undefined) { const r = el?.getBoundingClientRect?.(); if (!r?.width || !e) return; val = lo + (e.clientX - r.left) / r.width * (hi - lo); }
      if (!Number.isFinite(val)) return;
      val = Math.max(lo, Math.min(hi, Math.round((lo + Math.round((val - lo) / st) * st) * 1e6) / 1e6));
      const L = listAns(d.q), k = L.findIndex(x => Math.abs(x - val) < st / 2);
      if (k >= 0) L.splice(k, 1); else if (L.length < 12) L.push(val);
      L.sort((p, q2) => p - q2); haptic?.(10);
    },
    studioNLMove(d) {
      const q = qOf(d.q); if (!q) return; const v = V(q, a().variant), st = +v.step > 0 ? +v.step : 1, L = listAns(d.q), i = +d.i;
      if (!(i >= 0 && i < L.length)) return;
      L[i] = Math.max(+v.min, Math.min(+v.max, Math.round((L[i] + (+d.d || 0) * st) * 1e6) / 1e6)); L.sort((p, q2) => p - q2); haptic?.(10);
    },
    studioNLDel(d) { const L = listAns(d.q), i = +d.i; if (i >= 0 && i < L.length) L.splice(i, 1); },
    // Formel-Leiste: Zeichen an der letzten Cursor-Position einfügen
    studioInsert(d) {
      const x = a(), t = String(d.t ?? ''), el = app.querySelector(`[data-bind="ai.ans.${d.q}"]`); if (!t) return;
      const cur = typeof x.ans[d.q] === 'string' ? x.ans[d.q] : el?.value || '', at = el && Number.isInteger(el.selectionStart) ? Math.min(el.selectionStart, cur.length) : cur.length, end = el && Number.isInteger(el.selectionEnd) ? Math.max(at, Math.min(el.selectionEnd, cur.length)) : at;
      x.ans[d.q] = cur.slice(0, at) + t + cur.slice(end); if (el) el.value = x.ans[d.q];
      setTimeout(() => { const e2 = app.querySelector(`[data-bind="ai.ans.${d.q}"]`); if (e2) { e2.focus?.(); e2.setSelectionRange?.(at + t.length, at + t.length); } }, 0);
    },
    studioSketchClear(d) {
      delete a().photos[d.q];
      const cv = app.querySelector(`canvas[data-sketch="${d.q}"]`); if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    },
    studioOrig(d) { const x = a(); x.orig = x.orig === d.q ? null : d.q; },
    // Lernhinweise: nur aufsteigend 1 → 2 → 3; Lösung (4) nur mit Bestätigung
    studioHint(d) {
      const x = a(), cur = +x.hints[d.q] || 0; if (cur >= 3) return;
      x.hints[d.q] = d.l ? Math.max(cur, Math.min(3, +d.l || cur + 1)) : cur + 1; haptic?.(10);
    },
    studioSolution(d) {
      const x = a(); if ((+x.hints[d.q] || 0) >= 4) return;
      if (d.ok === '1') { x.hints[d.q] = 4; return; }
      x.confirm = 'solution'; x.confirmQ = d.q;
    },
    // Timer
    studioTimerMenu() { a().timerMenu = !a().timerMenu; },
    studioTimerSet(d) { const x = a(); timerStart(x, +d.min || 0); x.timerMenu = false; haptic?.(15); },
    studioTimerOff() { const x = a(); x.timer = null; x.timerMenu = false; },
    studioToggleCalc() { a().calcOpen = !a().calcOpen; },
    studioCalc(d) {
      const x = a(), k = d.k;
      if (k === 'C') { x.calc = ''; x.calcOut = ''; return; }
      if (k === '⌫') { x.calc = x.calc.slice(0, -1); return; }
      if (k === '=') { try { x.calcOut = String(calcEval(x.calc)); } catch (e) { x.calcOut = e.message; } return; }
      if (x.calc.length < 60) x.calc += k;
    },
    studioResume() { runResume(a().run); timerResume(a().timer); },
    studioPhotoClear(d) { delete a().photos[d.q]; },
    async studioSubmit() {
      const x = a(), doc = curDoc(); if (!doc || !x.run || x.busy) return;
      x.confirm = null; x.timerMenu = false; runPause(x.run); timerPause(x.timer); partPause(x); x.busy = 'grade'; render();
      try {
        const qs = orderedQs(doc, x.order), ans = { ...x.ans };
        qs.forEach(q => { if (kindOf(q.taskKind) === 'ordering' && !x.touched?.[q.id]) ans[q.id] = null; });   // nie verschoben = nicht beantwortet
        const res = await gradeAnswers(doc, qs, x.variant, ans, x.photos, x.hints);
        const { att, session } = recordAttempt({ doc, variant: x.variant, mode: x.mode, results: res, minutes: Math.round(runElapsed(x.run) / 60000), leaves: x.run.leaves, start: x.run.start, country: x.country, hints: x.hints, ans, photos: x.photos });
        if (session && BK.enabled && S.user?.id) BK.pushSession(session).then(() => BK.pushProfileStats()).catch(() => { });
        x.results = att.id; x.phase = 'result';
        if (att.grade >= 5) setTimeout(() => confetti?.(app), 60);
        chime?.(); haptic?.(40);
      } catch (e) { toast('⚠️ ' + (e.message === 'NO_KEY' ? 'Bitte anmelden' : e.message)); runResume(x.run); partResume(x); if (!x.timer?.over) timerResume(x.timer); }
      finally { x.busy = null; }
    },
    studioCountry(d) {
      const x = a(), c = ['CH', 'DE', 'AT'].includes(d.id) ? d.id : 'CH'; x.country = c;
      S.prefs = { ...(S.prefs || {}), gradeCountry: c };
      const att = x.results && studioData().attempts.find(t => t.id === x.results);
      if (att) { att.country = c; att.gradeLocal = gradeFor(c, att.earned, att.max); }
      save();
    },
    studioPaperSol() { a().paperSol = !a().paperSol; },
    studioPrint() { document.body.classList.add('print-paper'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-paper'), 500); }, 50); return false; },
    async studioPdf() {
      const x = a(), doc = curDoc(); if (!doc) return; x.busy = 'pdf'; render();
      try { const { examStudioPdf } = await import('./studio-pdf.js'); await examStudioPdf(doc, orderedQs(doc, x.order), x.variant, { solutions: x.paperSol, country: x.country }); }
      catch (e) { toast('⚠️ PDF: ' + e.message); } finally { x.busy = null; }
    },
    studioDel(d) { U.modal = { type: 'studioDel', id: d.id }; },
    studioDelConfirm(d) {
      const doc = docById(d.id); U.modal = null; if (!doc) return;
      doc.pages.forEach(p => { imgDel(p.key); if (p.cleanKey) imgDel(p.cleanKey); }); doc.questions.forEach(q => { if (q.crop) imgDel(q.crop); if (q.qcrop) imgDel(q.qcrop); }); arr(doc.materials).forEach(m => { if (m?.crop) imgDel(m.crop); });
      studioData().docs = studioData().docs.filter(x => x.id !== d.id); studioData().attempts = studioData().attempts.filter(x => x.docId !== d.id);
      save(); Object.assign(a(), { phase: 'home', docId: null }); toast('Prüfung gelöscht');
    },
    studioCropEdit(d) { const x = a(), doc = curDoc(), q = doc?.questions.find(t => t.id === d.q); if (!q) return; const b = q.graphicBoundingBox || { pageIndex: 0, ymin: 200, xmin: 150, ymax: 650, xmax: 850, label: 'Abbildung' }; x.crop = { q: q.id, box: { ...b }, ink: q.cropInk !== false }; warmDoc(doc); },
    studioCropPage(d) { if (a().crop?.box) a().crop.box.pageIndex = +d.i; },
    studioCropInk() { if (a().crop) a().crop.ink = !a().crop.ink; },
    async studioCropSave() { const x = a(), doc = curDoc(), c = x.crop; if (!doc || !c) return; const q = doc.questions.find(t => t.id === c.q); q.graphicBoundingBox = normBox(c.box); q.cropInk = c.ink; await recrop(doc, q); save(); x.crop = null; toast('Grafik-Ausschnitt aktualisiert'); },
    async studioCropRemove() { const x = a(), doc = curDoc(), q = doc?.questions.find(t => t.id === x.crop?.q); if (!q) return; q.graphicBoundingBox = null; await recrop(doc, q); save(); x.crop = null; },
    studioCropClose() { a().crop = null; },
  };
  ACTS = acts;
  return acts;
}
// Wert nach data-bind schreiben und fehlende Form anlegen (Objekt für .value/.work/"r,c", Array für Ziffern-Index)
function writeBind(path, val) {
  const keys = String(path || '').split('.'); if (keys.length < 2) return;
  let o = U;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i], next = keys[i + 1];
    if (o[k] === null || o[k] === undefined || typeof o[k] !== 'object') o[k] = /^\d+$/.test(next) ? [] : {};
    o = o[k];
  }
  o[keys.at(-1)] = val;
}
export function studioChange({ render, toast }) {
  const a = () => U.ai;
  return {
    async studioFiles(el) {
      const x = a(), list = [...(el.files || [])]; el.value = '';
      for (const f of list) {
        if (f.size > 40 * 1024 * 1024) { toast(`${f.name}: zu gross (max. 40 MB)`); continue; }
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          const data = (await readAsDataURL(f)).split(',')[1];
          try { const { pdfCount } = await import('./pdf.js'); const count = await pdfCount(data); x.pdf = { name: f.name, data, count, from: 1, to: Math.min(count, MAX_PAGES - x.files.length) }; }
          catch { toast('PDF konnte nicht gelesen werden'); }
        } else if (/^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name)) {
          if (x.files.length >= MAX_PAGES) { toast(`Maximal ${MAX_PAGES} Seiten`); break; }
          x.files.push({ name: f.name, url: await readAsDataURL(f) });
        } else toast(`${f.name}: bitte PDF, Foto oder Screenshot`);
      }
      render();
      if ((x.files.length || x.pdf) && x.phase !== 'scan' && ACTS) { await ACTS.studioScan(); render(); }   // Scan startet sofort
    },
    studioPdfRange(el) {
      const p = a().pdf; if (!p) return;
      const v = Math.max(1, Math.min(p.count, +el.value || 1));
      if (el.dataset.k === 'from') { p.from = v; p.to = Math.min(p.count, Math.max(v, Math.min(+p.to, v + MAX_PAGES - 1))); }
      else p.to = Math.max(+p.from, Math.min(v, +p.from + MAX_PAGES - 1));
      render();
    },
    async studioPhoto(el) { const f = el.files?.[0]; if (!f) return; a().photos[el.dataset.q] = (await normalizeImage(await readAsDataURL(f), 1400)).url; el.value = ''; render(); },
    studioAns(el) { if (!el?.dataset?.bind) return; writeBind(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value); render(); },
    studioWords(el) {
      if (el?.dataset?.bind) writeBind(el.dataset.bind, el.value);
      const n = String(el?.value || '').split(/\s+/).filter(Boolean).length, q = el?.dataset?.q;
      if (q) document.querySelectorAll(`[data-live="words-${q}"]`).forEach(e => { e.textContent = `${n} ${n === 1 ? 'Wort' : 'Wörter'}`; });
    },
  };
}
// Skizzen: vorhandene Zeichnung aus a.photos auf neue/zurückgesetzte Leinwände malen
const sketchOf = new WeakMap();
export function paintSketches(root) {
  root?.querySelectorAll?.('canvas[data-sketch]').forEach(cv => {
    const q = cv.dataset.sketch, url = U.ai?.photos?.[q], key = `${q}|${cv.width}x${cv.height}|${url ? url.length : 0}`;
    if (sketchOf.get(cv) === key) return; sketchOf.set(cv, key);
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    if (url) loadImg(url).then(im => { if (sketchOf.get(cv) === key) g.drawImage(im, 0, 0, cv.width, cv.height); }).catch(() => { });
  });
}
export function studioPointer(app, render) {
  let drag = null, pen = null;
  try { new MutationObserver(() => requestAnimationFrame(() => paintSketches(app))).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sketch', 'width', 'height'] }); } catch { }
  const at = (e, p) => [(e.clientX - p.r.left) * p.kx, (e.clientY - p.r.top) * p.ky];
  app.addEventListener('pointerdown', e => {
    const cv = e.target.closest?.('canvas[data-sketch]');
    if (cv && U.ai?.tool === 'exam') {   // Zeichnen
      paintSketches(app);
      const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return;
      const g = cv.getContext('2d'), kx = cv.width / r.width, ky = cv.height / r.height;
      g.strokeStyle = '#0E1015'; g.lineWidth = Math.max(2, 2.6 * kx); g.lineCap = 'round'; g.lineJoin = 'round';
      pen = { cv, g, r, kx, ky }; pen.last = at(e, pen);
      g.beginPath(); g.moveTo(...pen.last); g.lineTo(pen.last[0] + 0.01, pen.last[1]); g.stroke();
      cv.setPointerCapture?.(e.pointerId); e.preventDefault(); return;
    }
    const h = e.target.closest('[data-crop-h]'), stage = e.target.closest('.crop-stage'), c = U.ai?.crop;
    if (!stage || !c) return;
    drag = { mode: h ? h.dataset.cropH : 'move', r: stage.getBoundingClientRect(), start: { ...c.box }, x0: e.clientX, y0: e.clientY };
    stage.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (pen) { for (const ev of e.getCoalescedEvents?.() || [e]) { const p = at(ev, pen); pen.g.beginPath(); pen.g.moveTo(...pen.last); pen.g.lineTo(...p); pen.g.stroke(); pen.last = p; } e.preventDefault(); return; }
    if (!drag) return; const c = U.ai?.crop; if (!c) { drag = null; return; }
    const dx = (e.clientX - drag.x0) / drag.r.width * 1000, dy = (e.clientY - drag.y0) / drag.r.height * 1000, s = drag.start, b = c.box, cl = v => Math.max(0, Math.min(1000, v));
    if (drag.mode === 'move') { const w = s.xmax - s.xmin, hh = s.ymax - s.ymin; b.xmin = cl(Math.min(1000 - w, s.xmin + dx)); b.ymin = cl(Math.min(1000 - hh, s.ymin + dy)); b.xmax = b.xmin + w; b.ymax = b.ymin + hh; }
    else { if (drag.mode.includes('n')) b.ymin = cl(Math.min(s.ymax - 20, s.ymin + dy)); if (drag.mode.includes('s')) b.ymax = cl(Math.max(s.ymin + 20, s.ymax + dy)); if (drag.mode.includes('w')) b.xmin = cl(Math.min(s.xmax - 20, s.xmin + dx)); if (drag.mode.includes('e')) b.xmax = cl(Math.max(s.xmin + 20, s.xmax + dx)); }
    const box = document.querySelector('.crop-box'); if (box) Object.assign(box.style, { top: b.ymin / 10 + '%', left: b.xmin / 10 + '%', height: (b.ymax - b.ymin) / 10 + '%', width: (b.xmax - b.xmin) / 10 + '%' });
  });
  const end = () => {
    if (pen) {
      const { cv } = pen, q = cv.dataset.sketch, url = cv.toDataURL('image/png'); pen = null;
      if (U.ai?.photos) { U.ai.photos[q] = url; sketchOf.set(cv, `${q}|${cv.width}x${cv.height}|${url.length}`); }
      render(); return;
    }
    if (drag) { drag = null; render(); }
  };
  app.addEventListener('pointerup', end); app.addEventListener('pointercancel', end);
  // Code-Feld: Tab rückt ein (2 Leerzeichen), Shift+Tab rückt aus, Esc verlässt das Feld
  app.addEventListener('keydown', e => {
    const t = e.target; if (!t?.matches?.('textarea[data-code]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { t.blur(); return; }
    if (e.key !== 'Tab') return;
    e.preventDefault(); const s0 = t.selectionStart, s1 = t.selectionEnd, val = t.value;
    if (e.shiftKey) { const ls = val.lastIndexOf('\n', s0 - 1) + 1; if (val.slice(ls, ls + 2) === '  ') { t.value = val.slice(0, ls) + val.slice(ls + 2); t.setSelectionRange(Math.max(ls, s0 - 2), Math.max(ls, s1 - 2)); } }
    else { t.value = val.slice(0, s0) + '  ' + val.slice(s1); t.setSelectionRange(s0 + 2, s0 + 2); }
    if (t.dataset.bind) writeBind(t.dataset.bind, t.value);
  });
}
export async function studioShowcase() {
  const ps = [await demoPage(0), await demoPage(1)];
  const doc = await demoAnalyze({ id: 'showcase', ts: Date.now(), title: '', subject: '', subjectId: null, tools: [], pages: [], questions: [], source: 'demo', remixRound: 0 }, ps, null);
  doc.pages = [];
  for (const [i, p] of ps.entries()) { await imgPut(`page:showcase:${i}`, p.url); doc.pages.push({ key: `page:showcase:${i}`, w: p.w, h: p.h }); }
  await cropAll(doc);
  studioData().docs = [doc]; Object.assign(U.ai, { docId: doc.id, phase: 'cleaned' });
}

/* =========================================================================================
   8) SELBSTTESTS – await runStudioSelfTests() (Konsole oder UI-Testsuite)
   ========================================================================================= */
async function examSelfTests(check) {
  // 1) Noten & Teilpunkte
  check('1 Note 0 P = 1.0', swissGrade(0, 10) === 1); check('1 Note 50 % = 3.5', swissGrade(5, 10) === 3.5); check('1 Note 60 % = 4.0', swissGrade(6, 10) === 4);
  check('1 Note 100 % = 6.0', swissGrade(10, 10) === 6); check('1 Teilpunkte 2.5 / 4 P = 4.1', swissGrade(2.5, 4) === 4.1, String(swissGrade(2.5, 4))); check('1 Maximum 0 → 1.0', swissGrade(0, 0) === 1);
  // 2) Bounding-Box & Crop
  const n1 = normBox({ ymin: 0.1, xmin: 0.2, ymax: 0.3, xmax: 0.4 }), n2 = normBox({ ymin: 600, xmin: 700, ymax: 200, xmax: 100 }), n3 = normBox({ ymin: 990, xmin: 995, ymax: 1200, xmax: 1000 });
  check('2 normBox 0–1 → 0–1000', n1.xmin === 200 && n1.ymax === 300);
  check('2 normBox vertauschte Achsen', n2.ymin === 200 && n2.ymax === 600 && n2.xmin === 100 && n2.xmax === 700);
  check('2 normBox Randwerte', n3.ymax === 1000 && n3.ymax - n3.ymin >= 30 && n3.xmax - n3.xmin >= 30 && n3.xmax <= 1000);
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, 400, 400); cx.fillStyle = '#000'; cx.fillRect(100, 100, 200, 4); cx.fillRect(100, 296, 200, 4); cx.fillRect(100, 100, 4, 200); cx.fillRect(296, 100, 4, 200);
  const crop = await cropDiagramFromSource(cv.toDataURL('image/png'), { ymin: 250, xmin: 250, ymax: 750, xmax: 750 }, { pad: CROP_PAD });
  const im = await loadImg(crop), k2 = document.createElement('canvas'); k2.width = im.naturalWidth; k2.height = im.naturalHeight; const kx = k2.getContext('2d'); kx.drawImage(im, 0, 0);
  const dark = (x, y) => kx.getImageData(Math.round(x), Math.round(y), 1, 1).data[0] < 128;
  const innerW = im.naturalWidth - 2 * CROP_BORDER, srcW = 200 + 2 * CROP_PAD / 1000 * 400, sc = innerW / srcW, off = CROP_PAD / 1000 * 400;
  check('2 Crop ist gültiges JPEG', crop.startsWith('data:image/jpeg'));
  check('2 Weisser Rand + Sicherheitsrand vorhanden', !dark(3, 3) && !dark(CROP_BORDER + (off - 4) * sc, im.naturalHeight / 2));
  check('2 Ganze Abbildung sichtbar (alle 4 Kanten)', dark(CROP_BORDER + (off + 2) * sc, im.naturalHeight / 2) && dark(im.naturalWidth - CROP_BORDER - (off + 2) * sc, im.naturalHeight / 2) && dark(im.naturalWidth / 2, CROP_BORDER + (off + 2) * sc) && dark(im.naturalWidth / 2, im.naturalHeight - CROP_BORDER - (off + 2) * sc));
  // 3) 20 Seiten
  const all = Array.from({ length: 20 }, (_, i) => i), waves = batches(all, PAGE_BATCH);
  check('3 MAX_PAGES = 20', MAX_PAGES === 20);
  check('3 20 Seiten → 10 Wellen à 2, keine Seite fehlt', waves.length === 10 && waves.every(w => w.length === 2) && waves.flat().join() === all.join());
  await pureSelfTests(check);
}
// Reine Logik (ohne DOM) – läuft auch in Node
export async function pureSelfTests(check) {
  // 4) Demo & Remix-Validierung
  const d0 = demoQuestions(0), d1 = demoQuestions(1), m = demoMath(5), bw = demoBwl(4), both = [...d0, ...d1, ...demo2Questions(0), ...demo2Questions(1)];
  check('4 Mathe-Remix geht auf (Pythagoras, glatt)', m.a ** 2 + m.b ** 2 === m.c ** 2 && Number.isInteger(m.c) && Number.isInteger(m.A));
  check('4 BWL-Remix ganze Stückzahl (alle Runden)', Number.isInteger(bw.x) && [0, 1, 2, 3, 4, 5].every(r => Number.isInteger(+demoQuestions(r)[2].x.correctAnswer)));
  const dAll = [...d0, ...demo2Questions(0)];
  check('4 Demo (Beispiel 1 + 2) enthält alle Bausteine', KINDS.every(k => dAll.some(q => q.taskKind === k)) && KINDS.length >= 16 && d0.length === 16, KINDS.filter(k => !dAll.some(q => q.taskKind === k)).join());
  check('4 Remix unterscheidet sich vom Original', both.every(q => JSON.stringify(q.x) !== JSON.stringify(q.o)));
  check('4 Teilpunkte-Summe = maxPoints', both.every(q => rubricSum(q.o.rubricCriteria) === q.maxPoints && rubricSum(q.x.rubricCriteria) === q.maxPoints), both.filter(q => rubricSum(q.o.rubricCriteria) !== q.maxPoints).map(q => q.id).join());
  check('4 Je 3 Lernhinweise, Hinweis 3 ohne Endergebnis', both.every(q => [q.o, q.x].every(v => v.hints.length === 3 && v.hints.every(Boolean) && (!KIND[q.taskKind].auto || q.taskKind === 'label_image' || !v.hints[2].includes(keyText(q.taskKind, v))))));
  check('4 Demo-Daten überstehen die Normalisierung unverändert', both.every(q => [q.o, q.x].every(v => { const n = normVariant(q.taskKind, v, v, 'solve', q.maxPoints); return n.kind === q.taskKind && !n.v.noKey; })));
  check('4 Musterlösung gibt volle Punkte (alle Auto-Bausteine, Original + Remix)', both.every(q => [q.o, q.x].every(v => !KIND[q.taskKind].auto || autoGrade(q.taskKind, v, solutionAnswer(q.taskKind, v), q.maxPoints)?.points === q.maxPoints)),
    both.filter(q => KIND[q.taskKind].auto && autoGrade(q.taskKind, q.o, solutionAnswer(q.taskKind, q.o), q.maxPoints)?.points !== q.maxPoints).map(q => q.id).join());
  check('4 fixRubric repariert falsche Summe', rubricSum(fixRubric(['1 P: a', '1 P: b'], 4, 'math_calculation')) === 4 && rubricSum(fixRubric([], 2.5, 'essay_open_text')) === 2.5 && rubricSum(fixRubric([], 1, 'math_calculation')) === 1 && rubricSum(fixRubric(null, 3, 'multiple_choice')) === 3);
  // 5) Mischen stabil
  const doc = { source: 'demo', questions: d0.map(d => ({ id: d.id, questionNumber: d.questionNumber, taskKind: d.taskKind, maxPoints: d.maxPoints, originalQuestion: d.o, remixedQuestion: d.x })) };
  const ids = doc.questions.map(q => q.id), ans0 = { q1: { work: '', result: 'c = 10 cm' }, q2: 1, q3: { value: '600', unit: 'Stück' } }, hints0 = { q1: 1, q3: 2 }, before = JSON.stringify([ans0, hints0]);
  let seed = 7; const order = shuffledOrder(doc, () => (seed = (seed * 9301 + 49297) % 233280) / 233280), list = orderedQs(doc, order);
  check('5 Mischen ist eine Permutation', [...order].sort().join() === [...ids].sort().join() && list.length === ids.length && order.join() !== ids.join());
  check('5 Antworten & Tipps bleiben bei ihrer Aufgabe', JSON.stringify([ans0, hints0]) === before && list.find(q => q.id === 'q3').originalQuestion.correctAnswer === '600');
  check('5 Ungültige Reihenfolge → Original', orderedQs(doc, ['q99']).map(q => q.id).join() === ids.join());
  // 6) Bewertung (Demo, alle Bausteine) + Lernhinweis-Abzug
  const perfect = Object.fromEntries(doc.questions.map(q => [q.id, solutionAnswer(q.taskKind, q.originalQuestion)])), maxAll = doc.questions.reduce((s, q) => s + q.maxPoints, 0);
  const gP = await gradeAnswers(doc, doc.questions, 'original', perfect, { q13: 'data:image/png;base64,AAAA' }), sumP = Object.values(gP).reduce((s, r) => s + r.points, 0);
  check('6 Musterlösungen ≈ volle Punktzahl (Demo)', sumP >= maxAll - 3, `${sumP}/${maxAll}`);
  const g0 = await gradeAnswers(doc, doc.questions, 'original', initAnswers(doc.questions, 'original'));
  check('6 Leere Abgabe = 0 (ausser ungeschobener Reihenfolge)', doc.questions.every(q => q.taskKind === 'ordering' || g0[q.id].points === 0));
  check('6 Nur halbe Punkte', Object.values(gP).concat(Object.values(g0)).every(r => Number.isInteger(r.points * 2)));
  const gH = await gradeAnswers(doc, doc.questions, 'original', perfect, {}, { q2: 1, q3: 2, q5: 4 });
  check('6 Lernhinweis-Abzug in der Bewertung', gH.q2.points === 1.5 && gH.q3.points === 1.5 && gH.q5.points === 0 && gH.q2.raw === 2 && /Lernhinweis 1/.test(gH.q2.feedback), `${gH.q2.points}/${gH.q3.points}/${gH.q5.points}`);
  // 11) Notenskalen CH / DE / AT
  const ch = gradeFor('CH', 6, 10), de = gradeFor('DE', 92, 100), de2 = gradeFor('DE', 49.5, 100), at = gradeFor('AT', 89, 100), at2 = gradeFor('AT', 49, 100);
  check('11 CH 60 % = 4.0 genügend', ch.grade === 4 && ch.pass && ch.label === '4.0', JSON.stringify(ch));
  check('11 CH unter 60 % ungenügend, 0.5-Anzeige', !gradeFor('CH', 5.5, 10).pass && gradeFor('CH', 8.7, 10).half === 5.5);
  check('11 DE 92 % = 1, 49.5 % = 5 (nicht bestanden)', de.grade === 1 && de.pass && de2.grade === 5 && !de2.pass);
  check('11 DE Grenzen 81/67/50/30', [81, 67, 50, 30, 29].map(p => gradeFor('DE', p, 100).grade).join() === '2,3,4,5,6');
  check('11 AT 89 % Sehr gut, 49 % Nicht genügend', at.grade === 1 && at.text === 'Sehr gut' && at2.grade === 5 && !at2.pass);
  check('11 AT Grenzen 76/63/50', [76, 63, 50].map(p => gradeFor('AT', p, 100).grade).join() === '2,3,4');
  const rCH = scaleRows('CH', 20), rDE = scaleRows('DE', 24), rAT = scaleRows('AT', 10);
  check('11 Skala CH: 4.0 ab 12 P, 6.0 ab 20 P von 20', rCH.find(r => r.grade === 4).minPoints === 12 && rCH.find(r => r.grade === 6).minPoints === 20 && rCH.at(-1).minPoints === 0);
  check('11 Skala DE/AT: Mindestpunkte steigen', rDE.length === 6 && rDE[0].minPoints === 22.5 && rDE.at(-1).minPoints === 0 && rAT.length === 5 && rAT.every((r, i) => !i || r.minPoints <= rAT[i - 1].minPoints));
  check('11 Unbekanntes Land → CH, Max 0 sicher', gradeFor('XX', 5, 10).label === '3.5' && gradeFor('DE', 0, 0).grade === 6 && scaleRows('CH', 0).every(r => r.minPoints === 0));
  check('11 Riesige Punktzahl hängt nicht', scaleRows('CH', 1e9).length === 11);
  // 12) Lernhinweis-Abzug
  check('12 HINT_PENALTY', HINT_PENALTY.join() === '0,0.25,0.5,0.75,1' && hintPenalty(2) === 0.5 && hintPenalty(9) === 1 && hintPenalty(-1) === 0);
  check('12 applyHints rundet auf halbe Punkte ab', applyHints(4, 4, 1) === 3 && applyHints(3, 3, 1) === 2 && applyHints(1, 1, 1) === 0.5 && applyHints(2, 2, 3) === 0.5 && applyHints(5, 5, 4) === 0 && applyHints(2, 4, 0) === 2);
  // 13) Automatische Bewertung je Baustein inkl. Teilpunkte
  const Q = id => doc.questions.find(q => q.id === id), G = (id, a) => autoGrade(Q(id).taskKind, Q(id).originalQuestion, a, Q(id).maxPoints);
  check('13 single_choice', G('q2', 1).points === 2 && G('q2', 0).points === 0);
  check('13 multi_select Teilpunkte', G('q5', [0, 1]).points === 2 && G('q5', [0]).points === 1 && G('q5', [0, 2]).points === 0 && G('q5', [0, 1, 2]).points === 1);
  check('13 true_false Teilpunkte', G('q6', [true, false, true, false]).points === 2 && G('q6', [true, false, null, null]).points === 1 && G('q6', ['1', '0', '1', '0']).points === 2);
  check('13 fill_blanks tolerant', G('q7', [' wasserstoff', 'SAUERSTOFF.', 'H₂O']).points === 3 && G('q7', ['Wasserstoff', 'Sauerstoff', 'h2o']).points === 3 && G('q7', ['Wasserstoff', 'x', '']).points === 1 && G('q7', ['Wasserstoff', 'x', '']).open);
  check('13 matching Teilpunkte', G('q8', [2, 0, 1]).points === 3 && G('q8', [2, 1, 0]).points === 1 && G('q8', [null, null, 1]).points === 1);
  check('13 ordering Teilpunkte', G('q10', [0, 1, 2, 3]).points === 2 && G('q10', [3, 2, 1, 0]).points === 0 && G('q10', [0, 2, 1, 3]).points === 1 && G('q10', [0, 1]).points === 0);
  check('13 numeric: Komma, Einheit, Toleranz', G('q3', { value: '600', unit: 'Stk.' }).points === 3 && G('q3', { value: '600,0', unit: 'stück' }).points === 3 && G('q3', { value: '600 Stück', unit: '' }).points === 3
    && G('q3', { value: '600', unit: '' }).points === 1.5 && G('q3', { value: '605', unit: 'Stück' }).points === 0 && G('q3', { value: '620', unit: 'Stück' }).points === 0 && G('q3', { value: 'abc', unit: '' }).points === 0);
  check('13 numeric: Tausendertrennzeichen', parseNum("12'000.5").n === 12000.5 && parseNum('1 000,5 m').n === 1000.5 && parseNum('1 000,5 m').rest === 'm' && parseNum('−3/4').n === -0.75 && parseNum('c = 10 cm').n === 10);
  check('13 textEq: keine Scheintreffer bei Formeln/Jahren', !textEq('CO2', 'H2O') && !textEq('H2', 'H2O') && !textEq('3x', '3') && !textEq('1849', '1848') && textEq('2,5 cm', '2.5') && textEq('x = 4', '4') && textEq('−1', '-1') && textEq('600 Stück', '600'));
  check('13 categorize Teilpunkte', G('q16', [0, 0, 1, 1, 0, 1]).points === 3 && G('q16', [0, 0, 1, 1, 0, 0]).points === 2.5 && G('q16', [1, 1, 0, 0, 1, 0]).points === 0);
  check('13 table_fill tolerant', G('q14', { '0,1': '−1', '0,2': '1', '0,3': '3', '0,4': '5' }).points === 2 && G('q14', { '0,1': '-1', '0,2': '1' }).points === 1);
  check('13 label_image Alternativen', G('q9', ['zellwand', 'Nukleus', 'Chloroplasten']).points === 3 && G('q9', ['Zellwand', '', '']).points === 1);
  check('13 graph_plot Gerade + Punkte', G('q15', [[0, 1], [2, 2]]).points === 2 && G('q15', [[-2, 0], [4, 3]]).points === 2 && G('q15', [[0, 1], [1, 3]]).points === 0.5 && G('q15', [[0, 0]]).points === 0
    && autoGrade('graph_plot', normVariant('graph_plot', { text: 'Punkte', axes: {} }, { points: [[1, 1], [2, 2]] }).v, [[1, 1], [3, 3]], 2).points === 0.5);
  check('13 short_answer / formula exakt, sonst KI', G('q11', 'Went').points === 1 && G('q11', 'gone') === null && G('q12', '2H2 + O2 -> 2H2O').points === 2 && G('q12', 'O₂ + 2 H₂ → 2 H₂O').points === 2 && G('q12', 'H2 + O2 -> H2O') === null);
  check('13 Rechnen/Freitext/Skizze → KI', G('q1', { work: 'x', result: '10' }) === null && G('q4', 'Text') === null && G('q13', 'x') !== undefined);
  check('13 Leere Antworten → 0', ['q1', 'q2', 'q3', 'q5', 'q6', 'q7', 'q8', 'q9', 'q14', 'q15', 'q16'].every(id => G(id, emptyAnswer(Q(id).taskKind, Q(id).originalQuestion)).points === 0));
  check('13 Ordering-Startreihenfolge nie gelöst', Array.from({ length: 30 }).every(() => emptyAnswer('ordering', Q('q10').originalQuestion).join() !== '0,1,2,3'));
  // 14) Normalisierung kaputter KI-Daten
  const N = (k, s, key, mode = 'solve') => normVariant(k, s, key, mode, 2);
  check('14 Unbekannter Baustein + Zahlen → Rechnen', N('banana', { text: 'Berechne 3 + 4' }).kind === 'math_calculation' && N(undefined, { text: 'Nenne die Hauptstadt' }).kind === 'short_answer');
  check('14 Alte Namen werden abgebildet', N('multiple_choice', { text: 'a?', options: ['x', 'y'] }, { correctOption: 1 }).kind === 'single_choice' && kindOf('diagram_analysis') === 'short_answer' && kindOf('MC') === 'single_choice');
  check('14 Choice ohne Optionen → Rückfall', N('single_choice', { text: 'Was ist 2 + 2?', options: [] }).kind === 'math_calculation' && N('multi_select', { text: 'Welche?', options: ['nur eine'] }).kind === 'short_answer');
  const sc1 = N('single_choice', { text: 'a?', options: ['A) Bern', 'B) Zürich'] }, { correctOption: 'B' }), sc2 = N('single_choice', { text: 'a?', options: ['Bern', 'Zürich'] }, { correctOption: 7, correctAnswer: 'bern' });
  check('14 correctOption als Buchstabe / per Text', sc1.v.correctOption === 1 && sc2.v.correctOption === 0 && !sc2.v.noKey && N('single_choice', { text: 'a?', options: ['x', 'y'] }, {}).v.noKey);
  check('14 true_false aus Strings, "richtig"/"falsch"', (n => n.kind === 'true_false' && n.v.statements.map(s => s.correct).join() === 'true,false,')(N('true_false', { text: 'R/F', statements: ['A', { text: 'B' }, 'C'] }, { statements: [{ correct: 'richtig' }, { correct: 'falsch' }, { correct: 'vielleicht' }] }))
    && N('true_false', { text: 'R/F', statements: ['A'] }, { statements: [{ correct: 'ja' }] }).v.statements[0].correct === true);
  check('14 fill_blanks ohne Lücke → Rückfall, ____ → ___', N('fill_blanks', { text: 'Kein Platz' }).kind === 'short_answer' && N('fill_blanks', { text: 'A ______ B ____' }, { blanks: [['x', 'y'], 'z'] }).v.blanks.join() === 'x|y,z');
  check('14 matching kaputte pairs → noKey, Paare als [l,r]', N('matching', { text: 'z', left: ['a', 'b'], right: ['1', '2'] }, { pairs: ['x', 9] }).v.noKey && N('matching', { text: 'z', left: ['a', 'b'], right: ['1', '2'] }, { pairs: [[0, 1], [1, 0]] }).v.pairs.join() === '1,0');
  check('14 Remix mischt identische Zuordnung', (v => v.pairs.some((p, i) => p !== i) && v.pairs.every((p, i) => v.right[p] === ['1', '2', '3'][i]))(N('matching', { text: 'z', left: ['a', 'b', 'c'], right: ['1', '2', '3'], pairs: [0, 1, 2] }, null, 'remix').v));
  check('14 ordering: Lösung als Texte oder Indizes', N('ordering', { text: 'o', items: ['b', 'a', 'c'] }, { items: ['A', 'B', 'C'] }).v.items.join() === 'a,b,c' && N('ordering', { text: 'o', items: ['b', 'a', 'c'] }, { order: [1, 0, 2] }).v.items.join() === 'a,b,c' && N('ordering', { text: 'o', items: ['b', 'a'] }, { items: ['x'] }).v.noKey);
  check('14 table_fill ohne Lücken → Rückfall, Lösung gemappt', N('table_fill', { text: 'T 1', rows: [['1', '2']] }).kind === 'math_calculation' && N('table_fill', { text: 'T', columns: ['a', 'b'], rows: [['1', null], ['2', '']] }, { solution: [[null, 2], [null, '4']] }).v.solution.flat().join() === ',2,,4');
  check('14 label_image 0–1 Koordinaten, ohne Marker → Rückfall', N('label_image', { text: 'L', markers: [{ x: 0.5, y: 0.25 }] }, { labels: ['x'] }).v.markers[0].x === 500 && N('label_image', { text: 'L', markers: 'kaputt' }).kind === 'short_answer');
  check('14 graph_plot Achsen-Standard + Linie', (v => v.axes.xmin === -5 && v.axes.step === 1 && v.line.m === 2 && !v.noKey)(N('graph_plot', { text: 'g', axes: { xmin: 5, xmax: 1 } }, { line: { m: '2', q: 0 } }).v) && N('graph_plot', { text: 'g', axes: { xmin: 0, xmax: 1000, ymin: 0, ymax: 1000, step: 1 } }).v.axes.step === 100);
  check('14 categorize Gruppen per Name', N('categorize', { text: 'c', groups: ['A', 'B'], items: ['x', 'y'] }, { itemGroup: ['b', 0] }).v.itemGroup.join() === '1,0');
  check('14 numeric Einheit aus Lösung gelöst', (v => v.correctAnswer === '12.5' && v.unit === 'cm' && v.tolerance === 0.01)(N('numeric', { text: 'n' }, { correctAnswer: '12,5 cm', tolerance: 7 }).v) && N('numeric', { text: 'n' }, { correctAnswer: 'gross' }).v.noKey);
  const junk = [null, 5, 'x', [], { text: null, options: 'a' }, { taskKind: 'matching', left: [null, {}], right: 3 }];
  let crashed = ''; for (const j of junk) for (const k of [...KINDS, 'xx']) for (const mode of ['extract', 'solve', 'remix']) { try { const n = normVariant(k, j, j, mode, 2); if (!KIND[n.kind] || n.v.hints.length !== 3) crashed = k; emptyAnswer(n.kind, n.v); autoGrade(n.kind, n.v, null, 2); } catch (e) { crashed = `${k}/${mode}: ${e.message}`; } }
  check('14 Kaputte KI-Daten: nie Absturz, immer 3 Hinweise', !crashed, crashed);
  const old = migrateDoc({ questions: [{ id: 'q1', taskKind: 'multiple_choice', maxPoints: 2, originalQuestion: { text: 'Welche?', options: ['a', 'b'], correctOption: 1, hints: ['Tipp', ''], rubricCriteria: [] } }] });
  check('14 Alte Prüfung wird migriert', old.questions[0].taskKind === 'single_choice' && old.questions[0].originalQuestion.hints.length === 3 && old.questions[0].originalQuestion.hints[0] === 'Tipp' && old.timeLimitMin === null && migrateDoc(old) === old);
  // 16) Gemeinsames Material
  const cm = collectMaterials([{ label: 'M1', type: 'Lesetext', text: 'Teil eins' }, null, 'x', { label: 'm 1', text: 'Teil zwei' }, { label: 'M2', graphic: { ymin: 0.1, xmin: 0.1, ymax: 0.5, xmax: 0.9 } }, { label: 'M3' }]);
  check('16 Material: Seiten zusammengeführt, Bild-Rahmen, kaputte Einträge ignoriert', cm.length === 3 && cm[0].text === 'Teil eins\nTeil zwei' && cm[1].box?.xmax === 900 && cm[0].id === 'm1' && cm[1].kind === 'Abbildung', JSON.stringify(cm.map(m => m.label)));
  check('16 Material: Verweis über Bezeichnung', linkRef(cm, 'M1') === 'm1' && linkRef(cm, 'Material M2') === 'm2' && linkRef(cm, 'M9') === null && linkRef(cm, '') === null && linkRef(null, 'M1') === null);
  const ld = linkDoc({ questions: [{ id: 'a', matRef: 'M1' }, { id: 'b', matRef: 'M3' }, { id: 'c' }] }, [{ label: 'M1', text: 'T' }, { label: 'M2', text: 'U' }, { label: 'M3' }]);
  check('16 Material: nur genutzt und mit Inhalt', ld.materials.length === 1 && ld.questions[0].materialId === 'm1' && ld.questions[1].materialId === null && ld.questions[2].materialId === null && !('matRef' in ld.questions[0]));
  const mdoc = { questions: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, materialId: i === 1 || i === 2 ? 'm1' : null })) };
  check('16 Mischen hält Aufgaben zum selben Material zusammen', Array.from({ length: 20 }).every(() => { const o = shuffledOrder(mdoc); return o.length === 6 && new Set(o).size === 6 && o.indexOf('c') === o.indexOf('b') + 1; }));
  const d2 = demo2Questions(0);
  check('16 Demo 2: Lesetext mit mindestens 2 Aufgaben', DEMO2_MATS.length === 1 && DEMO2_MATS[0].text.split('\n').length >= 5 && d2.filter(q => q.mat === 'm1').length >= 2);
  // 17) Prüfungsteile
  const np = normParts([{ title: 'Teil A – ohne Hilfsmittel', timeLimitMin: '20', tools: [] }, { title: 'teil a – ohne hilfsmittel', tools: ['x'] }, { title: 'Teil B', timeLimitMin: 999, tools: 'Rechner' }, null, { title: '' }]);
  check('17 Teile: zusammengeführt, Zeit/Hilfsmittel geprüft', np.length === 2 && np[0].timeLimitMin === 20 && np[0].tools.length === 0 && np[1].timeLimitMin === null && np[1].tools === null, JSON.stringify(np));
  const pd = linkDoc({ timeLimitMin: null, questions: [{ id: 'a', partRef: 'Teil A' }, { id: 'b' }, { id: 'c', partRef: 'B' }, { id: 'd' }] }, [], [{ title: 'Teil A', timeLimitMin: 20, tools: [] }, { title: 'Teil B', timeLimitMin: 40, tools: ['Taschenrechner'] }]);
  check('17 Teile: Aufgaben ohne Angabe gehören zum vorherigen Teil, Zeit = Summe', pd.questions.map(q => q.partId).join() === 'p1,p1,p2,p2' && pd.timeLimitMin === 60 && pd.parts.length === 2);
  const one = linkDoc({ timeLimitMin: null, questions: [{ id: 'a', partRef: 'Teil A' }] }, [], [{ title: 'Teil A', timeLimitMin: 25 }]);
  check('17 Nur ein Teil → keine Teile, Zeit übernommen', one.parts.length === 0 && one.questions[0].partId === null && one.timeLimitMin === 25);
  const pa = { order: [], qi: 0 }; pd.tools = ['Taschenrechner'];
  check('17 Rechner nur im erlaubten Teil', !calcAllowed(pd, pa) && (pa.qi = 2, calcAllowed(pd, pa)) && curPart(pd, pa).id === 'p2' && calcAllowed({ tools: ['Taschenrechner'], questions: [] }, pa) && !calcAllowed({ tools: [], questions: [] }, pa));
  partStart(pa, 'p1'); pa.partRun.t0 -= 60000;
  check('17 Teilzeit läuft nur im aktiven Teil', Math.abs(partLeft(pa, pd.parts[0]) - 19 * 60000) < 300 && partLeft(pa, pd.parts[1]) === 40 * 60000 && partClock(pa, pd.parts[1]) === '40:00');
  partSwitch(pa, 'p2'); pa.partRun.t0 -= 30000;
  check('17 Teilwechsel speichert verbrauchte Zeit', Math.abs(partSpent(pa, 'p1') - 60000) < 300 && Math.abs(partSpent(pa, 'p2') - 30000) < 300 && partLeft(pa, { id: 'x' }) === null && partShort({ title: 'Teil B – mit Rechner' }) === 'Teil B');
  check('17 Mischen: Teile bleiben in Reihenfolge', Array.from({ length: 10 }).every(() => { const o = shuffledOrder(pd); return o.slice(0, 2).sort().join() === 'a,b' && o.slice(2).sort().join() === 'c,d'; }));
  // 18) text_select (im Text markieren)
  check('18 Text zerlegen: Wörter + Satzzeichen', tokenize('Der Hund, der bellt.').join('|') === 'Der|Hund|,|der|bellt|.' && tokenize("Zürich's z.B. 3.5").length >= 4 && tokenize(null).length === 0 && joinTokens(['Der', 'Hund', ',', 'der', 'bellt', '.']) === 'Der Hund, der bellt.');
  check('18 [[…]] markiert Lösungs-Tokens', (m => m.idx.join() === '1,3' && m.tokens.length === 5)(markedTokens('Der [[Hund]] bellt [[laut]].')) && markedTokens('').tokens.length === 0);
  const TS = { text: 'Markiere', selectText: 'Der Hund bellt laut.' };
  check('18 Lösung als Indizes, als markierter Text, als Wörter', N('text_select', TS, { correct: [1, '3', 99] }).v.correct.join() === '1,3' && N('text_select', TS, { markedText: 'Der [[Hund]] bellt laut.' }).v.correct.join() === '1'
    && N('text_select', TS, { correctTokens: ['laut', 'xyz'] }).v.correct.join() === '3' && N('text_select', TS, {}).v.noKey && N('text_select', { text: 'x', selectText: 'Ein' }).kind === 'short_answer');
  check('18 Remix: neuer Text mit [[…]]', (v => v.tokens.length === 5 && v.correct.join() === '2' && !v.tokens.join('').includes('['))(N('text_select', { text: 'M', selectText: 'Die Katze [[schlaft]] hier.' }, null, 'remix').v) && N(undefined, { text: 'x', tokens: ['a', 'b'] }).kind === 'text_select');
  const tsv = N('text_select', TS, { correct: [1, 3] }).v;
  check('18 Bewertung: richtig minus falsch, nie unter 0', autoGrade('text_select', tsv, [1, 3], 2).points === 2 && autoGrade('text_select', tsv, [1], 2).points === 1 && autoGrade('text_select', tsv, [1, 3, 0], 2).points === 1
    && autoGrade('text_select', tsv, [0, 2], 2).points === 0 && autoGrade('text_select', tsv, [], 2).points === 0 && keyText('text_select', tsv) === 'Hund · laut');
  // 19) image_hotspot (Stelle antippen)
  const HS = N('image_hotspot', { text: 'Tippe', regions: [{ x: 200, y: 300, r: 50, label: 'A' }, [800, 500], { x: 'kaputt' }] }, { correctRegions: [0, 7] });
  check('19 Stellen normalisiert, Lösung aus correctRegions', HS.kind === 'image_hotspot' && HS.v.regions.length === 2 && HS.v.regions[1].r === 60 && HS.v.targets.length === 1 && HS.v.targets[0].x === 200 && !HS.v.noKey && keyText('image_hotspot', HS.v) === 'A');
  check('19 0–1-Koordinaten, ohne Stellen → Rückfall, ohne Lösung → noKey', (t => t.x === 500 && t.r === 50)(N('image_hotspot', { text: 'T', regions: [{ x: 0.5, y: 0.5, r: 0.05 }] }, { correctRegions: [0] }).v.targets[0])
    && N('image_hotspot', { text: 'Tippe auf', regions: [] }).kind === 'short_answer' && N('image_hotspot', { text: 'T', regions: [{ x: 1, y: 1 }] }, { correctRegions: [5] }).v.noKey);
  check('19 Bewertung: in der Stelle voll, daneben 0', autoGrade('image_hotspot', HS.v, [215, 320], 1).points === 1 && autoGrade('image_hotspot', HS.v, [800, 500], 1).points === 0 && autoGrade('image_hotspot', HS.v, null, 1).points === 0
    && autoGrade('image_hotspot', HS.v, ['x', 'y'], 1).points === 0 && emptyAnswer('image_hotspot', HS.v) === null && solutionAnswer('image_hotspot', HS.v).join() === '200,300');
  // 20) code
  const CV = N('code', { text: 'Schreibe', language: 'SQL', starter: 'SELECT ___\r\nFROM t;  ' }, { correctAnswer: '  SELECT a\n  FROM t;  ' });
  check('20 code: Sprache, Vorgabe, Musterlösung mit Einrückung', CV.kind === 'code' && CV.v.language === 'sql' && CV.v.starter === 'SELECT ___\nFROM t;' && CV.v.correctAnswer === 'SELECT a\n  FROM t;' && rubricSum(CV.v.rubricCriteria) === 2);
  check('20 code: Vergleich tolerant (SQL), Python-Einrückung zählt', codeEq('select a from t', 'SELECT a\nFROM t;', 'sql') && codeEq('SELECT a FROM t WHERE x>1', 'SELECT a FROM t WHERE x > 1;', 'sql') && !codeEq('SELECT b FROM t', 'SELECT a FROM t', 'sql')
    && codeEq('if x:\n    y = 1', 'if x:\n    y=1', 'python') && !codeEq('if x:\ny = 1', 'if x:\n    y = 1', 'python') && !codeEq('', '', 'sql'));
  check('20 code: Treffer = voll, sonst KI', autoGrade('code', CV.v, 'select a from t', 2).points === 2 && autoGrade('code', CV.v, 'SELECT z FROM t', 2) === null && emptyAnswer('code', CV.v) === '');
  const cdoc = { source: 'demo', questions: [{ id: 'c1', taskKind: 'code', maxPoints: 2, originalQuestion: CV.v }] };
  const gC = await gradeAnswers(cdoc, cdoc.questions, 'original', { c1: 'SELECT ___\nFROM t;' }), gC2 = await gradeAnswers(cdoc, cdoc.questions, 'original', { c1: 'SELECT b' });
  check('20 code: unveränderter Vorgabecode = nicht beantwortet, Demo gibt Teilpunkte', gC.c1.points === 0 && /Nicht beantwortet/.test(gC.c1.feedback) && gC2.c1.points > 0 && gC2.c1.points < 2, `${gC.c1.feedback} / ${gC2.c1.points}`);
  // 21) number_line (Zahlen-/Zeitstrahl)
  const NL = N('number_line', { text: 'Z', min: -3, max: 3, step: 0.5 }, { points: [2.5, '-1,5', 9, 'x'] });
  check('21 Zahlenstrahl normalisiert, Werte im Bereich', NL.kind === 'number_line' && NL.v.points.join() === '-1.5,2.5' && NL.v.step === 0.5 && keyText('number_line', NL.v) === '−1.5 · 2.5'
    && (v => v.min === 0 && v.max === 10 && v.step > 0 && v.noKey)(N('number_line', { text: 'Z', min: 5, max: 1 }).v) && N('number_line', { text: 'Z', min: 0, max: 1000, step: 0.01 }).v.step === 100);
  check('21 Bewertung mit Teilpunkten', autoGrade('number_line', NL.v, [-1.5, 2.5], 2).points === 2 && autoGrade('number_line', NL.v, [-1.5], 2).points === 1 && autoGrade('number_line', NL.v, [-1.5, 0, 2.5], 2).points === 1.5
    && autoGrade('number_line', NL.v, [-1, 2], 2).points === 0 && autoGrade('number_line', NL.v, [], 2).points === 0 && !isEmptyAns('number_line', [-1]) && isEmptyAns('number_line', ['x']));
  check('21 Zeitstrahl mit Jahren', (v => autoGrade('number_line', v, [1291, 1848], 2).points === 2 && autoGrade('number_line', v, [1290, 1848], 2).points === 0.5)(N('number_line', { text: 'Z', min: 1200, max: 2000, step: 1 }, { points: [1291, 1848] }).v));
  // 22) Wertungsarten, Dropdown/Wortbank, «nicht im Text»
  check('22 normScoring + tfVal', normScoring('Kprim') === 'kprim' && normScoring('all') === 'all_or_nothing' && normScoring('alles oder nichts') === 'all_or_nothing' && normScoring('Abzug') === 'minus' && normScoring('xyz') === 'partial' && normScoring(null) === 'partial'
    && tfVal('nicht im Text') === 'ng' && tfVal('Not given') === 'ng' && tfVal('richtig') === true && tfVal('0') === false && tfVal('vielleicht') === null);
  const MSo = { text: 'W?', options: ['a', 'b', 'c', 'd'] }, MS = sc => N('multi_select', { ...MSo, scoring: sc }, { correctOptions: [0, 2] }).v;
  check('22 multi_select: all_or_nothing, kprim, minus, partial', autoGrade('multi_select', MS('all_or_nothing'), [0, 2], 2).points === 2 && autoGrade('multi_select', MS('all_or_nothing'), [0], 2).points === 0
    && autoGrade('multi_select', MS('kprim'), [0, 2], 2).points === 2 && autoGrade('multi_select', MS('kprim'), [0], 2).points === 1 && autoGrade('multi_select', MS('kprim'), [1], 2).points === 0 && autoGrade('multi_select', MS('kprim'), [0, 1, 2], 2).points === 1
    && autoGrade('multi_select', MS('minus'), [0, 1], 2).points === 0 && autoGrade('multi_select', MS('partial'), [0], 2).points === 1 && MS('falsch').scoring === 'partial');
  const TFo = { text: 'R/F', statements: ['A', 'B', 'C', 'D'] }, TF = (sc, ks) => N('true_false', { ...TFo, scoring: sc }, { statements: ks }).v, KS = [true, false, 'nicht im Text', true].map(c => ({ correct: c }));
  const tfn = TF('partial', KS);
  check('22 true_false «nicht im Text»', tfn.notGiven && tfn.statements[2].correct === 'ng' && autoGrade('true_false', tfn, [true, false, 'ng', true], 2).points === 2 && autoGrade('true_false', tfn, [true, false, false, true], 2).points === 1.5 && /nicht im Text/.test(keyText('true_false', tfn)) && !N('true_false', TFo, { statements: [{ correct: true }] }).v.notGiven);
  check('22 true_false: kprim, minus, all_or_nothing', autoGrade('true_false', TF('kprim', KS), [true, false, 'ng', false], 2).points === 1 && autoGrade('true_false', TF('kprim', KS), [true, true, 'ng', false], 2).points === 0
    && autoGrade('true_false', TF('minus', KS), [true, false, false, null], 2).points === 0.5 && autoGrade('true_false', TF('minus', KS), [false, true, true, null], 2).points === 0 && autoGrade('true_false', TF('all_or_nothing', KS), [true, false, 'ng', null], 2).points === 0);
  const FB = N('fill_blanks', { text: 'A ___ B ___ C ___', blankOptions: [['x', 'y'], ['nur'], 'kaputt'], wordBank: ['p', 'q', null] }, { blanks: ['x', 'z', 'w'] }).v;
  check('22 fill_blanks: Dropdown je Lücke (≥ 2 Optionen), Wortbank', FB.blankOptions.length === 3 && FB.blankOptions[0].join() === 'x,y' && !FB.blankOptions[1].length && !FB.blankOptions[2].length && FB.wordBank.join() === 'p,q'
    && N('fill_blanks', { text: 'A ___' }, { blanks: ['x'] }).v.blankOptions.length === 0 && autoGrade('fill_blanks', FB, ['x', 'z', 'w'], 3).points === 3);
  const rq = { taskKind: 'true_false', maxPoints: 2, originalQuestion: tfn }, rx = remixFrom({ ...rq, originalQuestion: TF('kprim', KS) }, { text: 'Neu', statements: [{ text: 'E', correct: 'ng' }, { text: 'F', correct: true }, { text: 'G', correct: false }, { text: 'H', correct: true }] });
  check('22 Remix behält Wertung und «nicht im Text»', rx && rx.scoring === 'kprim' && rx.notGiven && rx.statements[0].correct === 'ng');
  // 15) Timer-Helfer
  const ta = {}, t1 = timerStart(ta, 45), now = Date.now();
  check('15 Countdown startet mit Limit', ta.timer === t1 && t1.mode === 'down' && t1.limitMs === 2700000 && Math.abs(timerLeft(t1) - 2700000) < 200);
  t1.t0 = now - 60000; check('15 Countdown zählt herunter', Math.abs(timerLeft(t1) - 2640000) < 200);
  timerPause(t1); const lp = timerLeft(t1); t1.acc += 0; check('15 Pause hält an', t1.paused && Math.abs(timerLeft(t1) - lp) < 5);
  timerResume(t1); check('15 Fortsetzen', !t1.paused && Math.abs(timerLeft(t1) - lp) < 200);
  t1.acc = 99e6; check('15 Countdown nie negativ', timerLeft(t1) === 0);
  const t2 = timerStart({}, 0); t2.t0 = Date.now() - 5000; check('15 Stoppuhr zählt hoch', t2.mode === 'up' && Math.abs(timerLeft(t2) - 5000) < 200);
  check('15 fmtClock', fmtClock(0) === '00:00' && fmtClock(65000) === '01:05' && fmtClock(3725000) === '1:02:05' && fmtClock(-5) === '00:00' && timerLeft(null) === 0 && clockText(null) === '');
}
export async function runStudioSelfTests() {
  const rows = [], check = (name, ok, detail = '') => rows.push({ Test: name, Ergebnis: ok ? '✅ PASS' : '❌ FAIL', Detail: detail });
  try { await examSelfTests(check); } catch (e) { check('Exam-Selbsttests ohne Absturz', false, e.message); }
  // 7) Scanner: Seite finden + gerade ziehen
  const H0 = homography([[0, 0], [100, 0], [100, 50], [0, 50]], [[10, 20], [110, 25], [105, 80], [5, 70]]);
  check('7 Homographie trifft alle 4 Ecken', H0 && [[0, 0, 10, 20], [100, 0, 110, 25], [100, 50, 105, 80], [0, 50, 5, 70]].every(([x, y, u, v]) => { const [a, b] = applyH(H0, x, y); return Math.abs(a - u) < 1e-6 && Math.abs(b - v) < 1e-6; }));
  const ph = document.createElement('canvas'); ph.width = 320; ph.height = 240; const pc = ph.getContext('2d', { willReadFrequently: true });
  pc.fillStyle = '#5a4636'; pc.fillRect(0, 0, 320, 240); const Q = [[70, 30], [262, 52], [245, 214], [52, 196]];
  pc.fillStyle = '#f4f1ea'; pc.beginPath(); Q.forEach(([x, y], i) => i ? pc.lineTo(x, y) : pc.moveTo(x, y)); pc.closePath(); pc.fill();
  const fq = detectDocumentQuad(pc.getImageData(0, 0, 320, 240));
  check('7 Seite im Foto gefunden (Ecken ±6 px)', !!fq && fq.every((p, i) => Math.hypot(p[0] - Q[i][0], p[1] - Q[i][1]) < 6), JSON.stringify(fq));
  const flat = document.createElement('canvas'); flat.width = 320; flat.height = 240; const fc = flat.getContext('2d', { willReadFrequently: true }); fc.fillStyle = '#fff'; fc.fillRect(0, 0, 320, 240);
  check('7 Bereits zugeschnittene Seite bleibt unverändert', detectDocumentQuad(fc.getImageData(0, 0, 320, 240)) === null);
  const wp = fq && warpPerspective(ph, fq, 400), wd = wp?.getContext('2d').getImageData(0, 0, wp.width, wp.height).data;
  const meanW = wd ? [...Array(400)].reduce((s, _, k) => { const x = 4 + (k * 37) % (wp.width - 8), y = 4 + (k * 53) % (wp.height - 8); return s + wd[(y * wp.width + x) * 4]; }, 0) / 400 : 0;
  check('7 Entzerrte Seite enthält nur Papier (kein Tisch)', meanW > 225, meanW.toFixed(0));
  // 8) Licht ausgleichen
  const lc = document.createElement('canvas'); lc.width = 400; lc.height = 300; const lx = lc.getContext('2d', { willReadFrequently: true });
  const gr = lx.createLinearGradient(0, 0, 400, 0); gr.addColorStop(0, '#6e6e6e'); gr.addColorStop(1, '#f0f0f0'); lx.fillStyle = gr; lx.fillRect(0, 0, 400, 300);
  lx.fillStyle = '#000'; for (let y = 20; y < 280; y += 24) lx.fillRect(30, y, 340, 3);
  flattenIllumination(lx, 400, 300); const px = (x, y) => lx.getImageData(x, y, 1, 1).data[0];
  check('8 Schatten weg: Papier links und rechts hell', px(15, 30) > 225 && px(390, 30) > 225, `${px(15, 30)} / ${px(390, 30)}`);
  check('8 Gedruckte Linien bleiben dunkel', px(40, 21) < 90 && px(360, 21) < 90, `${px(40, 21)} / ${px(360, 21)}`);
  // 9) Handschrift-Sicherheitsnetz (ohne Netz geprüft)
  const ec = document.createElement('canvas'); ec.width = 32; ec.height = 32; const ex = ec.getContext('2d', { willReadFrequently: true }); ex.fillStyle = '#000'; ex.fillRect(0, 0, 32, 32);
  const segOf = f => ({ W: 32, H: 32, w: 32, h: 32, k: 1, print: Float32Array.from({ length: 1024 }, (_, i) => f(i)[0]), hand: Float32Array.from({ length: 1024 }, (_, i) => f(i)[1]) });
  const e1 = eraseHandwriting(ex, 32, 32, segOf(i => (i % 32) < 16 ? [0.9, 0.05] : [0.05, 0.9]));
  check('9 Nur Handschrift wird gelöscht, Druck bleibt', e1.removed > 0 && ex.getImageData(4, 4, 1, 1).data[0] === 0 && ex.getImageData(28, 4, 1, 1).data[0] === 255);
  ex.fillRect(0, 0, 32, 32);
  const e2 = eraseHandwriting(ex, 32, 32, segOf(() => [0.02, 0.95]));
  check('9 Ganz handgeschriebenes Blatt bleibt unangetastet', e2.skipped && e2.removed === 0 && ex.getImageData(10, 10, 1, 1).data[0] === 0);
  const km = new Uint8Array(40 * 20), kp = new Float32Array(40 * 20);
  for (let y = 5; y < 15; y++) for (let x = 2; x < 12; x++) kp[y * 40 + x] = 0.9;                // gedrucktes Zeichen
  for (let y = 3; y < 6; y++) for (let x = 12; x < 15; x++) km[y * 40 + x] = 1;                  // kleine «Hochzahl» daneben
  for (let y = 4; y < 16; y++) for (let x = 24; x < 38; x++) km[y * 40 + x] = 1;                 // freier Handschrift-Strich
  keepSmallNearPrint(km, kp, 40, 20, { maxArea: 60 });
  check('9 Hochzahl neben Druck bleibt, freie Handschrift wird gelöscht', km[4 * 40 + 13] === 0 && km[10 * 40 + 30] === 1);
  ex.fillRect(0, 0, 32, 32);
  const sb = segOf(i => (i % 32) < 12 ? [0.9, 0.02] : [0.1, 0.1]); sb.ink = new Uint8Array(1024).fill(1);   // Netz unsicher, KI meldet Handschrift rechts
  const e3 = eraseHandwriting(ex, 32, 32, sb, { boxes: [{ ymin: 0, xmin: 700, ymax: 1000, xmax: 1000 }] });
  check('9 KI-Rahmen: unsichere Tinte im Rahmen weg, Druck und Rest bleiben', e3.removed > 0 && ex.getImageData(26, 10, 1, 1).data[0] === 255 && ex.getImageData(16, 10, 1, 1).data[0] === 0 && ex.getImageData(3, 10, 1, 1).data[0] === 0);
  // 10) Eigenes Handschrift-Netz (wenn auf dem Gerät verfügbar)
  if (await warmHandNet()) {
    const t = document.createElement('canvas'); t.width = 480; t.height = 320; const tx = t.getContext('2d', { willReadFrequently: true });
    tx.fillStyle = '#fff'; tx.fillRect(0, 0, 480, 320); tx.fillStyle = '#111'; tx.font = '20px Arial';
    ['Aufgabe 1 (3 P) Berechne die Fläche', 'des Dreiecks mit a = 6 cm und', 'b = 8 cm. Begründe deine Antwort.'].forEach((l, i) => tx.fillText(l, 20, 40 + i * 30));
    tx.strokeStyle = '#1e3cb4'; tx.lineWidth = 3; tx.lineCap = 'round'; tx.beginPath();
    for (let k = 0; k <= 60; k++) { const x = 40 + k * 6, y = 220 + Math.sin(k * 0.9) * 14 + (k % 7) * 1.5; k ? tx.lineTo(x, y) : tx.moveTo(x, y); } tx.stroke();
    tx.beginPath(); tx.moveTo(60, 260); tx.lineTo(90, 300); tx.moveTo(90, 260); tx.lineTo(60, 300); tx.stroke();
    const sg = await segmentHandwriting(t), at = (x, y, m) => m[Math.round(y * sg.k) * sg.W + Math.round(x * sg.k)];
    let ph2 = 0, nh2 = 0, pp = 0, np2 = 0; const dd = tx.getImageData(0, 0, 480, 320).data;
    for (let y = 0; y < 320; y += 2) for (let x = 0; x < 480; x += 2) { const i = (y * 480 + x) * 4; if (dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11 > 160) continue;
      if (y > 190) { nh2++; if (at(x, y, sg.hand) > 0.5) ph2++; } else if (y < 110) { np2++; if (at(x, y, sg.hand) > 0.5) pp++; } }
    check('10 Netz erkennt Kritzeleien als Handschrift', nh2 && ph2 / nh2 > 0.6, `${(ph2 / Math.max(1, nh2) * 100).toFixed(0)} %`);
    check('10 Netz lässt gedruckten Text stehen', np2 && pp / np2 < 0.05, `${(pp / Math.max(1, np2) * 100).toFixed(1)} % fälschlich`);
    check('10 Netz schnell genug', handNet.ms < 15000, `${handNet.ms} ms`);
  } else check('10 Handschrift-Netz geladen', false, 'Modell fehlt (ml/ trainieren + exportieren)');
  console.table(rows);
  const fail = rows.filter(r => r.Ergebnis.includes('FAIL'));
  console.log(fail.length ? `❌ ${fail.length} von ${rows.length} Selbsttests fehlgeschlagen` : `✅ Alle ${rows.length} Selbsttests bestanden`);
  return { pass: rows.length - fail.length, fail: fail.length, rows };
}
