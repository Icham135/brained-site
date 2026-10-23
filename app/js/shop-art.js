// SVG-Zeichnungen der neuen Shop-Accessoires fürs Brain (Koordinaten wie in brainSVG: viewBox 0 -8 120 120, Augen bei 51/69 × 66, Mund bei 60 × 75).
// ART(O) liefert Hüte, Brillen, Münder, Extras und Emote-Augen/-Münder; O = Umrissfarbe des Gehirns.
const star = (cx, cy, r, fill, extra = '') => {
  let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`; }
  return `<path d="${d}z" fill="${fill}" ${extra}/>`;
};
const mirror = g => `<g>${g}</g><g transform="translate(120 0) scale(-1 1)">${g}</g>`;

export function ART(O) {
  const sw = (w = 2.5) => `stroke="${O}" stroke-width="${w}" stroke-linejoin="round"`;
  const flowers = (() => {
    const cols = ['#FF7FA6', '#FFD23F', '#fff', '#B58CFF', '#FF9A5C', '#FFD23F', '#FF7FA6'], xs = [24, 36, 48, 60, 72, 84, 96], ys = [44, 30, 22, 19, 22, 30, 44];
    return `<path d="M18 48 Q60 4 102 48" fill="none" stroke="#3FA45B" stroke-width="3.5" stroke-linecap="round"/>` + xs.map((x, i) =>
      `<g class="${i % 2 ? 'b-star' : ''}" style="transform-origin:${x}px ${ys[i]}px"><circle cx="${x - 4}" cy="${ys[i]}" r="4.5" fill="${cols[i]}" ${sw(1.4)}/><circle cx="${x + 4}" cy="${ys[i]}" r="4.5" fill="${cols[i]}" ${sw(1.4)}/><circle cx="${x}" cy="${ys[i] - 4.5}" r="4.5" fill="${cols[i]}" ${sw(1.4)}/><circle cx="${x}" cy="${ys[i] + 4}" r="4.5" fill="${cols[i]}" ${sw(1.4)}/><circle cx="${x}" cy="${ys[i]}" r="3" fill="#FFB020" ${sw(1)}/></g>`).join('');
  })();
  const pearls = Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = 36 + t * 48, y = 90 + Math.sin(t * Math.PI) * 14; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#FFF8F0" stroke="#C9B8A8" stroke-width="1.2"/><circle cx="${(x - 1.2).toFixed(1)}" cy="${(y - 1.4).toFixed(1)}" r="1.1" fill="#fff"/>`; }).join('');
  const feathers = `<path d="M26 74 C2 70 -2 40 8 24 C12 38 22 44 30 52z" fill="#fff" ${sw(2)}/><path d="M26 84 C8 88 -2 70 4 58 C10 68 20 72 30 70z" fill="#F1F5FF" ${sw(2)}/><path d="M16 36 q6 8 12 14M10 58 q8 4 14 8" fill="none" stroke="#CBD6F2" stroke-width="1.6" stroke-linecap="round"/>`;
  return {
    hat: {
      beanie: `<path d="M30 38 Q32 8 60 8 Q88 8 90 38z" fill="#E5333B" ${sw()}/><rect x="28" y="34" width="64" height="10" rx="5" fill="#B5222A" ${sw(2.2)}/><path d="M38 35v8M48 35v8M58 35v8M68 35v8M78 35v8" stroke="${O}" stroke-width="1.4" opacity=".5"/><g class="b-wiggle" style="transform-origin:60px 8px"><circle cx="60" cy="5" r="7" fill="#fff" ${sw(2.2)}/></g>`,
      bunny: `<g class="b-wiggle" style="transform-origin:46px 30px"><ellipse cx="46" cy="14" rx="8" ry="19" fill="#fff" ${sw()}/><ellipse cx="46" cy="16" rx="3.8" ry="12" fill="#FFB6CB"/></g><g style="transform-origin:76px 30px;transform:rotate(14deg)"><ellipse cx="76" cy="14" rx="8" ry="19" fill="#fff" ${sw()}/><ellipse cx="76" cy="16" rx="3.8" ry="12" fill="#FFB6CB"/></g>`,
      cat: `<path d="M30 40 L34 8 L56 28z" fill="#6B6577" ${sw()}/><path d="M36 32 L38 16 L49 28z" fill="#FFB6CB"/><path d="M90 40 L86 8 L64 28z" fill="#6B6577" ${sw()}/><path d="M84 32 L82 16 L71 28z" fill="#FFB6CB"/>`,
      chef: `<circle cx="42" cy="20" r="11" fill="#fff" ${sw(2.2)}/><circle cx="78" cy="20" r="11" fill="#fff" ${sw(2.2)}/><circle cx="60" cy="12" r="14" fill="#fff" ${sw(2.2)}/><rect x="37" y="24" width="46" height="14" rx="3" fill="#fff" ${sw(2.2)}/><path d="M46 26v10M60 26v10M74 26v10" stroke="#D8D4E4" stroke-width="1.6"/>`,
      cowboy: `<path d="M42 32 Q42 6 60 8 Q78 6 78 32z" fill="#B4763F" ${sw()}/><path d="M42 28 h36" stroke="#5B3A1E" stroke-width="5"/><path d="M14 38 Q10 26 30 30 Q60 38 90 30 Q110 26 106 38 Q60 46 14 38z" fill="#A86B3C" ${sw()}/><circle cx="60" cy="27" r="2.6" fill="#FFC93C"/>`,
      flowers,
      horns: mirror(`<path d="M32 36 Q20 14 30 -2 Q42 10 48 32z" fill="#E5333B" ${sw()}/><path d="M33 24 Q31 12 33 6" fill="none" stroke="#FF8A8A" stroke-width="2" stroke-linecap="round"/>`),
      viking: `<path d="M30 40 Q32 4 60 4 Q88 4 90 40z" fill="#B8C0CC" ${sw()}/><path d="M42 12 q4 -4 10 -5" fill="none" stroke="#E8EDF5" stroke-width="3" stroke-linecap="round"/><rect x="28" y="34" width="64" height="9" rx="3" fill="#7A5230" ${sw(2.2)}/><circle cx="60" cy="38.5" r="2.4" fill="#FFC93C"/>` + mirror(`<path d="M30 30 Q6 30 6 4 Q20 14 36 22z" fill="#FFF3D6" ${sw()}/>`),
      unicorn: `<path d="M44 34 L38 10 L52 26z M76 34 L82 10 L68 26z" fill="#FFB6E1" ${sw(2)}/><path d="M60 -5 L51 30 L69 30z" fill="#FFE27A" ${sw()}/><path d="M56 14 l10 -3M54 22 l14 -3M58 6 l6 -2" stroke="#E8A317" stroke-width="2" stroke-linecap="round"/><g class="b-star" style="transform-origin:60px -2px">${star(60, -2, 4.5, '#fff', 'stroke="#FFC93C" stroke-width=".8"')}</g>`,
    },
    eyes: {
      g3d: `<rect x="39" y="59" width="19" height="13" rx="3.5" fill="#FF3B4E" fill-opacity=".72" ${sw(2.4)}/><rect x="62" y="59" width="19" height="13" rx="3.5" fill="#22C8FF" fill-opacity=".72" ${sw(2.4)}/><path d="M58 64 h4M39 62 l-9 -3M81 62 l9 -3" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/><path class="b-glint" d="M43 71 l4 -9 h3 l-4 9z" fill="#fff" opacity=".7"/>`,
      patch: `<path d="M16 50 Q60 40 104 52" fill="none" stroke="#1A1424" stroke-width="3"/><ellipse cx="69" cy="66" rx="10" ry="9" fill="#1A1424" ${sw(1.5)}/><path d="M64 62 q5 -2 10 0" stroke="#4A4560" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      starglass: `<g class="b-pulse" style="transform-origin:60px 66px">${star(50, 66, 11, '#FF6FA8', `fill-opacity=".9" ${sw(2)}`)}${star(70, 66, 11, '#FF6FA8', `fill-opacity=".9" ${sw(2)}`)}</g><path d="M58 65 h4" stroke="${O}" stroke-width="2"/><circle class="b-star" cx="46" cy="61" r="1.8" fill="#fff"/>`,
      vr: `<path d="M26 66 h-10M94 66 h10" stroke="#2A2640" stroke-width="5" stroke-linecap="round"/><rect x="30" y="56" width="60" height="20" rx="8" fill="#2A2640" ${sw(2.4)}/><rect x="34" y="59" width="52" height="14" rx="5" fill="#00E5FF" fill-opacity=".38"/><circle cx="48" cy="66" r="3.4" fill="#fff"/><circle cx="72" cy="66" r="3.4" fill="#fff"/><path class="b-glint" d="M36 73 l6 -13 h4 l-6 13z" fill="#fff" opacity=".75"/><circle class="b-led" cx="60" cy="58.5" r="1.6" fill="#00E0FF"/>`,
      laser: `<circle cx="51" cy="66" r="5" fill="#FF2A2A" ${sw(1.4)}/><circle cx="69" cy="66" r="5" fill="#FF2A2A" ${sw(1.4)}/><circle cx="51" cy="66" r="2" fill="#fff"/><circle cx="69" cy="66" r="2" fill="#fff"/><g class="b-led-line" stroke="#FF2A2A" stroke-linecap="round"><path d="M46 68 L-8 92 M74 68 L128 92" stroke-width="4" opacity=".35"/><path d="M46 68 L-8 92 M74 68 L128 92" stroke-width="1.6" stroke="#FFD0D0"/></g>`,
    },
    mouth: {
      tongue: `<path d="M54 75 q6 6 12 0" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><g class="b-wiggle" style="transform-origin:61px 78px"><path d="M56 77 q0 11 5 11 q5 0 5 -11z" fill="#FF6B8A" ${sw(1.6)}/><path d="M61 79 v6" stroke="#D43B66" stroke-width="1.2" stroke-linecap="round"/></g>`,
      lipstick: `<path d="M52 75 q4 -4 8 -1 q4 -3 8 1 q-4 9 -8 9 q-4 0 -8 -9z" fill="#E5334B" ${sw(1.6)}/><path d="M53 75 q7 3 14 0" fill="none" stroke="#9E1830" stroke-width="1.2"/><path d="M57 74 q2 -1.5 3 -.5" stroke="#FFB0BD" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
      fangs: `<path d="M52 75 q8 6 16 0" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/><path d="M54.5 77.5 l2.2 8 l2.4 -6.6z M65.5 77.5 l-2.2 8 l-2.4 -6.6z" fill="#fff" ${sw(1.2)}/>`,
      beard: `<path d="M36 70 q-6 26 24 32 q30 -6 24 -32 q-4 12 -24 12 q-20 0 -24 -12z" fill="#7A5230" ${sw(2.2)}/><path d="M46 88 q4 4 8 0M66 88 q4 4 8 0" stroke="#5B3A1E" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M54 76 q6 5 12 0" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`,
    },
    extra: {
      scarf: `<path d="M32 92 Q60 108 88 92 l2 10 Q60 118 30 102z" fill="#E5333B" ${sw(2.2)}/><g class="b-wiggle" style="transform-origin:78px 100px"><rect x="74" y="98" width="11" height="18" rx="3.5" fill="#E5333B" ${sw(2.2)}/><path d="M74 104h11M74 110h11" stroke="#fff" stroke-width="2.2"/></g><path d="M40 98 l-1 4M50 102 l-1 4M60 103 l-1 4M70 102 l-1 4" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`,
      medal: `<path d="M48 88 l12 18 l12 -18" fill="none" stroke="#2B6CFF" stroke-width="5.5" stroke-linejoin="round"/><path d="M48 88 l12 18 l12 -18" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="60" cy="106" r="7.5" fill="#FFC93C" ${sw(1.8)}/><path d="M60 100 l1.8 3.8 l4.2 .5 l-3.1 2.9 l.8 4.1 l-3.7 -2 l-3.7 2 l.8 -4.1 l-3.1 -2.9 l4.2 -.5z" fill="#fff" opacity=".85"/><path class="b-star" d="M66 98 l.8 -2.2 l.8 2.2 l2.2 .8 l-2.2 .8 l-.8 2.2 l-.8 -2.2 l-2.2 -.8z" fill="#fff"/>`,
      pearls,
      cape: `<path d="M28 88 Q60 110 92 88 L104 118 Q60 106 16 118z" fill="#E5333B" ${sw(2.4)}/><path d="M40 100 l-10 14M80 100 l10 14" stroke="#B5222A" stroke-width="2" stroke-linecap="round"/><circle cx="60" cy="98" r="5" fill="#FFC93C" ${sw(1.6)}/><path class="b-star" d="M60 94.5 l1.2 2.6 l2.8 .3 l-2.1 1.9 l.6 2.8 l-2.5 -1.4 l-2.5 1.4 l.6 -2.8 l-2.1 -1.9 l2.8 -.3z" fill="#fff"/>`,
      wings: `<g class="b-flap" style="transform-origin:28px 70px">${feathers}</g><g class="b-flap" style="transform-origin:92px 70px"><g transform="translate(120 0) scale(-1 1)">${feathers}</g></g>`,
    },
  };
}
