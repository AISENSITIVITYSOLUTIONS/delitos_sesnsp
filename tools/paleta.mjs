import { oklch, formatHex } from 'culori';
const mk = (l, c, h) => formatHex(oklch({ mode: 'oklch', l, c, h }));
// luz: L 0.43-0.77, C>=0.10
const light = {
  azul:      mk(0.50, 0.115, 252),  // azul marino medio
  ocre:      mk(0.63, 0.125, 75),   // ocre sobrio
  petroleo:  mk(0.52, 0.105, 190),  // verde petróleo
  purpura:   mk(0.52, 0.115, 300),  // púrpura discreta
  terracota: mk(0.55, 0.135, 35),   // terracota
};
// oscuro: L 0.48-0.67
const dark = {
  azul:      mk(0.62, 0.115, 252),
  ocre:      mk(0.66, 0.125, 75),
  petroleo:  mk(0.62, 0.105, 190),
  purpura:   mk(0.63, 0.110, 300),
  terracota: mk(0.63, 0.135, 35),
};
console.log('LIGHT', Object.values(light).join(','));
console.log('DARK ', Object.values(dark).join(','));
