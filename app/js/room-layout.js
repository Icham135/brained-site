// Lernraum-Layout: feste Weltkoordinaten (Bildpunkte des Bildes assets/room/room-leer-gehirn.webp, 1254 x 1254, Ursprung oben links).
// Alle Raum-Module (Szene, Laufen, Schilder, Kamera) bauen darauf auf: Werte hier nur ändern, nicht in den Modulen duplizieren.
// Y wächst nach unten (zum Betrachter). Je grösser y, desto weiter vorn: Z-Ordnung = Rang nach y.
export const IMG = 1254;

// Himmel-Ebene (assets/room/room-sky.webp, erzeugt mit tools/room-sky.py): ragt über das Bild hinaus. Weltkoordinate der linken oberen Ecke und Grösse.
export const SKY = { x: -600, y: -800, w: 2454, h: 2854 };

// Eingang: die Tür in der Frontwand (orange Lichtspalt). out = ausserhalb (Brainy erscheint hier, unsichtbar im Dunkeln), in = erster Bodenpunkt im Raum.
export const DOOR = { out: [465, 985], in: [467, 930], dir: 'N' };

// Begehbarer Boden (Polygon, Bildpunkte, im Uhrzeigersinn)
export const FLOOR = [[140, 600], [250, 510], [350, 462], [500, 420], [640, 385], [880, 500], [1010, 545], [1080, 610], [1130, 690], [985, 745], [885, 810], [860, 850], [780, 920], [700, 955], [580, 960], [470, 950], [400, 925], [300, 885], [235, 800], [200, 720], [160, 690]];

// Kopfmitte je Platz (hinter dem Laptop, Kopf über der Stuhllehne). Reihenfolge = Füllreihenfolge: private Räume nutzen die ersten 6.
const HEADS = [[580, 705], [663, 578], [488, 562], [783, 704], [466, 810], [361, 670], [701, 844], [908, 597], [756, 491], [561, 435], [391, 478], [269, 563]];

// Tiefenskalierung: wie gross ein Brainy relativ zur Grundgrösse bei Bildhöhe y wirkt (Isometrie: hinten kleiner, vorn grösser)
export const depthScale = y => +(0.88 + 0.24 * Math.min(1, Math.max(0, (y - 400) / 520))).toFixed(3);

// Sperrflächen je Platz relativ zur Kopfmitte: Stuhl und Pult als zwei Rechtecke [x0, y0, x1, y1]
const BLOCKS = [[-26, -34, 24, 6], [-38, -6, 84, 96]];
export const blocksOf = ([hx, hy]) => BLOCKS.map(([a, b, c, d]) => [hx + a, hy + b, hx + c, hy + d]);

// Plätze. head = Kopfmitte (gleich wie bisher), feet = Fusspunkt im Sitzen (Stuhlsitz), stand = Bodenpunkt links neben dem Stuhl, von dem aus man sich setzt/aufsteht,
// dir = Blickrichtung (S = zum Betrachter, hinter dem Laptop), z = Rang von hinten (0) nach vorn (11): gleicher Rang für Stuhl, Brainy und Pult, Schild liegt darüber.
const STAND_TRY = [[-62, 12], [-62, -14], [-62, 40], [-76, 12], [-34, -52], [-62, 62], [40, -52], [-90, 12], [38, 22], [-20, 40]];   // Kandidaten neben dem Stuhl: links, hinten, rechts; der erste freie und erreichbare gilt
export const SEATS = HEADS.map(([x, y], i) => ({
  id: i, x, y, head: [x, y], feet: [x - 4, y + 30], stand: [x - 62, y + 12], dir: 'S', scale: depthScale(y + 30), blocks: blocksOf([x, y]),
  z: HEADS.map(h => h[1]).sort((a, b) => a - b).indexOf(y),
}));
export const SEAT_XY = SEATS.map(s => [s.x, s.y]);   // Kurzform (Kompatibilität: alter Export SEATS in room-scene.js)

// ---------- Wegpunkte ----------
// Sichtbarkeitsgraph über einem Raster freier Bodenpunkte. PATH_POINTS = Knoten [x, y]; Kanten nur dort, wo die Strecke Pulte/Stühle (mit Abstand) nicht schneidet.
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const PAD = 0;
const inBlock = (p, pad = PAD) => SEATS.some(s => s.blocks.some(([x0, y0, x1, y1]) => p[0] > x0 - pad && p[0] < x1 + pad && p[1] > y0 - pad && p[1] < y1 + pad));
export const isFree = (p, pad = PAD) => inPoly(p, FLOOR) && !inBlock(p, pad);
const segFree = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6); for (let i = 1; i < n; i++) if (!isFree([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n], PAD - 1)) return false; return true; };
export const PATH_POINTS = [DOOR.in];
// Ecken der (leicht vergrösserten) Sperrflächen = Knoten des Sichtbarkeitsgraphen: kürzeste Wege laufen dicht an den Pulten vorbei
SEATS.forEach(({ blocks }) => blocks.forEach(([x0, y0, x1, y1]) => [[x0 - 4, y0 - 4], [x1 + 4, y0 - 4], [x0 - 4, y1 + 4], [x1 + 4, y1 + 4]].forEach(c => { if (isFree(c, PAD)) PATH_POINTS.push(c); })));
const NEIGH = PATH_POINTS.map(() => []);
PATH_POINTS.forEach((a, i) => PATH_POINTS.forEach((b, j) => { if (j > i && segFree(a, b)) { NEIGH[i].push(j); NEIGH[j].push(i); } }));

// kürzester Weg (Dijkstra) zwischen zwei Bodenpunkten; schliesst sich an den nächsten freien Knoten an. Rückgabe: Liste von [x, y].
const nearestNode = p => { let best = -1, bd = 1e9; PATH_POINTS.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd && (d < 1 || segFree(p, q))) { bd = d; best = i; } }); return best; };
function route(from, to) {
  const a = nearestNode(from), b = nearestNode(to); if (a < 0 || b < 0) return null;
  const dist = PATH_POINTS.map(() => 1e9), prev = PATH_POINTS.map(() => -1), done = PATH_POINTS.map(() => false); dist[a] = 0;
  for (;;) {
    let u = -1; dist.forEach((d, i) => { if (!done[i] && d < 1e9 && (u < 0 || d < dist[u])) u = i; });
    if (u < 0 || u === b) break; done[u] = true;
    NEIGH[u].forEach(v => { const d = dist[u] + Math.hypot(PATH_POINTS[u][0] - PATH_POINTS[v][0], PATH_POINTS[u][1] - PATH_POINTS[v][1]); if (d < dist[v]) { dist[v] = d; prev[v] = u; } });
  }
  if (dist[b] >= 1e9) return null;
  const pts = []; for (let i = b; i >= 0; i = prev[i]) pts.push(PATH_POINTS[i]); pts.reverse();
  const out = [from, ...pts, to];
  // Ecken glätten: Zwischenpunkte weglassen, wenn die direkte Strecke frei ist
  const res = [out[0]]; let i = 0;
  while (i < out.length - 1) { let j = out.length - 1; while (j > i + 1 && !segFree(out[i], out[j])) j--; res.push(out[j]); i = j; }
  return res;
}
export const findPath = (from, to) => route(from, to) || [from, to];
SEATS.forEach(q => { const c = STAND_TRY.map(([dx, dy]) => [q.x + dx, q.y + dy]).filter(p => isFree(p, 1)); q.stand = c.find(p => route(DOOR.in, p)) || c[0] || q.stand; });
// Weg Tür → Platz (letzter Punkt = Fusspunkt im Sitzen) und zurück Platz → Tür → hinaus
export const pathIn = id => { const s = SEATS[id]; return [DOOR.out, ...findPath(DOOR.in, s.stand), s.feet]; };
export const pathOut = id => { const s = SEATS[id]; return [s.feet, ...findPath(s.stand, DOOR.in), DOOR.out]; };
// Weg von Platz zu Platz (Wechsel)
export const pathBetween = (a, b) => [SEATS[a].feet, ...findPath(SEATS[a].stand, SEATS[b].stand), SEATS[b].feet];
