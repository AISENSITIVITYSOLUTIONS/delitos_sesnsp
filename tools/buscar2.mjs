import { oklch, formatHex, clampChroma } from 'culori';
import { execSync } from 'node:child_process';
const D = '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz';
const mk = (l, c, h) => formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
function probar(pal, mode, surface) {
  try {
    const out = execSync(`node ${D}/scripts/validate_palette.js "${pal.join(',')}" --mode ${mode} --surface "${surface}"`, {encoding:'utf8'});
    const pass = out.includes('ALL CHECKS PASS');
    const warn = out.includes('[WARN]');
    const m = out.match(/CVD separation\s+worst adjacent (#\w+)↔(#\w+) ΔE ([\d.]+)/);
    return { pass, warn, cvd: m ? parseFloat(m[3]) : 0 };
  } catch { return { pass:false, warn:true, cvd:0 }; }
}
// probar variaciones de L para separar pares problemáticos; orden fijo azul,ocre,petroleo,purpura,terracota
let mejores = [];
for (const pL of [0.44, 0.46, 0.48]) // petroleo más oscuro
for (const puL of [0.54, 0.57, 0.60]) // purpura más clara
for (const teL of [0.50, 0.53, 0.56]) // terracota
for (const puH of [295, 305]) {
  const light = [mk(0.50,0.115,252), mk(0.64,0.125,78), mk(pL,0.11,190), mk(puL,0.115,puH), mk(teL,0.135,35)];
  const r = probar(light, 'light', '#FBF9F4');
  mejores.push({pL,puL,teL,puH, cvd:r.cvd, pass:r.pass, warn:r.warn, light});
}
mejores.sort((a,b)=>b.cvd-a.cvd);
for (const m of mejores.slice(0,6)) console.log(JSON.stringify({...m, light:m.light.join(',')}));
