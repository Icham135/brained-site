// Lernraum-Szene: das Bild assets/room/room-leer-gehirn.webp (Bibliothek mit zwölf leeren Pulten, eingebettet in ein violettes Gehirn).
// Koordinaten = Bildpunkte (1254 x 1254). Brainys, Schilder und Effekte liegen als Vektor-Ebene darüber und werden im selben Container skaliert.
import { IMG, SKY, SEAT_XY } from './room-layout.js';
export { IMG, SKY };
export const EX = 0, EY = 0, WW = IMG, WH = IMG;   // Weltkoordinaten bleiben die Bildpunkte; der Himmel (SKY) ragt über 0..IMG hinaus (negative Werte)
export const SKY_IMG = 'assets/room/room-sky.webp';
export const ROOM_IMG = 'assets/room/room-leer-gehirn.webp';
// Raumfläche mit den zwölf Pulten (Startansicht): Mitte und Breite in Bildpunkten
export const ROOM_VIEW = { cx: 600, cy: 690, w: 880, h: 640 };   // h: Höhe der Raumfläche (Querformat: ganze Pult-Reihen sichtbar)
// Kopfmitte des Brainys je Platz (hinter dem Laptop, Kopf über der Stuhllehne). Füllreihenfolge: private Räume nutzen die ersten 6.
export const SEATS = SEAT_XY;   // Pare [x, y]; Details (Fusspunkt, Blickrichtung, Z-Ordnung, Wege) in js/room-layout.js
// Schreibtisch und Laptop verdecken den unteren Teil des Brainys: sichtbarer Bereich relativ zur Kopfmitte (Rückkante der Tischplatte, Laptop-Oberkante)
export const DESK_CLIP = [[-200, -200], [200, -200], [200, 3], [55, 3], [12, 11], [11, 26], [-200, 28]];
// Hintergrund: hoher Sternenhimmel (nahtlos über das Bild hinaus), darüber das Szenenbild mit weichen Rändern
const small = u => (Math.min(innerWidth || 390, innerHeight || 800) < 700 ? u.replace(/\.webp$/, '-s.webp') : u);   // Handys: halbe Auflösung (Speicher!)
export const sceneBack = () => `<img class="rm-sky" src="${small(SKY_IMG)}" alt="" draggable="false" style="left:${SKY.x}px;top:${SKY.y}px;width:${SKY.w}px;height:${SKY.h}px"><img class="rm-scene rm-back" src="${small(ROOM_IMG)}" alt="" draggable="false" width="${IMG}" height="${IMG}">`;
