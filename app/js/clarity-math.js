// Brained Clarity – kleine Formel-Auswertung (ohne eval): prüft Rechenaufgaben der KI und baut Demo-Rechenaufgaben.
// $v = \frac{s}{t}$ mit {s: 150, t: 30} → 5. Unterstützt + − · / ^ Klammern, \frac, \sqrt, griechische Buchstaben, Indizes.
const GREEK = { rho: 'rho', Delta: 'Delta', theta: 'theta', mu: 'mu', lambda: 'lambda', alpha: 'alpha', beta: 'beta', omega: 'omega', pi: 'pi', eta: 'eta', sigma: 'sigma', tau: 'tau', varepsilon: 'eps', epsilon: 'eps' };
const UGREEK = { ρ: 'rho', Δ: 'Delta', θ: 'theta', μ: 'mu', λ: 'lambda', α: 'alpha', β: 'beta', ω: 'omega', η: 'eta', σ: 'sigma', τ: 'tau', ε: 'eps' };
export const symKey = s => String(s ?? '').replace(/\$/g, '').replace(/\\(\w+)/g, (_, g) => GREEK[g] || g).replace(/[ρΔθμλαβωησταε]/g, c => UGREEK[c]).replace(/[{}\s_]/g, '').toLowerCase();

// Symbole einer Formel (rechte Seite), z. B. $v = \frac{s}{t}$ → ['s','t']; links: 'v'
export function formulaParts(formula) {
  const f = String(formula || '').replace(/\$/g, ''), eq = f.indexOf('=');
  const side = eq >= 0 ? f.slice(eq + 1) : f, lhs = eq >= 0 ? symKey(f.slice(0, eq)) : '';
  const ids = (prepare(side).match(/[A-Za-zÄÖÜäöüα-ωΑ-Ω]+/g) || []).filter(t => t !== 'sqrt' && t !== 'pi').map(symKey);
  return { lhs, vars: [...new Set(ids)] };
}
function prepare(src) {
  let f = String(src || '').replace(/\$/g, '').replace(/\\left|\\right|\\,|\\;|\\!/g, '').replace(/\\cdot|\\times|·|×|⋅/g, '*').replace(/\\div|÷/g, '/').replace(/−/g, '-');
  for (let i = 0; i < 6; i++) f = f.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\^\{([^{}]*)\}/g, '^($1)');
  return f.replace(/\\(\w+)/g, (_, g) => GREEK[g] || g).replace(/[ρΔθμλαβωησταε]/g, c => UGREEK[c]).replace(/(\w)_\{([^{}]*)\}/g, '$1$2').replace(/(\w)_(\w)/g, '$1$2').replace(/[{}]/g, '');
}
export function evalFormula(formula, vars) {
  let f = String(formula || ''); const eq = f.indexOf('='); if (eq >= 0) f = f.slice(eq + 1);
  const tk = prepare(f).match(/\d+(?:[.,]\d+)?|[A-Za-zÄÖÜäöü]+|[-+*/^()]/g) || []; let i = 0;
  const num = () => {
    const t = tk[i++]; if (t === undefined) throw 0;
    if (t === '(') { const v = add(); if (tk[i++] !== ')') throw 0; return v; }
    if (t === '-') return -pow(); if (t === '+') return pow();
    if (/^\d/.test(t)) return parseFloat(t.replace(',', '.'));
    if (/^[A-Za-zÄÖÜäöü]+$/.test(t)) {
      if (t === 'sqrt' && tk[i] === '(') { i++; const v = add(); if (tk[i++] !== ')') throw 0; return Math.sqrt(v); }
      if (t === 'pi') return Math.PI;
      const k = symKey(t); if (!(k in vars)) throw 0; return vars[k];
    }
    throw 0;
  };
  const pow = () => { const b = num(); if (tk[i] === '^') { i++; return Math.pow(b, pow()); } return b; };
  const mul = () => { let v = pow(); for (; ;) { const t = tk[i]; if (t === '*') { i++; v *= pow(); } else if (t === '/') { i++; v /= pow(); } else if (t && (t === '(' || /^[A-Za-z\d]/.test(t))) v *= pow(); else return v; } };
  const add = () => { let v = mul(); for (; ;) { const t = tk[i]; if (t === '+') { i++; v += mul(); } else if (t === '-') { i++; v -= mul(); } else return v; } };
  try { const v = add(); return i === tk.length && Number.isFinite(v) ? v : NaN; } catch { return NaN; }
}
// Zahl auf n gültige Stellen runden (4,35·10³ → 4350)
export const sig = (x, n = 4) => x === 0 || !Number.isFinite(x) ? x : Number(Number(x).toPrecision(n));
