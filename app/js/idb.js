// Kleiner Bildspeicher (IndexedDB) für Prüfungsseiten und ausgeschnittene Grafiken.
// localStorage wäre dafür zu klein (5 MB); Bilder bleiben nur auf dem Gerät.
const DB = 'brained-studio', STORE = 'img';
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const q = fn(t.objectStore(STORE)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
// Zwischenspeicher, damit morphdom-Renderings synchron auf Bilder zugreifen können
const mem = new Map();
export const imgPut = (key, dataUrl) => { mem.set(key, dataUrl); return tx('readwrite', s => s.put(dataUrl, key)).catch(() => { }); };
export const imgDel = key => { mem.delete(key); return tx('readwrite', s => s.delete(key)).catch(() => { }); };
export const imgSync = key => mem.get(key) || '';
export async function imgGet(key) {
  if (!key) return '';
  if (mem.has(key)) return mem.get(key);
  try { const v = await tx('readonly', s => s.get(key)); if (v) mem.set(key, v); return v || ''; } catch { return ''; }
}
// Lädt mehrere Bilder in den Zwischenspeicher (vor dem Rendern aufrufen)
export const imgWarm = keys => Promise.all(keys.filter(k => k && !mem.has(k)).map(imgGet));
