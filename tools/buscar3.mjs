import { formatHex, clampChroma } from 'culori';
import { validate } from '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz/scripts/validate_palette.js';
const mk = (l, c, h) => formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
const score = (res) => {
  // res.checks: array {name,status,detail}? — inspeccionar estructura una vez
  return res;
};
// inspección rápida de la estructura devuelta
const r = validate(["#2b65a2","#b5811c","#00605c","#745faa","#a14028"], {mode:'light', surface:'#FBF9F4'});
console.log(JSON.stringify(r, null, 1).slice(0, 1500));
