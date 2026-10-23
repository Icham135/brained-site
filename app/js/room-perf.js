// Lernraum-Leistung: Geräteklasse, Pausieren im Hintergrund, Bild vorladen/dekodieren, Bildraten-Wächter.
// Alle Raum-Module (walk, ambient, rooms) nutzen dies, damit der Raum Akku und Daten schont.
// Nutzung:  perfStart(rootEl) beim Öffnen, perfStop() beim Schliessen; perfLoop(fn) statt eigenem requestAnimationFrame;
//           perfTier() → 'high' | 'low' | 'reduced' (Ambient-Dichte/Effekte daran anpassen); preloadRoomImage(url).
// Wirkung am Wurzelelement: data-perf="high|low|reduced" und Klasse rm-paused (alle CSS-Animationen im Raum stehen still).
const listeners = new Set(), loops = new Set();
let root = null, active = false, tier = null, forced = null, raf = 0, last = 0, slow = 0, fast = 0;

const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
function detect() {
  if (forced) return forced;
  if (mq('(prefers-reduced-motion: reduce)')) return 'reduced';
  const n = navigator, cores = n.hardwareConcurrency || 4, mem = n.deviceMemory || 4, c = n.connection || {};
  if (c.saveData || cores <= 4 || mem <= 2 || /2g/.test(c.effectiveType || '')) return 'low';
  return 'high';
}
export const perfTier = () => tier || (tier = detect());
/** Stufe von Hand setzen (z. B. Test) oder null für automatisch */
export function perfForce(t) { forced = t; setTier(detect()); }
export const perfPaused = () => !active || document.hidden;
export const perfOn = fn => (listeners.add(fn), () => listeners.delete(fn));   // fn({ paused, tier })

function setTier(t) {
  tier = t; slow = fast = 0;
  if (root) root.dataset.perf = t;
  emit();
}
function emit() { listeners.forEach(f => { try { f({ paused: perfPaused(), tier: perfTier() }); } catch { } }); }
function sync() {
  const p = perfPaused();
  if (root) root.classList.toggle('rm-paused', p);
  if (p) { cancelAnimationFrame(raf); raf = 0; } else if (loops.size && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  emit();
}

// Gemeinsame Bildschleife: ein einziges requestAnimationFrame für alle Module, steht still bei Hintergrund oder geschlossenem Raum.
// Bleibt die Bildrate unter ~40 fps, wird die Stufe automatisch gesenkt (high → low), nie wieder erhöht in derselben Sitzung.
function frame(t) {
  raf = 0; if (perfPaused()) return;
  const dt = last ? t - last : 0; last = t;
  if (dt > 0 && dt < 250) {   // grosse Lücken (Tab-Wechsel) ignorieren
    if (dt > 26) { slow++; fast = 0; } else if (++fast > 30) slow = Math.max(0, slow - 1);
    if (slow > 45 && perfTier() === 'high' && !forced) setTier('low');
  }
  loops.forEach(f => f(t, dt));
  if (loops.size) raf = requestAnimationFrame(frame);
}
/** Schleife anmelden; fn(zeitMs, deltaMs). Rückgabe: Abmelden. */
export function perfLoop(fn) {
  loops.add(fn); if (!perfPaused() && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  return () => { loops.delete(fn); if (!loops.size) { cancelAnimationFrame(raf); raf = 0; } };
}

const STYLE = `.rm-paused *, .rm-paused *::before, .rm-paused *::after { animation-play-state: paused !important; }
[data-perf="reduced"] *, [data-perf="reduced"] *::before, [data-perf="reduced"] *::after { animation-duration: .001s !important; animation-iteration-count: 1 !important; transition-duration: .001s !important; }
[data-perf="low"] .rm-amb-dust, [data-perf="low"] .rm-amb-fly, [data-perf="reduced"] .rm-amb-dust, [data-perf="reduced"] .rm-amb-fly { display: none !important; }
.rm-world { contain: layout style; }`;
function addStyle() {
  if (document.getElementById('rm-perf-style')) return;
  const s = document.createElement('style'); s.id = 'rm-perf-style'; s.textContent = STYLE; document.head.appendChild(s);
}
const onVis = () => sync();
export function perfStart(el) {
  root = el || document.getElementById('app'); active = true; addStyle();
  tier = null; setTier(detect());
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onVis); window.addEventListener('pageshow', onVis);
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => setTier(detect())); } catch { }
  sync();
}
export function perfStop() {
  active = false; document.removeEventListener('visibilitychange', onVis);
  window.removeEventListener('pagehide', onVis); window.removeEventListener('pageshow', onVis);
  sync(); root = null;
}

// Bild: auf schwachen Geräten die kleine Variante (Datei-Suffix -s, 800 px breit), sonst gross. Dekodierung asynchron, damit der Hauptthread nicht stockt.
export const roomImageUrl = url => perfTier() === 'high' ? url : url.replace(/\.webp$/, '-s.webp');
const cache = new Map();
export function preloadRoomImage(url) {
  const u = roomImageUrl(url);
  if (!cache.has(u)) {
    const img = new Image(); img.decoding = 'async'; img.src = u;
    cache.set(u, (img.decode ? img.decode() : Promise.resolve()).catch(() => { }).then(() => u));
  }
  return cache.get(u);
}
