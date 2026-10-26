import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valorAnual,cambioComparable,rankingAtlas} from '../src/lib/atlas.ts';
test('atlas: tasas requieren población válida y preservan ceros y ausencias',()=>{
 assert.equal(valorAnual(null,100,true),null);assert.equal(valorAnual(0,100,true),0);
 assert.equal(valorAnual(50,0,true),null);assert.equal(valorAnual(50,100000,true),50);
});
test('atlas: no compara años parciales, ausencias ni denominador cero',()=>{
 assert.equal(cambioComparable(30,50,9,12),null);assert.equal(cambioComparable(30,50,12,9),null);
 assert.equal(cambioComparable(30,0,12,12),null);assert.equal(cambioComparable(null,50,12,12),null);
 assert.equal(cambioComparable(75,50,12,12),50);
});
test('atlas: ranking excluye ausencias y no inventa posiciones sobre nulos',()=>{
 assert.deepEqual(rankingAtlas([{cve:'01',nombre:'A',valor:null},{cve:'02',nombre:'B',valor:0},{cve:'03',nombre:'C',valor:5}]).map(x=>x.cve),['03','02']);
});
