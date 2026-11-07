// Alte Prüfung als PDF: Text direkt im Gerät auslesen (pdf.js, wird erst bei Bedarf geladen).
// Gescannte PDFs ohne Text → die ersten Seiten als Bilder, damit Brainy sie «lesen» kann.
let lib;
async function loadLib() {
  if (lib) return lib;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('./vendor/pdf.min.js', import.meta.url).href;
    s.onload = res; s.onerror = () => rej(new Error('PDF-Leser konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
  lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', import.meta.url).href;
  return lib;
}

// Textelemente einer Seite zu Text zusammensetzen: Leerzeichen nur, wo wirklich eine Lücke ist (sonst zerfällt «beeinflusst» bei Ligaturen fi/fl in «beein fl usst»)
export function joinText(items) {
  let out = '';
  items.forEach((it, i) => {
    out += it.str;
    if (it.hasEOL) { out += '\n'; return; }
    const nx = items[i + 1]; if (!nx || !it.str || !nx.str) return;
    const t = it.transform || [], u = nx.transform || [], h = Math.abs(it.height) || Math.abs(t[3]) || 10;
    if (t.length < 6 || u.length < 6) { out += ' '; return; }
    if (Math.abs(u[5] - t[5]) > h * 0.6) { out += '\n'; return; }   // andere Zeile
    const gap = u[4] - (t[4] + (it.width || 0));
    if (gap > h * 0.12 && !/\s$/.test(it.str) && !/^\s/.test(nx.str)) out += ' ';
  });
  return out;
}
const MAX_PAGES = 12, MAX_CHARS = 24000, IMG_PAGES = 4;

// base64 (ohne data:-Präfix) → { text, images: [{ type, data }], pages }
export async function readPdf(base64) {
  const pdfjs = await loadLib();
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const pages = doc.numPages;
  let text = '';
  for (let i = 1; i <= Math.min(pages, MAX_PAGES) && text.length < MAX_CHARS; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += `\n--- Seite ${i} ---\n` + joinText(tc.items);
  }
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
  const images = [];
  // Kaum Text → vermutlich gescannt: Seiten als Bilder mitschicken
  if (text.replace(/--- Seite \d+ ---/g, '').trim().length < 300) {
    for (let i = 1; i <= Math.min(pages, IMG_PAGES); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / Math.max(vp.width, vp.height));
      const v = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: v }).promise;
      images.push({ type: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.72).split(',')[1] });
    }
  }
  await doc.destroy();
  return { text, images, pages };
}

// Clarity: ausgewählte PDF-Seiten als Bilder (JPEG-Data-URLs) – für Scans und Foto-Korrektur
export async function pdfPages(base64, from = 1, to = 5, maxSide = 1600) {
  const pdfjs = await loadLib();
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const total = doc.numPages, out = [];
  for (let i = Math.max(1, from); i <= Math.min(total, to); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const v = page.getViewport({ scale: Math.min(3, maxSide / Math.max(vp.width, vp.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: v }).promise;
    out.push({ url: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height });
  }
  await doc.destroy();
  return { pages: out, total };
}
export async function pdfCount(base64) {
  const pdfjs = await loadLib();
  const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), isEvalSupported: false }).promise;
  const n = doc.numPages; await doc.destroy(); return n;
}

// Path: Text je Seite (ohne Seitenlimit der Karteikarten-Funktion); Seiten ohne Text meldet `scanned`
export async function pdfPageTexts(base64, maxPages = 200) {
  const pdfjs = await loadLib();
  const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)), isEvalSupported: false }).promise;
  const total = doc.numPages, pages = [];
  for (let i = 1; i <= Math.min(total, maxPages); i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push({ n: i, text: joinText(tc.items).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim() });
  }
  await doc.destroy();
  return { pages, total };
}
