import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendario,diasMes,serieMandato} from '../src/lib/laboratorio.ts';
const sn={meses:['2024-01','2024-02','2024-03'],total:[310,290,null],series:{x:[310,290,null]}};
test('promedio diario respeta febrero bisiesto y mantiene ausencias',()=>{
 assert.equal(diasMes('2024-02'),29);
 const c=calendario(sn,'x','diario');assert.equal(c[0].valor,10);assert.equal(c[1].valor,10);assert.equal(c[2].valor,null);assert.equal(c[11].valor,null);
});
test('no fabrica un patrón con años incompletos',()=>assert.ok(calendario(sn,'x','patron').every(c=>c.valor===null)));
test('alineación de mandatos no confunde enero 2015 con primer mes',()=>{
 const s={meses:['2015-01','2018-12'],total:[42,99],series:{}};
 const p=serieMandato(s,'total','2012-12','2018-11',false);assert.equal(p[0],null);assert.equal(p[25],42);assert.equal(p.filter(v=>v!=null).length,1);
});
test('ceros observados se conservan; sin referencia positiva no hay porcentaje',()=>{
 const s={meses:Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`),total:Array(12).fill(0),series:{}};
 assert.equal(calendario(s,'total','conteo')[0].valor,0);assert.equal(calendario(s,'total','patron')[0].valor,null);
});
