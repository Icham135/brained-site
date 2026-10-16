// Mehrsprachigkeit (DE · FR · IT · EN).
// Die App ist auf Deutsch geschrieben. Nach jedem Rendern übersetzt translateDOM() alle Texte
// anhand der Wörterbücher in js/lang/*.js (Schlüssel = deutscher Originaltext).
// Zahlen werden als «#» behandelt: "Weiter (3)" findet den Eintrag "Weiter (#)".

export const LANGS = [
  { id: 'de', flag: '🇨🇭', label: 'Deutsch', ai: 'Deutsch (Schweizer Rechtschreibung, ss statt ß)' },
  { id: 'fr', flag: '🇫🇷', label: 'Français', ai: 'Französisch (Schweizer Französisch, z.B. septante, nonante)' },
  { id: 'it', flag: '🇮🇹', label: 'Italiano', ai: 'Italienisch (Tessiner Kontext)' },
  { id: 'en', flag: '🇬🇧', label: 'English', ai: 'Englisch' },
];
// Wörterbücher werden nur bei Bedarf geladen (schnellerer Start auf dem Handy)
const DICTS = { fr: null, it: null, en: null, collect: {} }; // collect = Entwickler-Modus: sammelt alle Texte
export async function loadDict(l) {
  if (l === 'de' || DICTS[l]) return;
  try { DICTS[l] = (await import(`./lang/${l}.js`)).default; } catch { DICTS[l] = {}; }
}
const KEY = 'brained.lang';

function detect() {
  try { const s = localStorage.getItem(KEY); if (s && (s === 'de' || s in DICTS)) return s; } catch { }
  const n = (navigator.language || 'de').slice(0, 2);
  return n in DICTS && n !== 'collect' ? n : 'de';
}
export let lang = typeof navigator !== 'undefined' ? detect() : 'de';
export async function setLang(l) {
  l = l === 'de' || l in DICTS ? l : 'de';
  await loadDict(l);
  lang = l;
  try { localStorage.setItem(KEY, lang); } catch { }
  document.documentElement.lang = lang === 'de' ? 'de-CH' : lang + '-CH';
}
export const curLang = () => LANGS.find(l => l.id === lang) || LANGS[0];
export const aiLanguage = () => curLang().ai;

// Fehlende Texte sammeln (für scripts/i18n-collect.mjs)
export const missing = new Set();
const NUM = /\d+(?:[.,'’]\d+)*/g;

let persistT;
function persistMissing() {
  clearTimeout(persistT);
  persistT = setTimeout(() => { try { const old = JSON.parse(localStorage.getItem('brained.i18n.missing') || '[]'); localStorage.setItem('brained.i18n.missing', JSON.stringify([...new Set([...old, ...missing])])); } catch { } }, 50);
}
export function t(str) {
  if (lang === 'de' || str == null) return str;
  const d = DICTS[lang] || {}, s = String(str), core = s.trim();
  if (!core || !/[A-Za-zÄÖÜäöüéèàç]/.test(core)) return s;
  let out = d[core];
  if (out === undefined && NUM.test(core)) {
    NUM.lastIndex = 0;
    const nums = core.match(NUM), tpl = core.replace(NUM, '#');
    const tr = d[tpl];
    if (tr !== undefined) { let i = 0; out = tr.replace(/#/g, () => nums[i++] ?? '#'); }
    else missing.add(tpl);
  } else if (out === undefined) missing.add(core);
  NUM.lastIndex = 0;
  if (lang === 'collect') persistMissing();
  if (out === undefined) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  return lead + out + trail;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
export function translateDOM(root) {
  if (lang === 'de' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement?.closest('[data-noi18n],script,style,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  root.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(el => {
    if (el.closest('[data-noi18n]')) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const tv = t(v); if (tv !== v) el.setAttribute(a, tv); } }
  });
}

await loadDict(lang);
