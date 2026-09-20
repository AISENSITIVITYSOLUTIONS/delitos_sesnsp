import { oklch, formatHex, clampChroma } from 'culori';
import { execSync } from 'node:child_process';
const D = '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz';
const mk = (l, c, h) => formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
function probar(pal, mode, surface) {
  try {
    const out = execSync(`node ${D}/scripts/validate_palette.js "${pal.join(',')}" --mode ${mode} --surface "${surface}"`, {encoding:'utf8'});
    const pass = out.includes('ALL CHECKS PASS');
    const warn = out.includes('[WARN]');
    const m = out.match(/worst adjacent (#\w+)↔(#\w+) ΔE ([\d.]+) \((\w+)\)/);
    return { pass, warn, worst: m ? `${m[3]} ${m[4]}` : '?' };
  } catch (e) { return { pass:false, warn:true, worst:'FAIL' }; }
}
// orden: azul, ocre, petroleo, terracota, purpura
const combos = [];
for (const tL of [0.46, 0.48, 0.50]) for (const tH of [182, 188, 194]) for (const tC of [0.10, 0.11]) {
  combos.push({tL, tH, tC});
}
for (const c of combos) {
  const light = [mk(0.50,0.115,252), mk(0.63,0.125,75), mk(c.tL,c.tC,c.tH), mk(0.55,0.135,35), mk(0.52,0.115,300)];
  const rL = probar(light, 'light', '#FBF9F4');
  if (rL.pass && !rL.warn) {
    const dark = [mk(0.62,0.115,252), mk(0.66,0.125,75), mk(Math.min(c.tL+0.12,0.64),c.tC,c.tH), mk(0.63,0.135,35), mk(0.63,0.110,300)];
    const rD = probar(dark, 'dark', '#12202E');
    console.log('CANDIDATO', JSON.stringify(c), 'LIGHT', light.join(','), rL.worst, '| DARK', dark.join(','), rD.pass ? 'PASS' : 'NO', rD.warn ? 'warn' : 'limpio', rD.worst);
  }
}
console.log('fin');
