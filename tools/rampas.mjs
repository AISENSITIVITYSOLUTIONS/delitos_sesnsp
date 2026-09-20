import { formatHex, clampChroma } from 'culori';
import { validate, validateOrdinal, contrast } from '/tmp/claude-0/bundled-skills/2.1.278/a7125d2364160b70bb70e96cdecb42b2/dataviz/scripts/validate_palette.js';
const mkc = (l, c, h) => formatHex(clampChroma({ mode: 'oklch', l, c, h }, 'oklch'));
// Secuencial azul marino (magnitud), 7 pasos, claro→oscuro (modo claro)
const Ls = [0.90, 0.82, 0.73, 0.63, 0.53, 0.44, 0.35];
const Cs = [0.035, 0.055, 0.075, 0.095, 0.115, 0.115, 0.10];
const seqLight = Ls.map((l, i) => mkc(l, Cs[i], 252));
// modo oscuro: ancla invertida (valores bajos se hunden en la superficie oscura)
const LsD = [0.30, 0.38, 0.46, 0.54, 0.62, 0.70, 0.78];
const seqDark = LsD.map((l, i) => mkc(l, Cs[6 - i] ?? 0.1, 252));
console.log('SEQ_LIGHT', seqLight.join(','));
console.log('SEQ_DARK ', seqDark.join(','));
// Divergente petróleo ↔ terracota, 3 pasos por brazo + punto medio gris cálido neutro
const divL = [mkc(0.40,0.10,176), mkc(0.55,0.095,176), mkc(0.72,0.06,176), '#EDEAE2', mkc(0.72,0.075,35), mkc(0.55,0.12,35), mkc(0.40,0.115,35)];
const divD = [mkc(0.75,0.09,176), mkc(0.62,0.10,176), mkc(0.46,0.08,176), '#2B3947', mkc(0.46,0.09,35), mkc(0.62,0.12,35), mkc(0.75,0.10,35)];
console.log('DIV_LIGHT', divL.join(','));
console.log('DIV_DARK ', divD.join(','));
// contraste de tinta primaria/secundaria sobre superficies
console.log('contraste tinta clara #14212E sobre #FBF9F4:', contrast('#14212E', '#FBF9F4').toFixed(2));
console.log('contraste tinta secundaria #4E5A66 sobre #FBF9F4:', contrast('#4E5A66', '#FBF9F4').toFixed(2));
console.log('contraste tinta oscura #F2EFE7 sobre #12202E:', contrast('#F2EFE7', '#12202E').toFixed(2));
console.log('contraste secundaria oscura #A8B4BE sobre #12202E:', contrast('#A8B4BE', '#12202E').toFixed(2));
