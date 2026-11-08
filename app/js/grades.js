// Notenskalen Schweiz / Deutschland / Österreich (Richtwerte – Schulen können abweichen).
// gradeFor(country, earned, max) → { grade, label, pass, text } · scaleRows(country, max) → [{ grade, label, text, minPoints }]
const r1 = v => Math.round(v * 10) / 10;
const half = v => Math.round(v * 2) / 2;
const CH_TEXT = g => g >= 6 ? 'ausgezeichnet' : g >= 5.5 ? 'sehr gut' : g >= 5 ? 'gut' : g >= 4.5 ? 'befriedigend' : g >= 4 ? 'genügend' : g >= 3.5 ? 'knapp ungenügend' : g >= 3 ? 'ungenügend' : g >= 2 ? 'schwach' : 'sehr schwach';

export const SCALES = {
  CH: { name: 'Schweiz', flag: '🇨🇭', best: 6, worst: 1, passText: 'genügend ab 4.0',
    grade: p => Math.max(1, Math.min(6, r1(1 + 5 * p))), pass: g => g >= 4 - 1e-9,
    steps: [6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1] },
  DE: { name: 'Deutschland', flag: '🇩🇪', best: 1, worst: 6, passText: 'bestanden bis Note 4',
    bands: [[0.92, 1, 'sehr gut'], [0.81, 2, 'gut'], [0.67, 3, 'befriedigend'], [0.5, 4, 'ausreichend'], [0.3, 5, 'mangelhaft'], [0, 6, 'ungenügend']], pass: g => g <= 4 },
  AT: { name: 'Österreich', flag: '🇦🇹', best: 1, worst: 5, passText: 'positiv bis Note 4',
    bands: [[0.89, 1, 'Sehr gut'], [0.76, 2, 'Gut'], [0.63, 3, 'Befriedigend'], [0.5, 4, 'Genügend'], [0, 5, 'Nicht genügend']], pass: g => g <= 4 },
};
const sc = c => SCALES[c] || SCALES.CH;
const pct = (earned, max) => max > 0 ? Math.max(0, Math.min(1, (Number(earned) || 0) / max)) : 0;
const band = (s, p) => s.bands.find(([min]) => p >= min - 1e-9) || s.bands.at(-1);

export function gradeFor(country, earned, max) {
  const s = sc(country), p = pct(earned, max);
  if (s.bands) { const [, g, text] = band(s, p); return { grade: g, label: String(g), pass: s.pass(g), text }; }
  const g = s.grade(p);
  return { grade: g, label: g.toFixed(1), half: half(g), pass: s.pass(g), text: CH_TEXT(s.pass(g) ? half(g) : Math.min(half(g), 3.5)) };   // unter 4.0 nie «genügend»
}

// Tabelle «ab wie vielen Punkten gibt es welche Note» (Punkte in halben Schritten)
export function scaleRows(country, max) {
  const s = sc(country), m = Math.min(1e6, Math.max(0, Number(max) || 0));
  const minHalf = need => Math.min(m, Math.ceil(need * m * 2 - 1e-9) / 2);
  if (s.bands) return s.bands.map(([min, g, text]) => ({ grade: g, label: String(g), text, minPoints: min ? minHalf(min) : 0 }));
  return s.steps.map(g => {   // kleinste halbe Punktzahl, deren gerundete Note ≥ g ist (direkt berechnet, wenige Korrekturschritte)
    if (g === 1 || !m) return { grade: g, label: g.toFixed(1), text: CH_TEXT(g), minPoints: 0 };
    let pts = Math.max(0, Math.floor(m * (g - 1.05) / 5 * 2) / 2 - 1);
    for (let k = 0; k < 12 && pts < m && s.grade(pts / m) < g - 1e-9; k++) pts += 0.5;
    while (pts < m && s.grade(pts / m) < g - 1e-9) pts = Math.min(m, pts + Math.max(0.5, m / 1000));   // nur bei riesigen Punktzahlen
    return { grade: g, label: g.toFixed(1), text: CH_TEXT(g), minPoints: Math.min(m, pts) };
  });
}
