import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambio, dias, medida, valorMes } from '../src/lib/altoImpacto.ts';
test('cambio: ceros, nulos y negativos no producen mejoras ficticias',()=>{
 assert.equal(cambio(80,100),-19.999999999999996);
 assert.equal(cambio(0,100),-100);
 for(const [a,b] of [[0,0],[1,0],[null,3],[3,null],[-1,3],[1,-3]])assert.equal(cambio(a,b),null);
});
test('promedio diario respeta bisiestos y tasas requieren población',()=>{
 assert.equal(dias('2024-02'),29);assert.equal(dias('2025-02'),28);
 assert.equal(medida(290,'2024-02','diario',{}),10);
 assert.equal(medida(100,'2025-02','tasa',{'2025':1000000}),10);
 assert.equal(medida(100,'2025-02','tasa',{}),null);
});
test('corte y ausencias se conservan aunque el archivo contenga ceros futuros',()=>{
 const s={meta:{corte:'2026-02'},meses:['2026-01','2026-02','2026-03'],series:{x:[0,null,0]}};
 assert.equal(valorMes(s,'x','2026-01'),0);assert.equal(valorMes(s,'x','2026-02'),null);
 assert.equal(valorMes(s,'x','2026-03'),null);assert.equal(valorMes(s,'y','2026-01'),null);
});
