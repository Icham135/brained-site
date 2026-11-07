// Animierte Legendär-Skins: SMIL-Animationen (nur Transform/Opacity), im Gehirn-Umriss zugeschnitten.
// animSkin(kind, u) → { defs, fill, under, over }: under liegt über der Füllung und unter den Furchen, over ganz oben.
// Kleine Avatare (Listen) und «reduzierte Bewegung» bleiben ruhig (ui.js entscheidet).
const star = (x, y, s, d, c = '#fff') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="b-star" style="animation-delay:${d}s" d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3z" fill="${c}"/></g>`;
const twinkle = (x, y, r, d, dur = 2.4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".3"><animate attributeName="opacity" values=".15;1;.15" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/></circle>`;
const drift = (v, dur, extra = '') => `<animateTransform attributeName="transform" type="translate" values="${v}" dur="${dur}s" repeatCount="indefinite" ${extra}/>`;
const radial = (id, c, o = 1) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const sheen = (u, c = '#fff', dur = 3.4) => `<rect x="-50" y="-10" width="26" height="130" fill="url(#${u}s)" transform="rotate(22 60 60)"><animate attributeName="x" values="-50;-50;150;150" keyTimes="0;.1;.55;1" dur="${dur}s" repeatCount="indefinite"/></rect>`;
const sheenDef = (u, o = .85) => `<linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${o}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

export const ANIM = {
  // Flüssiges Gold: Glanzband fährt über das Gehirn, Funkeln
  gold: u => ({
    defs: `<linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".45" stop-color="#FFC93C"/><stop offset="1" stop-color="#E09A00"><animate attributeName="stop-color" values="#E09A00;#FFB300;#E09A00" dur="3s" repeatCount="indefinite"/></stop></linearGradient>${sheenDef(u)}`,
    fill: `url(#${u}f)`, under: '',
    over: `${sheen(u)}${star(34, 40, .9, 0)}${star(86, 58, .7, .8)}${star(58, 84, .6, 1.5)}`,
  }),
  // Galaxie: wandernde Nebel, funkelnde Sterne, Sternschnuppe
  galaxy: u => ({
    defs: `<radialGradient id="${u}f" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#4B2A9A"/><stop offset=".6" stop-color="#1B1242"/><stop offset="1" stop-color="#0B0724"/></radialGradient>${radial(u + 'a', '#B24BFF', .75)}${radial(u + 'b', '#FF4FA8', .6)}${radial(u + 'c', '#3DD6FF', .55)}`,
    fill: `url(#${u}f)`,
    under: `<g><circle cx="42" cy="50" r="30" fill="url(#${u}a)"/>${drift('0 0;10 -6;-6 6;0 0', 9)}</g><g><circle cx="82" cy="70" r="28" fill="url(#${u}b)"/>${drift('0 0;-12 4;6 -8;0 0', 11)}</g><g><circle cx="64" cy="40" r="22" fill="url(#${u}c)"/>${drift('0 0;6 8;-10 0;0 0', 13)}</g>`,
    over: `${twinkle(30, 46, 1.2, 0)}${twinkle(52, 28, 1, .6)}${twinkle(76, 38, 1.4, 1.1)}${twinkle(92, 62, 1.1, .3)}${twinkle(40, 84, 1.2, 1.7)}${twinkle(68, 80, 1, .9)}${twinkle(22, 66, .9, 1.4)}${twinkle(100, 84, 1, 2)}
      <line x1="0" y1="0" x2="-16" y2="-5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="-10 18;-10 18;135 62;135 62" keyTimes="0;.7;.9;1" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.7;.76;.9;1" dur="5s" repeatCount="indefinite"/></line>`,
  }),
  // Regenbogen: Farbfluss ohne Naht, Glanz
  rainbow: u => ({
    defs: `<linearGradient id="${u}f" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="30" spreadMethod="repeat"><stop offset="0" stop-color="#FF6B9D"/><stop offset=".17" stop-color="#FFB86B"/><stop offset=".33" stop-color="#FFE66B"/><stop offset=".5" stop-color="#7DFFA8"/><stop offset=".67" stop-color="#6BC8FF"/><stop offset=".83" stop-color="#A98BFF"/><stop offset="1" stop-color="#FF6B9D"/><animateTransform attributeName="gradientTransform" type="translate" values="0 0;120 0" dur="3.6s" repeatCount="indefinite"/></linearGradient>${sheenDef(u, .6)}`,
    fill: `url(#${u}f)`, under: '',
    over: `${sheen(u, '#fff', 4.2)}${star(36, 42, .8, .2)}${star(84, 64, .8, 1)}`,
  }),
  // Geist: pulsierendes Innenleuchten, aufsteigende Schleier
  ghost: u => ({
    defs: `<radialGradient id="${u}f" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#E4ECFF"/><stop offset="1" stop-color="#B5C4FF"/></radialGradient>${radial(u + 'g', '#fff', 1)}${radial(u + 'h', '#9BB5FF', .5)}`,
    fill: `url(#${u}f)`,
    under: `<circle cx="60" cy="60" r="40" fill="url(#${u}g)"><animate attributeName="opacity" values=".25;.9;.25" dur="3s" repeatCount="indefinite"/></circle><circle cx="60" cy="86" r="26" fill="url(#${u}h)"><animate attributeName="opacity" values=".8;.2;.8" dur="3.6s" repeatCount="indefinite"/></circle>`,
    over: [0, 1.3, 2.6].map((d, i) => `<g opacity="0"><path d="M${34 + i * 24} 104 q9 -10 0 -20 t0 -20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/><animateTransform attributeName="transform" type="translate" values="0 8;0 -34" dur="4s" begin="-${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.9;0" dur="4s" begin="-${d}s" repeatCount="indefinite"/></g>`).join(''),
  }),
  // Hologramm: Scanlines laufen, Störband, RGB-Zittern
  hologram: u => ({
    defs: `<linearGradient id="${u}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FF7FF"/><stop offset=".5" stop-color="#C9A8FF"/><stop offset="1" stop-color="#FF8CF0"/><animateTransform attributeName="gradientTransform" type="rotate" values="0 .5 .5;360 .5 .5" dur="6s" repeatCount="indefinite"/></linearGradient><pattern id="${u}p" width="120" height="4" patternUnits="userSpaceOnUse"><rect width="120" height="1.3" fill="#fff" opacity=".4"/></pattern>`,
    fill: `url(#${u}f)`, under: '',
    over: `<rect x="0" y="-8" width="120" height="120" fill="url(#${u}p)"><animateTransform attributeName="transform" type="translate" values="0 0;0 4" dur=".5s" repeatCount="indefinite"/></rect>
      <rect x="0" y="-10" width="120" height="8" fill="#fff" opacity=".4"><animate attributeName="y" values="-12;110" dur="2.6s" repeatCount="indefinite"/></rect>
      <g fill="none" stroke-width="2.4" stroke-linecap="round" opacity=".7"><path d="M60 22 C55 32 65 40 60 50" stroke="#00F0FF"><animateTransform attributeName="transform" type="translate" values="-1.2 0;1.2 0;-1.2 0" dur=".3s" repeatCount="indefinite"/></path><path d="M60 22 C55 32 65 40 60 50" stroke="#FF2BD6"><animateTransform attributeName="transform" type="translate" values="1.2 0;-1.2 0;1.2 0" dur=".3s" repeatCount="indefinite"/></path></g>
      <g><rect x="0" y="40" width="120" height="6" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0;.55;0;0" keyTimes="0;.85;.88;.92;1" dur="3.2s" repeatCount="indefinite"/></rect><animateTransform attributeName="transform" type="translate" values="0 0;0 0;5 0;-4 0;0 0" keyTimes="0;.85;.88;.92;1" dur="3.2s" repeatCount="indefinite"/></g>`,
  }),
  // Plasma: Blitze laufen durchs Gehirn
  plasma: u => ({
    defs: `<radialGradient id="${u}f" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#4B2BC9"/><stop offset=".7" stop-color="#1D0F5E"/><stop offset="1" stop-color="#0E0630"/></radialGradient>${radial(u + 'a', '#00E5FF', .6)}${radial(u + 'b', '#FF3DE0', .55)}`,
    fill: `url(#${u}f)`,
    under: `<g><circle cx="44" cy="60" r="30" fill="url(#${u}a)"/>${drift('0 0;8 6;-6 -4;0 0', 6)}</g><g><circle cx="80" cy="56" r="28" fill="url(#${u}b)"/>${drift('0 0;-8 -6;6 4;0 0', 7)}</g>`,
    over: ['M22 58 L36 50 L34 62 L50 54 L46 70 L62 60', 'M100 52 L86 60 L90 48 L74 56 L78 72 L62 62', 'M60 26 L53 40 L65 42 L56 58'].map((d, i) => `<path d="${d}" fill="none" stroke="#E6FDFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 9"><animate attributeName="stroke-dashoffset" values="0;-32" dur="${0.7 + i * .15}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".95;.25;1;.45;.95" dur="${1.1 + i * .2}s" repeatCount="indefinite"/></path>`).join('')
      + `<circle cx="60" cy="60" r="3.2" fill="#fff"><animate attributeName="r" values="2;5;2" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;.4;.9" dur="1.2s" repeatCount="indefinite"/></circle>`,
  }),
  // Magma: glühende Risse, aufsteigende Funken
  magma: u => ({
    defs: `<radialGradient id="${u}f" cx=".5" cy=".7" r=".8"><stop offset="0" stop-color="#5A1D0C"/><stop offset=".7" stop-color="#2B0E07"/><stop offset="1" stop-color="#150603"/></radialGradient>${radial(u + 'a', '#FF7A1A', .9)}`,
    fill: `url(#${u}f)`,
    under: `<circle cx="60" cy="92" r="46" fill="url(#${u}a)"><animate attributeName="opacity" values=".45;1;.45" dur="2.4s" repeatCount="indefinite"/></circle>`,
    over: ['M30 52 L42 62 L38 74 L52 84', 'M92 50 L80 60 L86 72 L70 82', 'M60 28 L56 44 L65 54 L58 70', 'M38 38 L50 46'].map((d, i) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="#FF7A1A" stroke-width="5" opacity=".35"><animate attributeName="opacity" values=".15;.5;.15" dur="${2 + i * .4}s" repeatCount="indefinite"/></path><path d="${d}" stroke="#FFD27A" stroke-width="2"><animate attributeName="opacity" values=".6;1;.6" dur="${2 + i * .4}s" repeatCount="indefinite"/></path></g>`).join('')
      + [[34, 96, 0], [60, 98, 1.1], [86, 96, 2], [48, 98, .6]].map(([x, y, d]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#FFB347" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;${(x % 3 - 1) * 5} -46" dur="3s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="3s" begin="${d}s" repeatCount="indefinite"/></circle>`).join(''),
  }),
  // Aurora: Nordlicht-Bänder wehen über das Gehirn
  aurora: u => ({
    defs: `<linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10275C"/><stop offset="1" stop-color="#0B4A66"/></linearGradient><linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5CFFB2"/><stop offset="1" stop-color="#7B6CFF"/></linearGradient><linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF7BE0"/><stop offset="1" stop-color="#3DD6FF"/></linearGradient>`,
    fill: `url(#${u}f)`,
    under: `<g opacity=".95"><path d="M-14 50 Q30 18 60 50 T134 48" stroke="url(#${u}a)" stroke-width="15" fill="none" stroke-linecap="round"/>${drift('-16 0;16 0;-16 0', 7)}<animate attributeName="opacity" values=".7;1;.7" dur="4s" repeatCount="indefinite"/></g><g opacity=".85"><path d="M-14 74 Q34 52 64 76 T134 70" stroke="url(#${u}b)" stroke-width="12" fill="none" stroke-linecap="round"/>${drift('14 0;-14 0;14 0', 9)}<animate attributeName="opacity" values=".8;.35;.8" dur="5s" repeatCount="indefinite"/></g><g opacity=".8"><path d="M-14 34 Q40 8 70 36 T134 30" stroke="url(#${u}a)" stroke-width="10" fill="none" stroke-linecap="round"/>${drift('10 0;-18 0;10 0', 11)}</g>`,
    over: `${twinkle(32, 40, 1, 0)}${twinkle(88, 36, 1.2, .8)}${twinkle(60, 90, 1, 1.4)}${twinkle(100, 74, .9, .4)}${twinkle(24, 74, .9, 1.9)}`,
  }),
};
