import { formatHex, clampChroma, oklch } from 'culori';
import { validate } from '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz/scripts/validate_palette.js';
const mkc = (l, c, h) => clampChroma({ mode: 'oklch', l, c, h }, 'oklch');
const hex = (o) => formatHex(o);
function evalua(pal, mode, surface) {
  const r = validate(pal, { mode, surface });
  const cvdLine = r.report.find(x => x[0] === 'CVD separation');
  const m = /ΔE ([\d.]+)/.exec(cvdLine[2] || '');
  return { ok: r.ok && cvdLine[1] === 'pass', cvd: m ? parseFloat(m[1]) : 0, report: r.report };
}
let best = null;
for (const tL of [0.50, 0.52, 0.54, 0.56])
for (const tH of [176, 182, 188, 194])
for (const tC of [0.10, 0.105, 0.11]) {
  const teal = mkc(tL, tC, tH);
  if (teal.c < 0.0995) continue;
  for (const azL of [0.46, 0.48, 0.50])
  for (const puL of [0.50, 0.53, 0.56])
  for (const teRL of [0.55, 0.58, 0.61])
  for (const orden of [['az','oc','te','pu','tr'], ['az','oc','te','tr','pu'], ['te','oc','az','pu','tr'], ['az','tr','te','oc','pu']]) {
    const c = {
      az: hex(mkc(azL, 0.115, 252)), oc: hex(mkc(0.64, 0.125, 78)),
      te: hex(teal), pu: hex(mkc(puL, 0.115, 300)), tr: hex(mkc(teRL, 0.135, 35)),
    };
    const pal = orden.map(k => c[k]);
    const r = evalua(pal, 'light', '#FBF9F4');
    if (r.ok && (!best || r.cvd > best.cvd)) best = { pal, orden, r, params: {tL,tH,tC,azL,puL,teRL} };
  }
}
if (best) {
  console.log('MEJOR LIGHT:', best.pal.join(','), 'orden', best.orden.join('>'), 'cvd', best.r.cvd, JSON.stringify(best.params));
} else console.log('sin candidato limpio');
