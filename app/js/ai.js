// Brainy – KI-Workflows. Nutzt die Claude API (Messages API). Ohne API-Key läuft ein
// Demo-Modus mit lokalen Heuristiken, damit jede Funktion trotzdem erlebbar ist.
// ⚠️ Prototyp: Der Key liegt lokal im Browser. Für Produktion → Backend-Proxy (Supabase Edge Function).
import { S, subj, dayKey, addDays, startOfDay } from './store.js';
import { lang, aiLanguage } from './i18n.js';
import { DEMO_QUESTIONS } from './data.js';
import { normalizeExam, demoExam, examPrompt, examPromptProfile, examIssues, examRepairPrompt, parseJSONLoose } from './examdoc.js';
import { examById } from './examdb.js';
import { examByKey } from './examcatalog.js';
import { scaleOf } from './examdoc.js';
import { isClean, CLEAN_MSG } from './moderation.js';

import * as BK from './backend.js';
// Mit Backend läuft Brainy über den Server (Key geheim); sonst eigener Key oder Demo-Modus.
export const hasKey = () => (BK.enabled && !!S.user?.id) || !!S.settings.apiKey;

const BRAINY = `Du bist «Brainy», das freundliche Cartoon-Gehirn der Schweizer Lern-App «Brained».
Du sprichst Schweizer Hochdeutsch (kein ß, sondern ss), duzt, bist motivierend, kurz und konkret. Max. 1 Emoji pro Antwort.`;

// Offizielles Anthropic-SDK (ESM via jsDelivr), erst bei Bedarf geladen → Demo-Modus bleibt offline.
let SDK, client, clientKey;
async function getClient() {
  if (client && clientKey === S.settings.apiKey) return client;
  SDK = SDK || (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm')).default;
  client = new SDK({ apiKey: S.settings.apiKey, dangerouslyAllowBrowser: true });
  clientKey = S.settings.apiKey;
  return client;
}

// effort: 'low' für schnelle Chat-Antworten, 'medium' für strukturierte Aufgaben (Prüfungen, Pläne)
export async function claude({ system, messages, maxTokens = 4000, effort = 'medium', kind = 'chat', keepLang = false }) {
  const userText = (messages || []).filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : (m.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ')).join(' ');
  if (!isClean(userText.slice(-4000), { learning: true })) throw new Error(CLEAN_MSG);
  if (lang !== 'de' && !keepLang) system = `${system}\n\nWICHTIG: Antworte (alle Texte, auch in JSON-Feldern) auf ${aiLanguage()}.`;
  if (!hasKey()) throw new Error('NO_KEY');
  if (BK.enabled && S.user?.id) return BK.brainy({ system, messages, max_tokens: maxTokens, effort, kind });
  const model = S.settings.model || 'claude-opus-5';
  const c = await getClient();
  const params = { model, max_tokens: maxTokens, system: `${BRAINY}\n\n${system}`, messages };
  if (!model.startsWith('claude-haiku')) params.output_config = { effort };
  let res;
  try {
    // Opus 5: serverseitiger Fallback, falls ein Sicherheits-Klassifikator ablehnt
    res = model === 'claude-opus-5'
      ? await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await c.messages.create(params);
  } catch (e) {
    if (isErr(e, 'AuthenticationError')) throw new Error('API-Key ungültig – bitte im Profil prüfen.');
    if (isErr(e, 'RateLimitError')) throw new Error('Zu viele Anfragen – kurz warten und nochmals versuchen.');
    if (isErr(e, 'APIConnectionError')) throw new Error('Keine Verbindung zu Claude.');
    throw new Error(e?.error?.error?.message || e?.message || 'Unbekannter Fehler');
  }
  if (res.stop_reason === 'refusal') throw new Error('Brainy kann dazu leider nichts sagen.');
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}
const isErr = (e, name) => !!SDK?.[name] && e instanceof SDK[name];

export function parseJSON(text) { return parseJSONLoose(text); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// ======================= 1) Erklär's Brainy (Feynman-Duell) =======================
// Du erklärst – Brainy spielt eine Person (Kind / Mitschüler:in / strenge Lehrperson), fragt nach Lücken
// und meldet live, wie viel er schon verstanden hat (Verständnis-Meter 0–100).
export const PERSONAS = {
  kid: { em: '🧒', name: '12-jähriges Kind', short: 'Kind', desc: 'Einfach erklären, ohne Fachchinesisch', role: 'eine neugierige 12-jährige Person, die das Thema NICHT kennt. Fachbegriffe ohne Erklärung verwirren dich' },
  peer: { em: '🧑‍🎓', name: 'Mitschüler:in', short: 'Mitschüler:in', desc: 'Prüfungsniveau – mit Beispielen', role: 'ein:e Mitschüler:in, die die Prüfung morgen hat, das Thema halb kennt und typische Denkfehler macht' },
  prof: { em: '👩‍🏫', name: 'Strenge Lehrperson', short: 'Lehrperson', desc: 'Fachbegriffe, Präzision, Begründungen', role: 'eine strenge, aber faire Lehrperson im mündlichen Examen. Du verlangst präzise Fachbegriffe, Definitionen und Begründungen' },
};
const FEYN_DEMO = [
  t => `Hmm, «${t}» klingt kompliziert 🤔 Was ist denn die Grundidee davon – in einem Satz?`,
  () => 'Okay… aber WARUM ist das so? Was steckt dahinter?',
  () => 'Kannst du mir ein Beispiel aus dem echten Leben geben? So, dass ich es mir vorstellen kann.',
  () => 'Und was wäre, wenn man das falsch macht oder es nicht so wäre?',
  () => 'Ich glaub, ich checks langsam! Fass es mir nochmals in 2 Sätzen zusammen?',
];
const demoMeter = text => { const w = text.split(/\s+/).length; return Math.min(30, 8 + w / 4 + (/weil|deshalb|darum|daher|denn/i.test(text) ? 6 : 0) + (/zum beispiel|z\. ?b\.|stell dir vor|wie wenn/i.test(text) ? 6 : 0)); };
// → { text, meter }
export async function feynmanReply(topic, persona, history, meter = 0) {
  const P = PERSONAS[persona] || PERSONAS.kid;
  const userTurns = history.filter(m => m.role === 'user').length;
  if (!hasKey()) { await wait(700); const last = history.filter(m => m.role === 'user').at(-1)?.text || ''; return { text: FEYN_DEMO[Math.min(userTurns, FEYN_DEMO.length - 1)](topic), meter: Math.min(100, Math.round(meter + demoMeter(last))) }; }
  const out = await claude({
    system: `Modus: ERKLÄR'S BRAINY. Thema: «${topic}». Du spielst ${P.role}. Die lernende Person erklärt dir das Thema.
Regeln: Erkläre selbst NIE etwas und verrate keine Lösung. Pro Antwort genau EINE kurze Rückfrage (max. 2 Sätze), die die wichtigste noch offene Lücke trifft: fehlender Fachbegriff, fehlendes Warum, Denkfehler oder fehlendes Beispiel. Ist etwas falsch, sag «Aber ich hab mal gehört, dass …» und lass die Person sich selbst korrigieren.
Schätze zusätzlich ehrlich, wie viel vom Thema du nach allen bisherigen Erklärungen verstanden hast (0–100). Steige nur bei inhaltlich korrekten, klaren Erklärungen; Fehler oder Ausweichen senken den Wert. 100 nur, wenn wirklich alles Wesentliche korrekt erklärt ist.
Antworte NUR mit JSON: {"reply":"…","meter":0-100}`,
    messages: [{ role: 'user', content: `Ich erkläre dir jetzt «${topic}».` }, ...history.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }))],
    maxTokens: 2000, effort: 'low',
  });
  try { const j = parseJSON(out); return { text: String(j.reply || '').trim() || out, meter: Math.max(0, Math.min(100, Math.round(+j.meter || meter))) }; }
  catch { return { text: out.replace(/```[\s\S]*?```/g, '').trim(), meter: Math.min(100, meter + 10) }; }
}
export async function feynmanScore(topic, persona, history, subjects = []) {
  const userText = history.filter(m => m.role === 'user').map(m => m.text).join('\n');
  if (!hasKey()) {
    await wait(900);
    const words = userText.split(/\s+/).filter(Boolean).length;
    const why = /weil|deshalb|darum|daher|denn/i.test(userText), ex = /zum beispiel|z\. ?b\.|beispiel|stell dir vor/i.test(userText);
    const score = Math.min(96, 30 + Math.min(words, 160) / 3 + (why ? 12 : 0) + (ex ? 12 : 0));
    return {
      score: Math.round(score), subject: null,
      good: [words > 60 ? 'Ausführlich erklärt' : 'Kurz und knackig', why ? 'Du begründest mit «weil/deshalb»' : null, ex ? 'Du nutzt Beispiele' : null].filter(Boolean),
      gaps: [!why ? 'Erkläre das WARUM, nicht nur das WAS' : null, !ex ? 'Ein konkretes Alltagsbeispiel fehlt' : null, words < 60 ? 'Geh bei den Fachbegriffen mehr in die Tiefe' : null].filter(Boolean),
      tip: 'Demo-Bewertung (Heuristik). Mit Brainy-Server bewertet Brainy inhaltlich, was stimmt und was fehlt.',
      cards: [{ q: `Erkläre «${topic}» in einem Satz.`, a: userText.split(/[.!?]/)[0]?.slice(0, 200) || topic }],
    };
  }
  const P = PERSONAS[persona] || PERSONAS.kid;
  const out = await claude({
    system: `Bewerte, wie gut die lernende Person das Thema «${topic}» erklärt hat (Feynman-Methode). Gegenüber war: ${P.name} – bewerte auf diesem Niveau.
Ordne das Thema einem dieser Fächer zu (id): ${subjects.map(s => `${s.id}=${s.name}`).join(', ') || 'keins'}.
Antworte NUR mit JSON: {"score":0-100,"subject":"id oder null","good":["…"],"gaps":["…"],"tip":"ein konkreter nächster Schritt","cards":[{"q":"Frage zu einer Lücke","a":"korrekte, kurze Antwort"}]}
good/gaps je 1-4 kurze Punkte. Inhaltliche Fehler gehören in gaps (mit Korrektur). 2-4 cards zu den Lücken.`,
    messages: [{ role: 'user', content: history.map(m => `${m.role === 'ai' ? 'Brainy' : 'Lernende Person'}: ${m.text}`).join('\n') }],
  });
  return parseJSON(out);
}

// ======================= 2) Prüfungsgenerator =======================
// Erstellt ein echtes Prüfungsdokument (Deckblatt, Aufgaben mit Punkten, Lösungsschlüssel) im Format der gewählten Prüfung.
const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
export const EXAM_LENGTHS = { short: { tasks: '3–4', share: .35 }, standard: { tasks: '5–6', share: .6 }, real: { tasks: null, share: 1 } };
export const examMinutes = (type, length) => length === 'real' ? type.minutes : Math.max(20, Math.round(type.minutes * EXAM_LENGTHS[length].share / 5) * 5);
// type: Eintrag aus EXAM_TYPES · length: 'short' | 'standard' | 'real' · upload: {type, data} (Bild/PDF einer alten Prüfung)
export async function examGenerate({ type, subjectId, subjectName, topic, length = 'standard', upload = null }) {
  const minutes = examMinutes(type, length), L = EXAM_LENGTHS[length] || EXAM_LENGTHS.standard;
  if (!hasKey()) {
    if (upload) throw new Error('Für Zwillingsprüfungen aus eigenen Unterlagen braucht Brainy die Claude-Verbindung (Profil → Claude API).');
    await wait(900);
    const bank = [...shuffle(DEMO_QUESTIONS[subjectId] || []), ...shuffle(DEMO_QUESTIONS.general)];
    return demoExam({ type, subjectId, subjectName, bank, n: { short: 4, standard: 6, real: 10 }[length] || 6, minutes });
  }
  const content = [];
  if (upload?.type === 'application/pdf') {
    // PDF im Gerät auslesen (funktioniert mit jedem KI-Anbieter); gescannte PDFs → Seitenbilder
    const { readPdf } = await import('./pdf.js');
    const pdf = await readPdf(upload.data);
    if (pdf.images.length) pdf.images.forEach(img => content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } }));
    if (pdf.text.replace(/--- Seite \d+ ---/g, '').trim().length >= 300) content.push({ type: 'text', text: `Inhalt der alten Prüfung (${pdf.pages} Seiten, aus PDF ausgelesen):\n${pdf.text}` });
    if (!content.length) throw new Error('Im PDF wurde kein lesbarer Inhalt gefunden – versuch ein Foto der Seiten.');
  } else if (upload) content.push({ type: 'image', source: { type: 'base64', media_type: upload.type, data: upload.data } });
  const bp = type.blueprint?.[subjectId] || '', P = type.paper || {};
  const size = L.tasks ? `${L.tasks} Aufgaben (gekürzte Version), Punkte proportional zur Dauer` : `vollständige Prüfung: ${P.points || 'realistische Punktzahl'}`;
  content.push({ type: 'text', text: upload
    ? `Das ist eine alte Prüfung. Analysiere Aufbau, Deckblatt, Themen, Aufgabentypen, Schwierigkeit und Punkteverteilung. Erstelle dann eine NEUE «Zwillingsprüfung» im gleichen Stil (${size}). Kopiere KEINE Aufgabe wörtlich – neue Zahlen, neue Kontexte.${topic ? ' Schwerpunkt: ' + topic : ''}`
    : `Erstelle die Prüfung. Thema/Schwerpunkt: ${topic || 'gesamter Prüfungsstoff gemäss offiziellem Aufbau'}` });
  const out = await claude({
    kind: 'exam',
    system: examPrompt({ type, subjectName, minutes, size, bp, P }),
    messages: [{ role: 'user', content }], maxTokens: 16000,
  });
  const ex = normalizeExam(parseJSON(out), { type, subjectName, minutes, subjectId });
  if (!ex.tasks.length) throw new Error('Keine Aufgaben erhalten – bitte nochmals versuchen');
  return ex;
}
// Generator mit Datenbank-Profil (Kanton · Prüfung · Fach/Teil) – Struktur exakt wie die echte Prüfung
export async function examGenerateDb({ examId, subjKey, length = 'real', extra = '', upload = null, subjectId = 'mathe', onStep = null }) {
  const ex = examByKey(examId) || examById(examId), subj = ex?.subjects?.[subjKey];
  if (!subj) throw new Error('Prüfung nicht gefunden');
  const pr = examPromptProfile({ ex, subj, key: subjKey, length, extra: (extra || '').trim() });
  // Sprachfächer (Deutsch, Französisch, Englisch, Italienisch) und fremdsprachige Originale bleiben in ihrer Sprache
  const keepLang = /deutsch|franz|englisch|ital/.test(subjKey.split(':').pop()) || !!(subj.lang || ex.lang);
  const type = { name: ex.name, paper: { kicker: `${ex.name}`, aids: subj.aids, formal: subj.form === 'Sie', rules: subj.rules } };
  if (!hasKey()) {
    if (upload) throw new Error('Für Zwillingsprüfungen aus eigenen Unterlagen braucht Brainy die Server-Verbindung.');
    await wait(900);
    const bank = [...shuffle(DEMO_QUESTIONS[subjectId] || DEMO_QUESTIONS.mathe || []), ...shuffle(DEMO_QUESTIONS.general)];
    const d = demoExam({ type, subjectId, subjectName: subj.title, bank, n: pr.nTasks || 6, minutes: pr.minutes });
    return { ...d, title: subj.title, rules: subj.rules || d.rules, aids: subj.aids };
  }
  const content = [];
  if (upload?.type === 'application/pdf') {
    const { readPdf } = await import('./pdf.js');
    const pdf = await readPdf(upload.data);
    pdf.images.forEach(img => content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } }));
    if (pdf.text.replace(/--- Seite \d+ ---/g, '').trim().length >= 300) content.push({ type: 'text', text: `Inhalt der alten Prüfung (${pdf.pages} Seiten):\n${pdf.text}` });
  } else if (upload) content.push({ type: 'image', source: { type: 'base64', media_type: upload.type, data: upload.data } });
  content.push({ type: 'text', text: upload ? 'Das ist eine alte Prüfung (für den Eigengebrauch hochgeladen). Übernimm Aufbau und Niveau, aber schreibe ausschliesslich NEUE Aufgaben im Rahmen der Fakten oben. Kopiere nichts wörtlich.' : 'Erstelle die Prüfung.' });
  const norm = raw => normalizeExam(raw, { type, subjectName: subj.title, minutes: pr.minutes, subjectId: subjKey.split(':').pop().startsWith('mathe') ? 'mathe' : subjectId });
  let exn;
  for (let k = 0; k < 2 && !exn; k++) {                 // unvollständige/kaputte Antwort → einmal neu versuchen
    const out = await claude({ kind: k ? 'chat' : 'exam', system: pr.system, messages: [{ role: 'user', content }], maxTokens: 16000, keepLang });
    try { exn = norm(parseJSON(out)); } catch (e) { if (k) throw new Error('Die Antwort war unvollständig – bitte nochmals versuchen'); }
  }
  if (!exn.tasks.length) throw new Error('Keine Aufgaben erhalten – bitte nochmals versuchen');
  // Schlusskontrolle: Struktur, Anrede, Abbildungen, Lösungen nachrechnen, Niveau – wie eine Prüfungskommission
  onStep?.('check');
  try {
    const issues = examIssues(exn, subj, pr);
    const fixed = await claude({ kind: 'chat', effort: 'high', system: 'Antworte nur mit JSON.', messages: [{ role: 'user', content: examRepairPrompt(exn, issues, subj, pr) }], maxTokens: 16000, keepLang });
    const ex2 = norm(parseJSON(fixed));
    if (ex2.tasks.length && examIssues(ex2, subj, pr).length <= issues.length) exn = ex2;
  } catch (e) { console.warn('Kontrolle übersprungen', e); }
  exn.title = subj.title; exn.kicker = ex.name; exn.formal = subj.form === 'Sie'; exn.dbRef = { examId, subjKey, canton: ex.canton, archive: ex.archive?.url }; exn.scale = scaleOf(ex);
  if (!exn.rules?.length) exn.rules = subj.rules || [];
  return exn;
}

// Schweizer Notenformel: Note = Punkte / Maximum · 5 + 1, gerundet auf Zehntel (Zeugnis meist auf 0.5)
export const swissGrade = pct => Math.max(1, Math.min(6, Math.round((pct * 5 + 1) * 10) / 10));
export const roundHalf = g => Math.round(g * 2) / 2;

export async function examGradeOpen(q, model, answer) {
  if (!hasKey()) {
    await wait(700);
    const kw = model.toLowerCase().match(/[a-zäöüé]{5,}/g) || [];
    const hit = kw.filter(w => answer.toLowerCase().includes(w)).length;
    const pts = Math.min(1, hit / Math.max(3, kw.length * .4));
    return { points: Math.round(pts * 100) / 100, feedback: pts > .6 ? 'Stark – die Kernbegriffe sind drin.' : 'Da fehlen noch zentrale Punkte. Vergleich mit der Musterlösung.' };
  }
  const out = await claude({
    system: 'Bewerte eine offene Prüfungsantwort fair wie eine Schweizer Lehrperson. Antworte NUR mit JSON: {"points":0..1,"feedback":"1-2 Sätze, konkret was fehlt/stimmt"}',
    messages: [{ role: 'user', content: `Frage: ${q}\nMusterlösung: ${model}\nAntwort: ${answer}` }], maxTokens: 2000, effort: 'low',
  });
  return parseJSON(out);
}

// ======================= 3) Lernplan-Generator =======================
// topics: [{ t: 'Thema', lvl: 0 (unsicher) | 1 (geht so) | 2 (sitzt) }] · Tage bekommen einen Typ:
// new = Neu lernen · rep = Repetition · cards = Karteikarten · exam = Probeprüfung · light = leichte Repetition (Vortag)
export const PLAN_KINDS = { new: { em: '📖', name: 'Neu lernen' }, rep: { em: '🔁', name: 'Repetition' }, cards: { em: '🃏', name: 'Karteikarten' }, exam: { em: '📝', name: 'Probeprüfung' }, light: { em: '😌', name: 'Locker' } };
export async function makePlan({ exam, subjectId, examDate, minPerDay, topics, restDays = [] }) {
  const today = startOfDay(Date.now());
  const end = startOfDay(examDate);
  const days = [];
  for (let d = addDays(today, 1); d < end; d = addDays(d, 1)) if (!restDays.includes(new Date(d).getDay())) days.push(d);
  if (!days.length) return [];
  const tps = (topics?.length ? topics : [{ t: 'Grundlagen', lvl: 1 }, { t: 'Vertiefung', lvl: 1 }, { t: 'Übungsaufgaben', lvl: 1 }]).map(x => typeof x === 'string' ? { t: x, lvl: 1 } : x);
  let plan;
  if (hasKey()) {
    try {
      const out = await claude({
        system: `Erstelle einen realistischen Lernplan bis zur Prüfung «${exam}» (${subj(subjectId).name}) am ${dayKey(end)}.
Verfügbare Tage: ${days.map(dayKey).join(', ')}. Pro Tag max. ${minPerDay} min.
Themen mit Selbsteinschätzung (0 = unsicher → braucht am meisten Zeit, 1 = geht so, 2 = sitzt → nur kurz repetieren): ${tps.map(x => `${x.t} (${x.lvl})`).join('; ')}.
Prinzipien: Spaced Repetition (jedes Thema mehrmals, mit wachsendem Abstand), Interleaving, zuerst Verständnis dann Übung, unsichere Themen früh und öfter, Karteikarten-Tage einstreuen, 2–3 Tage vor der Prüfung eine Probeprüfung unter echten Bedingungen, am letzten Tag nur locker repetieren.
kind: "new" | "rep" | "cards" | "exam" | "light".
Antworte NUR mit JSON-Array: [{"date":"YYYY-MM-DD","min":45,"kind":"new","focus":"konkrete Aufgabe, max. 60 Zeichen"}]`,
        messages: [{ role: 'user', content: 'Plan bitte.' }], maxTokens: 8000,
      });
      plan = parseJSON(out).map(p => { const [y, m, d] = p.date.split('-').map(Number); return { ts: new Date(y, m - 1, d).getTime(), min: Math.min(+p.min || minPerDay, minPerDay), focus: String(p.focus || '').slice(0, 80), kind: PLAN_KINDS[p.kind] ? p.kind : 'rep' }; })
        .filter(p => days.includes(startOfDay(p.ts)));
      if (!plan.length) plan = null;
    } catch (e) { console.warn(e); }
  }
  if (!plan) {
    // Lokaler Algorithmus: Themen nach Unsicherheit gewichtet, Repetition mit wachsendem Abstand, Probeprüfung, lockerer Vortag
    const n = days.length, weight = x => [3, 2, 1][x.lvl ?? 1];
    const queue = tps.slice().sort((a, b) => (a.lvl ?? 1) - (b.lvl ?? 1)).flatMap(x => Array.from({ length: weight(x) }, (_, k) => ({ t: x.t, k })));
    const examDay = n >= 4 ? n - 3 : -1, last = n - 1;
    let qi = 0, seen = new Set();
    plan = days.map((d, i) => {
      if (i === last && n > 1) return { ts: d, min: Math.round(minPerDay * .5), kind: 'light', focus: 'Locker repetieren + Karteikarten, früh schlafen 😴' };
      if (i === examDay) return { ts: d, min: minPerDay, kind: 'exam', focus: `Probeprüfung «${exam}» unter echten Bedingungen` };
      if (i % 4 === 3) return { ts: d, min: Math.round(minPerDay * .7), kind: 'cards', focus: `Karteikarten: ${[...seen].slice(-3).join(', ') || tps[0].t}` };
      const it = queue[qi % queue.length]; qi++;
      const fresh = !seen.has(it.t); seen.add(it.t);
      return { ts: d, min: minPerDay, kind: fresh ? 'new' : 'rep', focus: `${fresh ? 'Neu' : 'Repetition'}: ${it.t}` };
    });
  }
  return plan;
}

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
  const out = await claude({
    system: `Mach aus dem Lernstoff (Fach: ${subjectName}) ${long ? '6-15' : '3-6'} präzise Karteikarten für Spaced Repetition.
Regeln: nur prüfungsrelevante Kernaussagen, eine Idee pro Karte, Frage aktiv formuliert (kein Ja/Nein), Antwort max. 25 Wörter, ergänze Fehlendes korrekt.
Antworte NUR mit JSON-Array: [{"q":"…","a":"…"}]`,
    messages: [{ role: 'user', content }], maxTokens: 6000,
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
    messages: [{ role: 'user', content: JSON.stringify(summary) }], maxTokens: 3000,
  });
  return parseJSON(out);
}

// ======================= 6) Tipp-Leiter (Hausaufgaben-Hilfe ohne Abschreiben) =======================
// 3 Stufen: Denkanstoss → Strategie → erster Schritt. Die Lösung gibt's erst, wenn man selbst eine abgibt.
const HINT_DEMO = [
  'Was ist gegeben, was ist gesucht? Schreib beides sauber auf – oft steckt die halbe Lösung schon darin.',
  'Welches Thema aus dem Unterricht passt dazu? Notier die passende Regel oder Formel zuerst ganz allgemein.',
  'Setz jetzt die gegebenen Werte ein und mach nur den ersten Schritt. Den Rest schaffst du selbst!',
];
export async function hint(task, subjectName, level, prev = []) {
  if (!hasKey()) { await wait(600); return HINT_DEMO[level - 1]; }
  return claude({
    system: `Modus: TIPP-LEITER. Fach: ${subjectName}. Die lernende Person braucht Hilfe bei einer Aufgabe, soll sie aber SELBST lösen.
Gib Hinweis Stufe ${level} von 3: Stufe 1 = Denkanstoss (welches Konzept steckt dahinter?), Stufe 2 = Strategie/Lösungsweg in Worten, Stufe 3 = der erste konkrete Schritt.
Verrate NIE das Endergebnis. Max. 3 Sätze. Bereits gegebene Hinweise (nicht wiederholen): ${prev.join(' | ') || 'keine'}`,
    messages: [{ role: 'user', content: `Aufgabe: ${task}` }], maxTokens: 2000, effort: 'low',
  });
}
export async function checkSolution(task, subjectName, answer) {
  if (!hasKey()) {
    await wait(700);
    return { correct: null, feedback: 'Demo-Modus: Ohne Claude-Key kann ich deine Lösung nicht inhaltlich prüfen. Vergleich mit dem Lösungsblatt – oder verbinde Claude im Profil.', solution: '' };
  }
  const out = await claude({
    system: `Prüfe die Lösung der lernenden Person (Fach: ${subjectName}) wie eine faire Lehrperson. Sie hat es selbst versucht, also darfst du jetzt den Lösungsweg zeigen.
Antworte NUR mit JSON: {"correct":true|false,"feedback":"1-2 Sätze: was stimmt, wo genau der Fehler liegt","solution":"kurzer, vollständiger Lösungsweg"}`,
    messages: [{ role: 'user', content: `Aufgabe: ${task}\nMeine Lösung: ${answer}` }],
  });
  return parseJSON(out);
}

// ======================= 7) Eselsbrücken =======================
export async function mnemonics(fact, subjectName) {
  if (!hasKey()) {
    await wait(700);
    const items = fact.split(/[,;\n]| und /).map(s => s.trim()).filter(Boolean);
    const out = [];
    if (items.length >= 2) {
      const letters = items.map(i => i[0].toUpperCase()).join('');
      out.push({ art: 'Akronym', text: `Merkwort «${letters}»: ${items.map(i => `${i[0].toUpperCase()} = ${i}`).join(', ')}` });
      out.push({ art: 'Geschichte', text: `Erfinde einen Satz, dessen Wörter mit ${letters.split('').join('-')} beginnen – je verrückter, desto besser bleibt er hängen.` });
    }
    out.push({ art: 'Bild', text: `Stell dir «${items[0] || fact}» als riesiges Plakat am Bahnhof deiner Stadt vor – jedes Mal, wenn du vorbeigehst, liest du es.` });
    return out;
  }
  const out = await claude({
    system: `Erfinde 3 starke, einprägsame Eselsbrücken (Fach: ${subjectName}) für den Lernstoff. Mische Arten: Akronym, Reim, Bild/Geschichte. Gerne mit Schweizer Bezug. Inhaltlich korrekt!
Antworte NUR mit JSON-Array: [{"art":"Akronym|Reim|Bild|Geschichte","text":"…"}]`,
    messages: [{ role: 'user', content: fact }], effort: 'low',
  });
  return parseJSON(out);
}
