// Scanner-Ausbau nach Vorbild der chinesischen Prüfungs-Apps (Quark, CamScanner, Zuoyebang):
// A) Seite im Foto finden + gerade ziehen (Perspektivkorrektur), B) Schatten/Licht ausgleichen,
// C) Handschrift per eigenem Netz (Druck vs. Handschrift pro Bildpunkt) entfernen – läuft auf dem Gerät (ONNX, ohne Server).
// Alles mit Sicherheitsnetz: Im Zweifel bleibt das Bild unverändert.

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild konnte nicht geladen werden')); i.src = src; });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctx2d = c => c.getContext('2d', { willReadFrequently: true });

/* ---------- A) Seite finden: hellste zusammenhängende Fläche → 4 Ecken ---------- */
function otsu(g) {
  const hist = new Array(256).fill(0); for (const v of g) hist[v]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = g.length - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  return thr;
}
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export const quadArea = q => Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % 4]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
export function quadOk(q, w, h) {
  if (!q) return false;
  const s = q.map((p, i) => cross(p, q[(i + 1) % 4], q[(i + 2) % 4]));
  if (!(s.every(v => v > 0) || s.every(v => v < 0))) return false;           // konvex
  const a = quadArea(q) / (w * h); if (a < 0.2 || a > 0.97) return false;      // zu klein oder schon zugeschnitten
  for (let i = 0; i < 4; i++) {                                               // Winkel 50°–130°
    const p = q[i], u = q[(i + 3) % 4], v = q[(i + 1) % 4];
    const a1 = [u[0] - p[0], u[1] - p[1]], a2 = [v[0] - p[0], v[1] - p[1]];
    const cos = (a1[0] * a2[0] + a1[1] * a2[1]) / (Math.hypot(...a1) * Math.hypot(...a2) || 1);
    if (Math.abs(cos) > 0.65) return false;
  }
  return true;
}
// data: RGBA-Pixel (klein, z. B. 320 px), Rückgabe: Ecken [oben-links, oben-rechts, unten-rechts, unten-links] oder null
export function detectDocumentQuad({ data, width: w, height: h }) {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) | 0;
  const b = new Uint8Array(w * h);   // 3×3 weichzeichnen
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += g[(y + dy) * w + x + dx]; b[y * w + x] = s / 9; }
  const thr = otsu(b), lab = new Int32Array(w * h).fill(-1);
  let bestN = 0, bestId = -1, id = 0; const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] !== -1 || b[s] <= thr) continue;
    let n = 0; stack.push(s); lab[s] = id;
    while (stack.length) {
      const p = stack.pop(); n++; const x = p % w, y = (p / w) | 0;
      if (x > 0 && lab[p - 1] === -1 && b[p - 1] > thr) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && lab[p + 1] === -1 && b[p + 1] > thr) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && lab[p - w] === -1 && b[p - w] > thr) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && lab[p + w] === -1 && b[p + w] > thr) { lab[p + w] = id; stack.push(p + w); }
    }
    if (n > bestN) { bestN = n; bestId = id; } id++;
  }
  if (bestId < 0 || bestN < w * h * 0.15) return null;
  // Ecken = Extrempunkte (x+y, x−y); robust für Drehungen bis ca. ±40°
  let tl, tr, br, bl, mtl = Infinity, mtr = -Infinity, mbr = -Infinity, mbl = Infinity, inS = 0, inN = 0;
  for (let p = 0; p < w * h; p++) {
    if (lab[p] !== bestId) continue; const x = p % w, y = (p / w) | 0; inS += b[p]; inN++;
    if (x + y < mtl) { mtl = x + y; tl = [x, y]; } if (x - y > mtr) { mtr = x - y; tr = [x, y]; }
    if (x + y > mbr) { mbr = x + y; br = [x, y]; } if (x - y < mbl) { mbl = x - y; bl = [x, y]; }
  }
  let outS = 0, outN = 0; for (let p = 0; p < w * h; p++) if (lab[p] !== bestId) { outS += b[p]; outN++; }
  if (outN < w * h * 0.03 || inS / inN - outS / outN < 25) return null;       // kein klarer Rand um die Seite
  const q = [tl, tr, br, bl];
  return quadOk(q, w, h) ? q : null;
}

/* ---------- Homographie + Entzerren (bilinear) ---------- */
function solve(A, bv) {   // Gauss mit Pivot
  const n = bv.length, M = A.map((r, i) => [...r, bv[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
// Matrix H (3×3, h33 = 1), die Punkte from[i] → to[i] abbildet
export function homography(from, to) {
  const A = [], bv = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bv.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bv.push(v);
  }
  const s = solve(A, bv); return s && [...s, 1];
}
export const applyH = (H, x, y) => { const z = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / z, (H[3] * x + H[4] * y + H[5]) / z]; };

export function warpPerspective(src, quad, maxSide = 1600) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2])), H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const k = Math.min(1, maxSide / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
  const Hm = homography([[0, 0], [W, 0], [W, H], [0, H]], quad); if (!Hm) return null;
  const sc = ctx2d(src), sw = src.width, sh = src.height, s = sc.getImageData(0, 0, sw, sh).data;
  const out = canvas(W, H), oc = ctx2d(out), o = oc.createImageData(W, H), d = o.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [fx, fy] = applyH(Hm, x + 0.5, y + 0.5), x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5), ax = fx - 0.5 - x0, ay = fy - 0.5 - y0, i = (y * W + x) * 4;
    if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 255; continue; }
    const p = (y0 * sw + x0) * 4, q = p + sw * 4;
    for (let c = 0; c < 3; c++) d[i + c] = (s[p + c] * (1 - ax) + s[p + 4 + c] * ax) * (1 - ay) + (s[q + c] * (1 - ax) + s[q + 4 + c] * ax) * ay;
    d[i + 3] = 255;
  }
  oc.putImageData(o, 0, 0); return out;
}

/* ---------- B) Licht ausgleichen: Papierhelligkeit schätzen (Max-Filter + Weichzeichnen), dann teilen ---------- */
export function flattenIllumination(ctx, w, h) {
  const f = Math.max(2, Math.round(Math.max(w, h) / 200)), sw = Math.ceil(w / f), sh = Math.ceil(h / f);
  const im = ctx.getImageData(0, 0, w, h), d = im.data, bg = [new Float32Array(sw * sh), new Float32Array(sw * sh), new Float32Array(sw * sh)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, j = ((y / f) | 0) * sw + ((x / f) | 0); for (let c = 0; c < 3; c++) if (d[i + c] > bg[c][j]) bg[c][j] = d[i + c]; }
  const R = 5, B = 4;
  const filt = (a, r, op) => {   // trennbarer Max- bzw. Mittelwertfilter
    const t = new Float32Array(a.length), o = new Float32Array(a.length);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = op === 'max' ? 0 : 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= sw) continue; const v = a[y * sw + xx]; m = op === 'max' ? Math.max(m, v) : m + v; n++; } t[y * sw + x] = op === 'max' ? m : m / n; }
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= sh) continue; const v = t[yy * sw + x]; m = op === 'max' ? Math.max(m, v) : m + v; n++; } o[y * sw + x] = op === 'max' ? m : m / n; }
    return o;
  };
  const est = bg.map(a => filt(filt(a, R, 'max'), B, 'mean'));
  const lum = est[0].map((v, i) => v * 0.3 + est[1][i] * 0.59 + est[2][i] * 0.11), paper = [...lum].sort((a, b) => a - b)[Math.floor(lum.length * 0.9)] || 255;
  if (paper < 60) return false;   // zu dunkel – lieber nichts tun
  for (const e of est) for (let j = 0; j < e.length; j++) e[j] = Math.max(e[j], paper * 0.55, 40);   // grosse dunkle Flächen (Balken) nicht wegrechnen
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, Math.max(0, y / f - 0.5)), y0 = fy | 0, ay = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, Math.max(0, x / f - 0.5)), x0 = fx | 0, ax = fx - x0, j = y0 * sw + x0, i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const e = est[c], v = (e[j] * (1 - ax) + e[j + 1] * ax) * (1 - ay) + (e[j + sw] * (1 - ax) + e[j + sw + 1] * ax) * ay;
        d[i + c] = Math.min(255, d[i + c] * 255 / v);
      }
    }
  }
  ctx.putImageData(im, 0, 0); return true;
}

/* ---------- Foto → gerade, gleichmässig ausgeleuchtete Seite ---------- */
export async function scanPhoto(dataUrl, { maxSide = 1600, warp = true, flatten = true } = {}) {
  const img = await loadImg(dataUrl), k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  let c = canvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k)), x = ctx2d(c);
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  let quad = null;
  if (warp) {
    const s = Math.min(1, 320 / Math.max(c.width, c.height)), sm = canvas(Math.round(c.width * s), Math.round(c.height * s)), sx = ctx2d(sm);
    sx.drawImage(c, 0, 0, sm.width, sm.height); quad = detectDocumentQuad(sx.getImageData(0, 0, sm.width, sm.height));
    if (quad) { const big = quad.map(([a, b]) => [a / s, b / s]), wc = warpPerspective(c, big, maxSide); if (wc) { c = wc; x = ctx2d(c); quad = big; } else quad = null; }
  }
  if (!quad && Math.max(c.width, c.height) > maxSide) { const kk = maxSide / Math.max(c.width, c.height), r = canvas(Math.round(c.width * kk), Math.round(c.height * kk)); ctx2d(r).drawImage(c, 0, 0, r.width, r.height); c = r; x = ctx2d(c); }
  if (flatten) flattenIllumination(x, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', 0.88), w: c.width, h: c.height, warped: !!quad, quad };
}

/* ---------- C) Handschrift-Netz (eigenes Training, siehe ml/) ---------- */
const NET_SIDE = 1280;
let ortP = null, sessP = null;
export const handNet = { ready: false, failed: false, ms: 0 };
async function session() {
  if (!sessP) sessP = (async () => {
    const ort = await (ortP ||= import('./vendor/ort/ort.wasm.min.mjs'));
    ort.env.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    const s = await ort.InferenceSession.create(new URL('../assets/models/handnet.onnx', import.meta.url).href, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    handNet.ready = true; return { ort, s };
  })().catch(e => { handNet.failed = true; sessP = null; console.warn('Handschrift-Netz nicht verfügbar', e); throw e; });
  return sessP;
}
export const warmHandNet = () => session().then(() => true, () => false);

// Wahrscheinlichkeiten (Druck, Handschrift) für ein Canvas, in Netz-Auflösung
export async function segmentHandwriting(src) {
  const { ort, s } = await session(), t0 = performance.now();
  const k = Math.min(1, NET_SIDE / Math.max(src.width, src.height)), w = Math.round(src.width * k), h = Math.round(src.height * k);
  const W = Math.ceil(w / 16) * 16, H = Math.ceil(h / 16) * 16, c = canvas(W, H), x = ctx2d(c);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, W, H).data, n = W * H, inp = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) { inp[i] = d[i * 4] / 255 - 0.5; inp[n + i] = d[i * 4 + 1] / 255 - 0.5; inp[2 * n + i] = d[i * 4 + 2] / 255 - 0.5; }
  const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, H, W]) }), L = out[s.outputNames[0]].data;
  const print = new Float32Array(n), hand = new Float32Array(n), ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) {   // «Tinte» = nicht papierweiss (dunkel oder farbig, z. B. Leuchtstift)
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    ink[i] = (r * 0.3 + g * 0.59 + b * 0.11 < 200 || (mx - mn) / (mx || 1) > 0.22) ? 1 : 0;
  }
  for (let i = 0; i < n; i++) { const a = L[i], b = L[n + i], cc = L[2 * n + i], m = Math.max(a, b, cc), ea = Math.exp(a - m), eb = Math.exp(b - m), ec = Math.exp(cc - m), z = ea + eb + ec; print[i] = eb / z; hand[i] = ec / z; }
  handNet.ms = Math.round(performance.now() - t0);
  return { W, H, w, h, k, print, hand, ink };
}

// Handschrift-Pixel weiss malen. Sicherheitsnetz: nie dort, wo das Netz Druck sieht; ist fast alles «Handschrift»
// (z. B. handgeschriebenes Blatt), wird nichts gelöscht.
// boxes: Handschrift-Bereiche der KI (0–1000) – dort wird jede Tinte gelöscht, die das Netz nicht als Druck erkennt.
export function eraseHandwriting(ctx, w, h, seg, { hand = 0.5, print = 0.3, maxShare = 0.6, boxes = [] } = {}) {
  const { W, print: P, hand: Hh, k } = seg;
  const inBox = new Uint8Array(Hh.length);
  for (const b of boxes || []) {
    const x0 = Math.max(0, Math.floor(b.xmin / 1000 * seg.w)), x1 = Math.min(seg.w, Math.ceil(b.xmax / 1000 * seg.w)), y0 = Math.max(0, Math.floor(b.ymin / 1000 * seg.h)), y1 = Math.min(seg.h, Math.ceil(b.ymax / 1000 * seg.h));
    if ((x1 - x0) * (y1 - y0) > seg.w * seg.h * 0.5) continue;   // unplausibel grosser Bereich → ignorieren
    for (let y = y0; y < y1; y++) inBox.fill(1, y * W + x0, y * W + x1);
  }
  const netHand = i => Hh[i] > hand && P[i] < print, boxHand = i => inBox[i] && seg.ink?.[i] && P[i] < print;
  // Bremse «fast alles Handschrift → nichts löschen» gilt nur für das Netz allein; von der KI markierte Bereiche werden trotzdem bereinigt
  let nh = 0, np = 0, nb = 0;
  for (let i = 0; i < Hh.length; i++) { if (netHand(i)) nh++; else if (P[i] > 0.5) np++; if (boxHand(i)) nb++; }
  const share = nh / Math.max(1, nh + np), netOk = share <= maxShare;
  const isHand = i => (netOk && netHand(i)) || boxHand(i);
  if (!(netOk && nh) && !nb) return { removed: 0, share, skipped: !netOk };
  const mask = new Uint8Array(Hh.length);
  for (let i = 0; i < Hh.length; i++) if (isHand(i)) mask[i] = 1;
  keepSmallNearPrint(mask, P, W, Hh.length / W);
  // Maske leicht ausweiten (Kanten der Striche), aber nie über Druck
  const grown = mask.slice();
  for (let i = W; i < mask.length - W; i++) if (!mask[i] && P[i] < 0.2 && (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W])) grown[i] = 1;
  const im = ctx.getImageData(0, 0, w, h), d = im.data; let removed = 0;
  for (let y = 0; y < h; y++) {
    const my = Math.min(seg.h - 1, Math.round(y * k)) * W;
    for (let x = 0; x < w; x++) {
      if (!grown[my + Math.min(seg.w - 1, Math.round(x * k))]) continue;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; removed++;
    }
  }
  ctx.putImageData(im, 0, 0);
  return { removed, share, skipped: false };
}

// Zweite Sicherung: kleine «Handschrift»-Flecken direkt an gedrucktem Text (Hochzahlen, Indizes, Kommas) bleiben stehen
export function keepSmallNearPrint(mask, P, W, H, { maxArea = 260, r = 4, near = 0.45 } = {}) {
  const pr = new Uint32Array((W + 1) * (H + 1));   // Integralbild der Druck-Pixel
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += P[y * W + x] > 0.5 ? 1 : 0; pr[(y + 1) * (W + 1) + x + 1] = pr[y * (W + 1) + x + 1] + row; } }
  const box = (x, y) => { const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1); return pr[y1 * (W + 1) + x1] - pr[y0 * (W + 1) + x1] - pr[y1 * (W + 1) + x0] + pr[y0 * (W + 1) + x0]; };
  const seen = new Uint8Array(mask.length), st = [], comp = [];
  let kept = 0;
  for (let s0 = 0; s0 < mask.length; s0++) {
    if (!mask[s0] || seen[s0]) continue;
    comp.length = 0; st.push(s0); seen[s0] = 1;
    while (st.length) {
      const p = st.pop(); comp.push(p); const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (q >= 0 && q < mask.length && mask[q] && !seen[q]) { seen[q] = 1; st.push(q); }
    }
    if (comp.length > maxArea) continue;
    let n = 0; for (const p of comp) if (box(p % W, (p / W) | 0) > 0) n++;
    if (n / comp.length > near) { for (const p of comp) mask[p] = 0; kept++; }
  }
  return kept;
}

// Ganze Seite: Bild-URL → Bild-URL ohne Handschrift (oder null, wenn Netz fehlt / nichts zu tun)
export async function removeHandwritingUrl(dataUrl, boxes = [], answers = []) {
  const img = await loadImg(dataUrl), c = canvas(img.naturalWidth, img.naturalHeight), x = ctx2d(c);
  x.drawImage(img, 0, 0);
  let st = { removed: 0, share: 0, skipped: false };
  try { const seg = await segmentHandwriting(c); st = eraseHandwriting(x, c.width, c.height, seg, { boxes }); } catch (e) { if (!answers?.length) throw e; }
  const emptied = clearAnswerFields(x, c.width, c.height, answers);
  return st.removed || emptied ? { url: c.toDataURL('image/jpeg', 0.9), ...st, emptied } : { url: null, ...st, emptied };
}

// Getippte Antworten (Online-Übungen): Antwortfelder der KI (0–1000) leeren – Feldhintergrund (z. B. hellblau) und Rahmen bleiben
export function clearAnswerFields(ctx, w, h, answers = []) {
  let n = 0;
  for (const b of answers || []) {
    const x0 = Math.max(0, Math.floor(b.xmin / 1000 * w)), x1 = Math.min(w, Math.ceil(b.xmax / 1000 * w)), y0 = Math.max(0, Math.floor(b.ymin / 1000 * h)), y1 = Math.min(h, Math.ceil(b.ymax / 1000 * h));
    const bw = x1 - x0, bh = y1 - y0; if (bw < 4 || bh < 4 || bw * bh > w * h * 0.25) continue;   // unplausibel → nichts tun
    const im = ctx.getImageData(x0, y0, bw, bh), d = im.data, lum = i => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    // Hintergrund = hellster häufiger Farbton im Feld (Median der helleren Hälfte)
    const px = []; for (let i = 0; i < d.length; i += 16) px.push(i);
    px.sort((p, q) => lum(q) - lum(p)); const bg = px.slice(0, Math.max(1, px.length >> 1)), mid = bg[bg.length >> 1];
    const br = d[mid], bgc = d[mid + 1], bb = d[mid + 2], L0 = lum(mid), m = 2;   // Rand von 2 px schonen (Rahmen)
    for (let y = m; y < bh - m; y++) for (let xx = m; xx < bw - m; xx++) {
      const i = (y * bw + xx) * 4; if (L0 - lum(i) < 35) continue;
      d[i] = br; d[i + 1] = bgc; d[i + 2] = bb; n++;
    }
    ctx.putImageData(im, x0, y0);
  }
  return n;
}
