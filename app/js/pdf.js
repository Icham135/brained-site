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
    text += `\n--- Seite ${i} ---\n` + tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('');
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
