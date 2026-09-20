import { formatHex, clampChroma } from 'culori';
import { validate } from '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz/scripts/validate_palette.js';
const mkc = (l, c, h) => clampChroma({ mode: 'oklch', l, c, h }, 'oklch');
const hex = (o) => formatHex(o);
function evalua(pal, mode, surface) {
  const r = validate(pal, { mode, surface });
  const cvdLine = r.report.find(x => x[0] === 'CVD separation');
  const m = /ΔE ([\d.]+)/.exec(cvdLine[2] || '');
  return { ok: r.ok && cvdLine[1] === 'pass', cvd: m ? parseFloat(m[1]) : 0 };
}
let best = null;
for (const azL of [0.58, 0.61, 0.64])
for (const ocL of [0.63, 0.66])
for (const teL of [0.58, 0.61, 0.64])
for (const puL of [0.56, 0.60, 0.64])
for (const trL of [0.58, 0.62, 0.66]) {
  const pal = [hex(mkc(azL,0.115,252)), hex(mkc(ocL,0.125,78)), hex(mkc(teL,0.105,176)), hex(mkc(puL,0.115,300)), hex(mkc(trL,0.135,35))];
  if (mkc(teL,0.105,176).c < 0.0995) continue;
  const r = evalua(pal, 'dark', '#12202E');
  if (r.ok && (!best || r.cvd > best.cvd)) best = { pal, r, params: {azL,ocL,teL,puL,trL} };
}
console.log(best ? `MEJOR DARK: ${best.pal.join(',')} cvd ${best.r.cvd} ${JSON.stringify(best.params)}` : 'sin candidato');
