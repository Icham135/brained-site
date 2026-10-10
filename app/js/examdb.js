// Prüfungs-Datenbank des Prüfungsgenerators: NUR Fakten (Dauer, Aufbau, Punkte, Aufgabentypen, Hilfsmittel,
// Bewertung) aus offiziellen Prüfungsanforderungen und der Analyse veröffentlichter Prüfungen – keine Prüfungstexte.
// Originale werden nur verlinkt (archive). Regeln/Hinweise sind sinngemäss zusammengefasst.
// Aufbau: EXAMS[] = { id, canton, exam, name, stage, owner, archive, requirements, grading, pass, subjects: { fach: Profil } }
// Profil: { title, minutes, form: 'du'|'Sie', aids, rules[], structure:{ tasks, total, points, note }, sections[], archetypes[], topics[], material, answer, years }

export const CANTONS = {
  ZH: 'Zürich', BE: 'Bern', LU: 'Luzern', UR: 'Uri', SZ: 'Schwyz', OW: 'Obwalden', NW: 'Nidwalden', GL: 'Glarus', ZG: 'Zug', FR: 'Freiburg', SO: 'Solothurn',
  BS: 'Basel-Stadt', BL: 'Basel-Landschaft', SH: 'Schaffhausen', AR: 'Appenzell Ausserrhoden', AI: 'Appenzell Innerrhoden', SG: 'St. Gallen', GR: 'Graubünden',
  AG: 'Aargau', TG: 'Thurgau', TI: 'Tessin', VD: 'Waadt', VS: 'Wallis', NE: 'Neuenburg', GE: 'Genf', JU: 'Jura',
};
export const EXAM_KINDS = {
  zap1: { em: '🏫', name: 'Langgymnasium', stage: 'ab 6. Primarklasse' },
  gym: { em: '🎓', name: 'Gymnasium / Kurzgymnasium', stage: 'ab Sekundarschule' },
  fms: { em: '🏢', name: 'FMS · HMS · IMS · WMS', stage: 'ab Sekundarschule' },
  bmsauf: { em: '🎒', name: 'BMS-Aufnahme', stage: 'BM 1 / BM 2' },
  bmp: { em: '📚', name: 'BM-Abschluss (BMP)', stage: 'Berufsmaturität' },
  abu: { em: '🛠️', name: 'LAP / QV · ABU', stage: 'Berufslehre EFZ/EBA' },
  matura: { em: '🎓', name: 'Matura', stage: 'Gymnasium' },
};

// ---------------- gemeinsame Bausteine ----------------
const ZH_ARCHIVE = p => ({ label: 'Alte Prüfungen 2015–2026 mit Lösungen', owner: 'Bildungsdirektion Kanton Zürich', url: `https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/${p}.html` });
const ZH_REQ1 = { label: 'Prüfungsanforderungen ZAP 1 (gültig ab 1.8.2026)', url: 'https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/pruefung-fuer-das-langgymnasium.html' };
const ZH_REQ23 = { label: 'Prüfungsanforderungen ZAP 2/ZAP 3/IMS (gültig ab 1.8.2022)', url: 'https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/pruefung-fuer-das-kurzgymnasium.html' };
export const EXAMS = [
  // ======================= ZÜRICH =======================
  {
    id: 'zh-zap1', canton: 'ZH', exam: 'zap1', name: 'Zentrale Aufnahmeprüfung ZAP 1 (Langgymnasium)', stage: '6. Primarklasse → Langgymnasium',
    owner: 'Bildungsdirektion Kanton Zürich', archive: ZH_ARCHIVE('pruefung-fuer-das-langgymnasium'), requirements: ZH_REQ1,
    grading: 'Prüfungsnote = ¼ Sprachprüfung + ¼ Aufsatz + ½ Mathematik. Mit Vornoten: Gesamtnote = ½ Prüfung + ½ Vornoten.', pass: 'Aufnahme in die Probezeit ab 4.75 (mit Vornoten) bzw. 4.5 (ohne Vornoten).',
    subjects: {
      mathe: {
        title: 'Mathematik – Hauptprüfung', minutes: 60, form: 'du', answer: 'grid', years: '2015–2026',
        aids: 'Lineal, Geodreieck, Zirkel, Bleistift (für Konstruktionen). Kein Taschenrechner, keine elektronischen Hilfsmittel.',
        rules: ['Du hast 60 Minuten Zeit.', 'Löse die Aufgaben direkt auf dem Aufgabenblatt; reicht der Platz nicht, fährst du auf der letzten Seite weiter.', 'Notiere Ausrechnungen und Zwischenresultate, damit der Lösungsweg verständlich ist.', 'Antwortsätze sind nicht verlangt – kennzeichne die Ergebnisse aber deutlich und mit Masseinheit.', 'Du darfst die Aufgaben in beliebiger Reihenfolge lösen.', 'Jede Aufgabe zählt 4 Punkte. Bei Teilaufgaben sind die Teilpunkte angegeben.'],
        structure: { tasks: 9, total: 36, points: 'jede Aufgabe genau 4 Punkte', note: 'Teilaufgaben a)/b)/c) mit Teilpunkten (1P/2P), Aufgaben mit Zeichnung/Konstruktion sind typisch' },
        archetypes: [
          'Rechnen ohne Taschenrechner: geschickt rechnen mit Klammern und Dezimalzahlen, oder fehlende Zahl im Kästchen (Operationsumkehr, auch mit Zeitangaben h/min) – meist Aufgabe 1',
          'Sachaufgabe mit Tabelle (Preise, Einnahmen, Distanzen/Zeiten) mit 2–3 aufbauenden Teilfragen',
          'Kombinatorik: alle Möglichkeiten systematisch finden und in eine Tabelle eintragen (z.B. Münzen, Ziffern), «falsche Möglichkeiten geben Abzug»',
          'Flächen und Anteile auf Häuschen-/Plattenmuster: Anteil als gekürzter Bruch, Kosten, günstigste Variante',
          'Sachrechnen rückwärts mit Brüchen und Verlusten (z.B. Ernte → Verlust → Anteil → Gläser), Ergebnis mit Masseinheit',
          'Proportionalität und umgekehrte Proportionalität (Vorräte reichen für x Tage, Personen kommen hinzu), Wertepaare prüfen',
          'Geometrische Konstruktion auf Karte/Plan mit Massstab: Ortslinien (Kreis = Abstand zu Punkt, Parallele = Abstand zu Gerade, Mittelsenkrechte = näher bei), mögliches Gebiet schraffieren',
          'Raumvorstellung: Würfel/Pyramide kippen oder drehen, Würfelnetze, Würfelbauten in Ansichten (vorne/oben/rechts)',
          'Muster und Zahlenmauern, Bewegungsaufgaben (Begegnung, Weg-Zeit), Durchschnitt, Teiler/Vielfache, Richtig/Falsch-Aussagen',
        ],
        level: ['Kombinatorik mit Einschränkung: In einer Kasse liegen nur 5-, 2- und 1-Franken-Stücke, von jeder Sorte mindestens eines, zusammen 17 CHF – alle Möglichkeiten in eine Tabelle (mehr Zeilen als Lösungen)', 'Rückwärts mit Brüchen: Nach Verlusten (⅕ verdirbt, dann 3 kg gehen verloren) und Einkochen auf ⅔ füllt man 96 Gläser à 250 g – wie viel wurde geerntet?', 'Umgekehrte Proportionalität in zwei Schritten: Vorräte für 30 Personen reichen 20 Tage; nach 8 Tagen kommen 10 Personen dazu – wie viele Tage noch?', 'Kein Taschenrechner, kein Pythagoras, keine Prozentzinsen – nur Stoff bis Mitte 6. Klasse'],
        topics: ['Zahl und Variable: Grundoperationen bis 1 Mio., Brüche (Nenner 2–100) und Dezimalzahlen, runden, geschickt rechnen, Teilbarkeitsregeln', 'Form und Raum: Grundbegriffe, Dreieck/Viereck/Kreis konstruieren, Umfang/Fläche Rechteck, Volumen Quader, Netze, Ansichten, Mittelsenkrechte, Koordinatensystem', 'Grössen, Funktionen, Daten: Masseinheiten umwandeln, Proportionalität (auch umgekehrt), Anteile, Mittelwert, einfache Kombinatorik'],
      },
      'deutsch-sprach': {
        title: 'Sprachprüfung Deutsch – Hauptprüfung', minutes: 45, form: 'du', answer: 'lines', years: '2015–2026', aids: 'keine',
        rules: ['Lies den Text auf dem beiliegenden Textblatt sorgfältig durch. Du brauchst ihn zur Lösung der Aufgaben.', 'Du darfst wählen, in welcher Reihenfolge du die Aufgaben löst.', 'In den Aufgaben mit ganzen Sätzen führen Rechtschreibe- und Grammatikfehler zu Punkteabzug.', 'Du hast 45 Minuten Zeit.'],
        structure: { tasks: 16, total: 51, points: '1–5 Punkte pro Aufgabe', note: 'Teil A Textverständnis (ca. 11 Aufgaben), Teil B Sprachbetrachtung (ca. 5 Aufgaben)' },
        material: { kind: 'literarischer Text (Erzählung, Alltagsgeschichte mit Konflikt) mit Zeilennummern alle 5 Zeilen', words: '800–900' },
        sections: ['Teil A: Textverständnis', 'Teil B: Sprachbetrachtung'],
        archetypes: ['Kurze Inhaltsfrage (1 P.) und Detailfragen zum Text', 'Zeilennummer angeben, aus welcher Stelle etwas hervorgeht', 'Bedingungen/Gründe in je einem ganzen Satz nennen (mit Abzug für Orthografie)', 'Tabelle: Aussage stimmt (✓) / stimmt nicht (–) / nicht entscheidbar (?) – ein Kreuz pro Zeile', 'Satz vervollständigen («Jürgen ist erleichtert, weil …»)', 'Adjektive aus dem Text bzw. aus einer Liste einer Figur zuordnen', 'Gründe ankreuzen: spielt eine Rolle (R) / nicht (F), falsche Kreuze geben Abzug', 'Begründung einer Figur mit Textstelle; vereinfachter Sachtext-Ausschnitt anwenden', 'Wortbedeutung im Kontext ankreuzen / Ersatzausdruck wählen', 'Teil B: Verb der Wortfamilie im Textzusammenhang einsetzen', 'Teil B: Nachmorphem (Nachsilbe) wählen', 'Teil B: Wortart bestimmen (Nomen/Verb/Adjektiv/nichts) – Wörter in Grossbuchstaben', 'Teil B: Sätze in verlangte Zeitform umschreiben (Präsens/Präteritum/Perfekt)', 'Teil B: je zwei Grammatikfehler pro Satz korrigieren'],
        topics: ['Textverständnis literarischer und Sachtexte, Absicht/Kernaussage, Realität vs. Fiktion', 'Wortschatz: Wortfamilien, Wortfelder', 'Grammatik: Stamm/Vor-/Nachmorphem, Wortarten (Verb, Nomen, Adjektiv), Personalform, Infinitiv, Zeitformen (Präsens, Präteritum, Perfekt), Geschlecht, Pluralformen, Fall (anwenden), Steigerungsformen, direkte Rede'],
      },
      'deutsch-aufsatz': {
        title: 'Deutsch: Text verfassen – Hauptprüfung', minutes: 60, form: 'du', answer: 'lines', years: '2015–2026',
        aids: 'Duden «Rechtschreibung» oder Schweizer Schülerduden Rechtschreibung',
        rules: ['Schreibe zu einem der drei nachfolgenden Themen einen Text.', 'Schreibe mit Füllfeder oder Kugelschreiber.', 'Gestrichenes wird nicht bewertet.', 'Du hast 60 Minuten Zeit.'],
        structure: { tasks: 3, total: null, points: 'Bewertung als Note', note: 'Wahl aus 3 Themen' },
        archetypes: ['Thema 1 – Bericht (z.B. für eine Zeitung über ein Ereignis im Quartier): Ablauf, Auswirkungen, Reaktionen; «Berichte im Präteritum.»', 'Thema 2 – Erzählung zu einer Alltagssituation mit Wendung; «Schreibe im Präteritum.»', 'Thema 3 – Bildergeschichte: erzählen, wie es zur abgebildeten Situation kam und wie es weitergeht, Ich-Form, eigener Titel', 'Jedes Thema endet mit: «Gib die Nummer des Themas an und übernimm den Titel.»'],
        topics: ['Textsorten Erzählung und Bericht', 'Aufbau, Zeitformen, direkte Rede, Satzzeichen'],
      },
    },
  },
  {
    id: 'zh-zap2', canton: 'ZH', exam: 'gym', name: 'Zentrale Aufnahmeprüfung ZAP 2 (Kurzgymnasium & HMS)', stage: '2. Sekundarklasse → Kurzgymnasium / Handelsmittelschule',
    owner: 'Bildungsdirektion Kanton Zürich', archive: ZH_ARCHIVE('pruefung-fuer-das-kurzgymnasium'), requirements: ZH_REQ23,
    grading: 'Prüfungsnote = ¼ Sprachprüfung + ¼ Aufsatz + ½ Mathematik. Mit Vornoten: Gesamtnote = ½ Prüfung + ½ Vornoten.', pass: 'Aufnahme ab 4.75 (mit Vornoten) bzw. 4.5 (ohne Vornoten).',
    subjects: {
      mathe: {
        title: 'Mathematik – Hauptprüfung', minutes: 90, form: 'du', answer: 'grid', years: '2015–2026',
        aids: 'Netzunabhängiger, von der Bildungsdirektion zugelassener Taschenrechner (ohne Grafik/Algebra), Zirkel, Geodreieck, Massstab.',
        rules: ['Du hast 90 Minuten Zeit.', 'Löse alle Aufgaben in dieses Heft; zusätzliches Notizpapier ist nicht erlaubt.', 'Du darfst die Aufgaben in beliebiger Reihenfolge lösen.', 'Deine Lösungswege müssen klar ersichtlich sein – Zwischenresultate und Überlegungsfiguren gehören ins Heft.', 'Geometrische Konstruktionen müssen nachvollziehbar sein.', 'Hebe deine Schlussresultate deutlich hervor; streiche durch, was nicht bewertet werden soll.'],
        structure: { tasks: 10, total: 37, points: '1–3 Punkte pro Teilaufgabe', note: 'Aufgabe 1 besteht aus 8–9 kurzen Teilaufgaben (1–2 P.), danach Aufgaben 2–10 mit Teilaufgaben a)/b)' },
        archetypes: ['Aufgabe 1 (Kurzaufgaben): Terme vereinfachen, Potenzen, Term bestimmen («von dem man … subtrahieren muss»), Formel nach x auflösen, kgV-Sachaufgabe (Zahnräder), Einheiten umwandeln (dm³ → ml), Winkel berechnen, Pyramidenvolumen → Höhe, Konstruktion (z.B. Drachenviereck aus Diagonale)', 'Lineare Gleichungen mit Klammern und Brüchen lösen', 'Bruch- und Wurzelterme vereinfachen', 'Gleichungen zu Textsituationen aufstellen (nicht lösen): Eintrittspreise, Geldverteilung, Zahlenrätsel – «x: …» ist vorgegeben', 'Prozentrechnen mit Diagramm (Kreisdiagramm/Anteile) und Prozent vom Prozent', 'Füllgraphen den Gefässen zuordnen / Weg-Zeit-Graphen', 'Wahrscheinlichkeit zweistufig (mindestens einer trifft; Gegenwahrscheinlichkeit)', 'Flächen mit Variable (Rechteck mit grauem Teil, Fläche gegeben → x)', 'Pythagoras im Raum und Volumen (Zelt, Prisma, Pyramide)', 'Figurenfolge: Anzahl für Figur 4 per Tabelle, Term für Figur n'],
        level: ['Bruchterm-Gleichung mit Klammern: 5 − (5x − 12) = 10 − 2(4x + 1)', 'Gleichung aufstellen (nicht lösen): Alina hat 5-mal so viel Geld wie Mia; nach Ausgaben von 600 bzw. 150 CHF haben beide zusammen 3-mal so viel wie Mia zu Beginn', 'Zweistufige Wahrscheinlichkeit mit Gegenereignis (mindestens jemand trifft)', 'Pythagoras im Raum: Zeltstangen/Pyramide, dann Volumen'],
        topics: ['Zahl & Variable: Rechenregeln, Primfaktoren, ggT/kgV, Zehnerpotenzen, Terme (Bruch-/Wurzelterme), ausmultiplizieren/faktorisieren, lineare Gleichungen, Formeln umformen, Quadratwurzel', 'Daten & Zufall: Diagramme, Mittelwert, relative Häufigkeit, Wahrscheinlichkeit ein-/zweistufig', 'Grössen: Masseinheiten, Prozente und Anteile, proportional/umgekehrt proportional, Weg-Zeit-/Füllgraphen', 'Geometrie: Symmetrien, spezielle Drei-/Vierecke, Winkelsummen, Pythagoras, Thales, Flächen, Mittelsenkrechte/Winkelhalbierende, Konstruktionen, Würfel/Quader/Pyramide/Prisma, Volumen/Oberfläche'],
      },
      'deutsch-sprach': {
        title: 'Sprachprüfung Deutsch – Hauptprüfung', minutes: 45, form: 'du', answer: 'lines', years: '2015–2026', aids: 'keine',
        rules: ['Lies den Text auf dem Textblatt sorgfältig durch.', 'Du darfst die Aufgaben in beliebiger Reihenfolge lösen.', 'Halte dich genau an die Anzahl verlangter Markierungen/Kreuze – zu viele geben Abzug.', 'Du hast 45 Minuten Zeit.'],
        structure: { tasks: 14, total: 75, points: '4–7 Punkte pro Aufgabe', note: 'Textverständnis (Aufgaben 1–4) und Sprachbetrachtung (5–14)' },
        material: { kind: 'literarischer Text (Ich-Erzähler) mit Zeilennummern', words: '850–900' },
        archetypes: ['Genau vier passende Adjektive zum Ich-Erzähler markieren', 'Passendes Wort aus einem Zeilenbereich zum vorgegebenen Satz finden', 'Richtig / falsch / keine Angabe möglich ankreuzen (7 Aussagen)', 'Fragen zum Text beantworten (Szenarien, Motive)', 'Zwei Sätze mit Konjunktion aus Liste verbinden (inhaltlich und grammatisch korrekt)', 'Begriffe aus einem Wortspeicher einsetzen (einer bleibt übrig)', 'Wörter in Klammern in den korrekten Fall setzen', 'Satz in die nächstfolgende Zeitform setzen', 'Wortart bestimmen (ein Kreuz pro Zeile)', 'Objekt umrahmen und Fall bestimmen (Akkusativ/Dativ/Genitiv)', 'Wortfamilie: Nomen mit Artikel, Verb, Adjektiv ableiten', 'Antonym zum markierten Wort (nicht mit un-)', 'Satz grammatisch korrekt vervollständigen (Zeitenfolge, Fälle)', 'Fünf formale Fehler (Komma, Rechtschreibung) korrigieren'],
        topics: ['Textverständnis: genau erfassen, Absicht/Pointe, Realität vs. Fiktion, kritisch reflektieren, interpretieren', 'Wortschatz: Ober-/Unterbegriffe, Wortfamilien, Wortfelder', 'Wortlehre: Zeitformen inkl. Futur I/Plusquamperfekt, Indikativ/Imperativ/Konjunktiv I+II (bestimmen), Aktiv/Passiv (bestimmen), Deklination, Pronomen, Partikeln', 'Satzlehre: Personalform, Infinitiv, Partizip II, Verbzusatz, Subjekt/Objekte, Kommas bei Aufzählungen und Verbgruppen'],
      },
      'deutsch-aufsatz': {
        title: 'Deutsch: Text verfassen – Hauptprüfung', minutes: 90, form: 'du', answer: 'lines', years: '2015–2026', aids: 'Rechtschreibwörterbuch',
        rules: ['Wähle eines der vier Themen aus und verfasse dazu einen Text.', 'Du hast dafür 90 Minuten Zeit.', 'Als Hilfsmittel darfst du ein Rechtschreibwörterbuch benutzen.'],
        structure: { tasks: 4, total: null, points: 'Bewertung als Note', note: 'Wahl aus 4 Themen' },
        archetypes: ['2–3 Erörterungen zu Gesellschaftsthemen (z.B. Kontrolle, Privatsphäre, Warnhinweise): einleitend beschreiben, im Hauptteil Vor- und Nachteile bzw. Chancen und Risiken erörtern, im Schluss eigene Meinung', '1 Erzählung mit Vorgaben (z.B. Gegenstände von einem Einkaufszettel müssen zentrale Rolle spielen), Spannung, Höhepunkt, passender Schluss', 'Teilweise mit Bildimpuls'],
        topics: ['Textsorten Beschreibung, Bericht, Argumentation/Stellungnahme, Erzählung'],
      },
    },
  },
  {
    id: 'zh-zap3', canton: 'ZH', exam: 'bmsauf', name: 'Zentrale Aufnahmeprüfung ZAP 3 (BMS & FMS)', stage: '3. Sekundarklasse → BM 1 / FMS · nach Lehre → BM 2',
    owner: 'Bildungsdirektion Kanton Zürich', archive: ZH_ARCHIVE('pruefung-fuer-die-berufsmaturitaetsschule'), requirements: ZH_REQ23, alsoFor: ['fms'],
    grading: 'Prüfungsnote = ¼ Sprachprüfung + ¼ Aufsatz + ½ Mathematik. BM 1 mit Vornoten: ½ Prüfung + ½ Vornoten.', pass: 'Bestanden ab 4.5 (mit Vornoten) bzw. 4.25 (ohne Vornoten, z.B. BM 2).',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 90, form: 'Sie', answer: 'grid', years: '2015–2026',
        aids: 'Konstruktionswerkzeug (Zirkel, Geometrie-Dreieck, Massstab) und von der Bildungsdirektion zugelassene Taschenrechner.',
        rules: ['Sie müssen alle Aufgaben in dieses Heft lösen; zusätzliches Notizpapier ist nicht erlaubt.', 'Sie dürfen die Aufgaben in beliebiger Reihenfolge lösen.', 'Heben Sie Ihre Schlussresultate deutlich hervor.', 'Schreiben Sie mit einem dokumentenechten Stift; Bleistift nur für Zeichnungen.', 'Ihre Lösungswege müssen klar ersichtlich sein. Ungültiges muss gestrichen werden; Durchgestrichenes wird nicht bewertet.', 'Alle Resultate müssen vollständig vereinfacht sein, falls nichts anderes verlangt ist.'],
        structure: { tasks: 12, total: 40, points: '2–4 Punkte pro Aufgabe (Punkte stehen bei jeder Aufgabe, z.B. «Aufgabe 1 · 4 P.»)', note: 'Aufgaben meist mit Teilaufgaben a)/b)' },
        archetypes: ['Klammern auflösen und Terme vereinfachen (Polynome, Binome)', 'Bruchterme vereinfachen', 'Potenz- und Wurzelterme vereinfachen', 'Gleichungen lösen (mit Klammern, mit Brüchen)', 'Sachrechnen/Dreisatz in Berufskontext (z.B. Tropfrate einer Transfusion)', 'Prozentrechnen: mehrstufige Zu-/Abnahme rückwärts, Mischungsrechnen (Gehalt in %), «Genauigkeit: 1 Dezimale»', 'Gleichungen aufstellen (nicht lösen) zu Textsituationen, «x: …» vorgegeben', 'Wahrscheinlichkeit mit Baumdiagramm (mit Zurücklegen), auch rückwärts (Anzahl Kugeln bestimmen)', 'Lineare Funktionen: Steigung, Geradengleichung, Schnittpunkt grafisch', 'Geometrie: Kreis/Kreissektor, Pythagoras, Flächen zusammengesetzter Figuren', 'Körper: Prisma, Zylinder, Pyramide – Volumen und Oberfläche', 'Zins (Jahres-/Marchzins), Rabatt/MWST, Geschwindigkeit/Strecke/Zeit, Währungen'],
        level: ['Prozent rückwärts mehrstufig: Gewicht +35 %, dann +22 %, am Ende 5.6 kg – Ausgangsgewicht auf 1 Dezimale', 'Mischungsrechnen: 210 g Lösung mit 96 % Alkohol + 90 g Wasser – Alkoholgehalt der Mischung', 'Baumdiagramm rückwärts: Wahrscheinlichkeit für zwei blaue Kugeln ist 9/16 bei 104 Kugeln – wie viele blaue?', 'Gleichung aufstellen: Bio-Karotten kosten 1.70 CHF/kg mehr; 6 kg günstige kosten 3.60 CHF weniger als 4 kg Bio'],
        topics: ['Terme inkl. Bruch-, Wurzel- und Potenzterme, Polynome, Binome/Trinome, 3. Wurzel', 'Lineare Gleichungen, Formeln umformen', 'Statistik & Wahrscheinlichkeit mehrstufig (Baumdiagramm)', 'Prozente, Zins/Marchzins, Rabatt/MWST, Währungen, Geschwindigkeit', 'Lineare Funktionen (Steigungsdreieck, Geradengleichung, Schnittpunkt)', 'Geometrie: Kreis, Kreissektor, Pythagoras, Thales, Prisma, Zylinder, Pyramide'],
      },
      'deutsch-sprach': {
        title: 'Deutsch – Sprachbetrachtung und Textverständnis', minutes: 45, form: 'Sie', answer: 'lines', years: '2015–2026', aids: 'keine',
        rules: ['Lesen Sie den beiliegenden Text sorgfältig.', 'Kreuzen Sie pro Teilaufgabe nur so viele Antworten an wie verlangt.', 'Achten Sie auf Rechtschreibung und Leserlichkeit.', 'Dauer: 45 Minuten.'],
        structure: { tasks: 12, total: 60, points: '3–7 Punkte pro Aufgabe', note: 'Textverständnis (1–6) und Sprachbetrachtung (7–12)' },
        material: { kind: 'Sachtext / Essay (z.B. Wirtschaft, Gesellschaft) mit Zeilennummern', words: '450–550' },
        archetypes: ['Multiple Choice zum Text (eine richtige Antwort pro Teilaufgabe)', 'Die drei Antworten ankreuzen, die laut Text am besten passen', 'Richtig / falsch / ungeklärt laut Text', 'Wort mit gegenteiliger Bedeutung im Textzusammenhang ankreuzen', 'Redewendungen korrekt ergänzen', 'Passendes Adjektiv im Satz ankreuzen (sprachlich und inhaltlich)', 'Verbformen in verlangten Zeitformen einsetzen', 'Satzglieder und verbale Teile bestimmen (Begriffe zur Auswahl)', 'Modus bestimmen (Konjunktiv I/II, Indikativ, Imperativ)', 'Aktiv ↔ Passiv ohne Zeitform zu ändern', 'Wortart bestimmen: Präposition, Konjunktion, übrige Partikel, Pronomen …', 'Fehlende Satz- und Redezeichen einsetzen'],
        topics: ['Textverständnis Sachtext', 'Wortschatz: Bedeutung im Kontext, Antonyme, Redewendungen', 'Wortlehre: Zeitformen, Modi, Aktiv/Passiv (bestimmen und anwenden), Wortarten', 'Satzlehre: Satzglieder, Präpositionalgefüge, Haupt-/Nebensatz, Komma bei Infinitiven/Einschüben/Relativsätzen'],
      },
      'deutsch-aufsatz': {
        title: 'Deutsch – Verfassen eines Textes', minutes: 90, form: 'Sie', answer: 'lines', years: '2015–2026', aids: 'Rechtschreibwörterbuch (z.B. Duden Rechtschreibung oder Schweizer Schülerduden)',
        rules: ['Verfassen Sie einen zusammenhängenden, klar strukturierten, sprachlich korrekten und ansprechenden Text.', 'Wählen Sie eines der Themen.', 'Bewertung: Konzept/Aufbau, Gehalt/Veranschaulichung, Stil, sprachliche Korrektheit (je 10 Punkte, total 40).'],
        structure: { tasks: 3, total: 40, points: '4 Bewertungsbereiche à 10 Punkte', note: 'Wahl aus mehreren Themen' },
        archetypes: ['Erzählung/Erlebnis mit Ausgangssituation (z.B. «Die beste Investition meines Lebens» – Flohmarkt)', 'Erörterung/Stellungnahme zu einer Frage aus Gesellschaft oder Arbeitswelt', 'Beschreibung/Reflexion mit persönlichem Bezug'],
        topics: ['Textsorten Beschreibung, Bericht, Argumentation/Stellungnahme, Erzählung'],
      },
    },
  },
  {
    id: 'zh-ims', canton: 'ZH', exam: 'fms', name: 'Zentrale Aufnahmeprüfung Informatikmittelschule (IMS)', stage: '2. Sekundarklasse → IMS',
    owner: 'Bildungsdirektion Kanton Zürich', archive: ZH_ARCHIVE('pruefung-fuer-die-informatikmittelschule'), requirements: ZH_REQ23,
    grading: 'Prüfungsnote = ¼ Sprachprüfung + ¼ Aufsatz + ½ Mathematik; mit Vornoten ½ Prüfung + ½ Vornoten.', pass: 'Bestanden ab 4.5 (mit Vornoten) bzw. 4.25 (ohne).',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 90, form: 'Sie', answer: 'grid', years: '2016–2025',
        aids: 'Zugelassener Taschenrechner, Zirkel, Geodreieck.', rules: ['Sie müssen alle Aufgaben in dieses Heft lösen.', 'Sie dürfen die Aufgaben in beliebiger Reihenfolge lösen.', 'Schreiben Sie mit einem dokumentenechten Stift.', 'Ungültige Lösungswege und Lösungen müssen gestrichen werden; Durchgestrichenes wird nicht bewertet.', 'Alle Resultate müssen vollständig vereinfacht sein.'],
        structure: { tasks: 12, total: 34, points: '2–4 Punkte pro Aufgabe' },
        archetypes: ['Terme vereinfachen, faktorisieren', 'Gleichungen lösen und aufstellen', 'Prozent: Rabatt, Verkaufspreis, maximaler Rabatt «Genauigkeit: ganze Prozente»', 'Geometrie: Rechteck mit eingeschriebenen Halbkreisen, Flächen/Umfang', 'Steigung/Steigungsdreieck', 'Wahrscheinlichkeit mehrstufig', 'Körper, Pythagoras'],
        topics: ['Stoff bis Ende 4. Semester Sekundarschule; sonst wie ZAP 2 (inkl. Kreise, Zylinder, Baumdiagramme, Währungen, Rabatt/MWST, Steigungsdreieck)'],
      },
    },
  },


  {
    id: 'zh-bmp', canton: 'ZH', exam: 'bmp', name: 'Berufsmaturitätsprüfung Wirtschaft (BMP) Kanton Zürich', stage: 'BM 1 / BM 2 Typ Wirtschaft – Abschlussprüfung',
    owner: 'Prüfungskommission Kaufmännische Berufsmatura Kanton Zürich (WSKVW)', archive: { label: 'Frühere Abschlussprüfungen 2015–2024 (komplette Serien)', url: 'https://www.wskvw.ch/pruefungskommission-kaufleute/abschlusspruefungen/bm-bm2-vbr/' },
    grading: 'Jedes Fach 100 Punkte; Notenskala: 0–4 = 1 · 5–14 = 1.5 · … · 55–64 = 4 · … · 95–100 = 6.', pass: 'BM-Ausweis gemäss Berufsmaturitätsverordnung (Durchschnitt ≥ 4, max. zwei ungenügende Fächer, Notenabweichungen beschränkt).',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 120, form: 'Sie', answer: 'grid', years: '2015–2025',
        aids: 'Taschenrechner nichtdruckend, netzunabhängig, ohne CAS/Solver, nicht programmierbar; beigelegte Formelsammlung.',
        rules: ['Prüfungsdauer: 120 Minuten.', 'Unbelegte Resultate (fehlender Lösungsweg) werden nicht berücksichtigt.', 'Lösungsschritte werden bewertet.', 'Resultate müssen eindeutig und aussagekräftig dargestellt sein.', 'Als Schreibmaterial sind Bleistift und Rotstift nicht gestattet (ausgenommen grafische Darstellungen).'],
        structure: { tasks: 10, total: 100, points: '6–15 Punkte pro Aufgabe', note: 'Jede Aufgabe auf 1–2 Seiten mit Karofeld' },
        archetypes: ['Gleichungssysteme (auch Bruchgleichungen mit Definitionsmenge)', 'Ungleichungen / quadratische Gleichungen', 'Lineare und quadratische Funktionen (Scheitelpunkt, Schnittpunkte, Parabeln)', 'Exponential- und Logarithmusfunktionen (Wachstum/Zerfall)', 'Folgen und Reihen (arithmetisch/geometrisch)', 'Finanzmathematik: Zinseszins, Renten, Kredite', 'Lineare Optimierung (Wirtschaft)', 'Wahrscheinlichkeit und Statistik', 'Anwendungsaufgabe Kosten/Erlös/Gewinn (Nutzschwelle)'],
        topics: ['Rahmenlehrplan BM 2012, Schwerpunkt Wirtschaft: Algebra, Funktionen, Exponential/Logarithmus, Folgen, Finanzmathematik, Optimierung, Stochastik'],
      },
      'deutsch-analyse': {
        title: 'Deutsch – Textanalyse', minutes: 60, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'Rechtschreibwörterbuch',
        rules: ['Prüfungsdauer (Textanalyse): 60 Minuten.', 'Dieser Prüfungsteil wird nach 60 Minuten eingesammelt.', 'Dieser Prüfungsteil umfasst ca. 18 Aufgaben.'],
        structure: { tasks: 18, total: 50, points: '1–5 Punkte pro Aufgabe' },
        material: { kind: 'Sachtext / populärwissenschaftlicher Artikel (z.B. Psychologie-Studie) mit Zeilennummern', words: '800–1100' },
        archetypes: ['Inhaltsfragen zum Text (Vorteile, Begründungen)', 'Aussagen zum Text beurteilen', 'Bedeutung von Konjunktionen/Wörtern im Kontext («Zeitangaben lassen sich mit „und“ verstärken»)', 'Teilsätze ergänzen, sodass ein Bedeutungsunterschied deutlich wird', 'Sätze umformulieren, sodass die Bedeutung gleich bleibt', 'Aktiv ↔ Passiv (nur verbale Teile)', 'Satzteile in Nebensätze umformen bzw. umgekehrt', 'Kommas setzen in langem Satz', 'Endungen ergänzen (Deklination: «des renommiert__ Berliner__ Forscher__»)'],
        topics: ['Textanalyse, Grammatik, Stil, Zeichensetzung'],
      },
      'deutsch-produktion': {
        title: 'Deutsch – Textproduktion', minutes: 90, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'Rechtschreibwörterbuch',
        rules: ['Prüfungsdauer: 90 Minuten.', 'Wählen Sie eine der Aufgaben.'],
        structure: { tasks: 3, total: 50, points: 'Bewertung nach Inhalt, Aufbau, Sprache' },
        archetypes: ['Erörterung zu einer aktuellen Frage (Wirtschaft/Gesellschaft)', 'Kommentar / Leserbrief zu einem Text', 'Textinterpretation oder kreative Aufgabe mit Vorgaben'],
        topics: ['Argumentative Textproduktion'],
      },
      englisch: {
        title: 'Englisch (schriftlich)', minutes: 120, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'keine',
        rules: ['Schriftliche Prüfung: 120 Minuten. Hilfsmittel: keine.'],
        structure: { tasks: 8, total: 100, points: 'Reading (Tasks à 11–14 P.), Use of English (Tenses 8, weitere 8–9 P.), Writing 25 P.' },
        sections: ['Reading', 'Use of English', 'Writing'],
        material: { kind: 'zwei englische Lesetexte (z.B. Unternehmen/Umwelt) und eine Geschichte für Tenses', words: '500–800' },
        archetypes: ['Reading Task 1 (z.B. City Rickshaw Service) – Multiple Choice/Kurzantworten (11 P.)', 'Reading Task 2 (z.B. The 3 Rs) – Fragen, True/False (14 P.)', 'Tenses: Verben in Geschichte in korrekte Zeitform (8 P.)', 'Word formation / Vocabulary in context (9 P.)', 'Sentence transformation (8 P.)', 'Writing (25 P.): Text nach Vorgaben, Bewertung nach 5 Kriterien à 0–5 Punkte'],
        topics: ['B1–B2: Reading, Grammar/Use of English, Writing'],
      },
      franz: {
        title: 'Französisch (schriftlich)', minutes: 120, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'keine',
        rules: ['Die angegebenen Zeiten sind Richtwerte. Hilfsmittel: keine.'],
        structure: { tasks: 4, total: 100, points: 'A Hörverstehen 28 · B Grammatik 22 · C Leseverstehen 26 · D Schreiben 24' },
        sections: ['A. Hörverstehen', 'B. Grammatik', 'C. Leseverstehen', 'D. Schreiben'],
        material: { kind: 'Hörtext als Transkript zum Vorlesen (Interview, z.B. Multitasking) + französischer Lesetext', words: '400–700' },
        archetypes: ['Hörverstehen: vrai/faux, Fragen mit Stichworten, Satzanfänge ergänzen', 'Grammatik: Pronomen, Zeiten (passé composé/imparfait, subjonctif), Relativpronomen', 'Leseverstehen: Fragen, vrai/faux mit Begründung', 'Schreiben: Text nach Vorgaben'],
        topics: ['B1: Hören, Grammatik, Lesen, Schreiben'],
      },
      wr: {
        title: 'Wirtschaft und Recht', minutes: 120, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'ZGB/OR (ohne Handnotizen)',
        rules: ['Prüfungsdauer: 120 Minuten.', 'Hilfsmittel: Gesetzestexte ZGB/OR ohne Handnotizen.', 'Nennen Sie bei Rechtsfragen die massgebenden Gesetzesartikel.'],
        structure: { tasks: 2, total: 100, points: 'Teil 1 Grundlagen Wirtschaft und Recht (ca. 39 P.) · Teil 2 Fall zur Betriebs- und Rechtskunde (ca. 61 P.)' },
        sections: ['Teil 1: Grundlagen Wirtschaft und Recht', 'Teil 2: Fall zur Betriebs- und Rechtskunde'],
        archetypes: ['Teil 1: Volkswirtschaft (Konjunktur, BIP, Geldpolitik SNB, Inflation), Kurzfragen', 'Teil 1: Rechtsgrundlagen (Vertragsentstehung, Mängel, Fristen) mit Artikel', 'Teil 2: Fallstudie eines Unternehmens: Unternehmensmodell, Marketing, Rechtsform, Arbeitsvertrag, Kaufvertrag, Mietrecht, Haftung'],
        topics: ['Volks- und Betriebswirtschaft, OR/ZGB-Rechtskunde'],
      },
      rw: {
        title: 'Finanz- und Rechnungswesen (FRW)', minutes: 180, form: 'Sie', answer: 'lines', years: '2015–2025', aids: 'Nichtdruckender, netzunabhängiger Taschenrechner; Kontenrahmen (Beilage)',
        rules: ['Prüfungsdauer: 180 Minuten.', 'Buchungssätze mit Kontenbezeichnungen gemäss Kontenrahmen.', 'Beträge auf 5 Rappen genau, sofern nichts anderes verlangt.'],
        structure: { tasks: 10, total: 100, points: 'Teil 1 Buchhaltung 49 · Teil 2 BAB/Nutzschwelle/Kalkulation 26 · Teil 3 Geldflussrechnung 25' },
        sections: ['Teil 1: Buchhalterische Aufgabenstellungen', 'Teil 2: BAB, Nutzschwelle und Kalkulation im Handel', 'Teil 3: Geldflussrechnung'],
        archetypes: ['Geschäftsfälle im Jahr verbuchen (25 P.)', 'Buchungstatsachen zum Jahresabschluss (Abschreibungen, Rückstellungen, Abgrenzungen) (11 P.)', 'Lohnabrechnung (4 P.)', 'Warenverkehr (4 P.)', 'Wertschriften (5 P.)', 'Betriebsabrechnungsbogen (18 P.)', 'Nutzschwelle (4 P.)', 'Kalkulation im Handelsbetrieb (4 P.)', 'Geldflussrechnung (21 P.) und operativer Cashflow indirekt (4 P.)'],
        topics: ['Doppelte Buchhaltung, Abschluss, Kostenrechnung, Kalkulation, Geldflussrechnung'],
      },
    },
  },

  // ======================= BERN =======================
  {
    id: 'be-gym', canton: 'BE', exam: 'gym', name: 'Kantonale Aufnahmeprüfung Gymnasium Bern', stage: '8. oder 9. Schuljahr → 1. Jahr gymnasialer Bildungsgang',
    owner: 'Bildungs- und Kulturdirektion Kanton Bern', archive: { label: 'Aufgaben und Lösungen 2022–2026', url: 'https://www.bkd.be.ch/de/start/themen/bildung-im-kanton-bern/mittelschulen/gymnasium/aufnahmeverfahren-gymnasium/aufgaben-und-loesungen-aufnahmepruefungen-gymnasium.html' },
    grading: 'Schriftliche Prüfungen in Deutsch, Französisch, Englisch und Mathematik I/II (Punkte → Note).', pass: 'Massgebend sind die kantonalen Aufnahmebestimmungen (siehe offizielle Seite).',
    subjects: {
      'mathe-1': {
        title: 'Mathematik I (ohne Taschenrechner)', minutes: 60, form: 'du', answer: 'grid', years: '2022–2026',
        aids: 'Geodreieck, Zirkel, Lineal, Stifte in unterschiedlichen Farben. Kein Taschenrechner.',
        rules: ['Bearbeitungsdauer: 60 Minuten.', 'Alle Lösungsblätter sind mit Namen, Vornamen und Prüfungsnummer zu versehen.', 'Die Aufgaben sind unter Angabe aller nachvollziehbaren Berechnungen und Begründungen direkt auf diese Blätter zu lösen.', 'Die Punktezahlen der Aufgaben sind in Klammern angegeben.'],
        structure: { tasks: 9, total: 30, points: '2–6 Punkte pro Aufgabe, Teilaufgaben mit (1)', note: 'Aufgabe 1 = 4 Kurzaufgaben à 1 Punkt' },
        archetypes: ['Kurzaufgaben (je 1 P.): Masseinheiten umrechnen (dm² → mm²), Bruch × Dezimalzahl, Rechnen mit negativen Zahlen und Potenzen, Prozent als gekürzter Bruch', 'Prozent/Anteile im Alltag (z.B. Kakaoanteil zweier Schokoladen vergleichen)', 'Überschlagen/Plausibilität: welches von mehreren grossen Produkten stimmt – mit kurzer Begründung', 'Bruchterme so weit wie möglich vereinfachen, Endresultat als gekürzter Bruch (6 P.)', 'Sachaufgabe mit Mittelwert/Daten (z.B. Niederschlagsmengen)', 'Kombinatorik / Anzahl Möglichkeiten (z.B. Aufgabenverteilung unter Personen)', 'Rechteck mit Seitenlängen als Terme in x (Umfang/Fläche, Gleichung)', 'Abbildungen: Figur um Punkt drehen, zentrische Streckung mit Streckzentrum', 'Zusammengesetzte Figuren (Quadrat + Rechteck), Würfel zerteilen (27 kleine Würfel)'],
        topics: ['Lehrplan 21 Zyklus 3 (bis 8. bzw. 9. Schuljahr): Zahlen und Terme, Bruchterme, lineare Gleichungen', 'Prozent, Proportionalität, Daten/Mittelwert, Kombinatorik', 'Geometrie: Abbildungen (Drehung, Streckung), Flächen, Würfel/Quader'],
      },
      'mathe-2': {
        title: 'Mathematik II (mit Taschenrechner)', minutes: 60, form: 'du', answer: 'grid', years: '2022–2026',
        aids: 'Geodreieck, Zirkel, Lineal, Taschenrechner (nicht programmierbar und ohne Gleichungslöser).',
        rules: ['Bearbeitungsdauer: 60 Minuten.', 'Alle Lösungsblätter sind mit Namen, Vornamen und Prüfungsnummer zu versehen.', 'Die Aufgaben sind unter Angabe aller nachvollziehbaren Berechnungen und Begründungen direkt auf diese Blätter zu lösen.', 'Die Punktezahlen der Aufgaben sind in Klammern angegeben.'],
        structure: { tasks: 9, total: 33, points: '2–6 Punkte pro Aufgabe' },
        archetypes: ['Funktionaler Zusammenhang mit Tabelle und Diagramm (z.B. Wasserspiegel sinkt gleichmässig: Punkte eintragen, Gerade zeichnen, Werte ablesen)', 'Sachrechnen mit Anteilen/Brüchen und grossen Zahlen (z.B. Raumsonde, Gewicht, Treibstoffanteil)', 'Gitternetz/Koordinaten: Punkte, Flächen, Muster (6 P.)', 'Dreieck konstruieren aus Winkeln und Seite', 'Kombinatorik (zwei verschiedene Buchstaben aus einem Vorrat ziehen)', 'Würfel-Augensummen / Wahrscheinlichkeit', 'Bauplan mit Massstab: Flächen berechnen', 'Prozentuale Veränderung von Rechteck-Seiten → Fläche', 'Tarife/lineare Funktion (Taxi: Grundgebühr + Preis pro km)'],
        topics: ['Funktionale Zusammenhänge, Diagramme, lineare Funktionen', 'Prozent, Proportionalität, Massstab', 'Kombinatorik und Wahrscheinlichkeit', 'Konstruktionen, Flächen, Koordinatensystem'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 120, form: 'du', answer: 'lines', years: '2022–2026', aids: 'keine (gemäss Prüfungsblatt)',
        rules: ['Du hast zwei Stunden Zeit, um die Prüfung zu lösen; du kannst dir die Zeit selbst einteilen.', 'Empfehlung: Lesen des Textes und Aufgaben 1–4 ca. 40 Minuten, Schreibauftrag (Aufgabe 5) ca. 80 Minuten.'],
        structure: { tasks: 5, total: 28, points: 'Textarbeit (Aufgaben 1–4) + Schreibauftrag (Aufgabe 5)' },
        material: { kind: 'Sachtext / Essay zu einem Alltags- oder Gesellschaftsthema (z.B. Begegnungen, Kommunikation) mit Zeilennummern und Abschnitten', words: '600–800' },
        archetypes: ['1 Worterklärungen: Begriffe aus dem Text im Kontext erklären (mit Zeilenangabe)', '2 Gliederung und Grobverständnis: Abschnitten passende Überschriften/Zusammenfassungen zuordnen', '3 Aussagen zum Text beurteilen (stimmt / stimmt nicht, mit Begründung)', '4 Sprachliche Aufgabe zum Text (Satzbau, Formulierungen umformen)', '5 Schreibauftrag (ca. 80 min): persönliche Erörterung zum Thema des Textes, mit Vorgaben für Einleitung (konkrete Situation), Hauptteil (begründen/vergleichen) und Schluss (Tipps oder persönliche Lehre)'],
        topics: ['Textverständnis Sachtext, Wortbedeutungen im Kontext', 'Textproduktion: Erörterung/Stellungnahme mit klarem Aufbau'],
      },
      franz: {
        title: 'Französisch', minutes: 60, form: 'du', answer: 'lines', years: '2022–2026', aids: 'gemäss Prüfungsblatt (teilweise Wörterbuch)',
        rules: ['Lies die Anweisungen zu jeder Übung genau.', 'Schreibe vollständige Sätze, nur auf Französisch, wo verlangt.'],
        structure: { tasks: 3, total: 90, points: 'Exercice I–III (je ca. 30 Punkte)' },
        material: { kind: 'kurzer französischer Lesetext (Alltag, Freizeit, Reisen) mit Zeilennummern', words: '250–400' },
        archetypes: ['Exercice I – Compréhension: richtig/falsch ankreuzen, bei «richtig» Zeile angeben, bei «falsch» Aussage auf Deutsch korrigieren', 'Exercice II – Grammaire/vocabulaire: Verben konjugieren (présent, passé composé), Lücken mit passendem Wort füllen', 'Exercice III – Production écrite: eigenen Text in der Gegenwart schreiben mit Vorgaben (Strukturwörter wie d’abord, ensuite …), ohne Textausschnitte zu kopieren'],
        topics: ['Leseverstehen A2', 'Konjugation présent/passé composé, Vokabular Alltag', 'Kurzer eigener Text'],
      },
      englisch: {
        title: 'Englisch', minutes: 60, form: 'du', answer: 'lines', years: '2022–2026', aids: 'keine',
        rules: ['Die Prüfung dauert 60 Minuten.', 'Alle Anleitungen vor den Prüfungsaufgaben genau lesen und befolgen.', 'Alle Lösungen mit Tinte oder Kugelschreiber direkt auf die Aufgabenblätter schreiben.'],
        structure: { tasks: 2, total: 60, points: 'Part 1: Reading comprehension 30 Punkte · Part 2: Writing 30 Punkte' },
        material: { kind: 'englischer Zeitungsartikel (Gesellschaft, Lifestyle, Technik) mit nummerierten Paragraphen', words: '600–800' },
        archetypes: ['Part 1 Reading: ca. 15 Satzanfänge, die mit der passenden Option (Multiple Choice) zum Artikel ergänzt werden («According to … ___»), inkl. Frage zur Bedeutung des Titels und zur Gesamtaussage', 'Part 2 Writing: eigener Text (E-Mail, Meinung, Erlebnis) zum Thema des Artikels mit inhaltlichen Vorgaben und Wortzahl'],
        topics: ['Reading comprehension B1', 'Writing: strukturierter Text mit Vorgaben'],
      },
    },
  },
  {
    id: 'be-bms', canton: 'BE', exam: 'bmsauf', name: 'Aufnahmeprüfung Berufsmaturität Bern', stage: 'BM 1 (lehrbegleitend) / BM 2',
    owner: 'Berufsmaturitätsschulen Kanton Bern (z.B. IDM Thun, Inforama)', archive: { label: 'Beispielprüfungen mit Lösungen (IDM Thun)', url: 'https://www.idm.ch/berufsmaturitat/beispiele-aufnahmeprufungen/' },
    grading: 'Prüfungsfächer Deutsch, Französisch, Englisch und Mathematik; Punkte → Note gemäss Skala auf dem Prüfungsblatt.', pass: 'Bestehensnorm gemäss kantonalem Reglement (siehe Schule).',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 75, form: 'Sie', answer: 'grid', years: '2021–2025',
        aids: 'Schreibzeug, Geodreieck, Lineal, Zirkel; Taschenrechner ohne CAS, ohne Solver-Funktion, nicht grafikfähig.',
        rules: ['Zeit: 75 Minuten.', 'Der Lösungsweg muss nachvollziehbar sein.', 'Die Punkte pro Teilaufgabe sind bei jeder Aufgabe angegeben.'],
        structure: { tasks: 6, total: 36, points: '1–2 Punkte pro Teilaufgabe (Aufgaben mit 4–6 Teilaufgaben)', note: 'Notenskala: 36 Punkte, Note in Halbnoten' },
        archetypes: ['Grundoperationen und Terme: je 1 Punkt pro Teilaufgabe (Klammern, Potenzen, Bruchterme, Faktorisieren)', 'Gleichungen und Gleichungssysteme (lineare, mit Brüchen)', 'Prozent-/Sachrechnen aus Beruf und Alltag (Umsatz, Durchschnittspreise, Lückentext «… Prozent mehr als …»)', 'Proportionalität/Dreisatz, Infusionen und Durchflussmengen', 'Geometrie: Pythagoras, Flächen, Körper (Volumen/Oberfläche)', 'Lineare Funktionen / Textaufgabe mit Gleichung'],
        topics: ['Stoff Sekundarstufe I (Lehrplan 21): Terme, Gleichungen, Prozent, Proportionalität, Geometrie, Funktionen'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 75, form: 'Sie', answer: 'lines', years: '2021–2025', aids: 'Eigenes Rechtschreibwörterbuch',
        rules: ['Wählen Sie eines der beiden Themen aus und bearbeiten Sie zu diesem Thema beide Teilaufträge.', 'Schreiben Sie zu Teilauftrag 1 rund eine halbe Seite, zu Teilauftrag 2 mindestens eine Seite.'],
        structure: { tasks: 2, total: null, points: 'Bewertung nach Kriterien (Kernaussage erfasst, Auseinandersetzung, Sprache)', note: 'Wahl aus 2 Themen mit je 2 Teilaufträgen' },
        material: { kind: 'Thema A: literarischer Text (Gedicht oder Erzählung) · Thema B: Zeitungsartikel', words: '300–600' },
        archetypes: ['Thema A Teilauftrag 1: zentrale Aussage/innere Spannung im literarischen Text beschreiben (mit Textbelegen)', 'Thema A Teilauftrag 2: persönliche Stellungnahme («Würden Sie … raten?»)', 'Thema B Teilauftrag 1: wichtigste Aussagen des Artikels prägnant zusammenfassen', 'Thema B Teilauftrag 2: Position beziehen zu einer im Artikel diskutierten Lösung/These'],
        topics: ['Textverständnis, Zusammenfassung, Erörterung'],
      },
      englisch: {
        title: 'Englisch schriftlich', minutes: 45, form: 'Sie', answer: 'lines', years: '2021–2025', aids: 'keine',
        rules: ['Zeit: 45 Minuten. Hilfsmittel: keine.', 'Part 1: Reading (empfohlen 25 Minuten), Part 2: Writing.'],
        structure: { tasks: 4, total: 50, points: 'Teil 1 Textverständnis 25 · Teil 2 Textproduktion 25' },
        archetypes: ['Multiple Choice: 10 kurze Alltagsnachrichten/Schilder – was bedeuten sie? (10 Punkte)', 'True / False / Not Given zu einem Text (10 Punkte)', 'Matching (5 Punkte)', 'Writing: E-Mail/Nachricht mit 4 inhaltlichen Punkten (z.B. Lieblingsaktivität beschreiben, warum, was schwierig ist, Empfehlung)'],
        topics: ['A2–B1: Leseverstehen, kurze Textproduktion'],
      },
      franz: {
        title: 'Französisch schriftlich', minutes: 45, form: 'du', answer: 'lines', years: '2019–2025', aids: 'keine',
        rules: ['Zeit: 45 Minuten. Hilfsmittel: keine.'],
        structure: { tasks: 3, total: 50, points: 'Teil 1 Textverständnis 25 · Teil 2 Textproduktion 25' },
        archetypes: ['Satzanfänge passend zu einem Info-Text ergänzen (z.B. Tipps «Pour cuisiner, …»)', 'Vrai/faux zu einem Dialog oder Text', 'Production écrite: Angebot auswählen und begründen nach Vorgaben («vous préférez …, votre budget est de …»)'],
        topics: ['A2: Leseverstehen, Alltagswortschatz, kurze Textproduktion'],
      },
    },
  },

  // ======================= LUZERN =======================
  {
    id: 'lu-matura', canton: 'LU', exam: 'matura', name: 'Schriftliche Maturaprüfung Mathematik (Kantonsschulen Luzern)', stage: 'Gymnasium – Grundlagenfach Mathematik',
    owner: 'Kantonsschulen Alpenquai und Reussbühl Luzern', archive: { label: 'Maturaprüfungen mit Lösungen (KS Alpenquai)', url: 'https://ksalpenquai.lu.ch/profil/fachschaften/Mathematik_Fachseite/Maturapruefungen' },
    requirements: { label: 'Maturaprüfungen Kantonsschule Reussbühl', url: 'https://ksreussbuehl.lu.ch/ausbildung/Faecher_neu/Mathematik/fa_mathematik_maturapruefungen' },
    grading: 'Punkte → Note; die Note 6 wird ab ca. 36–42 Punkten erteilt (je nach Jahrgang, auf dem Deckblatt angegeben).', pass: 'Maturanote gemäss MAR/MAV; schulinterne Prüfung.',
    subjects: {
      mathe: {
        title: 'Schriftliche Maturaprüfung Mathematik (Grundlagenfach)', minutes: 180, form: 'Sie', answer: 'grid', years: '2016–2024',
        aids: 'Formelsammlung «Formeln, Tabellen, Begriffe» (DMK/DPK), Taschenrechner TI-30 (z.B. TI-30X Pro MultiView, ohne Handbuch).',
        rules: ['Prüfungsdauer: 3 Stunden.', 'Lösen Sie jede Aufgabe auf einem separaten Blatt.', 'Alle Lösungen müssen den Lösungsweg zeigen; Resultate ohne Herleitung geben keine Punkte.', 'Die Punkte pro Teilaufgabe sind angegeben.'],
        structure: { tasks: 5, total: 44, points: '6–11 Punkte pro Aufgabe, Teilaufgaben a)–f) mit 1–4 Punkten', note: 'Note 6 bereits bei etwas weniger als dem Punktemaximum (z.B. 40 von 44)' },
        archetypes: ['Vektorgeometrie: Punkte, Geraden und Ebenen im Raum, Abstände, Winkel, Schnittpunkte, Flächen/Volumen (10–11 P.)', 'Analysis I: Funktionsuntersuchung (Nullstellen, Extrema, Wendepunkte, Tangente), Funktionenschar mit Parameter k inkl. Beweisaufgabe', 'Analysis II: Anwendung mit Kontext (z.B. Küstenlinie als Graph, Flächen zwischen Kurven als «Badesee», Integral), Optimierung', 'Stochastik: Kombinatorik, Binomialverteilung, bedingte Wahrscheinlichkeit, Baumdiagramm (6–9 P.)'],
        topics: ['Analysis: Ableitung, Kurvendiskussion, Integral, Extremalprobleme, Funktionenscharen', 'Vektorgeometrie: Geraden, Ebenen, Skalar-/Vektorprodukt', 'Stochastik: Kombinatorik, Wahrscheinlichkeit, Binomialverteilung'],
      },
    },
  },

  // ======================= AARGAU =======================
  {
    id: 'ag-gym', canton: 'AG', exam: 'gym', name: 'Aufnahmeprüfung Gymnasium Aargau', stage: 'Bezirksschule/Sek → Gymnasium',
    owner: 'Departement Bildung, Kultur und Sport Aargau', archive: { label: 'Ältere Aufnahmeprüfungen 2024–2026 (Deutsch, Mathematik)', url: 'https://www.ag.ch/de/themen/bildung-forschung/mittelschulen/gymnasium/aufnahmebedingungen' },
    grading: 'Punkte → Note je Fach (ungerundete Note und Endnote auf dem Deckblatt), Erst- und Zweitkorrektur.', pass: 'Bei Bestehen definitive Aufnahme ins Gymnasium (Bestehensnorm siehe Kanton).',
    subjects: {
      deutsch: {
        title: 'Deutsch, 1. Serie', minutes: 90, form: 'Sie', answer: 'lines', years: '2024–2026', aids: 'keine',
        rules: ['Dauer: 90 Minuten. Hilfsmittel: keine.', 'Teil 1: Textverständnis und Sprachbetrachtung. Teil 2: Kurzaufsatz (mindestens 250 Wörter).'],
        structure: { tasks: 18, total: null, points: '1–3 Punkte pro Aufgabe, Teilnoten für beide Teile', note: 'Teil 1 ca. 15–19 Aufgaben mit Zeilenbezug, Teil 2 Kurzaufsatz' },
        sections: ['1. Teil: Textverständnis und Sprachbetrachtung', '2. Teil: Kurzaufsatz (mind. 250 Wörter)'],
        material: { kind: 'Kurzgeschichte (moderne deutschsprachige Literatur) mit Zeilennummern', words: '600–900' },
        archetypes: ['Aussagen der Geschichte in die richtige zeitliche Reihenfolge bringen', 'Charakterzug einer Figur nennen und begründen', 'Erzählperspektive ankreuzen; typische Merkmale einer Kurzgeschichte ankreuzen', 'Zitat mit Zeilenangabe deuten («Zeile 29: […] – was bedeutet …?»), Titel interpretieren', 'Umgangssprachliche Ausdrücke in Standardsprache umformulieren', 'Synonyme und Antonyme (Wortart beibehalten)', 'Lückentext mit korrektem Wort aus Auswahl', 'Wortarten bestimmen (bei Partikeln Untergruppe), Haupt-/Nebensätze unterscheiden, Fall bestimmen, Satzglieder nennen', 'Rechtschreibung: Getrennt-/Zusammenschreibung, Gross-/Kleinschreibung, Kommas setzen', 'Direkte in indirekte Rede, Steigerungsformen-Tabelle', 'Teil 2: Kurzaufsatz zu einem von mehreren Themen (Erörterung oder Erzählung), mind. 250 Wörter'],
        topics: ['Literarisches Textverständnis', 'Wortschatz, Grammatik (Wortarten, Satzglieder, Fälle, Nebensätze), Rechtschreibung, Zeichensetzung', 'Textproduktion'],
      },
      mathe: {
        title: 'Mathematik, 1. Serie', minutes: 90, form: 'Sie', answer: 'grid', years: '2024–2026', aids: 'Taschenrechner (nicht programmierbar), Zirkel, Geodreieck',
        rules: ['Dauer: 90 Minuten.', 'Der Lösungsweg muss vollständig, sauber und nachvollziehbar sein.', 'Schlussresultate, falsche Lösungsansätze und ungültige Ergebnisse müssen deutlich gekennzeichnet werden.', 'Einheiten bei Resultaten müssen angegeben werden.', 'Alle Ergebnisse sind in exakter, vereinfachter Form anzugeben, sofern nichts anderes verlangt ist.', 'Die Prüfung muss mit Tinte, Kugelschreiber oder Filzstift geschrieben werden.'],
        structure: { tasks: 6, total: 36, points: '2–9 Punkte pro Aufgabe, Teilaufgaben mit halben Punkten (z.B. 3P+3P+3P)' },
        archetypes: ['Bruchterme so weit wie möglich vereinfachen (Binome erkennen, faktorisieren) – 3 Teilaufgaben', 'Bruchgleichungen nach x auflösen', 'Wahrscheinlichkeit mit Ziehen mit Zurücklegen und Spielregeln (Gewinnspiel), Resultat in Prozent', 'Geometrie: Flächen/Pythagoras/Körper mit Skizze', 'Lineare Funktion / Sachaufgabe mit Graph', 'Proportionalität, Prozent oder Zinsen in Sachkontext'],
        topics: ['Terme und Bruchterme, Gleichungen', 'Wahrscheinlichkeit', 'Geometrie (Pythagoras, Flächen, Körper)', 'Funktionen und Sachrechnen'],
      },
    },
  },
  {
    id: 'ag-fms', canton: 'AG', exam: 'fms', name: 'Aufnahmeprüfung FMS · WMS · IMS Aargau', stage: 'Sekundar-/Bezirksschule → FMS, WMS oder IMS',
    owner: 'Departement Bildung, Kultur und Sport Aargau', archive: { label: 'Prüfungsbeispiele FMS/WMS/IMS', url: 'https://www.ag.ch/de/themen/bildung-forschung/mittelschulen/fachmittelschule' },
    requirements: { label: 'Informationen Aufnahmeprüfung FMS/WMS/IMS (PDF)', url: 'https://www.ag.ch/media/kanton-aargau/bks/sekii/mittelschulen/bksbm-aufnahmepruefung-fms-wms-ims.pdf' },
    grading: 'Geprüft werden Deutsch, Französisch, Englisch und Mathematik schriftlich.', pass: 'Bestehensnorm gemäss kantonalem Reglement.',
    subjects: {
      deutsch: {
        title: 'Deutsch – Serie A', minutes: 90, form: 'du', answer: 'lines', years: '2025–2026', aids: 'keine',
        rules: ['Prüfungsdauer: 90 Minuten. Empfohlen: 45 Minuten für Teil 1 und 2, dann bleibt genügend Zeit für den Kurzaufsatz.', 'Die Prüfung besteht aus drei Teilen: Textverständnis, Sprachbetrachtung und Kurzaufsatz.', 'Schreibe den Kurzaufsatz am Schluss, nachdem du Teil 1 und 2 gelöst hast.'],
        structure: { tasks: 3, total: null, points: 'Teil 1 ca. 14 Aufgaben (1–3 P.), Teil 2 ca. 8 Aufgaben, Teil 3 Kurzaufsatz mit eigener Note' },
        sections: ['Teil 1: Textverständnis', 'Teil 2: Sprachbetrachtung', 'Teil 3: Kurzaufsatz'],
        material: { kind: 'Kurzgeschichte eines deutschsprachigen Autors (z.B. Nachkriegsliteratur) mit Zeilennummern', words: '700–1000' },
        archetypes: ['Zitat mit Zeilenangabe erklären', 'Zwei Beispiele aus dem Text nennen', 'Schlussfolgerungen aus dem Text ziehen', 'Reaktion einer Figur in eigenen Worten beschreiben', 'Stelle im Text zitieren, die etwas belegt', 'Synonym/Antonym im Satzkontext', 'Zutreffende Aussagen ankreuzen; Merkmale der Kurzgeschichte', 'Teil 2: Wortarten, Nebensätze bestimmen, Aktiv/Passiv, indirekte Rede, Zeitformen, Satzglieder abtrennen, Objekte bestimmen, Kommas setzen', 'Teil 3: Kurzaufsatz zu einem Thema'],
        topics: ['Literarisches Textverständnis', 'Grammatik und Zeichensetzung', 'Kurzaufsatz'],
      },
      mathe: {
        title: 'Mathematik – 1. Serie', minutes: 90, form: 'du', answer: 'grid', years: '2025–2026', aids: 'Taschenrechner (nicht programmierbar), Zirkel, Geodreieck',
        rules: ['Die Prüfung dauert 90 Minuten.', 'Taschenrechner (nicht programmierbar), Zirkel und Geodreieck sind zugelassen.', 'Der Lösungsweg muss nachvollziehbar sein.'],
        structure: { tasks: 6, total: 30, points: 'Themenblöcke mit 3–6 Punkten (z.B. «Terme und Gleichungen 4.5 P»)' },
        archetypes: ['Terme und Gleichungen (Themenblock)', 'Lineare Funktionen im Sachkontext (z.B. Seilbahn: Höhe nach x Minuten, Funktionsgleichung, Graph zeichnen)', 'Prozent und Proportionalität', 'Geometrie und Körper', 'Daten und Wahrscheinlichkeit'],
        topics: ['Stoff Sekundarstufe I Aargau: Terme, Gleichungen, Funktionen, Geometrie, Daten'],
      },
    },
  },
  {
    id: 'ag-bms', canton: 'AG', exam: 'bmsauf', name: 'Aufnahmeprüfung Berufsmaturität Aargau', stage: 'BM 1 (lehrbegleitend) / BM 2',
    owner: 'Berufsschule Aarau', archive: { label: 'Aufnahmeprüfungen mit Lösungen 2016–2025', url: 'https://www.bs-aarau.ch/de/aufnahmepruefungen-_content---1--1177.html' },
    grading: 'Grundlage: Lehrplan und Lehrmittel der Aargauer Sekundarschulen. Punkte → Note (Note 6 schon vor dem Punktemaximum).', pass: 'Bestehensnorm gemäss kantonalem Reglement (Durchschnitt).',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 60, form: 'Sie', answer: 'grid', years: '2016–2025', aids: 'Netzunabhängiger Taschenrechner ohne Textspeicher und ohne alphanumerische Anzeige, Geodreieck, Zirkel',
        rules: ['Dauer der Prüfung: 60 Minuten.', 'Zum Erreichen der angegebenen Punktezahl muss der Lösungsweg vollständig und klar ersichtlich sein.', 'Die kleinste Bewertungseinheit ist ein halber Punkt.', 'Für 32 der möglichen 40 Punkte wird die Note 6 erteilt.'],
        structure: { tasks: 13, total: 40, points: '1–5.5 Punkte pro Aufgabe (halbe Punkte)', note: 'Note 6 bereits ab 80 % der Punkte' },
        archetypes: ['Terme so weit wie möglich vereinfachen', 'Faktorisieren (Produkt mit möglichst vielen Faktoren)', 'Gleichungen nach x auflösen', 'Zahlenrätsel als Gleichung («Zieht man vom Dreifachen einer Zahl 10 ab …»)', 'Textaufgaben: Preise/Kopien, Mischungen (Nüsse/Schokolade pro kg), Arbeitsaufgaben (zwei Arbeiter)', 'Grössen umrechnen', 'Körper: würfelförmiger Tank zu x % gefüllt, Kugel im Würfel, Zylinder-Abwicklung', 'Winkelaufgabe / Geometrie mit Skizze (Springreit-Hindernis, Halbkreis auf rechtwinkligem Dreieck)', 'Diagrammaufgabe: Kreisdiagramm, Notenverteilung, Mittelwert', 'Richtige Aussagen ankreuzen'],
        topics: ['Terme, Faktorisieren, Brüche, Gleichungen', 'Sachrechnen: Prozent, Proportionalität, Mischung, Arbeit', 'Einheiten, Geometrie, Körper', 'Statistik/Diagramme'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 90, form: 'Sie', answer: 'lines', years: '2016–2025', aids: 'keine',
        rules: ['Dauer der Prüfung: 90 Minuten. Erlaubte Hilfsmittel: keine.', 'Sprachbetrachtung (40 Punkte, ca. 30–35 Minuten) und Textproduktion (60 Punkte, ca. 55–60 Minuten).'],
        structure: { tasks: 12, total: 100, points: 'Teil 1 Sprachbetrachtung 40 · Teil 2 Textproduktion 60', note: 'Notenskala in 10er-Schritten (95–100 = 6)' },
        sections: ['1. Textverständnis und Sprachbetrachtung', '2. Verfassen eines Textes (mindestens 200 Wörter)'],
        material: { kind: 'Sachtext / Zeitungsartikel mit Zeilennummern', words: '400–600' },
        archetypes: ['Fragen zum Text in ganzen Sätzen beantworten', 'Gemäss Text richtige Antworten ankreuzen / Zuordnungsaufgaben', 'Synonyme zu Wörtern aus dem Text (mit Zeilenangabe)', 'Antonyme', 'Fehlende Kommas in Zeilen x–y setzen', 'Wortfamilie: fehlende Wortarten ergänzen', 'Fälle bestimmen', 'Nebensätze unterstreichen / Satzteil in Nebensatz umformen', 'Aktiv ↔ Passiv', 'Verben in verlangte Zeitform setzen', 'Teil 2: Text mit mind. 200 Wörtern zu einem von drei Themen (z.B. «Ein Zuhause ist ein Privileg», «Altersdiskriminierung»), Wortzahl angeben'],
        topics: ['Sachtextverständnis, Wortschatz, Grammatik, Zeichensetzung, Textproduktion'],
      },
      englisch: {
        title: 'Englisch', minutes: 45, form: 'Sie', answer: 'lines', years: '2016–2025', aids: 'keine',
        rules: ['Dauer der Prüfung: 45 Minuten. Erlaubte Hilfsmittel: keine.'],
        structure: { tasks: 3, total: 50, points: 'Reading/Vocabulary 18 (20 min) · Grammar/Structures 17 (10 min) · Writing 15 (15 min)' },
        sections: ['1. Reading Comprehension, Vocabulary', '2. Grammar, Structures', '3. Writing'],
        material: { kind: 'englischer Sachtext (z.B. Remote Work) mit nummerierten Absätzen', words: '300–450' },
        archetypes: ['True / false / not given zu Aussagen a–f', 'Choose the correct answer', 'Fill in the correct verb forms', 'Make questions about the underlined words', 'Make negative sentences', 'Writing: einen von zwei Schreibaufträgen wählen'],
        topics: ['A2–B1: Reading, Tenses, Questions/Negations, Writing'],
      },
      franz: {
        title: 'Französisch', minutes: 45, form: 'Sie', answer: 'lines', years: '2016–2025', aids: 'keine',
        rules: ['Dauer der Prüfung: 45 Minuten. Erlaubte Hilfsmittel: keine.'],
        structure: { tasks: 4, total: 55, points: 'Compréhension 20 · Vocabulaire 10 · Grammaire 15 · Production écrite 10' },
        sections: ['1. Compréhension de texte', '2. Vocabulaire', '3. Grammaire', '4. Production écrite'],
        material: { kind: 'französischer Sachtext (z.B. Tiere, Velo-Reisen) ', words: '300–400' },
        archetypes: ['Vrai/faux zu Aussagen über den Text', 'Satzanfänge passend zum Text vervollständigen', 'Fragen auf Deutsch beantworten («Nennen Sie zwei Gründe»)', 'Vocabulaire en contexte: Lücken mit passendem Wort', 'Grammaire: Pronomen einsetzen (le/la/lui/leur/en/y), Adjektive angleichen und steigern, Fragen bilden (est-ce que), Sätze verneinen', 'Production écrite: kurzer Text nach Vorgaben'],
        topics: ['A2: Leseverstehen, Wortschatz, Pronomen, Adjektive, Fragen/Verneinung, kurze Textproduktion'],
      },
    },
  },

  // ======================= SOLOTHURN =======================
  {
    id: 'so-ap', canton: 'SO', exam: 'gym', name: 'Aufnahmeprüfung Kantonsschulen Solothurn (BM · FMS · Gymnasium)', stage: 'Sek → Gymnasium, FMS oder BM (Solothurn & Olten)',
    owner: 'Kantonsschule Solothurn', archive: { label: 'Alte Prüfungen 2019–2025 mit Lösungen', url: 'https://ksso.so.ch/bildungsangebot/gymnasium/aufnahme/alte-pruefungen/' }, alsoFor: ['bmsauf', 'fms'],
    requirements: { label: 'Prüfungseckwerte Aufnahmeprüfung 2027 (BM · FMS · Gymnasium)', url: 'https://berufsmatura.so.ch/fileadmin/berufsmatura/Aufnahmeverfahren/pruefungseckwerte_ap-2027_gym-fms-bm_def_20260507.pdf' },
    grading: 'Seit 2018 gleiche Prüfung für BM, FMS und Gymnasium. Prüfungsresultat = Mathematik × 2 + Deutsch + Fremdsprachen (Durchschnitt Englisch und Französisch); ganze und halbe Noten.', pass: 'Eintritt BM und FMS ab 16 Notenpunkten, Gymnasium ab 18 Notenpunkten.',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 90, form: 'Sie', answer: 'grid', years: '2019–2025',
        aids: 'Einfacher Taschenrechner (keine Smartphones, keine Rechner mit Grafik- oder Algebrafunktionen zum Umformen von Termen oder Lösen von Gleichungen).',
        rules: ['Prüfungsdauer: 90 Minuten.', 'Die Lösungen müssen mit Tinte, Filzstift oder Kugelschreiber direkt auf das Aufgabenblatt geschrieben werden.', 'Für die maximale Punktzahl wird ein vollständiger Lösungsweg erwartet.', 'Falsche Lösungsansätze und ungültige Ergebnisse müssen deutlich gekennzeichnet und durchgestrichen werden; sind mehrere Lösungswege vorhanden, wird die Aufgabe nicht bewertet.'],
        structure: { tasks: 8, total: 32, points: '3–5 Punkte pro Aufgabe, Teilpunkte angegeben (z.B. 1 + 2 + 2 = 5 Punkte)', note: '6 Aufgaben aus Bereich A (Zahlen, Algebra, Funktionen, Proportionalität, Prozent), 2 aus Bereich B (Geometrie, Pythagoras, Körper, Kreis)' },
        archetypes: ['Lücken in Binomen/Faktorisierungen füllen, vollständig ausklammern, Termgleichwertigkeit per Tabelle ankreuzen', 'Bruchterme vereinfachen', 'Potenzen und Wurzeln', 'Lineare Gleichungen und Bruchgleichungen', 'Gleichungssysteme / Textaufgaben mit Gleichung', 'Prozent- und Proportionalitätsaufgaben', 'Lineare Funktionen', 'Formeln umformen'],
        topics: ['Algebra der Sekundarstufe I: Terme, Faktorisieren, Bruchterme, Potenzen, Gleichungen, Gleichungssysteme, Funktionen'],
      },
      'deutsch-sprach': {
        title: 'Deutsch – Sprachbogen', minutes: 30, form: 'Sie', answer: 'lines', years: '2019–2025', aids: 'keine',
        rules: ['Prüfungsdauer: 45 Minuten (Richtzeit).', 'Teil 1: Fragen zum Text · Teil 2: Sprache, Grammatik und Rechtschreibung.'],
        structure: { tasks: 11, total: 20, points: 'Teil 1 ca. 9 Punkte, Teil 2 ca. 10 Punkte (halbe Punkte möglich)' },
        sections: ['Teil 1: Fragen zum Text', 'Teil 2: Sprache, Grammatik und Rechtschreibung'],
        material: { kind: 'Zeitungsartikel / Sachtext zu einem Jugend- oder Gesellschaftsthema (z.B. Spielzeugwaffen, ethisches Hacking)', words: '500–700' },
        archetypes: ['Fragen zum Inhalt in eigenen Worten (1–2 Punkte)', 'Worterklärungen stichwortartig in eigenen Worten', 'Richtig oder falsch (oder «keine Angabe im Text»)', 'Frage zum Titel des Artikels', 'Teil 2: alle fehlenden Kommas setzen', 'Grammatik- und Rechtschreibfehler im Textausschnitt korrigieren', 'Wortfamilien ergänzen (wie im Beispiel)', 'Text in die indirekte Rede setzen'],
        topics: ['Sachtextverständnis', 'Kommasetzung, Rechtschreibung, Grammatik, Wortfamilien, indirekte Rede'],
      },
      'deutsch-aufsatz': {
        title: 'Deutsch – Aufsatz', minutes: 90, form: 'Sie', answer: 'lines', years: '2019–2025', aids: 'keine',
        rules: ['Richtzeit: 75 Minuten. Hilfsmittel: keine.', 'Schreiben Sie zu einem der Themen einen Aufsatz von mindestens anderthalb Seiten (ca. 300 Wörter).', 'Schreiben Sie einen in sich geschlossenen, logisch aufgebauten Text; das Thema muss präzise erfasst sein.', 'Setzen Sie einen passenden eigenen Titel über Ihren Text.'],
        structure: { tasks: 3, total: null, points: 'Bewertung als Note', note: 'Wahl aus 3 Themen: Erörterung, Stellungnahme (Brief/E-Mail), Erzählung' },
        archetypes: ['Thema 1 – Erörterung zu einer Gesellschaftsfrage (z.B. Altersfreigaben bei Games und Serien) mit konkreten Beispielen', 'Thema 2 – Stellungnahme als Brief oder E-Mail an eine befreundete Person zu deren Verhalten', 'Thema 3 – Erzählung, die mit einem vorgegebenen Satz beginnt'],
        topics: ['Erörterung, Stellungnahme, Erzählung'],
      },
      englisch: {
        title: 'Englisch', minutes: 60, form: 'Sie', answer: 'lines', years: '2019–2025', aids: 'keine',
        rules: ['Prüfungsdauer: 60 Minuten.', 'Listening: Sie haben 1 Minute Zeit, die Aufgaben zu lesen; der Hörtext wird zweimal abgespielt.'],
        structure: { tasks: 3, total: 55, points: 'Listening 15 · Reading 20 · Writing 20' },
        sections: ['1. Listening comprehension', '2. Reading comprehension', '3. Writing'],
        material: { kind: 'Hörtext als Transkript zum Vorlesen (Dialog, z.B. über Roboter in der Arbeitswelt) + englischer Lesetext (Artikel)', words: '300–500' },
        archetypes: ['Listening: Multiple Choice und Lückensätze zum Dialog (Hörtext wird zweimal vorgelesen)', 'Reading: richtige Antwort ankreuzen (a–d), Fragen beantworten (Stichworte genügen), Ausdruck im Text finden, der … bedeutet', 'Writing: Text/E-Mail nach Vorgaben'],
        topics: ['A2–B1 Listening, Reading, Writing'],
      },
      franz: {
        title: 'Französisch', minutes: 60, form: 'Sie', answer: 'lines', years: '2019–2025', aids: 'keine',
        rules: ['Prüfungsdauer: 60 Minuten.', 'Zu Beginn haben Sie Zeit, die Fragen durchzulesen; die Hörtexte werden vorgespielt.'],
        structure: { tasks: 4, total: 45, points: 'Hörverstehen, Leseverstehen, Schreiben (0.5–3 Punkte pro Frage)' },
        material: { kind: 'Hörtexte als Transkript zum Vorlesen (kurze Dialoge, z.B. Einkaufen) + französischer Lesetext (z.B. Taschengeld der Jugendlichen)', words: '300–450' },
        archetypes: ['Compréhension orale: Fragen zu einem Telefongespräch/Dialog (1 Punkt)', 'Bilder (a–f) den Dialogen (1–6) zuordnen, Lücken mit gehörten Angaben (Preise, Mengen)', 'Compréhension écrite: 10–15 Fragen zum Artikel, vrai/faux, Zuordnung Wort ↔ Definition', 'Production écrite: Antwortbrief mit Vorgaben (Anrede, Dank, Verneinung mit Begründung, Vorschlag, Schlusssatz, Grussformel)'],
        topics: ['A2: Hör- und Leseverstehen, kurzer Brief'],
      },
    },
  },

  // ======================= ST. GALLEN =======================
  {
    id: 'sg-gym', canton: 'SG', exam: 'gym', name: 'Aufnahmeprüfung Gymnasium St. Gallen', stage: '2. oder 3. Sekundarklasse → Gymnasium',
    owner: 'Bildungsdepartement Kanton St. Gallen / Amt für Mittelschulen', archive: { label: 'Alte Prüfungen (Maturanavigator)', url: 'https://www.maturanavigator.ch/gymnasium/gymnasium/aufnahme/aufnahmepruefung-2022' },
    requirements: { label: 'Prüfungsanforderungen & Musteraufgaben (sg.ch)', url: 'https://www.sg.ch/bildung-sport/mittelschule/aus-dem-amt/aufnahmepruefung.html' },
    grading: 'Punkte → Schlussnote je Prüfung (Kandidatennummer statt Name).', pass: 'Aufnahme gemäss kantonalem Aufnahmereglement.',
    subjects: {
      'mathe-1': {
        title: 'Mathematik 1 (ohne Taschenrechner)', minutes: 90, form: 'du', answer: 'grid', years: '2015–2026',
        aids: 'Tintenschreiber, Bleistift und Radiergummi, Geodreieck, Massstab, Zirkel, Farbstifte. Kein Taschenrechner.',
        rules: ['Dauer: 90 Minuten.', 'Löse die Aufgaben auf diesen Blättern.', 'Der Lösungsweg muss aus der Darstellung klar ersichtlich sein.'],
        structure: { tasks: 11, total: 57, points: '2–8 Punkte pro Aufgabe' },
        archetypes: ['Termwert für gegebene x bestimmen und vereinfachen', 'Zahlenfolgen (jede Zahl = Summe der zwei vorangehenden), fehlende Zahlen bestimmen', 'Bruch- und Dezimalrechnen ohne Rechner, Terme vereinfachen', 'Gleichungen lösen', 'Textaufgaben mit Gleichung (Alter, Geld, Bewegung)', 'Konstruktionen (Dreiecke, Vierecke, Ortslinien)', 'Winkelberechnungen in Figuren', 'Prozent/Proportionalität', 'Würfel- und Quadergeometrie, Raumvorstellung'],
        topics: ['Lehrplan Volksschule SG (Sek): Arithmetik, Algebra, Geometrie, Sachrechnen'],
      },
      'mathe-2': {
        title: 'Mathematik 2 (mit Taschenrechner)', minutes: 90, form: 'du', answer: 'grid', years: '2015–2026',
        aids: 'Tintenschreiber, Bleistift und Radiergummi, Geodreieck und Zirkel, Taschenrechner.',
        rules: ['Dauer: 90 Minuten.', 'Löse die Aufgaben auf diesen Blättern.', 'Der Lösungsweg muss aus der Darstellung klar ersichtlich sein.'],
        structure: { tasks: 10, total: 45, points: '2–8 Punkte pro Aufgabe' },
        archetypes: ['Fehlende Werte in Tabellen zu Figuren (gleichschenkliges Dreieck, Drachenviereck, Parallelogramm: Seiten, Höhen, Diagonalen, Umfang, Fläche; gemischte Einheiten mm/cm/dm)', 'Pythagoras in Figuren und Körpern', 'Prozent- und Zinsrechnen', 'Kreis, Kreisteile', 'Körper: Volumen, Oberfläche, Masse/Dichte', 'Funktionen und Diagramme', 'Wahrscheinlichkeit/Kombinatorik', 'Sachaufgaben mit mehreren Schritten'],
        topics: ['Geometrie (Flächen, Pythagoras, Kreis, Körper), Prozent/Zins, Funktionen, Daten'],
      },
      'deutsch-sprach': {
        title: 'Deutsch – Sprachprüfung', minutes: 80, form: 'du', answer: 'lines', years: '2015–2026', aids: 'keine',
        rules: ['Dauer der Sprachprüfung: 80 Minuten.', 'Für diese Prüfung sind keine Hilfsmittel erlaubt.'],
        structure: { tasks: 28, total: null, points: 'Teil Textverständnis (ca. 15 Aufgaben) + Teil Sprachbetrachtung (ca. 13 Aufgaben)' },
        sections: ['Textverständnis', 'Sprachbetrachtung'],
        material: { kind: 'literarische Erzählung (z.B. Begegnung Enkelin–Grossmutter im Altersheim) mit Zeilennummern', words: '900–1200' },
        archetypes: ['Richtig/falsch zu 8 Aussagen über den Text', 'Fragen zu Figuren und Handlung in ganzen Sätzen', 'Zitat erklären (Zeile x f.)', 'Belegstelle zitieren', 'Farben/Motive im Textabschnitt zuordnen', 'Humor/Erzähltechnik deuten, Vergleich (z.B. Leben der Fische im Aquarium ↔ Altersheim)', 'Wissensbezug (welthistorische Ereignisse im Leben einer Figur)', 'Sprachbetrachtung: Wortfamilie (Verb + Nomen zum Adjektiv), Zeitform bestimmen und umformen, Fälle bestimmen und setzen, Fremdwort ersetzen, Satzglieder zählen, Verbformen, ein Fehler pro Satz, Kommas mit /, Lückentext aus Liste, Redewendungen mit Körperteilen korrigieren, Antonym-Fehler finden, Wortarten bestimmen'],
        topics: ['Literarisches Textverständnis', 'Wortlehre, Satzlehre, Rechtschreibung, Zeichensetzung, Redewendungen'],
      },
      'deutsch-aufsatz': {
        title: 'Deutsch – Textproduktion', minutes: 60, form: 'du', answer: 'lines', years: '2015–2026', aids: 'Rechtschreibewörterbuch',
        rules: ['Du hast 60 Minuten Zeit.', 'Erlaubtes Hilfsmittel: Rechtschreibewörterbuch.', 'Wähle ein Thema und halte dich an die Vorgaben zu Aufbau und Teilen.'],
        structure: { tasks: 3, total: null, points: 'Bewertung als Note' },
        archetypes: ['Brief/Text an sich selbst oder an eine Person mit zweiteiligem Auftrag (z.B. «Im ersten Teil gehst du auf deine Gründe ein … Im zweiten Teil …»)', 'Erörterung mit Pro und Contra', 'Erzählung mit vorgegebenem Einstieg'],
        topics: ['Textproduktion mit Vorgaben'],
      },
      englisch: {
        title: 'Englisch', minutes: 75, form: 'du', answer: 'lines', years: '2015–2022', aids: 'keine',
        rules: ['Dauer: 75 Minuten.', 'Schreibe die Lösungsbuchstaben in die vorgesehenen Kästchen.'],
        structure: { tasks: 4, total: 100, points: 'A Grammatik & Wortschatz 40 · B Textverständnis 20 · C Textproduktion 20 · D Hörverständnis 20' },
        sections: ['Teil A Grammatik und Wortschatz', 'Teil B Textverständnis', 'Teil C Textproduktion', 'Teil D Hörverständnis'],
        material: { kind: 'Lesetext + Hörtext als Transkript zum Vorlesen', words: '300–450' },
        archetypes: ['Choose the correct option (Relativpronomen, Modalverben, much/many, Präpositionen …)', 'Complete with ONE suitable word', 'Form complete questions asking for the missing part', 'Textverständnis-Fragen', 'Textproduktion (E-Mail/Erzählung)', 'Hörverständnis mit Multiple Choice'],
        topics: ['A2–B1: Grammatik, Wortschatz, Lesen, Schreiben, Hören'],
      },
    },
  },
  {
    id: 'sg-eap', canton: 'SG', exam: 'fms', name: 'Einheitsaufnahmeprüfung (EAP) St. Gallen – FMS · WMS · IMS · BMS', stage: 'Sek → FMS, WMS, IMS oder BMS',
    owner: 'Amt für Mittelschulen St. Gallen', archive: { label: 'Alte Prüfungen EAP (Maturanavigator)', url: 'https://www.maturanavigator.ch/' }, alsoFor: ['bmsauf'],
    requirements: { label: 'Prüfungsanforderungen EAP (sg.ch)', url: 'https://www.sg.ch/bildung-sport/mittelschule/aus-dem-amt/aufnahmepruefung.html' },
    grading: 'Gemeinsame Prüfung für FMS, WMS, IMS und BMS.', pass: 'Gemäss Aufnahmereglement.',
    subjects: {
      'deutsch-sprach': {
        title: 'Deutsch – Sprachprüfung (EAP)', minutes: 60, form: 'du', answer: 'lines', years: '2022–2026', aids: 'keine',
        rules: ['Sprachprüfung: 60 Minuten. Keine Hilfsmittel.'],
        structure: { tasks: 20, total: null, points: 'Textverständnis (ca. 10 Aufgaben) + Sprachbetrachtung (ca. 10 Aufgaben)' },
        material: { kind: 'Erzählung aus dem Alltag Jugendlicher mit Zeilennummern', words: '800–1100' },
        archetypes: ['Richtig/falsch zu Informationen im Text', 'Personifikation/Stilmittel erkennen', 'Zitat (Zeile x) deuten', 'Wortarten aus dem Text bestimmen', 'Titel deuten (Kummer aller Art: Aufzählung)', 'Gross-/Kleinschreibung markieren', 'Verbformen-Tabelle', 'Satzglieder bestimmen', 'Präpositionen einsetzen', 'Zusammengesetzte Nomen bilden', 'Redewendungen zuordnen', 'Präfixe/Vormorpheme', 'Zeitformen bestimmen und umformen', 'Kommaregeln den Beispielen zuordnen'],
        topics: ['Textverständnis, Wortschatz, Grammatik, Rechtschreibung, Zeichensetzung'],
      },
    },
  },

  // ======================= THURGAU =======================
  {
    id: 'tg-pms', canton: 'TG', exam: 'gym', name: 'Aufnahmeprüfung PMS Kreuzlingen (Pädagogische Maturitätsschule)', stage: '3. Sekundarklasse → PMS',
    owner: 'Pädagogische Maturitätsschule Kreuzlingen', archive: { label: 'Prüfungsaufgaben 2019–2026', url: 'https://www.pmstg.ch/aktuell/pruefungsaufgaben.html/7566' },
    grading: 'Punkte → Note je Fach.', pass: 'Gemäss Aufnahmereglement der Thurgauer Mittelschulen.',
    subjects: {
      deutsch: {
        title: 'Deutsch (Sprachprüfung + Aufsatz)', minutes: 115, form: 'du', answer: 'lines', years: '2019–2026', aids: 'keine',
        rules: ['Die Prüfung dauert 115 Minuten: Sprachprüfung 40 Minuten, Aufsatz 75 Minuten.'],
        structure: { tasks: 6, total: 58, points: 'Sprachprüfung mit Punkten, Aufsatz mit Wahlthemen' },
        sections: ['Sprachprüfung (40 Minuten)', 'Aufsatz (75 Minuten)'],
        material: { kind: 'Erzählung (z.B. Familie, Unglück, Wanderung) mit Zeilennummern', words: '700–1000' },
        archetypes: ['10 Aussagen richtig/falsch ankreuzen (x)', 'Fragen zu Figuren, Motiven und Zitaten [Z. x]', 'Sprachaufgaben (Grammatik, Wortschatz)', 'Aufsatz – Wahl aus 3–4 Themen: Perspektivwechsel («Stell dir vor, du bist …»), Tagebucheinträge aus Sicht einer Figur, Erörterung («Was hältst du davon …»), Geschichte fortsetzen'],
        topics: ['Literarisches Textverständnis, Sprachbetrachtung, kreatives und argumentatives Schreiben'],
      },
      'mathe-2': {
        title: 'Mathematik – Teil B (mit Taschenrechner)', minutes: 45, form: 'du', answer: 'grid', years: '2019–2026', aids: 'Nicht-programmierbarer Taschenrechner; keine Formelsammlung.',
        rules: ['Zur Verfügung stehende Zeit: 45 Minuten.', 'Nicht-programmierbarer Taschenrechner erlaubt, nicht aber Formelsammlungen.', 'Der Lösungsweg muss ersichtlich sein.'],
        structure: { tasks: 5, total: 50, points: '8–12 Punkte pro Aufgabe' },
        archetypes: ['Prozent- und Zinsrechnen in Sachkontext', 'Geometrie mit Pythagoras, Kreis, Körper', 'Lineare Funktionen / Diagramme', 'Proportionalität und Dreisatz', 'Statistik (Mittelwert, Diagramm)'],
        topics: ['Sachrechnen und Geometrie mit Taschenrechner'],
      },
      'mathe-1': {
        title: 'Mathematik – Teil A (ohne Hilfsmittel)', minutes: 45, form: 'du', answer: 'grid', years: '2019–2026', aids: 'keine',
        rules: ['Zur Verfügung stehende Zeit: 45 Minuten. Hilfsmittel: keine.', 'Der Lösungsweg muss ersichtlich sein.'],
        structure: { tasks: 6, total: 55, points: '8–12 Punkte pro Aufgabe' },
        archetypes: ['Terme multiplizieren und vereinfachen', 'Gleichungen lösen', 'Verhältnisse (Zahl im Verhältnis 3:4 zerlegen), Prozent', 'Wahrscheinlichkeit mit Urne und Baumdiagramm', 'Sachaufgabe Flächen/Anteile (Ackerland, Getreidearten)', 'Flächengleichheit zweier Figuren (Sechseck, Trapez) → x berechnen'],
        topics: ['Terme, Gleichungen, Verhältnisse, Wahrscheinlichkeit, Flächen'],
      },
    },
  },

  // ======================= SCHWYZ =======================
  {
    id: 'sz-bms', canton: 'SZ', exam: 'bmsauf', name: 'Aufnahmeprüfung Berufsmaturität Schwyz', stage: 'Sek → BM 1 (kaufmännisch/gewerblich)',
    owner: 'Kaufmännische Berufsschule Schwyz', archive: { label: 'BM-Aufnahmeprüfungen mit Lösungen', url: 'https://www.kbs-schwyz.ch/berufsschule/m-profil/bm-aufnahmepruefungen/' },
    grading: 'Prüfungsfächer Deutsch, Englisch, Französisch, Mathematik (Algebra); Punkte → Note.', pass: 'Bestehensnorm gemäss kantonalem BM-Reglement.',
    subjects: {
      mathe: {
        title: 'Algebra', minutes: 100, form: 'Sie', answer: 'grid', years: '2019–2023', aids: 'Taschenrechner (nicht programmierbar, netzunabhängig).',
        rules: ['Zeit: 100 Minuten.', 'Ohne Lösungsweg gibt es keine Punkte.', 'Jede Aufgabe wird mit maximal 2 Punkten bewertet.'],
        structure: { tasks: 20, total: 40, points: 'jede Aufgabe max. 2 Punkte' },
        archetypes: ['Terme vereinfachen und ausmultiplizieren', 'Faktorisieren', 'Bruchterme', 'Potenzen und Wurzeln', 'Lineare Gleichungen und Bruchgleichungen', 'Gleichungssysteme', 'Textaufgaben mit Gleichung', 'Prozent- und Zinsrechnen', 'Lineare Funktionen'],
        topics: ['Algebra Sekundarstufe I'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 80, form: 'Sie', answer: 'lines', years: '2019–2022', aids: 'keine elektronischen Hilfsmittel',
        rules: ['Zeit: 80 Minuten.', 'Es sind keine Hilfsmittel erlaubt.'],
        structure: { tasks: 18, total: null, points: 'mehrere Prüfungsteile (Textverständnis, Sprachbetrachtung, Text verfassen)' },
        material: { kind: 'Sachtext mit Zeilennummern', words: '400–600' },
        archetypes: ['Fragen zum Textverständnis', 'Wortschatz (Synonyme, Bedeutungen)', 'Kommasetzung in Zeilen x–y', 'Wortarten/Grammatik zu unterstrichenen Wörtern', 'Kurzer eigener Text'],
        topics: ['Textverständnis, Grammatik, Zeichensetzung, Textproduktion'],
      },
      englisch: {
        title: 'Englisch', minutes: 50, form: 'Sie', answer: 'lines', years: '2019–2022', aids: 'keine',
        rules: ['Zeit: 50 Minuten. Hilfsmittel: keine.'], structure: { tasks: 4, total: null, points: 'mehrere Prüfungsteile mit Maximalpunktzahl' },
        archetypes: ['Reading comprehension', 'Grammar (tenses, questions, comparatives)', 'Vocabulary', 'Short writing'], topics: ['A2 Englisch'],
      },
      franz: {
        title: 'Französisch', minutes: 50, form: 'Sie', answer: 'lines', years: '2019–2022', aids: 'keine',
        rules: ['Zeit: 50 Minuten. Hilfsmittel: keine.'], structure: { tasks: 5, total: null, points: '1–2 Punkte pro Frage' },
        archetypes: ['Compréhension: Fragen zu einem Reisetext («Von wann bis wann hat die Reise gedauert? (2 pts)»)', 'Grammaire: Verben, Pronomen, Artikel', 'Vocabulaire', 'Production écrite'], topics: ['A2 Französisch'],
      },
    },
  },
  // ======================= SCHAFFHAUSEN =======================
  {
    id: 'sh-bms', canton: 'SH', exam: 'bmsauf', name: 'Aufnahmeprüfung Berufsmaturität Schaffhausen', stage: 'Sek → BM 1 / BM 2',
    owner: 'HKV Schaffhausen', archive: { label: 'Aufnahmeprüfungen BM mit Lösungen', url: 'https://www.hkv-sh.ch/grundbildung/aufnahmeprufung-bm/' },
    grading: 'Prüfungsfächer Deutsch, Englisch, Französisch, Mathematik; Punkte → Note.', pass: 'Bestehensnorm gemäss BM-Reglement Schaffhausen.',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 60, form: 'Sie', answer: 'grid', years: '2023–2025', aids: 'Sek-Taschenrechner',
        rules: ['Prüfungszeit gesamt: 60 Minuten.', 'Hilfsmittel: Sek-Taschenrechner.', 'Der Lösungsweg muss ersichtlich sein.'],
        structure: { tasks: 6, total: 52, points: '6–12 Punkte pro Aufgabe, Teilaufgaben 2–3 Punkte' },
        archetypes: ['Gleichungen mit Klammern lösen (z.B. 5x − (2 + 3x) = −6[2 − 3(x + 1)])', 'Wurzel- und Potenzterme vereinfachen', 'Bruchterme', 'Textaufgaben', 'Geometrie', 'Prozent'],
        topics: ['Algebra und Geometrie Sek I'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 100, form: 'Sie', answer: 'lines', years: '2023–2025', aids: 'keine',
        rules: ['Prüfungszeit: 100 Minuten.', 'Teile 1 und 2: 50 Minuten (danach individuell 10 Minuten Pause), Teil 3: 50 Minuten.', 'Keine Hilfsmittel.'],
        structure: { tasks: 3, total: 100, points: 'Teil 1 Textverständnis & Wortschatz 25 · Teil 2 Grammatik & Orthografie 25 · Teil 3 Aufsatz 50' },
        sections: ['Teil 1: Textverständnis und Wortschatz', 'Teil 2: Grammatik und Orthografie', 'Teil 3: Aufsatz'],
        material: { kind: 'Sachtext oder Erzählung mit Zeilennummern', words: '500–700' },
        archetypes: ['Fragen zum Text, Wortbedeutungen', 'Grammatik: Wortarten, Fälle, Zeitformen, Satzglieder', 'Orthografie: Gross-/Kleinschreibung, Kommas', 'Aufsatz zu einem von mehreren Themen'],
        topics: ['Textverständnis, Grammatik, Orthografie, Aufsatz'],
      },
      englisch: {
        title: 'Englisch', minutes: 70, form: 'Sie', answer: 'lines', years: '2023–2025', aids: 'keine',
        rules: ['Prüfungszeit gesamt: 70 Minuten.', 'Für die Teile 1, 2 und 3 sind keine Hilfsmittel zugelassen.'],
        structure: { tasks: 3, total: 100, points: 'Reading 20 · Grammar 60 · Writing 20' }, sections: ['Teil 1 Reading', 'Teil 2 Grammar', 'Teil 3 Writing'],
        archetypes: ['Reading: Fragen/True-False zu einem Text', 'Grammar (60 P.): Tenses, irregular verbs, questions, comparatives, prepositions, word order', 'Writing: kurzer Text nach Vorgaben'], topics: ['A2–B1 Englisch, Schwerpunkt Grammatik'],
      },
      franz: {
        title: 'Französisch', minutes: 70, form: 'Sie', answer: 'lines', years: '2023–2025', aids: 'keine',
        rules: ['Keine Hilfsmittel.'], structure: { tasks: 3, total: 100, points: 'Compréhension ca. 25–29 · Grammaire ca. 43–46 · Production de texte ca. 28–30' },
        sections: ['Teil 1 Compréhension de texte', 'Teil 2 Grammaire', 'Teil 3 Production de texte'],
        archetypes: ['Compréhension: Fragen und vrai/faux zum Text', 'Grammaire: Konjugation, Pronomen, Adjektive, Verneinung, Fragen', 'Production de texte: Text nach Vorgaben'], topics: ['A2 Französisch'],
      },
    },
  },
  // ======================= GLARUS =======================
  {
    id: 'gl-bms', canton: 'GL', exam: 'bmsauf', name: 'Aufnahmeprüfung Berufsmaturität Glarus', stage: 'Sek → BM 1',
    owner: 'Gewerblich-industrielle Berufsfachschule Glarus', archive: { label: 'Musterprüfungen BM zum Üben', url: 'https://www.gibgl.ch/berufsmaturitaet/musterpruefungen-bm-zum-ueben.html/6816' },
    grading: 'Punkte → Note; Mathe 40 Punkte, Deutsch 100 Punkte.', pass: 'Bestehensnorm gemäss BM-Reglement.',
    subjects: {
      mathe: {
        title: 'Mathematik (Sekundarstufe I)', minutes: 90, form: 'Sie', answer: 'grid', years: '2016–2018',
        aids: 'Zeichenutensilien, Taschenrechner (keine leistungsfähigeren als übliche Schulrechner), keine Formelsammlung.',
        rules: ['Dauer: 90 Minuten.', 'Die Prüfung umfasst 14 Aufgaben mit total 40 Punkten.', 'Der Lösungsweg muss ersichtlich sein.'],
        structure: { tasks: 14, total: 40, points: '2–4 Punkte pro Aufgabe' },
        archetypes: ['Terme und Gleichungen', 'Bruchrechnen', 'Prozent und Zins', 'Proportionalität', 'Geometrie: Flächen, Pythagoras, Körper', 'Funktionen', 'Textaufgaben'], topics: ['Mathematik Sekundarstufe I'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 90, form: 'Sie', answer: 'lines', years: '2016–2018', aids: 'Wörterbuch nur zum Verfassen des Aufsatzes',
        rules: ['Dauer: 90 Minuten (Sprachprüfung 30 Minuten).', 'Maximal erreichbare Punktzahl: 100 Punkte (Sprachprüfung 50, Aufsatz 50).'],
        structure: { tasks: 2, total: 100, points: 'Sprachprüfung 50 · Aufsatz 50' }, sections: ['Sprachprüfung (30 Minuten)', 'Aufsatz (60 Minuten)'],
        archetypes: ['Sprachprüfung: Grammatik, Rechtschreibung, Zeichensetzung, Wortschatz', 'Aufsatz: ein Thema aus mehreren wählen'], topics: ['Sprachbetrachtung, Aufsatz'],
      },
    },
  },

  // ======================= BASEL-LANDSCHAFT =======================
  {
    id: 'bl-matura', canton: 'BL', exam: 'matura', name: 'Schriftliche Maturprüfung Gymnasium Oberwil (BL)', stage: 'Gymnasium – 4. Klasse',
    owner: 'Gymnasium Oberwil (Bildungs-, Kultur- und Sportdirektion BL)', archive: { label: 'Maturprüfungen der letzten Jahre', url: 'https://www.gymoberwil.ch/maturitaetsabteilung/maturitaetspruefungen/aktuelle-pruefungen' },
    grading: 'Schulinterne schriftliche Maturprüfungen; Punkte → Note (für die 6 ist nicht die volle Punktzahl nötig).', pass: 'Maturität gemäss MAR/MAV.',
    subjects: {
      mathe: {
        title: 'Mathematik – Grundlagenfach', minutes: 240, form: 'Sie', answer: 'grid', years: '2018–2025',
        aids: 'Formelsammlung «Mathematik kompakt» (Wetzel), Taschenrechner TI-30X Pro MultiView/MathPrint.',
        rules: ['Zeit: 4 Stunden.', 'Verwenden Sie für jede Aufgabe ein neues Blatt.', 'Die erreichbare Punktzahl ist bei jeder Aufgabe angegeben.', 'Für die Note 6 ist nicht die volle Punktzahl erforderlich.'],
        structure: { tasks: 5, total: 68, points: '9–17 Punkte pro Aufgabe, Teilpunkte als Summe angegeben (z.B. 2 + 2 + 3 + 4 + 3 + 3 = 17 Punkte)' },
        archetypes: ['Analysis (17 P.): zwei Funktionen (Wurzel/Gerade) – Nullstellen, Schnittwinkel mit Achse, Schnittpunkte, parallele Tangente, Fläche zwischen Graphen, Rotationsvolumen mit Parameter', 'Vektorgeometrie (16 P.): Körper/Pyramide im Raum, Schatten eines Punktes auf Ebene, Winkel, Abstände', 'Analysis (12 P.): Funktionsuntersuchung/Anwendung', 'Stochastik (14 P.): Kartenspiel, Wahrscheinlichkeiten, Erwartungswert (Aufgabe in 4.1/4.2 aufgeteilt)', 'Analysis (9 P.): Extremalproblem oder Exponentialfunktion'],
        topics: ['Analysis, Vektorgeometrie, Stochastik (Grundlagenfach)'],
      },
      deutsch: {
        title: 'Deutsch – Maturaufsatz', minutes: 240, form: 'Sie', answer: 'lines', years: '2018–2025', aids: 'DUDEN Band 1: Die deutsche Rechtschreibung',
        rules: ['Dauer: 4 Stunden.', 'Bearbeiten Sie eines der folgenden Aufsatzthemen.', 'Bewertung: Inhalt 50 %, Sprache 50 %.'],
        structure: { tasks: 4, total: null, points: 'Note: Inhalt 50 %, Sprache 50 %', note: 'Themenauswahl (ca. 4 Themen)' },
        archetypes: ['Erörterung zu einem abgedruckten Essay/Kolumne (z.B. zum Thema Freiheit) – Textbezug und eigene Position', 'Literarische Interpretation (Gedicht oder Kurzprosa)', 'Freie Erörterung zu einem Zitat', 'Essay zu einem Gesellschaftsthema'],
        topics: ['Erörterung, Interpretation, Essay auf Maturniveau'],
      },
      englisch: {
        title: 'Englisch', minutes: 240, form: 'Sie', answer: 'lines', years: '2018–2025', aids: 'Deutsch-Englisch/Englisch-Deutsch Wörterbuch nur für den Essay',
        rules: ['Die Prüfung besteht aus drei Teilen: Listening Comprehension, Reading Comprehension, Essay.', 'Listening: Time allotted 40 minutes, Antworten auf dem Prüfungsblatt.', 'Das Wörterbuch darf nur für den Essay verwendet werden.'],
        structure: { tasks: 3, total: null, points: 'I Listening · II Reading · III Essay' }, sections: ['I. Listening Comprehension', 'II. Reading Comprehension', 'III. Essay'],
        material: { kind: 'Hörtext als Transkript zum Vorlesen + anspruchsvoller Lesetext (Zeitungsartikel/Literatur)', words: '700–1100' },
        archetypes: ['Listening: comprehension questions (Part A) u.a.', 'Reading: Fragen zum Text, Vokabular im Kontext', 'Essay: Wahl aus mehreren Themen (argumentativ oder literarisch)'], topics: ['B2–C1 Englisch'],
      },
      franz: {
        title: 'Französisch', minutes: 240, form: 'Sie', answer: 'lines', years: '2018–2025', aids: 'Für die Rédaction: deutsch-französisches Wörterbuch in höchstens zwei Bänden ohne Notizen (keine elektronischen Wörterbücher)',
        rules: ['Für Contraction und Compréhension de l’écrit sind keine Hilfsmittel erlaubt; diese Teile werden vor der Rédaction abgegeben.', 'Bewertung: Contraction ¼, Compréhension de l’écrit ¼, Rédaction ½ der Note.'],
        structure: { tasks: 3, total: null, points: 'Contraction ¼ · Compréhension ¼ · Rédaction ½' }, sections: ['Contraction', 'Compréhension de l’écrit', 'Rédaction'],
        material: { kind: 'französischer Artikel/Essay', words: '700–1000' },
        archetypes: ['Contraction: Text auf ca. ein Viertel zusammenfassen', 'Compréhension de l’écrit: Fragen zum Text', 'Rédaction: argumentativer oder literarischer Aufsatz zu einem von mehreren Themen'], topics: ['B2 Französisch'],
      },
    },
  },

  // ======================= BASEL-STADT =======================
  {
    id: 'bs-sek2', canton: 'BS', exam: 'gym', name: 'Freiwillige Aufnahmeprüfung Sekundarstufe II Basel-Stadt', stage: 'Sek → Gymnasium, FMS, WMS/IMS, BMS',
    owner: 'Erziehungsdepartement Basel-Stadt', archive: { label: 'Beispielprüfungen Deutsch & Mathematik mit Lösungen', url: 'https://www.bs.ch/themen/bildung-und-kinderbetreuung/schule/weiterfuehrende-schulen/freiwillige-aufnahmepruefung' }, alsoFor: ['bmsauf', 'fms'],
    grading: 'Gemeinsame freiwillige Prüfung für alle Schulen der Sekundarstufe II; Punkte → Note je Fach.', pass: 'Aufnahme gemäss Laufbahnverordnung Basel-Stadt.',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 90, form: 'du', answer: 'grid', years: '2020–2022',
        aids: 'Schreibutensilien, Geodreieck/Winkelmesser, Lineal, Zirkel und Taschenrechner. Keine Formelsammlungen.',
        rules: ['Löse die Aufgaben direkt auf den Aufgabenblättern.', 'Die Punktzahl jeder Aufgabe steht am rechten Rand.', 'Der Lösungsweg muss klar ersichtlich, nachvollziehbar und vollständig sein; Endresultate doppelt unterstreichen.', 'Runde Endresultate auf zwei Stellen nach dem Komma, falls nichts anderes verlangt ist. Skizzen sind nicht massstäblich.'],
        structure: { tasks: 6, total: 69, points: 'Teil A Bruchrechnen 7 · B Algebra/Anwendungen ca. 32 · C ca. 11 · D ca. 5 · E Geometrie ca. 12 · F ca. 2–5 (Teilpunkte 1–3 P.)' },
        sections: ['A. Bruchrechnen', 'B. Algebra/Anwendungen', 'C. Funktionen/Proportionalität', 'D. Daten/Wahrscheinlichkeit', 'E. Geometrie', 'F. Knobelaufgabe'],
        archetypes: ['A: Brüche addieren/multiplizieren, Doppelbrüche, Dezimalbrüche (auch periodisch) als gekürzte Brüche', 'B: Terme vereinfachen, binomische Formeln (ausmultiplizieren, faktorisieren), Bruchterme kürzen, Gleichungen, Textaufgaben', 'C: lineare Funktionen, Proportionalität, Diagramme', 'D: Statistik/Wahrscheinlichkeit', 'E: Flächen, Pythagoras, Körper (Skizzen nicht massstäblich)', 'F: kurze Knobel-/Transferaufgabe'],
        topics: ['Stoff Sekundarschule Basel-Stadt (Lehrplan 21): Bruchrechnen, Algebra, Funktionen, Geometrie, Daten'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 90, form: 'du', answer: 'lines', years: '2020–2022', aids: 'keine',
        rules: ['Es stehen dir 90 Minuten Zeit zur Verfügung (Teil 1 Lesen 45 Minuten, Teil 2 Schreiben 45 Minuten).', 'Bei Auswahlaufgaben kreuzt du die richtige Antwort an; sonst schreibst du ein Wort, einen Satz oder einen Text auf die Linien.', 'Die Punktzahl jeder Aufgabe steht am rechten Rand.'],
        structure: { tasks: 4, total: 50, points: 'Teil 1: zwei Leseaufgaben à 12–16 P. · Teil 2: zwei Schreibaufgaben à 12 P.' },
        sections: ['Teil 1: Lesen (45 Minuten)', 'Teil 2: Schreiben (45 Minuten)'],
        material: { kind: 'Leseaufgabe 1: literarischer Text (z.B. Kurzgeschichte/Anekdote) · Leseaufgabe 2: Sachtext (z.B. Technik, Psychologie)', words: '500–800 je Text' },
        archetypes: ['Lesen: Multiple-Choice-Fragen zu Inhalt und Absicht, Wortbedeutungen (Worterklärungen mit *), Aussagen richtig/falsch, Kurzantworten', 'Schreiben 1: Gebrauchstext (Artikel für die Schülerzeitung, Bewerbung um ein Casting) mit inhaltlichen Vorgaben', 'Schreiben 2: kreativer Text (Geschichte erfinden, Tagebucheintrag einer berühmten Person, Fantasiewort-Geschichte)'],
        topics: ['Leseverstehen literarisch und Sachtext, Gebrauchs- und kreatives Schreiben'],
      },
    },
  },

  // ======================= WAADT (Prüfungen auf Französisch) =======================
  {
    id: 'vd-gym', canton: 'VD', exam: 'gym', lang: 'fr', name: 'Examens d’admission aux gymnases vaudois – École de maturité', stage: 'Fin de scolarité obligatoire → 1re année École de maturité',
    owner: 'État de Vaud – DGEP', archive: { label: 'Exemples d’examens d’admission 2023–2026 (corrigés)', url: 'https://www.vd.ch/formation/formations-gymnasiales/examens-dadmission-au-gymnase/exemples-dexamens-dadmission-au-gymnase' }, alsoFor: ['fms'],
    grading: 'Chaque branche notée sur 6; pondération des parties indiquée sur la page de garde.', pass: 'Selon le règlement d’admission des gymnases vaudois.',
    subjects: {
      franz: {
        title: 'Français (écrit)', minutes: 180, form: 'Sie', lang: 'fr', answer: 'lines', years: '2023–2026', aids: 'Dictionnaire Petit Robert I ou Petit Larousse (électronique si autorisé)',
        rules: ['Durée : 3 heures.', 'Le candidat rédige les réponses à l’encre de façon soignée.', 'Les feuilles de brouillon sont remises avec l’épreuve.', 'Pondération : partie compréhension 50 % et partie expression 50 % de la note finale.'],
        structure: { tasks: 2, total: 60, points: 'Compréhension 30 pts · Expression 30 pts' }, sections: ['Partie compréhension', 'Partie expression'],
        material: { kind: 'extrait littéraire (roman/récit autobiographique) avec lignes numérotées', words: '700–1000' },
        archetypes: ['Compréhension: questions sur le sens, les personnages, les procédés (lignes indiquées)', 'Vocabulaire en contexte, reformulation', 'Analyse de figures de style et du registre', 'Expression: rédaction argumentative ou narrative (env. 300–400 mots) en lien avec le thème du texte'],
        topics: ['Compréhension de texte littéraire, vocabulaire, grammaire, rédaction'],
      },
      mathe: {
        title: 'Mathématiques (écrit)', minutes: 180, form: 'Sie', lang: 'fr', answer: 'grid', years: '2023–2026', aids: 'Calculatrice TI-30 ECO RS, TI-30X IIS ou TI-30X IIB, règle, équerre, rapporteur, compas, formulaire joint',
        rules: ['Durée : 3 heures.', 'Le candidat rédige les solutions directement sous chaque question (pas de couleur rouge).', 'Les calculs et les raisonnements doivent être détaillés ; la réponse doit être soulignée ou encadrée.', 'Pondération : partie technique 30 % et partie analyse-réflexion 70 %.'],
        structure: { tasks: 12, total: null, points: 'Questions de 2–6 pts', note: 'Partie technique (30 %) puis partie analyse-réflexion (70 %)' }, sections: ['Partie technique', 'Partie analyse-réflexion'],
        archetypes: ['Technique: calculs de fractions (réponse en fraction irréductible), puissances, racines', 'Technique: calcul littéral (développer, factoriser), équations', 'Analyse-réflexion: problèmes de proportionnalité et pourcentages', 'Géométrie: Pythagore, Thalès, aires et volumes', 'Fonctions affines, lecture de graphiques', 'Problèmes ouverts avec raisonnement à justifier'],
        topics: ['Programme du secondaire I vaudois (voie prégymnasiale)'],
      },
      englisch: {
        title: 'Anglais (écrit)', minutes: 180, form: 'Sie', lang: 'fr', answer: 'lines', years: '2023–2026', aids: 'néant',
        rules: ['Durée : 3 heures. Matériel autorisé : néant.', 'Pondération : partie technique 20 %, compréhension 40 %, expression 40 %.'],
        structure: { tasks: 3, total: 98, points: 'Technique 40 · Compréhension 33 · Expression 25' }, sections: ['1. Partie technique', '2. Partie compréhension', '3. Partie expression'],
        material: { kind: 'articles en anglais (presse, adaptés)', words: '400–700' },
        archetypes: ['Verb tenses and verb forms: Lückentext (Artikel) mit Auswahl', 'Vocabulary/grammar exercises', 'Reading comprehension: questions, true/false with justification', 'Writing: Text nach Vorgaben (Brief, Artikel, Meinung)'],
        topics: ['Anglais niveau A2–B1'],
      },
      'deutsch-fs': {
        title: 'Allemand (écrit)', minutes: 180, form: 'Sie', lang: 'de', answer: 'lines', years: '2023–2026', aids: 'néant',
        rules: ['Durée : 3 heures. Matériel autorisé : néant.', 'Les mots soulignés sans note de bas de page ont déjà été traduits.', 'Pondération : compréhension 40 % et expression 60 %.'],
        structure: { tasks: 4, total: 60, points: 'Leseverstehen 24 · Ausdruck 36' }, sections: ['Leseverstehen', 'Schriftlicher Ausdruck'],
        material: { kind: 'deutscher Sachtext (z.B. Biografie) mit Zeilennummern und Worterklärungen', words: '400–600' },
        archetypes: ['Leseverstehen Teil 1: Fragen zum Text, richtig/falsch', 'Leseverstehen Teil 2: Zuordnung, Wortschatz', 'Grammatik im Kontext', 'Schriftlicher Ausdruck: Text auf Deutsch nach Vorgaben'],
        topics: ['Deutsch als Fremdsprache A2–B1'],
      },
    },
  },

  // ======================= TESSIN (Prüfungen auf Italienisch) =======================
  {
    id: 'ti-mp', canton: 'TI', exam: 'bmp', lang: 'it', name: 'Esami di maturità professionale – Cantone Ticino', stage: 'MP1/MP2 – esame finale',
    owner: 'DECS – Divisione della formazione professionale', archive: { label: 'Esami liberati (anni precedenti)', url: 'https://www4.ti.ch/decs/dfp/mp/esami-liberati/esami-liberati' },
    grading: 'Punteggio → nota per disciplina secondo il regolamento cantonale della maturità professionale.', pass: 'Attestato di maturità professionale secondo OMPr (media ≥ 4).',
    subjects: {
      ital: {
        title: 'Lingua italiana', minutes: 150, form: 'Sie', lang: 'it', answer: 'lines', years: '2021–2023', aids: 'Vocabolario della lingua italiana e dizionario dei sinonimi e dei contrari',
        rules: ['Durata dell’esame: 150 minuti.', 'Controlli di aver ricevuto tutto il materiale (testi, pagine degli esercizi, griglia di valutazione).', 'È consentito l’uso del vocabolario della lingua italiana e del dizionario dei sinonimi e dei contrari.', 'I compiti vanno scritti a penna; tutto il materiale va riconsegnato.'],
        structure: { tasks: 3, total: null, points: 'Griglia di valutazione (contenuto, struttura, lingua)' },
        material: { kind: 'testi (articolo di giornale / testo letterario) da analizzare', words: '600–900' },
        archetypes: ['Comprensione e analisi di un testo (domande, sintesi)', 'Riflessione sulla lingua', 'Produzione: testo argomentativo o saggio breve su una traccia a scelta'],
        topics: ['Lingua italiana MP: comprensione, analisi, produzione scritta'],
      },
      englisch: {
        title: 'Inglese (B1/B2)', minutes: 120, form: 'Sie', lang: 'it', answer: 'lines', years: '2021–2023', aids: 'Dizionario bilingue solo in forma cartacea',
        rules: ['Durata dell’esame: 120 minuti.', 'Riportare le risposte di ascolto e lettura sull’Answer Sheet: fanno stato esclusivamente le risposte riportate lì.', 'È autorizzato l’uso del dizionario bilingue solamente in forma cartacea.'],
        structure: { tasks: 3, total: null, points: 'Listening · Reading · Writing' }, sections: ['Listening', 'Reading', 'Writing'],
        material: { kind: 'Hörtext als Transkript zum Vorlesen + englischer Lesetext', words: '400–700' },
        archetypes: ['Listening: multiple choice on answer sheet', 'Reading: multiple choice / true-false / gap fill', 'Writing: email or essay with given points'], topics: ['Inglese B1–B2'],
      },
      'deutsch-fs': {
        title: 'Tedesco (B1/B2)', minutes: 120, form: 'Sie', lang: 'de', answer: 'lines', years: '2021–2023', aids: 'Dizionario cartaceo bilingue Italiano-Tedesco o monolingue Tedesco',
        rules: ['Struttura: Seh-Hörverstehen 20 min · Leseverstehen 50 min · Schriftlicher Ausdruck 50 min (totale 120 min).', 'Mit nicht löschbarem Stift schreiben, Gross- und Kleinschreibung beachten.'],
        structure: { tasks: 3, total: 60, points: 'Seh-Hörverstehen 20 · Leseverstehen · Schriftlicher Ausdruck' }, sections: ['1. Seh-Hörverstehen (20 min)', '2. Leseverstehen (50 min)', '3. Schriftlicher Ausdruck (50 min)'],
        material: { kind: 'Video-/Hörtext als Transkript + zwei deutsche Zeitungstexte (z.B. Vapes, Recycling von Legosteinen)', words: '500–800' },
        archetypes: ['Seh-Hörverstehen: Fragen zu einem kurzen Reportage-Video', 'Leseverstehen: Fragen, richtig/falsch, Zuordnung zu zwei Texten', 'Schriftlicher Ausdruck: Stellungnahme/E-Mail auf Deutsch'], topics: ['Deutsch als Fremdsprache B1–B2'],
      },
      mathe: {
        title: 'Matematica fondamentale', minutes: 120, form: 'Sie', lang: 'it', answer: 'grid', years: '2021–2023', aids: 'Calcolatrice non programmabile, formulario secondo le direttive della scuola',
        rules: ['Svolgere gli esercizi in modo ordinato indicando tutti i passaggi.', 'Il punteggio di ogni esercizio è indicato.'],
        structure: { tasks: 6, total: 48, points: 'Esercizi da 6–10 punti con sottopunti da 2 punti' },
        archetypes: ['Esercizio 1 (8 punti): potenze, frazioni algebriche, radicali, problema con sistema (monete da 2 e 5 CHF)', 'Equazioni e disequazioni', 'Funzioni lineari e quadratiche', 'Geometria e trigonometria', 'Percentuali e problemi applicati', 'Statistica/probabilità'],
        topics: ['Matematica fondamentale MP (PQ MP)'],
      },
    },
  },

  // ======================= NEUENBURG (Prüfungen auf Französisch) =======================
  {
    id: 'ne-adm', canton: 'NE', exam: 'gym', lang: 'fr', name: 'Examens d’admission aux filières de maturités – Neuchâtel', stage: 'Fin de 11e année (ou école privée) → lycée / filières de maturité',
    owner: 'État de Neuchâtel – OFPA', archive: { label: 'Examens-types par discipline (sessions 2024–2026)', url: 'https://www.ne.ch/conditions-postobligatoire' }, alsoFor: ['fms'],
    grading: 'Points par branche (p. ex. mathématiques /74, italien /60) → note.', pass: 'Selon les conditions d’admission du postobligatoire neuchâtelois.',
    subjects: {
      franz: {
        title: 'Français', minutes: 90, form: 'Sie', lang: 'fr', answer: 'lines', years: '2024–2026', aids: 'aucun',
        rules: ['Durée : 90 minutes.', 'Partie 1 : lisez attentivement l’extrait textuel proposé, puis répondez aux questions.', 'Partie 2 : rédigez un texte argumentatif en respectant les points énumérés.'],
        structure: { tasks: 2, total: null, points: 'Compréhension de l’écrit + texte argumentatif' }, sections: ['Partie 1 : Compréhension de l’écrit', 'Partie 2 : Texte argumentatif'],
        material: { kind: 'extrait littéraire (conte, récit) avec lignes numérotées', words: '900–1400' },
        archetypes: ['Questions de compréhension avec renvoi aux lignes', 'Vocabulaire et procédés d’écriture', 'Texte argumentatif avec consignes (thèse, arguments, exemples, conclusion)'], topics: ['Français 11e année'],
      },
      mathe: {
        title: 'Mathématiques', minutes: 60, form: 'du', lang: 'fr', answer: 'grid', years: '2024–2026', aids: 'Règle et calculatrice',
        rules: ['Durée : 60 minutes.', 'Tous les calculs sont présentés avec soin, au crayon ou au stylo.', 'Tous les résultats doivent être justifiés, soit par calculs, soit par un commentaire, sans oublier les unités.', 'Les seuls outils autorisés sont une règle et une calculatrice.'],
        structure: { tasks: 10, total: 74, points: 'Exercices de 4–10 points' },
        archetypes: ['Exercice 1 : calculer et donner le résultat sous forme de puissance', 'Compléter les étapes intermédiaires d’un calcul déjà effectué', 'Calcul littéral et équations', 'Proportionnalité et pourcentages', 'Géométrie : aires, Pythagore, volumes', 'Fonctions et graphiques', 'Problèmes de la vie courante'], topics: ['Mathématiques 11e année (PER)'],
      },
      englisch: {
        title: 'Anglais', minutes: 45, form: 'Sie', lang: 'fr', answer: 'lines', years: '2024–2026', aids: 'Dictionnaire papier bilingue fourni',
        rules: ['Durée : 45 minutes.', 'Dictionnaire papier bilingue fourni dans le cadre de l’examen.'],
        structure: { tasks: 3, total: 60, points: 'Compréhension, grammaire/vocabulaire, expression' },
        material: { kind: 'texte anglais (record, compétition, fait divers)', words: '300–450' },
        archetypes: ['Reading comprehension questions', 'Grammar & vocabulary', 'Short writing'], topics: ['Anglais A2–B1'],
      },
      'deutsch-fs': {
        title: 'Allemand', minutes: 45, form: 'Sie', lang: 'de', answer: 'lines', years: '2024–2026', aids: 'Dictionnaire papier bilingue fourni',
        rules: ['Durée : 45 minutes.', 'Dictionnaire papier bilingue fourni dans le cadre de l’examen.'],
        structure: { tasks: 3, total: 60, points: 'Leseverstehen, Grammatik/Wortschatz, Schreiben' },
        archetypes: ['Leseverstehen', 'Grammatik und Wortschatz', 'Kurzer Text'], topics: ['Deutsch als Fremdsprache A2'],
      },
    },
  },

  // ======================= FREIBURG (französischsprachige Schulen) =======================
  {
    id: 'fr-adm', canton: 'FR', exam: 'gym', lang: 'fr', name: 'Examen d’admission Fribourg – Gymnases, ECG, Écoles de commerce', stage: 'Fin du CO → GYM / ECG / EC (Fribourg et Bulle)',
    owner: 'État de Fribourg – DFAC', archive: { label: 'Exemples d’épreuves 2023–2025 (avec audios)', url: 'https://www.fr.ch/formation-et-ecoles/ecoles-secondaires-superieures/exemples-depreuves-pour-les-examens-dadmission' }, alsoFor: ['fms'],
    grading: 'Épreuves identiques pour toutes les filières depuis 2020-21; 50 points par branche.', pass: 'Selon le règlement d’admission (les corrigés ne sont pas publiés).',
    subjects: {
      franz: {
        title: 'Français (langue maternelle)', minutes: 75, form: 'Sie', lang: 'fr', answer: 'lines', years: '2023–2025', aids: 'aucun',
        rules: ['Durée de l’épreuve : 75 minutes.', 'Barème : 50 points au total.'],
        structure: { tasks: 4, total: 50, points: 'I Compréhension 15 · II Vocabulaire 10 · III Grammaire 15 · IV Orthographe 10' },
        sections: ['Partie I – Questions de compréhension', 'Partie II – Questions de vocabulaire', 'Partie III – Questions de grammaire', 'Partie IV – Questions d’orthographe'],
        material: { kind: 'texte narratif avec lignes numérotées', words: '600–900' },
        archetypes: ['Compréhension: position du narrateur, personnages, intentions, citations de lignes', 'Vocabulaire: synonymes, antonymes, sens en contexte, familles de mots', 'Grammaire: classes et fonctions des mots, temps et modes, propositions', 'Orthographe: accords, homophones, dictée de phrases à corriger'],
        topics: ['Français CO (PER)'],
      },
      mathe: {
        title: 'Mathématiques', minutes: 60, form: 'Sie', lang: 'fr', answer: 'grid', years: '2023–2025', aids: 'Partie I sans calculatrice: règle graduée, compas, rapporteur · Partie II: avec calculatrice',
        rules: ['Durée : première partie (sans calculatrice) 40 minutes, seconde partie 20 minutes – total 60 minutes.', 'Matériel autorisé : règle graduée, compas et rapporteur.', 'Barème : 50 points au total.'],
        structure: { tasks: 10, total: 50, points: 'Exercices de 3–9 points' }, sections: ['Première partie, sans calculatrice (40 min)', 'Seconde partie, avec calculatrice (20 min)'],
        archetypes: ['Exercice 1 (9 pts): effectuer des calculs, réponse en nombre entier ou fraction irréductible', 'Calcul littéral, équations', 'Puissances et racines', 'Proportionnalité, pourcentages', 'Géométrie: constructions, angles, aires, Pythagore', 'Problèmes concrets (avec calculatrice)'],
        topics: ['Mathématiques CO (PER)'],
      },
      'deutsch-fs': {
        title: 'Allemand (deuxième langue nationale)', minutes: 60, form: 'Sie', lang: 'de', answer: 'lines', years: '2023–2025', aids: 'aucun',
        rules: ['Dauer der Prüfung: 60 Minuten. Keine Hilfsmittel.', 'Bewertung: Hören, Lesen, Wortschatz, Schreiben – 50 Punkte total.', 'Der Hörtext wird abgespielt (Transkript zum Vorlesen).'],
        structure: { tasks: 4, total: 50, points: 'Hören · Lesen · Wortschatz · Schreiben' }, sections: ['Hören', 'Lesen', 'Wortschatz', 'Schreiben'],
        material: { kind: 'Hörtext als Transkript zum Vorlesen + deutscher Lesetext', words: '300–500' },
        archetypes: ['Hören: Multiple Choice/richtig-falsch', 'Lesen: Fragen zum Text', 'Wortschatz: Lücken, Zuordnung', 'Schreiben: kurze Nachricht/E-Mail'], topics: ['Deutsch als Fremdsprache A2'],
      },
    },
  },
  // ======================= SCHAFFHAUSEN (Gymnasium) =======================
  {
    id: 'sh-gym', canton: 'SH', exam: 'gym', name: 'Aufnahmeprüfung Kantonsschule Schaffhausen', stage: '2./3. Sekundarschule → Gymnasium',
    owner: 'Kantonsschule Schaffhausen', archive: { label: 'Alte Aufnahmeprüfungen', owner: 'Kantonsschule Schaffhausen', url: 'https://kanti.sh.ch/aufnahmepruefung/' },
    grading: 'Bewertung nach Punkten gemäss Punkteübersicht auf dem Deckblatt.', pass: '',
    subjects: {
      mathe: {
        title: 'Mathematik', minutes: 120, form: 'du', answer: 'grid', years: '2015–2025',
        aids: 'gemäss Deckblatt der Prüfung',
        rules: ['Du hast 2 Stunden Zeit.', 'Der Lösungsweg muss nachvollziehbar sein, ansonsten werden keine Teilpunkte vergeben.', 'Löse die Aufgaben direkt auf dem Aufgabenblatt.'],
        structure: { tasks: 12, total: 48, points: 'jede Aufgabe 4 Punkte', note: 'Punkteübersicht mit 12 Aufgaben à 4 Punkte auf dem Deckblatt; Teilaufgaben (a), (b) möglich' },
        archetypes: ['Klammern auflösen und Terme so weit wie möglich zusammenfassen', 'Gleichungen nach der Unbekannten auflösen, Ergebnis als ganze Zahl oder gekürzter Bruch', 'Sachaufgabe mit linearem Zusammenhang (z. B. Höhe eines Becherstapels)', 'Kombinatorik und Logik (Formen/Farben, Zahlenschloss, Ziffern-Segmente)', 'Geometrie: Kreisbogen, gleichschenklige Dreiecke, Winkel und Flächen in einer Figur', 'Raumvorstellung: Prisma mit Wasserstand, Würfelkörper zu einem 3×3×3-Würfel zusammensetzen', 'Textaufgabe durch Aufstellen einer Gleichung lösen', 'Teilbarkeit und Primfaktorzerlegung', 'Massstab und Distanzen auf einer Karte'],
        topics: ['Zahl und Variable: Terme, Gleichungen, Bruch- und Dezimalrechnen, Teilbarkeit, Primfaktoren', 'Form und Raum: Winkel, Dreiecke, Kreis, Flächen, Volumen, Raumvorstellung', 'Grössen, Funktionen, Daten und Zufall: Proportionalität, Kombinatorik, Sachrechnen'],
      },
      deutsch: {
        title: 'Deutsch', minutes: 60, form: 'du', answer: 'lines', years: '2015–2025', aids: 'keine',
        rules: ['Lies den Text sorgfältig durch.', 'Beantworte die Fragen in ganzen Sätzen, wo verlangt.', 'Die Punktzahl steht bei jeder Aufgabe.'],
        structure: { tasks: 12, total: 52, points: '1–5 Punkte pro Aufgabe (auch halbe Punkte)', note: 'ca. 51–53 Punkte, 45–60 Minuten je nach Stufe' },
        material: { kind: 'Kurzgeschichte oder Romanauszug (zeitgenössisch, Alltagskonflikt) mit Zeilennummern', words: '700–1000' },
        sections: ['Textverständnis', 'Sprachbetrachtung'],
        archetypes: ['Ereignisse der Handlung der richtigen Uhrzeit/Reihenfolge zuordnen', 'Aussagen zum Text als richtig oder falsch ankreuzen', 'Nummerierte Sätze zum Handlungsverlauf in die richtige Reihenfolge bringen', 'Verhalten und Motive einer Figur mit Textstellen begründen', 'Wortbedeutung im Kontext erklären', 'Grammatik und Rechtschreibung an Sätzen aus dem Text'],
        topics: ['Textverständnis literarischer Texte', 'Wortschatz und Wortbedeutung', 'Grammatik: Wortarten, Satzglieder, Zeitformen', 'Rechtschreibung und Zeichensetzung'],
      },
    },
  },
];

// ---------------- Abfragen ----------------
export const examById = id => EXAMS.find(e => e.id === id);
export const cantonsWithData = () => [...new Set(EXAMS.map(e => e.canton))].sort((a, b) => CANTONS[a].localeCompare(CANTONS[b]));
export const examsIn = canton => EXAMS.filter(e => e.canton === canton);
export const SUBJECT_LABELS = { 'deutsch-fs': 'Deutsch (Fremdsprache)', mathe: 'Mathematik', 'mathe-1': 'Mathematik I (ohne TR)', 'mathe-2': 'Mathematik II (mit TR)', 'deutsch-sprach': 'Deutsch – Sprachprüfung', 'deutsch-aufsatz': 'Deutsch – Aufsatz', deutsch: 'Deutsch', franz: 'Französisch', englisch: 'Englisch', wr: 'Wirtschaft & Recht', rw: 'Finanz- & Rechnungswesen', abu: 'ABU', 'deutsch-fs': 'Deutsch (Fremdsprache)', 'deutsch-analyse': 'Deutsch – Textanalyse', 'deutsch-produktion': 'Deutsch – Textproduktion', ital: 'Italienisch' };
