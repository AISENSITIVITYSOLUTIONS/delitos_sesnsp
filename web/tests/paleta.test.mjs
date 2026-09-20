import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indiceCambio,colorDelito} from '../src/theme/paleta.ts';
test('variación conserva centro cero y simetría con magnitudes extremas',()=>{
 assert.equal(indiceCambio(0,100),3);
 for(const v of [.001,10,34,67,100,200])assert.equal(indiceCambio(v,100)+indiceCambio(-v,100),6);
 assert.equal(indiceCambio(100,100),6);assert.equal(indiceCambio(-100,100),0);
});
test('identidad del delito no depende del ranking y las modalidades conservan familia',()=>{
 const ids=['extorsion','homicidio-doloso','robo-de-vehiculo-automotor'];
 const base=Object.fromEntries(ids.map(k=>[k,colorDelito(k)]));
 for(const k of ids.reverse())assert.equal(colorDelito(k),base[k]);
 assert.equal(colorDelito('robo-de-vehiculo-automotor/con-violencia'),base['robo-de-vehiculo-automotor']);
 assert.equal(new Set(Object.values(base)).size,3);
});
