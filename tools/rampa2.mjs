import { formatHex, clampChroma, oklch } from 'culori';
const mk = (l, c, h) => formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
// Secuencial análoga petróleo→marino (vecinos fríos, L monótona) — modo claro
const pasos = [
  [0.92, 0.030, 185], [0.84, 0.055, 195], [0.75, 0.075, 207],
  [0.65, 0.095, 219], [0.55, 0.110, 231], [0.45, 0.115, 243], [0.34, 0.105, 252],
];
const light = pasos.map(p => mk(...p));
// oscuro: ancla invertida (bajo se hunde), recorrido inverso de tono
const pasosD = [
  [0.30, 0.075, 252], [0.38, 0.095, 243], [0.46, 0.105, 231],
  [0.55, 0.105, 219], [0.64, 0.095, 207], [0.73, 0.075, 197], [0.82, 0.055, 188],
];
const dark = pasosD.map(p => mk(...p));
console.log('LIGHT', JSON.stringify(light));
console.log('DARK ', JSON.stringify(dark));
// verificación monotonía L
import { oklch as toOklch, parse } from 'culori';
const Ls = light.map(x => toOklch(parse(x)).l.toFixed(3));
console.log('L light (debe descender):', Ls.join(' > '));
